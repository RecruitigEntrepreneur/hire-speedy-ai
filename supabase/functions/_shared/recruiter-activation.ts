import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPublicAppUrl } from './app-url.ts';
import { esc, layout, sendIntakeMail } from './intake-mail.ts';
import type { OnboardingCase, RecruiterEnvelope } from './recruiter-onboarding-service.ts';
import { issueLoginLink, LOGIN_LINK_DAYS } from './recruiter-login-link.ts';
import { grantPartnerStatus } from './recruiter-partner-service.ts';
import { normLang } from './i18n.ts';
import { welcomeMailTexts } from './recruiter-i18n.ts';

/**
 * Freischaltung eines Headhunters: Recruiter-Rolle verifiziert, Profil mit Name
 * und Firma aus den Vertragsangaben ergänzt, Willkommensmail. Seit 21.09.2026
 * automatisch, sobald beide Unterschriften bestätigt sind (syncEnvelope). Der
 * Admin-Knopf bleibt für den Fall, dass das scheitert, und zum erneuten Senden.
 */
type ActivationCase = Pick<OnboardingCase, 'id' | 'email' | 'claimed_by' | 'profile' | 'language'>;

/** Nur leere Felder füllen. Aus der Code-Anmeldung steht oft nur der Vorname im Profil; ein selbst gepflegter Name bleibt. */
export function profilePatch(current: { full_name?: string | null; company_name?: string | null }, profile: { name?: string; company?: string }) {
  const patch: { full_name?: string; company_name?: string } = {};
  const name = (profile.name ?? '').trim();
  const have = (current.full_name ?? '').trim();
  if (name && (!have || (!/\s/.test(have) && name.toLowerCase().startsWith(`${have.toLowerCase()} `)))) patch.full_name = name;
  const company = (profile.company ?? '').trim();
  if (company && !(current.company_name ?? '').trim()) patch.company_name = company;
  return patch;
}

/**
 * Mit persönlichem Link erkennt die Anmeldeseite den Headhunter und schickt den
 * Code auf Knopfdruck (Entscheidung 21.09.2026). Ohne Link, falls er sich nicht
 * erzeugen ließ, gibt er dort seine Adresse ein.
 */
