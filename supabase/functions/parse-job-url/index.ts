import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedJobData {
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

    const systemPrompt = `Du bist ein erfahrener HR-Experte und Stellenanzeigen-Analyst. Analysiere die folgende Stellenanzeige und extrahiere strukturierte Daten.

Extrahiere folgende Informationen:
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

Sei präzise und extrahiere nur Informationen, die tatsächlich vorhanden sind.
Bei Gehaltsangaben pro Monat multipliziere mit 12.
Setze fehlende Informationen auf null oder leere Arrays.`;

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
              description: "Extrahiert strukturierte Daten aus einer Stellenanzeige",
              parameters: {
                type: "object",
                properties: {
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
                  nice_to_haves: { type: "array", items: { type: "string" } }
                },
                required: ["title", "company_name", "skills", "must_haves", "nice_to_haves"]
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
