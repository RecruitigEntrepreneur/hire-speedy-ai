import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  checkUrl, cleanChannels, embedCode, expertiseLine, linkedinAddUrl, normalizeNumber, outreachText, PARTNER_ALPHABET, PARTNER_NUMBER, partnerNumber,
  postText, publicView, signatureHtml, siteDomain, versionAtLeast, type PartnerStatusRow,
} from '../functions/_shared/recruiter-partner.ts';
import { grantPartnerStatus, partnerCheck, partnerSettings, partnerSignatureTest, setPartnerActive } from '../functions/_shared/recruiter-partner-service.ts';
import { autoActivateRecruiter } from '../functions/_shared/recruiter-activation.ts';
import { markPathsYDown, MARK_PATHS } from '../functions/_shared/matchunt-mark.ts';
import type { RecruiterEnvelope } from '../functions/_shared/recruiter-onboarding-service.ts';
import type { sendIntakeMail } from '../functions/_shared/intake-mail.ts';

const assert = (v: unknown, m = 'Assertion failed') => { if (!v) throw Error(m); };
const reasonOf = async (work: () => Promise<unknown>) => { try { await work(); } catch (e) { return String((e as { reason?: string }).reason ?? 'thrown'); } return 'none'; };
type MailArgs = Parameters<typeof sendIntakeMail>[1];
const NOW = Date.parse('2026-09-22T10:00:00Z');
const U = '0f8fad5b-d9cb-469f-a165-70867728950e';
const NUMBER = 'MP-7K3Q-92XW';
const status = (over: Partial<PartnerStatusRow> = {}): PartnerStatusRow => ({
  user_id: U, partner_number: NUMBER, tier: 'partner', contract_version: '2.1', granted_at: '2026-09-21T15:30:00Z', ended_at: null, end_reason: null,
  directory_consent_at: null, show_expertise_at: null, channels: {}, website_domain: null, website_seen_at: null, ...over,
});

/** Kleine Tabelle im Speicher: select/eq/order/limit/maybeSingle/update/insert wie supabase-js. */
function fakeDb(tables: Record<string, Record<string, unknown>[]>, opts: { numbers?: string[] } = {}) {
  const writes: { table: string; kind: 'insert' | 'update'; value: Record<string, unknown> }[] = [];
  const numbers = [...(opts.numbers ?? [])];
  const db = {
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      let patch: Record<string, unknown> | null = null;
      let insert: Record<string, unknown> | null = null;
      const rows = () => (tables[table] ??= []).filter(r => filters.every(([k, v]) => r[k] === v));
      const run = (single: boolean) => {
        if (insert) {
          const row = { ...insert };
          if (table === 'recruiter_partner_status') {
            if (!row.partner_number) row.partner_number = numbers.shift() ?? 'MP-2222-2222';
            const all = tables[table] ??= [];
            if (all.some(r => r.user_id === row.user_id || r.partner_number === row.partner_number)) return { data: null, error: { code: '23505', message: 'duplicate' } };
            all.push({ ...status({ user_id: String(row.user_id) }), ...row });
          } else (tables[table] ??= []).push(row);
          writes.push({ table, kind: 'insert', value: insert });
          return { data: null, error: null };
        }
        if (patch) {
          const hit = rows();
          hit.forEach(r => Object.assign(r, patch));
          writes.push({ table, kind: 'update', value: patch });
          return { data: single ? hit[0] ?? null : hit, error: null };
        }
        const hit = rows();
        return { data: single ? hit[0] ?? null : hit, error: null };
      };
      const q: Record<string, unknown> = {
        select: () => q, order: () => q, limit: () => q,
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
        update: (p: Record<string, unknown>) => { patch = p; return q; },
        insert: (p: Record<string, unknown>) => { insert = p; return q; },
        maybeSingle: async () => run(true),
        single: async () => run(true),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(run(false)).then(resolve),
      };
      return q;
    },
  } as unknown as SupabaseClient;
  return { db, writes, tables };
}
const user = { id: U, email: 'marko.benko@freenet.de' } as User;

