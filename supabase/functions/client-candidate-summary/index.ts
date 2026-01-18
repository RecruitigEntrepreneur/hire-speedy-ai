import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RiskFactor {
  factor: string;
  severity: "low" | "medium" | "high";
  detail: string;
}

interface PositiveFactor {
  factor: string;
  strength: "low" | "medium" | "high";
  detail: string;
}

interface JobHopperAnalysis {
  is_job_hopper: boolean;
  avg_tenure_months: number;
  concern_level: "low" | "medium" | "high";
  explanation: string;
}

interface ClientSummary {
  executive_summary: string;
  risk_factors: RiskFactor[];
  positive_factors: PositiveFactor[];
  change_motivation_summary: string;
  career_goals: string;
  job_hopper_analysis: JobHopperAnalysis;
  recommendation_score: number;
  recommendation: "strong_yes" | "yes" | "maybe" | "no" | "strong_no";
  key_selling_points: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candidateId, submissionId } = await req.json();

    if (!candidateId) {
      return new Response(JSON.stringify({ error: "candidateId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all candidate data + job data via submission
    const [candidateResult, experiencesResult, interviewNotesResult, aiAssessmentResult, behaviorResult, submissionResult] = await Promise.all([
      supabase.from("candidates").select("*").eq("id", candidateId).single(),
      supabase.from("candidate_experiences").select("*").eq("candidate_id", candidateId).order("start_date", { ascending: false }),
      supabase.from("candidate_interview_notes").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: false }).limit(1),
      supabase.from("candidate_ai_assessment").select("*").eq("candidate_id", candidateId).maybeSingle(),
      supabase.from("candidate_behavior").select("*").eq("candidate_id", candidateId).maybeSingle(),
      submissionId 
        ? supabase.from("submissions").select("job_id, jobs(*)").eq("id", submissionId).single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (candidateResult.error) throw candidateResult.error;

    const candidate = candidateResult.data;
    const experiences = experiencesResult.data || [];
    const interviewNotes = interviewNotesResult.data?.[0] || null;
    const aiAssessment = aiAssessmentResult.data;
    const behavior = behaviorResult.data;
    const job = submissionResult.data?.jobs as any || null;

    console.log("[client-candidate-summary] Job context loaded:", job?.title || "No job context");

    // Calculate job hopper metrics
    const jobHopperAnalysis = calculateJobHopperAnalysis(experiences);

    // Build comprehensive prompt for AI
    const systemPrompt = `Du bist ein erfahrener Recruiting-Analyst. Erstelle eine prägnante Zusammenfassung für Kunden über einen Kandidaten.

Analysiere ALLE Informationen und erstelle ein strukturiertes JSON-Objekt mit:
1. executive_summary: 2-3 Sätze für die schnelle Entscheidung
2. risk_factors: Array von Risikofaktoren mit factor, severity (low/medium/high), detail
3. positive_factors: Array von Stärken mit factor, strength (low/medium/high), detail
4. change_motivation_summary: Warum der Kandidat wechseln möchte (1-2 Sätze)
5. career_goals: Mittel- bis langfristige Karriereziele des Kandidaten (1-2 Sätze, basierend auf Interview-Notizen wie career_3_5_year_plan oder career_ultimate_goal)
6. recommendation_score: 0-100 Gesamtbewertung
7. recommendation: strong_yes/yes/maybe/no/strong_no
8. key_selling_points: Array von 3-5 Kernstärken als kurze Strings

${job ? `WICHTIG - JOB-KONTEXT: Du hast Zugriff auf die konkrete Stellenanforderung des Kunden.
Bei der RISIKOANALYSE musst du UNBEDINGT den Job-Kontext berücksichtigen:
- Skill-Gaps: Welche Must-Have-Skills oder Nice-to-Haves fehlen dem Kandidaten im Vergleich zur Stelle?
- Erfahrungs-Gaps: Hat der Kandidat die geforderte Seniorität/Erfahrungsjahre?
- Gehalts-Fit: Liegt die Gehaltsvorstellung des Kandidaten im Budget des Kunden (salary_min - salary_max)?
- Standort-Fit: Passt der Wohnort zum Job-Standort und zur Remote-Policy?
- Verfügbarkeit: Passt die Kündigungsfrist zum gewünschten Starttermin?
- Sprachkenntnisse: Erfüllt der Kandidat die geforderten Sprachanforderungen?
- Zertifizierungen: Hat der Kandidat die geforderten Zertifikate?

Formuliere Risiken IMMER mit Bezug zur Stelle, z.B.:
- "Kubernetes-Erfahrung fehlt (Job: Must-Have)" statt nur "Kubernetes-Erfahrung fehlt"
- "Gehaltsvorstellung 95k€ über Budget (Job: 70-85k€)" statt nur "Hohe Gehaltsvorstellung"
- "Nur 2 Jahre React (Job fordert 5+ Jahre)" statt nur "Wenig React-Erfahrung"` : `Berücksichtige besonders:
- Gehaltsvorstellungen vs. typische Marktgehälter
- Skills und Erfahrung im Vergleich zu typischen Anforderungen`}

Weitere Bewertungskriterien:
- Wechselmotivation und Ernsthaftigkeit
- Verfügbarkeit und Kündigungsfristen
- Jobhopper-Tendenz (bereits berechnet, aber kontextualisieren)
- Kulturelle Passung basierend auf Interview-Notizen

Antworte NUR mit validem JSON ohne Markdown-Formatierung.`;

    // Build job context section if available
    const jobContextSection = job ? `
## Job-Anforderungen des Kunden (WICHTIG für Risiko-Analyse!)
- Position: ${job.title || "Nicht angegeben"}
- Unternehmen: ${job.company_name || "Nicht angegeben"}
- Beschreibung: ${job.description || "Keine Beschreibung"}
- Must-Have-Skills: ${Array.isArray(job.must_haves) ? job.must_haves.join(", ") : "Keine angegeben"}
- Nice-to-Have-Skills: ${Array.isArray(job.nice_to_haves) ? job.nice_to_haves.join(", ") : "Keine angegeben"}
- Geforderte Skills: ${Array.isArray(job.skills) ? job.skills.join(", ") : "Keine angegeben"}
- Anforderungen: ${job.requirements || "Keine spezifischen"}
- Gehaltsspanne: ${job.salary_min && job.salary_max ? `${job.salary_min.toLocaleString("de-DE")}€ - ${job.salary_max.toLocaleString("de-DE")}€` : "Nicht angegeben"}
- Standort: ${job.location || "Nicht angegeben"}
- Remote-Policy: ${job.remote_policy || job.remote_type || "Nicht angegeben"}
- Präsenztage pro Woche: ${job.onsite_days_required ?? "Nicht angegeben"}
- Erfahrungslevel: ${job.experience_level || job.seniority || "Nicht angegeben"}
- Geforderte Jahre Erfahrung: ${job.experience_years_min ? `${job.experience_years_min}+ Jahre` : "Nicht angegeben"}
- Sprachanforderungen: ${job.required_languages ? JSON.stringify(job.required_languages) : "Keine angegeben"}
- Zertifizierungen: ${Array.isArray(job.required_certifications) ? job.required_certifications.join(", ") : "Keine gefordert"}
- Startdatum gewünscht: ${job.start_date || "Flexibel"}
- Briefing-Notizen: ${job.briefing_notes || "Keine"}
` : "";

    const userPrompt = `Analysiere diesen Kandidaten${job ? " FÜR DIE KONKRETE STELLE" : ""}:
${jobContextSection}
## Kandidatenprofil
- Name: ${candidate.full_name}
- Aktuelle Position: ${candidate.job_title || "Nicht angegeben"}
- Erfahrung: ${candidate.experience_years || 0} Jahre
- Standort: ${candidate.city || "Nicht angegeben"}
- Aktuelles Gehalt: ${candidate.current_salary ? `${candidate.current_salary.toLocaleString("de-DE")}€` : "Nicht angegeben"}
- Gehaltsvorstellung: ${candidate.expected_salary ? `${candidate.expected_salary.toLocaleString("de-DE")}€` : candidate.salary_expectation_min && candidate.salary_expectation_max ? `${candidate.salary_expectation_min.toLocaleString("de-DE")}€ - ${candidate.salary_expectation_max.toLocaleString("de-DE")}€` : "Nicht angegeben"}
- Verfügbarkeit: ${candidate.availability_date || "Nicht angegeben"}
- Kündigungsfrist: ${candidate.notice_period || "Nicht angegeben"}
- Remote-Präferenz: ${candidate.remote_preference || candidate.work_model || (candidate.remote_possible ? "Remote möglich" : "Nicht angegeben")}
- Kandidaten-Skills: ${(candidate.skills || []).join(", ") || "Keine angegeben"}
- Zertifikate: ${Array.isArray(candidate.certifications) ? candidate.certifications.join(", ") : "Keine angegeben"}
- Sprachen: ${candidate.language_skills ? JSON.stringify(candidate.language_skills) : "Keine angegeben"}

## Jobhopper-Analyse (bereits berechnet)
- Durchschnittliche Verweildauer: ${jobHopperAnalysis.avg_tenure_months} Monate
- Ist Jobhopper: ${jobHopperAnalysis.is_job_hopper ? "Ja" : "Nein"}
- Bewertung: ${jobHopperAnalysis.concern_level}
- Erklärung: ${jobHopperAnalysis.explanation}

## Berufserfahrung
${experiences.map(exp => `- ${exp.job_title} bei ${exp.company_name} (${exp.start_date || "?"} - ${exp.end_date || "heute"}): ${exp.description || "Keine Beschreibung"}`).join("\n") || "Keine Erfahrung erfasst"}

${interviewNotes ? `## Interview-Notizen (Recruiter-Gespräch)
- Wechselmotivation: ${interviewNotes.change_motivation || "Nicht erfasst"}
- Was gefällt aktuell: ${interviewNotes.current_positive || "Nicht erfasst"}
- Was stört aktuell: ${interviewNotes.current_negative || "Nicht erfasst"}
- Warum jetzt wechseln: ${interviewNotes.why_now || "Nicht erfasst"}
- Karriereziel (3-5 Jahre): ${interviewNotes.career_3_5_year_plan || "Nicht erfasst"}
- Ultimatives Karriereziel: ${interviewNotes.career_ultimate_goal || "Nicht erfasst"}
- Gehaltsvorstellung: ${interviewNotes.salary_desired || "Nicht erfasst"}
- Minimum-Gehalt: ${interviewNotes.salary_minimum || "Nicht erfasst"}
- Empfehlung Recruiter: ${interviewNotes.would_recommend ? "Ja" : interviewNotes.would_recommend === false ? "Nein" : "Nicht bewertet"}
- Recruiter-Notizen: ${interviewNotes.recommendation_notes || "Keine"}
- Motivation-Tags: ${(interviewNotes.change_motivation_tags || []).join(", ") || "Keine"}` : "## Interview-Notizen\nKeine Interview-Notizen vorhanden"}

${aiAssessment ? `## Bestehende AI-Bewertung
- Gesamtscore: ${aiAssessment.overall_score}/100
- Risiko-Level: ${aiAssessment.risk_level}
- Empfehlung: ${aiAssessment.recommendation}
- Platzierungswahrscheinlichkeit: ${aiAssessment.placement_probability}%` : ""}

${behavior ? `## Engagement-Daten
- Engagement-Level: ${behavior.engagement_level}
- Emails geöffnet: ${behavior.emails_opened}
- Abschluss-Wahrscheinlichkeit: ${behavior.closing_probability}%` : ""}

Erstelle jetzt die Client-Zusammenfassung als JSON.${job ? " Achte besonders auf den Vergleich Kandidat vs. Job-Anforderungen bei den Risiken!" : ""}`;

    console.log("[client-candidate-summary] Calling AI for candidate:", candidateId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[client-candidate-summary] AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    console.log("[client-candidate-summary] AI response received, parsing...");

    // Parse AI response
    let parsedSummary: ClientSummary;
    try {
      // Remove markdown code blocks if present
      let cleanContent = aiContent.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      parsedSummary = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error("[client-candidate-summary] Failed to parse AI response:", parseError, aiContent);
      throw new Error("Failed to parse AI response");
    }

    // Merge calculated job hopper analysis with AI context
    const finalSummary = {
      ...parsedSummary,
      job_hopper_analysis: jobHopperAnalysis,
    };

    // Save to database
    const { data: savedSummary, error: saveError } = await supabase
      .from("candidate_client_summary")
      .upsert({
        candidate_id: candidateId,
        submission_id: submissionId || null,
        executive_summary: finalSummary.executive_summary,
        risk_factors: finalSummary.risk_factors,
        positive_factors: finalSummary.positive_factors,
        change_motivation_summary: finalSummary.change_motivation_summary,
        career_goals: finalSummary.career_goals || null,
        job_hopper_analysis: finalSummary.job_hopper_analysis,
        recommendation_score: finalSummary.recommendation_score,
        recommendation: finalSummary.recommendation,
        key_selling_points: finalSummary.key_selling_points,
        generated_at: new Date().toISOString(),
        model_version: "v2-job-context",
      }, {
        onConflict: "candidate_id",
      })
      .select()
      .single();

    if (saveError) {
      console.error("[client-candidate-summary] Failed to save summary:", saveError);
      // Try insert if upsert failed
      const { data: insertedSummary, error: insertError } = await supabase
        .from("candidate_client_summary")
        .insert({
          candidate_id: candidateId,
          submission_id: submissionId || null,
          executive_summary: finalSummary.executive_summary,
          risk_factors: finalSummary.risk_factors,
          positive_factors: finalSummary.positive_factors,
          change_motivation_summary: finalSummary.change_motivation_summary,
          career_goals: finalSummary.career_goals || null,
          job_hopper_analysis: finalSummary.job_hopper_analysis,
          recommendation_score: finalSummary.recommendation_score,
          recommendation: finalSummary.recommendation,
          key_selling_points: finalSummary.key_selling_points,
          generated_at: new Date().toISOString(),
          model_version: "v2-job-context",
        })
        .select()
        .single();

      if (insertError) {
        console.error("[client-candidate-summary] Insert also failed:", insertError);
      }
    }

    console.log("[client-candidate-summary] Summary generated successfully for:", candidateId);

    return new Response(JSON.stringify({ success: true, summary: finalSummary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[client-candidate-summary] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function calculateJobHopperAnalysis(experiences: any[]): JobHopperAnalysis {
  if (!experiences || experiences.length === 0) {
    return {
      is_job_hopper: false,
      avg_tenure_months: 0,
      concern_level: "low",
      explanation: "Keine Berufserfahrung erfasst - keine Bewertung möglich",
    };
  }

  const tenures: number[] = [];
  
  for (const exp of experiences) {
    if (exp.start_date) {
      const startDate = new Date(exp.start_date);
      const endDate = exp.end_date ? new Date(exp.end_date) : new Date();
      const months = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
      tenures.push(months);
    }
  }

  if (tenures.length === 0) {
    return {
      is_job_hopper: false,
      avg_tenure_months: 0,
      concern_level: "low",
      explanation: "Keine Datumsinformationen vorhanden",
    };
  }

  const avgTenure = Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length);
  const years = (avgTenure / 12).toFixed(1);

  // Determine concern level
  let concernLevel: "low" | "medium" | "high";
  let isJobHopper: boolean;
  let explanation: string;

  if (avgTenure < 12) {
    isJobHopper = true;
    concernLevel = "high";
    explanation = `Durchschnittlich nur ${avgTenure} Monate pro Position - deutliche Jobhopper-Tendenz`;
  } else if (avgTenure < 24) {
    isJobHopper = false;
    concernLevel = "medium";
    explanation = `Durchschnittlich ${years} Jahre pro Position - etwas wechselfreudig, im IT-Bereich aber akzeptabel`;
  } else {
    isJobHopper = false;
    concernLevel = "low";
    explanation = `Durchschnittlich ${years} Jahre pro Position - stabile Beschäftigungshistorie`;
  }

  return {
    is_job_hopper: isJobHopper,
    avg_tenure_months: avgTenure,
    concern_level: concernLevel,
    explanation,
  };
}
