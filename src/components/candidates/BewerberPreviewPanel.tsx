import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Calendar,
  X,
  ChevronRight,
  MapPin,
  Banknote,
  Clock,
  Briefcase,
  Laptop,
  Sparkles,
  GraduationCap,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BewerberItem, CareerEntry } from '@/hooks/useBewerber';

interface BewerberPreviewPanelProps {
  item: BewerberItem;
  onInterviewRequest?: () => void;
  onReject?: () => void;
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
  const map: Record<string, string> = {
    remote: 'Remote',
    hybrid: 'Hybrid',
    onsite: 'Vor Ort',
    flexible: 'Flexibel',
  };
  return pref ? map[pref] || pref : '—';
}

function formatCareerDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.getFullYear().toString();
}

function formatCareerRange(entry: CareerEntry): string {
  if (entry.isCurrent) {
    const start = formatCareerDate(entry.startDate);
    return start ? `Seit ${start}` : 'Aktuell';
  }
  const start = formatCareerDate(entry.startDate);
  const end = formatCareerDate(entry.endDate);
  if (start && end) return `${start} – ${end}`;
  if (start) return `Ab ${start}`;
  return '';
}

function formatDuration(years: number | null): string {
  if (!years) return '';
  if (years === 1) return '1 Jahr';
  return `${years} Jahre`;
}

export function BewerberPreviewPanel({ item, onInterviewRequest, onReject }: BewerberPreviewPanelProps) {
  const score = item.matchScore || 0;
  const initials = item.anonymizedName.slice(0, 2);

  return (
    <div className="h-full flex flex-col">
      {/* ─── HERO ─── */}
      <div className="p-5 border-b">
        <div className="flex items-start gap-3 mb-3">
          <Avatar className="h-14 w-14 border-2 border-background shadow-sm">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <Link to={`/dashboard/candidates/${item.submissionId}`} className="text-lg font-bold text-foreground hover:text-primary transition-colors">
              {item.anonymizedName}
            </Link>
            <p className="text-sm text-muted-foreground">{item.currentRole || 'Keine Rolle angegeben'}</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Für: <span className="font-medium text-muted-foreground">{item.jobTitle}</span>
            </p>
          </div>
        </div>

        {/* Quick Facts inline */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <Briefcase className="h-3 w-3" />
            {item.experienceYears ? `${item.experienceYears} J.` : '—'}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {item.region}
          </span>
          <span className="flex items-center gap-1">
            <Banknote className="h-3 w-3" />
            {formatSalary(item.salaryMin, item.salaryMax)}
          </span>
          <span className="flex items-center gap-1">
            <Laptop className="h-3 w-3" />
            {formatRemote(item.remotePreference)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {item.noticePeriod || item.availabilityDate || 'Sofort'}
          </span>
          {item.seniority && (
            <span className="flex items-center gap-1">
              <GraduationCap className="h-3 w-3" />
              <span className="capitalize">{item.seniority}</span>
            </span>
          )}
        </div>

        {/* CTAs */}
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={onInterviewRequest}>
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            Interview anfragen
          </Button>
          <Button variant="destructive" size="sm" className="flex-1" onClick={onReject}>
            <X className="h-3.5 w-3.5 mr-1.5" />
            Ablehnen
          </Button>
        </div>
      </div>

      {/* ─── BODY: 50/50 Split ─── */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 divide-x min-h-0">

          {/* ─── LEFT: Skills + KI-Einschätzung ─── */}
          <div className="p-4 space-y-4">
            {/* Skills Card */}
            {item.skills && item.skills.length > 0 && (
              <div className="bg-card border rounded-lg p-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Skills
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {item.skills.slice(0, 8).map((skill, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs font-normal">
                      {skill}
                    </Badge>
                  ))}
                  {item.skills.length > 8 && (
                    <Badge variant="outline" className="text-xs font-normal">
                      +{item.skills.length - 8}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* KI-Einschätzung Card */}
            <div className="bg-card border rounded-lg p-3 border-l-2 border-l-amber-400">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Passung zur Stelle
                </h4>
                <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                  KI-gestützt
                </Badge>
              </div>

              {/* Score */}
              {score > 0 && (
                <div className="bg-muted/40 rounded-lg p-3 mb-3 text-center">
                  <span className="text-2xl font-bold text-foreground">{score}%</span>
                  <span className="text-xs text-muted-foreground block mt-0.5">Übereinstimmung</span>
                </div>
              )}

              {/* AI Summary */}
              {item.aiSummary && (
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  {item.aiSummary}
                </p>
              )}

              {/* Disclaimer */}
              <p className="text-[10px] text-muted-foreground/50 leading-tight">
                Passung zur Stelle, nicht Bewertung der Person. Die Entscheidung liegt bei Ihnen.
              </p>
            </div>

            {/* Recruiter Note */}
            {item.recruiterNotes && (
              <div className="bg-card border rounded-lg p-3 border-l-2 border-l-blue-400">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Recruiter-Notiz
                </h4>
                <p className="text-xs text-muted-foreground italic leading-relaxed">
                  &ldquo;{item.recruiterNotes}&rdquo;
                </p>
              </div>
            )}
          </div>

          {/* ─── RIGHT: Werdegang ─── */}
          <div className="p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Letzte Stationen
            </h4>

            {item.career.length > 0 ? (
              <div className="space-y-2">
                {item.career.map((entry, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'rounded-lg p-2.5 border',
                      entry.isCurrent
                        ? 'bg-green-500/5 border-green-500/20'
                        : 'bg-muted/30 border-transparent'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn(
                        'mt-0.5 h-2 w-2 rounded-full shrink-0',
                        entry.isCurrent ? 'bg-green-500' : 'bg-muted-foreground/30'
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground leading-tight">
                          {entry.jobTitle}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3 shrink-0" />
                          {entry.companyAnonymized}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground/70">
                          <span>{formatCareerRange(entry)}</span>
                          {entry.durationYears && (
                            <>
                              <span>·</span>
                              <span>{formatDuration(entry.durationYears)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground/50 py-6 text-center">
                Keine Stationen verfügbar
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── FOOTER ─── */}
      <div className="p-3 border-t">
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link to={`/dashboard/candidates/${item.submissionId}`}>
            Vollständiges Profil
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
