import { normLang, baseLang, swiss, tr, intlLocale } from '../functions/_shared/i18n.ts';
import { localizeMessage, codeMailTexts, invitationMailTexts, TRANSLATED_MESSAGES } from '../functions/_shared/recruiter-i18n.ts';
import { cleanLinkInput, cleanLinkKey, linkCounts, linkUsable, openPublicLink, setCaseLanguage } from '../functions/_shared/recruiter-language.ts';
import { sendCode, peekCase, type CodeDeps } from '../functions/_shared/recruiter-code.ts';
import { beginRecruiterCase } from '../functions/_shared/recruiter-entry.ts';
import { welcomeMail } from '../functions/_shared/recruiter-activation.ts';
import { layout } from '../functions/_shared/intake-mail.ts';
import { LIMITS, type LimitResult } from '../functions/_shared/intake-limits.ts';
import { hashToken } from '../functions/_shared/tokens.ts';
import type { OnboardingCase } from '../functions/_shared/recruiter-onboarding-service.ts';
import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';

const assert = (v: unknown, msg = 'Assertion failed') => { if (!v) throw Error(msg); };
const rejects = (work: () => unknown): boolean => { try { work(); } catch { return true; } return false; };
const TOKEN = 'A'.repeat(43);

type Row = Record<string, unknown>;
/**
 * Kleine Datenbank im Speicher. `missing` nennt Spalten, die es „noch nicht gibt“
 * (Migration nicht angewandt): Lesen und Schreiben damit scheitert wie bei PostgREST.
 */
function memoryDb(seed: Record<string, Row[]> = {}, opts: { missing?: string[]; rpc?: (name: string, args: Row) => { data: unknown; error: unknown } } = {}) {
  const tables: Record<string, Row[]> = { recruiter_onboarding_cases: [], profiles: [], user_roles: [], recruiter_public_links: [], ...seed };
  const missing = new Set(opts.missing ?? []);
  const writes: { table: string; kind: 'insert' | 'update'; values: Row }[] = [];
  const users: Record<string, { id: string; email: string; app_metadata: Row; user_metadata: Row }> = {};
  const db = {
    from: (table: string) => {
      const filters: ((r: Row) => boolean)[] = [];
      let insert: Row | null = null; let update: Row | null = null; let single = false; let cols = '*';
      const q = {
        select: (c = '*') => { cols = c; return q; },
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q; },
        is: (k: string, v: unknown) => { filters.push(r => (r[k] ?? null) === v); return q; },
        gt: (k: string, v: string) => { filters.push(r => String(r[k]) > v); return q; },
        order: () => q, limit: () => q,
        maybeSingle: () => { single = true; return q; }, single: () => { single = true; return q; },
        insert: (v: Row) => { insert = v; return q; }, update: (v: Row) => { update = v; return q; },
        then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => {
          const touched = [...Object.keys(insert ?? {}), ...Object.keys(update ?? {}), ...cols.split(',')];
          if (touched.some(c => missing.has(c))) return Promise.resolve({ data: null, error: { code: 'PGRST204', message: 'Could not find the column in the schema cache' } }).then(resolve);
          let rows = (tables[table] ?? []).filter(r => filters.every(f => f(r)));
          if (insert) { const row = { id: `new-${tables[table].length + 1}`, revision: 0, revoked_at: null, ...insert }; tables[table].push(row); writes.push({ table, kind: 'insert', values: insert }); rows = [row]; }
          if (update) { rows.forEach(r => Object.assign(r, update)); writes.push({ table, kind: 'update', values: update }); }
          return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve);
        },
      };
      return q;
    },
    rpc: (name: string, args: Row) => Promise.resolve(opts.rpc ? opts.rpc(name, args) : { data: null, error: { code: 'PGRST202', message: 'function not found' } }),
    auth: { admin: {
      createUser: (args: { email: string; user_metadata: Row }) => {
        users[args.email] = { id: `id-${args.email}`, email: args.email, app_metadata: {}, user_metadata: args.user_metadata };
        return Promise.resolve({ data: { user: structuredClone(users[args.email]) }, error: null });
      },
      updateUserById: (id: string, attrs: { app_metadata?: Row }) => {
        const user = Object.values(users).find(u => u.id === id)!;
        Object.assign(user.app_metadata, attrs.app_metadata ?? {});
        return Promise.resolve({ data: { user: structuredClone(user) }, error: null });
      },
    } },
  } as unknown as SupabaseClient;
  return { db, tables, writes };
}
function codeDeps() {
  const mails: { to: string; subject: string; html: string }[] = [];
  const deps: CodeDeps = {
    limits: () => Promise.resolve({ allowed: true } as LimitResult),
    mail: (_db, args) => { mails.push(args); return Promise.resolve({ sent: true }); },
    fetch: () => Promise.resolve(new Response(null, { status: 500 })),
    env: () => undefined,
  };
  return { deps, mails };
}
const invite = async (extra: Row = {}): Promise<Row> => ({
  id: 'case-1', revision: 3, token_hash: await hashToken(TOKEN), email: 'anna@example.test', profile: { name: 'Anna Åkesson' },
  revoked_at: null, claimed_by: null, expires_at: '2999-01-01T00:00:00Z', ...extra,
});

