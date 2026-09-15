import { peekCase, sendCode, verifyCode, caseStatus, type CodeDeps } from '../functions/_shared/recruiter-code.ts';
import { hashToken } from '../functions/_shared/tokens.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { LimitResult } from '../functions/_shared/intake-limits.ts';

const assert = (v: unknown, msg = 'Assertion failed') => { if (!v) throw Error(msg); };
const reasonOf = async (work: () => Promise<unknown>): Promise<string> => {
  try { await work(); } catch (e) { return String((e as { reason?: string })?.reason ?? 'thrown'); }
  return 'none';
};
const TOKEN = 'A'.repeat(43);
const OTHER = 'B'.repeat(43);

async function fixture(opts: { cases?: Record<string, unknown>[]; userExists?: boolean; allowed?: boolean; mailSent?: boolean; verify?: { status: number; body?: unknown } } = {}) {
  const cases = opts.cases ?? [];
  const calls = { createUser: [] as Record<string, unknown>[], generateLink: [] as Record<string, unknown>[], mails: [] as Record<string, unknown>[], fetches: [] as { url: string; init?: RequestInit }[] };
  const db = {
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
        maybeSingle: () => Promise.resolve({ data: (table === 'recruiter_onboarding_cases' ? cases : []).find(r => filters.every(([k, v]) => r[k] === v)) ?? null, error: null }),
      };
      return q;
    },
    auth: { admin: {
      createUser: (args: Record<string, unknown>) => { calls.createUser.push(args); return Promise.resolve(opts.userExists
        ? { data: { user: null }, error: { code: 'email_exists', message: 'A user with this email address has already been registered', status: 422 } }
        : { data: { user: { id: 'new' } }, error: null }); },
      generateLink: (args: Record<string, unknown>) => { calls.generateLink.push(args); return Promise.resolve({ data: { properties: { email_otp: '482913', action_link: 'https://example.test/link' }, user: { id: 'u' } }, error: null }); },
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
  return { db, calls, deps };
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

Deno.test('code with invitation creates a recruiter account and mails the Supabase code to the invitation address only', async () => {
  const f = await fixture({ cases: [await invite()] });
  const r = await sendCode(f.db, { token: TOKEN, ip: '1.1.1.1' }, f.deps);
  assert(r.sent && r.masked_email === 'ma***@example.test');
  const created = f.calls.createUser[0] as { email: string; email_confirm: boolean; user_metadata: { role: string; full_name: string } };
  assert(created.email === 'marko@example.test' && created.email_confirm === false && created.user_metadata.role === 'recruiter' && created.user_metadata.full_name === 'Marko');
  assert(f.calls.generateLink[0].type === 'magiclink' && f.calls.generateLink[0].email === 'marko@example.test');
  const mail = f.calls.mails[0] as { to: string; subject: string; html: string; template: string };
  assert(mail.to === 'marko@example.test' && mail.subject.startsWith('482913') && mail.html.includes('482913') && mail.template === 'recruiter_onboarding_code');
});

Deno.test('code reuses an existing account; expired, revoked and rate-limited requests send nothing; a claimed case may continue', async () => {
  const f = await fixture({ cases: [await invite()], userExists: true });
  assert((await sendCode(f.db, { token: TOKEN, ip: null }, f.deps)).sent && f.calls.mails.length === 1);
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
  const claimed = await fixture({ cases: [await invite({ claimed_by: 'u', expires_at: '2000-01-01' })], userExists: true });
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

Deno.test('verify checks the code against Supabase with the invitation address and returns the session', async () => {
  const f = await fixture({ cases: [await invite()] });
  const s = await verifyCode(f.db, { token: TOKEN, code: '482 913' }, f.deps);
  assert(s.access_token === 'at' && s.refresh_token === 'rt' && s.expires_in === 3600);
  const call = f.calls.fetches[0];
  const sent = JSON.parse(String(call.init?.body));
  assert(call.url === 'https://proj.supabase.co/auth/v1/verify' && call.init?.method === 'POST');
  assert(sent.type === 'magiclink' && sent.email === 'marko@example.test' && sent.token === '482913');
  assert((call.init?.headers as Record<string, string>).apikey === 'anon');
  assert(await reasonOf(() => verifyCode(f.db, { token: TOKEN, code: '12' }, f.deps)) === 'invalid_request');
  const wrong = await fixture({ cases: [await invite()], verify: { status: 403, body: { msg: 'Token has expired or is invalid' } } });
  assert(await reasonOf(() => verifyCode(wrong.db, { token: TOKEN, code: '111111' }, wrong.deps)) === 'invalid_request');
  const tooMany = await fixture({ cases: [await invite()], verify: { status: 429 } });
  assert(await reasonOf(() => verifyCode(tooMany.db, { token: TOKEN, code: '111111' }, tooMany.deps)) === 'rate_limited');
  const byEmail = await fixture();
  assert((await verifyCode(byEmail.db, { email: 'Neu@Example.test', code: '111111' }, byEmail.deps)).access_token === 'at');
  assert(JSON.parse(String(byEmail.calls.fetches[0].init?.body)).email === 'neu@example.test');
  const noEnv = await fixture({ cases: [await invite()] });
  noEnv.deps.env = () => undefined;
  assert(await reasonOf(() => verifyCode(noEnv.db, { token: TOKEN, code: '111111' }, noEnv.deps)) === 'not_deployed');
  assert(noEnv.calls.fetches.length === 0);
});
