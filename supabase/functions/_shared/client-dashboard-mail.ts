import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPublicAppUrl } from './app-url.ts';
import { esc, layout, sendIntakeMail } from './intake-mail.ts';
import { issueLoginLink, LOGIN_LINK_DAYS } from './recruiter-login-link.ts';
import { CLIENT_LINK_KEY } from './client-code.ts';
import { accountForEmail } from './client-access.ts';
import { attachClientToDraft, createClientAccount } from './client-account.ts';
import type { Lang } from './i18n.ts';
import { clientDashboardMailTexts } from './intake-i18n.ts';
import { customerMailLanguage, seedProfileLanguage } from './intake-language.ts';

/**
 * Mail an die Kontaktperson, sobald der Rahmenvertrag vom Kunden unterschrieben ist
 * (Entscheidung 30.10.2026). Ihr Weg ins Dashboard ohne Passwort: wenn sie das Fenster
 * geschlossen hat, wenn jemand anderes unterschrieben hat, für jeden späteren Besuch.
 * Die Mail nach der Gegenzeichnung (client-access.ts) bleibt daneben bestehen.
 *
 * Der Vertrag ist ein Rahmenvertrag und gilt für alle Positionen, die Stelle wird
 * deshalb nur als erste Position genannt (Wunsch Marko, 31.10.2026).
 */
export const CLIENT_DASHBOARD_TEMPLATE = 'client_dashboard_ready';

const P = 'style="margin:0 0 16px 0;"';

export function clientDashboardMail(a: { name: string | null; title: string | null; signerName: string | null; lang?: Lang | null }, appUrl: string, link: string | null) {
  const text = clientDashboardMailTexts(a.lang, { days: LOGIN_LINK_DAYS });
  const position = a.title?.trim() ? text.positionNamed(`<strong>${esc(a.title.trim())}</strong>`) : text.position;
  const html = layout({
    lang: a.lang,
    preheader: text.preheader,
    heading: text.heading,
    body: `<p ${P}>${text.hello}${a.name ? ' ' + esc(a.name) : ''},</p>
      <p ${P}>${a.signerName ? text.signedBy(esc(a.signerName)) : text.signed}</p>
      <p ${P}>${text.next(position)}</p>
      <p ${P}>${text.status}</p>`,
    cta: { label: text.cta, url: `${appUrl}/anmelden${link ? `#${link}` : ''}` },
    after: `<p>${link ? text.withLink : text.withoutLink}</p>`
      + `<p>${text.questions}</p><p>${text.regards}</p>`,
    footnote: `<a href="${esc(appUrl)}/impressum">${text.imprint}</a> · <a href="${esc(appUrl)}/datenschutz">${text.privacy}</a>`,
  });
  return { subject: text.subject, html };
}

export interface DashboardMailDeps { mail: typeof sendIntakeMail; appUrl: () => string; issueLink: typeof issueLoginLink }
const liveDeps: DashboardMailDeps = { mail: sendIntakeMail, appUrl: getPublicAppUrl, issueLink: issueLoginLink };

/** Einmal je Auftrag. Wirft nie: Eine fehlende Mail darf die Unterschrift nicht kippen. */
export async function noticeClientDashboardReady(db: SupabaseClient,
  args: { mandateId: string; draftId: string | null; signerEmail: string | null; signerName: string | null },
  deps: DashboardMailDeps = liveDeps) {
  try {
    if (!args.draftId) return;
    const { data: sent } = await db.from('email_events').select('id')
      .eq('template_name', CLIENT_DASHBOARD_TEMPLATE).eq('status', 'sent').eq('metadata->>mandate_id', args.mandateId).limit(1);
    if (sent?.length) return;
    const { data: draft } = await db.from('intake_drafts').select('*').eq('id', args.draftId).maybeSingle();
    const email = String(draft?.contact_email ?? '').trim().toLowerCase();
    if (!draft || !email || draft.identity_state !== 'email_verified') return;
    // Adresse eines Headhunters oder Admins: nichts still übernehmen. Matchunt erfährt es bei der Gegenzeichnung.
    const account = await accountForEmail(db, email);
    if (account && !account.roles.includes('client')) return;
    const userId = account?.userId ?? await createClientAccount(db, draft);
    await attachClientToDraft(db, draft, userId);
    const lang = await customerMailLanguage(db, draft);
    await seedProfileLanguage(db, userId, lang);
    const link = await deps.issueLink(db, userId, Date.now(), CLIENT_LINK_KEY).catch((e) => {
      console.error('[client-dashboard-mail] Anmeldelink nicht erzeugt', e instanceof Error ? e.message : e);
      return null;
    });
    const fremd = args.signerEmail && args.signerEmail.trim().toLowerCase() !== email ? args.signerName : null;
    const { subject, html } = clientDashboardMail({ name: draft.contact_name ?? null, title: draft.title ?? null, signerName: fremd, lang }, deps.appUrl(), link);
    await deps.mail(db, { to: email, subject, html, template: CLIENT_DASHBOARD_TEMPLATE,
      idempotencyKey: `client-dashboard/${args.mandateId}`,
      meta: { draft_id: args.draftId, mandate_id: args.mandateId, user_id: userId } });
  } catch (e) {
    console.error('[client-dashboard-mail] Mail nicht versendet', e instanceof Error ? e.message : e);
  }
}
