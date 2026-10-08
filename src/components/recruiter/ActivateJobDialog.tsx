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
 * „Ich suche“ von überall, wo eingereicht wird: gleicher Dialog und gleiche
 * Platzregel wie in der Jobliste. Plätze sind für alle gleich (die Datenbank
 * rechnet sie); beim direkten Einreichen ist eine Suche über die Grenze erlaubt.
 */
export function useActivationGate() {
  const activation = useJobActivation();
  const maxSlots = activation.capacity.limit;
  const activeCount = activation.capacity.used;
  const canActivate = activeCount < maxSlots;
  return { ...activation, maxSlots, activeCount, canActivate };
}

export function ActivateJobDialog({
  job,
  onClose,
  onActivated,
  gate,
  forSubmission = false,
}: {
  job: JobLike | null;
  onClose: () => void;
  onActivated: (jobId: string) => void;
  gate: ReturnType<typeof useActivationGate>;
  /** Aus der Akte oder dem Einreichen-Fenster: Suche startet zum Einreichen. */
  forSubmission?: boolean;
}) {
  const { activateJob, activeCount, maxSlots, canActivate } = gate;
  if (!job) return null;

  if (!canActivate && !(forSubmission && activeCount < maxSlots + 1)) {
    return (
      <SlotLimitDialog open onOpenChange={(o) => !o && onClose()} activeCount={activeCount} maxSlots={maxSlots} />
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
      jobId={job.id}
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
      activeCount={activeCount}
      maxSlots={maxSlots}
      forSubmission={forSubmission}
      onConfirm={async () => {
        const res = await activateJob(job.id, forSubmission);
        return res.success && res.result ? { ok: true, result: res.result } : { ok: false, error: res.error || 'Das hat nicht geklappt.' };
      }}
      onSubmitCandidate={done}
      onGoToJob={done}
    />
  );
}
