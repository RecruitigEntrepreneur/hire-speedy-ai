import { useRecruiterTrustLevel } from '@/hooks/useRecruiterTrustLevel';
import { useJobActivation } from '@/hooks/useJobActivation';
import { formatAnonymousCompany } from '@/lib/anonymousCompanyFormat';
import { ActivationConfirmDialog, SlotLimitDialog } from './ActivationConfirmDialog';

type JobLike = Record<string, unknown> & { id: string; title: string };

const num = (v: unknown) => (typeof v === 'number' ? v : null);
const str = (v: unknown) => (typeof v === 'string' ? v : null);

function earningOf(job: JobLike): number | null {
  const min = num(job.salary_min);
  const max = num(job.salary_max);
  const fee = num(job.recruiter_fee_percentage);
  if (!fee || (!min && !max)) return null;
  const avg = min && max ? (min + max) / 2 : min || max;
  return avg ? Math.round(avg * (fee / 100)) : null;
}

/**
 * Stelle aktivieren ("Ich suche") von überall, wo eingereicht wird: gleicher
 * Dialog und gleiche Platzregel wie in der Jobliste. Nach der Aktivierung
 * geht es direkt weiter (onActivated), ohne Umweg über die Jobliste.
 */
export function useActivationGate() {
  const trust = useRecruiterTrustLevel();
  const activation = useJobActivation();
  const maxSlots = trust.trustLevel?.max_active_slots ?? 5;
  const activeCount = Math.max(trust.trustLevel?.active_count ?? 0, activation.activatedJobIds.length);
  const canActivate = !!trust.trustLevel && trust.trustLevel.trust_level !== 'suspended' && activeCount < maxSlots;
  return { ...activation, trust, maxSlots, activeCount, canActivate };
}

export function ActivateJobDialog({
  job,
  onClose,
  onActivated,
  gate,
}: {
  job: JobLike | null;
  onClose: () => void;
  onActivated: (jobId: string) => void;
  gate: ReturnType<typeof useActivationGate>;
}) {
  const { trust, activateJob, activeCount, maxSlots, canActivate, refetch } = gate;
  if (!job || !trust.trustLevel) return null;

  if (!canActivate) {
    return (
      <SlotLimitDialog
        open
        onOpenChange={(o) => !o && onClose()}
        activeCount={activeCount}
        maxSlots={maxSlots}
        levelInfo={trust.getLevelInfo()}
      />
    );
  }

  const done = () => {
    onClose();
    onActivated(job.id);
  };

  return (
    <ActivationConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      jobTitle={job.title}
      anonymousLabel={formatAnonymousCompany({
        industry: str(job.industry),
        companySize: str(job.company_size_band),
        fundingStage: str(job.funding_stage),
        techStack: Array.isArray(job.tech_environment) ? (job.tech_environment as string[]) : null,
        location: str(job.location),
        urgency: str(job.hiring_urgency),
        remoteType: str(job.remote_type),
      })}
      earning={earningOf(job)}
      feePercentage={num(job.recruiter_fee_percentage)}
      hiringUrgency={str(job.hiring_urgency)}
      recruiterCount={0}
      activeCount={activeCount}
      maxSlots={maxSlots}
      companyName={str(job.company_name)}
      companyLogoUrl={null}
      companyIndustry={str(job.industry)}
      companyLocation={str(job.location)}
      onConfirm={async () => {
        const result = await activateJob(job.id, trust.trustLevel!.trust_level);
        if (!result.success) return false;
        trust.refetch();
        await refetch();
        done();
        return true;
      }}
      onSubmitCandidate={done}
      onGoToJob={done}
    />
  );
}
