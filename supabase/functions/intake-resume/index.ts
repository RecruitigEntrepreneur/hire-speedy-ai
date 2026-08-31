import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail, clientIp } from '../_shared/http.ts';
import { hashKey } from '../_shared/tokens.ts';
import { checkLimits, LIMITS } from '../_shared/intake-limits.ts';
import { isPlausibleEmail } from '../_shared/domain.ts';
import { serviceClient, logEvent, issueDraftToken } from '../_shared/intake-core.ts';
import { sendIntakeMail, layout, esc } from '../_shared/intake-mail.ts';
import { intakeResumeUrl } from '../_shared/app-url.ts';

/**
 * intake-resume — "später fortsetzen" und "Link erneut senden". Ohne Login.
 *
 * Antwortet IMMER gleich, egal ob zur Adresse ein Entwurf existiert. Sonst
 * waere der Endpunkt ein Werkzeug, um zu erfahren, welche Unternehmen gerade
 * eine Stelle bei Matchunt aufnehmen — und wer dort verantwortlich ist.
 *
 * Ein neuer Link geht ausschliesslich an eine bereits VERIFIZIERTE Adresse.
 * Vor der Verifizierung gibt es keinen Nachweis, dass die Adresse dem
 * Absender gehoert; ein Link dorthin waere ein Zustellversprechen an einen
 * Unbekannten.
 */
serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const generic = {
    ok: true,
    message:
      'Wenn zu dieser Adresse eine begonnene Aufnahme vorliegt, ist ein Link zum Fortsetzen unterwegs.',
  };

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim().toLowerCase();
    if (!isPlausibleEmail(email)) {
      return fail('invalid_request', 'Bitte geben Sie eine gültige E-Mail-Adresse an.');
    }

    const supabase = serviceClient();
    const ip = clientIp(req);
    const ipHash = ip ? await hashKey(ip) : null;

    const limit = await checkLimits(supabase, LIMITS.resume(email, ip));
    if (!limit.allowed) return json(generic);

    const { data: drafts } = await supabase
      .from('intake_drafts')
      .select('id, link_id, contact_name, company_name, title, built, identity_state, review_state')
      .ilike('contact_email', email)
      .eq('identity_state', 'email_verified')
      .in('review_state', ['not_submitted', 'changes_requested'])
      .order('last_activity_at', { ascending: false })
      .limit(1);

    const draft = drafts?.[0];
    if (!draft) return json(generic);

    const issued = await issueDraftToken(supabase, {
      draftId: draft.id,
      origin: 'resume',
      recipientEmail: email,
      recipientName: draft.contact_name,
      days: 14,
    });
    if ('error' in issued) return json(generic);

    const url = intakeResumeUrl(issued.token);
    const position = (draft.built as any)?.title ?? draft.title ?? 'Ihre Position';

    const html = layout({
      preheader: 'Hier geht es weiter mit Ihrer Stellenaufnahme.',
      heading: 'Ihre Stellenaufnahme fortsetzen',
      body: `
        <p style="margin:0 0 16px 0;">Guten Tag${draft.contact_name ? ' ' + esc(draft.contact_name) : ''},</p>
        <p style="margin:0 0 16px 0;">
          Ihre begonnene Aufnahme für <strong>${esc(position)}</strong> ist gespeichert.
          Über den Link machen Sie genau dort weiter, wo Sie aufgehört haben.
        </p>`,
      cta: { label: 'Aufnahme fortsetzen', url },
      footnote:
        'Der Link gilt 14 Tage. Ohne Aktivität löschen wir die begonnene Aufnahme 30 Tage nach der letzten Änderung.',
    });

    await sendIntakeMail(supabase, {
      to: email,
      subject: `Ihre Stellenaufnahme bei Matchunt fortsetzen`,
      html,
      template: 'intake_resume',
      meta: { draft_id: draft.id },
    });

    await logEvent(supabase, {
      type: 'resume_requested', linkId: draft.link_id, draftId: draft.id, ipHash,
    });

    return json(generic);
  } catch (e) {
    console.error('[intake-resume]', e);
    // Auch im Fehlerfall dieselbe Antwort — sonst waere der Fehler selbst
    // ein Signal.
    return json(generic);
  }
});
