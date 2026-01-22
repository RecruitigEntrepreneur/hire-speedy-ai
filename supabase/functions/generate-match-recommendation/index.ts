import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MatchRecommendationRequest {
  candidateId: string;
  jobId: string;
  matchResult?: {
    overall: number;
    fit: { score: number; breakdown: { skills: number; experience: number; seniority: number; industry: number } };
    constraints: { score: number; breakdown: { salary: number; commute: number; startDate: number } };
    explainability?: { topReasons: string[]; topRisks: string[] };
  };
  forceRefresh?: boolean;
}

interface AIRecommendation {
  recommendation_text: string;
  action_recommendation: string;
  confidence: 'high' | 'medium' | 'low';
  key_match_points: string[];
  key_risks: string[];
  negotiation_hints: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { candidateId, jobId, matchResult, forceRefresh } = await req.json() as MatchRecommendationRequest;

    if (!candidateId || !jobId) {
      return new Response(JSON.stringify({ error: 'candidateId and jobId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for cached recommendation (unless forceRefresh)
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('match_recommendations')
        .select('*')
        .eq('candidate_id', candidateId)
        .eq('job_id', jobId)
        .single();

      if (cached) {
        // Return cached if less than 7 days old
        const cacheAge = Date.now() - new Date(cached.generated_at).getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (cacheAge < sevenDays) {
          return new Response(JSON.stringify({ recommendation: cached, cached: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Fetch candidate data with all relevant fields
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select(`
        id, full_name, email, phone, job_title, company, city, 
        skills, experience_years, seniority, 
        expected_salary, salary_expectation_min, salary_expectation_max, current_salary,
        availability_date, notice_period,
        cv_ai_summary, cv_ai_bullets,
        language_skills, certifications,
        remote_preference, work_model, max_commute_minutes,
        target_roles, target_industries,
        visa_required, residence_status
      `)
      .eq('id', candidateId)
      .single();

    if (candidateError || !candidate) {
      return new Response(JSON.stringify({ error: 'Candidate not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch interview notes for additional context
    const { data: interviewNotes } = await supabase
      .from('candidate_interview_notes')
      .select('change_motivation, why_now, salary_desired, salary_minimum, would_recommend, recommendation_notes')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Fetch job data with all relevant fields
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        id, title, company_name, location, description, requirements,
        salary_min, salary_max,
        experience_level, seniority_level,
        must_haves, nice_to_haves, skills,
        remote_type, office_days_required,
        required_languages,
        urgency, status
      `)
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch job skill requirements if available
    const { data: skillRequirements } = await supabase
      .from('job_skill_requirements')
      .select('skill_name, is_must_have, weight')
      .eq('job_id', jobId);

    // Build the AI prompt with all available context
    const prompt = buildPrompt(candidate, job, interviewNotes, skillRequirements, matchResult);

    // Call Lovable AI Gateway
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `Du bist ein erfahrener Senior Recruiter mit 15+ Jahren Erfahrung in der Tech-Branche. 
Deine Aufgabe ist es, die Passung zwischen Kandidaten und Jobs zu analysieren und actionable Empfehlungen zu geben.
Antworte IMMER auf Deutsch.
Sei konkret, nutze Zahlen und Fakten aus den Daten.
Fokussiere auf das Wesentliche - was muss der Recruiter wissen, um eine Entscheidung zu treffen?`
          },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'create_recommendation',
              description: 'Erstelle eine strukturierte Matching-Empfehlung',
              parameters: {
                type: 'object',
                properties: {
                  recommendation_text: {
                    type: 'string',
                    description: '2-3 prägnante Sätze: Was passt gut, was ist das Hauptrisiko, wie damit umgehen. Max 200 Zeichen.'
                  },
                  action_recommendation: {
                    type: 'string',
                    description: 'Konkrete nächste Aktion für den Recruiter. Max 80 Zeichen. Z.B. "Sofort einreichen" oder "Erst Gehalt klären"'
                  },
                  confidence: {
                    type: 'string',
                    enum: ['high', 'medium', 'low'],
                    description: 'Wie sicher ist diese Empfehlung? high = klare Sache, low = viele Unbekannte'
                  },
                  key_match_points: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '2-4 konkrete Stärken der Passung mit Zahlen/Fakten. Z.B. "6J React (gefordert: 3+)"'
                  },
                  key_risks: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '1-3 konkrete Risiken mit Kontext. Z.B. "Gehalt 85k€ (Budget: 65-80k€)"'
                  },
                  negotiation_hints: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Verhandlungstipps falls es Gaps gibt. Z.B. "Remote-Flexibilität als Argument nutzen"'
                  }
                },
                required: ['recommendation_text', 'action_recommendation', 'confidence', 'key_match_points', 'key_risks'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'create_recommendation' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted, please add funds' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    
    // Extract the tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error('Invalid AI response structure');
    }

    const recommendation: AIRecommendation = JSON.parse(toolCall.function.arguments);

    // Upsert the recommendation to cache
    const { data: savedRecommendation, error: saveError } = await supabase
      .from('match_recommendations')
      .upsert({
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
        model_version: 'gemini-3-flash-preview-v1',
      }, {
        onConflict: 'candidate_id,job_id',
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving recommendation:', saveError);
      // Still return the recommendation even if caching fails
      return new Response(JSON.stringify({ 
        recommendation: {
          ...recommendation,
          candidate_id: candidateId,
          job_id: jobId,
          match_score: matchResult?.overall || null,
          generated_at: new Date().toISOString(),
        }, 
        cached: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ recommendation: savedRecommendation, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-match-recommendation:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildPrompt(
  candidate: any,
  job: any,
  interviewNotes: any,
  skillRequirements: any[] | null,
  matchResult?: any
): string {
  // Format candidate skills
  const candidateSkills = candidate.skills?.join(', ') || 'Keine angegeben';
  
  // Format job requirements
  const mustHaves = skillRequirements?.filter(s => s.is_must_have).map(s => s.skill_name) || job.must_haves || [];
  const niceToHaves = skillRequirements?.filter(s => !s.is_must_have).map(s => s.skill_name) || job.nice_to_haves || [];
  
  // Format salary info
  const candidateSalary = candidate.expected_salary || candidate.salary_expectation_max || 
    (interviewNotes?.salary_desired ? parseInt(interviewNotes.salary_desired.replace(/\D/g, '')) : null);
  const jobSalaryRange = job.salary_min && job.salary_max 
    ? `${job.salary_min/1000}k - ${job.salary_max/1000}k€`
    : job.salary_max ? `bis ${job.salary_max/1000}k€` : 'Nicht angegeben';

  // Format availability
  const availability = candidate.availability_date 
    ? new Date(candidate.availability_date).toLocaleDateString('de-DE')
    : candidate.notice_period || 'Nicht angegeben';

  // Build match context if available
  let matchContext = '';
  if (matchResult) {
    matchContext = `
ALGORITHMISCHER SCORE:
- Gesamt: ${matchResult.overall}%
- Fit-Score: ${matchResult.fit?.score || 'N/A'}% (Skills: ${matchResult.fit?.breakdown?.skills || 'N/A'}%, Erfahrung: ${matchResult.fit?.breakdown?.experience || 'N/A'}%)
- Constraints: ${matchResult.constraints?.score || 'N/A'}% (Gehalt: ${matchResult.constraints?.breakdown?.salary || 'N/A'}%, Pendel: ${matchResult.constraints?.breakdown?.commute || 'N/A'}%)
${matchResult.explainability?.topReasons?.length ? `- Algorithmus-Stärken: ${matchResult.explainability.topReasons.join(', ')}` : ''}
${matchResult.explainability?.topRisks?.length ? `- Algorithmus-Risiken: ${matchResult.explainability.topRisks.join(', ')}` : ''}
`;
  }

  return `Analysiere die Passung zwischen diesem Kandidaten und Job. Gib eine actionable Empfehlung.

=== KANDIDAT ===
Name: ${candidate.full_name}
Aktuelle Position: ${candidate.job_title || 'Nicht angegeben'} bei ${candidate.company || 'Nicht angegeben'}
Erfahrung: ${candidate.experience_years || 'Nicht angegeben'} Jahre
Seniority: ${candidate.seniority || 'Nicht angegeben'}
Standort: ${candidate.city || 'Nicht angegeben'}
Remote-Präferenz: ${candidate.remote_preference || candidate.work_model || 'Nicht angegeben'}
Max. Pendelzeit: ${candidate.max_commute_minutes ? `${candidate.max_commute_minutes} Min` : 'Nicht angegeben'}

Skills: ${candidateSkills}
Zertifikate: ${candidate.certifications?.join(', ') || 'Keine'}
Sprachen: ${JSON.stringify(candidate.language_skills) || 'Nicht angegeben'}

Gehalt aktuell: ${candidate.current_salary ? `${candidate.current_salary/1000}k€` : 'Nicht angegeben'}
Gehalt erwartet: ${candidateSalary ? `${candidateSalary/1000}k€` : 'Nicht angegeben'}
Verfügbarkeit: ${availability}

${candidate.cv_ai_summary ? `CV-Summary: ${candidate.cv_ai_summary}` : ''}
${candidate.cv_ai_bullets ? `Highlights: ${JSON.stringify(candidate.cv_ai_bullets)}` : ''}

${interviewNotes ? `
=== INTERVIEW-NOTIZEN ===
Wechselmotivation: ${interviewNotes.change_motivation || 'Nicht dokumentiert'}
Warum jetzt: ${interviewNotes.why_now || 'Nicht dokumentiert'}
Empfehlung: ${interviewNotes.would_recommend ? 'Ja' : interviewNotes.would_recommend === false ? 'Nein' : 'Nicht bewertet'}
${interviewNotes.recommendation_notes ? `Notizen: ${interviewNotes.recommendation_notes}` : ''}
` : ''}

=== JOB ===
Titel: ${job.title}
Unternehmen: ${job.company_name}
Standort: ${job.location || 'Nicht angegeben'}
Remote: ${job.remote_type || 'Nicht angegeben'}${job.office_days_required ? ` (${job.office_days_required} Bürotage)` : ''}
Dringlichkeit: ${job.urgency || 'Normal'}

Must-Haves: ${mustHaves.join(', ') || 'Keine definiert'}
Nice-to-Haves: ${niceToHaves.join(', ') || 'Keine definiert'}
Erfahrungslevel: ${job.experience_level || job.seniority_level || 'Nicht angegeben'}
Gehaltsspanne: ${jobSalaryRange}
Sprachen: ${job.required_languages?.join(', ') || 'Nicht angegeben'}

${job.requirements ? `Anforderungen: ${job.requirements.substring(0, 500)}...` : ''}
${matchContext}

Erstelle jetzt eine prägnante, actionable Empfehlung für den Recruiter.`;
}
