import { Button } from '@/components/ui/button';
import { Lock, CheckCircle, Users, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JobCompactCardProps {
  job: {
    id: string;
    title: string;
    company_name: string;
    location: string;
    industry: string | null;
  };
  earning: number | null;
  feePercentage: number;
  isRevealed: boolean;
  revealedCompanyName?: string;
  isActive: boolean;
  recruiterCount: number;
  onSelect: () => void;
  onToggleActive: (e: React.MouseEvent) => void;
}

export function JobCompactCard({
  job,
  earning,
  feePercentage,
  isRevealed,
  revealedCompanyName,
  isActive,
  recruiterCount,
  onSelect,
  onToggleActive,
}: JobCompactCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); }}
      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/30 cursor-pointer transition-colors group"
    >
      {/* Company */}
      <span className="flex items-center gap-1 text-xs text-muted-foreground w-24 shrink-0 truncate">
        {isRevealed ? (
          <>
            <CheckCircle className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
            <span className="truncate">{revealedCompanyName}</span>
          </>
        ) : (
          <>
            <Lock className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{job.industry || 'Unternehmen'}</span>
          </>
        )}
      </span>

      {/* Title */}
      <span className="text-sm font-medium truncate flex-1">{job.title}</span>

      {/* Location */}
      <span className="text-xs text-muted-foreground truncate w-20 shrink-0 hidden md:block">
        {job.location}
      </span>

      {/* Earning */}
      <span className="text-sm font-bold text-emerald-500 tabular-nums shrink-0 w-16 text-right">
        {earning ? `€${(earning / 1000).toFixed(1)}k` : `${feePercentage}%`}
      </span>

      {/* Recruiter count */}
      <span className="text-xs text-muted-foreground shrink-0 w-14 text-right flex items-center justify-end gap-1">
        <Users className="h-3 w-3" />
        {recruiterCount === 0 ? 'Erster!' : recruiterCount}
      </span>

      {/* Active toggle */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-6 text-[11px] px-2 shrink-0',
          isActive
            ? 'text-emerald-500 hover:bg-emerald-500/10'
            : 'text-muted-foreground opacity-0 group-hover:opacity-100',
        )}
        onClick={onToggleActive}
      >
        {isActive ? <Check className="h-3 w-3" /> : <Search className="h-3 w-3" />}
      </Button>
    </div>
  );
}
