import { peekClientLink, sendClientCode, verifyClientCode, CLIENT_LINK_KEY, CLIENT_CODE_KEY, type ClientCodeDeps } from '../functions/_shared/client-code.ts';
import { clientAccessMail, notifyAccessProblem, sendClientAccess, type AccessDeps } from '../functions/_shared/client-access.ts';
import { issueLoginLink } from '../functions/_shared/recruiter-login-link.ts';
import { syncClientEnvelopes, syncDue, SYNC_INTERVAL_MS } from '../functions/_shared/docusign-sync.ts';
import { hashCode } from '../functions/_shared/tokens.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { LimitResult } from '../functions/_shared/intake-limits.ts';
import type { DocuSignConfig } from '../functions/_shared/docusign.ts';

const assert = (v: unknown, msg = 'Assertion failed') => { if (!v) throw Error(msg); };
const reasonOf = async (work: () => Promise<unknown>): Promise<string> => {
  try { await work(); } catch (e) { return String((e as { reason?: string })?.reason ?? 'thrown'); }
  return 'none';
};
const messageOf = async (work: () => Promise<unknown>): Promise<string> => {
  try { await work(); } catch (e) { return String((e as Error).message); }
  return '';
};

const KUNDE = '2b1f3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const HEADHUNTER = '9f8e7d6c-5b4a-4938-8271-6a5b4c3d2e1f';
type Row = Record<string, unknown>;
interface FakeUser { id: string; email: string; app_metadata: Record<string, unknown>; user_metadata: Record<string, unknown> }

/** Eine Supabase-Attrappe, die genau das kann, was die Kundenanmeldung, die Zugangsmail und der Abgleich brauchen. */
function fixture(opts: { tables?: Record<string, Row[]>; allowed?: boolean; mailSent?: boolean } = {}) {
  const users: Record<string, FakeUser> = {
    [KUNDE]: { id: KUNDE, email: 'luca@kanna.test', app_metadata: { provider: 'email' }, user_metadata: {} },
    [HEADHUNTER]: { id: HEADHUNTER, email: 'danny@example.test', app_metadata: {}, user_metadata: {} },
  };
  const tables: Record<string, Row[]> = {
    profiles: [
      { user_id: KUNDE, email: 'Luca@Kanna.test', full_name: 'Luca Bartosch' },
      { user_id: HEADHUNTER, email: 'danny@example.test', full_name: 'Danny Beispiel' },
    ],
    user_roles: [{ user_id: KUNDE, role: 'client' }, { user_id: HEADHUNTER, role: 'recruiter' }],
    ...opts.tables,
  };
  const calls = { mails: [] as Row[], updates: [] as { table: string; values: Row; filters: [string, unknown][] }[], fetches: 0 };
  const matches = (row: Row, filters: [string, string, unknown][]) => filters.every(([op, k, v]) => {
    const value = k.includes('->>') ? (row[k.split('->>')[0]] as Row | undefined)?.[k.split('->>')[1]] : row[k];
    if (op === 'eq') return value === v;
    if (op === 'ilike') return String(value ?? '').toLowerCase() === String(v).replace(/\\(.)/g, '$1').toLowerCase();
    if (op === 'is') return value === v || (v === null && value === undefined);
    return true;
  });
  const db = {
    from: (table: string) => {
      const filters: [string, string, unknown][] = [];
      let values: Row | null = null;
      const rows = () => (tables[table] ?? []).filter(r => matches(r, filters));
      const q: Record<string, unknown> = {
        select: () => q, limit: () => q, order: () => q, not: () => q, gte: () => q, or: () => q, in: () => q,
        eq: (k: string, v: unknown) => { filters.push(['eq', k, v]); return q; },
        ilike: (k: string, v: unknown) => { filters.push(['ilike', k, v]); return q; },
        is: (k: string, v: unknown) => { filters.push(['is', k, v]); return q; },
        update: (v: Row) => { values = v; return q; },
        insert: (v: Row | Row[]) => { (tables[table] ??= []).push(...(Array.isArray(v) ? v : [v])); return Promise.resolve({ error: null }); },
        maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
        then: (resolve: (r: unknown) => unknown) => {
          if (values) {
            calls.updates.push({ table, values, filters: filters.map(([, k, v]) => [k, v]) });
            for (const r of rows()) Object.assign(r, values);
            return Promise.resolve({ error: null }).then(resolve);
          }
          return Promise.resolve({ data: rows(), error: null }).then(resolve);
        },
      };
      return q;
    },
    auth: { admin: {
      getUserById: (id: string) => Promise.resolve(users[id] ? { data: { user: structuredClone(users[id]) }, error: null } : { data: { user: null }, error: { status: 404 } }),
      generateLink: (args: { email: string }) => {
        const user = Object.values(users).find(u => u.email === args.email);
        return Promise.resolve(user ? { data: { user: structuredClone(user), properties: { hashed_token: 'hashed' } }, error: null } : { data: { user: null }, error: { status: 404 } });
      },
      updateUserById: (id: string, attrs: { app_metadata?: Row }) => {
        const user = users[id];
        for (const [k, v] of Object.entries(attrs.app_metadata ?? {})) { if (v === null) delete user.app_metadata[k]; else user.app_metadata[k] = v; }
        return Promise.resolve({ data: { user: structuredClone(user) }, error: null });
      },
    } },
  } as unknown as SupabaseClient;
  const deps: ClientCodeDeps = {
    limits: () => Promise.resolve({ allowed: opts.allowed ?? true } as LimitResult),
    mail: (_db, args) => { calls.mails.push(args as unknown as Row); return Promise.resolve({ sent: opts.mailSent ?? true }); },
    fetch: () => { calls.fetches += 1; return Promise.resolve(new Response(JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }))); },
    env: key => ({ SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: 'anon' } as Record<string, string>)[key],
  };
  const lastCode = () => String((calls.mails.at(-1) as { subject: string }).subject.split(' ')[0]);
  return { db, deps, calls, users, tables, lastCode };
}

