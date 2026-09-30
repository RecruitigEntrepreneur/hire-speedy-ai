/**
 * Match V4.1 – Stufenregeln. Die KI liefert das Urteil je Kriterium, die Stufe
 * setzen diese festen, prüfbaren Regeln (Headhunter-Fachprüfung 30.09.2026):
 *
 *   Sehr passend  gleiche Berufsfamilie, alle unverzichtbaren Kriterien belegt
 *                 (mind. 2), Seniorität passt, Gehalt/Start/Ort bekannt und grün
 *   Passend       kein unverzichtbares Kriterium offen oder verfehlt (höchstens
 *                 eins teilweise), höchstens ein Prüfpunkt im Rahmen
 *   Prüfen        sonst, wenn nichts ausschließt – mit konkreten Klärfragen
 *   Ausgeschlossen belegter Ausschluss (Rahmen, andere Berufsfamilie, vom Kunden
 *                 bestätigtes Muss-Kriterium verfehlt) – sichtbar und übersteuerbar
 *
 * Fehlende Angaben sind nie ein Minus, sie deckeln nur die Stufe.
 */

import type { FrameItem, FrameResult } from './frame.ts';
import type { ReqStatus, VerifiedJudgement } from './judge.ts';
import type { CandidateProfile, JobProfile, ReqClass } from './profiles.ts';
import { familyRelation, MATCH_V41_VERSION, SENIORITY } from './profiles.ts';

export type Tier = 'sehr_passend' | 'passend' | 'pruefen' | 'ausgeschlossen';

export const TIER_LABEL: Record<Tier, string> = {
  sehr_passend: 'Sehr passend',
  passend: 'Passend',
  pruefen: 'Prüfen',
  ausgeschlossen: 'Ausgeschlossen',
};

export interface RequirementRow {
  id: string;
  text: string;
  class: ReqClass;
  status: ReqStatus;
  evidence: string;
  note: string;
}

export interface MatchV41Result {
  version: string;
  tier: Tier;
  label: string;
  /** Nur zum Sortieren innerhalb einer Stufe und als Tooltip – nie als Filter. */
  sort_score: number;
  /** 0–1: wie vollständig die Grundlage ist (unbekannte Kriterien/Rahmen senken sie). */
  confidence: number;
  exclusion: { code: string; text: string; overridable: true } | null;
  /** Warum die Stufe gedeckelt ist, für den Headhunter lesbar. */
  caps: string[];
  requirements: RequirementRow[];
  frame: FrameItem[];
  summary: string;
  reasons: string[];
  gaps: string[];
  talking_points: string[];
  audit: { rejected_quotes: number; scrubbed: number; missing_ids: string[] };
}

const RANK: Tier[] = ['ausgeschlossen', 'pruefen', 'passend', 'sehr_passend'];
const cap = (t: Tier, max: Tier): Tier => (RANK.indexOf(t) > RANK.indexOf(max) ? max : t);

