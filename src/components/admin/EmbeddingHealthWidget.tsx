import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, RefreshCw, Database, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EmbeddingStats {
  candidatesTotal: number;
  candidatesWithEmbedding: number;
  jobsTotal: number;
  jobsWithEmbedding: number;
  queuePending: number;
  queueProcessing: number;
  queueFailed: number;
}

export function EmbeddingHealthWidget() {
  const queryClient = useQueryClient();
  
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['embedding-health-stats'],
    queryFn: async (): Promise<EmbeddingStats> => {
      // Get candidate embedding stats
      const { data: candidateStats } = await supabase
        .from('candidates')
        .select('id, embedding')
        .limit(1000);
      
      const candidatesTotal = candidateStats?.length || 0;
      const candidatesWithEmbedding = candidateStats?.filter(c => c.embedding !== null).length || 0;
      
      // Get job embedding stats
      const { data: jobStats } = await supabase
        .from('jobs')
        .select('id, embedding')
        .limit(1000);
      
      const jobsTotal = jobStats?.length || 0;
      const jobsWithEmbedding = jobStats?.filter(j => j.embedding !== null).length || 0;
      
      // Get queue stats
      const { data: queueStats } = await supabase
        .from('embedding_queue')
        .select('status');
      
      const queuePending = queueStats?.filter(q => q.status === 'pending').length || 0;
      const queueProcessing = queueStats?.filter(q => q.status === 'processing').length || 0;
      const queueFailed = queueStats?.filter(q => q.status === 'failed').length || 0;
      
      return {
        candidatesTotal,
        candidatesWithEmbedding,
        jobsTotal,
        jobsWithEmbedding,
        queuePending,
        queueProcessing,
        queueFailed
      };
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const processQueueMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-embeddings', {
        body: { batch: true, batchSize: 10 }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.processed} Embeddings verarbeitet`, {
        description: data.remaining > 0 
          ? `Noch ${data.remaining} in der Queue` 
          : 'Queue ist leer'
      });
      queryClient.invalidateQueries({ queryKey: ['embedding-health-stats'] });
    },
    onError: (error) => {
      toast.error('Fehler bei Embedding-Generierung', {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
    }
  });

  const queueAllMutation = useMutation({
    mutationFn: async () => {
      // Get all entities without embeddings
      const { data: candidates } = await supabase
        .from('candidates')
        .select('id')
        .is('embedding', null);
      
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id')
        .is('embedding', null);
      
      // Queue them all
      const candidateQueue = (candidates || []).map(c => ({
        entity_type: 'candidate' as const,
        entity_id: c.id,
        priority: 2,
        status: 'pending' as const
      }));
      
      const jobQueue = (jobs || []).map(j => ({
        entity_type: 'job' as const,
        entity_id: j.id,
        priority: 2,
        status: 'pending' as const
      }));
      
      const allItems = [...candidateQueue, ...jobQueue];
      
      if (allItems.length > 0) {
        // Insert in batches to avoid conflicts
        for (const item of allItems) {
          await supabase
            .from('embedding_queue')
            .upsert(item, { onConflict: 'entity_type,entity_id,status' });
        }
      }
      
      return { queued: allItems.length };
    },
    onSuccess: (data) => {
      toast.success(`${data.queued} Einträge zur Queue hinzugefügt`);
      queryClient.invalidateQueries({ queryKey: ['embedding-health-stats'] });
    },
    onError: (error) => {
      toast.error('Fehler beim Queuen', {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Vector Embeddings
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const candidateCoverage = stats?.candidatesTotal 
    ? Math.round((stats.candidatesWithEmbedding / stats.candidatesTotal) * 100) 
    : 0;
  
  const jobCoverage = stats?.jobsTotal 
    ? Math.round((stats.jobsWithEmbedding / stats.jobsTotal) * 100) 
    : 0;
  
  const totalCoverage = (candidateCoverage + jobCoverage) / 2;
  const isReady = totalCoverage >= 80;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Vector Embeddings
              <Badge variant={isReady ? "default" : "secondary"} className="ml-2">
                {isReady ? 'Bereit' : 'In Arbeit'}
              </Badge>
            </CardTitle>
            <CardDescription>
              Semantic Search & Similar Candidates
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Coverage Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Kandidaten</span>
              <span className="font-medium">
                {stats?.candidatesWithEmbedding}/{stats?.candidatesTotal}
              </span>
            </div>
            <Progress value={candidateCoverage} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Jobs</span>
              <span className="font-medium">
                {stats?.jobsWithEmbedding}/{stats?.jobsTotal}
              </span>
            </div>
            <Progress value={jobCoverage} className="h-2" />
          </div>
        </div>

        {/* Queue Status */}
        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
          <Database className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 text-sm">
            <span className="text-muted-foreground">Queue Status:</span>
          </div>
          <div className="flex items-center gap-2">
            {stats?.queuePending ? (
              <Badge variant="outline" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {stats.queuePending} pending
              </Badge>
            ) : null}
            {stats?.queueProcessing ? (
              <Badge variant="secondary" className="gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                {stats.queueProcessing} processing
              </Badge>
            ) : null}
            {stats?.queueFailed ? (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {stats.queueFailed} failed
              </Badge>
            ) : null}
            {!stats?.queuePending && !stats?.queueProcessing && !stats?.queueFailed && (
              <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                <CheckCircle className="h-3 w-3" />
                Leer
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => queueAllMutation.mutate()}
            disabled={queueAllMutation.isPending || 
              (stats?.candidatesWithEmbedding === stats?.candidatesTotal && 
               stats?.jobsWithEmbedding === stats?.jobsTotal)}
          >
            {queueAllMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Database className="h-4 w-4 mr-2" />
            )}
            Alle Queuen
          </Button>
          
          <Button
            size="sm"
            className="flex-1"
            onClick={() => processQueueMutation.mutate()}
            disabled={processQueueMutation.isPending || !stats?.queuePending}
          >
            {processQueueMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Queue Verarbeiten
          </Button>
        </div>

        {/* Feature Status */}
        <div className="pt-2 border-t space-y-1">
          <div className="flex items-center gap-2 text-sm">
            {totalCoverage >= 80 ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            )}
            <span className={totalCoverage >= 80 ? 'text-green-700' : 'text-yellow-700'}>
              {totalCoverage >= 80 
                ? 'Semantic Search & Similar Candidates aktiv' 
                : `${Math.round(totalCoverage)}% Coverage - mindestens 80% für volle Funktionalität`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default EmbeddingHealthWidget;