Deno.test('normLang ordnet zu wie matchLanguage im Frontend; alles andere wird ignoriert', () => {
  const table: [unknown, string | null][] = [
    ['de', 'de'], ['de-DE', 'de'], ['DE_de', 'de'], ['de-AT', 'de-AT'], ['de-at', 'de-AT'], ['de-CH', 'de-CH'], ['de-LI', 'de-CH'],
    ['en', 'en'], ['en-US', 'en'], ['en-GB', 'en'], ['sv', 'sv'], ['sv-SE', 'sv'], ['sv_FI', 'sv'],
    ['nb', 'nb'], ['nb-NO', 'nb'], ['no', 'nb'], ['nn', 'nb'], ['nn-NO', 'nb'], [' en ', 'en'],
    ['fr', null], ['da', null], ['', null], ['  ', null], [null, null], [undefined, null], [42, null], [{}, null], ['english', null],
  ];
  for (const [input, want] of table) assert(normLang(input) === want, `${JSON.stringify(input)} → ${normLang(input)} statt ${want}`);
  assert(baseLang('de-AT') === 'de' && baseLang('de-CH') === 'de' && baseLang(null) === 'de' && baseLang('sv') === 'sv' && baseLang('nb') === 'nb' && baseLang('en') === 'en');
  assert(intlLocale('en') === 'en-GB' && intlLocale('sv') === 'sv-SE' && intlLocale('nb') === 'nb-NO' && intlLocale(null) === 'de-DE' && intlLocale('de-CH') === 'de-CH');
});

Deno.test('tr wählt die Sprache, fällt auf Deutsch zurück und schreibt für die Schweiz ohne Eszett, Namen bleiben', () => {
  const texts = { de: 'Viele Grüße, {name}', en: 'Best regards, {name}', sv: 'Hälsningar, {name}' };
  assert(tr(null, texts, { name: 'Groß' }) === 'Viele Grüße, Groß');
  assert(tr('de-AT', texts, { name: 'Groß' }) === 'Viele Grüße, Groß');
  assert(tr('de-CH', texts, { name: 'Groß' }) === 'Viele Grüsse, Groß', 'nur der Text, nicht der Name');
  assert(tr('en', texts, { name: 'Groß' }) === 'Best regards, Groß' && tr('sv', texts, { name: 'x' }) === 'Hälsningar, x');
  assert(tr('nb', texts, { name: 'x' }) === 'Viele Grüße, x', 'fehlende Übersetzung: Deutsch');
  assert(swiss('Straße, außen') === 'Strasse, aussen');
  assert(tr('en', { de: 'a {x} {y}', en: 'b {x} {y}' }, { x: 1 }) === 'b 1 {y}', 'unbekannte Platzhalter bleiben stehen');
});

