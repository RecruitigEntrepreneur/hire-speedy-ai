import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import RecruiterInvitation from '@/pages/onboarding/RecruiterInvitation';
import { cleanProfile } from '../../supabase/functions/_shared/recruiter-contract-policy';
import type { StoredContract, StoredOnboarding } from '@/lib/recruiterOnboardingApi';
import '@/index.css';

// Separate Vite-Entwicklungsseite. Sie meldet niemanden an und lädt keine
// echten Daten: Onboarding-API und Auth werden hier nachgestellt.
//   /__preview/recruiter-onboarding.html?scenario=invite|website|expired|claimed|completed|activated
// Der Code lautet immer 123456.
if (!import.meta.env.DEV) throw new Error('This preview is only available in development.');

const scenario = new URLSearchParams(location.search).get('scenario') ?? 'invite';
const withToken = scenario !== 'website';
const TOKEN = 'Dulvku-GjoMLCexGNWKqHx5OP74-HKw69DktxuGcr_4';
// Die Seite liest den Token aus dem Fragment, wenn der Pfad auf /invitation endet.
if (withToken) history.replaceState(null, '', `/__preview/invitation?scenario=${scenario}#${TOKEN}`);
else history.replaceState(null, '', `/__preview/onboarding?scenario=${scenario}`);

const user = { id: 'user-1', email: 'marko.benko@freenet.de', email_confirmed_at: '2026-09-15T09:00:00Z', user_metadata: { full_name: 'Marko Benko' }, app_metadata: {}, aud: 'authenticated', created_at: '2026-09-15T09:00:00Z' } as User;
const makeSession = (): Session => ({ access_token: 'preview-access', refresh_token: 'preview-refresh', expires_in: 3600, token_type: 'bearer', user } as Session);
// Späte Szenarien starten angemeldet, damit der Vertragsteil direkt sichtbar ist.
let session: Session | null = ['completed', 'activated'].includes(scenario) ? makeSession() : null;
const listeners: ((event: string, session: Session | null) => void)[] = [];
const emit = (event: string) => listeners.forEach(l => l(event, session));

const completedContract: StoredContract = {
  id: 'env-1', case_id: 'case-1', state: 'completed', package_version: 'Fassung 2.1',
  documents: [{ role: 'framework', name: 'Rahmenvertrag', path: 'x/framework.pdf', sha256: 'a' }, { role: 'data', name: 'Anlage 1', path: 'x/data.pdf', sha256: 'b' }],
  recruiter_client_user_id: 'user-1', recruiter_signed_at: '2026-09-15T10:00:00Z', countersigned_at: '2026-09-15T11:00:00Z',
  signed_document_path: 'x/combined.pdf', certificate_path: 'x/certificate.pdf',
};
let onboarding: StoredOnboarding = {
  id: 'case-1', revision: 3, entry_source: withToken ? 'invitation' : 'website', kind: 'individual', email: 'marko.benko@freenet.de',
  profile: cleanProfile({ name: 'Marko Benko', company: 'Bluewater Bridge', country: 'Deutschland', specialty: 'Finance & Controlling', region: 'DACH', signer: 'Marko Benko', signerEmail: 'marko.benko@freenet.de' }),
  state: ['completed', 'activated'].includes(scenario) ? 'approved' : 'draft', feedback: '',
  contracts: ['completed', 'activated'].includes(scenario) ? [completedContract] : [],
  activated: scenario === 'activated',
};

const fail = (message: string, status = 400) => ({ data: null, error: { message, context: new Response(JSON.stringify({ message }), { status }) } });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// `supabase.functions` ist ein Getter, der bei jedem Zugriff einen neuen Client
// liefert; deshalb wird die Eigenschaft selbst ersetzt statt nur die Methode.
Object.defineProperty(supabase, 'functions', { configurable: true, value: {
  invoke: async (_name: string, opts?: { body?: Record<string, unknown> }) => {
    const body = opts?.body ?? {};
    await wait(350);
    switch (body.action) {
      case 'peek':
        return { data: { name: 'Marko', masked_email: 'ma********@freenet.de', expires_at: '2026-09-22T00:00:00Z', status: scenario === 'expired' ? 'expired' : scenario === 'claimed' ? 'claimed' : 'open' }, error: null };
      case 'code':
        if (!body.token && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(body.email))) return fail('Bitte gib eine gültige E-Mail-Adresse an.');
        return { data: { sent: true, masked_email: body.token ? 'ma********@freenet.de' : String(body.email).replace(/^(..)[^@]*/, '$1***'), code_length: 6 }, error: null };
      case 'verify':
        if (String(body.code).replace(/\s+/g, '') !== '123456') return fail('Der Code ist falsch oder abgelaufen. Fordere einfach einen neuen an.');
        return { data: { access_token: 'preview-access', refresh_token: 'preview-refresh', expires_in: 3600 }, error: null };
      case 'load':
        return { data: onboarding, error: null };
      case 'resume':
        return { data: { onboarding: scenario === 'website' && onboarding.revision === 3 ? null : onboarding }, error: null };
      case 'begin':
        onboarding = { ...onboarding, revision: 4, kind: String(body.kind) };
        return { data: { onboarding }, error: null };
      case 'save':
      case 'submit':
        onboarding = { ...onboarding, revision: onboarding.revision + 1, profile: cleanProfile(body.profile), state: body.action === 'submit' ? 'review' : 'draft' };
        return { data: onboarding, error: null };
      case 'start':
        return fail('Vorschau: DocuSign wird hier nicht aufgerufen.');
      case 'document':
        return fail('Vorschau: Dokumente werden hier nicht geöffnet.');
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
  signOut: async () => { session = null; emit('SIGNED_OUT'); return { error: null }; },
  updateUser: async () => { await wait(300); return { data: { user }, error: null }; },
});

createRoot(document.getElementById('root')!).render(<BrowserRouter><RecruiterInvitation /></BrowserRouter>);
