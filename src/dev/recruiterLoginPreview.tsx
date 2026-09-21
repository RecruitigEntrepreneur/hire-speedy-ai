import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthProvider, useAuth } from '@/lib/auth';
import RecruiterLogin from '@/pages/recruiter/RecruiterLogin';
import '@/index.css';

// Separate Vite-Entwicklungsseite für /recruiter/login. Sie meldet niemanden an
// und ruft keinen Server auf: Code-API, Auth und Rollenabfrage sind nachgestellt.
//   /__preview/recruiter-login.html?scenario=first|returning|signed-in
// Der Code lautet immer 123456. Das Passwort „passwort“ gilt als zu einfach.
if (!import.meta.env.DEV) throw new Error('This preview is only available in development.');

const scenario = new URLSearchParams(location.search).get('scenario') ?? 'first';
let user = {
  id: 'user-1', email: 'dk@kmb-partners.com', app_metadata: {}, aud: 'authenticated', created_at: '2026-09-15T09:00:00Z',
  user_metadata: { full_name: 'Danny Kostic', ...(scenario === 'returning' ? { password_set_at: '2026-09-20T10:00:00Z' } : {}) },
} as User;
const makeSession = (): Session => ({ access_token: 'preview-access', refresh_token: 'preview-refresh', expires_in: 3600, token_type: 'bearer', user } as Session);
let session: Session | null = scenario === 'signed-in' ? makeSession() : null;
const listeners: ((event: string, session: Session | null) => void)[] = [];
const emit = (event: string) => listeners.forEach(l => l(event, session));

const fail = (message: string, status = 400) => ({ data: null, error: { message, context: new Response(JSON.stringify({ message }), { status }) } });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// `supabase.functions` ist ein Getter; deshalb wird die Eigenschaft selbst ersetzt.
Object.defineProperty(supabase, 'functions', { configurable: true, value: {
  invoke: async (_name: string, opts?: { body?: Record<string, unknown> }) => {
    const body = opts?.body ?? {};
    await wait(350);
    if (body.login !== true) return fail('Vorschau: nur der Anmelde-Modus ist nachgestellt.');
    switch (body.action) {
      case 'code':
        if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(body.email))) return fail('Bitte gib eine gültige E-Mail-Adresse an.');
        return { data: { sent: true, masked_email: String(body.email).replace(/^(..)[^@]*/, '$1****'), code_length: 6 }, error: null };
      case 'verify':
        if (String(body.code) !== '123456') return fail('Der Code ist falsch oder abgelaufen. Fordere einfach einen neuen an.');
        return { data: { access_token: 'preview-access', refresh_token: 'preview-refresh', expires_in: 3600 }, error: null };
      default:
        return fail(`Vorschau: Aktion ${String(body.action)} ist nicht nachgestellt.`);
    }
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

// Rollenabfrage im AuthProvider: das Konto ist ein Headhunter.
Object.assign(supabase, { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'recruiter' }, error: null }) }) }) }) });

function DashboardStandIn() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  return <div className="mx-auto max-w-xl space-y-2 p-10">
    <h1 className="text-2xl font-semibold">Dashboard (Vorschau)</h1>
    <p>Angemeldet als {user?.email ?? 'niemand'}, gelandet auf {pathname}.</p>
    <p className="text-sm text-muted-foreground">Passwort-Merker: {String(user?.user_metadata?.password_set_at ?? 'keiner')}</p>
  </div>;
}

export function Preview() {
  return <AuthProvider>
    <MemoryRouter initialEntries={['/recruiter/login?next=%2Frecruiter%2Fjobs']}>
      <Routes>
        <Route path="/recruiter/login" element={<RecruiterLogin/>}/>
        <Route path="*" element={<DashboardStandIn/>}/>
      </Routes>
    </MemoryRouter>
  </AuthProvider>;
}

createRoot(document.getElementById('root')!).render(<Preview/>);
