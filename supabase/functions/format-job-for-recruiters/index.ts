import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FormattedContent {
  headline: string;
  highlights: string[];
  role_summary: string;
  ideal_candidate: string;
  selling_points: string[];
  urgency_note: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { jobId } = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: "jobId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch job details from database
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompt for AI formatting
    const prompt = `Du bist ein professioneller Recruiter-Marketing-Spezialist. Formatiere diese Stellenanzeige so, dass sie für Recruiter besonders attraktiv und übersichtlich ist.

STELLENINFORMATIONEN:
- Titel: ${job.title}
- Branche: ${job.industry || 'Nicht angegeben'}
- Standort: ${job.location || 'Flexibel'}
- Remote: ${job.remote_type || 'Hybrid'}
- Anstellung: ${job.employment_type || 'Vollzeit'}
- Erfahrung: ${job.experience_level || 'Mid-Level'}
- Gehalt: ${job.salary_min ? `€${job.salary_min.toLocaleString()}` : 'k.A.'} - ${job.salary_max ? `€${job.salary_max.toLocaleString()}` : 'k.A.'}
- Recruiter-Fee: ${job.recruiter_fee_percentage || 15}%

BESCHREIBUNG:
${job.description || 'Keine Beschreibung vorhanden.'}

ANFORDERUNGEN:
${job.requirements || 'Keine spezifischen Anforderungen.'}

SKILLS:
${job.skills?.join(', ') || 'Keine Skills angegeben'}

MUST-HAVES:
${job.must_haves?.join(', ') || 'Keine Must-Haves'}

NICE-TO-HAVES:
${job.nice_to_haves?.join(', ') || 'Keine Nice-to-Haves'}

Erstelle eine ansprechende Formatierung mit:
1. Eine catchy Headline (max 60 Zeichen)
2. 3-4 Key Highlights (kurze Bulletpoints, die Recruiter ansprechen)
3. Eine prägnante Rollenbeschreibung (2-3 Sätze)
4. Beschreibung des idealen Kandidaten (2-3 Sätze)
5. 3-5 Selling Points (Benefits, die Kandidaten überzeugen)

WICHTIG: Antworte NUR mit dem JSON-Objekt, keine anderen Texte!`;

    // Call Lovable AI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Du bist ein Experte für Recruiter-Marketing. Du erstellst ansprechende, professionelle Job-Formatierungen. Antworte immer nur mit validem JSON." },
          { role: "user", content: prompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "format_job",
              description: "Formatiere die Stellenanzeige für Recruiter",
              parameters: {
                type: "object",
                properties: {
                  headline: { 
                    type: "string", 
                    description: "Catchy headline für die Stelle, max 60 Zeichen" 
                  },
                  highlights: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "3-4 Key Highlights als kurze Bulletpoints" 
                  },
                  role_summary: { 
                    type: "string", 
                    description: "Prägnante Rollenbeschreibung, 2-3 Sätze" 
                  },
                  ideal_candidate: { 
                    type: "string", 
                    description: "Beschreibung des idealen Kandidaten, 2-3 Sätze" 
                  },
                  selling_points: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "3-5 Benefits/Selling Points" 
                  },
                  urgency_note: { 
                    type: "string", 
                    description: "Optionaler Urgency-Hinweis falls dringend" 
                  }
                },
                required: ["headline", "highlights", "role_summary", "ideal_candidate", "selling_points"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "format_job" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error("AI Gateway error");
    }

    const aiResponse = await response.json();
    
    // Extract the formatted content from tool call
    let formattedContent: FormattedContent | null = null;

    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        formattedContent = JSON.parse(toolCall.function.arguments);
      } catch (parseError) {
        console.error("Error parsing tool call arguments:", parseError);
      }
    }

    // Fallback: Try to parse from content if tool call failed
    if (!formattedContent && aiResponse.choices?.[0]?.message?.content) {
      try {
        const content = aiResponse.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          formattedContent = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error("Error parsing content:", parseError);
      }
    }

    // Generate fallback content if AI fails
    if (!formattedContent) {
      formattedContent = {
        headline: job.title,
        highlights: [
          job.remote_type === 'remote' ? '100% Remote möglich' : `${job.location || 'Flexibler Standort'}`,
          job.salary_max ? `Gehalt bis €${job.salary_max.toLocaleString()}` : 'Wettbewerbsfähiges Gehalt',
          `${job.recruiter_fee_percentage || 15}% Recruiter-Fee`,
        ],
        role_summary: job.description?.substring(0, 200) + '...' || 'Spannende Position mit Entwicklungsmöglichkeiten.',
        ideal_candidate: `Erfahrung auf ${job.experience_level || 'Mid'}-Level mit Skills in ${job.skills?.slice(0, 3).join(', ') || 'relevanten Technologien'}.`,
        selling_points: job.nice_to_haves?.slice(0, 5) || ['Attraktive Vergütung', 'Moderne Arbeitsumgebung', 'Entwicklungsmöglichkeiten'],
        urgency_note: null
      };
    }

    // Update job with formatted content
    await supabase
      .from('jobs')
      .update({ formatted_content: formattedContent })
      .eq('id', jobId);

    return new Response(
      JSON.stringify({ formattedContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in format-job-for-recruiters:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
