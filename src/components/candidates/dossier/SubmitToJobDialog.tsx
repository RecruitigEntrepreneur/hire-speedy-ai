import { VorstellenFenster } from '@/components/recruiter/vorstellen/VorstellenFenster';

/**
 * Vorstellen aus dem Kandidatenprofil (seit 09.11.2026 der neue Einreichungsweg):
 * erst Stelle wählen, bei der ersten Einreichung je Firma die Kundenfrage, dann
 * Passung, Kundenansicht, Abschicken und Fertig – alles in einem Fenster.
 */
export function SubmitToJobDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  onSubmitted,
  initialJobId = null,
  onOpenInterview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  onSubmitted: () => void;
  /** Aus „Passende Stellen": diese Stelle gleich öffnen, wenn sie aktiviert ist. */
  initialJobId?: string | null;
  /** „Interview fortsetzen“: Profil öffnet das Interview und danach wieder das Vorstellen. */
  onOpenInterview?: (candidateId: string, jobId: string | null) => void;
}) {
  return (
    <VorstellenFenster
      open={open}
      onOpenChange={onOpenChange}
      candidate={{ id: candidateId, name: candidateName }}
      initialJobId={initialJobId}
      onSubmitted={onSubmitted}
      onOpenInterview={onOpenInterview}
    />
  );
}
