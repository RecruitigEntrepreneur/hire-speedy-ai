import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, CheckCircle, XCircle, Loader2, 
  RefreshCw, Play, AlertTriangle 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

export function QueueStatusCard() {
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['queue-status'],
    queryFn: async (): Promise<QueueStats> => {
      const { data, error } = await supabase
        .from('outreach_send_queue')
        .select('status');
      
      if (error) throw error;

      const counts = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: data?.length || 0,
      };

      data?.forEach(item => {
        const status = item.status as keyof typeof counts;
        if (status in counts) {
          counts[status]++;
        }
      });

      return counts;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const triggerQueue = async () => {
    try {
      const { error } = await supabase.functions.invoke('process-outreach-queue');
      if (error) throw error;
      toast.success('Queue-Verarbeitung gestartet');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Fehler beim Starten der Queue');
    }
  };

  const retryFailed = async () => {
    try {
      const { error } = await supabase
        .from('outreach_send_queue')
        .update({ status: 'pending', attempts: 0 })
        .eq('status', 'failed');
      
      if (error) throw error;
      toast.success('Fehlgeschlagene E-Mails werden erneut verarbeitet');
      refetch();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const completionRate = stats && stats.total > 0 
    ? ((stats.completed / stats.total) * 100).toFixed(1) 
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Sende-Warteschlange</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
            <Clock className="h-5 w-5 mx-auto mb-1 text-yellow-600" />
            <p className="text-2xl font-bold text-yellow-600">{stats?.pending || 0}</p>
            <p className="text-xs text-muted-foreground">Wartend</p>
          </div>
          <div className="text-center p-3 bg-blue-500/10 rounded-lg">
            <Loader2 className="h-5 w-5 mx-auto mb-1 text-blue-600 animate-spin" />
            <p className="text-2xl font-bold text-blue-600">{stats?.processing || 0}</p>
            <p className="text-xs text-muted-foreground">Verarbeitung</p>
          </div>
          <div className="text-center p-3 bg-green-500/10 rounded-lg">
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-600" />
            <p className="text-2xl font-bold text-green-600">{stats?.completed || 0}</p>
            <p className="text-xs text-muted-foreground">Gesendet</p>
          </div>
          <div className="text-center p-3 bg-red-500/10 rounded-lg">
            <XCircle className="h-5 w-5 mx-auto mb-1 text-red-600" />
            <p className="text-2xl font-bold text-red-600">{stats?.failed || 0}</p>
            <p className="text-xs text-muted-foreground">Fehlgeschlagen</p>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Fortschritt</span>
            <span className="font-medium">{completionRate}%</span>
          </div>
          <Progress value={Number(completionRate)} className="h-2" />
        </div>

        {/* Warnings */}
        {stats && stats.failed > 0 && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-lg text-sm">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span className="text-red-600">
              {stats.failed} E-Mail(s) konnten nicht gesendet werden
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={triggerQueue}
            disabled={!stats || stats.pending === 0}
          >
            <Play className="h-4 w-4 mr-2" />
            Queue verarbeiten
          </Button>
          {stats && stats.failed > 0 && (
            <Button
              variant="outline"
              onClick={retryFailed}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Fehlgeschlagene wiederholen
            </Button>
          )}
        </div>

        {/* Info */}
        <p className="text-xs text-muted-foreground text-center">
          Aktualisiert alle 10 Sekunden automatisch
        </p>
      </CardContent>
    </Card>
  );
}
