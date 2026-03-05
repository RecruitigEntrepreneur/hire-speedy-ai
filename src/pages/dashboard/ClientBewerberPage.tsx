import { useState, useEffect } from 'react';
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
import { BewerberGridView } from '@/components/candidates/BewerberGridView';
import { BewerberListView } from '@/components/candidates/BewerberListView';
import { useBewerber, type BewerberFilters, type BewerberSortOption } from '@/hooks/useBewerber';
import { usePageViewTracking } from '@/hooks/useEventTracking';
import {
  Search,
  Inbox,
  LayoutGrid,
  List,
  RefreshCw,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'inbox' | 'grid' | 'list';

const VIEW_STORAGE_KEY = 'bewerber-view-preference';

const STAGE_TABS = [
  { key: null, label: 'Alle' },
  { key: 'submitted', label: 'Neu' },
  { key: 'screening', label: 'Screening' },
  { key: 'interview_1', label: 'Interview 1' },
  { key: 'interview_2', label: 'Interview 2' },
  { key: 'offer', label: 'Angebot' },
] as const;

function getStoredView(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === 'inbox' || stored === 'grid' || stored === 'list') return stored;
  } catch {}
  return 'inbox';
}

export default function ClientBewerberPage() {
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredView);
  const [filters, setFilters] = useState<BewerberFilters>({
    stage: null,
    jobId: null,
    search: '',
    sort: 'newest',
  });

  usePageViewTracking('client_bewerber');

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch {}
  }, [viewMode]);

  const { items, stageCounts, totalCount, jobs, isLoading, error, refetch } = useBewerber(filters);

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
          <p className="text-muted-foreground mb-4">Fehler beim Laden der Bewerber</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Erneut versuchen
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Bewerber</h1>
          <p className="text-muted-foreground text-sm">
            {totalCount} {totalCount === 1 ? 'aktiver Bewerber' : 'aktive Bewerber'} in der Pipeline
          </p>
        </div>

        {/* Stage Tabs */}
        <div className="flex flex-wrap gap-1">
          {STAGE_TABS.map((tab) => {
            const count = tab.key ? (stageCounts[tab.key] || 0) : totalCount;
            const isActive = filters.stage === tab.key;
            return (
              <button
                key={tab.key ?? 'all'}
                onClick={() => updateFilter('stage', tab.key)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className={cn(
                    'ml-1.5 px-1.5 py-0.5 rounded-full text-xs',
                    isActive ? 'bg-primary-foreground/20' : 'bg-background'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filters + View Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
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
              <SelectValue placeholder="Alle Jobs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Jobs</SelectItem>
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
              <SelectItem value="newest">Neueste zuerst</SelectItem>
              <SelectItem value="match_score">Bester Match</SelectItem>
              <SelectItem value="waiting_time">Längste Wartezeit</SelectItem>
            </SelectContent>
          </Select>

          {/* Spacer */}
          <div className="flex-1" />

          {/* View Switcher */}
          <div className="flex items-center border rounded-md">
            <button
              onClick={() => setViewMode('inbox')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'inbox' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
              title="Inbox-Ansicht"
            >
              <Inbox className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 transition-colors border-x',
                viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
              title="Grid-Ansicht"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 transition-colors',
                viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
              title="Listen-Ansicht"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Active View */}
        {items.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground font-medium">Keine Bewerber gefunden</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filters.search || filters.stage || filters.jobId
                ? 'Versuchen Sie andere Filter oder Suchbegriffe.'
                : 'Sobald Recruiter Kandidaten einreichen, erscheinen sie hier.'}
            </p>
          </div>
        ) : (
          <>
            {viewMode === 'inbox' && <BewerberInboxView items={items} />}
            {viewMode === 'grid' && <BewerberGridView items={items} />}
            {viewMode === 'list' && <BewerberListView items={items} />}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
