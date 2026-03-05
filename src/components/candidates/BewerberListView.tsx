import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  X,
  ChevronRight,
  ChevronDown,
  MapPin,
  Banknote,
  Clock,
  Laptop,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BewerberItem } from '@/hooks/useBewerber';

interface BewerberListViewProps {
  items: BewerberItem[];
}

function getMatchScoreColor(score: number) {
  if (score >= 85) return 'bg-green-500/10 text-green-700 border-green-500/20';
  if (score >= 70) return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
  return 'bg-muted text-muted-foreground border-border';
}

function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return '—';
  const fmt = (v: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `ab ${fmt(min)}`;
  return `bis ${fmt(max!)}`;
}

function formatRemote(pref: string | null): string {
  const map: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'Vor Ort', flexible: 'Flexibel' };
  return pref ? map[pref] || pref : '—';
}

function formatWaiting(hours: number): string {
  if (hours < 1) return 'Gerade eben';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function BewerberListView({ items }: BewerberListViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        Keine Bewerber gefunden
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_140px_100px_80px_80px_100px] gap-2 px-4 py-2 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
        <span>Kandidat</span>
        <span>Job</span>
        <span className="text-center">Match</span>
        <span className="text-center">Wartezeit</span>
        <span className="text-center">Standort</span>
        <span className="text-right">Aktionen</span>
      </div>

      {/* Rows */}
      {items.map((item) => {
        const isExpanded = expandedId === item.submissionId;
        const score = item.matchScore || 0;

        return (
          <div key={item.submissionId} className="border-b last:border-b-0">
            {/* Main row */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : item.submissionId)}
              className={cn(
                'w-full grid grid-cols-[1fr_140px_100px_80px_80px_100px] gap-2 px-4 py-2.5 items-center text-left transition-colors',
                isExpanded ? 'bg-muted/40' : 'hover:bg-muted/20'
              )}
            >
              {/* Name + Role */}
              <div className="flex items-center gap-2 min-w-0">
                <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                {item.urgency === 'critical' && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                <div className="min-w-0">
                  <span className="font-medium text-sm block truncate">{item.anonymizedName}</span>
                  <span className="text-xs text-muted-foreground truncate block">{item.currentRole || '—'}</span>
                </div>
              </div>

              {/* Job */}
              <span className="text-xs text-muted-foreground truncate">{item.jobTitle}</span>

              {/* Match Score */}
              <div className="flex justify-center">
                {score > 0 ? (
                  <span className={cn('px-2 py-0.5 rounded text-xs font-bold border', getMatchScoreColor(score))}>
                    {score}%
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>

              {/* Waiting */}
              <span className={cn(
                'text-xs text-center',
                item.urgency === 'critical' ? 'text-red-600 font-medium' :
                item.urgency === 'warning' ? 'text-amber-600' : 'text-muted-foreground'
              )}>
                {formatWaiting(item.hoursWaiting)}
              </span>

              {/* Location */}
              <span className="text-xs text-muted-foreground text-center truncate">{item.city || '—'}</span>

              {/* Actions placeholder (prevents button click propagation issues) */}
              <div className="text-right">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground inline-block" />
              </div>
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-4 pb-3 pt-1 bg-muted/20 border-t border-dashed">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Quick Facts */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</h4>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {item.experienceYears && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          <span>{item.experienceYears}+ Jahre Erfahrung</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Banknote className="h-3 w-3" />
                        <span>{formatSalary(item.salaryMin, item.salaryMax)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Laptop className="h-3 w-3" />
                        <span>{formatRemote(item.remotePreference)}</span>
                      </div>
                      {item.city && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" />
                          <span>{item.city}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Summary + Skills */}
                  <div className="space-y-1.5">
                    {item.aiSummary && (
                      <>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          KI-Einschatzung
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-3">{item.aiSummary}</p>
                      </>
                    )}
                    {item.skills && item.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.skills.slice(0, 6).map((skill, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs font-normal px-1.5 py-0">
                            {skill}
                          </Badge>
                        ))}
                        {item.skills.length > 6 && (
                          <Badge variant="outline" className="text-xs font-normal px-1.5 py-0">
                            +{item.skills.length - 6}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 justify-center">
                    <Button size="sm" className="w-full">
                      <Calendar className="h-3.5 w-3.5 mr-1.5" />
                      Interview planen
                    </Button>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" className="flex-1">
                        <X className="h-3.5 w-3.5 mr-1" />
                        Ablehnen
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" asChild>
                        <Link to={`/dashboard/candidates/${item.submissionId}`}>
                          Profil
                          <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
