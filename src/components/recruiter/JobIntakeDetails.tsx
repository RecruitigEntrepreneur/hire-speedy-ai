import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '@/i18n/languages';

/**
 * Was der Kunde in der Aufnahme selbst gesagt hat.
 *
 * BEFUND (08.09.2026): Die Stellenansicht zeigte vier Listen, von denen drei
 * ein Modell aus der Anzeige erzeugt hatte -- und darunter einen Kasten
 * "Nicht erhoben" mit sieben Punkten. Der Fragenkatalog erhebt diese Punkte
 * laengst; sie kamen nur nie in `jobs` an (draftToJobRow schrieb 6 von 37
 * Katalogspalten). Seit die Slot-zu-Spalten-Tabelle greift, liegen sie vor.
 *
 * Dieser Block traegt sie nach -- bewusst UNTER dem KI-Teil und mit eigener
 * Ueberschrift, damit der Unterschied sichtbar bleibt: oben steht, was ein
 * Modell aus der Anzeige geschrieben hat, hier steht, was der Kunde gesagt
 * hat. Kein Feld wird aufgefuellt. Was fehlt, erscheint nicht.
 *
 * Der Fussteil ist kein Schmuck: acht dieser Felder stehen in
 * recruiter_jobs_view hinter `CASE WHEN rev.revealed`. Vor dem Reveal liest
 * die Seite dort NULL -- ununterscheidbar von "nie erhoben". Ohne den Hinweis
 * haelt der Recruiter eine Sperre fuer eine Luecke und fragt beim Kunden nach,
 * was der laengst beantwortet hat.
 */

export interface IntakeDetails {
  employment_type?: string | null;

  /* Warum diese Stelle */
  vacancy_reason?: string | null;
  negative_impact_if_unfilled?: string | null;   // reveal-gated

  /* Was wirklich zaehlt */
  must_have_criteria?: string[] | null;
  trainable_skills?: string[] | null;
  nice_to_have_criteria?: string[] | null;

  /* Die Aufgabe */
  daily_routine?: string | null;                 // reveal-gated
  task_focus?: string | null;
  task_breakdown?: unknown;

  /* Wer passt */
  success_profile?: string | null;
  failure_profile?: string | null;

  /* Umfeld und Entscheidung */
  team_size?: number | null;
  company_headcount?: number | null;
  department_structure?: string | null;
  reports_to?: string | null;
  decision_makers?: string[] | null;
  company_culture?: string | null;               // reveal-gated

  /* Das Angebot */
  salary_months?: number | null;
  bonus_structure?: string | null;
  contract_limitation?: string | null;
  day_rate_min?: number | null;
  day_rate_max?: number | null;
  contract_duration_months?: number | null;
  utilization_days_per_week?: number | null;
  extension_possible?: boolean | null;
  benefits?: string[] | null;
  career_path?: string | null;
  career_example?: string | null;                // reveal-gated
  unique_selling_points?: string[] | null;       // reveal-gated
  position_advantages?: string[] | null;         // reveal-gated

  /* Rahmen und Tempo */
  core_hours?: string | null;
  core_hours_detail?: string | null;
  overtime_policy?: string | null;
  time_tracking_method?: string | null;
  works_council?: boolean | null;
  works_council_meeting_schedule?: string | null;
  contract_creation_days?: number | null;
  contract_sent_digitally?: boolean | null;

  /* Vor dem Kandidatengespraech wissen */
  contract_sensitive_topics?: string | null;
  industry_opportunities?: string | null;        // reveal-gated
  industry_challenges?: string | null;           // reveal-gated
}

/**
 * Nicht-Antworten. `reports_to` traegt auf Altbestand woertlich "Unbekannt" --
 * der Parser hat das Wort als Wert gespeichert, statt das Feld leer zu lassen.
 * Gedruckt waere das schlechter als eine Luecke: der Recruiter liest eine
 * Auskunft, wo keine ist.
 */
const PLATZHALTER = new Set([
  'unbekannt', 'unklar', 'keine angabe', 'k.a.', 'k. a.', 'ka', 'n/a', 'na',
  'nicht angegeben', 'nicht bekannt', 'tbd', '-', '--', '?',
]);

const platzhalter = (v: unknown) =>
  typeof v === 'string' && PLATZHALTER.has(v.trim().toLowerCase());

/**
 * `false` gilt hier ausdruecklich NICHT als leer: "kein Betriebsrat" und
 * "Vertrag kommt per Post" sind Antworten, die der Headhunter braucht.
 */
