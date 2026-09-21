import { peekCase, peekLoginLink, sendCode, verifyCode, caseStatus, CODE_MAX_ATTEMPTS, type CodeDeps } from '../functions/_shared/recruiter-code.ts';
import { issueLoginLink, LOGIN_LINK_KEY } from '../functions/_shared/recruiter-login-link.ts';
import { hashToken, hashCode } from '../functions/_shared/tokens.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { LimitResult } from '../functions/_shared/intake-limits.ts';

const assert = (v: unknown, msg = 'Assertion failed') => { if (!v) throw Error(msg); };
const reasonOf = async (work: () => Promise<unknown>): Promise<string> => {
  try { await work(); } catch (e) { return String((e as { reason?: string })?.reason ?? 'thrown'); }
  return 'none';
};
const messageOf = async (work: () => Promise<unknown>): Promise<string> => {
  try { await work(); } catch (e) { return String((e as Error).message); }
  return '';
};
const TOKEN = 'A'.repeat(43);
const OTHER = 'B'.repeat(43);

interface FakeUser { id: string; email: string; app_metadata: Record<string, unknown>; user_metadata: Record<string, unknown> }

async function fixture(opts: { cases?: Record<string, unknown>[]; users?: string[]; recruiters?: string[]; ids?: Record<string, string>; allowed?: boolean; mailSent?: boolean; verify?: { status: number; body?: unknown } } = {}) {
  const idOf = (email: string) => opts.ids?.[email] ?? `id-${email}`;
  const cases = opts.cases ?? [];
  const users: Record<string, FakeUser> = {};
  for (const email of [...(opts.users ?? []), ...(opts.recruiters ?? [])]) users[email] = { id: idOf(email), email, app_metadata: { provider: 'email' }, user_metadata: {} };
  // Bestehende Headhunter-Konten, wie die Anmeldeseite sie nachschlägt: Profil und Rolle.
  const profiles = (opts.recruiters ?? []).map(email => ({ user_id: idOf(email), email, full_name: 'Danny Beispiel' }));
  const roles = (opts.recruiters ?? []).map(email => ({ user_id: idOf(email), role: 'recruiter' }));
  const calls = { createUser: [] as Record<string, unknown>[], links: 0, updates: [] as { id: string; attrs: Record<string, unknown> }[], mails: [] as Record<string, unknown>[], fetches: [] as { url: string; init?: RequestInit }[] };
  const db = {
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
        limit: () => q,
        maybeSingle: () => Promise.resolve({ data: ((table === 'recruiter_onboarding_cases' ? cases : table === 'profiles' ? profiles : table === 'user_roles' ? roles : []) as Record<string, unknown>[]).find(r => filters.every(([k, v]) => r[k] === v)) ?? null, error: null }),
      };
      return q;
    },
    auth: { admin: {
      createUser: (args: { email: string; user_metadata: Record<string, unknown> }) => {
        calls.createUser.push(args);
        if (users[args.email]) return Promise.resolve({ data: { user: null }, error: { code: 'email_exists', message: 'A user with this email address has already been registered', status: 422 } });
        users[args.email] = { id: `id-${args.email}`, email: args.email, app_metadata: { provider: 'email' }, user_metadata: args.user_metadata };
        return Promise.resolve({ data: { user: structuredClone(users[args.email]) }, error: null });
      },
      generateLink: (args: { email: string }) => {
        calls.links += 1;
        const user = users[args.email];
        if (!user) return Promise.resolve({ data: { properties: null, user: null }, error: { message: 'User not found', status: 404 } });
        return Promise.resolve({ data: { properties: { hashed_token: `hashed-${calls.links}`, email_otp: '00000000', action_link: 'https://example.test/link' }, user: structuredClone(user) }, error: null });
      },
      getUserById: (id: string) => {
        const user = Object.values(users).find(u => u.id === id);
        return Promise.resolve(user ? { data: { user: structuredClone(user) }, error: null } : { data: { user: null }, error: { message: 'User not found', status: 404 } });
      },
      // Wie GoTrue: Schlüssel werden zusammengeführt, null löscht.
      updateUserById: (id: string, attrs: { app_metadata?: Record<string, unknown> }) => {
        calls.updates.push({ id, attrs });
        const user = Object.values(users).find(u => u.id === id);
        if (!user) return Promise.resolve({ data: { user: null }, error: { message: 'User not found', status: 404 } });
        for (const [k, v] of Object.entries(attrs.app_metadata ?? {})) { if (v === null) delete user.app_metadata[k]; else user.app_metadata[k] = v; }
        return Promise.resolve({ data: { user: structuredClone(user) }, error: null });
      },
    } },
  } as unknown as SupabaseClient;
  const deps: CodeDeps = {
    limits: () => Promise.resolve({ allowed: opts.allowed ?? true, retryAt: opts.allowed === false ? new Date('2026-09-15T10:15:00Z') : undefined } as LimitResult),
    mail: (_db, args) => { calls.mails.push(args); return Promise.resolve({ sent: opts.mailSent ?? true }); },
    fetch: (input, init) => {
      calls.fetches.push({ url: String(input), init });
      const v = opts.verify ?? { status: 200, body: { access_token: 'at', refresh_token: 'rt', expires_in: 3600 } };
      return Promise.resolve(new Response(v.body === undefined ? null : JSON.stringify(v.body), { status: v.status }));
    },
    env: key => ({ SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: 'anon' } as Record<string, string>)[key],
  };
  const lastCode = () => String((calls.mails.at(-1) as { subject: string }).subject.split(' ')[0]);
  const storedCode = (email: string) => users[email]?.app_metadata.recruiter_code as { hash: string; expires_at: string; attempts: number } | undefined;
  return { db, calls, deps, users, lastCode, storedCode };
}
const invite = async (extra: Record<string, unknown> = {}) => ({
  id: 'case-1', token_hash: await hashToken(TOKEN), email: 'marko@example.test', profile: { name: 'Marko Benko' },
  revoked_at: null, claimed_by: null, expires_at: '2999-01-01T00:00:00Z', ...extra,
});

