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

  return clean({
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

    briefing_notes: String(payload.briefing_text ?? '').trim() || undefined,
    vacancy_reason: built.vacancyReason ?? undefined,
    reports_to: built.reportsTo ?? undefined,
    hiring_urgency: built.hiringUrgency ?? undefined,
    onsite_days_required:
      remoteType === 'hybrid' && remoteDays != null ? Math.max(0, 5 - remoteDays) : undefined,
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
