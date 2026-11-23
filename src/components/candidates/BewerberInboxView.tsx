import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { BewerberPreviewPanel } from './BewerberPreviewPanel';
import { BewerberStatusPill } from './BewerberStatusPill';
import { useClientTasks, type ClientTask } from '@/lib/clientTasksApi';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { InterviewRequestDialog } from '@/components/interview/request/InterviewRequestDialog';
import type { BewerberItem } from '@/hooks/useBewerber';
import { useSubmitterNames } from '@/components/candidates/client/useSubmitter';

interface BewerberInboxViewProps {
  items: BewerberItem[];
  onRefresh?: () => void;
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="px-3 py-2 text-xs font-semibold text-foreground bg-card border-b sticky top-0 z-10">
      {label} ({count})
    </div>
  );
}

function CandidateCard({
  item,
  submitter,
  task,
  isSelected,
  onSelect,
  onOpen,
}: {
  item: BewerberItem;
  submitter?: string;
  /** offene Aufgabe des Kunden zu dieser Bewerbung (23.10.2026) */
  task?: ClientTask;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const { t: tc } = useTranslation('clientCandidates');
  const title =
    item.fullName || item.currentRole || item.career[0]?.jobTitle || t('bewerber.card.no_role');
  const isArchived = item.tab === 'archiv';

  return (
    <button
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={cn(
        'w-full text-left p-3 border-b transition-colors',
        isSelected ? 'bg-secondary' : 'hover:bg-secondary/50',
        isArchived && 'opacity-80'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm truncate">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground truncate mt-0.5">
        {item.fullName && item.currentRole ? `${item.currentRole} · ` : ''}{tc('card.for', { job: item.jobTitle })}
        {submitter ? tc('card.by', { name: submitter }) : ''}
      </p>
      {task && (
        <p className={'mt-1 truncate text-[11px] font-medium text-foreground'}>
          {tc('card.task', { title: task.title })}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <BewerberStatusPill item={item} />
        {title !== item.anonymizedName && (
          <span className="text-[11px] text-muted-foreground/70 shrink-0">{item.anonymizedName}</span>
        )}
      </div>
    </button>
  );
}

export function BewerberInboxView({ items, onRefresh }: BewerberInboxViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Zuständigkeits-Sektionen: was beim Kunden liegt zuerst, Rest darunter.
  const mine = items.filter((i) => i.isMyTurn);
  const others = items.filter((i) => !i.isMyTurn);
  const grouped = [...mine, ...others];
  const showSections = mine.length > 0 && others.length > 0;

  const [selectedId, setSelectedId] = useState<string | null>(grouped[0]?.submissionId || null);
  const selectedItem = grouped.find((i) => i.submissionId === selectedId) || grouped[0] || null;

  const [wizardFor, setWizardFor] = useState<BewerberItem | null>(null);
  const [rejectFor, setRejectFor] = useState<BewerberItem | null>(null);

  // Wer den Kandidaten eingereicht hat, je Karte (über die Suchenden-Liste der Stellen)
  const { data: submitterNames } = useSubmitterNames(items.map((i) => ({ submissionId: i.submissionId, jobId: i.jobId })));
  const { data: taskList } = useClientTasks();
  const taskBySub = new Map<string, ClientTask>();
  for (const t of taskList?.tasks ?? []) if (t.submissionId && !taskBySub.has(t.submissionId)) taskBySub.set(t.submissionId, t);

  const displayNameOf = (item: BewerberItem) =>
    item.fullName || item.currentRole || item.career[0]?.jobTitle || item.anonymizedName;

  const renderCard = (item: BewerberItem) => (
    <CandidateCard
      key={item.submissionId}
      item={item}
      submitter={submitterNames?.[item.submissionId]}
      task={taskBySub.get(item.submissionId)}
      isSelected={!isMobile && selectedItem?.submissionId === item.submissionId}
      onSelect={() => (isMobile ? navigate(`/dashboard/candidates/${item.submissionId}`) : setSelectedId(item.submissionId))}
      onOpen={() => navigate(`/dashboard/candidates/${item.submissionId}`)}
    />
  );

  return (
    // Handy: kein Kasten mit eigener Scrollleiste, die ganze Seite scrollt; ein Tipp öffnet das Profil
    // (die Vorschau rechts gibt es erst ab 768 px).
    <div className="md:flex md:h-[calc(100vh-280px)] md:min-h-[500px] md:overflow-hidden md:rounded-lg md:border md:bg-card">
      {/* Left: List */}
      <div className="flex w-full shrink-0 flex-col md:w-[340px] md:border-r lg:w-[380px]">
        <div className="max-md:border-t md:flex-1 md:overflow-y-auto">
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
      <div className="hidden min-w-0 flex-1 md:block">
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
                candidate: { id: rejectFor.candidateId, full_name: (rejectFor.identityUnlocked && rejectFor.fullName) || rejectFor.anonymizedName, email: '' },
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
        <InterviewRequestDialog
          open={!!wizardFor}
          onOpenChange={(open: boolean) => !open && setWizardFor(null)}
          submissionId={wizardFor.submissionId}
          onSent={() => {
            setWizardFor(null);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}