Deno.test('Kundenlink: begrüßt mit vollem Namen, Code geht an die Adresse des Kontos, Anmeldung klappt', async () => {
  const f = fixture();
  const link = await issueLoginLink(f.db, KUNDE, Date.now(), CLIENT_LINK_KEY);
  const peek = await peekClientLink(f.db, link);
  assert(JSON.stringify(peek) === JSON.stringify({ status: 'open', name: 'Luca Bartosch', masked_email: 'lu***@kanna.test' }), JSON.stringify(peek));
  const sent = await sendClientCode(f.db, { link, ip: null }, f.deps);
  const mail = f.calls.mails[0] as { to: string; html: string; template: string; subject: string };
  assert(sent.sent && mail.to === 'luca@kanna.test' && mail.template === 'client_login_code', JSON.stringify(mail.to));
  assert(mail.subject.endsWith('ist Ihr Matchunt-Anmeldecode') && mail.html.includes('Guten Tag Luca Bartosch') && mail.html.includes('melden Sie sich'), 'Sie-Form');
  const stored = f.users[KUNDE].app_metadata[CLIENT_CODE_KEY] as { hash: string };
  assert(stored.hash === await hashCode('luca@kanna.test', f.lastCode()), 'nur der Hash, unter dem Kundenschlüssel');
  const session = await verifyClientCode(f.db, { link, code: f.lastCode(), ip: null }, f.deps);
  assert(session.access_token === 'at' && !f.users[KUNDE].app_metadata[CLIENT_CODE_KEY], 'Code verbraucht, Sitzung da');
  assert((await peekClientLink(f.db, link)).status === 'open', 'Link bleibt nutzbar');
});

