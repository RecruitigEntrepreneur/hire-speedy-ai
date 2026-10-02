import { InterviewRequestDialog } from '@/components/interview/request/InterviewRequestDialog';

interface InterviewRequestWithOptInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  /** nicht mehr genutzt – Name und Stelle lädt das Anfrage-Fenster selbst */
  candidateAnonymousId: string;
  /** nicht mehr genutzt */
  jobTitle: string;
  /** nicht mehr genutzt */
  jobIndustry?: string;
  onSuccess?: () => void;
}

/**
 * Kompatibilitäts-Wrapper: Früher schrieb dieser Dialog Interview-Anfragen als
 * JSON in submissions.client_notes (keine interviews-Zeile, kein Token, keine
 * E-Mail an den Kandidaten → "Geister-Anfragen", die nirgends auftauchten).
 *
 * Jetzt läuft JEDE Anfrage über das Fenster „Interview anfragen“
 * (InterviewRequestDialog → Edge Function interview-request): echte
 * interviews-Zeile, Mail an Kandidat und Headhunter, sichtbar in der
 * Interview-Agenda. Der Wrapper hält die alte Prop-Signatur stabil.
 */
export function InterviewRequestWithOptInDialog({
  open,
  onOpenChange,
  submissionId,
  onSuccess,
}: InterviewRequestWithOptInDialogProps) {
  return (
    <InterviewRequestDialog
      open={open}
      onOpenChange={onOpenChange}
      submissionId={submissionId}
      onSent={() => onSuccess?.()}
    />
  );
}
