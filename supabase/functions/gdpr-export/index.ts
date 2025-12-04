import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("GDPR export requested for user:", user.id);

    // Create export request
    const { data: exportRequest, error: insertError } = await supabase
      .from("data_export_requests")
      .insert({
        user_id: user.id,
        status: "processing",
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Collect all user data
    const exportData: Record<string, unknown> = {
      export_date: new Date().toISOString(),
      user_id: user.id,
      email: user.email,
    };

    // Profile data
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    exportData.profile = profile;

    // User role
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    exportData.user_role = userRole;

    // Company profile (if client)
    const { data: companyProfile } = await supabase
      .from("company_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (companyProfile) exportData.company_profile = companyProfile;

    // Candidates (if recruiter)
    const { data: candidates } = await supabase
      .from("candidates")
      .select("*")
      .eq("recruiter_id", user.id);
    if (candidates?.length) exportData.candidates = candidates;

    // Submissions (as recruiter)
    const { data: recruiterSubmissions } = await supabase
      .from("submissions")
      .select("*, jobs(title, company_name)")
      .eq("recruiter_id", user.id);
    if (recruiterSubmissions?.length) exportData.submissions_as_recruiter = recruiterSubmissions;

    // Jobs (if client)
    const { data: jobs } = await supabase
      .from("jobs")
      .select("*")
      .eq("client_id", user.id);
    if (jobs?.length) exportData.jobs = jobs;

    // Messages
    const { data: sentMessages } = await supabase
      .from("messages")
      .select("*")
      .eq("sender_id", user.id);
    const { data: receivedMessages } = await supabase
      .from("messages")
      .select("*")
      .eq("recipient_id", user.id);
    exportData.messages = {
      sent: sentMessages || [],
      received: receivedMessages || [],
    };

    // Notifications
    const { data: notifications } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id);
    if (notifications?.length) exportData.notifications = notifications;

    // Consents
    const { data: consents } = await supabase
      .from("consents")
      .select("*")
      .eq("subject_id", user.id);
    if (consents?.length) exportData.consents = consents;

    // Activity logs
    const { data: activityLogs } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("user_id", user.id);
    if (activityLogs?.length) exportData.activity_logs = activityLogs;

    // Stripe account (if exists)
    const { data: stripeAccount } = await supabase
      .from("stripe_accounts")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (stripeAccount) exportData.stripe_account = stripeAccount;

    // Payout requests (if recruiter)
    const { data: payoutRequests } = await supabase
      .from("payout_requests")
      .select("*")
      .eq("recruiter_id", user.id);
    if (payoutRequests?.length) exportData.payout_requests = payoutRequests;

    // Invoices (if client)
    const { data: invoices } = await supabase
      .from("invoices")
      .select("*")
      .eq("client_id", user.id);
    if (invoices?.length) exportData.invoices = invoices;

    // Convert to JSON
    const jsonData = JSON.stringify(exportData, null, 2);
    const fileName = `gdpr-export-${user.id}-${Date.now()}.json`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(`gdpr-exports/${fileName}`, jsonData, {
        contentType: "application/json",
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      // Still return the data directly if upload fails
    }

    // Create signed URL (expires in 7 days)
    const { data: signedUrl } = await supabase.storage
      .from("documents")
      .createSignedUrl(`gdpr-exports/${fileName}`, 60 * 60 * 24 * 7);

    // Update export request
    await supabase
      .from("data_export_requests")
      .update({
        status: "completed",
        file_url: signedUrl?.signedUrl || null,
        completed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", exportRequest.id);

    // Send email notification
    try {
      await supabase.functions.invoke("send-email", {
        body: {
          to: user.email,
          template: "data_export_ready",
          data: {
            download_url: signedUrl?.signedUrl || "Nicht verfügbar",
            expires_in: "7 Tagen",
          },
        },
      });
    } catch (emailError) {
      console.error("Email notification failed:", emailError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        export_id: exportRequest.id,
        download_url: signedUrl?.signedUrl,
        data: exportData, // Also return data directly
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("GDPR export error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
