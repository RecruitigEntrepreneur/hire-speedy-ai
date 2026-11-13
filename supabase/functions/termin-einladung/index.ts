// deno-lint-ignore-file no-explicit-any
/**
 * termin-einladung – Headhunter lädt einen Kandidaten aus der Akte zum eigenen Gespräch ein (01.11.2026).
 *
 * Aktionen (body.action), nur für den Headhunter des Kandidaten:
 *   senden        { candidate_id, arten, weg, text } → neue Einladung; weg 'mail' verschickt sie, 'selbst' liefert den Link
 *   link          { candidate_id }                   → neuer persönlicher Link, gleiche Gesprächsart
 *   erinnern      { candidate_id }                   → Erinnerungs-Mail, höchstens einmal in 24 Stunden
 *   zurueckziehen { candidate_id }                   → alle offenen Links des Kandidaten schließen
 *
 * Lebenslauf anfragen (05.11.2026):
 *   senden { …, lebenslauf: true }                     → Anfrage zur Einladung, Hochladen auf der Einladungsseite
 *   lebenslauf_anfragen { candidate_id, weg, text }    → Anfrage ohne Termin, eigener Link /t/lebenslauf/<token>
 *   lebenslauf_erinnern { candidate_id }               → Erinnerungs-Mail mit neuem Link, höchstens einmal in 24 Stunden
 *
 * Der Link enthält nur eine Zufallsnummer. In der Datenbank liegt der Hash, den Klartext
 * bekommt nur der Headhunter (zum Kopieren) oder der Kandidat (per Mail).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fail, json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { checkLimits, LIMITS } from '../_shared/intake-limits.ts';
import { generateToken, hashToken } from '../_shared/tokens.ts';
import { getPublicAppUrl } from '../_shared/app-url.ts';
import { sendInterviewMail } from '../_shared/interview-mailer.ts';
import { kandidatEinladung, lebenslaufAnfrage } from '../_shared/termin-mails.ts';
import { candidateLanguage } from '../_shared/recipient-language.ts';
import { viaMatchunt } from '../_shared/mail-i18n.ts';

const FROM_EMAIL = () => Deno.env.get('INTERVIEW_FROM_EMAIL') ?? 'termine@matchunt.ai';
const GUELTIG_TAGE = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 86_400_000;

class Fehler extends Error {
  constructor(public grund: Parameters<typeof fail>[0], meldung: string) { super(meldung); }
}
function muss(bedingung: unknown, grund: Parameters<typeof fail>[0], meldung: string): asserts bedingung {
  if (!bedingung) throw new Fehler(grund, meldung);
}

async function angemeldet(req: Request) {
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
  });
  const { data } = await client.auth.getUser();
  return data.user ?? null;
}

/** Nur der eigene Kandidat, nur mit eingerichteter und aktiver Terminseite. */
async function kontext(db: any, userId: string, candidateId: unknown) {
  const k = await kontextKandidat(db, userId, candidateId);
  const { data: page } = await db.from('recruiter_booking_pages').select('active').eq('recruiter_id', userId).maybeSingle();
  muss(page?.active, 'not_allowed', 'Richte zuerst deine Terminseite ein, dann kannst du einladen.');
  return k;
}

/** Nur der eigene Kandidat; ohne Terminseite (Lebenslauf anfragen geht auch ohne). */
async function kontextKandidat(db: any, userId: string, candidateId: unknown) {
  muss(typeof candidateId === 'string' && UUID.test(candidateId), 'invalid_request', 'Welcher Kandidat?');
  const { data: kand } = await db.from('candidates').select('id, full_name, email').eq('id', candidateId).eq('recruiter_id', userId).maybeSingle();
  muss(kand, 'not_allowed', 'Dieser Kandidat gehört nicht zu dir.');
  const { data: prof } = await db.from('profiles').select('full_name, email').eq('user_id', userId).maybeSingle();
  const name = String(prof?.full_name ?? '').trim() || 'Dein Headhunter';
  // Mails an den Kandidaten in der Sprache seines Headhunters (Mehrsprachigkeit, 13.11.2026)
  const lang = await candidateLanguage(db, userId);
  return { kand, name, vorname: name.split(/\s+/)[0], email: (prof?.email ?? null) as string | null, lang };
}

