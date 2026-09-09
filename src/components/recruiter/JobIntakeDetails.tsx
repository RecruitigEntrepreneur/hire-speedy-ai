import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Lock } from 'lucide-react';

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
const ALTWERTE: Record<string, string> = {
  growth: 'Wachstum',
  succession: 'Nachfolge',
  new_position: 'Neu geschaffen',
  restructuring: 'Umstrukturierung',
  // jobs_contract_limitation_check speichert Schluessel, keine Saetze.
  unbefristet: 'Unbefristet',
  befristet: 'Befristet',
  befristet_mit_aussicht: 'Befristet, mit Aussicht auf Übernahme',
  projekt: 'Projektvertrag',
};

const uebersetzt = (v: unknown) =>
  typeof v === 'string' ? (ALTWERTE[v.trim().toLowerCase()] ?? v) : v;

/**
 * Eine Teamgroesse von -1 ist keine Teamgroesse. Der Wert steht auf
 * Altbestand fuer "nicht ermittelt" und wurde als Zahl gespeichert; gedruckt
 * behauptet er eine Auskunft, die es nicht gibt.
 */
const zahl = (v: unknown) => (typeof v === 'number' && v > 0 ? v : null);

/** Zahlen in Saetzen ("1.200 EUR pro Tag", "13,5 Monate") deutsch setzen. */
const de = (v: unknown) =>
  typeof v === 'number' ? v.toLocaleString('de-DE') : String(v ?? '?');

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
  if (leer(wert)) return null;
  // 13.5 Monatsgehaelter liest sich auf Deutsch als 13,5.
  if (typeof wert === 'number') {
    return (
      <div className="grid gap-x-6 gap-y-0.5 border-t border-border/60 py-2.5 sm:grid-cols-[13rem_1fr]">
        <dt className="text-xs leading-relaxed text-muted-foreground">{frage}</dt>
        <dd className="text-sm leading-relaxed tabular-nums">
          {wert.toLocaleString('de-DE')}
        </dd>
      </div>
    );
  }

  const text = Array.isArray(wert)
    ? wert.filter((x) => x && !platzhalter(x)).map((x) => String(uebersetzt(x))).join(' · ')
    : typeof wert === 'boolean'
      ? (wert ? 'Ja' : 'Nein')
      : String(uebersetzt(wert)).trim();
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

