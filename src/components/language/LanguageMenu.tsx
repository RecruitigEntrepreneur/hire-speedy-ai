import { Check, ChevronDown } from 'lucide-react';
import { availableLanguages, setLanguage, useLanguageState } from '@/i18n';
import { languageDef } from '@/i18n/languages';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Flag } from './Flag';

/**
 * Sprachmenü der Plattform: Fahne und Name in der eigenen Sprache.
 * In der Kopfzeile der Funnels und Anmeldeseiten; am Handy nur die Fahne.
 */
export function LanguageMenu({ className, compact }: { className?: string; compact?: boolean }) {
  const { language } = useLanguageState();
  const current = languageDef(language);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${current.label} – Sprache wählen / Choose language`}
        data-testid="language-menu"
        className={cn(
          'inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-border bg-transparent px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <Flag code={current.flag} />
        <span className={cn(compact ? 'sr-only' : 'hidden sm:inline')}>{current.label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[13rem]">
        <LanguageItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Die Einträge allein, z. B. für das Untermenü im Konto-Menü. */
export function LanguageItems() {
  const { language } = useLanguageState();
  return (
    <>
      {availableLanguages().map((l) => (
        <DropdownMenuItem
          key={l.code}
          lang={l.code}
          data-testid={`language-${l.code}`}
          className="cursor-pointer gap-2.5"
          onSelect={() => void setLanguage(l.code)}
        >
          <Flag code={l.flag} />
          <span className="flex-1">{l.label}</span>
          {l.code === language && <Check className="h-4 w-4" aria-hidden="true" />}
        </DropdownMenuItem>
      ))}
    </>
  );
}
