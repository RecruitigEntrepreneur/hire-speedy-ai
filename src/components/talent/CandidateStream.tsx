import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  ChevronRight, 
  X, 
  Calendar,
  Clock,
  Filter,
  SortAsc
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PIPELINE_STAGES } from '@/hooks/useHiringPipeline';

export interface StreamCandidate {
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
  hoursInStage: number;
}

interface CandidateStreamProps {
  candidates: StreamCandidate[];
  jobs: { id: string; title: string }[];
  selectedId?: string;
  onSelect: (candidate: StreamCandidate) => void;
  onMove: (submissionId: string, newStage: string) => void;
  onReject: (submissionId: string) => void;
  isProcessing?: boolean;
}

export function CandidateStream({
  candidates,
  jobs,
  selectedId,
  onSelect,
  onMove,
  onReject,
  isProcessing
}: CandidateStreamProps) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'match'>('newest');

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStageBadgeVariant = (stage: string) => {
    switch (stage) {
      case 'submitted': return 'secondary';
      case 'interview_1': 
      case 'interview_2': return 'default';
      case 'offer': return 'outline';
      case 'hired': return 'default';
      default: return 'secondary';
    }
  };

  const getStageLabel = (stage: string) => {
    return PIPELINE_STAGES.find(s => s.key === stage)?.label || stage;
  };

  const getNextStage = (currentStage: string) => {
    const stages = ['submitted', 'interview_1', 'interview_2', 'offer', 'hired'];
    const currentIndex = stages.indexOf(currentStage);
    return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;
  };

  const filteredCandidates = candidates
    .filter(c => {
      if (c.status === 'rejected') return false;
      if (search) {
        const searchLower = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(searchLower) ||
          c.currentRole.toLowerCase().includes(searchLower) ||
          c.jobTitle.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .filter(c => stageFilter === 'all' || c.stage === stageFilter)
    .filter(c => jobFilter === 'all' || c.jobId === jobFilter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
        case 'match':
          return (b.matchScore || 0) - (a.matchScore || 0);
        case 'newest':
        default:
          return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      }
    });

  const stageCounts = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.key] = candidates.filter(c => c.stage === stage.key && c.status !== 'rejected').length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col">
        {/* Header with filters */}
        <div className="p-3 border-b space-y-3 bg-background">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Name, Rolle, Job..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          
          {/* Quick stage filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <Button
              variant={stageFilter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={() => setStageFilter('all')}
            >
              Alle
              <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[10px]">
                {candidates.filter(c => c.status !== 'rejected').length}
              </Badge>
            </Button>
            {PIPELINE_STAGES.map(stage => (
              <Button
                key={stage.key}
                variant={stageFilter === stage.key ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() => setStageFilter(stage.key)}
              >
                {stage.label}
                {stageCounts[stage.key] > 0 && (
                  <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[10px]">
                    {stageCounts[stage.key]}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          {/* Job filter + Sort */}
          <div className="flex items-center gap-2">
            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <Filter className="h-3 w-3 mr-1.5" />
                <SelectValue placeholder="Alle Jobs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Jobs</SelectItem>
                {jobs.map(job => (
                  <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="h-8 text-xs w-32">
                <SortAsc className="h-3 w-3 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Neueste</SelectItem>
                <SelectItem value="oldest">Älteste</SelectItem>
                <SelectItem value="match">Match Score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Candidate List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1.5">
            {filteredCandidates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">
                  {search || stageFilter !== 'all' || jobFilter !== 'all'
                    ? 'Keine Kandidaten gefunden'
                    : 'Noch keine Kandidaten vorhanden'}
                </p>
              </div>
            ) : (
              filteredCandidates.map(candidate => {
                const nextStage = getNextStage(candidate.stage);
                const isUrgent = candidate.hoursInStage >= 24;
                const isWarning = candidate.hoursInStage >= 12 && candidate.hoursInStage < 24;

                return (
                  <div
                    key={candidate.submissionId}
                    onClick={() => onSelect(candidate)}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all group",
                      "hover:shadow-sm hover:border-primary/30",
                      selectedId === candidate.submissionId && "ring-2 ring-primary border-primary",
                      isUrgent && "border-l-4 border-l-destructive",
                      isWarning && !isUrgent && "border-l-4 border-l-amber-500"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(candidate.name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {candidate.name}
                          </span>
                          {candidate.matchScore && (
                            <Badge variant="secondary" className="shrink-0 text-[10px] h-5">
                              {candidate.matchScore}%
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {candidate.currentRole}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant={getStageBadgeVariant(candidate.stage)} className="text-[10px] h-5">
                            {getStageLabel(candidate.stage)}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(candidate.submittedAt), { locale: de })}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 truncate">
                          {candidate.jobTitle}
                        </p>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {nextStage && candidate.stage !== 'hired' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-primary hover:bg-primary/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMove(candidate.submissionId, nextStage);
                                }}
                                disabled={isProcessing}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Weiter zu {getStageLabel(nextStage)}</TooltipContent>
                          </Tooltip>
                        )}
                        {candidate.stage !== 'hired' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onReject(candidate.submissionId);
                                }}
                                disabled={isProcessing}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ablehnen</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}