import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPublicAppUrl } from './app-url.ts';
import { esc, layout, sendIntakeMail } from './intake-mail.ts';
import { issueLoginLink, LOGIN_LINK_DAYS } from './recruiter-login-link.ts';
import { CLIENT_LINK_KEY } from './client-code.ts';

/**
 * Zugang des Kunden nach der Gegenzeichnung (Entscheidung 25.09.2026).
 *
 * Sobald Matchunt gegengezeichnet hat, bekommt der Kunde EINE Mail: Seine
 * Position ist auf Matchunt, hier ist sein Zugang, „Jetzt loslegen“. Der Knopf
 * führt mit persönlichem Link auf /anmelden (client-code.ts): Begrüßung, Code,
 * beim ersten Mal Passwort, Dashboard.
 *
 * Für neue UND bestehende Konten. Vorher bekam nur ein neu angelegtes Konto
 * einen Link, und der galt eine Stunde. Ein bestehendes Konto bekam „Zum
 * Dashboard“ und stand ohne Passwort vor der Anmeldeseite (Live-Fall
 * Kanna Medics, 25.09.2026).
 */

export const CLIENT_ACCESS_TEMPLATE = 'client_access';

export interface AccessMailArgs {
  name: string | null;
  title: string;
  mandateNumber: string | null;
  email: string;
  /** Beidseitig unterzeichnet; false nur bei Aufträgen ohne Unterschriftslauf. */
  signed: boolean;
}

