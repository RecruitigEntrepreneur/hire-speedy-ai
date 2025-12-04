import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MatchRequest {
  candidateId: string;
  jobId: string;
}

interface MatchWeights {
  skills: number;
  experience: number;
  salary: number;
  location: number;
}

const DEFAULT_WEIGHTS: MatchWeights = {
  skills: 0.4,
  experience: 0.25,
  salary: 0.2,
  location: 0.15,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candidateId, jobId }: MatchRequest = await req.json();

    console.log(`Calculating match score: candidate=${candidateId}, job=${jobId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch candidate and job data
    const [candidateResult, jobResult] = await Promise.all([
      supabase.from("candidates").select("*").eq("id", candidateId).single(),
      supabase.from("jobs").select("*").eq("id", jobId).single(),
    ]);

    if (candidateResult.error || !candidateResult.data) {
      throw new Error(`Candidate not found: ${candidateId}`);
    }

    if (jobResult.error || !jobResult.data) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const candidate = candidateResult.data;
    const job = jobResult.data;

    // Calculate skill match using AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Du bist ein KI-Assistent für Recruiting. Analysiere die Übereinstimmung zwischen einem Kandidaten und einer Stelle.
Gib eine JSON-Antwort mit folgender Struktur:
{
  "skillMatchScore": 0-100,
  "matchedSkills": ["skill1", "skill2"],
  "missingMustHaves": ["skill1"],
  "experienceMatch": 0-100,
  "salaryMatch": 0-100,
  "overallAssessment": "Kurze Bewertung in 2-3 Sätzen",
  "strengthPoints": ["Stärke 1", "Stärke 2"],
  "concernPoints": ["Bedenken 1"]
}`;

    const userPrompt = `
KANDIDATENPROFIL:
- Skills: ${(candidate.skills || []).join(", ") || "Keine angegeben"}
- Erfahrungsjahre: ${candidate.experience_years || "Nicht angegeben"}
- Erwartetes Gehalt: ${candidate.expected_salary ? `€${candidate.expected_salary.toLocaleString()}` : "Nicht angegeben"}
- Aktuelles Gehalt: ${candidate.current_salary ? `€${candidate.current_salary.toLocaleString()}` : "Nicht angegeben"}
- Verfügbarkeit: ${candidate.availability_date || "Nicht angegeben"}
- Kündigungsfrist: ${candidate.notice_period || "Nicht angegeben"}
- Zusammenfassung: ${candidate.summary || "Keine"}

STELLENPROFIL:
- Titel: ${job.title}
- Beschreibung: ${job.description || "Keine"}
- Must-Haves: ${(job.must_haves || []).join(", ") || "Keine"}
- Nice-to-Haves: ${(job.nice_to_haves || []).join(", ") || "Keine"}
- Skills: ${(job.skills || []).join(", ") || "Keine"}
- Erfahrungslevel: ${job.experience_level || "Nicht angegeben"}
- Gehaltsspanne: ${job.salary_min && job.salary_max ? `€${job.salary_min.toLocaleString()} - €${job.salary_max.toLocaleString()}` : "Nicht angegeben"}
- Standort: ${job.location || "Nicht angegeben"}
- Remote: ${job.remote_type || "Nicht angegeben"}
- Branche: ${job.industry || "Nicht angegeben"}

Analysiere die Übereinstimmung und gib eine detaillierte JSON-Bewertung.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysisText = aiData.choices?.[0]?.message?.content || "{}";
    
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch {
      console.error("Failed to parse AI response:", analysisText);
      analysis = {
        skillMatchScore: 50,
        experienceMatch: 50,
        salaryMatch: 50,
        overallAssessment: "Automatische Analyse konnte nicht durchgeführt werden.",
        matchedSkills: [],
        missingMustHaves: [],
        strengthPoints: [],
        concernPoints: [],
      };
    }

    // Calculate weighted overall score
    const overallScore = Math.round(
      (analysis.skillMatchScore || 50) * DEFAULT_WEIGHTS.skills +
      (analysis.experienceMatch || 50) * DEFAULT_WEIGHTS.experience +
      (analysis.salaryMatch || 50) * DEFAULT_WEIGHTS.salary +
      50 * DEFAULT_WEIGHTS.location // Location score defaults to 50 if not analyzed
    );

    // Update submission with match score if submission exists
    const { data: submission } = await supabase
      .from("submissions")
      .select("id")
      .eq("candidate_id", candidateId)
      .eq("job_id", jobId)
      .single();

    if (submission) {
      await supabase
        .from("submissions")
        .update({ match_score: overallScore })
        .eq("id", submission.id);
    }

    console.log(`Match score calculated: ${overallScore}%`);

    return new Response(
      JSON.stringify({
        overallScore,
        analysis: {
          skillMatch: analysis.skillMatchScore || 50,
          experienceMatch: analysis.experienceMatch || 50,
          salaryMatch: analysis.salaryMatch || 50,
          matchedSkills: analysis.matchedSkills || [],
          missingMustHaves: analysis.missingMustHaves || [],
          overallAssessment: analysis.overallAssessment || "",
          strengthPoints: analysis.strengthPoints || [],
          concernPoints: analysis.concernPoints || [],
        },
        weights: DEFAULT_WEIGHTS,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in calculate-match:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
