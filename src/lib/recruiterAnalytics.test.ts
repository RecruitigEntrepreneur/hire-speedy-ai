import { describe, expect, it } from 'vitest';
import { computeRecruiterAnalytics, median, type AnaSubmission } from './recruiterAnalytics';

const now = new Date('2026-11-23T12:00:00Z');
const vor = (tage: number) => new Date(now.getTime() - tage * 86_400_000).toISOString();
const sub = (id: string, tage: number, status: string, extra: Partial<AnaSubmission> = {}): AnaSubmission =>
  ({ id, job_id: 'j1', status, stage: status, submitted_at: vor(tage), rejection_reason: null, ...extra });

describe('Auswertung des Headhunters', () => {
  it('Median rundet und verträgt leere Listen', () => {
    expect(median([])).toBeNull();
    expect(median([4, 10])).toBe(7);
    expect(median([3, 9, 20])).toBe(9);
  });

  it('zeigt unter fünf Vorstellungen keine Quote', () => {
    const a = computeRecruiterAnalytics({ submissions: [sub('a', 3, 'submitted'), sub('b', 5, 'interview')], interviews: [], placements: [], jobs: [] }, '90', now);
    expect(a.submitted).toBe(2);
    expect(a.interviews).toBe(1);
    expect(a.inviteRate).toBeNull();
  });

  it('zählt den Weg, die Zeiten, Absagen und das Honorar', () => {
    const submissions = [
      sub('a', 40, 'placed'), sub('b', 30, 'interview'), sub('c', 20, 'submitted'), sub('d', 12, 'submitted'),
      sub('e', 10, 'rejected', { stage: 'client_rejected', rejection_reason: ' Gehalt zu hoch ' }),
      sub('f', 9, 'rejected', { stage: 'withdrawn' }),
      sub('alt', 200, 'interview'),
    ];
    const a = computeRecruiterAnalytics({
      submissions,
      interviews: [{ submission_id: 'a', created_at: vor(36) }, { submission_id: 'b', created_at: vor(20) }, { submission_id: 'alt', created_at: vor(190) }],
      placements: [{ submission_id: 'a', created_at: vor(10), feeCents: 825000 }],
      jobs: [{ id: 'j1', title: 'Test Stelle', industry: 'Medizintechnik', location: 'Stuttgart' }],
    }, '90', now);
    expect(a.submitted).toBe(6);
    expect(a.interviews).toBe(2);
    expect(a.hired).toBe(1);
    expect(a.inviteRate).toBe(33);
    expect(a.hireRate).toBeNull();
    expect(a.daysToInvite).toBe(7);
    expect(a.daysToHire).toBe(30);
    expect(a.waiting).toBe(2);
    expect(a.waitingMaxDays).toBe(20);
    expect(a.rejected).toBe(1);
    expect(a.withdrawn).toBe(1);
    expect(a.reasons).toEqual(['Gehalt zu hoch']);
    expect(a.feeCents).toBe(825000);
    expect(a.weeks.reduce((x, y) => x + y, 0)).toBe(6);
    expect(a.jobs).toEqual([{ jobId: 'j1', title: 'Test Stelle', meta: 'Medizintechnik · Stuttgart', submitted: 6, interviews: 2, hired: 1, daysToInvite: 7 }]);
  });
});
