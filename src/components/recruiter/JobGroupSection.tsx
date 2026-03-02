import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JobGroupSectionProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  initialExpanded?: boolean;
  collapsedMax?: number;
  className?: string;
  children: React.ReactNode[];
}

export function JobGroupSection({
  icon,
  label,
  count,
  initialExpanded = false,
  collapsedMax = 3,
  className,
  children,
}: JobGroupSectionProps) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const showToggle = children.length > collapsedMax;
  const visibleChildren = expanded ? children : children.slice(0, collapsedMax);
  const hiddenCount = children.length - collapsedMax;

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Group header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {count}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-1">
        {visibleChildren}
      </div>

      {/* Expand/Collapse toggle */}
      {showToggle && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground h-7"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              Weniger anzeigen
              <ChevronUp className="h-3.5 w-3.5 ml-1" />
            </>
          ) : (
            <>
              +{hiddenCount} weitere aufklappen
              <ChevronDown className="h-3.5 w-3.5 ml-1" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}
