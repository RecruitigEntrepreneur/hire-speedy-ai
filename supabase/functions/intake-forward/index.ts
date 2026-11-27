import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail, clientIp } from '../_shared/http.ts';
import { hashKey } from '../_shared/tokens.ts';
import { checkLimits, LIMITS } from '../_shared/intake-limits.ts';
import { isPlausibleEmail, isFreemailAddress } from '../_shared/domain.ts';
import { serviceClient, resolveDraft, touchDraft, logEvent, issueDraftToken } from '../_shared/intake-core.ts';
import { sendIntakeMail, layout, esc } from '../_shared/intake-mail.ts';
import { intakeResumeUrl } from '../_shared/app-url.ts';
import { callLanguage, customerMailLanguage, rememberDraftLanguage, withIntakeLang } from '../_shared/intake-language.ts';
import { forwardMailTexts, helferMailTexts, zurueckMailTexts } from '../_shared/intake-i18n.ts';
import { ichVon, mitarbeitInfo, rolleVon } from '../_shared/aufnahme-mitarbeit.ts';

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
 *
 * Seit 26.11.2026 außerdem „Kollegen bitten“ (rolle: 'beschreiben'): Die eingeladene
 * Person beschreibt nur die Stelle. Dazu die Aktionen 'zurueckziehen' (Einladender
 * nimmt eine Einladung zurück) und 'zurueckgeben' (die Kollegin ist fertig; der
 * Einladende bekommt eine Mail mit frischem Link).
 */
