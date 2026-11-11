import { describe, expect, it } from 'vitest';
import {
  conditionsTable, creditNotesCsv, earningExplain, jobEarning, objectionUntil, overviewTotals, placementAmount, placementChain,
  placementRow, placementWindow, runSlot, startTaskKind, tenthWorkday, trancheStage,
  type JobTerms, type PlacementFacts, type TrancheLike,
} from '../../supabase/functions/_shared/abrechnung-view';

const TODAY = '2026-11-20';
const ctx = { today: TODAY, doneRuns: [] as string[], v2Active: true, taxMode: 'standard' as const };

function facts(over: Partial<PlacementFacts> & { p: PlacementFacts['p'] }): PlacementFacts {
  return {
    tranches: [], candidateName: 'Cem Aydın', jobTitle: 'Head of Sales DACH', jobId: 'job-1', companyName: 'MedTec Süd GmbH',
    invoice: { status: 'paid', issued_at: '2026-10-22', due_date: '2026-11-05', paid_at: '2026-11-03T12:00:00Z' }, claim: null,
    contractSignedOn: '2026-10-20', creditNotes: {}, ...over,
  };
}
const tr = (type: string, cents: number, status: string, extra: Partial<TrancheLike> = {}): TrancheLike =>
  ({ id: `${type}-1`, placement_id: 'p1', tranche_type: type, amount_cents: cents, status, ...extra });

// Cem: Continuity 90, Fassung 2, 165.000 € Zielgehalt, bezahlt und angetreten
const cem = facts({
  p: {
    id: 'p1', submission_id: 's1', package_key: 'continuity_90', conditions_version: 2,
    pricing_snapshot: { continuityDays: 90, conditionsVersion: 2, recruiterInitialPct: 5, recruiterRetentionPct: 10 },
    placement_state: 'started', invoice_state: 'paid', retention_state: 'withheld', continuity_state: 'running',
    first_working_day: '2026-11-01', start_fixed_at: '2026-11-04T08:00:00Z', start_fixed_how: 'client', start_reported_at: '2026-11-01T08:00:00Z', start_report_kind: 'started',
    continuity_end_date: '2027-01-30', retention_release_date: '2027-02-13', gross_annual_target_compensation_cents: 16_500_000,
    recruiter_initial_cents: 825_000, recruiter_retention_cents: 1_650_000, paid_at: '2026-11-03T12:00:00Z', created_at: '2026-10-20T10:00:00Z',
  },
  tranches: [tr('initial', 825_000, 'due'), tr('retention', 1_650_000, 'pending', { id: 'r-1' })],
});

describe('Gutschriftlauf', () => {
  it('10. Werktag des Monats', () => {
    expect(tenthWorkday('2026-12')).toBe('2026-12-14');
    expect(tenthWorkday('2026-11')).toBe('2026-11-13');
  });
  it('fällig im November → Anfang Dezember', () => {
    const s = runSlot('2026-11-04', TODAY);
    expect(s.label).toBe('Anfang Dezember');
    expect(s.short).toBe('Anfang Dez.');
    expect(s.latest).toBe('2026-12-14');
  });
  it('Oktober-Lauf schon gemacht → nächster Lauf', () => {
    expect(runSlot('2026-10-20', '2026-11-05', ['2026-10']).label).toBe('Anfang Dezember');
    expect(runSlot('2026-10-20', '2026-11-05').label).toBe('Anfang November');
  });
  it('Lauf überfällig: kein falsches „Anfang …“', () => {
    expect(runSlot('2026-10-20', TODAY).label).toBe('mit dem nächsten Lauf');
  });
  it('2. Teil nach Garantie plus Meldefrist', () => {
    expect(runSlot('2027-02-13', TODAY).label).toBe('Anfang März');
  });
});

