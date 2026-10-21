import { Button } from '@/components/ui/button';
import { Lock, Search, Check } from 'lucide-react';
import { formatAnonymousCompanyShort, formatWorkModel } from '@/lib/anonymousCompanyFormat';
import { spezialistenSatz, verdienstJeTag } from '@/lib/recruiterContracting';
import { FirmenLogo } from '@/components/company/FirmenLogo';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Honorar } from './Honorar';

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

const formatSalaryRange = (min: number | null, max: number | null): string | null => {
  const k = (n: number) => `${Math.round(n / 1000)}`;
  if (min && max) return `€${k(min)}–${k(max)}k`;
  if (min) return `ab €${k(min)}k`;
  if (max) return `bis €${k(max)}k`;
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
  const salaryRange = formatSalaryRange(job.salary_min, job.salary_max);
  const tagVerdienst = verdienstJeTag(job);
  const tagessatz = spezialistenSatz(job);
  const skills = (job.skills || []).slice(0, 3);
  const moreSkills = Math.max((job.skills?.length || 0) - 3, 0);
  const freshness = job.updated_at
    ? formatDistanceToNow(new Date(job.updated_at), { locale: de, addSuffix: true })
    : null;
  const urgent = job.hiring_urgency === 'urgent';
  const facts = [
    tagessatz ? `Contracting · ${tagessatz} / Tag` : salaryRange,
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
        <h3 className="min-w-0 text-[15px] font-medium leading-snug">{job.title}</h3>
        <span className="shrink-0 text-[15px] font-semibold tabular-nums text-emerald-500">
          <Honorar>{tagVerdienst ?? (earning ? `€${earning.toLocaleString('de-DE')}` : `${job.recruiter_fee_percentage} %`)}</Honorar>
        </span>
      </div>

      {/* Zeile 2: Dringend · Firma · Ort · Arbeitsmodell | Honorar-Satz */}
      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        {/* Firmenname kürzt mit „…“, statt unter den Honorar-Satz zu laufen (21.10.2026). */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          {urgent && <span className="shrink-0 font-medium text-destructive">Dringend</span>}
          {urgent && <span aria-hidden="true">·</span>}
          {isRevealed ? (
            <>
              <FirmenLogo url={job.company_logo_url} name={revealedCompanyName} size={16} />
              <span className="min-w-0 truncate text-foreground/80">{revealedCompanyName}</span>
            </>
          ) : (
            <>
              <Lock className="h-3 w-3 shrink-0" aria-label="Firma anonym" />
              <span className="truncate">{formatAnonymousCompanyShort({ industry: job.industry, companySize: job.company_size_band })}</span>
            </>
          )}
          {job.location && <><span aria-hidden="true">·</span><span className="truncate">{job.location}</span></>}
          {job.remote_type && <><span aria-hidden="true" className="hidden sm:inline">·</span><span className="hidden shrink-0 sm:inline">{formatWorkModel(job.remote_type)}</span></>}
        </div>
        {/* Am Handy genügt der Betrag oben; Satz und Arbeitsmodell ab sm. */}
        <span className="hidden shrink-0 tabular-nums sm:inline">
          {tagVerdienst ? 'je Einsatztag' : earning != null ? <Honorar>{`${job.recruiter_fee_percentage} % Honorar`}</Honorar> : null}
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
            Pausiert bis {new Date(pausedUntil).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
          </span>
        ) : (
          <span className="truncate text-[11px] text-muted-foreground">{freshness ? `${freshness} aktualisiert` : ''}</span>
        )}

        {isActive ? (
          <span data-tour={tourId ? `${tourId}.activate` : undefined} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-500">
            <Check className="h-3.5 w-3.5" />Du suchst
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
            Ich suche
          </Button>
        )}
      </div>
    </div>
  );
}
