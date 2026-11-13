import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, FileUp, Loader2, MoreHorizontal, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import {
  daysUntil,
  endJobSearch,
  errorText,
  fmtDayShort,
  myPartnerProgress,
  mySearchCapacity,
  mySearches,
  nextTierHint,
  TIER_COLOR,
  TIER_LABEL,
  uploadDeclarationProof,
  type MySearch,
  type PartnerProgress,
} from '@/lib/jobSearch';
import { cn } from '@/lib/utils';
import { ClientQuestionFlow } from './ClientQuestionFlow';
import { useTranslation } from 'react-i18next';

type T = (key: string, options?: Record<string, unknown>) => string;

function standOf(s: MySearch, t: T): { text: string; tone: 'ok' | 'warn' | 'muted' } {
  if (s.status === 'active') {
    if (s.submissions > 0) return { text: t('mine.stand.runningNoSlot'), tone: 'ok' };
    const d = daysUntil(s.ends_at);
    return d === null
      ? { text: t('mine.stand.running'), tone: 'ok' }
      : { text: t('mine.stand.daysLeft', { count: d }), tone: d <= 5 ? 'warn' : 'ok' };
  }
  if (s.status === 'paused') {
    if (s.review_hold) return { text: t('mine.stand.review'), tone: 'muted' };
    return {
      text: s.job_paused_until ? t('mine.stand.clientPausedUntil', { date: fmtDayShort(s.job_paused_until) }) : t('mine.stand.clientPaused'),
      tone: 'muted',
    };
  }
  switch (s.end_reason) {
    case 'expired':
      return { text: t('mine.stand.expired'), tone: 'muted' };
    case 'job_closed':
      return { text: s.job_status === 'filled' ? t('mine.stand.filled') : t('mine.stand.closed'), tone: 'muted' };
    case 'direct_position':
      return { text: t('mine.stand.direct'), tone: 'muted' };
    default:
      return {
        text: s.slot_until && new Date(s.slot_until) > new Date() ? t('mine.stand.endedSlotFree', { date: fmtDayShort(s.slot_until) }) : t('mine.stand.ended'),
        tone: 'muted',
      };
  }
}

function clientNote(s: MySearch, t: T): string | null {
  const company = s.company_name || t('mine.note.theClient');
  if (s.direct_declaration === 'confirmed') return null;
  switch (s.client_declaration) {
    case 'client:confirmed':
      return t('mine.note.confirmed');
    case 'client:pending':
      return t('mine.note.pending');
    case 'client:rejected':
      return t('mine.note.rejected', { company });
    default:
      return s.status === 'ended' && s.company_name ? t('mine.note.protected', { company }) : null;
  }
}