Deno.test('peek shows first name, masked address and status, never the address itself', async () => {
  const f = await fixture({ cases: [await invite()] });
  const p = await peekCase(f.db, TOKEN);
  assert(p.name === 'Marko' && p.masked_email === 'ma***@example.test' && p.status === 'open', JSON.stringify(p));
  assert(!JSON.stringify(p).includes('marko@example.test'));
  assert(caseStatus({ revoked_at: '2026-01-01', claimed_by: null, expires_at: '2999-01-01' }) === 'revoked');
  assert(caseStatus({ revoked_at: null, claimed_by: 'u', expires_at: '2000-01-01' }) === 'claimed');
  assert(caseStatus({ revoked_at: null, claimed_by: null, expires_at: '2000-01-01' }) === 'expired');
  assert(await reasonOf(() => peekCase(f.db, OTHER)) === 'not_found');
  assert(await reasonOf(() => peekCase(f.db, 'short')) === 'invalid_request');
  assert(await reasonOf(() => peekCase(f.db, 42)) === 'invalid_request');
});

Deno.test('code with invitation creates a recruiter account, stores only a hash and mails six digits to the invitation address', async () => {
  const f = await fixture({ cases: [await invite()] });
  const r = await sendCode(f.db, { token: TOKEN, ip: '1.1.1.1' }, f.deps);
  assert(r.sent && r.masked_email === 'ma***@example.test' && r.code_length === 6);
  const created = f.calls.createUser[0] as { email: string; email_confirm: boolean; user_metadata: { role: string; full_name: string } };
  assert(created.email === 'marko@example.test' && created.email_confirm === false && created.user_metadata.role === 'recruiter' && created.user_metadata.full_name === 'Marko');
  const mail = f.calls.mails[0] as { to: string; subject: string; html: string; template: string };
  const code = f.lastCode();
  assert(/^\d{6}$/.test(code) && mail.to === 'marko@example.test' && mail.html.includes(code) && mail.html.includes('eine Stunde') && mail.template === 'recruiter_onboarding_code');
  const stored = f.storedCode('marko@example.test');
  assert(stored && stored.hash === await hashCode('marko@example.test', code) && stored.attempts === 0, 'hash stored in app_metadata');
  assert(stored && !JSON.stringify(stored).includes(code), 'code itself is never stored');
  const minutes = (Date.parse(stored!.expires_at) - Date.now()) / 60000;
  assert(minutes > 59 && minutes <= 60, `valid for an hour, got ${minutes}`);
  assert(f.calls.links === 0, 'no lookup link needed for a freshly created account');
});

