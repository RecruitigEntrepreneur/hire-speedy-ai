import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { 
  X, 
  ChevronRight, 
  Mail, 
  Phone, 
  ExternalLink,
  Clock,
  Briefcase,
  FileText,
  MessageSquare
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PIPELINE_STAGES } from '@/hooks/useHiringPipeline';

interface CandidateDetailPanelProps {
  candidate: {
    id: string;
    submissionId: string;
    name: string;
    currentRole: string;
    jobId: string;
    jobTitle: string;
    stage: string;
    status: string;
    matchScore: number | null;
    submittedAt: string;
    email?: string;
    phone?: string;
  } | null;
  open: boolean;
  onClose: () => void;
  onMove: (submissionId: string, newStage: string) => void;
  onReject: (submissionId: string) => void;
  isProcessing?: boolean;
}

export function CandidateDetailPanel({
  candidate,
  open,
  onClose,
  onMove,
  onReject,
  isProcessing
}: CandidateDetailPanelProps) {
  if (!candidate) return null;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStageLabel = (stage: string) => {
    return PIPELINE_STAGES.find(s => s.key === stage)?.label || stage;
  };

  const getNextStage = (currentStage: string) => {
    const stages = ['submitted', 'interview_1', 'interview_2', 'offer', 'hired'];
    const currentIndex = stages.indexOf(currentStage);
    return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;
  };

  const getPreviousStage = (currentStage: string) => {
    const stages = ['submitted', 'interview_1', 'interview_2', 'offer', 'hired'];
    const currentIndex = stages.indexOf(currentStage);
    return currentIndex > 0 ? stages[currentIndex - 1] : null;
  };

  const nextStage = getNextStage(candidate.stage);
  const previousStage = getPreviousStage(candidate.stage);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[450px] sm:max-w-[450px] p-0 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {getInitials(candidate.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h2 className="font-semibold truncate">{candidate.name}</h2>
                <p className="text-sm text-muted-foreground truncate">{candidate.currentRole}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Quick info */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <Badge variant="secondary" className="gap-1">
              {getStageLabel(candidate.stage)}
            </Badge>
            {candidate.matchScore && (
              <Badge variant="outline" className="gap-1">
                {candidate.matchScore}% Match
              </Badge>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(candidate.submittedAt), { locale: de, addSuffix: true })}
            </span>
          </div>

          {/* Contact */}
          <div className="flex items-center gap-2 mt-3">
            {candidate.email && (
              <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                <a href={`mailto:${candidate.email}`}>
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  E-Mail
                </a>
              </Button>
            )}
            {candidate.phone && (
              <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                <a href={`tel:${candidate.phone}`}>
                  <Phone className="h-3.5 w-3.5 mr-1.5" />
                  Anrufen
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs ml-auto" asChild>
              <Link to={`/dashboard/candidates/${candidate.submissionId}`}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Vollprofil
              </Link>
            </Button>
          </div>
        </div>

        {/* Actions */}
        {candidate.stage !== 'hired' && (
          <div className="p-4 border-b bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-2">Schnellaktionen</p>
            <div className="flex gap-2">
              {nextStage && (
                <Button
                  className="flex-1"
                  size="sm"
                  onClick={() => onMove(candidate.submissionId, nextStage)}
                  disabled={isProcessing}
                >
                  <ChevronRight className="h-4 w-4 mr-1" />
                  {getStageLabel(nextStage)}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => onReject(candidate.submissionId)}
                disabled={isProcessing}
              >
                <X className="h-4 w-4 mr-1" />
                Ablehnen
              </Button>
            </div>
            {previousStage && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-muted-foreground"
                onClick={() => onMove(candidate.submissionId, previousStage)}
                disabled={isProcessing}
              >
                ← Zurück zu {getStageLabel(previousStage)}
              </Button>
            )}
          </div>
        )}

        {/* Content Tabs */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-2 grid w-auto grid-cols-3">
            <TabsTrigger value="overview" className="text-xs">Übersicht</TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs">Notizen</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="overview" className="p-4 mt-0 space-y-4">
              {/* Job Info */}
              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" />
                  Bewirbt sich für
                </p>
                <p className="font-medium text-sm">{candidate.jobTitle}</p>
              </div>

              {/* Stage Progress */}
              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground mb-3">Pipeline-Status</p>
                <div className="flex items-center gap-1">
                  {PIPELINE_STAGES.map((stage, index) => {
                    const isActive = candidate.stage === stage.key;
                    const isPast = PIPELINE_STAGES.findIndex(s => s.key === candidate.stage) > index;
                    return (
                      <div key={stage.key} className="flex-1">
                        <div 
                          className={cn(
                            "h-1.5 rounded-full transition-colors",
                            isActive && "bg-primary",
                            isPast && "bg-primary/40",
                            !isActive && !isPast && "bg-muted"
                          )}
                        />
                        <p className={cn(
                          "text-[10px] mt-1 text-center",
                          isActive ? "text-primary font-medium" : "text-muted-foreground"
                        )}>
                          {stage.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Details */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Details</p>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Eingereicht</span>
                    <span>{format(new Date(candidate.submittedAt), 'dd. MMM yyyy', { locale: de })}</span>
                  </div>
                  {candidate.email && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">E-Mail</span>
                      <span className="truncate ml-4">{candidate.email}</span>
                    </div>
                  )}
                  {candidate.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Telefon</span>
                      <span>{candidate.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="p-4 mt-0">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div className="w-0.5 h-full bg-border" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium">Kandidat eingereicht</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(candidate.submittedAt), 'dd. MMM yyyy, HH:mm', { locale: de })}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center py-4">
                  Weitere Aktivitäten laden...
                </p>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="p-4 mt-0">
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Keine Notizen vorhanden</p>
                <Button variant="outline" size="sm" className="mt-3">
                  Notiz hinzufügen
                </Button>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
