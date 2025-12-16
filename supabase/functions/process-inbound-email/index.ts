import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AI-Prompt für Intent-Klassifikation
const INTENT_PROMPT = `Analysiere diese E-Mail-Antwort auf eine B2B-Outreach-E-Mail und klassifiziere sie.

E-MAIL:
{email_content}

Antworte im JSON-Format:
{
  "intent": "interested" | "not_interested" | "question" | "meeting_request" | "unsubscribe" | "out_of_office" | "bounce" | "other",
  "sentiment": "positive" | "neutral" | "negative",
  "summary": "Kurze Zusammenfassung in 1-2 Sätzen auf Deutsch",
  "suggested_action": "Empfohlene nächste Aktion auf Deutsch",
  "pause_sequence": true | false,
  "key_points": ["Punkt 1", "Punkt 2"]
}

REGELN:
- "interested": Zeigt Interesse an einem Gespräch/Meeting
- "not_interested": Ablehnung, kein Interesse
- "question": Hat Rückfragen zum Angebot/Service
- "meeting_request": Möchte direkt einen Termin
- "unsubscribe": Möchte keine weiteren E-Mails
- "out_of_office": Automatische Abwesenheitsnotiz
- "bounce": Unzustellbar, E-Mail-Adresse ungültig
- "other": Keine der obigen Kategorien

PAUSE_SEQUENCE sollte true sein bei: interested, meeting_request, question, unsubscribe, bounce, not_interested`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Webhook-Payload parsen (kompatibel mit Resend/Mailgun/SendGrid)
    const payload = await req.json();

    console.log("Received inbound email webhook:", JSON.stringify(payload).substring(0, 500));

    const fromEmail = payload.from?.email || payload.from || payload.sender;
    const fromName = payload.from?.name || payload.fromName || "";
    const subject = payload.subject || "";
    const body = payload.text || payload.body || payload.html?.replace(/<[^>]*>/g, '') || "";
    const inReplyTo = payload.headers?.["In-Reply-To"] || payload.in_reply_to || "";

    if (!fromEmail) {
      console.error("No sender email in payload");
      return new Response(
        JSON.stringify({ status: "error", message: "No sender email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing inbound email from ${fromEmail}`);

    // Lead anhand E-Mail finden
    const { data: lead, error: leadError } = await supabase
      .from("outreach_leads")
      .select("*")
      .ilike("contact_email", fromEmail.toLowerCase())
      .single();

    if (leadError || !lead) {
      console.log("Unknown sender:", fromEmail);
      return new Response(
        JSON.stringify({ status: "unknown_sender", email: fromEmail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found lead: ${lead.id} - ${lead.contact_name}`);

    // Conversation finden oder erstellen
    let { data: conversation } = await supabase
      .from("outreach_conversations")
      .select("*")
      .eq("lead_id", lead.id)
      .in("status", ["active", "replied"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!conversation) {
      console.log("Creating new conversation");
      const { data: newConv, error: convError } = await supabase
        .from("outreach_conversations")
        .insert({
          lead_id: lead.id,
          subject: subject,
          status: "replied",
          last_message_at: new Date().toISOString(),
          message_count: 1
        })
        .select()
        .single();
      
      if (convError) {
        console.error("Error creating conversation:", convError);
        throw convError;
      }
      conversation = newConv;
    } else {
      // Conversation aktualisieren
      await supabase
        .from("outreach_conversations")
        .update({
          status: "replied",
          last_message_at: new Date().toISOString(),
          message_count: (conversation.message_count || 0) + 1
        })
        .eq("id", conversation.id);
    }

    // AI Intent-Klassifikation
    console.log("Calling AI for intent classification...");
    
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
          {
            role: "user",
            content: INTENT_PROMPT.replace("{email_content}", `Betreff: ${subject}\n\n${body}`)
          }
        ],
        temperature: 0.3,
      }),
    });

    let analysis = {
      intent: "other",
      sentiment: "neutral",
      summary: "Antwort erhalten",
      suggested_action: "Manuell prüfen",
      pause_sequence: true,
      key_points: []
    };

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const analysisText = aiData.choices?.[0]?.message?.content;
      
      try {
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError);
      }
    } else {
      console.error("AI request failed:", await aiResponse.text());
    }

    console.log(`Intent classification: ${analysis.intent}, sentiment: ${analysis.sentiment}`);

    // Nachricht speichern
    const { error: msgError } = await supabase
      .from("outreach_messages")
      .insert({
        conversation_id: conversation.id,
        direction: "inbound",
        subject,
        body,
        from_email: fromEmail,
        from_name: fromName,
        received_at: new Date().toISOString(),
        intent: analysis.intent,
        sentiment: analysis.sentiment,
        ai_summary: analysis.summary,
        suggested_action: analysis.suggested_action,
        is_read: false
      });

    if (msgError) {
      console.error("Error saving message:", msgError);
    }

    // Conversation Intent/Sentiment aktualisieren
    await supabase
      .from("outreach_conversations")
      .update({
        intent: analysis.intent,
        sentiment: analysis.sentiment
      })
      .eq("id", conversation.id);

    // Lead-Status aktualisieren
    let newLeadStatus = "replied";
    if (analysis.intent === "interested" || analysis.intent === "meeting_request") {
      newLeadStatus = "qualified";
    } else if (analysis.intent === "not_interested" || analysis.intent === "unsubscribe") {
      newLeadStatus = "closed";
    }

    await supabase
      .from("outreach_leads")
      .update({
        last_replied_at: new Date().toISOString(),
        status: newLeadStatus
      })
      .eq("id", lead.id);

    // Sequenz pausieren wenn nötig
    if (analysis.pause_sequence) {
      console.log("Pausing active sequences for lead");
      await supabase
        .from("outreach_sequences")
        .update({
          status: "replied",
          pause_reason: analysis.intent
        })
        .eq("lead_id", lead.id)
        .eq("status", "active");
    }

    // Kampagnen-Stats aktualisieren
    const { data: recentEmail } = await supabase
      .from("outreach_emails")
      .select("campaign_id")
      .eq("lead_id", lead.id)
      .order("sent_at", { ascending: false })
      .limit(1)
      .single();

    if (recentEmail?.campaign_id) {
      const { data: campaign } = await supabase
        .from("outreach_campaigns")
        .select("stats")
        .eq("id", recentEmail.campaign_id)
        .single();

      if (campaign) {
        const currentStats = campaign.stats || { sent: 0, opened: 0, clicked: 0, replied: 0, converted: 0 };
        await supabase
          .from("outreach_campaigns")
          .update({
            stats: { ...currentStats, replied: (currentStats.replied || 0) + 1 }
          })
          .eq("id", recentEmail.campaign_id);
      }

      // E-Mail als beantwortet markieren
      await supabase
        .from("outreach_emails")
        .update({
          replied_at: new Date().toISOString(),
          reply_intent: analysis.intent,
          reply_sentiment: analysis.sentiment
        })
        .eq("lead_id", lead.id)
        .is("replied_at", null);
    }

    console.log(`Inbound email processed successfully for lead ${lead.id}`);

    return new Response(
      JSON.stringify({
        status: "processed",
        lead_id: lead.id,
        conversation_id: conversation.id,
        intent: analysis.intent,
        sentiment: analysis.sentiment,
        summary: analysis.summary
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Inbound processing error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
