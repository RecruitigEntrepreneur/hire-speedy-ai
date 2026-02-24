// ─── On-Demand Token Refresh ──────────────────────────────────────────────────
// Check if a token is near-expiry and refresh it automatically

import { encryptToken, decryptToken, getEncryptionKey } from "./encryption.ts";
import { getProviderConfig } from "./provider-config.ts";

interface SupabaseClient {
  from: (table: string) => any;
}

interface IntegrationRow {
  id: string;
  provider: string;
  auth_type: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  api_key_encrypted: string | null;
}

/**
 * Get a valid access token for the given integration.
 * If the token is near-expiry (< 5 min), refresh it first.
 * Returns the decrypted access token ready for API use.
 */
export async function getValidToken(
  supabase: SupabaseClient,
  integration: IntegrationRow
): Promise<string> {
  const encryptionKey = getEncryptionKey();

  // API key integrations: just decrypt and return
  if (integration.auth_type === "api_key" && integration.api_key_encrypted) {
    return decryptToken(integration.api_key_encrypted, encryptionKey);
  }

  if (!integration.access_token_encrypted) {
    throw new Error("No access token stored for this integration");
  }

  // Check if token needs refresh
  const now = new Date();
  const expiresAt = integration.token_expires_at
    ? new Date(integration.token_expires_at)
    : null;
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (!expiresAt || expiresAt > fiveMinutesFromNow) {
    // Token is still valid
    return decryptToken(integration.access_token_encrypted, encryptionKey);
  }

  // Token needs refresh
  console.log(
    `[token-refresh] Token for ${integration.provider} expires at ${expiresAt.toISOString()}, refreshing...`
  );

  if (!integration.refresh_token_encrypted) {
    // No refresh token available - mark as expired
    await supabase
      .from("recruiter_integrations")
      .update({ status: "expired", error_message: "Token expired, no refresh token" })
      .eq("id", integration.id);
    throw new Error("Token expired and no refresh token available. Please reconnect.");
  }

  const refreshToken = await decryptToken(
    integration.refresh_token_encrypted,
    encryptionKey
  );
  const providerConfig = getProviderConfig(integration.provider);

  const clientId = Deno.env.get(providerConfig.clientIdEnvVar);
  const clientSecret = Deno.env.get(providerConfig.clientSecretEnvVar);

  if (!clientId || !clientSecret) {
    throw new Error(
      `Missing OAuth credentials for ${integration.provider}. Set ${providerConfig.clientIdEnvVar} and ${providerConfig.clientSecretEnvVar}.`
    );
  }

  const response = await fetch(providerConfig.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `[token-refresh] Failed to refresh token for ${integration.provider}:`,
      errorText
    );

    // Mark integration as error
    await supabase
      .from("recruiter_integrations")
      .update({
        status: "error",
        error_message: `Token refresh failed: ${response.status}`,
      })
      .eq("id", integration.id);

    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const tokens = await response.json();

  // Calculate expiry
  const expiresIn =
    tokens.expires_in || providerConfig.defaultTokenLifetimeSeconds || 3600;
  const newExpiresAt = new Date(
    Date.now() + expiresIn * 1000
  ).toISOString();

  // Encrypt and store new tokens
  const newAccessTokenEncrypted = await encryptToken(
    tokens.access_token,
    encryptionKey
  );

  const updateData: Record<string, unknown> = {
    access_token_encrypted: newAccessTokenEncrypted,
    token_expires_at: newExpiresAt,
    status: "connected",
    error_message: null,
    updated_at: new Date().toISOString(),
  };

  // Some providers rotate refresh tokens
  if (tokens.refresh_token) {
    updateData.refresh_token_encrypted = await encryptToken(
      tokens.refresh_token,
      encryptionKey
    );
  }

  await supabase
    .from("recruiter_integrations")
    .update(updateData)
    .eq("id", integration.id);

  console.log(
    `[token-refresh] Successfully refreshed token for ${integration.provider}, expires at ${newExpiresAt}`
  );

  return tokens.access_token;
}
