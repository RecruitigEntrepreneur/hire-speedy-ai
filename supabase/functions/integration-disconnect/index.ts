import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken, getEncryptionKey } from "../_shared/encryption.ts";
import { OAUTH_PROVIDERS } from "../_shared/provider-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { integrationId } = await req.json();

    if (!integrationId) {
      return new Response(
        JSON.stringify({ error: "Missing integrationId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch integration (scoped to user)
    const { data: integration, error: fetchError } = await supabase
      .from("recruiter_integrations")
      .select("*")
      .eq("id", integrationId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !integration) {
      return new Response(
        JSON.stringify({ error: "Integration nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[integration-disconnect] Disconnecting ${integration.provider} for user ${user.id}`);

    // Attempt to revoke token at provider (best effort)
    if (integration.auth_type === "oauth" && integration.access_token_encrypted) {
      const providerConfig = OAUTH_PROVIDERS[integration.provider];
      if (providerConfig?.revokeUrl) {
        try {
          const encryptionKey = getEncryptionKey();
          const accessToken = await decryptToken(integration.access_token_encrypted, encryptionKey);

          await fetch(providerConfig.revokeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token: accessToken }),
          });
          console.log(`[integration-disconnect] Token revoked at ${integration.provider}`);
        } catch (revokeErr) {
          // Non-critical - token will expire on its own
          console.log(`[integration-disconnect] Token revocation failed (non-critical):`, revokeErr);
        }
      }
    }

    // Delete the integration row
    const { error: deleteError } = await supabase
      .from("recruiter_integrations")
      .delete()
      .eq("id", integrationId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("[integration-disconnect] Delete failed:", deleteError.message);
      return new Response(
        JSON.stringify({ error: "Trennen fehlgeschlagen" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[integration-disconnect] Successfully disconnected ${integration.provider}`);

    return new Response(
      JSON.stringify({ success: true, provider: integration.provider }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[integration-disconnect] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
