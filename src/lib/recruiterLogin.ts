/**
 * Anmeldung freigeschalteter Headhunter (/recruiter/login, Entscheidung 21.09.2026):
 * E-Mail, Code aus der Mail, beim ersten Mal Passwort festlegen (überspringbar),
 * dann weiter. Links in den Headhunter-Bereich ohne Anmeldung führen hierher.
 */

/** Merker im Konto, dass ein Passwort festgelegt wurde; dann fragt die Anmeldung nicht mehr danach. */
export const PASSWORD_SET_KEY = 'password_set_at';

/** Ziel nach der Anmeldung: nur Seiten im Headhunter-Bereich, keine fremden Adressen, keine Anmeldeseiten. */
export function safeRecruiterPath(value: string | null | undefined): string {
  if (!value || !/^\/recruiter(\/|\?|$)/.test(value) || /^\/recruiter\/(login|onboarding|invitation)(\/|\?|$)/.test(value)) return '/recruiter';
  return value;
}

export const loginPathFor = (path: string) => `/recruiter/login?next=${encodeURIComponent(path)}`;

/** Antwort auf den persönlichen Link aus der Willkommensmail (/recruiter/login#<Schlüssel>). */
export type LoginLinkPeek = { status: 'open'; name: string; masked_email: string } | { status: 'expired' | 'invalid' };
