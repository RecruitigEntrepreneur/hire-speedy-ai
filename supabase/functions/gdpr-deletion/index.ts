import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeletionRequest {
  action: "request" | "confirm" | "cancel";
  reason?: string;
  confirmation_token?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const body: DeletionRequest = await req.json();
    console.log("GDPR deletion action:", body.action, "for user:", user.id);

    switch (body.action) {
      case "request": {
        const { data: existingRequest } = await supabase
          .from("data_deletion_requests")
          .select("*")
          .eq("user_id", user.id)
          .in("status", ["pending", "confirmed", "processing"])
          .single();

        if (existingRequest) {
          return new Response(
            JSON.stringify({ error: "Eine Löschanfrage ist bereits aktiv" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const confirmationToken = crypto.randomUUID();
        const { data: deletionRequest, error: insertError } = await supabase
          .from("data_deletion_requests")
          .insert({
            user_id: user.id,
            reason: body.reason,
            confirmation_token: confirmationToken,
            status: "pending",
          })
          .select()
          .single();

        if (insertError) throw insertError;

        return new Response(
          JSON.stringify({
            success: true,
            message: "Löschanfrage erstellt.",
            request_id: deletionRequest.id,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "confirm": {
        if (!body.confirmation_token) {
          return new Response(
            JSON.stringify({ error: "Bestätigungstoken erforderlich" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        const { data: deletionRequest } = await supabase
          .from("data_deletion_requests")
          .select("*")
          .eq("user_id", user.id)
          .eq("confirmation_token", body.confirmation_token)
          .eq("status", "pending")
          .single();

        if (!deletionRequest) {
          return new Response(
            JSON.stringify({ error: "Ungültiger oder abgelaufener Token" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        await supabase
          .from("data_deletion_requests")
          .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
          .eq("id", deletionRequest.id);

        await anonymizeUserData(supabase, user.id);

        await supabase
          .from("data_deletion_requests")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", deletionRequest.id);

        await supabase.auth.admin.deleteUser(user.id);

        return new Response(
          JSON.stringify({ success: true, message: "Konto gelöscht." }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      case "cancel": {
        await supabase
          .from("data_deletion_requests")
          .delete()
          .eq("user_id", user.id)
          .eq("status", "pending");

        return new Response(
          JSON.stringify({ success: true, message: "Löschanfrage abgebrochen" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Ungültige Aktion" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    }
  } catch (error) {
    console.error("GDPR deletion error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

// deno-lint-ignore no-explicit-any
async function anonymizeUserData(supabase: any, userId: string) {
  const anonymizedEmail = `deleted-${userId.slice(0, 8)}@anonymized.local`;

  await supabase
    .from("profiles")
    .update({ email: anonymizedEmail, full_name: "Gelöschter Benutzer", phone: null, avatar_url: null })
    .eq("user_id", userId);

  await supabase
    .from("candidates")
    .update({ full_name: "Anonymisiert", email: anonymizedEmail, phone: null, linkedin_url: null, cv_url: null })
    .eq("recruiter_id", userId);

  await supabase.from("messages").update({ content: "[Gelöscht]" }).eq("sender_id", userId);
  await supabase.from("stripe_accounts").delete().eq("user_id", userId);

  console.log("User data anonymized for:", userId);
}

serve(handler);
