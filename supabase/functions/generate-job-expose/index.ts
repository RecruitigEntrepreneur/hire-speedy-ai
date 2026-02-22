import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { jobId } = await req.json();
    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load job data
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(
        "title, description, requirements, salary_min, salary_max, skills, must_haves, nice_to_haves, remote_type, employment_type, industry, location, job_summary"
      )
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summary = job.job_summary as any;

    const prompt = `Du bist ein professioneller Recruiter-Texter. Erstelle ein anonymisiertes Stellenexposé auf Deutsch.

WICHTIG: Der Firmenname darf NICHT genannt werden. Verwende stattdessen eine branchenbezogene Umschreibung wie "Führendes Unternehmen im Bereich ${job.industry || "Technologie"}" oder "Etablierter Arbeitgeber in der Region ${job.location || "Deutschland"}".

Job-Daten:
- Titel: ${job.title}
- Branche: ${job.industry || "nicht angegeben"}
- Standort: ${job.location || "nicht angegeben"}
- Remote: ${job.remote_type || "nicht angegeben"}
- Beschäftigungsart: ${job.employment_type || "nicht angegeben"}
- Gehalt: ${job.salary_min ? `€${job.salary_min}` : "k.A."} - ${job.salary_max ? `€${job.salary_max}` : "k.A."}
- Skills: ${(job.skills || []).join(", ") || "keine"}
- Must-Haves: ${(job.must_haves || []).join(", ") || "keine"}
- Nice-to-Haves: ${(job.nice_to_haves || []).join(", ") || "keine"}
- Beschreibung: ${job.description || "keine"}
- Anforderungen: ${job.requirements || "keine"}
${summary?.benefits_extracted ? `- Benefits: ${summary.benefits_extracted.map((b: any) => b.text).join(", ")}` : ""}
${summary?.ai_insights?.unique_selling_point ? `- USP: ${summary.ai_insights.unique_selling_point}` : ""}

Erstelle ein professionelles 1-Seiten Exposé mit:
1. Kurze Einleitung (Unternehmen anonym beschrieben)
2. Rolle & Aufgaben (kompakt)
3. Anforderungsprofil
4. Benefits & Vorteile
5. Nächste Schritte

Formatiere mit Markdown-Überschriften. Halte es prägnant und verkaufsorientiert.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "Du erstellst anonymisierte Stellenexposés für Recruiter." },
            { role: "user", content: prompt },
          ],
        }),
      }
    );

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit erreicht. Bitte versuchen Sie es später erneut." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI-Kontingent aufgebraucht." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    const expose = aiData.choices?.[0]?.message?.content || "Kein Exposé generiert.";

    return new Response(JSON.stringify({ expose }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-job-expose error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
