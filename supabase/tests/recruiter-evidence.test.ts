import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { dueReminders, evidencePath, evidencePlan, evidenceState, EVIDENCE_PATH, latestByKind, openEvidence, validUntilOk, type EvidenceRow } from '../functions/_shared/recruiter-evidence.ts';
import { declareIncome, remindExpiring, reviewEvidence, submitEvidence } from '../functions/_shared/recruiter-evidence-service.ts';
import type { sendIntakeMail } from '../functions/_shared/intake-mail.ts';

const assert = (v: unknown, m = 'Assertion failed') => { if (!v) throw Error(m); };
const reasonOf = async (work: () => Promise<unknown>) => { try { await work(); } catch (e) { return String((e as { reason?: string }).reason ?? 'thrown'); } return 'none'; };
type MailArgs = Parameters<typeof sendIntakeMail>[1];
const NOW = Date.parse('2026-09-22T10:00:00Z');
const U = '0f8fad5b-d9cb-469f-a165-70867728950e';
const row = (over: Partial<EvidenceRow>): EvidenceRow => ({ id: crypto.randomUUID(), recruiter_id: U, kind: 'business', file_path: `${U}/business/1-a.pdf`, file_name: 'a.pdf', declaration: null, valid_until: null, status: 'approved', reason: null, uploaded_at: '2026-09-20T10:00:00Z', reviewed_at: null, reminded_at: null, ...over });

Deno.test('the contract decides which evidence applies: agencies need insurance and authority, individuals do not', () => {
  assert(JSON.stringify(evidencePlan('individual').map(p => [p.kind, p.required, p.applies])) === JSON.stringify([['business', true, true], ['insurance', false, true], ['authority', false, false], ['income', true, true]]));
  assert(evidencePlan('agency').every(p => p.required && p.applies));
});

Deno.test('states: missing, in review, checked, rejected, expiring within 30 days, expired', () => {
  assert(evidenceState(undefined, NOW) === 'missing');
  assert(evidenceState(row({ status: 'pending' }), NOW) === 'pending' && evidenceState(row({ status: 'rejected' }), NOW) === 'rejected');
  assert(evidenceState(row({ valid_until: '2027-03-31' }), NOW) === 'approved');
  assert(evidenceState(row({ valid_until: '2026-10-15' }), NOW) === 'expiring');
  assert(evidenceState(row({ valid_until: '2026-09-21' }), NOW) === 'expired');
  const latest = latestByKind([row({ uploaded_at: '2026-01-01T00:00:00Z', status: 'rejected' }), row({ uploaded_at: '2026-09-01T00:00:00Z', status: 'pending' })]);
  assert(latest.business?.status === 'pending', 'newest wins');
});

Deno.test('open duties count missing, rejected, expired and expiring evidence; the contract declaration covers income', () => {
  assert(JSON.stringify(openEvidence('individual', [], 'Nein', NOW)) === '["business"]', 'insurance is voluntary for individuals');
  assert(JSON.stringify(openEvidence('individual', [], '', NOW)) === '["business","income"]');
  assert(JSON.stringify(openEvidence('individual', [row({ status: 'pending' })], 'Nein', NOW)) === '[]', 'in review is not open');
  assert(JSON.stringify(openEvidence('agency', [row({}), row({ kind: 'insurance', valid_until: '2026-10-01' })], 'Nein', NOW)) === '["insurance","authority"]');
});

Deno.test('paths stay in the own folder, names are cleaned, dates must lie ahead', () => {
  const path = evidencePath(U, 'insurance', '../Police 2026 (final).pdf', 42);
  assert(path === `${U}/insurance/42-Police_2026_final_.pdf` && EVIDENCE_PATH.test(path), path);
  assert(!EVIDENCE_PATH.test(`${U}/income/1-a.pdf`) && !EVIDENCE_PATH.test(`other/business/1-a.pdf`));
  assert(validUntilOk('2027-01-31', NOW) && validUntilOk('2026-09-22', NOW) && !validUntilOk('2026-09-21', NOW) && !validUntilOk('31.01.2027', NOW));
});

