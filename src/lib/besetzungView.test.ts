import { describe, expect, it } from 'vitest';
import type { BesetzungItem, BesetzungPlacement } from '@/lib/besetzungApi';
import {
  actionsOf, endDoneText, endReasons, factsOf, packageLabel, researchPanel, statusOf, stepsOf,
} from '@/components/besetzungen/besetzungView';

// Ansichtslogik Besetzungen (Umbau Nachbesetzung 11.11.2026): K3/K4 Wörter und Knöpfe je
// Phase, K5 Gründe, K6/J2/J3 Stand der Nachbesetzung. Ohne Suchtage, ohne Anrechnung.

const TODAY = '2026-12-30';

const placement = (over: Partial<BesetzungPlacement> = {}): BesetzungPlacement => ({
  id: 'p1', state: 'started', startDate: '2026-11-01', startConfirmedAt: null, startMovedAt: null,
  startFixedAt: '2026-11-02T08:00:00Z', startFixedHow: 'client', startReport: null,
  nonStartReportedAt: null, nonStartReason: null, nonStartDocument: false,
  continuityEnd: '2027-01-30', reportUntil: '2027-02-13', coreUntil: null,
  departure: null, end: null, claim: null, research: null, offer: null, researchInvoice: null, replaces: null,
  jobStatus: 'filled', jobPaused: false, purchaseOrder: '4500123', costCenter: '410',
  ...over,
});

const can = (over: Partial<NonNullable<BesetzungItem['can']>> = {}): NonNullable<BesetzungItem['can']> => ({
  moveStart: false, startCheck: false, answerStart: false, confirmEnd: false, endReport: false, endDocument: false,
  purchaseOrder: false, confirmPosition: false, endResearch: false, answerOffer: false, reopenJob: false, ...over,
});

const item = (over: Partial<BesetzungItem> = {}): BesetzungItem => ({
  submissionId: 's1', group: 'haus', name: 'Cem Aydın', unlocked: true, jobId: 'j1', jobTitle: 'Head of Sales DACH',
  recruiterName: 'Julia Hartmann', dran: null, offer: null,
  contract: { id: 'c1', status: 'final', way: 'digital', signingMode: 'email', sentAt: null, companySignedAt: null, signedOn: '2026-10-20' },
  placement: placement(),
  package: { key: 'continuity_90', name: 'Matchunt Continuity 90', pct: 23, continuityDays: 90 },
  grossCents: 16_500_000, feeCents: 3_795_000,
  invoice: { id: 'i1', number: 'RE-2026-0142', status: 'paid', totalCents: 4_516_050, openCents: 0, dueDate: '2026-11-05', paidAt: '2026-11-03', reportedPaidOn: null, overdue: false },
  can: can({ endReport: true }),
  events: [],
  ...over,
});

describe('K3/K4 Wörter', () => {
  it('sagt „Nachbesetzung möglich“ statt „Continuity läuft“', () => {
    expect(statusOf(item(), TODAY).text).toBe('Nachbesetzung möglich');
    expect(stepsOf(item(), TODAY).map((s) => s.label)).toContain('Nachbesetzung möglich bis 30.01.2027');
    const f = factsOf(item(), TODAY).find((x) => x.label === 'Nachbesetzung möglich bis');
    expect(f?.value).toBe('30.01.2027 · melden bis 13.02.');
  });
  it('Paket ohne Negativ-Satz bei Core, Ersatz ohne neues Honorar', () => {
    expect(packageLabel(item({ package: { key: 'core', name: 'Matchunt Core', pct: 20, continuityDays: null } }))).toBe('Core · 20 %');
    expect(packageLabel(item({ package: { key: 'continuity_90', name: 'x', pct: 23, continuityDays: null, replacement: true } }))).toBe('Nachbesetzung · kein neues Honorar');
  });
  it('Bestellnummer: Link „ergänzen“ nur, solange keine Rechnung gestellt ist', () => {
    const with_ = factsOf(item({ can: can({ purchaseOrder: true }) }), TODAY).find((x) => x.label === 'Bestellnummer');
    const without = factsOf(item(), TODAY).find((x) => x.label === 'Bestellnummer');
    expect(with_?.action).toBe('po');
    expect(without?.action).toBeUndefined();
    expect(without?.value).toBe('4500123 · Kostenstelle 410');
  });
});

