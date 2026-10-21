import { Check } from 'lucide-react';
import { factEntries } from './JobFactsBar';
import type { WorkspaceJob } from './RecruiterJobWorkspace';
import { briefingText, getRecruiterCriteria } from '@/lib/recruiterBriefing';
import { recruiterFeeRange } from '@/lib/recruiterFee';
import { verdienstJeTag } from '@/lib/recruiterContracting';
import { Honorar } from './Honorar';

const EURO = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const keyOf = (v: string) => v.trim().toLocaleLowerCase('de-DE');

/**
 * Der Verdienst neben dem Titel: die Mitte des Bandes (wie in der früheren
 * Verdienst-Karte), bei Contracting der Verdienst je Einsatztag.
 * Keine `dark:`-Klassen: die Tailwind-Konfiguration kehrt sie hier um.
 */
export function HeroEarning({ job }: { job: WorkspaceJob }) {
  const jeTag = job.employment_type === 'freelance' ? verdienstJeTag(job) : null;
  const range = jeTag ? null : recruiterFeeRange(job.recruiter_fee_percentage ?? null, job.salary_min ?? null, job.salary_max ?? null);
  const mitte = range == null ? null
    : range.min != null && range.max != null ? Math.round((range.min + range.max) / 2)
    : (range.min ?? range.max);
  if (!jeTag && mitte == null) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{jeTag ? 'Dein Verdienst je Einsatztag' : 'Dein Verdienst'}</p>
      <p className="mt-1 text-2xl font-semibold leading-none tracking-tight tabular-nums text-emerald-500"><Honorar>{jeTag ?? EURO.format(mitte!)}</Honorar></p>
    </div>
  );
}

/** Texte oder Listen aus der Aufnahme als kurze Punkte; lange Absätze bleiben im Briefing. */
function punkte(value: unknown): string[] {
  const roh = Array.isArray(value) ? value.map(briefingText) : briefingText(value).split(/\n|•|·|;/);
  return roh.map((t) => t.replace(/^[-–*\s]+/, '').trim()).filter((t) => t && t.length <= 70);
}

/** „Warum wechseln“: Vorteile der Position, Besonderheiten, Highlights, Benefits -- höchstens drei, ohne Dubletten. */
export function wechselGruende(job: WorkspaceJob): string[] {
  const kandidaten = [
    ...punkte(job.position_advantages),
    ...punkte(job.unique_selling_points),
    ...punkte(job.formatted_content?.highlights),
    ...punkte(job.formatted_content?.selling_points),
    ...punkte(job.benefits),
  ];
  const seen = new Set<string>();
  return kandidaten.filter((t) => (seen.has(keyOf(t)) ? false : (seen.add(keyOf(t)), true))).slice(0, 3);
}

function Spalte({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-t border-border pt-4 first:border-t-0 first:pt-0 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0 sm:first:border-l-0 sm:first:pl-0">
      <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{titel}</p>
      <ul className="space-y-1.5 text-sm leading-6">{children}</ul>
    </div>
  );
}

/**
 * Der 30-Sekunden-Check unter dem Titel: Muss-Kriterien, Eckdaten, Gründe für
 * den Wechsel. Flach, ohne Karten; leere Spalten entfallen.
 */
export function JobDecisionStrip({ job }: { job: WorkspaceJob }) {
  const criteria = getRecruiterCriteria(job);
  const muss = criteria.required.slice(0, 3);
  const mehr = criteria.required.length - muss.length;
  const vorteil = [...criteria.trainable, ...criteria.negotiable].slice(0, 2);
  const { eintraege } = factEntries({
    salaryMin: job.salary_min ?? null,
    salaryMax: job.salary_max ?? null,
    dayRateMin: job.employment_type === 'freelance' ? job.day_rate_min : null,
    dayRateMax: job.employment_type === 'freelance' ? job.day_rate_max : null,
    onsiteRequired: job.onsite_required,
    onsiteDaysRequired: job.onsite_days_required,
    remoteDaysFlexible: job.remote_days_flexible,
    remotePolicy: job.remote_policy,
    remoteType: job.remote_type,
    requiredLanguages: job.required_languages,
    experienceLevel: job.experience_level,
    deadline: job.deadline,
    salaryMonths: job.salary_months ?? null,
  });
  const gruende = wechselGruende(job);
  if (!muss.length && !eintraege.length && !gruende.length) return null;

  return (
    <div className="grid gap-4 sm:auto-cols-fr sm:grid-flow-col sm:gap-0">
      {muss.length > 0 && (
        <Spalte titel="Muss">
          {muss.map((m) => (
            <li key={m} className="flex gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" /><span className="min-w-0">{m}</span></li>
          ))}
          {mehr > 0 && <li className="text-xs text-muted-foreground">+ {mehr} weitere im Briefing</li>}
          {vorteil.length > 0 && <li className="pt-1 text-xs leading-5 text-muted-foreground">Von Vorteil: {vorteil.join(' · ')}</li>}
        </Spalte>
      )}
      {eintraege.length > 0 && (
        <Spalte titel="Eckdaten">
          {eintraege.slice(0, 5).map((e) => (
            <li key={e.label} className="flex gap-2">
              <span className="w-24 shrink-0 text-xs leading-6 text-muted-foreground">{e.label}</span>
              <span className="min-w-0 tabular-nums">{e.wert}</span>
            </li>
          ))}
        </Spalte>
      )}
      {gruende.length > 0 && (
        <Spalte titel="Warum wechseln">
          {gruende.map((g) => (
            <li key={g} className="flex gap-2"><span className="text-muted-foreground" aria-hidden="true">·</span><span className="min-w-0">{g}</span></li>
          ))}
        </Spalte>
      )}
    </div>
  );
}
