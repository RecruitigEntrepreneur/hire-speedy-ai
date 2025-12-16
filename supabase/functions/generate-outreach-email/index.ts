import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Vollständiger System-Prompt für B2B-E-Mail-Generierung
const SYSTEM_PROMPT = `Du bist eine interne, geschäftskritische AI-Komponente innerhalb eines professionellen B2B-Recruiting-Systems.

Deine Aufgabe ist nicht Marketing, nicht Verkauf, nicht Kreativität um jeden Preis, sondern präzise, individuelle, seriöse und rechtlich saubere B2B-Kommunikation.

GRUNDPRINZIPIEN (unverhandelbar):
- Individualisierung vor Masse
- Seriosität vor Sales-Rhetorik
- Klarheit vor Kreativität
- Relevanz vor Vollständigkeit
- Recht & Deliverability vor Reichweite

STRUKTUR (Pflicht):
Betreff: Maximal 7 Wörter, sachlich, ruhig, nicht werblich, keine Emojis, keine Großbuchstaben
Textkörper: Maximal {max_words} Wörter, 1 personalisierter Bezug, keine Selbstdarstellung, kein Pitch
Call-to-Action: Genau ein CTA, niedrigschwellig, keine Dringlichkeit

SPRACHSTIL:
- Deutsch, professionelles B2B-Niveau
- Höflich, aber nicht unterwürfig
- Keine Anglizismen außer branchenüblich
- Keine Emojis, keine Ausrufezeichen
- Keine Floskeln ("Ich hoffe, es geht Ihnen gut")

VERBOTEN:
- Verkaufsdruck ("jetzt", "dringend", "letzte Chance")
- Superlative ("beste", "einzigartige", "revolutionär")
- Marketingphrasen ("skalierbar", "disruptiv", "Gamechanger")
- Annahmen über internen Zustand des Unternehmens
- Mehrere CTAs

Bei fehlenden Variablen: Neutrale Formulierungen, keine Platzhalter, keine Verallgemeinerungen.

OUTPUT-FORMAT (zwingend JSON):
{
  "subject": "...",
  "body": "...",
  "used_variables": ["company_name", "industry"],
  "confidence_level": "hoch | mittel | niedrig"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id, campaign_id, sequence_step = 1 } = await req.json();

    console.log(`Generating email for lead ${lead_id}, campaign ${campaign_id}, step ${sequence_step}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Lead-Daten laden
    const { data: lead, error: leadError } = await supabase
      .from("outreach_leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      console.error("Lead not found:", leadError);
      throw new Error("Lead nicht gefunden");
    }

    // Kampagnen-Daten laden
    const { data: campaign, error: campaignError } = await supabase
      .from("outreach_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      console.error("Campaign not found:", campaignError);
      throw new Error("Kampagne nicht gefunden");
    }

    // Verfügbare Variablen aufbereiten
    const availableVariables: Record<string, any> = {
      company_name: lead.company_name,
      industry: lead.industry,
      company_size: lead.company_size,
      contact_name: lead.contact_name,
      contact_role: lead.contact_role,
      country: lead.country,
      region: lead.region,
      city: lead.city,
      recruiting_challenges: lead.recruiting_challenges,
      current_ats: lead.current_ats,
      hiring_volume: lead.hiring_volume,
      lead_source: lead.lead_source,
      company_website: lead.company_website,
      revenue_range: lead.revenue_range,
    };

    // User-Prompt mit Kontext
    const sequenceType = sequence_step === 1 ? 'Erstkontakt' : `Follow-up ${sequence_step - 1}`;
    
    const userPrompt = `
KAMPAGNEN-KONTEXT:
- Ziel: ${campaign.goal}
- Zielgruppe: ${campaign.target_segment}
- Tonalität: ${campaign.tonality}
- Erlaubter CTA: ${campaign.allowed_cta || "Macht ein kurzer Austausch Sinn?"}
- Verbotene Wörter: ${JSON.stringify(campaign.forbidden_words)}
- Maximale Wortanzahl: ${campaign.max_word_count}
- Sequenz-Schritt: ${sequence_step} (${sequenceType})

LEAD-DATEN (nur diese Variablen verwenden):
${Object.entries(availableVariables)
  .filter(([_, v]) => v !== null && v !== undefined && v !== '')
  .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
  .join('\n')}

ABSENDER:
- Name: ${campaign.sender_name}
- Signatur: ${campaign.sender_signature || 'Mit freundlichen Grüßen'}

${sequence_step > 1 ? `
WICHTIG: Dies ist ein Follow-up. Beziehe dich kurz auf die vorherige E-Mail, ohne aufdringlich zu sein. Variiere den Ansatz leicht.
` : ''}

Generiere jetzt eine E-Mail für diesen Lead.
`;

    console.log("Calling Lovable AI...");

    // AI-Generierung via Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT.replace("{max_words}", String(campaign.max_word_count)) },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", errorText);
      throw new Error("AI-Generierung fehlgeschlagen");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    console.log("AI Response received:", content?.substring(0, 200));

    // JSON aus Response extrahieren
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No valid JSON in AI response:", content);
      throw new Error("Kein valides JSON in AI-Antwort");
    }

    const emailData = JSON.parse(jsonMatch[0]);

    // Qualitätsprüfung
    const forbiddenWords = campaign.forbidden_words || [];
    const foundForbidden = forbiddenWords.filter((word: string) =>
      emailData.body.toLowerCase().includes(word.toLowerCase()) ||
      emailData.subject.toLowerCase().includes(word.toLowerCase())
    );

    if (foundForbidden.length > 0) {
      console.warn("Verbotene Wörter gefunden:", foundForbidden);
      emailData.confidence_level = "niedrig";
    }

    const wordCount = emailData.body.split(/\s+/).length;
    if (wordCount > campaign.max_word_count) {
      console.warn(`Wortanzahl überschritten: ${wordCount}/${campaign.max_word_count}`);
      emailData.confidence_level = "niedrig";
    }

    // E-Mail in Datenbank speichern
    const { data: savedEmail, error: saveError } = await supabase
      .from("outreach_emails")
      .insert({
        lead_id,
        campaign_id,
        subject: emailData.subject,
        body: emailData.body,
        used_variables: emailData.used_variables,
        confidence_level: emailData.confidence_level,
        sequence_step,
        status: "review",
        generation_prompt: userPrompt,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving email:", saveError);
      throw saveError;
    }

    console.log(`Email generated and saved: ${savedEmail.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        email: savedEmail,
        quality_check: {
          forbidden_words_found: foundForbidden,
          word_count: wordCount,
          max_words: campaign.max_word_count,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error generating email:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
