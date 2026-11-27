// Texte des Website-Rahmens (Hinweisleiste, Sprachmenü, Fuß, Einwilligung) in den vier Grundsprachen.
// Deutsch ist die Quelle. Schwedisch und Norwegisch sind nicht muttersprachlich gegengelesen.
// Die Inhalte der Sektionen sind noch nur Deutsch – übersetzt wird nur der Rahmen.
import { schweiz, sprache, type Basis, type Code } from "./sprachen";

export type ZweckText = { name: string; text: string; dienst: string; zweck: string };
export type Texte = {
  menue: string; hinweisSchliessen: string;
  fuss: { impressum: string; datenschutz: string; agb: string; cookies: string; sprache: string };
  e1: { titel: string; text: string; ablehnen: string; einstellungen: string; akzeptieren: string };
  zentrale: {
    titel: string; intro: string; notwendig: string; notwendigText: string; immerAn: string;
    zwecke: { statistik: ZweckText; verbessern: ZweckText; werbung: ZweckText; firmen: ZweckText };
    dienst: string; zweck: string; dauer: string; dauerWert: string; empfaenger: string; empfaengerWert: string;
    /** {id} {zeit} {f} */
    idZeile: string; nochKeine: string; speichern: string; ablehnen: string; akzeptieren: string;
    schliessen: string; mehr: string; details: string;
  };
};

const DE: Texte = {
  menue: "Sprache wählen",
  hinweisSchliessen: "Hinweis schließen",
  fuss: { impressum: "Impressum", datenschutz: "Datenschutz", agb: "AGB", cookies: "Cookie-Einstellungen", sprache: "Sprache" },
  e1: {
    titel: "Helfen Sie uns, Matchunt besser zu machen",
    text: "Wir möchten verstehen, wie Sie die Seite nutzen und welche Anzeigen wirken. Dafür setzen wir Dienste ein, die Daten auch außerhalb der EU verarbeiten können. Sie entscheiden – jederzeit änderbar unter „Cookie-Einstellungen“ unten auf jeder Seite.",
    ablehnen: "Alle ablehnen", einstellungen: "Einstellungen", akzeptieren: "Alle akzeptieren",
  },
  zentrale: {
    titel: "Ihre Datenschutz-Einstellungen",
    intro: "Wählen Sie, was wir nutzen dürfen. Notwendiges ist immer an.",
    notwendig: "Notwendig", notwendigText: "Ihre Sprache und diese Auswahl merken", immerAn: "immer an",
    zwecke: {
      statistik: { name: "Statistik", text: "Besuche, Seiten und Klicks zählen, auch im Film oben", dienst: "noch offen (z. B. PostHog, Server in der EU)", zweck: "Besuche zählen, Wege und Absprünge verstehen" },
      verbessern: { name: "Seite verbessern", text: "Heatmaps und Sitzungs-Aufzeichnungen, Eingaben geschwärzt", dienst: "noch offen (z. B. Microsoft Clarity)", zweck: "sehen, wo die Seite hakt" },
      werbung: { name: "Werbung", text: "LinkedIn und Google: messen, ob Anzeigen wirken, und Sie dort wieder ansprechen", dienst: "LinkedIn Insight Tag, Google Ads (noch nicht eingebunden)", zweck: "Anzeigen messen und verbessern" },
      firmen: { name: "Firmen-Erkennung", text: "Welche Firma uns besucht, nie welche Person", dienst: "noch offen (z. B. Dealfront)", zweck: "Firmen erkennen, die sich für Matchunt interessieren" },
    },
    dienst: "Dienst", zweck: "Zweck", dauer: "Speicherdauer", dauerWert: "wird mit dem Dienst festgelegt",
    empfaenger: "Empfänger", empfaengerWert: "der jeweilige Anbieter",
    idZeile: "Einwilligungs-ID {id} · gespeichert am {zeit} · Fassung {f}", nochKeine: "Noch keine Auswahl gespeichert.",
    speichern: "Auswahl speichern", ablehnen: "Alle ablehnen", akzeptieren: "Alle akzeptieren",
    schliessen: "Schließen", mehr: "Mehr dazu in der Datenschutzerklärung", details: "Details",
  },
};

