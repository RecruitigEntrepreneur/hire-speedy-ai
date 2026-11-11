/**
 * Contracting aus Sicht des Recruiters (Entscheidung 29.09.2026).
 *
 * recruiter_jobs_view liefert bei Contracting in day_rate_min/max schon den
 * Satz des Spezialisten (78 %, abgerundet auf volle 10 €) und den Verdienst
 * des Recruiters je Einsatztag. Budget und Marge des Kunden sieht der
 * Recruiter nicht. Hier wird nur noch formatiert.
 */
import { einsatzZeile, euroSpanne, spanne } from './contractingFreigabe';

// Jede Stellenform aus recruiter_jobs_view; gelesen werden nur die Spalten unten.
type Job = object | null | undefined;
const feld = (job: Job, name: string): unknown => (job as Record<string, unknown> | null | undefined)?.[name];

export const istContracting = (job: Job) => feld(job, 'employment_type') === 'freelance';

/**
 * Wie der Kandidat bezahlt wird -- Entscheidung 25.09.2026
 * (CONTRACTING_ABRECHNUNGSMODELL.md, Freelancer-Vertrag § 5): 30 Tage,
 * Schnellzahlung in 7 Tagen gegen 2 % Skonto.
 */
export const ZAHLUNG_KANDIDAT = 'Zahlung 30 Tage nach Abnahme, auf Wunsch in 7 Tagen mit 2 % Skonto';

/** Wann der Recruiter sein Geld sieht (CONTRACTING_ABRECHNUNGSMODELL.md). */
export const AUSZAHLUNG_RECRUITER = 'monatlich nach Zahlung des Kunden';

/** "zzgl. USt · 3 Tage/Woche · 12 Monate · Verlängerung möglich" */
export function einsatzFuerKandidat(job: Job): string {
  const einsatz = job ? einsatzZeile(job as Record<string, unknown>) : null;
  return ['zzgl. USt', einsatz].filter(Boolean).join(' · ');
}

/** "310–780 €" -- der Tagessatz für den Spezialisten. */
export function spezialistenSatz(job: Job): string | null {
  if (!istContracting(job)) return null;
  const s = spanne(feld(job, 'day_rate_min'), feld(job, 'day_rate_max'));
  return s ? euroSpanne(s) : null;
}

/**
 * "bis 810 €" -- die Obergrenze für den Kandidaten (Etappe 1, 04.11.2026). Die
 * Spanne allein las sich wie ein Korridor; entscheidend ist, bis wohin der
 * Kandidat gehen darf. Ohne Obergrenze die Untergrenze ("ab 660 €").
 */
export function spezialistenGrenze(job: Job): string | null {
  if (!istContracting(job)) return null;
  const bis = Number(feld(job, 'day_rate_max'));
  if (Number.isFinite(bis) && bis > 0) return `bis ${euroSpanne([bis, bis])}`;
  const ab = Number(feld(job, 'day_rate_min'));
  return Number.isFinite(ab) && ab > 0 ? `ab ${euroSpanne([ab, ab])}` : null;
}

/** Fürs Gespräch: Vertragspartner und Status des Kandidaten. */
export const VERTRAG_KANDIDAT =
  'Vertrag und Rechnung laufen über Matchunt, nicht über den Kunden. Selbstständig: eigene Rechnung, eigene Versicherung, keine Anstellung.';

/** "44–110 €" -- was der Recruiter je Einsatztag verdient. */
export function verdienstJeTag(job: Job): string | null {
  if (!istContracting(job)) return null;
  const s = spanne(feld(job, 'recruiter_day_earning_min'), feld(job, 'recruiter_day_earning_max'));
  return s ? euroSpanne(s) : null;
}

/** "24.400–30.200 €" -- Verdienst über die ganze Laufzeit bei der angegebenen Auslastung, auf 100 € gerundet. */
export function verdienstLaufzeit(job: Job): string | null {
  if (!istContracting(job)) return null;
  const s = spanne(feld(job, 'recruiter_day_earning_min'), feld(job, 'recruiter_day_earning_max'));
  const tage = Number(feld(job, 'utilization_days_per_week'));
  const monate = Number(feld(job, 'contract_duration_months'));
  if (!s || !(tage > 0) || !(monate > 0)) return null;
  const gesamt = (n: number) => Math.round((n * tage * 52 * monate) / 12 / 100) * 100;
  return euroSpanne([gesamt(s[0]), gesamt(s[1])]);
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