Deno.test('code reuses an existing account and replaces the previous code; expired, revoked and rate-limited requests send nothing; a claimed case may continue', async () => {
  const f = await fixture({ cases: [await invite()], users: ['marko@example.test'] });
  assert((await sendCode(f.db, { token: TOKEN, ip: null }, f.deps)).sent && f.calls.mails.length === 1 && f.calls.links === 1);
  const first = f.storedCode('marko@example.test')!.hash;
  await sendCode(f.db, { token: TOKEN, ip: null }, f.deps);
  assert(f.storedCode('marko@example.test')!.hash !== first && f.users['marko@example.test'].app_metadata.provider === 'email', 'new code replaces the old one, other metadata stays');
  const blocked: [Awaited<ReturnType<typeof fixture>>, string][] = [
    [await fixture({ cases: [await invite({ expires_at: '2000-01-01' })] }), 'expired'],
    [await fixture({ cases: [await invite({ revoked_at: '2026-01-01' })] }), 'revoked'],
    [await fixture({ cases: [await invite()], allowed: false }), 'rate_limited'],
    [await fixture({ cases: [] }), 'not_found'],
  ];
  for (const [fx, reason] of blocked) {
    assert(await reasonOf(() => sendCode(fx.db, { token: TOKEN, ip: null }, fx.deps)) === reason, `expected ${reason}`);
    assert(fx.calls.mails.length === 0 && fx.calls.createUser.length === 0, `no side effects for ${reason}`);
  }
  const claimed = await fixture({ cases: [await invite({ claimed_by: 'u', expires_at: '2000-01-01' })], users: ['marko@example.test'] });
  assert((await sendCode(claimed.db, { token: TOKEN, ip: null }, claimed.deps)).sent);
});

Deno.test('code without invitation needs a plausible address; a failed mail is reported, not swallowed', async () => {
  const f = await fixture();
  assert(await reasonOf(() => sendCode(f.db, { email: 'nope', ip: null }, f.deps)) === 'invalid_request' && f.calls.mails.length === 0);
  assert((await sendCode(f.db, { email: ' Neu@Example.test ', ip: null }, f.deps)).masked_email === 'ne***@example.test');
  assert((f.calls.mails[0] as { to: string }).to === 'neu@example.test' && (f.calls.createUser[0] as { user_metadata: { full_name: string } }).user_metadata.full_name === '');
  const failing = await fixture({ mailSent: false });
  assert(await reasonOf(() => sendCode(failing.db, { email: 'neu@example.test', ip: null }, failing.deps)) === 'upstream_error');
});

Deno.test('verify checks our code, clears it and turns the one-time token into a session', async () => {
  const f = await fixture({ cases: [await invite()] });
  await sendCode(f.db, { token: TOKEN, ip: null }, f.deps);
  const code = f.lastCode();
  const s = await verifyCode(f.db, { token: TOKEN, code: `${code.slice(0, 3)} ${code.slice(3)}`, ip: null }, f.deps);
  assert(s.access_token === 'at' && s.refresh_token === 'rt' && s.expires_in === 3600);
  const call = f.calls.fetches[0];
  const sent = JSON.parse(String(call.init?.body));
  assert(call.url === 'https://proj.supabase.co/auth/v1/verify' && call.init?.method === 'POST');
  assert(sent.type === 'magiclink' && sent.token_hash === 'hashed-1' && sent.email === undefined && sent.token === undefined, JSON.stringify(sent));
  assert((call.init?.headers as Record<string, string>).apikey === 'anon');
  assert(f.storedCode('marko@example.test') === undefined, 'code removed after use');
  assert(await reasonOf(() => verifyCode(f.db, { token: TOKEN, code, ip: null }, f.deps)) === 'invalid_request', 'a used code does not work twice');
  assert(f.calls.fetches.length === 1, 'no session without a valid code');
});

