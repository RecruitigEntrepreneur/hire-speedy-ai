/**
 * V4.1 mit ECHTER KI gegen die 25 Headhunter-Fälle.
 *
 *   OPENROUTER_API_KEY=… AI_PROVIDER=openrouter npm run eval:v41
 *   LOVABLE_API_KEY=… npm run eval:v41 -- --only M07,M11 --repeat 3
 *   npm run eval:v41 -- --judge-only        # Verstehen aus den Musterantworten, nur das Urteil live
 *
 * Den Schlüssel setzt du selbst im Terminal (nie in den Chat). Er verlässt
 * diesen Rechner nur Richtung Anbieter. Die Fälle sind synthetisch, es gehen
 * keine echten Kandidatendaten raus.
 *
 * Misst je Fall: Stufe getroffen? Welche Kriterien weichen vom Musterurteil ab?
 * Wie viele Zitate hat die Prüfung verworfen? Kosten (Tokens) und Dauer.
 * Report nach evals/reports/<Zeit>-v41-catalogue.{json,md}.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleCandidateProfile, assembleJobProfile } from '../../supabase/functions/_shared/match-v41/understand';
import { judgePair, understandCandidate, understandJob, type AiCaller } from '../../supabase/functions/_shared/match-v41/pipeline';
import type { Tier } from '../../supabase/functions/_shared/match-v41/policy';
import { EVAL_NOW_MS, loadGoldenCases, TIER_BY_LABEL, toCandidateInput, toJobInput, toPrivate, type GoldenCase } from './cases';
import { ORACLE } from './oracle';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };

const provider = (process.env.AI_PROVIDER ?? (process.env.OPENROUTER_API_KEY && !process.env.LOVABLE_API_KEY ? 'openrouter' : 'lovable')).toLowerCase();
const key = provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.LOVABLE_API_KEY;
const model = opt('model') ?? process.env.AI_MODEL ?? 'google/gemini-3.6-flash';
const url = provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://ai.gateway.lovable.dev/v1/chat/completions';

if (!key) {
  console.error(`Kein Schlüssel: ${provider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'LOVABLE_API_KEY'} im Terminal setzen (export …), dann erneut starten.`);
  process.exit(2);
}

const usage = { calls: 0, prompt: 0, completion: 0, failures: 0 };

const liveAi: AiCaller = async (call) => {
  const body = {
    model,
    temperature: call.temperature ?? 0,
    messages: [{ role: 'system', content: call.system }, { role: 'user', content: call.user }],
    tools: [{ type: 'function', function: call.tool }],
    tool_choice: { type: 'function', function: { name: call.tool.name } },
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://matchunt.ai' } : {}) },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); continue; }
    if (!res.ok) { usage.failures++; throw new Error(`${provider} ${res.status}: ${text.slice(0, 300)}`); }
    const data = JSON.parse(text);
    usage.calls++;
    usage.prompt += data?.usage?.prompt_tokens ?? 0;
    usage.completion += data?.usage?.completion_tokens ?? 0;
    const raw = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    return { model: data?.model ?? model, toolArguments: raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null };
  }
  usage.failures++;
  throw new Error(`${provider}: dreimal überlastet`);
};

interface CaseRun {
  id: string;
  expected: string;
  acceptable: string[];
  got: string;
  hit_exact: boolean;
  hit_acceptable: boolean;
  exclusion: string | null;
  caps: string[];
  families: { job: string[]; cand: string[] };
  requirement_diffs: { text: string; oracle: string; live: string }[];
  rejected_quotes: number;
  must_not_claim_hits: string[];
  summary: string;
  ms: number;
}

async function runCase(c: GoldenCase): Promise<CaseRun> {
  const t0 = Date.now();
  const o = ORACLE[c.id];
  const jobInput = toJobInput(c);
  const candInput = toCandidateInput(c);
  const job = flag('judge-only')
    ? assembleJobProfile(jobInput, { families: o.job.families, seniority: o.job.seniority ?? c.job.seniority, requirements: o.job.requirements ?? [
      ...(c.job.unverzichtbar ?? []).map((t: string) => ({ text: t, class: 'must', kind: 'competence', evidence: [t] })),
      ...(c.job.verhandelbar ?? []).map((t: string) => ({ text: t, class: 'nice', kind: 'competence', evidence: [t] })),
      ...(c.job.lernbar ?? []).map((t: string) => ({ text: t, class: 'trainable', kind: 'competence', evidence: [t] })),
    ] })
    : (await understandJob(jobInput, liveAi)).value;
  const cand = flag('judge-only')
    ? assembleCandidateProfile(candInput, { families: o.cand.families })
    : (await understandCandidate(candInput, liveAi)).value;
  const res = (await judgePair(job, cand, toPrivate(c), candInput.redacted_text ?? '', EVAL_NOW_MS, liveAi)).value;

  const diffs = res.requirements.flatMap((r) => {
    const oracle = o.judge.verdicts[r.text]?.[0];
    return oracle && oracle !== r.status ? [{ text: r.text, oracle, live: r.status }] : [];
  });
  const text = [res.summary, ...res.reasons, ...res.gaps, ...res.talking_points].join(' ').toLowerCase();
  const expected = TIER_BY_LABEL[c.expected_tier];
  return {
    id: c.id,
    expected: c.expected_tier,
    acceptable: c.acceptable_tiers,
    got: res.label,
    hit_exact: res.tier === expected,
    hit_acceptable: c.acceptable_tiers.map((t) => TIER_BY_LABEL[t]).includes(res.tier),
    exclusion: res.exclusion?.text ?? null,
    caps: res.caps,
    families: { job: job.families, cand: cand.families },
    requirement_diffs: diffs,
    rejected_quotes: res.audit.rejected_quotes,
    must_not_claim_hits: (c.must_not_claim ?? []).filter((p) => text.includes(p.toLowerCase())),
    summary: res.summary,
    ms: Date.now() - t0,
  };
}

async function main() {
  const only = opt('only')?.split(',').map((s) => s.trim());
  const repeat = Number(opt('repeat') ?? 1);
  const cases = loadGoldenCases().filter((c) => !only || only.includes(c.id));
  const runs: CaseRun[] = [];
  for (let r = 0; r < repeat; r++) {
    for (const c of cases) {
      try {
        const run = await runCase(c);
        runs.push(run);
        console.log(`${run.hit_acceptable ? (run.hit_exact ? '✓' : '≈') : '✗'} ${run.id} erwartet ${run.expected.padEnd(14)} → ${run.got.padEnd(14)} ${run.exclusion ?? run.caps.join(' | ')}`);
      } catch (e) {
        console.log(`! ${c.id} Fehler: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  const n = runs.length || 1;
  const offDomainInMain = runs.filter((r) => ['Ausgeschlossen'].includes(r.expected) && ['Sehr passend', 'Passend'].includes(r.got)).length;
  const missedGood = runs.filter((r) => ['Sehr passend', 'Passend'].includes(r.expected) && ['Ausgeschlossen'].includes(r.got)).length;
  const summary = {
    model, provider, mode: flag('judge-only') ? 'judge-only' : 'full', repeat, cases: cases.length,
    exact: runs.filter((r) => r.hit_exact).length / n,
    acceptable: runs.filter((r) => r.hit_acceptable).length / n,
    unfit_shown_as_fit: offDomainInMain,
    fit_wrongly_excluded: missedGood,
    requirement_disagreements: runs.reduce((a, r) => a + r.requirement_diffs.length, 0),
    rejected_quotes: runs.reduce((a, r) => a + r.rejected_quotes, 0),
    must_not_claim_hits: runs.reduce((a, r) => a + r.must_not_claim_hits.length, 0),
    usage,
    avg_ms: Math.round(runs.reduce((a, r) => a + r.ms, 0) / n),
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = resolve(HERE, '../reports');
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `${stamp}-v41-catalogue.json`), JSON.stringify({ summary, runs }, null, 2));
  const md = [
    `# V4.1 Katalog-Lauf (${summary.mode})`,
    '',
    `Modell: ${model} über ${provider} · ${cases.length} Fälle × ${repeat}`,
    '',
    '| Kennzahl | Wert |', '|---|---|',
    `| Stufe genau getroffen | ${(summary.exact * 100).toFixed(0)} % |`,
    `| Stufe im erlaubten Bereich | ${(summary.acceptable * 100).toFixed(0)} % |`,
    `| Unpassende als passend gezeigt | ${summary.unfit_shown_as_fit} |`,
    `| Passende fälschlich ausgeschlossen | ${summary.fit_wrongly_excluded} |`,
    `| Kriterien anders als Musterurteil | ${summary.requirement_disagreements} |`,
    `| Verworfene Zitate | ${summary.rejected_quotes} |`,
    `| Verbotene Behauptungen | ${summary.must_not_claim_hits} |`,
    `| KI-Aufrufe / Tokens (ein/aus) | ${usage.calls} / ${usage.prompt} / ${usage.completion} |`,
    `| Dauer je Fall | ${summary.avg_ms} ms |`,
    '',
    '| Fall | erwartet | Ergebnis | Grund | Abweichungen |', '|---|---|---|---|---|',
    ...runs.map((r) => `| ${r.hit_acceptable ? (r.hit_exact ? '✓' : '≈') : '✗'} ${r.id} | ${r.expected} | ${r.got} | ${(r.exclusion ?? r.caps.join('; ')).replace(/\|/g, '/')} | ${r.requirement_diffs.map((d) => `${d.text}: ${d.oracle}→${d.live}`).join('; ').replace(/\|/g, '/')} |`),
  ].join('\n');
  writeFileSync(resolve(dir, `${stamp}-v41-catalogue.md`), `${md}\n`);
  console.log(`\nGenau: ${(summary.exact * 100).toFixed(0)} % · erlaubt: ${(summary.acceptable * 100).toFixed(0)} % · unpassend gezeigt: ${offDomainInMain} · passend verloren: ${missedGood}`);
  console.log(`Report: evals/reports/${stamp}-v41-catalogue.md`);
  process.exit(summary.unfit_shown_as_fit > 0 || summary.fit_wrongly_excluded > 0 ? 1 : 0);
}

void main();
