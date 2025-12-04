import { TalentAlert } from '@/hooks/useTalentPool';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Briefcase, MapPin, X, MessageSquare, Send } from 'lucide-react';

interface TalentMatchAlertProps {
  alert: TalentAlert;
  onDismiss: () => void;
  onContact: () => void;
}

export function TalentMatchAlert({ alert, onDismiss, onContact }: TalentMatchAlertProps) {
  const candidate = alert.talent_pool?.candidates;
  const job = alert.jobs;
  const matchScore = alert.match_score || 0;

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">{candidate?.full_name || 'Kandidat'}</h4>
                <p className="text-sm text-muted-foreground">{candidate?.email}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{matchScore}% Match</span>
                  <Progress value={matchScore} className="w-20 h-2" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{job?.title}</span>
              <span className="text-muted-foreground">bei {job?.company_name}</span>
              {job?.location && (
                <>
                  <MapPin className="h-4 w-4 text-muted-foreground ml-2" />
                  <span className="text-muted-foreground">{job.location}</span>
                </>
              )}
            </div>

            {alert.match_reasons && alert.match_reasons.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {alert.match_reasons.map((reason, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {reason.reason}: {reason.score}%
                    {reason.details && (
                      <span className="text-muted-foreground ml-1">({reason.details})</span>
                    )}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onContact}>
              <MessageSquare className="h-4 w-4 mr-1" />
              Kontaktieren
            </Button>
            <Button size="sm">
              <Send className="h-4 w-4 mr-1" />
              Einreichen
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
