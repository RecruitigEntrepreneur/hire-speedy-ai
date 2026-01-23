import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedIntakeData {
  team_size?: number;
  team_avg_age?: string;
  core_hours?: string;
  overtime_policy?: string;
  remote_days?: number;
  company_culture?: string;
  career_path?: string;
  success_profile?: string;
  failure_profile?: string;
  vacancy_reason?: string;
  hiring_deadline_weeks?: number;
  candidates_in_pipeline?: number;
  decision_makers?: string[];
  works_council?: boolean;
  daily_routine?: string;
  must_have_criteria?: string[];
  nice_to_have_criteria?: string[];
  trainable_skills?: string[];
  hiring_urgency?: 'standard' | 'urgent' | 'hot';
  unique_selling_points?: string[];
  position_advantages?: string[];
  reports_to?: string;
  department_structure?: string;
  bonus_structure?: string;
  industry_challenges?: string;
  industry_opportunities?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { briefing_text, existing_data } = await req.json();

    if (!briefing_text || briefing_text.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: 'Briefing text too short. Please provide more details.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `Du bist ein erfahrener HR-Experte und Recruiting-Berater. 
Deine Aufgabe ist es, aus einem Freitext-Briefing strukturierte Daten für eine Stellenausschreibung zu extrahieren.

Extrahiere NUR Informationen, die explizit im Text erwähnt werden. Erfinde keine Daten.

Achte besonders auf:
- Team-Größe und Altersstruktur
- Arbeitszeiten (Kernarbeitszeit, Home Office, Überstunden)
- Unternehmenskultur und Werte
- Must-Have und Nice-to-Have Anforderungen
- Timeline und Dringlichkeit (standard/urgent/hot)
- Budget und Gehaltsstruktur
- Entscheidungsprozess und Ansprechpartner
- Besonderheiten der Stelle

Antworte NUR mit dem JSON-Objekt, keine zusätzlichen Erklärungen.`;

    const existingContext = existing_data 
      ? `\n\nBereits bekannte Daten (nicht überschreiben wenn nicht explizit anders genannt):\n${JSON.stringify(existing_data, null, 2)}`
      : '';

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENROUTER_API_KEY')}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('SUPABASE_URL') || 'https://lovable.dev',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Briefing:\n${briefing_text}${existingContext}` }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
        tools: [{
          type: "function",
          function: {
            name: "extract_intake_data",
            description: "Extrahiert strukturierte Intake-Daten aus dem Briefing-Text",
            parameters: {
              type: "object",
              properties: {
                team_size: { type: "integer", description: "Größe des direkten Teams" },
                team_avg_age: { type: "string", description: "Altersstruktur, z.B. '25-35'" },
                core_hours: { type: "string", description: "Kernarbeitszeit, z.B. '10-16 Uhr'" },
                overtime_policy: { type: "string", description: "Überstunden-Regelung" },
                remote_days: { type: "integer", description: "Anzahl Home Office Tage pro Woche" },
                company_culture: { type: "string", description: "Beschreibung der Unternehmenskultur" },
                career_path: { type: "string", description: "Entwicklungsmöglichkeiten" },
                success_profile: { type: "string", description: "Wer hat langfristig Erfolg" },
                failure_profile: { type: "string", description: "Wer passt nicht" },
                vacancy_reason: { type: "string", description: "Grund für die Vakanz" },
                hiring_deadline_weeks: { type: "integer", description: "Wochen bis zur gewünschten Besetzung" },
                candidates_in_pipeline: { type: "integer", description: "Aktuelle Kandidaten im Prozess" },
                decision_makers: { type: "array", items: { type: "string" }, description: "Entscheidungsträger" },
                works_council: { type: "boolean", description: "Betriebsrat vorhanden" },
                daily_routine: { type: "string", description: "Typischer Arbeitsalltag" },
                must_have_criteria: { type: "array", items: { type: "string" }, description: "Muss-Kriterien" },
                nice_to_have_criteria: { type: "array", items: { type: "string" }, description: "Nice-to-have Kriterien" },
                trainable_skills: { type: "array", items: { type: "string" }, description: "Nachschulbare Skills" },
                hiring_urgency: { type: "string", enum: ["standard", "urgent", "hot"], description: "Dringlichkeit" },
                unique_selling_points: { type: "array", items: { type: "string" }, description: "Alleinstellungsmerkmale" },
                position_advantages: { type: "array", items: { type: "string" }, description: "Vorteile der Position" },
                reports_to: { type: "string", description: "Berichtet an..." },
                department_structure: { type: "string", description: "Abteilungsstruktur" },
                bonus_structure: { type: "string", description: "Bonusstruktur" },
                industry_challenges: { type: "string", description: "Branchenherausforderungen" },
                industry_opportunities: { type: "string", description: "Branchenchancen" },
                salary_min: { type: "integer", description: "Mindestgehalt" },
                salary_max: { type: "integer", description: "Maximalgehalt" }
              }
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_intake_data" } }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const result = await response.json();
    
    let extractedData: ExtractedIntakeData = {};
    
    // Handle tool call response
    if (result.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      extractedData = JSON.parse(result.choices[0].message.tool_calls[0].function.arguments);
    } 
    // Handle direct JSON response
    else if (result.choices?.[0]?.message?.content) {
      try {
        extractedData = JSON.parse(result.choices[0].message.content);
      } catch {
        console.error('Failed to parse AI response as JSON');
      }
    }

    // Calculate completeness
    const allFields = [
      'team_size', 'team_avg_age', 'core_hours', 'company_culture', 
      'vacancy_reason', 'hiring_urgency', 'must_have_criteria',
      'decision_makers', 'daily_routine', 'career_path'
    ];
    
    const filledFields = allFields.filter(field => {
      const value = extractedData[field as keyof ExtractedIntakeData];
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== '';
    });
    
    const completeness = Math.round((filledFields.length / allFields.length) * 100);

    return new Response(
      JSON.stringify({
        extracted_data: extractedData,
        completeness,
        fields_found: filledFields.length,
        total_fields: allFields.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-intake-briefing:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract intake data';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
