import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthProvider } from '@/lib/auth';
import { JobApprovalDialog } from '@/components/admin/JobApprovalDialog';
import { BEISPIEL_ANZEIGE } from './beispielAnzeige';
import '@/index.css';

// Separate Vite-Entwicklungsseite für den Freigabedialog „Job zur Genehmigung“.
// Ruft keinen Server auf; Daten und Anmeldung sind nachgestellt.
//   /__preview/admin-approval.html?scenario=contracting|luca-alt|fest
if (!import.meta.env.DEV) throw new Error('This preview is only available in development.');

const scenario = new URLSearchParams(location.search).get('scenario') ?? 'contracting';
const user = { id: 'admin-1', email: 'admin@matchunt.test', app_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z', user_metadata: {} } as User;
const session = { access_token: 'preview', refresh_token: 'preview', expires_in: 3600, token_type: 'bearer', user } as Session;

const stelle = {
  id: 'job-1', title: 'Arzt / Ärztin (m/w/d) für Cannabinoidmedizin & Telemedizin', company_name: 'Kanna Medics GmbH',
  description: null, requirements: null, location: 'München', remote_type: 'hybrid', experience_level: 'senior',
  skills: ['Cannabinoidmedizin', 'Telemedizin', 'Approbation'], must_haves: null, nice_to_haves: null,
  industry: 'Telemedizin', urgency: 'standard', status: 'pending_approval', client_id: 'kunde-1',
  formatted_content: null, reveal_envelope: { red_list: ['Kanna'] },
  must_have_criteria: ['Approbation', 'Erfahrung Cannabinoidmedizin'], contract_creation_days: 3,
  mandate_id: 'm-1', intake_draft_id: 'd-1', company_size_band: '1-50',
  salary_min: null, salary_max: null, fee_percentage: 20, recruiter_fee_percentage: 15,
  employment_type: 'freelance', day_rate_min: 400, day_rate_max: 1000,
  utilization_days_per_week: 3, contract_duration_months: 12, extension_possible: true,
};

const SZENARIEN: Record<string, { job: Record<string, unknown>; mandat: Record<string, unknown>; rahmen: Record<string, unknown> }> = {
  contracting: {
    job: stelle,
    mandat: {
      id: 'm-1', mandate_number: 'MV-2026-001020', status: 'accepted', signature_status: 'not_required',
      fee_basis: 'day_rate_all_in', fee_percentage: 22, recruiter_fee_percentage: 11, payment_terms_days: 14,
      client_confirmed_at: '2026-09-29T08:10:00Z', framework_agreement_id: 'rv-2',
      pricing_snapshot: { model: 'contracting', dayRateMin: 400, dayRateMax: 1000, paymentTermsDays: 14 },
    },
    rahmen: { agreement_number: 'RV-2026-001030', status: 'active', template_version: 2, countersigned_at: '2026-09-29T08:30:00Z' },
  },
  'luca-alt': {
    job: stelle,
    mandat: {
      id: 'm-1', mandate_number: 'MV-2026-001009', status: 'accepted', signature_status: 'signed',
      signature_signed_at: '2026-09-25T12:13:00Z', fee_basis: 'annual_target_salary', fee_percentage: 23,
      recruiter_fee_percentage: 15, package_key: 'growth', client_confirmed_at: '2026-09-25T12:10:00Z',
      framework_agreement_id: 'rv-1', pricing_snapshot: { package: 'growth' },
    },
    rahmen: { agreement_number: 'RV-2026-001002', status: 'active', template_version: 1, countersigned_at: '2026-09-25T12:17:23Z' },
  },
  fest: {
    job: { ...stelle, title: 'Bilanzbuchhalter (m/w/d)', employment_type: 'full-time', salary_min: 65000, salary_max: 75000, day_rate_min: null, day_rate_max: null },
    mandat: {
      id: 'm-1', mandate_number: 'MV-2026-001015', status: 'accepted', signature_status: 'signed',
      signature_signed_at: '2026-09-24T10:00:00Z', fee_basis: 'annual_target_salary', fee_percentage: 22,
      recruiter_fee_percentage: 15, package_key: 'core', client_confirmed_at: '2026-09-24T09:50:00Z',
      framework_agreement_id: 'rv-1', pricing_snapshot: { package: 'core' },
    },
    rahmen: { agreement_number: 'RV-2026-001011', status: 'active', template_version: 2, countersigned_at: '2026-09-24T10:30:00Z' },
  },
};
const s = SZENARIEN[scenario] ?? SZENARIEN.contracting;
const rows = (table: string): unknown[] => ({
  user_roles: [{ role: 'admin' }],
  commercial_terms_templates: [{ key: 'standard', fee_percentage: 20, recruiter_fee_percentage: 15, min_fee_percentage: 15, max_fee_percentage: 30, min_recruiter_fee_percentage: 10, max_recruiter_fee_percentage: 25, fee_basis: 'annual_target_salary' }],
  commercial_mandates: [s.mandat],
  client_framework_agreements: [s.rahmen],
  job_recruiter_text_drafts: [],
} as Record<string, unknown[]>)[table] ?? [];

// Jede Kette (select/eq/update/…) endet entweder in maybeSingle() oder wird direkt abgewartet.
Object.assign(supabase, { from: (table: string) => {
  const q: Record<string, unknown> = {
    select: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, update: () => q, insert: () => q,
    upsert: () => q, delete: () => q,
    maybeSingle: async () => ({ data: rows(table)[0] ?? null, error: null }),
    then: (resolve: (r: unknown) => unknown) => Promise.resolve({ data: rows(table), error: null }).then(resolve),
  };
  return q;
} });
// format-job-for-recruiters mit entwurf: true -- nachgestellte KI-Antwort samt Prüfung.
// `supabase.functions` ist ein Getter, der jedes Mal einen neuen Client baut --
// deshalb die Eigenschaft selbst ersetzen, sonst geht der Aufruf an den Server.
Object.defineProperty(supabase, 'functions', { configurable: true, value: { invoke: async (name: string) => {
  if (name !== 'format-job-for-recruiters') return { data: null, error: null };
  await new Promise(r => setTimeout(r, 800));
  return { data: {
    formattedContent: BEISPIEL_ANZEIGE,
    pruefung: {
      begriffe: ['Kanna Medics GmbH', 'Kanna Medics', 'Kanna', 'kanna-medics.de', 'kanna-medics'],
      ohneGrundlage: ['Sprechstunden in festen Blöcken, dazwischen Dokumentation.'],
      erzeugtAm: new Date().toISOString(),
    },
  }, error: null };
} } });
Object.assign(supabase.auth, {
  getSession: async () => ({ data: { session }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AuthProvider>
      <MemoryRouter>
        <JobApprovalDialog job={s.job as never} open onOpenChange={() => undefined} onApproved={() => alert('Freigegeben (Vorschau)')} />
      </MemoryRouter>
    </AuthProvider>
  </QueryClientProvider>,
);
