import { enrichCase, type EnrichDeps } from '../functions/_shared/recruiter-enrich.ts';
import { legalFormOf, countryOf, suggestionFrom, applySuggestion, personMatches } from '../functions/_shared/recruiter-company.ts';
import { cleanProfile } from '../functions/_shared/recruiter-contract-policy.ts';
import type { OnboardingCase } from '../functions/_shared/recruiter-onboarding-service.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { LimitResult } from '../functions/_shared/intake-limits.ts';

const assert = (v: unknown, msg = 'Assertion failed') => { if (!v) throw Error(msg); };
const reasonOf = async (work: () => Promise<unknown>): Promise<string> => {
  try { await work(); } catch (e) { return String((e as { reason?: string })?.reason ?? 'thrown'); }
  return 'none';
};
const db = {} as SupabaseClient;
const draft = (email: string, extra: Partial<OnboardingCase> = {}): OnboardingCase => ({
  id: 'case-1', revision: 1, created_by: null, contract_template_hash: null, kind: 'individual', email, token_hash: 'x',
  expires_at: '2999-01-01', revoked_at: null, claimed_by: 'user', profile: cleanProfile({ name: 'Marko Benko' }), state: 'draft', feedback: '',
  checks: {}, reviewed_at: null, ...extra,
});
function deps(opts: { allowed?: boolean; status?: number; body?: unknown; throws?: boolean } = {}) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const d: EnrichDeps = {
    limits: () => Promise.resolve({ allowed: opts.allowed ?? true } as LimitResult),
    fetch: (input, init) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      if (opts.throws) return Promise.reject(new Error('network'));
      return Promise.resolve(new Response(JSON.stringify(opts.body ?? { success: true, data: { legal_name: 'Bluewater Bridge GmbH', street: 'Musterstraße 1', postal_code: '20095', city: 'Hamburg', registration_number: 'HRB 12345', vat_id: 'DE 123456789', ceo_name: 'Marko Benko' } }), { status: opts.status ?? 200 }));
    },
    env: key => ({ SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service' } as Record<string, string>)[key],
  };
  return { d, calls };
}

Deno.test('legal form and country are derived, never asked', () => {
  const cases: [string, string][] = [
    ['Bluewater Bridge GmbH', 'GmbH'], ['Muster Gesellschaft mbH', 'GmbH'], ['Startup UG (haftungsbeschränkt)', 'UG (haftungsbeschränkt)'],
    ['Hansa Logistik GmbH & Co. KG', 'GmbH & Co. KG'], ['Nordwind AG', 'AG'], ['Europa SE', 'AG'], ['Meier & Schulz OHG', 'OHG'],
    ['Müller KG', 'KG'], ['Beratung Schmidt GbR', 'GbR'], ['Anna Weber e.K.', 'e.K.'], ['Acme Ltd', 'Andere'], ['Marko Benko', ''],
    ['Vertragsservice Berlin', ''],
  ];
  for (const [name, form] of cases) assert(legalFormOf(name) === form, `${name} -> ${legalFormOf(name)} expected ${form}`);
  assert(countryOf({ country: 'Germany' }) === 'Deutschland' && countryOf({ country: 'AT' }) === 'Österreich' && countryOf({ vat_id: 'CHE-123.456.789' }) === 'Schweiz');
  assert(countryOf({ vat_id: 'DE123' }) === 'Deutschland' && countryOf({ postal_code: '20095' }) === 'Deutschland' && countryOf({ postal_code: '1010' }) === '');
  assert(countryOf({ country: 'France' }) === 'France');
  assert(personMatches('Marko Benko', 'Geschäftsführer: Marko Benko') && personMatches('Dr. Anna-Lena Müller', 'Anna Lena Müller') && !personMatches('Marko Benko', 'Peter Schmidt') && !personMatches('', 'Marko Benko'));
});

Deno.test('suggestion maps the impressum into the profile, tax status follows the VAT id', () => {
  const s = suggestionFrom({ legal_name: 'Bluewater Bridge GmbH', street: 'Musterstraße 1', postal_code: '20095', city: 'Hamburg', registration_number: 'HRB 12345', vat_id: 'de 123 456 789', ceo_name: 'Marko Benko' }, 'bluewater-bridge.de');
  assert(s.company === 'Bluewater Bridge GmbH' && s.legalForm === 'GmbH' && s.address === 'Musterstraße 1, 20095 Hamburg' && s.country === 'Deutschland');
  assert(s.taxStatus === 'regular' && s.vatId === 'DE123456789' && s.registration === 'HRB 12345' && s.ceo === 'Marko Benko');
  const p = applySuggestion(cleanProfile({ name: 'Marko Benko', company: 'alt' }), s);
  assert(p.company === 'Bluewater Bridge GmbH' && p.legalForm === 'GmbH' && p.taxStatus === 'regular');
  assert(p.contractDetails!.businessEvidence.includes('HRB 12345') && p.contractDetails!.taxNumber.includes('DE123456789') && p.contractDetails!.responsiblePerson === 'Marko Benko');
  const none = suggestionFrom({ name: 'Solo Recruiting' }, 'solo.de');
  assert(none.legalForm === '' && none.taxStatus === '' && none.address === '');
  const kept = applySuggestion(cleanProfile({ name: 'X', company: 'Bleibt GmbH', taxStatus: 'small_business' }), none);
  assert(kept.company === 'Solo Recruiting' && kept.taxStatus === 'small_business' && kept.contractDetails!.responsiblePerson === 'X', 'empty suggestions do not overwrite');
});

Deno.test('enrich uses the business mail domain, needs a website for freemail, and reports upstream trouble', async () => {
  const a = deps();
  const r = await enrichCase(db, draft('marko@bluewater-bridge.de'), {}, '1.1.1.1', a.d);
  assert(r.suggestion.company === 'Bluewater Bridge GmbH' && r.suggestion.source === 'bluewater-bridge.de');
  assert(a.calls[0].url === 'https://proj.supabase.co/functions/v1/enrich-company-from-domain' && a.calls[0].body.domain === 'bluewater-bridge.de');
  const b = deps();
  assert(await reasonOf(() => enrichCase(db, draft('marko@gmail.com'), {}, null, b.d)) === 'invalid_request' && b.calls.length === 0);
  assert(await reasonOf(() => enrichCase(db, draft('marko@gmail.com'), { website: 'nicht sinnvoll' }, null, b.d)) === 'invalid_request' && b.calls.length === 0);
  const c = deps();
  await enrichCase(db, draft('marko@gmail.com'), { website: 'https://www.Bluewater-Bridge.de/impressum' }, null, c.d);
  assert(c.calls[0].body.domain === 'bluewater-bridge.de', 'url is reduced to the domain');
  assert(await reasonOf(() => enrichCase(db, draft('x@firma.de', { state: 'review' }), {}, null, deps().d)) === 'conflict');
  assert(await reasonOf(() => enrichCase(db, draft('x@firma.de'), {}, null, deps({ allowed: false }).d)) === 'rate_limited');
  assert(await reasonOf(() => enrichCase(db, draft('x@firma.de'), {}, null, deps({ status: 500, body: { success: false } }).d)) === 'not_found');
  assert(await reasonOf(() => enrichCase(db, draft('x@firma.de'), {}, null, deps({ body: { success: true, data: {} } }).d)) === 'not_found');
  assert(await reasonOf(() => enrichCase(db, draft('x@firma.de'), {}, null, deps({ throws: true }).d)) === 'upstream_error');
});
