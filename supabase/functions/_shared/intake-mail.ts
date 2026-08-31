/**
 * Mailversand fuer die Jobaufnahme.
 *
 * Bewusst NICHT ueber die vorhandene send-email-Function:
 *   - sie versendet unter 'Recruiting Platform <onboarding@resend.dev>'
 *     (send-email/index.ts:334). Das ist die Resend-Sandbox-Adresse; in
 *     Produktion stellt Resend darueber nur an die eigene Account-Adresse zu.
 *     Eine Verifizierungsmail an ein fremdes Unternehmen kaeme nie an.
 *   - sie hat eine geschlossene Templateliste ohne Uebergabe von subject/html,
 *     und vier ihrer Aufrufer zeigen bereits auf Templates, die es nicht gibt.
 *   - sie steht auf verify_jwt = true.
 *
 * Stattdessen der REST-Weg aus organization-invite/index.ts:187-234 — der
 * einzige Versandpfad im Repo, der res.ok prueft und den Fehlertext auswertet.
 * Protokolliert wird in die vorhandene Tabelle email_events.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const from = (): string => Deno.env.get('RESEND_FROM') ?? 'Matchunt <noreply@matchunt.ai>';

/** HTML-Escaping. send-email interpoliert Freitext ungefiltert (Z. 128) — hier nicht. */
export const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const BRAND = '#111827';
const MUTED = '#6b7280';

/** Gemeinsames Grundgeruest. Abgeleitet aus send-interview-invitation:94-161. */
export function layout(opts: {
  preheader: string;
  heading: string;
  body: string;
  cta?: { label: string; url: string };
  footnote?: string;
}): string {
  return `<!doctype html>
<html lang="de"><body style="margin:0;padding:0;background:#f6f7f9;">
<span style="display:none;font-size:1px;color:#f6f7f9;">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
    <tr><td style="padding:28px 32px 8px 32px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <div style="font-size:15px;font-weight:700;letter-spacing:-0.01em;color:${BRAND};">Matchunt</div>
    </td></tr>
    <tr><td style="padding:8px 32px 0 32px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.3;color:${BRAND};font-weight:700;">${esc(opts.heading)}</h1>
      <div style="font-size:15px;line-height:1.6;color:#374151;">${opts.body}</div>
    </td></tr>
    ${
      opts.cta
        ? `<tr><td style="padding:24px 32px 4px 32px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <a href="${esc(opts.cta.url)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:600;">${esc(opts.cta.label)}</a>
      <div style="margin-top:12px;font-size:12px;color:${MUTED};word-break:break-all;">${esc(opts.cta.url)}</div>
    </td></tr>`
        : ''
    }
    ${
      opts.footnote
        ? `<tr><td style="padding:20px 32px 0 32px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <div style="font-size:12px;line-height:1.6;color:${MUTED};border-top:1px solid #e5e7eb;padding-top:16px;">${opts.footnote}</div>
    </td></tr>`
        : ''
    }
    <tr><td style="padding:24px 32px 28px 32px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <div style="font-size:12px;color:${MUTED};">Versendet über Matchunt.</div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

export interface SendResult {
  sent: boolean;
  id?: string;
  error?: string;
}

/**
 * Versendet und protokolliert. Wirft nie — der Aufrufer entscheidet, ob ein
 * fehlgeschlagener Versand den Vorgang scheitern laesst. Bei der
 * Verifizierungsmail tut er das, bei einer Benachrichtigung nicht.
 */
export async function sendIntakeMail(
  supabase: SupabaseClient,
  args: {
    to: string;
    subject: string;
    html: string;
    template: string;
    replyTo?: string;
    meta?: Record<string, unknown>;
  },
): Promise<SendResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY');

  const { data: logRow } = await supabase
    .from('email_events')
    .insert({
      to_email: args.to,
      template_name: args.template,
      subject: args.subject,
      status: 'pending',
      metadata: args.meta ?? {},
    })
    .select('id')
    .maybeSingle();

  const finish = async (status: string, error?: string, id?: string) => {
    if (logRow?.id) {
      await supabase
        .from('email_events')
        .update({
          status,
          error_message: error ?? null,
          metadata: { ...(args.meta ?? {}), resend_id: id ?? null },
        })
        .eq('id', logRow.id);
    }
  };

  if (!apiKey) {
    const message = 'RESEND_API_KEY ist nicht gesetzt';
    console.error('[intake-mail]', message);
    await finish('failed', message);
    return { sent: false, error: message };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: from(),
        to: [args.to],
        subject: args.subject,
        html: args.html,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const text = (await res.text()).slice(0, 400);
      console.error('[intake-mail] Resend antwortete', res.status, text);
      await finish('failed', `${res.status}: ${text}`);
      return { sent: false, error: `Resend ${res.status}` };
    }

    const body = await res.json().catch(() => ({}));
    await finish('sent', undefined, body?.id);
    return { sent: true, id: body?.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unbekannter Fehler';
    console.error('[intake-mail] Versand fehlgeschlagen:', message);
    await finish('failed', message);
    return { sent: false, error: message };
  }
}
