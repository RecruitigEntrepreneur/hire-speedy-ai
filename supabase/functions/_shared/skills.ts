/**
 * Skills so aufbereiten, dass der Matcher sie tatsaechlich vergleichen kann.
 *
 * Warum das noetig ist: calculate-match-v3-1 (index.ts:1174-1183) faellt ohne
 * strukturierte job_skill_requirements auf jobs.must_haves zurueck und
 * behandelt JEDEN Eintrag als Skillnamen -- kleingeschrieben und gegen die
 * Kandidaten-Skills ueber die Synonymtabelle gehalten. Ein Eintrag wie
 * "Ganzheitliches Denkvermoegen, hohe Eigenverantwortung und ausgepraegte
 * Umsetzungsstaerke bei technischen Fragestellungen" wird damit zu einem
 * Muss-Skill, den kein Kandidat je erfuellt: er zaehlt gegen die
 * mustHaveCoverage und drueckt den Score jedes Bewerbers.
 *
 * Kanonisiert wird gegen public.skill_synonyms -- dieselbe Tabelle, die der
 * Matcher laedt (index.ts:660-666). Ausdruecklich NICHT gegen
 * skill_taxonomy: die ist leer (0 Zeilen), weshalb die Function
 * normalize-skills faktisch nichts normalisiert.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type SkillKind =
  | 'technology'    // Sprache, Framework, Werkzeug, Plattform -> matchbar
  | 'method'        // Vorgehen wie Scrum, CI/CD -> matchbar
  | 'domain'        // Fachgebiet wie SAP FI/CO, Verpackungsmaschinen -> matchbar
  | 'language'      // natuerliche Sprache -> required_languages
  | 'certification' // Zertifikat, Zulassung -> required_certifications
  | 'education'     // Abschluss, Studium -> Freitext
  | 'experience'    // Jahre Berufserfahrung -> experience_min/max
  | 'soft';         // Persoenlichkeit -> Freitext, NIE ein Muss-Skill

/** Ein klassifiziertes Kriterium aus der Anzeige. */
export interface ClassifiedRequirement {
  /** Der Wortlaut aus der Anzeige — bleibt fuer den Freitext erhalten. */
  text: string;
  kind: SkillKind;
  /** Nur bei technology/method/domain: der einzelne, kurze Skillname. */
  skill?: string | null;
  required?: boolean;
  min_years?: number | null;
  /** Bei language: ISO-Code und Niveau. */
  language_code?: string | null;
  language_level?: string | null;
}

export type SynonymMap = Map<string, string>;

/**
 * Synonyme laden. Die Tabelle ist klein (gut 100 Zeilen), ein voller Scan
 * kostet nichts und erspart eine Abfrage je Skill.
 */
export async function loadSynonymMap(supabase: SupabaseClient): Promise<SynonymMap> {
  const map: SynonymMap = new Map();
  const { data, error } = await supabase
    .from('skill_synonyms')
    .select('canonical_name, synonym, bidirectional, active')
    .eq('active', true);

  if (error) {
    console.warn('[skills] Synonyme nicht ladbar:', error.message);
    return map;
  }
  for (const row of data ?? []) {
    const canonical = String(row.canonical_name ?? '').trim().toLowerCase();
    const synonym = String(row.synonym ?? '').trim().toLowerCase();
    if (!canonical) continue;
    map.set(canonical, canonical);
    if (synonym) map.set(synonym, canonical);
  }
  return map;
}

/**
 * Zusammengesetzte Nennungen trennen.
 *
 * "C#/.NET" sind zwei Skills, nicht einer -- als ein Eintrag findet ihn kein
 * Synonym und kein Kandidatenprofil. Getrennt wird an Schraegstrich, Komma,
 * "und", "sowie", "oder" und dem Aufzaehlungs-Ampersand. NICHT getrennt wird
 * bei Namen, die den Trenner als Bestandteil fuehren (CI/CD, TCP/IP, A/B).
 */
const KEEP_TOGETHER = new Set([
  'ci/cd', 'tcp/ip', 'a/b', 'i/o', 'r&d', 'q&a', 'p&l', 'ui/ux', 'and/or',
  'sap fi/co', 'fi/co', 'b2b/b2c', 'ci/cd-pipelines',
]);

export function splitCompoundSkill(raw: string): string[] {
  const value = raw.trim();
  if (!value) return [];
  if (KEEP_TOGETHER.has(value.toLowerCase())) return [value];

  const parts = value
    .split(/\s*(?:\/|,|;|\bund\b|\bsowie\b|\boder\b|&)\s*/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 1);

  // Nur trennen, wenn dabei mehrere brauchbare Teile herauskommen und keiner
  // davon ein Satzfragment ist.
  if (parts.length < 2) return [value];
  if (parts.some((p) => p.split(/\s+/).length > 4)) return [value];
  return parts;
}

/**
 * Der kanonische Schluessel eines Skills — zum Entdoppeln, nicht zum Anzeigen.
 *
 * skill_synonyms.canonical_name ist durchgehend kleingeschrieben ("javascript",
 * "typescript"). Als Anzeigetext taugt das nicht: der Kunde saehe "c#" und
 * ".net" in seinem Profil. Fuer den Vergleich ist es genau richtig -- der
 * Matcher schreibt beide Seiten ohnehin klein.
 */
export function canonicalKey(raw: string, map: SynonymMap): string {
  const key = raw.trim().toLowerCase();
  if (!key) return '';
  const hit = map.get(key);
  if (hit) return hit;
  const stripped = key.replace(/[.,;:!?]+$/, '');
  return map.get(stripped) ?? key;
}

