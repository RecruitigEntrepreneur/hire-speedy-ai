import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail, clientIp } from '../_shared/http.ts';
import { hashKey } from '../_shared/tokens.ts';
import {
  serviceClient, resolveDraft, touchDraft, logEvent,
  resolveTemplate, clientFacingTerms, effectiveTerms,
} from '../_shared/intake-core.ts';
import { getPublicAppUrl } from '../_shared/app-url.ts';

/**
 * intake-terms — Konditionen zeigen und Rueckfragen anstossen. Ohne Login.
 *
 * Die Konditionen sind bei der Darstellung FREIBLEIBEND. Die Bestaetigung des
 * Kunden (in intake-submit) ist sein Angebot, nicht der Vertragsschluss;
 * Matchunt nimmt gesondert an. Andernfalls waere Matchunt an jeden gebunden,
 * der das Formular ausfuellt — auch an Wettbewerber und an Mandate, die
 * niemand bedienen kann.
 *
 * "Konditionen besprechen" ist kein Verhandlungsschritt im Produkt (gelockt in
 * ONBOARDING_INTAKE_MASTERANALYSE: der Admin bewegt sich nur innerhalb der
 * veroeffentlichten Regel). Es ist eine protokollierte Rueckfrage, die beim
 * Betreuer landet — und die Aufnahme laeuft trotzdem weiter.
 */
serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action === 'request_discussion' ? 'request_discussion' : 'get';

    const supabase = serviceClient();
    const ip = clientIp(req);
    const ipHash = ip ? await hashKey(ip) : null;

    const found = await resolveDraft(supabase, body?.draft_token);
    if (!found.ok) return fail(found.reason!, found.message!);
    const draft = found.draft!;

    let link: Record<string, any> | null = null;
    if (draft.link_id) {
      const { data } = await supabase.from('intake_links').select('*').eq('id', draft.link_id).maybeSingle();
      link = data ?? null;
    }

    const template = await resolveTemplate(supabase, link?.terms_template_id);
    if (!template) {
      return fail('not_deployed',
        'Die Konditionen sind noch nicht hinterlegt. Bitte melden Sie sich bei Ihrem Ansprechpartner.');
    }

    const shown = clientFacingTerms(template, link);

    // ------------------------------------------------------------------- get
    if (action === 'get') {
      // Ein offenes Angebot wird nicht bei jedem Aufruf neu erzeugt — sonst
      // gaebe es zu einem Entwurf beliebig viele Konditionsstaende.
      const { data: existing } = await supabase
        .from('commercial_mandates')
        .select('id, mandate_number, status, fee_percentage, client_confirmed_at, template_version')
        .eq('draft_id', draft.id)
        .in('status', ['proposed', 'client_confirmed', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (draft.commercial_state === 'not_started') {
        await touchDraft(supabase, draft.id, { commercial_state: 'presented' });
        await logEvent(supabase, {
          type: 'terms_presented', linkId: draft.link_id, draftId: draft.id, ipHash,
          meta: { template_id: template.id, version: template.version, fee: shown.fee_percentage },
        });
      }

      return json({
        terms: {
          ...shown,
          agb_url: `${getPublicAppUrl()}/agb`,
          // Was der Kunde als naechstes erwartet: nach der Anfrage kommt der
          // Vertrag zur Unterschrift. Das steht hier und nicht erst hinterher.
          signature_notice: shown.requires_signature
            ? 'Nach Ihrer Anfrage prüfen wir das Mandat und senden Ihnen die Vermittlungsvereinbarung zur digitalen Unterschrift zu. Erst danach starten wir die Suche.'
            : null,
        },
        mandate: existing
          ? {
              id: existing.id,
              number: existing.mandate_number,
              status: existing.status,
              confirmed_at: existing.client_confirmed_at,
            }
          : null,
        commercial_state: draft.commercial_state === 'not_started' ? 'presented' : draft.commercial_state,
      });
    }

    // ---------------------------------------------------- request_discussion
    if (draft.review_state === 'accepted') {
      return fail('conflict', 'Der Auftrag ist bereits angenommen. Bitte wenden Sie sich an Ihren Ansprechpartner.');
    }

    const note = String(body?.note ?? '').trim().slice(0, 2000);
    const t = effectiveTerms(template, link);

    await touchDraft(supabase, draft.id, {
      commercial_state: 'discussion_requested',
      admin_note: [draft.admin_note, note && `Rückfrage des Kunden: ${note}`]
        .filter(Boolean).join('\n\n').slice(0, 4000) || null,
    });

    await logEvent(supabase, {
      type: 'terms_discussion_requested', linkId: draft.link_id, draftId: draft.id, ipHash,
      meta: { note_length: note.length, shown_fee: t.fee_percentage },
    });

    // Der Betreuer erfaehrt es sofort; sonst versandet die Rueckfrage.
    const recipients = new Set<string>();
    if (draft.owner_user_id) recipients.add(draft.owner_user_id);
    if (recipients.size === 0) {
      const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin').limit(5);
      (admins ?? []).forEach((a) => recipients.add(a.user_id));
    }
    if (recipients.size > 0) {
      await supabase.from('notifications').insert(
        [...recipients].map((user_id) => ({
          user_id,
          type: 'intake_terms_discussion',
          title: 'Rückfrage zu den Konditionen',
          message: `${draft.company_name ?? 'Ein Unternehmen'} möchte die Konditionen besprechen${note ? `: ${note.slice(0, 200)}` : '.'}`,
          related_type: 'intake_draft',
          related_id: draft.id,
        })),
      );
    }

    return json({
      ok: true,
      commercial_state: 'discussion_requested',
      message:
        'Vermerkt. Ihr Ansprechpartner meldet sich zu den Konditionen. Sie können die Aufnahme trotzdem abschließen und einreichen — wir starten erst nach der Klärung.',
    });
  } catch (e) {
    console.error('[intake-terms]', e);
    return fail('internal_error', 'Unerwarteter Fehler.');
  }
});