Deno.test('partner numbers: MP-XXXX-XXXX, no 0/1/I/L/O/U, every character equally likely', () => {
  assert(PARTNER_ALPHABET.length === 30 && !/[01ILOU]/.test(PARTNER_ALPHABET));
  for (let i = 0; i < 200; i++) assert(PARTNER_NUMBER.test(partnerNumber()), 'format');
  // Bytes ab 240 fallen weg: 240 → verworfen, 0 → '2', 29 → 'Z', 30 → '2'.
  let calls = 0;
  const n = partnerNumber(() => { calls++; return Uint8Array.from([240, 255, 0, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]); });
  assert(n === 'MP-2Z23-4567' && calls === 1, n);
  assert(normalizeNumber(' mp-7k3q-92xw ') === NUMBER && !PARTNER_NUMBER.test('MP-7K3Q-92X0') && !PARTNER_NUMBER.test('MP-7K3Q-92XI'));
});

Deno.test('only contracts from 2.1 on carry the brand licence', () => {
  assert(versionAtLeast('2.1') && versionAtLeast('2.2') && versionAtLeast('3') && versionAtLeast('2.10'));
  assert(!versionAtLeast('2.0') && !versionAtLeast('1.9') && !versionAtLeast('2') && !versionAtLeast('v2.1') && !versionAtLeast('') && !versionAtLeast(undefined));
});

Deno.test('LinkedIn: no certificate link without the company page; with it, all fields and no expiry', () => {
  assert(linkedinAddUrl({ number: NUMBER, grantedAt: '2026-09-21T15:30:00Z' }) === null, 'page not there yet');
  const url = new URL(linkedinAddUrl({ number: NUMBER, grantedAt: '2026-09-30T23:30:00Z', organizationId: '123456' })!);
  const p = url.searchParams;
  assert(url.origin === 'https://www.linkedin.com' && p.get('startTask') === 'CERTIFICATION_NAME' && p.get('name') === 'Matchunt Partner');
  assert(p.get('organizationId') === '123456' && p.get('certId') === NUMBER && p.get('certUrl') === checkUrl(NUMBER));
  assert(p.get('issueYear') === '2026' && p.get('issueMonth') === '10', 'Berlin time: already October');
  assert(!p.has('expirationYear') && !p.has('expirationMonth'));
  assert(new URL(linkedinAddUrl({ number: NUMBER, grantedAt: '2026-09-21T10:00:00Z', tier: 'gold', organizationId: '1' })!).searchParams.get('name') === 'Matchunt Gold Partner');
});

Deno.test('signature: same image for everyone, number and check link as real text', () => {
  const html = signatureHtml({ number: NUMBER });
  assert(html.includes('src="https://matchunt.ai/badges/partner-light@2x.png"') && !html.match(/src="[^"]*MP-/), 'no number in the image address');
  assert(html.includes(`href="${checkUrl(NUMBER)}"`) && html.includes(`Nr. ${NUMBER}`) && html.includes('Status prüfen') && html.includes('alt="Matchunt Partner"'));
  assert(signatureHtml({ number: NUMBER, lang: 'en' }).includes('Verify status') && signatureHtml({ number: NUMBER, tier: 'gold' }).includes('/badges/gold@2x.png'));
  assert(embedCode(NUMBER) === `<script src="https://matchunt.ai/badge.js" async></script>\n<matchunt-badge partner="${NUMBER}"></matchunt-badge>`);
  assert(embedCode(NUMBER, { theme: 'dark', size: 's' }).includes('partner="MP-7K3Q-92XW" theme="dark" size="s"'));
});

