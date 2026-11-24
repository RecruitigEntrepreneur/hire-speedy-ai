/**
 * Offene Stellen, die vielleicht passen (13.11.2026): Abgleich mit festen Regeln statt
 * KI-Stufen. Keine Bewertung, kein Score: Die Liste zeigt alle offenen Stellen, sortiert
 * nach Rolle (Wortliste), Ort und Datum, und je Stelle die Fakten neben den Angaben des
 * Kandidaten. Ausgeschlossen wird nur, was ein Fakt klar ausschließt; die Stellen bleiben
 * mit Grund sichtbar. Der Headhunter entscheidet.
 */

import i18n from '@/i18n';
import { term } from './candidateTerms';
import { effectiveJobModel } from './fitCheck';
import { genitiv } from './vorstellen';

// Texte beim Aufruf übersetzt (candidateDetail:openJobs, Arbeitsmodell unter jobs.remote).
const tj = (key: string, options?: Record<string, unknown>): string => i18n.t(`candidateDetail:openJobs.${key}`, options) as string;

/** Spalten aus recruiter_jobs_view, die der Abgleich braucht (Profil und Kandidatenliste). */
export const STELLEN_SPALTEN = 'id, title, location, remote_type, onsite_days_required, salary_min, salary_max, required_languages, created_at';

export interface StelleInfo {
  id: string;
  title: string;
  location: string | null;
  remote_type: string | null;
  onsite_days_required: number | null;
  salary_min: number | null;
  salary_max: number | null;
  required_languages: unknown;
  created_at: string | null;
}

export interface KandidatAngaben {
  vorname: string;
  job_title: string;
  target_roles: string[];
  city: string;
  remote_preference: string | null;
  expected_salary: number | null;
  salary_minimum: number | null;
  relocation_willing: boolean | null;
  languages: Array<{ language: string }>;
}

export interface StelleAbgleich {
  stelle: StelleInfo;
  /** Titel passt zu den Wunschrollen (oder, ohne Wunschrollen, zur heutigen Rolle). */
  rolle: boolean;
  gleicherOrt: boolean;
  /** Fakten neben den Angaben des Kandidaten, ohne die Rolle. */
  fakten: string[];
  /** Fester Ausschlussgrund, sonst null. */
  ausschluss: string | null;
}

export interface AbgleichErgebnis {
  /** Woran die Rolle gemessen wurde: Wunschrollen, heutige Rolle oder nichts. */
  rollenQuelle: 'wunsch' | 'heute' | null;
  rollen: string[];
  zurRolle: StelleAbgleich[];
  weitere: StelleAbgleich[];
  ausgeschlossen: StelleAbgleich[];
}

const MODELLE = ['onsite', 'hybrid', 'remote', 'field', 'flexible'];
/** Anzeige des Arbeitsmodells; Unbekanntes bleibt, wie es ist. */
const modellText = (m: string): string => (MODELLE.includes(m) ? i18n.t(`candidateDetail:jobs.remote.${m}`) as string : m);

/** Betrag ausgeschrieben, „85.000 €“ statt „85k“ (Apple-Stil, 24.11.2026). */
const zahl = (n: number) => Math.round(n).toLocaleString(i18n.language === 'en' ? 'en-GB' : i18n.language || 'de');
export const tausend = (n: number) => `${zahl(n)} €`;

export function budgetText(s: Pick<StelleInfo, 'salary_min' | 'salary_max'>): string | null {
  if (!s.salary_max) return null;
  return s.salary_min ? `${zahl(s.salary_min)}–${tausend(s.salary_max)}` : i18n.t('candidateDetail:jobs.upTo', { max: zahl(s.salary_max) }) as string;
}

