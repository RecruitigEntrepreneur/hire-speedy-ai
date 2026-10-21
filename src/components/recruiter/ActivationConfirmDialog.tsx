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
import { Lock, Loader2, Flame, ArrowRight, UserPlus, Search, Eye, ShieldCheck, Clock, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { mySearches, type StartSearchResult } from '@/lib/jobSearch';
import { FIT_LABEL, byFit, isFitting } from '@/lib/matchFit';
import { usePoolFit } from '@/hooks/usePoolFit';
import { Badge } from '@/components/ui/badge';
import { ClientQuestionFlow } from './search/ClientQuestionFlow';
import { Honorar } from './Honorar';

interface MiniCandidate {
  id: string;
  full_name: string;
  job_title: string | null;
}

export type ConfirmResult = { ok: true; result: StartSearchResult } | { ok: false; error: string };

interface ActivationConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  anonymousLabel: string;
  earning: number | null;
  /** Contracting: Verdienst je Einsatztag, z. B. "44–110 €" -- ersetzt den Verdienst. */
  earningPerDay?: string | null;
  hiringUrgency: string | null;
  /** Offene Suchen ohne Einreichung / Plätze */
  activeCount: number;
  maxSlots: number;
  /** Aus der Kandidatenakte: Suche startet zum Einreichen (eine Suche über die Grenze erlaubt). */
  forSubmission?: boolean;
  onConfirm: () => Promise<ConfirmResult>;
  onSubmitCandidate: (candidateId?: string) => void;
  onGoToJob: () => void;
}

/**
 * „Ich suche“: Hinweise zuerst (der Kunde sieht dich, Kontakt nur über Matchunt,
 * 30 Tage für die erste Einreichung), dann Firmenname und Kundenfrage, dann
 * direkt einreichen. Keine Zahl anderer Headhunter.
 */