Deno.test('Servermeldungen: ohne lang unverändert deutsch, sonst in der Sprache; Unbekanntes bleibt deutsch', () => {
  const wrong = 'Der Code ist falsch oder abgelaufen. Fordere einfach einen neuen an.';
  assert(localizeMessage(null, wrong) === wrong && localizeMessage('de', wrong) === wrong && localizeMessage('de-AT', wrong) === wrong);
  assert(localizeMessage('en', wrong) === 'The code is wrong or has expired. Simply request a new one.');
  assert(localizeMessage('sv', wrong) === 'Koden är fel eller har gått ut. Begär bara en ny.');
  assert(localizeMessage('nb', wrong) === 'Koden er feil eller utløpt. Bare be om en ny.');
  assert(localizeMessage('en', 'Etwas ganz anderes.') === 'Etwas ganz anderes.');
  const signature = 'Der Signaturzugang gehört ausschließlich der benannten unterzeichnenden Person und muss noch offen sein.';
  assert(localizeMessage('de-CH', signature) === signature.replace('ausschließlich', 'ausschliesslich') && localizeMessage('de', signature) === signature);
  const limited = 'Gerade wurden mehrere Codes angefordert. Ein neuer Code ist ab 12:15 Uhr möglich. Ein schon erhaltener Code lässt sich weiterhin eintragen.';
  assert(localizeMessage('en', limited).includes('from 12:15') && localizeMessage('sv', limited).includes('kl. 12:15') && localizeMessage('nb', limited).includes('kl. 12:15'));
  assert(localizeMessage('en', 'DocuSign konnte die Anfrage nicht abschließen (502).') === 'DocuSign could not complete the request (502).');
  // Jede übersetzte Meldung hat alle drei Sprachen, und keine Übersetzung ist leer oder noch deutsch.
  for (const de of TRANSLATED_MESSAGES) for (const lang of ['en', 'sv', 'nb'] as const) {
    const text = localizeMessage(lang, de);
    assert(text && text !== de, `${lang}: ${de}`);
  }
});

