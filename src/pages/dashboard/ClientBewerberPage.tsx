import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BewerberInboxView } from '@/components/candidates/BewerberInboxView';
import {
  useBewerber,
  type BewerberFilters,
  type BewerberListTab,
  type BewerberSortOption,
} from '@/hooks/useBewerber';
import { usePageViewTracking } from '@/hooks/useEventTracking';
import { Search, RefreshCw, Users, Archive, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const VALID_TABS: BewerberListTab[] = ['neu', 'pruefung', 'angefragt', 'interview', 'angebot', 'abgelehnt', 'beendet'];

// „Angefragt“ (wartet auf den Kandidaten) steht neben „Interview“; das frühere Archiv
// teilt sich in „Abgelehnt“ und „Beendet“. „In Prüfung“ nur, wenn dort jemand steht.
const PIPELINE_TABS: { key: BewerberListTab | null; labelKey: string }[] = [
  { key: 'neu', labelKey: 'bewerber.tabs.neu' },
  { key: 'pruefung', labelKey: 'bewerber.tabs.pruefung' },
  { key: 'angefragt', labelKey: 'bewerber.tabs.angefragt' },
  { key: 'interview', labelKey: 'bewerber.tabs.interview' },
  { key: 'angebot', labelKey: 'bewerber.tabs.angebot' },
  { key: null, labelKey: 'bewerber.tabs.alle' },
];
const CLOSED_TABS: { key: BewerberListTab; labelKey: string }[] = [
  { key: 'abgelehnt', labelKey: 'bewerber.tabs.abgelehnt' },
  { key: 'beendet', labelKey: 'bewerber.tabs.beendet' },
];

/** Alte Links (?tab=archiv) führen zu „Abgelehnt“. */
function tabFromParam(param: string | null): BewerberListTab | null {
  if (param === 'alle') return null;
  if (param === 'archiv') return 'abgelehnt';
  return VALID_TABS.includes(param as BewerberListTab) ? (param as BewerberListTab) : 'neu';
}

export default function ClientBewerberPage() {
  const { t } = useTranslation();
  // Deep-Links von der Job-Detailseite: /dashboard/candidates?job=<id>&tab=<tab|alle>
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<BewerberFilters>(() => {
    return {
      tab: null,
      listTab: tabFromParam(searchParams.get('tab')),
      jobId: searchParams.get('job'),
      search: '',
      sort: 'newest',
    };
  });

  usePageViewTracking('client_bewerber');

  const {
    items,
    allItems,
    listTabCounts,
    activeCount,
    myTurnCount,
    totalCount,
    truncated,
    jobs,
    isLoading,
    error,
    refetch,
  } = useBewerber(filters);

  const updateFilter = <K extends keyof BewerberFilters>(key: K, value: BewerberFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[500px] w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-4">{t('bewerber.error.load')}</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('bewerber.error.retry')}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const subtitle =
    activeCount === 0
      ? t('bewerber.header.empty')
      : myTurnCount === 0
        ? t('bewerber.header.all_done', { count: activeCount })
        : myTurnCount === 1
          ? t('bewerber.header.your_turn_single', { rest: activeCount - myTurnCount })
          : t('bewerber.header.your_turn_plural', { count: myTurnCount, rest: activeCount - myTurnCount });

  const emptyTabKey = filters.listTab ?? 'alle';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div data-tour="candidates.header">
          <h1 className="text-3xl font-bold">{t('bewerber.title')}</h1>
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        </div>

        {/* Reiter: laufende Bewerbungen | Abgelehnt und Beendet (abgesetzt) */}
        <div className="flex flex-wrap items-center gap-1">
          {PIPELINE_TABS.filter((tab) => tab.key !== 'pruefung' || listTabCounts.pruefung > 0 || filters.listTab === 'pruefung').map((tab) => {
            const count = tab.key === null ? activeCount : listTabCounts[tab.key];
            const isActive = filters.listTab === tab.key;
            return (
              <button
                key={tab.key ?? 'alle'}
                onClick={() => updateFilter('listTab', tab.key)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                {t(tab.labelKey)}
                {count > 0 && (
                  <span
                    className={cn(
                      'ml-1.5 px-1.5 py-0.5 rounded-full text-xs',
                      isActive ? 'bg-primary-foreground/20' : 'bg-background'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          <span className="mx-1.5 h-4 w-px bg-border" aria-hidden="true" />

          {CLOSED_TABS.map((tab) => {
            const isActive = filters.listTab === tab.key;
            const count = listTabCounts[tab.key];
            const Icon = tab.key === 'abgelehnt' ? XCircle : Archive;
            return (
              <button
                key={tab.key}
                onClick={() => updateFilter('listTab', tab.key)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1.5',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground/80 hover:bg-muted'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t(tab.labelKey)}
                {count > 0 && (
                  <span className={cn('px-1.5 py-0.5 rounded-full text-xs', isActive ? 'bg-primary-foreground/20' : 'bg-background')}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('bewerber.filter.search')}
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Job Filter */}
          <Select
            value={filters.jobId || 'all'}
            onValueChange={(v) => updateFilter('jobId', v === 'all' ? null : v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t('bewerber.filter.all_jobs')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('bewerber.filter.all_jobs')}</SelectItem>
              {jobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select
            value={filters.sort}
            onValueChange={(v) => updateFilter('sort', v as BewerberSortOption)}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t('bewerber.sort.newest')}</SelectItem>
              <SelectItem value="waiting_time">{t('bewerber.sort.waiting')}</SelectItem>
            </SelectContent>
          </Select>

          {truncated && (
            <span className="text-xs text-muted-foreground ml-auto">
              {t('bewerber.loaded_hint', { loaded: allItems.length, total: totalCount })}
            </span>
          )}
        </div>

        {/* Active View */}
        {items.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            {filters.listTab === 'abgelehnt' || filters.listTab === 'beendet' ? (
              <Archive className="h-12 w-12 text-muted-foreground mb-4" />
            ) : (
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
            )}
            <p className="text-muted-foreground font-medium">
              {filters.search
                ? t('bewerber.empty.search_title', { query: filters.search })
                : t(`bewerber.empty.${emptyTabKey}_title`)}
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md text-center">
              {filters.search
                ? t('bewerber.empty.search_text')
                : t(`bewerber.empty.${emptyTabKey}_text`)}
            </p>
          </div>
        ) : (
          <BewerberInboxView items={items} onRefresh={() => refetch()} />
        )}
      </div>
    </DashboardLayout>
  );
}