async function neueZeile(db: any, userId: string, candidateId: string, arten: string[], weg: 'mail' | 'selbst') {
  const token = generateToken();
  const { data, error } = await db.from('candidate_invites').insert({
    recruiter_id: userId, candidate_id: candidateId, arten, weg, token_hash: await hashToken(token),
    expires_at: new Date(Date.now() + GUELTIG_TAGE * DAY).toISOString(),
  }).select('id').single();
  muss(!error && data, 'internal_error', 'Die Einladung konnte nicht angelegt werden.');
  return { id: data.id as string, token };
}

async function mailen(db: any, k: Awaited<ReturnType<typeof kontext>>, zeile: { id: string; token: string }, text: string, erinnerung: boolean) {
  const mail = kandidatEinladung({ hhName: k.name, text, url: `${getPublicAppUrl()}/t/einladung/${zeile.token}`, erinnerung, lang: k.lang });
  const r = await sendInterviewMail({
    fromEmail: FROM_EMAIL(), fromName: viaMatchunt(k.name, k.lang), to: k.kand.email, replyTo: k.email ?? undefined,
    subject: mail.subject, html: mail.html, text: mail.text,
  });
  if (!r.sent) {
    // Nicht versendet: keine offene Einladung stehen lassen, die Karte würde „eingeladen“ zeigen.
    console.error('termin-einladung mail', r.error);
    await db.from('candidate_invites').delete().eq('id', zeile.id);
    throw new Fehler('upstream_error', 'Die Mail konnte nicht verschickt werden. Versuch es gleich noch einmal oder schick den Link selbst.');
  }
  await db.from('candidate_invites').update({ sent_at: new Date().toISOString() }).eq('id', zeile.id);
}

async function offeneLinks(db: any, candidateId: string) {
  const { data } = await db.from('candidate_invites').select('id, arten, weg, sent_at, created_at')
    .eq('candidate_id', candidateId).is('booked_at', null).is('revoked_at', null).gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  return (data ?? []) as any[];
}

async function senden(db: any, userId: string, body: any) {
  const k = await kontext(db, userId, body.candidate_id);
  const arten = Array.isArray(body.arten) ? [...new Set(body.arten.filter((a: unknown) => a === 'teams' || a === 'phone'))] as string[] : [];
  muss(arten.length > 0, 'invalid_request', 'Was bietest du an: Teams oder Telefon?');
  const weg = body.weg === 'mail' ? 'mail' : 'selbst';
  if (weg === 'mail') {
    muss(k.kand.email, 'invalid_request', 'In der Akte steht keine E-Mail. Trag sie ein oder schick den Link selbst.');
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, 3000) : '';
    muss(text, 'invalid_request', 'Bitte schreib kurz, worum es geht.');
    const grenze = await checkLimits(db, LIMITS.terminEinladen(userId));
    muss(grenze.allowed, 'rate_limited', 'Du hast heute schon viele Einladungen verschickt. Morgen geht es weiter.');
    const zeile = await neueZeile(db, userId, k.kand.id, arten, 'mail');
    await mailen(db, k, zeile, text, false);
    if (body.lebenslauf === true) await anfrageZurEinladung(db, userId, k.kand.id, zeile.id);
    return json({ ok: true, id: zeile.id, token: zeile.token });
  }
  const zeile = await neueZeile(db, userId, k.kand.id, arten, 'selbst');
  if (body.lebenslauf === true) await anfrageZurEinladung(db, userId, k.kand.id, zeile.id);
  return json({ ok: true, id: zeile.id, token: zeile.token });
}

// ---------------------------------------------------------------------------
// Lebenslauf anfragen (05.11.2026)
// ---------------------------------------------------------------------------

async function offeneAnfrage(db: any, candidateId: string) {
  const { data } = await db.from('cv_requests').select('*').eq('candidate_id', candidateId)
    .is('fulfilled_at', null).is('revoked_at', null).order('created_at', { ascending: false }).limit(1);
  return (data?.[0] ?? null) as any;
}