Deno.test('Code-Mail: Sprache aus dem Aufruf, sonst die des Vorgangs, sonst Deutsch wie bisher', async () => {
  // Ohne lang und ohne Sprache am Vorgang: wortgleich der alte deutsche Text.
  const plain = memoryDb({ recruiter_onboarding_cases: [await invite()] }); const a = codeDeps();
  await sendCode(plain.db, { token: TOKEN, ip: null }, a.deps);
  const code = a.mails[0].subject.split(' ')[0];
  assert(a.mails[0].subject === `${code} ist dein Matchunt-Code`, a.mails[0].subject);
  assert(a.mails[0].html.includes('<html lang="de">') && a.mails[0].html.includes('Hallo Anna,') && a.mails[0].html.includes('mit diesem Code bestätigst du deine E-Mail-Adresse, ganz ohne Passwort:')
    && a.mails[0].html.includes('Der Code ist eine Stunde gültig. Danach fordere auf der Seite einfach einen neuen an.') && a.mails[0].html.includes('Versendet über Matchunt.'));
  assert(!plain.writes.some(w => w.table === 'recruiter_onboarding_cases'), 'ohne lang wird am Vorgang nichts geschrieben');

  // Schwedisch gewählt: abgestimmter Wortlaut, und die Wahl steht danach am Vorgang.
  const sv = memoryDb({ recruiter_onboarding_cases: [await invite()] }); const b = codeDeps();
  await sendCode(sv.db, { token: TOKEN, ip: null, lang: 'sv-SE' }, b.deps);
  const svCode = b.mails[0].subject.split(' ')[0];
  assert(/^\d{6}$/.test(svCode) && b.mails[0].subject === `${svCode} är din Matchunt-kod`, b.mails[0].subject);
  assert(b.mails[0].html.includes('<html lang="sv">') && b.mails[0].html.includes('Hej Anna,') && b.mails[0].html.includes('här är din kod.') && b.mails[0].html.includes('Den gäller i en timme.') && b.mails[0].html.includes(svCode));
  assert(!b.mails[0].html.includes('Hallo') && !b.mails[0].html.includes('gültig') && !b.mails[0].html.includes('Versendet über'), 'kein deutscher Rest');
  const stored = sv.tables.recruiter_onboarding_cases[0];
  assert(stored.language === 'sv' && stored.revision === 4, 'Sprache gemerkt, Revision zählt mit');

  // Kein lang, aber die Einladung ist englisch.
  const en = memoryDb({ recruiter_onboarding_cases: [await invite({ language: 'en' })] }); const c = codeDeps();
  await sendCode(en.db, { token: TOKEN, ip: null }, c.deps);
  assert(c.mails[0].subject.endsWith('is your Matchunt code') && c.mails[0].html.includes('Hello Anna,') && c.mails[0].html.includes('valid for one hour'));
  assert((await peekCase(en.db, TOKEN)).language === 'en' && (await peekCase(plain.db, TOKEN)).language === null);

  // Norwegisch im Aufruf schlägt die Sprache der Einladung.
  const nb = memoryDb({ recruiter_onboarding_cases: [await invite({ language: 'en' })] }); const d = codeDeps();
  await sendCode(nb.db, { token: TOKEN, ip: null, lang: 'no' }, d.deps);
  assert(d.mails[0].subject.endsWith('er Matchunt-koden din') && d.mails[0].html.includes('her er koden din.') && nb.tables.recruiter_onboarding_cases[0].language === 'nb');

  // Unbekannte Sprache wird ignoriert.
  const fr = memoryDb({ recruiter_onboarding_cases: [await invite()] }); const e = codeDeps();
  await sendCode(fr.db, { token: TOKEN, ip: null, lang: 'fr' }, e.deps);
  assert(e.mails[0].subject.endsWith('ist dein Matchunt-Code') && !fr.writes.some(w => w.table === 'recruiter_onboarding_cases'));

  // Ohne Einladung (Einstieg über die Website): Sprache aus dem Aufruf; Anmeldeseite: Sprache aus dem Profil.
  const web = memoryDb(); const g = codeDeps();
  await sendCode(web.db, { email: 'neu@example.test', ip: null, lang: 'en', via: 'linkedin' }, g.deps);
  assert(g.mails[0].subject.endsWith('is your Matchunt code') && g.mails[0].html.includes('Hello,'));
  const login = memoryDb({ profiles: [{ user_id: 'u1', email: 'da@example.test', full_name: 'Danny Beispiel', language: 'sv' }], user_roles: [{ user_id: 'u1', role: 'recruiter' }] }); const h = codeDeps();
  await login.db.auth.admin.createUser({ email: 'da@example.test' } as never);
  // findRecruiter liefert die Konto-ID aus dem Profil; im Fixture heißt sie anders als beim Anlegen, daher gezielt setzen.
  login.tables.profiles[0].user_id = 'id-da@example.test'; login.tables.user_roles[0].user_id = 'id-da@example.test';
  await sendCode(login.db, { email: 'da@example.test', ip: null, login: true }, h.deps);
  assert(h.mails[0].subject.endsWith('är din Matchunt-kod') && h.mails[0].html.includes('Hej Danny,'), h.mails[0]?.subject);
});

Deno.test('Migration noch nicht angewandt: Code-Mail und Einstieg laufen, Sprache und Kennung werden ausgelassen', async () => {
  const f = memoryDb({ recruiter_onboarding_cases: [await invite()] }, { missing: ['language', 'source_key'] }); const m = codeDeps();
  const r = await sendCode(f.db, { token: TOKEN, ip: null, lang: 'en' }, m.deps);
  assert(r.sent && m.mails[0].subject.endsWith('is your Matchunt code'), 'Mail trotzdem in der gewählten Sprache');
  assert(f.tables.recruiter_onboarding_cases[0].language === undefined && f.tables.recruiter_onboarding_cases[0].revision === 3);
  const same = await setCaseLanguage(f.db, f.tables.recruiter_onboarding_cases[0] as unknown as OnboardingCase, 'sv');
  assert(same.revision === 3, 'wirft nicht, lässt den Vorgang unverändert');

  const user = { id: 'user', email: 'neu@example.test', email_confirmed_at: '2026-01-01', user_metadata: { full_name: 'Alex' } } as unknown as User;
  const g = memoryDb({ user_roles: [{ user_id: 'user', role: 'recruiter' }] }, { missing: ['language', 'source_key', 'id,key,label,language,expires_at,revoked_at,opened_count,created_at'] });
  const c = await beginRecruiterCase(g.db, user, 'individual', { lang: 'en', via: 'linkedin' });
  assert(c.claimed_by === 'user' && c.state === 'draft' && c.language === undefined && g.tables.recruiter_onboarding_cases.length === 1);
});