describe('H8 Übersicht', () => {
  it('Kette und Betrag bei Cem', () => {
    expect(placementChain(cem).map((c) => `${c.label}:${c.state}`)).toEqual([
      'Rechnung:done', 'Bezahlt:done', 'Angetreten:done', '1. Teil:current', 'Garantie:todo', '2. Teil:todo',
    ]);
    expect(placementAmount(cem, ctx)).toEqual({ amountCents: 825_000, amountSub: '+ 16.500 € ab 13.02.' });
    expect(placementRow(cem, ctx).packageLabel).toBe('Continuity 90');
  });
  it('nächste Gutschrift, Kacheln', () => {
    const t = overviewTotals([cem], [{ id: 'cn', status: 'paid', net_cents: 850_000, issued_on: '2026-10-02', paid_on: '2026-10-09' }], [], ctx);
    expect(t.upcoming[0].slot.label).toBe('Anfang Dezember');
    expect(t.upcoming[0].netCents).toBe(825_000);
    expect(t.upcoming[0].vatCents).toBe(156_750);
    expect(t.upcoming[0].lines[0].label).toBe('1. Teil · Cem Aydın');
    expect(t.waitingGuaranteeCents).toBe(1_650_000);
    expect(t.receivedYearCents).toBe(850_000);
  });
  it('Core vor dem Antritt: in einem Teil', () => {
    const tessa = facts({
      candidateName: 'Tessa Testfall',
      p: { id: 'p2', package_key: 'core', pricing_snapshot: { continuityDays: null }, placement_state: 'agreed', invoice_state: 'paid', first_working_day: '2026-12-01', recruiter_initial_cents: 1_425_000 },
      tranches: [tr('initial', 1_425_000, 'pending', { placement_id: 'p2' })],
    });
    expect(placementChain(tessa).map((c) => `${c.label}:${c.state}`)).toEqual(['Rechnung:done', 'Bezahlt:done', 'Antritt:current']);
    expect(placementAmount(tessa, ctx)).toEqual({ amountCents: 1_425_000, amountSub: 'in einem Teil' });
    expect(overviewTotals([tessa], [], [], ctx).waitingStartCents).toBe(1_425_000);
  });
  it('Altfall Fassung 1: 1. Teil ausgezahlt, Garantie läuft', () => {
    const lisa = facts({
      candidateName: 'Lisa Brenner',
      p: {
        id: 'p3', package_key: 'continuity_90', conditions_version: 1, pricing_snapshot: { continuityDays: 90 }, placement_state: 'started', invoice_state: 'paid',
        retention_state: 'withheld', start_fixed_at: '2026-09-01T08:00:00Z', first_working_day: '2026-09-01', continuity_end_date: '2026-11-30', retention_release_date: '2026-12-14',
      },
      tranches: [tr('initial', 850_000, 'paid', { placement_id: 'p3', paid_at: '2026-10-09T10:00:00Z' }), tr('retention', 425_000, 'pending', { id: 'r3', placement_id: 'p3' })],
    });
    const row = placementRow(lisa, ctx);
    expect(row.packageLabel).toBe('Konditionen vor der Umstellung');
    expect(row.chain.map((c) => `${c.label}:${c.state}`)).toEqual(['1. Teil:done', 'Garantie bis 30.11.:current', '2. Teil:todo']);
    expect([row.amountCents, row.amountSub]).toEqual([425_000, 'Anfang Januar']);
  });
  it('Teile: fällig, wartet, verfallen', () => {
    expect(trancheStage(tr('initial', 1, 'pending'), { id: 'x', placement_state: 'agreed', invoice_state: 'paid' })).toBe('waiting_start');
    expect(trancheStage(tr('initial', 1, 'pending'), { id: 'x', placement_state: 'started', invoice_state: 'invoiced' })).toBe('waiting_payment');
    expect(trancheStage(tr('retention', 1, 'pending'), { id: 'x', placement_state: 'started', invoice_state: 'paid', retention_state: 'released' })).toBe('due');
    expect(trancheStage(tr('retention', 1, 'forfeited'), { id: 'x' })).toBe('forfeited');
    expect(trancheStage(tr('initial', 1, 'approved', { credit_note_id: 'cn' }), { id: 'x' })).toBe('credited');
  });
});

