import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildNormalizerSystemPrompt,
  buildNormalizerUserPrompt,
  NORMALIZER_MODEL,
  NORMALIZER_PROMPT_VERSION,
  NORMALIZER_TOOL,
  sanitizeSkillRequirements,
} from "../_shared/match-v4.ts";

/**
 * Anforderungs-Normalizer (Phase 2.1): übersetzt Satzfragment-Must-haves in
 * kanonische Skill-Anforderungen und schreibt sie nach job_skill_requirements —
 * die Tabelle, die der Live-Matcher V3.1 bereits nativ bevorzugt liest.
 * Dadurch verbessert der Normalizer das BESTEHENDE Matching, ohne dessen Code
 * anzufassen.
 *
 * Bewusst NICHT: jobs.required_languages schreiben (würde den Language-Kill
 * scharf schalten, solange candidates.language_skills leer ist).
 * Sprach-/Sonstige Anforderungen werden nur im Ergebnis zurückgegeben.
 *
 * Flag: MATCH_V4_ENABLED (Supabase-Secret) muss "true" sein.
 * Aufruf: { jobId } für einen Job, { backfill: true, limit?: n } für die
 * nächsten n Jobs ohne Normalisierungs-Stempel (idempotent, wiederaufsetzbar).
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

interface NormalizeOutcome {
  jobId: string;
  title: string;
  ok: boolean;
  requirements?: { skill_name: string; type: string; weight: number }[];
  language_requirements?: unknown[];
  other_requirements?: unknown[];
  unrealistic?: unknown[];
  error?: string;
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

    const { jobId, backfill, limit = 10, force = false } = await req.json();

    let jobs: Record<string, unknown>[] = [];
    if (jobId) {
      const { data, error } = await supabase.from("jobs").select("*").eq("id", jobId).single();
      if (error || !data) return json({ error: "Job not found" }, 404);
      jobs = [data];
    } else if (backfill) {
      let query = supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(Math.min(Number(limit) || 10, 50));
      if (!force) query = query.is("requirements_normalized_at", null);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      jobs = data ?? [];
    } else {
      return json({ error: "jobId oder backfill:true erforderlich" }, 400);
    }

    const results: NormalizeOutcome[] = [];

    for (const job of jobs) {
      const outcome: NormalizeOutcome = { jobId: String(job.id), title: String(job.title ?? ""), ok: false };
      results.push(outcome);
      try {
        if (!job.title) {
          outcome.error = "Job ohne Titel — übersprungen";
          continue;
        }

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: NORMALIZER_MODEL,
            messages: [
              { role: "system", content: buildNormalizerSystemPrompt() },
              {
                role: "user",
                content: buildNormalizerUserPrompt({
                  title: job.title as string,
                  must_haves: job.must_haves as string[] | null,
                  nice_to_haves: job.nice_to_haves as string[] | null,
                  skills: job.skills as string[] | null,
                  experience_level: job.experience_level as string | null,
                  description: job.description as string | null,
                }),
              },
            ],
            tools: [{ type: "function", function: NORMALIZER_TOOL }],
            tool_choice: { type: "function", function: { name: NORMALIZER_TOOL.name } },
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error("AI Gateway error:", aiResponse.status, errText);
          outcome.error = `AI Gateway ${aiResponse.status}`;
          continue;
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall?.function?.arguments) {
          outcome.error = "Kein Tool-Call in der Antwort";
          continue;
        }
        const parsed = JSON.parse(toolCall.function.arguments);
        const requirements = sanitizeSkillRequirements(parsed.skill_requirements);
        if (requirements.length === 0) {
          outcome.error = "Normalizer lieferte keine verwertbaren Anforderungen";
          continue;
        }

        // Idempotent ersetzen: alte Zeilen raus, neue rein, Stempel setzen.
        const { error: delErr } = await supabase.from("job_skill_requirements").delete().eq("job_id", job.id);
        if (delErr) {
          outcome.error = `Delete fehlgeschlagen: ${delErr.message}`;
          continue;
        }
        const { error: insErr } = await supabase.from("job_skill_requirements").insert(
          requirements.map((r) => ({ job_id: job.id, skill_name: r.skill_name, type: r.type, weight: r.weight })),
        );
        if (insErr) {
          outcome.error = `Insert fehlgeschlagen: ${insErr.message}`;
          continue;
        }
        await supabase
          .from("jobs")
          .update({
            requirements_normalized_at: new Date().toISOString(),
            requirements_normalization_version: `${NORMALIZER_PROMPT_VERSION}/${NORMALIZER_MODEL}`,
          })
          .eq("id", job.id);

        await supabase.from("match_events").insert({
          event_type: "job_normalized",
          job_id: job.id,
          match_version: NORMALIZER_PROMPT_VERSION,
          model: NORMALIZER_MODEL,
          prompt_version: NORMALIZER_PROMPT_VERSION,
          payload: {
            requirements,
            language_requirements: parsed.language_requirements ?? [],
            other_requirements: parsed.other_requirements ?? [],
            unrealistic: parsed.unrealistic ?? [],
          },
        });

        outcome.ok = true;
        outcome.requirements = requirements;
        outcome.language_requirements = parsed.language_requirements ?? [];
        outcome.other_requirements = parsed.other_requirements ?? [];
        outcome.unrealistic = parsed.unrealistic ?? [];
      } catch (e) {
        console.error("normalize-job-requirements: job failed", job.id, e);
        outcome.error = e instanceof Error ? e.message : "Unbekannter Fehler";
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    console.log(`normalize-job-requirements: ${okCount}/${results.length} Jobs normalisiert`);
    return json({ normalized: okCount, total: results.length, results });
  } catch (error) {
    console.error("Error in normalize-job-requirements:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