const leer = (v: unknown): boolean => {
  if (v === null || v === undefined || v === '') return true;
  if (typeof v === 'string') return !v.trim() || platzhalter(v);
  if (Array.isArray(v)) return v.filter((x) => x && !platzhalter(x)).length === 0;
  return false;
};

/**
 * Altbestand spricht Englisch. `QuickQuestionsSection` (der Vorgaenger des
 * Fragenkatalogs) speicherte Schluessel statt Klartext -- auf der Seite stand
 * dadurch woertlich "restructuring". Der Fragenkatalog schreibt heute die
 * deutschen Chip-Texte; diese Tabelle holt nur die alten Zeilen nach.
 */
// jobs_contract_limitation_check speichert Schluessel, keine Saetze. Texte: intake.legacy.<key>
const ALTWERTE = ['growth', 'succession', 'new_position', 'restructuring', 'unbefristet', 'befristet', 'befristet_mit_aussicht', 'projekt'];
type T = (key: string, options?: Record<string, unknown>) => string;

const uebersetzt = (v: unknown, t: T) =>
  typeof v === 'string' && ALTWERTE.includes(v.trim().toLowerCase()) ? t(`intake.legacy.${v.trim().toLowerCase()}`) : v;

/**
 * Eine Teamgroesse von -1 ist keine Teamgroesse. Der Wert steht auf
 * Altbestand fuer "nicht ermittelt" und wurde als Zahl gespeichert; gedruckt
 * behauptet er eine Auskunft, die es nicht gibt.
 */
const zahl = (v: unknown) => (typeof v === 'number' && v > 0 ? v : null);

/** Zahlen in Saetzen ("1.200 EUR pro Tag", "13,5 Monate") in der Schreibweise der Sprache setzen. */
const de = (v: unknown, locale: string) =>
  typeof v === 'number' ? v.toLocaleString(locale) : String(v ?? '?');

/** jsonb: {"Betrieb": 60, "Projekte": 40} -> "Betrieb 60 % · Projekte 40 %". */
function gewichtung(v: unknown): string | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const teile = Object.entries(v as Record<string, unknown>)
    .filter(([k, n]) => k.trim() && (typeof n === 'number' || typeof n === 'string'))
    .map(([k, n]) => (typeof n === 'number' ? `${k} ${n} %` : `${k} ${n}`));
  return teile.length ? teile.join(' · ') : null;
}

/** Eine Zeile erscheint nur, wenn sie einen Wert hat. */
function Zeile({ frage, wert }: { frage: string; wert?: unknown }) {
  const { t, i18n } = useTranslation('recruiterJobDetail');
  if (leer(wert)) return null;
  // 13.5 Monatsgehaelter liest sich auf Deutsch als 13,5.
  if (typeof wert === 'number') {
    return (
      <div className="grid gap-x-6 gap-y-0.5 border-t border-border/60 py-2.5 sm:grid-cols-[13rem_1fr]">
        <dt className="text-xs leading-relaxed text-muted-foreground">{frage}</dt>
        <dd className="text-sm leading-relaxed tabular-nums">
          {wert.toLocaleString(intlLocale(i18n.language))}
        </dd>
      </div>
    );
  }

  const text = Array.isArray(wert)
    ? wert.filter((x) => x && !platzhalter(x)).map((x) => String(uebersetzt(x, t))).join(' · ')
    : typeof wert === 'boolean'
      ? (wert ? t('intake.yes') : t('intake.no'))
      : String(uebersetzt(wert, t)).trim();
  if (!text) return null;

  return (
    <div className="grid gap-x-6 gap-y-0.5 border-t border-border/60 py-2.5 sm:grid-cols-[13rem_1fr]">
      <dt className="text-xs leading-relaxed text-muted-foreground">{frage}</dt>
      <dd className="text-sm leading-relaxed">{text}</dd>
    </div>
  );
}

/** Eine Gruppe erscheint nur, wenn mindestens eine ihrer Zeilen etwas traegt. */
function Gruppe({ titel, werte, children }: { titel: string; werte: unknown[]; children: ReactNode }) {
  if (werte.every(leer)) return null;
  return (
    <section>
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {titel}
      </h3>
      <dl className="[&>div:first-child]:border-t-0">{children}</dl>
    </section>
  );
}

/**
 * Die acht Abschnitte mit ihren Feldern -- an EINER Stelle, weil zwei Aufrufer
 * dieselbe Frage stellen: die Karte, um Gruppen auszublenden, und
 * `hatAufnahme`, damit die Stellenseite weiss, ob der Reiter etwas zu zeigen
 * hat. Zwei getrennte Listen waeren zwei Wahrheiten -- und die Seite oeffnete
 * irgendwann einen leeren Reiter.
 */
