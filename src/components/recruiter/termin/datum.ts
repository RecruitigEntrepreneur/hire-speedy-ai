import { de, enGB, nb, sv } from 'date-fns/locale';
import { languageDef } from '@/i18n/languages';

/** date-fns-Locale passend zur Sprache der Oberfläche (de-AT und de-CH lesen de). */
export function dateFnsLocale(code: string | null | undefined) {
  switch (languageDef(code).base) {
    case 'en': return enGB;
    case 'sv': return sv;
    case 'nb': return nb;
    default: return de;
  }
}
