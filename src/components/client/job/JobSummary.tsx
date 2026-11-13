import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDayMonth, fmtNumber } from '@/lib/localeFormat';
import { ChevronDown, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { briefingText, buildBriefingSections, getRecruiterCriteria, type BriefingJob } from '@/lib/recruiterBriefing';
import { cn } from '@/lib/utils';

// Gespeicherte Schlüssel; die Anzeige steht unter clientJobs:summary.level / .remote / .start.
const LEVEL = new Set(['junior', 'mid', 'senior', 'lead', 'principal']);
const REMOTE = new Set(['remote', 'hybrid', 'onsite']);
const START = new Set(['asap', 'sofort']);

// Oben schon gezeigt -- unter „Weitere Angaben“ nicht noch einmal. Der Tagessatz
// heißt im Briefing „Tagessatz Spezialist“ (Headhunter-Sicht) und gehört nicht dorthin.
const OBEN = new Set([
  'must_have_criteria', 'trainable_skills', 'nice_to_have_criteria', 'success_profile', 'failure_profile',
  'vacancy_reason', 'daily_routine', 'negative_impact_if_unfilled', 'benefits', 'position_advantages',
  'bonus_structure', 'salary_months', 'contract_limitation', 'day_rate_min', 'day_rate_max',
  'contract_duration_months', 'utilization_days_per_week', 'extension_possible', 'onsite_days_required',
  'core_hours', 'overtime_policy', 'team_size', 'reports_to', 'company_culture', 'department_structure', 'skills',
  'remote_policy',
]);

// Briefing-Beschriftungen aus Headhunter-Sicht, für den Kunden umformuliert.
// Anzeige unter clientJobs:summary.label.<id> und summary.section.<id>.
const LABEL = new Set(['required_languages', 'required_certifications', 'candidates_in_pipeline']);
const ABSCHNITT = new Set(['profil', 'aufgabe', 'angebot', 'unternehmen', 'prozess']);

const money = (v: number) => fmtNumber(v, undefined, { maximumFractionDigits: 0 });

// Die Aufnahme speichert fehlende Antworten teils als Text „null“.
function txt(v: unknown): string {
  const s = briefingText(v);
  return ['null', 'undefined'].includes(s.toLowerCase()) ? '' : s;
}

function liste(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Map<string, string>();
  for (const item of v) {
    const s = txt(item);
    if (s && !seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s);
  }
  return [...seen.values()];
}

function spanne(a: unknown, b: unknown): string {
  return [a, b].filter((v): v is number => typeof v === 'number' && v > 0).map(money).join(' – ');
}

function Kopf({ children }: { children: ReactNode }) {
  return <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{children}</h3>;
}

function Feld({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Chips({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <Badge key={s} variant={muted ? 'outline' : 'secondary'} className={cn('font-normal', muted && 'text-muted-foreground')}>{s}</Badge>
      ))}
    </div>
  );
}

function Lang({ text, zeilen = 4 }: { text: string; zeilen?: 3 | 4 }) {
  const { t } = useTranslation('clientJobs');
  const [offen, setOffen] = useState(false);
  return (
    <>
      <p className={cn('whitespace-pre-line text-sm leading-6', !offen && (zeilen === 3 ? 'line-clamp-3' : 'line-clamp-4'))}>{text}</p>
      {text.length > 240 && (
        <button type="button" onClick={() => setOffen((v) => !v)} className="mt-1 text-xs font-medium text-primary hover:underline">
          {offen ? t('summary.less') : t('summary.more')}
        </button>
      )}
    </>
  );
}

/**
 * „Ihre Stelle“: alles, was der Kunde in der Aufnahme angegeben hat, so wie er es
 * kennt -- Eckdaten, Aufgaben, Kriterien, Team, Angebot. Kriterien kommen aus
 * must_have_criteria & Co. (dieselbe Regel wie beim Headhunter), nicht aus der
 * alten Skill-Spalte must_haves.
 */
