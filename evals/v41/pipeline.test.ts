/**
 * V4.1 gegen die 25 Headhunter-Fälle – mit Musterantworten statt echter KI.
 *
 * Prüft alles um die KI herum: Profile bauen, Zitate prüfen, Vorauswahl,
 * Stufenregeln. Dazu die Gegenproben, auf die es beim Headhunter ankommt:
 *   - erfindet die KI Belege, landet nichts über „Prüfen"
 *   - fällt die KI aus, landet nichts über „Prüfen"
 *   - Worttreffer („JavaScript" für Java) zählen nie als Beleg
 */

import { describe, expect, it } from 'vitest';
import { assembleCandidateProfile, assembleJobProfile } from '../../supabase/functions/_shared/match-v41/understand';
import { judgePair, type AiCaller } from '../../supabase/functions/_shared/match-v41/pipeline';
import type { JobProfile } from '../../supabase/functions/_shared/match-v41/profiles';
import { buildCandidateSection } from '../../supabase/functions/_shared/match-v41/judge';
import type { Tier } from '../../supabase/functions/_shared/match-v41/policy';
import { EVAL_NOW_MS, loadGoldenCases, TIER_BY_LABEL, toCandidateInput, toJobInput, toPrivate, type GoldenCase } from './cases';
import { ORACLE, type Oracle } from './oracle';

const cases = loadGoldenCases();
const RANK: Tier[] = ['ausgeschlossen', 'pruefen', 'passend', 'sehr_passend'];

function oracleJobAnswer(c: GoldenCase, o: Oracle) {
  const fromClient = [
    ...(c.job.unverzichtbar ?? []).map((t: string) => ({ text: t, class: 'must' })),
    ...(c.job.verhandelbar ?? []).map((t: string) => ({ text: t, class: 'nice' })),
    ...(c.job.lernbar ?? []).map((t: string) => ({ text: t, class: 'trainable' })),
  ].map((r) => ({ ...r, kind: 'competence', alternatives: [], min_years: null, regulated: false, evidence: [r.text] }));
  return {
    families: o.job.families,
    seniority: o.job.seniority ?? c.job.seniority ?? null,
    requirements: o.job.requirements ?? fromClient,
    languages: (c.job.required_languages ?? []).map((l: any) => ({
      language: l.language,
      min_level: String(l.min_level).toLowerCase(),
      customer_facing: (o.job.customer_facing ?? []).includes(l.language === 'Deutsch' ? 'de' : l.language === 'Englisch' ? 'en' : l.language),
    })),
    dropped: o.job.dropped ?? [],
  };
}

function build(c: GoldenCase) {
  const o = ORACLE[c.id];
  const job = assembleJobProfile(toJobInput(c), oracleJobAnswer(c, o));
  const cand = assembleCandidateProfile(toCandidateInput(c), { families: o.cand.families, seniority: null, competencies: [], qualifications: [] });
  return { o, job, cand, priv: toPrivate(c), free: toCandidateInput(c).redacted_text ?? '' };
}

const oracleAi = (job: JobProfile, o: Oracle): AiCaller => async () => ({
  model: 'oracle',
  toolArguments: {
    requirements: job.requirements.map((q) => {
      const [status, evidence] = o.judge.verdicts[q.text] ?? ['unknown'];
      return { id: q.id, status, evidence: evidence ?? '', note: '' };
    }),
    role_fit: o.judge.role_fit,
    seniority_fit: o.judge.seniority_fit,
    summary: 'Musterurteil.',
    strengths: [],
    gaps: [],
    talking_points: [],
  },
});

describe('V4.1 – 25 Headhunter-Fälle mit Musterurteil', () => {
  it('jeder Fall hat ein Musterurteil', () => {
    expect(cases.map((c) => c.id).filter((id) => !ORACLE[id])).toEqual([]);
  });

  for (const c of cases) {
    it(`${c.id} → ${c.acceptable_tiers.join(' / ')}  [${c.tags.join(', ')}]`, async () => {
      const { o, job, cand, priv, free } = build(c);
      const res = (await judgePair(job, cand, priv, free, EVAL_NOW_MS, oracleAi(job, o))).value;
      const acceptable = c.acceptable_tiers.map((t) => TIER_BY_LABEL[t]);
      if (process.env.V41_REPORT) console.log(`${c.id} erwartet ${c.expected_tier.padEnd(14)} → ${res.label.padEnd(14)} ${res.exclusion?.text ?? res.caps.join(' | ')} || ${res.frame.map((f) => `${f.key}=${f.status}`).join(' ')}`);
      expect(acceptable, `${c.id}: ${res.label}${res.exclusion ? ` (${res.exclusion.text})` : ''}; Deckel: ${res.caps.join(' | ')}; Rahmen: ${res.frame.map((f) => `${f.key}=${f.status}`).join(', ')}`).toContain(res.tier);
      // Musterzitate müssen die Zitatprüfung bestehen – sonst ist das Musterurteil oder die Prüfung falsch.
      expect(res.audit.rejected_quotes, `${c.id}: verworfene Zitate`).toBe(0);
      // Triple-Blind: kein Firmenname in irgendeinem Text für den Headhunter.
      if (c.job.company) expect(JSON.stringify(res)).not.toContain(c.job.company);
    });
  }
});

