import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  TrendingUp,
  Clock,
  Users
} from 'lucide-react';

interface RecruitingHealthScoreProps {
  activeJobs: number;
  totalCandidates: number;
  pendingInterviews: number;
  placements: number;
  newCandidatesLast7Days?: number;
}

type HealthLevel = 'excellent' | 'good' | 'warning' | 'critical';

interface HealthConfig {
  level: HealthLevel;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
  message: string;
}

export function RecruitingHealthScore({
  activeJobs,
  totalCandidates,
  pendingInterviews,
  placements,
  newCandidatesLast7Days = 0,
}: RecruitingHealthScoreProps) {
  const health = useMemo((): HealthConfig => {
    // Calculate health score based on key metrics
    let score = 0;
    const issues: string[] = [];

    // Factor 1: Active jobs with candidates
    if (activeJobs > 0 && totalCandidates > 0) {
      const candidatesPerJob = totalCandidates / activeJobs;
      if (candidatesPerJob >= 5) score += 30;
      else if (candidatesPerJob >= 2) score += 20;
      else if (candidatesPerJob >= 1) score += 10;
      else issues.push('Wenige Kandidaten');
    } else if (activeJobs > 0) {
      issues.push('Keine Kandidaten');
    }

    // Factor 2: Interview pipeline health
    if (pendingInterviews > 0) {
      score += 25;
    } else if (totalCandidates > 3) {
      issues.push('Keine Interviews geplant');
    }

    // Factor 3: Recent activity (new candidates)
    if (newCandidatesLast7Days >= 3) score += 25;
    else if (newCandidatesLast7Days >= 1) score += 15;
    else if (activeJobs > 0) issues.push('Keine neuen Kandidaten');

    // Factor 4: Conversion success
    if (placements > 0) score += 20;
    else if (totalCandidates > 10) score += 10; // Pipeline exists

    // Determine health level
    if (score >= 80) {
      return {
        level: 'excellent',
        label: 'Exzellent',
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
        message: 'Ihr Recruiting läuft optimal',
      };
    } else if (score >= 50) {
      return {
        level: 'good',
        label: 'Gut',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        icon: <TrendingUp className="h-5 w-5 text-blue-500" />,
        message: 'Recruiting-Prozess ist aktiv',
      };
    } else if (score >= 25) {
      return {
        level: 'warning',
        label: 'Achtung',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
        message: issues[0] || 'Pipeline braucht Aufmerksamkeit',
      };
    } else {
      return {
        level: 'critical',
        label: 'Kritisch',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        icon: <XCircle className="h-5 w-5 text-red-500" />,
        message: issues[0] || 'Keine aktive Recruiting-Aktivität',
      };
    }
  }, [activeJobs, totalCandidates, pendingInterviews, placements, newCandidatesLast7Days]);

  return (
    <Card className={`border ${health.borderColor} ${health.bgColor}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {health.icon}
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${health.color}`}>
                  Recruiting Health
                </span>
                <Badge 
                  variant="outline" 
                  className={`${health.color} border-current text-xs`}
                >
                  {health.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {health.message}
              </p>
            </div>
          </div>
          
          {/* Mini Stats */}
          <div className="hidden sm:flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="font-medium text-foreground">{totalCandidates}</span>
              <span className="text-xs">Kandidaten</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="font-medium text-foreground">{pendingInterviews}</span>
              <span className="text-xs">Interviews</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
