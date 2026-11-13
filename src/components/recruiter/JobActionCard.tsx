import { Button } from '@/components/ui/button';
import { Lock, Search, Check } from 'lucide-react';
import { formatAnonymousCompanyShort, formatWorkModel } from '@/lib/anonymousCompanyFormat';
import { spezialistenGrenze, verdienstImMonat, verdienstJeTag } from '@/lib/recruiterContracting';
import { FirmenLogo } from '@/components/company/FirmenLogo';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation, Trans } from 'react-i18next';
import { intlLocale } from '@/i18n/languages';
import { dateFnsLocale } from './search/dateLocale';
import { Honorar } from './Honorar';
import { useJobEarning, euroKurz } from './verdienste/useJobEarning';
import { runningSince } from '../../../supabase/functions/_shared/abrechnung-view';

interface JobActionCardProps {
  job: {
    id: string;
    // client_id bewusst nicht Teil der Props: recruiter_jobs_view liefert die
    // Spalte seit Welle 1 nicht mehr aus (Identitaetsvektor).
    title: string;
    company_name: string | null;
    /** Aus recruiter_jobs_view, wie der Name erst nach dem Reveal befüllt. */
    company_logo_url?: string | null;
    location: string;
    remote_type: string;
    salary_min: number | null;
    salary_max: number | null;
    recruiter_fee_percentage: number;
    skills: string[];
    hiring_urgency: string | null;
    industry: string | null;
    company_size_band: string | null;
    funding_stage: string | null;
    tech_environment: string[] | null;
    updated_at?: string | null;
    /** Contracting: aus recruiter_jobs_view, Satz des Spezialisten und Verdienst je Tag. */
    employment_type?: string | null;
    day_rate_min?: number | null;
    day_rate_max?: number | null;
    recruiter_day_earning_min?: number | null;
    recruiter_day_earning_max?: number | null;
  };
  earning: number | null;
  isRevealed: boolean;
  revealedCompanyName?: string;
  isSelected: boolean;
  /** Anker für den Rundgang (data-tour); nur an einer Karte gesetzt. */
  tourId?: string;
  isActive: boolean;
  /** Kunde hat pausiert: bis wann (oder seit wann, ohne Ende). */
  pausedUntil?: string | null;
  onSelect: () => void;
  onToggleActive: (e: React.MouseEvent) => void;
}

const formatSalaryRange = (min: number | null, max: number | null, t: (key: string, options?: Record<string, unknown>) => string): string | null => {
  const k = (n: number) => `${Math.round(n / 1000)}`;
  if (min && max) return `€${k(min)}–${k(max)}k`;
  if (min) return t('card.salaryFrom', { amount: `€${k(min)}k` });
  if (max) return t('card.salaryUpTo', { amount: `€${k(max)}k` });
  return null;
};

/**
 * Eine Stelle in der Liste „Offene Jobs" (Umbau 19.10.2026).
 *
 * Drei Zeilen statt fünf: Titel und Verdienst, dann wer/wo in einer Zeile, dann
 * Gehalt und Skills als Text. Farbe nur mit Bedeutung — Grün ist Geld und „Du
 * suchst", Rot ist dringend, alles andere grau. Die anonyme Firmenzeile nennt nur
 * Branche und Größe; Ort, Arbeitsmodell und Dringlichkeit standen vorher doppelt.
 */
