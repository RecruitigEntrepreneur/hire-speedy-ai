import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthProvider } from '@/lib/auth';
import { Toaster } from '@/components/ui/toaster';
import RecruiterProfile from '@/pages/recruiter/RecruiterProfile';
import { cleanProfile } from '../../supabase/functions/_shared/recruiter-contract-policy';
import type { StoredOnboarding } from '@/lib/recruiterOnboardingApi';
import '@/index.css';

// Separate Vite-Entwicklungsseite für das Headhunter-Profil (Etappe 2). Sie ruft keinen
// Server auf: Datenbank, Speicher, Functions und Anmeldung sind nachgestellt.
//   /__preview/recruiter-profile.html?scenario=fresh|mixed|agency|ended&section=nachweise|partnerstatus
if (!import.meta.env.DEV) throw new Error('This preview is only available in development.');

const params = new URLSearchParams(location.search);
const scenario = params.get('scenario') ?? 'mixed';
const USER_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const user = { id: USER_ID, email: 'marko.benko@freenet.de', user_metadata: { full_name: 'Marko Benko' }, app_metadata: {}, aud: 'authenticated', created_at: '2026-09-15T09:00:00Z' } as User;
const session = { access_token: 'preview', refresh_token: 'preview', expires_in: 3600, token_type: 'bearer', user } as Session;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const profile: Record<string, unknown> = {
  user_id: USER_ID, email: 'marko.benko@freenet.de', full_name: 'Marko Benko', phone: '', role_title: 'Talent Acquisition Manager', years_experience: 0,
  company_name: 'Bluewater & Bridge GmbH', company_address: 'Adlzreiterstraße 2, 80337 München', tax_id: 'USt-IdNr. DE365690081',
  bank_account_holder: null, bank_iban: null, bank_bic: null, avatar_path: null, linkedin_url: null, recruiter_expertise: null,
};
const now = Date.now();
const iso = (days: number) => new Date(now + days * 86_400_000).toISOString();
let evidence: Record<string, unknown>[] = scenario === 'fresh' ? [] : [
  { id: 'e1', recruiter_id: USER_ID, kind: 'business', file_path: `${USER_ID}/business/1-register.pdf`, file_name: 'Registerauszug.pdf', declaration: null, valid_until: null, status: 'rejected', reason: 'Datei nicht lesbar. Bitte als PDF hochladen.', uploaded_at: iso(-3), reviewed_at: iso(-2) },
  { id: 'e2', recruiter_id: USER_ID, kind: 'insurance', file_path: `${USER_ID}/insurance/2-police.pdf`, file_name: 'Police 2026.pdf', declaration: null, valid_until: iso(160).slice(0, 10), status: 'pending', reason: null, uploaded_at: iso(-1), reviewed_at: null },
];
// Partnerstatus (Etappe 3): alle Szenarien außer „fresh“; „ended“ zeigt den beendeten Stand.
let partner: Record<string, unknown> | null = scenario === 'fresh' ? null : {
  user_id: USER_ID, partner_number: 'MP-7K3Q-92XW', tier: 'partner', contract_version: '2.1', granted_at: '2026-09-21T15:30:00Z',
  ended_at: scenario === 'ended' ? '2026-09-20T10:00:00Z' : null, end_reason: scenario === 'ended' ? 'revoked' : null,
  directory_consent_at: null, show_expertise_at: null, channels: { linkedin: '2026-09-22T08:00:00Z' },
  website_domain: scenario === 'agency' ? 'bluewater-bridge.de' : null, website_seen_at: scenario === 'agency' ? iso(-1) : null,
};
// Kleinste gültige PDF-Datei, damit „Urkunde“ in der Vorschau etwas herunterlädt.
const samplePdf = btoa('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 842 595]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
const sampleQr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29" shape-rendering="crispEdges"><rect width="29" height="29" fill="#fff"/><path d="M4 4h7v7h-7zM18 4h7v7h-7zM4 18h7v7h-7zM14 14h2v2h-2z" fill="#0a0a0a"/></svg>';
const onboarding: StoredOnboarding = {
  id: 'case-1', revision: 5, kind: scenario === 'agency' ? 'agency' : 'individual', email: 'marko.benko@freenet.de', state: 'approved', feedback: '', activated: true,
  profile: cleanProfile({
    name: 'Marko Benko', company: 'Bluewater & Bridge GmbH', legalForm: 'GmbH', address: 'Adlzreiterstraße 2, 80337 München', country: 'Deutschland', taxStatus: 'regular',
    expertise: { areas: ['Finance & Controlling'], subareas: ['Buchhaltung', 'Controlling', 'Steuern'], levels: ['Fach', 'Führung'], companyTypes: ['Mittelstand', 'Konzern'], regions: ['Deutschland'], languages: ['Deutsch', 'Englisch'], methods: ['Active Sourcing', 'Netzwerk'], experience: 'über 10 Jahre', placements: '5 bis 15', parallel: '3 bis 5', linkedin: 'linkedin.com/in/marko-benko', extras: [] },
    contractDetails: { taxNumber: 'USt-IdNr. DE365690081', incomeConcentration: 'Nein', permitsDeclaration: 'Keine erforderlich', creditNoteConsent: true },
  }),
  contracts: [{ id: 'env-1', case_id: 'case-1', state: 'completed', package_version: '2.1', documents: [], recruiter_client_user_id: USER_ID, recruiter_signed_at: '2026-09-18T10:27:00Z', countersigned_at: '2026-09-21T15:30:00Z', signed_document_path: 'x', certificate_path: 'y' }],
};

// Abfrage-Kette wie supabase-js: jede Methode liefert die Kette, `await` liefert das Ergebnis.
function query(table: string) {
  const state = { single: false, patch: null as Record<string, unknown> | null, insert: null as Record<string, unknown> | null };
  const result = () => {
    if (state.patch) { if (table === 'profiles') Object.assign(profile, state.patch); return { data: null, error: null }; }
    if (table === 'profiles') return { data: state.single ? profile : [profile], error: null };
    if (table === 'user_roles') return { data: state.single ? { role: 'recruiter' } : [{ role: 'recruiter' }], error: null };
    if (table === 'recruiter_partner_status') return { data: state.single ? partner : partner ? [partner] : [], error: null };
    if (table === 'recruiter_evidence') return { data: state.single ? evidence[0] ?? null : [...evidence].sort((a, b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at))), error: null };
    return { data: state.single ? null : [], error: null, count: 0 };
  };
  const chain: Record<string, unknown> = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject);
      if (prop === 'single' || prop === 'maybeSingle') return () => { state.single = true; return chain; };
      if (prop === 'update') return (patch: Record<string, unknown>) => { state.patch = patch; return chain; };
      return () => chain;
    },
  });
  return chain;
}
const channel = { on: () => channel, subscribe: () => channel, unsubscribe: () => undefined };
Object.assign(supabase, {
  from: (table: string) => query(table),
  rpc: () => Promise.resolve({ data: null, error: null }),
  channel: () => channel,
  removeChannel: () => Promise.resolve('ok'),
});
const picture = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#3b5bdb"/><text x="32" y="40" font-size="24" text-anchor="middle" fill="white" font-family="sans-serif">MB</text></svg>');
Object.defineProperty(supabase, 'storage', { configurable: true, value: {
  from: () => ({
    upload: async (path: string) => { await wait(300); return { data: { path }, error: null }; },
    createSignedUrl: async () => ({ data: { signedUrl: picture }, error: null }),
    remove: async () => ({ data: [], error: null }),
  }),
} });
Object.defineProperty(supabase, 'functions', { configurable: true, value: {
  invoke: async (_name: string, opts?: { body?: Record<string, unknown> }) => {
    const body = opts?.body ?? {};
    await wait(300);
    if (body.action === 'resume') return { data: { onboarding }, error: null };
    if (body.action === 'billing') { Object.assign(profile, body.billing as object); return { data: { saved: true, changed: ['bank_iban'] }, error: null }; }
    if (body.action === 'evidence-submit') {
      evidence = [{ id: `e${evidence.length + 1}`, recruiter_id: USER_ID, kind: body.kind, file_path: body.path, file_name: body.file_name, declaration: null, valid_until: body.valid_until ?? null, status: 'pending', reason: null, uploaded_at: new Date().toISOString(), reviewed_at: null }, ...evidence];
      return { data: { id: 'new', status: 'pending' }, error: null };
    }
    if (body.action === 'income-declare') {
      evidence = [{ id: `e${evidence.length + 1}`, recruiter_id: USER_ID, kind: 'income', file_path: null, file_name: null, declaration: body.declaration, valid_until: null, status: 'approved', reason: null, uploaded_at: new Date().toISOString(), reviewed_at: null }, ...evidence];
      return { data: { id: 'new', status: 'approved' }, error: null };
    }
    if (body.action === 'partner-settings' && partner) {
      const stamp = new Date().toISOString();
      const next: Record<string, unknown> = { ...partner };
      if (typeof body.directory === 'boolean') next.directory_consent_at = body.directory ? stamp : null;
      if (typeof body.expertise === 'boolean') next.show_expertise_at = body.expertise ? stamp : null;
      if (typeof body.channel === 'string') {
        const channels = { ...(partner.channels as Record<string, string>) };
        if (body.done) channels[body.channel] = stamp; else delete channels[body.channel];
        next.channels = channels;
      }
      partner = next;
      return { data: partner, error: null };
    }
    if (body.action === 'partner-certificate') return { data: { file_name: 'Matchunt-Partner-MP-7K3Q-92XW.pdf', base64: samplePdf }, error: null };
    if (body.action === 'partner-qr') return { data: { svg: sampleQr, file_name: 'Matchunt-Partner-QR-MP-7K3Q-92XW.svg' }, error: null };
    if (body.action === 'partner-signature-test') return { data: { sent: true, to: 'marko.benko@freenet.de' }, error: null };
    const message = `Vorschau: Aktion ${String(body.action)} ist nicht nachgestellt.`;
    return { data: null, error: { message, context: new Response(JSON.stringify({ message }), { status: 400 }) } };
  },
} });
Object.assign(supabase.auth, {
  getSession: async () => ({ data: { session }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
});

export function Preview() {
  const section = params.get('section');
  return <QueryClientProvider client={new QueryClient()}>
    <AuthProvider>
      <MemoryRouter initialEntries={[section ? `/recruiter/profile/${section}` : '/recruiter/profile']}>
        <Routes>
          <Route path="/recruiter/profile" element={<RecruiterProfile/>}/>
          <Route path="/recruiter/profile/:section" element={<RecruiterProfile/>}/>
        </Routes>
      </MemoryRouter>
      <Toaster/>
    </AuthProvider>
  </QueryClientProvider>;
}

createRoot(document.getElementById('root')!).render(<Preview/>);
