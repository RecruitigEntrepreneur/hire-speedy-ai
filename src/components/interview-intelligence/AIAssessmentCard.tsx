import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Brain, AlertTriangle, CheckCircle, XCircle, MinusCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIAssessmentCardProps {
  assessment: {
    technical_fit?: number;
    culture_fit?: number;
    communication?: number;
    overall?: number;
  };
  riskAssessment?: {
    risks?: string[];
    mitigations?: string[];
  };
  recommendation?: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no' | null;
  reasoning?: string | null;
}

const recommendationConfig = {
  strong_yes: {
    label: 'Klare Empfehlung',
    icon: CheckCircle,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  yes: {
    label: 'Empfehlung',
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  maybe: {
    label: 'Unentschieden',
    icon: MinusCircle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  no: {
    label: 'Nicht empfohlen',
    icon: XCircle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  strong_no: {
    label: 'Ablehnung',
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
  },
};

export function AIAssessmentCard({
  assessment,
  riskAssessment,
  recommendation,
  reasoning,
}: AIAssessmentCardProps) {
  const getScoreColor = (score?: number) => {
    if (score === undefined) return 'bg-muted';
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getScoreLabel = (score?: number) => {
    if (score === undefined) return 'N/A';
    if (score >= 80) return 'Ausgezeichnet';
    if (score >= 70) return 'Sehr gut';
    if (score >= 60) return 'Gut';
    if (score >= 50) return 'Befriedigend';
    return 'Verbesserungsbedarf';
  };

  const recConfig = recommendation ? recommendationConfig[recommendation] : null;

  return (
    <div className="space-y-4">
      {/* Recommendation Badge */}
      {recConfig && (
        <Card className={cn('border-2', recConfig.borderColor, recConfig.bgColor)}>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <recConfig.icon className={cn('h-8 w-8', recConfig.color)} />
              <div>
                <p className={cn('text-lg font-bold', recConfig.color)}>
                  {recConfig.label}
                </p>
                {reasoning && (
                  <p className="text-sm text-muted-foreground mt-1">{reasoning}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assessment Scores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            AI-Bewertung
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Score */}
          {assessment.overall !== undefined && (
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Gesamtbewertung</p>
              <p className="text-4xl font-bold text-primary">{assessment.overall}</p>
              <p className="text-sm text-muted-foreground">{getScoreLabel(assessment.overall)}</p>
            </div>
          )}

          {/* Individual Scores */}
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Technischer Fit</span>
                <span className="font-medium">{assessment.technical_fit ?? '-'}</span>
              </div>
              <Progress value={assessment.technical_fit ?? 0} className="h-2" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Kultur-Fit</span>
                <span className="font-medium">{assessment.culture_fit ?? '-'}</span>
              </div>
              <Progress value={assessment.culture_fit ?? 0} className="h-2" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Kommunikation</span>
                <span className="font-medium">{assessment.communication ?? '-'}</span>
              </div>
              <Progress value={assessment.communication ?? 0} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Assessment */}
      {riskAssessment && (riskAssessment.risks?.length || riskAssessment.mitigations?.length) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Risikobewertung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {riskAssessment.risks && riskAssessment.risks.length > 0 && (
              <div>
                <p className="text-sm font-medium text-red-600 mb-2">Identifizierte Risiken</p>
                <ul className="space-y-1">
                  {riskAssessment.risks.map((risk, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-red-500">•</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {riskAssessment.mitigations && riskAssessment.mitigations.length > 0 && (
              <div>
                <p className="text-sm font-medium text-emerald-600 mb-2">Empfohlene Maßnahmen</p>
                <ul className="space-y-1">
                  {riskAssessment.mitigations.map((mitigation, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-emerald-500">✓</span>
                      <span>{mitigation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