Deno.test('texts: formal and informal, English, never naming clients', () => {
  assert(outreachText({ number: NUMBER, lang: 'de', formal: true, long: true }).includes('können Sie jederzeit hier prüfen: matchunt.ai/partner/MP-7K3Q-92XW'));
  assert(outreachText({ number: NUMBER, lang: 'de', formal: false, long: true }).includes('kannst du'));
  assert(outreachText({ number: NUMBER, lang: 'en', formal: true, long: false }).startsWith('I work as an independent headhunter'));
  assert(postText({ number: NUMBER, lang: 'de', focus: 'Finance & Controlling' }).includes('Schwerpunkt: Finance & Controlling. Mein Partnerstatus ist hier öffentlich prüfbar: https://matchunt.ai/partner/MP-7K3Q-92XW'));
  assert(!postText({ number: NUMBER, lang: 'de' }).includes('Schwerpunkt'));
  assert(expertiseLine({ areas: ['Finance & Controlling'], extras: [], levels: ['Fach', 'Führung'] }) === 'Finance & Controlling · Fach, Führung');
});

Deno.test('websites: only real domains are remembered', () => {
  assert(siteDomain('https://www.bluewater-bridge.de') === 'bluewater-bridge.de' && siteDomain('https://recruiting.example.com:8443') === 'recruiting.example.com');
  for (const o of ['https://matchunt.ai', 'https://app.matchunt.ai', 'https://x.lovable.app', 'http://localhost:5173', 'http://127.0.0.1', 'http://192.168.0.2', 'null', '', null]) assert(siteDomain(o) === null, String(o));
  assert(JSON.stringify(cleanChannels({ linkedin: '2026-09-22T10:00:00Z', signature: 'kaputt', website: '2026-09-22T10:00:00Z', post: 3 })) === '{"linkedin":"2026-09-22T10:00:00Z"}');
});

Deno.test('check page: active with minimal data, expertise only with consent, paused without name, ended for six months', () => {
  const person = { name: 'Marko Benko', company: 'Bluewater & Bridge GmbH', suspended: false, expertise: 'Finance & Controlling · Fach' };
  const active = publicView(status(), person, NOW);
  assert(active.state === 'active' && active.name === 'Marko Benko' && active.expertise === null && active.since === '2026-09-21T15:30:00Z');
  const withConsent = publicView(status({ show_expertise_at: '2026-09-22T09:00:00Z' }), person, NOW);
  assert(withConsent.state === 'active' && withConsent.expertise === 'Finance & Controlling · Fach');
  const paused = publicView(status(), { ...person, suspended: true }, NOW);
  assert(paused.state === 'paused' && !('name' in paused));
  assert(publicView(status({ ended_at: '2026-06-01T00:00:00Z', end_reason: 'revoked' }), null, NOW).state === 'ended');
  assert(publicView(status({ ended_at: '2026-01-01T00:00:00Z', end_reason: 'revoked' }), null, NOW).state === 'invalid', 'after six months only invalid');
  assert(publicView(null, null, NOW).state === 'invalid');
});

Deno.test('granting: from 2.1 on, once per account, the number comes from the database, a clash is retried', async () => {
  const f = fakeDb({});
  assert(await grantPartnerStatus(f.db, { userId: U, version: '2.0' }) === 'skipped' && !f.writes.length, 'old contract');
  assert(await grantPartnerStatus(f.db, { userId: U, version: '2.1', since: '2026-09-21T15:30:00Z' }) === 'granted');
  const row = f.tables.recruiter_partner_status[0];
  assert(row.granted_at === '2026-09-21T15:30:00Z' && row.contract_version === '2.1' && PARTNER_NUMBER.test(String(row.partner_number)));
  assert(await grantPartnerStatus(f.db, { userId: U, version: '2.2' }) === 'exists' && f.tables.recruiter_partner_status[0].contract_version === '2.2', 'newer contract, same number');
  const clash = fakeDb({ recruiter_partner_status: [{ ...status({ user_id: 'other' }), partner_number: 'MP-3333-3333' }] }, { numbers: ['MP-3333-3333', 'MP-4444-4444'] });
  assert(await grantPartnerStatus(clash.db, { userId: U, version: '2.1' }) === 'granted' && clash.tables.recruiter_partner_status[1].partner_number === 'MP-4444-4444');
  const broken = { from: () => { throw Error('down'); } } as unknown as SupabaseClient;
  assert(await grantPartnerStatus(broken, { userId: U, version: '2.1' }) === 'skipped', 'never throws');
});

