import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedCVData {
  // Stammdaten
  full_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  location: string | null;
  portfolio_url: string | null;
  github_url: string | null;
  website_url: string | null;
  nationality: string | null;
  residence_status: string | null;
  
  // Beruflicher Hintergrund
  current_title: string | null;
  current_company: string | null;
  experience_years: number | null;
  seniority: string | null;
  
  // AI-Zusammenfassung
  cv_ai_summary: string | null;
  cv_ai_bullets: string[];
  
  // Strukturierte Berufserfahrung
  experiences: Array<{
    company_name: string;
    job_title: string;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
    is_current: boolean;
    description: string;
  }>;
  
  // Strukturierte Ausbildung
  educations: Array<{
    institution: string;
    degree: string | null;
    field_of_study: string | null;
    graduation_year: number | null;
    grade: string | null;
  }>;
  
  // Strukturierte Skills
  skills: Array<{
    name: string;
    category: string | null;
    level: string | null;
  }>;
  
  // Strukturierte Sprachen
  languages: Array<{
    language: string;
    proficiency: string;
  }>;
  
  // Gehalt & Verfügbarkeit
  salary_expectation_min: number | null;
  salary_expectation_max: number | null;
  current_salary: number | null;
  notice_period: string | null;
  availability_from: string | null;
  relocation_ready: boolean;
  remote_preference: string | null;
  
  // Präferenzen
  target_roles: string[];
  target_industries: string[];
  target_employment_type: string | null;
  
  // NEU: Spezialisierungen & Soft Skills
  specializations: string[];
  soft_skills: string[];
  industry_experience: string[];
  certificates: string[];
  
  // NEU: Projektmetriken
  project_metrics: {
    max_team_size: number | null;
    max_budget: string | null;
    locations_managed: number | null;
    units_delivered: string | null;
  };
  
  // NEU: Exposé-Bausteine
  expose_title: string | null;
  expose_summary: string | null;
  expose_highlights: string[];
  expose_project_highlights: string[];
  expose_certifications: string[];
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

    const systemPrompt = `Du bist ein erfahrener HR-Experte und CV-Parser. Analysiere den Lebenslauf und extrahiere ALLE strukturierten Daten.

WICHTIG: Extrahiere möglichst vollständig und präzise. Leite fehlende Informationen wenn möglich ab (z.B. Seniority aus Berufsjahren).

REGELN:
- Datumsformate: YYYY-MM-DD oder YYYY-MM oder YYYY
- Seniority: "junior" (0-2 Jahre), "mid" (3-5 Jahre), "senior" (6-10 Jahre), "lead" (10+ Jahre oder Führungsrolle), "director" (C-Level/Director)
- Sprach-Proficiency: "native" (Muttersprache), "fluent" (Fließend), "advanced" (Fortgeschritten), "intermediate" (Gut), "basic" (Grundkenntnisse)
- Skills kategorisieren: "programming" (Sprachen/Frameworks), "tool" (Software/Tools), "soft_skill", "process" (Methoden), "domain" (Fachkenntnisse)
- remote_preference: "remote", "hybrid", "onsite", "flexible"
- notice_period: z.B. "immediate", "2_weeks", "1_month", "3_months"
- residence_status: "citizen", "permanent", "work_visa", "student_visa", "pending"

cv_ai_summary: Schreibe eine prägnante Zusammenfassung (max 150 Wörter) für Recruiter.
cv_ai_bullets: Erstelle 4-6 Bullet Points, die die wichtigsten Stärken und Erfahrungen hervorheben.

EXPOSÉ-BAUSTEINE (wichtig für Kundenexport):
- expose_title: Erstelle einen prägnanten Titel wie "Senior IT-Projektmanager | PMI-zertifiziert | 12+ Jahre Erfahrung"
- expose_summary: Schreibe ein Kurzprofil (max 100 Wörter) für externe Kunden
- expose_highlights: 3-5 wichtigste Qualifikations-Highlights
- expose_project_highlights: 2-4 beeindruckendste Projektbeispiele mit Metriken
- expose_certifications: Wichtigste Zertifizierungen für das Exposé

PROJEKTMETRIKEN: Extrahiere aus den Erfahrungen:
- max_team_size: Größte Teamgröße die gemanagt wurde
- max_budget: Größtes verwaltetes Budget
- locations_managed: Anzahl verwalteter Standorte
- units_delivered: Anzahl betroffener Einheiten/Nutzer

Extrahiere auch: specializations, soft_skills, industry_experience, certificates, nationality.`;

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
          { role: "user", content: `Analysiere diesen Lebenslauf vollständig:\n\n${textToAnalyze}` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_cv_data",
              description: "Extrahiert vollständige strukturierte Daten aus einem Lebenslauf",
              parameters: {
                type: "object",
                properties: {
                  full_name: { type: "string", nullable: true },
                  email: { type: "string", nullable: true },
                  phone: { type: "string", nullable: true },
                  linkedin_url: { type: "string", nullable: true },
                  location: { type: "string", nullable: true },
                  portfolio_url: { type: "string", nullable: true },
                  github_url: { type: "string", nullable: true },
                  website_url: { type: "string", nullable: true },
                  current_title: { type: "string", nullable: true },
                  current_company: { type: "string", nullable: true },
                  experience_years: { type: "number", nullable: true },
                  seniority: { type: "string", nullable: true },
                  cv_ai_summary: { type: "string", nullable: true },
                  cv_ai_bullets: { type: "array", items: { type: "string" } },
                  experiences: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        company_name: { type: "string" },
                        job_title: { type: "string" },
                        location: { type: "string", nullable: true },
                        start_date: { type: "string", nullable: true },
                        end_date: { type: "string", nullable: true },
                        is_current: { type: "boolean" },
                        description: { type: "string" }
                      },
                      required: ["company_name", "job_title", "description"]
                    }
                  },
                  educations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        institution: { type: "string" },
                        degree: { type: "string", nullable: true },
                        field_of_study: { type: "string", nullable: true },
                        graduation_year: { type: "number", nullable: true },
                        grade: { type: "string", nullable: true }
                      },
                      required: ["institution"]
                    }
                  },
                  skills: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        category: { type: "string", nullable: true },
                        level: { type: "string", nullable: true }
                      },
                      required: ["name"]
                    }
                  },
                  languages: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        language: { type: "string" },
                        proficiency: { type: "string" }
                      },
                      required: ["language", "proficiency"]
                    }
                  },
                  salary_expectation_min: { type: "number", nullable: true },
                  salary_expectation_max: { type: "number", nullable: true },
                  current_salary: { type: "number", nullable: true },
                  notice_period: { type: "string", nullable: true },
                  availability_from: { type: "string", nullable: true },
                  relocation_ready: { type: "boolean" },
                  remote_preference: { type: "string", nullable: true },
                  target_roles: { type: "array", items: { type: "string" } },
                  target_industries: { type: "array", items: { type: "string" } },
                  target_employment_type: { type: "string", nullable: true },
                  nationality: { type: "string", nullable: true },
                  residence_status: { type: "string", nullable: true },
                  specializations: { type: "array", items: { type: "string" } },
                  soft_skills: { type: "array", items: { type: "string" } },
                  industry_experience: { type: "array", items: { type: "string" } },
                  certificates: { type: "array", items: { type: "string" } },
                  project_metrics: {
                    type: "object",
                    properties: {
                      max_team_size: { type: "number", nullable: true },
                      max_budget: { type: "string", nullable: true },
                      locations_managed: { type: "number", nullable: true },
                      units_delivered: { type: "string", nullable: true }
                    }
                  },
                  expose_title: { type: "string", nullable: true },
                  expose_summary: { type: "string", nullable: true },
                  expose_highlights: { type: "array", items: { type: "string" } },
                  expose_project_highlights: { type: "array", items: { type: "string" } },
                  expose_certifications: { type: "array", items: { type: "string" } }
                },
                required: ["experiences", "educations", "skills", "languages", "cv_ai_bullets", "expose_highlights", "expose_project_highlights"]
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
      experiences_count: parsedCV.experiences?.length,
      skills_count: parsedCV.skills?.length,
      languages_count: parsedCV.languages?.length,
      experience_years: parsedCV.experience_years,
      seniority: parsedCV.seniority
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: parsedCV,
        parser_version: "v2"
      }),
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
