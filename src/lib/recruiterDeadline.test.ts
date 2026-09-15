import { describe, expect, it } from 'vitest';
import { recruiterCounterDeadline, munichNonWorkingDay } from '../../supabase/functions/_shared/recruiter-deadline';
describe('Munich contract deadline', () => {
  it.each([
    ['2026-09-15T10:00:00Z','2026-10-15T22:00:00.000Z'],
    ['2026-08-26T10:00:00Z','2026-09-25T22:00:00.000Z'],
    ['2026-08-27T10:00:00Z','2026-09-28T22:00:00.000Z'],
    ['2026-09-25T10:00:00Z','2026-10-26T23:00:00.000Z'],
    ['2026-03-05T10:00:00Z','2026-04-07T22:00:00.000Z'],
    ['2026-12-02T10:00:00Z','2027-01-04T23:00:00.000Z'],
    ['2026-09-14T22:30:00Z','2026-10-15T22:00:00.000Z'],
  ])('resolves %s to the exclusive Berlin boundary %s', (signed,deadline) => expect(recruiterCounterDeadline(signed)).toBe(deadline));
  it('recognizes Munich fixed and movable holidays without adding Augsburg-only holidays', () => {
    for (const day of ['2026-04-03','2026-04-06','2026-05-14','2026-05-25','2026-06-04','2025-08-15','2026-12-25']) expect(munichNonWorkingDay(new Date(day+'T00:00:00Z'))).toBe(true);
    expect(munichNonWorkingDay(new Date('2025-08-08T00:00:00Z'))).toBe(false);
  });
});
