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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { response_id } = await req.json();

    if (!response_id) {
      return new Response(JSON.stringify({ error: 'response_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get reference response with request details
    const { data: response, error: responseError } = await supabase
      .from('reference_responses')
      .select(`
        *,
        reference_requests (
          reference_name,
          reference_company,
          reference_position,
          relationship,
          candidate_id,
          candidates (
            full_name
          )
        )
      `)
      .eq('id', response_id)
      .single();

    if (responseError || !response) {
      return new Response(JSON.stringify({ error: 'Response not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build analysis prompt
    const prompt = `Analysiere die folgende Referenzauskunft und erstelle eine Zusammenfassung sowie identifiziere potenzielle Red Flags.

Kandidat: ${response.reference_requests?.candidates?.full_name || 'Unbekannt'}
Referenzgeber: ${response.reference_requests?.reference_name} (${response.reference_requests?.relationship})
Position: ${response.reference_requests?.reference_position} bei ${response.reference_requests?.reference_company}

Bewertungen (1-5 Skala):
- Gesamtleistung: ${response.overall_performance || 'N/A'}
- Technische Fähigkeiten: ${response.technical_skills || 'N/A'}
- Kommunikation: ${response.communication || 'N/A'}
- Teamarbeit: ${response.teamwork || 'N/A'}
- Zuverlässigkeit: ${response.reliability || 'N/A'}
- Führung: ${response.leadership || 'N/A'}

Stärken: ${response.strengths?.join(', ') || 'Keine angegeben'}
Verbesserungsbereiche: ${response.areas_for_improvement?.join(', ') || 'Keine angegeben'}
Bemerkenswerte Erfolge: ${response.notable_achievements || 'Keine angegeben'}
Arbeitsstil: ${response.working_style || 'Nicht beschrieben'}
Würde wieder einstellen: ${response.would_rehire ? 'Ja' : response.would_rehire === false ? 'Nein' : 'N/A'}
Empfehlungslevel: ${response.recommendation_level || 'N/A'}
Zusätzliche Kommentare: ${response.additional_comments || 'Keine'}

Erstelle:
1. Eine kurze Zusammenfassung (3-4 Sätze)
2. Eine Liste von Red Flags (falls vorhanden) mit Schweregrad (low, medium, high)

Antworte im folgenden JSON-Format:
{
  "summary": "Zusammenfassung hier...",
  "risk_flags": [
    {"flag": "Beschreibung", "severity": "low|medium|high", "category": "performance|reliability|teamwork|communication|other"}
  ]
}`;

    let aiSummary = '';
    let riskFlags: any[] = [];

    if (lovableApiKey) {
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { 
                role: 'system', 
                content: 'Du bist ein HR-Analyst, der Referenzauskünfte analysiert. Antworte immer im angeforderten JSON-Format.' 
              },
              { role: 'user', content: prompt }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          
          if (content) {
            try {
              // Extract JSON from response
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                aiSummary = parsed.summary || '';
                riskFlags = parsed.risk_flags || [];
              }
            } catch (parseError) {
              console.error('Error parsing AI response:', parseError);
              aiSummary = content;
            }
          }
        }
      } catch (aiError) {
        console.error('Error calling AI:', aiError);
      }
    }

    // Fallback: Generate basic summary without AI
    if (!aiSummary) {
      const avgScore = [
        response.overall_performance,
        response.technical_skills,
        response.communication,
        response.teamwork,
        response.reliability,
      ].filter(Boolean).reduce((a, b) => a + b, 0) / 5;

      aiSummary = `Referenz von ${response.reference_requests?.reference_name}. `;
      aiSummary += `Durchschnittliche Bewertung: ${avgScore.toFixed(1)}/5. `;
      aiSummary += response.would_rehire ? 'Würde wieder einstellen. ' : '';
      aiSummary += `Empfehlung: ${response.recommendation_level || 'nicht angegeben'}.`;

      // Basic red flag detection
      if (response.overall_performance && response.overall_performance <= 2) {
        riskFlags.push({ flag: 'Niedrige Gesamtbewertung', severity: 'high', category: 'performance' });
      }
      if (response.would_rehire === false) {
        riskFlags.push({ flag: 'Würde nicht wieder einstellen', severity: 'high', category: 'other' });
      }
      if (response.recommendation_level === 'no' || response.recommendation_level === 'strong_no') {
        riskFlags.push({ flag: 'Negative Empfehlung', severity: 'high', category: 'other' });
      }
      if (response.reliability && response.reliability <= 2) {
        riskFlags.push({ flag: 'Zuverlässigkeitsbedenken', severity: 'medium', category: 'reliability' });
      }
    }

    // Update response with AI analysis
    const { error: updateError } = await supabase
      .from('reference_responses')
      .update({
        ai_summary: aiSummary,
        ai_risk_flags: riskFlags,
      })
      .eq('id', response_id);

    if (updateError) {
      console.error('Error updating response:', updateError);
    }

    console.log(`Reference analysis completed for response ${response_id}`);

    return new Response(JSON.stringify({
      success: true,
      response_id,
      ai_summary: aiSummary,
      risk_flags: riskFlags,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-reference:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
