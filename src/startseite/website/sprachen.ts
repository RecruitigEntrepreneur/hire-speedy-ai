// Sprachen der Website – dieselben sechs Einträge und dieselbe Zuordnung wie in der App
// (hire-speedy-ai: src/i18n/languages.ts), damit Website und App gleich entscheiden.
// Reine Logik ohne Browser-Zugriff: läuft im Proxy, auf dem Server und im Browser.

export type Code = "de" | "de-AT" | "de-CH" | "en" | "sv" | "nb";
export type Basis = "de" | "en" | "sv" | "nb";
export type Flagge = "de" | "at" | "ch" | "gb" | "se" | "no";

export type Sprache = {
  code: Code;
  /** Teil der Adresse: /w/de, /w/de-at, /w/no … */
  slug: string;
  /** Name in der eigenen Sprache, so steht er im Menü. */
  name: string;
  /** Kürzel in der Kopfzeile. */
  kurz: string;
  flagge: Flagge;
  /** Sprache, aus der die Texte kommen (de-AT und de-CH lesen die deutschen). */
  basis: Basis;
  /** Hinweisleiste in dieser Sprache: „Diese Seite gibt es auch auf …“ (Wortlaut wie in der App). */
  hinweis: { text: string; aktion: string };
};

export const SPRACHEN: readonly Sprache[] = [
  { code: "de", slug: "de", name: "Deutsch", kurz: "DE", flagge: "de", basis: "de",
    hinweis: { text: "Diese Seite gibt es auch auf Deutsch.", aktion: "Zu Deutsch wechseln" } },
  { code: "de-AT", slug: "de-at", name: "Deutsch (Österreich)", kurz: "AT", flagge: "at", basis: "de",
    hinweis: { text: "Diese Seite gibt es auch auf Deutsch.", aktion: "Zu Deutsch wechseln" } },
  { code: "de-CH", slug: "de-ch", name: "Deutsch (Schweiz)", kurz: "CH", flagge: "ch", basis: "de",
    hinweis: { text: "Diese Seite gibt es auch auf Deutsch.", aktion: "Zu Deutsch wechseln" } },
  { code: "en", slug: "en", name: "English", kurz: "EN", flagge: "gb", basis: "en",
    hinweis: { text: "This page is also available in English.", aktion: "Switch to English" } },
  { code: "sv", slug: "sv", name: "Svenska", kurz: "SV", flagge: "se", basis: "sv",
    hinweis: { text: "Den här sidan finns också på svenska.", aktion: "Byt till svenska" } },
  { code: "nb", slug: "no", name: "Norsk", kurz: "NO", flagge: "no", basis: "nb",
    hinweis: { text: "Denne siden finnes også på norsk.", aktion: "Bytt til norsk" } },
];

/** Ohne frühere Wahl und ohne passende Browsersprache: Englisch (wie in der App). */
export const STANDARD: Code = "en";
/** Cookie mit der eigenen Wahl. Vom Besucher selbst gewünscht, deshalb ohne Einwilligung erlaubt. */
export const COOKIE_SPRACHE = "mu_sprache";
/** Cookie „Hinweisleiste weggeklickt“. */
export const COOKIE_HINWEIS = "mu_hinweis";
/** Wurzel der Website im Labor. In Produktion ist das die Startadresse der Domain. */
export const WURZEL = "/w";

export const sprache = (code: string | null | undefined): Sprache => SPRACHEN.find((s) => s.code === code) ?? SPRACHEN[0];
export const ausSlug = (slug: string | null | undefined): Sprache | null => SPRACHEN.find((s) => s.slug === slug) ?? null;
export const adresse = (s: Sprache, rest = "") => `${WURZEL}/${s.slug}${rest}`;

/**
 * Ordnet eine Sprachangabe (Browser, Link, Cookie) einer Website-Sprache zu – wie matchLanguage in der App.
 * „sv-SE“ → sv, „no“/„nn“/„nb-NO“ → nb, „de-AT“ bleibt, „de-LI“ zählt zur Schweiz.
 */
export function passend(tag: string | null | undefined): Code | null {
  if (!tag) return null;
  const t = tag.trim().toLowerCase().replace("_", "-");
  if (!t) return null;
  const [l, region] = t.split("-");
  if (l === "de") return region === "at" ? "de-AT" : region === "ch" || region === "li" ? "de-CH" : "de";
  if (l === "en") return "en";
  if (l === "sv") return "sv";
  if (l === "nb" || l === "no" || l === "nn") return "nb";
  return null;
}

/** Accept-Language-Kopf in Reihenfolge der Gewichtung („de-CH,de;q=0.9,en;q=0.8“). */
export function browserSprachen(kopf: string | null | undefined): string[] {
  return (kopf ?? "")
    .split(",")
    .map((teil) => {
      const [tag, ...rest] = teil.trim().split(";");
      const q = rest.find((r) => r.trim().startsWith("q="));
      return { tag: tag.trim(), q: q ? Number(q.trim().slice(2)) || 0 : 1 };
    })
    .filter((x) => x.tag && x.tag !== "*")
    .sort((a, b) => b.q - a.q)
    .map((x) => x.tag);
}

/** Erste Browsersprache, die wir anbieten. */
export function ausBrowser(tags: readonly string[]): Code | null {
  for (const t of tags) { const c = passend(t); if (c) return c; }
  return null;
}

/** Vorauswahl beim Aufruf der Wurzel: eigene frühere Wahl → Browser → Englisch. */
export function vorauswahl(gespeichert: string | null | undefined, browser: readonly string[]): Sprache {
  const eigene = ausSlug(gespeichert);
  if (eigene) return eigene;
  return sprache(ausBrowser(browser) ?? STANDARD);
}

/** Schweizer Schreibweise: kein Eszett. */
export const schweiz = (text: string) => text.replace(/ß/g, "ss");
