import type de from './de';
import type { Messages } from '../../types';

// Norsk (bokmål). Tiltale: du.
const nb: Messages<typeof de> = {
  chapters: {
    welcome: 'Velkommen',
    create: 'Opprett en stilling',
    after: 'Etter innsending',
    candidates: 'Kandidater og team',
  },
  steps: {
    'c-welcome': {
      title: 'Velkommen til Matchunt',
      body: 'På noen minutter viser vi deg hvordan du gir en stilling til headhunterne våre og får kandidater som passer. Samtidig oppretter du din første stilling. Du klikker, vi forklarer.',
    },
    'c-entry': {
      title: 'Her starter hver stilling',
      body: '«Legg til stilling» er den viktigste knappen. Påbegynte stillinger finner du senere her under «Fortsett».',
    },
    'c-decide': {
      title: 'Dette venter på deg',
      body: '«Trenger beslutning» viser kandidater og avtaler der det er din tur. Jo raskere du svarer, desto bedre er sjansene.',
    },
    'c-start': {
      title: 'Nå oppretter vi din første stilling',
      body: 'Lim inn stillingsannonsen og klikk på «Bygg profil». Ingen annonse for hånden? Velg da «Beskriv selv».',
      narrowBody: 'Trykk på «Legg til stilling».',
      action: 'Legg til stilling',
    },
    'c-kind': {
      title: 'Fast ansettelse eller konsulentoppdrag?',
      body: 'Det avgjør hva vi spør om og hva som står i avtalen. Velg riktig type.',
      action: 'Neste',
    },
    'c-ways': {
      title: 'Raskeste vei: annonsen din',
      body: 'Lim inn annonsen, en lenke eller en PDF: vi bygger profilen, du kontrollerer bare. Uten annonse beskriver du stillingen selv.',
      action: 'Neste',
    },
    'c-profile': {
      title: 'Kontroller i stedet for å skrive',
      body: 'Profilen din er klar. Alt fra annonsen er merket «fra annonsen»: «✓ stemmer» bekrefter, ellers endrer du bare. «Bekreft alle» godtar alt på én gang.',
      wait: 'Omvisningen venter til profilen din er klar.',
    },
    'c-criteria': {
      title: 'Den viktigste opplysningen',
      body: 'Vurder hvert krav: absolutt nødvendig, kan forhandles eller kan læres. Headhunterne måler hver kandidat mot dette.',
    },
    'c-briefing': {
      title: 'Briefen: det som ikke står i noen annonse',
      body: 'Åtte spørsmål fra ekte rekrutteringssamtaler, for eksempel hvorfor stillingen er ledig og hvem som lykkes hos dere. Nettopp dette gjør headhuntenes henvendelse overbevisende.',
    },
    'c-save': {
      title: 'Ingenting går tapt',
      body: 'Alt lagres fortløpende. Med «Senere» fortsetter du når som helst under «Fortsett». «Neste» fører til innsending når brief og krav er på plass.',
    },
    'c-submit': {
      title: 'Fyll ut i ro og mak',
      body: 'Svar på spørsmålene nå og send inn når du er klar. Omvisningen venter så lenge og fortsetter deretter under «Mine jobber».',
    },
    'c-jobs': {
      title: 'Hvor står stillingen min?',
      body: 'Under «Mine jobber» ser du hver stilling med status: Sendt inn → Gjennomgang hos Matchunt (vanligvis under 24 t) → Live → Første kandidater. Utkast ligger under «Utkast».',
      hold: 'Omvisningen fortsetter så snart du har sendt inn eller valgt «Senere».',
    },
    'c-navCandidates': {
      title: 'Kandidatene dine',
      body: 'Klikk på «Søkere» i menyen til venstre.',
      narrowBody: 'Trykk på «Åpne søkere».',
      action: 'Åpne søkere',
    },
    'c-candidates': {
      title: 'Kandidatene kommer anonymt',
      body: 'Først ser du en anonym profil med headhunterens vurdering. Vil du møte noen, spør headhunteren personen. Deretter ser du navn og CV.',
    },
    'c-navTeam': {
      title: 'Teamet ditt',
      body: 'Klikk på «Team» i menyen til venstre.',
      narrowBody: 'Trykk på «Åpne team».',
      action: 'Åpne team',
    },
    'c-team': {
      title: 'Ta med teamet ditt',
      body: 'Inviter kolleger: HR sender inn stillinger, fagavdelingen gir tilbakemelding på kandidater.',
    },
    'c-done': {
      title: 'Ferdig',
      body: 'Nå kjenner du de viktigste veiene. Omvisningen starter du på nytt når som helst via «Omvisning» på oversikten.',
    },
  },
};

export default nb;
