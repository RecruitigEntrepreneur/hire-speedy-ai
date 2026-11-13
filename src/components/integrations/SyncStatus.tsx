import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";
import { dfLocale } from "@/lib/localeFormat";

interface SyncStatusProps {
  lastSyncedAt: string | null;
  errorMessage: string | null;
  isLoading?: boolean;
}

export function SyncStatus({ lastSyncedAt, errorMessage, isLoading }: SyncStatusProps) {
  const { t } = useTranslation('clientSettings');
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 animate-pulse" />
        <span>{t('integrations.syncRunning')}</span>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        <span>{t('integrations.syncFailed')}</span>
      </div>
    );
  }

  if (!lastSyncedAt) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>{t('integrations.notSynced')}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <CheckCircle2 className="h-4 w-4 text-green-500" />
      <span>
        {t('integrations.lastSynced', { when: formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true, locale: dfLocale() }) })}
      </span>
    </div>
  );
}