export function clientAccessMail(a: AccessMailArgs, appUrl: string, link: string | null) {
  const auftrag = a.mandateNumber ? ` ${esc(a.mandateNumber)}` : '';
  const html = layout({
    preheader: 'Ihr Zugang ist bereit. Ein Klick, dann sind Sie in Ihrem Dashboard.',
    heading: 'Ihre Position ist auf Matchunt',
    body: `<p style="margin:0 0 16px 0;">Guten Tag${a.name ? ' ' + esc(a.name) : ''},</p>
      <p style="margin:0 0 16px 0;">${a.signed
        ? `Ihr Auftrag${auftrag} ist beidseitig unterzeichnet.`
        : `wir haben Ihren Auftrag${auftrag} angenommen.`}
        Ihre Position <strong>${esc(a.title)}</strong> liegt jetzt in Ihrem Matchunt-Bereich.
        Wir prüfen sie noch einmal und geben sie dann für unsere Recruiter frei.</p>
      <p style="margin:0 0 16px 0;padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
        Ihr Zugang: <strong>${esc(a.email)}</strong></p>`,
    cta: { label: 'Jetzt loslegen', url: `${appUrl}/anmelden${link ? `#${link}` : ''}` },
    after: (link
        ? `<p>Der Link ist persönlich und ${LOGIN_LINK_DAYS} Tage gültig. Beim Öffnen senden wir Ihnen einen Anmeldecode an diese Adresse.</p>`
        : '<p>Auf der Seite geben Sie Ihre Adresse ein, wir senden Ihnen einen Anmeldecode.</p>')
      + '<p>Bei Fragen antworten Sie einfach auf diese Mail.</p><p>Viele Grüße<br>Ihr Matchunt-Team</p>',
    footnote: `<a href="${esc(appUrl)}/impressum">Impressum</a> · <a href="${esc(appUrl)}/datenschutz">Datenschutz</a>`,
  });
  return { subject: 'Ihre Position ist auf Matchunt – jetzt loslegen', html };
}

/** Konto zu einer Adresse, mit allen Rollen. Headhunter und Kunde teilen sich keine Adresse. */
export async function accountForEmail(db: SupabaseClient, email: string): Promise<{ userId: string; roles: string[] } | null> {
  const { data: profile } = await db.from('profiles').select('user_id')
    .ilike('email', email.replace(/[\\%_]/g, m => `\\${m}`)).limit(1).maybeSingle();
  if (!profile?.user_id) return null;
  const { data: roles } = await db.from('user_roles').select('role').eq('user_id', profile.user_id);
  return { userId: profile.user_id as string, roles: (roles ?? []).map((r: { role: string }) => r.role) };
}

/** Die jüngste Zugangsmail zu einem Auftrag, falls es eine gibt. */
export async function lastAccessMail(db: SupabaseClient, mandateId: string) {
  const { data } = await db.from('email_events').select('created_at,status,error_message,to_email')
    .eq('template_name', CLIENT_ACCESS_TEMPLATE).eq('metadata->>mandate_id', mandateId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data as { created_at: string; status: string; error_message: string | null; to_email: string } | null;
}

export interface AccessDeps { mail: typeof sendIntakeMail; appUrl: () => string; issueLink: typeof issueLoginLink }
const liveAccessDeps: AccessDeps = { mail: sendIntakeMail, appUrl: getPublicAppUrl, issueLink: issueLoginLink };

/**
 * Zugangsmail senden, einmal je Auftrag. `resend` ist der Admin-Knopf
 * „Zugangsmail erneut senden“: neuer Link, neue Mail. Wirft nie.
 */
export async function sendClientAccess(db: SupabaseClient, a: AccessMailArgs & {
  userId: string; mandateId: string; draftId: string; jobId: string | null; replyTo?: string;
}, opts: { resend?: boolean } = {}, deps: AccessDeps = liveAccessDeps): Promise<{ sent: boolean; already?: boolean; error?: string }> {
  try {
    if (!opts.resend) {
      const last = await lastAccessMail(db, a.mandateId);
      if (last?.status === 'sent') return { sent: false, already: true };
    }
    // Ohne Link geht die Mail trotzdem raus; dann gibt der Kunde auf /anmelden seine Adresse ein.
    const link = await deps.issueLink(db, a.userId, Date.now(), CLIENT_LINK_KEY).catch((e) => {
      console.error('[client-access] Anmeldelink nicht erzeugt', e instanceof Error ? e.message : e);
      return null;
    });
    const { subject, html } = clientAccessMail(a, deps.appUrl(), link);
    const result = await deps.mail(db, {
      to: a.email, subject, html, template: CLIENT_ACCESS_TEMPLATE, replyTo: a.replyTo,
      meta: { draft_id: a.draftId, mandate_id: a.mandateId, job_id: a.jobId, user_id: a.userId, resend: opts.resend === true },
    });
    return { sent: result.sent, error: result.error };
  } catch (e) {
    console.error('[client-access] Zugangsmail fehlgeschlagen', e instanceof Error ? e.message : e);
    return { sent: false, error: e instanceof Error ? e.message : 'unbekannt' };
  }
}

/**
 * Der Kunde wartet, aber sein Zugang kam nicht an: Matchunt bekommt Bescheid.
 * Glocke und Mail an Betreuer und Admins, einmal je Aufnahme und Anlass. Wirft nie.
 *
 *   held    Die Adresse gehört zu einem Headhunter-Konto: nichts still anlegen
 *           oder verschicken, Matchunt entscheidet.
 *   failed  Die automatische Zugangsmail nach der Gegenzeichnung ging nicht raus.
 *           Scheitert der Versand an Resend selbst, erreicht auch diese Mail
 *           niemanden; die Glocke erscheint trotzdem.
 */
export type AccessProblem = { kind: 'held' } | { kind: 'failed'; error?: string };

export async function notifyAccessProblem(db: SupabaseClient, draft: Record<string, any>, problem: AccessProblem,
  deps: Pick<AccessDeps, 'mail' | 'appUrl'> = liveAccessDeps) {
  try {
    const type = problem.kind === 'held' ? 'client_access_held' : 'client_access_failed';
    const { data: schon } = await db.from('notifications').select('id')
      .eq('type', type).eq('related_id', draft.id).limit(1);
    if (schon?.length) return;
    const firma = draft.company_legal_name || draft.company_name || 'Unbekannte Firma';
    const grund = problem.kind === 'failed' ? (problem.error || 'unbekannter Fehler') : '';
    const titel = problem.kind === 'held' ? 'Kundenzugang angehalten' : 'Zugangsmail nicht zugestellt';
    const empfaenger = new Set<string>();
    if (draft.owner_user_id) empfaenger.add(draft.owner_user_id);
    const { data: admins } = await db.from('user_roles').select('user_id').eq('role', 'admin').limit(10);
    (admins ?? []).forEach((r: { user_id: string }) => empfaenger.add(r.user_id));
    if (!empfaenger.size) return;
    await db.from('notifications').insert([...empfaenger].map((user_id) => ({
      user_id,
      type,
      title: titel,
      message: problem.kind === 'held'
        ? `${firma} · ${draft.contact_email} ist als Headhunter registriert`
        : `${firma} · ${draft.contact_email} · ${grund}`,
      related_type: 'intake_draft',
      related_id: draft.id,
    })));
    const { data: profiles } = await db.from('profiles').select('email').in('user_id', [...empfaenger]);
    const url = `${deps.appUrl()}/admin/intakes/${draft.id}`;
    const body = problem.kind === 'held'
      ? `<p style="margin:0 0 16px 0;">Der Vertrag mit <strong>${esc(firma)}</strong> ist gegengezeichnet.
          Die Adresse <strong>${esc(draft.contact_email)}</strong> gehört aber zu einem Headhunter-Konto.
          Deshalb ist noch kein Kundenzugang angelegt und keine Mail an den Kunden rausgegangen.</p>
        <p style="margin:0 0 16px 0;">In der Aufnahme unter „Zugang des Kunden“ das Konto als Kunde umstellen,
          dann geht die Zugangsmail automatisch raus.</p>`
      : `<p style="margin:0 0 16px 0;">Der Vertrag mit <strong>${esc(firma)}</strong> ist gegengezeichnet,
          aber die Zugangsmail an <strong>${esc(draft.contact_email)}</strong> ging nicht raus
          (${esc(grund)}). Der Kunde wartet auf seinen Zugang.</p>
        <p style="margin:0 0 16px 0;">In der Aufnahme unter „Zugang des Kunden“ die Zugangsmail erneut senden.</p>`;
    for (const p of profiles ?? []) {
      if (!p.email) continue;
      await deps.mail(db, {
        to: p.email,
        subject: `${titel}: ${firma}`,
        template: problem.kind === 'held' ? 'client_access_held_admin' : 'client_access_failed_admin',
        meta: { draft_id: draft.id },
        html: layout({
          preheader: `${firma} wartet auf den Zugang.`,
          heading: titel,
          body,
          cta: { label: 'Aufnahme öffnen', url },
        }),
      });
    }
  } catch (e) {
    console.warn('[client-access] Meldung an Matchunt fehlgeschlagen:', e instanceof Error ? e.message : e);
  }
}
