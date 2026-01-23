import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KeyFact {
  icon: string;
  label: string;
  value: string;
}

interface TaskCategory {
  category: string;
  items: string[];
}

interface RequirementsStructured {
  education: string[];
  experience: string[];
  tools: string[];
  soft_skills: string[];
  certifications: string[];
}

interface Benefit {
  icon: string;
  text: string;
}

interface AIInsights {
  role_type: string;
  ideal_profile: string;
  unique_selling_point: string;
  hiring_recommendation: string;
}

interface JobSummary {
  key_facts: KeyFact[];
  tasks_structured: TaskCategory[];
  requirements_structured: RequirementsStructured;
  benefits_extracted: Benefit[];
  ai_insights: AIInsights;
  generated_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { jobId } = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'jobId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch job data
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build comprehensive job context
    const jobContext = `
STELLENTITEL: ${job.title}
UNTERNEHMEN: ${job.company_name}
STANDORT: ${job.location || 'Nicht angegeben'}
REMOTE: ${job.remote_type || job.remote_policy || 'Nicht angegeben'}
BESCHÄFTIGUNGSART: ${job.employment_type || 'Vollzeit'}
ERFAHRUNGSLEVEL: ${job.experience_level || 'Nicht angegeben'}
GEHALT: ${job.salary_min && job.salary_max ? `${job.salary_min.toLocaleString('de-DE')}€ - ${job.salary_max.toLocaleString('de-DE')}€` : 'Nicht angegeben'}
FEE: ${job.fee_percentage ? `${job.fee_percentage}%` : 'Standard'}
DRINGLICHKEIT: ${job.urgency || job.hiring_urgency || 'Normal'}
BRANCHE: ${job.industry || 'Nicht angegeben'}

STELLENBESCHREIBUNG:
${job.description || 'Keine Beschreibung vorhanden'}

ANFORDERUNGEN:
${job.requirements || 'Keine Anforderungen angegeben'}

MUST-HAVES: ${(job.must_haves || []).join(', ') || 'Nicht angegeben'}
NICE-TO-HAVES: ${(job.nice_to_haves || []).join(', ') || 'Nicht angegeben'}
SKILLS: ${(job.skills || []).join(', ') || 'Nicht angegeben'}

INTAKE-BRIEFING:
${job.intake_briefing || 'Kein Briefing vorhanden'}

TEAM-GRÖSSE: ${job.team_size || 'Nicht angegeben'}
UNTERNEHMENSKULTUR: ${job.company_culture || 'Nicht angegeben'}
GRUND DER VAKANZ: ${job.vacancy_reason || 'Nicht angegeben'}
BENEFITS: ${job.benefits || 'Nicht angegeben'}
SELLING POINTS: ${job.selling_points || 'Nicht angegeben'}
    `.trim();

    const systemPrompt = `Du bist ein HR-Experte, der Stellenanzeigen analysiert und strukturiert zusammenfasst.

Deine Aufgabe: Erstelle eine Executive Summary für HR-Manager basierend auf allen verfügbaren Job-Informationen.

WICHTIGE REGELN:
1. Extrahiere NUR Informationen die explizit im Text stehen - erfinde NICHTS
2. Halte alle Texte kurz und prägnant (max. 6-8 Wörter pro Item)
3. Kategorisiere Anforderungen korrekt (Tools vs. Soft Skills vs. Erfahrung)
4. Extrahiere Benefits aus der Beschreibung wenn vorhanden
5. Gib realistische AI-Insights basierend auf den Daten

Antworte NUR mit dem JSON-Objekt, keine Erklärungen.`;

