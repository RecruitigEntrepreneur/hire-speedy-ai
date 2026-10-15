/**
 * company-decision-notify – Mail an den Kunden, nachdem Matchunt über eine
 * Firma entschieden hat (verifiziert, abgelehnt, Rückfrage, Änderung).
 *
 * Body: { companyId, decision: 'verify' | 'reject' | 'question' }
 *
 * Nur Admins. Die Entscheidung selbst steht schon in client_companies
 * (admin_decide_company); diese Function liest sie und schreibt die Mail.
 * Empfänger: Inhaber des Kontos (wie die Benachrichtigung im Konto).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fail, json, preflight } from '../_shared/http.ts';
import { esc, layout, sendIntakeMail } from '../_shared/intake-mail.ts';
import { getPublicAppUrl } from '../_shared/app-url.ts';

const TEMPLATE = 'company_decision_client';
const str = (v: unknown) => (typeof v === 'string' ? v : '');

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return fail('invalid_request', 'Nur POST.');

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return fail('not_allowed', 'Anmeldung fehlt.');
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: userData } = await anon.auth.getUser(token);
    const user = userData?.user;
    if (!user) return fail('not_allowed', 'Anmeldung ungültig.');
    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: isAdmin } = await db.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return fail('not_allowed', 'Nur Matchunt.');

    const body = await req.json().catch(() => null) as { companyId?: string; decision?: string } | null;
    const decision = body?.decision;
    if (!body?.companyId || !decision || !['verify', 'reject', 'question'].includes(decision)) {
      return fail('invalid_request', 'companyId oder decision fehlt.');
    }

    const { data: c } = await db.from('client_companies')
      .select('id, owner_id, name, legal_name, status, reject_reason, admin_question, pending_change, decided_at, updated_at')
      .eq('id', body.companyId).maybeSingle();
    if (!c) return fail('not_found', 'Firma nicht gefunden.');
    const { data: owner } = await db.from('profiles').select('email, full_name').eq('user_id', c.owner_id).maybeSingle();
    if (!owner?.email) return json({ sent: false, skipped: 'keine E-Mail beim Kunden' });

    const name = str(c.legal_name) || str(c.name);
    // Eine Änderung, die gerade entschieden wurde, steht nicht mehr in pending_change –
    // bei Rückfragen schon.
    const isChange = decision === 'question' ? !!c.pending_change && c.status === 'verified' : false;
    const link = `${getPublicAppUrl()}/dashboard/settings#firmendaten`;

    const texte = {
      verify: {
        subject: `„${name}“ ist verifiziert`,
        heading: `„${name}“ ist verifiziert`,
        text: 'Matchunt hat Ihre Firma geprüft. Sie können jetzt Stellen für diese Firma einreichen. Hat sich eine Änderung bestätigt, gelten die neuen Daten ab sofort für neue Stellen.',
        cta: 'Zu Ihren Firmen',
      },
      reject: {
        subject: `„${name}“ wurde nicht verifiziert`,
        heading: `„${name}“ wurde nicht verifiziert`,
        text: `Grund: ${str(c.reject_reason)}. Sie können die Angaben korrigieren und die Firma erneut zur Prüfung senden.`,
        cta: 'Angaben korrigieren',
      },
      question: {
        subject: `Rückfrage zu „${name}“`,
        heading: `Rückfrage zu „${name}“`,
        text: `${isChange ? 'Zu Ihrer Änderung' : 'Zu Ihrer Firma'} hat Matchunt eine Frage: ${str(c.admin_question)}`,
        cta: 'Angaben ergänzen',
      },
    }[decision as 'verify' | 'reject' | 'question'];

    const html = layout({
      preheader: texte.subject,
      heading: texte.heading,
      body: [
        `<p style="margin:0 0 12px 0;">Guten Tag${owner.full_name ? ` ${esc(owner.full_name)}` : ''},</p>`,
        `<p style="margin:0 0 12px 0;">${esc(texte.text)}</p>`,
      ].join(''),
      cta: { label: texte.cta, url: link },
      footnote: 'Stellen können nur für Firmen eingereicht werden, die Matchunt verifiziert hat.',
    });

    const res = await sendIntakeMail(db, {
      to: owner.email,
      subject: texte.subject,
      html,
      template: TEMPLATE,
      meta: { company_id: c.id, decision },
      idempotencyKey: `${TEMPLATE}-${c.id}-${decision}-${c.updated_at}`,
    });
    return json({ sent: res.sent, error: res.error ?? null });
  } catch (e) {
    console.error('company-decision-notify', e instanceof Error ? e.message : e);
    return fail('internal_error', 'Das hat nicht geklappt.');
  }
});