Deno.test('verify counts attempts, kills the code after five, rejects expired codes and bad input', async () => {
  const f = await fixture({ cases: [await invite()] });
  await sendCode(f.db, { token: TOKEN, ip: null }, f.deps);
  const code = f.lastCode();
  const wrong = code === '000000' ? '000001' : '000000';
  for (let i = 1; i < CODE_MAX_ATTEMPTS; i++) {
    assert(await reasonOf(() => verifyCode(f.db, { token: TOKEN, code: wrong, ip: null }, f.deps)) === 'invalid_request');
    assert(f.storedCode('marko@example.test')?.attempts === i, `attempt ${i} counted`);
  }
  assert((await messageOf(() => verifyCode(f.db, { token: TOKEN, code: wrong, ip: null }, f.deps))).startsWith('Zu oft'));
  assert(f.storedCode('marko@example.test') === undefined, 'code removed after the fifth failure');
  assert(await reasonOf(() => verifyCode(f.db, { token: TOKEN, code, ip: null }, f.deps)) === 'invalid_request', 'even the right code is dead now');
  assert(f.calls.fetches.length === 0);
  const expired = await fixture({ cases: [await invite()] });
  await sendCode(expired.db, { token: TOKEN, ip: null }, expired.deps);
  expired.users['marko@example.test'].app_metadata.recruiter_code = { ...expired.storedCode('marko@example.test')!, expires_at: '2000-01-01T00:00:00Z' };
  assert(await reasonOf(() => verifyCode(expired.db, { token: TOKEN, code: expired.lastCode(), ip: null }, expired.deps)) === 'invalid_request');
  assert(expired.storedCode('marko@example.test') === undefined, 'expired code removed');
  const g = await fixture({ cases: [await invite()], users: ['marko@example.test'] });
  assert(await reasonOf(() => verifyCode(g.db, { token: TOKEN, code: '12', ip: null }, g.deps)) === 'invalid_request');
  assert(await reasonOf(() => verifyCode(g.db, { token: TOKEN, code: '12345678', ip: null }, g.deps)) === 'invalid_request');
  assert(g.calls.links === 0, 'malformed input never reaches Supabase');
  assert(await reasonOf(() => verifyCode(g.db, { token: TOKEN, code: '123456', ip: null }, g.deps)) === 'invalid_request', 'no code stored');
  const limited = await fixture({ cases: [await invite()], users: ['marko@example.test'], allowed: false });
  assert(await reasonOf(() => verifyCode(limited.db, { token: TOKEN, code: '123456', ip: null }, limited.deps)) === 'rate_limited');
  const noEnv = await fixture({ cases: [await invite()], users: ['marko@example.test'] });
  noEnv.deps.env = () => undefined;
  assert(await reasonOf(() => verifyCode(noEnv.db, { token: TOKEN, code: '123456', ip: null }, noEnv.deps)) === 'not_deployed');
});

Deno.test('verify by address works for the website entry and reports a failed session issue', async () => {
  const f = await fixture();
  await sendCode(f.db, { email: 'Neu@Example.test', ip: null }, f.deps);
  assert((await verifyCode(f.db, { email: 'neu@example.test', code: f.lastCode(), ip: null }, f.deps)).access_token === 'at');
  const broken = await fixture({ verify: { status: 500, body: { msg: 'boom' } } });
  await sendCode(broken.db, { email: 'neu@example.test', ip: null }, broken.deps);
  assert(await reasonOf(() => verifyCode(broken.db, { email: 'neu@example.test', code: broken.lastCode(), ip: null }, broken.deps)) === 'upstream_error');
});

Deno.test('login sends a code only to existing recruiters, never creates an account and answers the same for unknown addresses', async () => {
  const f = await fixture({ recruiters: ['danny@example.test'] });
  const known = await sendCode(f.db, { email: 'Danny@Example.test', ip: null, login: true }, f.deps);
  const mail = f.calls.mails[0] as { to: string; html: string };
  assert(known.sent && mail.to === 'danny@example.test' && mail.html.includes('Dein Anmeldecode') && mail.html.includes('meldest du dich bei Matchunt an') && mail.html.includes('Hallo Danny'), 'login mail');
  assert(f.calls.createUser.length === 0 && f.calls.links === 0, 'login neither creates nor looks up through auth');
  assert(f.storedCode('danny@example.test')?.attempts === 0, 'code stored for the existing account');
  const unknown = await sendCode(f.db, { email: 'fremd@example.test', ip: null, login: true }, f.deps);
  assert(unknown.sent && unknown.masked_email === 'fr***@example.test' && unknown.code_length === 6, 'same answer for unknown addresses');
  assert(f.calls.mails.length === 1 && f.calls.createUser.length === 0 && f.calls.updates.length === 1, 'no mail, no account, no code for an unknown address');
});

Deno.test('login verify turns a valid code into a session and rejects unknown addresses without touching auth', async () => {
  const f = await fixture({ recruiters: ['danny@example.test'] });
  await sendCode(f.db, { email: 'danny@example.test', ip: null, login: true }, f.deps);
  const s = await verifyCode(f.db, { email: 'danny@example.test', code: f.lastCode(), ip: null, login: true }, f.deps);
  assert(s.access_token === 'at' && s.refresh_token === 'rt', 'session for the recruiter');
  const g = await fixture();
  assert(await messageOf(() => verifyCode(g.db, { email: 'fremd@example.test', code: '123456', ip: null, login: true }, g.deps)) === 'Der Code ist falsch oder abgelaufen. Fordere einfach einen neuen an.');
  assert(g.calls.links === 0 && g.calls.createUser.length === 0, 'nothing created or looked up for an unknown address');
});