/** Mit der Einladung angefragt: Hochgeladen wird auf der Einladungsseite, ein eigener Link entsteht erst beim Erinnern. */
async function anfrageZurEinladung(db: any, userId: string, candidateId: string, inviteId: string) {
  const offen = await offeneAnfrage(db, candidateId);
  if (offen) { await db.from('cv_requests').update({ invite_id: inviteId }).eq('id', offen.id); return; }
  await db.from('cv_requests').insert({ recruiter_id: userId, candidate_id: candidateId, invite_id: inviteId, weg: 'einladung', sent_at: new Date().toISOString() });
}

/** Neuer Link für eine Anfrage: alter Link gilt nicht mehr, der neue 30 Tage. */
async function neuerAnfrageLink(db: any, id: string) {
  const token = generateToken();
  await db.from('cv_requests').update({ token_hash: await hashToken(token), expires_at: new Date(Date.now() + GUELTIG_TAGE * DAY).toISOString() }).eq('id', id);
  return token;
}

async function anfrageMailen(k: Awaited<ReturnType<typeof kontextKandidat>>, token: string, text: string, erinnerung: boolean) {
  const mail = lebenslaufAnfrage({ hhName: k.name, text, url: `${getPublicAppUrl()}/t/lebenslauf/${token}`, erinnerung, lang: k.lang });
  const r = await sendInterviewMail({
    fromEmail: FROM_EMAIL(), fromName: viaMatchunt(k.name, k.lang), to: k.kand.email, replyTo: k.email ?? undefined,
    subject: mail.subject, html: mail.html, text: mail.text,
  });
  if (!r.sent) {
    console.error('termin-einladung lebenslauf mail', r.error);
    throw new Fehler('upstream_error', 'Die Mail konnte nicht verschickt werden. Versuch es gleich noch einmal oder schick den Link selbst.');
  }
}

async function lebenslaufAnfragen(db: any, userId: string, body: any) {
  const k = await kontextKandidat(db, userId, body.candidate_id);
  const weg = body.weg === 'mail' ? 'mail' : 'selbst';
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 3000) : '';
  if (weg === 'mail') {
    muss(k.kand.email, 'invalid_request', 'In der Akte steht keine E-Mail. Trag sie ein oder schick den Link selbst.');
    muss(text, 'invalid_request', 'Bitte schreib kurz, worum es geht.');
    const grenze = await checkLimits(db, LIMITS.terminEinladen(userId));
    muss(grenze.allowed, 'rate_limited', 'Du hast heute schon viele Mails verschickt. Morgen geht es weiter.');
  }
  const offen = await offeneAnfrage(db, k.kand.id);
  const id = offen?.id ?? (await db.from('cv_requests').insert({ recruiter_id: userId, candidate_id: k.kand.id, weg }).select('id').single()).data?.id;
  muss(id, 'internal_error', 'Die Anfrage konnte nicht angelegt werden.');
  const token = await neuerAnfrageLink(db, id);
  if (weg === 'mail') {
    await anfrageMailen(k, token, text, false);
    await db.from('cv_requests').update({ sent_at: new Date().toISOString() }).eq('id', id);
  }
  return json({ ok: true, id, token });
}

async function lebenslaufErinnern(db: any, userId: string, body: any) {
  const k = await kontextKandidat(db, userId, body.candidate_id);
  muss(k.kand.email, 'invalid_request', 'In der Akte steht keine E-Mail. Schick den Link selbst.');
  const offen = await offeneAnfrage(db, k.kand.id);
  muss(offen, 'not_found', 'Es gibt keine offene Anfrage mehr.');
  const zuletzt = [offen.reminded_at, offen.sent_at].map((t) => Date.parse(t ?? '')).filter((t) => !Number.isNaN(t)).sort((a, b) => b - a)[0];
  muss(!zuletzt || Date.now() - zuletzt >= DAY, 'conflict', 'Die letzte Mail ging erst heute raus. Erinnern geht morgen wieder.');
  const grenze = await checkLimits(db, LIMITS.terminEinladen(userId));
  muss(grenze.allowed, 'rate_limited', 'Du hast heute schon viele Mails verschickt. Morgen geht es weiter.');
  const vorname = String(k.kand.full_name ?? '').trim().split(/\s+/)[0] || 'du';
  const text = `Hallo ${vorname},\n\nkurze Erinnerung: Lädst du mir noch deinen Lebenslauf hoch? Das dauert eine Minute:\n\n[Link]\n\nViele Grüße\n${k.vorname}`;
  const token = await neuerAnfrageLink(db, offen.id);
  await anfrageMailen(k, token, text, true);
  await db.from('cv_requests').update({ reminded_at: new Date().toISOString() }).eq('id', offen.id);
  return json({ ok: true });
}

