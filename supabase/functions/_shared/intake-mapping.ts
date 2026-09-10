/**
 * Abbildung Gast-Aufnahme -> jobs-Zeile.
 *
 * Spiegel von src/lib/intakeMapping.ts. Beide Dateien MUESSEN dieselbe
 * Abbildung liefern; Deno kann nicht aus src/ importieren. Wer eine aendert,
 * aendert die andere mit.
 *
 * Die Feldliste stammt 1:1 aus buildRecord() in
 * src/components/dashboard/JobIntakeStudio.tsx:335-406 -- dem erprobten
 * Mapper des Dashboard-Studios. Zwei Ergaenzungen gegenueber dort:
 *
 *  1. client_id fehlt hier bewusst. Es wird ausschliesslich im INSERT-Pfad von
 *     accept_intake_draft() gesetzt (gelockte Regel F.4). Genau das Gegenteil
 *     macht der Bestandscode, wo buildRecord blind client_id: user.id schreibt
 *     und damit beim Fortsetzen fremde Stellen still uebernimmt.
 *  2. Die Contracting-Konditionen werden in typisierte Spalten geschrieben,
 *     nicht nur nach intake_payload.contracting -- sonst geht eine
 *     Freelance-Stelle ganz ohne Verguetungsangabe an die Recruiter.
 */

import { catalogToJobRow } from './brief-columns.ts';

type Json = Record<string, any>;

const asArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const out = value.map((v) => String(v ?? '').trim()).filter(Boolean);
  return out.length ? out : undefined;
};

const asInt = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : undefined;
};

const clean = (obj: Json): Json =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

/**
 * Die Einstufung der Kriterien -- aus `flexibility`, nicht aus dem Katalog.
 *
 * BEFUND (09.09.2026, Testaufnahme "Senior Platform Engineer"): Der Kunde
 * stuft jedes Kriterium als unverzichtbar / verhandelbar / lernbar ein, und
 * nichts davon erreichte die Stelle. `knownFromForm` leitet die drei Listen
 * zwar ab, aber nur in einem useMemo fuer Anzeige und Zaehler -- persistiert
 * wird `draft.flexibility`. `catalogToJobRow` liest `dyn.catalog.known` und
 * fand dort nichts. Die Spalten standen in der RPC, die Werte kamen nie an.
 *
 * Abgeleitet wird deshalb hier, an der Stelle, die in die Spalte schreibt.
 * `flexibility` bleibt die einzige Quelle -- die Listen zusaetzlich in den
 * Entwurf zu spiegeln haette zwei Wahrheiten ergeben, die auseinanderlaufen,
 * sobald der Kunde eine Einstufung aendert.
 */
function kriterienAusFlexibility(roh: unknown) {
  const flex = (roh ?? {}) as Record<string, unknown>;
  const mit = (stufe: string) =>
    Object.entries(flex)
      .filter(([kriterium, wert]) => wert === stufe && String(kriterium ?? '').trim())
      .map(([kriterium]) => kriterium.trim());

  const leerZuUndefined = (a: string[]) => (a.length ? a : undefined);
  return {
    must_have_criteria: leerZuUndefined(mit('fix')),
    trainable_skills: leerZuUndefined(mit('flexible')),
    /* Die mittlere Stufe. Ohne sie liest sich ein Profil als "Pflicht oder
       egal" -- der Verhandlungsspielraum ist aber genau das, womit der
       Headhunter einen Kandidaten ueberhaupt vorstellt, der nicht jedes
       Kriterium erfuellt. accept_intake_draft nimmt die Spalte seit
       Migration 20260909110000 an; davor haette sie sie still verworfen. */
    nice_to_have_criteria: leerZuUndefined(mit('negotiable')),
  };
}

/**
 * "Homeoffice frei waehlbar" -- die Auskunft, die keine Zahl ist.
 *
 * Der Chip "frei waehlbar" traegt bewusst keinen chipValue: er legt seinen
 * Text ab, und `store: 'number'` verwirft ihn beim Schreiben, damit
 * onsite_days_required leer bleibt statt falsch. Die Auskunft selbst geht
 * ueber diese Spalte raus. Ein eigener Slot dafuer waere eine Zeile, die
 * niemand ausfuellt -- sie steht schon in der Antwort daneben.
 */
function remoteFreiWaehlbar(known: unknown): boolean | undefined {
  const k = (known ?? {}) as Record<string, { value?: unknown } | undefined>;
  const wert = k.remote_days?.value;
  return typeof wert === 'string' && wert.toLowerCase().includes('frei')
    ? true
    : undefined;
}

