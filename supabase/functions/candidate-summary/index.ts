import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candidate, job } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating AI summary for candidate:", candidate.full_name);

    const systemPrompt = `Du bist ein erfahrener HR-Experte und Recruiting-Berater. Analysiere den Kandidaten und erstelle eine kurze, prägnante Zusammenfassung für den einstellenden Manager. 

Fokussiere dich auf:
1. Warum passt dieser Kandidat zur Stelle?
2. Stärken und relevante Erfahrungen
3. Potenzielle Bedenken oder Lücken
4. Gesamtbewertung (1-5 Sterne)

Halte die Zusammenfassung auf Deutsch und unter 200 Wörtern. Sei direkt und actionable.`;

    const userPrompt = `
Kandidat: ${candidate.full_name}
E-Mail: ${candidate.email}
Erfahrung: ${candidate.experience_years || 'Nicht angegeben'} Jahre
Aktuelle Gehalt: ${candidate.current_salary ? `€${candidate.current_salary.toLocaleString()}` : 'Nicht angegeben'}
Gehaltsvorstellung: ${candidate.expected_salary ? `€${candidate.expected_salary.toLocaleString()}` : 'Nicht angegeben'}
Skills: ${candidate.skills?.join(', ') || 'Keine angegeben'}
Zusammenfassung vom Recruiter: ${candidate.summary || 'Keine'}

Stelle: ${job.title}
Unternehmen: ${job.company_name}
Anforderungen: ${job.requirements || 'Keine spezifischen Anforderungen'}
Gehaltsspanne: ${job.salary_min && job.salary_max ? `€${job.salary_min.toLocaleString()} - €${job.salary_max.toLocaleString()}` : 'Nicht angegeben'}
Must-Haves: ${job.must_haves?.join(', ') || 'Keine'}
Nice-to-Haves: ${job.nice_to_haves?.join(', ') || 'Keine'}

Erstelle eine Analyse, warum dieser Kandidat für diese Stelle geeignet ist.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "Keine Zusammenfassung verfügbar.";

    console.log("AI summary generated successfully");

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating candidate summary:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});