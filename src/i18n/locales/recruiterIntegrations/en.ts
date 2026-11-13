import type de from './de';
import type { Messages } from '../../types';

const en: Messages<typeof de> = {
  title: 'Integrations',
  subtitle: 'Connect your CRM and ATS systems with one click',
  mail: {
    title: 'Email-based interview system active',
    text: 'Candidates automatically receive interview invitations by email with a calendar attachment (.ics). When an appointment is confirmed, everyone involved is notified automatically.',
    branded: 'Branded invitations',
    ical: 'iCal attachments',
    auto: 'Automatic notifications',
  },
  connected: {
    title: 'Connected integrations',
    expired: 'Expired',
    error: 'Error',
    ok: 'Connected',
    lastSynced: 'Last synchronised {{when}}',
    never: 'Not synchronised yet',
    reconnect: 'Reconnect',
    disconnect: 'Disconnect',
  },
  available: {
    title: 'Available integrations',
    text: 'Connect your CRM or ATS system – click once, log in, done',
    soon: 'Soon',
  },
  sync: {
    title: 'Automatic synchronisation',
    text: 'Configure how often your connected services should be synchronised',
    enable: 'Enable auto-sync',
    enableText: 'Candidates are synchronised automatically every 15 minutes',
    notify: 'Notifications on sync',
    notifyText: 'Get a notification when new candidates are imported',
  },
  api: {
    title: 'API access',
    text: 'For developers: integrate your own tools via our REST API',
    docs: 'Open API documentation',
  },
  dialog: {
    title: 'Connect {{name}}',
    credentials: 'Enter your client credentials',
    apiKey: 'Enter your API key to establish the connection',
    clientIdPlaceholder: 'Your client ID...',
    clientSecretPlaceholder: 'Your client secret...',
    apiKeyPlaceholder: 'Your API key...',
    docs: 'Open documentation',
    cancel: 'Cancel',
    connecting: 'Connecting...',
    connect: 'Connect',
  },
  toast: {
    connected: '{{name}} connected successfully!',
    failedWith: 'Connection to {{name}} failed: {{error}}',
    oauthMissing: 'OAuth for {{name}} is not configured yet. The edge function has to be deployed first.',
    failedRetry: 'Connection to {{name}} failed. Please try again.',
    failed: 'Connection to {{name}} failed',
    apiKeyMissing: 'The edge function for API key connections is not deployed yet.',
    credentialsMissing: 'The edge function for credentials connections is not deployed yet.',
    disconnectMissing: 'The edge function for disconnecting is not deployed yet.',
    disconnected: '{{name}} disconnected',
    disconnectFailed: 'The integration could not be disconnected',
  },
};
export default en;
