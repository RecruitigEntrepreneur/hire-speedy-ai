import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail, clientIp, userAgent } from '../_shared/http.ts';
import { hashKey } from '../_shared/tokens.ts';
import { checkLimits, LIMITS } from '../_shared/intake-limits.ts';
import { normalizeDomain, isFreemailAddress, isPlausibleEmail } from '../_shared/domain.ts';
import {
  serviceClient, resolveDraft, touchDraft, logEvent, publicDraft, publicLink,
  resolveTemplate, clientFacingTerms, inDays, DRAFT_DAYS, TOKEN_DAYS,
} from '../_shared/intake-core.ts';

/**
 * intake-draft — Laden und Autosave der Aufnahme. Ohne Login, per Entwurfs-Token.
 *
 * Anders als der bestehende Dashboard-Pfad meldet diese Function einen
 * Speicherfehler ausdruecklich zurueck. src/lib/intakeCapture.ts:56 faengt eine
 * fehlende Spalte ab und laesst den Insert still ohne die erweiterten Felder
 * durchlaufen — der Kunde sieht "Entwurf gespeichert" und findet beim
 * Fortsetzen ein leeres Briefing. Ein Gast hat kein Dashboard, in das er
 * ausweichen koennte; hier darf nichts still verschwinden.
 */

/** Nur diese Felder duerfen aus dem Browser gesetzt werden. Alles rund um
 *  Zustaende, Zuordnung, Freigabe und Vertrag ist ausgeschlossen. */
const CONTENT_FIELDS = [
  'built', 'answers', 'dyn', 'freelance', 'flexibility',
  'reveal_setup', 'intake_payload', 'skill_requirements',
] as const;

const TEXT_FIELDS = [
  'title',
  'contact_name', 'contact_email', 'contact_phone', 'contact_role',
  'company_name', 'company_legal_name', 'company_website',
  'company_street', 'company_postal_code', 'company_city', 'company_country',
  'company_vat_id', 'company_registration_number', 'company_size', 'company_industry',
  'billing_email',
] as const;

/** Grobe Obergrenze gegen aufgeblaehte Payloads. 512 KB reichen fuer jedes
 *  reale Briefing um ein Vielfaches. */