/**
 * `jobs.works_council` traegt `DEFAULT false` (Migration 20260123171202).
 * Jede Stelle, die nie danach gefragt wurde, steht damit auf `false` -- als
 * "vom Kunden bestaetigt: kein Betriebsrat" gedruckt waere das eine Aussage,
 * die niemand gemacht hat, und genau die Sorte Erfindung, gegen die dieser
 * Block gebaut ist. Ein `true` kann nur gesetzt worden sein, ein `false` nicht:
 * also zaehlt hier nur das Ja. Faellt der Default irgendwann weg, kann diese
 * Zeile weg.
 */
const betriebsratVon = (job: IntakeDetails) => (job.works_council === true ? true : null);

/**
 * Kategorie und Uhrzeit in einer Zeile: "Gleitzeit mit Kernzeit, 09:00-15:00".
 *
 * Zwei Zeilen waeren hier Buerokratie -- der Recruiter liest im Gespraech
 * einen Satz vor, keine Tabelle. Die Trennung existiert in der Datenbank,
 * damit die Kategorie ueber alle Stellen vergleichbar bleibt; auf dem Papier
 * gehoert sie zusammen.
 */
const arbeitszeitVon = (job: IntakeDetails) => {
  const kategorie = String(job.core_hours ?? '').trim();
  const zeit = String(job.core_hours_detail ?? '').trim();
  if (!kategorie) return zeit || null;
  return zeit ? `${kategorie}, ${zeit}` : kategorie;
};

/** Der Tagessatz ist EINE Zeile, auch wenn er aus zwei Spalten kommt. Ohne Übersetzer nur „vorhanden“. */
const tagessatzVon = (job: IntakeDetails, t?: T, locale = 'de-DE') =>
  leer(job.day_rate_min) && leer(job.day_rate_max)
    ? null
    : t ? t('intake.dayRateRange', { min: de(job.day_rate_min, locale), max: de(job.day_rate_max, locale) }) : true;

function gruppenVon(job: IntakeDetails): Record<string, unknown[]> {
  const freelance = job.employment_type === 'freelance';
  return {
    warum: [job.vacancy_reason, job.negative_impact_if_unfilled],
    kriterien: [job.must_have_criteria, job.trainable_skills, job.nice_to_have_criteria],
    aufgabe: [job.daily_routine, job.task_focus, gewichtung(job.task_breakdown)],
    passung: [job.success_profile, job.failure_profile],
    umfeld: [zahl(job.team_size), zahl(job.company_headcount),
             job.department_structure, job.reports_to,
             job.decision_makers, job.company_culture],
    angebot: freelance
      ? [tagessatzVon(job), job.contract_duration_months,
         job.utilization_days_per_week, job.extension_possible, job.benefits,
         job.unique_selling_points, job.position_advantages]
      : [job.salary_months, job.bonus_structure, job.contract_limitation, job.benefits,
         job.career_path, job.career_example,
         job.unique_selling_points, job.position_advantages],
    rahmen: [arbeitszeitVon(job), job.overtime_policy, job.time_tracking_method,
             betriebsratVon(job), job.works_council_meeting_schedule,
             job.contract_creation_days, job.contract_sent_digitally],
    vorher: [job.contract_sensitive_topics, job.industry_opportunities, job.industry_challenges],
  };
}

/** Traegt die Aufnahme ueberhaupt etwas? Entscheidet den Startreiter. */
export const hatAufnahme = (job: IntakeDetails) =>
  !Object.values(gruppenVon(job)).flat().every(leer);

/**
 * Wie viele Zeilen der Reiter zeigen wird. Die Zahl steht am Reiter, also
 * muss sie stimmen: sie zaehlt dieselben Eintraege, die die Karte rendert --
 * deshalb ist der Tagessatz oben schon zu EINEM Eintrag zusammengefasst.
 */
export const zeilenDerAufnahme = (job: IntakeDetails) =>
  Object.values(gruppenVon(job)).flat().filter((v) => !leer(v)).length;

/**
 * Wie viele der acht Abschnitte etwas tragen.
 *
 * Die Stellenseite oeffnet die Aufnahme nur dann als Startreiter, wenn mehr
 * als ein Abschnitt gefuellt ist. Grund: auf Altbestand steht dort manchmal
 * eine einzige Zeile ("Betriebsrat: Nein"). Die ist wahr und gehoert in den
 * Reiter -- aber als erste Ansicht einer Stelle waere sie unbrauchbar, und
 * der Recruiter muesste sich erst zurueckklicken, um arbeiten zu koennen.
 */
