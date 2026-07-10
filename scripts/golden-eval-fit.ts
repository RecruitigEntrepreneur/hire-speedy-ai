// ─── Golden-Eval: Match-Qualität roh vs. redigiert ──────────────────────────
// Beweist VOR dem Deploy, dass die PII-Redaktion die Fit-Bewertung nicht
// verschlechtert. Für N echte Submissions wird je ein Assessment aus dem ROHEN
// und aus dem REDIGIERTEN Prompt erzeugt (identischer Builder) und verglichen.
//
// Lauf:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... LOVABLE_API_KEY=... \
//   deno run --allow-net --allow-env scripts/golden-eval-fit.ts [N | id1,id2,...]
//
// Akzeptanz (Gate): Median |Δ overall_score| ≤ 3 UND Verdict-Übereinstimmung ≥ 95%.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { redactCandidateForLLM } from "../supabase/functions/_shared/pii-redaction.ts";
import { buildJobSection, buildRawView, buildUserPrompt, FIT_MODEL, FIT_TOOL, SYSTEM_PROMPT } from "../supabase/functions/_shared/fit-assessment.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

if (!SUPABASE_URL || !SERVICE_KEY || !LOVABLE_API_KEY) {
  console.error("Bitte SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY und LOVABLE_API_KEY setzen.");
  Deno.exit(2);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const DIMENSIONS = ["technical_fit", "experience_fit", "seniority_fit", "location_fit", "salary_fit", "culture_fit"];

function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function percentile(xs: number[], p: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGateway(userPrompt: string): Promise<any> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: FIT_MODEL,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt }],
      tools: [{ type: "function", function: FIT_TOOL }],
      tool_choice: { type: "function", function: { name: FIT_TOOL.name } },
    }),
  });
  if (!res.ok) throw new Error(`gateway ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("kein tool_call in der Antwort");
  return JSON.parse(args);
}

async function loadData(submissionId: string) {
  const { data: sub } = await supabase.from("submissions").select("id, candidate_id, job_id").eq("id", submissionId).single();
  if (!sub) return null;
  const [c, e, l, s, n, a, j] = await Promise.all([
    supabase.from("candidates").select("*").eq("id", sub.candidate_id).single(),
    supabase.from("candidate_experiences").select("*").eq("candidate_id", sub.candidate_id).order("start_date", { ascending: false }),
    supabase.from("candidate_languages").select("*").eq("candidate_id", sub.candidate_id),
    supabase.from("candidate_skills").select("*").eq("candidate_id", sub.candidate_id),
    supabase.from("candidate_interview_notes").select("*").eq("candidate_id", sub.candidate_id).order("created_at", { ascending: false }).limit(1),
    supabase.from("candidate_ai_assessment").select("*").eq("candidate_id", sub.candidate_id).maybeSingle(),
    supabase.from("jobs").select("*").eq("id", sub.job_id).single(),
  ]);
  if (!c.data || !j.data) return null;
  return {
    candidate: c.data, experiences: e.data || [], languages: l.data || [], skills: s.data || [],
    interviewNotes: n.data?.[0] || null, aiAssessment: a.data || null, job: j.data,
  };
}

function promptFor(d: any, redacted: boolean): string {
  const jobSection = buildJobSection(d.job);
  const view = redacted
    ? redactCandidateForLLM(d.candidate, d.experiences, d.skills, d.languages, d.interviewNotes, d.job.location ?? null, "on").view
    : buildRawView(d.candidate, d.experiences, d.skills, d.languages, d.interviewNotes, d.job);
  view.priorAssessment = d.aiAssessment
    ? { overall_score: d.aiAssessment.overall_score ?? null, risk_level: d.aiAssessment.risk_level ?? null, recommendation: d.aiAssessment.recommendation ?? null }
    : null;
  return buildUserPrompt(view, jobSection);
}

async function getSubmissionIds(arg: string | undefined): Promise<string[]> {
  if (arg && /[,-]/.test(arg) === false && /^\d+$/.test(arg) === false) return [arg];
  if (arg && arg.includes(",")) return arg.split(",").map((s) => s.trim()).filter(Boolean);
  const n = arg && /^\d+$/.test(arg) ? parseInt(arg, 10) : 25;
  const { data } = await supabase
    .from("candidate_fit_assessments")
    .select("submission_id")
    .order("generated_at", { ascending: false })
    .limit(n);
  return [...new Set((data || []).map((r: any) => r.submission_id))];
}

// ─── Run ────────────────────────────────────────────────────────────────────

const ids = await getSubmissionIds(Deno.args[0]);
console.log(`Golden-Eval über ${ids.length} Submissions (Modell ${FIT_MODEL})\n`);

const scoreDeltas: number[] = [];
const dimDeltas: Record<string, number[]> = Object.fromEntries(DIMENSIONS.map((d) => [d, []]));
let verdictMatches = 0, evaluated = 0, failed = 0, motivNullRaw = 0, motivNullRed = 0;
const rows: string[] = [];

for (const id of ids) {
  try {
    const d = await loadData(id);
    if (!d) { failed++; rows.push(`${id.slice(0, 8)}  — keine Daten`); continue; }
    const raw = await callGateway(promptFor(d, false));
    await sleep(400);
    const red = await callGateway(promptFor(d, true));
    await sleep(400);

    const dScore = Math.abs((raw.overall_score ?? 0) - (red.overall_score ?? 0));
    scoreDeltas.push(dScore);
    const vMatch = raw.overall_verdict === red.overall_verdict;
    if (vMatch) verdictMatches++;
    for (const dim of DIMENSIONS) {
      const rv = raw.dimension_scores?.[dim], cv = red.dimension_scores?.[dim];
      if (typeof rv === "number" && typeof cv === "number") dimDeltas[dim].push(Math.abs(rv - cv));
    }
    if (raw.motivation_fit == null) motivNullRaw++;
    if (red.motivation_fit == null) motivNullRed++;
    evaluated++;
    rows.push(`${id.slice(0, 8)}  Δscore=${dScore.toString().padStart(2)}  verdict ${vMatch ? "✓ " + raw.overall_verdict : "✗ " + raw.overall_verdict + "→" + red.overall_verdict}`);
  } catch (err) {
    failed++;
    rows.push(`${id.slice(0, 8)}  — Fehler: ${(err as Error).message}`);
  }
}

console.log(rows.join("\n"));

const medScore = median(scoreDeltas);
const p90Score = percentile(scoreDeltas, 90);
const verdictPct = evaluated ? (verdictMatches / evaluated) * 100 : 0;

console.log("\n──────────── Ergebnis ────────────");
console.log(`Bewertet: ${evaluated} | Fehler/übersprungen: ${failed}`);
console.log(`Δ overall_score:  Median ${medScore}  P90 ${p90Score}  Max ${scoreDeltas.length ? Math.max(...scoreDeltas) : "-"}`);
console.log(`Verdict-Übereinstimmung: ${verdictPct.toFixed(1)}%`);
console.log("Δ Dimension (Median):  " + DIMENSIONS.map((d) => `${d.replace("_fit", "")}=${median(dimDeltas[d])}`).join("  "));
console.log(`motivation_fit null: roh ${motivNullRaw} / redigiert ${motivNullRed}`);

const pass = evaluated > 0 && medScore <= 3 && verdictPct >= 95;
console.log(`\n${pass ? "✅ GO" : "❌ NO-GO"}  (Gate: Median Δscore ≤ 3 und Verdict ≥ 95%)`);
Deno.exit(pass ? 0 : 1);
