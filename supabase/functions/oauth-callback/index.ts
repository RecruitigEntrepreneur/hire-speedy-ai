import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken, getEncryptionKey } from "../_shared/encryption.ts";
import { getProviderConfig, getAppUrl } from "../_shared/provider-config.ts";

// ─── Main Handler ─────────────────────────────────────────────────────────────
// This function receives a browser redirect from the OAuth provider.
// No JWT verification because the browser redirect has no auth header.
// Security is ensured via the state parameter tied to the authenticated user.

serve(async (req) => {
  const url = new URL(req.url);
  const appUrl = getAppUrl();

  // Helper to redirect with error
  const redirectError = (msg: string, provider?: string) => {
    const params = new URLSearchParams({ error: msg });
    if (provider) params.set("provider", provider);
    return Response.redirect(`${appUrl}/recruiter/integrations?${params}`, 302);
  };

  try {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Provider denied access
    if (error) {
      console.log(`[oauth-callback] Provider returned error: ${error}`);
      return redirectError(error === "access_denied" ? "Zugriff verweigert" : error);
    }

    if (!code || !state) {
      console.error("[oauth-callback] Missing code or state parameter");
      return redirectError("Fehlende Parameter");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ─── 1. Validate state ────────────────────────────────────────────

    const { data: oauthState, error: stateError } = await supabase
      .from("oauth_states")
      .select("*")
      .eq("state", state)
      .single();

    if (stateError || !oauthState) {
      console.error("[oauth-callback] Invalid or unknown state:", state);
      return redirectError("Ungueltiger State-Parameter (CSRF-Schutz)");
    }

    // Check expiry
    if (new Date(oauthState.expires_at) < new Date()) {
      console.error("[oauth-callback] State expired:", oauthState.expires_at);
      // Clean up expired state
      await supabase.from("oauth_states").delete().eq("id", oauthState.id);
      return redirectError("Sitzung abgelaufen. Bitte erneut verbinden.", oauthState.provider);
    }

    const { provider, user_id, code_verifier, redirect_uri } = oauthState;

    console.log(`[oauth-callback] Valid state for user ${user_id}, provider ${provider}`);

    // ─── 2. Exchange code for tokens ──────────────────────────────────

    const config = getProviderConfig(provider);
    const clientId = Deno.env.get(config.clientIdEnvVar);
    const clientSecret = Deno.env.get(config.clientSecretEnvVar);

    if (!clientId || !clientSecret) {
      console.error(`[oauth-callback] Missing OAuth credentials for ${provider}`);
      return redirectError("OAuth-Konfiguration fehlt", provider);
    }

    const tokenParams: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect_uri || `${supabaseUrl}/functions/v1/oauth-callback`,
      client_id: clientId,
      client_secret: clientSecret,
    };

    // Add PKCE verifier if provider supports it
    if (config.supportsPKCE && code_verifier) {
      tokenParams.code_verifier = code_verifier;
    }

    console.log(`[oauth-callback] Exchanging code for tokens at ${config.tokenUrl}`);

    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error(`[oauth-callback] Token exchange failed (${tokenResponse.status}):`, errorBody);
      return redirectError("Token-Austausch fehlgeschlagen", provider);
    }

    const tokens = await tokenResponse.json();

    if (!tokens.access_token) {
      console.error("[oauth-callback] No access_token in response:", JSON.stringify(tokens).substring(0, 200));
      return redirectError("Kein Access-Token erhalten", provider);
    }

    console.log(`[oauth-callback] Token exchange successful for ${provider}`);

    // ─── 3. Encrypt tokens ────────────────────────────────────────────

    const encryptionKey = getEncryptionKey();
    const accessTokenEncrypted = await encryptToken(tokens.access_token, encryptionKey);

    let refreshTokenEncrypted: string | null = null;
    if (tokens.refresh_token) {
      refreshTokenEncrypted = await encryptToken(tokens.refresh_token, encryptionKey);
    }

    // Calculate token expiry
    const expiresIn = tokens.expires_in || config.defaultTokenLifetimeSeconds || 3600;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Provider metadata (e.g. Salesforce instance URL)
    const providerMetadata: Record<string, unknown> = {};
    if (tokens.instance_url) {
      providerMetadata.instance_url = tokens.instance_url;
    }
    if (tokens.token_type) {
      providerMetadata.token_type = tokens.token_type;
    }

    // ─── 4. Upsert into recruiter_integrations ───────────────────────

    const { error: upsertError } = await supabase
      .from("recruiter_integrations")
      .upsert(
        {
          user_id,
          provider,
          auth_type: "oauth",
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: refreshTokenEncrypted,
          token_expires_at: tokenExpiresAt,
          provider_metadata: providerMetadata,
          status: "connected",
          error_message: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      );

    if (upsertError) {
      console.error("[oauth-callback] Failed to store integration:", upsertError.message);
      return redirectError("Speichern fehlgeschlagen", provider);
    }

    // ─── 5. Cleanup state ─────────────────────────────────────────────

    await supabase.from("oauth_states").delete().eq("id", oauthState.id);

    console.log(`[oauth-callback] Successfully connected ${provider} for user ${user_id}`);

    // ─── 6. Redirect back to app ──────────────────────────────────────

    return Response.redirect(
      `${appUrl}/recruiter/integrations?connected=${provider}`,
      302
    );
  } catch (error) {
    console.error("[oauth-callback] Unexpected error:", error);
    return redirectError(error instanceof Error ? error.message : "Unerwarteter Fehler");
  }
});
