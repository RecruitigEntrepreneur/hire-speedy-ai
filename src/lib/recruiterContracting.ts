/**
 * Contracting aus Sicht des Recruiters (Entscheidung 29.09.2026).
 *
 * recruiter_jobs_view liefert bei Contracting in day_rate_min/max schon den
 * Satz des Spezialisten (78 %, abgerundet auf volle 10 €) und den Verdienst
 * des Recruiters je Einsatztag. Budget und Marge des Kunden sieht der
 * Recruiter nicht. Hier wird nur noch formatiert.
 */
import { spanne } from './contractingFreigabe';
import { fmtNumber, tFor } from './localeFormat';
import i18n from '@/i18n';

// Texte beim Aufruf übersetzt (Namespace jobPosting, contracting.*). Ohne Sprache: Oberfläche.
const tc = (key: string, options?: Record<string, unknown>, lang?: string | null): string =>
  tFor(lang ?? i18n.language, 'jobPosting')(`contracting.${key}`, options) as string;
const betrag = (n: number, lang?: string | null) => fmtNumber(Math.round(n), lang ?? i18n.language);
/** „310–780 €“ in der Sprache der Anzeige. */
const euroSpanne = ([von, bis]: [number, number], lang?: string | null) =>
  tFor(lang ?? i18n.language, 'jobPosting')('money.eur', {
    amount: Math.round(von) === Math.round(bis) ? betrag(von, lang) : `${betrag(von, lang)}–${betrag(bis, lang)}`,
  }) as string;
const zahl = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

// Jede Stellenform aus recruiter_jobs_view; gelesen werden nur die Spalten unten.
type Job = object | null | undefined;
const feld = (job: Job, name: string): unknown => (job as Record<string, unknown> | null | undefined)?.[name];

export const istContracting = (job: Job) => feld(job, 'employment_type') === 'freelance';

/**
 * Wie der Kandidat bezahlt wird -- Entscheidung 25.09.2026
 * (CONTRACTING_ABRECHNUNGSMODELL.md, Freelancer-Vertrag § 5): 30 Tage,
 * Schnellzahlung in 7 Tagen gegen 2 % Skonto.
 */
export const zahlungKandidat = (lang?: string | null) => tc('payment', undefined, lang);

/** Wann der Recruiter sein Geld sieht (CONTRACTING_ABRECHNUNGSMODELL.md). */
export const auszahlungRecruiter = () => tc('payout');

/** "zzgl. USt · 3 Tage/Woche · 12 Monate · Verlängerung möglich" */
export function einsatzFuerKandidat(job: Job): string {
  const j = (job ?? {}) as Record<string, unknown>;
  const tage = zahl(j.utilization_days_per_week);
  const monate = zahl(j.contract_duration_months);
  return [
    tc('plusVat'),
    tage ? tc('daysPerWeek', { n: tage }) : null,
    monate ? tc('months', { n: monate }) : null,
    j.extension_possible === true ? tc('extension') : null,
  ].filter(Boolean).join(' · ');
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
  if (Number.isFinite(bis) && bis > 0) return tc('upTo', { amount: euroSpanne([bis, bis]) });
  const ab = Number(feld(job, 'day_rate_min'));
  return Number.isFinite(ab) && ab > 0 ? tc('from', { amount: euroSpanne([ab, ab]) }) : null;
}

/** Nur der Betrag der Obergrenze („810 €“), ohne „bis“; ohne Obergrenze null. */
export function spezialistenObergrenze(job: Job): string | null {
  if (!istContracting(job)) return null;
  const bis = Number(feld(job, 'day_rate_max'));
  return Number.isFinite(bis) && bis > 0 ? euroSpanne([bis, bis]) : null;
}

/** Fürs Gespräch: Vertragspartner und Status des Kandidaten. */
export const vertragKandidat = () => tc('contract');

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
