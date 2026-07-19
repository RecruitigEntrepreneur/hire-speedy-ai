import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Shadow-Batch-Runner: bewertet echte Submissions mit calculate-match-v4,
 * ohne irgendetwas im UI zu verändern (reine Messfahrt).
 *
 * Verarbeitet pro Aufruf `limit` Submissions ab `offset` (Edge-Function-
 * Zeitlimit!) und meldet zurück, ob weitere Batches nötig sind — so lange
 * erneut aufrufen, bis done=true. Judge-Ergebnisse landen im Pair-Cache
 * (match_ai_judgements), Wiederholungen sind daher billig.
 *
 * Demo-Seeds (aaaa…-Kandidaten, 1111…-Jobs) und bekannte Test-Jobs werden
 * übersprungen — dieselben Ausschlussregeln wie im Golden-Dataset-Builder.
 *
 * Flag: MATCH_V4_ENABLED muss "true" sein.
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

const SEED_CANDIDATE_RE = /^aaaa/;
const SEED_JOB_RE = /^(11111111|22222222|33333333|44444444|55555555|66666666)-/;
const TEST_ARTIFACT_JOBS = new Set([
  "2c4c9f21-aa8d-43ad-95a2-12d7ad98bee7", // location "teststadt"
  "6490d139-e7ad-49a3-a1df-449cf0da4631", // Gehalt 600k-5M, "top hunter"
]);

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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 8, 15);
    const offset = Number(body.offset) || 0;

    const { data: allSubmissions, error } = await supabase
      .from("submissions")
      .select("id, candidate_id, job_id, status")
      .order("submitted_at", { ascending: true });
    if (error) return json({ error: error.message }, 500);

    const production = (allSubmissions ?? []).filter(
      (s) =>
        !SEED_CANDIDATE_RE.test(s.candidate_id) &&
        !SEED_JOB_RE.test(s.job_id) &&
        !TEST_ARTIFACT_JOBS.has(s.job_id),
    );

    const batch = production.slice(offset, offset + limit);
    const results: Record<string, unknown>[] = [];

    for (const submission of batch) {
      try {
        const v4Response = await fetch(`${supabaseUrl}/functions/v1/calculate-match-v4`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            candidateId: submission.candidate_id,
            jobIds: [submission.job_id],
            judgeTopN: 1,
          }),
        });
        if (!v4Response.ok) {
          results.push({ submissionId: submission.id, error: `v4 ${v4Response.status}` });
          continue;
        }
        const v4 = await v4Response.json();
        const r = v4.results?.[0] ?? {};
        results.push({
          submissionId: submission.id,
          status: submission.status,
          v31_overall: r.v31?.overall ?? null,
          v31_policy: r.v31?.policy ?? null,
          killed: r.v31?.killed ?? null,
          judge_weighted: r.judge?.weighted ?? null,
          judge_cached: r.judge?.cached ?? null,
          blended: r.blended ?? null,
        });
      } catch (e) {
        results.push({
          submissionId: submission.id,
          error: e instanceof Error ? e.message : "Unbekannter Fehler",
        });
      }
    }

    const nextOffset = offset + batch.length;
    const done = nextOffset >= production.length;
    console.log(
      `run-v4-shadow-batch: ${nextOffset}/${production.length} Submissions verarbeitet (done=${done})`,
    );
    return json({
      done,
      processed: nextOffset,
      total: production.length,
      skippedSeeds: (allSubmissions ?? []).length - production.length,
      nextOffset: done ? null : nextOffset,
      results,
    });
  } catch (error) {
    console.error("Error in run-v4-shadow-batch:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
