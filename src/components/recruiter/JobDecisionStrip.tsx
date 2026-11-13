import { Check } from 'lucide-react';
import { factEntries } from './JobFactsBar';
import type { WorkspaceJob } from './RecruiterJobWorkspace';
import { briefingText, getRecruiterCriteria } from '@/lib/recruiterBriefing';
import { recruiterFeeRange } from '@/lib/recruiterFee';
import { verdienstJeTag } from '@/lib/recruiterContracting';
import { Honorar } from './Honorar';
import { useJobEarning } from './verdienste/useJobEarning';
import { eur0 } from '../../../supabase/functions/_shared/abrechnung-view';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '@/i18n/languages';

const euro = (value: number, language: string) => new Intl.NumberFormat(intlLocale(language), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
const keyOf = (v: string) => v.trim().toLocaleLowerCase('de-DE');

/**
 * Der Verdienst neben dem Titel: die Mitte des Bandes (wie in der früheren
 * Verdienst-Karte), bei Contracting der Verdienst je Einsatztag.
 * Seit 11.11.2026 (H4/H6) mit der Zeile „8.250 € bei Antritt · 16.500 € nach 90 Tagen“
 * bzw. bei einer Nachbesetzung „in einem Teil …“; ein Klick öffnet „Verdienst berechnen“.
 * Keine `dark:`-Klassen: die Tailwind-Konfiguration kehrt sie hier um.
 */
export function HeroEarning({ job, onDetails }: { job: WorkspaceJob; onDetails?: () => void }) {
  const jeTag = job.employment_type === 'freelance' ? verdienstJeTag(job) : null;
  const { earning: plan } = useJobEarning(jeTag ? null : job.id, job.salary_min ?? null, job.salary_max ?? null);
  const { t, i18n } = useTranslation('recruiterJobDetail');
  if (plan) {
    return (
      <div>
        <p className="text-xs text-muted-foreground">{t('earning.yours')}</p>
        <p className="mt-1 text-2xl font-semibold leading-none tracking-tight tabular-nums text-emerald-500"><Honorar>{eur0(plan.totalCents, i18n.language)}</Honorar></p>
        {onDetails
          ? <button type="button" onClick={onDetails} className="mt-1 text-left text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"><Honorar>{plan.detail}</Honorar></button>
          : <p className="mt-1 text-xs text-muted-foreground"><Honorar>{plan.detail}</Honorar></p>}
        {plan.research && <p className="mt-1 max-w-[18rem] text-xs text-muted-foreground">{plan.research.note}</p>}
      </div>
    );
  }
  const range = jeTag ? null : recruiterFeeRange(job.recruiter_fee_percentage ?? null, job.salary_min ?? null, job.salary_max ?? null);
  const mitte = range == null ? null
    : range.min != null && range.max != null ? Math.round((range.min + range.max) / 2)
    : (range.min ?? range.max);
  if (!jeTag && mitte == null) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{jeTag ? t('earning.yoursPerDay') : t('earning.yours')}</p>
      <p className="mt-1 text-2xl font-semibold leading-none tracking-tight tabular-nums text-emerald-500"><Honorar>{jeTag ?? euro(mitte!, i18n.language)}</Honorar></p>
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
  const { t } = useTranslation('recruiterJobDetail');
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
        <Spalte titel={t('strip.must')}>
          {muss.map((m) => (
            <li key={m} className="flex gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" /><span className="min-w-0">{m}</span></li>
          ))}
          {mehr > 0 && <li className="text-xs text-muted-foreground">{t('strip.more', { count: mehr })}</li>}
          {vorteil.length > 0 && <li className="pt-1 text-xs leading-5 text-muted-foreground">{t('strip.niceToHave', { list: vorteil.join(' · ') })}</li>}
        </Spalte>
      )}
      {eintraege.length > 0 && (
        <Spalte titel={t('ws.keyFacts')}>
          {eintraege.slice(0, 5).map((e) => (
            <li key={e.label} className="flex gap-2">
              <span className="w-24 shrink-0 text-xs leading-6 text-muted-foreground">{e.label}</span>
              <span className="min-w-0 tabular-nums">{e.wert}</span>
            </li>
          ))}
        </Spalte>
      )}
      {gruende.length > 0 && (
        <Spalte titel={t('strip.whyMove')}>
          {gruende.map((g) => (
            <li key={g} className="flex gap-2"><span className="text-muted-foreground" aria-hidden="true">·</span><span className="min-w-0">{g}</span></li>
          ))}
        </Spalte>
      )}
    </div>
  );
}