describe('H9/H10/J5 Besetzungs-Fenster', () => {
  it('H9: alles läuft', () => {
    const v = placementWindow(cem, ctx);
    expect(v.subtitle).toBe('MedTec Süd GmbH · Continuity 90 · Start 01.11.2026');
    expect(v.figures.map((f) => `${f.label}=${f.value}`)).toEqual(['Grundlage=165.000 €', '1. Teil · 5 %=8.250 €', '2. Teil · 10 %=16.500 €']);
    const current = v.steps.find((s) => s.state === 'current')!;
    expect(current.text).toBe('Gutschrift 1. Teil · 8.250 € + USt');
    expect(current.date).toBe('Anfang Dez.');
    expect(v.steps.some((s) => s.text === 'Garantie läuft bis 30.01.2027, Meldefrist bis 13.02.')).toBe(true);
    expect(v.steps.at(-1)).toMatchObject({ text: 'Gutschrift 2. Teil · 16.500 € + USt', date: 'Anfang März' });
    expect(v.steps.find((s) => s.text === 'Cem hat angefangen')?.note).toBe('du hast gemeldet, MedTec Süd hat bestätigt');
    expect(v.footer).toBe('Du musst nichts tun. Wackelt es bei Cem, sag uns früh Bescheid.');
    expect(v.halfway.possible).toBe(true);
  });
  it('H10: Kündigung in der Garantie, Stelle neu ausgeschrieben', () => {
    const f = facts({
      ...cem,
      p: { ...cem.p, placement_state: 'ended_early', retention_state: 'forfeited', research_state: 'running', research_started_at: '2026-12-18T10:00:00Z', research_bounty_cents: 2_475_000 },
      tranches: [tr('initial', 825_000, 'paid', { paid_at: '2026-12-09T10:00:00Z' }), tr('retention', 1_650_000, 'forfeited', { id: 'r-1' })],
      claim: { id: 'c1', kind: 'departure', category: 'candidate_resigned', status: 'accepted', reported_at: '2026-12-12T10:00:00Z', decided_at: '2026-12-16T10:00:00Z', recruiter_statement: 'Er hat ein Angebot vom Wettbewerb.' },
    });
    const v = placementWindow(f, { ...ctx, today: '2026-12-20' });
    expect(v.caseTitle).toBe('Cem kündigt in der Garantiezeit');
    expect(v.steps.map((s) => s.text)).toEqual(['1. Teil ausgezahlt, bleibt deiner', 'MedTec Süd hat gemeldet, du wurdest angehört', 'Matchunt hat anerkannt', 'Stelle für alle neu ausgeschrieben']);
    expect(v.box).toBe('Besetzt du sie, bekommst du deinen 2. Teil (16.500 €), sobald der Ersatz angefangen hat. Besetzt sie jemand anderes, entfällt er.');
    expect(v.jobLink).toBe('/recruiter/jobs/job-1');
  });
  it('H10: Nichtantritt mit Continuity', () => {
    const f = facts({
      candidateName: 'Dora Weber',
      p: {
        id: 'p5', package_key: 'continuity_90', conditions_version: 2, pricing_snapshot: { continuityDays: 90, conditionsVersion: 2 }, placement_state: 'cancelled', invoice_state: 'paid',
        non_start_reported_at: '2026-11-20T10:00:00Z', research_state: 'running', research_started_at: '2026-11-26T10:00:00Z', gross_annual_target_compensation_cents: 6_000_000,
      },
      tranches: [tr('initial', 300_000, 'forfeited', { placement_id: 'p5' })],
      claim: { id: 'c2', kind: 'non_start', category: 'declined_before_start', status: 'accepted', decided_at: '2026-11-24T10:00:00Z' },
    });
    const v = placementWindow(f, ctx);
    expect(v.steps.map((s) => `${s.state}:${s.text}`)).toEqual(['done:Rechnung bezahlt, Matchunt hat geprüft', 'current:Stelle für alle neu ausgeschrieben']);
    expect(v.box).toBe('Besetzt du sie, bekommst du 9.000 € in einem Teil, sobald der Ersatz angefangen hat. Für den Ersatz gibt es keine zweite Garantie.');
  });
  it('J5: Core ohne Antritt, ohne und mit neuer Ausschreibung', () => {
    const base = facts({
      candidateName: 'Tessa Testfall',
      p: {
        id: 'p6', package_key: 'core', pricing_snapshot: { continuityDays: null }, placement_state: 'cancelled', invoice_state: 'paid', non_start_reported_at: '2026-11-25T10:00:00Z',
        non_start_reason: 'declined_before_start', non_start_note: 'Gegenangebot', gross_annual_target_compensation_cents: 9_500_000,
      },
      tranches: [tr('initial', 1_425_000, 'forfeited', { placement_id: 'p6' })],
      jokerDecided: true,
    });
    const none = placementWindow(base, ctx);
    expect(none.caseTitle).toBe('Tessa hat nicht angefangen');
    expect(none.box).toBe('Bei Core gibt es den Anteil erst mit dem Antritt, deshalb diesmal keinen. Grund laut Kunde: vor dem Start abgesagt (Gegenangebot).');
    expect(placementRow(base, ctx).amountSub).toBe('kein Anteil');
    const reopened = placementWindow({ ...base, p: { ...base.p, research_kind: 'joker', research_state: 'running', research_started_at: '2026-12-05T10:00:00Z' } }, ctx);
    expect(reopened.caseTitle).toBe('Die Stelle wird neu ausgeschrieben');
    expect(reopened.box).toBe('Für alle Headhunter, auch für dich. Besetzt du sie, bekommst du 14.250 € in einem Teil nach Antritt.');
  });
  it('Grund beim Kunden', () => {
    const v = placementWindow({ ...cem, p: { ...cem.p, client_sphere_at: '2026-12-01T10:00:00Z' } }, ctx);
    expect(v.box).toBe('Der Grund liegt beim Kunden. Du bekommst deinen vollen Anteil, der 2. Teil wird sofort frei.');
  });
  it('H7: Kasten am ersten Arbeitstag', () => {
    const p = { ...cem.p, placement_state: 'agreed', start_fixed_at: null, start_fixed_how: null, start_reported_at: null, start_report_kind: null, first_working_day: '2026-11-20' };
    const v = placementWindow({ ...cem, p, tranches: [tr('initial', 825_000, 'pending'), tr('retention', 1_650_000, 'pending', { id: 'r-1' })] }, ctx);
    expect(v.start.canReport).toBe(true);
    expect(v.start.box).toBe('Deine Meldung geht an MedTec Süd zur Bestätigung. Bestätigt MedTec Süd oder widerspricht 3 Werktage nicht, wird dein 1. Teil fällig: 8.250 € mit der Gutschrift Anfang Dezember.');
  });
});

