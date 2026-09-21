import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { DocuSignConfig } from './docusign.ts';
import { getPublicAppUrl } from './app-url.ts';
import { esc, layout, sendIntakeMail } from './intake-mail.ts';
import { normalizeEmail, validEmail } from './recruiter-contract-policy.ts';
import { recruiterCounterDeadline } from './recruiter-deadline.ts';
import type { RecruiterEnvelope } from './recruiter-onboarding-service.ts';

/**
 * Mail an Matchunt, sobald die Unterschrift eines Headhunters bestätigt ist:
 * jetzt prüfen, gegenzeichnen, freischalten. DocuSign selbst schreibt Matchunt
 * nicht an, weil die Gegenzeichnung eingebettet im Admin-Bereich läuft.
 *
 * Einmal je Vertrag und Empfänger. Maßgeblich ist eine versendete Zeile in
 * email_events mit metadata.contract_id; scheitert der Versand, holt ihn der
 * nächste Abgleich nach. Bewusst ohne metadata.case_id: Unter dieser Kennung
 * listet die Akte die Mails an den Headhunter, diese hier geht an Matchunt.
 */
export const SIGNED_NOTICE_TEMPLATE = 'recruiter_contract_signed';
/** Empfänger laut Entscheidung vom 21.09.2026; RECRUITER_NOTIFY_EMAIL (mit Komma getrennt) ersetzt ihn. */
const DEFAULT_RECIPIENT = 'marko.benko@bluewater-bridge.de';

type Env = (key: string) => string | undefined;

export function noticeRecipients(env: Env = key => Deno.env.get(key)): string[] {
  const listed = (env('RECRUITER_NOTIFY_EMAIL') ?? '').split(',').map(normalizeEmail).filter(validEmail);
  return listed.length ? [...new Set(listed)] : [DEFAULT_RECIPIENT];
}

const berlin = (time: number, options: Intl.DateTimeFormatOptions) => new Date(time).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', ...options });
const day = (time: number) => berlin(time, { day: '2-digit', month: '2-digit', year: 'numeric' });

export function signedNoticeMail(e: RecruiterEnvelope, input: { approved: boolean; demo: boolean; appUrl: string }) {
  const p = e.snapshot;
  const name = (p.name || p.signer || 'Ein Headhunter').replace(/\s+/g, ' ').trim();
  const signed = Date.parse(e.recruiter_signed_at!);
  // Die Frist endet exklusiv um Mitternacht; genannt wird der letzte volle Tag.
  const lastDay = day(Date.parse(recruiterCounterDeadline(e.recruiter_signed_at!)) - 1);
  const signer = p.signer && p.signer !== p.name ? `<p>Unterschrieben hat ${esc(p.signer)}${p.signerRole ? `, ${esc(p.signerRole)}` : ''}.</p>` : '';
  const html = layout({
    preheader: `Gegenzeichnen bis einschließlich ${lastDay}.`,
    heading: `${name} hat unterschrieben`,
    body: `<p>${esc(name)}${p.company ? ` (${esc(p.company)})` : ''} hat den Recruiter-Rahmenvertrag ${esc(e.package_version)} am ${day(signed)} um ${berlin(signed, { hour: '2-digit', minute: '2-digit' })} Uhr in DocuSign unterschrieben.</p>${signer}`
      + '<p><strong>Jetzt ist Matchunt dran:</strong></p><ol style="margin:0 0 16px 0;padding-left:20px;">'
      + `<li>${input.approved ? 'Angaben prüfen (schon erledigt)' : 'Angaben prüfen und „Prüfung abschließen“'}</li>`
      + '<li>„In DocuSign gegenzeichnen“</li><li>„Freischalten &amp; Zugang senden“</li></ol>'
      + `<p>Gegenzeichnen geht bis einschließlich <strong>${lastDay}</strong>. Danach muss der Vertrag neu vereinbart werden.</p>`
      + (input.demo ? '<p><strong>Achtung:</strong> DocuSign läuft noch in der Demo-Umgebung. Diese Unterschrift ist nicht rechtsverbindlich.</p>' : ''),
    cta: { label: 'Vertrag öffnen', url: `${input.appUrl}/admin/recruiters?contract_return=${encodeURIComponent(e.id)}` },
    footnote: `Gegenzeichnen kann nur ${esc(e.counter_name)} mit dem eigenen Admin-Zugang.`,
  });
  return { subject: `${name} hat unterschrieben – bitte gegenzeichnen`, html };
}

export interface NoticeDeps { mail: typeof sendIntakeMail; env: Env; now: () => number; appUrl: () => string }
const defaults: NoticeDeps = { mail: sendIntakeMail, env: key => Deno.env.get(key), now: () => Date.now(), appUrl: getPublicAppUrl };

/** Wirft nie: Eine fehlende Mail darf den Abgleich mit DocuSign nicht scheitern lassen. */
export async function noticeRecruiterSigned(db: SupabaseClient, e: RecruiterEnvelope, cfg: Pick<DocuSignConfig, 'apiBase'>, deps: Partial<NoticeDeps> = {}) {
  const d = { ...defaults, ...deps };
  try {
    if (e.state !== 'sent' || !e.recruiter_signed_at || e.countersigned_at) return;
    // Nach Fristende sperrt der Server die Gegenzeichnung; eine Aufforderung wäre falsch.
    if (d.now() >= Date.parse(recruiterCounterDeadline(e.recruiter_signed_at))) return;
    const { data: sent, error } = await db.from('email_events').select('to_email')
      .eq('template_name', SIGNED_NOTICE_TEMPLATE).eq('status', 'sent').eq('metadata->>contract_id', e.id);
    if (error) throw error;
    const done = new Set((sent ?? []).map(row => normalizeEmail(String(row.to_email ?? ''))));
    const open = noticeRecipients(d.env).filter(to => !done.has(to));
    if (!open.length) return;
    const { data: c, error: caseError } = await db.from('recruiter_onboarding_cases').select('state,revoked_at').eq('id', e.case_id).maybeSingle();
    if (caseError) throw caseError;
    if (!c || c.revoked_at) return;
    const { subject, html } = signedNoticeMail(e, { approved: c.state === 'approved', demo: /demo\.docusign\.net/i.test(cfg.apiBase), appUrl: d.appUrl() });
    for (const to of open) {
      await d.mail(db, { to, subject, html, template: SIGNED_NOTICE_TEMPLATE,
        idempotencyKey: `recruiter-signed/${e.id}/${to}`, meta: { contract_id: e.id, recruiter_case_id: e.case_id } });
    }
  } catch (err) {
    console.error('[recruiter-signed-notice] Mail nicht versendet', err instanceof Error ? err.message : err);
  }
}
