import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { assertNoLeak, redactCandidateForLLM } from "../_shared/pii-redaction.ts";
import { buildJobSection } from "../_shared/fit-assessment.ts";
import {
  blendOverall,
  buildJudgeSystemPrompt,
  buildJudgeUserPrompt,
  buildV31Summary,
  enforceEvidence,
  JUDGE_MODEL,
  JUDGE_PROMPT_VERSION,
  JUDGE_TOOL,
  judgeWeightedScore,
  MATCH_V4_VERSION,
} from "../_shared/match-v4.ts";

/**
 * Match V4 (Shadow): erweitert das bestehende Matching, ersetzt es nicht.
 *
 * Stufe 1: calculate-match-v3-1 (unverändert, interner Aufruf) — Hard-Kills,
 *          Dealbreaker und strukturierter Fit bleiben die Geschäftsregeln.
 * Stufe 2: Evidenzbasierter LLM-Judge für die Top-N nicht-gekillten Paare
 *          (PII-redaktiert, Fail-closed-Leak-Check, Pair-Cache).
 * Stufe 3: Blending (pure Logik in _shared/match-v4.ts, im Harness getestet).
 * Stufe 4: Lern-Schleife — jedes Ergebnis nach match_events (Shadow-Log,
 *          Ergebnisse werden noch NICHT im UI angezeigt).
 *
 * Flag: MATCH_V4_ENABLED. Rollback = Flag aus; V3.1 bleibt unberührt.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if ((Deno.env.get("MATCH_V4_ENABLED") ?? "").toLowerCase() !== "true") {
      return json({ disabled: true, error: "MATCH_V4_ENABLED ist nicht gesetzt" }, 403);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return json({ error: "LOVABLE_API_KEY not configured" }, 500);
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { candidateId, jobIds, judgeTopN = 5, force = false } = await req.json();
    if (!candidateId || !Array.isArray(jobIds) || jobIds.length === 0) {
      return json({ error: "candidateId und jobIds[] sind erforderlich" }, 400);
    }

    // Stufe 1: bestehende Engine unverändert aufrufen
    const v31Response = await fetch(`${supabaseUrl}/functions/v1/calculate-match-v3-1`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ candidateId, jobIds, mode: "preview" }),
    });
    if (!v31Response.ok) {
      const errText = await v31Response.text();
      console.error("calculate-match-v3-1 failed:", v31Response.status, errText);
      return json({ error: "V3.1-Stufe fehlgeschlagen" }, 502);
    }
    const v31Data = await v31Response.json();
    const v31Results: Record<string, any>[] = v31Data.results ?? [];

    // Kandidaten-Daten einmal laden (Muster von assess-candidate-fit)
    const [candidateRes, experiencesRes, languagesRes, skillsRes] = await Promise.all([
      supabase.from("candidates").select("*").eq("id", candidateId).single(),
      supabase.from("candidate_experiences").select("*").eq("candidate_id", candidateId).order("start_date", { ascending: false }),
      supabase.from("candidate_languages").select("*").eq("candidate_id", candidateId),
      supabase.from("candidate_skills").select("*").eq("candidate_id", candidateId),
    ]);
    const candidate = candidateRes.data;
    if (!candidate) return json({ error: "Candidate not found" }, 404);
    const experiences = experiencesRes.data ?? [];
    const languages = languagesRes.data ?? [];
    const skills = skillsRes.data ?? [];

    const { data: jobs } = await supabase.from("jobs").select("*").in("id", jobIds);
    const jobById = new Map((jobs ?? []).map((j: any) => [j.id, j]));

    // Judge-Kandidaten: Top-N nach V3.1-Score, Hard-Kills bleiben draußen.
    // Bewusst INKLUSIVE excluded/hidden — der Judge kann zu Unrecht versteckte
    // Kandidaten rehabilitieren (93%-Hidden-Befund aus dem Eval).
    const judgeTargets = v31Results
      .filter((r) => !r.killed && jobById.has(r.jobId))
      .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))
      .slice(0, Math.min(Number(judgeTopN) || 5, 10));

    const redactionMode = (Deno.env.get("PII_REDACTION_MODE") ?? "on").toLowerCase();
    const results: Record<string, unknown>[] = [];
    let judgeCalls = 0;
    let cacheHits = 0;

    for (const v31 of v31Results) {
      const job = jobById.get(v31.jobId);
      const base = { jobId: v31.jobId, version: MATCH_V4_VERSION, v31, judge: null as unknown, blended: v31.overall ?? 0 };
      results.push(base);
      if (!job || !judgeTargets.includes(v31)) continue;

      try {
        // PII-Redaktion pro Job (Stellenort beeinflusst die Orts-Generalisierung)
        const redaction = redactCandidateForLLM(candidate, experiences, skills, languages, null, job.location ?? null, redactionMode);
        const view = redaction.view;
        const viewJson = JSON.stringify(view, null, 1);
        const jobSection = buildJobSection(job);
        const v31Summary = buildV31Summary(v31 as never);

        const inputHash = await sha256(
          JSON.stringify({ candidateId, jobId: job.id, viewJson, jobSection, v31Summary, JUDGE_MODEL, JUDGE_PROMPT_VERSION }),
        );

        if (!force) {
          const { data: cached } = await supabase
            .from("match_ai_judgements")
            .select("*")
            .eq("candidate_id", candidateId)
            .eq("job_id", job.id)
            .eq("input_hash", inputHash)
            .maybeSingle();
          if (cached) {
            cacheHits++;
            base.judge = { ...cached.dimensions, cached: true, weighted: cached.weighted_score };
            base.blended = cached.blended_score ?? blendOverall(v31.overall ?? 0, cached.weighted_score);
            continue;
          }
        }

        const userPrompt = buildJudgeUserPrompt(viewJson, jobSection, v31Summary);
        if (redactionMode !== "off") {
          const candidatePart = userPrompt.split(jobSection).join(" ");
          const leaks = assertNoLeak(candidatePart, redaction.leakContext);
          if (leaks.length > 0) {
            console.error("calculate-match-v4: PII leak safeguard triggered", JSON.stringify(leaks));
            continue; // Paar überspringen statt PII zu senden — fail closed
          }
        }

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: JUDGE_MODEL,
            messages: [
              { role: "system", content: buildJudgeSystemPrompt() },
              { role: "user", content: userPrompt },
            ],
            tools: [{ type: "function", function: JUDGE_TOOL }],
            tool_choice: { type: "function", function: { name: JUDGE_TOOL.name } },
          }),
        });
        judgeCalls++;

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error("AI Gateway error (judge):", aiResponse.status, errText);
          continue; // V3.1-Ergebnis bleibt als Fallback bestehen
        }
        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall?.function?.arguments) continue;

        const judge = enforceEvidence(JSON.parse(toolCall.function.arguments));
        const weighted = judgeWeightedScore(judge);
        const blended = blendOverall(v31.overall ?? 0, weighted);

        await supabase.from("match_ai_judgements").upsert(
          {
            candidate_id: candidateId,
            job_id: job.id,
            input_hash: inputHash,
            judge_model: JUDGE_MODEL,
            prompt_version: JUDGE_PROMPT_VERSION,
            dimensions: judge,
            weighted_score: weighted,
            v31_score: v31.overall ?? 0,
            blended_score: blended,
            red_flags: judge.red_flags ?? [],
            summary: judge.summary ?? null,
          },
          { onConflict: "candidate_id,job_id,input_hash" },
        );

        base.judge = { ...judge, weighted, cached: false };
        base.blended = blended;
      } catch (e) {
        console.error("calculate-match-v4: judge failed for job", v31.jobId, e);
      }
    }

    // Lern-Schleife: Shadow-Ergebnisse loggen (Ranking nach blended Score)
    const ranked = [...results].sort((a, b) => (b.blended as number) - (a.blended as number));
    const events = ranked.map((r, idx) => ({
      event_type: "v4_scored",
      candidate_id: candidateId,
      job_id: r.jobId,
      rank: idx + 1,
      score: r.blended,
      match_version: MATCH_V4_VERSION,
      model: JUDGE_MODEL,
      prompt_version: JUDGE_PROMPT_VERSION,
      payload: {
        shadow: true,
        v31_overall: (r.v31 as Record<string, unknown>).overall,
        v31_policy: (r.v31 as Record<string, unknown>).policy,
        judged: r.judge !== null,
      },
    }));
    const { error: evErr } = await supabase.from("match_events").insert(events);
    if (evErr) console.error("match_events insert failed:", evErr.message);

    console.log(
      `V4 shadow: ${results.length} Paare, ${judgeCalls} Judge-Calls, ${cacheHits} Cache-Hits`,
    );
    return json({
      version: MATCH_V4_VERSION,
      shadow: true,
      candidateId,
      judgeCalls,
      cacheHits,
      results,
    });
  } catch (error) {
    console.error("Error in calculate-match-v4:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
