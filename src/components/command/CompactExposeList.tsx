import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  X, 
  MessageSquare, 
  Lock,
  TrendingUp,
  MapPin,
  Briefcase,
  ChevronRight
} from 'lucide-react';
import { generateAnonymousId, anonymizeExperience, anonymizeRegion } from '@/lib/anonymization';
import type { SubmissionExpose } from '@/hooks/useJobCommandData';

interface CompactExposeListProps {
  submissions: SubmissionExpose[];
  onRequestInterview: (submissionId: string) => void;
  onReject: (submissionId: string) => void;
  onAskQuestion: (submissionId: string) => void;
  onViewDetails: (submissionId: string) => void;
}

type FilterTab = 'all' | 'new' | 'interview' | 'offer';

export function CompactExposeList({
  submissions,
  onRequestInterview,
  onReject,
  onAskQuestion,
  onViewDetails,
}: CompactExposeListProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const getFilteredSubmissions = (tab: FilterTab) => {
    switch (tab) {
      case 'new':
        return submissions.filter(s => s.stage === 'new' || s.stage === 'submitted' || s.stage === 'screening');
      case 'interview':
        return submissions.filter(s => s.stage === 'interview');
      case 'offer':
        return submissions.filter(s => s.stage === 'offer');
      default:
        return submissions;
    }
  };

  const counts = {
    all: submissions.length,
    new: submissions.filter(s => s.stage === 'new' || s.stage === 'submitted' || s.stage === 'screening').length,
    interview: submissions.filter(s => s.stage === 'interview').length,
    offer: submissions.filter(s => s.stage === 'offer').length,
  };

  const filteredSubmissions = getFilteredSubmissions(activeTab);

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
        <TabsList className="grid w-full grid-cols-4 h-9">
          <TabsTrigger value="all" className="text-xs">
            Alle ({counts.all})
          </TabsTrigger>
          <TabsTrigger value="new" className="text-xs">
            Neu ({counts.new})
          </TabsTrigger>
          <TabsTrigger value="interview" className="text-xs">
            Interview ({counts.interview})
          </TabsTrigger>
          <TabsTrigger value="offer" className="text-xs">
            Angebot ({counts.offer})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Keine Kandidaten in dieser Kategorie</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSubmissions.map((submission) => (
                <ExposeCard
                  key={submission.id}
                  submission={submission}
                  onRequestInterview={() => onRequestInterview(submission.id)}
                  onReject={() => onReject(submission.id)}
                  onAskQuestion={() => onAskQuestion(submission.id)}
                  onViewDetails={() => onViewDetails(submission.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ExposeCardProps {
  submission: SubmissionExpose;
  onRequestInterview: () => void;
  onReject: () => void;
  onAskQuestion: () => void;
  onViewDetails: () => void;
}

function ExposeCard({
  submission,
  onRequestInterview,
  onReject,
  onAskQuestion,
  onViewDetails,
}: ExposeCardProps) {
  const anonymousId = generateAnonymousId(submission.id);
  const experienceRange = anonymizeExperience(submission.candidate.experience_years);
  const regionDisplay = anonymizeRegion(submission.candidate.city);
  const skills = submission.candidate.skills || [];

  const getMatchScoreColor = (score: number | null) => {
    if (!score) return 'bg-muted text-muted-foreground';
    if (score >= 80) return 'bg-success text-success-foreground';
    if (score >= 60) return 'bg-warning text-warning-foreground';
    return 'bg-destructive text-destructive-foreground';
  };

  const getStageBadge = (stage: string) => {
    const stageMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      new: { label: 'Neu', variant: 'default' },
      submitted: { label: 'Eingereicht', variant: 'default' },
      screening: { label: 'Screening', variant: 'secondary' },
      interview: { label: 'Interview', variant: 'outline' },
      offer: { label: 'Angebot', variant: 'outline' },
    };
    return stageMap[stage] || { label: stage, variant: 'secondary' };
  };

  const stageBadge = getStageBadge(submission.stage);

  return (
    <Card className="hover:shadow-md hover:border-primary/30 transition-all group cursor-pointer" onClick={onViewDetails}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <h4 className="font-semibold text-sm truncate">{anonymousId}</h4>
              <Badge variant={stageBadge.variant} className="text-[10px] px-1.5 py-0">
                {stageBadge.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {submission.candidate.job_title || 'Position nicht angegeben'}
            </p>
          </div>
          
          {/* Match Score */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getMatchScoreColor(submission.match_score)}`}>
            {submission.match_score ? `${submission.match_score}%` : '—'}
          </div>
        </div>

        {/* Deal Probability */}
        {submission.deal_probability && (
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Deal:</span>
            <span className="text-xs font-medium">{submission.deal_probability}%</span>
          </div>
        )}

        {/* Quick Facts */}
        <div className="space-y-1 mb-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Briefcase className="h-3 w-3" />
            <span>{experienceRange}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            <span>{regionDisplay}</span>
            {submission.candidate.work_model && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">
                {submission.candidate.work_model}
              </Badge>
            )}
          </div>
        </div>

        {/* Skills */}
        <div className="flex flex-wrap gap-1 mb-3">
          {skills.slice(0, 3).map((skill, idx) => (
            <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0">
              {skill}
            </Badge>
          ))}
          {skills.length > 3 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              +{skills.length - 3}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button 
            size="sm" 
            className="flex-1 h-7 text-xs"
            onClick={onRequestInterview}
          >
            <Calendar className="h-3 w-3 mr-1" />
            Interview
          </Button>
          <Button 
            size="icon" 
            variant="destructive" 
            className="h-7 w-7"
            onClick={onReject}
          >
            <X className="h-3 w-3" />
          </Button>
          <Button 
            size="icon" 
            variant="outline" 
            className="h-7 w-7"
            onClick={onAskQuestion}
          >
            <MessageSquare className="h-3 w-3" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-7 w-7"
            onClick={onViewDetails}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
