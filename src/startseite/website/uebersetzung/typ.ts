/** Ein Wörterbuch-Teil: deutscher Text → Übersetzung, je Grundsprache außer Deutsch. */
export type Woerterbuch = { en: Record<string, string>; sv: Record<string, string>; nb: Record<string, string> };
