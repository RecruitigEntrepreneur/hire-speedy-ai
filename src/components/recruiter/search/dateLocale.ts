import { de, enGB, nb, sv } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { languageDef } from '@/i18n/languages';

/** date-fns-Locale passend zur Sprache der Oberfläche (de, de-AT, de-CH lesen de). */
export function dateFnsLocale(language: string | null | undefined): Locale {
  switch (languageDef(language).base) {
    case 'en': return enGB;
    case 'sv': return sv;
    case 'nb': return nb;
    default: return de;
  }
}
