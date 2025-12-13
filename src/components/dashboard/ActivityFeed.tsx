import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, 
  UserPlus, 
  Calendar, 
  CheckCircle, 
  XCircle,
  Briefcase,
  FileText
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface ActivityItem {
  id: string;
  type: 'submission' | 'interview_scheduled' | 'hired' | 'rejected' | 'job_created';
  title: string;
  description: string;
  timestamp: string;
  metadata?: {
    jobId?: string;
    submissionId?: string;
    candidateName?: string;
  };
}

export function ActivityFeed({ limit = 10 }: { limit?: number }) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchActivities();
    }
  }, [user]);

  const fetchActivities = async () => {
    try {
      const activities: ActivityItem[] = [];

      // Recent submissions
      const { data: submissions } = await supabase
        .from('submissions')
        .select(`
          id,
          status,
          submitted_at,
          candidates (full_name),
          jobs!inner (id, title, client_id)
        `)
        .eq('jobs.client_id', user?.id)
        .order('submitted_at', { ascending: false })
        .limit(limit);

      if (submissions) {
        submissions.forEach((sub: any) => {
          if (sub.status === 'submitted') {
            activities.push({
              id: `sub-${sub.id}`,
              type: 'submission',
              title: 'Neuer Kandidat eingereicht',
              description: `${sub.candidates?.full_name || 'Kandidat'} für ${sub.jobs?.title}`,
              timestamp: sub.submitted_at,
              metadata: { jobId: sub.jobs?.id, submissionId: sub.id },
            });
          } else if (sub.status === 'hired') {
            activities.push({
              id: `hired-${sub.id}`,
              type: 'hired',
              title: 'Kandidat eingestellt',
              description: `${sub.candidates?.full_name || 'Kandidat'} für ${sub.jobs?.title}`,
              timestamp: sub.submitted_at,
              metadata: { jobId: sub.jobs?.id, submissionId: sub.id },
            });
          } else if (sub.status === 'rejected') {
            activities.push({
              id: `rejected-${sub.id}`,
              type: 'rejected',
              title: 'Kandidat abgelehnt',
              description: `${sub.candidates?.full_name || 'Kandidat'} für ${sub.jobs?.title}`,
              timestamp: sub.submitted_at,
              metadata: { jobId: sub.jobs?.id, submissionId: sub.id },
            });
          }
        });
      }

      // Recent interviews
      const { data: interviews } = await supabase
        .from('interviews')
        .select(`
          id,
          scheduled_at,
          created_at,
          submission:submissions!inner (
            id,
            candidates (full_name),
            job:jobs!inner (id, title, client_id)
          )
        `)
        .eq('submission.job.client_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (interviews) {
        interviews.forEach((int: any) => {
          activities.push({
            id: `int-${int.id}`,
            type: 'interview_scheduled',
            title: 'Interview geplant',
            description: `${int.submission?.candidates?.full_name || 'Kandidat'} für ${int.submission?.job?.title}`,
            timestamp: int.created_at,
            metadata: { submissionId: int.submission?.id },
          });
        });
      }

      // Recent jobs
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, title, created_at')
        .eq('client_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (jobs) {
        jobs.forEach((job: any) => {
          activities.push({
            id: `job-${job.id}`,
            type: 'job_created',
            title: 'Job erstellt',
            description: job.title,
            timestamp: job.created_at,
            metadata: { jobId: job.id },
          });
        });
      }

      // Sort by timestamp
      activities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivities(activities.slice(0, limit));
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'submission': return <UserPlus className="h-4 w-4 text-primary" />;
      case 'interview_scheduled': return <Calendar className="h-4 w-4 text-warning" />;
      case 'hired': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'job_created': return <Briefcase className="h-4 w-4 text-chart-2" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityBadge = (type: ActivityItem['type']) => {
    switch (type) {
      case 'submission': return <Badge variant="outline" className="text-xs">Neu</Badge>;
      case 'interview_scheduled': return <Badge variant="secondary" className="text-xs">Interview</Badge>;
      case 'hired': return <Badge className="text-xs bg-success text-success-foreground">Eingestellt</Badge>;
      case 'rejected': return <Badge variant="destructive" className="text-xs">Abgelehnt</Badge>;
      case 'job_created': return <Badge variant="outline" className="text-xs">Job</Badge>;
      default: return null;
    }
  };

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Aktivitäten
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Keine aktuellen Aktivitäten
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
            
            <div className="space-y-4">
              {activities.map((activity, index) => (
                <div key={activity.id} className="relative flex gap-4 pl-8">
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border">
                    {getActivityIcon(activity.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{activity.title}</span>
                      {getActivityBadge(activity.type)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: de })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