export function decideTier(
  job: JobProfile,
  cand: CandidateProfile,
  frame: FrameResult,
  judged: VerifiedJudgement,
): MatchV41Result {
  const rows: RequirementRow[] = job.requirements.map((q, i) => {
    const v = judged.requirements[i];
    return { id: q.id, text: q.text, class: q.class, status: v.status, evidence: v.evidence, note: v.note };
  });
  const musts = rows.filter((r) => r.class === 'must');
  const mustReq = (id: string) => job.requirements.find((q) => q.id === id)!;
  const count = (s: ReqStatus, list = musts) => list.filter((r) => r.status === s).length;

  // Mehr Erfahrung ist nie ein Minus (Überqualifikation ist ein Altersindiz): liegt der
  // Kandidat laut Profil auf oder über der Ebene der Stelle, zählt die Seniorität als passend.
  const seniorityFit = cand.seniority && job.seniority && SENIORITY.indexOf(cand.seniority) >= SENIORITY.indexOf(job.seniority)
    ? 'fits'
    : judged.seniority_fit;

  const caps: string[] = [];
  const base = (tier: Tier, exclusion: MatchV41Result['exclusion']): MatchV41Result => ({
    version: MATCH_V41_VERSION,
    tier,
    label: TIER_LABEL[tier],
    sort_score: sortScore(rows),
    confidence: confidenceOf(rows, frame),
    exclusion,
    caps,
    requirements: rows,
    frame: frame.items,
    summary: judged.summary,
    reasons: reasonsOf(judged, frame),
    gaps: gapsOf(rows, frame),
    talking_points: talkingPointsOf(judged, frame),
    audit: { rejected_quotes: judged.rejected_quotes, scrubbed: judged.scrubbed, missing_ids: judged.missing_ids },
  });

  // 1. Belegte Ausschlüsse aus dem Rahmen (Sperrliste, Präsenz, Visum, Sprache, Gehalt).
  if (frame.exclusion) {
    return base('ausgeschlossen', { code: frame.exclusion.key, text: frame.exclusion.text, overridable: true });
  }

  // 2. Berufsfamilie: KI-Einschätzung und Profile müssen zusammen „anders" ergeben.
  const rel = familyRelation(cand.families, job.families);
  if (judged.role_fit === 'different' && rel !== 'same') {
    return base('ausgeschlossen', { code: 'family', text: 'Andere Berufsfamilie', overridable: true });
  }
  if (rel === 'different' && judged.role_fit === 'unknown') {
    return base('ausgeschlossen', { code: 'family', text: 'Andere Berufsfamilie', overridable: true });
  }

  // 3. Unverzichtbares Kriterium verfehlt.
  const failedConfirmed = musts.filter((r) => r.status === 'not_met' && mustReq(r.id).class_confirmed);
  if (failedConfirmed.length > 0) {
    return base('ausgeschlossen', {
      code: 'must',
      text: `Unverzichtbar, aber nicht erfüllt: ${failedConfirmed.map((r) => r.text).join('; ')}`,
      overridable: true,
    });
  }
  if (musts.length >= 2 && count('not_met') * 2 >= musts.length) {
    return base('ausgeschlossen', { code: 'must', text: 'Die meisten Muss-Kriterien sind nicht erfüllt', overridable: true });
  }

  // 4. Stufe aus Kriterien und Rahmen.
  const frameChecks = frame.items.filter((i) => i.status === 'check');
  const frameKeyOk = (k: FrameItem['key']) => frame.items.find((i) => i.key === k)?.status === 'ok';
  const coreFrameGreen = (['salary', 'start', 'location', 'work_model'] as const).every(frameKeyOk)
    && !frame.items.some((i) => i.key === 'language' && i.status !== 'ok')
    && !frame.items.some((i) => i.key === 'visa' && i.status !== 'ok');

  let tier: Tier;
  const allMet = musts.length > 0 && count('met') === musts.length;
  if (allMet && musts.length >= 2 && judged.role_fit === 'same' && seniorityFit === 'fits' && coreFrameGreen) {
    tier = 'sehr_passend';
  } else if (musts.length > 0 && count('not_met') === 0 && count('unknown') === 0 && count('partial') <= 1 && frameChecks.length <= 1) {
    tier = 'passend';
  } else {
    tier = 'pruefen';
  }

  // 5. Deckel mit Begründung.
  if (musts.length === 0) {
    tier = cap(tier, 'pruefen');
    caps.push('Stelle hat keine prüfbaren Muss-Kriterien');
  }
  if (musts.some((r) => r.status === 'not_met')) {
    tier = cap(tier, 'pruefen');
    caps.push('Ein Muss-Kriterium (Vorschlag der KI, nicht vom Kunden bestätigt) ist nicht erfüllt');
  }
  if (judged.role_fit === 'adjacent' || rel === 'adjacent') {
    if (!allMet) {
      tier = cap(tier, 'pruefen');
      caps.push('Nachbar-Berufsfamilie ohne vollständige Belege');
    } else {
      tier = cap(tier, 'passend');
    }
  }
  if (seniorityFit === 'far_off') {
    tier = cap(tier, 'pruefen');
    caps.push('Seniorität mehr als eine Stufe unter der Stelle');
  }
  if (frame.items.some((i) => i.key === 'salary' && i.status === 'check' && /unter Budget/.test(i.text))) {
    tier = cap(tier, 'pruefen');
    caps.push('Gehaltswunsch deutlich unter Budget – Ebene prüfen');
  }
  if (frame.items.some((i) => i.key === 'employment' && i.status === 'check')) {
    tier = cap(tier, 'pruefen');
    caps.push('Anstellungsart unterschiedlich');
  }
  if (frame.items.some((i) => i.key === 'visa' && i.status === 'check')) {
    tier = cap(tier, 'pruefen');
    caps.push('Visum nötig, Sponsoring beim Kunden klären');
  }
  if (frame.items.some((i) => i.key === 'start' && i.status === 'check')) {
    tier = cap(tier, 'pruefen');
    caps.push('Dringende Besetzung, Kündigungsfrist deutlich länger');
  }

  return base(tier, null);
}

function sortScore(rows: RequirementRow[]): number {
  const w = (c: ReqClass) => (c === 'must' ? 1 : c === 'nice' ? 0.5 : 0.25);
  const v = (s: ReqStatus) => (s === 'met' ? 1 : s === 'partial' ? 0.5 : s === 'unknown' ? 0.3 : 0);
  const total = rows.reduce((a, r) => a + w(r.class), 0);
  if (total === 0) return 50;
  return Math.round((rows.reduce((a, r) => a + w(r.class) * v(r.status), 0) / total) * 100);
}

function confidenceOf(rows: RequirementRow[], frame: FrameResult): number {
  const musts = rows.filter((r) => r.class === 'must');
  const reqKnown = musts.length ? musts.filter((r) => r.status !== 'unknown').length / musts.length : 0.3;
  const core = frame.items.filter((i) => ['salary', 'start', 'location', 'work_model', 'language'].includes(i.key));
  const frameKnown = core.length ? core.filter((i) => i.status !== 'unknown').length / core.length : 0.5;
  return Math.round((0.7 * reqKnown + 0.3 * frameKnown) * 100) / 100;
}

function reasonsOf(j: VerifiedJudgement, frame: FrameResult): string[] {
  const out = [...j.strengths];
  for (const i of frame.items) if (i.status === 'ok' && (i.key === 'salary' || i.key === 'location') && out.length < 3) out.push(i.text);
  return out.slice(0, 3);
}

function gapsOf(rows: RequirementRow[], frame: FrameResult): string[] {
  const out: string[] = [];
  for (const r of rows.filter((x) => x.class === 'must')) {
    if (r.status === 'not_met') out.push(`fehlt: ${r.text}`);
    else if (r.status === 'partial') out.push(`teilweise: ${r.text}`);
    else if (r.status === 'unknown') out.push(`offen: ${r.text}`);
  }
  for (const i of frame.items) if (i.status === 'check' || i.status === 'unknown') out.push(i.text);
  return out.slice(0, 5);
}

function talkingPointsOf(j: VerifiedJudgement, frame: FrameResult): string[] {
  const out = [...j.talking_points];
  for (const i of frame.items) if (i.status === 'check' && out.length < 4) out.push(i.text);
  return out.slice(0, 4);
}
