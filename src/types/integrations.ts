// ─── CRM Integration Types ────────────────────────────────────────────────────

export type IntegrationProvider =
  | 'hubspot'
  | 'salesforce'
  | 'greenhouse'
  | 'lever'
  | 'bullhorn'
  | 'personio'
  | 'workday'
  | 'jobvite'
  | 'icims';

export type AuthType = 'oauth' | 'api_key' | 'client_credentials';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'expired';

export interface ProviderInfo {
  id: IntegrationProvider;
  name: string;
  description: string;
  logo: string;
  authType: AuthType;
  docsUrl?: string;
  comingSoon?: boolean;
}

export interface RecruiterIntegration {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  auth_type: AuthType;
  status: IntegrationStatus;
  error_message: string | null;
  sync_candidates: boolean;
  sync_jobs: boolean;
  last_synced_at: string | null;
  provider_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Provider Registry ────────────────────────────────────────────────────────

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'CRM & Marketing Platform',
    logo: '🟠',
    authType: 'oauth',
    docsUrl: 'https://developers.hubspot.com/',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Enterprise CRM Platform',
    logo: '☁️',
    authType: 'oauth',
    docsUrl: 'https://developer.salesforce.com/',
  },
  {
    id: 'greenhouse',
    name: 'Greenhouse',
    description: 'Recruiting Software',
    logo: '🌱',
    authType: 'api_key',
    docsUrl: 'https://developers.greenhouse.io/',
  },
  {
    id: 'lever',
    name: 'Lever',
    description: 'Talent Acquisition Suite',
    logo: '⚙️',
    authType: 'oauth',
  },
  {
    id: 'bullhorn',
    name: 'Bullhorn',
    description: 'Staffing & Recruiting CRM',
    logo: '📢',
    authType: 'oauth',
    docsUrl: 'https://bullhorn.github.io/rest-api-docs/',
  },
  {
    id: 'personio',
    name: 'Personio',
    description: 'HR Management Platform',
    logo: '👤',
    authType: 'client_credentials',
    docsUrl: 'https://developer.personio.de/',
  },
  {
    id: 'workday',
    name: 'Workday',
    description: 'HR Management Platform',
    logo: '📊',
    authType: 'oauth',
    comingSoon: true,
  },
  {
    id: 'jobvite',
    name: 'Jobvite',
    description: 'Talent Acquisition Platform',
    logo: '💼',
    authType: 'api_key',
    comingSoon: true,
  },
  {
    id: 'icims',
    name: 'iCIMS',
    description: 'Talent Cloud Platform',
    logo: '🎯',
    authType: 'api_key',
    comingSoon: true,
  },
];

export function getProviderInfo(providerId: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === providerId);
}

export function getProviderName(providerId: string): string {
  return getProviderInfo(providerId)?.name || providerId;
}