export function JobSummary({ job, ohneRahmen = false }: { job: Record<string, unknown>; ohneRahmen?: boolean }) {
  const { t } = useTranslation('clientJobs');
  const [mehr, setMehr] = useState(false);
  const b = job as unknown as BriefingJob & Record<string, unknown>;
  const freelance = job.employment_type === 'freelance';

  const payload = (job.intake_payload ?? {}) as { briefing_answers?: Record<string, { value?: unknown }> };
  const startRoh = txt(payload.briefing_answers?.start?.value);
  const start = START.has(startRoh.toLowerCase()) ? t(`summary.start.${startRoh.toLowerCase()}`) : startRoh;

  const gehalt = spanne(job.salary_min, job.salary_max);
  const tagessatz = spanne(job.day_rate_min, job.day_rate_max);
  // „Nein“/„keine“ heißt: kein variabler Anteil.
  const bonusRoh = txt(job.bonus_structure);
  const bonus = /^(nein|keine?n?|kein bonus|0 ?%?)$/i.test(bonusRoh) ? '' : bonusRoh;
  const monate = typeof job.salary_months === 'number' && job.salary_months !== 12 ? t('summary.salaries', { n: fmtNumber(job.salary_months) }) : '';
  const befristung = txt(job.contract_limitation);
  const erfahrung = [
    job.experience_level ? (LEVEL.has(String(job.experience_level)) ? t(`summary.level.${job.experience_level}`) : String(job.experience_level)) : '',
    typeof job.experience_min === 'number' && job.experience_min > 0 ? t('summary.fromYears', { count: job.experience_min }) : '',
  ].filter(Boolean).join(', ');
  const ort = [
    txt(job.location),
    [job.remote_type && REMOTE.has(String(job.remote_type)) ? t(`summary.remote.${job.remote_type}`) : '',
      typeof job.onsite_days_required === 'number' && job.onsite_days_required > 0 ? t('summary.onsiteDays', { count: job.onsite_days_required }) : ''].filter(Boolean).join(', '),
  ].filter(Boolean).join(' · ');

  const eckdaten: { label: string; wert: string; zusatz?: string }[] = [
    freelance
      ? { label: t('summary.dayRate'), wert: tagessatz ? t('summary.euro', { amount: tagessatz }) : '', zusatz: [job.utilization_days_per_week && t('summary.daysPerWeek', { n: txt(job.utilization_days_per_week) }), job.contract_duration_months && t('summary.months', { n: txt(job.contract_duration_months) })].filter(Boolean).join(' · ') }
      : { label: t('summary.salary'), wert: gehalt ? t('summary.euro', { amount: gehalt }) : '', zusatz: [bonus && t('summary.variable', { bonus }), monate].filter(Boolean).join(' · ') },
    { label: t('summary.contract'), wert: freelance ? t('summary.contracting') : [job.employment_type === 'part-time' ? t('summary.partTime') : t('summary.permanent'), befristung && befristung.charAt(0).toLowerCase() + befristung.slice(1)].filter(Boolean).join(', ') },
    { label: t('summary.experience'), wert: erfahrung },
    { label: t('summary.startLabel'), wert: start },
    { label: t('summary.location'), wert: ort },
  ].filter((e) => e.wert);

  const aufgaben = txt(job.daily_routine) || txt(job.description);
  const kriterien = getRecruiterCriteria(b);
  const team = txt(job.department_structure) || (typeof job.team_size === 'number' ? t('summary.teamSize', { count: job.team_size }) : '');
  const chef = txt(job.reports_to);
  const kultur = txt(job.company_culture);
  const arbeitszeit = [txt(job.core_hours), txt(job.overtime_policy) && t('summary.overtime', { text: txt(job.overtime_policy) })].filter(Boolean).join(' · ');
  const benefits = liste(job.benefits).length ? liste(job.benefits) : liste(job.position_advantages);
  const warum = txt(job.vacancy_reason);
  const folgen = txt(job.negative_impact_if_unfilled);
  const gut = txt(job.success_profile);
  const passtNicht = txt(job.failure_profile);

  const weitere = buildBriefingSections(b)
    .map((s) => ({ ...s, rows: s.rows.filter((r) => !OBEN.has(r.id) && !['null', 'undefined'].includes(r.value.toLowerCase())) }))
    .filter((s) => s.rows.length > 0);
  const anzahl = weitere.reduce((n, s) => n + s.rows.length, 0);

  const datum = (job.submitted_at || job.created_at) as string | undefined;
  const links = aufgaben || kriterien.required.length || kriterien.negotiable.length || kriterien.trainable.length;
  const rechts = team || chef || kultur || arbeitszeit || benefits.length || warum || gut;

  const inhalt = (
    <>
      {!ohneRahmen && <Kopf>{datum ? t('summary.titleFrom', { date: fmtDayMonth(datum) }) : t('summary.title')}</Kopf>}

      {eckdaten.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {eckdaten.map((e) => (
            <div key={e.label} className="rounded-lg bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">{e.label}</p>
              <p className="text-sm font-medium leading-5">{e.wert}</p>
              {e.zusatz && <p className="text-xs text-muted-foreground">{e.zusatz}</p>}
            </div>
          ))}
        </div>
      )}

      {(links || rechts) && (
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div>
            {aufgaben && <Feld label={t('summary.tasks')}><Lang text={aufgaben} /></Feld>}
            {kriterien.required.length > 0 && <Feld label={t('summary.must')}><Chips items={kriterien.required} /></Feld>}
            {kriterien.negotiable.length > 0 && <Feld label={t('summary.negotiable')}><Chips items={kriterien.negotiable} muted /></Feld>}
            {kriterien.trainable.length > 0 && <Feld label={t('summary.trainable')}><Chips items={kriterien.trainable} muted /></Feld>}
          </div>
          <div>
            {(team || chef) && (
              <Feld label={t('summary.team')}>
                <p className="text-sm leading-6">{[team, chef && t('summary.reportsTo', { name: chef })].filter(Boolean).join(' ')}</p>
              </Feld>
            )}
            {(kultur || arbeitszeit) && (
              <Feld label={t('summary.workStyle')}>
                {kultur && <Lang text={kultur} zeilen={3} />}
                {arbeitszeit && <p className="mt-1 text-sm leading-6 text-muted-foreground">{arbeitszeit}</p>}
              </Feld>
            )}
            {benefits.length > 0 && <Feld label={t('summary.offer')}><Chips items={benefits} muted /></Feld>}
            {(warum || folgen) && (
              <Feld label={t('summary.whyOpen')}>
                <p className="text-sm leading-6">{[warum, folgen && t('summary.unfilled', { text: folgen })].filter(Boolean).join('. ')}</p>
              </Feld>
            )}
            {(gut || passtNicht) && (
              <Feld label={t('summary.goodHere')}>
                {gut && <p className="text-sm leading-6">{gut}</p>}
                {passtNicht && <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('summary.notFit', { text: passtNicht })}</p>}
              </Feld>
            )}
          </div>
        </div>
      )}

      {!eckdaten.length && !links && !rechts && (
        <p className="text-sm text-muted-foreground">{t('summary.empty')}</p>
      )}

      {anzahl > 0 && (
        <div className="mt-5 border-t pt-3">
          <button type="button" onClick={() => setMehr((v) => !v)} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" aria-expanded={mehr}>
            <ChevronDown className={cn('h-4 w-4 transition-transform', mehr && 'rotate-180')} />
            {mehr ? t('summary.moreHide') : t('summary.moreShow', { count: anzahl })}
          </button>
          {mehr && (
            <div className="mt-3 space-y-4">
              {weitere.map((s) => (
                <div key={s.id}>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{ABSCHNITT.has(s.id) ? t(`summary.section.${s.id}`) : s.title}</p>
                  <dl className="divide-y divide-border/60">
                    {s.rows.map((r) => (
                      <div key={r.id} className="grid gap-1 py-1.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-3">
                        <dt className="text-xs leading-6 text-muted-foreground">{LABEL.has(r.id) ? t(`summary.label.${r.id}`) : r.label}</dt>
                        <dd className="whitespace-pre-line text-sm leading-6">{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );

  if (ohneRahmen) return <div>{inhalt}</div>;
  return (
    <Card>
      <CardContent className="p-5">{inhalt}</CardContent>
    </Card>
  );
}

/**
 * „So sehen es die Headhunter“: anonymer Firmen-Descriptor und die Regel für den
 * Firmennamen. start_job_search setzt company_revealed_at bei „Ich suche“ für
 * jede Stufe; vertrauliche Suchen sehen nur Gold-Partner.
 */
export function HeadhunterVorschau({ descriptor, vertraulich }: { descriptor: string | null; vertraulich: boolean }) {
  const { t } = useTranslation('clientJobs');
  return (
    <div className="rounded-xl border bg-muted/30 p-5">
      <Kopf><span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" aria-hidden="true" />{t('summary.hhTitle')}</span></Kopf>
      <p className="text-sm leading-6">
        {descriptor ? t('summary.hhAnonAs', { descriptor }) : t('summary.hhAnon')}
      </p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {t('summary.hhName')}
        {vertraulich && t('summary.hhConfidential')}
      </p>
    </div>
  );
}