export function JobActionCard({
  job,
  earning,
  isRevealed,
  revealedCompanyName,
  isSelected,
  tourId,
  isActive,
  pausedUntil,
  onSelect,
  onToggleActive,
}: JobActionCardProps) {
  const { t, i18n } = useTranslation('recruiterJobs');
  const locale = intlLocale(i18n.language);
  const salaryRange = formatSalaryRange(job.salary_min, job.salary_max, t);
  const tagVerdienst = verdienstJeTag(job);
  const monatVerdienst = verdienstImMonat(job);
  const tagessatz = spezialistenGrenze(job);
  // Verdienst nach Paket und Fassung, mit „in 2 Teilen“ (H3) bzw. Nachbesetzung (H6), Umbau 11.11.2026
  const { earning: plan } = useJobEarning(tagVerdienst ? null : job.id, job.salary_min, job.salary_max);
  const skills = (job.skills || []).slice(0, 3);
  const moreSkills = Math.max((job.skills?.length || 0) - 3, 0);
  const freshness = job.updated_at
    ? formatDistanceToNow(new Date(job.updated_at), { locale: dateFnsLocale(i18n.language), addSuffix: true })
    : null;
  const urgent = job.hiring_urgency === 'urgent';
  const facts = [
    tagessatz ? t('card.contracting', { rate: tagessatz }) : salaryRange,
    plan?.research ? t('card.researchSince', { since: runningSince(plan.research.since, new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }), i18n.language) }) : null,
    ...skills,
  ].filter(Boolean) as string[];

  return (
    <div
      role="button"
      tabIndex={0}
      data-tour={tourId}
      data-job-id={tourId ? job.id : undefined}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); }}
      className={cn(
        'group cursor-pointer rounded-lg border bg-card px-4 py-3 transition-colors',
        isSelected
          ? 'border-primary/60 ring-1 ring-primary/40'
          : 'border-border hover:border-muted-foreground/40',
      )}
    >
      {/* Zeile 1: Titel | Verdienst */}
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 text-[15px] font-medium leading-snug">
          {plan?.research && <span className="mr-1.5 inline-block rounded border border-border px-1.5 align-middle text-[11px] font-normal text-muted-foreground">{t('card.research')}</span>}
          {job.title}
          {plan?.research?.own && <span className="text-sm font-normal text-muted-foreground"> · {t('card.ownPlacement')}</span>}
        </h3>
        <span className="shrink-0 text-[15px] font-semibold tabular-nums text-emerald-500">
          <Honorar>{tagVerdienst ?? (plan ? `${plan.research ? '' : '≈ '}${euroKurz(plan.totalCents)}` : earning ? `€${earning.toLocaleString(locale)}` : `${job.recruiter_fee_percentage} %`)}</Honorar>
        </span>
      </div>

      {/* Zeile 2: Dringend · Firma · Ort · Arbeitsmodell | Honorar-Satz */}
      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        {/* Firmenname kürzt mit „…“, statt unter den Honorar-Satz zu laufen (21.10.2026). */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          {urgent && <span className="shrink-0 font-medium text-destructive">{t('card.urgent')}</span>}
          {urgent && <span aria-hidden="true">·</span>}
          {isRevealed ? (
            <>
              <FirmenLogo url={job.company_logo_url} name={revealedCompanyName} size={16} />
              <span className="min-w-0 truncate text-foreground/80">{revealedCompanyName}</span>
            </>
          ) : (
            <>
              <Lock className="h-3 w-3 shrink-0" aria-label={t('card.companyAnonymous')} />
              <span className="truncate">{formatAnonymousCompanyShort({ industry: job.industry, companySize: job.company_size_band })}</span>
            </>
          )}
          {job.location && <><span aria-hidden="true">·</span><span className="truncate">{job.location}</span></>}
          {job.remote_type && <><span aria-hidden="true" className="hidden sm:inline">·</span><span className="hidden shrink-0 sm:inline">{formatWorkModel(job.remote_type)}</span></>}
        </div>
        {/* Am Handy genügt der Betrag oben; Satz und Arbeitsmodell ab sm. */}
        <span className="hidden shrink-0 tabular-nums sm:inline">
          {tagVerdienst ? <>{t('card.perDay')}{monatVerdienst ? <span className="hidden xl:inline"> · <Trans t={t} i18nKey="card.perMonth" components={{ fee: <Honorar>{monatVerdienst}</Honorar> }} /></span> : null}</> : plan ? plan.cardLine : earning != null ? <Honorar>{t('card.feePercent', { pct: job.recruiter_fee_percentage })}</Honorar> : null}
        </span>
      </div>

      {/* Zeile 3: Gehalt · Skills */}
      {facts.length > 0 && (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {facts.join(' · ')}
          {moreSkills > 0 && <span className="text-muted-foreground/70"> · +{moreSkills}</span>}
        </p>
      )}

      {/* Fuß: Frische | Ich suche (keine Zahl anderer Headhunter) */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {pausedUntil ? (
          <span className="truncate text-[11px] text-amber-600">
            {t('card.pausedUntil', { date: new Date(pausedUntil).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }) })}
          </span>
        ) : (
          <span className="truncate text-[11px] text-muted-foreground">{freshness ? t('card.updated', { when: freshness }) : ''}</span>
        )}

        {isActive ? (
          <span data-tour={tourId ? `${tourId}.activate` : undefined} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-500">
            <Check className="h-3.5 w-3.5" />{t('card.searching')}
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            data-tour={tourId ? `${tourId}.activate` : undefined}
            className="h-7 shrink-0 px-2.5 text-xs"
            disabled={!!pausedUntil}
            onClick={onToggleActive}
          >
            <Search className="mr-1 h-3 w-3" />
            {t('card.iSearch')}
          </Button>
        )}
      </div>
    </div>
  );
}