/** Der Tagessatz ist EINE Zeile, auch wenn er aus zwei Spalten kommt. */
const tagessatzVon = (job: IntakeDetails) =>
  leer(job.day_rate_min) && leer(job.day_rate_max)
    ? null
    : `${de(job.day_rate_min)} – ${de(job.day_rate_max)} € pro Tag`;

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
  const freelance = job.employment_type === 'freelance';
  const aufteilung = gewichtung(job.task_breakdown);
  const teamgroesse = zahl(job.team_size);
  const gruppen = gruppenVon(job);

  /* Was hinter dem Reveal-Gate steht und gerade NULL liest. Erhoben oder
     nicht -- vor dem Reveal ist das von hier aus nicht unterscheidbar, also
     wird es als gesperrt benannt und nicht als fehlend. */
  const gesperrt = isRevealed ? [] : ([
    { wert: job.daily_routine, name: 'Arbeitsalltag' },
    { wert: job.company_culture, name: 'Zusammenarbeit im Team' },
    { wert: job.negative_impact_if_unfilled, name: 'Was passiert, wenn die Stelle offen bleibt' },
    { wert: job.unique_selling_points, name: 'Alleinstellungsmerkmale' },
    { wert: job.position_advantages, name: 'Vorteile der Position' },
    // `career_example` traegt im Katalog `only: 'full-time'` -- bei Contracting
    // wird es nie gefragt. Es dort als "gesperrt" zu fuehren hiesse, dem
    // Recruiter eine Auskunft zu versprechen, die niemand gegeben hat.
    { wert: job.career_example, name: 'Karrierebeispiel', gilt: !freelance },
    { wert: job.industry_opportunities, name: 'Chancen der Branche' },
    { wert: job.industry_challenges, name: 'Herausforderungen der Branche' },
    { wert: job.company_headcount, name: 'Genaue Mitarbeiterzahl' },
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
          <CardTitle className="text-base">Aus der Aufnahme</CardTitle>
          <Badge variant="outline" className="border-success/30 text-success">
            vom Kunden bestätigt
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Diese Angaben hat der Kunde im Briefing selbst gegeben — nicht ein Modell
          aus der Anzeige geschrieben. Darauf kannst du dich im Kandidatengespräch berufen.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">

        <Gruppe titel="Warum diese Stelle" werte={gruppen.warum}>
          <Zeile frage="Warum sie offen ist" wert={job.vacancy_reason} />
          <Zeile frage="Wenn sie offen bleibt" wert={job.negative_impact_if_unfilled} />
        </Gruppe>

        {/* Zuerst, weil der Headhunter danach sucht: was muss der Kandidat
            mitbringen, und was darf er hier noch lernen. Beides ist die
            Einstufung des Kunden an seiner eigenen Liste -- nicht die
            Wunschliste aus der Anzeige, die weiter oben steht. */}
        <Gruppe titel="Was wirklich zählt" werte={gruppen.kriterien}>
          <Zeile frage="Ohne das geht es nicht" wert={job.must_have_criteria} />
          <Zeile frage="Kann nachgeschult werden" wert={job.trainable_skills} />
          <Zeile frage="Verhandelbar" wert={job.nice_to_have_criteria} />
        </Gruppe>

        <Gruppe titel="Die Aufgabe" werte={gruppen.aufgabe}>
          <Zeile frage="Der Arbeitsalltag" wert={job.daily_routine} />
          <Zeile frage="Schwerpunkt" wert={job.task_focus} />
          <Zeile frage="Gewichtung" wert={aufteilung} />
        </Gruppe>

        <Gruppe titel="Wer passt — und wer nicht" werte={gruppen.passung}>
          <Zeile frage="Hat hier Erfolg" wert={job.success_profile} />
          <Zeile frage="Ist hier gescheitert" wert={job.failure_profile} />
        </Gruppe>

        <Gruppe titel="Umfeld und Entscheidung" werte={gruppen.umfeld}>
          <Zeile frage="Teamgröße" wert={teamgroesse} />
          {/* Erst nach dem Reveal in der View. Vorher traegt die
              Groessenklasse in der Eckdatenleiste die Auskunft. */}
          <Zeile frage="Mitarbeitende gesamt" wert={zahl(job.company_headcount)} />
          <Zeile frage="Aufbau der Abteilung" wert={job.department_structure} />
          <Zeile frage={freelance ? 'Fachliche Führung' : 'Berichtet an'} wert={job.reports_to} />
          <Zeile frage="Entscheidet mit" wert={job.decision_makers} />
          <Zeile frage="Zusammenarbeit im Team" wert={job.company_culture} />
        </Gruppe>

        {freelance ? (
          <Gruppe titel="Konditionen und Verkaufsargumente" werte={gruppen.angebot}>
            <Zeile frage="Tagessatz" wert={tagessatzVon(job)} />
            <Zeile
              frage="Laufzeit"
              wert={leer(job.contract_duration_months) ? null : `${de(job.contract_duration_months)} Monate`}
            />
            <Zeile
              frage="Auslastung"
              wert={leer(job.utilization_days_per_week) ? null : `${de(job.utilization_days_per_week)} Tage pro Woche`}
            />
            <Zeile frage="Verlängerung möglich" wert={job.extension_possible} />
            <Zeile frage="Wird gestellt" wert={job.benefits} />
            <Zeile frage="Das macht das Projekt besonders" wert={job.unique_selling_points} />
            <Zeile frage="Vorteile der Position" wert={job.position_advantages} />
          </Gruppe>
        ) : (
          <Gruppe titel="Das Angebot" werte={gruppen.angebot}>
            <Zeile frage="Monatsgehälter" wert={job.salary_months} />
            <Zeile frage="Bonus" wert={job.bonus_structure} />
            <Zeile frage="Vertragsform" wert={job.contract_limitation} />
            <Zeile frage="Benefits" wert={job.benefits} />
            <Zeile frage="Entwicklungsweg" wert={job.career_path} />
            <Zeile frage="Ein konkretes Beispiel" wert={job.career_example} />
            <Zeile frage="Das macht die Firma besonders" wert={job.unique_selling_points} />
            <Zeile frage="Vorteile der Position" wert={job.position_advantages} />
          </Gruppe>
        )}

        <Gruppe titel="Rahmen und Tempo" werte={gruppen.rahmen}>
          <Zeile frage={freelance ? 'Anwesenheit' : 'Arbeitszeit'} wert={arbeitszeitVon(job)} />
          <Zeile frage="Überstunden" wert={job.overtime_policy} />
          <Zeile frage={freelance ? 'Leistungsnachweis' : 'Zeiterfassung'} wert={job.time_tracking_method} />
          <Zeile frage="Betriebsrat" wert={betriebsratVon(job)} />
          <Zeile frage="Betriebsrat tagt" wert={job.works_council_meeting_schedule} />
          <Zeile
            frage="Vom Ja bis zum Vertrag"
            wert={leer(job.contract_creation_days) ? null : `${de(job.contract_creation_days)} Tage`}
          />
          <Zeile frage="Vertrag digital" wert={job.contract_sent_digitally} />
        </Gruppe>

        <Gruppe titel="Das solltest du vorher wissen" werte={gruppen.vorher}>
          <Zeile frage="Sensible Vertragsthemen" wert={job.contract_sensitive_topics} />
          <Zeile frage="Chancen der Branche" wert={job.industry_opportunities} />
          <Zeile frage="Herausforderungen der Branche" wert={job.industry_challenges} />
        </Gruppe>

        {gesperrt.length > 0 && (
          <p className="flex items-start gap-2 border-t border-border/60 pt-4 text-xs leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              Erhoben, aber erst nach dem Reveal sichtbar: {gesperrt.join(', ')}.
              Diese Angaben nennen Standorte, Produkte oder Personen und würden den
              Kunden verraten. Frag sie nicht beim Kunden nach — sie stehen bereits da.
            </span>
          </p>
        )}

      </CardContent>
    </Card>
  );
}
