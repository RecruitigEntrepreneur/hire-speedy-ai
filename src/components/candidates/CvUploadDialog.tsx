import { CvImportDialog } from './cv/CvImportDialog';

interface CvUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCandidateCreated?: (candidateId: string) => void;
  existingCandidateId?: string;
  /** Das Textfeld für Lebenslauf oder LinkedIn-Profil ist gleich offen. */
  startWithText?: boolean;
}

/**
 * „Kandidat aus CV erstellen" und „CV aktualisieren" – seit 01.10.2026 der neue
 * Ablauf mit Prüfseite (cv/CvImportDialog). Der Name bleibt, damit alle Aufrufer
 * (Kandidatenliste, Dashboard, Akte, Detail-Sheet) unverändert funktionieren.
 */
export function CvUploadDialog(props: CvUploadDialogProps) {
  return <CvImportDialog {...props} />;
}
