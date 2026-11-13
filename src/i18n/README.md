# Sprachen der Plattform

- `languages.ts`: Liste der Sprachen (Fahne, Name, Status), Vorauswahl-Regel, Schweizer Schreibweise.
- `index.ts`: i18next, `setLanguage`, `applyLinkLanguage`, `applyProfileLanguage`, `useLanguageState`.
- `locales/de.ts`, `locales/en.ts`: Namespace `translation` (Website und ältere Seiten).
- `locales/<namespace>/<sprache>.ts`: Namespaces der Plattform, je Sprache eine Datei
  (`de`, `en`, `sv`, `nb`). Sie werden erst geladen, wenn eine Seite sie braucht.
  `de-AT` und `de-CH` lesen `de`; für die Schweiz wird „ß“ automatisch zu „ss“.

## Regeln

1. Deutsch ist die Quelle. `de.ts` exportiert ein einfaches Objekt, die anderen
   Dateien sind als `Messages<typeof de>` typisiert. Fehlt ein Schlüssel, schlägt der Typecheck an.
2. Im Code: `const { t } = useTranslation('<namespace>')`, Platzhalter als `{{name}}`,
   Text mit Auszeichnung über `<Trans>`.
3. Anrede: Kunden auf Deutsch „Sie“, Headhunter „du“. Englisch „you“. Schwedisch und Norwegisch „du“.
4. Datum, Zahl, Währung über `intlLocale(i18n.language)` aus `languages.ts`.
6. Übersetzt wird nur, was ein Mensch auf dem Bildschirm liest. Werte, die in der
   Datenbank landen, an eine Function gehen oder verglichen werden (Status, Schlüssel,
   Auswahlwerte, auch wenn sie deutsch sind), bleiben unverändert; nur ihre Anzeige wird übersetzt.
   Was Nutzer selbst eingegeben haben, wird nie übersetzt.
7. Logikmodule ohne React (`src/lib`, Hooks): kein Text als Konstante auf Modulebene,
   weil er sonst beim Laden einmal in einer Sprache einfriert. Stattdessen Funktion, die
   beim Aufruf `i18n.t('<namespace>:<schlüssel>')` liest, oder nur den Schlüssel
   speichern und in der Komponente übersetzen. Die Komponente, die das Modul nutzt, lädt den
   Namespace über `useTranslation([...])`. In Vitest ist die Sprache Deutsch und alles
   vorab geladen (`testSetup.ts`), bestehende Tests müssen unverändert grün bleiben.
8. Mehrzahl über `_one` / `_other`. Keine zusammengesetzten Sätze aus Bruchstücken.
9. Schwedisch und Norwegisch (Bokmål) in natürlicher Geschäftssprache der Personalbranche,
   keine Wort-für-Wort-Übersetzung. Eigennamen bleiben: Matchunt, Triple-Blind.
5. Eine Sprache mit `status: 'draft'` ist nur lokal sichtbar, bis ein Muttersprachler gegengelesen hat.
