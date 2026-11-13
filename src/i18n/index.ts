import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { useSyncExternalStore } from "react";
import de from "./locales/de";
import en from "./locales/en";
import {
  LANGUAGE_CODES, languageDef, matchLanguage, pickLanguage, swissSpelling, visibleLanguages,
  type LanguageCode, type LanguageDef, type LanguagePick,
} from "./languages";

// Schalter DE/EN der Website (Navbar). Die Plattform nutzt das Sprachmenü mit allen Sprachen.
export const SUPPORTED_LANGUAGES = ["de", "en"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = "matchunt-lang";
const DRAFT_KEY = "matchunt-lang-drafts";
const HINT_KEY = "matchunt-lang-hint-closed";

const read = (key: string, session = false): string | null => {
  try { return (session ? sessionStorage : localStorage).getItem(key); } catch { return null; }
};
const write = (key: string, value: string, session = false) => {
  try { (session ? sessionStorage : localStorage).setItem(key, value); } catch { /* privates Fenster */ }
};

/** Entwurfs-Sprachen (noch nicht gegengelesen) sind lokal sichtbar oder per Freischaltung. */
export function draftsVisible(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_LANGUAGE_DRAFTS === "1" || read(DRAFT_KEY) === "1";
}

export function availableLanguages(): LanguageDef[] {
  return visibleLanguages(draftsVisible());
}

const queryLanguage = (): string | null => {
  if (typeof window === "undefined") return null;
  try { return new URLSearchParams(window.location.search).get("lang"); } catch { return null; }
};
const browserLanguages = (): readonly string[] =>
  typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];

let linkLanguage: string | null = queryLanguage();
let state: LanguagePick = pickLanguage({
  stored: read(STORAGE_KEY), link: linkLanguage, browser: browserLanguages(), showDrafts: draftsVisible(),
});
if (read(HINT_KEY, true) === "1") state = { ...state, suggestion: null };

const listeners = new Set<() => void>();
const publish = (next: LanguagePick) => {
  state = next;
  listeners.forEach((fn) => fn());
};

// Namespaces der Plattform liegen je Sprache in einer eigenen Datei und werden
// erst geladen, wenn eine Seite sie braucht: ./locales/<namespace>/<sprache>.ts
const files = import.meta.glob<{ default: Record<string, unknown> }>("./locales/*/*.ts");

i18n
  .use({
    type: "backend" as const,
    read(language: string, namespace: string, done: (error: unknown, data?: Record<string, unknown>) => void) {
      const load = files[`./locales/${namespace}/${language}.ts`];
      if (!load) return done(null, {});
      load().then((module) => done(null, module.default), (error) => done(error));
    },
  })
  .use({
    type: "postProcessor" as const,
    name: "swiss",
    process(value: string, _key: unknown, _options: unknown, translator: { language?: string }) {
      return translator?.language === "de-CH" && typeof value === "string" ? swissSpelling(value) : value;
    },
  })
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
    partialBundledLanguages: true,
    lng: state.language,
    supportedLngs: LANGUAGE_CODES,
    load: "currentOnly",
    // Österreich und Schweiz lesen die deutschen Texte; alles andere fällt auf Englisch, dann Deutsch.
    fallbackLng: (code?: string) => (languageDef(code).base === "de" ? ["de"] : ["en", "de"]),
    postProcess: ["swiss"],
    interpolation: { escapeValue: false },
    // Kein Suspense: Fehlt ein Namespace (noch nicht geladen oder Datei fehlt), zeigt die Seite
    // kurz die deutschen Texte bzw. Rückfälle statt die ganze App anzuhalten. Ein Anhalten
    // bei offenem Fenster ließ React abstürzen (leere Seite).
    react: { useSuspense: false },
    returnNull: false,
  });

// Alle Texte der aktiven Sprache sind geladen, bevor die App startet (main.tsx wartet
// auf i18nReady). Würde ein Fenster seinen Namespace erst beim Öffnen holen, wartete
// die ganze Seite (leerer Bildschirm). Bei einem Sprachwechsel lädt i18next alle
// bekannten Namespaces der neuen Sprache, bevor es umschaltet.
const allNamespaces = [...new Set(
  Object.keys(files).map((path) => path.match(/locales\/([^/]+)\//)?.[1]).filter((name): name is string => !!name),
)];
export const i18nReady: Promise<void> = i18n.loadNamespaces(allNamespaces).then(() => undefined, () => undefined);

// keep <html lang> in sync with the active language for SEO / a11y
const syncHtmlLang = (lng: string) => {
  if (typeof document !== "undefined") document.documentElement.lang = lng || "de";
};
syncHtmlLang(state.language);
i18n.on("languageChanged", syncHtmlLang);

type ChoiceListener = (code: LanguageCode) => void;
const choiceListeners = new Set<ChoiceListener>();
/** Meldet jede bewusste Wahl im Menü, z. B. um sie im Profil zu speichern. */
export function onLanguageChoice(fn: ChoiceListener): () => void {
  choiceListeners.add(fn);
  return () => choiceListeners.delete(fn);
}

/** Bewusste Wahl im Menü: gilt sofort, wird gemerkt und geht allem anderen vor. */
export async function setLanguage(code: LanguageCode): Promise<void> {
  write(STORAGE_KEY, code);
  publish({ language: code, source: "choice", suggestion: null });
  await i18n.changeLanguage(code);
  choiceListeners.forEach((fn) => fn(code));
}

/**
 * Sprache einer Einladung oder eines Links. Greift nur, solange die Person
 * nicht selbst gewählt hat.
 */
export async function applyLinkLanguage(tag: string | null | undefined): Promise<void> {
  if (!tag || state.source === "choice") return;
  linkLanguage = tag;
  const next = pickLanguage({ link: tag, browser: browserLanguages(), showDrafts: draftsVisible() });
  publish(read(HINT_KEY, true) === "1" ? { ...next, suggestion: null } : next);
  if (next.language !== i18n.language) await i18n.changeLanguage(next.language);
}

/** Sprache aus dem Profil nach der Anmeldung: zählt wie eine eigene Wahl, wenn hier noch keine getroffen wurde. */
export async function applyProfileLanguage(tag: string | null | undefined): Promise<void> {
  const code = matchLanguage(tag);
  if (!code || state.source === "choice") return;
  if (!availableLanguages().some((l) => l.code === code)) return;
  write(STORAGE_KEY, code);
  publish({ language: code, source: "choice", suggestion: null });
  if (code !== i18n.language) await i18n.changeLanguage(code);
}

export function dismissLanguageHint(): void {
  write(HINT_KEY, "1", true);
  publish({ ...state, suggestion: null });
}

export function currentLanguage(): LanguageCode {
  return state.language;
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
/** Aktuelle Sprache, ihre Herkunft und ein möglicher Vorschlag für die Hinweiszeile. */
export function useLanguageState(): LanguagePick {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export default i18n;
