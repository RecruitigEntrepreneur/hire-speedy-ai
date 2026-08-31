import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail, clientIp, userAgent } from '../_shared/http.ts';
import { hashKey, hashCode, generateNumericCode, timingSafeEqual } from '../_shared/tokens.ts';
import { checkLimits, LIMITS } from '../_shared/intake-limits.ts';
import {
  normalizeDomain, domainFromEmail, isFreemailAddress, isPlausibleEmail, maskEmail,
} from '../_shared/domain.ts';
import { serviceClient, resolveDraft, touchDraft, logEvent, publicDraft } from '../_shared/intake-core.ts';
import { sendIntakeMail, layout, esc } from '../_shared/intake-mail.ts';

/**
 * intake-verify-email — Nachweis der Geschaefts-E-Mail. Ohne Login.
 *
 * Es gibt im Repo kein Verifizierungs-Primitiv: kein signInWithOtp, kein
 * verifyOtp, kein generateLink. Alle bestehenden Token-Flows senden an eine
 * bereits bekannte Adresse; "der Nutzer traegt seine Adresse selbst ein und
 * weist sie nach" existiert nicht und wird hier gebaut.
 *
 * Sechsstelliger Code, 15 Minuten, hoechstens 5 Versuche, nur als Hash
 * gespeichert. Ein Magic Link waere bequemer, aber der Code funktioniert auch,
 * wenn die Mail auf dem Telefon und die Aufnahme am Rechner liegt — genau der
 * Regelfall, wenn jemand eine Stelle aufnimmt.
 */

