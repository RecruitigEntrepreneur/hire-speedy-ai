import { availableLanguages } from '@/i18n';
import { languageDef, type LanguageCode } from '@/i18n/languages';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Flag } from './Flag';

const AUTO = 'auto';

/**
 * Sprachauswahl für den Admin: legt fest, in welcher Sprache eine Einladung
 * oder ein Link startet. Ändert nicht die Sprache der eigenen Oberfläche.
 */
export function LanguagePicker({ value, onChange, allowAuto, id, className }: {
  value: LanguageCode | null;
  onChange: (value: LanguageCode | null) => void;
  /** „Automatisch“: der Browser des Besuchers entscheidet. */
  allowAuto?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <Select value={value ?? AUTO} onValueChange={(next) => onChange(next === AUTO ? null : (next as LanguageCode))}>
      <SelectTrigger id={id} className={className}><SelectValue /></SelectTrigger>
      <SelectContent>
        {allowAuto && <SelectItem value={AUTO}>Automatisch (Browser des Besuchers)</SelectItem>}
        {availableLanguages().map((l) => (
          <SelectItem key={l.code} value={l.code}>
            <span className="flex items-center gap-2.5"><Flag code={l.flag} />{l.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Fahne und Name einer gespeicherten Sprache, z. B. in Listen. */
export function LanguageTag({ code, className }: { code: string | null | undefined; className?: string }) {
  if (!code) return null;
  const l = languageDef(code);
  return <span className={className ?? 'inline-flex items-center gap-1.5'}><Flag code={l.flag} />{l.label}</span>;
}
