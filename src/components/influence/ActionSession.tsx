import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Phone,
  Mail,
  MessageSquare,
  Check,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  X,
  StickyNote,
  BookOpen,
  Lightbulb,
  User,
  Briefcase,
  Timer,
  ChevronDown,
  ExternalLink,
  Keyboard,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { SnoozeDropdown } from './SnoozeDropdown';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ActionSessionProps {
  session: {
    currentItem: UnifiedTaskItem | null;
    isActive: boolean;
    currentIndex: number;
    queueLength: number;
    completedCount: number;
    skippedCount: number;
    snoozedCount: number;
    totalDuration: number;
    isLastItem: boolean;
    outcomes: { item: UnifiedTaskItem; action: string; duration: number }[];
    completeItem: (note?: string) => Promise<void>;
    skipItem: () => void;
    snoozeItem: (until: Date) => Promise<void>;
    endSession: () => Promise<void>;
    goBack: () => void;
  };
  onOpenPlaybook: (item: UnifiedTaskItem) => void;
  onEnd: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  'opt_in_pending': 'Opt-In steht aus',
  'opt_in_pending_24h': 'Opt-In dringend (24h)',
  'opt_in_pending_48h': 'Opt-In überfällig (48h)',
  'interview_prep_missing': 'Interviewvorbereitung fehlt',
  'interview_reminder': 'Interview-Erinnerung',
  'salary_mismatch': 'Gehaltsabweichung',
  'salary_negotiation': 'Gehaltsverhandlung',
  'ghosting_risk': 'Ghosting-Risiko',
  'engagement_drop': 'Engagement gesunken',
  'closing_opportunity': 'Abschluss-Chance',
  'follow_up_needed': 'Follow-up nötig',
  'no_activity': 'Keine Aktivität',
  'sla_warning': 'SLA-Warnung',
  'culture_concern': 'Kultur-Bedenken',
  'document_missing': 'Dokument fehlt',
  'client_feedback_positive': 'Positives Feedback',
  'client_feedback_negative': 'Negatives Feedback',
  'call': 'Anruf',
  'email': 'E-Mail',
  'follow_up': 'Follow-up',
  'meeting': 'Meeting',
  'other': 'Sonstiges',
};

// ─── Sub-components ─────────────────────────────────────────────────────────────

