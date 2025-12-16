import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 50; // 50 pro Aufruf, alle 30 Sek = 6.000/Stunde möglich

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
    console.log("Processing outreach queue...");

    // Pending E-Mails aus Queue holen
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
        JSON.stringify({ processed: 0, success: 0, failed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${queueItems.length} emails...`);

    let successCount = 0;
    let failCount = 0;

    for (const item of queueItems) {
      // Status auf "processing" setzen
      await supabase
        .from("outreach_send_queue")
        .update({
          status: "processing",
          processing_started_at: new Date().toISOString()
        })
        .eq("id", item.id);

      try {
        const email = item.email;
        
        if (!email || !email.lead || !email.campaign) {
          console.error(`Missing data for queue item ${item.id}`);
          throw new Error("Fehlende E-Mail/Lead/Kampagnen-Daten");
        }

        const lead = email.lead;
        const campaign = email.campaign;

        // Tracking-URLs
        const baseUrl = Deno.env.get("SUPABASE_URL");
        const trackingPixel = `<img src="${baseUrl}/functions/v1/track-outreach-engagement?type=open&eid=${email.id}" width="1" height="1" style="display:none;" />`;

        // HTML-Body mit Tracking
        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6; }
    p { margin: 0 0 1em 0; }
  </style>
</head>
<body>
  ${email.body.split('\n').map((p: string) => p.trim() ? `<p>${p}</p>` : '').join('')}
  <br/>
  <p>${campaign.sender_signature || 'Mit freundlichen Grüßen'}<br/>${campaign.sender_name}</p>
  ${trackingPixel}
</body>
</html>
        `;

        console.log(`Sending email to ${lead.contact_email}...`);

        // E-Mail senden
        const { data: resendData, error: resendError } = await resend.emails.send({
          from: `${campaign.sender_name} <${campaign.sender_email}>`,
          to: [lead.contact_email],
          subject: email.subject,
          html: htmlBody,
        });

        if (resendError) {
          console.error("Resend error:", resendError);
          throw new Error(resendError.message);
        }

        console.log(`Email sent successfully: ${resendData?.id}`);

        // Erfolg aktualisieren
        await supabase
          .from("outreach_send_queue")
          .update({
            status: "completed",
            completed_at: new Date().toISOString()
          })
          .eq("id", item.id);

        await supabase
          .from("outreach_emails")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            resend_id: resendData?.id
          })
          .eq("id", email.id);

        await supabase
          .from("outreach_leads")
          .update({ last_contacted_at: new Date().toISOString() })
          .eq("id", lead.id);

        // Kampagnen-Stats aktualisieren
        const currentStats = campaign.stats || { sent: 0, opened: 0, clicked: 0, replied: 0, converted: 0 };
        await supabase
          .from("outreach_campaigns")
          .update({
            stats: { ...currentStats, sent: (currentStats.sent || 0) + 1 }
          })
          .eq("id", campaign.id);

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
            .eq("id", item.email?.id);
        }

        failCount++;
      }
    }

    console.log(`Queue processing complete: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        processed: queueItems.length,
        success: successCount,
        failed: failCount
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
