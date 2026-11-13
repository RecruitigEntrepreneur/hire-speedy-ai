import type de from './de';
import type { Messages } from '../../types';

// Svenska. Tilltal: du.
const sv: Messages<typeof de> = {
  chapters: {
    welcome: 'Välkommen',
    create: 'Skapa en tjänst',
    after: 'Efter inskicket',
    candidates: 'Kandidater & team',
  },
  steps: {
    'c-welcome': {
      title: 'Välkommen till Matchunt',
      body: 'På några minuter visar vi hur du lämnar en tjänst till våra headhunters och får matchande kandidater. Samtidigt skapar du din första tjänst. Du klickar, vi förklarar.',
    },
    'c-entry': {
      title: 'Här börjar varje tjänst',
      body: '”Lägg till tjänst” är den viktigaste knappen. Påbörjade tjänster hittar du senare här under ”Fortsätt”.',
    },
    'c-decide': {
      title: 'Det här väntar på dig',
      body: '”Behöver beslut” visar kandidater och tider där det är din tur. Ju snabbare du svarar, desto bättre chanser.',
    },
    'c-start': {
      title: 'Nu skapar vi din första tjänst',
      body: 'Klistra in din jobbannons och klicka på ”Bygg profil”. Ingen annons till hands? Välj då ”Beskriv själv”.',
      narrowBody: 'Tryck på ”Lägg till tjänst”.',
      action: 'Lägg till tjänst',
    },
    'c-kind': {
      title: 'Fast anställning eller konsultuppdrag?',
      body: 'Det styr vad vi frågar och vad som står i avtalet. Välj rätt typ.',
      action: 'Fortsätt',
    },
    'c-ways': {
      title: 'Snabbaste vägen: din annons',
      body: 'Klistra in annonsen, en länk eller en PDF: vi bygger profilen, du granskar bara. Utan annons beskriver du tjänsten själv.',
      action: 'Fortsätt',
    },
    'c-profile': {
      title: 'Granska i stället för att skriva',
      body: 'Din profil är klar. Allt från din annons är märkt ”från annonsen”: ”✓ stämmer” bekräftar, annars ändrar du bara. ”Bekräfta alla” godkänner allt på en gång.',
      wait: 'Rundturen väntar tills din profil är klar.',
    },
    'c-criteria': {
      title: 'Den viktigaste uppgiften',
      body: 'Klassa varje krav: oumbärligt, förhandlingsbart eller går att lära sig. Mot detta mäter headhunterna varje kandidat.',
    },
    'c-briefing': {
      title: 'Briefingen: det som inte står i någon annons',
      body: 'Åtta frågor från riktiga rekryteringssamtal, till exempel varför tjänsten är ledig och vem som lyckas hos er. Just det gör headhuntrarnas kontakt övertygande.',
    },
    'c-save': {
      title: 'Inget går förlorat',
      body: 'Allt sparas löpande. Med ”Senare” fortsätter du när som helst under ”Fortsätt”. ”Nästa” leder till inskicket när briefing och krav är klara.',
    },
    'c-submit': {
      title: 'Fyll i i lugn och ro',
      body: 'Besvara frågorna nu och skicka in när du är redo. Rundturen väntar så länge och fortsätter sedan under ”Mina jobb”.',
    },
    'c-jobs': {
      title: 'Var står min tjänst?',
      body: 'Under ”Mina jobb” ser du varje tjänst med sin status: Inskickad → Granskning av Matchunt (oftast under 24 tim.) → Live → Första kandidaterna. Utkast finns under ”Utkast”.',
      hold: 'Rundturen fortsätter så snart du har skickat in eller valt ”Senare”.',
    },
    'c-navCandidates': {
      title: 'Dina kandidater',
      body: 'Klicka på ”Sökande” i menyn till vänster.',
      narrowBody: 'Tryck på ”Öppna sökande”.',
      action: 'Öppna sökande',
    },
    'c-candidates': {
      title: 'Kandidaterna kommer anonymt',
      body: 'Först ser du en anonym profil med headhunterns bedömning. Vill du träffa någon frågar headhuntern personen. Därefter ser du namn och CV.',
    },
    'c-navTeam': {
      title: 'Ditt team',
      body: 'Klicka på ”Team” i menyn till vänster.',
      narrowBody: 'Tryck på ”Öppna team”.',
      action: 'Öppna team',
    },
    'c-team': {
      title: 'Ta med ditt team',
      body: 'Bjud in kollegor: HR skickar in tjänster, verksamheten ger återkoppling på kandidater.',
    },
    'c-done': {
      title: 'Klart',
      body: 'Nu känner du till de viktigaste vägarna. Rundturen startar du om när som helst via ”Rundtur” på översikten.',
    },
  },
};

export default sv;
