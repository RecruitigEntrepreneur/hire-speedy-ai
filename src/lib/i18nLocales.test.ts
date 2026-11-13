import { describe, expect, it } from 'vitest';

// Prüft alle Namespaces unter src/i18n/locales/<namespace>/<sprache>.ts:
// jede Sprache hat genau die Schlüssel der deutschen Datei, kein Text ist leer,
// und Platzhalter ({{name}}) sowie Auszeichnungen (<strong>, <1>) stimmen überein.
const files = import.meta.glob<{ default: Record<string, unknown> }>('../i18n/locales/*/*.ts', { eager: true });

type Flat = Record<string, string>;
const flatten = (value: unknown, prefix = '', out: Flat = {}): Flat => {
  if (typeof value === 'string') out[prefix] = value;
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) flatten(child, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
};
const marks = (text: string) => [...text.matchAll(/\{\{\s*([\w.]+)[^}]*\}\}|<\/?(\w+)\s*\/?>/g)].map((m) => m[1] ?? `<${m[2]}>`).sort().join(' ');
// Mehrzahl-Endungen dürfen sich je Sprache unterscheiden; verglichen wird der Stamm.
const stem = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '');

const namespaces = new Map<string, Map<string, Flat>>();
for (const [path, module] of Object.entries(files)) {
  const [, namespace, language] = path.match(/locales\/([^/]+)\/([^/]+)\.ts$/) ?? [];
  if (!namespace) continue;
  if (!namespaces.has(namespace)) namespaces.set(namespace, new Map());
  namespaces.get(namespace)!.set(language, flatten(module.default));
}

describe('Übersetzungsdateien', () => {
  it('findet Namespaces', () => {
    expect(namespaces.size).toBeGreaterThan(0);
  });

  for (const [namespace, languages] of namespaces) {
    const de = languages.get('de');
    it(`${namespace}: hat eine deutsche Quelle und alle vier Sprachen`, () => {
      expect(de, 'de.ts fehlt').toBeTruthy();
      expect([...languages.keys()].sort()).toEqual(['de', 'en', 'nb', 'sv']);
    });
    if (!de) continue;
    const deStems = [...new Set(Object.keys(de).map(stem))].sort();
    for (const [language, messages] of languages) {
      if (language === 'de') continue;
      it(`${namespace}/${language}: gleiche Schlüssel wie Deutsch`, () => {
        expect([...new Set(Object.keys(messages).map(stem))].sort()).toEqual(deStems);
      });
      it(`${namespace}/${language}: keine leeren Texte, gleiche Platzhalter`, () => {
        const problems: string[] = [];
        for (const [key, text] of Object.entries(messages)) {
          const source = de[key] ?? de[`${stem(key)}_other`] ?? de[stem(key)];
          if (!text.trim() && source?.trim()) problems.push(`${key}: leer`);
          if (source !== undefined && marks(source) !== marks(text)) problems.push(`${key}: „${marks(source)}“ ≠ „${marks(text)}“`);
        }
        expect(problems).toEqual([]);
      });
    }
  }
});