Deno.test('Kundenanmeldung ohne Link: unbekannte Adressen und Headhunter bekommen dieselbe Antwort und keine Mail', async () => {
  const f = fixture();
  const fremd = await sendClientCode(f.db, { email: 'fremd@example.test', ip: null }, f.deps);
  const hh = await sendClientCode(f.db, { email: 'danny@example.test', ip: null }, f.deps);
  assert(fremd.sent && hh.sent && f.calls.mails.length === 0, 'neutral, nichts verschickt');
  const kunde = await sendClientCode(f.db, { email: ' LUCA@kanna.test ', ip: null }, f.deps);
  assert(kunde.masked_email === 'lu***@kanna.test' && f.calls.mails.length === 1, 'Schreibweise egal');
  assert(await messageOf(() => verifyClientCode(f.db, { email: 'danny@example.test', code: '123456', ip: null }, f.deps))
    === 'Der Code stimmt nicht. Prüfen Sie ihn oder fordern Sie unten einen neuen an.');
  assert(await reasonOf(() => sendClientCode(f.db, { email: 'kein-at', ip: null }, f.deps)) === 'invalid_request');
  const gebremst = fixture({ allowed: false });
  assert(await reasonOf(() => sendClientCode(gebremst.db, { email: 'luca@kanna.test', ip: null }, gebremst.deps)) === 'rate_limited' && gebremst.calls.mails.length === 0);
});

Deno.test('Headhunter- und Kundenlinks sind getrennt; abgelaufene Links verraten nichts', async () => {
  const f = fixture();
  const hhLink = await issueLoginLink(f.db, HEADHUNTER);
  assert((await peekClientLink(f.db, hhLink)).status === 'invalid', 'Headhunter-Link öffnet die Kundenanmeldung nicht');
  const hhAlsKunde = await issueLoginLink(f.db, HEADHUNTER, Date.now(), CLIENT_LINK_KEY);
  assert((await peekClientLink(f.db, hhAlsKunde)).status === 'invalid', 'ohne Kundenrolle keine Begrüßung');
  const link = await issueLoginLink(f.db, KUNDE, Date.now() - 31 * 86_400_000, CLIENT_LINK_KEY);
  assert(JSON.stringify(await peekClientLink(f.db, link)) === '{"status":"expired"}');
  assert(await reasonOf(() => sendClientCode(f.db, { link, ip: null }, f.deps)) === 'expired' && f.calls.mails.length === 0);
});

Deno.test('Zugangsmail: Titel, Vorgang, Adresse und persönlicher Link; Namen werden maskiert', () => {
  const { subject, html } = clientAccessMail({ name: 'Luca <b>Bartosch</b>', title: 'Arzt / Ärztin', mandateNumber: 'MV-2026-001009', email: 'luca@kanna.test', signed: true }, 'https://matchunt.ai', 'abc.def');
  assert(subject === 'Ihre Position ist auf Matchunt – jetzt loslegen');
  assert(html.includes('https://matchunt.ai/anmelden#abc.def') && html.includes('Jetzt loslegen'), 'Knopf mit Link');
  assert(html.includes('MV-2026-001009') && html.includes('beidseitig unterzeichnet') && html.includes('luca@kanna.test'));
  assert(html.includes('Arzt / Ärztin') && !html.includes('<b>Bartosch</b>'), 'escaped');
  const ohne = clientAccessMail({ name: null, title: 'X', mandateNumber: null, email: 'a@b.de', signed: false }, 'https://matchunt.ai', null);
  assert(ohne.html.includes('https://matchunt.ai/anmelden"') && ohne.html.includes('angenommen') && ohne.html.includes('Adresse ein'), 'ohne Link: Adressfeld');
});

Deno.test('Zugangsmail geht einmal je Auftrag; „erneut senden“ schickt einen neuen Link', async () => {
  const f = fixture();
  const links: string[] = [];
  const deps: AccessDeps = {
    mail: (_db, args) => { f.calls.mails.push(args as unknown as Row); f.tables.email_events = [{ template_name: 'client_access', status: 'sent', metadata: { mandate_id: 'm-1' } }]; return Promise.resolve({ sent: true }); },
    appUrl: () => 'https://matchunt.ai',
    issueLink: async (db, id, now, key) => { const l = await issueLoginLink(db, id, now, key); links.push(l); return l; },
  };
  const args = { userId: KUNDE, email: 'luca@kanna.test', name: 'Luca Bartosch', title: 'Arzt', mandateNumber: 'MV-1', signed: true, mandateId: 'm-1', draftId: 'd-1', jobId: 'j-1' };
  assert((await sendClientAccess(f.db, args, {}, deps)).sent);
  assert(JSON.stringify(await sendClientAccess(f.db, args, {}, deps)) === '{"sent":false,"already":true}', 'kein zweites Mal');
  assert((await sendClientAccess(f.db, args, { resend: true }, deps)).sent && links.length === 2 && links[0] !== links[1]);
  const mail = f.calls.mails[0] as { to: string; template: string; meta: Row };
  assert(mail.to === 'luca@kanna.test' && mail.template === 'client_access' && mail.meta.mandate_id === 'm-1');
  assert(Array.isArray(f.users[KUNDE].app_metadata[CLIENT_LINK_KEY]), 'Link unter dem Kundenschlüssel');
});

