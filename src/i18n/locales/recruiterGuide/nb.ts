import type de from './de';
import type { Messages } from '../../types';

const nb: Messages<typeof de> = {
  ui: {
    chapter: 'Kapittel {{current}} av {{total}} · {{name}}',
    close: 'Avslutt omvisningen',
    progress: 'Hvor langt du har kommet i omvisningen',
    back: 'Tilbake',
    next: 'Neste',
    example: 'Eksempel',
    titleWithName: '{{title}}, {{name}}',
  },
  texts: {
    yourTurn: 'Din tur: klikk på det markerte området.',
    start: 'Da setter vi i gang',
    skip: 'Hopp over',
    finish: 'Ferdig',
    paused: 'Omvisningen er satt på pause',
    resume: 'Fortsett',
    finalCta: 'Se ledige oppdrag',
  },
  clientTexts: {
    yourTurn: 'Din tur: klikk på det markerte området.',
    start: 'Da setter vi i gang',
    skip: 'Hopp over',
    finish: 'Ferdig',
    paused: 'Omvisningen er satt på pause',
    resume: 'Fortsett',
    finalCta: 'Til oversikten',
  },
  chapters: {
    overview: 'Oversikt',
    jobs: 'Ledige oppdrag',
    briefing: 'Briefing',
    candidates: 'Mine kandidater',
    pipeline: 'Pipeline',
    tasks: 'Oppgaver og intervjuer',
  },
  menu: {
    body: 'Klikk på «{{label}}» i menyen til venstre.',
    narrowBody: 'Trykk på «Åpne {{label}}».',
    open: 'Åpne {{label}}',
    items: {
      jobs: 'Ledige oppdrag',
      candidates: 'Mine kandidater',
      pipeline: 'Pipeline',
      tasks: 'Oppgaver',
      interviews: 'Intervjuer',
    },
  },
  steps: {
    welcome: {
      title: 'Velkommen til Matchunt',
      body: 'Vi går gjennom plattformen sammen én gang. Det tar omtrent tre minutter. Du klikker selv, og vi viser deg hvordan du kommer frem til din første plassering her.',
    },
    cockpit: {
      title: 'Startsiden din',
      body: 'Her begynner du hver dag. Øverst ser du hva som står for tur. Med «Legg til kandidater» tar du når som helst inn nye kandidater.',
    },
    topJobs: {
      title: 'Toppoppdrag',
      body: 'Et utvalg ledige oppdrag. Alle oppdrag, med filtre og sortering, finner du under «Ledige oppdrag».',
    },
    navJobs: { title: 'Videre til oppdragene' },
    filters: {
      title: 'Finn det som passer deg',
      body: 'Søk på stikkord og filtrer på fjernarbeid, nivå eller bransje. Sorter på «Høyest honorar» eller «Lite konkurranse» for å se de beste sjansene først. Fanene «Haster», «Nytt» og «Topp» tar deg raskt til de hotteste oppdragene.',
    },
    card: {
      title: 'Slik leser du et oppdrag',
      body: 'Øverst står rollen og honoraret ditt i euro. Under står selskapet, anonymt som bransje, størrelse og region, samt sted, lønnsspenn og de viktigste ferdighetene. Nederst ser du hvor mange headhuntere som allerede søker og presenterer.',
    },
    activate: {
      title: '«Jeg søker» betyr: jeg er med',
      body: 'Dermed påtar du deg et oppdrag bindende. Det opptar én av plassene dine og kan foreløpig ikke angres. Målet er en første presentasjon innen 14 dager. Si derfor bare ja hvis du har aktuelle kandidater i tankene.',
    },
    openPreview: {
      title: 'Se nærmere etter',
      body: 'Klikk på oppdraget. En forhåndsvisning åpnes til høyre.',
      action: 'Åpne forhåndsvisning',
    },
    preview: {
      title: 'Forhåndsvisningen',
      body: 'Her står de viktigste kravene og nøkkelopplysningene. Du kan foreslå en kandidat herfra så snart du har valgt «Jeg søker».',
    },
    openBriefing: {
      title: 'Til hele briefingen',
      body: 'Klikk på oppdraget én gang til. Da åpnes den fullstendige briefingen.',
      narrowBody: 'Trykk på «Åpne briefing». Da ser du den fullstendige briefingen for oppdraget.',
      action: 'Åpne briefing',
    },
    jobHeader: {
      title: 'Oppdragsbriefingen din',
      body: 'Alt kunden har fortalt i behovsavklaringen, samlet på ett sted. Med det kan du kontakte kandidater målrettet uten å nevne selskapet.',
    },
    jobTabs: {
      title: 'Tre innfallsvinkler',
      body: '«Briefing» for detaljene, «Mine kandidater» for presentasjonene dine til oppdraget og «Fra annonsen» for originalteksten.',
    },
    jobSubmit: {
      title: 'Slik presenterer du noen',
      body: 'Med «Forbered presentasjon» velger du en kandidat, skriver vurderingen din og bekrefter kandidatens samtykke. Etter en kontrollvisning går presentasjonen til kunden, først anonymt.',
    },
    navCandidates: { title: 'Kandidatene dine' },
    candidatesAdd: {
      title: 'Ta inn kandidater',
      body: 'Via «Legg til kandidater» laster du opp en CV, limer inn tekst eller en LinkedIn-profil, eller legger inn kandidater med bare navn og e-post. Deretter står de i listen din, omtrent slik:',
    },
    navPipeline: { title: 'Pipelinen din' },
    pipeline: {
      title: 'Hver presentasjon i ett blikk',
      body: 'Her følger du hver presentasjon gjennom fasene frem til plasseringen. «Åpent honorar» viser hva som ligger i pipelinen din.',
    },
    optin: {
      title: 'Det viktigste øyeblikket: opt-in',
      body: 'Vil kunden møte kandidaten din, står presentasjonen på «Intervju forespurt». Da innhenter du samtykke fra kandidaten. Først etterpå ser du hvilket selskap det gjelder.',
    },
    navTasks: { title: 'Oppgavene dine' },
    tasks: {
      title: 'Det som står for tur nå',
      body: 'Her samler Matchunt de neste stegene dine, sortert etter effekt: innhente opt-in, følge opp, forberede intervjuer. Start helst hver dag her.',
    },
    navInterviews: { title: 'Avtalene dine' },
    interviews: {
      title: 'Kontroll på intervjuene',
      body: 'Alle intervjuene til kandidatene dine: i dag, denne uken og uten tidspunkt ennå. Etter hvert intervju noterer du kort hvordan det gikk (debrief).',
    },
    done: {
      title: 'Klar for din første presentasjon?',
      body: 'Velg et oppdrag der du kommer på en kandidat. Du kan når som helst starte omvisningen på nytt fra startsiden via «Omvisning».',
    },
  },
  examples: {
    job: {
      title: 'Senior Controller',
      fee: '€12.400',
      feeNote: '15 % honorar',
      company: 'Industriselskap · 250–500 ansatte',
      place: 'München · hybrid · 75.000–90.000 €',
      activity: '2 rekrutterere · 1 presentasjon',
      searching: 'Jeg søker',
    },
    submit: {
      step1: 'Velg en kandidat eller legg inn en ny',
      step2: 'Vurderingen din: hvorfor passer personen?',
      step3: 'Bekreft kandidatens samtykke',
      step4: 'Kontroller og send til kunden',
    },
    candidate: {
      initials: 'LM',
      name: 'Laura M.',
      role: 'Senior Controller · 8 års erfaring',
      place: 'München · tilgjengelig fra 1. jan.',
    },
    pipeline: {
      submitted: 'Presentert',
      inReview: 'Til vurdering',
      interviewRequested: 'Intervju forespurt',
      optIn: 'Opt-in gitt',
      scheduled: 'Tidspunkt avtalt',
      interviewed: 'Intervju gjennomført',
      offer: 'Tilbud',
      placed: 'Plassert',
    },
    optin: {
      step1: 'Kunden vil møte Laura M.',
      step2: 'Du spør Laura om hun samtykker.',
      step3: 'Laura sier ja: nå ser du selskapet.',
      step4: 'Dere avtaler tidspunkt for intervjuet.',
    },
    task: {
      pill: 'Opt-in',
      urgent: 'haster',
      title: 'Kunden vil intervjue Laura M.',
      text: 'Senior Controller · Innhent samtykket hennes i dag.',
    },
    interview: {
      when: 'Tor. 14:00 · Laura M.',
      kind: 'Videointervju · tidspunktet er bekreftet',
      after: 'Etterpå: en kort debrief om hvordan det gikk.',
    },
    clientSubmit: {
      title: 'Send inn',
      text: 'Under rammeavtalen deres · Pakke Core 20 % · ingen ny signatur',
      topUp: 'Oppgrader oppdraget',
      submit: 'Send inn oppdraget',
    },
    clientStatus: {
      title: 'Senior Controller',
      state: 'Til vurdering hos Matchunt',
      submitted: 'Sendt inn',
      review: 'Vurdering',
      live: 'Live',
      candidates: 'Kandidater',
    },
    clientCandidate: {
      title: 'PR-3F8A21 · Senior Controller',
      match: '89 %',
      quote: '«8 år med konsernregnskap, SAP S/4HANA, ønsker mer rom til å forme.» (Headhunter)',
      locked: 'Navn og CV etter at personen har samtykket',
      meet: 'Møt',
      decline: 'Avslå',
    },
  },
};

export default nb;
