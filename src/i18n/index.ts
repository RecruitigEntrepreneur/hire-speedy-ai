import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import de from "./locales/de";
import en from "./locales/en";

export const SUPPORTED_LANGUAGES = ["de", "en"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
    fallbackLng: "de",
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    // only match the base language, never region variants (de-AT -> de)
    load: "languageOnly",
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "matchunt-lang",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });

// keep <html lang> in sync with the active language for SEO / a11y
const syncHtmlLang = (lng: string) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = (lng || "de").slice(0, 2);
  }
};
syncHtmlLang(i18n.resolvedLanguage || i18n.language);
i18n.on("languageChanged", syncHtmlLang);

export default i18n;
