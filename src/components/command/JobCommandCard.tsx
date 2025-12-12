import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronUp, 
  MapPin, 
  Building2, 
  Users, 
  AlertTriangle,
  Briefcase,
  Clock
} from 'lucide-react';
import { InterviewTimeline } from './InterviewTimeline';
import { CompactExposeList } from './CompactExposeList';
import type { JobCommandData } from '@/hooks/useJobCommandData';

interface JobCommandCardProps {
  data: JobCommandData;
  onRequestInterview: (submissionId: string) => void;
  onReject: (submissionId: string) => void;
  onAskQuestion: (submissionId: string) => void;
  onViewDetails: (submissionId: string) => void;
}

export function JobCommandCard({
  data,
  onRequestInterview,
  onReject,
  onAskQuestion,
  onViewDetails,
}: JobCommandCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { job, stats, upcomingInterviews, pendingActions, submissions } = data;

  const hasNewCandidates = stats.new > 0;
  const hasWarnings = pendingActions > 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={`transition-all ${isExpanded ? 'ring-2 ring-primary/20' : ''}`}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              {/* Job Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-lg truncate">{job.title}</h3>
                  {hasNewCandidates && (
                    <Badge className="bg-primary text-primary-foreground">
                      {stats.new} Neu
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {job.company_name}
                  </span>
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {job.location}
                    </span>
                  )}
                  {job.remote_type && (
                    <Badge variant="outline" className="text-xs">
                      {job.remote_type}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6">
                <div className="hidden md:flex items-center gap-4">
                  <StatPill label="Neu" count={stats.new} color="bg-primary" />
                  <StatPill label="Screening" count={stats.screening} color="bg-secondary" />
                  <StatPill label="Interview" count={stats.interview} color="bg-warning" />
                  <StatPill label="Angebot" count={stats.offer} color="bg-success" />
                </div>

                <Button variant="ghost" size="icon">
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Bottom Row: Interviews & Warnings */}
            <div className="flex items-center justify-between gap-4 mt-3 pt-3 border-t">
              <div className="flex-1">
                {upcomingInterviews.length > 0 ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Nächstes Interview:</span>
                    <span className="font-medium">
                      {new Date(upcomingInterviews[0].scheduled_at).toLocaleDateString('de-DE', { 
                        weekday: 'short', 
                        day: 'numeric', 
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span className="text-muted-foreground">mit "{upcomingInterviews[0].anonymous_id}"</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Keine Interviews geplant</span>
                  </div>
                )}
              </div>

              {hasWarnings && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {pendingActions} warten {'>'}48h
                </Badge>
              )}

              {/* Mobile Stats */}
              <div className="flex md:hidden items-center gap-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{stats.total}</span>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="border-t pt-4">
              {/* Interview Timeline */}
              {upcomingInterviews.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Anstehende Interviews
                  </h4>
                  <InterviewTimeline interviews={upcomingInterviews} />
                </div>
              )}

              {/* Expose List */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Kandidaten-Exposés ({submissions.length})
                </h4>
                <CompactExposeList
                  submissions={submissions}
                  onRequestInterview={onRequestInterview}
                  onReject={onReject}
                  onAskQuestion={onAskQuestion}
                  onViewDetails={onViewDetails}
                />
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function StatPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{count}</span>
    </div>
  );
}