Deno.test('begin: neuer Vorgang bekommt Sprache und gültige Kennung; bestehender nur die gewählte Sprache', async () => {
  const user = { id: 'user', email: 'neu@example.test', email_confirmed_at: '2026-01-01', user_metadata: { full_name: 'Alex' } } as unknown as User;
  const links = [
    { id: 'l1', key: 'linkedin', label: 'LinkedIn', language: 'sv', expires_at: null, revoked_at: null, opened_count: 0, created_at: '2026-11-01' },
    { id: 'l2', key: 'alt', label: 'Alt', language: null, expires_at: '2000-01-01T00:00:00Z', revoked_at: null, opened_count: 0, created_at: '2026-11-01' },
    { id: 'l3', key: 'weg', label: 'Weg', language: null, expires_at: null, revoked_at: '2026-11-02T00:00:00Z', opened_count: 0, created_at: '2026-11-01' },
  ];
  const seed = () => ({ user_roles: [{ user_id: 'user', role: 'recruiter' }], profiles: [{ user_id: 'user', email: user.email, language: null }], recruiter_public_links: structuredClone(links) });
  const f = memoryDb(seed());
  const c = await beginRecruiterCase(f.db, user, 'individual', { lang: 'sv', via: 'LinkedIn ' });
  assert(c.language === 'sv' && c.source_key === 'linkedin' && (c as unknown as Row).entry_source === 'website', JSON.stringify(c));
  assert(f.tables.profiles[0].language === 'sv', 'Sprache auch am Profil');
  // Später Englisch gewählt und über einen anderen Link gekommen: Sprache wechselt, Kennung bleibt.
  const again = await beginRecruiterCase(f.db, user, 'individual', { lang: 'en', via: 'weg' });
  assert(again.id === c.id && again.language === 'en' && again.source_key === 'linkedin' && f.tables.recruiter_onboarding_cases.length === 1);
  // Ohne lang bleibt die Sprache.
  assert((await beginRecruiterCase(f.db, user, 'individual')).language === 'en');
  for (const via of ['alt', 'weg', 'unbekannt', 'x', 'Über uns', 42, null]) {
    const g = memoryDb(seed());
    const fresh = await beginRecruiterCase(g.db, user, 'individual', { via });
    assert(fresh.source_key === undefined && fresh.language === undefined, `Kennung ${String(via)} wird nicht gespeichert`);
  }
  // Einladung, die das bestätigte Konto auf einem anderen Gerät übernimmt: Sprache ja, Kennung nie.
  const h = memoryDb({ ...seed(), recruiter_onboarding_cases: [{ id: 'invite', revision: 0, email: user.email, claimed_by: null, revoked_at: null, expires_at: '2999-01-01', profile: {}, kind: 'agency', language: 'de' }] });
  const claimed = await beginRecruiterCase(h.db, user, 'individual', { lang: 'nb', via: 'linkedin' });
  assert(claimed.id === 'invite' && claimed.claimed_by === 'user' && claimed.language === 'nb' && claimed.source_key === undefined);
});

