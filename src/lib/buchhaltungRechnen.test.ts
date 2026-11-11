import { describe, expect, it } from 'vitest';
import {
  creditTax, csvFile, dunningOptions, inRun, lateInterest, nextStep, pendingRunPeriod, periodEnd, positionLabel, releaseDeadline, poFollowsFrom,
  runDeadline, runName, shiftPeriod, trancheDue, workdaysUntil, type StepFacts, type TrancheFacts,
} from '../../supabase/functions/_shared/buchhaltung-rechnen';

describe('Fristen und Monate', () => {
  it('Freigabe binnen 10 Werktagen, „Bestellnummer folgt“ ab Tag 7', () => {
    expect(releaseDeadline('2026-11-05')).toBe('2026-11-19');
    expect(poFollowsFrom('2026-11-05')).toBe('2026-11-12');
    expect(workdaysUntil('2026-11-12', '2026-11-19')).toBe(5);
    expect(workdaysUntil('2026-11-19', '2026-11-12')).toBe(-5);
  });
  it('Lauf für November heißt Dezember-Lauf, bis zum 10. Werktag', () => {
    expect(runName('2026-11')).toBe('Dezember-Lauf');
    expect(runDeadline('2026-11')).toBe('2026-12-14');
    expect(shiftPeriod('2026-12', 1)).toBe('2027-01');
    expect(shiftPeriod('2027-01', -1)).toBe('2026-12');
    expect(periodEnd('2026-02')).toBe('2026-02-28');
  });
  it('anstehender Lauf: Vormonat, solange er fehlt', () => {
    expect(pendingRunPeriod('2026-11-12', [])).toBe('2026-10');
    expect(pendingRunPeriod('2026-11-12', ['2026-10'])).toBe('2026-11');
  });
});

describe('Verzugszinsen (§ 288 BGB)', () => {
  it('Basiszinssatz + 9 Prozentpunkte, tagesgenau', () => {
    // 15.581,00 € · (2,27 + 9) % · 15 Tage / 365
    const r = lateInterest(1558100, 2.27, '2026-11-04', '2026-11-19');
    expect(r.days).toBe(15);
    expect(r.ratePct).toBe(11.27);
    expect(r.interestCents).toBe(Math.round(1558100 * 11.27 * 15 / 36500));
    expect(r.interestCents).toBe(7216);
  });
  it('vor Fälligkeit keine Zinsen, negativer Basiszins wird verrechnet', () => {
    expect(lateInterest(100000, 1, '2026-11-20', '2026-11-19').interestCents).toBe(0);
    expect(lateInterest(100000, -0.88, '2026-01-01', '2027-01-01').interestCents).toBe(8120);
  });
});

describe('Mahnstufen', () => {
  const base = { status: 'open', dueDate: '2026-11-04', today: '2026-11-12', reminderSentAt: null as string | null, reminders: [] as { level: number; payUntil: string | null; sentAt: string | null }[] };
  it('erst nach der Erinnerung', () => {
    const o = dunningOptions(base);
    expect(o.map((x) => x.allowed)).toEqual([false, false, false]);
    expect(o[0].why).toMatch(/Zahlungserinnerung/);
  });
  it('1. Mahnung nach der Erinnerung, 2. erst nach Ablauf der Frist', () => {
    const withReminder = { ...base, reminderSentAt: '2026-11-11T06:30:00Z', reminders: [{ level: 0, payUntil: null, sentAt: '2026-11-11' }] };
    expect(dunningOptions(withReminder).map((x) => x.allowed)).toEqual([true, false, false]);
    const l1 = { ...withReminder, reminders: [...withReminder.reminders, { level: 1, payUntil: '2026-11-19', sentAt: '2026-11-12' }] };
    expect(dunningOptions({ ...l1, today: '2026-11-19' }).map((x) => x.allowed)).toEqual([false, false, false]);
    expect(dunningOptions({ ...l1, today: '2026-11-20' }).map((x) => x.allowed)).toEqual([false, true, false]);
    const l2 = { ...l1, today: '2026-12-01', reminders: [...l1.reminders, { level: 2, payUntil: '2026-11-27', sentAt: '2026-11-20' }] };
    expect(dunningOptions(l2).map((x) => x.allowed)).toEqual([false, false, true]);
  });
  it('nicht fällig oder bezahlt: nichts', () => {
    expect(dunningOptions({ ...base, today: '2026-11-03' }).every((x) => !x.allowed)).toBe(true);
    expect(dunningOptions({ ...base, status: 'paid' }).every((x) => !x.allowed)).toBe(true);
  });
});

