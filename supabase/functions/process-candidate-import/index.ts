import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface EmailClassification {
  classification: "new_candidate" | "candidate_update" | "candidate_notes" | "candidate_with_notes" | "multi_candidate" | "unprocessable";
  confidence: number;
  has_meaningful_body: boolean;
  body_is_forwarding_artifact: boolean;
  extracted_notes: string | null;
  note_categories: string[];
  candidate_name_from_body: string | null;
  reasoning: string;
}

interface Attachment {
  storage_path: string;
  original_name: string;
  size_bytes: number;
  mime_type: string;
}

interface MatchResult {
  candidate_id: string;
  method: string;
  confidence: number;
}

// ─── AI Classification ──────────────────────────────────────────────────────

const CLASSIFICATION_SYSTEM_PROMPT = `Du bist ein intelligenter E-Mail-Klassifizierer fuer ein Recruiting-System.
Recruiter leiten Kandidaten-CVs und Notizen an ihre persoenliche Matchunt-E-Mail-Adresse weiter.

Analysiere die eingehende E-Mail und bestimme:
1. Was wurde gesendet? (CV, Notizen, beides, oder unklar)
2. Ist der E-Mail-Body relevanter Recruiter-Content oder nur Weiterleitungs-Artefakte?
3. Falls Notizen vorhanden: Welche Kategorie(n)?
4. Falls kein CV-Anhang: Auf welchen Kandidaten beziehen sich die Notizen?

REGELN fuer Body-Analyse:
- Weiterleitungs-Artefakte IGNORIEREN: "FYI", "Siehe Anhang", "---------- Forwarded message ----------",
  "Von: ... Gesendet: ... An: ...", "Begin forwarded message", E-Mail-Signaturen, "Mit freundlichen Gruessen"
- Als RELEVANTE NOTIZEN zaehlen: Persoenliche Einschaetzungen, Interview-Feedback,
  Gehaltsinfos, Kuendigungsfristen, Soft-Skills-Bewertungen, Verfuegbarkeit,
  Motivation des Kandidaten, Risiken/Bedenken
- Kurze Saetze wie "Guter Kandidat" oder "Bitte anlegen" SIND relevante Notizen (Kategorie: general)
- Body-Text mit mehr als 2 Saetzen inhaltlicher Bewertung = relevante Notizen

REGELN fuer Kandidaten-Erkennung (bei Notizen ohne CV):
- Extrahiere den vollen Namen des Kandidaten aus dem Text
- Suche nach Mustern wie "Interview mit [Name]", "Gespraech mit [Name]",
  "Nochmal zu [Name]", "[Name] war...", "Bezueglich [Name]", "Zu [Name]:"
- Der Name ist NICHT der Name des Absenders oder ein Firmenname

REGELN fuer Notizkategorien:
- "interview_impression": Interviewfeedback, persoenlicher Eindruck, Gespraechsbewertung
- "soft_skills": Kommunikation, Teamfaehigkeit, Auftreten, Motivation
- "risks": Bedenken, rote Flaggen, Kuendigungsgrund, Wechselmotivation unklar
- "strengths": Technische Staerken, besondere Qualifikationen, Alleinstellungsmerkmale
- "special_wishes": Gehaltsvorstellung, Remote-Wunsch, Standort-Praeferenz, Kuendigungsfrist
- "general": Alles andere`;