async function neuerLink(db: any, userId: string, body: any) {
  const k = await kontext(db, userId, body.candidate_id);
  const offen = await offeneLinks(db, k.kand.id);
  muss(offen.length, 'not_found', 'Es gibt keine offene Einladung mehr.');
  const zeile = await neueZeile(db, userId, k.kand.id, offen[0].arten, 'selbst');
  return json({ ok: true, id: zeile.id, token: zeile.token });
}

async function erinnern(db: any, userId: string, body: any) {
  const k = await kontext(db, userId, body.candidate_id);
  muss(k.kand.email, 'invalid_request', 'In der Akte steht keine E-Mail. Schick den Link selbst.');
  const offen = await offeneLinks(db, k.kand.id);
  muss(offen.length, 'not_found', 'Es gibt keine offene Einladung mehr.');
  const zuletzt = offen.map((o) => Date.parse(o.sent_at ?? '')).filter((t) => !Number.isNaN(t)).sort((a, b) => b - a)[0];
  muss(!zuletzt || Date.now() - zuletzt >= DAY, 'conflict', 'Die letzte Mail ging erst heute raus. Erinnern geht morgen wieder.');
  const grenze = await checkLimits(db, LIMITS.terminEinladen(userId));
  muss(grenze.allowed, 'rate_limited', 'Du hast heute schon viele Einladungen verschickt. Morgen geht es weiter.');
  const vorname = String(k.kand.full_name ?? '').trim().split(/\s+/)[0] || 'du';
  const text = `Hallo ${vorname},\n\nkurze Erinnerung an meine Einladung. Such dir einfach eine Zeit aus, die dir passt:\n\n[Link]\n\nViele Grüße\n${k.vorname}`;
  const zeile = await neueZeile(db, userId, k.kand.id, offen[0].arten, 'mail');
  await mailen(db, k, zeile, text, true);
  return json({ ok: true });
}

async function zurueckziehen(db: any, userId: string, body: any) {
  const k = await kontext(db, userId, body.candidate_id);
  await db.from('candidate_invites').update({ revoked_at: new Date().toISOString() })
    .eq('candidate_id', k.kand.id).is('booked_at', null).is('revoked_at', null);
  return json({ ok: true });
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return fail('invalid_request', 'Nur POST.');
  try {
    const user = await angemeldet(req);
    if (!user) return fail('not_allowed', 'Bitte melde dich an.');
    const db = serviceClient();
    const { data: istRecruiter } = await db.rpc('has_role', { _user_id: user.id, _role: 'recruiter' });
    if (!istRecruiter) return fail('not_allowed', 'Nur für Headhunter.');
    const body = await req.json().catch(() => ({}));
    switch (String(body?.action ?? '')) {
      case 'senden': return await senden(db, user.id, body);
      case 'link': return await neuerLink(db, user.id, body);
      case 'erinnern': return await erinnern(db, user.id, body);
      case 'zurueckziehen': return await zurueckziehen(db, user.id, body);
      case 'lebenslauf_anfragen': return await lebenslaufAnfragen(db, user.id, body);
      case 'lebenslauf_erinnern': return await lebenslaufErinnern(db, user.id, body);
      default: return fail('invalid_request', 'Unbekannte Aktion.');
    }
  } catch (e) {
    if (e instanceof Fehler) return fail(e.grund, e.message);
    console.error('termin-einladung', e instanceof Error ? e.message : e);
    return fail('internal_error', 'Das hat gerade nicht geklappt. Versuch es gleich noch einmal.');
  }
});
