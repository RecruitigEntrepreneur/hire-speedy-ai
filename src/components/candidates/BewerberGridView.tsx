import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Calendar,
  X,
  ChevronRight,
  MapPin,
  Banknote,
  Clock,
  Laptop,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BewerberItem } from '@/hooks/useBewerber';

interface BewerberGridViewProps {
  items: BewerberItem[];
}

function getMatchScoreColor(score: number) {
  if (score >= 85) return 'bg-green-500/10 text-green-700 border-green-500/20';
  if (score >= 70) return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
  return 'bg-muted text-muted-foreground border-border';
}

function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return '';
  const fmt = (v: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `ab ${fmt(min)}`;
  return `bis ${fmt(max!)}`;
}

function formatRemote(pref: string | null): string {
  const map: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'Vor Ort', flexible: 'Flexibel' };
  return pref ? map[pref] || pref : '';
}

function formatWaiting(hours: number): string {
  if (hours < 1) return 'Gerade eingegangen';
  if (hours < 24) return `Wartet seit ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Wartet seit ${days} Tag${days > 1 ? 'en' : ''}`;
}

export function BewerberGridView({ items }: BewerberGridViewProps) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        Keine Bewerber gefunden
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {items.map((item) => {
        const score = item.matchScore || 0;
        const initials = item.anonymizedName.slice(0, 2);
        const salary = formatSalary(item.salaryMin, item.salaryMax);
        const remote = formatRemote(item.remotePreference);

        return (
          <Card key={item.submissionId} className="relative overflow-hidden">
            {/* Match score bar at top */}
            {score > 0 && (
              <div
                className={cn('absolute top-0 left-0 h-1', score >= 85 ? 'bg-green-500' : score >= 70 ? 'bg-amber-500' : 'bg-muted-foreground/30')}
                style={{ width: `${score}%` }}
              />
            )}

            <div className="p-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 border">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{item.anonymizedName}</span>
                    {score > 0 && (
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold border', getMatchScoreColor(score))}>
                        {score}% Match
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{item.currentRole || '—'}</p>
                  <p className="text-xs text-muted-foreground/70">→ {item.jobTitle}</p>
                </div>
              </div>

              {/* SLA indicator */}
              <div className="mt-2 flex items-center gap-1">
                {item.urgency === 'critical' && <AlertCircle className="h-3 w-3 text-red-500" />}
                <span className={cn(
                  'text-xs',
                  item.urgency === 'critical' ? 'text-red-600 font-medium' :
                  item.urgency === 'warning' ? 'text-amber-600' : 'text-green-600'
                )}>
                  {formatWaiting(item.hoursWaiting)}
                </span>
              </div>

              {/* Facts row */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {item.experienceYears && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.experienceYears}+ Jahre
                  </span>
                )}
                {item.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {item.city}
                  </span>
                )}
                {salary && (
                  <span className="flex items-center gap-1">
                    <Banknote className="h-3 w-3" />
                    {salary}
                  </span>
                )}
                {remote && (
                  <span className="flex items-center gap-1">
                    <Laptop className="h-3 w-3" />
                    {remote}
                  </span>
                )}
              </div>

              {/* AI Summary */}
              {item.aiSummary && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground line-clamp-2 flex items-start gap-1">
                    <Sparkles className="h-3 w-3 shrink-0 mt-0.5 text-primary/60" />
                    {item.aiSummary}
                  </p>
                </div>
              )}

              {/* Skills */}
              {item.skills && item.skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.skills.slice(0, 5).map((skill, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs font-normal px-1.5 py-0">
                      {skill}
                    </Badge>
                  ))}
                  {item.skills.length > 5 && (
                    <Badge variant="outline" className="text-xs font-normal px-1.5 py-0">
                      +{item.skills.length - 5}
                    </Badge>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex items-center gap-2">
                <Button size="sm" className="flex-1">
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  Interview planen
                </Button>
                <Button size="sm" variant="destructive">
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/dashboard/candidates/${item.submissionId}`}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
