import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Keywords for auto-classification
const CLASSIFICATION_KEYWORDS = {
  positive: ['interesse', 'interessiert', 'gerne', 'ja', 'termin', 'call', 'sprechen', 'klingt gut', 'passt', 'mehr erfahren'],
  not_interested: ['kein interesse', 'nicht interessiert', 'nein danke', 'passt nicht', 'nicht relevant', 'falsche adresse'],
  wrong_person: ['falsche person', 'nicht zuständig', 'nicht mehr hier', 'hat das unternehmen verlassen', 'wrong person'],
  unsub: ['stop', 'abmelden', 'unsubscribe', 'keine mails', 'remove', 'austragen', 'nicht mehr kontaktieren'],
  objection: ['zu teuer', 'kein budget', 'keine zeit', 'später', 'vielleicht', 'nicht jetzt', 'q1', 'q2', 'q3', 'q4']
};

// Classify reply based on content
function classifyReply(text: string): { classification: string; confidence: number } {
  const lowerText = text.toLowerCase();
  
  // Check for unsubscribe first (highest priority)
  for (const keyword of CLASSIFICATION_KEYWORDS.unsub) {
    if (lowerText.includes(keyword)) {
      return { classification: 'unsub', confidence: 0.95 };
    }
  }
  
  // Check for wrong person
  for (const keyword of CLASSIFICATION_KEYWORDS.wrong_person) {
    if (lowerText.includes(keyword)) {
      return { classification: 'wrong_person', confidence: 0.9 };
    }
  }
  
  // Check for positive
  for (const keyword of CLASSIFICATION_KEYWORDS.positive) {
    if (lowerText.includes(keyword)) {
      return { classification: 'positive', confidence: 0.8 };
    }
  }
  
  // Check for not interested
  for (const keyword of CLASSIFICATION_KEYWORDS.not_interested) {
    if (lowerText.includes(keyword)) {
      return { classification: 'not_interested', confidence: 0.85 };
    }
  }
  
  // Check for objection
  for (const keyword of CLASSIFICATION_KEYWORDS.objection) {
    if (lowerText.includes(keyword)) {
      return { classification: 'objection', confidence: 0.7 };
    }
  }
  
  // Default to neutral
  return { classification: 'neutral', confidence: 0.5 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    console.log("Processing inbound reply:", JSON.stringify(body, null, 2));

    const { from_email, subject, body_text, in_reply_to, message_id } = body;

    if (!from_email) {
      return new Response(
        JSON.stringify({ error: "Missing from_email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const senderEmail = from_email.toLowerCase();

    // Find the lead by email
    const { data: lead, error: leadError } = await supabase
      .from("outreach_leads")
      .select("*, emails:outreach_emails(*)")
      .eq("contact_email", senderEmail)
      .maybeSingle();

    if (leadError || !lead) {
      console.log(`Lead not found for email: ${senderEmail}`);
      return new Response(
        JSON.stringify({ status: "lead_not_found", email: senderEmail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found lead: ${lead.id} (${lead.company_name})`);

    // Classify the reply
    const { classification, confidence } = classifyReply(body_text || subject || '');
    console.log(`Classification: ${classification} (confidence: ${confidence})`);

    // Find the most recent sent email to this lead
    const { data: recentEmail } = await supabase
      .from("outreach_emails")
      .select("*, campaign:outreach_campaigns(*)")
      .eq("lead_id", lead.id)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Create reply classification record
    await supabase.from("outreach_reply_classifications").insert({
      email_id: recentEmail?.id,
      lead_id: lead.id,
      ai_classification: classification,
      ai_confidence: confidence,
      reply_text: body_text?.substring(0, 5000) // Limit text length
    });

    // Update lead as replied
    await supabase
      .from("outreach_leads")
      .update({ 
        has_replied: true,
        reply_sentiment: classification,
        last_reply_at: new Date().toISOString()
      })
      .eq("id", lead.id);

    // Update email if found
    if (recentEmail) {
      await supabase
        .from("outreach_emails")
        .update({ 
          replied_at: new Date().toISOString(),
          reply_classification: classification
        })
        .eq("id", recentEmail.id);

      // Update campaign stats
      if (recentEmail.campaign) {
        const currentStats = recentEmail.campaign.stats || {};
        const newStats = {
          ...currentStats,
          replied: (currentStats.replied || 0) + 1
        };
        
        // Track positive replies separately
        if (classification === 'positive') {
          newStats.positive_replies = (currentStats.positive_replies || 0) + 1;
        }

        await supabase
          .from("outreach_campaigns")
          .update({ stats: newStats })
          .eq("id", recentEmail.campaign.id);
      }
    }

    // === AUTO-ACTIONS based on classification ===

    // Stop all sequences for this lead
    await supabase
      .from("outreach_sequences")
      .update({ status: "paused", paused_reason: `Reply received: ${classification}` })
      .eq("lead_id", lead.id)
      .eq("status", "active");

    // Cancel pending queue items
    await supabase
      .from("outreach_send_queue")
      .update({ status: "cancelled", error_message: "Lead replied" })
      .eq("status", "pending")
      .in("email_id", (await supabase
        .from("outreach_emails")
        .select("id")
        .eq("lead_id", lead.id)
      ).data?.map(e => e.id) || []);

    // If unsubscribe, add to suppression list
    if (classification === 'unsub') {
      await supabase.from("outreach_suppression_list").upsert({
        email: senderEmail,
        reason: 'unsubscribe',
        source: 'reply',
        original_lead_id: lead.id,
        notes: `Auto-detected opt-out from reply: "${body_text?.substring(0, 100)}"`
      }, { onConflict: 'email' });

      await supabase
        .from("outreach_leads")
        .update({ is_suppressed: true, suppression_reason: 'opted_out' })
        .eq("id", lead.id);

      console.log(`Added ${senderEmail} to suppression list (opt-out)`);
    }

    // Create or update conversation
    const { data: existingConvo } = await supabase
      .from("outreach_conversations")
      .select("*")
      .eq("lead_id", lead.id)
      .maybeSingle();

    if (existingConvo) {
      const messages = existingConvo.messages || [];
      messages.push({
        direction: 'inbound',
        content: body_text,
        subject: subject,
        timestamp: new Date().toISOString(),
        classification: classification
      });

      await supabase
        .from("outreach_conversations")
        .update({ 
          messages,
          last_message_at: new Date().toISOString(),
          status: classification === 'positive' ? 'hot' : 'active'
        })
        .eq("id", existingConvo.id);
    } else {
      await supabase.from("outreach_conversations").insert({
        lead_id: lead.id,
        campaign_id: recentEmail?.campaign_id,
        status: classification === 'positive' ? 'hot' : 'active',
        messages: [{
          direction: 'inbound',
          content: body_text,
          subject: subject,
          timestamp: new Date().toISOString(),
          classification: classification
        }],
        last_message_at: new Date().toISOString()
      });
    }

    console.log(`Reply processed successfully for lead ${lead.id}`);

    return new Response(
      JSON.stringify({
        status: "processed",
        lead_id: lead.id,
        classification,
        confidence,
        actions_taken: {
          sequences_paused: true,
          queue_cancelled: true,
          suppression_added: classification === 'unsub'
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error processing inbound reply:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
