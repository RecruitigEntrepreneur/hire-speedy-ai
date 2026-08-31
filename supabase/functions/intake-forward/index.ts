import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail, clientIp } from '../_shared/http.ts';
import { hashKey } from '../_shared/tokens.ts';
import { checkLimits, LIMITS } from '../_shared/intake-limits.ts';
import { isPlausibleEmail, isFreemailAddress } from '../_shared/domain.ts';
import { serviceClient, resolveDraft, touchDraft, logEvent, issueDraftToken } from '../_shared/intake-core.ts';
import { sendIntakeMail, layout, esc } from '../_shared/intake-mail.ts';
import { intakeResumeUrl } from '../_shared/app-url.ts';

/**
 * intake-forward — "an einen anderen Entscheider weiterleiten". Ohne Login.
 *
 * Erzeugt einen EIGENEN Token fuer die neue Adresse, statt den vorhandenen
 * Link weiterreichen zu lassen. Die gelockte Regel aus J.2.4 begruendet das:
 * ein Entwurf enthaelt Gehaltsbaender, interne Probleme und gescheiterte
 * Suchversuche. Ein herumgereichter Link waere nicht nachvollziehbar und nicht
 * einzeln widerrufbar; mit einem eigenen Token ist beides gegeben.
 *
 * Der Zugang des Absenders bleibt bestehen — er hat die Arbeit gemacht.
 */
serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = serviceClient();
    const ip = clientIp(req);
    const ipHash = ip ? await hashKey(ip) : null;

    const found = await resolveDraft(supabase, body?.draft_token);
    if (!found.ok) return fail(found.reason!, found.message!);
    const draft = found.draft!;

    if (['accepted', 'rejected'].includes(draft.review_state)) {
      return fail('conflict', 'Dieser Vorgang ist abgeschlossen.');
    }

    const toEmail = String(body?.to_email ?? '').trim().toLowerCase();
    const toName = String(body?.to_name ?? '').trim().slice(0, 120) || null;
    const message = String(body?.message ?? '').trim().slice(0, 1000);

    if (!isPlausibleEmail(toEmail)) {
      return fail('invalid_request', 'Bitte geben Sie eine gültige E-Mail-Adresse an.');
    }
    if (isFreemailAddress(toEmail)) {
      return fail('not_allowed',
        'Bitte leiten Sie an eine geschäftliche E-Mail-Adresse weiter — die Aufnahme enthält vertrauliche Angaben zu Ihrer Position.');
    }
    if (toEmail === String(draft.contact_email ?? '').toLowerCase()) {
      return fail('invalid_request', 'Diese Adresse bearbeitet die Aufnahme bereits.');
    }

    const limit = await checkLimits(supabase, LIMITS.forward(draft.id, ip));
    if (!limit.allowed) {
      return fail('rate_limited', 'Sie haben die Aufnahme bereits mehrfach weitergeleitet. Bitte später erneut.');
    }

    const issued = await issueDraftToken(supabase, {
      draftId: draft.id,
      origin: 'forward',
      recipientEmail: toEmail,
      recipientName: toName,
      note: message || null,
    });
    if ('error' in issued) return fail('internal_error', 'Der Zugang konnte nicht erzeugt werden.');

    const url = intakeResumeUrl(issued.token);
    const position = (draft.built as any)?.title ?? draft.title ?? 'eine offene Position';

    const html = layout({
      preheader: `${esc(draft.contact_name ?? 'Ein Kollege')} bittet Sie um Freigabe.`,
      heading: 'Freigabe einer Stellenaufnahme',
      body: `
        <p style="margin:0 0 16px 0;">Guten Tag${toName ? ' ' + esc(toName) : ''},</p>
        <p style="margin:0 0 16px 0;">
          ${esc(draft.contact_name ?? 'Ein Kollege')}${draft.company_name ? ` (${esc(draft.company_name)})` : ''}
          hat bei Matchunt eine Stellenaufnahme für <strong>${esc(position)}</strong> vorbereitet
          und bittet Sie um Prüfung und Freigabe.
        </p>
        ${message ? `<div style="margin:0 0 16px 0;padding:14px 16px;background:#f9fafb;border-left:3px solid #d1d5db;font-style:italic;">${esc(message)}</div>` : ''}
        <p style="margin:0 0 16px 0;">
          Über den Link sehen Sie die vollständige Aufnahme, können sie ergänzen und die Anfrage abschicken.
        </p>`,
      cta: { label: 'Aufnahme öffnen', url },
      footnote:
        'Dieser Zugang gilt 14 Tage und ist ausschließlich für Sie bestimmt. Bitte leiten Sie ihn nicht weiter — nutzen Sie stattdessen die Weiterleitungsfunktion in der Aufnahme, damit jeder Zugang nachvollziehbar bleibt.',
    });

    const mail = await sendIntakeMail(supabase, {
      to: toEmail,
      subject: `Freigabe erbeten: Stellenaufnahme ${position}`,
      html,
      template: 'intake_forward',
      replyTo: draft.contact_email ?? undefined,
      meta: { draft_id: draft.id, from: draft.contact_email },
    });

    if (!mail.sent) {
      return fail('upstream_error', 'Die Einladung konnte nicht versendet werden. Bitte versuchen Sie es erneut.');
    }

    await touchDraft(supabase, draft.id, {}, found.token?.id ?? null);
    await logEvent(supabase, {
      type: 'forwarded', linkId: draft.link_id, draftId: draft.id, ipHash,
      meta: { to_domain: toEmail.split('@').pop() },
    });

    return json({ ok: true, message: `Einladung an ${toEmail} versendet.` });
  } catch (e) {
    console.error('[intake-forward]', e);
    return fail('internal_error', 'Unerwarteter Fehler.');
  }
});
