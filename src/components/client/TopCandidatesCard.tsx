import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowRight, Star, Briefcase, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Candidate {
  id: string;
  full_name: string;
  seniority: string | null;
  experience_years: number | null;
  skills: string[] | null;
}

interface Submission {
  id: string;
  match_score: number | null;
  stage: string;
  candidate: Candidate;
}

interface TopCandidatesCardProps {
  submissions: Submission[];
  jobTitle?: string;
  onCandidateClick: (submission: Submission) => void;
  onViewAll: () => void;
  className?: string;
}

export function TopCandidatesCard({ 
  submissions, 
  jobTitle,
  onCandidateClick, 
  onViewAll,
  className 
}: TopCandidatesCardProps) {
  // Get top candidates (by match score, excluding rejected/hired, limit 3)
  const topCandidates = submissions
    .filter(s => !['rejected', 'hired'].includes(s.stage || ''))
    .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
    .slice(0, 3);

  // Generate anonymous ID
  const generateAnonymousId = (submissionId: string): string => {
    const prefix = jobTitle?.slice(0, 2).toUpperCase() || 'XX';
    return `${prefix}-${submissionId.slice(0, 4).toUpperCase()}`;
  };

  if (topCandidates.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" />
            Top Kandidaten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Noch keine Kandidaten im Prozess</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("col-span-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            Top Kandidaten
          </span>
          <Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs h-7">
            Alle vergleichen
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topCandidates.map((submission, index) => {
            const anonymousId = generateAnonymousId(submission.id);
            const isTopCandidate = index === 0;
            
            return (
              <div
                key={submission.id}
                onClick={() => onCandidateClick(submission)}
                className={cn(
                  "relative p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md hover:border-primary/30",
                  isTopCandidate && "border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5"
                )}
              >
                {/* Rank Badge */}
                {isTopCandidate && (
                  <Badge className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] px-1.5">
                    #1
                  </Badge>
                )}

                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className={cn(
                      "font-mono text-xs",
                      isTopCandidate ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"
                    )}>
                      {anonymousId.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-semibold text-sm">{anonymousId}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {submission.candidate.seniority || 'Kandidat'}
                    </p>
                  </div>
                </div>

                {/* Match Score */}
                {submission.match_score && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all",
                          submission.match_score >= 80 ? "bg-emerald-500" :
                          submission.match_score >= 60 ? "bg-amber-500" : "bg-muted-foreground"
                        )}
                        style={{ width: `${submission.match_score}%` }}
                      />
                    </div>
                    <span className={cn(
                      "text-sm font-bold",
                      submission.match_score >= 80 ? "text-emerald-600" :
                      submission.match_score >= 60 ? "text-amber-600" : "text-muted-foreground"
                    )}>
                      {submission.match_score}%
                    </span>
                  </div>
                )}

                {/* Experience */}
                {submission.candidate.experience_years && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {submission.candidate.experience_years} Jahre Erfahrung
                  </div>
                )}

                {/* Skills Preview */}
                {submission.candidate.skills && submission.candidate.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {submission.candidate.skills.slice(0, 3).map((skill, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                        {skill}
                      </Badge>
                    ))}
                    {submission.candidate.skills.length > 3 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        +{submission.candidate.skills.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