describe('V4.1 – Gegenproben', () => {
  it('erfundene Belege heben keinen Fall über „Prüfen"', async () => {
    for (const c of cases) {
      const { o, job, cand, priv, free } = build(c);
      const liar: AiCaller = async () => ({
        model: 'liar',
        toolArguments: {
          requirements: job.requirements.map((q) => ({ id: q.id, status: 'met', evidence: `zehn Jahre ${q.text} in leitender Funktion`, note: '' })),
          role_fit: 'same', seniority_fit: 'fits', summary: '', strengths: [], gaps: [], talking_points: [],
        },
      });
      const res = (await judgePair(job, cand, priv, free, EVAL_NOW_MS, liar)).value;
      if (job.requirements.length > 0) expect(RANK.indexOf(res.tier), `${c.id} → ${res.label}`).toBeLessThanOrEqual(RANK.indexOf('pruefen'));
      void o;
    }
  });

  it('KI-Ausfall: nichts über „Prüfen", belegte Ausschlüsse bleiben', async () => {
    const down: AiCaller = async () => { throw new Error('gateway 503'); };
    for (const c of cases) {
      const { job, cand, priv, free } = build(c);
      const r = await judgePair(job, cand, priv, free, EVAL_NOW_MS, down);
      expect(RANK.indexOf(r.value.tier), `${c.id}`).toBeLessThanOrEqual(RANK.indexOf('pruefen'));
      if (['M05', 'M12', 'M16', 'M20', 'M25'].includes(c.id)) expect(r.value.tier).toBe('ausgeschlossen');
    }
  });

  it('Rahmen-Ausschluss fragt die KI gar nicht erst (Kosten)', async () => {
    let calls = 0;
    const counting: AiCaller = async () => { calls++; return { model: 'x', toolArguments: null }; };
    for (const id of ['M05', 'M12', 'M16', 'M20', 'M25']) {
      const { job, cand, priv, free } = build(cases.find((c) => c.id === id)!);
      await judgePair(job, cand, priv, free, EVAL_NOW_MS, counting);
    }
    expect(calls).toBe(0);
  });

  it('Worttreffer zählen nicht: JavaScript ≠ Java, Qualitätscontrolling ≠ Controlling, Stammdatenpflege ≠ Pflege', async () => {
    const traps: [string, string, string][] = [
      ['M13', 'Java', 'Java'],
      ['M11', 'SAP CO', 'Controlling'],
      ['M23', 'Examinierte Pflegefachkraft (Altenpflege oder generalistisch)', 'Pflege'],
    ];
    for (const [id, reqText, fakeQuote] of traps) {
      const { job, cand, priv, free } = build(cases.find((c) => c.id === id)!);
      const fooled: AiCaller = async () => ({
        model: 'fooled',
        toolArguments: {
          requirements: job.requirements.map((q) => ({ id: q.id, status: q.text === reqText ? 'met' : 'unknown', evidence: q.text === reqText ? fakeQuote : '', note: '' })),
          role_fit: 'same', seniority_fit: 'fits', summary: '', strengths: [], gaps: [], talking_points: [],
        },
      });
      const res = (await judgePair(job, cand, priv, free, EVAL_NOW_MS, fooled)).value;
      const row = res.requirements.find((r) => r.text === reqText)!;
      expect(row.status, `${id}: „${fakeQuote}" darf kein Beleg sein`).toBe('unknown');
      expect(res.audit.rejected_quotes).toBe(1);
    }
  });

  it('Überqualifikation wird nicht bestraft (Kandidat über der Ebene der Stelle)', async () => {
    const c = cases.find((x) => x.id === 'M21')!; // Stelle mid, Kandidatin senior
    const { o, job, cand, priv, free } = build(c);
    const res = (await judgePair(job, cand, priv, free, EVAL_NOW_MS, oracleAi(job, { ...o, judge: { ...o.judge, seniority_fit: 'far_off' } }))).value;
    expect(res.tier).toBe('sehr_passend');
  });
});

describe('V4.1 – Kandidatenteil für die KI', () => {
  it('enthält weder Gehalt noch Ort, Kündigungsfrist oder Sperrliste', () => {
    const c = cases.find((x) => x.id === 'M20')!;
    const { cand, free } = build(c);
    const section = buildCandidateSection(cand, free);
    expect(section).not.toMatch(/Medtech Beta|90000|85000|Hamburg|3_months|hybrid/);
    expect(section).toContain('Klinikvertrieb');
  });
});