Deno.test('reminders go out once, only for the newest checked evidence and only inside 30 days', () => {
  const soon = row({ kind: 'insurance', valid_until: '2026-10-10' });
  const replaced = row({ recruiter_id: 'b', kind: 'insurance', valid_until: '2026-10-10', uploaded_at: '2026-01-01T00:00:00Z' });
  const newer = row({ recruiter_id: 'b', kind: 'insurance', valid_until: '2027-10-10', uploaded_at: '2026-09-15T00:00:00Z', status: 'pending' });
  const done = row({ recruiter_id: 'c', kind: 'insurance', valid_until: '2026-10-10', reminded_at: '2026-09-21T06:00:00Z' });
  const late = row({ recruiter_id: 'd', kind: 'insurance', valid_until: '2027-06-01' });
  assert(JSON.stringify(dueReminders([soon, replaced, newer, done, late], NOW).map(r => r.id)) === JSON.stringify([soon.id]));
});

function fixture(opts: { files?: string[]; rows?: EvidenceRow[]; role?: boolean; profile?: Record<string, unknown> } = {}) {
  const rows = [...(opts.rows ?? [])] as unknown as Record<string, unknown>[];
  const mails: MailArgs[] = [];
  const files = new Set(opts.files ?? []);
  const db = {
    from: (table: string) => {
      const filters: ((r: Record<string, unknown>) => boolean)[] = [];
      let patch: Record<string, unknown> | null = null;
      let inserted: Record<string, unknown> | null = null;
      const pick = () => (table === 'recruiter_evidence' ? rows : []).filter(r => filters.every(f => f(r)));
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q; },
        not: (k: string, _op: string, _v: unknown) => { filters.push(r => r[k] !== null && r[k] !== undefined); return q; },
        lte: (k: string, v: string) => { filters.push(r => String(r[k]) <= v); return q; },
        is: (k: string, _v: null) => { filters.push(r => r[k] === null || r[k] === undefined); return q; },
        in: (k: string, vs: unknown[]) => { filters.push(r => vs.includes(r[k])); return q; },
        insert: (value: Record<string, unknown>) => { inserted = { id: crypto.randomUUID(), uploaded_at: new Date(NOW).toISOString(), reviewed_at: null, reminded_at: null, reason: null, file_path: null, file_name: null, declaration: null, valid_until: null, ...value }; rows.push(inserted); return q; },
        update: (value: Record<string, unknown>) => { patch = value; return q; },
        single: () => Promise.resolve({ data: inserted, error: null }),
        maybeSingle: () => {
          if (table === 'user_roles') return Promise.resolve({ data: opts.role === false ? null : { user_id: U }, error: null });
          if (table === 'profiles') return Promise.resolve({ data: opts.profile ?? { full_name: 'Danny Beispiel', email: 'danny@example.test' }, error: null });
          return Promise.resolve({ data: pick()[0] ?? null, error: null });
        },
        then: (resolve: (v: unknown) => unknown) => {
          if (patch) { for (const r of pick()) Object.assign(r, patch); return Promise.resolve({ error: null }).then(resolve); }
          return Promise.resolve({ data: pick(), error: null }).then(resolve);
        },
      };
      return q;
    },
    storage: { from: () => ({ list: (folder: string, o: { search: string }) => Promise.resolve({ data: [...files].filter(f => f.startsWith(`${folder}/`) && f.endsWith(o.search)).map(f => ({ name: f.slice(folder.length + 1) })), error: null }) }) },
  } as unknown as SupabaseClient;
  const deps = { mail: (async (_db: SupabaseClient, args: MailArgs) => { mails.push(args); return { sent: true }; }) as typeof sendIntakeMail, appUrl: () => 'https://matchunt.ai', recipients: () => ['marko.benko@bluewater-bridge.de'], now: () => NOW };
  const user = { id: U, email: 'danny@example.test' } as User;
  return { db, deps, user, rows, mails };
}

