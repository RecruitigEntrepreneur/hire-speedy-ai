import { CandidateActivity } from '@/hooks/useCandidateActivityLog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  Mail, 
  FileText, 
  BookOpen, 
  CheckCircle, 
  ArrowRightLeft,
  Upload,
  Clock
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { dateFnsLocale } from '@/lib/candidateDateLocale';

interface CandidateActivityTimelineProps {
  activities: CandidateActivity[];
  loading: boolean;
  /** Mit „+ Eintragen“ im Kartenkopf und kurzer Leer-Zeile (Profil, 24.11.2026) */
  onAdd?: () => void;
}

// Beschriftung über candidateDetail:activity.badges.<typ>
const activityConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  call: {
    icon: Phone,
    color: 'text-muted-foreground',
    bgColor: 'bg-secondary',
  },
  email: {
    icon: Mail,
    color: 'text-muted-foreground',
    bgColor: 'bg-secondary',
  },
  note: {
    icon: FileText,
    color: 'text-muted-foreground',
    bgColor: 'bg-secondary',
  },
  status_change: {
    icon: ArrowRightLeft,
    color: 'text-muted-foreground',
    bgColor: 'bg-secondary',
  },
  playbook_used: {
    icon: BookOpen,
    color: 'text-muted-foreground',
    bgColor: 'bg-secondary',
  },
  alert_actioned: {
    icon: CheckCircle,
    color: 'text-muted-foreground',
    bgColor: 'bg-secondary',
  },
  hubspot_import: {
    icon: Upload,
    color: 'text-muted-foreground',
    bgColor: 'bg-secondary',
  },
};

export function CandidateActivityTimeline({ activities, loading, onAdd }: CandidateActivityTimelineProps) {
  const { t, i18n } = useTranslation('candidateDetail');
  const locale = dateFnsLocale(i18n.language);
  // Apple-Stil (24.11.2026): Überschrift ohne Symbol, graue Kreise statt bunter
  const kopf = (anzahl?: number) => (
    <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
      <CardTitle className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
        {t('activity.heading')}
        {!!anzahl && <span className="text-sm font-normal text-muted-foreground tabular-nums">{anzahl}</span>}
      </CardTitle>
      {onAdd && <button type="button" onClick={onAdd} className="text-sm font-medium text-klick hover:underline">+ {t('activity.add')}</button>}
    </CardHeader>
  );
  if (loading) {
    return (
      <Card>
        {kopf()}
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        {kopf()}
        <CardContent>
          {onAdd
            ? <p className="text-sm text-muted-foreground">{t('activity.empty')}. {t('activity.emptyHint')}.</p>
            : <div className="text-center py-8 text-muted-foreground">
                <p>{t('activity.empty')}</p>
                <p className="text-sm">{t('activity.emptyHint')}</p>
              </div>}
        </CardContent>
      </Card>
    );
  }

  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const date = format(new Date(activity.created_at), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, CandidateActivity[]>);

  return (
    <Card>
      {kopf(activities.length)}
      <CardContent>
        <div className="space-y-6">
          {Object.entries(groupedActivities).map(([date, dayActivities]) => (
            <div key={date}>
              <div className="text-sm font-medium text-muted-foreground mb-3">
                {format(new Date(date), 'PPPP', { locale })}
              </div>
              <div className="space-y-4">
                {dayActivities.map((activity, index) => {
                  const typeKey = activityConfig[activity.activity_type] ? activity.activity_type : 'note';
                  const config = activityConfig[typeKey];
                  const Icon = config.icon;

                  return (
                    <div key={activity.id} className="flex gap-4 relative">
                      {/* Timeline line */}
                      {index < dayActivities.length - 1 && (
                        <div className="absolute left-5 top-10 bottom-0 w-px bg-border" />
                      )}
                      
                      {/* Icon */}
                      <div className={`relative z-10 h-10 w-10 rounded-full ${config.bgColor} flex items-center justify-center shrink-0`}>
                        <Icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{activity.title}</p>
                            <Badge variant="outline" className="mt-1 rounded-full border-transparent bg-secondary text-xs font-normal text-muted-foreground">
                              {t(`activity.badges.${typeKey}`)}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(activity.created_at), 'HH:mm', { locale })}
                          </span>
                        </div>
                        {activity.description && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {activity.description}
                          </p>
                        )}
                        {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                            {Object.entries(activity.metadata).map(([key, value]) => (
                              <div key={key}>
                                <span className="font-medium">{key}:</span> {String(value)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
