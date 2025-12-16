import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 50;

// Helper: Extract domain from email
function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

// Helper: Check if email is suppressed
async function isEmailSuppressed(supabase: any, email: string): Promise<boolean> {
  const { data } = await supabase
    .from("outreach_suppression_list")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return !!data;
}

// Helper: Check and update rate limits
async function checkRateLimit(
  supabase: any, 
  senderEmail: string, 
  targetDomain: string | null,
  campaignLimits: { daily_limit: number; domain_daily_limit: number }
): Promise<{ allowed: boolean; reason?: string }> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // Check global sender limit
  const { data: senderLimit } = await supabase
    .from("outreach_rate_limits")
    .select("*")
    .eq("sender_email", senderEmail)
    .is("target_domain", null)
    .eq("limit_type", "daily")
    .maybeSingle();

  if (senderLimit) {
    // Reset if expired
    if (senderLimit.reset_at && new Date(senderLimit.reset_at) < now) {
      await supabase
        .from("outreach_rate_limits")
        .update({ current_count: 0, reset_at: tomorrowStart.toISOString() })
        .eq("id", senderLimit.id);
    } else if (senderLimit.current_count >= (campaignLimits.daily_limit || senderLimit.max_count)) {
      return { allowed: false, reason: `Sender daily limit reached (${senderLimit.current_count}/${campaignLimits.daily_limit})` };
    }
  } else {
    // Create rate limit entry
    await supabase.from("outreach_rate_limits").insert({
      sender_email: senderEmail,
      target_domain: null,
      limit_type: "daily",
      max_count: campaignLimits.daily_limit || 200,
      current_count: 0,
      reset_at: tomorrowStart.toISOString()
    });
  }

  // Check domain limit if target domain provided
  if (targetDomain) {
    const { data: domainLimit } = await supabase
      .from("outreach_rate_limits")
      .select("*")
      .eq("sender_email", senderEmail)
      .eq("target_domain", targetDomain)
      .eq("limit_type", "daily")
      .maybeSingle();

    if (domainLimit) {
      if (domainLimit.reset_at && new Date(domainLimit.reset_at) < now) {
        await supabase
          .from("outreach_rate_limits")
          .update({ current_count: 0, reset_at: tomorrowStart.toISOString() })
          .eq("id", domainLimit.id);
      } else if (domainLimit.current_count >= (campaignLimits.domain_daily_limit || domainLimit.max_count)) {
        return { allowed: false, reason: `Domain daily limit reached for ${targetDomain} (${domainLimit.current_count}/${campaignLimits.domain_daily_limit})` };
      }
    } else {
      await supabase.from("outreach_rate_limits").insert({
        sender_email: senderEmail,
        target_domain: targetDomain,
        limit_type: "daily",
        max_count: campaignLimits.domain_daily_limit || 10,
        current_count: 0,
        reset_at: tomorrowStart.toISOString()
      });
    }
  }

  return { allowed: true };
}

