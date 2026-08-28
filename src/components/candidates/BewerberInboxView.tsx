import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { BewerberPreviewPanel } from './BewerberPreviewPanel';
import { BewerberStatusPill } from './BewerberStatusPill';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { ProfessionalInterviewWizard } from '@/components/dialogs/interview-wizard';
import type { BewerberItem } from '@/hooks/useBewerber';

interface BewerberInboxViewProps {
  items: BewerberItem[];
  onRefresh?: () => void;
}

function getMatchBadgeColor(score: number) {
  if (score >= 85) return 'bg-success/10 text-success border-success/20';
  if (score >= 70) return 'bg-warning/10 text-warning border-warning/20';
  return 'bg-muted text-muted-foreground border-border';
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground bg-muted/30 border-b sticky top-0 z-10">
      {label} ({count})
    </div>
  );
}

function CandidateCard({
  item,
  isSelected,
  onSelect,
  onOpen,
}: {
  item: BewerberItem;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const score = item.matchScore || 0;
  const title =
    item.fullName || item.currentRole || item.career[0]?.jobTitle || t('bewerber.card.no_role');
  const isArchived = item.tab === 'archiv';

  return (
    <button
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={cn(
        'w-full text-left p-3 border-b transition-colors',
        isSelected ? 'bg-muted/60 border-l-2 border-l-primary' : 'hover:bg-muted/30 border-l-2 border-l-transparent',
        isArchived && 'opacity-80'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm truncate">{title}</span>
        {score > 0 && (
          <span className={cn('px-1.5 py-0.5 rounded text-xs font-bold border shrink-0', getMatchBadgeColor(score))}>
            {score}%
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground truncate mt-0.5">
        {item.fullName && item.currentRole ? `${item.currentRole} · ` : ''}für: {item.jobTitle}
      </p>
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <BewerberStatusPill item={item} />
        {title !== item.anonymizedName && (
          <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">{item.anonymizedName}</span>
        )}
      </div>
    </button>
  );
}

export function BewerberInboxView({ items, onRefresh }: BewerberInboxViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Zuständigkeits-Sektionen: was beim Kunden liegt zuerst, Rest darunter.
  const mine = items.filter((i) => i.isMyTurn);
  const others = items.filter((i) => !i.isMyTurn);
  const grouped = [...mine, ...others];
  const showSections = mine.length > 0 && others.length > 0;

  const [selectedId, setSelectedId] = useState<string | null>(grouped[0]?.submissionId || null);
  const selectedItem = grouped.find((i) => i.submissionId === selectedId) || grouped[0] || null;

  const [wizardFor, setWizardFor] = useState<BewerberItem | null>(null);
  const [rejectFor, setRejectFor] = useState<BewerberItem | null>(null);

  const displayNameOf = (item: BewerberItem) =>
    item.fullName || item.currentRole || item.career[0]?.jobTitle || item.anonymizedName;

  const renderCard = (item: BewerberItem) => (
    <CandidateCard
      key={item.submissionId}
      item={item}
      isSelected={selectedItem?.submissionId === item.submissionId}
      onSelect={() => setSelectedId(item.submissionId)}
      onOpen={() => navigate(`/dashboard/candidates/${item.submissionId}`)}
    />
  );

  return (
    <div className="flex border rounded-lg bg-card overflow-hidden" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
      {/* Left: List */}
      <div className="w-[340px] lg:w-[380px] border-r flex flex-col shrink-0">
        <div className="flex-1 overflow-y-auto">
          {showSections ? (
            <>
              <SectionHeader label={t('bewerber.sections.mine')} count={mine.length} />
              {mine.map(renderCard)}
              <SectionHeader label={t('bewerber.sections.others')} count={others.length} />
              {others.map(renderCard)}
            </>
          ) : (
            grouped.map(renderCard)
          )}
          {items.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {t('bewerber.empty.alle_title')}
            </div>
          )}
        </div>
      </div>

      {/* Right: Preview */}
      <div className="flex-1 min-w-0">
        {selectedItem ? (
          <BewerberPreviewPanel
            item={selectedItem}
            onInterviewRequest={() => setWizardFor(selectedItem)}
            onReject={() => setRejectFor(selectedItem)}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            {t('bewerber.select_prompt')}
          </div>
        )}
      </div>

      {/* Dialoge — direkt in der Inbox nutzbar, kein Seitenwechsel nötig */}
      <RejectionDialog
        open={!!rejectFor}
        onOpenChange={(open) => !open && setRejectFor(null)}
        submission={
          rejectFor
            ? {
                id: rejectFor.submissionId,
                candidate: { id: rejectFor.candidateId, full_name: displayNameOf(rejectFor), email: '' },
                job: { id: rejectFor.jobId, title: rejectFor.jobTitle, company_name: '' },
              }
            : null
        }
        onSuccess={() => {
          setRejectFor(null);
          onRefresh?.();
        }}
      />

      {wizardFor && (
        <ProfessionalInterviewWizard
          open={!!wizardFor}
          onOpenChange={(open: boolean) => !open && setWizardFor(null)}
          submissionId={wizardFor.submissionId}
          candidateAnonymousId={displayNameOf(wizardFor)}
          jobTitle={wizardFor.jobTitle}
          onSuccess={() => {
            setWizardFor(null);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}
