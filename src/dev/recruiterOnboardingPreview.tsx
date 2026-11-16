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
//     |returned|returned-late|returned-cancel|signed
// Der Code lautet immer 123456.
// Rückkehr aus DocuSign: `returned` bestätigt bei der ersten Nachfrage, `returned-late` nie
// (nach 2 Minuten „dauert länger“), `returned-cancel` kommt mit event=cancel, `signed` ohne event.
if (!import.meta.env.DEV) throw new Error('This preview is only available in development.');

const scenario = new URLSearchParams(location.search).get('scenario') ?? 'invite';
const RETURN_EVENTS: Record<string, string> = { returned: 'signing_complete', 'returned-late': 'signing_complete', 'returned-cancel': 'cancel' };
const contractScenario = scenario in RETURN_EVENTS || scenario === 'signed';
const withToken = scenario !== 'website' && !contractScenario;
const TOKEN = 'Dulvku-GjoMLCexGNWKqHx5OP74-HKw69DktxuGcr_4';
// Die Seite liest den Token aus dem Fragment, wenn der Pfad auf /invitation endet.
// DocuSign kehrt wie live auf /recruiter/onboarding zurück, also ohne Token.
if (withToken) history.replaceState(null, '', `/__preview/invitation?scenario=${scenario}#${TOKEN}`);
else history.replaceState(null, '', `/__preview/onboarding?scenario=${scenario}${RETURN_EVENTS[scenario] ? `&event=${RETURN_EVENTS[scenario]}` : ''}`);

const user = { id: 'user-1', email: 'marko.benko@freenet.de', email_confirmed_at: '2026-09-15T09:00:00Z', user_metadata: { full_name: 'Marko Benko' }, app_metadata: {}, aud: 'authenticated', created_at: '2026-09-15T09:00:00Z' } as User;
const makeSession = (): Session => ({ access_token: 'preview-access', refresh_token: 'preview-refresh', expires_in: 3600, token_type: 'bearer', user } as Session);
// Späte Szenarien starten angemeldet, damit der Vertragsteil direkt sichtbar ist.
let session: Session | null = ['completed', 'activated'].includes(scenario) || contractScenario ? makeSession() : null;
const listeners: ((event: string, session: Session | null) => void)[] = [];
const emit = (event: string) => listeners.forEach(l => l(event, session));

const completedContract: StoredContract = {
  id: 'env-1', case_id: 'case-1', state: 'completed', package_version: 'Fassung 2.1',
  documents: [{ role: 'framework', name: 'Rahmenvertrag', path: 'x/framework.pdf', sha256: 'a' }, { role: 'data', name: 'Anlage 1', path: 'x/data.pdf', sha256: 'b' }],
  recruiter_client_user_id: 'user-1', recruiter_signed_at: '2026-09-15T10:00:00Z', countersigned_at: '2026-09-15T11:00:00Z',
  signed_document_path: 'x/combined.pdf', certificate_path: 'x/certificate.pdf',
};
// Statt DocuSign: eine Seite im Rahmen, die wie DocuSign `signing_complete` meldet.
const signingMock = () => URL.createObjectURL(new Blob([`<!doctype html><meta charset="utf-8"><body style="font:15px sans-serif;background:#fff;color:#111;padding:40px"><h2>DocuSign (Nachbildung)</h2><p>Rahmenvertrag und sechs Anlagen</p><button onclick="parent.postMessage({event:'signing_complete'},'*')" style="padding:10px 18px">Fertigstellen</button> <button onclick="parent.postMessage({type:'matchunt:sign-return',event:'cancel'},location.origin)" style="padding:10px 18px">Abbrechen</button>`], { type: 'text/html' }));
// Versendet, Headhunter-Unterschrift offen (bzw. bei `signed` schon erkannt).
const sentContract: StoredContract = {
  ...completedContract, state: 'sent', countersigned_at: null, signed_document_path: null, certificate_path: null,
  recruiter_signed_at: scenario === 'signed' ? '2026-09-25T12:12:00Z' : null,
};
let onboarding: StoredOnboarding = {
  id: 'case-1', revision: 3, entry_source: withToken ? 'invitation' : 'website', kind: 'individual', email: 'marko.benko@freenet.de',
  profile: cleanProfile({ name: 'Luca Beispiel', company: 'Greeners GmbH', country: 'Deutschland', specialty: 'Finance & Controlling', region: 'DACH', signer: 'Luca Beispiel', signerEmail: 'marko.benko@freenet.de' }),
  state: ['completed', 'activated'].includes(scenario) ? 'approved' : contractScenario ? 'review' : 'draft', feedback: '',
  contracts: ['completed', 'activated'].includes(scenario) ? [completedContract] : contractScenario ? [sentContract] : [],
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
      case 'enrich': {
        await wait(900);
        if (!body.website && !withToken) return fail('Bitte gib die Website deines Unternehmens an.');
        const source = body.website ? String(body.website).replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] : 'bluewater-bridge.de';
        return { data: { suggestion: { company: 'Bluewater Bridge GmbH', legalForm: 'GmbH', address: 'Musterstraße 1, 20095 Hamburg', country: 'Deutschland', taxStatus: 'regular', vatId: 'DE123456789', registration: 'HRB 12345', ceo: 'Marko Benko', source } }, error: null };
      }
      case 'sync': {
        // Nachfrage bei DocuSign: `returned` erkennt die Unterschrift gleich beim ersten Mal.
        await wait(2500);
        if (scenario === 'returned' && body.returned === true) {
          onboarding = { ...onboarding, contracts: onboarding.contracts.map(k => ({ ...k, recruiter_signed_at: new Date().toISOString() })) };
        }
        return { data: onboarding, error: null };
      }
      case 'start': {
        await wait(1500);
        onboarding = { ...onboarding, contracts: [sentContract] };
        return { data: { url: signingMock() }, error: null };
      }
      case 'signature':
        return { data: { url: signingMock() }, error: null };
      case 'access':
        // Nicht weiterleiten: Hier soll der Stand sichtbar bleiben.
        return { data: { allowed: false, pending: false }, error: null };
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