const CLASSIFICATION_TOOL = {
  type: "function" as const,
  function: {
    name: "classify_email",
    description: "Klassifiziert eine eingehende Recruiter-E-Mail",
    parameters: {
      type: "object",
      properties: {
        classification: {
          type: "string",
          enum: ["new_candidate", "candidate_update", "candidate_notes", "candidate_with_notes", "multi_candidate", "unprocessable"],
          description: "new_candidate: CV-Anhang, vermutlich neuer Kandidat. candidate_update: CV-Anhang fuer bestehenden Kandidaten (Betreff deutet auf Update hin). candidate_notes: Nur Text, kein CV-Anhang. candidate_with_notes: CV-Anhang + relevante Notizen im Body. multi_candidate: Mehrere CV-Anhaenge. unprocessable: Nicht auswertbar.",
        },
        confidence: { type: "number", description: "Konfidenz 0.0-1.0" },
        has_meaningful_body: { type: "boolean", description: "true wenn Body relevante Recruiter-Notizen enthaelt" },
        body_is_forwarding_artifact: { type: "boolean", description: "true wenn Body nur Weiterleitungs-Header/Signaturen enthaelt" },
        extracted_notes: { type: "string", description: "Der bereinigte Notizentext (ohne Artefakte/Signaturen). Leer wenn keine Notizen." },
        note_categories: {
          type: "array",
          items: { type: "string", enum: ["interview_impression", "soft_skills", "risks", "strengths", "special_wishes", "general"] },
          description: "Erkannte Kategorien",
        },
        candidate_name_from_body: { type: "string", description: "Extrahierter Kandidatenname aus dem Body (fuer notes-only). Leer wenn nicht erkennbar." },
        reasoning: { type: "string", description: "Kurze Begruendung" },
      },
      required: ["classification", "confidence", "has_meaningful_body", "body_is_forwarding_artifact", "note_categories", "reasoning"],
    },
  },
};

