import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { assertNoLeak, redactCandidateForLLM, REDACTION_VERSION } from "../_shared/pii-redaction.ts";
import { buildJobSection, buildRawView, buildUserPrompt, FIT_MODEL, FIT_TOOL, SYSTEM_PROMPT } from "../_shared/fit-assessment.ts";

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

    // 2b. PII-Redaktion VOR der KI: Allowlist-Payload, direkte Identifikatoren raus.
    //     Flag PII_REDACTION_MODE (default "on"); "off" liefert die rohe Sicht.
    const redactionMode = (Deno.env.get("PII_REDACTION_MODE") ?? "on").toLowerCase();
    const redactionEnabled = redactionMode !== "off";
    const redaction = redactCandidateForLLM(
      candidate, experiences, skills, languages, interviewNotes, job.location ?? null, redactionMode,
    );
    const view = redactionEnabled
      ? redaction.view
      : buildRawView(candidate, experiences, skills, languages, interviewNotes, job);
    const { report: redactionReport, leakContext } = redaction;
    view.priorAssessment = aiAssessment
      ? {
          overall_score: aiAssessment.overall_score ?? null,
          risk_level: aiAssessment.risk_level ?? null,
          recommendation: aiAssessment.recommendation ?? null,
        }
      : null;
    const promptVersion = redactionEnabled ? "v2-redacted" : "v1";

    // 3. Compute input hash for caching (submission/candidate id + redaction version
    //    verhindern Cross-Kandidaten-Kollision und erzwingen Miss beim Rollout)
    const inputData = JSON.stringify({
      submissionId,
      candidate_id,
      redactionVersion: redactionEnabled ? REDACTION_VERSION : "none",
      candidate: { id: candidate.id, skills: candidate.skills, experience_years: candidate.experience_years, job_title: candidate.job_title, seniority: candidate.seniority, city: candidate.city, salary_expectation_min: candidate.salary_expectation_min, salary_expectation_max: candidate.salary_expectation_max, cv_ai_summary: candidate.cv_ai_summary, summary: candidate.summary, remote_preference: candidate.remote_preference, certifications: candidate.certifications },
      experiences: experiences.map((e: any) => ({ company: e.company_name, title: e.job_title, start: e.start_date, end: e.end_date, desc: e.description })),
      languages: languages.map((l: any) => ({ lang: l.language, prof: l.proficiency })),
      skills: skills.map((s: any) => ({ name: s.skill_name, level: s.level, years: s.years_experience, category: s.category })),
      interviewNotes: interviewNotes ? { motivation: interviewNotes.change_motivation, salary_current: interviewNotes.salary_current, salary_desired: interviewNotes.salary_desired, career_goals: interviewNotes.career_ultimate_goal, would_recommend: interviewNotes.would_recommend } : null,
      job: { id: job.id, title: job.title, description: job.description, must_haves: job.must_haves, nice_to_haves: job.nice_to_haves, experience_level: job.experience_level, salary_min: job.salary_min, salary_max: job.salary_max, location: job.location, remote_policy: job.remote_policy },
    });

    const inputHash = await sha256(inputData);

    // 4. Check cache (auf prompt_version gefiltert: alte v1-Roh-Assessments treffen nicht)
    if (!force) {
      const { data: existing } = await supabase
        .from("candidate_fit_assessments")
        .select("*")
        .eq("submission_id", submissionId)
        .eq("input_data_hash", inputHash)
        .eq("prompt_version", promptVersion)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ success: true, cached: true, assessment: existing }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 5. Build prompt (geteilter Builder — identisch für Edge Function und Golden-Eval)
    const jobSection = buildJobSection(job);
    const userPrompt = buildUserPrompt(view, jobSection);

    // 5b. Fail-closed Leak-Assertion: kein direkter Identifikator darf im Kandidaten-Teil
    //     des Prompts stehen. Die STELLEN-Sektion ist ausgenommen (Stellenort ist legitim
    //     und darf den Kandidaten-Wohnort-Token nicht fälschlich als Leak auslösen).
    if (redactionEnabled) {
      const candidatePromptPart = userPrompt.split(jobSection).join(" ");
      const leaks = assertNoLeak(candidatePromptPart, leakContext);
      if (leaks.length > 0) {
        console.error("pii-redaction: leak detected, aborting", JSON.stringify(leaks));
        return new Response(JSON.stringify({ error: "PII redaction safeguard triggered" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log("pii-redaction", JSON.stringify(redactionReport));
    }

    // 6. Call Lovable AI Gateway with function calling
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: FIT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [{ type: "function", function: FIT_TOOL }],
        tool_choice: { type: "function", function: { name: FIT_TOOL.name } },
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

    // Get user id from auth header (skip if called via service role key / pg_net trigger)
    let generatedBy: string | null = null;
    const token = authHeader.replace("Bearer ", "");
    if (token !== supabaseKey) {
      try {
        const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
        const { data: { user } } = await anonClient.auth.getUser(token);
        generatedBy = user?.id || null;
      } catch {
        // pg_net or service role call — no user context
        generatedBy = null;
      }
    }

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
          model_used: FIT_MODEL,
          prompt_version: promptVersion,
          input_data_hash: inputHash,
          generation_time_ms: generationTimeMs,
          generated_at: new Date().toISOString(),
          generated_by: generatedBy,
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