describe('K4 Knöpfe je Phase', () => {
  it('unterschrieben, vor dem Start: kein „Tritt nicht an“, keine Bestellnummer', () => {
    const i = item({ group: 'start', placement: placement({ state: 'agreed', startFixedAt: null, startDate: '2027-01-15' }), can: can({ moveStart: true, endReport: true, purchaseOrder: true }) });
    expect(actionsOf(i)).toEqual(['moveStart', 'endReport', 'contractPdf', 'invoice', 'profile']);
  });
  it('erster Tag da: „Hat … angefangen?“ bzw. „Start bestätigen“ als Hauptknopf', () => {
    const due = item({ group: 'start', placement: placement({ state: 'agreed', startFixedAt: null }), can: can({ startCheck: true }) });
    expect(actionsOf(due)).toEqual(['startCheck', 'contractPdf', 'invoice']);
    const reported = item({ group: 'start', placement: placement({ state: 'agreed', startFixedAt: null }), can: can({ answerStart: true }) });
    expect(actionsOf(reported)[0]).toBe('startConfirm');
  });
  it('im Haus: „Besetzung endet“ statt „Ausgeschieden melden“; danach nur Unterlagen', () => {
    expect(actionsOf(item())).toEqual(['endReport', 'contractPdf', 'invoice', 'profile']);
    expect(actionsOf(item({ group: 'ab', can: can() }))).toEqual(['contractPdf', 'invoice', 'profile']);
  });
});

describe('K5 Gründe', () => {
  it('nach dem Start fünf Gründe, ohne „passt nicht ins Team“', () => {
    const r = endReasons(true, 'Cem');
    expect(r.map((x) => x.label)).toEqual([
      'Cem hat selbst gekündigt', 'Wir trennen uns wegen Leistung oder Verhalten', 'Aufhebung auf Wunsch von Cem',
      'Stelle fällt weg oder wird umgebaut', 'Etwas anderes',
    ]);
    expect(r.some((x) => /Team/.test(x.label))).toBe(false);
  });
  it('vor dem Start drei Gründe', () => {
    expect(endReasons(false, 'Dora').map((x) => x.key)).toEqual(['declined_before_start', 'no_show', 'offer_withdrawn']);
  });
  it('Satz nach dem Melden ohne Erstattung', () => {
    expect(endDoneText('claim', 'departure', '2026-12-16', 'candidate_resigned')).toBe('Gemeldet. Matchunt prüft Ihre Meldung bis 16.12. Für Sie ist nichts zu tun.');
    expect(endDoneText('client_sphere', 'departure', null, 'position_changed')).toContain('§ 9 Abs. 4');
    expect(endDoneText('core', 'departure', null, 'candidate_resigned')).not.toMatch(/erstatt/i);
  });
});

