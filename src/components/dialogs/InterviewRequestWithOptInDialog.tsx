import { ProfessionalInterviewWizard } from '@/components/dialogs/interview-wizard';

interface InterviewRequestWithOptInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  candidateAnonymousId: string;
  jobTitle: string;
  jobIndustry?: string;
  onSuccess?: () => void;
}

/**
 * Kompatibilitäts-Wrapper: Früher schrieb dieser Dialog Interview-Anfragen als
 * JSON in submissions.client_notes (keine interviews-Zeile, kein Token, keine
 * E-Mail an den Kandidaten → "Geister-Anfragen", die nirgends auftauchten).
 *
 * Jetzt läuft JEDE Anfrage über den ProfessionalInterviewWizard und damit über
 * die send-interview-invitation Edge Function: echte interviews-Zeile mit
 * response_token, E-Mail an den Kandidaten, sichtbar in der Interview-Agenda.
 * Der Wrapper hält die alte Prop-Signatur stabil für alle Aufrufer.
 */
export function InterviewRequestWithOptInDialog({
  open,
  onOpenChange,
  submissionId,
  candidateAnonymousId,
  jobTitle,
  jobIndustry,
  onSuccess,
}: InterviewRequestWithOptInDialogProps) {
  return (
    <ProfessionalInterviewWizard
      open={open}
      onOpenChange={onOpenChange}
      submissionId={submissionId}
      candidateAnonymousId={candidateAnonymousId}
      jobTitle={jobTitle}
      companyDescription={jobIndustry ? `${jobIndustry}-Unternehmen` : undefined}
      onSuccess={onSuccess}
    />
  );
}
