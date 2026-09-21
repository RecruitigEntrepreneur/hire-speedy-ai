import { describe, expect, it } from 'vitest';
import { loginPathFor, safeRecruiterPath } from './recruiterLogin';

describe('Headhunter-Anmeldung: Ziel nach dem Login', () => {
  it('führt nur in den Headhunter-Bereich', () => {
    expect(safeRecruiterPath('/recruiter/jobs/abc?tab=briefing')).toBe('/recruiter/jobs/abc?tab=briefing');
    expect(safeRecruiterPath('/recruiter')).toBe('/recruiter');
    expect(safeRecruiterPath(null)).toBe('/recruiter');
    expect(safeRecruiterPath('https://evil.example')).toBe('/recruiter');
    expect(safeRecruiterPath('//evil.example')).toBe('/recruiter');
    expect(safeRecruiterPath('/admin')).toBe('/recruiter');
    expect(safeRecruiterPath('/recruitering')).toBe('/recruiter');
  });

  it('schickt nicht zurück auf Anmelde- oder Onboardingseiten', () => {
    expect(safeRecruiterPath('/recruiter/login')).toBe('/recruiter');
    expect(safeRecruiterPath('/recruiter/onboarding')).toBe('/recruiter');
    expect(safeRecruiterPath('/recruiter/invitation')).toBe('/recruiter');
  });

  it('merkt sich die gewünschte Seite im Anmeldelink', () => {
    expect(loginPathFor('/recruiter/jobs/abc?x=1')).toBe('/recruiter/login?next=%2Frecruiter%2Fjobs%2Fabc%3Fx%3D1');
    expect(safeRecruiterPath(new URLSearchParams(loginPathFor('/recruiter/jobs/abc?x=1').split('?')[1]).get('next'))).toBe('/recruiter/jobs/abc?x=1');
  });
});
