import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { interview_id } = await req.json();
    
    if (!interview_id) {
      return new Response(JSON.stringify({ error: 'interview_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[generate-interview-prep] Generating prep for interview: ${interview_id}`);

    // Fetch interview details with related data
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select(`
        *,
        submission:submissions (
          id,
          match_score,
          recruiter_id,
          candidate:candidates (
            id,
            full_name,
            email,
            skills,
            experience_years,
            current_salary,
            expected_salary,
            summary
          ),
          job:jobs (
            id,
            title,
            company_name,
            description,
            requirements,
            skills,
            must_haves,
            nice_to_haves,
            salary_min,
            salary_max,
            industry,
            client_id
          )
        )
      `)
      .eq('id', interview_id)
      .single();

    if (interviewError || !interview) {
      console.error('[generate-interview-prep] Interview not found:', interviewError);
      return new Response(JSON.stringify({ error: 'Interview not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const submission = interview.submission;
    const candidate = submission?.candidate;
    const job = submission?.job;

    if (!candidate || !job) {
      return new Response(JSON.stringify({ error: 'Missing candidate or job data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch company profile for additional context
    const { data: companyProfile } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('user_id', job.client_id)
      .maybeSingle();

    // Build context for AI
    const context = {
      candidate: {
        name: candidate.full_name,
        skills: candidate.skills || [],
        experience_years: candidate.experience_years,
        summary: candidate.summary,
        current_salary: candidate.current_salary,
        expected_salary: candidate.expected_salary,
      },
      job: {
        title: job.title,
        company: job.company_name,
        description: job.description,
        requirements: job.requirements,
        skills: job.skills || [],
        must_haves: job.must_haves || [],
        nice_to_haves: job.nice_to_haves || [],
        salary_range: job.salary_min && job.salary_max ? `${job.salary_min}-${job.salary_max}€` : null,
        industry: job.industry,
      },
      company: companyProfile ? {
        description: companyProfile.description,
        industry: companyProfile.industry,
        website: companyProfile.website,
      } : null,
      match_score: submission?.match_score,
    };

    // Generate candidate prep using Lovable AI
    const candidatePrepPrompt = `Du bist ein Karriere-Coach. Basierend auf den folgenden Informationen, erstelle eine Interview-Vorbereitung für den Kandidaten.

Kandidat: ${JSON.stringify(context.candidate)}
Job: ${JSON.stringify(context.job)}
Unternehmen: ${JSON.stringify(context.company)}
Match-Score: ${context.match_score || 'N/A'}

Erstelle eine JSON-Antwort mit:
1. key_strengths: Array von 3-5 Stärken des Kandidaten für diese Position
2. improvement_areas: Array von 2-3 Bereichen, die der Kandidat ansprechen sollte
3. likely_questions: Array von 5-7 wahrscheinlichen Interview-Fragen
4. recommended_answers: Array von Objekten {question, answer} für die wichtigsten Fragen
5. tips: Array von 3-5 konkreten Tipps für das Interview

Antworte NUR mit validem JSON, keine Erklärungen.`;

    const candidatePrepResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Du bist ein erfahrener Karriere-Coach und Interview-Experte. Antworte immer auf Deutsch und nur mit validem JSON.' },
          { role: 'user', content: candidatePrepPrompt }
        ],
      }),
    });

    if (!candidatePrepResponse.ok) {
      console.error('[generate-interview-prep] AI error:', await candidatePrepResponse.text());
      throw new Error('AI generation failed');
    }

    const candidatePrepData = await candidatePrepResponse.json();
    let candidatePrep;
    try {
      const content = candidatePrepData.choices[0].message.content;
      // Clean up JSON if wrapped in code blocks
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      candidatePrep = JSON.parse(cleanContent);
    } catch (e) {
      console.error('[generate-interview-prep] Failed to parse candidate prep:', e);
      candidatePrep = { key_strengths: [], improvement_areas: [], likely_questions: [], recommended_answers: [], tips: [] };
    }

    // Generate interviewer guide
    const interviewerGuidePrompt = `Du bist ein HR-Berater. Basierend auf den folgenden Informationen, erstelle einen Interview-Leitfaden für den Interviewer.

Kandidat: ${JSON.stringify(context.candidate)}
Job: ${JSON.stringify(context.job)}
Match-Score: ${context.match_score || 'N/A'}

Erstelle eine JSON-Antwort mit:
1. questions_to_ask: Array von 8-10 Fragen, die der Interviewer stellen sollte (Mix aus technischen, Verhaltens- und Kulturfragen)
2. red_flags: Array von 3-5 Warnsignalen, auf die geachtet werden sollte
3. focus_areas: Array von 3-4 Bereichen, die besonders geprüft werden sollten
4. evaluation_criteria: Array von 4-5 Bewertungskriterien

Antworte NUR mit validem JSON, keine Erklärungen.`;

    const interviewerGuideResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Du bist ein erfahrener HR-Berater und Interview-Experte. Antworte immer auf Deutsch und nur mit validem JSON.' },
          { role: 'user', content: interviewerGuidePrompt }
        ],
      }),
    });

    let interviewerGuide;
    if (interviewerGuideResponse.ok) {
      const guideData = await interviewerGuideResponse.json();
      try {
        const content = guideData.choices[0].message.content;
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        interviewerGuide = JSON.parse(cleanContent);
      } catch (e) {
        console.error('[generate-interview-prep] Failed to parse interviewer guide:', e);
        interviewerGuide = { questions_to_ask: [], red_flags: [], focus_areas: [], evaluation_criteria: [] };
      }
    } else {
      interviewerGuide = { questions_to_ask: [], red_flags: [], focus_areas: [], evaluation_criteria: [] };
    }

    // Generate candidate summary
    const summaryPrompt = `Erstelle eine kurze, prägnante Zusammenfassung (3-4 Sätze) des Kandidaten für den Interviewer:

Kandidat: ${JSON.stringify(context.candidate)}
Job: ${JSON.stringify(context.job)}
Match-Score: ${context.match_score || 'N/A'}

Die Zusammenfassung sollte die wichtigsten Qualifikationen, Erfahrungen und den Fit für die Position hervorheben.`;

    const summaryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Du bist ein HR-Experte. Antworte auf Deutsch, präzise und professionell.' },
          { role: 'user', content: summaryPrompt }
        ],
      }),
    });

    let candidateSummary = '';
    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      candidateSummary = summaryData.choices[0].message.content;
    }

    // Company insights
    const companyInsights = {
      culture: companyProfile?.description || `${job.company_name} im Bereich ${job.industry || 'Technologie'}`,
      values: job.must_haves || [],
      interview_style: 'Strukturiertes Interview mit technischen und Verhaltensfragen',
    };

    // Save to database
    const { data: intelligence, error: insertError } = await supabase
      .from('interview_intelligence')
      .upsert({
        interview_id,
        submission_id: submission.id,
        candidate_prep: candidatePrep,
        company_insights: companyInsights,
        interviewer_guide: interviewerGuide,
        candidate_summary: candidateSummary,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'interview_id' })
      .select()
      .single();

    if (insertError) {
      console.error('[generate-interview-prep] Insert error:', insertError);
      throw insertError;
    }

    console.log(`[generate-interview-prep] Successfully generated prep for interview: ${interview_id}`);

    // Create notification for recruiter
    await supabase.from('notifications').insert({
      user_id: submission.recruiter_id,
      type: 'interview_prep_ready',
      title: 'Interview-Vorbereitung bereit',
      message: `Die AI-gestützte Interview-Vorbereitung für ${candidate.full_name} ist jetzt verfügbar.`,
      related_type: 'interview',
      related_id: interview_id,
    });

    return new Response(JSON.stringify({
      success: true,
      intelligence,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-interview-prep] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
