import type de from './de';
import type { Messages } from '../../types';

const nb: Messages<typeof de> = {
  title: 'Integrasjoner',
  subtitle: 'Koble til CRM- og ATS-systemene dine med ett klikk',
  mail: {
    title: 'E-postbasert intervjusystem aktivt',
    text: 'Kandidater får automatisk intervjuinvitasjoner på e-post med kalendervedlegg (.ics). Når en avtale bekreftes, varsles alle involverte automatisk.',
    branded: 'Invitasjoner med merkevare',
    ical: 'iCal-vedlegg',
    auto: 'Automatiske varsler',
  },
  connected: {
    title: 'Tilkoblede integrasjoner',
    expired: 'Utløpt',
    error: 'Feil',
    ok: 'Tilkoblet',
    lastSynced: 'Sist synkronisert {{when}}',
    never: 'Ikke synkronisert ennå',
    reconnect: 'Koble til på nytt',
    disconnect: 'Koble fra',
  },
  available: {
    title: 'Tilgjengelige integrasjoner',
    text: 'Koble til CRM- eller ATS-systemet ditt – klikk én gang, logg inn, ferdig',
    soon: 'Snart',
  },
  sync: {
    title: 'Automatisk synkronisering',
    text: 'Konfigurer hvor ofte de tilkoblede tjenestene dine skal synkroniseres',
    enable: 'Aktiver automatisk synk',
    enableText: 'Kandidater synkroniseres automatisk hvert 15. minutt',
    notify: 'Varsler ved synk',
    notifyText: 'Få et varsel når nye kandidater importeres',
  },
  api: {
    title: 'API-tilgang',
    text: 'For utviklere: integrer egne verktøy via REST-API-et vårt',
    docs: 'Åpne API-dokumentasjonen',
  },
  dialog: {
    title: 'Koble til {{name}}',
    credentials: 'Skriv inn klientopplysningene dine',
    apiKey: 'Skriv inn API-nøkkelen din for å opprette tilkoblingen',
    clientIdPlaceholder: 'Din klient-ID...',
    clientSecretPlaceholder: 'Din klienthemmelighet...',
    apiKeyPlaceholder: 'Din API-nøkkel...',
    docs: 'Åpne dokumentasjonen',
    cancel: 'Avbryt',
    connecting: 'Kobler til...',
    connect: 'Koble til',
  },
  toast: {
    connected: '{{name}} er koblet til!',
    failedWith: 'Tilkoblingen til {{name}} mislyktes: {{error}}',
    oauthMissing: 'OAuth for {{name}} er ikke konfigurert ennå. Edge-funksjonen må rulles ut først.',
    failedRetry: 'Tilkoblingen til {{name}} mislyktes. Prøv igjen.',
    failed: 'Tilkoblingen til {{name}} mislyktes',
    apiKeyMissing: 'Edge-funksjonen for API-nøkkeltilkobling er ikke rullet ut ennå.',
    credentialsMissing: 'Edge-funksjonen for tilkobling med klientopplysninger er ikke rullet ut ennå.',
    disconnectMissing: 'Edge-funksjonen for frakobling er ikke rullet ut ennå.',
    disconnected: '{{name}} er koblet fra',
    disconnectFailed: 'Integrasjonen kunne ikke kobles fra',
  },
};
export default nb;
