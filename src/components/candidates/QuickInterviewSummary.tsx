import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MessageSquare,
  Target,
  CheckCircle,
  XCircle,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface QuickInterviewSummaryProps {
  candidateId: string;
  onViewDetails?: () => void;
}

interface InterviewNotes {
  change_motivation?: string | null;
  career_ultimate_goal?: string | null;
  career_3_5_year_plan?: string | null;
  would_recommend?: boolean | null;
  recommendation_notes?: string | null;
  summary_motivation?: string | null;
  summary_salary?: string | null;
  summary_notice?: string | null;
}

export function QuickInterviewSummary({ candidateId, onViewDetails }: QuickInterviewSummaryProps) {
  const [notes, setNotes] = useState<InterviewNotes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotes = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('candidate_interview_notes')
        .select('change_motivation, career_ultimate_goal, career_3_5_year_plan, would_recommend, recommendation_notes, summary_motivation, summary_salary, summary_notice')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setNotes(data);
      setLoading(false);
    };
    fetchNotes();
  }, [candidateId]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Interview-Erkenntnisse
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!notes) {
    return (
      <Card className="border-dashed border-amber-300/50 bg-amber-50/30 dark:bg-amber-900/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-amber-600" />
            Interview-Erkenntnisse
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            Für ein vollständiges Exposé fehlen:
          </p>
          <ul className="text-sm space-y-1.5">
            <li className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              Gehaltsvorstellung (Wunsch + Minimum)
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              Wechselmotivation
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              Verfügbarkeit / Kündigungsfrist
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              Deine Einschätzung & Empfehlung
            </li>
          </ul>
          {onViewDetails && (
            <Button size="sm" onClick={onViewDetails} className="w-full mt-2">
              <MessageSquare className="h-4 w-4 mr-2" />
              Interview jetzt starten
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const getRecommendationBadge = () => {
    if (notes.would_recommend === true) {
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle className="h-3 w-3 mr-1" />
          Empfohlen
        </Badge>
      );
    }
    if (notes.would_recommend === false) {
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <XCircle className="h-3 w-3 mr-1" />
          Nicht empfohlen
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <HelpCircle className="h-3 w-3 mr-1" />
        Ausstehend
      </Badge>
    );
  };

  const truncate = (text: string | null | undefined, maxLength: number) => {
    if (!text) return null;
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Interview-Erkenntnisse
          </CardTitle>
          {getRecommendationBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* Motivation */}
        {(notes.summary_motivation || notes.change_motivation) && (
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Wechselmotivation</p>
            <p className="text-foreground">
              {truncate(notes.summary_motivation || notes.change_motivation, 120)}
            </p>
          </div>
        )}

        {/* Career Goal */}
        {(notes.career_ultimate_goal || notes.career_3_5_year_plan) && (
          <div>
            <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
              <Target className="h-3 w-3" />
              Karriereziel
            </p>
            <p className="text-foreground">
              {truncate(notes.career_ultimate_goal || notes.career_3_5_year_plan, 100)}
            </p>
          </div>
        )}

        {/* Recommendation Notes */}
        {notes.recommendation_notes && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-0.5">Recruiter-Notiz</p>
            <p className="text-foreground italic">
              "{truncate(notes.recommendation_notes, 100)}"
            </p>
          </div>
        )}

        {onViewDetails && (
          <Button variant="ghost" size="sm" className="px-0 h-auto text-xs" onClick={onViewDetails}>
            Vollständiges Interview ansehen
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