describe('Gutschriftlauf: wann ist ein Anteil fällig?', () => {
  const f = (o: Partial<TrancheFacts>): TrancheFacts => ({
    type: 'initial', status: 'pending', creditNoteId: null, invoicePaidOn: '2026-11-03', startFixedOn: '2026-11-01', started: true, placementCancelled: false,
    retentionState: 'withheld', retentionReleaseDate: '2027-02-13', clientSphereOn: null, openClaim: false, ...o,
  });
  it('1. Teil: Kunde hat bezahlt und Antritt steht fest', () => {
    expect(trancheDue(f({}))).toEqual({ due: true, since: '2026-11-03', waitingFor: null });
    expect(trancheDue(f({ invoicePaidOn: null }))).toMatchObject({ due: false, waitingFor: 'Zahlung des Kunden' });
    expect(trancheDue(f({ started: false, startFixedOn: null }))).toMatchObject({ due: false, waitingFor: 'Antritt' });
    expect(trancheDue(f({ placementCancelled: true, started: false }))).toMatchObject({ due: false, waitingFor: 'kein Antritt' });
    expect(trancheDue(f({ creditNoteId: 'x' })).due).toBe(false);
    expect(trancheDue(f({ status: 'forfeited' })).due).toBe(false);
  });
  it('2. Teil: erst nach Garantie plus Meldefrist und ohne offenen Fall', () => {
    expect(trancheDue(f({ type: 'retention' }))).toMatchObject({ due: false });
    expect(trancheDue(f({ type: 'retention', retentionState: 'released', retentionReleaseDate: '2027-02-13' }))).toEqual({ due: true, since: '2027-02-13', waitingFor: null });
    expect(trancheDue(f({ type: 'retention', retentionState: 'released', openClaim: true })).due).toBe(false);
    // Grund beim Kunden: sofort frei
    expect(trancheDue(f({ type: 'retention', retentionState: 'released', clientSphereOn: '2026-12-01' })).since).toBe('2026-12-01');
  });
  it('Auslobung: Ersatz angetreten, ursprüngliche Rechnung und Unterschied bezahlt', () => {
    const b = (o: Partial<TrancheFacts>) => f({ type: 'research_bounty', invoicePaidOn: null, originalPaidOn: '2026-11-03', startFixedOn: '2027-03-01', ...o });
    expect(trancheDue(b({}))).toEqual({ due: true, since: '2027-03-01', waitingFor: null });
    expect(trancheDue(b({ started: false }))).toMatchObject({ due: false, waitingFor: 'Antritt der Ersatzbesetzung' });
    expect(trancheDue(b({ originalPaidOn: null })).due).toBe(false);
    expect(trancheDue(b({ differenceInvoice: { paidOn: null } }))).toMatchObject({ due: false, waitingFor: 'Zahlung der Rechnung über den Unterschied' });
    expect(trancheDue(b({ differenceInvoice: { paidOn: '2027-03-10' } })).since).toBe('2027-03-10');
  });
  it('in den Lauf kommt, was bis Monatsende fällig war', () => {
    expect(inRun({ due: true, since: '2026-11-30', waitingFor: null }, '2026-11')).toBe(true);
    expect(inRun({ due: true, since: '2026-12-01', waitingFor: null }, '2026-11')).toBe(false);
  });
  it('Steuer je Headhunter und Positionsarten', () => {
    expect(creditTax('standard', 825000)).toMatchObject({ vatCents: 156750, totalCents: 981750 });
    expect(creditTax('small_business', 825000)).toMatchObject({ vatCents: 0, totalCents: 825000, note: 'Kein Ausweis der Umsatzsteuer (§ 19 UStG).' });
    expect(creditTax('foreign', 825000).note).toMatch(/Reverse Charge/);
    expect(positionLabel('initial', 'continuity_90', 5, 23)).toBe('1. Teil (5/23)');
    expect(positionLabel('retention', 'continuity_90', 10, 23)).toBe('2. Teil nach Ende der Garantie (10/23)');
    expect(positionLabel('research_bounty', 'continuity_90', 15, 23)).toBe('Auslobung Nachbesetzung (15/23)');
    expect(positionLabel('initial', 'core', 15, 20)).toBe('Core (15/20)');
  });
});

