import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProviderConfig, isOAuthProvider, getRedirectUri } from "../_shared/provider-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── PKCE Helpers ─────────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

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

    // Parse request
    const { provider } = await req.json();

    if (!provider || !isOAuthProvider(provider)) {
      return new Response(
        JSON.stringify({ error: `Provider '${provider}' does not support OAuth` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[oauth-connect] User ${user.id} initiating OAuth for ${provider}`);

    const config = getProviderConfig(provider);
    const clientId = Deno.env.get(config.clientIdEnvVar);

    if (!clientId) {
      console.error(`[oauth-connect] Missing env var: ${config.clientIdEnvVar}`);
      return new Response(
        JSON.stringify({ error: `OAuth not configured for ${provider}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Generate state token
    const state = crypto.randomUUID();

    // Store state in DB (10 minute TTL)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const redirectUri = getRedirectUri();

    const { error: stateError } = await supabase
      .from("oauth_states")
      .insert({
        state,
        user_id: user.id,
        provider,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        expires_at: expiresAt,
      });

    if (stateError) {
      console.error("[oauth-connect] Failed to store state:", stateError.message);
      return new Response(
        JSON.stringify({ error: "Failed to initiate OAuth flow" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
    });

    // Add scopes if configured
    if (config.scopes) {
      params.set("scope", config.scopes);
    }

    // Add PKCE challenge if provider supports it
    if (config.supportsPKCE) {
      params.set("code_challenge", codeChallenge);
      params.set("code_challenge_method", "S256");
    }

    const authorizationUrl = `${config.authUrl}?${params.toString()}`;

    console.log(`[oauth-connect] Generated auth URL for ${provider}, state: ${state.substring(0, 8)}...`);

    // Cleanup expired states while we're at it
    await supabase.rpc("cleanup_expired_oauth_states").catch(() => {
      // Non-critical, just log
      console.log("[oauth-connect] Cleanup of expired states skipped");
    });

    return new Response(
      JSON.stringify({ authorization_url: authorizationUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[oauth-connect] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