describe('H3–H6 Verdienst an Stellen', () => {
  const terms = (over: Partial<JobTerms> = {}): JobTerms => ({
    jobId: 'j', packageKey: 'continuity_90', version: 2, standard: true, initialPct: 5, retentionPct: 10, continuityDays: 90, v2Active: true, activatedAt: null, research: null, reportedAt: null, ...over,
  });
  it('Continuity 90 Fassung 2', () => {
    const e = jobEarning(terms(), 150_000, 180_000)!;
    expect(e.totalCents).toBe(2_475_000);
    expect(e.line).toBe('8.250 € bei Antritt, Rest nach 90 Tagen');
    expect(e.detail).toBe('8.250 € bei Antritt · 16.500 € nach 90 Tagen');
    expect(e.cardLine).toBe('in 2 Teilen');
    expect([e.minCents, e.maxCents]).toEqual([2_250_000, 2_700_000]);
    const ex = earningExplain(e, terms());
    expect(ex.payout.map((p) => p.cents)).toEqual([null, 825_000, 1_650_000]);
    expect(ex.risks[0]).toBe('Fängt dein Kandidat nicht an, wird die Stelle neu für alle ausgeschrieben, auch für dich. Besetzt du sie, bekommst du die vollen 24.750 €.');
    expect(ex.risks[1]).toBe('Geht er in den 90 Tagen, bleiben die 8.250 € deine. Die Stelle wird neu für alle ausgeschrieben. Besetzt du sie, kommen deine 16.500 € dazu.');
  });
  it('Core: ganz bei Antritt', () => {
    const e = jobEarning(terms({ packageKey: 'core', initialPct: 15, retentionPct: 0, continuityDays: null }), 150_000, 180_000)!;
    expect([e.totalCents, e.line, e.cardLine]).toEqual([2_475_000, 'ganz bei Antritt', 'ganz bei Antritt']);
  });
  it('vor der Umstellung aktiviert', () => {
    const e = jobEarning(terms({ version: 1, initialPct: 10, retentionPct: 5, activatedAt: '2026-10-12T09:00:00Z' }), 150_000, 180_000)!;
    expect(e.detail).toBe('16.500 € bei Antritt · 8.250 € nach 90 Tagen · Konditionen vom 12.10.');
  });
  it('Nachbesetzung: für alle und für den ursprünglichen Headhunter', () => {
    const all = jobEarning(terms({ research: { reason: 'departure', since: '2026-12-18', bountyCents: 2_475_000, ownCents: null, ownIsRetention: false } }), 150_000, 180_000)!;
    expect([all.totalCents, all.cardLine, all.research?.note]).toEqual([2_475_000, 'in einem Teil nach Antritt', 'Die erste Besetzung hat in der Probezeit gekündigt.']);
    const own = jobEarning(terms({ research: { reason: 'departure', since: null, bountyCents: 2_475_000, ownCents: 1_650_000, ownIsRetention: true } }), null, null)!;
    expect([own.totalCents, own.cardLine]).toEqual([1_650_000, 'dein 2. Teil, wenn du besetzt']);
  });
  it('ohne Konditionen oder Gehalt: null', () => {
    expect(jobEarning(null, 1, 2)).toBeNull();
    expect(jobEarning(terms(), null, null)).toBeNull();
  });
});

