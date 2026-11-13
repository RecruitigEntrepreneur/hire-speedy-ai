import { availableLanguages, setLanguage, useLanguageState } from '@/i18n';
import { isLanguageCode } from '@/i18n/languages';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Flag } from './Flag';

/** Auswahlfeld für die Einstellungen: dieselben Einträge wie im Sprachmenü. */
export function LanguageSelect({ id, className }: { id?: string; className?: string }) {
  const { language } = useLanguageState();
  return (
    <Select value={language} onValueChange={(value) => { if (isLanguageCode(value)) void setLanguage(value); }}>
      <SelectTrigger id={id} className={className} data-testid="language-select"><SelectValue /></SelectTrigger>
      <SelectContent>
        {availableLanguages().map((l) => (
          <SelectItem key={l.code} value={l.code} lang={l.code}>
            <span className="flex items-center gap-2.5"><Flag code={l.flag} />{l.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
