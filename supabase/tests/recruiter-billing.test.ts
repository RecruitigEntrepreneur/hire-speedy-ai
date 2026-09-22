import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { billingChanges, cleanBilling, ibanValid, bicValid, maskIban } from '../functions/_shared/recruiter-billing.ts';
import { saveBilling } from '../functions/_shared/recruiter-billing-service.ts';
import type { sendIntakeMail } from '../functions/_shared/intake-mail.ts';

const assert = (v: unknown, m = 'Assertion failed') => { if (!v) throw Error(m); };
const reasonOf = async (work: () => Promise<unknown>) => { try { await work(); } catch (e) { return String((e as { reason?: string }).reason ?? 'thrown'); } return 'none'; };
type MailArgs = Parameters<typeof sendIntakeMail>[1];
const IBAN = 'DE89 3704 0044 0532 0130 00';

function fixture(opts: { role?: boolean; profile?: Record<string, unknown> | null; mailFails?: boolean } = {}) {
  const writes: Record<string, unknown>[] = [];
  const mails: MailArgs[] = [];
  const profile = opts.profile === undefined ? { full_name: 'Danny Beispiel', company_name: 'KMB Partners GmbH', company_address: 'Hauptstraße 1, 80331 München', tax_id: 'DE123456789', bank_account_holder: null, bank_iban: null, bank_bic: null } : opts.profile;
  const db = { from: (table: string) => {
    const q = {
      select: () => q, eq: () => q,
      update: (patch: Record<string, unknown>) => { writes.push(patch); return { eq: () => Promise.resolve({ error: null }) }; },
      maybeSingle: () => Promise.resolve({ data: table === 'user_roles' ? (opts.role === false ? null : { user_id: 'u1' }) : profile, error: null }),
    };
    return q;
  } } as unknown as SupabaseClient;
  const deps = {
    mail: (async (_db: SupabaseClient, args: MailArgs) => { if (opts.mailFails) throw Error('resend down'); mails.push(args); return { sent: true }; }) as typeof sendIntakeMail,
    appUrl: () => 'https://matchunt.ai', recipients: () => ['marko.benko@bluewater-bridge.de'],
  };
  const user = { id: 'u1', email: 'danny@example.test' } as User;
  return { db, deps, user, writes, mails };
}

Deno.test('IBAN and BIC are checked like a bank would, empty means not yet given', () => {
  assert(ibanValid(IBAN) && ibanValid('de89370400440532013000') && ibanValid(''), 'valid and empty');
  assert(!ibanValid('DE89 3704 0044 0532 0130 01') && !ibanValid('DE00') && !ibanValid('1234567890123456'), 'wrong check digits or format');
  assert(bicValid('COBADEFFXXX') && bicValid('cobadeff') && bicValid('') && !bicValid('COBADE'), 'BIC 8 or 11');
  assert(maskIban(IBAN) === 'DE89 •••• 3000', maskIban(IBAN));
  const clean = cleanBilling({ company_name: '  KMB   Partners ', bank_account_holder: ' KMB  Partners GmbH ', bank_iban: IBAN, bank_bic: 'coba deff xxx', extra: 'x' });
  assert(clean.company_name === 'KMB Partners' && clean.bank_account_holder === 'KMB Partners GmbH' && clean.bank_iban === 'DE89370400440532013000' && clean.bank_bic === 'COBADEFFXXX' && !('extra' in clean));
});

Deno.test('only real changes count, and the IBAN never appears in full', () => {
  const before = { company_name: 'KMB Partners GmbH', company_address: 'Alt 1', tax_id: 'DE1', bank_iban: null, bank_bic: null };
  const after = cleanBilling({ ...before, company_address: 'Neu 2', bank_iban: IBAN });
  const changes = billingChanges(before, after);
  assert(JSON.stringify(changes.map(c => c.field)) === '["company_address","bank_iban"]', JSON.stringify(changes));
  assert(changes[1].before === '(leer)' && changes[1].after === 'DE89 •••• 3000');
  assert(billingChanges({ ...before, company_name: ' KMB  Partners GmbH ' }, cleanBilling(before)).length === 0, 'whitespace is no change');
});

Deno.test('saving writes the profile and tells Matchunt what changed', async () => {
  const f = fixture();
  const r = await saveBilling(f.db, f.user, { company_name: 'KMB Partners GmbH', company_address: 'Hauptstraße 1, 80331 München', tax_id: 'DE123456789', bank_account_holder: 'KMB Partners GmbH', bank_iban: IBAN, bank_bic: 'COBADEFFXXX' }, f.deps);
  assert(JSON.stringify(r.changed) === '["bank_account_holder","bank_iban","bank_bic"]' && f.writes.length === 1, JSON.stringify(r));
  const m = f.mails[0];
  assert(f.mails.length === 1 && m.to === 'marko.benko@bluewater-bridge.de' && m.template === 'recruiter_billing_changed' && m.replyTo === 'danny@example.test');
  assert(m.subject === 'Danny Beispiel hat Abrechnungsdaten geändert' && m.html.includes('DE89 •••• 3000') && !m.html.includes('DE89370400440532013000'), 'masked IBAN only');
  assert(m.html.includes('Bankverbindung') && !m.html.includes('vom unterschriebenen Vertrag ab'), 'bank hint, no contract hint');
  const g = fixture();
  await saveBilling(g.db, g.user, { company_name: 'KMB Partners GmbH', company_address: 'Neu 2, 80331 München', tax_id: 'DE123456789' }, g.deps);
  assert(g.mails[0].html.includes('vom unterschriebenen Vertrag ab'), 'contract hint for address');
});

Deno.test('nothing changed means no write and no mail; bad input, other roles and a failed mail are handled', async () => {
  const f = fixture();
  const same = await saveBilling(f.db, f.user, { company_name: 'KMB Partners GmbH', company_address: 'Hauptstraße 1, 80331 München', tax_id: 'DE123456789' }, f.deps);
  assert(same.changed.length === 0 && f.writes.length === 0 && f.mails.length === 0);
  assert(await reasonOf(() => saveBilling(f.db, f.user, { bank_iban: 'DE00 1234' }, f.deps)) === 'invalid_request' && f.writes.length === 0);
  assert(await reasonOf(() => saveBilling(f.db, f.user, { bank_bic: 'XYZ' }, f.deps)) === 'invalid_request');
  const client = fixture({ role: false });
  assert(await reasonOf(() => saveBilling(client.db, client.user, { bank_iban: IBAN }, client.deps)) === 'not_allowed' && client.writes.length === 0);
  const down = fixture({ mailFails: true });
  const r = await saveBilling(down.db, down.user, { company_name: 'KMB Partners GmbH', company_address: 'Hauptstraße 1, 80331 München', tax_id: 'DE123456789', bank_iban: IBAN }, down.deps);
  assert(r.saved && down.writes.length === 1, 'saved even if the notice fails');
});
