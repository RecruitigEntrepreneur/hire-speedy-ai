import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Archive, ArrowRight, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BewerberStatusPill } from '@/components/candidates/BewerberStatusPill';
import type { BewerberItem, BewerberTab, BewerberTone } from '@/hooks/useBewerber';
import { severity, type DiagnoseTone, type JobDiagnose, type JobState } from '@/lib/jobCockpit';
import { cn } from '@/lib/utils';

const TONE_CLASSES: Record<BewerberTone, string> = {
  ok: 'bg-success/10 text-success',
  warn: 'bg-warning/10 text-warning',
  crit: 'bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
};

const BANNER_CLASSES: Record<DiagnoseTone, string> = {
  ok: 'bg-success/10 text-success',
  warn: 'bg-warning/10 text-warning',
  crit: 'bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
  accent: 'bg-primary/10 text-primary',
};

// Job-Zustandspille: gleiche Wort+Farb-Sprache wie die Bewerber-Pillen.
export function JobStatePill({ state, className }: { state: JobState; className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[state.tone],
        className
      )}
    >
      {t(`jobdetail.state.${state.key}`)}
    </span>
  );
}

// Zug-Banner: ein Satz Diagnose + höchstens EINE Aktion.
export function JobZugBanner({
  diagnose,
  jobId,
  onEdit,
  onResume,
}: {
  diagnose: JobDiagnose;
  jobId: string;
  onEdit: () => void;
  onResume: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleAction = () => {
    const a = diagnose.action;
    if (a.type === 'detail' && a.submissionId) navigate(`/dashboard/candidates/${a.submissionId}`);
    else if (a.type === 'inbox') navigate(`/dashboard/candidates?job=${jobId}&tab=${a.tab ?? 'alle'}`);
    else if (a.type === 'edit') onEdit();
    else if (a.type === 'resume') onResume();
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3',
        BANNER_CLASSES[diagnose.tone]
      )}
    >
      <p className="text-sm font-medium">{t(`jobdetail.banner.${diagnose.key}`, diagnose.params)}</p>
      {diagnose.action.type !== 'none' && (
        <Button size="sm" onClick={handleAction} className="shrink-0">
          {t(`jobdetail.banner_action.${diagnose.action.labelKey}`)}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

const FUNNEL_TABS: BewerberTab[] = ['neu', 'pruefung', 'interview', 'angebot'];

// Funnel-Leiste: exakt dieselben Eimer wie die Inbox-Tabs (tabOf), tappbar,
// Akzentpunkt = mindestens ein Bewerber wartet dort auf den Kunden.
export function JobFunnel({
  jobId,
  tabCounts,
  turnTabs,
  hiredCount,
}: {
  jobId: string;
  tabCounts: Record<BewerberTab, number>;
  turnTabs: Set<BewerberTab>;
  hiredCount: number;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const go = (tab: BewerberTab) => navigate(`/dashboard/candidates?job=${jobId}&tab=${tab}`);

  return (
    <div>
      <div className="flex flex-wrap items-stretch gap-1.5">
        {FUNNEL_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => go(tab)}
            className="flex items-center gap-1.5 rounded-md bg-muted/50 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            {t(`bewerber.tabs.${tab}`)}
            <span className="text-sm font-semibold text-foreground">{tabCounts[tab]}</span>
            {turnTabs.has(tab) && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            )}
          </button>
        ))}

        <span className="mx-1 my-1 w-px bg-border" aria-hidden="true" />

        <button
          onClick={() => go('archiv')}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground/80 transition-colors hover:bg-muted"
        >
          <Archive className="h-3.5 w-3.5" />
          {t('bewerber.tabs.archiv')}
          <span className="font-semibold text-foreground">{tabCounts.archiv}</span>
          {hiredCount > 0 && (
            <span className="text-xs text-success">{t('jobdetail.funnel.hired', { count: hiredCount })}</span>
          )}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{t('jobdetail.funnel.hint')}</p>
    </div>
  );
}

const MAX_WAIT_ROWS = 5;

// "Wartet auf Sie": reine Navigation zu den Entscheidungs-Flows — bewusst keine
// Aktions-Buttons (Entscheidungen fallen in Inbox/Detailseite, nicht hier).
export function JobWaitList({ items, jobId }: { items: BewerberItem[]; jobId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const mine = items
    .filter((i) => i.tab !== 'archiv' && i.isMyTurn)
    .sort((a, b) => severity(b) - severity(a) || b.hoursWaiting - a.hoursWaiting);

  if (mine.length === 0) return null;

  const shown = mine.slice(0, MAX_WAIT_ROWS);
  const rest = mine.length - shown.length;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('jobdetail.wait.title')}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-primary"
          onClick={() => navigate(`/dashboard/candidates?job=${jobId}&tab=alle`)}
        >
          {t('jobdetail.wait.open_inbox')}
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>

      <div>
        {shown.map((item) => {
          const title =
            item.fullName || item.currentRole || item.career[0]?.jobTitle || item.anonymizedName;
          const sub = [
            title === item.anonymizedName ? null : item.anonymizedName,
            item.matchScore && item.matchScore > 0 ? `${item.matchScore} % ${t('jobdetail.wait.match')}` : null,
            item.experienceBand || null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <button
              key={item.submissionId}
              onClick={() => navigate(`/dashboard/candidates/${item.submissionId}`)}
              className="flex w-full items-center gap-3 border-t py-2.5 text-left transition-colors first:border-t-0 hover:bg-muted/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                {item.identityUnlocked && item.fullName
                  ? item.fullName
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'PR'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{title}</span>
                {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
              </span>
              <BewerberStatusPill item={item} />
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {rest > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t('jobdetail.wait.more', { count: rest })}
        </p>
      )}
    </div>
  );
}
