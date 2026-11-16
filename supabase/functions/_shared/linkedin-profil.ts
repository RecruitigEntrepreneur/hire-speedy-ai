/**
 * LinkedIn-Profil des Headhunters lesen und in Vorschläge für Profil › Über dich
 * und Schwerpunkte übersetzen (16.11.2026).
 *
 * Quelle ist die Datenfreigabe nach EU-Recht (Member Data Portability API,
 * Member Snapshot API). Die Zeilen tragen die Spaltennamen des LinkedIn-
 * Datenexports („Title“, „Company Name“, „Started On“ …). Wir lesen nur die
 * Profil-Bereiche PROFILE, POSITIONS, LANGUAGES und SKILLS, nie Nachrichten
 * oder Kontakte.
 *
 * Vorschläge kommen nur aus den festen Listen von recruiter-expertise.ts:
 * Was dort nicht steht, schlagen wir nicht vor. Übernommen wird erst nach dem
 * Häkchen des Headhunters.
 */
import { EXPERTISE_AREAS, LANGUAGES } from './recruiter-expertise.ts';

/** Die Bereiche, die wir bei LinkedIn abfragen. */
export const LINKEDIN_BEREICHE = ['PROFILE', 'POSITIONS', 'LANGUAGES', 'SKILLS'] as const;
export type LinkedinBereich = typeof LINKEDIN_BEREICHE[number];

export interface LiPosition { titel: string; firma: string; beschreibung: string; von: number | null; bis: number | null }
export interface LinkedinProfil { headline: string; positionen: LiPosition[]; sprachen: string[]; skills: string[] }
export interface LinkedinVorschlag {
  position: string | null;
  erfahrungJahre: number | null;
  sprachen: string[];
  bereiche: string[];
  unterbereiche: string[];
}

type Zeile = Record<string, unknown>;

/** Spalte unabhängig von Groß-/Kleinschreibung, Leer- und Unterstrichen. */
function feld(z: Zeile, ...namen: string[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '');
  const ziel = new Set(namen.map(norm));
  for (const [k, v] of Object.entries(z)) if (ziel.has(norm(k)) && typeof v === 'string') return v.trim();
  return '';
}

const MONATE: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, mär: 3, maer: 3, apr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
  oct: 10, okt: 10, nov: 11, dec: 12, dez: 12,
};

/** „Mar 2015“, „März 2015“, „2015-03“, „03/2015“, „2015“ → Monatszahl (Jahr*12 + Monat-1). */
export function monat(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) return Number(m[1]) * 12 + Number(m[2]) - 1;
  m = s.match(/^(\d{1,2})[/.](\d{4})$/);
  if (m) return Number(m[2]) * 12 + Number(m[1]) - 1;
  m = s.match(/^([a-zäö]+)\.?\s+(\d{4})$/);
  if (m) {
    const mon = MONATE[m[1].slice(0, 4)] ?? MONATE[m[1].slice(0, 3)];
    return mon ? Number(m[2]) * 12 + mon - 1 : Number(m[2]) * 12;
  }
  m = s.match(/^(\d{4})$/);
  return m ? Number(m[1]) * 12 : null;
}

/** Zeilen der Snapshot-Bereiche → schlichtes Profil. */
export function profilAusSnapshot(d: Partial<Record<LinkedinBereich, Zeile[]>>): LinkedinProfil {
  const profil = d.PROFILE?.[0] ?? {};
  return {
    headline: feld(profil, 'Headline'),
    positionen: (d.POSITIONS ?? []).map((z) => ({
      titel: feld(z, 'Title'),
      firma: feld(z, 'Company Name', 'Company'),
      beschreibung: feld(z, 'Description'),
      von: monat(feld(z, 'Started On', 'Start Date')),
      bis: monat(feld(z, 'Finished On', 'End Date')),
    })).filter((p) => p.titel || p.firma),
    sprachen: (d.LANGUAGES ?? []).map((z) => feld(z, 'Name', 'Language')).filter(Boolean),
    skills: (d.SKILLS ?? []).map((z) => feld(z, 'Name', 'Skill')).filter(Boolean),
  };
}

const RECRUITING = /recruit|talent|headhunt|personalberat|personalvermittl|executive search|sourcing|personaldienstleist/i;

const SPRACHE: [RegExp, string][] = [
  [/deutsch|german|allemand|tedesco|alem[aá]n/i, 'Deutsch'],
  [/englisch|english|anglais|inglese|ingl[eé]s/i, 'Englisch'],
  [/franz[öo]sisch|french|fran[cç]ais|francese|franc[eé]s/i, 'Französisch'],
  [/spanisch|spanish|espa[nñ]ol|espagnol|spagnolo/i, 'Spanisch'],
  [/italienisch|italian|italiano|italien/i, 'Italienisch'],
  [/polnisch|polish|polski|polonais/i, 'Polnisch'],
];

/**
 * Schlüsselwörter je Unterpunkt. „HR & Recruiting“ fehlt bewusst: Ein Headhunter
 * arbeitet selbst im Recruiting, das sagt nichts darüber, welche Stellen er besetzt.
 */
