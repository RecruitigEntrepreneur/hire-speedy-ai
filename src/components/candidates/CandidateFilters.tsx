import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Search,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  Tag,
} from 'lucide-react';
import { CandidateTag } from '@/hooks/useCandidateTags';

export interface FilterState {
  search: string;
  experienceMin: number;
  experienceMax: number;
  salaryMin: number;
  salaryMax: number;
  availability: string;
  selectedTags: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  /** Stelle: vorgestellt dort oder passt laut Abgleich (24.11.2026); 'all' = alle. */
  jobId: string;
  /** Nur Kandidaten ohne Lebenslauf (war bis 25.11.2026 ein eigener Reiter) */
  nurOhneCv?: boolean;
}

/** Obergrenze des Gehalts-Schiebers; gleich dem Standardwert der Seite. */
export const FILTER_GEHALT_MAX = 500000;

interface CandidateFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  tags: CandidateTag[];
  allSkills: string[];
  /** Auswahl für den Filter „Stelle“ */
  stellen?: { id: string; title: string }[];
}

export function CandidateFilters({
  filters,
  onFilterChange,
  tags,
  stellen = [],
}: CandidateFiltersProps) {
  const { t, i18n } = useTranslation('candidates');
  const geld = (n: number) => Math.round(n).toLocaleString(i18n.language === 'en' ? 'en-GB' : i18n.language || 'de');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      ...filters,
      experienceMin: 0,
      experienceMax: 30,
      salaryMin: 0,
      salaryMax: FILTER_GEHALT_MAX,
      availability: 'all',
      selectedTags: [],
      jobId: 'all',
      nurOhneCv: false,
    });
  };

  // Zahl am Knopf statt „!“ (24.11.2026); die Suche zählt nicht, die steht sichtbar im Feld
  const aktiveFilter =
    (filters.experienceMin > 0 || filters.experienceMax < 30 ? 1 : 0) +
    (filters.salaryMin > 0 || filters.salaryMax < FILTER_GEHALT_MAX ? 1 : 0) +
    (filters.availability !== 'all' ? 1 : 0) +
    (filters.jobId !== 'all' ? 1 : 0) +
    (filters.nurOhneCv ? 1 : 0) +
    filters.selectedTags.length;
  const hasActiveFilters = aktiveFilter > 0;
  const stelleTitel = stellen.find((x) => x.id === filters.jobId)?.title;

  const toggleTag = (tagId: string) => {
    const newTags = filters.selectedTags.includes(tagId)
      ? filters.selectedTags.filter((t) => t !== tagId)
      : [...filters.selectedTags, tagId];
    updateFilter('selectedTags', newTags);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('filters.searchPlaceholder')}
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="rounded-full pl-10"
          />
        </div>

        {/* Sort */}
        <Select
          value={`${filters.sortBy}-${filters.sortOrder}`}
          onValueChange={(v) => {
            // Beide Werte auf einmal setzen; zweimal updateFilter überschrieb vorher die Sortierung (24.11.2026)
            const [sortBy, sortOrder] = v.split('-');
            onFilterChange({ ...filters, sortBy, sortOrder: sortOrder as 'asc' | 'desc' });
          }}
        >
          <SelectTrigger className="w-auto min-w-[9rem] gap-2 rounded-full">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder={t('filters.sort')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at-desc">{t('filters.newestFirst')}</SelectItem>
            <SelectItem value="created_at-asc">{t('filters.oldestFirst')}</SelectItem>
            <SelectItem value="full_name-asc">{t('filters.nameAsc')}</SelectItem>
            <SelectItem value="full_name-desc">{t('filters.nameDesc')}</SelectItem>
            <SelectItem value="experience_years-desc">{t('filters.experienceDesc')}</SelectItem>
            <SelectItem value="experience_years-asc">{t('filters.experienceAsc')}</SelectItem>
            <SelectItem value="expected_salary-desc">{t('filters.salaryDesc')}</SelectItem>
            <SelectItem value="expected_salary-asc">{t('filters.salaryAsc')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Advanced Filters Toggle */}
        <Popover open={showAdvanced} onOpenChange={setShowAdvanced}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              {t('filters.filter')}
              {hasActiveFilters && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-medium tabular-nums text-background">
                  {aktiveFilter}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 rounded-xl" align="end">
            <div className="space-y-4">
              <h4 className="text-[15px] font-semibold tracking-tight">{t('filters.advanced')}</h4>

              {/* Stelle: vorgestellt dort oder passt laut Abgleich */}
              {stellen.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('filters.job')}</label>
                  <Select value={filters.jobId} onValueChange={(v) => updateFilter('jobId', v)}>
                    <SelectTrigger className="rounded-lg"><SelectValue placeholder={t('filters.allJobs')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('filters.allJobs')}</SelectItem>
                      {stellen.map((x) => <SelectItem key={x.id} value={x.id}>{x.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Experience Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t('filters.experienceRange', { min: filters.experienceMin, max: filters.experienceMax })}
                </label>
                <Slider
                  value={[filters.experienceMin, filters.experienceMax]}
                  onValueChange={([min, max]) => onFilterChange({ ...filters, experienceMin: min, experienceMax: max })}
                  min={0}
                  max={30}
                  step={1}
                />
              </div>

              {/* Salary Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t('filters.salaryRange', { min: geld(filters.salaryMin), max: geld(filters.salaryMax) })}
                </label>
                <Slider
                  value={[filters.salaryMin, filters.salaryMax]}
                  onValueChange={([min, max]) => onFilterChange({ ...filters, salaryMin: min, salaryMax: max })}
                  min={0}
                  max={FILTER_GEHALT_MAX}
                  step={5000}
                />
              </div>

              {/* Availability */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('filters.availability')}</label>
                <Select
                  value={filters.availability}
                  onValueChange={(v) => updateFilter('availability', v)}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder={t('filters.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filters.all')}</SelectItem>
                    <SelectItem value="immediate">{t('filters.immediate')}</SelectItem>
                    <SelectItem value="30days">{t('filters.within30')}</SelectItem>
                    <SelectItem value="90days">{t('filters.within90')}</SelectItem>
                    <SelectItem value="later">{t('filters.later')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={!!filters.nurOhneCv} onCheckedChange={(v) => updateFilter('nurOhneCv', v === true)} />
                {t('filters.onlyNoCv')}
              </label>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('actions.tags')}</label>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant={filters.selectedTags.includes(tag.id) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        style={{
                          backgroundColor: filters.selectedTags.includes(tag.id) ? tag.color : undefined,
                          borderColor: tag.color,
                        }}
                        onClick={() => toggleTag(tag.id)}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="text-sm font-medium text-klick hover:underline">
                  {t('filters.reset')} ›
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('filters.active')}</span>
          {filters.jobId !== 'all' && (
            <Badge variant="secondary" className="gap-1 rounded-full font-normal">
              {stelleTitel ?? t('filters.job')}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('jobId', 'all')} />
            </Badge>
          )}
          {(filters.experienceMin > 0 || filters.experienceMax < 30) && (
            <Badge variant="secondary" className="gap-1 rounded-full font-normal">
              {t('filters.yearsBadge', { min: filters.experienceMin, max: filters.experienceMax })}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFilterChange({ ...filters, experienceMin: 0, experienceMax: 30 })}
              />
            </Badge>
          )}
          {(filters.salaryMin > 0 || filters.salaryMax < FILTER_GEHALT_MAX) && (
            <Badge variant="secondary" className="gap-1 rounded-full font-normal">
              {geld(filters.salaryMin)}–{geld(filters.salaryMax)} €
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onFilterChange({ ...filters, salaryMin: 0, salaryMax: FILTER_GEHALT_MAX })}
              />
            </Badge>
          )}
          {filters.availability !== 'all' && (
            <Badge variant="secondary" className="gap-1 rounded-full font-normal">
              {filters.availability === 'immediate'
                ? t('filters.immediate')
                : filters.availability === '30days'
                ? t('filters.days30')
                : filters.availability === '90days'
                ? t('filters.days90')
                : t('filters.later')}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('availability', 'all')} />
            </Badge>
          )}
          {filters.selectedTags.map((tagId) => {
            const tag = tags.find((t) => t.id === tagId);
            return tag ? (
              <Badge
                key={tagId}
                variant="secondary"
                className="gap-1"
                style={{ backgroundColor: tag.color + '30', borderColor: tag.color }}
              >
                {tag.name}
                <X className="h-3 w-3 cursor-pointer" onClick={() => toggleTag(tagId)} />
              </Badge>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
