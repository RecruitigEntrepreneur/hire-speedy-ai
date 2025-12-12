import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candidateId, interviewNotes, additionalNotes, candidateData } = await req.json();

    if (!candidateId) {
      throw new Error('Candidate ID is required');
    }

    console.log('Processing interview notes for candidate:', candidateId);

    // Combine all notes for AI processing
    const combinedNotes = `
Interview Notes:
${JSON.stringify(interviewNotes, null, 2)}

Additional Notes:
${additionalNotes || 'None'}

Candidate Data:
${JSON.stringify(candidateData, null, 2)}
    `.trim();

    // Use Lovable AI API
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `Du bist ein professioneller Recruiting-Analyst. Analysiere die Interview-Notizen und extrahiere strukturierte Daten.

Antworte NUR mit einem validen JSON-Objekt (keine Markdown-Formatierung) mit folgender Struktur:
{
  "risk_factors": ["Array von Risikofaktoren als Strings"],
  "risk_level": "low|medium|high",
  "opportunity_factors": ["Array von Chancen als Strings"],
  "opportunity_level": "low|medium|high",
  "key_highlights": ["Array von Key Highlights für Kunden (max 5)"],
  "technical_fit": 0-100,
  "culture_fit": 0-100,
  "communication_score": 0-100,
  "overall_score": 0-100,
  "placement_probability": 0-100,
  "recommendation": "strong_yes|yes|maybe|no|strong_no",
  "reasoning": "Kurze Begründung der Empfehlung",
  "extracted_data": {
    "salary_current": "Zahl oder null",
    "salary_desired": "Zahl oder null",
    "salary_minimum": "Zahl oder null",
    "notice_period": "String oder null",
    "motivation_tags": ["Array von Motivation-Tags"],
    "dealbreakers": ["Array von Dealbreakern"],
    "strengths": ["Array von Stärken"],
    "cultural_fit_notes": "String oder null"
  },
  "summary_for_client": "2-3 Sätze Zusammenfassung für den Kunden"
}

Bewerte realistisch basierend auf:
- Risiken: Gehalt über Markt, lange Kündigungsfrist, Remote-Only, instabile Historie, etc.
- Chancen: Klare Ziele, hohe Motivation, starkes Skillset, Cultural Fit
- Highlights: Konkrete Achievements, Erfahrungsjahre, Führungserfahrung, Technologien`;

    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analysiere diese Interview-Notizen:\n\n${combinedNotes}` }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResult = await response.json();
    const aiContent = aiResult.choices[0]?.message?.content;
    
    if (!aiContent) {
      throw new Error('No AI response received');
    }

    console.log('AI Response received, parsing...');

    // Parse the AI response
    let parsedData;
    try {
      // Remove potential markdown code blocks
      const cleanedContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiContent);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Upsert AI assessment
    const { data: assessment, error: assessmentError } = await supabase
      .from('candidate_ai_assessment')
      .upsert({
        candidate_id: candidateId,
        risk_factors: parsedData.risk_factors || [],
        risk_level: parsedData.risk_level || 'medium',
        opportunity_factors: parsedData.opportunity_factors || [],
        opportunity_level: parsedData.opportunity_level || 'medium',
        key_highlights: parsedData.key_highlights || [],
        technical_fit: parsedData.technical_fit,
        culture_fit: parsedData.culture_fit,
        communication_score: parsedData.communication_score,
        overall_score: parsedData.overall_score,
        placement_probability: parsedData.placement_probability,
        recommendation: parsedData.recommendation,
        reasoning: parsedData.reasoning,
        generated_at: new Date().toISOString(),
        model_version: 'gpt-4o-mini',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'candidate_id',
      })
      .select()
      .single();

    if (assessmentError) {
      console.error('Error saving assessment:', assessmentError);
      // Try insert instead of upsert
      const { data: newAssessment, error: insertError } = await supabase
        .from('candidate_ai_assessment')
        .insert({
          candidate_id: candidateId,
          risk_factors: parsedData.risk_factors || [],
          risk_level: parsedData.risk_level || 'medium',
          opportunity_factors: parsedData.opportunity_factors || [],
          opportunity_level: parsedData.opportunity_level || 'medium',
          key_highlights: parsedData.key_highlights || [],
          technical_fit: parsedData.technical_fit,
          culture_fit: parsedData.culture_fit,
          communication_score: parsedData.communication_score,
          overall_score: parsedData.overall_score,
          placement_probability: parsedData.placement_probability,
          recommendation: parsedData.recommendation,
          reasoning: parsedData.reasoning,
          generated_at: new Date().toISOString(),
          model_version: 'gpt-4o-mini',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting assessment:', insertError);
        throw insertError;
      }
    }

    console.log('AI Assessment saved successfully');

    return new Response(JSON.stringify({
      success: true,
      assessment: parsedData,
      extracted_data: parsedData.extracted_data,
      summary_for_client: parsedData.summary_for_client,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing interview notes:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
