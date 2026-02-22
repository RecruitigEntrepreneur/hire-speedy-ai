import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CandidateSkillsCard } from './CandidateSkillsCard';
import { CandidateDocumentsManager } from './CandidateDocumentsManager';
import { CandidateCvAiSummaryCard } from './CandidateCvAiSummaryCard';
import { CandidateTag } from '@/hooks/useCandidateTags';

interface CandidateSidebarProps {
  candidate: {
    id: string;
    skills?: string[] | null;
    certifications?: string[] | null;
    cv_ai_summary?: string | null;
    cv_ai_bullets?: unknown | null;
  };
  tags: CandidateTag[];
}

export function CandidateSidebar({ candidate, tags }: CandidateSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="space-y-5">
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