Deno.test('link-create prüft die Kennung: klein, nur a-z 0-9 und Bindestrich, 3 bis 40 Zeichen', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');
  const ok = cleanLinkInput({ label: '  LinkedIn   Q4 ', key: 'linkedin-q4', language: null, expires_at: null }, now);
  assert(JSON.stringify(ok) === JSON.stringify({ label: 'LinkedIn Q4', key: 'linkedin-q4', language: null, expires_at: null }), JSON.stringify(ok));
  for (const key of ['abc', 'a-b', '123', 'a'.repeat(40), 'sverige-2026']) assert(cleanLinkInput({ label: 'Test', key }, now).key === key, key);
  for (const key of ['ab', 'a'.repeat(41), 'LinkedIn', 'linked in', 'über', 'a_b', 'a.b', 'a/b', ' abc', 'abc ', '', null, undefined, 42, 'abc?x=1'])
    assert(rejects(() => cleanLinkInput({ label: 'Test', key }, now)), `Kennung ${JSON.stringify(key)} muss abgelehnt werden`);
  assert(rejects(() => cleanLinkInput({ label: ' ', key: 'abc' }, now)), 'Name fehlt');
  assert(cleanLinkInput({ label: 'Test', key: 'abc', language: 'sv-SE' }, now).language === 'sv' && cleanLinkInput({ label: 'Test', key: 'abc', language: '' }, now).language === null);
  assert(rejects(() => cleanLinkInput({ label: 'Test', key: 'abc', language: 'fr' }, now)), 'unbekannte Sprache');
  assert(cleanLinkInput({ label: 'Test', key: 'abc', expires_at: '2026-12-01T00:00:00Z' }, now).expires_at === '2026-12-01T00:00:00.000Z');
  assert(cleanLinkInput({ label: 'Test', key: 'abc', expires_at: '2026-11-12' }, now).expires_at === '2026-11-12T22:59:59.000Z', 'nur Datum: gilt bis zum Ende des Tages');
  assert(rejects(() => cleanLinkInput({ label: 'Test', key: 'abc', expires_at: '2026-11-11' }, now)), 'gestern ist vorbei');
  assert(rejects(() => cleanLinkInput({ label: 'Test', key: 'abc', expires_at: '2026-11-01T00:00:00Z' }, now)) && rejects(() => cleanLinkInput({ label: 'Test', key: 'abc', expires_at: 'bald' }, now)));
  // Aus dem Link gelesen wird großzügiger (Groß/Klein, Leerraum), gespeichert ist immer klein.
  assert(cleanLinkKey(' LinkedIn-Q4 ') === 'linkedin-q4' && cleanLinkKey('ab') === null && cleanLinkKey(7) === null);
  assert(linkUsable({ expires_at: null, revoked_at: null }, now) && !linkUsable({ expires_at: '2026-11-12T11:00:00Z', revoked_at: null }, now) && !linkUsable({ expires_at: null, revoked_at: '2026-11-01' }, now));
});

Deno.test('Aktion link: gültig mit Sprache und Zählung; unbekannt, abgelaufen, zurückgezogen und fehlende Migration sind kein Fehler', async () => {
  const allowed = () => Promise.resolve({ allowed: true } as LimitResult);
  const calls: Row[] = [];
  const open = memoryDb({}, { rpc: (name, args) => { calls.push({ name, ...args }); return { data: args._key === 'linkedin' ? [{ link_key: 'linkedin', link_language: 'sv' }] : args._key === 'auto' ? [{ link_key: 'auto', link_language: null }] : [], error: null }; } });
  assert(JSON.stringify(await openPublicLink(open.db, 'LinkedIn', '1.1.1.1', allowed, LIMITS.recruiterLink)) === '{"valid":true,"language":"sv"}');
  assert(JSON.stringify(calls[0]) === '{"name":"recruiter_public_link_open","_key":"linkedin"}');
  assert(JSON.stringify(await openPublicLink(open.db, 'auto', null, allowed, LIMITS.recruiterLink)) === '{"valid":true,"language":null}');
  assert(JSON.stringify(await openPublicLink(open.db, 'unbekannt', null, allowed, LIMITS.recruiterLink)) === '{"valid":false,"language":null}');
  const before = calls.length;
  for (const bad of ['x', '', null, undefined, 42, 'a b c']) assert(JSON.stringify(await openPublicLink(open.db, bad, null, allowed, LIMITS.recruiterLink)) === '{"valid":false,"language":null}');
  assert(calls.length === before, 'ungültige Kennung fragt die Datenbank nicht');
  // Migration fehlt: Funktion und Tabelle gibt es nicht.
  assert(JSON.stringify(await openPublicLink(memoryDb().db, 'linkedin', null, allowed, LIMITS.recruiterLink)) === '{"valid":false,"language":null}');
  // Grenze gerissen: Antwort ja, Zählung nein.
  const limited = memoryDb({ recruiter_public_links: [{ id: 'l1', key: 'linkedin', label: 'L', language: 'en', expires_at: null, revoked_at: null }] }, { rpc: () => { throw Error('darf nicht zählen'); } });
  assert(JSON.stringify(await openPublicLink(limited.db, 'linkedin', null, () => Promise.resolve({ allowed: false } as LimitResult), LIMITS.recruiterLink)) === '{"valid":true,"language":"en"}');
  const rules = LIMITS.recruiterLink('1.1.1.1', 'linkedin');
  assert(rules.length === 2 && rules.every(r => r.zweck === 'hh-link') && rules[0].scope === 'ip' && rules[1].scope === 'link');
  const counts = linkCounts([{ id: 'a', source_key: 'linkedin' }, { id: 'b', source_key: 'linkedin' }, { id: 'c', source_key: null }, { id: 'd', source_key: 'xing' }], new Set(['b', 'c']));
  assert(JSON.stringify(counts) === '{"linkedin":{"started":2,"signed":1},"xing":{"started":1,"signed":0}}', JSON.stringify(counts));
});

