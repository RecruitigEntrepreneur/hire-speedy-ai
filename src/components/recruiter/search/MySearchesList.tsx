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

function standOf(s: MySearch): { text: string; tone: 'ok' | 'warn' | 'muted' } {
  if (s.status === 'active') {
    if (s.submissions > 0) return { text: 'läuft · belegt keinen Platz', tone: 'ok' };
    const d = daysUntil(s.ends_at);
    return d === null
      ? { text: 'läuft', tone: 'ok' }
      : { text: `noch ${d} ${d === 1 ? 'Tag' : 'Tage'} für 1. Einreichung`, tone: d <= 5 ? 'warn' : 'ok' };
  }
  if (s.status === 'paused') {
    if (s.review_hold) return { text: 'ruht · Matchunt prüft „Stelle schon direkt“', tone: 'muted' };
    return {
      text: `ruht · Kunde pausiert${s.job_paused_until ? ` bis ${fmtDayShort(s.job_paused_until)}` : ''}`,
      tone: 'muted',
    };
  }
  switch (s.end_reason) {
    case 'expired':
      return { text: 'beendet · 30 Tage ohne Einreichung', tone: 'muted' };
    case 'job_closed':
      return { text: s.job_status === 'filled' ? 'beendet · Stelle besetzt' : 'beendet · Stelle geschlossen', tone: 'muted' };
    case 'direct_position':
      return { text: 'du bearbeitest die Stelle direkt', tone: 'muted' };
    default: {
      const free = s.slot_until && new Date(s.slot_until) > new Date() ? ` · Platz frei am ${fmtDayShort(s.slot_until)}` : '';
      return { text: `beendet${free}`, tone: 'muted' };
    }
  }
}

function clientNote(s: MySearch): string | null {
  const company = s.company_name || 'Der Kunde';
  if (s.direct_declaration === 'confirmed') return null;
  switch (s.client_declaration) {
    case 'client:confirmed':
      return 'Bestandskunde bestätigt';
    case 'client:pending':
      return 'Bestandskunde · in Prüfung';
    case 'client:rejected':
      return `${company}: Beleg reicht nicht · nur über Matchunt`;
    default:
      return s.status === 'ended' && s.company_name ? `${company}: nur über Matchunt (Kundenschutz)` : null;
  }
}

export function MySearchesList({ onSubmit }: { onSubmit: (jobId: string, title: string) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
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
      toast({ title: 'Meine Suchen konnten nicht geladen werden', description: errorText(err), variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmEnd = async () => {
    if (!endFor) return;
    setBusy(true);
    try {
      await endJobSearch(endFor.job_id);
      toast({ title: 'Suche beendet' });
      setEndFor(null);
      await load();
    } catch (err) {
      toast({ title: 'Beenden hat nicht geklappt', description: errorText(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const uploadProof = async () => {
    if (!proofFor || !proofFile || !user || !proofFor.client_declaration_id) return;
    setBusy(true);
    try {
      await uploadDeclarationProof(user.id, proofFor.client_declaration_id, 'contract', proofFile);
      toast({ title: 'Beleg hochgeladen', description: 'Matchunt prüft ihn und meldet sich in der Glocke.' });
      setProofFor(null);
      setProofFile(null);
      await load();
    } catch (err) {
      toast({ title: 'Upload hat nicht geklappt', description: errorText(err), variant: 'destructive' });
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
            {capacity.used} von {capacity.limit} offenen Suchen ohne Einreichung
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <Card className="border-border/30">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Du suchst noch für keine Stelle. Drück bei einer Stelle „Ich suche“, dann erscheint sie hier.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/40">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_auto] gap-3 border-b border-border/40 bg-muted/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <span>Stelle · Kunde</span>
            <span>Meine Kandidaten</span>
            <span>Stand</span>
            <span className="w-24" />
          </div>
          {rows.map((s) => {
            const stand = standOf(s);
            const note = clientNote(s);
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
                  {s.submissions === 0 ? '–' : `${s.submissions}${s.in_process ? ` · ${s.in_process} im Prozess` : ''}`}
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
                      Frage offen: Ist {s.company_name || 'das Unternehmen'} schon dein Kunde?
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-end gap-1">
                  {canSubmit && (
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onSubmit(s.job_id, s.title)}>
                      <Send className="h-3 w-3" />
                      Einreichen
                    </Button>
                  )}
                  {(s.status !== 'ended' || needsProof) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Weitere Aktionen">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {needsProof && (
                          <DropdownMenuItem onClick={() => setProofFor(s)}>
                            <FileUp className="mr-2 h-4 w-4" />
                            Vertrag als Beleg hochladen
                          </DropdownMenuItem>
                        )}
                        {s.status !== 'ended' && (
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setEndFor(s)}>
                            Suche beenden
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
            <DialogDescription>Bitte vor der ersten Einreichung beantworten.</DialogDescription>
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
            <DialogTitle>Beleg für {proofFor?.company_name || 'den Kunden'}</DialogTitle>
            <DialogDescription>
              Unterschriebener Rahmen- oder Einzelvertrag von vor deinem ersten „Ich suche“. Beträge darfst du schwärzen, nur Matchunt sieht ihn.
            </DialogDescription>
          </DialogHeader>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm hover:bg-muted/40">
            <FileUp className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{proofFile ? proofFile.name : 'Datei wählen'}</span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="sr-only" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="flex justify-end">
            <Button disabled={!proofFile || busy} onClick={uploadProof}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Hochladen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!endFor} onOpenChange={(o) => !o && setEndFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suche „{endFor?.title}“ beenden?</AlertDialogTitle>
            <AlertDialogDescription>
              {endFor && endFor.submissions > 0
                ? 'Deine eingereichten Kandidaten laufen weiter. Neue Einreichungen gehen erst nach erneutem „Ich suche“.'
                : 'Ohne Einreichung bleibt der Platz bis 30 Tage nach deinem „Ich suche“ belegt. Der Kunde sieht dich weiter als „hat gesucht“.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void confirmEnd();
              }}
            >
              Suche beenden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