// Konto-IDs wie in Supabase (UUID), damit der Link dem echten Format entspricht.
const DANNY = '0f8fad5b-d9cb-469f-a165-70867728950e';
const CUSTOMER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const linkFixture = () => fixture({ recruiters: ['danny@example.test'], users: ['kunde@example.test'], ids: { 'danny@example.test': DANNY, 'kunde@example.test': CUSTOMER } });

Deno.test('a login link greets by first name and sends the code to the account address, without typing it', async () => {
  const f = await linkFixture();
  const link = await issueLoginLink(f.db, DANNY);
  assert(link.startsWith(`${DANNY}.`) && link.length === 36 + 1 + 43, link);
  const stored = f.users['danny@example.test'].app_metadata[LOGIN_LINK_KEY] as { hash: string; expires_at: string }[];
  assert(stored.length === 1 && !JSON.stringify(stored).includes(link.split('.')[1]), 'only the hash is stored');
  const days = (Date.parse(stored[0].expires_at) - Date.now()) / 86_400_000;
  assert(days > 29.9 && days <= 30, `valid for 30 days, got ${days}`);
  const p = await peekLoginLink(f.db, link);
  assert(JSON.stringify(p) === JSON.stringify({ status: 'open', name: 'Danny', masked_email: 'da***@example.test' }), JSON.stringify(p));
  const sent = await sendCode(f.db, { link, ip: null }, f.deps);
  const mail = f.calls.mails[0] as { to: string; html: string };
  assert(sent.sent && sent.masked_email === 'da***@example.test' && mail.to === 'danny@example.test' && mail.html.includes('Dein Anmeldecode'), 'code goes to the account, as a login code');
  assert(f.calls.createUser.length === 0, 'a link never creates an account');
  const s = await verifyCode(f.db, { link, code: f.lastCode(), ip: null }, f.deps);
  assert(s.access_token === 'at', 'the code from the mail signs in');
  assert((await peekLoginLink(f.db, link)).status === 'open', 'the link stays usable after a sign-in');
});

Deno.test('expired, tampered or foreign links reveal nothing and send nothing', async () => {
  const f = await linkFixture();
  const link = await issueLoginLink(f.db, DANNY);
  const tampered = `${DANNY}.${'C'.repeat(43)}`;
  for (const bad of [tampered, 'kaputt', 42, `${DANNY}.${link.split('.')[1]}x`]) {
    assert(JSON.stringify(await peekLoginLink(f.db, bad)) === '{"status":"invalid"}', `invalid: ${bad}`);
  }
  assert(await reasonOf(() => sendCode(f.db, { link: tampered, ip: null }, f.deps)) === 'not_found' && f.calls.mails.length === 0);
  const customer = await issueLoginLink(f.db, CUSTOMER);
  assert((await peekLoginLink(f.db, customer)).status === 'invalid', 'no recruiter role, no greeting');
  const stored = f.users['danny@example.test'].app_metadata[LOGIN_LINK_KEY] as { expires_at: string }[];
  stored[0].expires_at = '2000-01-01T00:00:00Z';
  assert(JSON.stringify(await peekLoginLink(f.db, link)) === '{"status":"expired"}');
  assert(await reasonOf(() => sendCode(f.db, { link, ip: null }, f.deps)) === 'expired' && f.calls.mails.length === 0);
  assert(await reasonOf(() => verifyCode(f.db, { link, code: '123456', ip: null }, f.deps)) === 'expired' && f.calls.links === 0);
});

Deno.test('a new welcome mail keeps the last three links valid', async () => {
  const f = await linkFixture();
  const links: string[] = [];
  for (let i = 0; i < 4; i++) links.push(await issueLoginLink(f.db, DANNY));
  const states = await Promise.all(links.map(l => peekLoginLink(f.db, l).then(p => p.status)));
  assert(JSON.stringify(states) === JSON.stringify(['invalid', 'open', 'open', 'open']), JSON.stringify(states));
  assert(f.users['danny@example.test'].app_metadata.provider === 'email', 'other metadata stays');
});
