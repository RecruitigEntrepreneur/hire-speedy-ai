import { useOfferEvents } from '@/hooks/useOffers';
import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { 
  FileText, 
  Send, 
  Eye, 
  MessageSquare, 
  CheckCircle, 
  XCircle,
  Clock 
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface OfferTimelineProps {
  offerId: string;
}

const eventConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  created: { icon: FileText, color: 'text-muted-foreground', label: 'Angebot erstellt' },
  sent: { icon: Send, color: 'text-blue-500', label: 'Angebot gesendet' },
  viewed: { icon: Eye, color: 'text-amber-500', label: 'Angebot angesehen' },
  counter_offer: { icon: MessageSquare, color: 'text-purple-500', label: 'Gegenangebot erhalten' },
  accepted: { icon: CheckCircle, color: 'text-green-500', label: 'Angebot angenommen' },
  rejected: { icon: XCircle, color: 'text-red-500', label: 'Angebot abgelehnt' },
  expired: { icon: Clock, color: 'text-gray-500', label: 'Angebot abgelaufen' },
  reminder_sent: { icon: Send, color: 'text-blue-400', label: 'Erinnerung gesendet' },
};

export function OfferTimeline({ offerId }: OfferTimelineProps) {
  const { data: events, isLoading } = useOfferEvents(offerId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        Keine Events vorhanden
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => {
        const config = eventConfig[event.event_type] || eventConfig.created;
        const Icon = config.icon;

        return (
          <div key={event.id} className="flex gap-3">
            <div className="relative">
              <div className={`p-2 rounded-full bg-background border ${config.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              {index < events.length - 1 && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 w-px h-6 bg-border" />
              )}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{config.label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(event.created_at), { 
                    locale: de, 
                    addSuffix: true 
                  })}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {format(new Date(event.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
              </div>
              {event.details && typeof event.details === 'object' && (
                <div className="mt-1 text-sm">
                  {event.event_type === 'counter_offer' && (event.details as Record<string, unknown>).counter_offer_salary && (
                    <span className="text-purple-600">
                      Neues Gehalt: {((event.details as Record<string, unknown>).counter_offer_salary as number).toLocaleString('de-DE')} €
                    </span>
                  )}
                  {(event.details as Record<string, unknown>).reason && (
                    <span className="text-muted-foreground">
                      Grund: {(event.details as Record<string, unknown>).reason as string}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
