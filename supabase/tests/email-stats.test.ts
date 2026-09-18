import { eventFromWebhook, mergeEmailEvent, summarizeMail, MAX_MAIL_EVENTS, type MailRow } from '../functions/_shared/email-stats.ts';
import { recordEmailEvent, caseMails, invitationMails } from '../functions/_shared/email-event-log.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const assert = (v: unknown, msg = 'Assertion failed') => { if (!v) throw Error(msg); };
const eq = (actual: unknown, expected: unknown, msg = '') => {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  assert(a === e, `${msg}\n  ist:  ${a}\n  soll: ${e}`);
};

type Row = MailRow & Record<string, unknown>;
/** Nachgestellter Supabase-Client: select/eq/in/order/limit/maybeSingle/update, JSON-Pfade mit ->>. */
function fakeDb(rows: Row[]) {
  const updates: { id: unknown; values: Record<string, unknown> }[] = [];
  const get = (row: Row, col: string) => {
    if (!col.includes('->>')) return row[col];
    const [base, key] = col.split('->>');
    const obj = row[base];
    return obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined;
  };
  const db = {
    from(_table: string) {
      const filters: { op: 'eq' | 'in'; col: string; val: unknown }[] = [];
      let limit = Infinity; let ascending = true;
      const run = () => rows
        .filter(r => filters.every(f => f.op === 'eq' ? get(r, f.col) === f.val : (f.val as unknown[]).includes(get(r, f.col))))
        .sort((a, b) => (ascending ? 1 : -1) * a.created_at.localeCompare(b.created_at))
        .slice(0, limit);
      const q = {
        select: () => q,
        eq: (col: string, val: unknown) => { filters.push({ op: 'eq', col, val }); return q; },
        in: (col: string, val: unknown[]) => { filters.push({ op: 'in', col, val }); return q; },
        order: (_col: string, o: { ascending: boolean }) => { ascending = o.ascending; return q; },
        limit: (n: number) => { limit = n; return q; },
        maybeSingle: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve({ data: run(), error: null }).then(resolve, reject),
        update: (values: Record<string, unknown>) => ({
          eq: (col: string, val: unknown) => {
            const row = rows.find(r => r[col] === val);
            if (row) { Object.assign(row, values); updates.push({ id: val, values }); }
            return Promise.resolve({ error: null });
          },
        }),
      };
      return q;
    },
  };
  return { db: db as unknown as SupabaseClient, updates };
}

Deno.test('webhook events carry the time of the event, not of the mail; unknown events are ignored', () => {
  eq(eventFromWebhook({ type: 'email.opened', created_at: '2026-09-18T10:00:00.000Z', data: { email_id: 're_1', created_at: '2026-09-17T08:00:00.000Z' } }),
    { resendId: 're_1', event: { type: 'opened', at: '2026-09-18T10:00:00.000Z' } });
  eq(eventFromWebhook({ type: 'email.clicked', created_at: '2026-09-18T10:05:00.000Z', data: { email_id: 're_1', click: { link: 'https://matchunt.ai/recruiter/invitation', timestamp: '2026-09-18T10:04:59.000Z' } } }),
    { resendId: 're_1', event: { type: 'clicked', at: '2026-09-18T10:04:59.000Z', link: 'https://matchunt.ai/recruiter/invitation' } });
  eq([eventFromWebhook({ type: 'email.received', data: { email_id: 're_1' } }), eventFromWebhook({ type: 'contact.created', data: {} }),
    eventFromWebhook({ type: 'email.opened', data: {} }), eventFromWebhook(null)], [null, null, null, null]);
});

