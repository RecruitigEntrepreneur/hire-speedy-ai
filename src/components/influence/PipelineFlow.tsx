import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowRight,
  User
} from 'lucide-react';
import { CandidateBehavior } from '@/hooks/useCandidateBehavior';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Submission {
  id: string;
  job_id: string;
  candidate_id: string;
  status: string;
  stage?: string;
  jobs: { title: string; company_name: string };
  candidates: { full_name: string; email: string; phone: string | null };
}

interface PipelineFlowProps {
  submissions: Submission[];
  behaviors: Record<string, CandidateBehavior | undefined>;
  loading?: boolean;
  onSelectCandidate?: (submissionId: string) => void;
}

const STAGES = [
  { key: 'contacted', label: 'Kontaktiert', statuses: ['submitted', 'reviewing'] },
  { key: 'interview', label: 'Interview', statuses: ['interview_scheduled', 'interviewed'] },
  { key: 'shortlist', label: 'Shortlist', statuses: ['shortlisted'] },
  { key: 'offer', label: 'Angebot', statuses: ['offer'] },
  { key: 'closed', label: 'Gewonnen', statuses: ['placed'] },
];

export function PipelineFlow({
  submissions,
  behaviors,
  loading = false,
  onSelectCandidate,
}: PipelineFlowProps) {
  
  // Group submissions by stage
  const groupedByStage = STAGES.map(stage => ({
    ...stage,
    submissions: submissions.filter(s => stage.statuses.includes(s.status)),
  }));

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-destructive';
  };

  const getScoreBorderColor = (score: number) => {
    if (score >= 70) return 'border-emerald-500';
    if (score >= 40) return 'border-amber-500';
    return 'border-destructive';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pipeline Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {STAGES.map(stage => (
              <Skeleton key={stage.key} className="h-32 w-40 shrink-0" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Pipeline Flow
          </CardTitle>
          <Badge variant="outline">{submissions.length} Kandidaten</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
          {groupedByStage.map((stage, stageIndex) => (
            <div key={stage.key} className="flex items-center gap-2">
              {/* Stage Column */}
              <div className="min-w-[140px] shrink-0">
                {/* Stage Header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-sm font-medium">{stage.label}</span>
                  <Badge variant="secondary" className="text-xs h-5">
                    {stage.submissions.length}
                  </Badge>
                </div>
                
                {/* Candidates in Stage */}
                <div className="min-h-[100px] bg-muted/30 rounded-lg p-2 space-y-2">
                  {stage.submissions.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground py-8">
                      Leer
                    </div>
                  ) : (
                    <TooltipProvider>
                      <div className="flex flex-wrap gap-1.5">
                        {stage.submissions.map(sub => {
                          const behavior = behaviors[sub.id];
                          const score = behavior?.closing_probability || 50;
                          
                          return (
                            <Tooltip key={sub.id}>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => onSelectCandidate?.(sub.id)}
                                  className={`
                                    w-8 h-8 rounded-full flex items-center justify-center
                                    border-2 ${getScoreBorderColor(score)}
                                    ${getScoreColor(score)} bg-opacity-20
                                    hover:scale-110 transition-transform cursor-pointer
                                  `}
                                >
                                  <User className="h-4 w-4 text-foreground" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[200px]">
                                <div className="space-y-1">
                                  <p className="font-medium text-sm">
                                    {sub.candidates?.full_name || 'Unbekannt'}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {sub.jobs?.title}
                                  </p>
                                  <div className="flex items-center gap-2 pt-1">
                                    <span className={`inline-block w-2 h-2 rounded-full ${getScoreColor(score)}`} />
                                    <span className="text-xs">{score}% Close-Chance</span>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </TooltipProvider>
                  )}
                </div>
              </div>
              
              {/* Arrow between stages */}
              {stageIndex < STAGES.length - 1 && (
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>&gt;70% Close</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <span>40-69%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-destructive" />
            <span>&lt;40%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
