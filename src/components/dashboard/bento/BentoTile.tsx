import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, type LucideIcon } from 'lucide-react';

interface BentoTileProps {
  icon: LucideIcon;
  title: string;
  count?: number | string | null;
  to?: string;
  toLabel?: string;
  children: ReactNode;
}

/** Einheitliche Bento-Kachel: Header (Icon + Titel + optional Count + "Alle ›")
 *  und ein flex-Body, der die Kachel füllt – so werden die vier Boxen gleich hoch. */
export function BentoTile({ icon: Icon, title, count, to, toLabel = 'Alle', children }: BentoTileProps) {
  return (
    <Card className="border-border/30 shadow-sm h-full">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <h2 className="font-semibold truncate">{title}</h2>
            {count != null && count !== '' && (
              <span className="text-sm text-muted-foreground shrink-0">{count}</span>
            )}
          </div>
          {to && (
            <Button variant="ghost" size="sm" asChild className="h-7 text-xs text-muted-foreground gap-1 shrink-0">
              <Link to={to}>
                {toLabel}
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
        <div className="flex-1 min-h-0">{children}</div>
      </CardContent>
    </Card>
  );
}
