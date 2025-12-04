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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, X, Shield, AlertTriangle, Loader2 } from 'lucide-react';

interface OptInResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  candidateName: string;
  jobIndustry: string;
  onApprove: (submissionId: string) => Promise<void>;
  onDeny: (submissionId: string, reason: string) => Promise<void>;
}

export function OptInResponseDialog({
  open,
  onOpenChange,
  submissionId,
  candidateName,
  jobIndustry,
  onApprove,
  onDeny,
}: OptInResponseDialogProps) {
  const [loading, setLoading] = useState(false);
  const [showDenyReason, setShowDenyReason] = useState(false);
  const [denyReason, setDenyReason] = useState('');

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApprove(submissionId);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async () => {
    if (!denyReason.trim()) {
      setShowDenyReason(true);
      return;
    }
    setLoading(true);
    try {
      await onDeny(submissionId, denyReason);
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
            <Shield className="h-5 w-5 text-primary" />
            Opt-In Anfrage für {candidateName}
          </DialogTitle>
          <DialogDescription>
            Ein Unternehmen in der Branche "{jobIndustry}" möchte ein Interview
            mit diesem Kandidaten führen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Wichtig:</strong> Bitte bestätigen Sie mit dem Kandidaten,
              ob er seine Identität für dieses Unternehmen freigeben möchte.
              <br /><br />
              Bei Zustimmung werden folgende Daten sichtbar:
              <ul className="mt-2 space-y-1 text-sm">
                <li>• Vollständiger Name</li>
                <li>• E-Mail-Adresse</li>
                <li>• Telefonnummer</li>
                <li>• CV / Lebenslauf</li>
                <li>• LinkedIn-Profil</li>
              </ul>
            </AlertDescription>
          </Alert>

          {showDenyReason && (
            <div className="space-y-2">
              <Label htmlFor="deny-reason">Grund für Ablehnung</Label>
              <Textarea
                id="deny-reason"
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="Warum lehnt der Kandidat ab?"
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              if (showDenyReason) {
                handleDeny();
              } else {
                setShowDenyReason(true);
              }
            }}
            disabled={loading}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <X className="h-4 w-4 mr-2" />
            {showDenyReason ? 'Ablehnung bestätigen' : 'Ablehnen'}
          </Button>
          <Button 
            onClick={handleApprove} 
            disabled={loading}
            className="bg-emerald hover:bg-emerald/90"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Zustimmen & Freigeben
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