/** Rueckwaertskompatibler Name; liefert den Schluessel. */
export const canonicalizeSkill = canonicalKey;

/**
 * Trennen, entdoppeln, lesbar halten.
 *
 * Entdoppelt wird ueber den kanonischen Schluessel -- "TS" und "TypeScript"
 * sind derselbe Skill. Angezeigt wird die ausfuehrlichste Schreibweise, die in
 * der Anzeige vorkam: aus "TS" und "TypeScript" wird "TypeScript", aus "K8s"
 * und "Kubernetes" wird "Kubernetes". Steht nur die Abkuerzung da, bleibt sie
 * stehen -- der Matcher loest sie ueber dieselbe Synonymtabelle selbst auf.
 */
export function normalizeSkillList(values: unknown, map: SynonymMap, limit = 25): string[] {
  if (!Array.isArray(values)) return [];
  const order: string[] = [];
  const display = new Map<string, string>();

  for (const value of values) {
    const raw = String(value ?? '').trim();
    if (!raw || raw.length > 60) continue;   // Saetze sind keine Skills
    for (const part of splitCompoundSkill(raw)) {
      const key = canonicalKey(part, map);
      if (!key) continue;
      if (!display.has(key)) {
        if (order.length >= limit) continue;
        order.push(key);
        display.set(key, part);
      } else if (part.length > display.get(key)!.length) {
        display.set(key, part);
      }
    }
  }
  return order.map((k) => display.get(k)!);
}

/** Wohin ein klassifiziertes Kriterium gehoert. */
export interface RoutedRequirements {
  /** Matchbar: kurze, kanonisierte Skillnamen. */
  mustHaves: string[];
  niceToHaves: string[];
  skills: string[];
  /** Typisierte Spalten. */
  requiredLanguages: { code: string; minLevel: string }[];
  requiredCertifications: string[];
  experienceMin: number | null;
  /** Alles, was nicht matchbar ist — geht in den Anforderungstext, damit es
   *  nicht verloren geht, aber nie in die Muss-Liste. */
  narrative: string[];
}

const LANG_CODES: Record<string, string> = {
  deutsch: 'de', german: 'de', englisch: 'en', english: 'en',
  franzoesisch: 'fr', französisch: 'fr', french: 'fr',
  spanisch: 'es', spanish: 'es', italienisch: 'it', italian: 'it',
  polnisch: 'pl', niederlaendisch: 'nl', niederländisch: 'nl',
  tschechisch: 'cs', chinesisch: 'zh', mandarin: 'zh',
};

/**
 * Die klassifizierten Kriterien auf ihre Ziele verteilen.
 *
 * Der Kern: NUR technology/method/domain landen in der Muss-Liste. Ein
 * Studienabschluss, eine Sprachanforderung oder "Freude an der Zusammenarbeit"
 * sind keine Skills — sie haben eigene Felder oder gehoeren in den Freitext.
 */
export function routeRequirements(
  items: ClassifiedRequirement[],
  map: SynonymMap,
): RoutedRequirements {
  const out: RoutedRequirements = {
    mustHaves: [], niceToHaves: [], skills: [],
    requiredLanguages: [], requiredCertifications: [],
    experienceMin: null, narrative: [],
  };
  const seenSkill = new Set<string>();
  const seenLang = new Set<string>();

  for (const item of items ?? []) {
    const text = String(item?.text ?? '').trim();
    const kind = item?.kind;

    if (kind === 'technology' || kind === 'method' || kind === 'domain') {
      const base = String(item.skill ?? text).trim();
      for (const part of splitCompoundSkill(base)) {
        const key = canonicalKey(part, map);
        if (!key || key.length > 60 || seenSkill.has(key)) continue;
        seenSkill.add(key);
        // Angezeigt wird die Schreibweise aus der Anzeige, entdoppelt ueber
        // den kanonischen Schluessel.
        out.skills.push(part);
        if (item.required === false) out.niceToHaves.push(part);
        else out.mustHaves.push(part);
      }
      continue;
    }

    if (kind === 'language') {
      const name = String(item.language_code ?? text).toLowerCase();
      const code = LANG_CODES[name] ?? (name.length === 2 ? name : null);
      if (code && !seenLang.has(code)) {
        seenLang.add(code);
        out.requiredLanguages.push({ code, minLevel: item.language_level || 'C1' });
      }
      if (text) out.narrative.push(text);
      continue;
    }

    if (kind === 'certification') {
      const value = String(item.skill ?? text).trim();
      if (value && value.length <= 80) out.requiredCertifications.push(value);
      continue;
    }

    if (kind === 'experience') {
      const years = Number(item.min_years);
      if (Number.isFinite(years) && years > 0 && years < 40) {
        out.experienceMin = out.experienceMin == null ? years : Math.max(out.experienceMin, years);
      }
      if (text) out.narrative.push(text);
      continue;
    }

    // education und soft: erhalten, aber nie als Muss-Kriterium.
    if (text) out.narrative.push(text);
  }

  // Muss-Liste deckeln. Mehr als acht harte Kriterien schrumpfen den Pool
  // schneller, als sie die Qualitaet heben — das sagt auch der Qualitaets-Check
  // in der Aufnahme.
  out.mustHaves = out.mustHaves.slice(0, 8);
  out.niceToHaves = out.niceToHaves.slice(0, 12);
  out.skills = out.skills.slice(0, 25);
  return out;
}