export function welcomeMail(c: Pick<OnboardingCase, 'profile' | 'language'>, appUrl: string, link: string | null = null) {
  // Sprache des Vorgangs, sonst Deutsch.
  const lang = normLang(c.language);
  const t = welcomeMailTexts(lang, { days: LOGIN_LINK_DAYS });
  const firstName = String(c.profile.name ?? '').trim().split(/\s+/)[0] ?? '';
  const html = layout({
    lang,
    preheader: t.preheader,
    heading: t.heading,
    body: `<p>${t.hello}${firstName ? ' ' + esc(firstName) : ''},</p><p>${t.lead}</p>`
      + `<p><strong>${t.how}</strong></p><ol style="margin:0 0 16px 0;padding-left:20px;">`
      + `<li>${link ? t.stepLink : t.stepAddress}</li>`
      + `<li>${t.stepCode}</li>`
      + `<li>${t.stepPassword}</li></ol>`,
    cta: { label: t.cta, url: `${appUrl}/recruiter/login${link ? `#${link}` : ''}` },
    after: (link ? `<p>${t.linkValid}</p>` : '')
      + `<p>${t.questions}</p><p>${t.regards}</p>`,
    footnote: `<a href="${esc(appUrl)}/impressum">${t.imprint}</a> · <a href="${esc(appUrl)}/datenschutz">${t.privacy}</a>`,
  });
  return { subject: t.subject, html };
}

/** Rolle verifizieren und Profil ergänzen. false, wenn das Konto keine Recruiter-Rolle hat. */
export async function grantRecruiterAccess(db: SupabaseClient, c: ActivationCase): Promise<boolean> {
  const { data: role, error } = await db.from('user_roles').update({ verified: true, status: 'active' })
    .eq('user_id', c.claimed_by).eq('role', 'recruiter').select('user_id').maybeSingle();
  if (error) throw new Error(`Recruiter-Rolle nicht freigeschaltet (${error.code ?? 'db'})`);
  if (!role) return false;
  try {
    const { data: current, error: readError } = await db.from('profiles').select('full_name,company_name').eq('user_id', c.claimed_by).maybeSingle();
    if (readError) throw readError;
    const patch = current ? profilePatch(current, c.profile) : {};
    if (Object.keys(patch).length) {
      const { error: writeError } = await db.from('profiles').update(patch).eq('user_id', c.claimed_by);
      if (writeError) throw writeError;
    }
  } catch (e) {
    // Ein unvollständiges Profil darf die Freischaltung nicht aufhalten.
    console.error('[recruiter-activation] Profil nicht ergänzt', e instanceof Error ? e.message : e);
  }
  // Sprache des Vorgangs ins Profil, wenn dort noch keine steht (eigene Abfrage: die Spalte
  // kommt mit der Migration 20261112120000 und darf vorher nichts aufhalten).
  const lang = normLang(c.language);
  if (lang) {
    try {
      const { error: langError } = await db.from('profiles').update({ language: lang }).eq('user_id', c.claimed_by).is('language', null);
      if (langError) console.warn('[recruiter-activation] Sprache nicht ins Profil übernommen', langError.code ?? '');
    } catch (e) {
      console.warn('[recruiter-activation] Sprache nicht ins Profil übernommen', e instanceof Error ? e.message : e);
    }
  }
  return true;
}

export interface WelcomeDeps { mail: typeof sendIntakeMail; appUrl: () => string; issueLink?: typeof issueLoginLink }
const liveWelcomeDeps: WelcomeDeps = { mail: sendIntakeMail, appUrl: getPublicAppUrl, issueLink: issueLoginLink };

export async function sendWelcomeMail(db: SupabaseClient, c: ActivationCase, opts: { replyTo?: string; idempotencyKey?: string } = {},
  deps: WelcomeDeps = liveWelcomeDeps) {
  // Ohne Link geht die Mail trotzdem raus, dann mit der allgemeinen Anmeldeseite.
  const link = c.claimed_by ? await (deps.issueLink ?? issueLoginLink)(db, c.claimed_by).catch(e => {
    console.error('[recruiter-activation] Anmeldelink nicht erzeugt', e instanceof Error ? e.message : e);
    return null;
  }) : null;
  const { subject, html } = welcomeMail(c, deps.appUrl(), link);
  return deps.mail(db, { to: c.email, subject, html, template: 'recruiter_onboarding_activation', replyTo: opts.replyTo,
    idempotencyKey: opts.idempotencyKey, meta: { case_id: c.id } });
}

/** Nach der Gegenzeichnung: freischalten und begrüßen, einmal je Vorgang. Wirft nie. */
export async function autoActivateRecruiter(db: SupabaseClient, e: RecruiterEnvelope, deps: WelcomeDeps = liveWelcomeDeps) {
  if (e.state !== 'completed') return;
  try {
    const { data: c, error } = await db.from('recruiter_onboarding_cases').select('*').eq('id', e.case_id).maybeSingle();
    if (error) throw error;
    if (!c || c.state !== 'approved' || c.revoked_at || !c.claimed_by) return;
    const { data: role, error: roleError } = await db.from('user_roles').select('verified').eq('user_id', c.claimed_by).eq('role', 'recruiter').maybeSingle();
    if (roleError) throw roleError;
    if (!role) return;
    const wasActive = role.verified === true;
    if (!wasActive && !await grantRecruiterAccess(db, c as OnboardingCase)) return;
    // Partnerstatus ab Vertrag 2.1, auch für ein Konto, das schon frei war und jetzt 2.1 unterschreibt.
    await grantPartnerStatus(db, { userId: c.claimed_by, version: e.package_version, since: e.countersigned_at });
    // Schon frei, etwa ein bestehendes Konto mit neuem Vertrag oder ein schnellerer Admin-Klick: keine zweite Begrüßung.
    if (wasActive) return;
    await sendWelcomeMail(db, c as OnboardingCase, { replyTo: e.counter_email, idempotencyKey: `recruiter-activation/${c.id}` }, deps);
  } catch (err) {
    console.error('[recruiter-activation] Automatische Freischaltung fehlgeschlagen', err instanceof Error ? err.message : err);
  }
}
