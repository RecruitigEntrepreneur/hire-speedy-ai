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
  role_archetype: string;
  primary_domain: string;
  fit_assessment: "geeignet" | "grenzwertig" | "nicht_geeignet";
  risk_factors: RiskFactor[];
  positive_factors: PositiveFactor[];
  change_motivation_summary: string;
  change_motivation_status: "unbekannt" | "gering" | "mittel" | "hoch";
  career_goals: string;
  job_hopper_analysis: JobHopperAnalysis;
  // NOTE: recommendation_score REMOVED - V3.1 Match Engine is the single source of truth
  recommendation: "strong_yes" | "yes" | "maybe" | "no" | "strong_no";
  key_selling_points: string[];
}

// Helper: Detect role archetype from job title
function detectRoleArchetype(jobTitle: string | null, seniority: string | null): string {
  const level = seniority || "Mid-Level";
  if (!jobTitle) return `${level} Fachkraft`;
  
  const lower = jobTitle.toLowerCase();
  
  if (lower.includes('backend') || lower.includes('java') || lower.includes('node') || lower.includes('python') || lower.includes('go ') || lower.includes('golang')) {
    return `${level} Backend Engineer`;
  }
  if (lower.includes('frontend') || lower.includes('react') || lower.includes('vue') || lower.includes('angular')) {
    return `${level} Frontend Engineer`;
  }
  if (lower.includes('fullstack') || lower.includes('full stack') || lower.includes('full-stack')) {
    return `${level} Fullstack Engineer`;
  }
  if (lower.includes('data') && (lower.includes('engineer') || lower.includes('scientist'))) {
    return `${level} Data Engineer`;
  }
  if (lower.includes('machine learning') || lower.includes('ml ') || lower.includes(' ai ') || lower.includes('artificial intelligence')) {
    return `${level} ML Engineer`;
  }
  if (lower.includes('devops') || lower.includes('sre') || lower.includes('platform') || lower.includes('infrastructure')) {
    return `${level} DevOps/Platform Engineer`;
  }
  if (lower.includes('cloud') || lower.includes('azure') || lower.includes('aws') || lower.includes('gcp')) {
    return `${level} Cloud Engineer`;
  }
  if (lower.includes('product') && (lower.includes('manager') || lower.includes('owner'))) {
    return `${level} Product Manager`;
  }
  if (lower.includes('project') && lower.includes('manager')) {
    return `${level} Project Manager`;
  }
  if (lower.includes('lead') || lower.includes('architect') || lower.includes('principal')) {
    return `${level} Tech Lead/Architect`;
  }
  if (lower.includes('mobile') || lower.includes('ios') || lower.includes('android') || lower.includes('flutter') || lower.includes('react native')) {
    return `${level} Mobile Engineer`;
  }
  if (lower.includes('qa') || lower.includes('test') || lower.includes('quality')) {
    return `${level} QA Engineer`;
  }
  if (lower.includes('security') || lower.includes('cyber')) {
    return `${level} Security Engineer`;
  }
  if (lower.includes('consultant') || lower.includes('berater')) {
    return `${level} IT Consultant`;
  }
  
  return `${level} Software Engineer`;
}

