import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Euro, Clock, Home, TrendingUp, FileText, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CandidateSkillsCard } from './CandidateSkillsCard';
import { CandidateDocumentsManager } from './CandidateDocumentsManager';
import { CandidateCvAiSummaryCard } from './CandidateCvAiSummaryCard';
import { CandidateTag } from '@/hooks/useCandidateTags';

interface CandidateSidebarProps {
  candidate: {
    id: string;
    seniority?: string | null;
    expected_salary?: number | null;
    salary_expectation_min?: number | null;
    salary_expectation_max?: number | null;
    notice_period?: string | null;
    availability_date?: string | null;
    remote_possible?: boolean | null;
    remote_preference?: string | null;
    skills?: string[] | null;
    certifications?: string[] | null;
    cv_ai_summary?: string | null;
    cv_ai_bullets?: unknown | null;
  };
  tags: CandidateTag[];
}

const seniorityLabels: Record<string, string> = {
  junior: 'Junior', mid: 'Mid-Level', senior: 'Senior',
  lead: 'Lead', director: 'Director', executive: 'Executive',
};
const noticePeriodLabels: Record<string, string> = {
  immediate: 'Sofort', '2_weeks': '2 Wochen', '1_month': '1 Monat',
  '2_months': '2 Monate', '3_months': '3 Monate', '6_months': '6 Monate',
};
const remoteLabels: Record<string, string> = {
  remote: 'Full Remote', hybrid: 'Hybrid', onsite: 'Vor Ort',
};

function QuickFactRow({ icon: Icon, label, value, missing }: { icon: React.ElementType; label: string; value: string | null; missing: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", missing ? "text-amber-500" : "text-primary")} />
        {label}
      </span>
      <span className={cn("text-sm font-medium", missing && "text-amber-600 dark:text-amber-400")}>
        {value || 'Fehlt'}
      </span>
    </div>
  );
}

export function CandidateSidebar({ candidate, tags }: CandidateSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const formatSalary = (v: number | null | undefined) => v ? `${Math.round(v / 1000)}k€` : null;
  const salaryText = candidate.salary_expectation_min && candidate.salary_expectation_max
    ? `${formatSalary(candidate.salary_expectation_min)} - ${formatSalary(candidate.salary_expectation_max)}`
    : candidate.expected_salary ? formatSalary(candidate.expected_salary) : null;

  const getAvailability = () => {
    if (candidate.availability_date) {
      const d = new Date(candidate.availability_date);
      return d <= new Date() ? 'Sofort' : `Ab ${d.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}`;
    }
    return candidate.notice_period ? (noticePeriodLabels[candidate.notice_period] || candidate.notice_period) : null;
  };

  const getRemote = () => {
    if (candidate.remote_preference) return remoteLabels[candidate.remote_preference] || candidate.remote_preference;
    return candidate.remote_possible ? 'Remote möglich' : null;
  };

  const sidebarContent = (
    <div className="space-y-5">
      {/* Quick Facts */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Quick Facts</h3>
        <div className="divide-y">
          <QuickFactRow icon={Euro} label="Gehalt" value={salaryText} missing={!salaryText} />
          <QuickFactRow icon={Clock} label="Verfügbar" value={getAvailability()} missing={!getAvailability()} />
          <QuickFactRow icon={Home} label="Remote" value={getRemote()} missing={!getRemote()} />
          <QuickFactRow icon={TrendingUp} label="Seniority" value={candidate.seniority ? seniorityLabels[candidate.seniority] || candidate.seniority : null} missing={!candidate.seniority} />
        </div>
      </div>

      {/* Skills */}
      <CandidateSkillsCard skills={candidate.skills} certifications={candidate.certifications} />

      {/* AI Summary */}
      <CandidateCvAiSummaryCard summary={candidate.cv_ai_summary || null} bullets={candidate.cv_ai_bullets} />

      {/* Documents */}
      <CandidateDocumentsManager candidateId={candidate.id} />

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Tag className="h-3 w-3" />
            Tags
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(tag => (
              <Badge key={tag.id} variant="secondary" className="text-xs" style={tag.color ? { backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' } : undefined}>
                {tag.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile: Collapsible */}
      <div className="lg:hidden">
        <Collapsible open={mobileOpen} onOpenChange={setMobileOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between mb-4">
              <span className="text-sm font-medium">Kandidaten-Details</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", mobileOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mb-6">
            <div className="rounded-lg border bg-card p-4">
              {sidebarContent}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Desktop: Sticky Sidebar */}
      <div className="hidden lg:block w-80 shrink-0">
        <div className="sticky top-20 space-y-0 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 pb-24">
          {sidebarContent}
        </div>
      </div>
    </>
  );
}
