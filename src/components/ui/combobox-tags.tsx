import { useState, useRef, useCallback, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AsyncSuggestion {
  label: string;
  category?: string | null;
}

interface ComboboxTagsProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  suggestions?: string[];
  /** Async search callback — when provided, triggers on input change and overrides static suggestions */
  onSearch?: (query: string, excludeTags: string[]) => void;
  /** Results from async search (from onSearch). Each has label + optional category. */
  asyncResults?: AsyncSuggestion[];
  asyncLoading?: boolean;
  placeholder?: string;
  maxSuggestions?: number;
  className?: string;
}

export function ComboboxTags({
  tags,
  onAdd,
  onRemove,
  suggestions = [],
  onSearch,
  asyncResults,
  asyncLoading,
  placeholder = 'Eingeben oder auswählen...',
  maxSuggestions = 8,
  className,
}: ComboboxTagsProps) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Use async results if onSearch is provided, otherwise filter static suggestions
  const filtered = onSearch && asyncResults
    ? asyncResults.filter(s => !tags.includes(s.label)).slice(0, maxSuggestions)
    : input.trim()
      ? suggestions
          .filter(s => !tags.includes(s) && s.toLowerCase().includes(input.toLowerCase()))
          .slice(0, maxSuggestions)
          .map(s => ({ label: s } as AsyncSuggestion))
      : [];

  const showDropdown = open && (filtered.length > 0 || asyncLoading);

  const addTag = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
    }
    setInput('');
    setHighlightIndex(0);
    inputRef.current?.focus();
  }, [tags, onAdd]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showDropdown && filtered[highlightIndex]) {
        addTag(filtered[highlightIndex].label);
      } else if (input.trim()) {
        addTag(input);
      }
    } else if (e.key === 'ArrowDown' && showDropdown) {
      e.preventDefault();
      setHighlightIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp' && showDropdown) {
      e.preventDefault();
      setHighlightIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onRemove(tags[tags.length - 1]);
    }
  };

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [input]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && showDropdown) {
      const items = listRef.current.querySelectorAll('[data-item]');
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex, showDropdown]);

  return (
    <div className={cn('relative', className)}>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button onClick={() => onRemove(tag)} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => {
          const val = e.target.value;
          setInput(val);
          setOpen(true);
          if (onSearch) onSearch(val, tags);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay to allow click on suggestion
          setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      />
      {showDropdown && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 max-h-48 overflow-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {asyncLoading && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Suche...</div>
          )}
          {filtered.map((item, i) => (
            <div
              key={item.label}
              data-item
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(item.label);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
              className={cn(
                'relative flex cursor-pointer select-none items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
                i === highlightIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )}
            >
              <span>{item.label}</span>
              {item.category && (
                <span className="text-[10px] text-muted-foreground ml-2">{item.category}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single Combobox (for location, industry, etc.) ──────────────

interface ComboboxSingleProps {
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
  placeholder?: string;
  maxSuggestions?: number;
  className?: string;
}

export function ComboboxSingle({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Eingeben oder auswählen...',
  maxSuggestions = 8,
  className,
}: ComboboxSingleProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = value.trim()
    ? suggestions
        .filter(s => s.toLowerCase().includes(value.toLowerCase()))
        .slice(0, maxSuggestions)
    : [];

  const showDropdown = open && filtered.length > 0 && filtered[0]?.toLowerCase() !== value.toLowerCase();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && showDropdown && filtered[highlightIndex]) {
      e.preventDefault();
      onChange(filtered[highlightIndex]);
      setOpen(false);
    } else if (e.key === 'ArrowDown' && showDropdown) {
      e.preventDefault();
      setHighlightIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp' && showDropdown) {
      e.preventDefault();
      setHighlightIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  useEffect(() => {
    setHighlightIndex(0);
  }, [value]);

  return (
    <div className={cn('relative', className)}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      />
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 max-h-48 overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {filtered.map((item, i) => (
            <div
              key={item}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(item);
                setOpen(false);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
              className={cn(
                'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
                i === highlightIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )}
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
