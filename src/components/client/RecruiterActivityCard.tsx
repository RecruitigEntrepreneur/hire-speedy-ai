import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Target, Clock, Send, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface RecruiterActivityCardProps {
  activeRecruiters: number;
  totalSubmissions: number;
  lastSubmissionAt: string | null;
  weeklySubmissions?: number;
  onViewCandidates: () => void;
  className?: string;
}

export function RecruiterActivityCard({
  activeRecruiters,
  totalSubmissions,
  lastSubmissionAt,
  weeklySubmissions = 0,
  onViewCandidates,
  className
}: RecruiterActivityCardProps) {
  const getActivityLevel = () => {
    if (activeRecruiters >= 3 && weeklySubmissions >= 3) return 'high';
    if (activeRecruiters >= 1 || weeklySubmissions >= 1) return 'medium';
    return 'low';
  };

  const activityLevel = getActivityLevel();
  const activityConfig = {
    high: { label: 'Hohe Aktivität', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    medium: { label: 'Normale Aktivität', color: 'text-blue-600', bg: 'bg-blue-500/10' },
    low: { label: 'Wenig Aktivität', color: 'text-muted-foreground', bg: 'bg-muted' },
  };

  const config = activityConfig[activityLevel];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Recruiter Aktivität
          </span>
          <Badge variant="outline" className={`${config.bg} ${config.color} border-0`}>
            {config.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold">{activeRecruiters}</p>
            <p className="text-xs text-muted-foreground">Aktive Recruiter</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold">{totalSubmissions}</p>
            <p className="text-xs text-muted-foreground">Einreichungen</p>
          </div>
        </div>

        {/* Activity Indicators */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Send className="h-3.5 w-3.5" />
              Diese Woche
            </span>
            <span className="font-medium">
              {weeklySubmissions} {weeklySubmissions === 1 ? 'Einreichung' : 'Einreichungen'}
            </span>
          </div>
          
          {lastSubmissionAt && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Letzte Aktivität
              </span>
              <span className="font-medium">
                {formatDistanceToNow(new Date(lastSubmissionAt), { addSuffix: true, locale: de })}
              </span>
            </div>
          )}
        </div>

        {/* Trend Indicator */}
        {weeklySubmissions > 0 && (
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <TrendingUp className="h-3.5 w-3.5" />
              Aktive Suche - Recruiter arbeiten an Kandidaten
            </div>
          </div>
        )}

        {/* CTA */}
        <Button variant="outline" size="sm" onClick={onViewCandidates} className="w-full">
          Alle Kandidaten ansehen
          <ArrowRight className="h-3.5 w-3.5 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