Deno.test('events are merged once, in time order, capped, and leave case and resend ids alone', () => {
  const base = { case_id: 'case-1', resend_id: 're_1' };
  let meta = mergeEmailEvent(base, { type: 'opened', at: '2026-09-18T10:00:00.000Z' });
  meta = mergeEmailEvent(meta, { type: 'delivered', at: '2026-09-18T09:00:00.000Z' });
  meta = mergeEmailEvent(meta, { type: 'opened', at: '2026-09-18T10:00:00.000Z' });
  eq(meta, { case_id: 'case-1', resend_id: 're_1', events: [{ type: 'delivered', at: '2026-09-18T09:00:00.000Z' }, { type: 'opened', at: '2026-09-18T10:00:00.000Z' }] });
  let many: Record<string, unknown> = {};
  for (let i = 0; i < MAX_MAIL_EVENTS + 5; i++) many = mergeEmailEvent(many, { type: 'opened', at: new Date(Date.UTC(2026, 8, 18, 0, 0, i)).toISOString() });
  eq((many.events as unknown[]).length, MAX_MAIL_EVENTS);
  eq(mergeEmailEvent('kaputt', { type: 'sent', at: '2026-09-18T09:00:00.000Z' }), { events: [{ type: 'sent', at: '2026-09-18T09:00:00.000Z' }] });
});

Deno.test('a mail is summarised with delivery, open and click counts, first and last time, and problems', () => {
  const row: MailRow = {
    id: 'm1', to_email: 'david@example.com', template_name: 'recruiter_onboarding_invitation', subject: 'Ihre Einladung', status: 'sent', error_message: null, created_at: '2026-09-17T08:00:00.000Z',
    metadata: { case_id: 'case-1', resend_id: 're_1', events: [
      { type: 'sent', at: '2026-09-17T08:00:01.000Z' }, { type: 'delivered', at: '2026-09-17T08:00:03.000Z' },
      { type: 'opened', at: '2026-09-17T09:10:00.000Z' }, { type: 'clicked', at: '2026-09-17T09:11:00.000Z', link: 'https://matchunt.ai/recruiter/invitation' },
      { type: 'opened', at: '2026-09-18T07:30:00.000Z' }, { type: 'opened', at: '2026-09-18T12:00:00.000Z' },
    ] },
  };
  const s = summarizeMail(row);
  eq([s.tracked, s.lastEvent, s.deliveredAt, s.problem], [true, 'opened', '2026-09-17T08:00:03.000Z', null]);
  eq(s.opens, { count: 3, first: '2026-09-17T09:10:00.000Z', last: '2026-09-18T12:00:00.000Z' });
  eq(s.clicks, { count: 1, first: '2026-09-17T09:11:00.000Z', last: '2026-09-17T09:11:00.000Z', links: ['https://matchunt.ai/recruiter/invitation'] });
  const bounced = summarizeMail({ ...row, metadata: { events: [{ type: 'bounced', at: '2026-09-17T08:00:05.000Z' }] } });
  eq(bounced.problem, { type: 'bounced', at: '2026-09-17T08:00:05.000Z' });
  const blind = summarizeMail({ ...row, metadata: { resend_id: 're_1', resend_last_event: 'opened' } });
  eq([blind.tracked, blind.lastEvent, blind.opens.count], [false, 'opened', 0], 'without events only the last state from Resend');
  eq(summarizeMail({ id: 'm2', created_at: '2026-09-17T08:00:00.000Z', status: 'failed', error_message: 'Domain nicht verifiziert' }).error, 'Domain nicht verifiziert');
});

Deno.test('the webhook writes to the email_events row with the same resend id and skips unknown mails', async () => {
  const rows: Row[] = [{ id: 'm1', created_at: '2026-09-17T08:00:00.000Z', metadata: { case_id: 'case-1', resend_id: 're_1' } }];
  const { db } = fakeDb(rows);
  assert(await recordEmailEvent(db, { type: 'email.opened', created_at: '2026-09-18T10:00:00.000Z', data: { email_id: 're_1' } }));
  assert(await recordEmailEvent(db, { type: 'email.opened', created_at: '2026-09-18T10:00:00.000Z', data: { email_id: 're_1' } }), 'retry is fine');
  assert(await recordEmailEvent(db, { type: 'email.opened', created_at: '2026-09-18T11:00:00.000Z', data: { email_id: 're_1' } }));
  eq((rows[0].metadata as { events: unknown[] }).events.length, 2, 'retry counted once');
  eq((rows[0].metadata as { case_id: string }).case_id, 'case-1');
  assert(!await recordEmailEvent(db, { type: 'email.opened', data: { email_id: 're_unbekannt' } }));
  assert(!await recordEmailEvent(db, { type: 'email.received', data: { email_id: 're_1' } }));
});

