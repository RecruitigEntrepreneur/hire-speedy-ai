import { useReferenceRequests, ReferenceRequest } from '@/hooks/useReferenceChecks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Star,
  MessageSquare,
  Shield,
  Users,
  Briefcase,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface ReferenceSummaryProps {
  candidateId: string;
}

const statusConfig = {
  pending: { label: 'Ausstehend', icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Abgeschlossen', icon: CheckCircle2, color: 'bg-green-100 text-green-800' },
  declined: { label: 'Abgelehnt', icon: XCircle, color: 'bg-red-100 text-red-800' },
  expired: { label: 'Abgelaufen', icon: AlertTriangle, color: 'bg-gray-100 text-gray-800' },
};

const relationshipLabels: Record<string, string> = {
  manager: 'Vorgesetzter',
  colleague: 'Kollege',
  report: 'Direkter Mitarbeiter',
  client: 'Kunde',
};

const recommendationLabels: Record<string, { label: string; color: string }> = {
  strong_yes: { label: 'Starke Empfehlung', color: 'text-green-600' },
  yes: { label: 'Empfehlung', color: 'text-green-500' },
  neutral: { label: 'Neutral', color: 'text-gray-500' },
  no: { label: 'Keine Empfehlung', color: 'text-red-500' },
  strong_no: { label: 'Negative Empfehlung', color: 'text-red-600' },
};

export function ReferenceSummary({ candidateId }: ReferenceSummaryProps) {
  const { requests, isLoading } = useReferenceRequests(candidateId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Referenzen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const completedRequests = requests?.filter(r => r.status === 'completed') || [];
  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];

  // Calculate average scores
  const avgScores = completedRequests.reduce(
    (acc, req) => {
      const response = req.reference_responses?.[0];
      if (response) {
        if (response.overall_performance) acc.overall += response.overall_performance;
        if (response.technical_skills) acc.technical += response.technical_skills;
        if (response.communication) acc.communication += response.communication;
        if (response.teamwork) acc.teamwork += response.teamwork;
        if (response.reliability) acc.reliability += response.reliability;
        acc.count++;
      }
      return acc;
    },
    { overall: 0, technical: 0, communication: 0, teamwork: 0, reliability: 0, count: 0 }
  );

  const hasScores = avgScores.count > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Referenzen ({requests?.length || 0})</span>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-green-100 text-green-800">
              {completedRequests.length} erhalten
            </Badge>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
              {pendingRequests.length} ausstehend
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Average Scores */}
        {hasScores && (
          <div className="grid grid-cols-5 gap-4 p-4 bg-muted rounded-lg">
            {[
              { label: 'Gesamt', value: avgScores.overall / avgScores.count, icon: Star },
              { label: 'Technik', value: avgScores.technical / avgScores.count, icon: Briefcase },
              { label: 'Kommunikation', value: avgScores.communication / avgScores.count, icon: MessageSquare },
              { label: 'Teamwork', value: avgScores.teamwork / avgScores.count, icon: Users },
              { label: 'Zuverlässigkeit', value: avgScores.reliability / avgScores.count, icon: Shield },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <item.icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{item.value.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Individual References */}
        <div className="space-y-4">
          {requests?.map((request) => {
            const config = statusConfig[request.status];
            const Icon = config.icon;
            const response = request.reference_responses?.[0];

            return (
              <div
                key={request.id}
                className="p-4 border rounded-lg space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{request.reference_name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {request.reference_position && `${request.reference_position} `}
                      {request.reference_company && `bei ${request.reference_company}`}
                    </p>
                    {request.relationship && (
                      <Badge variant="outline" className="mt-1">
                        {relationshipLabels[request.relationship] || request.relationship}
                      </Badge>
                    )}
                  </div>
                  <Badge className={config.color}>
                    <Icon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                </div>

                {response && (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      {[
                        { label: 'Gesamt', value: response.overall_performance },
                        { label: 'Technik', value: response.technical_skills },
                        { label: 'Kommunikation', value: response.communication },
                        { label: 'Teamwork', value: response.teamwork },
                        { label: 'Zuverlässigkeit', value: response.reliability },
                        { label: 'Führung', value: response.leadership },
                      ].map((item) => item.value && (
                        <div key={item.label} className="flex items-center gap-2">
                          <span className="text-muted-foreground">{item.label}:</span>
                          <Progress value={item.value * 20} className="flex-1 h-2" />
                          <span className="font-medium">{item.value}/5</span>
                        </div>
                      ))}
                    </div>

                    {response.recommendation_level && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Empfehlung:</span>
                        <span className={`font-medium ${recommendationLabels[response.recommendation_level]?.color}`}>
                          {recommendationLabels[response.recommendation_level]?.label}
                        </span>
                        {response.would_rehire !== null && (
                          <Badge variant={response.would_rehire ? 'default' : 'destructive'}>
                            {response.would_rehire ? 'Würde wieder einstellen' : 'Würde nicht wieder einstellen'}
                          </Badge>
                        )}
                      </div>
                    )}

                    {response.ai_summary && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-1">AI-Zusammenfassung</p>
                        <p className="text-sm text-muted-foreground">{response.ai_summary}</p>
                      </div>
                    )}

                    {response.ai_risk_flags && response.ai_risk_flags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {response.ai_risk_flags.map((flag, i) => (
                          <Badge
                            key={i}
                            variant={
                              flag.severity === 'high' ? 'destructive' :
                              flag.severity === 'medium' ? 'secondary' : 'outline'
                            }
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {flag.flag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {!response && request.status === 'pending' && (
                  <p className="text-sm text-muted-foreground">
                    Angefragt {formatDistanceToNow(new Date(request.requested_at), {
                      locale: de,
                      addSuffix: true,
                    })}
                  </p>
                )}
              </div>
            );
          })}

          {!requests?.length && (
            <p className="text-center text-muted-foreground py-8">
              Noch keine Referenzen angefordert
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