const MAX_PAYLOAD_BYTES = 512 * 1024;

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action === 'patch' ? 'patch' : 'get';

    const supabase = serviceClient();
    const ip = clientIp(req);
    const ipHash = ip ? await hashKey(ip) : null;

    const found = await resolveDraft(supabase, body?.draft_token);
    if (!found.ok) return fail(found.reason!, found.message!);
    const draft = found.draft!;
    const tokenId = found.token?.id ?? null;

    // Ein abgeschlossener Vorgang wird nicht mehr bearbeitet.
    const locked = ['pending_admin', 'accepted', 'rejected'].includes(draft.review_state);

    // ---- Begleitdaten (Link + Konditionen) --------------------------------
    let link: Record<string, any> | null = null;
    if (draft.link_id) {
      const { data } = await supabase.from('intake_links').select('*').eq('id', draft.link_id).maybeSingle();
      link = data ?? null;
    }
    let ownerName: string | null = null;
    if (link?.owner_user_id) {
      const { data } = await supabase.from('profiles').select('full_name').eq('user_id', link.owner_user_id).maybeSingle();
      ownerName = data?.full_name ?? null;
    }
    const template = await resolveTemplate(supabase, link?.terms_template_id);
    const terms = template ? clientFacingTerms(template, link) : null;

    if (action === 'get') {
      await touchDraft(supabase, draft.id, {}, tokenId);
      return json({
        draft: publicDraft(draft),
        link: link ? publicLink(link, ownerName) : null,
        terms,
        locked,
      });
    }

    // ---- Autosave ---------------------------------------------------------
    if (locked) {
      return fail('conflict',
        draft.review_state === 'pending_admin'
          ? 'Ihre Anfrage liegt bereits bei uns und kann nicht mehr geändert werden.'
          : 'Dieser Vorgang ist abgeschlossen.');
    }

    const limit = await checkLimits(supabase, LIMITS.draftPatch(draft.id));
    if (!limit.allowed) {
      return fail('rate_limited', 'Zu viele Speichervorgänge. Bitte kurz warten.');
    }

    const patchIn = (body?.patch ?? {}) as Record<string, unknown>;
    if (JSON.stringify(patchIn).length > MAX_PAYLOAD_BYTES) {
      return fail('invalid_request', 'Die Aufnahme ist zu groß. Bitte kürzen Sie die Freitexte.');
    }

    const update: Record<string, unknown> = {};

    for (const field of CONTENT_FIELDS) {
      if (field in patchIn) update[field] = patchIn[field] ?? null;
    }
    for (const field of TEXT_FIELDS) {
      if (field in patchIn) {
        const raw = patchIn[field];
        update[field] = typeof raw === 'string' ? raw.trim().slice(0, 300) || null : null;
      }
    }
    if ('contract_type' in patchIn) {
      update.contract_type = patchIn.contract_type === 'freelance' ? 'freelance' : 'full-time';
    }
    if ('completeness' in patchIn) {
      const value = Number(patchIn.completeness);
      update.completeness = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
    }

    // Domain wird immer serverseitig abgeleitet, nie uebernommen: der Browser
    // ist im Gast-Fall vollstaendig unter der Kontrolle des Aufrufers.
    const emailForDomain = (update.contact_email as string) ?? draft.contact_email;
    const siteForDomain = (update.company_website as string) ?? draft.company_website;
    if ('contact_email' in update || 'company_website' in update) {
      const domain =
        normalizeDomain(siteForDomain) ??
        (emailForDomain && !isFreemailAddress(emailForDomain)
          ? normalizeDomain(String(emailForDomain).split('@').pop())
          : null);
      update.company_domain = domain;
      update.is_freemail = isFreemailAddress(emailForDomain);
    }

    // ---- Zustandsachsen fortschreiben -------------------------------------
    const nextEmail = (update.contact_email as string) ?? draft.contact_email;
    const nextName = (update.contact_name as string) ?? draft.contact_name;
    const hasContact = Boolean(nextName && nextEmail && isPlausibleEmail(nextEmail));

    // Aendert sich die Adresse nach der Verifizierung, faellt die Verifizierung
    // zurueck. Sonst waere die gepruefte Adresse nachtraeglich austauschbar.
    const emailChanged =
      'contact_email' in update &&
      String(update.contact_email ?? '').toLowerCase() !== String(draft.contact_email ?? '').toLowerCase();

    if (draft.identity_state === 'email_verified' && emailChanged) {
      update.identity_state = hasContact ? 'contact_provided' : 'anonymous';
      // Ein bereits bestaetigtes Konditionsangebot haengt an der geprueften
      // Adresse und wird ebenfalls zurueckgesetzt.
      if (draft.commercial_state === 'confirmed') update.commercial_state = 'presented';
    } else if (draft.identity_state === 'anonymous' && hasContact) {
      update.identity_state = 'contact_provided';
    }

    const hasTitle = Boolean(
      ((update.built as any)?.title ?? (draft.built as any)?.title ?? update.title ?? draft.title),
    );
    if (hasTitle && draft.capture_state === 'started') update.capture_state = 'in_progress';

    if (Object.keys(update).length === 0) {
      await touchDraft(supabase, draft.id, {}, tokenId);
      return json({ draft: publicDraft(draft), link: link ? publicLink(link, ownerName) : null, terms, locked: false });
    }

    const { data: saved, error } = await supabase
      .from('intake_drafts')
      .update({
        ...update,
        last_activity_at: new Date().toISOString(),
        purge_after: inDays(DRAFT_DAYS),
      })
      .eq('id', draft.id)
      .select('*')
      .single();

    if (!error && tokenId) {
      await supabase
        .from('intake_draft_tokens')
        .update({ expires_at: inDays(TOKEN_DAYS) })
        .eq('id', tokenId)
        .is('revoked_at', null);
    }

    if (error || !saved) {
      // Ausdruecklich melden statt still schlucken.
      console.error('[intake-draft] Speichern fehlgeschlagen:', error?.message);
      return fail('internal_error',
        'Ihre Eingaben konnten gerade nicht gespeichert werden. Bitte versuchen Sie es erneut.');
    }

    // Ereignisse: einmalig, an den Zustandsuebergaengen.
    if (draft.capture_state === 'started' && saved.capture_state === 'in_progress') {
      await logEvent(supabase, {
        type: 'first_value', linkId: draft.link_id, draftId: draft.id,
        anonymousId: draft.anonymous_id, ipHash,
      });
    }
    if (draft.identity_state === 'anonymous' && saved.identity_state === 'contact_provided') {
      await logEvent(supabase, {
        type: 'contact_provided', linkId: draft.link_id, draftId: draft.id,
        anonymousId: draft.anonymous_id, ipHash,
        meta: { is_freemail: saved.is_freemail === true },
      });
    }

    return json({
      draft: publicDraft(saved),
      link: link ? publicLink(link, ownerName) : null,
      terms,
      locked: false,
    });
  } catch (e) {
    console.error('[intake-draft]', e);
    return fail('internal_error', 'Unerwarteter Fehler.');
  }
});
