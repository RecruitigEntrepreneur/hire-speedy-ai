import { de, enGB, nb, sv, type Locale } from 'date-fns/locale';
import { languageDef } from '@/i18n/languages';

/** date-fns-Locale passend zur Sprache der Oberfläche (für format, formatDistance usw.). */
export function dateFnsLocale(language: string | null | undefined): Locale {
  switch (languageDef(language).base) {
    case 'en': return enGB;
    case 'sv': return sv;
    case 'nb': return nb;
    default: return de;
  }
}
