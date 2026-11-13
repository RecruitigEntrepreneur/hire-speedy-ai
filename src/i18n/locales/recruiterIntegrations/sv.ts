import type de from './de';
import type { Messages } from '../../types';

const sv: Messages<typeof de> = {
  title: 'Integrationer',
  subtitle: 'Anslut dina CRM- och ATS-system med ett klick',
  mail: {
    title: 'E-postbaserat intervjusystem aktivt',
    text: 'Kandidater får automatiskt intervjuinbjudningar via e-post med kalenderbilaga (.ics). När en tid bekräftas meddelas alla berörda automatiskt.',
    branded: 'Inbjudningar med varumärke',
    ical: 'iCal-bilagor',
    auto: 'Automatiska aviseringar',
  },
  connected: {
    title: 'Anslutna integrationer',
    expired: 'Utgången',
    error: 'Fel',
    ok: 'Ansluten',
    lastSynced: 'Senast synkroniserad {{when}}',
    never: 'Inte synkroniserad än',
    reconnect: 'Anslut igen',
    disconnect: 'Koppla från',
  },
  available: {
    title: 'Tillgängliga integrationer',
    text: 'Anslut ditt CRM- eller ATS-system – klicka en gång, logga in, klart',
    soon: 'Snart',
  },
  sync: {
    title: 'Automatisk synkronisering',
    text: 'Ställ in hur ofta dina anslutna tjänster ska synkroniseras',
    enable: 'Aktivera automatisk synk',
    enableText: 'Kandidater synkroniseras automatiskt var 15:e minut',
    notify: 'Aviseringar vid synk',
    notifyText: 'Få en avisering när nya kandidater importeras',
  },
  api: {
    title: 'API-åtkomst',
    text: 'För utvecklare: integrera egna verktyg via vårt REST-API',
    docs: 'Öppna API-dokumentationen',
  },
  dialog: {
    title: 'Anslut {{name}}',
    credentials: 'Ange dina klientuppgifter',
    apiKey: 'Ange din API-nyckel för att upprätta anslutningen',
    clientIdPlaceholder: 'Ditt klient-ID...',
    clientSecretPlaceholder: 'Din klienthemlighet...',
    apiKeyPlaceholder: 'Din API-nyckel...',
    docs: 'Öppna dokumentationen',
    cancel: 'Avbryt',
    connecting: 'Ansluter...',
    connect: 'Anslut',
  },
  toast: {
    connected: '{{name}} har anslutits!',
    failedWith: 'Anslutningen till {{name}} misslyckades: {{error}}',
    oauthMissing: 'OAuth för {{name}} är inte konfigurerat än. Edge-funktionen måste driftsättas först.',
    failedRetry: 'Anslutningen till {{name}} misslyckades. Försök igen.',
    failed: 'Anslutningen till {{name}} misslyckades',
    apiKeyMissing: 'Edge-funktionen för API-nyckelanslutning är inte driftsatt än.',
    credentialsMissing: 'Edge-funktionen för anslutning med klientuppgifter är inte driftsatt än.',
    disconnectMissing: 'Edge-funktionen för frånkoppling är inte driftsatt än.',
    disconnected: '{{name}} har kopplats från',
    disconnectFailed: 'Integrationen kunde inte kopplas från',
  },
};
export default sv;