describe('Fahrplan: genau ein nächster Schritt', () => {
  const s = (o: Partial<StepFacts>): StepFacts => ({
    today: '2026-11-12', openClaim: false, coreNonStartOpen: false, startContested: false, feeExpected: true, invoice: null,
    placementState: 'agreed', startFixed: false, firstDay: '2026-12-01', startReported: false, research: { state: 'not_applicable', since: null },
    tranches: [], retention: { state: 'not_applicable', releaseDate: null, continuityEnd: null }, runName: 'Dezember-Lauf', ...o,
  });
  const inv = (o: Partial<NonNullable<StepFacts['invoice']>>) => ({ status: 'open', dueDate: '2026-11-18', releaseBy: null, reminderSentAt: null, dunningLevel: 0, lastDunningPayUntil: null, dunningAllowed: false, ...o });
  it('Knopf, wenn Matchunt dran ist', () => {
    expect(nextStep(s({ invoice: inv({ status: 'draft' }) }))).toEqual({ key: 'release', label: 'Rechnung prüfen', action: true });
    expect(nextStep(s({ openClaim: true, invoice: inv({ status: 'draft' }) })).key).toBe('case');
    expect(nextStep(s({ invoice: inv({ dueDate: '2026-11-04', reminderSentAt: '2026-11-11', dunningAllowed: true }) }))).toMatchObject({ key: 'dunning', action: true });
  });
  it('grauer Text, wenn andere dran sind', () => {
    expect(nextStep(s({ invoice: inv({}) }))).toEqual({ key: 'invoice_open', label: 'Rechnung offen bis 18.11.', action: false });
    expect(nextStep(s({ invoice: inv({ status: 'paid' }) }))).toMatchObject({ key: 'wait_start', action: false });
    expect(nextStep(s({ invoice: inv({ status: 'paid' }), placementState: 'started', startFixed: true, tranches: [{ label: '1. Teil', status: 'due', dueNow: true, creditNoteNumber: null, payUntil: null }] })))
      .toEqual({ key: 'credit_due', label: '1. Teil im Dezember-Lauf', action: false });
    expect(nextStep(s({ invoice: inv({ status: 'paid' }), placementState: 'started', startFixed: true, research: { state: 'running', since: '2026-11-01' } })).label).toBe('Nachbesetzung läuft seit 11 Tagen');
    expect(nextStep(s({ feeExpected: true, invoice: null })).label).toBe('Rechnung fehlt');
  });
});

describe('CSV', () => {
  it('Semikolon, Anführungszeichen, BOM', () => {
    const csv = csvFile(['A', 'B'], [['x;y', 'sagt "hi"'], [1, null]]);
    expect(csv.startsWith('﻿A;B\r\n')).toBe(true);
    expect(csv).toContain('"x;y";"sagt ""hi"""');
    expect(csv).toContain('1;\r\n');
  });
});
