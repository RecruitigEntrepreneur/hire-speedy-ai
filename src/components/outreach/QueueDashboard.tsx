import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueueStatus, useProcessQueue, useRetryQueueItem, useOutreachStats } from "@/hooks/useOutreach";
import { Play, RefreshCw, Clock, CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export function QueueDashboard() {
  const { data: queue, isLoading } = useQueueStatus();
  const { data: stats } = useOutreachStats();
  const processQueue = useProcessQueue();
  const retryItem = useRetryQueueItem();

  const pendingItems = queue?.filter(q => q.status === 'pending') || [];
  const processingItems = queue?.filter(q => q.status === 'processing') || [];
  const completedItems = queue?.filter(q => q.status === 'completed') || [];
  const failedItems = queue?.filter(q => q.status === 'failed') || [];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Wartend</p>
                <p className="text-2xl font-bold">{stats?.queuePending || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Bearbeitung</p>
                <p className="text-2xl font-bold">{stats?.queueProcessing || 0}</p>
              </div>
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gesendet</p>
                <p className="text-2xl font-bold">{stats?.queueCompleted || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fehlgeschlagen</p>
                <p className="text-2xl font-bold">{stats?.queueFailed || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Process Button */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Queue-Verarbeitung</CardTitle>
          <Button
            onClick={() => processQueue.mutate()}
            disabled={processQueue.isPending || pendingItems.length === 0}
          >
            {processQueue.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verarbeite...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Jetzt senden ({pendingItems.length})
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Klicken Sie auf "Jetzt senden" um alle wartenden E-Mails zu verarbeiten. 
            Die E-Mails werden unter Berücksichtigung von Rate-Limits und Spam-Schutz versendet.
          </p>
        </CardContent>
      </Card>

      {/* Failed Items */}
      {failedItems.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Fehlgeschlagen ({failedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {failedItems.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
                  <div>
                    <span className="font-medium">
                      {item.email?.lead?.contact_name || 'Unbekannt'}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      ({item.email?.lead?.company_name})
                    </span>
                    {item.error_message && (
                      <p className="text-sm text-destructive">{item.error_message}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => retryItem.mutate(item.id)}
                    disabled={retryItem.isPending}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Wiederholen
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Items */}
      {pendingItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Wartende E-Mails ({pendingItems.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingItems.slice(0, 10).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <span className="font-medium">
                      {item.email?.lead?.contact_name || 'Unbekannt'}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      ({item.email?.lead?.company_name})
                    </span>
                    <p className="text-sm text-muted-foreground">
                      {item.email?.subject}
                    </p>
                  </div>
                  <Badge variant="outline">
                    <Clock className="h-3 w-3 mr-1" />
                    {item.scheduled_at && format(new Date(item.scheduled_at), 'dd.MM. HH:mm', { locale: de })}
                  </Badge>
                </div>
              ))}
              {pendingItems.length > 10 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  + {pendingItems.length - 10} weitere
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        </div>
      )}

      {!isLoading && queue?.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          Keine E-Mails in der Queue.
          <br />
          <span className="text-sm">Genehmigen Sie E-Mails im E-Mail-Tab um sie zur Queue hinzuzufügen.</span>
        </Card>
      )}
    </div>
  );
}
