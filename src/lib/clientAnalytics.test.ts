import { describe, expect, it } from 'vitest';
import { buildClientAnalytics, type AnaItem, type AnaJob } from './clientAnalytics';

const NOW = Date.parse('2026-11-22T12:00:00Z');
const ago = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

const job = (id: string, over: Partial<AnaJob> = {}): AnaJob => ({
  id, title: `Stelle ${id}`, status: 'published', approved_at: ago(60), created_at: ago(61), closed_at: null, ...over,
});
const item = (id: string, over: Partial<AnaItem> = {}): AnaItem => ({
  submissionId: id, jobId: 'a', submittedAt: ago(20), tab: 'neu', archiveKind: null,
  requestedAt: null, rejectedAt: null, rejectReason: null, isMyTurn: false, experienceBand: '6-10 Jahre', region: 'Süd', ...over,
});

describe('buildClientAnalytics', () => {
  const base = {
    jobs: [job('a'), job('b', { status: 'filled', closed_at: ago(10) })],
    interviews: [{ submission_id: '2', scheduled_at: ago(10), status: 'completed' }],
    offers: [{ submission_id: '2', status: 'accepted', created_at: ago(6), sent_at: ago(6), decision_at: ago(4), responded_at: null }],
    now: NOW,
  };
  const items = [
    item('1', { isMyTurn: true }),
    item('2', { tab: 'archiv', archiveKind: 'eingestellt', requestedAt: ago(15) }),
    item('3', { tab: 'archiv', archiveKind: 'abgelehnt', rejectedAt: ago(19.5), rejectReason: null }),
    item('4', { submittedAt: ago(200) }),
    item('5', { jobId: 'fremd' }),
  ];

  it('zählt nur Vorschläge der eigenen Stellen im Zeitraum', () => {
    const a = buildClientAnalytics({ ...base, items, periodDays: 90 });
    expect(a.proposals).toBe(3);
    expect(a.flow).toMatchObject({ total: 3, hired: 1, rejected: 1, active: 1 });
    expect(buildClientAnalytics({ ...base, items, periodDays: 365 }).proposals).toBe(4);
  });

  it('rechnet Prüfzeit, Verteilung und die belegten Zeit-Abschnitte', () => {
    const a = buildClientAnalytics({ ...base, items, periodDays: 90 });
    expect(a.review).toBeCloseTo(2.75); // 5 Tage und 0,5 Tage
    expect(a.speed).toEqual({ sameDay: 1, upTo3: 0, upTo7: 1, longer: 0 });
    const seg = Object.fromEntries(a.segments.map((s) => [s.key, s.days]));
    expect(seg.toInterview).toBeCloseTo(5);
    expect(seg.toOffer).toBeCloseTo(4);
    expect(seg.toAccept).toBeCloseTo(2);
    expect(a.timeMine).toBeCloseTo(2.75 + 4);
  });

  it('lässt Abschnitte ohne Daten weg und zählt Hinweise', () => {
    const a = buildClientAnalytics({ ...base, interviews: [], offers: [], items, periodDays: 90 });
    expect(a.segments.map((s) => s.key)).toEqual(['first', 'review']);
    expect(a.waiting).toBe(1);
    expect(a.reasonsMissing).toBe(1);
    expect(a.jobsFilled).toBe(1);
    expect(a.jobsTotal).toBe(2);
  });
});

import { buildJobExtras, monthsToStart, parseSalaryBand, type JobExtraItem } from './clientAnalytics';

describe('buildJobExtras', () => {
  const x = (id: string, over: Partial<JobExtraItem> = {}): JobExtraItem => ({
    submissionId: id, submittedAt: ago(20), archiveKind: null, isMyTurn: false, hoursWaiting: 0,
    salaryBand: '', availabilityDate: null, noticePeriod: null, ...over,
  });

  it('liest Gehaltsband und Start', () => {
    expect(parseSalaryBand('€60k - €70k')).toEqual([60000, 70000]);
    expect(parseSalaryBand('')).toBeNull();
    expect(monthsToStart({ availabilityDate: null, noticePeriod: '3_months_eoq' }, NOW)).toBe(3);
    expect(monthsToStart({ availabilityDate: null, noticePeriod: 'sofort' }, NOW)).toBe(0);
    expect(monthsToStart({ availabilityDate: null, noticePeriod: '' }, NOW)).toBeNull();
  });

  it('zählt Wartende, Bänder über dem Budget und den Start', () => {
    const e = buildJobExtras({
      now: NOW, budgetMin: 72000, budgetMax: 82000,
      items: [
        x('1', { isMyTurn: true, hoursWaiting: 9 * 24 + 3, salaryBand: '€70k - €80k', noticePeriod: '3_months' }),
        x('2', { isMyTurn: true, hoursWaiting: 30, salaryBand: '€90k - €100k', noticePeriod: 'sofort' }),
        x('3', { salaryBand: '€90k - €100k', submittedAt: ago(5) }),
        x('4', { archiveKind: 'abgelehnt', salaryBand: '€60k - €70k', noticePeriod: '6_months' }),
      ],
    });
    expect(e.waiting).toEqual([{ submissionId: '1', days: 9 }, { submissionId: '2', days: 1 }]);
    expect(e.salary.map((b) => [b.label, b.count, b.over, b.inBudget])).toEqual([
      ['€60k - €70k', 1, false, false],
      ['€70k - €80k', 1, false, true],
      ['€90k - €100k', 2, true, false],
    ]);
    expect(e.salaryOver).toBe(2);
    expect(e.start).toEqual({ now: 1, soon: 1, later: 0, unknown: 1 });
    expect(e.daysSinceLast).toBe(5);
  });
});
