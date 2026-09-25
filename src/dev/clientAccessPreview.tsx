import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { Toaster } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AuthProvider, useAuth } from '@/lib/auth';
import ClientLogin from '@/pages/ClientLogin';
import { ClientAccessPanel } from '@/components/admin/ClientAccessPanel';
import '@/index.css';

// Separate Vite-Entwicklungsseite für den Kundenzugang nach der Gegenzeichnung.
// Sie meldet niemanden an und ruft keinen Server auf; alles ist nachgestellt.
//   /__preview/client-access.html?view=login&scenario=link|link-expired|email|returning
//   /__preview/client-access.html?view=admin&scenario=sent|held|missing|waiting|failed
// Der Code lautet immer 123456. Das Passwort „passwort“ gilt als zu einfach.
if (!import.meta.env.DEV) throw new Error('This preview is only available in development.');

const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'login';
const scenario = params.get('scenario') ?? (view === 'admin' ? 'sent' : 'link');
const LINK = `2b1f3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d.${'k'.repeat(43)}`;
if (view === 'login' && scenario.startsWith('link')) history.replaceState(null, '', `${location.pathname}${location.search}#${LINK}`);

let user = {
  id: 'kunde-1', email: 'luca.bartosch@kanna-medics.de', app_metadata: {}, aud: 'authenticated', created_at: '2026-09-25T12:29:00Z',
  user_metadata: { full_name: 'Luca Bartosch', ...(scenario === 'returning' ? { password_set_at: '2026-09-25T13:00:00Z' } : {}) },
} as User;
const makeSession = (): Session => ({ access_token: 'preview-access', refresh_token: 'preview-refresh', expires_in: 3600, token_type: 'bearer', user } as Session);
let session: Session | null = null;
const listeners: ((event: string, session: Session | null) => void)[] = [];
const emit = (event: string) => listeners.forEach(l => l(event, session));
const fail = (message: string, status = 400) => ({ data: null, error: { message, context: new Response(JSON.stringify({ message }), { status }) } });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const access = {
  account: { user_id: 'kunde-1', email: 'luca.bartosch@kanna-medics.de', roles: [scenario === 'held' ? 'recruiter' : 'client'],
    created_at: '2026-07-02T12:27:28Z', last_sign_in_at: scenario === 'sent' ? '2026-09-25T13:02:00Z' : null,
    password_set_at: scenario === 'sent' ? '2026-09-25T13:02:30Z' : null },
  mail: scenario === 'sent' ? { created_at: '2026-09-25T12:29:03Z', status: 'sent', error_message: null, to_email: 'luca.bartosch@kanna-medics.de' }
    : scenario === 'failed' ? { created_at: '2026-09-25T12:29:03Z', status: 'failed', error_message: 'Resend: 403 domain not verified', to_email: 'luca.bartosch@kanna-medics.de' }
    : null,
  countersigned: scenario !== 'waiting',
  signature_required: true,
  accepted: scenario !== 'waiting',
};