// Helper: Increment rate limit counters
async function incrementRateLimits(supabase: any, senderEmail: string, targetDomain: string | null) {
  // Increment sender limit
  await supabase.rpc('increment_rate_limit', { 
    p_sender_email: senderEmail, 
    p_target_domain: null 
  }).catch(() => {
    // Fallback if RPC doesn't exist
    supabase
      .from("outreach_rate_limits")
      .update({ current_count: supabase.sql`current_count + 1` })
      .eq("sender_email", senderEmail)
      .is("target_domain", null);
  });

  // Increment domain limit
  if (targetDomain) {
    await supabase
      .from("outreach_rate_limits")
      .update({ current_count: supabase.sql`current_count + 1` })
      .eq("sender_email", senderEmail)
      .eq("target_domain", targetDomain)
      .catch(() => {});
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    console.log("Processing outreach queue with guardrails...");

    // Fetch pending emails from queue
    const { data: queueItems, error: queueError } = await supabase
      .from("outreach_send_queue")
      .select(`
        *,
        email:outreach_emails(
          *,
          lead:outreach_leads(*),
          campaign:outreach_campaigns(*)
        )
      `)
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("priority", { ascending: false })
      .order("scheduled_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (queueError) {
      console.error("Queue fetch error:", queueError);
      throw queueError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log("No pending emails in queue");
      return new Response(
        JSON.stringify({ processed: 0, success: 0, failed: 0, skipped: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${queueItems.length} emails with guardrails...`);

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const item of queueItems) {
      const email = item.email;
      
      if (!email || !email.lead || !email.campaign) {
        console.error(`Missing data for queue item ${item.id}`);
        failCount++;
        continue;
      }

      const lead = email.lead;
      const campaign = email.campaign;

      // === GUARDRAIL 1: Test Mode Check ===
      if (campaign.test_mode) {
        const testRecipients = campaign.test_recipients || [];
        if (!testRecipients.includes(lead.contact_email)) {
          console.log(`Test mode: Skipping ${lead.contact_email} (not in test list)`);
          await supabase
            .from("outreach_send_queue")
            .update({ status: "skipped", error_message: "Test mode: not in test recipients" })
            .eq("id", item.id);
          skippedCount++;
          continue;
        }
      }

      // === GUARDRAIL 2: Suppression Check ===
      const isSuppressed = await isEmailSuppressed(supabase, lead.contact_email);
      if (isSuppressed) {
        console.log(`Suppressed: Skipping ${lead.contact_email}`);
        await supabase
          .from("outreach_send_queue")
          .update({ status: "skipped", error_message: "Email is on suppression list" })
          .eq("id", item.id);
        
        // Mark lead as suppressed
        await supabase
          .from("outreach_leads")
          .update({ is_suppressed: true, suppression_reason: "on_dnc_list" })
          .eq("id", lead.id);
        
        skippedCount++;
        continue;
      }

      // === GUARDRAIL 3: Rate Limit Check ===
      const targetDomain = extractDomain(lead.contact_email);
      const rateLimitCheck = await checkRateLimit(
        supabase, 
        campaign.sender_email, 
        targetDomain,
        { daily_limit: campaign.daily_limit || 200, domain_daily_limit: campaign.domain_daily_limit || 10 }
      );

      if (!rateLimitCheck.allowed) {
        console.log(`Rate limited: ${rateLimitCheck.reason}`);
        // Reschedule for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        
        await supabase
          .from("outreach_send_queue")
          .update({ 
            scheduled_at: tomorrow.toISOString(),
            error_message: rateLimitCheck.reason
          })
          .eq("id", item.id);
        
        skippedCount++;
        continue;
      }

      // === GUARDRAIL 4: Check if Lead already replied ===
      if (lead.has_replied) {
        console.log(`Already replied: Skipping ${lead.contact_email}`);
        await supabase
          .from("outreach_send_queue")
          .update({ status: "skipped", error_message: "Lead has already replied" })
          .eq("id", item.id);
        skippedCount++;
        continue;
      }

      // Set status to processing
      await supabase
        .from("outreach_send_queue")
        .update({
          status: "processing",
          processing_started_at: new Date().toISOString()
        })
        .eq("id", item.id);

      try {
        // Build tracking URLs
        const baseUrl = Deno.env.get("SUPABASE_URL");
        const trackingPixel = `<img src="${baseUrl}/functions/v1/track-outreach-engagement?type=open&eid=${email.id}" width="1" height="1" style="display:none;" />`;

        // Add test mode indicator to subject
        const subject = campaign.test_mode ? `[TEST] ${email.subject}` : email.subject;

        // Build HTML body with tracking and opt-out
        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6; }
    p { margin: 0 0 1em 0; }
    .optout { font-size: 11px; color: #999; margin-top: 2em; }
  </style>
</head>
<body>
  ${email.body.split('\n').map((p: string) => p.trim() ? `<p>${p}</p>` : '').join('')}
  <br/>
  <p>${campaign.sender_signature || 'Mit freundlichen Grüßen'}<br/>${campaign.sender_name}</p>
  <p class="optout">Wenn das nicht passt, kurze Antwort mit "Stop" genügt.</p>
  ${trackingPixel}
</body>
</html>
        `;

        console.log(`Sending email to ${lead.contact_email}...`);

        // Send email via Resend
        const { data: resendData, error: resendError } = await resend.emails.send({
          from: `${campaign.sender_name} <${campaign.sender_email}>`,
          to: [lead.contact_email],
          subject: subject,
          html: htmlBody,
        });

        if (resendError) {
          console.error("Resend error:", resendError);
          throw new Error(resendError.message);
        }

        console.log(`Email sent successfully: ${resendData?.id}`);

        // Update queue item
        await supabase
          .from("outreach_send_queue")
          .update({
            status: "completed",
            completed_at: new Date().toISOString()
          })
          .eq("id", item.id);

        // Update email record
        await supabase
          .from("outreach_emails")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            resend_id: resendData?.id
          })
          .eq("id", email.id);

        // Update lead
        await supabase
          .from("outreach_leads")
          .update({ last_contacted_at: new Date().toISOString() })
          .eq("id", lead.id);

        // Update campaign stats
        const currentStats = campaign.stats || { sent: 0, opened: 0, clicked: 0, replied: 0, converted: 0 };
        await supabase
          .from("outreach_campaigns")
          .update({
            stats: { ...currentStats, sent: (currentStats.sent || 0) + 1 }
          })
          .eq("id", campaign.id);

        // Increment rate limits
        await incrementRateLimits(supabase, campaign.sender_email, targetDomain);

        successCount++;

      } catch (sendError: any) {
        console.error(`Failed to send email for queue item ${item.id}:`, sendError);

        const newAttempts = item.attempts + 1;
        const newStatus = newAttempts >= item.max_attempts ? "failed" : "pending";

        await supabase
          .from("outreach_send_queue")
          .update({
            status: newStatus,
            attempts: newAttempts,
            error_message: sendError.message,
            processing_started_at: null
          })
          .eq("id", item.id);

        if (newStatus === "failed") {
          await supabase
            .from("outreach_emails")
            .update({ status: "failed" })
            .eq("id", email.id);
        }

        failCount++;
      }
    }

    console.log(`Queue processing complete: ${successCount} success, ${failCount} failed, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({
        processed: queueItems.length,
        success: successCount,
        failed: failCount,
        skipped: skippedCount
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Queue processing error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
