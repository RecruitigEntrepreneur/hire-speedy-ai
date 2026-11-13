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
}

// Beschriftung über candidateDetail:activity.badges.<typ>
const activityConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  call: {
    icon: Phone,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
  },
  email: {
    icon: Mail,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  note: {
    icon: FileText,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  status_change: {
    icon: ArrowRightLeft,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  playbook_used: {
    icon: BookOpen,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  alert_actioned: {
    icon: CheckCircle,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
  },
  hubspot_import: {
    icon: Upload,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
};

export function CandidateActivityTimeline({ activities, loading }: CandidateActivityTimelineProps) {
  const { t, i18n } = useTranslation('candidateDetail');
  const locale = dateFnsLocale(i18n.language);
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('activity.heading')}
          </CardTitle>
        </CardHeader>
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('activity.heading')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto opacity-50 mb-3" />
            <p>{t('activity.empty')}</p>
            <p className="text-sm">{t('activity.emptyHint')}</p>
          </div>
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {t('activity.heading')}
          <Badge variant="secondary" className="ml-2">{activities.length}</Badge>
        </CardTitle>
      </CardHeader>
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
                            <Badge variant="outline" className="text-xs mt-1">
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