Deno.test('the admin card lists the mails of one case and asks Resend only for mails without events', async () => {
  const rows: Row[] = [
    { id: 'inv', created_at: '2026-09-17T08:00:00.000Z', template_name: 'recruiter_onboarding_invitation', status: 'sent', metadata: { case_id: 'case-1', resend_id: 're_inv' } },
    { id: 'code', created_at: '2026-09-18T09:00:00.000Z', template_name: 'recruiter_onboarding_code', status: 'sent', metadata: { case_id: 'case-1', resend_id: 're_code', events: [{ type: 'delivered', at: '2026-09-18T09:00:02.000Z' }] } },
    { id: 'other', created_at: '2026-09-18T09:30:00.000Z', template_name: 'recruiter_onboarding_invitation', status: 'sent', metadata: { case_id: 'case-2', resend_id: 're_other' } },
  ];
  const { db, updates } = fakeDb(rows);
  const asked: string[] = [];
  const fetch = ((input: string | URL | Request) => {
    asked.push(String(input));
    return Promise.resolve(new Response(JSON.stringify({ id: 're_inv', last_event: 'opened' }), { status: 200 }));
  }) as typeof globalThis.fetch;
  const mails = await caseMails(db, 'case-1', { fetch, apiKey: 're_key', now: () => new Date('2026-09-18T12:00:00.000Z') });
  eq(mails.map(m => [m.id, m.lastEvent, m.tracked]), [['code', 'delivered', true], ['inv', 'opened', false]]);
  eq(asked, ['https://api.resend.com/emails/re_inv'], 'only the mail without events is looked up');
  eq(updates.map(u => [u.id, (u.values.metadata as Record<string, unknown>).resend_last_event]), [['inv', 'opened']]);
  const offline = fakeDb(structuredClone(rows));
  const failing = (() => Promise.reject(new Error('offline'))) as unknown as typeof globalThis.fetch;
  eq((await caseMails(offline.db, 'case-1', { fetch: failing, apiKey: 're_key' })).length, 2, 'Resend errors do not break the card');
  let called = false;
  await caseMails(fakeDb(structuredClone(rows)).db, 'case-1', { fetch: (() => { called = true; return Promise.reject(); }) as unknown as typeof globalThis.fetch });
  assert(!called, 'no key, no lookup');
});

Deno.test('the list gets the latest invitation mail per case and ignores code mails', async () => {
  const rows: Row[] = [
    { id: 'old', created_at: '2026-09-10T08:00:00.000Z', template_name: 'recruiter_onboarding_invitation', status: 'failed', error_message: 'x', metadata: { case_id: 'case-1' } },
    { id: 'new', created_at: '2026-09-17T08:00:00.000Z', template_name: 'recruiter_onboarding_invitation', status: 'sent', metadata: { case_id: 'case-1' } },
    { id: 'code', created_at: '2026-09-18T08:00:00.000Z', template_name: 'recruiter_onboarding_code', status: 'sent', metadata: { case_id: 'case-2' } },
  ];
  const byCase = await invitationMails(fakeDb(rows).db, ['case-1', 'case-2']);
  eq(Object.fromEntries(Object.entries(byCase).map(([k, v]) => [k, v.id])), { 'case-1': 'new' });
  eq(await invitationMails(fakeDb(rows).db, []), {});
});
