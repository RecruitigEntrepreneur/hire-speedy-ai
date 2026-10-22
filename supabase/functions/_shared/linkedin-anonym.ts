// Anonymität für öffentliche LinkedIn-Beiträge (21.10.2026).
//
// Öffentlich gilt strenger als in der Anzeige an einen einzelnen Kandidaten:
// Branche + Stadt + Mitarbeiterzahl zusammen machen einen Kunden auffindbar.
// Deshalb Region statt Stadt, Branche allgemein, keine Mitarbeiterzahl, und
// keine Spur des Firmennamens (auch nicht des ersten Wortes oder der Domain).
// Gemeinsam genutzt von der Vorschau (Frontend) und der Prüfung vor dem
// Posten (Function) – reine Funktionen ohne Datenbank.
import { namensFunde, verboteneBegriffe } from './recruiter-anzeige.ts';

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
export function regionAus(location: unknown, remoteType?: unknown): Region {
  const ort = typeof location === 'string' ? location.trim() : '';
  if (remoteType === 'remote' && !ort) return { text: 'Remote', sicher: true, stadt: null };
  for (const [muster, region] of REGIONEN) {
    const m = ort.match(muster);
    if (m) return { text: region, sicher: true, stadt: m[0] };
  }
  // Schon grob formuliert („Region Süd (Bayern, …) – Home-Office-basiert“): ersten Teil nehmen.
  const grob = ort.split(/\s[–-]\s|\(/)[0].trim();
  if (/^(region|raum|großraum|bundesweit|deutschland|dach|remote)\b/i.test(grob)) return { text: grob, sicher: true, stadt: null };
  return { text: remoteType === 'remote' ? 'Remote' : 'Deutschland', sicher: false, stadt: ort ? ort.split(/[,(]/)[0].trim() : null };
}

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
export function brancheAllgemein(industry: unknown): { name: string; aus: string } | null {
  const b = typeof industry === 'string' ? industry : '';
  if (!b.trim()) return null;
  for (const [muster, name, aus] of BRANCHEN) if (muster.test(b)) return { name, aus };
  return null;
}

/** „mittelständisches“ usw. aus Mitarbeiterzahl oder Größenband; ohne Angabe leer. */
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
    funde.push({ treffer: m ? m[0] : b, grund: 'firma', ersatz: 'das Unternehmen' });
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

export const GRUND_TEXT: Record<FundGrund, string> = {
  firma: 'ist der Firmenname',
  ort: 'ist genauer als die Region',
  groesse: 'macht den Kunden auffindbar',
};