/** „München · hybrid · 130.000–160.000 €“ */
export function stelleMeta(s: Pick<StelleInfo, 'location' | 'remote_type' | 'salary_min' | 'salary_max'>): string {
  return [s.location, s.remote_type ? modellText(s.remote_type) : null, budgetText(s)].filter(Boolean).join(' · ');
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

// Deutsche Namen zum Vergleich mit den gespeicherten Sprachen der Akte; angezeigt über term().
const SPRACHE: Record<string, string> = { de: 'Deutsch', en: 'Englisch', fr: 'Französisch', es: 'Spanisch', it: 'Italienisch', nl: 'Niederländisch', pl: 'Polnisch', pt: 'Portugiesisch', tr: 'Türkisch', ru: 'Russisch' };

/** Pflichtsprachen der Stelle: Texte oder `[{ code, minLevel }]` aus der Aufnahme. */
function sprachListe(value: unknown): Array<{ name: string; stufe: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v === 'string') return { name: v.trim(), stufe: '' };
      if (!v || typeof v !== 'object') return { name: '', stufe: '' };
      const o = v as Record<string, unknown>;
      const code = String(o.code ?? '').toLowerCase();
      const name = String(o.language ?? o.name ?? '') || SPRACHE[code] || code;
      return { name: name.trim(), stufe: String(o.minLevel ?? o.level ?? '').trim() };
    })
    .filter((x) => x.name);
}

function stelleModell(s: StelleInfo): string | null {
  return effectiveJobModel(s) ?? (s.remote_type === 'field' ? 'field' : null);
}

export function gleicheStadt(a: string | null, b: string | null): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  const x = norm(a).trim();
  const y = norm(b).trim();
  return x.includes(y) || y.includes(x);
}

// ── Rolle: kleine Wortliste von uns, keine KI ───────────────────────────────
// Fachgebiet und Ebene getrennt: „Teamleiter Service“ teilt mit „Vertriebsleitung“ nur
// die Ebene und passt deshalb nicht. Teilwörter, weil deutsche Titel zusammengesetzt sind
// („Vertriebsleitung“ enthält „vertrieb“ und „leitung“).

type Begriff = string | RegExp;

const FACH: Record<string, Begriff[]> = {
  vertrieb: ['vertrieb', 'sales', 'verkauf', 'key account', 'account manag', 'account execut', 'business development', 'aussendienst', 'gebietsleit', 'kundenberat'],
  marketing: ['marketing', /\bbrand\b/, 'kommunikation', 'communication', 'content', /\bpr\b/, /\bseo\b/],
  personal: ['personal', 'human resources', 'recruit', 'talent', 'people', /\bhr\b/, /\bhrbp\b/],
  finanzen: ['finanz', 'finance', 'buchhalt', 'accounting', 'controlling', 'controller', 'lohn', 'payroll', 'steuer', /\btax\b/, 'bilanz', 'treasury', /\bcfo\b/],
  it: ['entwickl', 'developer', 'software', 'devops', 'informatik', 'administrat', 'cloud', /\bit\b/, /\bsap\b/, /\bdata\b/, 'security', 'frontend', 'backend', 'fullstack'],
  service: ['service', 'support', 'customer success', 'kundendienst', 'kundenbetreu'],
  einkauf: ['einkauf', 'procurement', 'purchas', 'beschaffung'],
  logistik: ['logistik', 'logistic', 'lager', 'supply chain', 'spedition', 'disposition'],
  produktion: ['produktion', 'fertigung', 'manufactur', 'werkleit'],
  technik: ['techni', 'ingenieur', 'engineer', 'konstrukt', 'mechatron', 'elektro', 'instandhalt', 'wartung'],
  pflege: ['pflege', 'kranken', 'stationsleit', 'altenpfleg'],
  recht: ['recht', 'legal', 'jurist', 'anwalt', 'compliance'],
  produkt: ['produktmanag', 'product manag', 'product owner'],
  projekt: ['projektmanag', 'project manag', 'projektleit'],
  qualitaet: ['qualitat', 'quality', /\bqm\b/, /\bqs\b/],
  assistenz: ['assistenz', 'assistant', 'office manag', 'sekretar'],
};

const EBENE: Record<string, Begriff[]> = {
  leitung: ['leiter', 'leitung', 'head of', 'director', 'direktor', /\blead/, 'teamlead', /\bchef/, /\bvp\b/, 'vice president', 'geschaftsfuhr', 'managing director', 'vorstand', 'chief', /\bc[efoti]o\b/],
};