/**
 * Baut die Job-Zeile aus einem Entwurf. Ohne client_id, ohne organization_id,
 * ohne status — die setzt accept_intake_draft().
 */
export function draftToJobRow(draft: Json): Json {
  const built = (draft.built ?? {}) as Json;
  const dyn = (draft.dyn ?? {}) as Json;
  const typed = (dyn.typedFields ?? {}) as Json;
  const freelance = (draft.freelance ?? {}) as Json;
  const reveal = (draft.reveal_setup ?? {}) as Json;
  const payload = (draft.intake_payload ?? {}) as Json;
  const isFreelance = draft.contract_type === 'freelance';

  const remoteType = String(built.remote_type ?? 'hybrid');
  const remoteDays = asInt(built.remoteDays);

  /*
    Was der Kunde im Fragenkatalog beantwortet hat. Steht VORNE, damit die
    ausdruecklichen Felder darunter gewinnen koennen, wo beide dieselbe Spalte
    treffen -- Gehalt und Tagessatz kommen aus dem sichtbaren Formular, nicht
    aus der Spiegelung. Umgekehrt gewinnt der Katalog dort, wo er die
    BESTAETIGTE Antwort traegt und `built` nur den Rohwert des Parsers:
    onsite_days_required, vacancy_reason, reports_to und hiring_urgency stehen
    deshalb unten NICHT mehr, sondern kommen aus dem Katalog.
  */
  const ausKatalog = catalogToJobRow(dyn.catalog?.known, String(draft.contract_type ?? ''));
  const ausFlex = kriterienAusFlexibility(draft.flexibility);

  return clean({
    ...ausKatalog,
    title: String(built.title ?? draft.title ?? '').trim() || undefined,
    // Kein Fallback auf "Mein Unternehmen" wie im Dashboard-Studio: hier ist
    // der Firmenname erhoben und geprueft, ein Platzhalter waere ein Fehler.
    company_name:
      String(draft.company_legal_name ?? draft.company_name ?? built.company_name ?? '').trim() || undefined,
    description: String(built.description ?? '').trim() || undefined,
    requirements: String(built.requirements ?? '').trim() || undefined,
    location: String(built.location ?? '').trim() || undefined,
    remote_type: remoteType,
    employment_type: draft.contract_type,
    experience_level: String(built.experience_level ?? 'mid'),

    // Festanstellung: Gehalt. Contracting: Tagessatz.
    salary_min: isFreelance ? undefined : asInt(built.salary_min),
    salary_max: isFreelance ? undefined : asInt(built.salary_max),
    day_rate_min: isFreelance ? asInt(freelance.dayRateMin) : undefined,
    day_rate_max: isFreelance ? asInt(freelance.dayRateMax) : undefined,
    contract_duration_months: isFreelance ? asInt(freelance.durationMonths) : undefined,
    utilization_days_per_week: isFreelance ? asInt(freelance.utilizationDaysPerWeek) : undefined,
    extension_possible: isFreelance
      ? (typeof freelance.extensionPossible === 'boolean' ? freelance.extensionPossible : undefined)
      : undefined,

    skills: asArray(built.skills),
    must_haves: asArray(built.must_haves),
    nice_to_haves: asArray(built.nice_to_haves),

    // Diese fuenf standen bisher in recruiter_jobs_view und wurden von keinem
    // Aufnahmepfad je gefuellt. Der Recruiter sah dafuer KI-erfundene
    // "Selling Points" und "[Unternehmen]" statt der Branche.
    benefits: asArray(built.benefits),
    industry: String(built.industry ?? draft.company_industry ?? '').trim() || undefined,
    required_languages: typed.required_languages ?? undefined,
    required_certifications: typed.required_certifications ?? undefined,
    onsite_required:
      typeof typed.onsite_required === 'boolean' ? typed.onsite_required : undefined,

    briefing_notes: String(payload.briefing_text ?? '').trim() || undefined,
    // Diese vier traegt der Katalog, sobald der Kunde sie bestaetigt hat.
    // `built` ist nur noch der Rueckfall fuer Entwuerfe, die vor dem Katalog
    // entstanden sind -- deshalb `??` gegen den Katalogwert.
    /* Die Einstufung des Kunden. `??` wie bei den vier darunter: haette der
       Katalog die Listen doch, gewinnt er -- sonst kommen sie aus der
       Einstufung an der Kriterienliste, wo der Kunde sie vorgenommen hat. */
    must_have_criteria: ausKatalog.must_have_criteria ?? ausFlex.must_have_criteria,
    trainable_skills: ausKatalog.trainable_skills ?? ausFlex.trainable_skills,
    /* Ohne Katalogseite: nice_to_have_criteria ist kein Slot -- die Einstufung
       an der Kriterienliste ist die einzige Quelle. */
    nice_to_have_criteria: ausFlex.nice_to_have_criteria,
    remote_days_flexible: remoteFreiWaehlbar(dyn.catalog?.known),
    vacancy_reason: ausKatalog.vacancy_reason ?? built.vacancyReason ?? undefined,
    reports_to: ausKatalog.reports_to ?? built.reportsTo ?? undefined,
    hiring_urgency: ausKatalog.hiring_urgency ?? built.hiringUrgency ?? undefined,
    onsite_days_required:
      ausKatalog.onsite_days_required ??
      (remoteType === 'hybrid' && remoteDays != null ? Math.max(0, 5 - remoteDays) : undefined),
    intake_completeness: asInt(draft.completeness),

    // Typisierte Matching-Felder aus der KI-Normalisierung.
    visa_sponsorship: typeof typed.visa_sponsorship === 'boolean' ? typed.visa_sponsorship : undefined,
    experience_min: asInt(typed.experience_min),
    experience_max: asInt(typed.experience_max),
    search_difficulty: typed.search_difficulty ?? undefined,
    target_companies: asArray(typed.target_companies),
    nogo_companies: asArray(typed.nogo_companies),

    reveal_trigger: reveal.trigger ?? 'after_first_interview',
    reveal_envelope: {
      ...(dyn.envelopePatch ?? {}),
      descriptor: reveal.descriptor || (dyn.envelopePatch as Json)?.descriptor || null,
    },

    intake_payload: {
      ...payload,
      source: 'guest_intake',
      captured_at: payload.captured_at ?? new Date().toISOString(),
      /**
       * Die Briefing-Antworten, aus denen die Recruiter-Ansicht zwei Felder
       * projiziert (`recruiter_briefing_answers`: deliverable_90d,
       * interview_process).
       *
       * BEFUND (10.09.2026): Der Dashboard-Pfad schrieb sie seit jeher
       * (src/lib/intakeMapping.ts, `briefing_answers: answers`), dieser hier
       * nicht. Es sind zwei Kopien derselben Abbildung, weil Deno nicht aus
       * src/ importieren kann -- und dieser Pfad ist der lebende: jede
       * Aufnahme ueber /start/:token laeuft hier durch. Die neue Spalte waere
       * also bei genau den Stellen leer geblieben, fuer die sie gebaut wurde.
       * Der Kunde beantwortet die Frage, und niemand sieht die Antwort.
       *
       * Die Allowlist sitzt in der Ansicht, nicht hier: `jobs.intake_payload`
       * ist ohnehin nicht Teil von recruiter_jobs_view.
       */
      briefing_answers: draft.answers ?? payload.briefing_answers ?? null,
      contract_type: draft.contract_type,
      contracting: isFreelance ? freelance : null,
      flexibility: draft.flexibility ?? null,
      skill_requirements: draft.skill_requirements ?? null,
      // Der Entwurfszustand wird beim Uebergang bewusst NICHT mitgenommen:
      // er gehoert in intake_drafts und waere in jobs eine zweite Wahrheit.
      draft_state: null,
    },
  });
}

/** Kurzfassung fuer die Pruefliste und das Vertragsdokument. */
export function draftSummary(draft: Json): {
  title: string;
  company: string;
  location: string | null;
  compensation: string | null;
} {
  const built = (draft.built ?? {}) as Json;
  const freelance = (draft.freelance ?? {}) as Json;
  const isFreelance = draft.contract_type === 'freelance';

  const money = (min: unknown, max: unknown, suffix: string) => {
    const a = asInt(min);
    const b = asInt(max);
    if (a == null && b == null) return null;
    if (a != null && b != null) return `${a.toLocaleString('de-DE')}–${b.toLocaleString('de-DE')} ${suffix}`;
    return `${(a ?? b)!.toLocaleString('de-DE')} ${suffix}`;
  };

  return {
    title: String(built.title ?? draft.title ?? 'Unbenannte Position'),
    company: String(draft.company_legal_name ?? draft.company_name ?? 'Unbenanntes Unternehmen'),
    location: String(built.location ?? '').trim() || null,
    compensation: isFreelance
      ? money(freelance.dayRateMin, freelance.dayRateMax, '€ / Tag')
      : money(built.salary_min, built.salary_max, '€ p. a.'),
  };
}
