import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Car, Clock, MapPin, ChevronRight, AlertCircle, 
  CheckCircle2, XCircle, HelpCircle, RefreshCw 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface PendingQuery {
  id: string;
  candidate_id: string;
  job_id: string;
  asked_at: string | null;
  responded_at: string | null;
  response: string | null;
  response_notes: string | null;
  candidate?: {
    full_name: string;
    email: string;
  };
  job?: {
    title: string;
    company_name: string;
  };
}

interface PendingCommuteQueriesWidgetProps {
  onSelectQuery?: (query: PendingQuery) => void;
  limit?: number;
}

export function PendingCommuteQueriesWidget({ 
  onSelectQuery,
  limit = 5 
}: PendingCommuteQueriesWidgetProps) {
  const [queries, setQueries] = useState<PendingQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchQueries = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('commute_overrides')
        .select(`
          *,
          candidate:candidates!candidate_id(full_name, email),
          job:jobs!job_id(title, company_name)
        `)
        .order('asked_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      // Transform the data
      const transformedData = (data || []).map(item => ({
        ...item,
        candidate: Array.isArray(item.candidate) ? item.candidate[0] : item.candidate,
        job: Array.isArray(item.job) ? item.job[0] : item.job,
      }));
      
      setQueries(transformedData);
    } catch (error) {
      console.error('Error fetching commute queries:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueries();
  }, [user]);

  const pendingQueries = queries.filter(q => q.asked_at && !q.responded_at);
  const answeredQueries = queries.filter(q => q.responded_at);

  const getResponseIcon = (response: string | null) => {
    switch (response) {
      case 'yes': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'no': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'conditional': return <HelpCircle className="h-4 w-4 text-amber-600" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getResponseLabel = (response: string | null) => {
    switch (response) {
      case 'yes': return 'Akzeptiert';
      case 'no': return 'Abgelehnt';
      case 'conditional': return 'Bedingt';
      default: return 'Ausstehend';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Car className="h-4 w-4" />
            Pendel-Rückfragen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded" />
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

  if (queries.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Car className="h-4 w-4" />
              Pendel-Rückfragen
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchQueries}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Keine Pendel-Rückfragen vorhanden
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Car className="h-4 w-4" />
            Pendel-Rückfragen
            {pendingQueries.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {pendingQueries.length} offen
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchQueries}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Pending Queries */}
        {pendingQueries.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Ausstehend
            </p>
            {pendingQueries.map((query) => (
              <div
                key={query.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors"
                onClick={() => onSelectQuery?.(query)}
              >
                <Clock className="h-4 w-4 text-amber-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {query.candidate?.full_name || 'Unbekannt'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {query.job?.title || 'Job'} • {query.asked_at ? formatDistanceToNow(new Date(query.asked_at), { addSuffix: true, locale: de }) : ''}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}

        {/* Answered Queries */}
        {answeredQueries.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Beantwortet
            </p>
            {answeredQueries.slice(0, 3).map((query) => (
              <div
                key={query.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border cursor-pointer hover:bg-muted transition-colors"
                onClick={() => onSelectQuery?.(query)}
              >
                {getResponseIcon(query.response)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {query.candidate?.full_name || 'Unbekannt'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {query.job?.title || 'Job'}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {getResponseLabel(query.response)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
