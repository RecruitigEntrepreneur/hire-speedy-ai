import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { MailPreview } from '@/lib/interviewScheduling';

interface Props {
  preview: MailPreview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Zeigt die Mail an den Kandidaten so, wie sie verschickt würde (abgeschottet im iframe). */
export function MailPreviewDialog({ preview, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] max-w-2xl flex-col gap-3"
        // Fokus nicht ins iframe legen, sonst landet Esc dort und schließt die Vorschau nicht
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>So bekommt der Kandidat die Mail</DialogTitle>
          <DialogDescription>Vorschau mit Ihren aktuellen Angaben. Gesendet wird erst mit „Anfrage senden“.</DialogDescription>
        </DialogHeader>
        {preview && (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <dt className="text-muted-foreground">Von</dt>
              <dd className="truncate">{preview.fromName}</dd>
              <dt className="text-muted-foreground">Betreff</dt>
              <dd className="font-medium">{preview.subject}</dd>
            </dl>
            <iframe
              title="Vorschau der Mail an den Kandidaten"
              srcDoc={preview.html}
              sandbox=""
              className="h-[60vh] w-full rounded-lg border bg-white"
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