const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action === 'confirm' ? 'confirm' : 'send';

    const supabase = serviceClient();
    const ip = clientIp(req);
    const ipHash = ip ? await hashKey(ip) : null;
    const ua = userAgent(req);

    const found = await resolveDraft(supabase, body?.draft_token);
    if (!found.ok) return fail(found.reason!, found.message!);
    const draft = found.draft!;
    const tokenId = found.token?.id ?? null;

    if (['pending_admin', 'accepted', 'rejected'].includes(draft.review_state)) {
      return fail('conflict', 'Dieser Vorgang ist abgeschlossen.');
    }

    // ------------------------------------------------------------------ send
    if (action === 'send') {
      const email = String(body?.email ?? draft.contact_email ?? '').trim().toLowerCase();
      if (!isPlausibleEmail(email)) {
        return fail('invalid_request', 'Bitte geben Sie eine gültige E-Mail-Adresse an.');
      }

      // Freemail am oeffentlichen Link: Ablehnung (Entscheidung 2026-08-31).
      // An persoenlichen und Kampagnenlinks bleibt sie zugelassen — dort ist
      // bekannt, wer schreibt.
      if (isFreemailAddress(email)) {
        let linkType = 'public';
        let allow = false;
        if (draft.link_id) {
          const { data: link } = await supabase
            .from('intake_links').select('link_type, allow_freemail').eq('id', draft.link_id).maybeSingle();
          linkType = link?.link_type ?? 'public';
          allow = link?.allow_freemail === true;
        }
        if (linkType === 'public' && !allow) {
          return fail('not_allowed',
            'Bitte verwenden Sie Ihre geschäftliche E-Mail-Adresse. Über eine private Adresse können wir das Unternehmen nicht zuordnen.');
        }
      }

      const limit = await checkLimits(supabase, LIMITS.verifySend(draft.id, email, ip));
      if (!limit.allowed) {
        return fail('rate_limited',
          'Es wurden bereits mehrere Codes an diese Adresse gesendet. Bitte prüfen Sie Ihren Posteingang und den Spam-Ordner.');
      }

      const code = generateNumericCode(6);
      const codeHash = await hashCode(draft.id, code);

      // Aeltere offene Codes entwerten: sonst waeren mehrere gleichzeitig gueltig.
      await supabase
        .from('intake_email_verifications')
        .update({ consumed: true })
        .eq('draft_id', draft.id)
        .eq('consumed', false);

      const { error: insErr } = await supabase.from('intake_email_verifications').insert({
        draft_id: draft.id,
        email,
        code_hash: codeHash,
        expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
        max_attempts: MAX_ATTEMPTS,
        ip_hash: ipHash,
      });
      if (insErr) {
        console.error('[intake-verify-email] Code nicht gespeichert:', insErr.message);
        return fail('internal_error', 'Der Code konnte nicht erzeugt werden.');
      }

      const html = layout({
        preheader: `Ihr Bestätigungscode: ${code}`,
        heading: 'Ihr Bestätigungscode',
        body: `
          <p style="margin:0 0 16px 0;">Guten Tag${draft.contact_name ? ' ' + esc(draft.contact_name) : ''},</p>
          <p style="margin:0 0 20px 0;">bitte bestätigen Sie Ihre geschäftliche E-Mail-Adresse mit diesem Code:</p>
          <div style="font-size:34px;font-weight:700;letter-spacing:10px;padding:18px 0;color:#111827;">${esc(code)}</div>
          <p style="margin:12px 0 0 0;">Der Code ist ${CODE_TTL_MINUTES} Minuten gültig.</p>`,
        footnote:
          'Wenn Sie keine Stellenaufnahme bei Matchunt begonnen haben, können Sie diese Nachricht ignorieren. Der Code allein gibt niemandem Zugriff.',
      });

      const mail = await sendIntakeMail(supabase, {
        to: email,
        subject: `${code} ist Ihr Matchunt-Bestätigungscode`,
        html,
        template: 'intake_verify_code',
        meta: { draft_id: draft.id, link_id: draft.link_id },
      });

      if (!mail.sent) {
        // Anders als bei einer Benachrichtigung ist ein fehlgeschlagener
        // Versand hier fatal: der Kunde wartet auf etwas, das nie kommt.
        return fail('upstream_error',
          'Die Bestätigungsmail konnte nicht versendet werden. Bitte versuchen Sie es in einigen Minuten erneut.');
      }

      await touchDraft(supabase, draft.id, {
        contact_email: email,
        is_freemail: isFreemailAddress(email),
        ...(draft.identity_state === 'anonymous' && draft.contact_name
          ? { identity_state: 'contact_provided' }
          : {}),
      }, tokenId);
      await logEvent(supabase, {
        type: 'email_verification_sent', linkId: draft.link_id, draftId: draft.id, ipHash,
      });

      return json({ sent: true, masked_email: maskEmail(email), expires_in_minutes: CODE_TTL_MINUTES });
    }

    // --------------------------------------------------------------- confirm
    const code = String(body?.code ?? '').replace(/\D/g, '');
    if (code.length !== 6) return fail('invalid_request', 'Bitte geben Sie den sechsstelligen Code ein.');

    const limit = await checkLimits(supabase, LIMITS.verifyConfirm(draft.id, ip));
    if (!limit.allowed) return fail('rate_limited', 'Zu viele Versuche. Bitte später erneut probieren.');

    const { data: row } = await supabase
      .from('intake_email_verifications')
      .select('*')
      .eq('draft_id', draft.id)
      .eq('consumed', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return fail('not_found', 'Es liegt kein offener Code vor. Bitte fordern Sie einen neuen an.');
    if (new Date(row.expires_at) < new Date()) {
      await supabase.from('intake_email_verifications').update({ consumed: true }).eq('id', row.id);
      return fail('expired', 'Der Code ist abgelaufen. Bitte fordern Sie einen neuen an.');
    }
    if ((row.attempts ?? 0) >= (row.max_attempts ?? MAX_ATTEMPTS)) {
      await supabase.from('intake_email_verifications').update({ consumed: true }).eq('id', row.id);
      return fail('not_allowed', 'Zu viele Fehlversuche. Bitte fordern Sie einen neuen Code an.');
    }

    const given = await hashCode(draft.id, code);
    if (!timingSafeEqual(given, row.code_hash)) {
      const attempts = (row.attempts ?? 0) + 1;
      await supabase.from('intake_email_verifications').update({ attempts }).eq('id', row.id);
      const left = Math.max(0, (row.max_attempts ?? MAX_ATTEMPTS) - attempts);
      return fail('invalid_request',
        left > 0
          ? `Der Code stimmt nicht. Noch ${left} ${left === 1 ? 'Versuch' : 'Versuche'}.`
          : 'Der Code stimmt nicht. Bitte fordern Sie einen neuen an.');
    }

    await supabase
      .from('intake_email_verifications')
      .update({ verified_at: new Date().toISOString(), consumed: true, attempts: (row.attempts ?? 0) + 1 })
      .eq('id', row.id);

    // ---- Bestandskunden erkennen -- als Hinweis, nicht als Zuordnung -------
    const domain = normalizeDomain(draft.company_website) ?? domainFromEmail(row.email);
    let matchedOrg: string | null = draft.matched_organization_id ?? null;
    let matchedOutreach: string | null = draft.matched_outreach_company_id ?? null;
    let matchedUser: string | null = null;
    let confidence: string | null = draft.match_confidence ?? null;
    let knownCompany: { type: string; name: string } | null = null;

    // Die E-Mail-Adresse selbst ist das staerkste Signal: derselbe Mensch.
    const { data: profileHit } = await supabase
      .from('profiles').select('user_id, full_name, company_name').ilike('email', row.email).maybeSingle();
    if (profileHit) {
      matchedUser = profileHit.user_id;
      confidence = 'exact_email';
      const { data: org } = await supabase
        .from('organizations').select('id, name').eq('owner_id', profileHit.user_id).eq('type', 'client')
        .order('created_at').limit(1).maybeSingle();
      if (org) { matchedOrg = matchedOrg ?? org.id; knownCompany = { type: 'organization', name: org.name }; }
    }

    if (domain && !isFreemailAddress(row.email)) {
      if (!matchedOrg) {
        const { data: org } = await supabase
          .from('organizations').select('id, name').eq('primary_domain', domain).maybeSingle();
        if (org) { matchedOrg = org.id; confidence = confidence ?? 'exact_domain'; knownCompany = { type: 'organization', name: org.name }; }
      }
      if (!matchedOutreach) {
        const { data: oc } = await supabase
          .from('outreach_companies').select('id, name').eq('domain', domain).maybeSingle();
        if (oc) { matchedOutreach = oc.id; confidence = confidence ?? 'exact_domain'; knownCompany = knownCompany ?? { type: 'known_company', name: oc.name }; }
      }
    }

    await touchDraft(supabase, draft.id, {
      contact_email: row.email,
      company_domain: domain,
      is_freemail: isFreemailAddress(row.email),
      identity_state: 'email_verified',
      matched_organization_id: matchedOrg,
      matched_outreach_company_id: matchedOutreach,
      matched_client_user_id: matchedUser,
      match_confidence: confidence,
    }, tokenId);

    // DSGVO-Nachweis. Muss serverseitig laufen: die Policy
    // "System can insert consents" WITH CHECK (true) faellt unter das
    // Drop-Kriterium von 20260829110000 und steht nicht auf der Keep-Liste.
    const { error: consentErr } = await supabase.from('consents').insert({
      subject_type: 'intake_draft',
      subject_id: draft.id,
      consent_type: 'email_verification',
      version: '2026-09-v1',
      granted: true,
      ip_address: ipHash,
      user_agent: ua,
      granted_at: new Date().toISOString(),
    });
    if (consentErr) console.warn('[intake-verify-email] consents:', consentErr.message);

    await logEvent(supabase, {
      type: 'email_verified', linkId: draft.link_id, draftId: draft.id, ipHash, userAgent: ua,
      meta: { domain, matched: Boolean(matchedOrg || matchedOutreach) },
    });

    const { data: fresh } = await supabase.from('intake_drafts').select('*').eq('id', draft.id).single();

    return json({
      verified: true,
      // Nur die Tatsache, dass wir das Unternehmen kennen — nie, dass es im
      // Akquise-Bestand liegt. Das ist Innensicht.
      known_company: knownCompany ? { name: knownCompany.name } : null,
      draft: fresh ? publicDraft(fresh) : null,
    });
  } catch (e) {
    console.error('[intake-verify-email]', e);
    return fail('internal_error', 'Unerwarteter Fehler.');
  }
});