export function MySearchesList({ onSubmit }: { onSubmit: (jobId: string, title: string) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation('recruiterSearch');
  const [rows, setRows] = useState<MySearch[] | null>(null);
  const [capacity, setCapacity] = useState<{ used: number; limit: number } | null>(null);
  const [progress, setProgress] = useState<PartnerProgress | null>(null);
  const [question, setQuestion] = useState<MySearch | null>(null);
  const [proofFor, setProofFor] = useState<MySearch | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [endFor, setEndFor] = useState<MySearch | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, c, p] = await Promise.all([mySearches(), mySearchCapacity(), myPartnerProgress().catch(() => null)]);
      setRows(r ?? []);
      setCapacity(c);
      setProgress(p);
    } catch (err) {
      setRows([]);
      toast({ title: t('mine.loadFailed'), description: errorText(err), variant: 'destructive' });
    }
  }, [toast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmEnd = async () => {
    if (!endFor) return;
    setBusy(true);
    try {
      await endJobSearch(endFor.job_id);
      toast({ title: t('mine.ended') });
      setEndFor(null);
      await load();
    } catch (err) {
      toast({ title: t('mine.endFailed'), description: errorText(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const uploadProof = async () => {
    if (!proofFor || !proofFile || !user || !proofFor.client_declaration_id) return;
    setBusy(true);
    try {
      await uploadDeclarationProof(user.id, proofFor.client_declaration_id, 'contract', proofFile);
      toast({ title: t('mine.proofUploaded'), description: t('mine.proofUploadedText') });
      setProofFor(null);
      setProofFile(null);
      await load();
    } catch (err) {
      toast({ title: t('mine.uploadFailed'), description: errorText(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (rows === null) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hint = progress ? nextTierHint(progress) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs">
        {progress && (
          <span className="inline-flex items-center gap-1.5">
            <Award className={cn('h-3.5 w-3.5', TIER_COLOR[progress.tier])} aria-hidden="true" />
            <span className="font-medium">Matchunt {TIER_LABEL[progress.tier]}</span>
            {hint && <span className="text-muted-foreground">· {hint}</span>}
          </span>
        )}
        {capacity && (
          <span className="text-muted-foreground">
            {t('mine.slotsUsed', { used: capacity.used, limit: capacity.limit })}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <Card className="border-border/30">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('mine.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/40">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_auto] gap-3 border-b border-border/40 bg-muted/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <span>{t('mine.col.job')}</span>
            <span>{t('mine.col.candidates')}</span>
            <span>{t('mine.col.stand')}</span>
            <span className="w-24" />
          </div>
          {rows.map((s) => {
            const stand = standOf(s, t);
            const note = clientNote(s, t);
            const openQuestion = (s.status === 'active' || s.status === 'paused') && !s.client_declaration && !s.review_hold;
            const needsProof = s.client_declaration === 'client:pending' || s.client_declaration === 'client:rejected';
            const canSubmit = s.status === 'active' && !openQuestion;
            return (
              <div
                key={s.job_id}
                className="grid grid-cols-1 gap-1.5 border-b border-border/30 px-3 py-2.5 text-sm last:border-b-0 md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_auto] md:items-center md:gap-3"
              >
                <button
                  type="button"
                  className={cn('min-w-0 text-left', s.status === 'ended' && 'text-muted-foreground')}
                  onClick={() => navigate(`/recruiter/jobs/${s.job_id}`)}
                >
                  <span className="block truncate font-medium">{s.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[s.company_name, s.location].filter(Boolean).join(' · ')}
                  </span>
                </button>
                <span className="text-xs text-muted-foreground">
                  {s.submissions === 0 ? '–' : s.in_process ? t('mine.inProcess', { submissions: s.submissions, inProcess: s.in_process }) : s.submissions}
                </span>
                <div className="min-w-0 text-xs">
                  <span
                    className={cn(
                      stand.tone === 'ok' && 'text-emerald-600',
                      stand.tone === 'warn' && 'text-amber-600',
                      stand.tone === 'muted' && 'text-muted-foreground',
                    )}
                  >
                    {stand.text}
                  </span>
                  {note && <span className="block text-muted-foreground">{note}</span>}
                  {openQuestion && (
                    <button type="button" className="block text-left text-primary underline-offset-2 hover:underline" onClick={() => setQuestion(s)}>
                      {t('mine.openQuestion', { company: s.company_name || t('q.theCompany') })}
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-end gap-1">
                  {canSubmit && (
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onSubmit(s.job_id, s.title)}>
                      <Send className="h-3 w-3" />
                      {t('q.submit')}
                    </Button>
                  )}
                  {(s.status !== 'ended' || needsProof) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t('mine.moreActions')}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {needsProof && (
                          <DropdownMenuItem onClick={() => setProofFor(s)}>
                            <FileUp className="mr-2 h-4 w-4" />
                            {t('mine.uploadContract')}
                          </DropdownMenuItem>
                        )}
                        {s.status !== 'ended' && (
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setEndFor(s)}>
                            {t('end.confirm')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!question} onOpenChange={(o) => !o && setQuestion(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{question?.title}</DialogTitle>
            <DialogDescription>{t('q.beforeFirst')}</DialogDescription>
          </DialogHeader>
          {question && (
            <ClientQuestionFlow
              jobId={question.job_id}
              jobTitle={question.title}
              companyName={question.company_name}
              onDone={() => {
                setQuestion(null);
                void load();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!proofFor} onOpenChange={(o) => { if (!o) { setProofFor(null); setProofFile(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{proofFor?.company_name ? t('mine.proofFor', { company: proofFor.company_name }) : t('mine.proofForClient')}</DialogTitle>
            <DialogDescription>
              {t('mine.proofText')}
            </DialogDescription>
          </DialogHeader>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm hover:bg-muted/40">
            <FileUp className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{proofFile ? proofFile.name : t('mine.chooseFile')}</span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="sr-only" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="flex justify-end">
            <Button disabled={!proofFile || busy} onClick={uploadProof}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('mine.upload')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!endFor} onOpenChange={(o) => !o && setEndFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('end.titleNamed', { title: endFor?.title })}</AlertDialogTitle>
            <AlertDialogDescription>
              {endFor && endFor.submissions > 0
                ? t('end.withSubmissions')
                : t('end.withoutSubmissions')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('end.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void confirmEnd();
              }}
            >
              {t('end.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
