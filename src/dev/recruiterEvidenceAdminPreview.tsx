import { createRoot } from 'react-dom/client';
import { supabase } from '@/integrations/supabase/client';
import { EvidencePanel } from '@/components/admin/network/EvidencePanel';
import { PartnerStatusAdmin } from '@/components/admin/network/PartnerStatusAdmin';
import '@/index.css';

// Separate Vite-Entwicklungsseite für Akte › Nachweise in der Recruiterverwaltung.
// Datenbank, Speicher und die Admin-Function sind nachgestellt.
//   /__preview/recruiter-evidence-admin.html
if (!import.meta.env.DEV) throw new Error('This preview is only available in development.');

const USER_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const iso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
let rows: Record<string, unknown>[] = [
  { id: '11111111-1111-4111-8111-111111111111', recruiter_id: USER_ID, kind: 'insurance', file_path: `${USER_ID}/insurance/2-police.pdf`, file_name: 'Police 2026.pdf', declaration: null, valid_until: iso(160).slice(0, 10), status: 'pending', reason: null, uploaded_at: iso(-1), reviewed_at: null },
  { id: '22222222-2222-4222-8222-222222222222', recruiter_id: USER_ID, kind: 'business', file_path: `${USER_ID}/business/1-register.pdf`, file_name: 'Registerauszug.pdf', declaration: null, valid_until: null, status: 'approved', reason: null, uploaded_at: iso(-3), reviewed_at: iso(-2) },
  { id: '33333333-3333-4333-8333-333333333333', recruiter_id: USER_ID, kind: 'income', file_path: null, file_name: null, declaration: 'below', valid_until: null, status: 'approved', reason: null, uploaded_at: iso(-4), reviewed_at: null },
];
let partner: Record<string, unknown> = { user_id: USER_ID, partner_number: 'MP-7K3Q-92XW', tier: 'partner', contract_version: '2.1', granted_at: '2026-09-21T15:30:00Z', ended_at: null, end_reason: null,
  directory_consent_at: iso(-1), show_expertise_at: null, channels: { linkedin: iso(-1), signature: iso(0) }, website_domain: 'bluewater-bridge.de', website_seen_at: iso(0) };
const profile = { user_id: USER_ID, recruiter_expertise: { areas: ['Finance & Controlling'], levels: ['Fach', 'Führung'], regions: ['Deutschland', 'Österreich'], languages: ['Deutsch', 'Englisch'] } };
const chain = (table: string) => {
  const q: Record<string, unknown> = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (resolve: (v: unknown) => unknown) => Promise.resolve({ data: table === 'recruiter_evidence' ? rows : [profile], error: null }).then(resolve);
      if (prop === 'maybeSingle') return () => Promise.resolve({ data: table === 'profiles' ? profile : table === 'recruiter_partner_status' ? partner : null, error: null });
      return () => q;
    },
  });
  return q;
};
Object.assign(supabase, { from: (table: string) => chain(table) });
Object.defineProperty(supabase, 'storage', { configurable: true, value: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'about:blank' }, error: null }) }) } });
Object.defineProperty(supabase, 'functions', { configurable: true, value: {
  invoke: async (_name: string, opts?: { body?: Record<string, unknown> }) => {
    const body = opts?.body ?? {};
    await new Promise(r => setTimeout(r, 300));
    if (body.action === 'partner-status') {
      partner = { ...partner, ended_at: body.active ? null : new Date().toISOString(), end_reason: body.active ? null : 'revoked' };
      return { data: partner, error: null };
    }
    if (body.action === 'evidence-review') {
      rows = rows.map(r => r.id === body.id ? { ...r, status: body.decision, reason: body.decision === 'rejected' ? body.reason : null, reviewed_at: new Date().toISOString() } : r);
      return { data: { id: body.id, status: body.decision, mailed: body.decision === 'rejected' }, error: null };
    }
    return { data: null, error: { message: 'Vorschau: nicht nachgestellt.' } };
  },
} });

export function Preview() {
  return <div className="mx-auto max-w-2xl p-8"><h1 className="mb-4 text-xl font-semibold">Akte › Übersicht und Nachweise (Vorschau)</h1><div className="mb-6"><PartnerStatusAdmin userId={USER_ID} active onChanged={() => undefined}/></div><EvidencePanel userId={USER_ID} active onChanged={() => undefined}/></div>;
}

createRoot(document.getElementById('root')!).render(<Preview/>);
