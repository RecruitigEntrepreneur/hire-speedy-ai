import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Link as LinkIcon, 
  BookOpen, 
  Building2, 
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { CandidateBehavior } from '@/hooks/useCandidateBehavior';

interface CandidateEngagementPanelProps {
  behavior: CandidateBehavior;
}

export function CandidateEngagementPanel({ behavior }: CandidateEngagementPanelProps) {
  const emailOpenRate = behavior.emails_sent > 0 
    ? Math.round((behavior.emails_opened / behavior.emails_sent) * 100) 
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          📊 Engagement-Übersicht
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email Stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-blue-500" />
            <span>Emails</span>
          </div>
          <div className="text-sm">
            <span className="font-medium">{behavior.emails_opened}</span>
            <span className="text-muted-foreground"> von {behavior.emails_sent} geöffnet </span>
            <Badge variant={emailOpenRate >= 50 ? 'default' : 'secondary'} className="ml-1">
              {emailOpenRate}%
            </Badge>
          </div>
        </div>

        {/* Link Clicks */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <LinkIcon className="h-4 w-4 text-purple-500" />
            <span>Links geklickt</span>
          </div>
          <span className="text-sm font-medium">{behavior.links_clicked}</span>
        </div>

        {/* Prep Materials */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4 text-amber-500" />
            <span>Prep-Material angesehen</span>
          </div>
          <span className="text-sm font-medium">{behavior.prep_materials_viewed}</span>
        </div>

        {/* Company Profile */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-slate-500" />
            <span>Firmenprofil</span>
          </div>
          {behavior.company_profile_viewed ? (
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          ) : (
            <XCircle className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Salary Tool */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            <span>Salary-Tool genutzt</span>
          </div>
          {behavior.salary_tool_used ? (
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          ) : (
            <XCircle className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Hesitation Signals */}
        {behavior.hesitation_signals.length > 0 && (
          <div className="pt-3 border-t">
            <div className="flex items-center gap-2 text-sm text-amber-600 mb-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Hesitation Signals</span>
            </div>
            <ul className="space-y-1">
              {behavior.hesitation_signals.map((signal, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  {signal}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Motivation Indicators */}
        {behavior.motivation_indicators.length > 0 && (
          <div className="pt-3 border-t">
            <div className="flex items-center gap-2 text-sm text-emerald-600 mb-2">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Motivation Indicators</span>
            </div>
            <ul className="space-y-1">
              {behavior.motivation_indicators.map((indicator, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-emerald-500">•</span>
                  {indicator}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