export function ActivationConfirmDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  anonymousLabel,
  earning,
  earningPerDay,
  hiringUrgency,
  activeCount,
  maxSlots,
  forSubmission = false,
  onConfirm,
  onSubmitCandidate,
  onGoToJob,
}: ActivationConfirmDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'confirm' | 'question' | 'success'>('confirm');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StartSearchResult | null>(null);
  const [candidates, setCandidates] = useState<MiniCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [clientInfo, setClientInfo] = useState<string | null>(null);

  const isUrgent = hiringUrgency === 'urgent';

  // Nur Kandidaten, die laut Matching passen (14.10.2026) – nicht einfach die neuesten.
  useEffect(() => {
    if (step !== 'success' || !user || forSubmission) return;
    setCandidatesLoading(true);
    supabase
      .from('candidates')
      .select('id, full_name, job_title')
      .eq('recruiter_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setCandidates((data as MiniCandidate[]) || []);
        setCandidatesLoading(false);
      });
  }, [step, user, forSubmission]);
  const pool = usePoolFit(step === 'success' && !forSubmission ? jobId : null, candidates.map((c) => c.id));
  const fitting = candidates
    .filter((c) => isFitting(pool.fit.get(c.id)))
    .sort((a, b) => byFit(pool.fit.get(a.id)!, pool.fit.get(b.id)!))
    .slice(0, 3);

  // Kundenangabe: einmal je Kunde beantwortet, danach nur noch als Hinweis.
  useEffect(() => {
    if (step !== 'success') return;
    mySearches()
      .then(async (rows) => {
        const s = (rows ?? []).find((r) => r.job_id === jobId);
        if (!s?.client_declaration) return setClientInfo(null);
        const label = s.client_declaration.startsWith('no') ? 'kein Bestandskunde'
          : s.client_declaration === 'client:confirmed' ? 'Bestandskunde (bestätigt)'
          : s.client_declaration === 'client:rejected' ? 'kein Bestandskunde (nicht bestätigt)'
          : 'Bestandskunde (wird geprüft)';
        let since = '';
        if (s.client_declaration_id) {
          const { data } = await supabase.from('recruiter_client_declarations' as never).select('created_at').eq('id', s.client_declaration_id).maybeSingle();
          const at = (data as { created_at?: string } | null)?.created_at;
          if (at) since = ` (deine Angabe vom ${new Date(at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })})`;
        }
        setClientInfo(`Kunde: ${label}${since}`);
      })
      .catch(() => setClientInfo(null));
  }, [step, jobId]);

  const afterQuestion = () => {
    if (forSubmission) {
      onSubmitCandidate();
      return;
    }
    setStep('success');
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await onConfirm();
      if ('error' in res) {
        setError(res.error);
        return;
      }
      setResult(res.result);
      if (res.result.needs_client_answer) setStep('question');
      else afterQuestion();
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
      setResult(null);
    }
  };

  const company = result?.company_name || null;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      {/* Die Kundenfrage kommt direkt nach „Ich suche“ und wird beantwortet, nicht weggedrückt. */}
      <AlertDialogContent className="max-w-md" onEscapeKeyDown={(e) => { if (step === 'question') e.preventDefault(); }}>
        {step === 'confirm' && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                {forSubmission ? 'Suche starten und einreichen' : 'Aktiv suchen'}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  {/* Stelle mit Verdienst rechts, wie auf der Stellenkarte */}
                  <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium text-foreground text-sm">
                        {isUrgent && <Flame className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Dringend" />}
                        {jobTitle}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{anonymousLabel}</p>
                    </div>
                    {(earningPerDay || earning !== null) && (
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold tabular-nums text-emerald-500">
                          <Honorar>{earningPerDay ?? `≈ €${earning!.toLocaleString('de-DE')}`}</Honorar>
                        </p>
                        <p className="text-[10px] text-muted-foreground">{earningPerDay ? 'je Einsatztag' : 'dein Verdienst'}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-foreground">
                    <p className="flex items-start gap-2">
                      <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span><b className="font-medium">Der Kunde sieht, dass du für ihn suchst:</b> Foto, Name, Unternehmen und Partnerstufe.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>Kontakt zum Kunden nur über Matchunt. Der Kunde meldet uns Direktkontakte.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>Du hast 30 Tage für deine erste Einreichung, danach belegst du keinen Platz mehr. Beenden geht jederzeit.</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>Danach siehst du den Firmennamen.</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Offene Suchen ohne Einreichung</span>
                    <span className="font-medium tabular-nums">
                      {activeCount} von {maxSlots}
                    </span>
                  </div>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      Ich suche aktiv passende Kandidaten für diese Stelle.
                    </span>
                  </label>

                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Abbrechen</AlertDialogCancel>
              <Button onClick={handleConfirm} disabled={!confirmed || loading} className="gap-1.5">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Ich suche aktiv</>}
              </Button>
            </AlertDialogFooter>
          </>
        )}

        {step === 'question' && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Du suchst jetzt für {company || 'diesen Kunden'}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="pt-1 text-foreground">
                  <ClientQuestionFlow
                    jobId={jobId}
                    jobTitle={jobTitle}
                    companyName={company}
                    onDone={(answer) => (answer === 'direct_position' ? handleOpenChange(false) : afterQuestion())}
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
          </>
        )}

        {step === 'success' && (
          <>
            <AlertDialogHeader className="min-w-0">
              <AlertDialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-500">
                <Search className="h-5 w-5" />
                Du suchst jetzt
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{company || jobTitle}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 break-words">
                        {[jobTitle, result?.location].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  {clientInfo && <p className="-mt-2 text-xs text-muted-foreground">{clientInfo}</p>}

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Passend aus deinem Pool:</p>
                    {fitting.length > 0 ? (
                      <div className="space-y-1.5">
                        {fitting.map((c) => {
                          const f = pool.fit.get(c.id);
                          return (
                            <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/30">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-foreground truncate">{c.full_name}</p>
                                {c.job_title && <p className="text-[11px] text-muted-foreground truncate">{c.job_title}</p>}
                              </div>
                              {isFitting(f) && <Badge variant="outline" className="shrink-0 text-[10px]">{FIT_LABEL[f]}</Badge>}
                              <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => onSubmitCandidate(c.id)}>
                                Einreichen
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    ) : candidatesLoading || pool.checking ? (
                      <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Passende Kandidaten werden gesucht …
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border border-dashed border-border/50 text-center">
                        <p className="text-xs text-muted-foreground">{candidates.length ? 'Noch kein passender Kandidat in deinem Pool.' : 'Noch keine Kandidaten angelegt.'}</p>
                        <Button size="sm" variant="outline" className="mt-2 h-7 text-xs gap-1" onClick={() => onSubmitCandidate()}>
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
  onShowMine?: () => void;
}

/** Alle Plätze belegt: was hilft, ohne Stufen-Tabelle. */
export function SlotLimitDialog({ open, onOpenChange, activeCount, maxSlots, onShowMine }: SlotLimitDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Alle {maxSlots} Plätze belegt
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Du hast {activeCount} offene Suchen ohne Einreichung. Reiche bei einer davon ein, dann ist der Platz sofort wieder frei.
              </p>
              <p className="text-xs text-muted-foreground">
                Ohne Einreichung wird ein Platz 30 Tage nach „Ich suche“ frei. Einen passenden Kandidaten aus der Akte kannst du trotzdem einreichen.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Schließen</AlertDialogCancel>
          {onShowMine && (
            <Button
              onClick={() => {
                onOpenChange(false);
                onShowMine();
              }}
            >
              Meine Suchen
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
