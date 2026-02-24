import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken, getEncryptionKey } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Handles API Key and Client Credentials Integrations ──────────────────────
// For providers that don't support OAuth (Greenhouse, Personio, etc.)

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

    const { action, provider, apiKey, clientId, clientSecret } = await req.json();

    if (!provider) {
      return new Response(
        JSON.stringify({ error: "Missing provider" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[integration-api-key] Action: ${action}, Provider: ${provider}, User: ${user.id}`);

    const encryptionKey = getEncryptionKey();

    // ─── Connect ────────────────────────────────────────────────────

    if (action === "connect") {
      const isClientCredentials = clientId && clientSecret;
      const isApiKey = apiKey;

      if (!isApiKey && !isClientCredentials) {
        return new Response(
          JSON.stringify({ error: "Missing credentials (apiKey or clientId+clientSecret)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const insertData: Record<string, unknown> = {
        user_id: user.id,
        provider,
        status: "connected",
        error_message: null,
        updated_at: new Date().toISOString(),
      };

      if (isClientCredentials) {
        insertData.auth_type = "client_credentials";
        insertData.client_id_encrypted = await encryptToken(clientId, encryptionKey);
        insertData.client_secret_encrypted = await encryptToken(clientSecret, encryptionKey);
      } else {
        insertData.auth_type = "api_key";
        insertData.api_key_encrypted = await encryptToken(apiKey, encryptionKey);
      }

      const { error: upsertError } = await supabase
        .from("recruiter_integrations")
        .upsert(insertData, { onConflict: "user_id,provider" });

      if (upsertError) {
        console.error("[integration-api-key] Upsert failed:", upsertError.message);
        return new Response(
          JSON.stringify({ error: "Speichern fehlgeschlagen" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[integration-api-key] Connected ${provider} for user ${user.id}`);

      return new Response(
        JSON.stringify({ success: true, provider, status: "connected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Test Connection ────────────────────────────────────────────

    if (action === "test") {
      // TODO: Implement provider-specific test calls
      // For now, just return success if credentials are provided
      return new Response(
        JSON.stringify({ success: true, message: "Connection test not yet implemented" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[integration-api-key] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
