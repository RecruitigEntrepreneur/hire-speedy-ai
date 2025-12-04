import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Send, Shield, Loader2 } from 'lucide-react';

interface OptInRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  jobIndustry: string;
  onConfirm: () => Promise<void>;
}

export function OptInRequestDialog({
  open,
  onOpenChange,
  candidateId,
  jobIndustry,
  onConfirm,
}: OptInRequestDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Anonymes Interview anfragen
          </DialogTitle>
          <DialogDescription>
            Die Identität des Kandidaten ist geschützt und wird erst nach seiner
            ausdrücklichen Zustimmung freigegeben.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Triple-Blind Prozess:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• Der Kandidat erhält eine anonyme Anfrage</li>
                <li>• Er sieht nur: "Ein Unternehmen in [{jobIndustry}]"</li>
                <li>• Erst bei Zustimmung werden alle Daten sichtbar</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground">
            <p>Nach dem Senden der Anfrage:</p>
            <ul className="mt-2 space-y-1">
              <li>• Der Recruiter wird benachrichtigt</li>
              <li>• Der Kandidat wird um Zustimmung gebeten</li>
              <li>• Sie erhalten eine Benachrichtigung über das Ergebnis</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Anfrage senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
