/**
 * Gemeinsame Bausteine der login-freien Jobaufnahme.
 *
 * Alle Gast-Endpunkte laufen mit Service-Role und umgehen damit RLS. Es gibt
 * bewusst KEINE anon-Policy auf intake_links/intake_drafts: das ausgelieferte
 * Frontend-Bundle enthaelt den anon-Key, ein clientseitiger Filter schuetzt
 * also nichts. Die Zugangskontrolle sitzt vollstaendig hier.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hashToken } from './tokens.ts';
import { isMissingRelation } from './http.ts';

export const serviceClient = (): SupabaseClient =>
  createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

/** Rollende Verlaengerung des Entwurfs-Tokens: 14 Tage ab letzter Aktivitaet. */
export const TOKEN_DAYS = 14;
/** Aufbewahrung des Entwurfs: 30 Tage ab letzter Aktivitaet (J.2.4). */
export const DRAFT_DAYS = 30;

export const inDays = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString();

export type DraftRow = Record<string, any>;
export type LinkRow = Record<string, any>;

export interface DraftLookup {
  ok: boolean;
  draft?: DraftRow;
  /** Die Token-Zeile, ueber die zugegriffen wurde. */
  token?: Record<string, any>;
  reason?: 'not_found' | 'expired' | 'revoked' | 'not_deployed' | 'internal_error';
  message?: string;
}

/**
 * Entwurf per Token. Getrennte Ergebnisse statt eines pauschalen Fehlschlags —
 * der Kunde soll erfahren, ob sein Link abgelaufen, widerrufen oder unbekannt
 * ist (Muster validate-invite:51-62).
 *
 * Ein Entwurf kann mehrere gueltige Token haben (Erstbearbeiter, weiter-
 * geleiteter Entscheider). Der benutzte Token wird mitgegeben, damit der
 * Aufrufer seine Gueltigkeit rollen und ihn protokollieren kann.
 */
export async function resolveDraft(
  supabase: SupabaseClient,
  draftToken: unknown,
): Promise<DraftLookup> {
  if (typeof draftToken !== 'string' || draftToken.length < 20) {
    return { ok: false, reason: 'not_found', message: 'Ungültiger Zugriffslink.' };
  }

  const hash = await hashToken(draftToken);
  const { data: token, error } = await supabase
    .from('intake_draft_tokens')
    .select('*')
    .eq('token_hash', hash)
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error)) {
      return {
        ok: false,
        reason: 'not_deployed',
        message: 'Die Jobaufnahme ist noch nicht freigeschaltet. Bitte melden Sie sich bei uns.',
      };
    }
    console.error('[intake-core] Token-Lookup fehlgeschlagen:', error.message);
    return { ok: false, reason: 'internal_error', message: 'Zugriff fehlgeschlagen.' };
  }
  if (!token) return { ok: false, reason: 'not_found', message: 'Dieser Zugriffslink ist unbekannt.' };

  if (token.revoked_at) {
    return { ok: false, reason: 'revoked', message: 'Dieser Zugriffslink wurde deaktiviert.' };
  }
  if (token.expires_at && new Date(token.expires_at) < new Date()) {
    return {
      ok: false,
      reason: 'expired',
      message: 'Dieser Zugriffslink ist abgelaufen. Wir senden Ihnen gern einen neuen.',
    };
  }

  const { data: draft, error: draftErr } = await supabase
    .from('intake_drafts')
    .select('*')
    .eq('id', token.draft_id)
    .maybeSingle();

  if (draftErr) {
    console.error('[intake-core] Entwurfs-Lookup fehlgeschlagen:', draftErr.message);
    return { ok: false, reason: 'internal_error', message: 'Zugriff fehlgeschlagen.' };
  }
  if (!draft) {
    // Der Entwurf wurde nach 30 Tagen Inaktivitaet geloescht (J.2.4).
    return {
      ok: false,
      reason: 'expired',
      message: 'Diese Aufnahme ist abgelaufen und wurde gelöscht. Bitte beginnen Sie neu.',
    };
  }

  // Nutzungsspur, nicht blockierend.
  void supabase
    .from('intake_draft_tokens')
    .update({ last_used_at: new Date().toISOString(), use_count: (token.use_count ?? 0) + 1 })
    .eq('id', token.id)
    .then(({ error: e }) => { if (e) console.warn('[intake-core] Token-Spur:', e.message); });

  return { ok: true, draft, token };
}

