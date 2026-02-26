import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Play, Clock, AlertCircle, ListChecks, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';

type SessionMode = 'top5' | 'all' | 'urgent';

interface SessionStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: UnifiedTaskItem[];
  onStartSession: (selectedItems: UnifiedTaskItem[]) => void;
}

const MODE_CONFIG: { key: SessionMode; label: string; description: string; icon: typeof Zap }[] = [
  {
    key: 'top5',
    label: 'Top 5',
    description: 'Die 5 wichtigsten Aufgaben',
    icon: Zap,
  },
  {
    key: 'all',
    label: 'Alle offenen',
    description: 'Alle offenen Aufgaben durcharbeiten',
    icon: ListChecks,
  },
  {
    key: 'urgent',
    label: 'Nur dringende',
    description: 'Nur kritische Aufgaben',
    icon: AlertCircle,
  },
];

const CATEGORY_FILTERS = [
  { key: 'opt_in', label: 'Opt-In' },
  { key: 'follow_up', label: 'Follow-up' },
  { key: 'interview', label: 'Interview' },
  { key: 'manual', label: 'Manuell' },
  { key: 'other', label: 'Sonstige' },
];

function getItemCategory(item: UnifiedTaskItem): string {
  if (item.itemType === 'task') return 'manual';
  const category = item.taskCategory;
  if (['opt_in_pending', 'opt_in_pending_24h', 'opt_in_pending_48h'].includes(category)) return 'opt_in';
  if (['follow_up_needed', 'ghosting_risk', 'engagement_drop', 'no_activity'].includes(category)) return 'follow_up';
  if (['interview_prep_missing', 'interview_reminder'].includes(category)) return 'interview';
  return 'other';
}

export function SessionStartDialog({
  open,
  onOpenChange,
  items,
  onStartSession,
}: SessionStartDialogProps) {
  const [mode, setMode] = useState<SessionMode>('top5');
  const [enabledCategories, setEnabledCategories] = useState<Set<string>>(
    new Set(CATEGORY_FILTERS.map(c => c.key))
  );

  const toggleCategory = (key: string) => {
    setEnabledCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredItems = useMemo(() => {
    // First filter by enabled categories
    let result = items.filter(item => enabledCategories.has(getItemCategory(item)));

    // Then filter by mode
    if (mode === 'urgent') {
      result = result.filter(i => i.priority === 'critical');
    }

    // Limit for top5
    if (mode === 'top5') {
      result = result.slice(0, 5);
    }

    return result;
  }, [items, mode, enabledCategories]);

  const estimatedMinutes = Math.ceil(filteredItems.length * 3);
  const urgentInSelection = filteredItems.filter(i => i.priority === 'critical').length;

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(item => {
      const cat = getItemCategory(item);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [items]);

  const handleStart = () => {
    if (filteredItems.length === 0) return;
    onStartSession(filteredItems);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            Session starten
          </DialogTitle>
          <DialogDescription>
            Wähle deine Aufgaben für eine fokussierte Arbeitssession.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Selection */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Modus
          </label>
          <div className="grid grid-cols-3 gap-2">
            {MODE_CONFIG.map(m => {
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-3 rounded-lg border transition-all text-center',
                    mode === m.key
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/30 hover:bg-accent/50'
                  )}
                >
                  <Icon className={cn('h-4 w-4', mode === m.key ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="text-xs font-medium">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Filters */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Kategorien
          </label>
          <div className="space-y-1.5">
            {CATEGORY_FILTERS.map(cat => (
              <label
                key={cat.key}
                className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/50 cursor-pointer"
              >
                <Checkbox
                  checked={enabledCategories.has(cat.key)}
                  onCheckedChange={() => toggleCategory(cat.key)}
                />
                <span className="text-sm flex-1">{cat.label}</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {categoryCounts[cat.key] || 0}
                </Badge>
              </label>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="border rounded-lg p-3 bg-muted/30 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{filteredItems.length} Aufgaben</span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              ~{estimatedMinutes} min
            </div>
          </div>
          {urgentInSelection > 0 && (
            <div className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {urgentInSelection} dringend
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleStart}
            disabled={filteredItems.length === 0}
            className="gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            Session starten ({filteredItems.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
