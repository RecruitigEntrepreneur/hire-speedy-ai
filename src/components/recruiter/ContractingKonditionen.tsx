import {
  auszahlungRecruiter,
  vertragKandidat,
  zahlungKandidat,
  einsatzFuerKandidat,
  spezialistenGrenze,
  spezialistenObergrenze,
  verdienstImMonat,
  verdienstJeTag,
  verdienstLaufzeit,
} from '@/lib/recruiterContracting';
import { Honorar } from './Honorar';
import { useTranslation, Trans } from 'react-i18next';

/**
 * Projektkonditionen einer Contracting-Stelle als Gesprächskarte (Variante C,
 * Entscheidung 29.09.2026).
 *
 * Befund: "Tagessatz für den Spezialisten" direkt über "Dein Verdienst" liess
 * offen, ob der Verdienst vom Satz des Kandidaten abgeht oder obendrauf kommt.
 * Die Karte trennt deshalb, was in das Gespräch mit dem Kandidaten gehört, von
 * dem, was nur der Recruiter sieht, und beantwortet beide Fragen ausdrücklich.
 * Budget und Marge des Kunden stehen hier nie.
 *
 * Etappe 1 (04.11.2026): die Obergrenze statt der Spanne, wer Vertragspartner
 * ist, der Wert über die Laufzeit und was bei einem höheren Satz passiert.
 */
export function ContractingKonditionen({ job }: { job: object }) {
  const { t } = useTranslation('recruiterJobDetail');
  const grenze = spezialistenGrenze(job);
  const jeTag = verdienstJeTag(job);
  const imMonat = verdienstImMonat(job);
  const laufzeit = verdienstLaufzeit(job);
  const { utilization_days_per_week: tage, contract_duration_months: monate } =
    job as { utilization_days_per_week?: number | null; contract_duration_months?: number | null };
  const obergrenze = spezialistenObergrenze(job);

  return (
    <div className="space-y-4 rounded-xl border border-border p-5">
      <h3 className="font-medium">{t('contracting.title')}</h3>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{t('contracting.forCandidate')}</p>
        <p className="text-lg font-semibold">
          {grenze ? t('contracting.ratePerDay', { rate: `${grenze.charAt(0).toUpperCase()}${grenze.slice(1)}` }) : t('contracting.rateMissing')}
        </p>
        <p className="text-xs leading-5 text-muted-foreground">{einsatzFuerKandidat(job)}</p>
        <p className="text-xs leading-5 text-muted-foreground">{zahlungKandidat()}</p>
        <p className="text-xs leading-5 text-muted-foreground">{vertragKandidat()}</p>
      </div>

      {jeTag && (
        <div className="space-y-1 rounded-lg bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">{t('contracting.onlyYou')}</p>
          <p className="text-lg font-semibold text-emerald-600"><Honorar>{t('contracting.approx', { amount: jeTag })}</Honorar></p>
          <p className="text-xs leading-5 text-muted-foreground">
            {t('contracting.perDay')}{imMonat ? <> · <Trans t={t} i18nKey="contracting.perWeek" values={{ days: tage }} components={{ fee: <Honorar>{imMonat}</Honorar> }} /></> : ''}
            {laufzeit ? <> · <Trans t={t} i18nKey="contracting.perDuration" values={{ months: monate }} components={{ fee: <Honorar>{laufzeit}</Honorar> }} /></> : ''} · {auszahlungRecruiter()}
          </p>
        </div>
      )}

      {jeTag && (
        <div className="space-y-2 text-xs leading-5">
          <p><Trans t={t} i18nKey="contracting.qDeducted" components={{ q: <span className="font-medium" /> }} /></p>
          <p><Trans t={t} i18nKey="contracting.qOnTop" components={{ q: <span className="font-medium" /> }} /></p>
          {obergrenze && (
            <p><Trans t={t} i18nKey="contracting.qMore" values={{ limit: obergrenze }} components={{ q: <span className="font-medium" /> }} /></p>
          )}
        </div>
      )}
    </div>
  );
}
