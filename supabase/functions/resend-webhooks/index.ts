import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    console.log("Resend webhook received:", JSON.stringify(body, null, 2));

    const { type, data } = body;

    if (!type || !data) {
      return new Response(
        JSON.stringify({ error: "Invalid webhook payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find email by resend_id
    const resendId = data.email_id;
    const { data: email, error: emailError } = await supabase
      .from("outreach_emails")
      .select("*, lead:outreach_leads(*), campaign:outreach_campaigns(*)")
      .eq("resend_id", resendId)
      .maybeSingle();

    if (emailError) {
      console.error("Error fetching email:", emailError);
    }

    switch (type) {
      case "email.delivered":
        console.log(`Email delivered: ${resendId}`);
        if (email) {
          await supabase
            .from("outreach_emails")
            .update({ delivered_at: new Date().toISOString() })
            .eq("id", email.id);
        }
        break;

      case "email.opened":
        console.log(`Email opened: ${resendId}`);
        // Already handled by tracking pixel, but can update here too
        if (email) {
          await supabase
            .from("outreach_emails")
            .update({ 
              opened_at: email.opened_at || new Date().toISOString(),
              open_count: (email.open_count || 0) + 1
            })
            .eq("id", email.id);
        }
        break;

      case "email.clicked":
        console.log(`Email clicked: ${resendId}`);
        if (email) {
          await supabase
            .from("outreach_emails")
            .update({ 
              clicked_at: email.clicked_at || new Date().toISOString(),
              click_count: (email.click_count || 0) + 1
            })
            .eq("id", email.id);
        }
        break;

      case "email.bounced":
        console.log(`Email bounced: ${resendId}`);
        if (email && email.lead) {
          // Add to suppression list
          await supabase.from("outreach_suppression_list").upsert({
            email: email.lead.contact_email.toLowerCase(),
            reason: 'bounce',
            source: 'webhook',
            original_lead_id: email.lead.id,
            notes: `Bounce type: ${data.bounce?.type || 'unknown'}`
          }, { onConflict: 'email' });

          // Mark lead as suppressed
          await supabase
            .from("outreach_leads")
            .update({ 
              is_suppressed: true, 
              suppression_reason: 'bounced',
              email_validation_status: 'bounced'
            })
            .eq("id", email.lead.id);

          // Update email status
          await supabase
            .from("outreach_emails")
            .update({ status: 'bounced', bounced_at: new Date().toISOString() })
            .eq("id", email.id);

          // Cancel pending emails to this lead
          const { data: pendingEmails } = await supabase
            .from("outreach_emails")
            .select("id")
            .eq("lead_id", email.lead.id)
            .in("status", ["draft", "approved", "scheduled"]);

          if (pendingEmails && pendingEmails.length > 0) {
            await supabase
              .from("outreach_send_queue")
              .update({ status: "cancelled", error_message: "Lead email bounced" })
              .in("email_id", pendingEmails.map(e => e.id));
          }

          // Stop sequences
          await supabase
            .from("outreach_sequences")
            .update({ status: "paused", paused_reason: "Email bounced" })
            .eq("lead_id", email.lead.id)
            .eq("status", "active");

          console.log(`Added ${email.lead.contact_email} to suppression list (bounce)`);
        }
        break;

      case "email.complained":
        console.log(`Email complained (spam): ${resendId}`);
        if (email && email.lead) {
          // Add to suppression list with high priority
          await supabase.from("outreach_suppression_list").upsert({
            email: email.lead.contact_email.toLowerCase(),
            reason: 'complaint',
            source: 'webhook',
            original_lead_id: email.lead.id,
            notes: 'Spam complaint received - DO NOT CONTACT'
          }, { onConflict: 'email' });

          // Mark lead as suppressed
          await supabase
            .from("outreach_leads")
            .update({ 
              is_suppressed: true, 
              suppression_reason: 'spam_complaint'
            })
            .eq("id", email.lead.id);

          // Update email status
          await supabase
            .from("outreach_emails")
            .update({ status: 'complained' })
            .eq("id", email.id);

          // Cancel ALL pending emails for this lead
          const { data: pendingEmails } = await supabase
            .from("outreach_emails")
            .select("id")
            .eq("lead_id", email.lead.id)
            .in("status", ["draft", "approved", "scheduled"]);

          if (pendingEmails && pendingEmails.length > 0) {
            await supabase
              .from("outreach_send_queue")
              .update({ status: "cancelled", error_message: "Spam complaint received" })
              .in("email_id", pendingEmails.map(e => e.id));
          }

          // Stop all sequences
          await supabase
            .from("outreach_sequences")
            .update({ status: "paused", paused_reason: "Spam complaint received" })
            .eq("lead_id", email.lead.id);

          // CRITICAL: Pause campaign if too many complaints
          if (email.campaign) {
            const { data: recentComplaints } = await supabase
              .from("outreach_emails")
              .select("id")
              .eq("campaign_id", email.campaign.id)
              .eq("status", "complained")
              .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

            if (recentComplaints && recentComplaints.length >= 3) {
              console.log(`CRITICAL: Pausing campaign ${email.campaign.id} due to multiple complaints`);
              await supabase
                .from("outreach_campaigns")
                .update({ 
                  status: "paused",
                  // Add note about why it was paused
                  stats: {
                    ...email.campaign.stats,
                    auto_paused: true,
                    auto_paused_reason: "Multiple spam complaints",
                    auto_paused_at: new Date().toISOString()
                  }
                })
                .eq("id", email.campaign.id);
            }
          }

          console.log(`SPAM COMPLAINT: Added ${email.lead.contact_email} to suppression list`);
        }
        break;

      case "email.delivery_delayed":
        console.log(`Email delivery delayed: ${resendId}`);
        // Just log for now, could implement retry logic
        break;

      default:
        console.log(`Unknown webhook type: ${type}`);
    }

    return new Response(
      JSON.stringify({ status: "processed", type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