const EN: Texte = {
  menue: "Choose language",
  hinweisSchliessen: "Close notice",
  fuss: { impressum: "Legal notice", datenschutz: "Privacy", agb: "Terms", cookies: "Cookie settings", sprache: "Language" },
  e1: {
    titel: "Help us make Matchunt better",
    text: "We'd like to understand how you use this site and which ads work. For this we use services that may also process data outside the EU. It's your choice – you can change it any time under “Cookie settings” at the bottom of every page.",
    ablehnen: "Reject all", einstellungen: "Settings", akzeptieren: "Accept all",
  },
  zentrale: {
    titel: "Your privacy settings",
    intro: "Choose what we may use. Essentials are always on.",
    notwendig: "Essential", notwendigText: "Remember your language and this choice", immerAn: "always on",
    zwecke: {
      statistik: { name: "Statistics", text: "Count visits, pages and clicks, including the film at the top", dienst: "not chosen yet (e.g. PostHog, servers in the EU)", zweck: "Count visits, understand paths and drop-offs" },
      verbessern: { name: "Improve the site", text: "Heatmaps and session recordings, inputs masked", dienst: "not chosen yet (e.g. Microsoft Clarity)", zweck: "See where the site gets in the way" },
      werbung: { name: "Advertising", text: "LinkedIn and Google: measure whether ads work and show you our ads there again", dienst: "LinkedIn Insight Tag, Google Ads (not yet connected)", zweck: "Measure and improve ads" },
      firmen: { name: "Company recognition", text: "Which company visits us, never which person", dienst: "not chosen yet (e.g. Dealfront)", zweck: "Recognise companies interested in Matchunt" },
    },
    dienst: "Service", zweck: "Purpose", dauer: "Storage period", dauerWert: "set with the service",
    empfaenger: "Recipient", empfaengerWert: "the respective provider",
    idZeile: "Consent ID {id} · saved on {zeit} · version {f}", nochKeine: "No choice saved yet.",
    speichern: "Save choice", ablehnen: "Reject all", akzeptieren: "Accept all",
    schliessen: "Close", mehr: "More in the privacy policy", details: "Details",
  },
};

const SV: Texte = {
  menue: "Välj språk",
  hinweisSchliessen: "Stäng meddelandet",
  fuss: { impressum: "Juridisk information", datenschutz: "Integritet", agb: "Villkor", cookies: "Cookie-inställningar", sprache: "Språk" },
  e1: {
    titel: "Hjälp oss att göra Matchunt bättre",
    text: "Vi vill förstå hur du använder sidan och vilka annonser som fungerar. Därför använder vi tjänster som även kan behandla data utanför EU. Du bestämmer – och kan ändra det när som helst under ”Cookie-inställningar” längst ned på varje sida.",
    ablehnen: "Avvisa alla", einstellungen: "Inställningar", akzeptieren: "Godkänn alla",
  },
  zentrale: {
    titel: "Dina integritetsinställningar",
    intro: "Välj vad vi får använda. Nödvändiga är alltid på.",
    notwendig: "Nödvändiga", notwendigText: "Komma ihåg ditt språk och detta val", immerAn: "alltid på",
    zwecke: {
      statistik: { name: "Statistik", text: "Räkna besök, sidor och klick, även i filmen högst upp", dienst: "ännu inte vald (t.ex. PostHog, servrar i EU)", zweck: "Räkna besök, förstå vägar och avhopp" },
      verbessern: { name: "Förbättra sidan", text: "Värmekartor och sessionsinspelningar, inmatning maskerad", dienst: "ännu inte vald (t.ex. Microsoft Clarity)", zweck: "Se var sidan krånglar" },
      werbung: { name: "Annonsering", text: "LinkedIn och Google: mäta om annonser fungerar och visa dig våra annonser igen där", dienst: "LinkedIn Insight Tag, Google Ads (ännu inte anslutna)", zweck: "Mäta och förbättra annonser" },
      firmen: { name: "Företagsigenkänning", text: "Vilket företag som besöker oss, aldrig vilken person", dienst: "ännu inte vald (t.ex. Dealfront)", zweck: "Känna igen företag som är intresserade av Matchunt" },
    },
    dienst: "Tjänst", zweck: "Syfte", dauer: "Lagringstid", dauerWert: "fastställs med tjänsten",
    empfaenger: "Mottagare", empfaengerWert: "respektive leverantör",
    idZeile: "Samtyckes-ID {id} · sparat {zeit} · version {f}", nochKeine: "Inget val sparat ännu.",
    speichern: "Spara val", ablehnen: "Avvisa alla", akzeptieren: "Godkänn alla",
    schliessen: "Stäng", mehr: "Mer i integritetspolicyn", details: "Detaljer",
  },
};

