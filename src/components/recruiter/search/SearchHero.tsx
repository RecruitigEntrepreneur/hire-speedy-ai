import { useCallback, useEffect, useState } from 'react';
import { Check, HelpCircle, Loader2, PauseCircle, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { daysUntil, fmtDayShort, mySearches, type ClientAnswer, type MySearch } from '@/lib/jobSearch';
import { ClientQuestionFlow } from './ClientQuestionFlow';
import { useTranslation, Trans } from 'react-i18next';

type T = (key: string, options?: Record<string, unknown>) => string;

/** Die eigene Suche auf dieser Stelle (oder null). `revision` lädt neu. */
export function useMySearch(jobId: string | undefined, revision = 0) {
  const [row, setRow] = useState<MySearch | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (): Promise<MySearch | null> => {
    if (!jobId) return null;
    try {
      const found = ((await mySearches()) ?? []).find((r) => r.job_id === jobId) ?? null;
      setRow(found);
      return found;
    } catch {
      setRow(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void reload();
  }, [reload, revision]);

  const searching = !!row && row.status !== 'ended';
  const openQuestion = searching && !row.client_declaration && !row.review_hold;
  return { row, loading, reload, searching, openQuestion };
}

export type SearchState = ReturnType<typeof useMySearch>;

const pausedText = (until: string | null | undefined, t: T) => (until ? t('hero.pausedUntil', { date: fmtDayShort(until) }) : t('hero.paused'));

/** Kopfzeile der Stellenseite: nur solange der Kunde pausiert. */
export function JobPausedBadge({ until }: { until: string | null | undefined }) {
  const { t } = useTranslation('recruiterSearch');
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
      <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
      {pausedText(until, t)}
    </span>
  );
}

interface HeroProps {
  search: SearchState;
  jobPaused: boolean;
  pausedUntil: string | null | undefined;
  companyName: string | null;
  capacity: { used: number; limit: number };
  onStart: () => void;
  onSubmit: () => void;
  onAnswer: () => void;
  onEnd: () => void;
}

const ruht = (search: SearchState, jobPaused: boolean) => jobPaused || search.row?.status === 'paused';

/** Hauptknopf im Kopf der Stellenseite, neben dem Verdienst. */
/** `candidateName`: Stelle wurde für einen Kandidaten geöffnet („Ansehen“ in der Stellenwahl). */
export function SearchHeroAction({ search, jobPaused, pausedUntil, onStart, onSubmit, candidateName }: Pick<HeroProps, 'search' | 'jobPaused' | 'pausedUntil' | 'onStart' | 'onSubmit'> & { candidateName?: string | null }) {
  const { t } = useTranslation('recruiterSearch');
  if (search.loading) return <Button size="lg" disabled><Loader2 className="animate-spin" />{t('hero.loading')}</Button>;
  if (ruht(search, jobPaused)) {
    return <Button size="lg" disabled><PauseCircle />{jobPaused ? pausedText(pausedUntil, t) : t('hero.searchRests')}</Button>;
  }
  if (!search.searching) return <Button size="lg" onClick={onStart}><Search />{candidateName ? t('hero.searchAndPresent', { name: candidateName }) : t('hero.iSearch')}</Button>;
  return <Button size="lg" onClick={onSubmit}><Plus />{candidateName ? t('hero.present', { name: candidateName }) : t('hero.prepare')}</Button>;
}

/** Eine Zeile unter dem Kopf: was „Ich suche“ bedeutet, Stand der Suche, offene Kundenfrage oder Pause. */
export function SearchHeroStatus({ search, jobPaused, pausedUntil, companyName, capacity, onAnswer, onEnd }: Omit<HeroProps, 'onStart' | 'onSubmit'>) {
  const { t } = useTranslation('recruiterSearch');
  const { row, loading, searching, openQuestion } = search;
  if (loading) return null;
  const link = 'underline underline-offset-2 hover:text-foreground';

  if (ruht(search, jobPaused)) {
    const review = !jobPaused && row?.review_hold;
    return (
      <span className="text-amber-500">
        {review
          ? t('hero.review')
          : [t('hero.clientPaused'), pausedUntil ? t('hero.newFrom', { date: fmtDayShort(pausedUntil) }) : null, searching ? t('hero.deadlineStill') : null].filter(Boolean).join(' · ')}
      </span>
    );
  }
  if (!searching) {
    return <span>{t('hero.notSearching', { used: capacity.used, limit: capacity.limit })}</span>;
  }
  if (openQuestion) {
    return (
      <button type="button" onClick={onAnswer} className="inline-flex items-center gap-1.5 text-amber-500 hover:text-amber-400">
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        <span><Trans t={t} i18nKey="hero.question" values={{ company: companyName || t('q.theCompany') }} components={{ u: <span className="underline underline-offset-2" /> }} /></span>
      </button>
    );
  }
  const days = daysUntil(row!.ends_at);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 sm:justify-end">
      <span className="inline-flex items-center gap-1 text-emerald-500"><Check className="h-3.5 w-3.5" aria-hidden="true" />
        {row!.submissions > 0
          ? t('hero.searchingSubmitted', { count: row!.submissions })
          : t('hero.searchingDaysLeft', { count: days ?? 30 })}
      </span>
      <span aria-hidden="true">·</span>
      <button type="button" className={link} onClick={onEnd}>{t('end.confirm')}</button>
    </span>
  );
}

/** Untere Leiste am Handy: derselbe nächste Schritt wie im Kopf. */
export function SearchMobileAction({ search, jobPaused, pausedUntil, onStart, onSubmit, candidateName }: Pick<HeroProps, 'search' | 'jobPaused' | 'pausedUntil' | 'onStart' | 'onSubmit'> & { candidateName?: string | null }) {
  const { t } = useTranslation('recruiterSearch');
  if (ruht(search, jobPaused)) {
    return <Button className="min-w-0 flex-1" disabled><PauseCircle />{jobPaused ? pausedText(pausedUntil, t) : t('hero.searchRests')}</Button>;
  }
  if (!search.loading && !search.searching) {
    return <Button className="min-w-0 flex-1" onClick={onStart}><Search />{candidateName ? t('hero.present', { name: candidateName }) : t('hero.iSearch')}</Button>;
  }
  return <Button className="min-w-0 flex-1" onClick={onSubmit}><Plus />{candidateName ? t('hero.present', { name: candidateName }) : t('hero.prepare')}</Button>;
}

/** „Kennst du X schon?“, wenn die Frage nach dem „Ich suche“ offen geblieben ist. */
export function SearchQuestionDialog({ open, onOpenChange, jobId, jobTitle, companyName, onDone }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  companyName: string | null;
  onDone: (answer: ClientAnswer) => void;
}) {
  const { t } = useTranslation('recruiterSearch');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{jobTitle}</DialogTitle>
          <DialogDescription>{t('q.beforeFirst')}</DialogDescription>
        </DialogHeader>
        <ClientQuestionFlow jobId={jobId} jobTitle={jobTitle} companyName={companyName} onDone={onDone} />
      </DialogContent>
    </Dialog>
  );
}

export function EndSearchDialog({ open, onOpenChange, submissions, busy, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissions: number;
  busy: boolean;
  onConfirm: () => void;
}) {
  const { t } = useTranslation('recruiterSearch');
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('end.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {submissions > 0
              ? t('end.withSubmissions')
              : t('end.withoutSubmissions')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t('end.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {t('end.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
