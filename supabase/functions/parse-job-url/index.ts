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
  skills: string[];
  must_haves: string[];
  nice_to_haves: string[];
  requirements_classified?: ClassifiedRequirement[];
  required_languages?: { code: string; minLevel: string }[];
  required_certifications?: string[];
  experience_min?: number | null;
  
  // Team & Struktur
  team_size: number | null;
  team_avg_age: string | null;
  reports_to: string | null;
  department_structure: string | null;
  
  // Arbeitsweise
  core_hours: string | null;
  remote_days: number | null;
  overtime_policy: string | null;
  daily_routine: string | null;
  
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
- company_name: Firmenname (PFLICHT, falls nicht erkennbar: "Unbekannt")
- description: Vollständige Stellenbeschreibung
- requirements: Anforderungen an den Kandidaten
- location: Standort/Stadt
- remote_type: "onsite", "hybrid" oder "remote"
- employment_type: "full-time", "part-time", "contract" oder "freelance"
- experience_level: "junior", "mid", "senior" oder "lead"
- salary_min: Minimum Gehalt (nur Zahl in EUR, jährlich)
- salary_max: Maximum Gehalt (nur Zahl in EUR, jährlich)
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
- team_avg_age: String (z.B. "junges dynamisches Team" → "25-35")
- reports_to: String (z.B. "berichtet an CFO", "Teamleitung")
- department_structure: String (z.B. "Teil des Finance-Teams")

ARBEITSWEISE (falls erwähnt):
- core_hours: String (z.B. "Kernarbeitszeit 10-16 Uhr", "flexibel Mo-Fr")
- remote_days: Zahl (z.B. "2 Tage Home Office" → 2, "mobiles Arbeiten möglich" → 1)
- overtime_policy: String (z.B. "keine Überstunden", "Gleitzeitkonto")
- daily_routine: String (z.B. "typischer Arbeitstag...")

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
- company_size_estimate: String (z.B. "Startup", "51-200", "Konzern")

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
                  team_avg_age: { type: "string", nullable: true },
                  reports_to: { type: "string", nullable: true },
                  department_structure: { type: "string", nullable: true },
                  
                  // Arbeitsweise
                  core_hours: { type: "string", nullable: true },
                  remote_days: { type: "integer", nullable: true },
                  overtime_policy: { type: "string", nullable: true },
                  daily_routine: { type: "string", nullable: true },
                  
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
                  company_size_estimate: { type: "string", nullable: true }
                },
                required: ["title", "company_name", "skills", "must_haves", "nice_to_haves",
                           "benefits_extracted", "unique_selling_points", "requirements_classified"]
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