/** Einen neuen Zugriffstoken auf einen Entwurf ausgeben. */
export async function issueDraftToken(
  supabase: SupabaseClient,
  args: {
    draftId: string;
    origin: 'start' | 'forward' | 'resume' | 'admin';
    recipientEmail?: string | null;
    recipientName?: string | null;
    note?: string | null;
    createdBy?: string | null;
    days?: number;
  },
): Promise<{ token: string } | { error: string }> {
  const { generateToken } = await import('./tokens.ts');
  const token = generateToken();
  const { error } = await supabase.from('intake_draft_tokens').insert({
    draft_id: args.draftId,
    token_hash: await hashToken(token),
    origin: args.origin,
    recipient_email: args.recipientEmail ?? null,
    recipient_name: args.recipientName ?? null,
    note: args.note ?? null,
    created_by: args.createdBy ?? null,
    expires_at: inDays(args.days ?? TOKEN_DAYS),
  });
  if (error) {
    console.error('[intake-core] Token nicht ausgegeben:', error.message);
    return { error: error.message };
  }
  return { token };
}

/**
 * Aktivitaet fortschreiben. Rollt die Aufbewahrung des Entwurfs und die
 * Gueltigkeit des benutzten Tokens mit — solange jemand arbeitet, laeuft
 * nichts ab.
 */
export async function touchDraft(
  supabase: SupabaseClient,
  draftId: string,
  patch: Record<string, unknown> = {},
  tokenId?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('intake_drafts')
    .update({
      ...patch,
      last_activity_at: new Date().toISOString(),
      purge_after: inDays(DRAFT_DAYS),
    })
    .eq('id', draftId);
  if (error) console.warn('[intake-core] touchDraft:', error.message);

  if (tokenId) {
    await supabase
      .from('intake_draft_tokens')
      .update({ expires_at: inDays(TOKEN_DAYS) })
      .eq('id', tokenId)
      .is('revoked_at', null);
  }
}

export type IntakeEvent =
  | 'link_opened' | 'intake_started' | 'first_value' | 'contact_provided'
  | 'email_verification_sent' | 'email_verified' | 'intake_completed'
  // Firmenpruefung
  | 'company_check_started' | 'company_verified' | 'company_needs_review' | 'company_failed'
  // Paketwahl. 'terms_discussion_requested' entsteht nicht mehr neu -- es gibt
  // drei Pakete und keine Verhandlung -- bleibt aber fuer Bestandsdaten.
  | 'terms_presented' | 'terms_confirmed' | 'terms_discussion_requested'
  | 'forwarded' | 'resume_requested' | 'submitted'
  | 'accepted' | 'changes_requested' | 'rejected'
  | 'clarification_requested' | 'clarification_answered'
  // Unterschrift, zweistufig: der Kunde zuerst, Matchunt zuletzt.
  | 'contract_released' | 'contract_sent' | 'contract_signed'
  | 'contract_countersigned' | 'contract_declined'
  | 'published' | 'abandoned' | 'purged';

/** Ereignis protokollieren. Nie blockierend — ein fehlender Funnel-Eintrag
 *  darf keinen Kundenvorgang scheitern lassen. */
