import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { BewerberPreviewPanel } from './BewerberPreviewPanel';
import type { BewerberItem } from '@/hooks/useBewerber';

interface BewerberInboxViewProps {
  items: BewerberItem[];
}

function getMatchBadgeColor(score: number) {
  if (score >= 85) return 'bg-green-500/10 text-green-700 border-green-500/20';
  if (score >= 70) return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
  return 'bg-muted text-muted-foreground border-border';
}

function getUrgencyDot(urgency: string) {
  if (urgency === 'critical') return 'bg-red-500';
  if (urgency === 'warning') return 'bg-amber-500';
  return 'bg-green-500';
}

function formatWaiting(hours: number): string {
  if (hours < 1) return 'Gerade eben';
  if (hours < 24) return `Vor ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Vor ${days}d`;
}

export function BewerberInboxView({ items }: BewerberInboxViewProps) {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.submissionId || null);
  const selectedItem = items.find((i) => i.submissionId === selectedId) || null;

  return (
    <div className="flex border rounded-lg bg-card overflow-hidden" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
      {/* Left: List */}
      <div className="w-[340px] lg:w-[380px] border-r flex flex-col shrink-0">
        <div className="flex-1 overflow-y-auto">
          {items.map((item) => {
            const isSelected = item.submissionId === selectedId;
            const score = item.matchScore || 0;

            return (
              <button
                key={item.submissionId}
                onClick={() => setSelectedId(item.submissionId)}
                onDoubleClick={() => navigate(`/dashboard/candidates/${item.submissionId}`)}
                className={cn(
                  'w-full text-left p-3 border-b transition-colors',
                  isSelected ? 'bg-muted/60 border-l-2 border-l-primary' : 'hover:bg-muted/30 border-l-2 border-l-transparent'
                )}
              >
                <div className="flex items-start gap-2">
                  <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', getUrgencyDot(item.urgency))} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{item.anonymizedName}</span>
                      {score > 0 && (
                        <span className={cn('px-1.5 py-0.5 rounded text-xs font-bold border shrink-0', getMatchBadgeColor(score))}>
                          {score}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {item.currentRole || 'Keine Rolle'}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground/70 truncate">
                        → {item.jobTitle}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.urgency === 'critical' && <AlertCircle className="h-3 w-3 text-red-500" />}
                        <span className={cn(
                          'text-xs',
                          item.urgency === 'critical' ? 'text-red-600 font-medium' :
                          item.urgency === 'warning' ? 'text-amber-600' : 'text-muted-foreground/70'
                        )}>
                          {formatWaiting(item.hoursWaiting)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {items.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Keine Bewerber gefunden
            </div>
          )}
        </div>
      </div>

      {/* Right: Preview */}
      <div className="flex-1 min-w-0">
        {selectedItem ? (
          <BewerberPreviewPanel item={selectedItem} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Wahlen Sie einen Bewerber aus der Liste
          </div>
        )}
      </div>
    </div>
  );
}