const NB: Texte = {
  menue: "Velg språk",
  hinweisSchliessen: "Lukk meldingen",
  fuss: { impressum: "Juridisk informasjon", datenschutz: "Personvern", agb: "Vilkår", cookies: "Cookie-innstillinger", sprache: "Språk" },
  e1: {
    titel: "Hjelp oss å gjøre Matchunt bedre",
    text: "Vi vil forstå hvordan du bruker siden og hvilke annonser som virker. Derfor bruker vi tjenester som også kan behandle data utenfor EU. Du bestemmer – og kan endre det når som helst under «Cookie-innstillinger» nederst på hver side.",
    ablehnen: "Avvis alle", einstellungen: "Innstillinger", akzeptieren: "Godta alle",
  },
  zentrale: {
    titel: "Dine personverninnstillinger",
    intro: "Velg hva vi får bruke. Nødvendige er alltid på.",
    notwendig: "Nødvendige", notwendigText: "Huske språket ditt og dette valget", immerAn: "alltid på",
    zwecke: {
      statistik: { name: "Statistikk", text: "Telle besøk, sider og klikk, også i filmen øverst", dienst: "ikke valgt ennå (f.eks. PostHog, servere i EU)", zweck: "Telle besøk, forstå veier og frafall" },
      verbessern: { name: "Forbedre siden", text: "Varmekart og øktopptak, inndata maskert", dienst: "ikke valgt ennå (f.eks. Microsoft Clarity)", zweck: "Se hvor siden hakker" },
      werbung: { name: "Annonsering", text: "LinkedIn og Google: måle om annonser virker og vise deg annonsene våre igjen der", dienst: "LinkedIn Insight Tag, Google Ads (ikke koblet til ennå)", zweck: "Måle og forbedre annonser" },
      firmen: { name: "Bedriftsgjenkjenning", text: "Hvilken bedrift som besøker oss, aldri hvilken person", dienst: "ikke valgt ennå (f.eks. Dealfront)", zweck: "Gjenkjenne bedrifter som er interessert i Matchunt" },
    },
    dienst: "Tjeneste", zweck: "Formål", dauer: "Lagringstid", dauerWert: "fastsettes med tjenesten",
    empfaenger: "Mottaker", empfaengerWert: "den aktuelle leverandøren",
    idZeile: "Samtykke-ID {id} · lagret {zeit} · versjon {f}", nochKeine: "Ingen valg lagret ennå.",
    speichern: "Lagre valg", ablehnen: "Avvis alle", akzeptieren: "Godta alle",
    schliessen: "Lukk", mehr: "Mer i personvernerklæringen", details: "Detaljer",
  },
};

const NACH_BASIS: Record<Basis, Texte> = { de: DE, en: EN, sv: SV, nb: NB };

/** Rechtstexte liegen in der App und bleiben vorerst deutsch. */
export const RECHT = { impressum: "/impressum", datenschutz: "/datenschutz", agb: "/agb" };

/** Alle Zeichenketten eines Texte-Objekts umschreiben (für die Schweiz: ß → ss). */
function umschreiben<T>(wert: T, f: (s: string) => string): T {
  if (typeof wert === "string") return f(wert) as T;
  if (wert && typeof wert === "object") return Object.fromEntries(Object.entries(wert).map(([k, v]) => [k, umschreiben(v, f)])) as T;
  return wert;
}
const SCHWEIZ = umschreiben(DE, schweiz);

export function texte(code: Code): Texte {
  if (code === "de-CH") return SCHWEIZ;
  return NACH_BASIS[sprache(code).basis];
}

/** Platzhalter {name} ersetzen. */
export const fuellen = (vorlage: string, werte: Record<string, string | number>) =>
  vorlage.replace(/\{(\w+)\}/g, (_, k: string) => String(werte[k] ?? ""));

/** Datum und Uhrzeit in der Sprache der Seite. */
export function zeitText(iso: string, code: Code) {
  const region = code === "en" ? "en-GB" : code === "sv" ? "sv-SE" : code === "nb" ? "nb-NO" : code;
  try { return new Date(iso).toLocaleString(region, { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; }
}