Deno.test('activation after countersigning also grants the partner status, even for an account that was already active', async () => {
  const caseRow = { id: 'case-1', state: 'approved', revoked_at: null, claimed_by: U, email: 'm@example.test', profile: { name: 'Marko Benko' } };
  const envelope = { id: 'env-1', case_id: 'case-1', state: 'completed', package_version: '2.1', countersigned_at: '2026-09-21T15:30:00Z', counter_email: 'x@matchunt.ai' } as unknown as RecruiterEnvelope;
  const mails: MailArgs[] = [];
  const deps = { mail: (async (_db: SupabaseClient, a: MailArgs) => { mails.push(a); return { sent: true }; }) as typeof sendIntakeMail, appUrl: () => 'https://matchunt.ai', issueLink: async () => null as unknown as string };
  const fresh = fakeDb({ recruiter_onboarding_cases: [caseRow], user_roles: [{ user_id: U, role: 'recruiter', verified: false }], profiles: [{ user_id: U, full_name: 'Marko Benko', company_name: 'X' }] });
  await autoActivateRecruiter(fresh.db, envelope, deps);
  assert(fresh.tables.recruiter_partner_status?.length === 1 && mails.length === 1, 'granted and welcomed');
  const already = fakeDb({ recruiter_onboarding_cases: [caseRow], user_roles: [{ user_id: U, role: 'recruiter', verified: true }] });
  await autoActivateRecruiter(already.db, envelope, deps);
  assert(already.tables.recruiter_partner_status?.length === 1 && mails.length === 1, 'granted, no second welcome');
  const old = fakeDb({ recruiter_onboarding_cases: [caseRow], user_roles: [{ user_id: U, role: 'recruiter', verified: true }] });
  await autoActivateRecruiter(old.db, { ...envelope, package_version: '2.0' } as RecruiterEnvelope, deps);
  assert(!old.tables.recruiter_partner_status?.length, 'old contract: no status');
});

Deno.test('settings: consents and channels get server timestamps; ended status cannot be changed', async () => {
  const f = fakeDb({ recruiter_partner_status: [status()] });
  const a = await partnerSettings(f.db, user, { directory: true, expertise: true }, () => NOW);
  assert(a.directory_consent_at === '2026-09-22T10:00:00.000Z' && a.show_expertise_at === '2026-09-22T10:00:00.000Z');
  const b = await partnerSettings(f.db, user, { channel: 'signature', done: true }, () => NOW + 1000);
  assert(b.channels.signature === '2026-09-22T10:00:01.000Z' && b.directory_consent_at === '2026-09-22T10:00:00.000Z', 'consent keeps its first date');
  const c = await partnerSettings(f.db, user, { channel: 'signature', done: false, directory: false }, () => NOW);
  assert(!c.channels.signature && c.directory_consent_at === null);
  assert(await reasonOf(() => partnerSettings(f.db, user, { channel: 'website', done: true })) === 'invalid_request');
  assert(await reasonOf(() => partnerSettings(f.db, user, {})) === 'invalid_request');
  const ended = fakeDb({ recruiter_partner_status: [status({ ended_at: '2026-09-01T00:00:00Z', end_reason: 'revoked' })] });
  assert(await reasonOf(() => partnerSettings(ended.db, user, { directory: true })) === 'conflict');
  assert(await reasonOf(() => partnerSettings(fakeDb({}).db, user, { directory: true })) === 'not_found');
});

