import { linkFramework, notifyFrameworkConflict } from '../functions/_shared/framework-link.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const assert = (v: unknown, msg = 'Assertion failed') => { if (!v) throw Error(msg); };
type Row = Record<string, unknown>;

/** Nur was framework-link.ts braucht: select mit eq/in/neq, update, insert. */
function fixture(tables: Record<string, Row[]>) {
  const updates: { table: string; values: Row }[] = [];
  const db = {
    from: (table: string) => {
      const filters: ((r: Row) => boolean)[] = [];
      let values: Row | null = null;
      const rows = () => (tables[table] ?? []).filter(r => filters.every(f => f(r)));
      const q: Record<string, unknown> = {
        select: () => q, limit: () => q,
        eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return q; },
        neq: (k: string, v: unknown) => { filters.push(r => r[k] !== v); return q; },
        in: (k: string, vs: unknown[]) => { filters.push(r => vs.includes(r[k])); return q; },
        update: (v: Row) => { values = v; return q; },
        insert: (v: Row[]) => { (tables[table] ??= []).push(...v); return Promise.resolve({ error: null }); },
        maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
        then: (resolve: (r: unknown) => unknown) => {
          if (values) { updates.push({ table, values }); for (const r of rows()) Object.assign(r, values); return Promise.resolve({ error: null }).then(resolve); }
          return Promise.resolve({ data: rows(), error: null }).then(resolve);
        },
      };
      return q;
    },
  } as unknown as SupabaseClient;
  return { db, tables, updates };
}

const KANNA = 'org-kanna';
const rv = (extra: Row = {}): Row => ({ id: 'rv-1002', agreement_number: 'RV-2026-001002', organization_id: null, client_user_id: null, status: 'active', ...extra });

Deno.test('Annahme hängt den Rahmenvertrag an die neue Firma und trägt das Kundenkonto nach', async () => {
  const f = fixture({ client_framework_agreements: [rv()] });
  const r = await linkFramework(f.db, { frameworkId: 'rv-1002', organizationId: KANNA, clientUserId: 'luca' });
  assert(r.linked && !('already' in r && r.already), JSON.stringify(r));
  const row = f.tables.client_framework_agreements[0];
  assert(row.organization_id === KANNA && row.client_user_id === 'luca', JSON.stringify(row));
});

Deno.test('Schon verknüpft: nichts schreiben; vorhandenes Kundenkonto bleibt', async () => {
  const f = fixture({ client_framework_agreements: [rv({ organization_id: KANNA, client_user_id: 'luca' })] });
  const r = await linkFramework(f.db, { frameworkId: 'rv-1002', organizationId: KANNA, clientUserId: 'jemand-anders' });
  assert(r.linked && 'already' in r && r.already && f.updates.length === 0, JSON.stringify(r));
});

Deno.test('Die Firma hat schon einen laufenden Rahmenvertrag: nichts still ändern, Konflikt melden', async () => {
  const f = fixture({ client_framework_agreements: [rv(), { id: 'rv-1005', agreement_number: 'RV-2026-001005', organization_id: KANNA, status: 'sent' }] });
  const r = await linkFramework(f.db, { frameworkId: 'rv-1002', organizationId: KANNA, clientUserId: 'luca' });
  assert(!r.linked && r.reason === 'conflict' && r.other === 'RV-2026-001005', JSON.stringify(r));
  assert(f.updates.length === 0 && f.tables.client_framework_agreements[0].organization_id === null, 'unverändert');
  const abgelaufen = fixture({ client_framework_agreements: [rv(), { id: 'rv-alt', agreement_number: 'RV-alt', organization_id: KANNA, status: 'terminated' }] });
  assert((await linkFramework(abgelaufen.db, { frameworkId: 'rv-1002', organizationId: KANNA })).linked, 'ein beendeter Vertrag stört nicht');
  const fremd = fixture({ client_framework_agreements: [rv({ organization_id: 'org-andere' })] });
  const f2 = await linkFramework(fremd.db, { frameworkId: 'rv-1002', organizationId: KANNA });
  assert(!f2.linked && f2.reason === 'conflict' && fremd.updates.length === 0, 'gehört einer anderen Firma');
});

Deno.test('Ohne Rahmenvertrag oder ohne Firma passiert nichts', async () => {
  const f = fixture({ client_framework_agreements: [rv()] });
  assert(!(await linkFramework(f.db, { frameworkId: null, organizationId: KANNA })).linked);
  assert(!(await linkFramework(f.db, { frameworkId: 'rv-1002', organizationId: null })).linked);
  assert(!(await linkFramework(f.db, { frameworkId: 'gibt-es-nicht', organizationId: KANNA })).linked && f.updates.length === 0);
});

Deno.test('Konfliktmeldung: Glocke und Mail an Admins, einmal je Aufnahme', async () => {
  const f = fixture({ notifications: [], user_roles: [{ user_id: 'admin-1', role: 'admin' }], profiles: [{ user_id: 'admin-1', email: 'marko@matchunt.test' }] });
  const mails: Row[] = [];
  const deps = { mail: (_db: unknown, a: Row) => { mails.push(a); return Promise.resolve({ sent: true }); }, appUrl: () => 'https://matchunt.ai' } as never;
  const draft = { id: 'd-1', company_name: 'Kanna Medics', owner_user_id: null };
  await notifyFrameworkConflict(f.db, draft, { own: 'RV-2026-001002', other: 'RV-2026-001005' }, deps);
  await notifyFrameworkConflict(f.db, draft, { own: 'RV-2026-001002', other: 'RV-2026-001005' }, deps);
  const glocke = f.tables.notifications as Row[];
  assert(glocke.length === 1 && glocke[0].type === 'framework_conflict' && String(glocke[0].message).includes('RV-2026-001005'), JSON.stringify(glocke));
  assert(mails.length === 1 && (mails[0] as { subject: string }).subject === 'Zwei Rahmenverträge: Kanna Medics');
});
