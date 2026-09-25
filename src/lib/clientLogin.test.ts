import { describe, expect, it } from 'vitest';
import { safeClientPath, withFirstVisit } from './clientLogin';

describe('Kundenanmeldung', () => {
  it('lässt nach der Anmeldung nur Seiten im Kundenbereich zu', () => {
    expect(safeClientPath('/dashboard/jobs/1')).toBe('/dashboard/jobs/1');
    expect(safeClientPath('/dashboard?tab=a')).toBe('/dashboard?tab=a');
    for (const bad of [null, '', '/recruiter', 'https://evil.test/dashboard', '//evil.test', '/dashboardx', '/admin']) {
      expect(safeClientPath(bad)).toBe('/dashboard');
    }
  });

  it('hängt den Rundgang-Merker an, ohne vorhandene Parameter zu verlieren', () => {
    expect(withFirstVisit('/dashboard')).toBe('/dashboard?rundgang=1');
    expect(withFirstVisit('/dashboard?tab=a')).toBe('/dashboard?tab=a&rundgang=1');
  });
});
