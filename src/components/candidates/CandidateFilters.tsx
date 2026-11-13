import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
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
}

interface CandidateFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  tags: CandidateTag[];
  allSkills: string[];
}

export function CandidateFilters({
  filters,
  onFilterChange,
  tags,
}: CandidateFiltersProps) {
  const { t } = useTranslation('candidates');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      search: '',
      experienceMin: 0,
      experienceMax: 30,
      salaryMin: 0,
      salaryMax: 200000,
      availability: 'all',
      selectedTags: [],
      sortBy: 'created_at',
      sortOrder: 'desc',
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.experienceMin > 0 ||
    filters.experienceMax < 30 ||
    filters.salaryMin > 0 ||
    filters.salaryMax < 200000 ||
    filters.availability !== 'all' ||
    filters.selectedTags.length > 0;

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
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('filters.searchPlaceholder')}
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Sort */}
        <Select
          value={`${filters.sortBy}-${filters.sortOrder}`}
          onValueChange={(v) => {
            const [sortBy, sortOrder] = v.split('-');
            updateFilter('sortBy', sortBy);
            updateFilter('sortOrder', sortOrder as 'asc' | 'desc');
          }}
        >
          <SelectTrigger className="w-[180px]">
            <ArrowUpDown className="h-4 w-4 mr-2" />
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
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                  !
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <h4 className="font-medium">{t('filters.advanced')}</h4>

              {/* Experience Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t('filters.experienceRange', { min: filters.experienceMin, max: filters.experienceMax })}
                </label>
                <Slider
                  value={[filters.experienceMin, filters.experienceMax]}
                  onValueChange={([min, max]) => {
                    updateFilter('experienceMin', min);
                    updateFilter('experienceMax', max);
                  }}
                  min={0}
                  max={30}
                  step={1}
                />
              </div>

              {/* Salary Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t('filters.salaryRange', { min: (filters.salaryMin / 1000).toFixed(0), max: (filters.salaryMax / 1000).toFixed(0) })}
                </label>
                <Slider
                  value={[filters.salaryMin, filters.salaryMax]}
                  onValueChange={([min, max]) => {
                    updateFilter('salaryMin', min);
                    updateFilter('salaryMax', max);
                  }}
                  min={0}
                  max={200000}
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
                  <SelectTrigger>
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

              {/* Tags */}
              {tags.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Tags
                  </label>
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
                <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
                  <X className="h-4 w-4 mr-2" />
                  {t('filters.reset')}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('filters.active')}</span>
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              {t('filters.searchBadge', { term: filters.search })}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('search', '')} />
            </Badge>
          )}
          {(filters.experienceMin > 0 || filters.experienceMax < 30) && (
            <Badge variant="secondary" className="gap-1">
              {t('filters.yearsBadge', { min: filters.experienceMin, max: filters.experienceMax })}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => {
                  updateFilter('experienceMin', 0);
                  updateFilter('experienceMax', 30);
                }}
              />
            </Badge>
          )}
          {(filters.salaryMin > 0 || filters.salaryMax < 200000) && (
            <Badge variant="secondary" className="gap-1">
              {(filters.salaryMin / 1000).toFixed(0)}k-{(filters.salaryMax / 1000).toFixed(0)}k €
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => {
                  updateFilter('salaryMin', 0);
                  updateFilter('salaryMax', 200000);
                }}
              />
            </Badge>
          )}
          {filters.availability !== 'all' && (
            <Badge variant="secondary" className="gap-1">
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