    const userPrompt = `Analysiere diese Stellenanzeige und erstelle eine strukturierte Executive Summary:

${jobContext}

Erstelle die Summary mit der generate_job_summary Funktion.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        tools: [{
          type: "function",
          function: {
            name: "generate_job_summary",
            description: "Generiert eine strukturierte Executive Summary für einen Job",
            parameters: {
              type: "object",
              properties: {
                key_facts: {
                  type: "array",
                  description: "4-6 wichtigste Fakten zur Stelle",
                  items: {
                    type: "object",
                    properties: {
                      icon: { 
                        type: "string", 
                        enum: ["euro", "clock", "briefcase", "mapPin", "users", "building", "globe", "award", "calendar", "trending"],
                        description: "Icon für den Fakt"
                      },
                      label: { type: "string", description: "Kurzes Label (1-2 Wörter)" },
                      value: { type: "string", description: "Wert (max 4 Wörter)" }
                    },
                    required: ["icon", "label", "value"]
                  }
                },
                tasks_structured: {
                  type: "array",
                  description: "Aufgaben gruppiert nach Kategorie",
                  items: {
                    type: "object",
                    properties: {
                      category: { 
                        type: "string", 
                        enum: ["core", "periodic", "leadership", "project", "communication"],
                        description: "Aufgabenkategorie"
                      },
                      items: { 
                        type: "array", 
                        items: { type: "string" },
                        description: "Aufgaben in dieser Kategorie (max 6 Wörter pro Item)"
                      }
                    },
                    required: ["category", "items"]
                  }
                },
                requirements_structured: {
                  type: "object",
                  description: "Anforderungen nach Typ kategorisiert",
                  properties: {
                    education: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "Ausbildung/Studium (kurz, z.B. 'Kaufm. Ausbildung')"
                    },
                    experience: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "Berufserfahrung (z.B. '3+ Jahre Buchhaltung')"
                    },
                    tools: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "Software/Tools (z.B. 'Datev', 'Excel', 'SAP')"
                    },
                    soft_skills: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "Soft Skills (z.B. 'Analytisches Denken', 'Teamfähigkeit')"
                    },
                    certifications: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "Zertifikate wenn genannt"
                    }
                  }
                },
                benefits_extracted: {
                  type: "array",
                  description: "Benefits aus der Beschreibung extrahiert",
                  items: {
                    type: "object",
                    properties: {
                      icon: { 
                        type: "string", 
                        enum: ["train", "clock", "dumbbell", "building", "euro", "heart", "coffee", "laptop", "car", "gift", "umbrella", "book"],
                        description: "Passendes Icon"
                      },
                      text: { type: "string", description: "Benefit-Beschreibung (max 8 Wörter)" }
                    },
                    required: ["icon", "text"]
                  }
                },
                ai_insights: {
                  type: "object",
                  description: "AI-generierte Einschätzungen",
                  properties: {
                    role_type: { type: "string", description: "Rollentyp in 4-6 Wörtern" },
                    ideal_profile: { type: "string", description: "Idealer Kandidat in einem Satz" },
                    unique_selling_point: { type: "string", description: "Was diese Stelle besonders macht" },
                    hiring_recommendation: { type: "string", description: "Empfehlung für die Suche (1 Satz)" }
                  },
                  required: ["role_type", "ideal_profile", "unique_selling_point", "hiring_recommendation"]
                }
              },
              required: ["key_facts", "tasks_structured", "requirements_structured", "benefits_extracted", "ai_insights"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_job_summary" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit reached. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('AI Response:', JSON.stringify(aiResponse, null, 2));

    let summary: JobSummary | null = null;

    // Extract from tool_calls
    if (aiResponse.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      try {
        const parsed = JSON.parse(aiResponse.choices[0].message.tool_calls[0].function.arguments);
        summary = {
          ...parsed,
          generated_at: new Date().toISOString()
        };
      } catch (parseError) {
        console.error('Failed to parse tool_calls:', parseError);
      }
    }

    // Fallback: Try to extract JSON from content
    if (!summary && aiResponse.choices?.[0]?.message?.content) {
      const content = aiResponse.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          summary = {
            ...parsed,
            generated_at: new Date().toISOString()
          };
        } catch (parseError) {
          console.error('Failed to parse content JSON:', parseError);
        }
      }
    }

    // Generate fallback if AI failed
    if (!summary) {
      summary = generateFallbackSummary(job);
    }

    // Save to database
    const { error: updateError } = await supabase
      .from('jobs')
      .update({ job_summary: summary })
      .eq('id', jobId);

    if (updateError) {
      console.error('Failed to save summary:', updateError);
    }

    return new Response(
      JSON.stringify({ summary }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error generating summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate summary';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateFallbackSummary(job: any): JobSummary {
  const keyFacts: KeyFact[] = [];
  
  if (job.salary_min || job.salary_max) {
    keyFacts.push({
      icon: 'euro',
      label: 'Gehalt',
      value: job.salary_min && job.salary_max 
        ? `${Math.round(job.salary_min / 1000)}k - ${Math.round(job.salary_max / 1000)}k €`
        : 'Verhandelbar'
    });
  }
  
  if (job.employment_type) {
    keyFacts.push({
      icon: 'clock',
      label: 'Anstellung',
      value: job.employment_type
    });
  }
  
  if (job.experience_level) {
    keyFacts.push({
      icon: 'briefcase',
      label: 'Level',
      value: job.experience_level
    });
  }
  
  if (job.location) {
    keyFacts.push({
      icon: 'mapPin',
      label: 'Standort',
      value: job.location
    });
  }

  if (job.remote_type || job.remote_policy) {
    keyFacts.push({
      icon: 'globe',
      label: 'Remote',
      value: job.remote_type || job.remote_policy || 'Hybrid'
    });
  }

  return {
    key_facts: keyFacts,
    tasks_structured: [{
      category: 'core',
      items: ['Aufgaben aus Beschreibung extrahieren']
    }],
    requirements_structured: {
      education: [],
      experience: [],
      tools: job.skills || [],
      soft_skills: [],
      certifications: []
    },
    benefits_extracted: [],
    ai_insights: {
      role_type: job.title || 'Position',
      ideal_profile: 'Kandidat mit passender Erfahrung',
      unique_selling_point: job.company_name || 'Attraktiver Arbeitgeber',
      hiring_recommendation: 'Weitere Details im Intake-Briefing erfassen'
    },
    generated_at: new Date().toISOString()
  };
}
