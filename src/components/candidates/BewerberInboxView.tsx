import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground bg-muted/30 border-b sticky top-0 z-10">
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
      </div>
      <p className="text-xs text-muted-foreground truncate mt-0.5">
        {item.fullName && item.currentRole ? `${item.currentRole} · ` : ''}für: {item.jobTitle}
        {submitter ? ` · von ${submitter}` : ''}
      </p>
      {task && (
        <p className={cn('mt-1 truncate text-[11px] font-medium', task.urgent ? 'text-destructive' : 'text-amber-600 dark:text-amber-400')}>
          Ihre Aufgabe: {task.title}
        </p>
      )}
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