export const abschnitteDerAufnahme = (job: IntakeDetails) =>
  Object.values(gruppenVon(job)).filter((g) => !g.every(leer)).length;

export function JobIntakeDetails({
  job,
  isRevealed = false,
}: {
  job: IntakeDetails;
  isRevealed?: boolean;
}) {
  const { t, i18n } = useTranslation('recruiterJobDetail');
  const locale = intlLocale(i18n.language);
  const freelance = job.employment_type === 'freelance';
  const aufteilung = gewichtung(job.task_breakdown);
  const teamgroesse = zahl(job.team_size);
  const gruppen = gruppenVon(job);

  /* Was hinter dem Reveal-Gate steht und gerade NULL liest. Erhoben oder
     nicht -- vor dem Reveal ist das von hier aus nicht unterscheidbar, also
     wird es als gesperrt benannt und nicht als fehlend. */
  const gesperrt = isRevealed ? [] : ([
    { wert: job.daily_routine, name: t('intake.locked.dailyRoutine') },
    { wert: job.company_culture, name: t('intake.locked.culture') },
    { wert: job.negative_impact_if_unfilled, name: t('intake.locked.ifUnfilled') },
    { wert: job.unique_selling_points, name: t('intake.locked.usps') },
    { wert: job.position_advantages, name: t('intake.locked.advantages') },
    // `career_example` traegt im Katalog `only: 'full-time'` -- bei Contracting
    // wird es nie gefragt. Es dort als "gesperrt" zu fuehren hiesse, dem
    // Recruiter eine Auskunft zu versprechen, die niemand gegeben hat.
    { wert: job.career_example, name: t('intake.locked.careerExample'), gilt: !freelance },
    { wert: job.industry_opportunities, name: t('intake.locked.industryChances') },
    { wert: job.industry_challenges, name: t('intake.locked.industryChallenges') },
    { wert: job.company_headcount, name: t('intake.locked.headcount') },
  ] as { wert: unknown; name: string; gilt?: boolean }[])
    .filter((f) => (f.gilt ?? true) && leer(f.wert))
    .map((f) => f.name);

  /* Der Sperrhinweis ist ein Zusatz zu echtem Inhalt, keine eigene Karte:
     traegt die Aufnahme nichts, erscheint hier nichts. Sonst stuende auf
     jeder alten Stelle ein Schloss ueber einer leeren Karte. */
  const nichts = Object.values(gruppen).flat().every(leer);
  if (nichts) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-success" />
          <CardTitle className="text-base">{t('intake.title')}</CardTitle>
          <Badge variant="outline" className="border-success/30 text-success">
            {t('intake.confirmed')}
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t('intake.intro')}
        </p>
      </CardHeader>

      <CardContent className="space-y-6">

        <Gruppe titel={t('intake.g.why')} werte={gruppen.warum}>
          <Zeile frage={t('intake.q.vacancyReason')} wert={job.vacancy_reason} />
          <Zeile frage={t('intake.q.ifUnfilled')} wert={job.negative_impact_if_unfilled} />
        </Gruppe>

        {/* Zuerst, weil der Headhunter danach sucht: was muss der Kandidat
            mitbringen, und was darf er hier noch lernen. Beides ist die
            Einstufung des Kunden an seiner eigenen Liste -- nicht die
            Wunschliste aus der Anzeige, die weiter oben steht. */}
        <Gruppe titel={t('intake.g.criteria')} werte={gruppen.kriterien}>
          <Zeile frage={t('intake.q.mustHave')} wert={job.must_have_criteria} />
          <Zeile frage={t('intake.q.trainable')} wert={job.trainable_skills} />
          <Zeile frage={t('intake.q.negotiable')} wert={job.nice_to_have_criteria} />
        </Gruppe>

        <Gruppe titel={t('intake.g.task')} werte={gruppen.aufgabe}>
          <Zeile frage={t('intake.q.dailyRoutine')} wert={job.daily_routine} />
          <Zeile frage={t('intake.q.focus')} wert={job.task_focus} />
          <Zeile frage={t('intake.q.breakdown')} wert={aufteilung} />
        </Gruppe>

        <Gruppe titel={t('intake.g.fit')} werte={gruppen.passung}>
          <Zeile frage={t('intake.q.success')} wert={job.success_profile} />
          <Zeile frage={t('intake.q.failure')} wert={job.failure_profile} />
        </Gruppe>

        <Gruppe titel={t('intake.g.environment')} werte={gruppen.umfeld}>
          <Zeile frage={t('intake.q.teamSize')} wert={teamgroesse} />
          {/* Erst nach dem Reveal in der View. Vorher traegt die
              Groessenklasse in der Eckdatenleiste die Auskunft. */}
          <Zeile frage={t('intake.q.headcount')} wert={zahl(job.company_headcount)} />
          <Zeile frage={t('intake.q.department')} wert={job.department_structure} />
          <Zeile frage={freelance ? t('intake.q.technicalLead') : t('intake.q.reportsTo')} wert={job.reports_to} />
          <Zeile frage={t('intake.q.decisionMakers')} wert={job.decision_makers} />
          <Zeile frage={t('intake.q.culture')} wert={job.company_culture} />
        </Gruppe>

        {freelance ? (
          <Gruppe titel={t('intake.g.termsFreelance')} werte={gruppen.angebot}>
            <Zeile frage={t('intake.q.dayRate')} wert={tagessatzVon(job, t, locale)} />
            <Zeile
              frage={t('intake.q.duration')}
              wert={leer(job.contract_duration_months) ? null : t('intake.months', { n: de(job.contract_duration_months, locale) })}
            />
            <Zeile
              frage={t('intake.q.utilization')}
              wert={leer(job.utilization_days_per_week) ? null : t('intake.daysPerWeek', { n: de(job.utilization_days_per_week, locale) })}
            />
            <Zeile frage={t('intake.q.extension')} wert={job.extension_possible} />
            <Zeile frage={t('intake.q.provided')} wert={job.benefits} />
            <Zeile frage={t('intake.q.projectSpecial')} wert={job.unique_selling_points} />
            <Zeile frage={t('intake.q.advantages')} wert={job.position_advantages} />
          </Gruppe>
        ) : (
          <Gruppe titel={t('intake.g.offer')} werte={gruppen.angebot}>
            <Zeile frage={t('intake.q.salaryMonths')} wert={job.salary_months} />
            <Zeile frage={t('intake.q.bonus')} wert={job.bonus_structure} />
            <Zeile frage={t('intake.q.contractForm')} wert={job.contract_limitation} />
            <Zeile frage={t('intake.q.benefits')} wert={job.benefits} />
            <Zeile frage={t('intake.q.careerPath')} wert={job.career_path} />
            <Zeile frage={t('intake.q.careerExample')} wert={job.career_example} />
            <Zeile frage={t('intake.q.companySpecial')} wert={job.unique_selling_points} />
            <Zeile frage={t('intake.q.advantages')} wert={job.position_advantages} />
          </Gruppe>
        )}

        <Gruppe titel={t('intake.g.frame')} werte={gruppen.rahmen}>
          <Zeile frage={freelance ? t('intake.q.presence') : t('intake.q.workingHours')} wert={arbeitszeitVon(job)} />
          <Zeile frage={t('intake.q.overtime')} wert={job.overtime_policy} />
          <Zeile frage={freelance ? t('intake.q.timesheet') : t('intake.q.timeTracking')} wert={job.time_tracking_method} />
          <Zeile frage={t('intake.q.worksCouncil')} wert={betriebsratVon(job)} />
          <Zeile frage={t('intake.q.worksCouncilMeets')} wert={job.works_council_meeting_schedule} />
          <Zeile
            frage={t('intake.q.yesToContract')}
            wert={leer(job.contract_creation_days) ? null : t('intake.days', { n: de(job.contract_creation_days, locale) })}
          />
          <Zeile frage={t('intake.q.contractDigital')} wert={job.contract_sent_digitally} />
        </Gruppe>

        <Gruppe titel={t('intake.g.before')} werte={gruppen.vorher}>
          <Zeile frage={t('intake.q.sensitive')} wert={job.contract_sensitive_topics} />
          <Zeile frage={t('intake.q.industryChances')} wert={job.industry_opportunities} />
          <Zeile frage={t('intake.q.industryChallenges')} wert={job.industry_challenges} />
        </Gruppe>

        {gesperrt.length > 0 && (
          <p className="flex items-start gap-2 border-t border-border/60 pt-4 text-xs leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              {t('intake.lockedNote', { list: gesperrt.join(', ') })}
            </span>
          </p>
        )}

      </CardContent>
    </Card>
  );
}