function SessionProgress({
  currentIndex,
  queueLength,
  completedCount,
  skippedCount,
  snoozedCount,
  elapsed,
}: {
  currentIndex: number;
  queueLength: number;
  completedCount: number;
  skippedCount: number;
  snoozedCount: number;
  elapsed: number;
}) {
  const progressPercent = queueLength > 0 ? Math.round(((currentIndex) / queueLength) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="font-medium">
            {currentIndex + 1} von {queueLength}
          </span>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <Check className="h-3 w-3 text-emerald-500" /> {completedCount}
            </span>
            <span className="flex items-center gap-0.5">
              <SkipForward className="h-3 w-3" /> {skippedCount}
            </span>
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3 text-amber-500" /> {snoozedCount}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Timer className="h-3 w-3" />
          {formatElapsed(elapsed)}
        </div>
      </div>
      <Progress value={progressPercent} className="h-1.5" />

      {/* Dot Indicators */}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: queueLength }).map((_, idx) => {
          let dotColor = 'bg-muted';
          if (idx < currentIndex) {
            // Already processed - check outcome
            const processedCount = completedCount + skippedCount + snoozedCount;
            if (idx < processedCount) {
              // We don't track per-item color here, use generic "done" color
              dotColor = 'bg-emerald-400';
            }
          } else if (idx === currentIndex) {
            dotColor = 'bg-primary animate-pulse';
          }

          return (
            <div
              key={idx}
              className={cn(
                'h-1.5 rounded-full transition-all',
                idx === currentIndex ? 'w-4' : 'w-1.5',
                dotColor
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function SessionContextPanel({ item }: { item: UnifiedTaskItem }) {
  const navigate = useNavigate();
  const typeLabel = ALERT_TYPE_LABELS[item.taskCategory] || item.taskCategory;
  const isManual = item.itemType === 'task';

  return (
    <div className="space-y-3">
      {/* Candidate Info */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base truncate">
              {item.candidateName || 'Kein Kandidat'}
            </h3>
            {item.candidateId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={() => navigate(`/recruiter/candidates/${item.candidateId}`)}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
          {(item.jobTitle || item.companyName) && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
              <Briefcase className="h-3 w-3" />
              <span className="truncate">
                {item.jobTitle}{item.companyName ? ` · ${item.companyName}` : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Task Type Badge */}
      <div className="flex items-center gap-2">
        <Badge variant={isManual ? 'secondary' : 'outline'} className="text-xs">
          {isManual ? '🟣 Manuell' : '⚡ System'}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {typeLabel}
        </Badge>
        {item.priority === 'critical' && (
          <Badge variant="destructive" className="text-xs">Dringend</Badge>
        )}
        {item.impactScore > 0 && (
          <Badge variant="outline" className="text-xs">
            Impact: {item.impactScore}
          </Badge>
        )}
      </div>

      {/* Task Title (different from candidate name) */}
      <Card>
        <CardContent className="p-3">
          <h4 className="font-medium text-sm">{item.title}</h4>
          {item.dueAt && (
            <div className="text-xs text-muted-foreground mt-1">
              Fällig: {formatDistanceToNow(new Date(item.dueAt), { locale: de, addSuffix: true })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Actions */}
      <div className="flex items-center gap-2">
        {item.candidatePhone && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 flex-1"
            onClick={() => window.location.href = `tel:${item.candidatePhone}`}
          >
            <Phone className="h-3.5 w-3.5" />
            Anrufen
          </Button>
        )}
        {item.candidateEmail && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 flex-1"
            onClick={() => window.location.href = `mailto:${item.candidateEmail}`}
          >
            <Mail className="h-3.5 w-3.5" />
            E-Mail
          </Button>
        )}
        {item.candidatePhone && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 flex-1"
            onClick={() => window.open(`https://wa.me/${item.candidatePhone?.replace(/\D/g, '')}`, '_blank')}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            WhatsApp
          </Button>
        )}
      </div>
    </div>
  );
}

function WhyThisTask({ item }: { item: UnifiedTaskItem }) {
  const [open, setOpen] = useState(false);

  if (!item.description && !item.recommendedAction) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between h-8 text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-1.5">
            <Lightbulb className="h-3 w-3 text-amber-500" />
            Warum diese Aufgabe?
          </span>
          <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1">
        <Card className="bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800/30">
          <CardContent className="p-3 space-y-2">
            {item.description && (
              <p className="text-xs">{item.description}</p>
            )}
            {item.recommendedAction && (
              <div className="text-xs">
                <span className="font-medium text-primary">Empfehlung: </span>
                {item.recommendedAction}
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function ActionSession({ session, onOpenPlaybook, onEnd }: ActionSessionProps) {
  const {
    currentItem,
    isActive,
    currentIndex,
    queueLength,
    completedCount,
    skippedCount,
    snoozedCount,
    totalDuration,
    isLastItem,
    completeItem,
    skipItem,
    snoozeItem,
    endSession,
    goBack,
  } = session;

  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const startTimeRef = useRef<Date>(new Date());

  // Reset note when item changes
  useEffect(() => {
    setNote('');
    setNoteOpen(false);
    startTimeRef.current = new Date();
  }, [currentIndex]);

  // Elapsed timer
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setElapsed(Math.round((new Date().getTime() - startTimeRef.current.getTime()) / 1000) + totalDuration);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, totalDuration, currentIndex]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't capture when typing in note
    if (noteRef.current === document.activeElement) return;

    switch (e.key.toLowerCase()) {
      case 'e':
        e.preventDefault();
        handleComplete();
        break;
      case 's':
        e.preventDefault();
        handleSkip();
        break;
      case 'n':
        e.preventDefault();
        setNoteOpen(true);
        setTimeout(() => noteRef.current?.focus(), 100);
        break;
      case 'p':
        if (currentItem?.playbookId) {
          e.preventDefault();
          onOpenPlaybook(currentItem);
        }
        break;
      case 'arrowleft':
        e.preventDefault();
        goBack();
        break;
      case 'arrowright':
        e.preventDefault();
        handleSkip();
        break;
      case '?':
        e.preventDefault();
        setShowShortcuts(prev => !prev);
        break;
      case 'escape':
        e.preventDefault();
        handleEndSession();
        break;
    }
  }, [currentItem, note]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Action handlers
  const handleComplete = async () => {
    await completeItem(note.trim() || undefined);
    if (isLastItem) {
      onEnd();
    }
  };

  const handleSkip = () => {
    skipItem();
    if (isLastItem) {
      onEnd();
    }
  };

  const handleSnooze = async (until: Date) => {
    await snoozeItem(until);
    if (isLastItem) {
      onEnd();
    }
  };

  const handleEndSession = async () => {
    await endSession();
    onEnd();
  };

  if (!currentItem || !isActive) return null;

  return (
    <Dialog open={isActive} onOpenChange={() => handleEndSession()}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
        {/* Header Bar */}
        <div className="border-b px-4 py-3 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              ⚡ Action Session
            </h2>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowShortcuts(prev => !prev)}
                  >
                    <Keyboard className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Tastenkürzel anzeigen (?)</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground"
                onClick={handleEndSession}
              >
                <X className="h-3 w-3" />
                Beenden
              </Button>
            </div>
          </div>
          <SessionProgress
            currentIndex={currentIndex}
            queueLength={queueLength}
            completedCount={completedCount}
            skippedCount={skippedCount}
            snoozedCount={snoozedCount}
            elapsed={elapsed}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid md:grid-cols-2 gap-4 p-4 h-full">
            {/* Left: Context Panel */}
            <div className="space-y-4">
              <SessionContextPanel item={currentItem} />
              <WhyThisTask item={currentItem} />
            </div>

            {/* Right: Action Panel */}
            <div className="space-y-4">
              {/* Playbook Button */}
              {currentItem.playbookId && (
                <Card className="border-primary/20 bg-primary/[0.03]">
                  <CardContent className="p-3">
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-primary/30 hover:bg-primary/10"
                      onClick={() => onOpenPlaybook(currentItem)}
                    >
                      <BookOpen className="h-4 w-4 text-primary" />
                      Coaching-Playbook öffnen
                      <Badge variant="secondary" className="text-[10px] ml-auto">P</Badge>
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Recommended Action */}
              {currentItem.recommendedAction && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
                      Empfohlene Aktion
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm">{currentItem.recommendedAction}</p>
                  </CardContent>
                </Card>
              )}

              {/* Inline Note */}
              <Collapsible open={noteOpen} onOpenChange={setNoteOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 h-8 text-xs"
                  >
                    <StickyNote className="h-3 w-3" />
                    Notiz hinzufügen
                    <Badge variant="secondary" className="text-[10px] ml-auto">N</Badge>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <Textarea
                    ref={noteRef}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Notiz zu dieser Aufgabe..."
                    className="min-h-[80px] text-sm resize-none"
                    onKeyDown={(e) => {
                      // Ctrl+Enter to complete
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleComplete();
                      }
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Strg+Enter = Erledigt mit Notiz
                  </p>
                </CollapsibleContent>
              </Collapsible>

              {/* Keyboard Shortcuts Panel */}
              {showShortcuts && (
                <Card className="bg-muted/30">
                  <CardContent className="p-3">
                    <div className="text-xs font-medium mb-2">Tastenkürzel</div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {[
                        { key: 'E', label: 'Erledigt' },
                        { key: 'S', label: 'Überspringen' },
                        { key: 'N', label: 'Notiz' },
                        { key: 'P', label: 'Playbook' },
                        { key: '←', label: 'Zurück' },
                        { key: '→', label: 'Weiter' },
                        { key: '?', label: 'Shortcuts' },
                        { key: 'Esc', label: 'Beenden' },
                      ].map(s => (
                        <div key={s.key} className="flex items-center gap-2">
                          <kbd className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded border bg-background text-[10px] font-mono">
                            {s.key}
                          </kbd>
                          <span className="text-muted-foreground">{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="border-t px-4 py-3 shrink-0 bg-background">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Navigation */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 h-8"
                    onClick={goBack}
                    disabled={currentIndex === 0}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Zurück
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Vorherige Aufgabe (←)</TooltipContent>
              </Tooltip>
            </div>

            {/* Center: Snooze */}
            <SnoozeDropdown
              onSnooze={handleSnooze}
              triggerClassName="h-8 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground border rounded-md hover:bg-accent"
            />

            {/* Right: Primary Actions */}
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8"
                    onClick={handleSkip}
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    Überspringen
                    <kbd className="hidden sm:inline text-[10px] font-mono opacity-50 ml-1">S</kbd>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Überspringen (S)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className="gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleComplete}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Erledigt
                    <kbd className="hidden sm:inline text-[10px] font-mono opacity-50 ml-1">E</kbd>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Erledigt (E)</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
