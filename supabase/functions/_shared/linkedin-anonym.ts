// Anonymität für öffentliche LinkedIn-Beiträge (21.10.2026).
//
// Öffentlich gilt strenger als in der Anzeige an einen einzelnen Kandidaten:
// Branche + Stadt + Mitarbeiterzahl zusammen machen einen Kunden auffindbar.
// Deshalb Region statt Stadt, Branche allgemein, keine Mitarbeiterzahl, und
// keine Spur des Firmennamens (auch nicht des ersten Wortes oder der Domain).
// Gemeinsam genutzt von der Vorschau (Frontend) und der Prüfung vor dem
// Posten (Function) – reine Funktionen ohne Datenbank.
import { namensFunde, verboteneBegriffe } from './recruiter-anzeige.ts';
import { tr, type Lang, type Texts } from './i18n.ts';

// Mehrsprachig (13.11.2026): Der Beitrag entsteht in der Sprache des Headhunters. Alle Funktionen
// nehmen eine optionale Sprache; ohne Angabe Deutsch, so wie die Function linkedin weiter prüft.

/** Regionen in anderen Sprachen; Eigennamen ohne Eintrag bleiben, wie sie sind. */
const REGION_TEXT: Record<string, Omit<Texts, 'de'>> = {
  'Großraum München': { en: 'Greater Munich', sv: 'Münchenregionen', nb: 'Münchenregionen' },
  'Rheinland': { en: 'Rhineland', sv: 'Rhenlandet', nb: 'Rhinland' },
  'Region Stuttgart': { en: 'Stuttgart area', sv: 'Stuttgartregionen', nb: 'Stuttgartregionen' },
  'Ruhrgebiet': { en: 'Ruhr area', sv: 'Ruhrområdet', nb: 'Ruhr-området' },
  'Region Hannover': { en: 'Hanover area', sv: 'Hannoverregionen', nb: 'Hannover-regionen' },
  'Metropolregion Nürnberg': { en: 'Nuremberg area', sv: 'Nürnbergregionen', nb: 'Nürnberg-regionen' },
  'Mitteldeutschland': { en: 'Central Germany', sv: 'Mellersta Tyskland', nb: 'Midt-Tyskland' },
  'Region Dresden': { en: 'Dresden area', sv: 'Dresdenregionen', nb: 'Dresden-regionen' },
  'Region Karlsruhe': { en: 'Karlsruhe area', sv: 'Karlsruheregionen', nb: 'Karlsruhe-regionen' },
  'Region Augsburg': { en: 'Augsburg area', sv: 'Augsburgregionen', nb: 'Augsburg-regionen' },
  'Westfalen': { en: 'Westphalia' },
  'Südbaden': { en: 'Southern Baden', sv: 'Södra Baden', nb: 'Sør-Baden' },
  'Bayern': { en: 'Bavaria' },
  'Wien': { en: 'Vienna' },
  'Schweiz': { en: 'Switzerland', nb: 'Sveits' },
  'Deutschland': { en: 'Germany', sv: 'Tyskland', nb: 'Tyskland' },
  'Remote': { sv: 'Distans', nb: 'Fjernarbeid' },
};
const regionText = (text: string, lang?: Lang | null) => (REGION_TEXT[text] ? tr(lang, { de: text, ...REGION_TEXT[text] }) : text);

/** Städte → Region. Große Städte sind selbst Region genug, kleine verraten den Kunden. */
const REGIONEN: [RegExp, string][] = [
  [/\b(frankfurt|offenbach|wiesbaden|mainz|darmstadt|hanau|bad homburg|eschborn|oberursel|rüsselsheim|neu-isenburg|dreieich|langen)\b/i, 'Rhein-Main'],
  [/\b(münchen|muenchen|garching|unterföhring|ismaning|unterschleißheim|freising|erding|starnberg|grünwald|planegg|martinsried)\b/i, 'Großraum München'],
  [/\b(berlin|potsdam)\b/i, 'Berlin'],
  [/\bhamburg\b/i, 'Hamburg'],
  [/\b(köln|koeln|bonn|leverkusen|düsseldorf|duesseldorf|neuss|ratingen|hilden|bergisch gladbach)\b/i, 'Rheinland'],
  [/\b(stuttgart|esslingen|böblingen|sindelfingen|ludwigsburg|leonberg|waiblingen|filderstadt)\b/i, 'Region Stuttgart'],
  [/\b(dortmund|essen|bochum|duisburg|gelsenkirchen|oberhausen|mülheim|herne|recklinghausen)\b/i, 'Ruhrgebiet'],
  [/\b(hannover|langenhagen)\b/i, 'Region Hannover'],
  [/\b(nürnberg|nuernberg|fürth|erlangen|schwabach)\b/i, 'Metropolregion Nürnberg'],
  [/\b(leipzig|halle)\b/i, 'Mitteldeutschland'],
  [/\bdresden\b/i, 'Region Dresden'],
  [/\bbremen\b/i, 'Bremen'],
  [/\b(mannheim|heidelberg|ludwigshafen|walldorf|weinheim)\b/i, 'Rhein-Neckar'],
  [/\bkarlsruhe\b/i, 'Region Karlsruhe'],
  [/\baugsburg\b/i, 'Region Augsburg'],
  [/\b(münster|bielefeld|paderborn|osnabrück|gütersloh)\b/i, 'Westfalen'],
  [/\b(freiburg)\b/i, 'Südbaden'],
  [/\b(regensburg|ingolstadt)\b/i, 'Bayern'],
  [/\b(kiel|lübeck)\b/i, 'Schleswig-Holstein'],
  [/\b(aachen)\b/i, 'Region Aachen'],
  [/\b(wien)\b/i, 'Wien'],
  [/\b(zürich|zuerich|basel|bern)\b/i, 'Schweiz'],
];

