import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, ExternalLink, FileText, Lock, Rocket, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatAnonymousCompanyShort, formatWorkModel } from '@/lib/anonymousCompanyFormat';
import { FirmenLogo } from '@/components/company/FirmenLogo';
import { cn } from '@/lib/utils';
import { spezialistenSatz, verdienstJeTag } from '@/lib/recruiterContracting';
import { Honorar } from './Honorar';

interface JobPreviewPanelProps {
  job: {
    id: string;
    // client_id bewusst nicht Teil der Props: recruiter_jobs_view liefert die
    // Spalte seit Welle 1 nicht mehr aus (Identitaetsvektor).
    title: string;
    company_name: string | null;
    /** Aus recruiter_jobs_view, wie der Name erst nach dem Reveal befüllt. */
    company_logo_url?: string | null;
    description?: string | null;
    location: string;
    remote_type: string;
    employment_type: string;
    experience_level: string;
    salary_min: number | null;
    salary_max: number | null;
    recruiter_fee_percentage: number;
    skills: string[];
    created_at: string;
    hiring_urgency: string | null;
    industry: string | null;
    company_size_band: string | null;
    funding_stage: string | null;
    tech_environment: string[] | null;
    /** Contracting: aus recruiter_jobs_view, Satz des Spezialisten und Verdienst je Tag. */
    day_rate_min?: number | null;
    day_rate_max?: number | null;
    recruiter_day_earning_min?: number | null;
    recruiter_day_earning_max?: number | null;
  };
  earning: number | null;
  isRevealed: boolean;
  revealedCompanyName?: string;
  isActive: boolean;
  /** Kunde hat pausiert: bis wann. */
  pausedUntil?: string | null;
  onToggleActive: () => void;
  onClose: () => void;
}

const formatSalaryShort = (min: number | null, max: number | null) => {
  const k = (n: number) => Math.round(n / 1000);
  if (min && max) return `€${k(min)}–${k(max)}k`;
  if (min) return `ab €${k(min)}k`;
  if (max) return `bis €${k(max)}k`;
  return 'k. A.';
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  'full-time': 'Vollzeit',
  full_time: 'Vollzeit',
  'part-time': 'Teilzeit',
  part_time: 'Teilzeit',
  contract: 'Projektvertrag',
  freelance: 'Freelance',
  temporary: 'Befristet',
  internship: 'Praktikum',
};

const LEVEL_LABELS: Record<string, string> = {
  junior: 'Junior',
  mid: 'Mid-Level',
  senior: 'Senior',
  lead: 'Lead',
  'c-level': 'C-Level',
};

function Fakt({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 text-sm last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium">{children}</span>
    </div>
  );
}

