import { useState, useEffect } from 'react';
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
import {
  Lock,
  Loader2,
  CheckCircle2,
  Users,
  Flame,
  Info,
  ArrowRight,
  UserPlus,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import type { TrustLevelInfo } from '@/hooks/useRecruiterTrustLevel';

interface MiniCandidate {
  id: string;
  full_name: string;
  job_title: string | null;
}

interface ActivationConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTitle: string;
  anonymousLabel: string;
  earning: number | null;
  feePercentage: number | null;
  hiringUrgency: string | null;
  recruiterCount: number;
  activeCount: number;
  maxSlots: number;
  companyName: string | null;
  companyLogoUrl: string | null;
  companyIndustry: string | null;
  companyLocation: string | null;
  onConfirm: () => Promise<boolean>;
  onSubmitCandidate: (candidateId?: string) => void;
  onGoToJob: () => void;
}

const formatEuroShort = (n: number) => (n >= 1000 ? `€${Math.round(n / 1000)}k` : `€${n}`);

export function ActivationConfirmDialog({
  open,
  onOpenChange,
  jobTitle,
  anonymousLabel,
  earning,
  feePercentage,
  hiringUrgency,
  recruiterCount,
  activeCount,
  maxSlots,
  companyName,
  companyLogoUrl,
  companyIndustry,
  companyLocation,
  onConfirm,
  onSubmitCandidate,
  onGoToJob,
}: ActivationConfirmDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'confirm' | 'success'>('confirm');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<MiniCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  const isUrgent = hiringUrgency === 'urgent';

  useEffect(() => {
    if (step !== 'success' || !user) return;
    setCandidatesLoading(true);
    supabase
      .from('candidates')
      .select('id, full_name, job_title')
      .eq('recruiter_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        setCandidates((data as MiniCandidate[]) || []);
        setCandidatesLoading(false);
      });
  }, [step, user]);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const ok = await onConfirm();
      if (ok) {
        setStep('success');
      } else {
        setError('Aktivierung fehlgeschlagen — bitte versuche es erneut.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (loading) return;
    onOpenChange(v);
    if (!v) {
      setConfirmed(false);
      setError(null);
      setStep('confirm');
    }
  };

  const logoInitials = (companyName || '?')
    .split(/\s+/)
    .map(w => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        {step === 'confirm' ? (
          <>
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

                  {/* Business case */}
                  <div className="flex flex-wrap gap-1.5">
                    {earning !== null && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 text-xs font-medium">
                        Fee {feePercentage ? `${feePercentage} % ` : ''}≈ {formatEuroShort(earning)}
                      </span>
                    )}
                    {isUrgent && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/10 text-destructive text-xs font-medium">
                        <Flame className="h-3 w-3" />
                        Dringend
                      </span>
                    )}
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs',
                      recruiterCount === 0
                        ? 'bg-amber-500/10 text-amber-600 font-medium'
                        : 'bg-muted/50 text-muted-foreground',
                    )}>
                      {recruiterCount === 0 ? (
                        <>
                          <Sparkles className="h-3 w-3" />
                          Du wärst der Erste
                        </>
                      ) : (
                        <>
                          <Users className="h-3 w-3" />
                          {recruiterCount} Recruiter aktiv
                        </>
                      )}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Aktive Suchen</span>
                    <span className="font-medium tabular-nums">
                      {activeCount} / {maxSlots} — belegt Slot {Math.min(activeCount + 1, maxSlots)}
                    </span>
                  </div>

                  {/* Rules */}
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      Ziel: erste Einreichung innerhalb von 14 Tagen. Deine Aktivierungsquote zählt für dein Trust-Level.
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Nach der Bestätigung wird der Firmenname enthüllt. Die Aktivierung belegt einen Slot und kann derzeit nicht beendet werden.
                  </p>

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

                  {error && (
                    <p className="text-xs text-destructive">{error}</p>
                  )}
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
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-500">
                <CheckCircle2 className="h-5 w-5" />
                Firma enthüllt
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  {/* Revealed company */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                    {companyLogoUrl ? (
                      <img
                        src={companyLogoUrl}
                        alt=""
                        className="h-10 w-10 rounded-md object-contain bg-background shrink-0"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center text-sm font-semibold text-foreground shrink-0">
                        {logoInitials}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{companyName || 'Unbekannt'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[companyLocation, companyIndustry].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-foreground">{jobTitle}</p>

                  {/* Quick submit */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Direkt loslegen — deine Kandidaten:
                    </p>
                    {candidatesLoading ? (
                      <div className="flex justify-center py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : candidates.length > 0 ? (
                      <div className="space-y-1.5">
                        {candidates.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-2 p-2 rounded-lg border border-border/30"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-foreground truncate">{c.full_name}</p>
                              {c.job_title && (
                                <p className="text-[11px] text-muted-foreground truncate">{c.job_title}</p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs shrink-0"
                              onClick={() => onSubmitCandidate(c.id)}
                            >
                              Einreichen
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border border-dashed border-border/50 text-center">
                        <p className="text-xs text-muted-foreground">Noch keine Kandidaten angelegt.</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 h-7 text-xs gap-1"
                          onClick={() => onSubmitCandidate()}
                        >
                          <UserPlus className="h-3 w-3" />
                          Kandidat anlegen &amp; einreichen
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Später einreichen
              </Button>
              <Button onClick={onGoToJob} className="gap-1.5">
                Zur Stelle
                <ArrowRight className="h-4 w-4" />
              </Button>
            </AlertDialogFooter>
          </>
        )}
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
