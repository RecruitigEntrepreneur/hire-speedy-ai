import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { CaseReview } from '@/components/admin/network/CaseReview';
import { Button } from '@/components/ui/button';
import { MatchuntWordmark } from '@/components/ui/MatchuntWordmark';
import { TooltipProvider } from '@/components/ui/tooltip';
import { buildTimeline } from '@/lib/recruiterNetwork';
import type { AuditEntry, StoredContract, StoredOnboarding } from '@/lib/recruiterOnboardingApi';
import { cleanProfile } from '../../supabase/functions/_shared/recruiter-contract-policy';
import '@/index.css';

// Separate Vite-Entwicklungsseite für die Vorgangsseite. Ausgedachte Daten, keine
// Anmeldung, keine Aktionen.   /__preview/recruiter-case.html
if (!import.meta.env.DEV) throw new Error('This preview is only available in development.');

const profile = cleanProfile({
  name: 'Mila Beispiel', company: 'Beispiel Partners GmbH', legalForm: 'GmbH', address: 'Musterweg 1, 85354 Freising', country: 'Deutschland',
  taxStatus: 'regular', signer: 'Mila Beispiel', signerEmail: 'mila@beispiel-partners.test', signerRole: 'Geschäftsführerin', authorityDeclared: true,
  expertise: { areas: ['Finance & Controlling', 'IT & Software', 'Executive / C-Level'], levels: ['Fach', 'Führung', 'Executive'], regions: ['Deutschland'], languages: ['Deutsch', 'Englisch'], experience: '5 bis 10 Jahre', placements: '15 bis 30', parallel: '3 bis 5' },
  contractDetails: {
    businessEvidence: 'Handelsregister HRB 00000 (Beispiel)', taxNumber: 'USt-IdNr. DE000000000 (Beispiel)', responsiblePerson: 'Mila Beispiel-Kraus',
    authorityEvidence: 'Geschäftsführerin laut Impressum', insuranceEvidence: 'Kein zusätzlicher Nachweis hinterlegt; wird auf Anfrage nachgereicht.',
    permitsDeclaration: 'Ausschließlich Personalvermittlung, keine Arbeitnehmerüberlassung; keine Erlaubnis nach AÜG erforderlich.',
    incomeConcentration: 'Nein, unter der Hälfte der Erwerbseinkünfte.', dualRole: 'Keine.', privacyContact: 'Mila Beispiel',
    accessCountries: 'Deutschland', transferRecord: 'Keine Drittlandzugriffe vorgesehen; Zugriff nur aus EU/EWR.',
  },
});
const docs = ['framework', 'data', 'pricing', 'rules', 'privacy', 'terms', 'brand'].map(role => ({ role, name: `${role}.pdf`, path: `x/${role}.pdf`, sha256: 'a' })) as StoredContract['documents'];
const signedAt = new Date(Date.now() - 3 * 3600000).toISOString();

const SCENARIOS: Record<string, { label: string; c: Partial<StoredOnboarding>; contract: Partial<StoredContract> | null }> = {
  counter: { label: 'Gegenzeichnen (wie Danny)', c: { state: 'approved', reviewed_at: new Date(Date.now() - 3600000).toISOString(), checks: { identity: true, business: true, tax: true, authority: true, privacy: true } }, contract: { state: 'sent', recruiter_signed_at: signedAt } },
  review: { label: 'Prüfung offen, schon unterschrieben', c: { state: 'review' }, contract: { state: 'sent', recruiter_signed_at: signedAt } },
  waiting: { label: 'Wartet auf Unterschrift', c: { state: 'approved', checks: { identity: true, business: true, tax: true, authority: true, privacy: true } }, contract: { state: 'sent', recruiter_signed_at: null } },
  completed: { label: 'Vertrag komplett', c: { state: 'approved', checks: { identity: true, business: true, tax: true, authority: true, privacy: true } }, contract: { state: 'completed', recruiter_signed_at: signedAt, countersigned_at: new Date().toISOString(), signed_document_path: 'x/combined.pdf', certificate_path: 'x/certificate.pdf' } },
};

export function Preview() {
  const [scenario, setScenario] = useState('counter');
  const [theme, setTheme] = useState('dark');
  const [message, setMessage] = useState('');
  const s = SCENARIOS[scenario];
  const c: StoredOnboarding = { id: 'case-1', revision: 4, entry_source: 'invitation', kind: 'individual', email: 'mila@beispiel-partners.test', profile, state: 'approved', feedback: '', contracts: [],
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(), claimed_at: new Date(Date.now() - 4.9 * 3600000).toISOString(), activated: false, ...s.c };
  const contract: StoredContract | null = s.contract && { id: 'env-1', case_id: 'case-1', package_version: '2.1', documents: docs, recruiter_client_user_id: 'u', recruiter_signed_at: null, countersigned_at: null,
    signed_document_path: null, certificate_path: null, counter_user_id: 'admin', counter_name: 'Marko Benko', counter_email: 'marko@example.test', state: 'sent', ...s.contract };
  const history: AuditEntry[] = [
    { event: 'case.invited', revision: 0, occurred_at: c.created_at! }, { event: 'case.draft', revision: 1, occurred_at: c.claimed_at! },
    { event: 'case.review', revision: 2, occurred_at: new Date(Date.now() - 4 * 3600000).toISOString() }, { event: 'contract.prepared', revision: 0, occurred_at: new Date(Date.now() - 3.9 * 3600000).toISOString() },
    { event: 'contract.sent', revision: 1, occurred_at: new Date(Date.now() - 3.8 * 3600000).toISOString() },
  ];
  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-border/40 bg-card px-4 md:px-6">
      <MatchuntWordmark size="md" />
      <div className="flex items-center gap-3">
        <select aria-label="Szenario" className="rounded-md border border-input bg-background p-1.5 text-sm" value={scenario} onChange={e => { setScenario(e.target.value); setMessage(''); }}>
          {Object.entries(SCENARIOS).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}
        </select>
        <Button variant="ghost" size="icon" aria-label="Farbschema wechseln" onClick={() => { const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); document.documentElement.classList.toggle('light', next === 'light'); }}>{theme === 'dark' ? <Sun /> : <Moon />}</Button>
      </div>
    </header>
    <main className="container py-6">
      <CaseReview key={scenario} c={c} contract={contract} history={history} timeline={buildTimeline({ caseRow: c, contract, mails: [], history, account: null })}
        isCountersigner docusignEnabled busy={false} error="" message={message} onAction={action => setMessage(`Vorschau: Aktion „${action}“ würde jetzt laufen.`)}
        backHref="/admin/recruiters" akteHref="/admin/recruiters?akte=case-1"/>
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<MemoryRouter><TooltipProvider><Preview /></TooltipProvider></MemoryRouter>);
