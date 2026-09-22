import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPublicAppUrl } from './app-url.ts';
import { esc, layout, sendIntakeMail } from './intake-mail.ts';
import { dbError, must } from './recruiter-onboarding-service.ts';
import { noticeRecipients } from './recruiter-signed-notice.ts';
import { bicValid, billingChanges, cleanBilling, ibanValid, type BillingChange } from './recruiter-billing.ts';

export function billingChangedMail(name: string, email: string, changes: BillingChange[], appUrl: string) {
  const who = name.trim() || email;
  const rows = changes.map(c => `<tr><td style="padding:6px 8px 6px 0;color:#6b7280;">${esc(c.label)}</td>`
    + `<td style="padding:6px 8px;">${esc(c.before)}</td><td style="padding:6px 0 6px 8px;"><strong>${esc(c.after)}</strong></td></tr>`).join('');
  const bank = changes.some(c => c.field === 'bank_iban' || c.field === 'bank_bic' || c.field === 'bank_account_holder');
  const contract = changes.some(c => c.field === 'company_name' || c.field === 'company_address' || c.field === 'tax_id');
  const html = layout({
    preheader: `${who} hat Abrechnungsdaten geändert.`,
    heading: 'Abrechnungsdaten geändert',
    body: `<p>${esc(who)}${name.trim() && email ? ` (${esc(email)})` : ''} hat im Profil geändert:</p>`
      + '<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 16px 0;">'
      + '<tr><td></td><td style="padding:0 8px 4px;color:#6b7280;font-size:12px;">vorher</td><td style="padding:0 0 4px 8px;color:#6b7280;font-size:12px;">jetzt</td></tr>'
      + `${rows}</table>`
      + (contract ? '<p>Firma, Anschrift oder Steuerangaben weichen jetzt vom unterschriebenen Vertrag ab. Bitte prüfen, ob der Vertrag angepasst werden muss.</p>' : '')
      + (bank ? '<p>Neue Bankverbindung: vor der nächsten Auszahlung kurz beim Headhunter bestätigen lassen.</p>' : ''),
    cta: { label: 'Recruiterverwaltung öffnen', url: `${appUrl}/admin/recruiters` },
  });
  return { subject: `${who} hat Abrechnungsdaten geändert`, html };
}

type Deps = { mail: typeof sendIntakeMail; appUrl: () => string; recipients: () => string[] };
const liveDeps: Deps = { mail: sendIntakeMail, appUrl: getPublicAppUrl, recipients: () => noticeRecipients() };

/** Abrechnung aus dem Profil speichern und Matchunt über jede Änderung informieren. */
export async function saveBilling(db: SupabaseClient, user: User, input: unknown, deps: Deps = liveDeps) {
  const next = cleanBilling(input);
  must(ibanValid(next.bank_iban), 'Die IBAN stimmt nicht. Bitte prüf sie noch einmal.');
  must(bicValid(next.bank_bic), 'Der BIC stimmt nicht. Er hat 8 oder 11 Zeichen.');
  const { data: role, error: roleError } = await db.from('user_roles').select('user_id').eq('user_id', user.id).eq('role', 'recruiter').maybeSingle();
  dbError(roleError);
  must(role, 'Abrechnungsdaten gibt es nur für Headhunter.', 'not_allowed');
  const { data: current, error } = await db.from('profiles').select('full_name,company_name,company_address,tax_id,bank_account_holder,bank_iban,bank_bic').eq('user_id', user.id).maybeSingle();
  dbError(error);
  must(current, 'Dein Profil wurde nicht gefunden.', 'not_found');
  const changes = billingChanges(current, next);
  if (!changes.length) return { saved: true, changed: [] as string[] };
  const { error: writeError } = await db.from('profiles').update(next).eq('user_id', user.id);
  dbError(writeError);
  // Scheitert die Mail, bleibt die Änderung trotzdem gespeichert.
  try {
    const { subject, html } = billingChangedMail(String(current.full_name ?? ''), user.email ?? '', changes, deps.appUrl());
    for (const to of deps.recipients()) {
      await deps.mail(db, { to, subject, html, template: 'recruiter_billing_changed', replyTo: user.email ?? undefined, meta: { user_id: user.id, fields: changes.map(c => c.field) } });
    }
  } catch (e) {
    console.error('[recruiter-billing] Hinweis an Matchunt nicht verschickt', e instanceof Error ? e.message : e);
  }
  return { saved: true, changed: changes.map(c => c.field) };
}
