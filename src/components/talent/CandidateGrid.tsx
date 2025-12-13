import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  Filter,
  ArrowUpDown
} from 'lucide-react';
import { CandidatePreviewCard, CandidatePreviewCardProps } from './CandidatePreviewCard';

interface CandidateGridProps {
  candidates: CandidatePreviewCardProps[];
  jobs: { id: string; title: string }[];
  stageFilter: string;
  onSelect: (candidate: CandidatePreviewCardProps) => void;
  onMove: (submissionId: string, newStage: string) => void;
  onReject: (submissionId: string) => void;
  isProcessing?: boolean;
}

export function CandidateGrid({
  candidates,
  jobs,
  stageFilter,
  onSelect,
  onMove,
  onReject,
  isProcessing
}: CandidateGridProps) {
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'match' | 'waiting'>('newest');

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

        {/* Cards Grid */}
        <div className="flex-1 overflow-auto p-4">
          {filteredCandidates.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">
                {search || stageFilter !== 'all' || jobFilter !== 'all'
                  ? 'Keine Kandidaten gefunden'
                  : 'Noch keine Kandidaten vorhanden'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredCandidates.map(candidate => (
                <CandidatePreviewCard
                  key={candidate.submissionId}
                  candidate={candidate}
                  onSelect={() => onSelect(candidate)}
                  onMove={onMove}
                  onReject={onReject}
                  isProcessing={isProcessing}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}