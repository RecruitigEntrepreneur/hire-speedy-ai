import { X } from 'lucide-react';
import { dismissLanguageHint, setLanguage, useLanguageState } from '@/i18n';
import { languageDef } from '@/i18n/languages';
import { cn } from '@/lib/utils';
import { Flag } from './Flag';

/**
 * Einmalige, ruhige Zeile unter der Kopfzeile: Der Link startet in einer
 * anderen Sprache als der Browser. Der Text steht in der Sprache des Browsers.
 */
export function LanguageHint({ className }: { className?: string }) {
  const { suggestion } = useLanguageState();
  if (!suggestion) return null;
  const l = languageDef(suggestion);
  return (
    <div
      lang={l.code}
      role="status"
      data-testid="language-hint"
      className={cn('flex items-center gap-2.5 border-b border-border bg-card px-4 py-2 text-xs text-muted-foreground', className)}
    >
      <Flag code={l.flag} />
      <span>{l.hint.text}</span>
      <button type="button" className="font-medium text-foreground underline underline-offset-4" onClick={() => void setLanguage(l.code)}>
        {l.hint.action}
      </button>
      <button type="button" className="ml-auto rounded p-1 hover:bg-accent" aria-label="×" onClick={dismissLanguageHint}>
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