Deno.test('Einladung und Willkommensmail: Deutsch wortgleich wie bisher, sonst in der Sprache des Vorgangs', () => {
  const de = invitationMailTexts(null, { expiresAt: '2026-12-24T12:00:00Z' });
  assert(de.subject === 'Ihre Einladung zum Matchunt Recruiter-Netzwerk' && de.hello === 'Guten Tag' && !de.firstNameOnly && de.cta === 'Persönliches Onboarding starten');
  assert(de.validUntil === 'Dieser persönliche Link ist bis 24.12.2026 gültig. Bitte nicht weiterleiten.' && de.regards === 'Mit freundlichen Grüßen<br>Ihr Matchunt-Team', de.validUntil);
  assert(invitationMailTexts('de-CH', { expiresAt: '2026-12-24T12:00:00Z' }).regards === 'Mit freundlichen Grüssen<br>Ihr Matchunt-Team');
  const en = invitationMailTexts('en', { expiresAt: '2026-12-24T12:00:00Z' });
  assert(en.firstNameOnly && en.validUntil.includes('24/12/2026') && en.process.includes('countersigns') && en.imprint === 'Legal notice');
  assert(invitationMailTexts('sv', { expiresAt: '2026-12-24T12:00:00Z' }).process.includes('kontrasignerar') && invitationMailTexts('nb', { expiresAt: '2026-12-24T12:00:00Z' }).process.includes('kontrasignerer'));

  const old = welcomeMail({ profile: { name: 'Danny Beispiel' } } as never, 'https://matchunt.ai', 'u.L');
  assert(old.subject === 'Dein Vertrag ist komplett – willkommen bei Matchunt' && old.html.includes('<p>Hallo Danny,</p><p>wir haben deinen Vertrag gegengezeichnet. Er ist jetzt komplett, und dein Zugang ist freigeschaltet.</p>')
    && old.html.includes('<li>Tippe auf „Jetzt anmelden“.</li><li>Bestätige mit dem Code, den wir dir dann schicken.</li>') && old.html.includes('<p>Der Link ist persönlich und 30 Tage gültig.</p><p>Bei Fragen antworte einfach auf diese Mail.</p><p>Viele Grüße<br>dein Matchunt-Team</p>'));
  const sv = welcomeMail({ profile: { name: 'Anna Åkesson' }, language: 'sv' } as never, 'https://matchunt.ai');
  assert(sv.subject === 'Ditt avtal är klart – välkommen till Matchunt' && sv.html.includes('<html lang="sv">') && sv.html.includes('Hej Anna,') && sv.html.includes('kontrasignerat') && sv.html.includes('ange din e-postadress') && !sv.html.includes('Hallo'));
  const ch = welcomeMail({ profile: { name: 'Urs Großmann' }, language: 'de-CH' } as never, 'https://matchunt.ai');
  assert(ch.html.includes('Viele Grüsse<br>dein Matchunt-Team') && ch.html.includes('<html lang="de-CH">'));
  assert(codeMailTexts('en', { code: '123456', login: true }).heading === 'Your sign-in code' && codeMailTexts(null, { code: '123456', login: true }).intro === 'mit diesem Code meldest du dich bei Matchunt an, ganz ohne Passwort:');
  assert(layout({ preheader: '', heading: '', body: '' }).includes('<html lang="de">') && layout({ preheader: '', heading: '', body: '', lang: 'nb' }).includes('Sendt via Matchunt.'));
});