Deno.test('Abgleich: stempelt vor der Abfrage, ein Fehler hält die anderen nicht auf, fertige Verträge werden abgelegt', async () => {
  assert(syncDue(null) && !syncDue(new Date().toISOString()) && syncDue(new Date(Date.now() - SYNC_INTERVAL_MS).toISOString()));
  const f = fixture({ tables: { commercial_mandates: [
    { id: 'm-1', envelope_id: 'env-1', envelope_last_synced_at: null },
    { id: 'm-2', envelope_id: 'env-2', envelope_last_synced_at: null },
  ] } });
  const saved: string[] = [];
  const result = await syncClientEnvelopes(f.db, {} as DocuSignConfig, {
    status: (_cfg, id) => id === 'env-1' ? Promise.reject(new Error('503')) : Promise.resolve({ status: 'completed', recipients: { signers: [] } }),
    apply: () => Promise.resolve({ matched: true, customerSigned: true, countersigned: true, declined: false, mandateId: 'm-2', frameworkId: 'rv-1' }),
    saveDocument: (_db, id) => { saved.push(id); return Promise.resolve(); },
  });
  assert(result.checked === 2 && result.results[0].error === '503' && result.results[1].countersigned === true, JSON.stringify(result));
  assert(JSON.stringify(saved) === '["env-2"]', 'nur der fertige Vertrag');
  const stamps = f.calls.updates.filter(u => u.table === 'commercial_mandates' && 'envelope_last_synced_at' in u.values);
  assert(stamps.length === 2, 'beide gestempelt, auch der fehlgeschlagene');
});

Deno.test('Gescheiterte Zugangsmail: Glocke und Mail an Admins, einmal je Aufnahme; Headhunter-Fall getrennt', async () => {
  const f = fixture({ tables: {
    user_roles: [{ user_id: 'admin-1', role: 'admin' }],
    profiles: [{ user_id: 'admin-1', email: 'marko@matchunt.test' }],
    notifications: [],
  } });
  const mails: Row[] = [];
  const deps = { mail: (_db: unknown, args: Row) => { mails.push(args); return Promise.resolve({ sent: true }); }, appUrl: () => 'https://matchunt.ai' } as unknown as Pick<AccessDeps, 'mail' | 'appUrl'>;
  const draft = { id: 'd-1', company_name: 'Kanna Medics', contact_email: 'luca@kanna.test', owner_user_id: null };
  await notifyAccessProblem(f.db, draft, { kind: 'failed', error: 'Resend: 403' }, deps);
  await notifyAccessProblem(f.db, draft, { kind: 'failed', error: 'Resend: 403' }, deps);
  const glocke = f.tables.notifications as { type: string; user_id: string; message: string }[];
  assert(glocke.length === 1 && glocke[0].type === 'client_access_failed' && glocke[0].user_id === 'admin-1' && glocke[0].message.includes('Resend: 403'), JSON.stringify(glocke));
  const mail = mails[0] as { to: string; subject: string; html: string; template: string };
  assert(mails.length === 1 && mail.to === 'marko@matchunt.test' && mail.subject === 'Zugangsmail nicht zugestellt: Kanna Medics', mail.subject);
  assert(mail.html.includes('/admin/intakes/d-1') && mail.html.includes('erneut senden') && mail.template === 'client_access_failed_admin');
  await notifyAccessProblem(f.db, draft, { kind: 'held' }, deps);
  assert(glocke.length === 2 && glocke[1].type === 'client_access_held' && mails.length === 2, 'eigener Anlass, eigene Meldung');
});
