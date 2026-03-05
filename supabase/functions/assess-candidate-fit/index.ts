import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { submissionId, force } = await req.json();

    if (!submissionId) {
      return new Response(JSON.stringify({ error: "submissionId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Load submission
    const { data: submission, error: subErr } = await supabase
      .from("submissions")
      .select("id, candidate_id, job_id")
      .eq("id", submissionId)
      .single();

    if (subErr || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { candidate_id, job_id } = submission;

    // 2. Load all data in parallel
    const startTime = Date.now();

    const [
      candidateRes,
      experiencesRes,
      languagesRes,
      skillsRes,
      interviewNotesRes,
      aiAssessmentRes,
      jobRes,
    ] = await Promise.all([
      supabase.from("candidates").select("*").eq("id", candidate_id).single(),
      supabase.from("candidate_experiences").select("*").eq("candidate_id", candidate_id).order("start_date", { ascending: false }),
      supabase.from("candidate_languages").select("*").eq("candidate_id", candidate_id),
      supabase.from("candidate_skills").select("*").eq("candidate_id", candidate_id),
      supabase.from("candidate_interview_notes").select("*").eq("candidate_id", candidate_id).order("created_at", { ascending: false }).limit(1),
      supabase.from("candidate_ai_assessment").select("*").eq("candidate_id", candidate_id).maybeSingle(),
      supabase.from("jobs").select("*").eq("id", job_id).single(),
    ]);

    const candidate = candidateRes.data;
    const experiences = experiencesRes.data || [];
    const languages = languagesRes.data || [];
    const skills = skillsRes.data || [];
    const interviewNotes = interviewNotesRes.data?.[0] || null;
    const aiAssessment = aiAssessmentRes.data || null;
    const job = jobRes.data;

    if (!candidate || !job) {
      return new Response(JSON.stringify({ error: "Candidate or job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Compute input hash for caching
    const inputData = JSON.stringify({
      candidate: { id: candidate.id, skills: candidate.skills, experience_years: candidate.experience_years, job_title: candidate.job_title, seniority: candidate.seniority, city: candidate.city, salary_expectation_min: candidate.salary_expectation_min, salary_expectation_max: candidate.salary_expectation_max, cv_ai_summary: candidate.cv_ai_summary, summary: candidate.summary, remote_preference: candidate.remote_preference, certifications: candidate.certifications },
      experiences: experiences.map((e: any) => ({ company: e.company_name, title: e.job_title, start: e.start_date, end: e.end_date, desc: e.description })),
      languages: languages.map((l: any) => ({ lang: l.language, prof: l.proficiency })),
      skills: skills.map((s: any) => ({ name: s.skill_name, level: s.level, years: s.years_experience, category: s.category })),
      interviewNotes: interviewNotes ? { motivation: interviewNotes.change_motivation, salary_current: interviewNotes.salary_current, salary_desired: interviewNotes.salary_desired, career_goals: interviewNotes.career_ultimate_goal, would_recommend: interviewNotes.would_recommend } : null,
      job: { id: job.id, title: job.title, description: job.description, must_haves: job.must_haves, nice_to_haves: job.nice_to_haves, experience_level: job.experience_level, salary_min: job.salary_min, salary_max: job.salary_max, location: job.location, remote_policy: job.remote_policy },
    });

    const inputHash = await sha256(inputData);

    // 4. Check cache
    if (!force) {
      const { data: existing } = await supabase
        .from("candidate_fit_assessments")
        .select("*")
        .eq("submission_id", submissionId)
        .eq("input_data_hash", inputHash)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ success: true, cached: true, assessment: existing }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 5. Build prompt
    const systemPrompt = `Du bist ein erfahrener Recruiting-Analyst. Analysiere die Passung zwischen Kandidat und Stelle evidenzbasiert.

REGELN:
- Bewerte NUR anhand der vorliegenden Daten. Keine Vermutungen.
- Jede Bewertung MUSS mit konkreten Belegen aus dem Kandidatenprofil untermauert sein.
- Fehlende Daten sind KEINE negativen Signale — kennzeichne sie als "insufficient_data".
- Sei direkt und ehrlich. Kein Marketing-Sprech.
- Antworte auf Deutsch.`;

    const userPrompt = `Analysiere die Passung zwischen diesem Kandidaten und der Stelle.

## KANDIDAT
Name: ${candidate.full_name}
Aktuelle Position: ${candidate.job_title || 'N/A'} bei ${candidate.company || 'N/A'}
Seniority: ${candidate.seniority || 'N/A'}
Erfahrung: ${candidate.experience_years || 'N/A'} Jahre
Standort: ${candidate.city || 'N/A'}
Gehaltserwartung: ${candidate.salary_expectation_min ? `${candidate.salary_expectation_min}–${candidate.salary_expectation_max} EUR` : 'N/A'}
Remote-Präferenz: ${candidate.remote_preference || 'N/A'}
Skills: ${candidate.skills?.join(', ') || 'N/A'}
Zertifizierungen: ${candidate.certifications?.join(', ') || 'N/A'}

### Berufserfahrung
${experiences.length > 0 ? experiences.map((e: any) => `- ${e.job_title} bei ${e.company_name} (${e.start_date || '?'} – ${e.end_date || 'heute'}): ${e.description || 'Keine Beschreibung'}`).join('\n') : 'Keine Daten'}

### Skills (detailliert)
${skills.length > 0 ? skills.map((s: any) => `- ${s.skill_name} (Level: ${s.level || '?'}, ${s.years_experience ? s.years_experience + ' Jahre' : '?'}, Kategorie: ${s.category || '?'})`).join('\n') : 'Keine detaillierten Skills'}

### Sprachen
${languages.length > 0 ? languages.map((l: any) => `- ${l.language}: ${l.proficiency || '?'}`).join('\n') : 'Keine Daten'}

### CV-Zusammenfassung
${candidate.cv_ai_summary || candidate.summary || 'Keine Zusammenfassung verfügbar'}

### Interview-Notizen
${interviewNotes ? `Wechselmotivation: ${interviewNotes.change_motivation || 'N/A'}
Aktuelles Gehalt: ${interviewNotes.salary_current || 'N/A'}
Wunschgehalt: ${interviewNotes.salary_desired || 'N/A'}
Karriereziel: ${interviewNotes.career_ultimate_goal || 'N/A'}
Empfehlung: ${interviewNotes.would_recommend ? 'Ja' : 'Nein'}` : 'Keine Interview-Daten'}

${aiAssessment ? `### Bisherige AI-Einschätzung
Overall Score: ${aiAssessment.overall_score}/100
Risiko-Level: ${aiAssessment.risk_level}
Empfehlung: ${aiAssessment.recommendation}` : ''}

---

## STELLE
Titel: ${job.title}
Beschreibung: ${job.description || 'N/A'}
Must-Haves: ${Array.isArray(job.must_haves) ? job.must_haves.join(', ') : job.must_haves || 'N/A'}
Nice-to-Haves: ${Array.isArray(job.nice_to_haves) ? job.nice_to_haves.join(', ') : job.nice_to_haves || 'N/A'}
Erfahrungslevel: ${job.experience_level || 'N/A'}
Gehalt: ${job.salary_min ? `${job.salary_min}–${job.salary_max} EUR` : 'N/A'}
Standort: ${job.location || 'N/A'}
Remote: ${job.remote_policy || 'N/A'}

---

Erstelle ein vollständiges Fit Assessment.`;

    // 6. Call Lovable AI Gateway with function calling
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_fit_assessment",
              description: "Submit the structured fit assessment result.",
              parameters: {
                type: "object",
                properties: {
                  overall_verdict: { type: "string", enum: ["strong_fit", "good_fit", "partial_fit", "weak_fit", "no_fit"] },
                  overall_score: { type: "integer", minimum: 0, maximum: 100 },
                  executive_summary: { type: "string", description: "2-4 Sätze Gesamtbewertung auf Deutsch" },
                  verdict_confidence: { type: "string", enum: ["high", "medium", "low"] },
                  requirement_assessments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        requirement: { type: "string" },
                        status: { type: "string", enum: ["met", "partially_met", "not_met", "insufficient_data"] },
                        evidence: { type: "string" },
                        score: { type: "integer", minimum: 0, maximum: 100 },
                      },
                      required: ["requirement", "status", "evidence", "score"],
                    },
                  },
                  bonus_qualifications: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        qualification: { type: "string" },
                        present: { type: "boolean" },
                        evidence: { type: "string" },
                      },
                      required: ["qualification", "present", "evidence"],
                    },
                  },
                  gap_analysis: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        gap: { type: "string" },
                        severity: { type: "string", enum: ["critical", "moderate", "minor"] },
                        mitigation: { type: "string" },
                      },
                      required: ["gap", "severity", "mitigation"],
                    },
                  },
                  career_trajectory: {
                    type: "object",
                    properties: {
                      direction: { type: "string", enum: ["upward", "lateral", "pivoting", "unclear"] },
                      consistency: { type: "string", enum: ["high", "medium", "low"] },
                      explanation: { type: "string" },
                    },
                    required: ["direction", "consistency", "explanation"],
                  },
                  implicit_competencies: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        competency: { type: "string" },
                        evidence: { type: "string" },
                        confidence: { type: "string", enum: ["high", "medium", "low"] },
                      },
                      required: ["competency", "evidence", "confidence"],
                    },
                  },
                  motivation_fit: {
                    type: "object",
                    properties: {
                      score: { type: "integer", minimum: 0, maximum: 100 },
                      assessment: { type: "string" },
                      key_drivers: { type: "array", items: { type: "string" } },
                      concerns: { type: "array", items: { type: "string" } },
                    },
                    required: ["score", "assessment"],
                  },
                  dimension_scores: {
                    type: "object",
                    properties: {
                      technical_fit: { type: "integer", minimum: 0, maximum: 100 },
                      experience_fit: { type: "integer", minimum: 0, maximum: 100 },
                      seniority_fit: { type: "integer", minimum: 0, maximum: 100 },
                      location_fit: { type: "integer", minimum: 0, maximum: 100 },
                      salary_fit: { type: "integer", minimum: 0, maximum: 100 },
                      culture_fit: { type: "integer", minimum: 0, maximum: 100 },
                    },
                    required: ["technical_fit", "experience_fit", "seniority_fit"],
                  },
                  rejection_reasoning: { type: "string", description: "Nur ausfüllen wenn overall_verdict 'weak_fit' oder 'no_fit'" },
                },
                required: [
                  "overall_verdict", "overall_score", "executive_summary", "verdict_confidence",
                  "requirement_assessments", "bonus_qualifications", "gap_analysis",
                  "career_trajectory", "implicit_competencies", "dimension_scores",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_fit_assessment" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit erreicht. Bitte versuchen Sie es später erneut." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI-Kredit-Limit erreicht. Bitte kontaktieren Sie den Support." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI generation failed", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: "AI returned no structured result" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const assessment = JSON.parse(toolCall.function.arguments);
    const generationTimeMs = Date.now() - startTime;

    // Get user id from auth header
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));

    // 7. Upsert into database
    const { data: savedAssessment, error: upsertErr } = await supabase
      .from("candidate_fit_assessments")
      .upsert(
        {
          submission_id: submissionId,
          candidate_id,
          job_id,
          overall_verdict: assessment.overall_verdict,
          overall_score: assessment.overall_score,
          executive_summary: assessment.executive_summary,
          verdict_confidence: assessment.verdict_confidence,
          requirement_assessments: assessment.requirement_assessments || [],
          bonus_qualifications: assessment.bonus_qualifications || [],
          gap_analysis: assessment.gap_analysis || [],
          career_trajectory: assessment.career_trajectory || {},
          implicit_competencies: assessment.implicit_competencies || [],
          motivation_fit: assessment.motivation_fit || null,
          dimension_scores: assessment.dimension_scores || {},
          rejection_reasoning: assessment.rejection_reasoning || null,
          model_used: "google/gemini-2.5-flash",
          prompt_version: "v1",
          input_data_hash: inputHash,
          generation_time_ms: generationTimeMs,
          generated_at: new Date().toISOString(),
          generated_by: user?.id || null,
        },
        { onConflict: "submission_id" }
      )
      .select()
      .single();

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      return new Response(JSON.stringify({ error: "Failed to save assessment", details: upsertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, cached: false, assessment: savedAssessment }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("assess-candidate-fit error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
