import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BENEFITS_CATEGORIZED,
  BENEFIT_PRESETS,
  type BenefitCategory,
} from '@/lib/wizard-options';
import { Check, Plus, Search, Sparkles, X, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BenefitsBuilderProps {
  selected: string[];
  onAdd: (benefit: string) => void;
  onRemove: (benefit: string) => void;
  onBulkAdd: (benefits: string[]) => void;
}

export function BenefitsBuilder({ selected, onAdd, onRemove, onBulkAdd }: BenefitsBuilderProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showPresets, setShowPresets] = useState(selected.length === 0);

  const isSelected = (b: string) => selected.includes(b);

  const toggle = (b: string) => {
    if (isSelected(b)) onRemove(b);
    else onAdd(b);
  };

  const applyPreset = (benefits: string[]) => {
    const newBenefits = benefits.filter(b => !selected.includes(b));
    if (newBenefits.length > 0) onBulkAdd(newBenefits);
    setShowPresets(false);
  };

  // Filter across all categories when searching
  const searchResults: { benefit: string; category: BenefitCategory }[] = [];
  if (search.trim()) {
    const q = search.toLowerCase();
    for (const cat of BENEFITS_CATEGORIZED) {
      for (const item of cat.items) {
        if (item.toLowerCase().includes(q) && !searchResults.some(r => r.benefit === item)) {
          searchResults.push({ benefit: item, category: cat });
        }
      }
    }
  }

  const activeCat = BENEFITS_CATEGORIZED.find(c => c.id === activeCategory);

  return (
    <div className="space-y-4">
      {/* Selected Benefits */}
      {selected.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Ausgewählt ({selected.length})
            </span>
            {selected.length >= 3 && (
              <span className="text-xs text-emerald-500 flex items-center gap-1">
                <Check className="h-3 w-3" />
                Gutes Angebot!
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selected.map(b => (
              <Badge
                key={b}
                variant="default"
                className="pl-2.5 pr-1 py-1 gap-1 text-xs cursor-pointer hover:bg-primary/80 transition-colors"
                onClick={() => onRemove(b)}
              >
                {b}
                <X className="h-3 w-3 ml-0.5 opacity-60" />
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Quick Presets */}
      {showPresets && selected.length === 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Schnellstart — Paket wählen
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {BENEFIT_PRESETS.map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.benefits)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all',
                  'hover:border-primary/50 hover:bg-primary/5',
                  'text-sm'
                )}
              >
                <span className="text-lg">{preset.icon}</span>
                <div className="min-w-0">
                  <div className="font-medium text-sm">{preset.label}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {preset.benefits.length} Benefits
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Show preset button when already has items */}
      {selected.length > 0 && !showPresets && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground h-7"
          onClick={() => setShowPresets(true)}
        >
          <Sparkles className="h-3 w-3 mr-1" />
          Paket hinzufügen
        </Button>
      )}

      {/* Preset cards when toggled on and already has items */}
      {selected.length > 0 && showPresets && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Paket hinzufügen
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground"
              onClick={() => setShowPresets(false)}
            >
              Schließen
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {BENEFIT_PRESETS.map(preset => {
              const newCount = preset.benefits.filter(b => !selected.includes(b)).length;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.benefits)}
                  disabled={newCount === 0}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all',
                    newCount > 0
                      ? 'hover:border-primary/50 hover:bg-primary/5'
                      : 'opacity-40 cursor-not-allowed',
                    'text-sm'
                  )}
                >
                  <span className="text-lg">{preset.icon}</span>
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{preset.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {newCount > 0 ? `+${newCount} neue Benefits` : 'Bereits enthalten'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Benefits durchsuchen..."
          className="pl-8 h-8 text-sm"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Search Results */}
      {search.trim() && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">
            {searchResults.length} Ergebnis{searchResults.length !== 1 ? 'se' : ''}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {searchResults.map(({ benefit, category }) => (
              <button
                key={benefit}
                type="button"
                onClick={() => toggle(benefit)}
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs transition-all',
                  isSelected(benefit)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'hover:border-primary/50 hover:bg-primary/5'
                )}
              >
                {isSelected(benefit) ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                {benefit}
                <span className="text-[10px] opacity-60">{category.icon}</span>
              </button>
            ))}
            {searchResults.length === 0 && (
              <button
                type="button"
                onClick={() => { onAdd(search.trim()); setSearch(''); }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed text-xs hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <Plus className="h-3 w-3" />
                „{search.trim()}" hinzufügen
              </button>
            )}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      {!search.trim() && (
        <div className="space-y-3">
          <ScrollArea className="w-full">
            <div className="flex gap-1.5 pb-1">
              {BENEFITS_CATEGORIZED.map(cat => {
                const count = cat.items.filter(i => isSelected(i)).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs whitespace-nowrap transition-all shrink-0',
                      activeCategory === cat.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : count > 0
                        ? 'border-primary/40 bg-primary/5 text-primary'
                        : 'hover:border-primary/30 hover:bg-muted/50'
                    )}
                  >
                    <span>{cat.icon}</span>
                    {cat.label}
                    {count > 0 && (
                      <span className={cn(
                        'inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-medium',
                        activeCategory === cat.id
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-primary/20 text-primary'
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          {/* Category Items */}
          {activeCat && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {activeCat.icon} {activeCat.label}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const unselected = activeCat.items.filter(i => !isSelected(i));
                    if (unselected.length > 0) onBulkAdd(unselected);
                  }}
                  className="text-[11px] text-primary hover:underline"
                >
                  Alle auswählen
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeCat.items.map(benefit => (
                  <button
                    key={benefit}
                    type="button"
                    onClick={() => toggle(benefit)}
                    className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-xs transition-all',
                      isSelected(benefit)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:border-primary/50 hover:bg-primary/5'
                    )}
                  >
                    {isSelected(benefit) ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {benefit}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Collapsed hint when no category active */}
          {!activeCat && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Kategorie oben auswählen oder direkt suchen
            </p>
          )}
        </div>
      )}
    </div>
  );
}