const UNWICHTIG = new Set(['m/w/d', 'mwd', 'senior', 'junior', 'manager', 'managerin', 'mitarbeiter', 'mitarbeiterin', 'dach', 'deutschland', 'germany', 'gmbh', 'fur', 'und', 'oder', 'der', 'die', 'das', 'mit', 'im', 'in', 'bereich']);

function trifft(text: string, b: Begriff): boolean {
  return typeof b === 'string' ? text.includes(b) : b.test(text);
}

function begriffe(titel: string, liste: Record<string, Begriff[]>): Set<string> {
  const t = norm(titel);
  return new Set(Object.entries(liste).filter(([, bs]) => bs.some((b) => trifft(t, b))).map(([k]) => k));
}

function woerter(titel: string): string[] {
  return norm(titel).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !UNWICHTIG.has(w));
}

const schnitt = (a: Set<string>, b: Set<string>) => [...a].some((x) => b.has(x));

/** Passt der Stellentitel zu einer der Rollen? Fachgebiet muss passen; nennt die Rolle eine Ebene, auch die. */
export function passtZurRolle(stellenTitel: string, rollen: string[]): boolean {
  const fachS = begriffe(stellenTitel, FACH);
  const ebeneS = begriffe(stellenTitel, EBENE);
  return rollen.some((rolle) => {
    const fach = begriffe(rolle, FACH);
    const ebene = begriffe(rolle, EBENE);
    if (fach.size === 0 && ebene.size === 0) {
      // Rolle ohne Wort aus der Liste: gleiche Wörter im Titel
      const w = woerter(rolle);
      const ws = new Set(woerter(stellenTitel));
      return w.length > 0 && w.some((x) => ws.has(x));
    }
    if (fach.size > 0 && !schnitt(fach, fachS)) return false;
    if (ebene.size > 0 && !schnitt(ebene, ebeneS)) return false;
    return true;
  });
}

// ── Fakten und feste Ausschlüsse ────────────────────────────────────────────

function ortFakt(k: KandidatAngaben, s: StelleInfo, modell: string | null): string | null {
  if (modell === 'remote' || !s.location?.trim()) return null;
  if (!k.city.trim()) return tj('fact.noCity');
  if (gleicheStadt(s.location, k.city)) return tj('fact.sameCity', { name: k.vorname });
  const umzug = k.relocation_willing === true ? 'fact.livesWilling' : k.relocation_willing === false ? 'fact.livesNoMove' : 'fact.livesOpen';
  return tj(umzug, { name: k.vorname, city: k.city.trim() });
}

function modellFakt(k: KandidatAngaben, s: StelleInfo, modell: string | null): string | null {
  if (!modell) return null;
  // „hybrid“ mit 5 Präsenztagen ist faktisch vor Ort: so steht es auch da.
  const m = modell === 'onsite' && s.remote_type === 'hybrid' && s.onsite_days_required ? tj('fact.onsiteDays', { count: s.onsite_days_required }) : modellText(modell);
  const w = k.remote_preference;
  if (modell === 'remote') return modellText('remote');
  if (!w) return m;
  if (w === modell) return tj('fact.modelAsWished', { model: m });
  if (w === 'flexible') return tj('fact.modelFlexible', { model: m, name: k.vorname });
  return tj('fact.modelWished', { model: m, wish: modellText(w) });
}

function gehaltFakt(k: KandidatAngaben, s: StelleInfo): string {
  if (!s.salary_max) return tj('fact.noBudget');
  if (!k.expected_salary) return tj('fact.noWish');
  const amount = tausend(k.expected_salary);
  if (k.expected_salary > s.salary_max) return tj('fact.wishAbove', { amount });
  if (s.salary_min && k.expected_salary < s.salary_min) return tj('fact.wishBelow', { amount });
  return tj('fact.wishWithin', { amount });
}

