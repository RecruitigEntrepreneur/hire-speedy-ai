/**
 * Contracting aus Sicht des Recruiters (Entscheidung 29.09.2026).
 *
 * recruiter_jobs_view liefert bei Contracting in day_rate_min/max schon den
 * Satz des Spezialisten (78 %, abgerundet auf volle 10 €) und den Verdienst
 * des Recruiters je Einsatztag. Budget und Marge des Kunden sieht der
 * Recruiter nicht. Hier wird nur noch formatiert.
 */
import { euroSpanne, spanne } from './contractingFreigabe';

// Jede Stellenform aus recruiter_jobs_view; gelesen werden nur die Spalten unten.
type Job = object | null | undefined;
const feld = (job: Job, name: string): unknown => (job as Record<string, unknown> | null | undefined)?.[name];

export const istContracting = (job: Job) => feld(job, 'employment_type') === 'freelance';

/** "310–780 €" -- der Tagessatz für den Spezialisten. */
export function spezialistenSatz(job: Job): string | null {
  if (!istContracting(job)) return null;
  const s = spanne(feld(job, 'day_rate_min'), feld(job, 'day_rate_max'));
  return s ? euroSpanne(s) : null;
}

/** "44–110 €" -- was der Recruiter je Einsatztag verdient. */
export function verdienstJeTag(job: Job): string | null {
  if (!istContracting(job)) return null;
  const s = spanne(feld(job, 'recruiter_day_earning_min'), feld(job, 'recruiter_day_earning_max'));
  return s ? euroSpanne(s) : null;
}

/** "570–1.430 €" -- Verdienst im Monat bei der angegebenen Auslastung, auf 10 € gerundet. */
export function verdienstImMonat(job: Job): string | null {
  if (!istContracting(job)) return null;
  const s = spanne(feld(job, 'recruiter_day_earning_min'), feld(job, 'recruiter_day_earning_max'));
  const tage = Number(feld(job, 'utilization_days_per_week'));
  if (!s || !(tage > 0)) return null;
  const imMonat = (n: number) => Math.round((n * tage * 52) / 12 / 10) * 10;
  return euroSpanne([imMonat(s[0]), imMonat(s[1])]);
}
