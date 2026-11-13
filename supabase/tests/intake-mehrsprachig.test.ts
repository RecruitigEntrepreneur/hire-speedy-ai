import { publicDraft, publicLink } from '../functions/_shared/intake-core.ts';
import {
  callLanguage, customerMailLanguage, isMissingLanguageColumn, linkLanguageById, parseLinkLanguage, profileLanguage,
  rememberDraftLanguage, rowLanguage, seedProfileLanguage, withIntakeLang, withLanguageColumn,
} from '../functions/_shared/intake-language.ts';
import {
  localizeIntakeMessage, TRANSLATED_INTAKE_MESSAGES, verifyCodeMailTexts, resumeMailTexts, forwardMailTexts,
  clarifyMailTexts, reviewMailTexts, linkInvitationMailTexts, clientLoginCodeMailTexts, submittedMailTexts,
} from '../functions/_shared/intake-i18n.ts';
import { sendClientCode, type ClientCodeDeps } from '../functions/_shared/client-code.ts';
import { clientAccessMail, sendClientAccess, type AccessDeps } from '../functions/_shared/client-access.ts';
import { fail, json } from '../functions/_shared/http.ts';
import type { LimitResult } from '../functions/_shared/intake-limits.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const assert = (v: unknown, msg = 'Assertion failed') => { if (!v) throw Error(msg); };
const same = (a: unknown, b: unknown, msg = '') => assert(JSON.stringify(a) === JSON.stringify(b), `${msg} ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

type Row = Record<string, unknown>;
const KUNDE = '2b1f3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

/**
 * Kleine Datenbank im Speicher. `missing` nennt Tabellen, in denen es die Spalte
 * `language` „noch nicht gibt“ (Migration nicht angewandt): Lesen und Schreiben
 * damit scheitert dort wie bei PostgREST.
 */
function memoryDb(seed: Record<string, Row[]> = {}, opts: { missing?: string[] } = {}) {
  const tables: Record<string, Row[]> = { intake_drafts: [], intake_links: [], profiles: [], user_roles: [], ...seed };
  const missing = new Set(opts.missing ?? []);
  const writes: { table: string; kind: 'insert' | 'update'; values: Row }[] = [];
  const reads: { table: string; cols: string }[] = [];
  const users: Record<string, { id: string; email: string; app_metadata: Row }> = {
    [KUNDE]: { id: KUNDE, email: 'luca@kanna.test', app_metadata: {} },
  };
  const db = {
    from: (table: string) => {
      const filters: ((r: Row) => boolean)[] = [];
      let insert: Row | null = null; let update: Row | null = null; let single = false; let cols = '*';
      const q = {
        select: (c = '*') => { cols = c; return q; },
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q; },
        is: (k: string, v: unknown) => { filters.push(r => (r[k] ?? null) === v); return q; },
        ilike: (k: string, v: string) => { filters.push(r => String(r[k] ?? '').toLowerCase() === v.replace(/\\(.)/g, '$1').toLowerCase()); return q; },
        order: () => q, limit: () => q,
        maybeSingle: () => { single = true; return q; }, single: () => { single = true; return q; },
        insert: (v: Row) => { insert = v; return q; }, update: (v: Row) => { update = v; return q; },
        then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => {
          const touched = [...Object.keys(insert ?? {}), ...Object.keys(update ?? {}), ...cols.split(',').map(c => c.trim())];
          if (missing.has(table) && touched.includes('language')) {
            const error = insert || update
              ? { code: 'PGRST204', message: `Could not find the 'language' column of '${table}' in the schema cache` }
              : { code: '42703', message: `column ${table}.language does not exist` };
            return Promise.resolve({ data: null, error }).then(resolve);
          }
          if (!insert && !update) reads.push({ table, cols });
          let rows = (tables[table] ?? []).filter(r => filters.every(f => f(r)));
          if (insert) { const row = { id: `new-${tables[table].length + 1}`, ...insert }; tables[table].push(row); writes.push({ table, kind: 'insert', values: insert }); rows = [row]; }
          if (update) { rows.forEach(r => Object.assign(r, update)); writes.push({ table, kind: 'update', values: update }); }
          return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve);
        },
      };
      return q;
    },
    auth: { admin: {
      updateUserById: (id: string, attrs: { app_metadata?: Row }) => {
        Object.assign(users[id].app_metadata, attrs.app_metadata ?? {});
        return Promise.resolve({ data: { user: structuredClone(users[id]) }, error: null });
      },
      getUserById: (id: string) => Promise.resolve({ data: { user: structuredClone(users[id]) }, error: null }),
    } },
  } as unknown as SupabaseClient;
  return { db, tables, writes, reads };
}

const kunde = (language?: string | null): Record<string, Row[]> => ({
  profiles: [{ user_id: KUNDE, email: 'Luca@Kanna.test', full_name: 'Luca Bartosch', ...(language === undefined ? {} : { language }) }],
  user_roles: [{ user_id: KUNDE, role: 'client' }],
});
function codeDeps() {
  const mails: { to: string; subject: string; html: string; template: string }[] = [];
  const deps: ClientCodeDeps = {
    limits: () => Promise.resolve({ allowed: true } as LimitResult),
    mail: (_db, args) => { mails.push(args); return Promise.resolve({ sent: true }); },
    fetch: () => Promise.resolve(new Response(null, { status: 500 })),
    env: () => undefined,
  };
  return { deps, mails };
}

Deno.test('Kunden-Code-Mail: Sprache des Aufrufs, sonst des Profils, sonst Deutsch wortgleich', async () => {
  // Ohne Angabe: Deutsch, Wort für Wort wie vor der Mehrsprachigkeit.
  const de = codeDeps();
  await sendClientCode(memoryDb(kunde()).db, { email: 'luca@kanna.test', ip: null }, de.deps);
  const code = de.mails[0].subject.split(' ')[0];
  assert(/^\d{6}$/.test(code) && de.mails[0].subject === `${code} ist Ihr Matchunt-Anmeldecode`, de.mails[0].subject);
  for (const satz of ['<html lang="de">', `Ihr Anmeldecode: ${code}`, 'Guten Tag Luca Bartosch,', 'mit diesem Code melden Sie sich bei Matchunt an:',
    'Der Code ist eine Stunde gültig. Danach fordern Sie auf der Seite einfach einen neuen an.',
    'Wenn Sie sich gerade nicht bei Matchunt anmelden wollten, ignorieren Sie diese Nachricht. Geben Sie den Code nicht weiter.',
    'Versendet über Matchunt.']) assert(de.mails[0].html.includes(satz), `fehlt: ${satz}`);

  // Sprache des Aufrufs schlägt die des Profils.
  const sv = codeDeps();
  await sendClientCode(memoryDb(kunde('en')).db, { email: 'luca@kanna.test', ip: null, lang: 'sv-SE' }, sv.deps);
  assert(/^\d{6} är din inloggningskod för Matchunt$/.test(sv.mails[0].subject), sv.mails[0].subject);
  assert(sv.mails[0].html.includes('<html lang="sv">') && sv.mails[0].html.includes('Hej Luca Bartosch,') && sv.mails[0].html.includes('loggar du in på Matchunt'), 'Schwedisch, du');

  // Ohne `lang` gilt die Sprache am Profil.
  const en = codeDeps();
  await sendClientCode(memoryDb(kunde('en')).db, { email: 'luca@kanna.test', ip: null }, en.deps);
  assert(en.mails[0].subject.endsWith('is your Matchunt sign-in code') && en.mails[0].html.includes('Hello Luca Bartosch,'), en.mails[0].subject);
  const nb = codeDeps();
  await sendClientCode(memoryDb(kunde('nb')).db, { email: 'luca@kanna.test', ip: null, lang: 'xx' }, nb.deps);
  assert(nb.mails[0].subject.endsWith('er påloggingskoden din for Matchunt'), 'Unbekanntes lang zählt nicht, Profil gilt');

  // Schweiz: deutscher Text ohne Eszett.
  const ch = codeDeps();
  await sendClientCode(memoryDb(kunde('de-CH')).db, { email: 'luca@kanna.test', ip: null }, ch.deps);
  assert(ch.mails[0].subject.endsWith('ist Ihr Matchunt-Anmeldecode') && !ch.mails[0].html.includes('ß') && ch.mails[0].html.includes('<html lang="de-CH">'));
});

Deno.test('Kunden-Code-Mail ohne Spalte profiles.language: kein Absturz, Deutsch; mit lang trotzdem übersetzt', async () => {
  const ohne = memoryDb(kunde(), { missing: ['profiles'] });
  const de = codeDeps();
  const sent = await sendClientCode(ohne.db, { email: 'luca@kanna.test', ip: null }, de.deps);
  assert(sent.sent && de.mails.length === 1 && de.mails[0].subject.endsWith('ist Ihr Matchunt-Anmeldecode'), 'Deutsch wie bisher');
  assert(await profileLanguage(ohne.db, KUNDE) === null, 'Lesen liefert null');
  const en = codeDeps();
  await sendClientCode(ohne.db, { email: 'luca@kanna.test', ip: null, lang: 'en' }, en.deps);
  assert(en.mails[0].subject.endsWith('is your Matchunt sign-in code'), 'lang des Aufrufs braucht keine Spalte');
  await seedProfileLanguage(ohne.db, KUNDE, 'sv');
  assert(ohne.writes.length === 0, 'Schreiben wird ausgelassen');
});

Deno.test('Link-Sprache in der Antwort: Feld language an Link und Entwurf; ohne Spalte null', () => {
  const link = { id: 'l-1', link_type: 'personal', label: 'Kanna', prefill: {} };
  assert(publicLink({ ...link, language: 'sv' }, 'Marko').language === 'sv');
  assert(publicLink({ ...link, language: 'de-CH' }, null).language === 'de-CH');
  assert(publicLink({ ...link, language: null }, null).language === null, 'automatisch');
  assert(publicLink(link, null).language === null && 'language' in publicLink(link, null), 'Spalte fehlt: null, Feld ist da');
  assert(publicLink({ ...link, language: 'fr' }, null).language === null, 'Unbekanntes nie nach außen');
  const draft = { id: 'd-1', contract_type: 'full-time', capture_state: 'started', identity_state: 'anonymous', commercial_state: 'not_started', review_state: 'not_submitted' };
  assert(publicDraft({ ...draft, language: 'nb' }).language === 'nb' && publicDraft(draft).language === null);
});

Deno.test('Sprache am Entwurf: nur bei Änderung schreiben; ohne Spalte läuft der Aufruf weiter', async () => {
  const f = memoryDb({ intake_drafts: [{ id: 'd-1', link_id: 'l-1', language: null }], intake_links: [{ id: 'l-1', language: 'sv' }] });
  const draft = f.tables.intake_drafts[0];
  await rememberDraftLanguage(f.db, draft, null);
  assert(f.writes.length === 0, 'ohne lang nichts');
  await rememberDraftLanguage(f.db, draft, 'en');
  same(f.writes, [{ table: 'intake_drafts', kind: 'update', values: { language: 'en' } }]);
  await rememberDraftLanguage(f.db, draft, 'en');
  assert(f.writes.length === 1, 'gleicher Wert: kein zweites Schreiben');
  await rememberDraftLanguage(f.db, draft, 'nb');
  assert(f.writes.length === 2 && draft.language === 'nb', 'der Kunde hat im Menü gewechselt');

  // Migration noch nicht angewandt.
  const ohne = memoryDb({ intake_drafts: [{ id: 'd-2', link_id: 'l-2' }], intake_links: [{ id: 'l-2' }] }, { missing: ['intake_drafts', 'intake_links'] });
  const alt = { ...ohne.tables.intake_drafts[0] };
  await rememberDraftLanguage(ohne.db, alt, 'sv');
  assert(ohne.writes.length === 0 && alt.language === 'sv', 'nicht gespeichert, aber dieser Aufruf kennt die Sprache');
  assert(await linkLanguageById(ohne.db, 'l-2') === null && await linkLanguageById(ohne.db, null) === null);
  assert(await customerMailLanguage(ohne.db, ohne.tables.intake_drafts[0]) === null, 'ohne alles Deutsch wie bisher');
  assert(await customerMailLanguage(ohne.db, ohne.tables.intake_drafts[0], 'en') === 'en', 'dann gilt die Sprache des Aufrufs');
});

Deno.test('Sprache der Kundenmail: Entwurf, sonst Link, sonst Aufruf', async () => {
  const f = memoryDb({ intake_links: [{ id: 'l-1', language: 'sv' }, { id: 'l-2', language: null }] });
  assert(await customerMailLanguage(f.db, { id: 'd', link_id: 'l-1', language: 'nb' }, 'en') === 'nb');
  assert(f.reads.length === 0, 'Entwurf trägt die Sprache: Link wird nicht gelesen');
  assert(await customerMailLanguage(f.db, { id: 'd', link_id: 'l-1', language: null }, 'en') === 'sv');
  assert(await customerMailLanguage(f.db, { id: 'd', link_id: 'l-2' }, 'en') === 'en');
  assert(await customerMailLanguage(f.db, { id: 'd', link_id: null }) === null);
  assert(await customerMailLanguage(f.db, { id: 'd', link_id: 'l-1' }, null, { language: 'de-AT' }) === 'de-AT', 'geladener Link wird genutzt');
  assert(callLanguage({ lang: 'no' }) === 'nb' && callLanguage({ lang: 'fr' }) === null && callLanguage(null) === null && rowLanguage({ language: 'EN-us' }) === 'en');
});

Deno.test('Schreiben und Lesen mit language: fehlt die Spalte, wird ohne sie wiederholt', async () => {
  const ohne = memoryDb({ intake_links: [{ id: 'l-1', label: 'Alt' }] }, { missing: ['intake_links', 'intake_drafts'] });
  const made = await withLanguageColumn((withLanguage) => ohne.db.from('intake_drafts')
    .insert({ link_id: 'l-1', ...(withLanguage ? { language: 'sv' } : {}) }).select('*').single());
  assert(!made.error && made.languageSkipped === true && (made.data as Row).link_id === 'l-1' && !('language' in (made.data as Row)), 'Entwurf entsteht ohne die Spalte');
  const list = await withLanguageColumn((withLanguage) => ohne.db.from('intake_links').select('id, label' + (withLanguage ? ', language' : '')));
  assert(!list.error && list.languageSkipped && (list.data as unknown as Row[]).length === 1, 'Liste kommt trotzdem');

  const mit = memoryDb();
  const ok = await withLanguageColumn((withLanguage) => mit.db.from('intake_links')
    .insert({ label: 'Neu', ...(withLanguage ? { language: 'nb' } : {}) }).select('*').single());
  assert(!ok.error && !ok.languageSkipped && (ok.data as Row).language === 'nb' && mit.writes.length === 1, 'mit Spalte ein Schreiben');

  // Andere Fehler werden nicht verschluckt und nicht wiederholt.
  let runs = 0;
  const other = await withLanguageColumn(() => { runs += 1; return Promise.resolve({ data: null, error: { code: '23514', message: 'check violated' } }); });
  assert(runs === 1 && other.error?.code === '23514');
  assert(isMissingLanguageColumn({ code: '42703', message: 'column intake_links.language does not exist' }));
  assert(!isMissingLanguageColumn({ code: '42703', message: 'column intake_links.foo does not exist' }) && !isMissingLanguageColumn(null));
});

Deno.test('Link anlegen: sechs Codes oder leer; Unbekanntes wird abgelehnt', () => {
  same(parseLinkLanguage('sv'), { ok: true, language: 'sv' });
  same(parseLinkLanguage('de-ch'), { ok: true, language: 'de-CH' });
  for (const leer of [null, undefined, '']) same(parseLinkLanguage(leer), { ok: true, language: null }, 'automatisch');
  for (const falsch of ['fr', 'xx', 5, {}]) same(parseLinkLanguage(falsch), { ok: false });
});

Deno.test('Servermeldungen: eine Stelle je Function, Sprache des Aufrufs, sonst unverändert', async () => {
  const post = (body: unknown) => new Request('https://x.test/fn', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
  const handler = withIntakeLang(async (req) => {
    const body = await req.json();
    if (body.case === 'missing') return fail('conflict', 'Es fehlen noch Angaben.', { missing: ['Ansprechpartner', 'Name des Unternehmens'] });
    if (body.case === 'ok') return json({ ok: true, message: 'Dieser Link ist abgelaufen.', draft: { title: 'Dieser Link ist abgelaufen.' } });
    if (body.case === 'unknown') return fail('internal_error', 'duplicate key value violates unique constraint');
    return fail('expired', 'Dieser Link ist abgelaufen.');
  });
  // Ohne lang und auf Deutsch bleibt die Antwort Byte für Byte.
  const plain = await handler(post({}));
  same(await plain.json(), { error: 'expired', reason: 'expired', message: 'Dieser Link ist abgelaufen.' });
  assert(plain.status === 410);
  same((await (await handler(post({ lang: 'de' }))).json()).message, 'Dieser Link ist abgelaufen.');
  same((await (await handler(post({ lang: 'fr' }))).json()).message, 'Dieser Link ist abgelaufen.', 'unbekannte Sprache wird ignoriert');

  const sv = await handler(post({ lang: 'sv' }));
  assert(sv.status === 410 && sv.headers.get('Access-Control-Allow-Origin') === '*', 'Status und Header bleiben');
  same(await sv.json(), { error: 'expired', reason: 'expired', message: 'Den här länken har gått ut.' });
  same((await (await handler(post({ lang: 'en', case: 'missing' }))).json()), {
    error: 'conflict', reason: 'conflict', message: 'Some details are still missing.', missing: ['Contact person', 'Company name'],
  });
  same((await (await handler(post({ lang: 'nb', case: 'unknown' }))).json()).message, 'duplicate key value violates unique constraint', 'ohne Übersetzung geht es raus, wie es ist');
  // Gelungene Antworten bleiben unberührt, außer die Function trägt dort Text.
  same((await (await handler(post({ lang: 'en', case: 'ok' }))).json()).message, 'Dieser Link ist abgelaufen.');
  const withSuccess = withIntakeLang(() => json({ ok: true, message: 'Dieser Link ist abgelaufen.', notice: 'Ihre Konditionen stehen im Rahmenvertrag RV-2026-0007 und gelten unverändert. Diese Position wird darunter beauftragt — ohne erneute Unterschrift.', draft: { title: 'Dieser Link ist abgelaufen.' } }), { success: true });
  const ok = await (await withSuccess(post({ lang: 'en' }))).json();
  assert(ok.message === 'This link has expired.' && ok.notice.includes('framework agreement RV-2026-0007') && ok.draft.title === 'Dieser Link ist abgelaufen.', 'nur message und notice, nie Inhalte');
  // Kein Body, kein JSON: nichts geht kaputt.
  assert((await withIntakeLang(() => new Response(null, { status: 204 }))(new Request('https://x.test/fn', { method: 'OPTIONS' }))).status === 204);
});

Deno.test('Meldungen: Tabelle und Muster; Schweiz ohne ß; Fachbegriffe einheitlich', () => {
  const de = 'Bitte geben Sie eine gültige E-Mail-Adresse an.';
  assert(localizeIntakeMessage(null, de) === de && localizeIntakeMessage('de', de) === de && localizeIntakeMessage('de-AT', de) === de);
  assert(localizeIntakeMessage('en', de) === 'Please enter a valid email address.' && localizeIntakeMessage('sv', de) === 'Ange en giltig e-postadress.' && localizeIntakeMessage('nb', de) === 'Oppgi en gyldig e-postadresse.');
  assert(localizeIntakeMessage('de-CH', 'Die Aufnahme ist zu groß. Bitte kürzen Sie die Freitexte.') === 'Die Aufnahme ist zu gross. Bitte kürzen Sie die Freitexte.');
  assert(localizeIntakeMessage('en', 'Der Code stimmt nicht. Noch 3 Versuche.') === 'The code is not correct. 3 attempts left.');
  assert(localizeIntakeMessage('en', 'Der Code stimmt nicht. Noch 1 Versuch.') === 'The code is not correct. 1 attempt left.');
  assert(localizeIntakeMessage('nb', 'Zu viele Eingaben. Ab 14:05 Uhr geht es weiter — Ihre Angaben sind gespeichert.').includes('kl. 14:05'));
  assert(localizeIntakeMessage('sv', 'Ein neuer Code ist ab 9:30 Uhr möglich. Haben Sie schon einen Code erhalten? Er ist 15 Minuten gültig und lässt sich oben eintragen. Ihre Angaben sind gespeichert — Sie können jederzeit zurückkommen.').startsWith('En ny kod kan begäras från kl. 9:30'));
  assert(localizeIntakeMessage('en', 'Einladung an chef@kanna.test versendet.') === 'Invitation sent to chef@kanna.test.');
  // Gemeinsame Meldungen kennt die Tabelle des Headhunter-Einstiegs.
  assert(localizeIntakeMessage('en', 'Unbekannte Aktion.') === 'Unknown action.');
  assert(localizeIntakeMessage('en', 'Gerade wurden mehrere Codes angefordert. Ein neuer Code ist ab 10:15 Uhr möglich. Ein schon erhaltener Code lässt sich weiterhin eintragen.').includes('10:15'));
  assert(localizeIntakeMessage('en', 'Das steht nirgends.') === 'Das steht nirgends.');
  // Jede Meldung hat alle drei Sprachen, und keine Übersetzung ist leer oder deutsch geblieben.
  for (const m of TRANSLATED_INTAKE_MESSAGES) {
    for (const lang of ['en', 'sv', 'nb'] as const) {
      const out = localizeIntakeMessage(lang, m);
      assert(out && (out !== m || m === 'Ansprechpartner' || m === 'Paket'), `${lang}: ${m}`);
      assert(!/\bSie\b|\bIhre?[nmr]?\b/.test(out), `${lang} siezt: ${out}`);
    }
  }
  // Die Auswahl des Kunden ist eine Anfrage, kein Vertragsschluss.
  const notice = 'Ihre Auswahl ist eine Anfrage, noch kein Vertrag. Wir prüfen sie und senden Ihnen anschließend den Vertrag zur digitalen Unterschrift. Erst nach beidseitiger Unterschrift starten wir die Suche.';
  assert(localizeIntakeMessage('en', notice).startsWith('Your choice is a request, not yet a contract.'));
  assert(localizeIntakeMessage('sv', notice).startsWith('Ditt val är en förfrågan, ännu inget avtal.'));
  assert(localizeIntakeMessage('nb', notice).startsWith('Valget ditt er en forespørsel, ennå ingen avtale.'));
  assert(localizeIntakeMessage('sv', 'Ihre Konditionen sind im Rahmenvertrag vereinbart und gelten unverändert.').includes('ramavtalet'));
  assert(localizeIntakeMessage('nb', 'Die Beauftragungsanfrage konnte nicht gespeichert werden.').startsWith('Oppdragsforespørselen'));
  assert(localizeIntakeMessage('sv', 'Die Beauftragungsanfrage konnte nicht gespeichert werden.').startsWith('Uppdragsförfrågan'));
});

Deno.test('Mailtexte der Aufnahme: Deutsch wortgleich wie bisher, sonst in der Sprache des Kunden', () => {
  const code = verifyCodeMailTexts(null, { code: '482913', minutes: 15 });
  assert(code.subject === '482913 ist Ihr Matchunt-Bestätigungscode' && code.preheader === 'Ihr Bestätigungscode: 482913' && code.heading === 'Ihr Bestätigungscode');
  assert(code.intro === 'bitte bestätigen Sie Ihre geschäftliche E-Mail-Adresse mit diesem Code:' && code.validity === 'Der Code ist 15 Minuten gültig.');
  assert(code.footnote === 'Wenn Sie keine Stellenaufnahme bei Matchunt begonnen haben, können Sie diese Nachricht ignorieren. Der Code allein gibt niemandem Zugriff.');
  assert(verifyCodeMailTexts('en', { code: '482913', minutes: 15 }).subject === '482913 is your Matchunt confirmation code');
  assert(verifyCodeMailTexts('sv', { code: '482913', minutes: 15 }).validity === 'Koden gäller i 15 minuter.');
  assert(!verifyCodeMailTexts('de-CH', { code: '1', minutes: 15 }).intro.includes('ß'), 'Schweiz');

  const resume = resumeMailTexts(null);
  assert(resume.subject === 'Ihre Stellenaufnahme bei Matchunt fortsetzen' && resume.cta === 'Aufnahme fortsetzen'
    && resume.body('<strong>CFO</strong>') === 'Ihre begonnene Aufnahme für <strong>CFO</strong> ist gespeichert. Über den Link machen Sie genau dort weiter, wo Sie aufgehört haben.');
  assert(resumeMailTexts('nb').body('<strong>CFO</strong>').includes('<strong>CFO</strong>') && resumeMailTexts('en').positionFallback === 'your position');

  const forward = forwardMailTexts(null);
  assert(forward.subject('CFO') === 'Freigabe erbeten: Stellenaufnahme CFO' && forward.preheader('Luca') === 'Luca bittet Sie um Freigabe.'
    && forward.lead('Luca (Kanna)', '<strong>CFO</strong>') === 'Luca (Kanna) hat bei Matchunt eine Stellenaufnahme für <strong>CFO</strong> vorbereitet und bittet Sie um Prüfung und Freigabe.');
  assert(forwardMailTexts('sv').lead('Luca', 'CFO').includes('ber dig granska'), 'du');

  const clarify = clarifyMailTexts(null, { days: 14 });
  assert(clarify.subject === 'Rückfrage zu Ihrer Anfrage' && clarify.lead('<strong>CFO</strong>') === 'zu Ihrer Anfrage für <strong>CFO</strong> haben wir eine Rückfrage:'
    && clarify.link === 'Über den folgenden Link können Sie direkt antworten. Er ist 14 Tage gültig und öffnet ausschließlich diese Rückfrage.' && clarify.positionFallback === 'die Position');
  assert(clarifyMailTexts('en', { days: 14 }).link.includes('14 days'));

  assert(reviewMailTexts(null, { reject: true }).subject === 'Zu Ihrer Beauftragungsanfrage' && reviewMailTexts(null, { reject: false }).subject === 'Rückfrage zu Ihrer Beauftragungsanfrage');
  assert(reviewMailTexts(null, { reject: true }).lead('<strong>CFO</strong>') === 'wir können Ihre Anfrage für <strong>CFO</strong> derzeit leider nicht annehmen.');
  assert(reviewMailTexts('en', { reject: false }).subject === 'A question about your engagement request');

  const invite = linkInvitationMailTexts(null, { title: 'CFO' });
  assert(invite.subject === 'Ihre Position aufnehmen: CFO' && invite.heading === 'Ihre Position aufnehmen: CFO' && invite.cta === 'Position aufnehmen');
  assert(linkInvitationMailTexts(null, { title: '' }).subject === 'Ihre offene Position bei Matchunt aufnehmen' && linkInvitationMailTexts(null, { title: '' }).heading === 'Ihre Position aufnehmen');
  assert(invite.terms === 'Die Konditionen sehen Sie von Anfang an: Erfolgshonorar, keine Fixkosten, kein Retainer.');
  assert(linkInvitationMailTexts('en', { title: '' }).terms.includes('success fee') && linkInvitationMailTexts('sv', { title: '' }).terms.includes('arvode vid tillsättning')
    && linkInvitationMailTexts('nb', { title: '' }).terms.includes('honorar ved ansettelse'), 'Erfolgshonorar einheitlich');

  assert(clientLoginCodeMailTexts('sv', { code: '123456' }).subject === '123456 är din inloggningskod för Matchunt');
});

Deno.test('Eingangsbestätigung: Anfrage bleibt Anfrage, Auftrag nur unter Rahmenvertrag', () => {
  const anfrage = submittedMailTexts(null, { order: false, contracting: false });
  assert(anfrage.subject('MV-1') === 'Ihre Beauftragungsanfrage MV-1 ist eingegangen' && anfrage.heading === 'Ihre Beauftragungsanfrage ist eingegangen');
  assert(anfrage.lead('<strong>CFO</strong>') === 'vielen Dank. Wir haben Ihre Anfrage für <strong>CFO</strong> erhalten und prüfen ihn.', 'wortgleich wie bisher');
  assert(anfrage.footnote === 'Diese Bestätigung dokumentiert den Eingang Ihrer Anfrage. Ein Vertrag kommt erst mit unserer ausdrücklichen Annahme zustande. Bis dahin entstehen Ihnen keine Kosten.');
  assert(anfrage.rows.feeValue(22) === '22 % des Bruttojahreszielgehalts' && anfrage.rows.dueValue(14) === 'nur im Erfolgsfall, 14 Tage netto' && anfrage.germanTermsNote === '');
  const auftrag = submittedMailTexts(null, { order: true, contracting: true });
  assert(auftrag.subject('MV-1') === 'Ihr Auftrag MV-1 ist eingegangen' && auftrag.lead('<strong>CFO</strong>') === 'vielen Dank. Wir haben Ihren Auftrag für <strong>CFO</strong> (Contracting) erhalten.');
  assert(auftrag.next('<strong>RV-7</strong>') === 'Der Auftrag läuft unter Ihrem Rahmenvertrag <strong>RV-7</strong>. Eine erneute Unterschrift ist nicht nötig. Wir sichten die Position und starten die Suche.');
  assert(submittedMailTexts(null, { order: false, contracting: true }).lead('X') === 'vielen Dank. Wir haben Ihre Anfrage für X (Contracting) erhalten und prüfen sie.');

  const en = submittedMailTexts('en', { order: false, contracting: false });
  assert(en.heading === 'We have received your engagement request' && en.footnote.includes('A contract is only concluded once we expressly accept it.') && en.rows.fee === 'Success fee');
  const sv = submittedMailTexts('sv', { order: false, contracting: true });
  assert(sv.subject('MV-1') === 'Vi har tagit emot din uppdragsförfrågan MV-1' && sv.footnote.includes('Ett avtal ingås först när båda parter har undertecknat.') && sv.next().includes('ramavtalet'));
  assert(sv.germanTermsNote.includes('tyska'), 'Contracting-Konditionen bleiben deutscher Wortlaut, mit Hinweis');
  const nb = submittedMailTexts('nb', { order: true, contracting: false });
  assert(nb.underFramework('RV-7').includes('rammeavtalen din RV-7') && nb.heading === 'Vi har mottatt oppdraget ditt');
});

Deno.test('Zugangsmail: Sprache des Kunden; ohne Angabe Deutsch wie bisher', async () => {
  const args = { name: 'Luca Bartosch', title: 'CFO', mandateNumber: 'MV-2026-001009', email: 'luca@kanna.test', signed: true };
  const de = clientAccessMail(args, 'https://matchunt.ai', 'abc.def');
  assert(de.subject === 'Ihre Position ist auf Matchunt – jetzt loslegen');
  for (const satz of ['Guten Tag Luca Bartosch,', 'Ihr Auftrag MV-2026-001009 ist beidseitig unterzeichnet.', 'Ihre Position <strong>CFO</strong> liegt jetzt in Ihrem Matchunt-Bereich.',
    'Wir prüfen sie noch einmal und geben sie dann für unsere Recruiter frei.', 'Ihr Zugang: <strong>luca@kanna.test</strong>',
    '<p>Der Link ist persönlich und 30 Tage gültig. Beim Öffnen senden wir Ihnen einen Anmeldecode an diese Adresse.</p><p>Bei Fragen antworten Sie einfach auf diese Mail.</p><p>Viele Grüße<br>Ihr Matchunt-Team</p>',
    '/impressum">Impressum</a> · <a href="https://matchunt.ai/datenschutz">Datenschutz</a>']) assert(de.html.includes(satz), `fehlt: ${satz}`);
  const sv = clientAccessMail({ ...args, lang: 'sv' }, 'https://matchunt.ai', 'abc.def');
  assert(sv.subject === 'Din tjänst finns på Matchunt – kom igång' && sv.html.includes('<html lang="sv">') && sv.html.includes('Hej Luca Bartosch,')
    && sv.html.includes('Ditt uppdrag MV-2026-001009 är undertecknat av båda parter.') && sv.html.includes('https://matchunt.ai/anmelden#abc.def'));
  const en = clientAccessMail({ ...args, signed: false, mandateNumber: null, lang: 'en' }, 'https://matchunt.ai', null);
  assert(en.html.includes('we have accepted your order.') && en.html.includes('enter your address') && en.html.includes('Get started'));

  // sendClientAccess reicht die Sprache bis in die Mail durch.
  const mails: { subject: string }[] = [];
  const deps: AccessDeps = { mail: (_db, a) => { mails.push(a); return Promise.resolve({ sent: true }); }, appUrl: () => 'https://matchunt.ai', issueLink: () => Promise.resolve('abc.def') };
  const f = memoryDb({ email_events: [] });
  const sent = await sendClientAccess(f.db, { ...args, lang: 'nb', userId: KUNDE, mandateId: 'm-1', draftId: 'd-1', jobId: null }, { resend: true }, deps);
  assert(sent.sent && mails[0].subject === 'Stillingen din er på Matchunt – kom i gang');
});
