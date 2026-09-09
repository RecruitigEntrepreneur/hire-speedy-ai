import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  loadSynonymMap, normalizeSkillList, routeRequirements,
  type ClassifiedRequirement,
} from "../_shared/skills.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedJobData {
  // Basis-Felder
  title: string;
  company_name: string;
  description: string | null;
  requirements: string | null;
  location: string | null;
  remote_type: string | null;
  employment_type: string | null;
  experience_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  day_rate_min: number | null;
  day_rate_max: number | null;
  skills: string[];
  must_haves: string[];
  nice_to_haves: string[];
  requirements_classified?: ClassifiedRequirement[];
  required_languages?: { code: string; minLevel: string }[];
  required_certifications?: string[];
  experience_min?: number | null;
  
  // Team & Struktur
  team_size: number | null;
  reports_to: string | null;
  department_structure: string | null;
  
  // Arbeitsweise
  core_hours: string | null;
  remote_days: number | null;
  overtime_policy: string | null;
  daily_routine: string | null;
  task_focus: string | null;
  
  // Kultur & Benefits
  company_culture: string | null;
  benefits_extracted: string[];
  unique_selling_points: string[];
  career_path: string | null;
  
  // Dringlichkeit
  hiring_urgency: 'standard' | 'urgent' | 'hot' | null;
  vacancy_reason: string | null;
  hiring_deadline_weeks: number | null;
  
  // Industrie & Firma
  industry: string | null;
  company_size_estimate: string | null;

  /**
   * BEFUND (09.09.2026, Messlauf mit einer Anzeige, die zu JEDEM Katalogfeld
   * etwas sagte): 17 von 39 Feldern kamen an. Von den 22 Luecken fragte das
   * Schema 20 gar nicht ab -- das Modell hatte alles gelesen, es wurde nur
   * nicht danach gefragt. Die folgenden Felder schliessen genau diese Luecke.
   *
   * Alle nullable und alle in `required`: ein Feld, das mal da ist und mal
   * nicht, ist schlimmer als eines, das fehlt.
   */
  salary_months: number | null;
  bonus_percent: number | null;
  bonus_basis: string[] | null;
  contract_limitation: string | null;
  time_tracking_method: string | null;
  works_council: boolean | null;
  works_council_meeting_schedule: string | null;
  contract_creation_days: number | null;
  contract_sent_digitally: boolean | null;
  negative_impact_if_unfilled: string | null;
  task_breakdown: Record<string, number> | null;
  decision_makers: string[] | null;
  success_profile: string | null;
  failure_profile: string | null;
  position_advantages: string[] | null;
  career_example: string | null;
  contract_sensitive_topics: string[] | null;
  industry_opportunities: string | null;
  industry_challenges: string | null;
  candidates_in_pipeline: number | null;
  candidates_dropped_reason: string | null;
  visa_sponsorship: boolean | null;
}

/**
 * Zieladressen fuer ausgehende Abrufe pruefen.
 *
 * Blockiert Nicht-HTTP-Schemata (file:, gopher:, data:) und alle Adressen, die
 * auf das eigene Netz zeigen. Eine DNS-Aufloesung findet hier bewusst nicht
 * statt: sie kaeme mit einem Rebinding-Fenster zwischen Pruefung und Abruf und
 * mit spuerbarer Latenz. Die Hostnamenpruefung deckt die realistischen Faelle
 * ab; darueber hinaus schuetzt die Rate-Begrenzung in intake-ai.
 */
const PRIVATE_HOST_PATTERN = new RegExp(
  [
    "^localhost$", "^127\\.", "^0\\.", "^10\\.", "^192\\.168\\.",
    "^172\\.(1[6-9]|2[0-9]|3[01])\\.", "^169\\.254\\.",
    "^\\[?::1\\]?$", "^\\[?fc", "^\\[?fd", "^\\[?fe80:",
    "\\.local$", "\\.internal$", "^metadata",
  ].join("|"),
  "i",
);

