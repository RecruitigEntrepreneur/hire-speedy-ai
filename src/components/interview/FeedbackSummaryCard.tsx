import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Star, ThumbsUp, ThumbsDown, Users } from 'lucide-react';
import { useInterviewFeedback } from '@/hooks/useInterviewFeedback';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface FeedbackSummaryCardProps {
  interviewId: string;
}

const categoryLabels: Record<string, string> = {
  technical_skills: 'Technik',
  communication: 'Kommunikation',
  culture_fit: 'Culture Fit',
  motivation: 'Motivation',
  problem_solving: 'Problemlösung',
  overall_rating: 'Gesamt',
};

const recommendationLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  hire: { label: 'Einstellen', variant: 'default' },
  next_round: { label: 'Nächste Runde', variant: 'secondary' },
  reject: { label: 'Ablehnen', variant: 'destructive' },
  undecided: { label: 'Unentschlossen', variant: 'outline' },
};

export function FeedbackSummaryCard({ interviewId }: FeedbackSummaryCardProps) {
  const { feedbacks, isLoading, getAverageScores, getRecommendationSummary } = useInterviewFeedback(interviewId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!feedbacks || feedbacks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-muted-foreground" />
            Interview-Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Noch kein Feedback abgegeben.
          </p>
        </CardContent>
      </Card>
    );
  }

  const averages = getAverageScores();
  const recommendations = getRecommendationSummary();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Interview-Feedback
          </span>
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" />
            {feedbacks.length} Bewertung{feedbacks.length !== 1 && 'en'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Average Scores */}
        {averages && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Durchschnittliche Bewertungen</h4>
            <div className="space-y-2">
              {Object.entries(averages).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-sm w-28 text-muted-foreground">
                    {categoryLabels[key] || key}
                  </span>
                  <Progress value={value * 20} className="flex-1 h-2" />
                  <span className="text-sm font-medium w-10 text-right">
                    {value.toFixed(1)}/5
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendation Summary */}
        {recommendations && recommendations.total > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Empfehlungen</h4>
            <div className="flex flex-wrap gap-2">
              {recommendations.hire > 0 && (
                <Badge variant="default" className="gap-1">
                  ✅ {recommendations.hire}× Einstellen
                </Badge>
              )}
              {recommendations.next_round > 0 && (
                <Badge variant="secondary" className="gap-1">
                  ➡️ {recommendations.next_round}× Nächste Runde
                </Badge>
              )}
              {recommendations.reject > 0 && (
                <Badge variant="destructive" className="gap-1">
                  ❌ {recommendations.reject}× Ablehnen
                </Badge>
              )}
              {recommendations.undecided > 0 && (
                <Badge variant="outline" className="gap-1">
                  🤔 {recommendations.undecided}× Unentschlossen
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Collected Pros & Cons */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-1">
              <ThumbsUp className="h-4 w-4 text-green-500" />
              Stärken
            </h4>
            <div className="flex flex-wrap gap-1">
              {feedbacks.flatMap(f => f.pros || []).slice(0, 6).map((pro, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {pro}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-1">
              <ThumbsDown className="h-4 w-4 text-red-500" />
              Schwächen
            </h4>
            <div className="flex flex-wrap gap-1">
              {feedbacks.flatMap(f => f.cons || []).slice(0, 6).map((con, i) => (
                <Badge key={i} variant="outline" className="text-xs text-destructive">
                  {con}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Individual Feedbacks */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="details">
            <AccordionTrigger className="text-sm">
              Einzelne Feedbacks anzeigen
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                {feedbacks.map((feedback) => (
                  <div key={feedback.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {new Date(feedback.created_at).toLocaleDateString('de-DE')}
                      </span>
                      {feedback.recommendation && (
                        <Badge variant={recommendationLabels[feedback.recommendation]?.variant || 'outline'}>
                          {recommendationLabels[feedback.recommendation]?.label || feedback.recommendation}
                        </Badge>
                      )}
                    </div>
                    {feedback.overall_rating && (
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= feedback.overall_rating!
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-muted-foreground'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    {feedback.notes && (
                      <p className="text-sm">{feedback.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
