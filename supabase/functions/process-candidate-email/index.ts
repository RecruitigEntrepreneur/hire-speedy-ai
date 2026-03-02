import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/[ß]/g, 'ss')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
}

function extractRecipientAddress(payload: any): string | null {
  // Mailgun: recipient field or To header
  const to = payload.recipient || payload.to || payload.To || "";
  if (typeof to === "string") {
    // Extract email from "Name <email>" format
    const match = to.match(/<([^>]+)>/) || [null, to];
    return match[1]?.toLowerCase().trim() || null;
  }
  if (Array.isArray(to) && to.length > 0) {
    const first = to[0];
    if (typeof first === "string") return first.toLowerCase().trim();
    if (first?.email) return first.email.toLowerCase().trim();
  }
  return null;
}

// ─── Main Handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const payload = await req.json();
    console.log("[process-candidate-email] Received webhook:", JSON.stringify(payload).substring(0, 500));

    // ─── 1. Extract email metadata ──────────────────────────────────────

    const fromEmail = payload.from?.email || payload.from || payload.sender || "";
    const fromName = payload.from?.name || payload.fromName || "";
    const subject = payload.subject || "";
    const bodyText = payload.text || payload.body || payload["body-plain"] || "";
    const bodyHtml = payload.html || payload["body-html"] || "";
    const messageId = payload.headers?.["Message-Id"] || payload["Message-Id"] || payload.message_id || "";
    const inReplyTo = payload.headers?.["In-Reply-To"] || payload.in_reply_to || "";

    if (!fromEmail) {
      console.error("[process-candidate-email] No sender email");
      return new Response(
        JSON.stringify({ success: false, error: "No sender email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 2. Resolve recipient → recruiter ───────────────────────────────

    const recipientAddress = extractRecipientAddress(payload);
    if (!recipientAddress) {
      console.error("[process-candidate-email] No recipient address");
      return new Response(
        JSON.stringify({ success: false, error: "No recipient address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-candidate-email] From: ${fromEmail}, To: ${recipientAddress}`);

    const { data: inboundAddr, error: addrError } = await supabase
      .from("recruiter_inbound_addresses")
      .select("recruiter_id, is_active")
      .eq("email_address", recipientAddress)
      .single();

    if (addrError || !inboundAddr) {
      console.log(`[process-candidate-email] Unknown inbound address: ${recipientAddress}`);
      return new Response(
        JSON.stringify({ success: false, error: "Unknown inbound address" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!inboundAddr.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: "Inbound address is deactivated" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recruiterId = inboundAddr.recruiter_id;

    // ─── 3. Idempotency: check message_id ──────────────────────────────

    if (messageId) {
      const { data: existing } = await supabase
        .from("candidate_import_jobs")
        .select("id")
        .eq("message_id", messageId)
        .maybeSingle();

      if (existing) {
        console.log(`[process-candidate-email] Duplicate message_id: ${messageId}`);
        return new Response(
          JSON.stringify({ success: true, message: "Already processed", import_job_id: existing.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ─── 4. Rate limiting (simple: 20/hour, 100/day) ───────────────────

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: hourCount } = await supabase
      .from("candidate_import_jobs")
      .select("*", { count: "exact", head: true })
      .eq("recruiter_id", recruiterId)
      .gte("created_at", oneHourAgo);

    if ((hourCount || 0) >= 20) {
      console.log(`[process-candidate-email] Rate limit exceeded for recruiter ${recruiterId}`);
      return new Response(
        JSON.stringify({ success: false, error: "Rate limit exceeded (max 20/hour)" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 5. Extract and upload PDF attachments ──────────────────────────

    const attachments: Array<{
      storage_path: string;
      original_name: string;
      size_bytes: number;
      mime_type: string;
    }> = [];

    const rawAttachments = payload.attachments || payload.attachment || [];
    const attachmentList = Array.isArray(rawAttachments) ? rawAttachments : [rawAttachments];

    for (const att of attachmentList) {
      if (!att) continue;

      const mimeType = att.content_type || att["content-type"] || att.type || "";
      const fileName = att.filename || att.name || "attachment.pdf";
      const sizeBytes = att.size || 0;

      // Only accept PDFs (MVP)
      if (!mimeType.includes("pdf") && !fileName.toLowerCase().endsWith(".pdf")) {
        console.log(`[process-candidate-email] Skipping non-PDF attachment: ${fileName} (${mimeType})`);
        continue;
      }

      // Size check: max 10MB
      if (sizeBytes > 10 * 1024 * 1024) {
        console.log(`[process-candidate-email] Attachment too large: ${fileName} (${sizeBytes} bytes)`);
        continue;
      }

      // Decode attachment content (base64)
      const content = att.content || att.data || "";
      if (!content) {
        console.log(`[process-candidate-email] No content for attachment: ${fileName}`);
        continue;
      }

      // Convert base64 to Uint8Array
      const binaryContent = Uint8Array.from(atob(content), (c) => c.charCodeAt(0));

      // Upload to cv-documents bucket
      const sanitizedName = sanitizeFilename(fileName);
      const storagePath = `email-imports/${recruiterId}/${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from("cv-documents")
        .upload(storagePath, binaryContent, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        console.error(`[process-candidate-email] Upload failed for ${fileName}:`, uploadError.message);
        continue;
      }

      attachments.push({
        storage_path: storagePath,
        original_name: fileName,
        size_bytes: sizeBytes || binaryContent.length,
        mime_type: "application/pdf",
      });

      console.log(`[process-candidate-email] Uploaded: ${storagePath} (${binaryContent.length} bytes)`);
    }

    // ─── 6. Create import job ───────────────────────────────────────────

    const { data: importJob, error: insertError } = await supabase
      .from("candidate_import_jobs")
      .insert({
        recruiter_id: recruiterId,
        from_email: fromEmail.toLowerCase(),
        from_name: fromName,
        subject: subject,
        body_text: bodyText,
        body_html: bodyHtml,
        message_id: messageId || null,
        in_reply_to: inReplyTo || null,
        attachments: attachments,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[process-candidate-email] Failed to create import job:", insertError.message);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create import job" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-candidate-email] Created import job: ${importJob.id} with ${attachments.length} PDFs`);

    // ─── 7. Trigger async processing ────────────────────────────────────

    // Fire-and-forget call to the async processor
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    fetch(`${supabaseUrl}/functions/v1/process-candidate-import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ import_job_id: importJob.id }),
    }).catch((err) => {
      console.error("[process-candidate-email] Failed to trigger async processor:", err);
    });

    // ─── 8. Return immediately ──────────────────────────────────────────

    return new Response(
      JSON.stringify({
        success: true,
        import_job_id: importJob.id,
        attachments_uploaded: attachments.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[process-candidate-email] Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
