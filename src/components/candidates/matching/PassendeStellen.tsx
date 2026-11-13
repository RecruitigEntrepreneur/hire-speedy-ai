/**
 * Passende Stellen (Match V4.1) in der Kandidatenakte:
 *   1 Karte in der Akte: Top 3 mit Stufe und Kurzgrund
 *   2 Seitenpanel: alle Stellen, Filter nach Status, Ausschlüsse mit Grund
 *
 * Ein Klick auf eine Stelle öffnet ihr Mandatsbriefing (20.10.2026). Eingereicht
 * wird dort, nachdem der Headhunter die Stelle gelesen und „Ich suche“ gedrückt hat –
 * nicht mehr auf die Schnelle aus der Akte. Die frühere Seitenleiste „Warum passt
 * das?“ ist entfallen.
 *
 * Solange match-v41 nicht deployt ist, zeigt die Karte das bisherige Matching.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { dateFnsLocale } from '@/lib/candidateDateLocale';
import { term } from '@/lib/candidateTerms';
import { ChevronRight, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useActivationGate } from '@/components/recruiter/ActivateJobDialog';
import { CandidateHeroMatching } from '@/components/candidates/CandidateHeroMatching';
import { useMatchV41, type MatchV41Row } from '@/hooks/useMatchV41';
import { effectiveTier, shortLine, TIER_STYLE } from '@/lib/matchV41';
import { cn } from '@/lib/utils';

// Beschriftung: candidateDetail:jobs.remote.<art>
const REMOTE_KEYS = ['remote', 'hybrid', 'onsite', 'field'];

export function jobMeta(r: MatchV41Row): string {
  const j = r.job;
  if (!j) return '';
  const budget = j.salary_max ? (j.salary_min ? `${Math.round(j.salary_min / 1000)}–${Math.round(j.salary_max / 1000)}k` : i18n.t('candidateDetail:jobs.upTo', { max: Math.round(j.salary_max / 1000) })) : null;
  return [j.location, j.remote_type ? (REMOTE_KEYS.includes(j.remote_type) ? i18n.t(`candidateDetail:jobs.remote.${j.remote_type}`) : j.remote_type) : null, budget].filter(Boolean).join(' · ');
}

function TierBadge({ row }: { row: MatchV41Row }) {
  const { t } = useTranslation(['candidateDetail', 'candidateTerms']);
  const tier = effectiveTier(row);
  if (tier === 'ausgeblendet') return <Badge variant="outline" className="shrink-0 text-xs font-normal">{t('jobs.hidden')}</Badge>;
  return <Badge variant="outline" className={cn('shrink-0 text-xs font-normal', TIER_STYLE[tier].className)}>{term(TIER_STYLE[tier].label)}</Badge>;
}

type Gate = ReturnType<typeof useActivationGate>;

/** Eine Stelle: die ganze Zeile führt ins Mandatsbriefing. */
function MatchLine({ row }: { row: MatchV41Row }) {
  const { t, i18n: lang } = useTranslation('candidateDetail');
  return (
    <li>
      <Link to={`/recruiter/jobs/${row.job_id}`} className="group flex items-center gap-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium group-hover:underline">{row.job?.title ?? t('jobs.role')}</span>
          <span className="block truncate text-xs text-muted-foreground">{jobMeta(row)}</span>
          <span className="block truncate text-xs text-muted-foreground">{shortLine(row)}</span>
        </span>
        <TierBadge row={row} />
        {row.submittedAt && (
          <span className="shrink-0 text-xs text-muted-foreground">{t('jobs.submittedOn', { date: format(new Date(row.submittedAt), 'd.M.', { locale: dateFnsLocale(lang.language) }) })}</span>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

export function PassendeStellenCard({ candidateId, firstName }: {
  candidateId: string;
  firstName: string;
}) {
  const { t } = useTranslation('candidateDetail');
  const m = useMatchV41(candidateId);
  const gate = useActivationGate();
  const [listOpen, setListOpen] = useState(false);

  const visible = useMemo(() => m.rows.filter((r) => ['sehr_passend', 'passend', 'pruefen'].includes(effectiveTier(r))), [m.rows]);
  const excluded = m.rows.length - visible.length;

  if (m.unavailable) return <CandidateHeroMatching candidateId={candidateId} onNavigateToMatching={() => {}} />;

  const top = visible.slice(0, 3);
  // Kein eigener „Noch offen“-Hinweis mehr (19.10.2026): Was das Matching über den
  // Kandidaten braucht, steht zentral in „Bereit zum Einreichen“ und ist Pflicht im
  // Interview.

  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" /> {t('jobs.title')}
          </CardTitle>
          {m.rows.length > 0 && (
            <button type="button" className="flex items-center gap-0.5 text-xs text-primary hover:underline" onClick={() => setListOpen(true)}>
              {t('jobs.viewAll', { count: visible.length })} <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {m.loading ? (
          <div className="space-y-3 py-1">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            <p className="text-xs text-muted-foreground">{t('jobs.checking')}</p>
          </div>
        ) : m.error ? (
          <p className="text-sm text-destructive">{m.error}</p>
        ) : top.length === 0 ? (
          <div className="space-y-1 py-1 text-sm text-muted-foreground">
            <p>{m.pending > 0 ? t('jobs.stillChecking') : t('jobs.none')}</p>
            {excluded > 0 && (
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => setListOpen(true)}>
                {t('jobs.excluded', { count: excluded })}
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {top.map((r) => <MatchLine key={r.job_id} row={r} />)}
          </ul>
        )}
        {m.pending > 0 && top.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> {t('jobs.moreChecking', { count: m.pending })}</p>
        )}
      </CardContent>

      <PassendeStellenSheet open={listOpen} onOpenChange={setListOpen} firstName={firstName} match={m} gate={gate} />
    </Card>
  );
}

type Filter = 'alle' | 'einreichbar' | 'aktivierbar' | 'eingereicht' | 'ausgeschlossen';

function PassendeStellenSheet({ open, onOpenChange, firstName, match, gate }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  firstName: string;
  match: ReturnType<typeof useMatchV41>;
  gate: Gate;
}) {
  const { t } = useTranslation('candidateDetail');
  const [filter, setFilter] = useState<Filter>('alle');
  const [recomputing, setRecomputing] = useState(false);
  const isVisible = (r: MatchV41Row) => ['sehr_passend', 'passend', 'pruefen'].includes(effectiveTier(r));
  const groups: Record<Filter, MatchV41Row[]> = {
    alle: match.rows.filter(isVisible),
    einreichbar: match.rows.filter((r) => isVisible(r) && !r.submittedAt && gate.isActivated(r.job_id)),
    aktivierbar: match.rows.filter((r) => isVisible(r) && !r.submittedAt && !gate.isActivated(r.job_id)),
    eingereicht: match.rows.filter((r) => !!r.submittedAt),
    ausgeschlossen: match.rows.filter((r) => !isVisible(r)),
  };
  const list = groups[filter];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t('jobs.sheetTitle', { name: firstName })}</SheetTitle>
          <SheetDescription>{t('jobs.sheetDescription')}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(Object.keys(groups) as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn('rounded-full border px-2.5 py-1 text-xs', filter === f ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted')}
            >
              {t(`jobs.filter.${f}`)} {groups[f].length}
            </button>
          ))}
        </div>
        {filter === 'ausgeschlossen' && (
          <p className="mt-3 text-xs text-muted-foreground">{t('jobs.excludedNote')}</p>
        )}
        {list.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">{t('jobs.noneInFilter')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {list.map((r) => <MatchLine key={r.job_id} row={r} />)}
          </ul>
        )}
        <div className="mt-6 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <span>{match.pending > 0 ? t('jobs.pending', { count: match.pending }) : t('jobs.checked', { count: match.rows.length })}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={recomputing}
            onClick={async () => { setRecomputing(true); try { await match.recompute(); } finally { setRecomputing(false); } }}
          >
            <RefreshCw className={cn('mr-1.5 h-3 w-3', recomputing && 'animate-spin')} /> {t('jobs.recheck')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
