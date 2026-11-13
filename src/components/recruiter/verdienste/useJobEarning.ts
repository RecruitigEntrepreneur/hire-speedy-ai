import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';
import { useJobTerms } from '@/lib/abrechnungApi';
import { jobEarning, type JobEarning, type JobTerms } from '../../../../supabase/functions/_shared/abrechnung-view';

/**
 * Verdienst an einer Stelle (H3–H6): Betrag und Zeile „8.250 € bei Antritt, Rest
 * nach 90 Tagen“ aus Paket, Fassung und Gehaltsspanne. Ohne Konditionen (Function
 * noch nicht deployt, Contracting) null: dann bleibt die bisherige Anzeige.
 */
export function useJobEarning(jobId: string | null | undefined, salaryMin: number | null | undefined, salaryMax: number | null | undefined): { earning: JobEarning | null; terms: JobTerms | null } {
  const { data } = useJobTerms(jobId);
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useMemo(() => ({ earning: jobEarning(data ?? null, salaryMin, salaryMax, lang), terms: data ?? null }), [data, salaryMin, salaryMax, lang]);
}

/** „€24.750“ wie bisher auf Karten und in der Vorschau. */
export const euroKurz = (cents: number) => `€${Math.round(cents / 100).toLocaleString(intlLocale(i18n.language))}`;