const UNTERPUNKTE: [RegExp, string][] = [
  [/software|developer|entwickler|devops|frontend|backend/i, 'Softwareentwicklung'],
  [/\bdata\b|machine learning|\bki\b|\bai\b|künstliche intelligenz/i, 'Data & KI'],
  [/security|it-sicherheit|cyber/i, 'IT-Security'],
  [/\bcto\b|it-leitung|head of it/i, 'IT-Leitung / CTO'],
  [/vertrieb|\bsales\b/i, 'Vertrieb'],
  [/key account/i, 'Key Account'],
  [/marketing/i, 'Marketing'],
  [/business development/i, 'Business Development'],
  [/e-?commerce/i, 'E-Commerce'],
  [/controlling/i, 'Controlling'],
  [/buchhaltung|accounting|bilanz/i, 'Buchhaltung'],
  [/treasury/i, 'Treasury'],
  [/steuer(?!ung)|\btax\b/i, 'Steuern'],
  [/\bcfo\b|finanzleitung|head of finance/i, 'CFO / Leitung'],
  [/maschinenbau|mechanical engineer/i, 'Maschinenbau'],
  [/elektrotechnik|electrical engineer/i, 'Elektrotechnik'],
  [/konstruktion|\bcad\b/i, 'Konstruktion'],
  [/produktion|manufacturing|fertigung/i, 'Produktion'],
  [/qualitätsmanagement|quality management|\bqm\b/i, 'Qualität'],
  [/einkauf|procurement|purchasing/i, 'Einkauf'],
  [/supply chain/i, 'Supply Chain'],
  [/logistik|logistics/i, 'Logistik'],
  [/projektmanagement|project management/i, 'Projektmanagement'],
  [/legal|jurist|rechtsabteilung|syndikus/i, 'Rechtsabteilung'],
  [/compliance/i, 'Compliance'],
  [/datenschutz|data protection/i, 'Datenschutz'],
  [/pharma/i, 'Pharma'],
  [/medizintechnik|medtech|medical device/i, 'Medizintechnik'],
  [/pflege|nursing/i, 'Pflege'],
  [/ärzt|arzt|physician/i, 'Ärzte'],
  [/klinik|hospital/i, 'Klinikmanagement'],
  [/geschäftsführ|managing director|\bceo\b/i, 'Geschäftsführung'],
  [/vorstand|board/i, 'Vorstand'],
  [/interim/i, 'Interim'],
];

const BEREICH_VON = new Map(EXPERTISE_AREAS.flatMap((a) => a.sub.map((s) => [s, a.label] as const)));

/** Heutige Rolle: laufende Station, sonst die Überschrift bis zum ersten Trenner. */
function heutigeRolle(p: LinkedinProfil): string | null {
  const laufend = p.positionen.filter((x) => x.bis === null && x.titel).sort((a, b) => (b.von ?? 0) - (a.von ?? 0))[0];
  const roh = laufend?.titel || p.headline.split(/\s[|·•–-]\s|\s(?:bei|at|@)\s/i)[0] || '';
  const t = roh.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, 80) : null;
}

/** Jahre im Recruiting: vom Start der ersten Recruiting-Station bis heute bzw. zum Ende der letzten. */
function jahreImRecruiting(p: LinkedinProfil, heute: Date): number | null {
  const r = p.positionen.filter((x) => x.von !== null && (RECRUITING.test(x.titel) || RECRUITING.test(x.firma)));
  if (!r.length) return null;
  const jetzt = heute.getFullYear() * 12 + heute.getMonth();
  const start = Math.min(...r.map((x) => x.von as number));
  const ende = r.some((x) => x.bis === null) ? jetzt : Math.max(...r.map((x) => x.bis ?? jetzt));
  const jahre = Math.floor((Math.min(ende, jetzt) - start) / 12);
  return jahre >= 0 && jahre <= 60 ? jahre : null;
}

export function vorschlagAus(p: LinkedinProfil, heute = new Date()): LinkedinVorschlag {
  const sprachen = LANGUAGES.filter((l) => p.sprachen.some((s) => SPRACHE.some(([re, ziel]) => ziel === l && re.test(s))));
  const text = [p.headline, ...p.skills, ...p.positionen.flatMap((x) => [x.titel, x.beschreibung])].join(' \n ');
  const unterbereiche = [...new Set(UNTERPUNKTE.filter(([re]) => re.test(text)).map(([, s]) => s))];
  const bereiche = EXPERTISE_AREAS.map((a) => a.label).filter((l) => unterbereiche.some((s) => BEREICH_VON.get(s) === l));
  return {
    position: heutigeRolle(p),
    erfahrungJahre: jahreImRecruiting(p, heute),
    sprachen,
    // Reihenfolge wie im Katalog, damit die Chips gewohnt aussehen.
    unterbereiche: EXPERTISE_AREAS.flatMap((a) => a.sub).filter((s) => unterbereiche.includes(s)),
    bereiche,
  };
}
