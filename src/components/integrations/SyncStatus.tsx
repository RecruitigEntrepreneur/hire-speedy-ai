import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface SyncStatusProps {
  lastSyncedAt: string | null;
  errorMessage: string | null;
  isLoading?: boolean;
}

export function SyncStatus({ lastSyncedAt, errorMessage, isLoading }: SyncStatusProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 animate-pulse" />
        <span>Synchronisierung läuft...</span>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        <span>Synchronisierung fehlgeschlagen</span>
      </div>
    );
  }

  if (!lastSyncedAt) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Noch nicht synchronisiert</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <CheckCircle2 className="h-4 w-4 text-green-500" />
      <span>
        Zuletzt synchronisiert{" "}
        {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true, locale: de })}
      </span>
    </div>
  );
}