Deno.test('submitting needs the own folder, the uploaded file and a validity date for insurance', async () => {
  const path = `${U}/insurance/1-police.pdf`;
  const f = fixture({ files: [path] });
  assert(await reasonOf(() => submitEvidence(f.db, f.user, { kind: 'insurance', path: `7c9e6679-7425-40de-944b-e07fc1f90ae7/insurance/1-police.pdf` }, f.deps)) === 'not_allowed', 'foreign folder');
  assert(await reasonOf(() => submitEvidence(f.db, f.user, { kind: 'business', path }, f.deps)) === 'not_allowed', 'kind must match the folder');
  assert(await reasonOf(() => submitEvidence(f.db, f.user, { kind: 'insurance', path }, f.deps)) === 'invalid_request', 'insurance needs a date');
  assert(await reasonOf(() => submitEvidence(f.db, f.user, { kind: 'insurance', path: `${U}/insurance/2-fehlt.pdf`, valid_until: '2027-03-31' }, f.deps)) === 'not_found', 'file must exist');
  const r = await submitEvidence(f.db, f.user, { kind: 'insurance', path, file_name: 'Police 2026.pdf', valid_until: '2027-03-31' }, f.deps);
  assert(r.status === 'pending' && f.rows.length === 1 && f.rows[0].status === 'pending' && f.rows[0].file_name === 'Police 2026.pdf');
  assert(f.mails.length === 1 && f.mails[0].to === 'marko.benko@bluewater-bridge.de' && f.mails[0].subject === 'Nachweis zur Prüfung: Versicherungsnachweis' && f.mails[0].html.includes('31.03.2027'));
  const client = fixture({ files: [path], role: false });
  assert(await reasonOf(() => submitEvidence(client.db, client.user, { kind: 'insurance', path, valid_until: '2027-03-31' }, client.deps)) === 'not_allowed' && client.rows.length === 0);
});

Deno.test('the income declaration counts at once; Matchunt hears only about "more than half"', async () => {
  const f = fixture();
  await declareIncome(f.db, f.user, { declaration: 'below' }, f.deps);
  assert(f.rows[0].kind === 'income' && f.rows[0].status === 'approved' && f.mails.length === 0);
  await declareIncome(f.db, f.user, { declaration: 'above' }, f.deps);
  assert(f.mails.length === 1 && f.mails[0].subject.includes('mehr als die Hälfte'));
  assert(await reasonOf(() => declareIncome(f.db, f.user, { declaration: 'maybe' }, f.deps)) === 'invalid_request');
});

Deno.test('review: checked or rejected with a reason that reaches the recruiter; nothing twice', async () => {
  const pending = row({ status: 'pending' });
  const f = fixture({ rows: [pending] });
  assert(await reasonOf(() => reviewEvidence(f.db, { userId: 'admin-1', email: 'marko.benko@bluewater-bridge.de' }, { id: pending.id, decision: 'rejected', reason: 'x' }, f.deps)) === 'invalid_request', 'reason needed');
  const r = await reviewEvidence(f.db, { userId: 'admin-1', email: 'marko.benko@bluewater-bridge.de' }, { id: pending.id, decision: 'rejected', reason: 'Datei nicht lesbar, bitte als PDF.' }, f.deps);
  assert(r.status === 'rejected' && r.mailed && f.rows[0].status === 'rejected' && f.rows[0].reviewed_by === 'admin-1' && f.rows[0].reason === 'Datei nicht lesbar, bitte als PDF.');
  const m = f.mails[0];
  assert(m.to === 'danny@example.test' && m.replyTo === 'marko.benko@bluewater-bridge.de' && m.html.includes('Datei nicht lesbar') && m.html.includes('/recruiter/profile/nachweise') && m.html.includes('Hallo Danny'));
  assert(await reasonOf(() => reviewEvidence(f.db, {}, { id: pending.id, decision: 'approved' }, f.deps)) === 'conflict', 'already reviewed');
  const income = row({ kind: 'income', file_path: null, declaration: 'below' });
  const g = fixture({ rows: [income] });
  assert(await reasonOf(() => reviewEvidence(g.db, {}, { id: income.id, decision: 'approved' }, g.deps)) === 'conflict');
  const h = fixture({ rows: [row({ status: 'pending' })] });
  const ok = await reviewEvidence(h.db, { userId: 'admin-1' }, { id: h.rows[0].id, decision: 'approved' }, h.deps);
  assert(ok.status === 'approved' && !ok.mailed && h.mails.length === 0 && h.rows[0].reason === null);
});

Deno.test('the daily run reminds once and marks the evidence', async () => {
  const soon = row({ kind: 'insurance', valid_until: '2026-10-10' });
  const f = fixture({ rows: [soon, row({ recruiter_id: 'other', kind: 'insurance', valid_until: '2027-06-01' })] });
  const first = await remindExpiring(f.db, f.deps);
  assert(first.reminded === 1 && f.mails[0].to === 'danny@example.test' && f.mails[0].subject === 'Versicherungsnachweis läuft bald ab' && f.mails[0].html.includes('10.10.2026'));
  assert(typeof f.rows[0].reminded_at === 'string');
  const second = await remindExpiring(f.db, f.deps);
  assert(second.reminded === 0 && f.mails.length === 1, 'only once');
});
