import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
      console.log("Fetching job URL:", jobUrl);
      try {
        const pageResponse = await fetch(jobUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; JobParser/1.0)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          }
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
- must_haves: Array von Muss-Kriterien
- nice_to_haves: Array von Kann-Kriterien

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
- unique_selling_points: Array der besonderen Vorteile dieser Stelle
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
                  must_haves: { type: "array", items: { type: "string" } },
                  nice_to_haves: { type: "array", items: { type: "string" } },
                  
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
                  unique_selling_points: { type: "array", items: { type: "string" } },
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
                required: ["title", "company_name", "skills", "must_haves", "nice_to_haves", "benefits_extracted", "unique_selling_points"]
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

    console.log("Job parsed successfully:", {
      title: parsedJob.title,
      company: parsedJob.company_name,
      skills_count: parsedJob.skills?.length
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
