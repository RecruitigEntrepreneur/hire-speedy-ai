import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MatchRecommendationRequest {
  candidateId: string;
  jobId: string;
  matchResult?: {
    overall: number;
    fit: {
      score: number;
      breakdown: {
        skills: number;
        experience: number;
        seniority: number;
        industry: number;
      };
    };
    constraints: {
      score: number;
      breakdown: {
        salary: number;
        commute: number;
        startDate: number;
      };
    };
    explainability?: {
      topReasons: string[];
      topRisks: string[];
    };
  };
  forceRefresh?: boolean;
}

interface AIRecommendation {
  recommendation_text: string;
  action_recommendation: string;
  confidence: "high" | "medium" | "low";
  key_match_points: string[];
  key_risks: string[];
  negotiation_hints: string[];
}

/**
 * Helper: Anonymize company name for Triple-Blind architecture
 */
function anonymizeCompanyForAI(job: any): string {
  const parts: string[] = [];
  
  if (job.industry) {
    parts.push(job.industry);
  } else {
    parts.push("Unternehmen");
  }
  
  if (job.company_size_band) {
    const sizeMap: Record<string, string> = {
      "1-50": "1–50 MA",
      "51-200": "51–200 MA",
      "201-500": "200–500 MA",
      "501-1000": "500–1000 MA",
      "1000+": "1000+ MA",
    };
    parts.push(sizeMap[job.company_size_band] || job.company_size_band);
  }
  
  if (job.funding_stage) {
    parts.push(job.funding_stage);
  }
  
  if (job.tech_environment && job.tech_environment.length > 0) {
    const tech = job.tech_environment.slice(0, 3).join("/");
    parts.push(tech);
  }
  
  if (job.remote_type && job.location) {
    const remoteMap: Record<string, string> = {
      remote: "Remote",
      hybrid: "Hybrid",
      onsite: "Vor Ort",
    };
    const model = remoteMap[job.remote_type.toLowerCase()] || job.remote_type;
    const city = job.location.split(",")[0].trim();
    parts.push(`${model} ${city}`);
  } else if (job.location) {
    parts.push(job.location.split(",")[0].trim());
  }
  
  return `[${parts.join(" | ")}]`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    if (!LOVABLE_API_KEY) {
      throw new Error("Missing LOVABLE_API_KEY");
    }

    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { candidateId, jobId, matchResult, forceRefresh } =
      (await req.json()) as MatchRecommendationRequest;

    console.log(`[generate-match-recommendation] Request: candidateId=${candidateId}, jobId=${jobId}, forceRefresh=${forceRefresh}`);

    if (!candidateId || !jobId) {
      return new Response(
        JSON.stringify({ error: "candidateId and jobId are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check cache if not forcing refresh
    if (!forceRefresh) {
      const { data: cachedRec, error: cacheError } = await supabase
        .from("match_recommendations")
        .select("*")
        .eq("candidate_id", candidateId)
        .eq("job_id", jobId)
        .single();

      if (!cacheError && cachedRec) {
        const cachedAt = new Date(cachedRec.generated_at);
        const now = new Date();
        const daysSinceCached =
          (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceCached < 7) {
          console.log(`[generate-match-recommendation] Returning cached recommendation (${daysSinceCached.toFixed(1)} days old)`);
          return new Response(
            JSON.stringify({
              recommendation: {
                recommendation_text: cachedRec.recommendation_text,
                action_recommendation: cachedRec.action_recommendation,
                confidence: cachedRec.confidence,
                key_match_points: cachedRec.key_match_points || [],
                key_risks: cachedRec.key_risks || [],
                negotiation_hints: cachedRec.negotiation_hints || [],
                generated_at: cachedRec.generated_at,
              },
              cached: true,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Load candidate data
    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select(
        `
        id, full_name, email, phone, job_title, skills, seniority, experience_years,
        expected_salary, salary_expectation_min, salary_expectation_max,
        city, availability_date, notice_period, cv_ai_summary, cv_ai_bullets,
        remote_preference, max_commute_minutes, target_roles, target_industries,
        certifications, language_skills
      `
      )
      .eq("id", candidateId)
      .single();

    if (candidateError || !candidate) {
      console.error(`[generate-match-recommendation] Candidate not found: ${candidateId}`, candidateError);
      return new Response(
        JSON.stringify({ error: "Candidate not found", details: candidateError?.message }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[generate-match-recommendation] Candidate found: ${candidate.full_name}`);

    // Load job data (without status filter for broader search)
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(
        `
        id, title, company_name, industry, description, requirements,
        salary_min, salary_max, location, remote_type, experience_level,
        company_size_band, funding_stage, tech_environment, required_languages
      `
      )
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error(`[generate-match-recommendation] Job not found: ${jobId}`, jobError);
      return new Response(
        JSON.stringify({ error: "Job not found", details: jobError?.message }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[generate-match-recommendation] Job found: ${job.title}`);

    // Load interview notes if available
    const { data: interviewNotes } = await supabase
      .from("candidate_interview_notes")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Load skill requirements if available
    const { data: skillRequirements } = await supabase
      .from("job_skill_requirements")
      .select("skill_name, importance, skill_level")
      .eq("job_id", jobId);

    // Generate anonymized company name for Triple-Blind
    const anonymizedCompany = anonymizeCompanyForAI(job);
    console.log(`[generate-match-recommendation] Anonymized company: ${anonymizedCompany}`);

    // Build prompt
    const prompt = buildPrompt(
      candidate,
      job,
      anonymizedCompany,
      interviewNotes,
      skillRequirements,
      matchResult
    );

    console.log(`[generate-match-recommendation] Calling AI for recommendation...`);

    // Call AI
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `Du bist ein erfahrener Senior Tech-Recruiter mit 15+ Jahren Erfahrung. 
Du analysierst Kandidaten-Job-Matches und gibst prägnante, actionable Empfehlungen.
Du sprichst immer Deutsch und bist direkt und professionell.

⚠️ KRITISCH - TRIPLE-BLIND ANONYMISIERUNG:
- Du kennst den echten Firmennamen NICHT und darfst ihn auch nicht erraten
- Verwende NUR die anonymisierte Beschreibung (z.B. "[FinTech | 200-500 MA | Series B]")
- Schreibe "das Unternehmen", "der Arbeitgeber" oder die Branche - NIEMALS einen Firmennamen
- Die Anonymisierung schützt alle Parteien und ist ein zentrales Feature der Plattform`,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_recommendation",
                description:
                  "Erstelle eine strukturierte Matching-Empfehlung für den Recruiter",
                parameters: {
                  type: "object",
                  properties: {
                    recommendation_text: {
                      type: "string",
                      description:
                        "2-3 Sätze: Was passt gut, was ist das Hauptrisiko, wie damit umgehen. Kurz und prägnant. KEIN Firmenname!",
                    },
                    action_recommendation: {
                      type: "string",
                      description:
                        "Konkrete nächste Aktion für den Recruiter (1 Satz)",
                    },
                    confidence: {
                      type: "string",
                      enum: ["high", "medium", "low"],
                      description: "Wie sicher ist die Empfehlung",
                    },
                    key_match_points: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Die 3 wichtigsten Passung-Punkte (je 5-10 Worte)",
                    },
                    key_risks: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "1-2 konkrete Risiken mit Kontext (je 5-15 Worte)",
                    },
                    negotiation_hints: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Verhandlungstipps bei Gehaltsgap oder anderen Issues (optional)",
                    },
                  },
                  required: [
                    "recommendation_text",
                    "action_recommendation",
                    "confidence",
                    "key_match_points",
                    "key_risks",
                  ],
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "create_recommendation" },
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`[generate-match-recommendation] AI error: ${aiResponse.status}`, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log(`[generate-match-recommendation] AI response received`);

    // Extract recommendation from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error(`[generate-match-recommendation] No tool call in response:`, JSON.stringify(aiData));
      throw new Error("No recommendation generated");
    }

    const recommendation: AIRecommendation = JSON.parse(
      toolCall.function.arguments
    );

    console.log(`[generate-match-recommendation] Recommendation generated with confidence: ${recommendation.confidence}`);

    // Cache the recommendation
    const { error: upsertError } = await supabase
      .from("match_recommendations")
      .upsert(
        {
          candidate_id: candidateId,
          job_id: jobId,
          match_score: matchResult?.overall || null,
          recommendation_text: recommendation.recommendation_text,
          action_recommendation: recommendation.action_recommendation,
          confidence: recommendation.confidence,
          key_match_points: recommendation.key_match_points,
          key_risks: recommendation.key_risks,
          negotiation_hints: recommendation.negotiation_hints || [],
          generated_at: new Date().toISOString(),
          model_version: "gemini-3-flash-preview",
        },
        {
          onConflict: "candidate_id,job_id",
        }
      );

    if (upsertError) {
      console.error(`[generate-match-recommendation] Cache upsert error:`, upsertError);
      // Don't fail - still return the recommendation
    }

    return new Response(
      JSON.stringify({
        recommendation: {
          ...recommendation,
          generated_at: new Date().toISOString(),
        },
        cached: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[generate-match-recommendation] Error:`, error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
function buildPrompt(
  candidate: any,
  job: any,
  anonymizedCompany: string,
  interviewNotes: any,
  skillRequirements: any[] | null,
  matchResult?: any
): string {
  const mustHaves =
    skillRequirements
      ?.filter((s) => s.importance === "must_have")
      .map((s) => s.skill_name) || [];
  const niceToHaves =
    skillRequirements
      ?.filter((s) => s.importance === "nice_to_have")
      .map((s) => s.skill_name) || [];

  let prompt = `Analysiere die Passung zwischen diesem Kandidaten und der Position:

=== KANDIDAT ===
Name: ${candidate.full_name}
Aktuelle Position: ${candidate.job_title || "Nicht angegeben"}
Seniority: ${candidate.seniority || "Nicht angegeben"}
Erfahrung: ${candidate.experience_years || "?"} Jahre

Skills: ${candidate.skills?.join(", ") || "Keine angegeben"}
Zertifizierungen: ${candidate.certifications?.join(", ") || "Keine"}

Gehaltsvorstellung: ${candidate.expected_salary ? `${candidate.expected_salary}€` : "Nicht angegeben"}
${candidate.salary_expectation_min ? `Gehaltsspanne: ${candidate.salary_expectation_min}€ - ${candidate.salary_expectation_max || "?"}€` : ""}

Verfügbarkeit: ${candidate.availability_date || candidate.notice_period || "Nicht angegeben"}
Standort: ${candidate.city || "Nicht angegeben"}
Max. Pendelzeit: ${candidate.max_commute_minutes ? `${candidate.max_commute_minutes} Min.` : "Nicht angegeben"}
Remote-Präferenz: ${candidate.remote_preference || "Nicht angegeben"}

${candidate.cv_ai_summary ? `CV-Summary:\n${candidate.cv_ai_summary}` : ""}

${
  interviewNotes
    ? `
=== INTERVIEW-NOTIZEN ===
Motivation: ${interviewNotes.change_motivation || "Nicht erfasst"}
Positiv am aktuellen Job: ${interviewNotes.current_positive || "Nicht erfasst"}
Negativ am aktuellen Job: ${interviewNotes.current_negative || "Nicht erfasst"}
Karriereziel: ${interviewNotes.career_ultimate_goal || "Nicht erfasst"}
Warum jetzt wechseln: ${interviewNotes.why_now || "Nicht erfasst"}
`
    : ""
}

=== JOB (ANONYMISIERT - Triple-Blind) ===
Titel: ${job.title}
Unternehmen: ${anonymizedCompany}
(Hinweis: Der echte Firmenname ist dir nicht bekannt und darf nicht geraten werden)

${job.description ? `Beschreibung: ${job.description.substring(0, 500)}...` : ""}
${job.requirements ? `Anforderungen: ${job.requirements.substring(0, 500)}...` : ""}

Erfahrungslevel: ${job.experience_level || "Nicht angegeben"}
Gehaltsspanne: ${job.salary_min ? `${job.salary_min}€` : "?"} - ${job.salary_max ? `${job.salary_max}€` : "?"}
Standort: ${job.location || "Nicht angegeben"}
Remote-Policy: ${job.remote_type || "Nicht angegeben"}

${mustHaves.length > 0 ? `Must-Have Skills: ${mustHaves.join(", ")}` : ""}
${niceToHaves.length > 0 ? `Nice-to-Have Skills: ${niceToHaves.join(", ")}` : ""}
${job.required_languages?.length > 0 ? `Sprachen: ${JSON.stringify(job.required_languages)}` : ""}
${job.tech_environment?.length > 0 ? `Tech-Environment: ${job.tech_environment.join(", ")}` : ""}
`;

  if (matchResult) {
    prompt += `
=== ALGORITHMISCHER SCORE (zur Orientierung) ===
Gesamt-Score: ${matchResult.overall}%
- Fit-Score: ${matchResult.fit?.score || "?"}% (Skills: ${matchResult.fit?.breakdown?.skills || "?"}%, Erfahrung: ${matchResult.fit?.breakdown?.experience || "?"}%)
- Constraints: ${matchResult.constraints?.score || "?"}% (Gehalt: ${matchResult.constraints?.breakdown?.salary || "?"}%, Pendel: ${matchResult.constraints?.breakdown?.commute || "?"}%)

${matchResult.explainability?.topReasons?.length > 0 ? `Algorithmische Stärken: ${matchResult.explainability.topReasons.join("; ")}` : ""}
${matchResult.explainability?.topRisks?.length > 0 ? `Algorithmische Risiken: ${matchResult.explainability.topRisks.join("; ")}` : ""}
`;
  }

  prompt += `

Erstelle jetzt eine konkrete, actionable Empfehlung für den Recruiter.
WICHTIG: Verweise NICHT auf den Firmennamen - nutze "das Unternehmen" oder die Branche.`;

  return prompt;
}