import { describe, expect, it } from 'vitest';
import { addWorkdays, bundleByJob, candidateUpdateChoice, candidateUpdateText, nudgeState, workdaysBetween } from './kundePrueft';
import type { UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';

// Montag 19.10.2026, 18:21
const MO = new Date('2026-10-19T18:21:00');

describe('Werktage', () => {
  it('überspringt das Wochenende', () => {
    expect(addWorkdays(new Date('2026-10-22T10:00:00'), 3).toDateString()).toBe(new Date('2026-10-27T10:00:00').toDateString()); // Do + 3 = Di
    expect(addWorkdays(MO, 3).toDateString()).toBe(new Date('2026-10-22T10:00:00').toDateString()); // Mo + 3 = Do
  });
  it('zählt Werktage zwischen zwei Tagen', () => {
    expect(workdaysBetween(new Date('2026-10-14T13:00:00'), new Date('2026-10-20T09:00:00'))).toBe(4); // Mi → Di
    expect(workdaysBetween(MO, MO)).toBe(0);
  });
});

describe('Treppe: Erinnerung, Warten, Matchunt', () => {
  it('ohne Erinnerung bist du dran', () => {
    expect(nudgeState([], MO).waitState).toBe('jetzt');
  });
  it('nach der 1. Erinnerung wartest du drei Werktage', () => {
    const s = nudgeState(['2026-10-19T18:21:00'], new Date('2026-10-21T09:00:00'));
    expect(s.waitState).toBe('wartet');
    expect(new Date(s.nextNudgeAt!).toDateString()).toBe(new Date('2026-10-22T00:00:00').toDateString());
  });
  it('dann ist die 2. Erinnerung dran', () => {
    expect(nudgeState(['2026-10-19T18:21:00'], new Date('2026-10-22T19:00:00')).waitState).toBe('jetzt');
  });
  it('nach zwei Erinnerungen ohne Antwort übernimmt Matchunt', () => {
    const s = nudgeState(['2026-10-19T18:21:00', '2026-10-22T19:00:00'], new Date('2026-10-28T09:00:00'));
    expect(s.nudgeCount).toBe(2);
    expect(s.waitState).toBe('matchunt');
  });
});

describe('Kandidaten Bescheid geben?', () => {
  const now = new Date('2026-10-20T10:14:00');
  it('wählt aus, wenn der letzte Kontakt 5 Werktage her ist (Einreichung zählt)', () => {
    const c = candidateUpdateChoice({ hasEmail: true, lastContactAt: null, lastUpdateAt: null, submittedAt: '2026-10-13T09:00:00' }, now);
    expect(c.preselect).toBe(true);
    expect(c.reason).toBe('Letzter Kontakt vor 7 Tagen (Einreichung)');
  });
  it('wählt nicht aus, wenn er diese Woche schon einen Zwischenstand bekam', () => {
    const c = candidateUpdateChoice({ hasEmail: true, lastContactAt: '2026-10-19T18:22:00', lastUpdateAt: '2026-10-19T18:22:00', submittedAt: '2026-10-14T13:00:00' }, now);
    expect(c.preselect).toBe(false);
    expect(c.reason).toBe('Zwischenstand gestern schon bekommen');
  });
  it('wählt nicht aus, wenn du vor kurzem angerufen hast', () => {
    const c = candidateUpdateChoice({ hasEmail: true, lastContactAt: '2026-10-16T11:00:00', lastUpdateAt: null, submittedAt: '2026-10-05T09:00:00' }, now);
    expect(c.preselect).toBe(false);
  });
  it('ohne E-Mail nicht wählbar', () => {
    expect(candidateUpdateChoice({ hasEmail: false, lastContactAt: null, lastUpdateAt: null, submittedAt: null }, now).disabled).toBe(true);
  });
  it('der Text folgt der Bitte an den Kunden', () => {
    expect(candidateUpdateText('decision', 'Projektingenieur', 'Donnerstag')).toBe('ich habe heute beim Unternehmen zu Projektingenieur nachgefragt. Ich rechne bis Donnerstag mit einer Rückmeldung und melde mich, sobald ich etwas höre.');
    expect(candidateUpdateText('remind', null, 'Donnerstag')).toContain('nachgefasst');
    expect(candidateUpdateText('question', 'Projektingenieur', 'Donnerstag', 'am 15.10.')).toContain('ich habe am 15.10. beim Unternehmen');
  });
});

describe('Eine Zeile je Stelle', () => {
  const item = (id: string, jobId: string, createdAt: string, nudgeCount = 0, fee = 11000): UnifiedTaskItem => ({
    itemType: 'derived', itemId: id, recruiterId: 'r', title: '', description: null, recommendedAction: null, taskCategory: 'client_review_stalled',
    sortPriority: 2, priority: 'high', submissionId: id, candidateId: `c-${id}`, jobId, playbookId: null, createdAt, dueAt: null,
    isRead: false, isArchived: false, isCompleted: false, completedAt: null, snoozedUntil: null, impactScore: 60, feeValue: fee,
    candidateName: `Kandidat ${id}`, candidatePhone: null, candidateEmail: null, jobTitle: `Stelle ${jobId}`, companyName: null, isStale: false, nudgeCount,
  });
  it('bündelt je Stelle, längste Wartezeit zuerst', () => {
    const b = bundleByJob([
      item('a', 'tax', '2026-10-13T09:00:00'), item('b', 'tax', '2026-10-14T09:00:00'),
      item('c', 'it', '2026-10-05T09:00:00', 1),
    ], new Date('2026-10-20T10:00:00'));
    expect(b.map(x => [x.key, x.items.length, x.days, x.erinnerung])).toEqual([['it', 1, 15, 2], ['tax', 2, 7, 1]]);
    expect(b[1].feeTotal).toBe(22000);
  });
});
