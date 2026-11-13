// Server-Texte in der Sprache des Lesers (Mehrsprachigkeit 13.11.2026): Kunden-Aufgaben,
// Glocke, Liga-Mails. Ohne Sprache Deutsch wie bisher, mit 'sv' Schwedisch.
import { deriveClientTasks, noticeLabel, nonStartReason, regionBroad, type ClientTaskInput } from '../functions/_shared/client-tasks.ts';
import { awardMailContent, weeklyContent } from '../functions/_shared/liga.ts';
import { dateKeyIn, m, textsFor, tx } from '../functions/_shared/notify-i18n.ts';

const eq = (a: unknown, b: unknown, msg = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)}`); };
const assert = (v: unknown, msg = 'Assertion failed') => { if (!v) throw new Error(msg); };

const NOW = Date.parse('2026-10-23T12:00:00Z');
const JOB = 'j0000000-0000-4000-8000-000000000001';
const REC = 'r0000000-0000-4000-8000-000000000001';
const SUB = 's0000000-0000-4000-8000-000000000001';
const CAND = 'c0000000-0000-4000-8000-000000000001';
const IV = 'i0000000-0000-4000-8000-000000000001';

function input(extra: Partial<ClientTaskInput> = {}): ClientTaskInput {
  return {
    now: NOW,
    jobs: [{ id: JOB, title: 'Sales Manager DACH', status: 'published', salary_max: 95000 }],
    submissions: [{ id: SUB, job_id: JOB, candidate_id: CAND, recruiter_id: REC, stage: 'submitted', status: 'submitted', submitted_at: '2026-10-20T09:00:00Z', identity_unlocked: true }],
    candidates: [{ id: CAND, full_name: 'Tessa Testfall', expected_salary: 95000, notice_period: '3_months_eoq', city: 'München' }],
    recruiters: [{ user_id: REC, full_name: 'Marko Benko' }],
    interviews: [], offers: [], recommendations: [], contracts: [], placements: [], invoices: [], questions: [], messages: [], log: [],
    ...extra,
  };
}

Deno.test('Kunden-Aufgaben: ohne Sprache Deutsch wie bisher, mit sv Schwedisch', () => {
  const de = deriveClientTasks(input());
  eq(de.tasks[0].title, 'Kandidat prüfen');
  eq(de.tasks[0].context?.ask, 'Wollen Sie Tessa kennenlernen?');
  assert(de.tasks[0].context!.facts.some((f) => f.label === 'Gehaltswunsch' && f.key === 'salary_wish' && f.chip?.text === 'am oberen Rand'), 'Fakt deutsch mit Schlüssel');

  const sv = deriveClientTasks(input({ lang: 'sv' }));
  eq(sv.tasks[0].title, 'Granska kandidat');
  eq(sv.tasks[0].context?.ask, 'Vill du träffa Tessa?');
  const wish = sv.tasks[0].context!.facts.find((f) => f.key === 'salary_wish')!;
  eq(wish.label, 'Löneanspråk');
  eq(wish.chip?.text, 'i övre delen');
  assert(wish.value.includes('k€'), wish.value);
  eq(regionBroad('München', 'sv'), 'södra Tyskland');
  eq(regionBroad('München'), 'Süddeutschland');
});

Deno.test('Kunden-Aufgaben: Gespräch hat in jeder Sprache den Schlüssel meeting (FeedbackDialog)', () => {
  const iv = { id: IV, submission_id: SUB, status: 'completed', round: 1, scheduled_at: '2026-10-22T08:00:00Z', duration_minutes: 60, created_at: '2026-10-15T08:00:00Z', meeting_format: 'teams' };
  for (const lang of [undefined, 'en', 'sv', 'nb'] as const) {
    const r = deriveClientTasks(input({ interviews: [iv], lang }));
    const t = r.tasks.find((x) => x.kind === 'feedback')!;
    const meeting = t.context!.facts.find((f) => f.key === 'meeting');
    assert(meeting, `meeting fehlt (${lang})`);
    if (!lang) eq(meeting!.label, 'Gespräch');
  }
  const sv = deriveClientTasks(input({ interviews: [iv], lang: 'sv' })).tasks.find((x) => x.kind === 'feedback')!;
  eq(sv.title, 'Ge feedback');
  eq(sv.waitingWho, 'Tessa och Marko');
});

Deno.test('Kündigungsfrist und Nichtantritt: Deutsch unverändert, Schwedisch übersetzt', () => {
  eq(noticeLabel('3_months_eoq'), '3 Monate zum Quartalsende');
  eq(noticeLabel('3_months_eoq', 'sv'), '3 månader till kvartalsskiftet');
  eq(nonStartReason('counter_offer'), 'Gegenangebot angenommen');
  eq(nonStartReason('counter_offer', 'sv'), 'tackade ja till ett motbud');
});

Deno.test('Glocke: Text je Sprache des Empfängers aus dem Profil, sonst Deutsch', async () => {
  const db = (language: string | null) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: language ? { language } : null, error: null }) }) }) }) }) as never;
  const title = (l: Parameters<typeof tx>[0]) => tx(l, m`Stelle ruht: ${'Weiß GmbH'}`, m`Role paused: ${'Weiß GmbH'}`, m`Tjänsten vilar: ${'Weiß GmbH'}`, m`Stillingen står på pause: ${'Weiß GmbH'}`);
  eq((await textsFor(db(null), 'u1', title, 'x')).title, 'Stelle ruht: Weiß GmbH');
  eq((await textsFor(db('sv'), 'u1', title, 'x')).title, 'Tjänsten vilar: Weiß GmbH');
  eq((await textsFor(db('de-CH'), 'u1', (l) => tx(l, m`Grüße an ${'Weiß'}`, '', '', ''), 'x')).title, 'Grüsse an Weiß', 'ß nur im festen Text');
  eq(dateKeyIn('2026-11-13'), '13.11.2026');
  eq(dateKeyIn('2026-11-13', 'sv'), '2026-11-13');
});

Deno.test('Liga-Mails: ohne Sprache Deutsch wie bisher, mit sv Schwedisch', () => {
  const row = { recruiter_id: 'r1', email: 'hh@x.de', full_name: 'Julia Hartmann', season_label: 'Q4 2026', days_left: 42, rank: 2, participants: 12, points: 30, previous_rank: 3, gap_above: 5, top_n: 10, next_hold: null, hold_points: 10 };
  eq(weeklyContent(row).subject, 'Matchunt Liga: Du bist auf Platz 2 gestiegen (▲ 1)');
  eq(weeklyContent(row, 'sv').subject, 'Matchunt Liga: Du har klättrat till plats 2 (▲ 1)');
  const award = { full_name: 'Julia', awards: ['season_winner' as const], season_label: 'Q3 2026', rank: 1, participants: 38, points: 86, prizes: null };
  eq(awardMailContent(award).heading, 'Du bist Headhunter der Saison Q3 2026');
  eq(awardMailContent(award, 'sv').heading, 'Du är Säsongens headhunter Q3 2026');
});
