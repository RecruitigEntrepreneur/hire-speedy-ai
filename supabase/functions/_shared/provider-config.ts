// ─── CRM Provider OAuth Configuration ─────────────────────────────────────────

export interface ProviderOAuthConfig {
  authUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  scopes: string;
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  supportsPKCE: boolean;
  // Some providers return expires_in, others don't
  defaultTokenLifetimeSeconds?: number;
}

export const OAUTH_PROVIDERS: Record<string, ProviderOAuthConfig> = {
  hubspot: {
    authUrl: "https://app.hubspot.com/oauth/authorize",
    tokenUrl: "https://api.hubapi.com/oauth/v1/token",
    scopes: "crm.objects.contacts.read",
    clientIdEnvVar: "HUBSPOT_CLIENT_ID",
    clientSecretEnvVar: "HUBSPOT_CLIENT_SECRET",
    supportsPKCE: false,
    defaultTokenLifetimeSeconds: 1800, // 30 minutes
  },
  salesforce: {
    authUrl: "https://login.salesforce.com/services/oauth2/authorize",
    tokenUrl: "https://login.salesforce.com/services/oauth2/token",
    revokeUrl: "https://login.salesforce.com/services/oauth2/revoke",
    scopes: "api refresh_token",
    clientIdEnvVar: "SALESFORCE_CLIENT_ID",
    clientSecretEnvVar: "SALESFORCE_CLIENT_SECRET",
    supportsPKCE: true,
  },
  lever: {
    authUrl: "https://auth.lever.co/authorize",
    tokenUrl: "https://auth.lever.co/oauth/token",
    scopes: "offline_access contacts:read:admin",
    clientIdEnvVar: "LEVER_CLIENT_ID",
    clientSecretEnvVar: "LEVER_CLIENT_SECRET",
    supportsPKCE: false,
  },
  bullhorn: {
    authUrl: "https://auth.bullhornstaffing.com/oauth/authorize",
    tokenUrl: "https://auth.bullhornstaffing.com/oauth/token",
    scopes: "",
    clientIdEnvVar: "BULLHORN_CLIENT_ID",
    clientSecretEnvVar: "BULLHORN_CLIENT_SECRET",
    supportsPKCE: false,
    defaultTokenLifetimeSeconds: 600, // 10 minutes
  },
};

// Providers that use API key or client credentials (no OAuth redirect)
export const API_KEY_PROVIDERS = ["greenhouse", "jobvite", "icims"];
export const CLIENT_CREDENTIALS_PROVIDERS = ["personio"];

export function isOAuthProvider(provider: string): boolean {
  return provider in OAUTH_PROVIDERS;
}

export function getProviderConfig(provider: string): ProviderOAuthConfig {
  const config = OAUTH_PROVIDERS[provider];
  if (!config) {
    throw new Error(`No OAuth config for provider: ${provider}`);
  }
  return config;
}

export function getRedirectUri(): string {
  return Deno.env.get("OAUTH_REDIRECT_URI") ||
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/oauth-callback`;
}

export function getAppUrl(): string {
  return Deno.env.get("APP_URL") || "http://localhost:8080";
}
