import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthProvider } from '@/lib/auth';
import { ClientStartChecklist } from '@/components/dashboard/ClientStartChecklist';
import '@/index.css';

// Separate Vite-Entwicklungsseite für „Ihr Start bei Matchunt“ im Kunden-Dashboard.
// Ruft keinen Server auf; Daten und Anmeldung sind nachgestellt.
//   /__preview/client-start.html?scenario=luca|neu|fertig
if (!import.meta.env.DEV) throw new Error('This preview is only available in development.');

const scenario = new URLSearchParams(location.search).get('scenario') ?? 'luca';
const user = {
  id: 'kunde-1', email: 'luca.bartosch@kanna-medics.de', app_metadata: {}, aud: 'authenticated', created_at: '2026-07-02T12:27:28Z',
  user_metadata: { full_name: 'Luca Bartosch', ...(scenario === 'fertig' ? { client_tour_seen_at: '2026-09-26T08:00:00Z' } : {}) },
} as User;
const session = { access_token: 'preview', refresh_token: 'preview', expires_in: 3600, token_type: 'bearer', user } as Session;

const DATEN: Record<string, Record<string, unknown[]>> = {
  luca: {
    client_framework_agreements: [{ agreement_number: 'RV-2026-001002', status: 'active', countersigned_at: '2026-09-25T12:17:23Z' }],
    jobs: [{ title: 'Arzt / Ärztin (m/w/d) für Cannabinoidmedizin & Telemedizin', status: 'pending_approval' }],
    company_profiles: [{ company_name: 'Kanna Medics', legal_name: 'Kanna Medics GmbH' }],
  },
  neu: { client_framework_agreements: [], jobs: [], company_profiles: [] },
  fertig: {
    client_framework_agreements: [{ agreement_number: 'RV-2026-001002', status: 'active', countersigned_at: '2026-09-25T12:17:23Z' }],
    jobs: [{ title: 'Arzt / Ärztin für Cannabinoidmedizin', status: 'published' }],
    company_profiles: [{ company_name: 'Kanna Medics', legal_name: 'Kanna Medics GmbH', street: 'Gabelsbergerstr. 48b', postal_code: '80333', city: 'München' }],
  },
};
const rows = (table: string) => (table === 'user_roles' ? [{ role: 'client' }] : DATEN[scenario]?.[table] ?? []);

// Jede Kette (select/eq/order/…) endet entweder in maybeSingle() oder wird direkt abgewartet.
Object.assign(supabase, { from: (table: string) => {
  const q: Record<string, unknown> = {
    select: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q,
    maybeSingle: async () => ({ data: rows(table)[0] ?? null, error: null }),
    then: (resolve: (r: unknown) => unknown) => Promise.resolve({ data: rows(table), error: null }).then(resolve),
  };
  return q;
} });
Object.assign(supabase.auth, {
  getSession: async () => ({ data: { session }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
  updateUser: async () => ({ data: { user }, error: null }),
});

function Ziel() {
  const { pathname, hash } = useLocation();
  return <div className="mx-auto max-w-3xl p-8"><p>Gelandet auf {pathname}{hash}</p></div>;
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AuthProvider>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<div className="mx-auto max-w-3xl space-y-4 p-8">
            <h1 className="text-2xl font-bold">Guten Tag, Luca</h1>
            <ClientStartChecklist onTour={() => alert('Rundgang startet')} />
          </div>} />
          <Route path="*" element={<Ziel />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  </QueryClientProvider>,
);
