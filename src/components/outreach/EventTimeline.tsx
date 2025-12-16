import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, TrendingUp, UserPlus, Briefcase, 
  Newspaper, Building2, Rocket, Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface Event {
  id: string;
  type: string;
  title: string;
  description?: string;
  importance: 'high' | 'medium' | 'low';
  captured_at: string;
}

interface EventTimelineProps {
  events: Event[];
  maxItems?: number;
}

export function EventTimeline({ events, maxItems = 5 }: EventTimelineProps) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'funding':
        return <TrendingUp className="h-4 w-4" />;
      case 'management_change':
        return <UserPlus className="h-4 w-4" />;
      case 'hiring':
        return <Briefcase className="h-4 w-4" />;
      case 'expansion':
        return <Rocket className="h-4 w-4" />;
      case 'news':
        return <Newspaper className="h-4 w-4" />;
      default:
        return <Building2 className="h-4 w-4" />;
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high':
        return 'bg-green-500';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-muted-foreground/50';
    }
  };

  const getImportanceBadge = (importance: string) => {
    switch (importance) {
      case 'high':
        return <Badge variant="default" className="text-xs bg-green-500 hover:bg-green-600">HOT</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="text-xs">NEU</Badge>;
      default:
        return null;
    }
  };

  if (events.length === 0) {
    return null;
  }

  const displayedEvents = events.slice(0, maxItems);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Events & Signale
        </h3>
        {events.length > maxItems && (
          <Badge variant="outline" className="text-xs">
            +{events.length - maxItems} weitere
          </Badge>
        )}
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />

        <div className="space-y-4">
          {displayedEvents.map((event, index) => (
            <div key={event.id} className="relative pl-6">
              {/* Timeline dot */}
              <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${getImportanceColor(event.importance)}`}>
                <div className="w-1.5 h-1.5 rounded-full bg-background" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {getEventIcon(event.type)}
                  </span>
                  <span className="font-medium text-sm">{event.title}</span>
                  {getImportanceBadge(event.importance)}
                </div>
                
                {event.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {event.description}
                  </p>
                )}
                
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(event.captured_at), { 
                    addSuffix: true, 
                    locale: de 
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