async function classifyEmail(
  apiKey: string,
  fromName: string,
  fromEmail: string,
  subject: string,
  bodyText: string,
  attachmentCount: number,
  attachmentNames: string[]
): Promise<EmailClassification> {
  const userMessage = `E-MAIL-ANALYSE:

Absender: ${fromName} <${fromEmail}>
Betreff: ${subject}
Anhaenge: ${attachmentCount} PDF-Datei(en) (${attachmentNames.join(", ") || "keine"})

BODY:
---
${bodyText.substring(0, 3000)}
---`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      temperature: 0.2,
      messages: [
        { role: "system", content: CLASSIFICATION_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      tools: [CLASSIFICATION_TOOL],
      tool_choice: { type: "function", function: { name: "classify_email" } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI classification failed: ${response.status} ${errText}`);
  }

  const result = await response.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("AI returned no classification");
  }

  return JSON.parse(toolCall.function.arguments);
}

// ─── Candidate Matching ─────────────────────────────────────────────────────

async function matchCandidate(
  supabase: any,
  recruiterId: string,
  email?: string,
  phone?: string,
  fullName?: string
): Promise<MatchResult | null> {
  // Step 1a: Email match (highest confidence)
  if (email && email !== `unknown-${Date.now()}@placeholder.com` && !email.includes("placeholder")) {
    const { data } = await supabase
      .from("candidates")
      .select("id")
      .eq("recruiter_id", recruiterId)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (data) return { candidate_id: data.id, method: "email", confidence: 0.99 };
  }

  // Step 1b: Phone match
  if (phone) {
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, "");
    const { data } = await supabase
      .from("candidates")
      .select("id")
      .eq("recruiter_id", recruiterId)
      .not("phone", "is", null)
      .limit(50);

    if (data) {
      const phoneMatch = data.find((c: any) =>
        c.phone && c.phone.replace(/[\s\-\(\)]/g, "") === normalizedPhone
      );
      if (phoneMatch) return { candidate_id: phoneMatch.id, method: "phone", confidence: 0.90 };
    }
  }

  // Step 1c / 2a: Name match
  if (fullName && fullName !== "Unbekannt") {
    // Exact match
    const { data: exactMatch } = await supabase
      .from("candidates")
      .select("id")
      .eq("recruiter_id", recruiterId)
      .ilike("full_name", fullName)
      .limit(1)
      .maybeSingle();

    if (exactMatch) return { candidate_id: exactMatch.id, method: "name", confidence: 0.80 };

    // Fuzzy match: split name into parts
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      const firstName = parts[0];
      const lastName = parts[parts.length - 1];

      const { data: fuzzyMatches } = await supabase
        .from("candidates")
        .select("id, full_name, updated_at")
        .eq("recruiter_id", recruiterId)
        .ilike("full_name", `%${firstName}%`)
        .ilike("full_name", `%${lastName}%`)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (fuzzyMatches && fuzzyMatches.length === 1) {
        return { candidate_id: fuzzyMatches[0].id, method: "name", confidence: 0.60 };
      }
      if (fuzzyMatches && fuzzyMatches.length > 1) {
        // Pick most recently updated
        return { candidate_id: fuzzyMatches[0].id, method: "name", confidence: 0.40 };
      }
    }
  }

  return null;
}

// ─── Save Parsed Candidate (server-side port of useCvParsing.saveParsedCandidate) ──

function normalizeDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const str = dateStr.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // YYYY-MM
  if (/^\d{4}-\d{2}$/.test(str)) return `${str}-01`;
  // YYYY
  if (/^\d{4}$/.test(str)) return `${str}-01-01`;

  // German/English month names
  const monthMap: Record<string, string> = {
    januar: "01", february: "02", februar: "02", march: "03", maerz: "03", märz: "03",
    april: "04", may: "05", mai: "05", june: "06", juni: "06", july: "07", juli: "07",
    august: "08", september: "09", october: "10", oktober: "10", november: "11",
    december: "12", dezember: "12", jan: "01", feb: "02", mar: "03", apr: "04",
    jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };

  const monthMatch = str.match(/(\w+)\s+(\d{4})/i);
  if (monthMatch) {
    const month = monthMap[monthMatch[1].toLowerCase()];
    if (month) return `${monthMatch[2]}-${month}-01`;
  }

  // MM/YYYY or MM.YYYY
  const slashMatch = str.match(/^(\d{1,2})[\/.](\d{4})$/);
  if (slashMatch) return `${slashMatch[2]}-${slashMatch[1].padStart(2, "0")}-01`;

  return null;
}

async function saveParsedCandidate(
  supabase: any,
  parsedData: any,
  cvRawText: string,
  recruiterId: string,
  existingCandidateId?: string,
  storagePath?: string,
  originalFileName?: string,
  fileSize?: number
): Promise<string | null> {
  const candidateData: Record<string, any> = {
    full_name: parsedData.full_name || "Unbekannt",
    email: parsedData.email || `unknown-${Date.now()}@placeholder.com`,
    phone: parsedData.phone || null,
    linkedin_url: parsedData.linkedin_url || null,
    city: parsedData.location || null,
    portfolio_url: parsedData.portfolio_url || null,
    github_url: parsedData.github_url || null,
    website_url: parsedData.website_url || null,
    job_title: parsedData.current_title || null,
    company: parsedData.current_company || null,
    experience_years: parsedData.experience_years || null,
    seniority: parsedData.seniority || null,
    cv_ai_summary: parsedData.cv_ai_summary || null,
    cv_ai_bullets: parsedData.cv_ai_bullets || null,
    summary: parsedData.cv_ai_summary || null,
    current_salary: parsedData.current_salary || null,
    expected_salary: parsedData.salary_expectation_max || null,
    salary_expectation_min: parsedData.salary_expectation_min || null,
    salary_expectation_max: parsedData.salary_expectation_max || null,
    notice_period: parsedData.notice_period || null,
    availability_date: parsedData.availability_from || null,
    relocation_willing: parsedData.relocation_ready || null,
    remote_preference: parsedData.remote_preference || null,
    remote_possible: parsedData.remote_preference === "remote" || parsedData.remote_preference === "hybrid",
    target_roles: parsedData.target_roles || null,
    target_industries: parsedData.target_industries || null,
    target_employment_type: parsedData.target_employment_type || null,
    cv_raw_text: cvRawText,
    cv_parsed_at: new Date().toISOString(),
    cv_parser_version: "v3",
    import_source: "email_import",
    skills: parsedData.skills?.map((s: any) => s.name) || null,
    recruiter_id: recruiterId,
  };

  let candidateId: string;

  if (existingCandidateId) {
    const { error: updateError } = await supabase
      .from("candidates")
      .update(candidateData)
      .eq("id", existingCandidateId);

    if (updateError) throw updateError;
    candidateId = existingCandidateId;

    // Re-import child tables
    await Promise.all([
      supabase.from("candidate_experiences").delete().eq("candidate_id", candidateId),
      supabase.from("candidate_educations").delete().eq("candidate_id", candidateId),
      supabase.from("candidate_languages").delete().eq("candidate_id", candidateId),
      supabase.from("candidate_skills").delete().eq("candidate_id", candidateId),
    ]);
  } else {
    const { data: newCandidate, error: insertError } = await supabase
      .from("candidates")
      .insert(candidateData)
      .select("id")
      .single();

    if (insertError) throw insertError;
    candidateId = newCandidate.id;
  }

  // Insert experiences
  if (parsedData.experiences?.length > 0) {
    const experiencesData = parsedData.experiences.map((exp: any, index: number) => ({
      candidate_id: candidateId,
      company_name: exp.company_name,
      job_title: exp.job_title,
      location: exp.location,
      start_date: normalizeDate(exp.start_date),
      end_date: normalizeDate(exp.end_date),
      is_current: exp.is_current,
      description: exp.description,
      sort_order: index,
    }));
    await supabase.from("candidate_experiences").insert(experiencesData);
  }

  // Insert educations
  if (parsedData.educations?.length > 0) {
    const educationsData = parsedData.educations.map((edu: any, index: number) => ({
      candidate_id: candidateId,
      institution: edu.institution,
      degree: edu.degree,
      field_of_study: edu.field_of_study,
      graduation_year: edu.graduation_year,
      grade: edu.grade,
      sort_order: index,
    }));
    await supabase.from("candidate_educations").insert(educationsData);
  }

  // Insert languages
  if (parsedData.languages?.length > 0) {
    const languagesData = parsedData.languages.map((lang: any) => ({
      candidate_id: candidateId,
      language: lang.language,
      proficiency: lang.proficiency,
    }));
    await supabase.from("candidate_languages").insert(languagesData);
  }

  // Insert skills
  if (parsedData.skills?.length > 0) {
    const skillsData = parsedData.skills.map((skill: any) => ({
      candidate_id: candidateId,
      skill_name: skill.name,
      category: skill.category,
      level: skill.level,
    }));
    await supabase.from("candidate_skills").insert(skillsData);
  }

  // Save CV document
  if (storagePath) {
    await supabase
      .from("candidate_documents")
      .update({ is_current: false })
      .eq("candidate_id", candidateId)
      .eq("document_type", "cv");

    const { data: existingDocs } = await supabase
      .from("candidate_documents")
      .select("version")
      .eq("candidate_id", candidateId)
      .eq("document_type", "cv")
      .order("version", { ascending: false })
      .limit(1);

    const newVersion = (existingDocs?.[0]?.version || 0) + 1;

    const { data: publicUrl } = supabase.storage
      .from("cv-documents")
      .getPublicUrl(storagePath);

    await supabase.from("candidate_documents").insert({
      candidate_id: candidateId,
      document_type: "cv",
      version: newVersion,
      file_name: originalFileName || "cv.pdf",
      file_url: publicUrl.publicUrl,
      file_size: fileSize || 0,
      mime_type: "application/pdf",
      is_current: true,
      uploaded_by: recruiterId,
    });
  }

  return candidateId;
}

// ─── Note Creation ──────────────────────────────────────────────────────────

async function createCandidateNote(
  supabase: any,
  candidateId: string,
  recruiterId: string,
  content: string,
  categories: string[],
  importJobId: string
) {
  // Create structured note
  await supabase.from("candidate_notes").insert({
    candidate_id: candidateId,
    recruiter_id: recruiterId,
    content: content,
    category: categories[0] || "general",
    is_private: true,
    is_pinned: false,
    source: "email_import",
    import_job_id: importJobId,
  });

  // Create activity log entry
  await supabase.from("candidate_activity_log").insert({
    candidate_id: candidateId,
    recruiter_id: recruiterId,
    activity_type: "email_import",
    title: "Notizen per E-Mail hinzugefuegt",
    description: content.substring(0, 200),
    metadata: {
      import_job_id: importJobId,
      note_categories: categories,
      source: "email",
    },
  });
}

// ─── Confirmation Email ─────────────────────────────────────────────────────

async function sendConfirmationEmail(
  supabase: any,
  recruiterId: string,
  toEmail: string,
  subject: string,
  candidateNames: string[],
  notesAttached: boolean,
  isUpdate: boolean,
  needsReview: boolean
) {
  // Use Resend via existing patterns
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.log("[process-candidate-import] No RESEND_API_KEY, skipping confirmation email");
    return;
  }

  let statusText: string;
  if (needsReview) {
    statusText = "Konnte nicht automatisch zugeordnet werden – bitte manuell pruefen.";
  } else if (isUpdate) {
    statusText = `Kandidat aktualisiert: ${candidateNames.join(", ")}`;
  } else {
    statusText = `Neu angelegt: ${candidateNames.join(", ")}`;
  }

  const notesLine = notesAttached ? "\nDeine Notizen wurden dem Kandidatenprofil angehaengt." : "";

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Matchunt <noreply@matchunt.ai>",
        to: [toEmail],
        subject: `Re: ${subject || "Kandidaten-Import"}`,
        text: `Hallo,\n\ndeine E-Mail wurde verarbeitet.\n\n${statusText}${notesLine}\n\nViele Gruesse,\nMatchunt`,
      }),
    });
  } catch (err) {
    console.error("[process-candidate-import] Failed to send confirmation:", err);
  }
}

// ─── Main Handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  try {
    const { import_job_id } = await req.json();

    if (!import_job_id) {
      return new Response(
        JSON.stringify({ success: false, error: "import_job_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Load import job ──────────────────────────────────────────────

    const { data: job, error: jobError } = await supabase
      .from("candidate_import_jobs")
      .select("*")
      .eq("id", import_job_id)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ success: false, error: "Import job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (job.status !== "pending") {
      return new Response(
        JSON.stringify({ success: true, message: "Already processing or completed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as processing
    await supabase
      .from("candidate_import_jobs")
      .update({ status: "processing", processing_started_at: new Date().toISOString() })
      .eq("id", import_job_id);

    console.log(`[process-candidate-import] Processing job ${import_job_id}`);

    const attachments: Attachment[] = job.attachments || [];
    const pdfCount = attachments.length;
    const attachmentNames = attachments.map((a: Attachment) => a.original_name);

    // ─── 1. AI Classification ─────────────────────────────────────────

    let classification: EmailClassification;

    try {
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      classification = await classifyEmail(
        LOVABLE_API_KEY,
        job.from_name || "",
        job.from_email,
        job.subject || "",
        job.body_text || "",
        pdfCount,
        attachmentNames
      );

      console.log(`[process-candidate-import] Classification:`, JSON.stringify(classification));
    } catch (classErr) {
      console.error("[process-candidate-import] AI classification failed, using fallback:", classErr);

      // Fallback logic
      classification = {
        classification: pdfCount > 0 ? (pdfCount > 1 ? "multi_candidate" : "new_candidate") : "unprocessable",
        confidence: 0.5,
        has_meaningful_body: false,
        body_is_forwarding_artifact: true,
        extracted_notes: null,
        note_categories: [],
        candidate_name_from_body: null,
        reasoning: "Fallback: AI classification failed",
      };
    }

    // Override: if multiple PDFs, always multi_candidate
    if (pdfCount > 1 && classification.classification !== "multi_candidate") {
      classification.classification = "multi_candidate";
    }
    // Override: if PDFs present but classified as notes-only, upgrade
    if (pdfCount > 0 && classification.classification === "candidate_notes") {
      classification.classification = classification.has_meaningful_body ? "candidate_with_notes" : "new_candidate";
    }
    // Override: if no PDFs and classified as new_candidate, downgrade
    if (pdfCount === 0 && (classification.classification === "new_candidate" || classification.classification === "candidate_with_notes")) {
      classification.classification = classification.has_meaningful_body ? "candidate_notes" : "unprocessable";
    }

    // Save classification
    await supabase
      .from("candidate_import_jobs")
      .update({
        classification: classification.classification,
        classification_confidence: classification.confidence,
        classification_raw: classification,
        status: "classified",
      })
      .eq("id", import_job_id);

    // ─── 2. Process based on classification ───────────────────────────

    const createdCandidateIds: string[] = [];
    let matchedCandidateId: string | null = null;
    let matchMethod: string | null = null;
    let matchConfidence: number | null = null;
    let notesCreated = false;
    let isUpdate = false;
    let needsReview = false;
    const candidateNames: string[] = [];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Helper: process a single PDF through parse-pdf → parse-cv pipeline
    async function processPdf(att: Attachment): Promise<{ parsedData: any; rawText: string } | null> {
      try {
        // Step 1: Extract text from PDF
        const pdfResponse = await fetch(`${supabaseUrl}/functions/v1/parse-pdf`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pdfPath: att.storage_path }),
        });

        if (!pdfResponse.ok) throw new Error(`parse-pdf failed: ${pdfResponse.status}`);

        const pdfResult = await pdfResponse.json();
        const rawText = pdfResult.text;

        if (!rawText || rawText.length < 50) {
          console.log(`[process-candidate-import] PDF too short or empty: ${att.original_name}`);
          return null;
        }

        // Step 2: Parse CV
        const cvResponse = await fetch(`${supabaseUrl}/functions/v1/parse-cv`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cvText: rawText }),
        });

        if (!cvResponse.ok) throw new Error(`parse-cv failed: ${cvResponse.status}`);

        const cvResult = await cvResponse.json();
        return { parsedData: cvResult.data || cvResult, rawText };
      } catch (err) {
        console.error(`[process-candidate-import] PDF processing failed for ${att.original_name}:`, err);
        return null;
      }
    }

    // Helper: process a single CV (parse + match + save)
    async function processOneCandidate(att: Attachment): Promise<string | null> {
      const result = await processPdf(att);
      if (!result) return null;

      const { parsedData, rawText } = result;

      // Try to match existing candidate
      const match = await matchCandidate(
        supabase,
        job.recruiter_id,
        parsedData.email,
        parsedData.phone,
        parsedData.full_name
      );

      if (match) {
        matchedCandidateId = match.candidate_id;
        matchMethod = match.method;
        matchConfidence = match.confidence;
        isUpdate = true;
        console.log(`[process-candidate-import] Matched existing candidate: ${match.candidate_id} via ${match.method} (${match.confidence})`);
      }

      const candidateId = await saveParsedCandidate(
        supabase,
        parsedData,
        rawText,
        job.recruiter_id,
        match?.candidate_id,
        att.storage_path,
        att.original_name,
        att.size_bytes
      );

      if (candidateId) {
        candidateNames.push(parsedData.full_name || "Unbekannt");

        // Create activity log
        await supabase.from("candidate_activity_log").insert({
          candidate_id: candidateId,
          recruiter_id: job.recruiter_id,
          activity_type: "email_import",
          title: match ? "Kandidat per E-Mail aktualisiert" : "Kandidat per E-Mail angelegt",
          description: `CV: ${att.original_name}`,
          metadata: {
            import_job_id: import_job_id,
            source_email: job.from_email,
            is_update: !!match,
          },
        });
      }

      return candidateId;
    }

    // ─── Route by classification ──────────────────────────────────────

    switch (classification.classification) {
      case "new_candidate":
      case "candidate_with_notes":
      case "candidate_update": {
        if (attachments.length > 0) {
          const candidateId = await processOneCandidate(attachments[0]);
          if (candidateId) {
            createdCandidateIds.push(candidateId);

            // Attach notes if meaningful body detected
            if (classification.has_meaningful_body && classification.extracted_notes) {
              await createCandidateNote(
                supabase,
                candidateId,
                job.recruiter_id,
                classification.extracted_notes,
                classification.note_categories,
                import_job_id
              );
              notesCreated = true;
            }
          }
        }
        break;
      }

      case "multi_candidate": {
        for (const att of attachments) {
          const candidateId = await processOneCandidate(att);
          if (candidateId) {
            createdCandidateIds.push(candidateId);

            // Attach notes to all created candidates
            if (classification.has_meaningful_body && classification.extracted_notes) {
              await createCandidateNote(
                supabase,
                candidateId,
                job.recruiter_id,
                classification.extracted_notes,
                classification.note_categories,
                import_job_id
              );
              notesCreated = true;
            }
          }
        }
        break;
      }

      case "candidate_notes": {
        // Notes only - match by name from body
        const candidateName = classification.candidate_name_from_body;

        if (candidateName) {
          const match = await matchCandidate(supabase, job.recruiter_id, undefined, undefined, candidateName);

          if (match && match.confidence >= 0.5) {
            matchedCandidateId = match.candidate_id;
            matchMethod = match.method;
            matchConfidence = match.confidence;

            const noteContent = classification.extracted_notes || job.body_text || "";
            await createCandidateNote(
              supabase,
              match.candidate_id,
              job.recruiter_id,
              noteContent,
              classification.note_categories,
              import_job_id
            );
            notesCreated = true;
            candidateNames.push(candidateName);
            console.log(`[process-candidate-import] Notes attached to candidate ${match.candidate_id}`);
          } else {
            needsReview = true;
            console.log(`[process-candidate-import] No confident match for name: ${candidateName}`);
          }
        } else {
          needsReview = true;
          console.log(`[process-candidate-import] No candidate name extracted from body`);
        }
        break;
      }

      case "unprocessable":
      default: {
        needsReview = true;
        break;
      }
    }

    // ─── 3. Update import job with results ────────────────────────────

    const finalStatus = needsReview ? "needs_review" : "completed";

    await supabase
      .from("candidate_import_jobs")
      .update({
        matched_candidate_id: matchedCandidateId,
        match_method: matchMethod,
        match_confidence: matchConfidence,
        created_candidate_ids: createdCandidateIds,
        notes_created: notesCreated,
        status: finalStatus,
        completed_at: new Date().toISOString(),
      })
      .eq("id", import_job_id);

    console.log(`[process-candidate-import] Job ${import_job_id} → ${finalStatus}. Created: ${createdCandidateIds.length}, Notes: ${notesCreated}`);

    // ─── 4. Send confirmation email ───────────────────────────────────

    await sendConfirmationEmail(
      supabase,
      job.recruiter_id,
      job.from_email,
      job.subject || "",
      candidateNames,
      notesCreated,
      isUpdate,
      needsReview
    );

    return new Response(
      JSON.stringify({
        success: true,
        import_job_id,
        status: finalStatus,
        classification: classification.classification,
        created_candidates: createdCandidateIds.length,
        notes_created: notesCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[process-candidate-import] Unexpected error:", error);

    // Try to mark job as failed
    try {
      const { import_job_id } = await req.clone().json().catch(() => ({}));
      if (import_job_id) {
        await supabase
          .from("candidate_import_jobs")
          .update({ status: "failed", error_message: error.message || "Internal error", completed_at: new Date().toISOString() })
          .eq("id", import_job_id);
      }
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
