import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, Phone, MessageSquare, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecruiterInsightsPanelProps {
  nextSteps: {
    action: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  talkingPoints?: {
    candidate?: string[];
    client?: string[];
  };
  concerns?: string[];
  onActionComplete?: (index: number) => void;
}

const priorityConfig = {
  high: {
    label: 'Hoch',
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200',
    icon: AlertCircle,
  },
  medium: {
    label: 'Mittel',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200',
    icon: Clock,
  },
  low: {
    label: 'Niedrig',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200',
    icon: CheckCircle,
  },
};

export function RecruiterInsightsPanel({
  nextSteps,
  talkingPoints,
  concerns,
  onActionComplete,
}: RecruiterInsightsPanelProps) {
  return (
    <div className="space-y-4">
      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Nächste Schritte
          </CardTitle>
        </CardHeader>
        <CardContent>
          {nextSteps.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Keine Aktionen erforderlich
            </p>
          ) : (
            <ul className="space-y-3">
              {nextSteps.map((step, index) => {
                const config = priorityConfig[step.priority];
                const Icon = config.icon;
                return (
                  <li
                    key={index}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border',
                      config.bgColor,
                      config.borderColor
                    )}
                  >
                    <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', config.color)} />
                    <div className="flex-1">
                      <p className="font-medium">{step.action}</p>
                      <Badge variant="outline" className={cn('mt-1', config.color)}>
                        {config.label}
                      </Badge>
                    </div>
                    {onActionComplete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onActionComplete(index)}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Talking Points */}
      {talkingPoints && (talkingPoints.candidate?.length || talkingPoints.client?.length) && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Candidate Talking Points */}
          {talkingPoints.candidate && talkingPoints.candidate.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Phone className="h-4 w-4 text-primary" />
                  Gespräch mit Kandidat
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {talkingPoints.candidate.map((point, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-primary font-bold">{index + 1}.</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Client Talking Points */}
          {talkingPoints.client && talkingPoints.client.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Gespräch mit Client
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {talkingPoints.client.map((point, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-primary font-bold">{index + 1}.</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Concerns */}
      {concerns && concerns.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-amber-600">
              <AlertCircle className="h-5 w-5" />
              Bedenken ansprechen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {concerns.map((concern, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-amber-500">⚠</span>
                  <span>{concern}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