export async function logEvent(
  supabase: SupabaseClient,
  event: {
    type: IntakeEvent;
    linkId?: string | null;
    draftId?: string | null;
    anonymousId?: string | null;
    ipHash?: string | null;
    userAgent?: string | null;
    actorUserId?: string | null;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from('intake_link_events').insert({
    link_id: event.linkId ?? null,
    draft_id: event.draftId ?? null,
    event_type: event.type,
    anonymous_id: event.anonymousId ?? null,
    ip_hash: event.ipHash ?? null,
    user_agent: event.userAgent ?? null,
    actor_user_id: event.actorUserId ?? null,
    meta: event.meta ?? {},
  });
  if (error) console.warn('[intake-core] Ereignis nicht protokolliert:', event.type, error.message);
}

/**
 * Was der Gast von seinem Entwurf sehen darf.
 *
 * Explizite Whitelist statt select('*') — dasselbe Prinzip wie in
 * get-interview-by-token/index.ts:43-56. Nicht enthalten: Token-Hashes,
 * IP-Hash, interne Notizen, die erkannten Bestandskunden-Verweise und
 * owner_user_id. Der Kunde soll nicht erfahren, dass wir ihn im CRM fuehren.
 */
/**
 * Stand des Vertragslaufs, soweit der Kunde ihn sehen darf.
 *
 * Ohne diese Angaben weiss die Seite nach einem Neuladen nicht, ob schon ein
 * Umschlag unterwegs ist -- und der Kunde saehe eine Bestaetigung ohne jeden
 * Weg zur Unterschrift. Wer den Tab schliesst und zurueckkommt, koennte den
 * Vertrag nie abschliessen.
 */
export interface ContractState {
  /** Sprechende Vorgangsnummer, MV-…. Ohne sie stuende nach einem Neuladen
   *  "Vorgang ." auf der Seite -- ein Vertrag ohne Nummer. */
  number: string | null;
  has_envelope: boolean;
  customer_signed: boolean;
  countersigned: boolean;
  /** An wen der Vertrag ging, wenn nicht an den Absender selbst. */
  signer_email: string | null;
  signer_name: string | null;
}

/** Den Vertragsstand zu einem Entwurf holen. Nie blockierend. */
export async function contractState(
  supabase: SupabaseClient, draftId: string,
): Promise<ContractState | null> {
  const { data } = await supabase
    .from('commercial_mandates')
    .select('mandate_number, envelope_id, customer_signed_at, countersigned_at, customer_signer_email, customer_signer_name')
    .eq('draft_id', draftId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    number: data.mandate_number ?? null,
    has_envelope: Boolean(data.envelope_id),
    customer_signed: Boolean(data.customer_signed_at),
    countersigned: Boolean(data.countersigned_at),
    signer_email: data.customer_signer_email ?? null,
    signer_name: data.customer_signer_name ?? null,
  };
}

export function publicDraft(d: DraftRow, contract?: ContractState | null) {
  return {
    contract: contract ?? null,
    id: d.id,
    contract_type: d.contract_type,
    built: d.built ?? null,
    answers: d.answers ?? null,
    dyn: d.dyn ?? null,
    freelance: d.freelance ?? null,
    flexibility: d.flexibility ?? null,
    reveal_setup: d.reveal_setup ?? null,
    skill_requirements: d.skill_requirements ?? null,
    completeness: d.completeness ?? 0,
    title: d.title ?? null,
    contact_name: d.contact_name ?? null,
    contact_email: d.contact_email ?? null,
    contact_phone: d.contact_phone ?? null,
    contact_role: d.contact_role ?? null,
    company_name: d.company_name ?? null,
    company_legal_name: d.company_legal_name ?? null,
    company_domain: d.company_domain ?? null,
    company_website: d.company_website ?? null,
    company_street: d.company_street ?? null,
    company_postal_code: d.company_postal_code ?? null,
    company_city: d.company_city ?? null,
    company_country: d.company_country ?? null,
    company_vat_id: d.company_vat_id ?? null,
    company_registration_number: d.company_registration_number ?? null,
    company_size: d.company_size ?? null,
    company_industry: d.company_industry ?? null,
    billing_email: d.billing_email ?? null,
    states: {
      capture: d.capture_state,
      identity: d.identity_state,
      // Die Firmenpruefung laeuft als eigene Spur -- der Kunde soll sehen,
      // dass sie laeuft, statt vor einem stummen Ladebalken zu sitzen.
      company: d.company_state ?? 'not_checked',
      commercial: d.commercial_state,
      review: d.review_state,
    },
    selected_package_key: d.selected_package_key ?? null,
    selected_package_version: d.selected_package_version ?? null,
    submitted_at: d.submitted_at ?? null,
    rejection_reason: d.review_state === 'changes_requested' ? d.rejection_reason ?? null : null,
    purge_after: d.purge_after,
  };
}

/** Was der Gast vom Link sehen darf. Kein Token, keine CRM-Verweise. */
export function publicLink(l: LinkRow, ownerName: string | null) {
  const prefill = (l.prefill ?? {}) as Record<string, unknown>;
  return {
    id: l.id,
    link_type: l.link_type,
    label: l.label,
    owner_name: ownerName,
    allow_freemail: l.link_type === 'public' ? l.allow_freemail === true : true,
    prefill: {
      company_name: prefill.company_name ?? null,
      company_domain: prefill.company_domain ?? null,
      industry: prefill.industry ?? null,
      location: prefill.location ?? null,
      company_size: prefill.company_size ?? null,
      contact_name: prefill.contact_name ?? null,
      contact_email: prefill.contact_email ?? null,
      contact_role: prefill.contact_role ?? null,
      seed_title: prefill.seed_title ?? null,
      seed_text: prefill.seed_text ?? null,
      contract_type: prefill.contract_type ?? null,
    },
  };
}

/** Zustand eines Links, mit dem Grund im Klartext. */
export function linkState(l: LinkRow): { ok: boolean; reason?: string; message?: string } {
  if (l.revoked_at) {
    return { ok: false, reason: 'revoked', message: 'Dieser Link wurde deaktiviert.' };
  }
  if (l.expires_at && new Date(l.expires_at) < new Date()) {
    return { ok: false, reason: 'expired', message: 'Dieser Link ist abgelaufen.' };
  }
  if (l.max_uses != null && (l.uses_count ?? 0) >= l.max_uses) {
    return { ok: false, reason: 'exhausted', message: 'Dieser Link wurde bereits verwendet.' };
  }
  return { ok: true };
}

/**
 * Die geltende Konditionsvorlage: die des Links, sonst die aktive Standardfassung.
 */
export async function resolveTemplate(
  supabase: SupabaseClient,
  templateId?: string | null,
): Promise<Record<string, any> | null> {
  if (templateId) {
    const { data } = await supabase
      .from('commercial_terms_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle();
    if (data) return data;
  }
  const { data, error } = await supabase
    .from('commercial_terms_templates')
    .select('*')
    .eq('key', 'standard')
    .eq('is_active', true)
    .maybeSingle();
  if (error) console.warn('[intake-core] Konditionsvorlage nicht ladbar:', error.message);
  return data ?? null;
}

/** Die Zahlen, die fuer diesen Vorgang gelten: Link schlaegt Vorlage. */
export function effectiveTerms(template: Record<string, any>, link: LinkRow | null) {
  return {
    fee_percentage: Number(link?.fee_percentage ?? template.fee_percentage),
    recruiter_fee_percentage: Number(
      link?.recruiter_fee_percentage ?? template.recruiter_fee_percentage,
    ),
    fee_basis: template.fee_basis as string,
    contracting_margin_percentage: template.contracting_margin_percentage ?? null,
    payment_terms_days: Number(template.payment_terms_days),
    guarantee_days: template.guarantee_days ?? null,
    refund_rule: template.refund_rule ?? null,
    vat_note: template.vat_note ?? null,
    requires_signature: template.requires_signature === true,
    requires_kyb: template.requires_kyb === true,
  };
}

/**
 * Was der Kunde von den Konditionen sieht.
 *
 * WICHTIG: recruiter_fee_percentage ist NICHT enthalten. Das ist die
 * Innenmarge und geht den Kunden nichts an — anders als heute in
 * recruiter_jobs_view, wo beide Saetze unmaskiert nebeneinander stehen.
 */
export function clientFacingTerms(template: Record<string, any>, link: LinkRow | null) {
  const t = effectiveTerms(template, link);
  return {
    fee_percentage: t.fee_percentage,
    fee_basis: t.fee_basis,
    payment_terms_days: t.payment_terms_days,
    guarantee_days: t.guarantee_days,
    refund_rule: t.refund_rule,
    vat_note: t.vat_note,
    requires_signature: t.requires_signature,
    body_md: template.body_md as string,
    template_id: template.id as string,
    template_version: template.version as number,
    agb_version: template.agb_version as string,
    label: template.label as string,
  };
}

/**
 * Die drei Pakete in Kundensicht -- fuer den Kopf der Aufnahmeseite.
 *
 * AGB Paragraph 9 sagt zu, die Kondition werde "vor Beginn des jeweiligen
 * Vermittlungsprozesses transparent in der Plattform ausgewiesen". Die
 * AUSWAHL passiert erst nach der Aufnahme und nach der Firmenpruefung; die
 * TRANSPARENZ gilt trotzdem ab der ersten Sekunde. Deshalb steht hier eine
 * Uebersicht ohne Auswahlmoeglichkeit.
 *
 * Gelesen wird commercial_packages_public. Die View fuehrt Recruiter-Anteil,
 * Marge, Einbehalt und Auslobung nicht -- damit koennen sie hier auch nicht
 * versehentlich mitgeschickt werden.
 */
export async function publicPackages(supabase: SupabaseClient): Promise<{
  key: string; name: string; summary: string; fee_percent: number;
  continuity_days: number | null; payment_terms_days: number;
}[] | null> {
  const { data, error } = await supabase
    .from('commercial_packages_public')
    .select('package_key, public_name, summary, client_fee_pct, continuity_days, payment_terms_days')
    .order('sort_order');
  if (error || !data?.length) return null;
  return data.map((p: Record<string, any>) => ({
    key: p.package_key,
    name: p.public_name,
    summary: p.summary,
    fee_percent: Number(p.client_fee_pct),
    continuity_days: p.continuity_days,
    payment_terms_days: p.payment_terms_days,
  }));
}
