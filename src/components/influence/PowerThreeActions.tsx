import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Flame, 
  Phone, 
  Mail, 
  BookOpen,
  ArrowRight,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { CandidateBehavior } from '@/hooks/useCandidateBehavior';
import { InfluenceAlert } from '@/hooks/useInfluenceAlerts';

interface Submission {
  id: string;
  job_id: string;
  candidate_id: string;
  status: string;
  jobs: { title: string; company_name: string };
  candidates: { full_name: string; email: string; phone: string | null };
}

interface PowerThreeActionsProps {
  submissions: Submission[];
  behaviors: Record<string, CandidateBehavior | undefined>;
  alerts: InfluenceAlert[];
  loading?: boolean;
  onOpenPlaybook: (playbookId: string) => void;
  onMarkDone: (alertId: string) => void;
  onSelectCandidate?: (submissionId: string) => void;
}

interface PowerAction {
  submissionId: string;
  candidateName: string;
  jobTitle: string;
  company: string;
  closingProbability: number;
  action: string;
  reason: string;
  alert?: InfluenceAlert;
  email?: string;
  phone?: string | null;
}

export function PowerThreeActions({
  submissions,
  behaviors,
  alerts,
  loading = false,
  onOpenPlaybook,
  onMarkDone,
  onSelectCandidate,
}: PowerThreeActionsProps) {
  
  // Calculate Power-3 Score and get top 3 actions
  const calculatePowerActions = (): PowerAction[] => {
    const actions: PowerAction[] = [];

    for (const submission of submissions) {
      const behavior = behaviors[submission.id];
      const submissionAlerts = alerts.filter(a => a.submission_id === submission.id && !a.action_taken);
      
      // Base closing probability from behavior
      const closingProbability = behavior?.closing_probability || 50;
      
      // Calculate urgency based on alerts
      let urgencyBonus = 0;
      let topAlert: InfluenceAlert | undefined;
      let actionText = 'Follow-up senden';
      let reasonText = 'Hohe Closing-Chance';

      if (submissionAlerts.length > 0) {
        // Sort alerts by priority
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const sortedAlerts = [...submissionAlerts].sort(
          (a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]
        );
        topAlert = sortedAlerts[0];
        
        // Add urgency bonus based on priority
        urgencyBonus = priorityOrder[topAlert.priority] * 5;
        actionText = topAlert.recommended_action || 'Jetzt handeln';
        reasonText = topAlert.title;
      }

      // Power Score = Closing * 0.4 + Urgency * 0.3 + Recency * 0.3
      const powerScore = (closingProbability * 0.4) + (urgencyBonus * 6) + (behavior ? 10 : 0);

      actions.push({
        submissionId: submission.id,
        candidateName: submission.candidates?.full_name || 'Unbekannt',
        jobTitle: submission.jobs?.title || '',
        company: submission.jobs?.company_name || '',
        closingProbability,
        action: actionText,
        reason: reasonText,
        alert: topAlert,
        email: submission.candidates?.email,
        phone: submission.candidates?.phone,
      });
    }

    // Sort by power score (closing probability + alerts) and take top 3
    return actions
      .sort((a, b) => {
        // Prioritize those with critical/high alerts first
        const aHasCritical = a.alert?.priority === 'critical';
        const bHasCritical = b.alert?.priority === 'critical';
        if (aHasCritical && !bHasCritical) return -1;
        if (!aHasCritical && bHasCritical) return 1;
        
        // Then by closing probability
        return b.closingProbability - a.closingProbability;
      })
      .slice(0, 3);
  };

  const powerActions = calculatePowerActions();

  if (loading) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="h-5 w-5 text-primary" />
            THE POWER 3
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-28" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (powerActions.length === 0) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="h-5 w-5 text-primary" />
            THE POWER 3
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Flame className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Keine aktiven Deals</p>
            <p className="text-sm">Füge Kandidaten hinzu, um loszulegen</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="h-5 w-5 text-primary" />
            THE POWER 3
          </CardTitle>
          <span className="text-xs text-muted-foreground">Höchster Einfluss auf Deals</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {powerActions.map((action, index) => (
          <div
            key={action.submissionId}
            onClick={() => onSelectCandidate?.(action.submissionId)}
            className="p-4 rounded-lg bg-card border border-border hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Rank + Name */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl font-bold text-primary">{index + 1}.</span>
                  <span className="font-semibold truncate">{action.candidateName}</span>
                  {action.alert?.priority === 'critical' && (
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                </div>
                
                {/* Job Info */}
                <p className="text-sm text-muted-foreground mb-2 truncate">
                  → {action.jobTitle} @ {action.company}
                </p>
                
                {/* Reason / Alert */}
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground line-clamp-1">
                    {action.reason}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {action.phone && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={(e) => { e.stopPropagation(); window.open(`tel:${action.phone}`, '_blank'); }}
                    >
                      <Phone className="h-3 w-3 mr-1" />
                      Anrufen
                    </Button>
                  )}
                  {action.email && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={(e) => { e.stopPropagation(); window.open(`mailto:${action.email}`, '_blank'); }}
                    >
                      <Mail className="h-3 w-3 mr-1" />
                      Email
                    </Button>
                  )}
                  {action.alert?.playbook_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={(e) => { e.stopPropagation(); onOpenPlaybook(action.alert!.playbook_id!); }}
                    >
                      <BookOpen className="h-3 w-3 mr-1" />
                      Playbook
                    </Button>
                  )}
                  {action.alert && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={(e) => { e.stopPropagation(); onMarkDone(action.alert!.id); }}
                    >
                      Erledigt
                    </Button>
                  )}
                </div>
              </div>

              {/* Closing Probability */}
              <div className="text-right shrink-0">
                <div className={`text-3xl font-bold ${
                  action.closingProbability >= 70 ? 'text-emerald-500' :
                  action.closingProbability >= 40 ? 'text-amber-500' : 'text-destructive'
                }`}>
                  {action.closingProbability}%
                </div>
                <span className="text-xs text-muted-foreground">Close-Chance</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
