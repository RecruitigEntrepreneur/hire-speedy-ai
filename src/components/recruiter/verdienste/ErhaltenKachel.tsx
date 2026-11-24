import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { Honorar } from '@/components/recruiter/Honorar';
import { useVerdienste } from '@/lib/abrechnungApi';
import { eur0 } from '../../../../supabase/functions/_shared/abrechnung-view';

const year = () => String(new Date().getFullYear());

/**
 * Zeilen der Karte „Dein Geld“ auf der Startseite (23.11.2026): „Erhalten 2026“ zählt nur,
 * was als Gutschrift ausgezahlt ist; darunter die nächste Gutschrift. Ruhig, ohne Grün.
 */
export function GeldZeilen() {
  const { t } = useTranslation('recruiterEarnings');
  const { data, isError } = useVerdienste();
  const next = data?.next;
  return (
    <>
      <div className="flex items-baseline justify-between gap-3 pb-2.5">
        <span className="text-muted-foreground">{t('overview.received', { year: data?.year ?? year() })}</span>
        <span className="font-semibold tabular-nums">{data ? <Honorar>{eur0(data.totals.receivedYearCents, i18n.language)}</Honorar> : isError ? '–' : '…'}</span>
      </div>
      {next && (
        <div className="py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground">{t('tile.next')}</span>
            <span className="font-semibold tabular-nums"><Honorar>{eur0(next.netCents, i18n.language)}</Honorar></span>
          </div>
          <p className="mt-0.5 text-right text-xs text-muted-foreground">{next.slot.label}</p>
        </div>
      )}
    </>
  );
}