describe('K6 Stand der Nachbesetzung', () => {
  const ended = (over: Partial<BesetzungPlacement>) => item({
    placement: placement({
      state: 'ended_early',
      end: { kind: 'departure', reason: 'candidate_resigned', label: 'Cem hat selbst gekündigt', reportedAt: '2026-12-12T09:00:00Z', knownOn: '2026-12-10', lastDay: '2026-12-31', reviewUntil: '2026-12-16', outcome: 'claim', documents: 0 },
      ...over,
    }),
    can: can(),
  });

  it('1 · Matchunt prüft', () => {
    const p = researchPanel(ended({ claim: { status: 'submitted', kind: 'departure', deadline: null, reportedAt: '2026-12-12T09:00:00Z', decidedAt: null, reviewUntil: '2026-12-16', clientSphere: false, rejectionReason: null } }))!;
    expect(p.variant).toBe('review');
    expect(p.rows.map((r) => r.text)).toEqual(['Gemeldet', 'Matchunt prüft Ihre Meldung bis 16.12.']);
    expect(p.lines).toEqual(['Für Sie ist nichts zu tun.']);
  });
  it('2 · anerkannt, Position bestätigen mit Hinweis zum höheren Gehalt', () => {
    const p = researchPanel(ended({
      claim: { status: 'accepted', kind: 'departure', deadline: null, reportedAt: null, decidedAt: '2026-12-16T10:00:00Z', reviewUntil: null, clientSphere: false, rejectionReason: null },
      research: { state: 'awaiting_position', kind: 'continuity', startedAt: null, endedAt: null, endReason: null, jobId: 'j1', days: null, recruiters: 0, submissions: 0, fresh: 0, paused: false, replacement: null },
    }))!;
    expect(p.variant).toBe('position');
    expect(p.rows.map((r) => r.text)).toEqual(['Matchunt hat geprüft', 'Rechnung bezahlt', 'Position bestätigen']);
    expect(p.lines.join(' ')).toContain('Liegt das Gehalt höher, berechnen wir nur den Unterschied.');
  });
  it('3 · Suche läuft: „läuft seit 12 Tagen“, keine Suchtage', () => {
    const p = researchPanel(ended({
      research: { state: 'running', kind: 'continuity', startedAt: '2026-12-18T08:00:00Z', endedAt: null, endReason: null, jobId: 'j1', days: 12, recruiters: 3, submissions: 2, fresh: 2, paused: false, replacement: null },
    }))!;
    expect(p.variant).toBe('running');
    expect(p.rows[1].text).toBe('Nachbesetzung läuft seit 12 Tagen');
    expect(p.lines[0]).toBe('3 Headhunter suchen · 2 neue Vorstellungen');
    expect(JSON.stringify(p)).not.toMatch(/Tag \d+ von/);
  });
  it('4 · Ersatz gefunden: neue Karte, keine Anrechnung', () => {
    const p = researchPanel(ended({
      research: { state: 'succeeded', kind: 'continuity', startedAt: '2026-12-18T08:00:00Z', endedAt: '2027-01-20T08:00:00Z', endReason: 'filled', jobId: 'j1', days: 33, recruiters: 3, submissions: 4, fresh: 0, paused: false, replacement: { submissionId: 's9', name: 'Mira Stein' } },
    }))!;
    expect(p.variant).toBe('found');
    expect(p.lines[0]).toContain('„Mira · Nachbesetzung für Cem“');
    expect(JSON.stringify(p)).not.toMatch(/angerechnet/);
  });
  it('Variante Core: „Möchten Sie die Stelle wieder öffnen?“', () => {
    const i = item({
      package: { key: 'core', name: 'Matchunt Core', pct: 20, continuityDays: null },
      placement: placement({ state: 'ended_early', continuityEnd: null, end: { kind: 'departure', reason: 'candidate_resigned', label: 'x', reportedAt: '2026-12-12T09:00:00Z', knownOn: null, lastDay: null, reviewUntil: null, outcome: 'core', documents: 0 } }),
      can: can({ reopenJob: true }),
    });
    expect(researchPanel(i)).toMatchObject({ variant: 'core', lines: ['Gemeldet, danke.', 'Möchten Sie die Stelle wieder öffnen?'] });
  });
  it('Variante Grund beim Kunden', () => {
    const p = researchPanel(ended({ end: { kind: 'departure', reason: 'position_changed', label: 'x', reportedAt: null, knownOn: null, lastDay: null, reviewUntil: null, outcome: 'client_sphere', documents: 0 } }))!;
    expect(p.variant).toBe('sphere');
    expect(p.lines[1]).toBe('Eine Nachbesetzung ist hier nicht vorgesehen, weil die Stelle wegfällt oder umgebaut wird (Rahmenvertrag § 9 Abs. 4).');
  });
});

describe('J2/J3 Angebot bei Core', () => {
  const tessa = (over: Partial<BesetzungPlacement>) => item({
    name: 'Tessa Testfall', group: 'start',
    package: { key: 'core', name: 'Matchunt Core', pct: 20, continuityDays: null },
    placement: placement({
      state: 'cancelled', startFixedAt: null,
      end: { kind: 'non_start', reason: 'declined_before_start', label: 'Tessa hat vor dem Start abgesagt', reportedAt: '2026-12-01T09:00:00Z', knownOn: null, lastDay: null, reviewUntil: '2026-12-04', outcome: 'core', documents: 0 },
      ...over,
    }),
    can: can({ answerOffer: true }),
  });
  it('J2 mit Angebot: Preis und Frist, kein „Joker“', () => {
    const p = researchPanel(tessa({ offer: { status: 'open', priceCents: 475_000, validUntil: '2026-12-17', decidedAt: null, answeredAt: null } }))!;
    expect(p.variant).toBe('offer');
    expect(p.title).toBe('Tessa hat nicht angefangen');
    expect(p.lines).toContain('Angebot gültig bis 17.12.2026');
    expect(p.lines[1]).toContain('einmalig 4.750 € netto');
    expect(JSON.stringify(p)).not.toMatch(/Joker|statt/);
  });
  it('J3 nach „Annehmen“: Rechnung bezahlen, dann startet die Suche', () => {
    const p = researchPanel(tessa({
      offer: { status: 'accepted', priceCents: 475_000, validUntil: '2026-12-17', decidedAt: null, answeredAt: '2026-12-03T10:00:00Z' },
      research: { state: 'awaiting_payment', kind: 'joker', startedAt: null, endedAt: null, endReason: null, jobId: 'j1', days: null, recruiters: 0, submissions: 0, fresh: 0, paused: false, replacement: null },
    }))!;
    expect(p.rows.map((r) => [r.state, r.text])).toEqual([
      ['done', 'Angebot angenommen'], ['now', 'Rechnung bezahlen, dann startet die Suche'], ['next', 'Nachbesetzung läuft, bis die Stelle besetzt ist'],
    ]);
  });
  it('Core, noch nicht entschieden: Matchunt prüft', () => {
    expect(researchPanel(tessa({ state: 'agreed' }))?.variant).toBe('review');
  });
});
