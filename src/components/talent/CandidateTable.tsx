import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Search, 
  ChevronRight, 
  X, 
  Calendar,
  Clock,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PIPELINE_STAGES } from '@/hooks/useHiringPipeline';

export interface TableCandidate {
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

interface CandidateTableProps {
  candidates: TableCandidate[];
  jobs: { id: string; title: string }[];
  stageFilter: string;
  selectedIds: string[];
  onSelect: (candidate: TableCandidate) => void;
  onToggleSelect: (submissionId: string) => void;
  onSelectAll: () => void;
  onMove: (submissionId: string, newStage: string) => void;
  onReject: (submissionId: string) => void;
  isProcessing?: boolean;
}

export function CandidateTable({
  candidates,
  jobs,
  stageFilter,
  selectedIds,
  onSelect,
  onToggleSelect,
  onSelectAll,
  onMove,
  onReject,
  isProcessing
}: CandidateTableProps) {
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'match' | 'waiting'>('newest');

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

  const filteredCandidates = candidates
    .filter(c => {
      if (c.status === 'rejected') return false;
      if (stageFilter !== 'all' && c.stage !== stageFilter) return false;
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
    .filter(c => jobFilter === 'all' || c.jobId === jobFilter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
        case 'match':
          return (b.matchScore || 0) - (a.matchScore || 0);
        case 'waiting':
          return b.hoursInStage - a.hoursInStage;
        case 'newest':
        default:
          return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      }
    });

  const allSelected = filteredCandidates.length > 0 && 
    filteredCandidates.every(c => selectedIds.includes(c.submissionId));

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col">
        {/* Filters */}
        <div className="p-3 border-b flex items-center gap-3 bg-background">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, Rolle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          
          <Select value={jobFilter} onValueChange={setJobFilter}>
            <SelectTrigger className="h-9 w-48">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
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
            <SelectTrigger className="h-9 w-40">
              <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Neueste</SelectItem>
              <SelectItem value="oldest">Älteste</SelectItem>
              <SelectItem value="match">Match Score</SelectItem>
              <SelectItem value="waiting">Längste Wartezeit</SelectItem>
            </SelectContent>
          </Select>

          <div className="text-sm text-muted-foreground ml-auto">
            {filteredCandidates.length} Kandidat{filteredCandidates.length !== 1 ? 'en' : ''}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={onSelectAll}
                    aria-label="Alle auswählen"
                  />
                </TableHead>
                <TableHead className="min-w-[200px]">Kandidat</TableHead>
                <TableHead>Job</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-20 text-center">Match</TableHead>
                <TableHead className="w-28">Wartet</TableHead>
                <TableHead className="w-28 text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCandidates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <p className="text-muted-foreground">
                      {search || stageFilter !== 'all' || jobFilter !== 'all'
                        ? 'Keine Kandidaten gefunden'
                        : 'Noch keine Kandidaten vorhanden'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCandidates.map(candidate => {
                  const nextStage = getNextStage(candidate.stage);
                  const isUrgent = candidate.hoursInStage >= 48;
                  const isWarning = candidate.hoursInStage >= 24 && candidate.hoursInStage < 48;
                  const isSelected = selectedIds.includes(candidate.submissionId);

                  return (
                    <TableRow 
                      key={candidate.submissionId}
                      className={cn(
                        "cursor-pointer group",
                        isSelected && "bg-primary/5",
                        isUrgent && "bg-destructive/5 border-l-2 border-l-destructive",
                        isWarning && !isUrgent && "bg-amber-500/5 border-l-2 border-l-amber-500"
                      )}
                      onClick={() => onSelect(candidate)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleSelect(candidate.submissionId)}
                          aria-label={`${candidate.name} auswählen`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(candidate.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{candidate.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {candidate.currentRole}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm truncate max-w-[180px]">{candidate.jobTitle}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {getStageLabel(candidate.stage)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {candidate.matchScore ? (
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              candidate.matchScore >= 80 && "border-green-500 text-green-600",
                              candidate.matchScore >= 60 && candidate.matchScore < 80 && "border-amber-500 text-amber-600"
                            )}
                          >
                            {candidate.matchScore}%
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "text-xs flex items-center gap-1",
                          isUrgent && "text-destructive font-medium",
                          isWarning && "text-amber-600"
                        )}>
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(candidate.submittedAt), { locale: de })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {nextStage && candidate.stage !== 'hired' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-primary hover:bg-primary/10"
                                  onClick={() => onMove(candidate.submissionId, nextStage)}
                                  disabled={isProcessing}
                                >
                                  <ChevronRight className="h-4 w-4 mr-1" />
                                  Weiter
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{getStageLabel(nextStage)}</TooltipContent>
                            </Tooltip>
                          )}
                          {candidate.stage !== 'hired' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => onReject(candidate.submissionId)}
                                  disabled={isProcessing}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ablehnen</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
