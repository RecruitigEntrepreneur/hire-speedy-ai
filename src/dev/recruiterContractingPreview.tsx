import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthProvider } from '@/lib/auth';
import { TooltipProvider } from '@/components/ui/tooltip';
import { JobActionCard } from '@/components/recruiter/JobActionCard';
import { JobPreviewPanel } from '@/components/recruiter/JobPreviewPanel';
import { ActivationConfirmDialog } from '@/components/recruiter/ActivationConfirmDialog';
import { RecruiterJobWorkspace } from '@/components/recruiter/RecruiterJobWorkspace';
import { verdienstJeTag } from '@/lib/recruiterContracting';
import '@/index.css';

// Separate Vite-Entwicklungsseite: eine Contracting-Stelle, wie Recruiter sie seit
// Migration 20260929100000 sehen. Ruft keinen Server auf.
//   /__preview/recruiter-contracting.html?screen=liste|arbeitsbereich|aktivieren
if (!import.meta.env.DEV) throw new Error('This preview is only available in development.');

const screen = new URLSearchParams(location.search).get('screen') ?? 'liste';
const user = { id: 'recruiter-1', email: 'recruiter@matchunt.test', app_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z', user_metadata: {} } as User;
const session = { access_token: 'preview', refresh_token: 'preview', expires_in: 3600, token_type: 'bearer', user } as Session;
Object.assign(supabase, { from: () => {
  const q: Record<string, unknown> = {
    select: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q,
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve: (r: unknown) => unknown) => Promise.resolve({ data: [{ role: 'recruiter' }], error: null }).then(resolve),
  };
  return q;
} });
Object.assign(supabase.auth, {
  getSession: async () => ({ data: { session }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
});

// Kundenbudget 400–1.000 € all-in → so kommt die Stelle aus recruiter_jobs_view.
const stelle = {
  id: 'job-1', title: 'Arzt / Ärztin (m/w/d) für Cannabinoidmedizin & Telemedizin', company_name: null,
  location: 'München', remote_type: 'hybrid', employment_type: 'freelance', experience_level: 'senior',
  salary_min: null, salary_max: null, recruiter_fee_percentage: 11, fee_percentage: null,
  day_rate_min: 310, day_rate_max: 780, recruiter_day_earning_min: 44, recruiter_day_earning_max: 110,
  utilization_days_per_week: 3, contract_duration_months: 12, extension_possible: true,
  skills: ['Cannabinoidmedizin', 'Telemedizin', 'Approbation'], hiring_urgency: null, industry: 'Telemedizin',
  company_size_band: '1-50', funding_stage: null, tech_environment: null,
  created_at: '2026-09-29T08:00:00Z', updated_at: '2026-09-29T08:00:00Z',
  formatted_content: { role_summary: 'Ärztliche Betreuung von Patientinnen und Patienten per Videosprechstunde.' },
  must_have_criteria: ['Approbation', 'Erfahrung Cannabinoidmedizin'],
};
const nichts = () => undefined;

function Ansicht() {
  if (screen === 'arbeitsbereich') {
    return <RecruiterJobWorkspace job={stelle} companyRevealed={false} fullAccess={false} submissionCount={0} candidates={null} onSubmit={nichts} onExpose={nichts} />;
  }
  if (screen === 'aktivieren') {
    return (
      <ActivationConfirmDialog open onOpenChange={nichts} jobTitle={stelle.title} anonymousLabel="[Telemedizin | 1–50 MA | Hybrid München]"
        earning={null} feePercentage={11} earningPerDay={verdienstJeTag(stelle)} hiringUrgency={null} recruiterCount={2}
        activeCount={1} maxSlots={5} companyName={null} companyLogoUrl={null} companyIndustry="Telemedizin" companyLocation="München"
        onConfirm={async () => false} onSubmitCandidate={nichts} onGoToJob={nichts} />
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <JobActionCard job={{ ...stelle, company_name: '', location: stelle.location }} earning={null} isRevealed={false} isSelected
        isActive={false} recruiterCount={2} submittedCount={0} onSelect={nichts} onToggleActive={nichts} />
      <div className="h-[560px] rounded-lg border"><JobPreviewPanel job={{ ...stelle, company_name: '' }} earning={null} isRevealed={false} isActive={false} onToggleActive={nichts} onClose={nichts} /></div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <TooltipProvider>
      <MemoryRouter>
        <main className="mx-auto max-w-5xl p-6"><Ansicht /></main>
      </MemoryRouter>
    </TooltipProvider>
  </AuthProvider>,
);
