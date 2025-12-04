import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedCVData {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  skills: string[];
  experience_years: number | null;
  current_salary: number | null;
  expected_salary: number | null;
  notice_period: string | null;
  summary: string | null;
  languages: string[];
  education: string[];
  work_experience: Array<{
    company: string;
    title: string;
    duration: string;
    description: string;
  }>;
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

    const { cvText, cvUrl } = await req.json();

    if (!cvText && !cvUrl) {
      return new Response(
        JSON.stringify({ error: "Either cvText or cvUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let textToAnalyze = cvText;

    // If URL provided, we'll use it as context (actual PDF parsing would require additional setup)
    if (cvUrl && !cvText) {
      textToAnalyze = `CV URL provided: ${cvUrl}. Please analyze based on typical CV structure.`;
    }

    console.log("Parsing CV with Lovable AI...");

    const systemPrompt = `Du bist ein erfahrener HR-Experte und CV-Parser. Analysiere den folgenden Lebenslauf und extrahiere strukturierte Daten.

Extrahiere folgende Informationen:
- full_name: Vollständiger Name
- email: E-Mail-Adresse
- phone: Telefonnummer
- linkedin_url: LinkedIn URL (falls vorhanden)
- skills: Array von technischen und fachlichen Skills
- experience_years: Geschätzte Berufserfahrung in Jahren (als Zahl)
- current_salary: Aktuelles Gehalt falls erwähnt (als Zahl, nur EUR)
- expected_salary: Gehaltsvorstellung falls erwähnt (als Zahl, nur EUR)
- notice_period: Kündigungsfrist (z.B. "immediate", "2_weeks", "1_month", "3_months")
- summary: Kurze professionelle Zusammenfassung (max 200 Wörter)
- languages: Array von Sprachen mit Level (z.B. ["Deutsch (Muttersprache)", "Englisch (fließend)"])
- education: Array von Bildungsabschlüssen
- work_experience: Array von Berufserfahrungen mit company, title, duration, description

Sei präzise und extrahiere nur Informationen, die tatsächlich im CV vorhanden sind.
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
          { role: "user", content: `Analysiere diesen Lebenslauf:\n\n${textToAnalyze}` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_cv_data",
              description: "Extrahiert strukturierte Daten aus einem Lebenslauf",
              parameters: {
                type: "object",
                properties: {
                  full_name: { type: "string", nullable: true },
                  email: { type: "string", nullable: true },
                  phone: { type: "string", nullable: true },
                  linkedin_url: { type: "string", nullable: true },
                  skills: { type: "array", items: { type: "string" } },
                  experience_years: { type: "number", nullable: true },
                  current_salary: { type: "number", nullable: true },
                  expected_salary: { type: "number", nullable: true },
                  notice_period: { type: "string", nullable: true },
                  summary: { type: "string", nullable: true },
                  languages: { type: "array", items: { type: "string" } },
                  education: { type: "array", items: { type: "string" } },
                  work_experience: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        company: { type: "string" },
                        title: { type: "string" },
                        duration: { type: "string" },
                        description: { type: "string" }
                      }
                    }
                  }
                },
                required: ["skills", "languages", "education", "work_experience"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_cv_data" } }
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

    const parsedCV: ParsedCVData = JSON.parse(toolCall.function.arguments);

    console.log("CV parsed successfully:", {
      name: parsedCV.full_name,
      skills_count: parsedCV.skills?.length,
      experience_years: parsedCV.experience_years
    });

    return new Response(
      JSON.stringify({ success: true, data: parsedCV }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error parsing CV:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