function sprachFakt(k: KandidatAngaben, s: StelleInfo): { fakt: string | null; fehlt: string[] } {
  const verlangt = sprachListe(s.required_languages);
  if (!verlangt.length) return { fakt: null, fehlt: [] };
  const hat = k.languages.map((l) => norm(l.language.trim())).filter(Boolean);
  const fehlt = verlangt.filter((v) => !hat.some((h) => h.startsWith(norm(v.name)) || norm(v.name).startsWith(h)));
  // Verglichen wird mit dem deutschen Namen; angezeigt in der Sprache der Oberfläche.
  const text = (l: typeof verlangt) => l.map((v) => [term(v.name), v.stufe].filter(Boolean).join(' ')).join(', ');
  if (!fehlt.length) return { fakt: tj('fact.langEntered', { list: text(verlangt) }), fehlt: [] };
  return { fakt: tj('fact.langMissing', { list: text(fehlt) }), fehlt: fehlt.map((v) => v.name) };
}

function ausschlussGrund(k: KandidatAngaben, s: StelleInfo, modell: string | null, fehlendeSprachen: string[]): string | null {
  if (k.salary_minimum && s.salary_max && k.salary_minimum > s.salary_max) {
    return tj('exclude.budget', { genitive: genitiv(k.vorname), name: k.vorname, min: tausend(k.salary_minimum) });
  }
  if (modell === 'onsite' && k.remote_preference === 'remote') return tj('exclude.onsiteVsRemote', { name: k.vorname });
  // Anderer Ort schließt nicht aus: Ohne Koordinaten der Stelle wüsste die Regel nicht, dass
  // Esslingen neben Stuttgart liegt. Der Ort steht als Fakt in der Zeile („kein Umzug“).
  // Fehlende Sprache schließt nur aus, wenn überhaupt Sprachen eingetragen sind.
  if (fehlendeSprachen.length && k.languages.some((l) => l.language.trim())) return tj('exclude.language', { language: term(fehlendeSprachen[0]) });
  return null;
}

export function stelleAbgleichen(k: KandidatAngaben, s: StelleInfo, rollen: string[]): StelleAbgleich {
  const modell = stelleModell(s);
  const sprache = sprachFakt(k, s);
  const fakten = [ortFakt(k, s, modell), modellFakt(k, s, modell), gehaltFakt(k, s), sprache.fakt].filter((f): f is string => !!f);
  return {
    stelle: s,
    rolle: rollen.length > 0 && passtZurRolle(s.title, rollen),
    gleicherOrt: modell === 'remote' || gleicheStadt(s.location, k.city),
    fakten,
    ausschluss: ausschlussGrund(k, s, modell, sprache.fehlt),
  };
}

const neuer = (a: StelleAbgleich, b: StelleAbgleich) => (b.stelle.created_at ?? '').localeCompare(a.stelle.created_at ?? '');
const reihenfolge = (a: StelleAbgleich, b: StelleAbgleich) => Number(b.gleicherOrt) - Number(a.gleicherOrt) || neuer(a, b);

/** Alle offenen Stellen für einen Kandidaten: zur Rolle, weitere, fest ausgeschlossen. */
export function offeneStellenAbgleichen(k: KandidatAngaben, stellen: StelleInfo[]): AbgleichErgebnis {
  const wunsch = k.target_roles.map((r) => r.trim()).filter(Boolean);
  const rollen = wunsch.length ? wunsch : k.job_title.trim() ? [k.job_title.trim()] : [];
  const rollenQuelle = wunsch.length ? 'wunsch' : rollen.length ? 'heute' : null;
  const alle = stellen.map((s) => stelleAbgleichen(k, s, rollen));
  const offen = alle.filter((a) => !a.ausschluss);
  return {
    rollenQuelle,
    rollen,
    zurRolle: offen.filter((a) => a.rolle).sort(reihenfolge),
    weitere: offen.filter((a) => !a.rolle).sort(reihenfolge),
    ausgeschlossen: alle.filter((a) => a.ausschluss).sort(neuer),
  };
}
