import type de from './de';
import type { Messages } from '../../types';

const sv: Messages<typeof de> = {
  ui: {
    chapter: 'Kapitel {{current}} av {{total}} · {{name}}',
    close: 'Avsluta rundturen',
    progress: 'Hur långt du har kommit i rundturen',
    back: 'Tillbaka',
    next: 'Nästa',
    example: 'Exempel',
    titleWithName: '{{title}}, {{name}}',
  },
  texts: {
    yourTurn: 'Din tur: klicka på det markerade området.',
    start: 'Nu kör vi',
    skip: 'Hoppa över',
    finish: 'Klar',
    paused: 'Rundturen är pausad',
    resume: 'Fortsätt',
    finalCta: 'Visa lediga uppdrag',
  },
  clientTexts: {
    yourTurn: 'Din tur: klicka på det markerade området.',
    start: 'Nu kör vi',
    skip: 'Hoppa över',
    finish: 'Klar',
    paused: 'Rundturen är pausad',
    resume: 'Fortsätt',
    finalCta: 'Till översikten',
  },
  chapters: {
    overview: 'Översikt',
    jobs: 'Lediga uppdrag',
    briefing: 'Briefing',
    candidates: 'Mina kandidater',
    pipeline: 'Pipeline',
    tasks: 'Uppgifter & intervjuer',
  },
  menu: {
    body: 'Klicka på ”{{label}}” i menyn till vänster.',
    narrowBody: 'Tryck på ”Öppna {{label}}”.',
    open: 'Öppna {{label}}',
    items: {
      jobs: 'Lediga uppdrag',
      candidates: 'Mina kandidater',
      pipeline: 'Pipeline',
      tasks: 'Uppgifter',
      interviews: 'Intervjuer',
    },
  },
  steps: {
    welcome: {
      title: 'Välkommen till Matchunt',
      body: 'Vi går igenom plattformen tillsammans en gång. Det tar ungefär tre minuter. Du klickar själv, och vi visar hur du når din första tillsättning här.',
    },
    cockpit: {
      title: 'Din startsida',
      body: 'Här börjar du varje dag. Överst ser du vad som är aktuellt just nu. Med ”Lägg till kandidater” tar du när som helst in nya kandidater.',
    },
    topJobs: {
      title: 'Toppuppdrag',
      body: 'Ett urval av lediga uppdrag. Alla uppdrag, med filter och sortering, hittar du under ”Lediga uppdrag”.',
    },
    navJobs: { title: 'Vidare till uppdragen' },
    filters: {
      title: 'Hitta det som passar dig',
      body: 'Sök på nyckelord och filtrera på distans, nivå eller bransch. Sortera på ”Högst arvode” eller ”Liten konkurrens” för att se de bästa chanserna först. Flikarna ”Brådskande”, ”Nytt” och ”Topp” tar dig snabbt till de hetaste uppdragen.',
    },
    card: {
      title: 'Så läser du ett uppdrag',
      body: 'Överst står rollen och ditt arvode i euro. Därunder företaget, anonymt som bransch, storlek och region, samt ort, lönespann och de viktigaste kompetenserna. Längst ner ser du hur många headhunters som redan söker och presenterar.',
    },
    activate: {
      title: '”Jag söker” betyder: jag är med',
      body: 'Därmed tar du dig an ett uppdrag bindande. Det upptar en av dina platser och går för närvarande inte att ångra. Målet är en första presentation inom 14 dagar. Tacka därför bara ja om du har passande kandidater i åtanke.',
    },
    openPreview: {
      title: 'Titta närmare',
      body: 'Klicka på uppdraget. En förhandsvisning öppnas till höger.',
      action: 'Öppna förhandsvisning',
    },
    preview: {
      title: 'Förhandsvisningen',
      body: 'Här står de viktigaste kraven och nyckeluppgifterna. Du kan föreslå en kandidat härifrån så snart du har valt ”Jag söker”.',
    },
    openBriefing: {
      title: 'Till hela briefingen',
      body: 'Klicka på uppdraget en gång till. Då öppnas den fullständiga briefingen.',
      narrowBody: 'Tryck på ”Öppna briefing”. Då ser du den fullständiga briefingen för uppdraget.',
      action: 'Öppna briefing',
    },
    jobHeader: {
      title: 'Din uppdragsbriefing',
      body: 'Allt som kunden har berättat i behovsanalysen, samlat på ett ställe. Med det kan du kontakta kandidater träffsäkert utan att nämna företaget.',
    },
    jobTabs: {
      title: 'Tre perspektiv',
      body: '”Briefing” för detaljerna, ”Mina kandidater” för dina presentationer till uppdraget och ”Från annonsen” för originaltexten.',
    },
    jobSubmit: {
      title: 'Så presenterar du någon',
      body: 'Med ”Förbered presentation” väljer du en kandidat, skriver din bedömning och bekräftar kandidatens samtycke. Efter en granskningsvy går presentationen till kunden, först anonymt.',
    },
    navCandidates: { title: 'Dina kandidater' },
    candidatesAdd: {
      title: 'Ta in kandidater',
      body: 'Via ”Lägg till kandidater” laddar du upp ett CV, klistrar in text eller en LinkedIn-profil eller lägger upp kandidater med bara namn och e-post. Sedan står de i din lista, ungefär så här:',
    },
    navPipeline: { title: 'Din pipeline' },
    pipeline: {
      title: 'Varje presentation i en överblick',
      body: 'Här följer du varje presentation genom faserna fram till tillsättningen. ”Öppet arvode” visar vad som ligger i din pipeline.',
    },
    optin: {
      title: 'Det viktigaste ögonblicket: opt-in',
      body: 'Om kunden vill träffa din kandidat står presentationen på ”Intervju efterfrågad”. Då inhämtar du kandidatens samtycke. Först därefter ser du vilket företag det gäller.',
    },
    navTasks: { title: 'Dina uppgifter' },
    tasks: {
      title: 'Det som är aktuellt nu',
      body: 'Här samlar Matchunt dina nästa steg, sorterade efter effekt: inhämta opt-in, följa upp, förbereda intervjuer. Börja helst varje dag här.',
    },
    navInterviews: { title: 'Dina bokningar' },
    interviews: {
      title: 'Koll på intervjuerna',
      body: 'Alla dina kandidaters intervjuer: i dag, den här veckan och ännu utan tid. Efter varje intervju noterar du kort hur det gick (debrief).',
    },
    done: {
      title: 'Redo för din första presentation?',
      body: 'Välj ett uppdrag där du kommer att tänka på en kandidat. Du kan när som helst starta om rundturen på startsidan via ”Rundtur”.',
    },
  },
  examples: {
    job: {
      title: 'Senior Controller',
      fee: '€12.400',
      feeNote: '15 % arvode',
      company: 'Industriföretag · 250–500 anställda',
      place: 'München · hybrid · 75.000–90.000 €',
      activity: '2 rekryterare · 1 presentation',
      searching: 'Jag söker',
    },
    submit: {
      step1: 'Välj en kandidat eller lägg upp en ny',
      step2: 'Din bedömning: varför passar personen?',
      step3: 'Bekräfta kandidatens samtycke',
      step4: 'Granska och skicka till kunden',
    },
    candidate: {
      initials: 'LM',
      name: 'Laura M.',
      role: 'Senior Controller · 8 års erfarenhet',
      place: 'München · tillgänglig från 1 jan.',
    },
    pipeline: {
      submitted: 'Presenterad',
      inReview: 'Granskas',
      interviewRequested: 'Intervju efterfrågad',
      optIn: 'Opt-in lämnad',
      scheduled: 'Tid bokad',
      interviewed: 'Intervju genomförd',
      offer: 'Erbjudande',
      placed: 'Tillsatt',
    },
    optin: {
      step1: 'Kunden vill träffa Laura M.',
      step2: 'Du frågar Laura om hon samtycker.',
      step3: 'Laura säger ja: nu ser du företaget.',
      step4: 'Ni kommer överens om en intervjutid.',
    },
    task: {
      pill: 'Opt-in',
      urgent: 'brådskande',
      title: 'Kunden vill intervjua Laura M.',
      text: 'Senior Controller · Inhämta hennes samtycke i dag.',
    },
    interview: {
      when: 'Tors 14:00 · Laura M.',
      kind: 'Videointervju · tiden bekräftad',
      after: 'Därefter: en kort debrief om hur det gick.',
    },
    clientSubmit: {
      title: 'Skicka in',
      text: 'Under ert ramavtal · Paket Core 20 % · ingen ny underskrift',
      topUp: 'Uppgradera uppdraget',
      submit: 'Skicka in uppdraget',
    },
    clientStatus: {
      title: 'Senior Controller',
      state: 'Granskas av Matchunt',
      submitted: 'Inskickat',
      review: 'Granskning',
      live: 'Live',
      candidates: 'Kandidater',
    },
    clientCandidate: {
      title: 'PR-3F8A21 · Senior Controller',
      match: '89 %',
      quote: '”8 år med koncernbokslut, SAP S/4HANA, söker större möjlighet att påverka.” (Headhunter)',
      locked: 'Namn och CV efter personens samtycke',
      meet: 'Träffa',
      decline: 'Tacka nej',
    },
  },
};

export default sv;
