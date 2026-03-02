import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Lock, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrustLevelInfo } from '@/hooks/useRecruiterTrustLevel';

interface ActivationConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTitle: string;
  anonymousLabel: string;
  activeCount: number;
  maxSlots: number;
  levelInfo: TrustLevelInfo;
  onConfirm: () => Promise<void>;
}

export function ActivationConfirmDialog({
  open,
  onOpenChange,
  jobTitle,
  anonymousLabel,
  activeCount,
  maxSlots,
  levelInfo,
  onConfirm,
}: ActivationConfirmDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
      setConfirmed(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!loading) {
      onOpenChange(v);
      if (!v) setConfirmed(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Aktiv suchen
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              {/* Job info */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                <p className="font-medium text-foreground text-sm">{jobTitle}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{anonymousLabel}</p>
              </div>

              {/* Info */}
              <p className="text-sm">
                Nach Bestätigung erhältst du Zugang zum Firmennamen und allen Details.
              </p>

              {/* Stats */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Aktive Suchen</span>
                <span className="font-medium tabular-nums">{activeCount} / {maxSlots}</span>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Diese Zusage kann nicht rückgängig gemacht werden.
                </p>
              </div>

              {/* Checkbox */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(v === true)}
                  className="mt-0.5"
                />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  Ich bestätige, dass ich aktiv passende Kandidaten für diese Stelle suchen werde.
                </span>
              </label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Abbrechen</AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={!confirmed || loading}
            className="gap-1.5"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>Ich suche aktiv</>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface SlotLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount: number;
  maxSlots: number;
  levelInfo: TrustLevelInfo;
}

export function SlotLimitDialog({
  open,
  onOpenChange,
  activeCount,
  maxSlots,
  levelInfo,
}: SlotLimitDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Limit erreicht
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p className="text-sm">
                Du hast bereits {activeCount} aktive Suchen.
                Reiche Kandidaten für bestehende Suchen ein, um dein Limit zu erhöhen.
              </p>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span>🟤 Bronze</span>
                  <span className={cn('tabular-nums', levelInfo.level === 'bronze' && 'font-bold')}>
                    5 Suchen
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>🔵 Silber (ab 3 Placements)</span>
                  <span className={cn('tabular-nums', levelInfo.level === 'silver' && 'font-bold')}>
                    10 Suchen
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>⭐ Gold (ab 10 Placements)</span>
                  <span className={cn('tabular-nums', levelInfo.level === 'gold' && 'font-bold')}>
                    15 Suchen
                  </span>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Schließen</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