serve(withIntakeLang(async (req) => {
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
    // Der Kunde hat im Menü eine Sprache gewählt: am Entwurf merken.
    const lang = callLanguage(body);
    await rememberDraftLanguage(supabase, draft, lang);

    if (['accepted', 'rejected'].includes(draft.review_state)) {
      return fail('conflict', 'Dieser Vorgang ist abgeschlossen.');
    }

    const rolle = rolleVon(found.token);
    const action = String(body?.action ?? 'invite');
    const mailLangFrueh = await customerMailLanguage(supabase, draft, lang);

    // ---- Einladung zurückziehen (nur wer die Aufnahme verantwortet) --------------
    if (action === 'zurueckziehen') {
      if (rolle !== 'voll') return fail('not_allowed', 'Diese Aktion ist der einladenden Person vorbehalten.');
      const id = String(body?.token_id ?? '');
      const { error } = await supabase
        .from('intake_draft_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id)
        .eq('draft_id', draft.id)
        .eq('rolle', 'beschreiben');
      if (error) return fail('internal_error', 'Die Einladung konnte nicht zurückgezogen werden.');
      return json({ ok: true, mitarbeit: await mitarbeitInfo(supabase, draft, found.token) });
    }

    // ---- Kollegin ist fertig: zurück an den Einladenden ----------------------------
    if (action === 'zurueckgeben') {
      if (rolle !== 'beschreiben') return fail('not_allowed', 'Nur eine eingeladene Person kann zurückgeben.');
      const ich = ichVon(draft, found.token);
      if (!ich.bestaetigt) return fail('not_allowed', 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.');
      await supabase.from('intake_draft_tokens').update({ zurueckgegeben_am: new Date().toISOString() }).eq('id', found.token!.id);
      const an = String(draft.contact_email ?? '').trim();
      if (an) {
        // Frischer Zugang für den Einladenden, damit der Link in der Mail sicher funktioniert.
        const zugang = await issueDraftToken(supabase, { draftId: draft.id, origin: 'resume', recipientEmail: an, recipientName: draft.contact_name ?? null });
        if (!('error' in zugang)) {
          const tx = zurueckMailTexts(mailLangFrueh);
          const position = (draft.built as any)?.title ?? draft.title ?? '';
          const helfer = esc(ich.name ?? tx.helferFallback);
          const html = layout({
            lang: mailLangFrueh,
            preheader: tx.preheader,
            heading: tx.heading,
            body: `
              <p style="margin:0 0 16px 0;">${tx.hello}${draft.contact_name ? ' ' + esc(draft.contact_name) : ''},</p>
              <p style="margin:0 0 16px 0;">${tx.lead(helfer, `<strong>${esc(position)}</strong>`)}</p>`,
            cta: { label: tx.cta, url: intakeResumeUrl(zugang.token) },
          });
          await sendIntakeMail(supabase, {
            to: an, subject: tx.subject, html, template: 'intake_helfer_zurueck',
            meta: { draft_id: draft.id, helfer: ich.email },
          });
        }
      }
      await touchDraft(supabase, draft.id, {}, found.token?.id ?? null);
      const { data: tok } = await supabase.from('intake_draft_tokens').select('*').eq('id', found.token!.id).single();
      return json({ ok: true, mitarbeit: await mitarbeitInfo(supabase, draft, tok ?? found.token) });
    }

    // Einladen geht nur aus einem vollen Zugang -- eine Kollegin lädt nicht weiter ein.
    if (rolle !== 'voll') return fail('not_allowed', 'Diese Aktion ist der einladenden Person vorbehalten.');
    const helferEinladen = body?.rolle === 'beschreiben';
    if (helferEinladen && draft.identity_state !== 'email_verified') {
      return fail('not_allowed', 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.');
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
      rolle: helferEinladen ? 'beschreiben' : 'voll',
    });
    if ('error' in issued) return fail('internal_error', 'Der Zugang konnte nicht erzeugt werden.');

    const url = intakeResumeUrl(issued.token);
    // In der Sprache des Entwurfs, sonst des Links, sonst des Aufrufs.
    const mailLang = mailLangFrueh;

    if (helferEinladen) {
      const hx = helferMailTexts(mailLang);
      const position = (draft.built as any)?.title ?? draft.title ?? hx.positionFallback;
      // Der Name des Einladenden kommt im Einladen-Blatt mit; sonst wenigstens seine Adresse.
      const senderRoh = draft.contact_name ?? draft.contact_email ?? hx.senderFallback;
      const senderH = esc(senderRoh);
      const htmlH = layout({
        lang: mailLang,
        preheader: hx.preheader,
        heading: hx.heading,
        body: `
          <p style="margin:0 0 16px 0;">${hx.hello}${toName ? ' ' + esc(toName) : ''},</p>
          <p style="margin:0 0 16px 0;">${hx.lead(`${senderH}${draft.company_name ? ` (${esc(draft.company_name)})` : ''}`, `<strong>${esc(position)}</strong>`)}</p>
          ${message ? `<div style="margin:0 0 16px 0;padding:14px 16px;background:#f9fafb;border-left:3px solid #d1d5db;font-style:italic;">${esc(message)}</div>` : ''}
          <p style="margin:0 0 16px 0;">${hx.link(senderH)}</p>`,
        cta: { label: hx.cta, url },
        footnote: hx.footnote,
      });
      const mailH = await sendIntakeMail(supabase, {
        to: toEmail,
        subject: hx.subject(senderRoh),
        html: htmlH,
        template: 'intake_helfer',
        replyTo: draft.contact_email ?? undefined,
        meta: { draft_id: draft.id, from: draft.contact_email },
      });
      if (!mailH.sent) {
        if (issued.id) await supabase.from('intake_draft_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', issued.id);
        return fail('upstream_error', 'Die Einladung konnte nicht versendet werden. Bitte versuchen Sie es erneut.');
      }
      await touchDraft(supabase, draft.id, {}, found.token?.id ?? null);
      await logEvent(supabase, {
        type: 'forwarded', linkId: draft.link_id, draftId: draft.id, ipHash,
        meta: { to_domain: toEmail.split('@').pop(), rolle: 'beschreiben' },
      });
      return json({ ok: true, message: `Einladung an ${toEmail} versendet.`, mitarbeit: await mitarbeitInfo(supabase, draft, found.token) });
    }

    const text = forwardMailTexts(mailLang);
    const position = (draft.built as any)?.title ?? draft.title ?? text.positionFallback;
    const sender = esc(draft.contact_name ?? text.senderFallback);

    const html = layout({
      lang: mailLang,
      preheader: text.preheader(sender),
      heading: text.heading,
      body: `
        <p style="margin:0 0 16px 0;">${text.hello}${toName ? ' ' + esc(toName) : ''},</p>
        <p style="margin:0 0 16px 0;">
          ${text.lead(`${sender}${draft.company_name ? ` (${esc(draft.company_name)})` : ''}`, `<strong>${esc(position)}</strong>`)}
        </p>
        ${message ? `<div style="margin:0 0 16px 0;padding:14px 16px;background:#f9fafb;border-left:3px solid #d1d5db;font-style:italic;">${esc(message)}</div>` : ''}
        <p style="margin:0 0 16px 0;">
          ${text.link}
        </p>`,
      cta: { label: text.cta, url },
      footnote: text.footnote,
    });

    const mail = await sendIntakeMail(supabase, {
      to: toEmail,
      subject: text.subject(position),
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
}, { success: true }));