describe('Sonstiges', () => {
  it('Aufgaben erkennen', () => {
    expect(startTaskKind('Hat Cem angefangen?')).toBe('start');
    expect(startTaskKind('Wie läuft es bei Cem?')).toBe('halfway');
    expect(startTaskKind('Lebenslauf anfragen')).toBeNull();
  });
  it('H2-Tabelle', () => {
    const t = conditionsTable();
    expect(t[0]).toMatchObject({ label: 'Core', before: '15 % bei Antritt', after: 'unverändert' });
    expect(t[1]).toMatchObject({ label: 'Continuity 90', before: '10 % bei Antritt, 5 % nach 90 Tagen', after: '5 % bei Antritt, 10 % nach 90 Tagen' });
    expect(t[3]).toMatchObject({ before: '8 bzw. 11 %', after: '15 %, für alle Headhunter ausgeschrieben' });
  });
  it('Einwand-Frist und CSV', () => {
    expect(objectionUntil('2026-10-02')).toBe('2026-11-01');
    const csv = creditNotesCsv([{ number: 'GS-2026-0001', issued_on: '2026-10-02', period: '2026-09', status: 'paid', tax_mode: 'standard', vat_rate: 19, net_cents: 850_000, vat_cents: 161_500, total_cents: 1_011_500, paid_on: '2026-10-09', lines: [{ title: '1. Teil · Lisa Brenner' }] }]);
    const [head, row] = csv.replace(/^﻿/, '').trim().split('\r\n');
    expect(head.split(';')[0]).toBe('Gutschrift-Nr.');
    expect(row).toBe('GS-2026-0001;02.10.2026;2026-09;1. Teil · Lisa Brenner;8.500,00;19 %;1.615,00;10.115,00;Regelbesteuert;ausgezahlt;09.10.2026');
  });
});
