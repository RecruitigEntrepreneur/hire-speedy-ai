import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { esc, sendIntakeMail } from './intake-mail.ts';
import { dbError, must } from './recruiter-onboarding-service.ts';
import { cleanExpertise } from './recruiter-expertise.ts';
import {
  cleanChannels, expertiseLine, normalizeNumber, PARTNER_CHANNELS, PARTNER_NUMBER, publicView, signatureHtml, siteDomain, versionAtLeast,
  type Lang, type PartnerChannel, type PartnerStatusRow, type PublicPartner,
} from './recruiter-partner.ts';

/**
 * Partnerstatus auf dem Server. Verliehen wird er bei der Freischaltung nach der
 * Gegenzeichnung (recruiter-activation.ts), nie vom Browser. Der Headhunter ändert nur
 * seine Einwilligungen und meldet, wo er den Status eingerichtet hat; beenden kann ihn
 * nur Matchunt. Die öffentliche Prüfung läuft ohne Anmeldung (partner-check).
 */
export const PARTNER_TABLE = 'recruiter_partner_status';
const HOUR = 3_600_000;

/**
 * Status verleihen, einmal je Konto. Erst ab Vertrag 2.1 (Anlage 6 erlaubt Name und
 * Abzeichen). Die Nummer vergibt die Datenbank; trifft sie zufällig eine vergebene, noch
 * einmal. Wirft nie: Eine fehlende Nummer darf die Freischaltung nicht aufhalten.
 */
export async function grantPartnerStatus(db: SupabaseClient, p: { userId: string; version: unknown; since?: string | null }): Promise<'granted' | 'exists' | 'skipped'> {
  if (!versionAtLeast(p.version)) return 'skipped';
  try {
    const { data: existing, error: readError } = await db.from(PARTNER_TABLE).select('user_id,contract_version').eq('user_id', p.userId).maybeSingle();
    if (readError) throw readError;
    if (existing) {
      // Neuerer Vertrag: Fassung nachziehen, Nummer und „Partner seit“ bleiben.
      if (!versionAtLeast(existing.contract_version, String(p.version))) {
        await db.from(PARTNER_TABLE).update({ contract_version: String(p.version), updated_at: new Date().toISOString() }).eq('user_id', p.userId);
      }
      return 'exists';
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await db.from(PARTNER_TABLE).insert({ user_id: p.userId, contract_version: String(p.version), granted_at: p.since ?? new Date().toISOString() });
      if (!error) return 'granted';
      if (error.code !== '23505') throw error;
      // Doppelt: entweder dasselbe Konto (gleichzeitige Freischaltung) oder eine vergebene Nummer.
      const { data: again } = await db.from(PARTNER_TABLE).select('user_id').eq('user_id', p.userId).maybeSingle();
      if (again) return 'exists';
    }
    throw new Error('Keine freie Partnernummer gefunden');
  } catch (e) {
    console.error('[recruiter-partner] Status nicht verliehen', e instanceof Error ? e.message : e);
    return 'skipped';
  }
}

export async function ownStatus(db: SupabaseClient, userId: string): Promise<PartnerStatusRow> {
  const { data, error } = await db.from(PARTNER_TABLE).select('*').eq('user_id', userId).maybeSingle();
  dbError(error);
  must(data, 'Für dieses Konto gibt es noch keinen Partnerstatus.', 'not_found');
  return data as PartnerStatusRow;
}

/** Einwilligungen und „Ist eingerichtet“ je Stelle. Zeitstempel setzt der Server. */
export async function partnerSettings(db: SupabaseClient, user: User, body: { directory?: unknown; expertise?: unknown; channel?: unknown; done?: unknown }, now = () => Date.now()) {
  const row = await ownStatus(db, user.id);
  must(!row.ended_at, 'Dein Partnerstatus ist beendet.', 'conflict');
  const stamp = new Date(now()).toISOString();
  const patch: Record<string, unknown> = {};
  if (typeof body.directory === 'boolean') patch.directory_consent_at = body.directory ? row.directory_consent_at ?? stamp : null;
  if (typeof body.expertise === 'boolean') patch.show_expertise_at = body.expertise ? row.show_expertise_at ?? stamp : null;
  if (body.channel !== undefined) {
    must(PARTNER_CHANNELS.includes(body.channel as PartnerChannel) && typeof body.done === 'boolean', 'Unbekannte Stelle.');
    const channels = cleanChannels(row.channels);
    if (body.done) channels[body.channel as PartnerChannel] = channels[body.channel as PartnerChannel] ?? stamp;
    else delete channels[body.channel as PartnerChannel];
    patch.channels = channels;
  }
  must(Object.keys(patch).length, 'Nichts zu speichern.');
  const { data, error } = await db.from(PARTNER_TABLE).update({ ...patch, updated_at: stamp }).eq('user_id', user.id).select('*').maybeSingle();
  dbError(error);
  must(data, 'Der Partnerstatus konnte nicht gespeichert werden.', 'upstream_error');
  return data as PartnerStatusRow;
}

/**
 * Öffentliche Prüfung einer Nummer, ohne Anmeldung. Das Website-Abzeichen fragt mit
 * embed=true; dann merkt sich Matchunt nur die Domain der Website (höchstens stündlich),
 * damit der Headhunter im Profil sieht, dass es läuft. Keine IP, kein Cookie.
 */