function Abschnitt({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-4">
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Vorschau rechts neben der Liste „Offene Jobs" (Umbau 19.10.2026).
 *
 * „Du suchst" ist ein Stand und steht in der Kopfzeile — vorher sah es aus wie
 * ein Knopf, der nichts tat. Je Zustand ein Hauptknopf: „Ich suche", danach
 * „Kandidat vorschlagen". Die Eckdaten als ruhige Liste statt vier Kästen.
 * „Anzeige & Ansprache" öffnet das Mandatsbriefing mit „Zum Teilen".
 */
export function JobPreviewPanel({
  job,
  earning,
  isRevealed,
  revealedCompanyName,
  isActive,
  pausedUntil,
  onToggleActive,
  onClose,
}: JobPreviewPanelProps) {
  const [descExpanded, setDescExpanded] = useState(false);
  const urgent = job.hiring_urgency === 'urgent';
  const tagVerdienst = verdienstJeTag(job);
  const pauseText = pausedUntil
    ? `Pausiert bis ${new Date(pausedUntil).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`
    : null;
  const level = [LEVEL_LABELS[job.experience_level] || job.experience_level, EMPLOYMENT_LABELS[job.employment_type] || job.employment_type]
    .filter(Boolean).join(' · ');
  const ort = [job.location, job.remote_type ? formatWorkModel(job.remote_type) : null].filter(Boolean).join(' · ');

  return (
    <div className="flex h-full flex-col">
      {/* ── Kopf: Logo, Titel, Firma · Stand ── */}
      <div className="border-b border-border p-4">
        <div className="flex items-start gap-3">
          <FirmenLogo url={job.company_logo_url} name={revealedCompanyName} size={40} locked={!isRevealed} />

          <div className="min-w-0 flex-1">
            <Link to={`/recruiter/jobs/${job.id}`} className="text-base font-semibold leading-snug transition-colors hover:text-primary">
              {job.title}
            </Link>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              <span>{isRevealed ? revealedCompanyName : formatAnonymousCompanyShort({ industry: job.industry, companySize: job.company_size_band })}</span>
              {urgent && <><span aria-hidden="true">·</span><span className="font-medium text-destructive">Dringend</span></>}
              {isActive && <><span aria-hidden="true">·</span><span className="inline-flex items-center gap-1 font-medium text-emerald-500"><Check className="h-3.5 w-3.5" />Du suchst</span></>}
              {!isActive && pauseText && <><span aria-hidden="true">·</span><span className="text-amber-600">{pauseText}</span></>}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" asChild>
              <Link to={`/recruiter/jobs/${job.id}`} aria-label="Mandatsbriefing öffnen">
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onClose} aria-label="Vorschau schließen">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Zwei Knöpfe, einer davon der nächste Schritt. */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {/* Direkt aus der Liste an Anzeige und Ansprachetexte (29.09.2026), seit 19.10. im Briefing. */}
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
            <Link to={`/recruiter/jobs/${job.id}?teilen=1`}>
              <FileText className="mr-1 h-3.5 w-3.5" />
              Anzeige &amp; Ansprache
            </Link>
          </Button>
          {isActive ? (
            <Button size="sm" className="h-8 text-xs" asChild>
              <Link to={`/recruiter/jobs/${job.id}`}>
                <Rocket className="mr-1 h-3.5 w-3.5" />
                Kandidat vorschlagen
              </Link>
            </Button>
          ) : pauseText ? (
            <Button size="sm" className="h-8 text-xs" disabled>
              <Lock className="mr-1 h-3.5 w-3.5" />
              {pauseText}
            </Button>
          ) : (
            <Button size="sm" className="h-8 text-xs" onClick={onToggleActive}>
              <Search className="mr-1 h-3.5 w-3.5" />
              Ich suche
            </Button>
          )}
        </div>
      </div>

      {/* ── Inhalt ── */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          {tagVerdienst ? (
            <>
              <Fakt label="Dein Verdienst"><span className="text-emerald-500"><Honorar>{`${tagVerdienst} je Einsatztag`}</Honorar></span></Fakt>
              <Fakt label="Tagessatz Spezialist">{spezialistenSatz(job) ?? 'k. A.'}</Fakt>
            </>
          ) : (
            <>
              <Fakt label="Dein Verdienst">
                <span className="text-emerald-500">
                  <Honorar>{earning ? `€${earning.toLocaleString('de-DE')} (${job.recruiter_fee_percentage} %)` : `${job.recruiter_fee_percentage} % vom Jahresgehalt`}</Honorar>
                </span>
              </Fakt>
              <Fakt label="Gehalt">{formatSalaryShort(job.salary_min, job.salary_max)}</Fakt>
            </>
          )}
          {level && <Fakt label="Level">{level}</Fakt>}
          {ort && <Fakt label="Ort">{ort}</Fakt>}
        </div>

        {((job.skills && job.skills.length > 0) || (job.tech_environment && job.tech_environment.length > 0)) && (
          <Abschnitt title="Skills und Tech-Stack">
            <div className="flex flex-wrap gap-1.5">
              {job.skills?.map((skill) => (
                <Badge key={skill} variant="outline" className="text-xs font-normal">{skill}</Badge>
              ))}
              {job.tech_environment?.map((tech) => (
                <Badge key={tech} variant="secondary" className="text-xs font-normal">{tech}</Badge>
              ))}
            </div>
          </Abschnitt>
        )}

        {job.description && (
          <Abschnitt title="Stellenbeschreibung">
            <p className={cn('whitespace-pre-line text-sm leading-6 text-muted-foreground', !descExpanded && 'line-clamp-[8]')}>
              {job.description}
            </p>
            <button onClick={() => setDescExpanded(!descExpanded)} className="mt-1.5 text-xs text-primary hover:underline">
              {descExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
            </button>
          </Abschnitt>
        )}

        {(job.industry || job.company_size_band || job.funding_stage) && (
          <Abschnitt title="Unternehmen">
            {job.industry && <Fakt label="Branche">{job.industry}</Fakt>}
            {job.company_size_band && <Fakt label="Größe">{job.company_size_band}</Fakt>}
            {job.funding_stage && <Fakt label="Phase"><span className="capitalize">{job.funding_stage}</span></Fakt>}
          </Abschnitt>
        )}

        <Button variant="outline" size="sm" className="h-8 w-full text-xs text-muted-foreground" asChild>
          <Link to={`/recruiter/jobs/${job.id}`}>
            Mandatsbriefing öffnen
            <ExternalLink className="ml-1.5 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
