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

/** Die übrigen KI-Felder in formatted_content, die Headhunter lesen. */
export interface KiTexte {
  headline?: string;
  highlights?: string[];
  role_summary?: string;
  ideal_candidate?: string;
  selling_points?: string[];
  urgency_note?: string | null;
  anonymous_company_pitch?: string;
  anzeige?: Anzeige | null;
  ansprache?: Ansprache | null;
}

/** Alle KI-Texte aus Anzeige, Ansprache und Aufbereitung, für die Prüfungen. */
export function textDerAnzeige(content: KiTexte | null | undefined): string[] {
  const a = content?.anzeige ?? {};
  const s = content?.ansprache ?? {};
  const liste = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  return [
    content?.headline, content?.role_summary, content?.ideal_candidate, content?.urgency_note ?? undefined,
    content?.anonymous_company_pitch, ...liste(content?.highlights), ...liste(content?.selling_points),
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

// ---------------------------------------------------------------------------
// Regelprüfung gegen die Angaben des Kunden (21.10.2026)
//
// BEFUND (Tax Manager, Bluewater & Bridge): Die KI schrieb „führender
// Großhändler“, „rund 500 Mitarbeiter“ (Kunde: 900), „krisenfester
// Wachstumsmarkt“ und „erfolgreich absolviertes Steuerberaterexamen“ (Kunde:
// „von Vorteil, kein Muss“). Der Headhunter soll so etwas nie zu sehen
// bekommen. Diese Prüfung ist fest (keine KI) und läuft zweimal: im Generator
// nach dem Schreiben und beim Anzeigen, damit auch ältere Texte sauber sind.
// ---------------------------------------------------------------------------

/** Die Felder des Kunden, gegen die geprüft wird (Spalten aus jobs bzw. recruiter_jobs_view). */
export const FAKTEN_FELDER = [
  'title', 'industry', 'location', 'description', 'requirements', 'skills', 'must_haves', 'nice_to_haves',
  'must_have_criteria', 'trainable_skills', 'nice_to_have_criteria', 'unique_selling_points', 'position_advantages',
  'daily_routine', 'task_focus', 'vacancy_reason', 'negative_impact_if_unfilled', 'team_size', 'reports_to',
  'decision_makers', 'success_profile', 'failure_profile', 'company_culture', 'career_path', 'career_example',
  'benefits', 'core_hours', 'core_hours_detail', 'overtime_policy', 'onsite_days_required', 'required_languages',
  'required_certifications', 'experience_min', 'experience_max', 'contract_creation_days', 'industry_opportunities',
  'industry_challenges', 'company_headcount', 'company_size_band', 'department_structure', 'salary_months',
  'salary_min', 'salary_max', 'contract_limitation', 'contract_sensitive_topics', 'time_tracking_method',
  'hiring_urgency', 'contract_duration_months', 'utilization_days_per_week', 'remote_type', 'employment_type',
  'experience_level', 'interview_process', 'salary_flex', 'max_notice_period', 'target_companies', 'nogo_companies',
  'candidate_concerns', 'candidate_concerns_answer', 'tech_environment', 'funding_stage',
] as const;

/** Alle Angaben des Kunden als ein Text, klein geschrieben. */
export function faktenText(job: Record<string, unknown> | null | undefined): string {
  if (!job) return '';
  const teile: string[] = [];
  const rein = (v: unknown) => {
    if (v == null || v === '') return;
    if (Array.isArray(v)) v.forEach(rein);
    else if (typeof v === 'object') Object.entries(v as Record<string, unknown>).forEach(([k, w]) => { teile.push(k); rein(w); });
    else teile.push(String(v));
  };
  for (const f of FAKTEN_FELDER) rein(job[f]);
  return teile.join('\n').toLocaleLowerCase('de-DE');
}

const FUELLWORT = new Set(['und', 'oder', 'mit', 'von', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'sehr', 'gute', 'guter',
  'gutes', 'erste', 'kenntnisse', 'erfahrung', 'erfahrungen', 'wissen', 'umgang', 'bereich', 'idealerweise', 'bereitschaft']);

/** Was der Kunde „von Vorteil“ oder „erlernbar“ nennt: das darf nie als Pflicht erscheinen. */
export function vorteilBegriffe(job: Record<string, unknown> | null | undefined): string[] {
  if (!job) return [];
  const liste = (v: unknown) => (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(/[,;·\n]/) : []);
  const roh = [...liste(job.trainable_skills), ...liste(job.nice_to_have_criteria), ...liste(job.nice_to_haves)];
  const out = new Set<string>();
  for (const r of roh) {
    // „Steuerberaterexamen von Vorteil“ -> „steuerberaterexamen“; „Kenntnisse in SAP“ -> „sap“
    const kern = r.replace(/\b(von vorteil|wünschenswert|wuenschenswert|ist ein plus|erlernbar|kein muss)\b.*$/i, '')
      .replace(/[()/,]/g, ' ').trim().toLocaleLowerCase('de-DE');
    for (const wort of kern.split(/\s+/)) if (wort.length >= 3 && !FUELLWORT.has(wort)) out.add(wort);
  }
  return [...out];
}

export type RegelFund = { art: 'behauptung' | 'zahl' | 'vorteil'; text: string; treffer: string };

/**
 * Aussagen, die ein Kunde selbst machen muss. Treffer nur, wenn der Stamm nicht
 * in seinen Angaben steht. `satz: true` heißt: ganzer Satz bzw. Punkt fällt weg;
 * sonst nur das Wort (Adjektiv), der Satz bleibt.
 */
const BEHAUPTUNGEN: { stamm: string; muster: RegExp; satz: boolean }[] = [
  { stamm: 'führend', muster: /\b(?:welt|markt)?führend(?:e[nrms]?)?\b\s*,?\s*/gi, satz: false },
  { stamm: 'marktführer', muster: /\b(?:welt)?marktführer\w*\b/gi, satz: true },
  { stamm: 'branchenprimus', muster: /\bbranchenprimus\b/gi, satz: true },
  { stamm: 'nummer 1', muster: /\b(?:nr\.?|nummer)\s*(?:1|eins)\b/gi, satz: true },
  { stamm: 'krisen', muster: /\bkrisen(?:fest|sicher)(?:e[nrms]?)?\b\s*/gi, satz: false },
  { stamm: 'sicherer arbeitsplatz', muster: /\bsicher(?:e[nrms]?)?\s+arbeitspl[aä]tz\w*/gi, satz: true },
  { stamm: 'renommiert', muster: /\brenommiert(?:e[nrms]?)?\b\s*/gi, satz: false },
  { stamm: 'preisgekrönt', muster: /\bpreisgekrönt(?:e[nrms]?)?\b\s*/gi, satz: false },
  { stamm: 'einzigartig', muster: /\beinzigartig(?:e[nrms]?)?\b\s*/gi, satz: false },
  // „exklusive Vakanz“ (21.10.2026): ob ein Mandat exklusiv ist, sagt nur der Kunde.
  { stamm: 'exklusiv', muster: /\bexklusiv(?:e[nrms]?)?\b\s*/gi, satz: false },
  { stamm: 'top-arbeitgeber', muster: /\btop[- ]arbeitgeber\w*|arbeitgeber des jahres/gi, satz: true },
  { stamm: 'international', muster: /\binternational\s+(?:agierend|tätig)(?:e[nrms]?)?\b\s*|\binternational(?:e[nrms]?)?\b\s*/gi, satz: false },
  { stamm: 'weltweit', muster: /\bweltweit(?:e[nrms]?)?\b\s*/gi, satz: false },
  { stamm: 'global', muster: /\bglobal(?:e[nrms]?)?\b\s*/gi, satz: false },
];

// Zahlen mit Tausenderpunkt zählen als eine; Jahreszahlen und 0/1 prüft die Regel nicht.
const ZAHL = /(?<![\p{L}\d.,])\d+(?:\.\d{3})*(?![\p{L}\d]|[.,]\d)/gu;
const zahlWert = (z: string) => z.replace(/\./g, '');
const zaehlt = (n: string) => { const v = Number(n); return v >= 2 && !(v >= 1900 && v <= 2100); };
const PFLICHT = /(erfolgreich\s+(?:absolviert|abgeschlossen)|abgeschlossen(?:e[nrms]?)?\s|zwingend|vorausgesetzt|voraussetzung|pflicht|unabdingbar)/i;

/** Feste Prüfung eines Textes. `vorteilImText` prüft nur Profil- und Pitch-Texte, nicht Aufgaben. */
export function regelFunde(texte: string[], fakten: string, vorteile: string[] = []): RegelFund[] {
  const funde: RegelFund[] = [];
  const zahlenKunde = new Set((fakten.match(ZAHL) ?? []).map(zahlWert));
  for (const text of texte) {
    if (!text) continue;
    for (const b of BEHAUPTUNGEN) {
      b.muster.lastIndex = 0;
      const m = text.match(b.muster);
      if (m && !fakten.includes(b.stamm)) funde.push({ art: 'behauptung', text, treffer: m[0].trim().replace(/,$/, '') });
    }
    for (const z of text.replace(/\{[A-Z_]+\}/g, '').match(ZAHL) ?? []) {
      const n = zahlWert(z);
      if (zaehlt(n) && !zahlenKunde.has(n)) funde.push({ art: 'zahl', text, treffer: z });
    }
    if (PFLICHT.test(text)) {
      for (const v of vorteile) {
        if (new RegExp(`(?<![\\p{L}])${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu').test(text)) funde.push({ art: 'vorteil', text, treffer: v });
      }
    }
  }
  return funde;
}

const SATZ = /(?<=[.!?])\s+(?=[A-ZÄÖÜ„"(])/;

function saeubern(t: string) {
  return t.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/,\s*,/g, ',').replace(/\(\s*\)/g, '').trim();
}

/**
 * Ein Text ohne die Funde: Adjektive fallen weg, Sätze mit Zahlen oder
 * Behauptungen ohne Grundlage fallen ganz weg. `null` = nichts übrig.
 */
export function bereinigeText(text: string, fakten: string, vorteile: string[] = []): string | null {
  if (!regelFunde([text], fakten, vorteile).length) return text;
  const saetze = text.split(SATZ).map(satz => {
    let t = satz;
    for (const b of BEHAUPTUNGEN) {
      if (b.satz || fakten.includes(b.stamm)) continue;
      b.muster.lastIndex = 0;
      t = t.replace(b.muster, '');
    }
    t = saeubern(t);
    return regelFunde([t], fakten, vorteile).length ? null : t;
  }).filter((t): t is string => Boolean(t));
  const aus = saeubern(saetze.join(' '));
  return aus || null;
}

/**
 * Jeden KI-Text der Aufbereitung durch `fn` schicken. `null` oder Leertext
 * heißt: Listenpunkt fällt weg bzw. Feld wird leer.
 */
export function mapKiTexte<T extends KiTexte>(content: T, fn: (text: string) => string | null): T {
  const text = (v: unknown) => (typeof v === 'string' ? fn(v) ?? '' : v);
  const liste = (v: unknown) => (Array.isArray(v)
    ? v.map(x => (typeof x === 'string' ? fn(x) : x)).filter(x => x !== null && x !== '')
    : v);
  const a = content.anzeige ?? null;
  const s = content.ansprache ?? null;
  return {
    ...content,
    headline: text(content.headline),
    role_summary: text(content.role_summary),
    ideal_candidate: text(content.ideal_candidate),
    urgency_note: content.urgency_note == null ? content.urgency_note : text(content.urgency_note),
    anonymous_company_pitch: text(content.anonymous_company_pitch),
    highlights: liste(content.highlights),
    selling_points: liste(content.selling_points),
    anzeige: a && {
      ...a, einleitung: text(a.einleitung), unternehmen: text(a.unternehmen), arbeitsalltag: text(a.arbeitsalltag), team: text(a.team),
      aufgaben: liste(a.aufgaben), profil_zwingend: liste(a.profil_zwingend), profil_vorteil: liste(a.profil_vorteil),
      angebot: liste(a.angebot), ablauf: liste(a.ablauf),
    },
    ansprache: s && {
      ...s, linkedin: text(s.linkedin), email_betreff: text(s.email_betreff), email_text: text(s.email_text),
      telefon: s.telefon && { ...s.telefon, einstieg: text(s.telefon.einstieg), argumente: liste(s.telefon.argumente), fragen: liste(s.telefon.fragen) },
    },
  } as T;
}

/** Die ganze KI-Aufbereitung ohne Funde. Listenpunkte mit Fund fallen weg. */
export function bereinigeInhalt<T extends KiTexte>(content: T, fakten: string, vorteile: string[] = []): { content: T; entfernt: RegelFund[] } {
  const entfernt = regelFunde(textDerAnzeige(content), fakten, vorteile);
  if (!entfernt.length) return { content, entfernt };
  return { content: mapKiTexte(content, t => bereinigeText(t, fakten, vorteile)), entfernt };
}

/** Sätze, die die Belegprüfung nach der Korrektur noch findet, fallen weg. */
export function entferneSaetze<T extends KiTexte>(content: T, saetze: string[]): { content: T; entfernt: string[] } {
  const weg = saetze.map(x => x.trim()).filter(x => x.length >= 8);
  if (!weg.length) return { content, entfernt: [] };
  const entfernt = new Set<string>();
  const neu = mapKiTexte(content, text => {
    const teile = text.split(SATZ).filter(satz => {
      const treffer = weg.find(w => satz.includes(w) || w.includes(satz.trim()));
      if (treffer) entfernt.add(treffer);
      return !treffer;
    });
    return teile.length ? saeubern(teile.join(' ')) : null;
  });
  return { content: entfernt.size ? neu : content, entfernt: [...entfernt] };
}