Deno.test('public check: invalid input, unknown number, active person, paused account, website remembered hourly', async () => {
  const tables = () => ({
    recruiter_partner_status: [status({ show_expertise_at: '2026-09-22T09:00:00Z' })],
    profiles: [{ user_id: U, full_name: 'Marko Benko', company_name: 'Bluewater & Bridge GmbH', recruiter_expertise: null }],
    user_roles: [{ user_id: U, role: 'recruiter', status: 'active', verified: true }],
    recruiter_onboarding_cases: [{ claimed_by: U, profile: { expertise: { areas: ['Finance & Controlling'], levels: ['Fach', 'Führung'] } } }],
  });
  const f = fakeDb(tables());
  assert((await partnerCheck(f.db, { number: 'kein' }, null, NOW)).state === 'invalid' && !f.writes.length);
  assert((await partnerCheck(f.db, { number: 'MP-2222-2222' }, null, NOW)).state === 'invalid');
  const a = await partnerCheck(f.db, { number: 'mp-7k3q-92xw' }, null, NOW);
  assert(a.state === 'active' && a.company === 'Bluewater & Bridge GmbH' && a.expertise === 'Finance & Controlling · Fach, Führung', JSON.stringify(a));
  assert(!f.writes.length, 'no embed, nothing written');
  await partnerCheck(f.db, { number: NUMBER, embed: '1' }, 'https://www.bluewater-bridge.de', NOW);
  assert(f.tables.recruiter_partner_status[0].website_domain === 'bluewater-bridge.de' && f.writes.length === 1);
  await partnerCheck(f.db, { number: NUMBER, embed: '1' }, 'https://www.bluewater-bridge.de', NOW + 60_000);
  assert(f.writes.length === 1, 'within the hour: no second write');
  await partnerCheck(f.db, { number: NUMBER, embed: '1' }, 'https://matchunt.ai', NOW + 7_200_000);
  assert(f.writes.length === 1, 'Matchunt itself is not a partner website');
  const suspended = tables();
  suspended.user_roles[0].status = 'suspended';
  const p = await partnerCheck(fakeDb(suspended).db, { number: NUMBER }, null, NOW);
  assert(p.state === 'paused' && !('name' in p));
});

Deno.test('test mail goes only to the own address; Matchunt can end and restore the status', async () => {
  const mails: MailArgs[] = [];
  const f = fakeDb({ recruiter_partner_status: [status()], profiles: [{ user_id: U, full_name: 'Marko <b>Benko</b>', company_name: 'Bluewater & Bridge GmbH' }] });
  const r = await partnerSignatureTest(f.db, user, { lang: 'de' }, { mail: (async (_db: SupabaseClient, a: MailArgs) => { mails.push(a); return { sent: true }; }) as typeof sendIntakeMail });
  assert(r.to === 'marko.benko@freenet.de' && mails.length === 1 && mails[0].to === 'marko.benko@freenet.de' && mails[0].template === 'recruiter_partner_signature_test');
  assert(String(mails[0].html).includes(`Nr. ${NUMBER}`) && !String(mails[0].html).includes('<b>Benko</b>'), 'escaped');
  const ended = await setPartnerActive(f.db, { user_id: U, active: false }, () => NOW);
  assert(ended.ended_at === '2026-09-22T10:00:00.000Z' && ended.end_reason === 'revoked');
  const back = await setPartnerActive(f.db, { user_id: U, active: true }, () => NOW);
  assert(back.ended_at === null && back.end_reason === null);
  assert(await reasonOf(() => setPartnerActive(f.db, { user_id: 'x', active: true })) === 'invalid_request');
  assert(await reasonOf(() => setPartnerActive(fakeDb({}).db, { user_id: U, active: true })) === 'not_found');
});

Deno.test('the Matchunt mark converts to y-down paths inside the 1000 × 600 box', () => {
  const paths = markPathsYDown();
  assert(paths.length === MARK_PATHS.length && paths.every(p => p.startsWith('M ') && p.trim().endsWith('z')));
  const [x, y] = paths[0].split(' ').slice(1, 3).map(Number);
  assert(x > 0 && x < 1000 && y > 0 && y < 600, `${x} ${y}`);
});