function validateOutboundUrl(raw: string): { ok: boolean; url?: URL; message?: string } {
  let url: URL;
  try {
    url = new URL(String(raw).trim());
  } catch {
    return { ok: false, message: "Ungültige Adresse." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, message: "Nur http- und https-Adressen werden geladen." };
  }
  if (PRIVATE_HOST_PATTERN.test(url.hostname) || !url.hostname.includes(".")) {
    return { ok: false, message: "Diese Adresse kann nicht geladen werden." };
  }
  return { ok: true, url };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { jobUrl, jobText } = await req.json();

    if (!jobUrl && !jobText) {
      return new Response(
        JSON.stringify({ error: "Either jobUrl or jobText is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let contentToAnalyze = jobText || "";

    // Fetch the job posting page if URL provided
    if (jobUrl) {
      // SSRF-Haertung: Diese Function fetchte bisher die URL aus dem
      // Request-Body ungeprueft. Ueber den Gast-Proxy intake-ai ist sie jetzt
      // mittelbar aus dem offenen Netz erreichbar -- ohne diese Pruefung waere
      // sie ein Werkzeug fuer Cloud-Metadaten (169.254.169.254) und interne
      // Hosts, deren Inhalt an den Aufrufer zurueckfliesst.
      const guard = validateOutboundUrl(jobUrl);
      if (!guard.ok) {
        return new Response(JSON.stringify({ error: guard.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Fetching job URL:", guard.url!.hostname);
      try {
        const pageResponse = await fetch(guard.url!.toString(), {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; JobParser/1.0)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          },
          redirect: "follow",
          signal: AbortSignal.timeout(15_000),
        });
        
        if (pageResponse.ok) {
          const html = await pageResponse.text();
          // Strip HTML tags for basic text extraction
          contentToAnalyze = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 15000); // Limit to avoid token limits
        } else {
          console.warn("Failed to fetch URL, will analyze URL pattern");
          contentToAnalyze = `Job posting URL: ${jobUrl}`;
        }
      } catch (fetchError) {
        console.warn("Error fetching URL:", fetchError);
        contentToAnalyze = `Job posting URL: ${jobUrl}`;
      }
    }

    console.log("Parsing job posting with Lovable AI...");

    const systemPrompt = `Du bist ein erfahrener HR-Experte und Stellenanzeigen-Analyst. Analysiere die Stellenanzeige und extrahiere ALLE verfügbaren Informationen.

PFLICHT-FELDER:
- title: Jobtitel (PFLICHT)
- company_name: Firmenname. Steht keiner im Text, gib null -- NIEMALS "Unbekannt",
  "N/A" oder einen anderen Platzhalter. Der Wert landet in einem Pflichtfeld und
  spaeter auf der Vereinbarung; ein Platzhalter sieht dort aus wie eine Angabe,
  und niemand korrigiert ein gefuelltes Feld.
- description: Vollständige Stellenbeschreibung
- requirements: Anforderungen an den Kandidaten
- location: Standort/Stadt
- remote_type: "onsite", "hybrid" oder "remote"
- employment_type: "full-time", "part-time", "contract" oder "freelance"
- experience_level: "junior", "mid", "senior" oder "lead"
- salary_min: Minimum Gehalt (nur Zahl in EUR, JAEHRLICH). Nur bei Festanstellung.
- salary_max: Maximum Gehalt (nur Zahl in EUR, JAEHRLICH). Nur bei Festanstellung.
- day_rate_min / day_rate_max: Tagessatz in EUR, falls die Anzeige einen nennt
  ("850 EUR/Tag", "Tagessatz 700-900", "Daily Rate 900"). NIEMALS einen
  Tagessatz nach salary_min/salary_max schreiben -- eine Contracting-Anzeige
  mit "850 EUR Tagessatz" wuerde dort als Jahresgehalt von 850 EUR gelesen.
  Umgekehrt gehoert ein Jahresgehalt nie in day_rate_*.
- skills: Array von erforderlichen technischen Skills
- requirements_classified: DAS WICHTIGSTE FELD. Zerlege den Anforderungsteil der
  Anzeige Satz fuer Satz und ordne JEDES Kriterium einer Klasse zu. Ein Satz
  enthaelt oft mehrere Kriterien -- dann gib mehrere Eintraege aus.
    technology  = Sprache, Framework, Werkzeug, Plattform (C#, Kubernetes, SAP)
    method      = Vorgehen, Praxis (CI/CD, Scrum, Infrastructure as Code)
    domain      = Fachgebiet (Serienentwicklung, Verpackungsmaschinen, FI/CO)
    language    = natuerliche Sprache -> language_code + language_level (A1-C2)
    certification = Zertifikat, Zulassung, Fuehrerschein
    education   = Studium, Ausbildung, Abschluss
    experience  = "X Jahre Berufserfahrung" -> min_years
    soft        = Persoenlichkeit, Haltung, Arbeitsweise
  Je Eintrag: text (Wortlaut aus der Anzeige), kind, skill (NUR bei
  technology/method/domain: der kurze Name, hoechstens 3 Woerter),
  required (true = Muss, false = Kann/wuenschenswert), min_years falls genannt.
  Beispiel: "Fundierte Erfahrung in DevSecOps, CI/CD und Container" ergibt
  DREI Eintraege mit kind=method bzw. technology und je einem kurzen skill.
  "Sehr gute Deutsch- und Englischkenntnisse" ergibt ZWEI Eintraege mit
  kind=language. "Ganzheitliches Denkvermoegen" ist kind=soft und bekommt
  KEINEN skill.
- must_haves: KURZE, PRUEFBARE Muss-Kriterien. Jeder Eintrag hoechstens 5 Woerter
  und einzeln pruefbar -- ein Recruiter muss "hat der Kandidat das: ja/nein"
  beantworten koennen. Ein Satz aus der Anzeige wird in seine Kriterien zerlegt:
    "Fundierte Erfahrung in DevSecOps, CI/CD, Infrastructure as Code und Container"
      -> ["DevSecOps", "CI/CD", "Infrastructure as Code", "Container"]
    "Sehr gute Sprachkenntnisse in Deutsch und Englisch"
      -> ["Deutsch verhandlungssicher", "Englisch verhandlungssicher"]
  NICHT uebernehmen: Persoenlichkeitsfloskeln ohne pruefbaren Kern
  ("ganzheitliches Denkvermoegen", "Freude an der Zusammenarbeit",
  "hohe Eigenverantwortung"). Die gehoeren nach requirements, nicht hierher --
  sie sind nicht pruefbar und blaehen die Muss-Liste auf.
  Hoechstens 8 Eintraege. Ist die Anzeige laenger, nimm die 8 wichtigsten.
- nice_to_haves: Kann-Kriterien, gleiche Form und Laenge wie must_haves
- requirements: der VOLLSTAENDIGE Anforderungstext der Anzeige im Fliesstext.
  Hier gehoert alles hinein, was in must_haves zu lang oder zu weich war --
  nichts geht verloren, es steht nur an der richtigen Stelle.

TEAM & STRUKTUR (falls erwähnt):
- team_size: Zahl (z.B. "12-köpfiges Team" → 12)
- reports_to: An wen die AUSGESCHRIEBENE POSITION berichtet -- nicht, an wen der
  Verfasser des Textes berichtet. Schreibt jemand "ich bin Leiter Instandhaltung
  und berichte an den Werkleiter", dann berichtet der Kandidat an den LEITER
  INSTANDHALTUNG, nicht an den Werkleiter. Ist die Vorgesetztenrolle nicht
  eindeutig, gib null.
- department_structure: String (z.B. "Teil des Finance-Teams")

ARBEITSWEISE (falls erwähnt):
- core_hours: String (z.B. "Kernarbeitszeit 10-16 Uhr", "flexibel Mo-Fr")
- remote_days: Zahl (z.B. "2 Tage Home Office" → 2, "mobiles Arbeiten möglich" → 1)
- overtime_policy: String (z.B. "keine Überstunden", "Gleitzeitkonto")
- daily_routine: Wie ein Arbeitstag in dieser Rolle konkret ablaeuft -- woran
  die Person arbeitet, mit wem sie sich abstimmt, was wiederkehrt. Zwei bis
  vier Saetze in eigenen Worten, aus dem Aufgabenteil der Anzeige. Steht dort
  nur eine Aufgabenliste, fasse sie als Ablauf zusammen. Nur null, wenn die
  Anzeige ueber die Taetigkeit gar nichts sagt.
- task_focus: WORAUF die Stelle im Kern hinauslaeuft. Genau EINER dieser vier
  Werte, woertlich:
    "Operativ / hands-on"        = macht die Arbeit selbst
    "Steuernd / koordinierend"   = plant, stimmt ab, haelt zusammen
    "Aufbauend / verändernd"     = baut Neues auf, loest Bestehendes ab
    "Führend / entwickelnd"      = fuehrt Menschen, entwickelt sie weiter
  Im Zweifel null. Lieber nichts als ein falscher Schwerpunkt -- der Kunde
  bekommt die Frage dann im Gespraech.

KULTUR & BENEFITS:
- company_culture: String (Tonfall der Anzeige, Du/Sie-Kultur, Werte)
- benefits_extracted: Array ALLER genannten Benefits (Deutschlandticket, Fitness, etc.)
- unique_selling_points: Array der Gruende, WARUM jemand diese Stelle nimmt --
  aus Sicht des Kandidaten. Also: Technologie, Gestaltungsspielraum, Team,
  Produkt, Marktposition, Entwicklungsperspektive.
  KEINE Aufgabenbeschreibungen. "Verantwortung fuer CI/CD-Pipelines" ist eine
  Aufgabe und gehoert nach description, nicht hierher. "Greenfield-Plattform
  mit AI-Toolchain in einem 10.000-Mitarbeiter-Konzern" ist ein Grund.
- career_path: String (Entwicklungsmöglichkeiten, Aufstiegschancen)

DRINGLICHKEIT:
- hiring_urgency: "standard" | "urgent" | "hot"
  - "hot" = "sofort", "ab sofort", "schnellstmöglich"
  - "urgent" = "zum nächstmöglichen Zeitpunkt", "baldmöglichst"
  - "standard" = kein Zeitdruck erkennbar
- vacancy_reason: String (Nachfolge, Wachstum, neues Team, etc.)
- hiring_deadline_weeks: Zahl (falls Frist genannt)

INDUSTRIE & FIRMA:
- industry: String (z.B. "Fitness", "Finance", "IT", "Healthcare")
WAS DIE ANZEIGE SONST NOCH SAGT (falls erwaehnt, sonst null):

Diese Felder standen bis 09.09.2026 nicht im Schema. Gemessen an einer Anzeige,
die zu jedem davon etwas sagte, kam nichts an -- nicht weil der Text fehlte,
sondern weil niemand gefragt hat. Lies sie mit derselben Sorgfalt wie den Rest.

WICHTIG fuer alle: Der Wortlaut der Anzeige muss NICHT dem hier genannten
Beispiel gleichen. Gib zurueck, was dasteht -- die Zuordnung auf feste
Auswahlwerte passiert danach. Erfinde nichts; steht es nicht da, gib null.

- salary_months: Auf wie viele Monatsgehaelter sich das Fixum verteilt.
  "13. Gehalt" -> 13, "13,5 Gehaelter" -> 13.5, "12 plus Urlaubsgeld" -> 12.5.
- bonus_percent: Obergrenze der variablen Verguetung in Prozent. "Bonus bis
  15 %" -> 15, "Tantieme von bis zu einem Monatsgehalt" -> 8.
- bonus_basis: Woran der Bonus haengt, als Liste. z.B. ["Unternehmensergebnis",
  "persoenliche Ziele"].
- contract_limitation: Befristung des ARBEITSVERTRAGS -- nicht Voll-/Teilzeit.
  "unbefristet", "zunaechst auf zwei Jahre befristet", "befristet mit Aussicht
  auf Uebernahme", "Projektvertrag". Woertlich, wie es dasteht.
- time_tracking_method: Wie Arbeitszeit erfasst wird. "digitale Zeiterfassung",
  "Stempeluhr", "Vertrauensarbeitszeit ohne Erfassung".
- works_council: true, wenn ein Betriebsrat, Personalrat oder eine
  Mitarbeitervertretung erwaehnt wird. false nur bei ausdruecklicher
  Verneinung. Sonst null.
- works_council_meeting_schedule: Wie oft er tagt. "monatlich", "alle zwei
  Wochen", "nach Bedarf".
- contract_creation_days: Arbeitstage von der Zusage bis zum Vertrag.
  "Vertrag binnen drei Tagen" -> 3, "innerhalb einer Woche" -> 7.
- contract_sent_digitally: true bei "digital zur Unterschrift", "per
  DocuSign", "elektronisch"; false bei "postalisch".
- negative_impact_if_unfilled: Was passiert, wenn die Stelle laenger offen
  bleibt. Oft in "Warum wir suchen" oder "Ihre Chance".
- task_breakdown: Prozentuale Gewichtung der Aufgaben als Objekt, z.B.
  {"Fuehrung": 60, "Projektarbeit": 30, "Betrieb": 10}. Nur wenn die Anzeige
  Anteile nennt.
- decision_makers: Wer ausser der Fuehrungskraft ueber die Einstellung
  entscheidet, als Liste. "Bereichsleitung und Personalabteilung entscheiden
  gemeinsam" -> ["Bereichsleitung", "Personalabteilung"].
- success_profile: Welcher Menschentyp in diesem Unternehmen Erfolg hat.
  Abschnitte wie "Wer zu uns passt", "Das zeichnet Sie aus" -- ABER nur, wenn
  es ueber Fachliches hinausgeht (Arbeitsweise, Haltung, Umgang).
- failure_profile: Woran Vorgaenger oder Bewerber gescheitert sind. Selten,
  meist als Warnung formuliert ("Wer auf Anweisungen wartet, ist hier falsch").
- position_advantages: Vorteile DIESER STELLE, die ein Fachmann schaetzt --
  getrennt von unique_selling_points, die dem UNTERNEHMEN gelten. "Keine
  Rufbereitschaft", "kein Reisedruck", "volle Verantwortung ab Tag eins".
  Nennt die Anzeige beides in getrennten Abschnitten, trenne es auch hier.
- career_example: Ein KONKRETER genannter Aufstieg, mit Person oder Jahr.
  "Ein Kollege ist 2024 vom Techniker zum Projektleiter geworden."
- contract_sensitive_topics: Vertragsklauseln, die Kandidaten abschrecken
  koennen, als Liste. Wettbewerbsverbot, Rueckzahlungsklausel bei
  Weiterbildung, Bereitschaftsdienst, Reisepflicht, Umzugspflicht.
- industry_opportunities: Was in der BRANCHE gerade gut laeuft.
- industry_challenges: Womit die Branche gerade kaempft. Beides steht oft im
  selben Absatz -- lies beide, nicht nur das Positive.
- candidates_in_pipeline: Zahl der Kandidaten, die laut Anzeige schon im
  Verfahren sind.
- candidates_dropped_reason: Warum Kandidaten abgesprungen sind.
- visa_sponsorship: true bei "wir unterstuetzen bei der Visabeschaffung",
  false bei "Arbeitserlaubnis muss vorliegen" oder "kein Visa-Sponsoring".

- company_size_estimate: Mitarbeiterzahl des Unternehmens. Wenn die Anzeige eine
  Zahl oder Spanne nennt, gib sie so wieder ("340", "51-200", "ueber 1000").
  Nur wenn keine Zahl dasteht, ein Wort: "Startup", "Mittelstand", "Konzern".
  Das ist die Groesse der FIRMA, nicht die des Teams -- die steht in team_size.

WICHTIGE REGELN:
- Extrahiere NUR was explizit im Text steht oder klar ableitbar ist
- Nutze Kontext-Hinweise (z.B. "Du" vs "Sie" für Kultur-Einschätzung)
- Bei Gehaltsangaben pro Monat multipliziere mit 12
- Setze fehlende Informationen auf null oder leere Arrays
- Bei Benefits: Extrahiere JEDEN genannten Vorteil einzeln`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analysiere diese Stellenanzeige:\n\n${contentToAnalyze}` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_job_data",
              description: "Extrahiert ALLE strukturierten Daten aus einer Stellenanzeige",
              parameters: {
                type: "object",
                properties: {
                  // Basis-Felder
                  title: { type: "string" },
                  company_name: { type: "string" },
                  description: { type: "string", nullable: true },
                  requirements: { type: "string", nullable: true },
                  location: { type: "string", nullable: true },
                  remote_type: { 
                    type: "string", 
                    enum: ["onsite", "hybrid", "remote"],
                    nullable: true 
                  },
                  employment_type: { 
                    type: "string", 
                    enum: ["full-time", "part-time", "contract", "freelance"],
                    nullable: true 
                  },
                  experience_level: { 
                    type: "string", 
                    enum: ["junior", "mid", "senior", "lead"],
                    nullable: true 
                  },
                  salary_min: { type: "number", nullable: true },
                  salary_max: { type: "number", nullable: true },
                  day_rate_min: { type: "number", nullable: true },
                  day_rate_max: { type: "number", nullable: true },
                  skills: { type: "array", items: { type: "string" } },
                  requirements_classified: {
                    type: "array",
                    description: "Jedes Kriterium der Anzeige einzeln, mit seiner Klasse. Ein Satz kann mehrere Eintraege ergeben.",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "Wortlaut aus der Anzeige" },
                        kind: {
                          type: "string",
                          enum: ["technology", "method", "domain", "language",
                                 "certification", "education", "experience", "soft"],
                        },
                        skill: { type: "string", nullable: true, description: "Nur bei technology/method/domain: kurzer Name, hoechstens 3 Woerter" },
                        required: { type: "boolean", description: "true = Muss, false = Kann" },
                        min_years: { type: "integer", nullable: true },
                        language_code: { type: "string", nullable: true },
                        language_level: { type: "string", nullable: true },
                      },
                      required: ["text", "kind"],
                    },
                  },
                  must_haves: {
                    type: "array",
                    description: "Kurze, einzeln pruefbare Muss-Kriterien, hoechstens 5 Woerter je Eintrag und hoechstens 8 Eintraege. Keine Persoenlichkeitsfloskeln.",
                    items: { type: "string" },
                  },
                  nice_to_haves: {
                    type: "array",
                    description: "Kann-Kriterien, gleiche Form wie must_haves.",
                    items: { type: "string" },
                  },
                  
                  // Team & Struktur
                  team_size: { type: "integer", nullable: true },
                  reports_to: { type: "string", nullable: true },
                  department_structure: { type: "string", nullable: true },
                  
                  // Arbeitsweise
                  core_hours: { type: "string", nullable: true },
                  remote_days: { type: "integer", nullable: true },
                  overtime_policy: { type: "string", nullable: true },
                  daily_routine: { type: "string", nullable: true },
                  task_focus: {
                    type: "string",
                    enum: ["Operativ / hands-on", "Steuernd / koordinierend",
                           "Aufbauend / verändernd", "Führend / entwickelnd"],
                    nullable: true,
                  },
                  
                  // Kultur & Benefits
                  company_culture: { type: "string", nullable: true },
                  benefits_extracted: { type: "array", items: { type: "string" } },
                  unique_selling_points: {
                    type: "array",
                    description: "Gruende aus Kandidatensicht, warum man diese Stelle nimmt. Keine Aufgabenbeschreibungen.",
                    items: { type: "string" },
                  },
                  career_path: { type: "string", nullable: true },
                  
                  // Dringlichkeit
                  hiring_urgency: { 
                    type: "string", 
                    enum: ["standard", "urgent", "hot"],
                    nullable: true 
                  },
                  vacancy_reason: { type: "string", nullable: true },
                  hiring_deadline_weeks: { type: "integer", nullable: true },
                  
                  // Industrie & Firma
                  industry: { type: "string", nullable: true },
                  company_size_estimate: { type: "string", nullable: true },

                  // ---- Konditionen -------------------------------------
                  salary_months: { type: "number", nullable: true },
                  bonus_percent: { type: "number", nullable: true },
                  bonus_basis: { type: "array", items: { type: "string" }, nullable: true },
                  contract_limitation: { type: "string", nullable: true },

                  // ---- Arbeitszeit und Mitbestimmung -------------------
                  time_tracking_method: { type: "string", nullable: true },
                  works_council: { type: "boolean", nullable: true },
                  works_council_meeting_schedule: { type: "string", nullable: true },
                  contract_creation_days: { type: "integer", nullable: true },
                  contract_sent_digitally: { type: "boolean", nullable: true },

                  // ---- Rolle und Prozess ------------------------------
                  negative_impact_if_unfilled: { type: "string", nullable: true },
                  task_breakdown: { type: "object", nullable: true },
                  decision_makers: { type: "array", items: { type: "string" }, nullable: true },
                  success_profile: { type: "string", nullable: true },
                  failure_profile: { type: "string", nullable: true },

                  // ---- Verkauf, Vertrag, Branche ----------------------
                  position_advantages: { type: "array", items: { type: "string" }, nullable: true },
                  career_example: { type: "string", nullable: true },
                  contract_sensitive_topics: { type: "array", items: { type: "string" }, nullable: true },
                  industry_opportunities: { type: "string", nullable: true },
                  industry_challenges: { type: "string", nullable: true },

                  // ---- Stand des Verfahrens ---------------------------
                  candidates_in_pipeline: { type: "integer", nullable: true },
                  candidates_dropped_reason: { type: "string", nullable: true },
                  visa_sponsorship: { type: "boolean", nullable: true }
                },
                /*
                  BEFUND (07.09.2026, gemessen am deployten Stand): Bei
                  DERSELBEN Anzeige mit einem vollstaendigen Abschnitt "IHR
                  ARBEITSALLTAG" kam `daily_routine` in einem Lauf zurueck und
                  im naechsten gar nicht -- nicht null, sondern der Schluessel
                  fehlte. Nullable ohne `required` heisst fuer das Modell: darf
                  ich weglassen, und ob es weglaesst, ist Zufall. Betroffen war
                  ausgerechnet das Feld hinter Markos wichtigster Frage
                  ("Koennen Sie mir ein Bild des Arbeitsalltags malen?");
                  company_culture und career_path kamen im selben Aufruf durch.

                  Ein Feld, das mal da ist und mal nicht, ist schlimmer als
                  eines, das fehlt: es sieht im Test funktionierend aus.

                  Alle Briefing-Felder sind nullable. `required` zwingt also
                  nicht zum Erfinden, sondern nur zum Antworten -- notfalls
                  mit null.
                */
                required: ["title", "company_name", "skills", "must_haves", "nice_to_haves",
                           "benefits_extracted", "unique_selling_points", "requirements_classified",
                           "daily_routine", "task_focus", "team_size", "reports_to",
                           "core_hours", "remote_days", "overtime_policy",
                           "company_culture", "career_path",
                           "vacancy_reason", "hiring_urgency", "company_size_estimate",
                           "industry",
                           "salary_months", "bonus_percent", "contract_limitation",
                           "time_tracking_method", "works_council", "contract_creation_days",
                           "negative_impact_if_unfilled", "decision_makers",
                           "success_profile", "failure_profile", "position_advantages",
                           "contract_sensitive_topics",
                           "industry_opportunities", "industry_challenges"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_job_data" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received");

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in response");
    }

    const parsedJob: ParsedJobData = JSON.parse(toolCall.function.arguments);

    // ---- Einordnen und kanonisieren ---------------------------------------
    // Das Modell liefert die Klassifikation; hier wird sie auf die Zielfelder
    // verteilt und gegen skill_synonyms kanonisiert -- dieselbe Tabelle, die
    // calculate-match-v3-1 laedt. Ohne diesen Schritt landen ganze Saetze in
    // jobs.must_haves, und der Matcher haelt sie fuer Skillnamen: sie zaehlen
    // gegen die mustHaveCoverage und druecken den Score jedes Kandidaten.
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      const synonyms = await loadSynonymMap(supabase);

      const classified = Array.isArray(parsedJob.requirements_classified)
        ? parsedJob.requirements_classified
        : [];

      if (classified.length > 0) {
        const routed = routeRequirements(classified, synonyms);
        parsedJob.must_haves = routed.mustHaves;
        parsedJob.nice_to_haves = routed.niceToHaves;
        // Frei genannte Skills bleiben erhalten, ergaenzen aber nur.
        parsedJob.skills = normalizeSkillList(
          [...routed.skills, ...(parsedJob.skills ?? [])], synonyms,
        );
        parsedJob.required_languages = routed.requiredLanguages;
        parsedJob.required_certifications = routed.requiredCertifications;
        parsedJob.experience_min = routed.experienceMin;

        // Was nicht matchbar ist, geht nicht verloren -- es steht im
        // Anforderungstext, nur eben nicht in der Muss-Liste.
        if (routed.narrative.length > 0) {
          const existing = (parsedJob.requirements ?? "").trim();
          const added = routed.narrative.map((n) => `- ${n}`).join("\n");
          parsedJob.requirements = existing ? `${existing}\n\n${added}` : added;
        }
      } else {
        // Kein Klassifikationsergebnis: wenigstens trennen und kanonisieren.
        parsedJob.skills = normalizeSkillList(parsedJob.skills, synonyms);
        parsedJob.must_haves = normalizeSkillList(parsedJob.must_haves, synonyms, 8);
        parsedJob.nice_to_haves = normalizeSkillList(parsedJob.nice_to_haves, synonyms, 12);
      }
    } catch (e) {
      // Die Aufbereitung darf die Extraktion nicht scheitern lassen -- ein
      // unkanonisiertes Ergebnis ist besser als gar keines.
      console.warn("Skill-Aufbereitung uebersprungen:", e);
    }

    console.log("Job parsed successfully:", {
      title: parsedJob.title,
      company: parsedJob.company_name,
      skills_count: parsedJob.skills?.length,
      must_haves_count: parsedJob.must_haves?.length,
      classified_count: parsedJob.requirements_classified?.length,
    });

    return new Response(
      JSON.stringify({ success: true, data: parsedJob }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error parsing job:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
