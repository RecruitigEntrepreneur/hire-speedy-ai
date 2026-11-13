// Begleiteter Rundgang: Schritte für Headhunter (du), gemeinsame Oberfläche und Beispiele.
// `clientTexts` und die Beispiele `client*` gehören zum Kunden-Rundgang (Sie). Deutsch ist die Quelle.
const de = {
  ui: {
    chapter: 'Kapitel {{current}} von {{total}} · {{name}}',
    close: 'Rundgang beenden',
    progress: 'Fortschritt im Rundgang',
    back: 'Zurück',
    next: 'Weiter',
    example: 'Beispiel',
    titleWithName: '{{title}}, {{name}}',
  },
  texts: {
    yourTurn: 'Du bist dran: Klick auf die markierte Stelle.',
    start: "Los geht's",
    skip: 'Überspringen',
    finish: 'Fertig',
    paused: 'Rundgang pausiert',
    resume: 'Fortsetzen',
    finalCta: 'Offene Jobs ansehen',
  },
  clientTexts: {
    yourTurn: 'Sie sind dran: Klicken Sie auf die markierte Stelle.',
    start: "Los geht's",
    skip: 'Überspringen',
    finish: 'Fertig',
    paused: 'Rundgang pausiert',
    resume: 'Fortsetzen',
    finalCta: 'Zum Dashboard',
  },
  chapters: {
    overview: 'Übersicht',
    jobs: 'Offene Jobs',
    briefing: 'Briefing',
    candidates: 'Meine Kandidaten',
    pipeline: 'Pipeline',
    tasks: 'Aufgaben & Interviews',
  },
  menu: {
    body: 'Klick links im Menü auf „{{label}}“.',
    narrowBody: 'Tipp auf „{{label}} öffnen“.',
    open: '{{label}} öffnen',
    items: {
      jobs: 'Offene Jobs',
      candidates: 'Meine Kandidaten',
      pipeline: 'Pipeline',
      tasks: 'Aufgaben',
      interviews: 'Interviews',
    },
  },
  steps: {
    welcome: {
      title: 'Willkommen bei Matchunt',
      body: 'Wir gehen einmal gemeinsam durch die Plattform. Das dauert etwa drei Minuten. Du klickst selbst, und wir zeigen dir, wie du hier zu deiner ersten Besetzung kommst.',
    },
    cockpit: {
      title: 'Dein Cockpit',
      body: 'Hier startest du jeden Tag. Oben siehst du, was gerade ansteht. Mit „Kandidaten anlegen“ nimmst du jederzeit neue Kandidaten auf.',
    },
    topJobs: {
      title: 'Top Jobs',
      body: 'Eine Auswahl offener Positionen. Alle Positionen, mit Filtern und Sortierung, findest du unter „Offene Jobs“.',
    },
    navJobs: { title: 'Auf zu den Positionen' },
    filters: {
      title: 'Finden, was zu dir passt',
      body: 'Such nach Stichworten und filtere nach Remote, Level oder Branche. Sortier nach „Höchste Fee“ oder „Wenig Konkurrenz“, um die besten Chancen zuerst zu sehen. Die Reiter „Dringend“, „Neu“ und „Top“ bringen dich schnell zu den heißesten Positionen.',
    },
    card: {
      title: 'So liest du eine Position',
      body: 'Oben stehen die Rolle und deine Fee in Euro. Darunter die Firma, anonym als Branche, Größe und Region, dazu Ort, Gehaltsband und die wichtigsten Skills. Unten siehst du, wie viele Headhunter schon suchen und einreichen.',
    },
    activate: {
      title: '„Ich suche“ heißt: Ich bin dabei',
      body: 'Damit übernimmst du eine Position verbindlich. Das belegt einen deiner Slots und lässt sich derzeit nicht zurücknehmen. Ziel ist die erste Einreichung innerhalb von 14 Tagen. Sag deshalb nur zu, wenn du passende Kandidaten im Kopf hast.',
    },
    openPreview: {
      title: 'Schau genauer hin',
      body: 'Klick auf die Position. Rechts öffnet sich eine Vorschau.',
      action: 'Vorschau öffnen',
    },
    preview: {
      title: 'Die Vorschau',
      body: 'Hier stehen die wichtigsten Anforderungen und Eckdaten. Einen Kandidaten vorschlagen kannst du von hier aus, sobald du „Ich suche“ gewählt hast.',
    },
    openBriefing: {
      title: 'Zum ganzen Briefing',
      body: 'Klick noch einmal auf die Position. Dann öffnet sich das vollständige Briefing.',
      narrowBody: 'Tipp auf „Briefing öffnen“. Dann siehst du das vollständige Briefing zu dieser Position.',
      action: 'Briefing öffnen',
    },
    jobHeader: {
      title: 'Dein Mandatsbriefing',
      body: 'Alles, was der Kunde in der Aufnahme gesagt hat, an einem Ort. Damit sprichst du Kandidaten gezielt an, ohne die Firma zu nennen.',
    },
    jobTabs: {
      title: 'Drei Blickwinkel',
      body: '„Briefing“ für die Details, „Meine Kandidaten“ für deine Vorstellungen zu dieser Position und „Aus der Anzeige“ für den Originaltext.',
    },
    jobSubmit: {
      title: 'So stellst du jemanden vor',
      body: 'Mit „Vorstellung vorbereiten“ wählst du einen Kandidaten, schreibst deine Einschätzung und bestätigst seine Einwilligung. Nach einer Prüfansicht geht die Vorstellung an den Kunden, zunächst anonym.',
    },
    navCandidates: { title: 'Deine Kandidaten' },
    candidatesAdd: {
      title: 'Kandidaten aufnehmen',
      body: 'Über „Kandidaten anlegen“ lädst du einen Lebenslauf hoch, fügst Text oder ein LinkedIn-Profil ein oder legst Kandidaten nur mit Name und E-Mail an. Danach stehen sie in deiner Liste, etwa so:',
    },
    navPipeline: { title: 'Deine Pipeline' },
    pipeline: {
      title: 'Jede Vorstellung auf einen Blick',
      body: 'Hier verfolgst du jede Vorstellung durch die Phasen bis zur Vermittlung. „Offenes Honorar“ zeigt dir, was in deiner Pipeline steckt.',
    },
    optin: {
      title: 'Der wichtigste Moment: das Opt-In',
      body: 'Will der Kunde deinen Kandidaten kennenlernen, steht die Vorstellung auf „Interview angefragt“. Dann holst du die Zustimmung deines Kandidaten ein. Erst danach siehst du, um welche Firma es geht.',
    },
    navTasks: { title: 'Deine Aufgaben' },
    tasks: {
      title: 'Was jetzt dran ist',
      body: 'Hier sammelt Matchunt deine nächsten Schritte, sortiert nach Wirkung: Opt-In einholen, nachfassen, Interviews vorbereiten. Am besten startest du jeden Tag hier.',
    },
    navInterviews: { title: 'Deine Termine' },
    interviews: {
      title: 'Interviews im Griff',
      body: 'Alle Termine deiner Kandidaten: heute, diese Woche und noch ohne Termin. Nach jedem Interview hältst du kurz fest, wie es gelaufen ist (Debrief).',
    },
    done: {
      title: 'Bereit für deine erste Vorstellung?',
      body: 'Such dir eine Position, zu der dir ein Kandidat einfällt. Den Rundgang kannst du jederzeit im Dashboard über „Rundgang“ neu starten.',
    },
  },
  examples: {
    job: {
      title: 'Senior Controller (m/w/d)',
      fee: '€12.400',
      feeNote: '15 % Fee',
      company: 'Industrieunternehmen · 250–500 MA',
      place: 'München · hybrid · 75.000–90.000 €',
      activity: '2 Recruiter · 1 Einreichung',
      searching: 'Ich suche',
    },
    submit: {
      step1: 'Kandidat wählen oder neu anlegen',
      step2: 'Deine Einschätzung: warum passt er?',
      step3: 'Einwilligung des Kandidaten bestätigen',
      step4: 'Prüfen und an den Kunden senden',
    },
    candidate: {
      initials: 'LM',
      name: 'Laura M.',
      role: 'Senior Controllerin · 8 Jahre Erfahrung',
      place: 'München · verfügbar ab 01.01.',
    },
    pipeline: {
      submitted: 'Eingereicht',
      inReview: 'In Prüfung',
      interviewRequested: 'Interview angefragt',
      optIn: 'Opt-In erteilt',
      scheduled: 'Termin steht',
      interviewed: 'Interview geführt',
      offer: 'Angebot',
      placed: 'Vermittelt',
    },
    optin: {
      step1: 'Der Kunde möchte Laura M. kennenlernen.',
      step2: 'Du fragst Laura, ob sie einverstanden ist.',
      step3: 'Laura sagt Ja: Jetzt siehst du die Firma.',
      step4: 'Ihr stimmt den Interviewtermin ab.',
    },
    task: {
      pill: 'Opt-In',
      urgent: 'dringend',
      title: 'Kunde möchte Laura M. interviewen',
      text: 'Senior Controller (m/w/d) · Hol heute ihre Zustimmung ein.',
    },
    interview: {
      when: 'Do, 14:00 · Laura M.',
      kind: 'Video-Interview · Termin bestätigt',
      after: 'Danach: kurzer Debrief, wie es gelaufen ist.',
    },
    clientSubmit: {
      title: 'Einreichen',
      text: 'Unter Ihrem Rahmenvertrag · Paket Core 20 % · keine neue Unterschrift',
      topUp: 'Diese Position aufstocken',
      submit: 'Position einreichen',
    },
    clientStatus: {
      title: 'Senior Controller (m/w/d)',
      state: 'In Prüfung bei Matchunt',
      submitted: 'Eingereicht',
      review: 'Prüfung',
      live: 'Live',
      candidates: 'Kandidaten',
    },
    clientCandidate: {
      title: 'PR-3F8A21 · Senior Controller',
      match: '89 %',
      quote: '„8 Jahre Konzernabschluss, SAP S/4HANA, sucht mehr Gestaltung.“ (Headhunter)',
      locked: 'Name und Lebenslauf nach Zustimmung der Person',
      meet: 'Kennenlernen',
      decline: 'Absagen',
    },
  },
};

export default de;
