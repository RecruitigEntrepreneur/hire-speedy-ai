import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail, clientIp, userAgent, isMissingRelation } from '../_shared/http.ts';
import { hashToken, hashKey } from '../_shared/tokens.ts';
import { checkLimits, LIMITS } from '../_shared/intake-limits.ts';
import {
  serviceClient, logEvent, publicDraft, publicLink, linkState, issueDraftToken,
  publicPackages, inDays, DRAFT_DAYS,
} from '../_shared/intake-core.ts';

/**
 * intake-start — Einstieg ueber einen Jobaufnahme-Link. Ohne Login.
 *
 * Erzeugt fuer jeden Aufruf einen EIGENEN Entwurf mit eigenem Token. Der Link
 * selbst ist mehrfach oeffenbar (auch der persoenliche: derselbe Ansprech-
 * partner darf eine zweite Stelle aufnehmen); die Sessionbindung aus
 * ONBOARDING_INTAKE_MASTERANALYSE J.2.4 sitzt am Entwurf, nicht am Link.
 * Grund: ein Link traegt nur Vorbelegung, ein Entwurf traegt Gehaltsbaender
 * und gescheiterte Suchversuche.
 *
 * Gibt ausserdem die geltenden Konditionen mit zurueck — sie stehen ab der
 * ersten Sekunde auf dem Schirm, nicht als Ueberraschung am Ende. AGB
 * Paragraph 9 sagt genau das zu.
 */
serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.token;
    const anonymousId: string | null =
      typeof body?.anonymous_id === 'string' ? body.anonymous_id.slice(0, 64) : null;

    if (typeof token !== 'string' || token.length < 20) {
      return fail('invalid_request', 'Ungültiger Link.');
    }

    const supabase = serviceClient();
    const ip = clientIp(req);
    const ipHash = ip ? await hashKey(ip) : null;
    const ua = userAgent(req);

    // ---- Link finden ------------------------------------------------------
    const tokenHash = await hashToken(token);
    const { data: link, error: linkErr } = await supabase
      .from('intake_links')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (linkErr) {
      if (isMissingRelation(linkErr)) {
        return fail('not_deployed',
          'Die Jobaufnahme ist noch nicht freigeschaltet. Bitte melden Sie sich bei Ihrem Ansprechpartner.');
      }
      console.error('[intake-start] Link-Lookup:', linkErr.message);
      return fail('internal_error', 'Link konnte nicht geprüft werden.');
    }
    if (!link) return fail('not_found', 'Dieser Link ist unbekannt.');

    const state = linkState(link);
    if (!state.ok) {
      return fail(state.reason as 'revoked' | 'expired' | 'exhausted', state.message!);
    }

    // ---- Bremse -----------------------------------------------------------
    // Erst nach der Link-Pruefung: ein unbekannter Token soll den Zaehler
    // eines echten Links nicht belasten.
    const limit = await checkLimits(supabase, LIMITS.start(ip, link.id));
    if (!limit.allowed) {
      return fail('rate_limited',
        'Zu viele Aufrufe in kurzer Zeit. Bitte versuchen Sie es in einer Stunde erneut.');
    }

    await logEvent(supabase, {
      type: 'link_opened', linkId: link.id, anonymousId, ipHash, userAgent: ua,
    });

    // ---- Betreuer (nur der Name, keine Kontaktdaten) ----------------------
    let ownerName: string | null = null;
    if (link.owner_user_id) {
      const { data: owner } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', link.owner_user_id)
        .maybeSingle();
      ownerName = owner?.full_name ?? null;
    }

    // ---- Konditionen ------------------------------------------------------
    // Uebersicht der drei Pakete fuer den Seitenkopf. Die Auswahl kommt
    // spaeter (intake-packages) -- die Transparenz gilt ab jetzt.
    const packages = await publicPackages(supabase);

    // ---- Entwurf anlegen --------------------------------------------------
    const prefill = (link.prefill ?? {}) as Record<string, any>;

    const contractType =
      prefill.contract_type === 'freelance' || body?.contract_type === 'freelance'
        ? 'freelance'
        : 'full-time';

    const { data: draft, error: draftErr } = await supabase
      .from('intake_drafts')
      .insert({
        link_id: link.id,
        purge_after: inDays(DRAFT_DAYS),
        contract_type: contractType,
        // Vorbelegung, die der Kunde bestaetigt statt einzutippen.
        company_name: prefill.company_name ?? null,
        company_domain: prefill.company_domain ?? null,
        company_industry: prefill.industry ?? null,
        company_size: prefill.company_size ?? null,
        contact_name: prefill.contact_name ?? null,
        contact_email: prefill.contact_email ?? null,
        contact_role: prefill.contact_role ?? null,
        title: prefill.seed_title ?? null,
        owner_user_id: link.owner_user_id ?? null,
        // Ist die Firma am Link bereits mit einer Organisation verknuepft,
        // wird das als HINWEIS vermerkt. Rechte entstehen daraus keine.
        matched_organization_id: link.organization_id ?? null,
        matched_outreach_company_id: link.outreach_company_id ?? null,
        match_confidence: link.organization_id ? 'exact_domain' : null,
        anonymous_id: anonymousId,
        ip_hash: ipHash,
        user_agent: ua,
      })
      .select('*')
      .single();

    if (draftErr || !draft) {
      console.error('[intake-start] Entwurf nicht angelegt:', draftErr?.message);
      return fail('internal_error', 'Die Aufnahme konnte nicht gestartet werden.');
    }

    // Erster Zugriffstoken. Weitere entstehen beim Weiterleiten und beim
    // Anfordern eines Fortsetzungslinks — jeder einzeln widerrufbar.
    const issued = await issueDraftToken(supabase, {
      draftId: draft.id,
      origin: 'start',
      recipientEmail: prefill.contact_email ?? null,
      recipientName: prefill.contact_name ?? null,
    });
    if ('error' in issued) {
      // Ohne Token waere der gerade angelegte Entwurf unerreichbar.
      await supabase.from('intake_drafts').delete().eq('id', draft.id);
      return fail('internal_error', 'Die Aufnahme konnte nicht gestartet werden.');
    }
    const draftToken = issued.token;

    // Zaehler und Ereignis. Der Zaehler ist bewusst nicht transaktional mit
    // dem Insert verbunden — ein verlorener Zaehlschritt ist harmlos, ein
    // verlorener Entwurf nicht.
    await supabase
      .from('intake_links')
      .update({ uses_count: (link.uses_count ?? 0) + 1 })
      .eq('id', link.id);

    await logEvent(supabase, {
      type: 'intake_started', linkId: link.id, draftId: draft.id,
      anonymousId, ipHash, userAgent: ua,
      meta: { link_type: link.link_type, campaign: link.campaign_key ?? null },
    });

    return json({
      link: publicLink(link, ownerName),
      packages,
      draft_token: draftToken,
      draft: publicDraft(draft),
    });
  } catch (e) {
    console.error('[intake-start]', e);
    return fail('internal_error', 'Unerwarteter Fehler.');
  }
});
