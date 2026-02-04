import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    if (cvUrl && !cvText) {
      textToAnalyze = `CV URL provided: ${cvUrl}. Please analyze based on typical CV structure.`;
    }

    console.log("Parsing CV with Lovable AI...");

    const systemPrompt = `Du bist ein erfahrener HR-Experte und CV-Parser. Analysiere den Lebenslauf und extrahiere strukturierte Daten.

WICHTIG: Extrahiere möglichst vollständig und präzise.

REGELN:
- Datumsformate: YYYY-MM-DD oder YYYY-MM oder YYYY
- Seniority: "junior", "mid", "senior", "lead", "director"
- Sprach-Proficiency: "native", "fluent", "advanced", "intermediate", "basic"
- Skills kategorisieren: "programming", "tool", "soft_skill", "process", "domain"
- Experience-Beschreibungen: MAX 3-4 Bullet Points (mit •), kurz und prägnant. KEINE langen Fließtexte!

cv_ai_summary: Schreibe eine prägnante Zusammenfassung (max 150 Wörter) für Recruiter.
cv_ai_bullets: Erstelle 4-6 Bullet Points für die wichtigsten Stärken.
expose_title: Erstelle einen prägnanten Titel wie "Senior IT-Projektmanager | PMI-zertifiziert | 12+ Jahre"
expose_summary: Schreibe ein Kurzprofil (max 100 Wörter) für externe Kunden`;

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
              description: "Extrahiert strukturierte Daten aus einem Lebenslauf",
              parameters: {
                type: "object",
                properties: {
                  full_name: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  linkedin_url: { type: "string" },
                  location: { type: "string" },
                  current_title: { type: "string" },
                  current_company: { type: "string" },
                  experience_years: { type: "number" },
                  seniority: { type: "string" },
                  cv_ai_summary: { type: "string" },
                  cv_ai_bullets: { type: "array", items: { type: "string" } },
                  experiences: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        company_name: { type: "string" },
                        job_title: { type: "string" },
                        start_date: { type: "string" },
                        end_date: { type: "string" },
                        is_current: { type: "boolean" },
                        description: { 
                          type: "string",
                          description: "Fasse die Tätigkeit in MAX 3-4 kurzen Stichpunkten zusammen (Bullet Points mit •). Keine langen Fließtexte!"
                        }
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
                        degree: { type: "string" },
                        field_of_study: { type: "string" },
                        graduation_year: { type: "number" }
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
                        category: { type: "string" },
                        level: { type: "string" }
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
                  certificates: { type: "array", items: { type: "string" } },
                  expose_title: { type: "string" },
                  expose_summary: { type: "string" },
                  expose_highlights: { type: "array", items: { type: "string" } }
                },
                required: ["full_name", "experiences", "skills", "cv_ai_summary", "cv_ai_bullets"]
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

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in response");
    }

    const parsedCV = JSON.parse(toolCall.function.arguments);

    // Add default values for optional fields
    const result = {
      ...parsedCV,
      portfolio_url: parsedCV.portfolio_url || null,
      github_url: parsedCV.github_url || null,
      website_url: parsedCV.website_url || null,
      nationality: parsedCV.nationality || null,
      residence_status: parsedCV.residence_status || null,
      salary_expectation_min: parsedCV.salary_expectation_min || null,
      salary_expectation_max: parsedCV.salary_expectation_max || null,
      current_salary: parsedCV.current_salary || null,
      notice_period: parsedCV.notice_period || null,
      availability_from: parsedCV.availability_from || null,
      relocation_ready: parsedCV.relocation_ready || false,
      remote_preference: parsedCV.remote_preference || null,
      target_roles: parsedCV.target_roles || [],
      target_industries: parsedCV.target_industries || [],
      target_employment_type: parsedCV.target_employment_type || null,
      specializations: parsedCV.specializations || [],
      soft_skills: parsedCV.soft_skills || [],
      industry_experience: parsedCV.industry_experience || [],
      certificates: parsedCV.certificates || [],
      project_metrics: parsedCV.project_metrics || {
        max_team_size: null,
        max_budget: null,
        locations_managed: null,
        units_delivered: null
      },
      expose_title: parsedCV.expose_title || null,
      expose_summary: parsedCV.expose_summary || null,
      expose_highlights: parsedCV.expose_highlights || [],
      expose_project_highlights: parsedCV.expose_project_highlights || [],
      expose_certifications: parsedCV.expose_certifications || []
    };

    console.log("CV parsed successfully:", {
      name: result.full_name,
      experiences_count: result.experiences?.length,
      skills_count: result.skills?.length,
      languages_count: result.languages?.length,
      experience_years: result.experience_years,
      seniority: result.seniority
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result,
        parser_version: "v3"
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
