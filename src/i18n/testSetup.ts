// Für Vitest: Tests der Logikmodule lesen deutsche Texte. Alle Namespaces werden
// vorab geladen, damit i18n.t() ohne React sofort den Text liefert.
import i18n from './index';

const files = import.meta.glob('./locales/*/de.ts');
const namespaces = Object.keys(files)
  .map((path) => path.match(/locales\/([^/]+)\/de\.ts$/)?.[1])
  .filter((name): name is string => !!name);

await i18n.changeLanguage('de');
await i18n.loadNamespaces(namespaces);
