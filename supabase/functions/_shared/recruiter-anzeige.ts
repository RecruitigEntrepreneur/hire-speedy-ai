/**
 * Anzeige & Ansprache für Headhunter (Entscheidung 29.09.2026).
 *
 * Befund: Headhunter bekamen keine ausführliche anonymisierte Stellen-
 * beschreibung. Den Anzeigentext des Kunden zeigt recruiter_jobs_view erst
 * nach dem Reveal (er kann den Firmennamen enthalten), und die KI machte
 * daraus nur Schnipsel von 2–3 Sätzen.
 *
 * Jetzt schreibt format-job-for-recruiters zusätzlich eine vollständige
 * Anzeige (`anzeige`) und fertige Kurzansprachen (`ansprache`) in
 * formatted_content. Regeln:
 *  1. Beträge setzt das System ein, nie die KI: sie schreibt {VERGUETUNG}.
 *     Eingesetzt wird die Zahl aus recruiter_jobs_view (Satz des Spezialisten
 *     bzw. Gehalt) -- nie Budget oder Honorar.
 *  2. {VORNAME} ersetzt der Headhunter beim Kopieren.
 *  3. Firmenname, Domain und die Begriffe der red_list werden geprüft
 *     (namensFunde) und bis zum Reveal maskiert (maskiere_json, wie bisher).
 *  4. Matchunt sieht den Entwurf im Freigabe-Dialog, bevor er live geht.
 */

export const ANZEIGE_FASSUNG = 'anzeige-2026-09-v1';

export interface Anzeige {
  einleitung?: string;
  unternehmen?: string;
  aufgaben?: string[];
  arbeitsalltag?: string;
  profil_zwingend?: string[];
  profil_vorteil?: string[];
  angebot?: string[];
  team?: string;
  ablauf?: string[];
}

export interface Ansprache {
  linkedin?: string;
  email_betreff?: string;
  email_text?: string;
  telefon?: { einstieg?: string; argumente?: string[]; fragen?: string[] };
}

/** Alle KI-Texte aus Anzeige und Ansprache, für die Prüfungen. */
export function textDerAnzeige(content: { anzeige?: Anzeige | null; ansprache?: Ansprache | null } | null | undefined): string[] {
  const a = content?.anzeige ?? {};
  const s = content?.ansprache ?? {};
  const liste = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  return [
    a.einleitung, a.unternehmen, a.arbeitsalltag, a.team,
    ...liste(a.aufgaben), ...liste(a.profil_zwingend), ...liste(a.profil_vorteil), ...liste(a.angebot), ...liste(a.ablauf),
    s.linkedin, s.email_betreff, s.email_text, s.telefon?.einstieg,
    ...liste(s.telefon?.argumente), ...liste(s.telefon?.fragen),
  ].filter((t): t is string => typeof t === 'string' && t.trim() !== '');
}

const RECHTSFORM = /\s*(?:&\s*Co\.?\s*)?\b(GmbH|gGmbH|mbH|UG|AG|SE|KGaA|KG|OHG|GbR|e\.\s?K\.|e\.\s?V\.|eG|Ltd\.?|Inc\.?|LLC|plc|B\.V\.|N\.V\.)\s*$/i;

/** Die Begriffe, die in keiner Anzeige stehen dürfen. */
export function verboteneBegriffe(firma: string | null | undefined, redList: unknown, domains: (string | null | undefined)[] = []): string[] {
  const out = new Set<string>();
  const dazu = (v: string | null | undefined) => {
    const s = (v ?? '').trim();
    if (s.length >= 3) out.add(s);
  };
  dazu(firma);
  let ohne = (firma ?? '').trim();
  for (let i = 0; i < 3 && RECHTSFORM.test(ohne); i++) ohne = ohne.replace(RECHTSFORM, '').trim();
  dazu(ohne);
  if (Array.isArray(redList)) for (const b of redList) dazu(typeof b === 'string' ? b : null);
  for (const d of domains) {
    const host = (d ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    dazu(host);
    dazu(host.split('.')[0]);
  }
  return [...out];
}

/** Welche verbotenen Begriffe in den Texten vorkommen. */
export function namensFunde(texte: string[], begriffe: string[]): string[] {
  const alles = texte.join('\n').toLowerCase();
  return begriffe.filter(b => alles.includes(b.toLowerCase()));
}

const BETRAG = /(\d[\d.,]*\s?(€|eur\b|euro\b|k\b|tsd))|(€\s?\d)/i;

/** Sätze mit Geldbeträgen -- die darf nur das System einsetzen. */
export function betragFunde(texte: string[]): string[] {
  return texte.filter(t => BETRAG.test(t));
}

/** Platzhalter ersetzen; ohne Vornamen fällt er samt Leerzeichen weg ("Hallo," statt "Hallo {VORNAME},"). */
export function setzePlatzhalter(text: string, werte: { vorname?: string | null; verguetung?: string | null }): string {
  const vorname = (werte.vorname ?? '').trim();
  let aus = vorname ? text.replace(/\{VORNAME\}/g, vorname) : text.replace(/\s?\{VORNAME\}/g, '');
  aus = aus.replace(/\{VERGUETUNG\}/g, (werte.verguetung ?? '').trim() || 'nach Absprache');
  return aus;
}