// `supabase.functions` ist ein Getter; deshalb wird die Eigenschaft selbst ersetzt.
Object.defineProperty(supabase, 'functions', { configurable: true, value: {
  invoke: async (name: string, opts?: { body?: Record<string, unknown> }) => {
    const body = opts?.body ?? {};
    await wait(350);
    if (name === 'intake-admin') {
      if (body.action === 'access_status') return { data: access, error: null };
      if (body.action === 'make_client') { access.account.roles = ['client']; access.mail = { created_at: new Date().toISOString(), status: 'sent', error_message: null, to_email: access.account.email }; return { data: { ok: true }, error: null }; }
      if (body.action === 'resend_access') { access.mail = { created_at: new Date().toISOString(), status: 'sent', error_message: null, to_email: access.account.email }; return { data: { ok: true }, error: null }; }
      return fail(`Vorschau: ${String(body.action)} ist nicht nachgestellt.`);
    }
    if (name === 'docusign-status') { access.countersigned = true; access.accepted = true; access.mail = { created_at: new Date().toISOString(), status: 'sent', error_message: null, to_email: access.account.email }; return { data: { summary: 'beidseitig unterzeichnet', countersigned: true }, error: null }; }
    if (body.action === 'peek') {
      if (body.link !== LINK) return { data: { status: 'invalid' }, error: null };
      return { data: scenario === 'link-expired' ? { status: 'expired' } : { status: 'open', name: 'Luca Bartosch', masked_email: 'lu***@kanna-medics.de' }, error: null };
    }
    if (body.link !== undefined && (body.link !== LINK || scenario === 'link-expired')) return fail('Dieser Link ist abgelaufen. Geben Sie Ihre E-Mail-Adresse ein, wir senden Ihnen einen Code.');
    if (body.action === 'code') {
      if (body.link !== undefined) return { data: { sent: true, masked_email: 'lu***@kanna-medics.de', code_length: 6 }, error: null };
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(body.email))) return fail('Bitte geben Sie eine gültige E-Mail-Adresse an.');
      return { data: { sent: true, masked_email: String(body.email).replace(/^(..)[^@]*/, '$1***'), code_length: 6 }, error: null };
    }
    if (body.action === 'verify') {
      if (String(body.code) !== '123456') return fail('Der Code stimmt nicht. Prüfen Sie ihn oder fordern Sie unten einen neuen an.');
      return { data: { access_token: 'preview-access', refresh_token: 'preview-refresh', expires_in: 3600 }, error: null };
    }
    return fail(`Vorschau: ${name} ist nicht nachgestellt.`);
  },
} });

Object.assign(supabase.auth, {
  getSession: async () => ({ data: { session }, error: null }),
  onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
    listeners.push(callback);
    return { data: { subscription: { unsubscribe: () => { const i = listeners.indexOf(callback); if (i >= 0) listeners.splice(i, 1); } } } };
  },
  setSession: async () => { session = makeSession(); emit('SIGNED_IN'); return { data: { session, user }, error: null }; },
  updateUser: async (attrs: { password?: string; data?: Record<string, unknown> }) => {
    await wait(400);
    if (attrs.password === 'passwort') return { data: { user: null }, error: Object.assign(new Error('Password is known to be weak'), { code: 'weak_password', status: 422 }) };
    user = { ...user, user_metadata: { ...user.user_metadata, ...attrs.data } } as User;
    session = makeSession(); emit('USER_UPDATED');
    return { data: { user }, error: null };
  },
  signOut: async () => { session = null; emit('SIGNED_OUT'); return { error: null }; },
});

// Rollenabfrage im AuthProvider: das Konto ist ein Kunde.
Object.assign(supabase, { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'client' }, error: null }) }) }) }) });

function DashboardStandIn() {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  return <div className="mx-auto max-w-xl space-y-2 p-10">
    <h1 className="text-2xl font-semibold">Kunden-Dashboard (Vorschau)</h1>
    <p>Angemeldet als {user?.email ?? 'niemand'}, gelandet auf {pathname}{search}.</p>
    <p className="text-sm text-muted-foreground">{search.includes('rundgang') ? 'Erster Besuch: der Rundgang wird angeboten.' : 'Kein Rundgang (nicht der erste Besuch).'}</p>
  </div>;
}

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

createRoot(document.getElementById('root')!).render(view === 'admin'
  ? <QueryClientProvider client={queryClient}>
      <div className="mx-auto max-w-3xl p-8"><ClientAccessPanel draftId="draft-1" hasEnvelope/></div>
      <Toaster/>
    </QueryClientProvider>
  : <AuthProvider>
      <MemoryRouter initialEntries={['/anmelden']}>
        <Routes>
          <Route path="/anmelden" element={<ClientLogin/>}/>
          <Route path="*" element={<DashboardStandIn/>}/>
        </Routes>
      </MemoryRouter>
    </AuthProvider>);