// Helper: Detect primary domain from skills and job title
function detectPrimaryDomain(skills: string[] | null, jobTitle: string | null): string {
  const allText = [...(skills || []), jobTitle || ""].join(" ").toLowerCase();
  
  if (allText.includes('cloud') || allText.includes('aws') || allText.includes('azure') || allText.includes('gcp') || allText.includes('kubernetes') || allText.includes('docker')) {
    return "Cloud & Infrastructure";
  }
  if (allText.includes('data') || allText.includes('analytics') || allText.includes('warehouse') || allText.includes('etl') || allText.includes('spark')) {
    return "Data Engineering & Analytics";
  }
  if (allText.includes('machine learning') || allText.includes('ml') || allText.includes('tensorflow') || allText.includes('pytorch') || allText.includes('ai')) {
    return "Machine Learning & AI";
  }
  if (allText.includes('react') || allText.includes('vue') || allText.includes('angular') || allText.includes('frontend') || allText.includes('typescript') || allText.includes('javascript')) {
    return "Frontend & Web";
  }
  if (allText.includes('java') || allText.includes('spring') || allText.includes('node') || allText.includes('python') || allText.includes('golang') || allText.includes('backend')) {
    return "Backend & API";
  }
  if (allText.includes('mobile') || allText.includes('ios') || allText.includes('android') || allText.includes('swift') || allText.includes('kotlin')) {
    return "Mobile Development";
  }
  if (allText.includes('devops') || allText.includes('ci/cd') || allText.includes('jenkins') || allText.includes('terraform')) {
    return "DevOps & Automation";
  }
  if (allText.includes('security') || allText.includes('penetration') || allText.includes('compliance')) {
    return "Security & Compliance";
  }
  if (allText.includes('product') || allText.includes('agile') || allText.includes('scrum')) {
    return "Product & Agile";
  }
  
  return "Software Engineering";
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
    const hasInterview = !!interviewNotes;

    console.log("[client-candidate-summary] Job context loaded:", job?.title || "No job context");

    // Calculate job hopper metrics
    const jobHopperAnalysis = calculateJobHopperAnalysis(experiences);
    
    // Pre-calculate role archetype and domain
    const roleArchetype = detectRoleArchetype(candidate.job_title, candidate.seniority);
    const primaryDomain = detectPrimaryDomain(candidate.skills, candidate.job_title);

    // Build comprehensive prompt for AI with STRICT ANONYMIZATION RULES
    const systemPrompt = `Du bist ein erfahrener Recruiting-Analyst. Erstelle eine ANONYME, entscheidungsorientierte Zusammenfassung für Kunden.

🚨 KRITISCHE ANONYMISIERUNGS-REGELN (NIEMALS VERLETZEN!) 🚨
1. NIEMALS den Kandidaten-Namen verwenden - NUR "der Kandidat" oder "die Person"
2. NIEMALS "er", "sie", "sein", "ihr" verwenden - IMMER "der Kandidat"
3. NIEMALS frühere Arbeitgeber namentlich nennen - NUR Branche (z.B. "FinTech-Startup", "Automobilkonzern")
4. NIEMALS Städte nennen - NUR Regionen (z.B. "Süddeutschland", "DACH")
5. NIEMALS Aussagen die Rückschlüsse auf Identität zulassen

SPRACHLICHE VORGABEN (zwingend befolgen!):
❌ FALSCH: "Max Mustermann ist ein erfahrener Entwickler..."
✅ RICHTIG: "Der Kandidat verfügt über umfangreiche Entwicklungserfahrung..."

❌ FALSCH: "Er hat bei Siemens gearbeitet..."
✅ RICHTIG: "Der Kandidat bringt Erfahrung aus dem Großkonzern-Umfeld mit..."

❌ FALSCH: "Sie wohnt in München..."
✅ RICHTIG: "Der Kandidat ist in Süddeutschland ansässig..."

STRUKTUR (exakt einhalten):
1. executive_summary: 2-3 ANONYME Sätze, Fokus auf Anforderungen vs. Fakten, OHNE NAMEN
2. role_archetype: Bereits vorgegeben, übernehmen
3. primary_domain: Bereits vorgegeben, übernehmen  
4. fit_assessment: "geeignet" | "grenzwertig" | "nicht_geeignet" (basierend auf Job-Match)
5. risk_factors: Array von {factor, severity, detail} - OHNE NAMEN, OHNE FIRMENNAMEN
6. positive_factors: Array von {factor, strength, detail} - OHNE NAMEN
7. change_motivation_summary: ANONYME Zusammenfassung warum Wechsel (1-2 Sätze)
8. change_motivation_status: "unbekannt" | "gering" | "mittel" | "hoch"
9. career_goals: ANONYME Karriereziele (1-2 Sätze)
10. recommendation: strong_yes/yes/maybe/no/strong_no (qualitative Einschätzung, KEIN Score!)
11. key_selling_points: 3-5 ANONYME Kernstärken als kurze Strings

⚠️ WICHTIG: GENERIERE KEINEN NUMERISCHEN SCORE!
Das strukturierte Matching wird separat vom V3.1 Matching-Engine berechnet.
Fokussiere dich auf QUALITATIVE Insights (Texte, Risiken, Stärken).

${job ? `WICHTIG - JOB-KONTEXT: Du hast Zugriff auf die konkrete Stellenanforderung.
Bei der RISIKOANALYSE IMMER den Job-Kontext berücksichtigen:
- Skill-Gaps: Welche Must-Haves fehlen?
- Erfahrungs-Gaps: Passt die Seniorität?
- Gehalts-Fit: Liegt die Vorstellung im Budget?
- Standort-Fit: Passt zur Remote-Policy?
- Verfügbarkeit: Passt die Kündigungsfrist?

Formuliere Risiken MIT Job-Bezug (aber ANONYM):
✅ "Kubernetes-Erfahrung fehlt (Position erfordert Must-Have)"
✅ "Gehaltsvorstellung über Budget der Position"
❌ NICHT: "Max fehlt Kubernetes" oder "Position bei ACME AG"` : `Berücksichtige:
- Gehaltsvorstellungen vs. Markt
- Skills vs. typische Anforderungen
- Verfügbarkeit`}

WICHTIG: Wenn kein Interview geführt wurde, schreibe bei change_motivation_status "unbekannt" und erkläre das in change_motivation_summary.

Antworte NUR mit validem JSON ohne Markdown-Formatierung.`;

    // Build job context section if available (anonymized)
    const jobContextSection = job ? `
## Stellenanforderungen (WICHTIG für Matching!)
- Position: ${job.title || "Nicht angegeben"}
- Branche: ${job.industry || "Nicht angegeben"}
- Beschreibung: ${job.description || "Keine"}
- Must-Have-Skills: ${Array.isArray(job.must_haves) ? job.must_haves.join(", ") : "Keine"}
- Nice-to-Have-Skills: ${Array.isArray(job.nice_to_haves) ? job.nice_to_haves.join(", ") : "Keine"}
- Gehaltsspanne: ${job.salary_min && job.salary_max ? `${job.salary_min.toLocaleString("de-DE")}€ - ${job.salary_max.toLocaleString("de-DE")}€` : "Nicht angegeben"}
- Remote-Policy: ${job.remote_policy || job.remote_type || "Nicht angegeben"}
- Erfahrungslevel: ${job.experience_level || job.seniority || "Nicht angegeben"}
- Geforderte Jahre: ${job.experience_years_min ? `${job.experience_years_min}+` : "Nicht angegeben"}
` : "";

    // Build anonymized candidate profile for AI
    const userPrompt = `Analysiere diesen Kandidaten${job ? " FÜR DIE STELLE" : ""} und erstelle eine ANONYME Zusammenfassung:
${jobContextSection}
## Kandidatenprofil (ACHTUNG: Namen/Orte NICHT in Output übernehmen!)
- [ANONYM - Nicht ausgeben]: Kandidaten-ID für interne Referenz
- Rollen-Archetyp: ${roleArchetype}
- Primäre Domäne: ${primaryDomain}
- Erfahrung: ${candidate.experience_years || 0} Jahre
- Region: ${candidate.city ? "Angegeben" : "Nicht angegeben"} (NICHT den Ort nennen!)
- Gehaltsvorstellung: ${candidate.expected_salary ? `${candidate.expected_salary.toLocaleString("de-DE")}€` : candidate.salary_expectation_min && candidate.salary_expectation_max ? `${candidate.salary_expectation_min.toLocaleString("de-DE")}€ - ${candidate.salary_expectation_max.toLocaleString("de-DE")}€` : "Nicht angegeben"}
- Verfügbarkeit: ${candidate.availability_date || "Nicht angegeben"}
- Kündigungsfrist: ${candidate.notice_period || "Nicht angegeben"}
- Arbeitsmodell: ${candidate.remote_preference || candidate.work_model || (candidate.remote_possible ? "Remote möglich" : "Nicht angegeben")}
- Skills: ${(candidate.skills || []).join(", ") || "Keine angegeben"}
- Zertifikate: ${Array.isArray(candidate.certifications) ? candidate.certifications.join(", ") : "Keine"}

## Jobhopper-Analyse (bereits berechnet)
- Durchschnittliche Verweildauer: ${jobHopperAnalysis.avg_tenure_months} Monate
- Ist Jobhopper: ${jobHopperAnalysis.is_job_hopper ? "Ja" : "Nein"}
- Bewertung: ${jobHopperAnalysis.concern_level}
- Erklärung: ${jobHopperAnalysis.explanation}

## Berufserfahrung (Firmennamen NICHT im Output nennen - nur Branche!)
${experiences.map(exp => {
  // Anonymize company to industry hint
  const industryHint = exp.company_name?.toLowerCase().includes('bank') ? 'Finanzsektor' :
                       exp.company_name?.toLowerCase().includes('auto') ? 'Automobilindustrie' :
                       exp.company_name?.toLowerCase().includes('tech') ? 'Tech-Unternehmen' :
                       'Unternehmen';
  return `- Position bei ${industryHint} (${exp.start_date || "?"} - ${exp.end_date || "heute"}): ${exp.description || "Keine Beschreibung"}`;
}).join("\n") || "Keine Erfahrung erfasst"}

${hasInterview ? `## Interview-Notizen (Recruiter-Gespräch - ANONYM halten!)
- Wechselmotivation: ${interviewNotes.change_motivation || "Nicht erfasst"}
- Was gefällt aktuell: ${interviewNotes.current_positive || "Nicht erfasst"}
- Was stört aktuell: ${interviewNotes.current_negative || "Nicht erfasst"}
- Warum jetzt wechseln: ${interviewNotes.why_now || "Nicht erfasst"}
- Karriereziel (3-5 Jahre): ${interviewNotes.career_3_5_year_plan || "Nicht erfasst"}
- Ultimatives Karriereziel: ${interviewNotes.career_ultimate_goal || "Nicht erfasst"}
- Motivation-Tags: ${(interviewNotes.change_motivation_tags || []).join(", ") || "Keine"}` : `## Interview-Notizen
KEIN INTERVIEW GEFÜHRT - Wechselmotivation ist daher "unbekannt"!`}

${aiAssessment ? `## Bestehende AI-Bewertung
- Gesamtscore: ${aiAssessment.overall_score}/100
- Risiko-Level: ${aiAssessment.risk_level}
- Empfehlung: ${aiAssessment.recommendation}` : ""}

${behavior ? `## Engagement-Daten
- Engagement-Level: ${behavior.engagement_level}
- Abschluss-Wahrscheinlichkeit: ${behavior.closing_probability}%` : ""}

WICHTIG: Übernimm role_archetype "${roleArchetype}" und primary_domain "${primaryDomain}" exakt in dein JSON!

Erstelle jetzt die ANONYME Client-Zusammenfassung als JSON.`;

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

    // Ensure role_archetype and primary_domain are set (fallback if AI didn't include them)
    parsedSummary.role_archetype = parsedSummary.role_archetype || roleArchetype;
    parsedSummary.primary_domain = parsedSummary.primary_domain || primaryDomain;
    parsedSummary.fit_assessment = parsedSummary.fit_assessment || "grenzwertig";
    parsedSummary.change_motivation_status = parsedSummary.change_motivation_status || (hasInterview ? "mittel" : "unbekannt");

    // Merge calculated job hopper analysis with AI context
    const finalSummary = {
      ...parsedSummary,
      job_hopper_analysis: jobHopperAnalysis,
    };

    // Save to database with new fields (NO recommendation_score - V3.1 is source of truth)
    const { data: savedSummary, error: saveError } = await supabase
      .from("candidate_client_summary")
      .upsert({
        candidate_id: candidateId,
        submission_id: submissionId || null,
        executive_summary: finalSummary.executive_summary,
        role_archetype: finalSummary.role_archetype,
        primary_domain: finalSummary.primary_domain,
        fit_assessment: finalSummary.fit_assessment,
        risk_factors: finalSummary.risk_factors,
        positive_factors: finalSummary.positive_factors,
        change_motivation_summary: finalSummary.change_motivation_summary,
        change_motivation_status: finalSummary.change_motivation_status,
        career_goals: finalSummary.career_goals || null,
        job_hopper_analysis: finalSummary.job_hopper_analysis,
        // NOTE: recommendation_score intentionally omitted - V3.1 Match Engine provides the score
        recommendation: finalSummary.recommendation,
        key_selling_points: finalSummary.key_selling_points,
        generated_at: new Date().toISOString(),
        model_version: "v4-no-score",
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
          role_archetype: finalSummary.role_archetype,
          primary_domain: finalSummary.primary_domain,
          fit_assessment: finalSummary.fit_assessment,
          risk_factors: finalSummary.risk_factors,
          positive_factors: finalSummary.positive_factors,
          change_motivation_summary: finalSummary.change_motivation_summary,
          change_motivation_status: finalSummary.change_motivation_status,
          career_goals: finalSummary.career_goals || null,
          job_hopper_analysis: finalSummary.job_hopper_analysis,
          // NOTE: recommendation_score intentionally omitted
          recommendation: finalSummary.recommendation,
          key_selling_points: finalSummary.key_selling_points,
          generated_at: new Date().toISOString(),
          model_version: "v4-no-score",
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