export async function partnerCheck(db: SupabaseClient, input: { number?: unknown; embed?: unknown }, origin: string | null, now = Date.now()): Promise<PublicPartner> {
  const number = normalizeNumber(input.number);
  if (!PARTNER_NUMBER.test(number)) return { state: 'invalid' };
  const { data, error } = await db.from(PARTNER_TABLE).select('*').eq('partner_number', number).maybeSingle();
  dbError(error);
  if (!data) return { state: 'invalid' };
  const row = data as PartnerStatusRow;
  const site = input.embed === true || input.embed === '1' ? siteDomain(origin) : null;
  if (site && !row.ended_at && (row.website_domain !== site || !row.website_seen_at || now - Date.parse(row.website_seen_at) > HOUR)) {
    const { error: seenError } = await db.from(PARTNER_TABLE).update({ website_domain: site, website_seen_at: new Date(now).toISOString() }).eq('user_id', row.user_id);
    if (seenError) console.error('[recruiter-partner] Website nicht gemerkt', seenError.code);
  }
  if (row.ended_at) return publicView(row, null, now);
  const [{ data: profile, error: pe }, { data: role, error: re }] = await Promise.all([
    db.from('profiles').select('full_name,company_name,recruiter_expertise').eq('user_id', row.user_id).maybeSingle(),
    db.from('user_roles').select('status,verified').eq('user_id', row.user_id).eq('role', 'recruiter').maybeSingle(),
  ]);
  dbError(pe); dbError(re);
  if (!profile || !role) return publicView(row, null, now);
  let expertise: string | null = null;
  if (row.show_expertise_at) {
    let source: unknown = profile.recruiter_expertise;
    if (!source) {
      // Noch nie selbst gepflegt: dann gilt der Stand aus dem Vertrag.
      const { data: c } = await db.from('recruiter_onboarding_cases').select('profile').eq('claimed_by', row.user_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      source = (c?.profile as { expertise?: unknown } | undefined)?.expertise ?? null;
    }
    expertise = source ? expertiseLine(cleanExpertise(source)) || null : null;
  }
  return publicView(row, {
    name: String(profile.full_name ?? '').trim(),
    company: String(profile.company_name ?? '').trim(),
    suspended: role.status === 'suspended' || role.verified !== true,
    expertise,
  }, now);
}

type MailDeps = { mail: typeof sendIntakeMail };
const liveMail: MailDeps = { mail: sendIntakeMail };

/** „Test an mich“: der Signatur-Baustein in einer echten Mail an die eigene Adresse. */
export async function partnerSignatureTest(db: SupabaseClient, user: User, body: { lang?: unknown }, deps: MailDeps = liveMail) {
  const row = await ownStatus(db, user.id);
  must(!row.ended_at, 'Dein Partnerstatus ist beendet.', 'conflict');
  must(user.email, 'Für dieses Konto ist keine E-Mail-Adresse hinterlegt.', 'conflict');
  const { data: profile } = await db.from('profiles').select('full_name,company_name').eq('user_id', user.id).maybeSingle();
  const lang: Lang = body.lang === 'en' ? 'en' : 'de';
  const name = String(profile?.full_name ?? '').trim();
  const company = String(profile?.company_name ?? '').trim();
  const html = '<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#ffffff;">'
    + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;max-width:560px;">'
    + '<p>Hallo,</p><p>so sieht dein Signatur-Baustein in einer echten Mail aus. Er steht unter deiner eigenen Signatur; '
    + 'blockiert ein Mailprogramm Bilder, bleiben Nummer und Prüflink lesbar.</p>'
    + `<p style="margin:24px 0 0 0;">Beste Grüße<br><strong>${esc(name || 'Dein Name')}</strong>${company ? `<br><span style="color:#6b6b6b;">${esc(company)}</span>` : ''}</p>`
    + signatureHtml({ number: row.partner_number, tier: row.tier, lang })
    + '</div></body></html>';
  const result = await deps.mail(db, {
    to: user.email!, subject: 'Test: dein Signatur-Baustein', html,
    template: 'recruiter_partner_signature_test', meta: { user_id: user.id },
  });
  must(result.sent, 'Die Testmail konnte nicht versendet werden. Bitte später erneut versuchen.', 'upstream_error');
  return { sent: true, to: user.email! };
}

/** Matchunt beendet den Status oder stellt ihn wieder her (Recruiterverwaltung). */
export async function setPartnerActive(db: SupabaseClient, body: { user_id?: unknown; active?: unknown }, now = () => Date.now()) {
  must(typeof body.user_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.user_id) && typeof body.active === 'boolean', 'Ungültige Anfrage.');
  const patch = body.active
    ? { ended_at: null, end_reason: null, updated_at: new Date(now()).toISOString() }
    : { ended_at: new Date(now()).toISOString(), end_reason: 'revoked', updated_at: new Date(now()).toISOString() };
  const { data, error } = await db.from(PARTNER_TABLE).update(patch).eq('user_id', body.user_id).select('*').maybeSingle();
  dbError(error);
  must(data, 'Für dieses Konto gibt es keinen Partnerstatus.', 'not_found');
  return data as PartnerStatusRow;
}