export interface Region { text: string; sicher: boolean; stadt: string | null }

/**
 * Region aus dem Arbeitsort. `sicher: false` heißt: Ort unbekannt, der
 * Headhunter soll die Region selbst prüfen (Fallback „Deutschland“).
 */
export function regionAus(location: unknown, remoteType?: unknown, lang?: Lang | null): Region {
  const ort = typeof location === 'string' ? location.trim() : '';
  if (remoteType === 'remote' && !ort) return { text: regionText('Remote', lang), sicher: true, stadt: null };
  for (const [muster, region] of REGIONEN) {
    const m = ort.match(muster);
    if (m) return { text: regionText(region, lang), sicher: true, stadt: m[0] };
  }
  // Schon grob formuliert („Region Süd (Bayern, …) – Home-Office-basiert“): ersten Teil nehmen.
  const grob = ort.split(/\s[–-]\s|\(/)[0].trim();
  if (/^(region|raum|großraum|bundesweit|deutschland|dach|remote)\b/i.test(grob)) return { text: grob, sicher: true, stadt: null };
  return { text: regionText(remoteType === 'remote' ? 'Remote' : 'Deutschland', lang), sicher: false, stadt: ort ? ort.split(/[,(]/)[0].trim() : null };
}

/** Rückfall-Region ohne bekannten Ort („Deutschland“) in der Sprache. */
export function regionUnbekannt(lang?: Lang | null): string {
  return regionText('Deutschland', lang);
}

// Allgemeine Branche in anderen Sprachen: [Name, „aus der …“]
const BRANCHEN_TEXT: Record<string, { en: [string, string]; sv: [string, string]; nb: [string, string] }> = {
  'Handel': { en: ['Retail & trade', 'in retail and trade'], sv: ['Handel', 'inom handeln'], nb: ['Handel', 'innen handel'] },
  'Software & IT': { en: ['Software & IT', 'in software and IT'], sv: ['Mjukvara & IT', 'inom mjukvara och IT'], nb: ['Programvare og IT', 'innen programvare og IT'] },
  'Finanzbranche': { en: ['Financial services', 'in financial services'], sv: ['Finansbranschen', 'inom finansbranschen'], nb: ['Finansbransjen', 'innen finansbransjen'] },
  'Beratung': { en: ['Consulting', 'in consulting'], sv: ['Konsultverksamhet', 'inom konsultbranschen'], nb: ['Rådgivning', 'innen rådgivning'] },
  'Gesundheitswesen': { en: ['Healthcare', 'in healthcare'], sv: ['Hälso- och sjukvård', 'inom hälso- och sjukvården'], nb: ['Helse', 'innen helsesektoren'] },
  'Energie': { en: ['Energy', 'in the energy sector'], sv: ['Energi', 'inom energibranschen'], nb: ['Energi', 'innen energibransjen'] },
  'Logistik': { en: ['Logistics', 'in logistics'], sv: ['Logistik', 'inom logistik'], nb: ['Logistikk', 'innen logistikk'] },
  'Bau & Immobilien': { en: ['Construction & real estate', 'in construction and real estate'], sv: ['Bygg & fastigheter', 'inom bygg och fastigheter'], nb: ['Bygg og eiendom', 'innen bygg og eiendom'] },
  'Industrie': { en: ['Industry', 'in industry'], sv: ['Industri', 'inom industrin'], nb: ['Industri', 'innen industrien'] },
  'öffentlicher Sektor': { en: ['public sector', 'in the public sector'], sv: ['offentlig sektor', 'inom offentlig sektor'], nb: ['offentlig sektor', 'i offentlig sektor'] },
  'Medien & Marketing': { en: ['Media & marketing', 'in media and marketing'], sv: ['Media & marknadsföring', 'inom media och marknadsföring'], nb: ['Medier og markedsføring', 'innen medier og markedsføring'] },
  'Telekommunikation': { en: ['Telecommunications', 'in telecommunications'], sv: ['Telekom', 'inom telekom'], nb: ['Telekom', 'innen telekom'] },
  'Konsumgüter': { en: ['Consumer goods', 'in consumer goods'], sv: ['Konsumentvaror', 'inom konsumentvaror'], nb: ['Forbruksvarer', 'innen forbruksvarer'] },
};

const BRANCHEN: [RegExp, string, string][] = [
  [/handel|e-commerce|distribution/i, 'Handel', 'aus dem Handel'],
  [/software|saas|informationstechn|\bit\b|it-|digital|cloud|cyber/i, 'Software & IT', 'aus der Software- und IT-Branche'],
  [/bank|versicher|finanz|fintech|zahlung|leasing|asset/i, 'Finanzbranche', 'aus der Finanzbranche'],
  [/steuerberat|wirtschaftsprüf|kanzlei|beratung|consulting/i, 'Beratung', 'aus der Beratung'],
  [/pharma|medizin|gesundheit|klinik|biotech|medtech|pflege|cannabis/i, 'Gesundheitswesen', 'aus dem Gesundheitswesen'],
  [/energie|versorg|stadtwerk|solar|wind/i, 'Energie', 'aus der Energiebranche'],
  [/logistik|transport|spedition|verkehr|bahn/i, 'Logistik', 'aus der Logistik'],
  [/bau|immobilie|architekt|facility/i, 'Bau & Immobilien', 'aus der Bau- und Immobilienbranche'],
  [/maschinenbau|anlagenbau|industrie|produktion|automotive|fertigung|elektrotechnik|chemie|metall/i, 'Industrie', 'aus der Industrie'],
  [/öffentlich|verwaltung|behörde|kommun/i, 'öffentlicher Sektor', 'aus dem öffentlichen Sektor'],
  [/medien|verlag|marketing|agentur|werbung/i, 'Medien & Marketing', 'aus der Medien- und Marketingbranche'],
  [/telekommunikation|telco|mobilfunk/i, 'Telekommunikation', 'aus der Telekommunikation'],
  [/lebensmittel|konsumgüter|fmcg|getränke/i, 'Konsumgüter', 'aus der Konsumgüterbranche'],
];

/** Branche allgemein: „Großhandel für Industriebedarf“ → Handel. Ohne Treffer: nichts. */
export function brancheAllgemein(industry: unknown, lang?: Lang | null): { name: string; aus: string } | null {
  const b = typeof industry === 'string' ? industry : '';
  if (!b.trim()) return null;
  for (const [muster, name, aus] of BRANCHEN) {
    if (!muster.test(b)) continue;
    const t = BRANCHEN_TEXT[name];
    return t
      ? { name: tr(lang, { de: name, en: t.en[0], sv: t.sv[0], nb: t.nb[0] }), aus: tr(lang, { de: aus, en: t.en[1], sv: t.sv[1], nb: t.nb[1] }) }
      : { name, aus };
  }
  return null;
}

/** „mittelständisches“ usw. aus Mitarbeiterzahl oder Größenband; ohne Angabe leer. */
export type GroesseStufe = 'klein' | 'mittel' | 'gross' | '';

/** Größe als Schlüssel (für übersetzte Sätze); ohne Angabe leer. */
export function groesseStufe(headcount: unknown, band: unknown): GroesseStufe {
  const wort = groesseWort(headcount, band);
  return wort === 'kleines' ? 'klein' : wort === 'mittelständisches' ? 'mittel' : wort === 'großes' ? 'gross' : '';
}

export function groesseWort(headcount: unknown, band: unknown): string {
  const n = typeof headcount === 'number' ? headcount : Number(headcount);
  let zahl = Number.isFinite(n) && n > 0 ? n : NaN;
  if (Number.isNaN(zahl) && typeof band === 'string') {
    const m = band.replace(/\./g, '').match(/\d+/);
    if (m) zahl = Number(m[0]);
  }
  if (Number.isNaN(zahl)) return '';
  if (zahl < 50) return 'kleines';
  if (zahl < 1000) return 'mittelständisches';
  return 'großes';
}

const GENERISCH = /^(gruppe|group|holding|deutschland|germany|international|service|services|consulting|solutions|partner|bank|stadtwerke|klinikum)$/i;

export interface AnonymKontext {
  firma?: string | null;
  redList?: unknown;
  domains?: (string | null | undefined)[];
  region: Region;
  /** Mitarbeiterzahl des Kunden, falls bekannt */
  mitarbeitende?: number | null;
  /** Sprache des Textes (Ersatz „das Unternehmen“); ohne Angabe Deutsch */
  lang?: Lang | null;
}

export type FundGrund = 'firma' | 'ort' | 'groesse';
export interface AnonymFund { treffer: string; grund: FundGrund; ersatz: string }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Begriffe, an denen man den Kunden erkennt: Name mit/ohne Rechtsform, erstes Wort, Sperrliste, Domain. */
export function kundenBegriffe(ctx: AnonymKontext): string[] {
  const begriffe = new Set(verboteneBegriffe(ctx.firma, ctx.redList, ctx.domains ?? []));
  const erstes = (ctx.firma ?? '').trim().split(/[\s&,-]+/)[0] ?? '';
  if (erstes.length >= 5 && !GENERISCH.test(erstes)) begriffe.add(erstes);
  return [...begriffe].sort((a, b) => b.length - a.length);
}

/** Was im Text den Kunden verrät, mit Vorschlag zum Ersetzen. */
export function anonymFunde(text: string, ctx: AnonymKontext): AnonymFund[] {
  const funde: AnonymFund[] = [];
  const gesehen = new Set<string>();
  for (const b of namensFunde([text], kundenBegriffe(ctx))) {
    const key = b.toLowerCase();
    if ([...gesehen].some(g => g.includes(key))) continue;
    gesehen.add(key);
    const m = text.match(new RegExp(escape(b), 'i'));
    funde.push({ treffer: m ? m[0] : b, grund: 'firma', ersatz: tr(ctx.lang, { de: 'das Unternehmen', en: 'the company', sv: 'företaget', nb: 'selskapet' }) });
  }
  const stadt = ctx.region.stadt;
  if (stadt && stadt.toLowerCase() !== ctx.region.text.toLowerCase()) {
    const m = text.match(new RegExp(`\\b${escape(stadt)}(?:\\s+am\\s+Main)?\\b`, 'i'));
    if (m && !ctx.region.text.toLowerCase().includes(m[0].toLowerCase())) funde.push({ treffer: m[0], grund: 'ort', ersatz: ctx.region.text });
  }
  const n = ctx.mitarbeitende;
  if (n && n > 0) {
    const zahl = `(?:${n}|${n.toLocaleString('de-DE')})`;
    const re = new RegExp(`(?:\\s*mit)?(?:\\s+(?:rund|ca\\.|über|etwa))?\\s+${zahl}\\s*(?:Mitarbeitende[n]?|Mitarbeiter(?:innen)?|Beschäftigte[n]?|MA)\\b`, 'i');
    const m = text.match(re);
    if (m) funde.push({ treffer: m[0], grund: 'groesse', ersatz: '' });
  }
  return funde;
}

/** Ersetzt alle Funde („Automatisch ersetzen“). */
export function ersetzeFunde(text: string, funde: AnonymFund[]): string {
  let aus = text;
  for (const f of funde) {
    if (f.grund === 'firma') {
      // „bei Bluewater“ fällt ganz weg; allein stehend wird daraus „das Unternehmen“.
      aus = aus.replace(new RegExp(`(\\b(?:bei|von|für|mit|im|in|beim|vom)\\s+)?${escape(f.treffer)}`, 'gi'), (_m, prep) => (prep ? '' : f.ersatz));
    } else {
      aus = aus.replace(new RegExp(escape(f.treffer), 'gi'), f.ersatz);
    }
  }
  return aus.replace(/[ \t]{2,}/g, ' ').replace(/ ([,.;:!?])/g, '$1');
}

const GRUND: Record<FundGrund, Texts> = {
  firma: { de: 'ist der Firmenname', en: 'is the company name', sv: 'är företagsnamnet', nb: 'er selskapsnavnet' },
  ort: { de: 'ist genauer als die Region', en: 'is more precise than the region', sv: 'är mer exakt än regionen', nb: 'er mer presist enn regionen' },
  groesse: { de: 'macht den Kunden auffindbar', en: 'makes the client identifiable', sv: 'gör kunden möjlig att identifiera', nb: 'gjør kunden mulig å identifisere' },
};

/** Warum ein Fund den Kunden verrät, in der Sprache der Person. */
export const grundText = (grund: FundGrund, lang?: Lang | null): string => tr(lang, GRUND[grund]);

/** Deutsch, für die Meldung der Function linkedin. */
export const GRUND_TEXT: Record<FundGrund, string> = {
  firma: GRUND.firma.de,
  ort: GRUND.ort.de,
  groesse: GRUND.groesse.de,
};
