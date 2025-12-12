import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  Check, 
  X, 
  Calendar, 
  ArrowRight,
  Clock,
  AlertTriangle,
  User
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface NewCandidate {
  id: string;
  submittedAt: string;
  hoursWaiting: number;
  candidate: {
    id: string;
    fullName: string;
    email: string;
  };
  job: {
    id: string;
    title: string;
  };
  matchScore: number | null;
}

interface NewCandidateFeedProps {
  limit?: number;
}

export function NewCandidateFeed({ limit = 5 }: NewCandidateFeedProps) {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<NewCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchNewCandidates = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('submissions')
        .select(`
          id,
          submitted_at,
          match_score,
          candidate:candidates(id, full_name, email),
          job:jobs!inner(id, title, client_id)
        `)
        .eq('jobs.client_id', user.id)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
        .limit(limit);

      if (data) {
        const now = new Date();
        const mapped: NewCandidate[] = data.map((sub: any) => ({
          id: sub.id,
          submittedAt: sub.submitted_at,
          hoursWaiting: Math.floor((now.getTime() - new Date(sub.submitted_at).getTime()) / (1000 * 60 * 60)),
          candidate: {
            id: sub.candidate?.id,
            fullName: sub.candidate?.full_name || 'Unbekannt',
            email: sub.candidate?.email || '',
          },
          job: {
            id: sub.job?.id,
            title: sub.job?.title || 'Job',
          },
          matchScore: sub.match_score,
        }));
        setCandidates(mapped);
      }
    } catch (error) {
      console.error('Error fetching new candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNewCandidates();
  }, [user]);

  const handleQuickAction = async (submissionId: string, action: 'accept' | 'reject' | 'interview') => {
    setProcessing(submissionId);
    
    try {
      let newStatus = action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'interview';
      
      const { error } = await supabase
        .from('submissions')
        .update({ status: newStatus })
        .eq('id', submissionId);

      if (error) throw error;

      if (action === 'interview') {
        await supabase.from('interviews').insert({
          submission_id: submissionId,
          status: 'pending',
        });
      }

      toast.success(
        action === 'accept' ? 'Kandidat akzeptiert' :
        action === 'reject' ? 'Kandidat abgelehnt' :
        'Interview geplant'
      );
      
      fetchNewCandidates();
    } catch (error) {
      toast.error('Fehler bei der Aktion');
    } finally {
      setProcessing(null);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (candidates.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-muted-foreground">Keine neuen Kandidaten</h3>
          <p className="text-sm text-muted-foreground/70">Neue Einreichungen erscheinen hier</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Neue Kandidaten</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard/candidates">
            Alle anzeigen
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {candidates.map((candidate) => (
          <div
            key={candidate.id}
            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
              candidate.hoursWaiting >= 24 
                ? 'border-destructive/50 bg-destructive/5' 
                : candidate.hoursWaiting >= 12 
                  ? 'border-warning/50 bg-warning/5'
                  : 'border-border/50 bg-card hover:border-primary/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {getInitials(candidate.candidate.fullName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <Link 
                  to={`/dashboard/candidates/${candidate.id}`}
                  className="font-medium text-sm hover:text-primary transition-colors"
                >
                  {candidate.candidate.fullName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  für {candidate.job.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(candidate.submittedAt), { addSuffix: true, locale: de })}
                  </span>
                  {candidate.matchScore && (
                    <Badge variant="outline" className="text-xs h-5">
                      {candidate.matchScore}% Match
                    </Badge>
                  )}
                  {candidate.hoursWaiting >= 24 && (
                    <Badge variant="destructive" className="text-xs h-5">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {candidate.hoursWaiting}h
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                onClick={() => handleQuickAction(candidate.id, 'accept')}
                disabled={processing === candidate.id}
                title="Akzeptieren"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                onClick={() => handleQuickAction(candidate.id, 'interview')}
                disabled={processing === candidate.id}
                title="Interview planen"
              >
                <Calendar className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleQuickAction(candidate.id, 'reject')}
                disabled={processing === candidate.id}
                title="Ablehnen"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
