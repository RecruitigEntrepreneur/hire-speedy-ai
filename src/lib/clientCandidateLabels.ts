import i18n from '@/i18n';
import { fmtDate, fmtMoney } from '@/lib/localeFormat';

// Anzeige fester Werte in der Kundenansicht der Bewerber (Namespace clientCandidates, „labels“).
// Die Werte selbst (aus client_candidate_view, z. B. „6-10 Jahre“, „Süddeutschland“) bleiben,
// wie sie sind; übersetzt wird nur, was auf dem Bildschirm steht. Unbekanntes bleibt unverändert.

const t = (key: string, options?: Record<string, unknown>) => i18n.t(`clientCandidates:labels.${key}`, options ?? {});

const REGIONS: Record<string, string> = {
  DACH: 'dach',
  'Süddeutschland': 'south_de',
  'Norddeutschland': 'north_de',
  'Westdeutschland': 'west_de',
  'Ostdeutschland': 'east_de',
  'Österreich': 'austria',
  Schweiz: 'switzerland',
  'EU - Benelux': 'benelux',
  'EU - Frankreich': 'france',
  UK: 'uk',
  'EU - Südeuropa': 'south_eu',
  'EU - Osteuropa': 'east_eu',
  Deutschland: 'germany',
};

/** Grobe Region aus anon_region_broad. */
export function regionLabel(value: string | null | undefined): string {
  if (!value) return '';
  const key = REGIONS[value];
  return key ? t(`region.${key}`) : value;
}

/** Erfahrungsband aus anon_experience_band: „6-10 Jahre“, „15+ Jahre“, „Nicht angegeben“. */
export function experienceBandLabel(value: string | null | undefined): string {
  if (!value) return '';
  if (value === 'Nicht angegeben') return t('notSpecified');
  const range = value.match(/^(\d+)-(\d+) Jahre$/);
  if (range) return t('yearsRange', { from: range[1], to: range[2] });
  const plus = value.match(/^(\d+)\+ Jahre$/);
  if (plus) return t('yearsPlus', { n: plus[1] });
  return value;
}

/** Arbeitsmodell des Kandidaten (remote_preference). */
export function remoteLabel(pref: string | null | undefined, empty = '—'): string {
  if (!pref) return empty;
  return ['remote', 'hybrid', 'onsite', 'flexible'].includes(pref) ? t(`remote.${pref}`) : pref;
}

/** Gehaltsspanne in Euro: „85.000 € – 95.000 €“, „ab …“, „bis …“. */
export function salaryRangeLabel(min: number | null, max: number | null, empty = '—'): string {
  if (!min && !max) return empty;
  if (min && max) return `${fmtMoney(min)} – ${fmtMoney(max)}`;
  if (min) return t('salaryFrom', { value: fmtMoney(min) });
  return t('salaryUpTo', { value: fmtMoney(max!) });
}

/** Zeitraum einer Station im Werdegang (nur Jahre). */
export function careerRangeLabel(entry: { isCurrent: boolean; startDate: string | null; endDate: string | null }): string {
  const year = (d: string | null) => (d ? new Date(d).getFullYear().toString() : '');
  const start = year(entry.startDate);
  if (entry.isCurrent) return start ? t('since', { year: start }) : t('current');
  const end = year(entry.endDate);
  if (start && end) return `${start} – ${end}`;
  if (start) return t('fromYear', { year: start });
  return '';
}

/** Dauer in Jahren: „1 Jahr“, „3 Jahre“. */
export function durationLabel(years: number | null): string {
  if (!years) return '';
  return t('years', { count: years });
}

/** Verfügbar ab einem Datum. */
export const availableFromLabel = (iso: string) => t('availableFrom', { date: fmtDate(iso) });

/** „Sofort“ verfügbar. */
export const immediatelyLabel = () => t('immediately');
