/**
 * Match V4.1 – die drei Stufen zusammengesteckt.
 *
 *   understandJob / understandCandidate  KI, einmal je Stelle bzw. Kandidat (Ergebnis wird gespeichert)
 *   judgePair                            Vorauswahl ohne KI → KI-Urteil nur, wenn nichts ausschließt → Stufe
 *
 * Der KI-Aufruf wird hereingereicht (`AiCaller`), damit dieselbe Logik in der
 * Edge Function (aiChat aus _shared/ai.ts) und in den Evals läuft.
 */

import { evaluateFrame } from './frame.ts';
import {
  buildCandidateSection, buildJobSection, buildJudgeSystemPrompt, buildJudgeUserPrompt,
  JUDGE_V41_PROMPT_VERSION, JUDGE_V41_TOOL, verifyJudgement,
} from './judge.ts';
import { decideTier, type MatchV41Result } from './policy.ts';
import type { CandidateProfile, JobProfile, PrivateMatchContext } from './profiles.ts';
import {
  assembleCandidateProfile, assembleJobProfile, buildCandidateSource, buildCandidateUnderstandSystemPrompt,
  buildJobUnderstandSystemPrompt, buildJobUnderstandUserPrompt, CANDIDATE_UNDERSTAND_TOOL, JOB_UNDERSTAND_TOOL,
  UNDERSTAND_PROMPT_VERSION, type CandidateInput, type JobInput,
} from './understand.ts';

/** Passt auf aiChat aus _shared/ai.ts; eigene Typen, damit die Evals ohne Deno laufen. */
export interface AiToolCall {
  system: string;
  user: string;
  tool: { name: string; description?: string; parameters: unknown };
  temperature?: number;
}
export type AiCaller = (call: AiToolCall) => Promise<{ toolArguments: Record<string, unknown> | null; model: string }>;

export interface Traced<T> {
  value: T;
  model: string | null;
  prompt_version: string;
  /** false, wenn die KI nicht antwortete und nur die strukturierten Daten zählen. */
  ai_ok: boolean;
  error?: string;
}

async function callTool(ai: AiCaller, system: string, user: string, tool: AiToolCall['tool']): Promise<{ args: unknown; model: string | null; error?: string }> {
  try {
    const res = await ai({ system, user, tool, temperature: 0 });
    return { args: res.toolArguments, model: res.model };
  } catch (e) {
    return { args: null, model: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function understandJob(input: JobInput, ai: AiCaller): Promise<Traced<JobProfile>> {
  const r = await callTool(ai, buildJobUnderstandSystemPrompt(), buildJobUnderstandUserPrompt(input), JOB_UNDERSTAND_TOOL);
  return { value: assembleJobProfile(input, r.args), model: r.model, prompt_version: UNDERSTAND_PROMPT_VERSION, ai_ok: !!r.args, error: r.error };
}

export async function understandCandidate(input: CandidateInput, ai: AiCaller): Promise<Traced<CandidateProfile>> {
  const r = await callTool(ai, buildCandidateUnderstandSystemPrompt(), buildCandidateSource(input), CANDIDATE_UNDERSTAND_TOOL);
  return { value: assembleCandidateProfile(input, r.args), model: r.model, prompt_version: UNDERSTAND_PROMPT_VERSION, ai_ok: !!r.args, error: r.error };
}

/**
 * Urteil für ein Paar. Schließt die Vorauswahl schon aus, wird die KI gar nicht
 * gefragt (spart Kosten, und der Grund ist ohnehin belegt). Antwortet die KI
 * nicht, bleiben alle Kriterien „unbekannt" – das Ergebnis ist dann höchstens
 * „Prüfen", nie ein falsches „Sehr passend".
 */
export async function judgePair(
  job: JobProfile,
  cand: CandidateProfile,
  priv: PrivateMatchContext,
  redactedFreeText: string,
  nowMs: number,
  ai: AiCaller,
): Promise<Traced<MatchV41Result>> {
  const frame = evaluateFrame(job, cand, priv, nowMs);
  const section = buildCandidateSection(cand, redactedFreeText);
  if (frame.exclusion) {
    return { value: decideTier(job, cand, frame, verifyJudgement(null, job, section)), model: null, prompt_version: JUDGE_V41_PROMPT_VERSION, ai_ok: true };
  }
  const r = await callTool(ai, buildJudgeSystemPrompt(), buildJudgeUserPrompt(buildJobSection(job), section), JUDGE_V41_TOOL);
  const judged = verifyJudgement(r.args, job, section);
  const value = decideTier(job, cand, frame, judged);
  if (!r.args) value.caps.push('KI-Urteil nicht verfügbar – nur Rahmen geprüft');
  return { value, model: r.model, prompt_version: JUDGE_V41_PROMPT_VERSION, ai_ok: !!r.args, error: r.error };
}
