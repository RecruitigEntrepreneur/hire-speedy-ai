import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { candidateId } = await req.json();

    if (!candidateId) {
      return new Response(
        JSON.stringify({ error: 'candidateId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating CV PDF for candidate: ${candidateId}`);

    // Fetch all candidate data
    const [candidateResult, experiencesResult, educationsResult, interviewNotesResult, skillsResult, languagesResult] = await Promise.all([
      supabase.from('candidates').select('*').eq('id', candidateId).single(),
      supabase.from('candidate_experiences').select('*').eq('candidate_id', candidateId).order('sort_order'),
      supabase.from('candidate_educations').select('*').eq('candidate_id', candidateId).order('sort_order'),
      supabase.from('candidate_interview_notes').select('*').eq('candidate_id', candidateId).maybeSingle(),
      supabase.from('candidate_skills').select('*').eq('candidate_id', candidateId),
      supabase.from('candidate_languages').select('*').eq('candidate_id', candidateId),
    ]);

    if (candidateResult.error || !candidateResult.data) {
      console.error('Error fetching candidate:', candidateResult.error);
      return new Response(
        JSON.stringify({ error: 'Candidate not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const candidate = candidateResult.data;
    const experiences = experiencesResult.data || [];
    const educations = educationsResult.data || [];
    const interviewNotes = interviewNotesResult.data;
    const skills = skillsResult.data || [];
    const languages = languagesResult.data || [];

    console.log(`Found: ${experiences.length} experiences, ${educations.length} educations, ${skills.length} skills`);

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    const { width, height } = page.getSize();

    // Load fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let yPosition = height - 50;
    const leftMargin = 50;
    const contentWidth = width - 100;

    // Helper function to draw text with word wrap
    const drawText = (text: string, font: typeof helvetica, size: number, maxWidth: number = contentWidth) => {
      const words = text.split(' ');
      let currentLine = '';
      const lines: string[] = [];

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, size);
        
        if (testWidth > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }

      for (const line of lines) {
        if (yPosition < 50) {
          const newPage = pdfDoc.addPage([595.28, 841.89]);
          yPosition = height - 50;
        }
        page.drawText(line, {
          x: leftMargin,
          y: yPosition,
          size,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });
        yPosition -= size + 4;
      }
    };

    const drawLine = () => {
      yPosition -= 5;
      page.drawLine({
        start: { x: leftMargin, y: yPosition },
        end: { x: width - leftMargin, y: yPosition },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      });
      yPosition -= 15;
    };

    // === HEADER ===
    // Name
    page.drawText(candidate.full_name.toUpperCase(), {
      x: leftMargin,
      y: yPosition,
      size: 24,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.3),
    });
    yPosition -= 30;

    // Job Title
    if (candidate.job_title) {
      page.drawText(candidate.job_title, {
        x: leftMargin,
        y: yPosition,
        size: 14,
        font: helvetica,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 25;
    }

    // Contact Info
    const contactParts: string[] = [];
    if (candidate.email) contactParts.push(`E-Mail: ${candidate.email}`);
    if (candidate.phone) contactParts.push(`Tel: ${candidate.phone}`);
    if (candidate.city) contactParts.push(`Ort: ${candidate.city}`);
    
    if (contactParts.length > 0) {
      page.drawText(contactParts.join('  |  '), {
        x: leftMargin,
        y: yPosition,
        size: 10,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 15;
    }

    // LinkedIn
    if (candidate.linkedin_url) {
      page.drawText(`LinkedIn: ${candidate.linkedin_url}`, {
        x: leftMargin,
        y: yPosition,
        size: 9,
        font: helvetica,
        color: rgb(0.2, 0.4, 0.7),
      });
      yPosition -= 20;
    }

    drawLine();

    // === PROFIL / ZUSAMMENFASSUNG ===
    page.drawText('PROFIL', {
      x: leftMargin,
      y: yPosition,
      size: 12,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.3),
    });
    yPosition -= 18;

    // Use expose_summary or generate one
    let profileSummary = candidate.expose_summary || candidate.cv_ai_summary;
    if (!profileSummary && interviewNotes) {
      profileSummary = `${candidate.job_title || 'Fachkraft'} mit ${candidate.experience_years || 'mehreren'} Jahren Erfahrung. ${interviewNotes.summary_motivation || ''}`;
    }
    if (!profileSummary) {
      profileSummary = `Erfahrene Fachkraft mit Expertise in ${(candidate.skills || []).slice(0, 3).join(', ')}.`;
    }
    
    drawText(profileSummary, helvetica, 10);
    yPosition -= 10;
    drawLine();

    // === BERUFSERFAHRUNG ===
    if (experiences.length > 0) {
      page.drawText('BERUFSERFAHRUNG', {
        x: leftMargin,
        y: yPosition,
        size: 12,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.3),
      });
      yPosition -= 18;

      for (const exp of experiences) {
        // Company and Title
        page.drawText(`${exp.company_name} | ${exp.job_title}`, {
          x: leftMargin,
          y: yPosition,
          size: 11,
          font: helveticaBold,
          color: rgb(0.2, 0.2, 0.2),
        });
        yPosition -= 14;

        // Date range
        const startDate = exp.start_date ? new Date(exp.start_date).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' }) : '';
        const endDate = exp.is_current ? 'Heute' : (exp.end_date ? new Date(exp.end_date).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' }) : '');
        const dateRange = `${exp.location || ''} | ${startDate} - ${endDate}`;
        
        page.drawText(dateRange, {
          x: leftMargin,
          y: yPosition,
          size: 9,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5),
        });
        yPosition -= 14;

        // Description
        if (exp.description) {
          drawText(exp.description, helvetica, 10);
        }
        yPosition -= 10;
      }
      
      drawLine();
    }

    // === AUSBILDUNG ===
    if (educations.length > 0) {
      page.drawText('AUSBILDUNG', {
        x: leftMargin,
        y: yPosition,
        size: 12,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.3),
      });
      yPosition -= 18;

      for (const edu of educations) {
        page.drawText(`${edu.institution}`, {
          x: leftMargin,
          y: yPosition,
          size: 11,
          font: helveticaBold,
          color: rgb(0.2, 0.2, 0.2),
        });
        yPosition -= 14;

        const eduDetails: string[] = [];
        if (edu.degree) eduDetails.push(edu.degree);
        if (edu.field_of_study) eduDetails.push(edu.field_of_study);
        if (edu.graduation_year) eduDetails.push(`Abschluss: ${edu.graduation_year}`);
        if (edu.grade) eduDetails.push(`Note: ${edu.grade}`);
        
        page.drawText(eduDetails.join(' | '), {
          x: leftMargin,
          y: yPosition,
          size: 9,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5),
        });
        yPosition -= 16;
      }
      
      drawLine();
    }

    // === FÄHIGKEITEN ===
    const allSkills = skills.map(s => s.skill_name);
    if (candidate.skills?.length) {
      allSkills.push(...candidate.skills.filter((s: string) => !allSkills.includes(s)));
    }

    if (allSkills.length > 0) {
      page.drawText('FÄHIGKEITEN', {
        x: leftMargin,
        y: yPosition,
        size: 12,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.3),
      });
      yPosition -= 18;

      drawText(allSkills.join('  •  '), helvetica, 10);
      yPosition -= 10;
      drawLine();
    }

    // === SPRACHEN ===
    if (languages.length > 0) {
      page.drawText('SPRACHEN', {
        x: leftMargin,
        y: yPosition,
        size: 12,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.3),
      });
      yPosition -= 18;

      const langTexts = languages.map(l => `${l.language}${l.proficiency ? ` (${l.proficiency})` : ''}`);
      drawText(langTexts.join('  •  '), helvetica, 10);
      yPosition -= 10;
      drawLine();
    }

    // === KARRIEREZIEL (from interview notes) ===
    if (interviewNotes?.career_ultimate_goal || interviewNotes?.career_3_5_year_plan) {
      page.drawText('KARRIEREZIEL', {
        x: leftMargin,
        y: yPosition,
        size: 12,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.3),
      });
      yPosition -= 18;

      if (interviewNotes.career_ultimate_goal) {
        drawText(interviewNotes.career_ultimate_goal, helvetica, 10);
        yPosition -= 5;
      }
      if (interviewNotes.career_3_5_year_plan) {
        drawText(`3-5 Jahres-Plan: ${interviewNotes.career_3_5_year_plan}`, helvetica, 10);
      }
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    console.log(`PDF generated: ${pdfBytes.length} bytes`);

    // Generate filename
    const safeName = candidate.full_name.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_');
    const fileName = `${candidateId}/${safeName}_Lebenslauf_v1.pdf`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('cv-documents')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('cv-documents')
      .getPublicUrl(fileName);

    const fileUrl = urlData.publicUrl;
    console.log(`Uploaded to: ${fileUrl}`);

    // Mark existing CV documents as not current
    await supabase
      .from('candidate_documents')
      .update({ is_current: false })
      .eq('candidate_id', candidateId)
      .eq('document_type', 'cv');

    // Get max version
    const { data: existingDocs } = await supabase
      .from('candidate_documents')
      .select('version')
      .eq('candidate_id', candidateId)
      .eq('document_type', 'cv')
      .order('version', { ascending: false })
      .limit(1);

    const newVersion = (existingDocs?.[0]?.version || 0) + 1;

    // Create document record
    const { error: docError, data: docData } = await supabase
      .from('candidate_documents')
      .insert({
        candidate_id: candidateId,
        document_type: 'cv',
        version: newVersion,
        file_name: `${candidate.full_name} - Lebenslauf.pdf`,
        file_url: fileUrl,
        file_size: pdfBytes.length,
        mime_type: 'application/pdf',
        is_current: true,
        notes: 'Automatisch generierter Lebenslauf mit Interview-Daten',
      })
      .select()
      .single();

    if (docError) {
      console.error('Document record error:', docError);
      return new Response(
        JSON.stringify({ error: `Document record failed: ${docError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update candidate with CV URL
    await supabase
      .from('candidates')
      .update({ cv_url: fileUrl })
      .eq('id', candidateId);

    console.log(`CV document created successfully: ${docData.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        document: docData,
        file_url: fileUrl,
        file_size: pdfBytes.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating CV PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
