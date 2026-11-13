// Kunden-Rundgang (lib/clientGuide.ts): Kapitel und Schritte. Anrede „Sie“.
// Die Knöpfe der Einblendung stehen in recruiterGuide (clientTexts).
const de = {
  chapters: {
    welcome: 'Willkommen',
    create: 'Stelle anlegen',
    after: 'Nach dem Einreichen',
    candidates: 'Kandidaten & Team',
  },
  steps: {
    'c-welcome': {
      title: 'Willkommen bei Matchunt',
      body: 'In wenigen Minuten zeigen wir Ihnen, wie Sie eine Stelle an unsere Headhunter geben und passende Kandidaten bekommen. Dabei legen Sie gleich Ihre erste Stelle an. Sie klicken selbst, wir erklären.',
    },
    'c-entry': {
      title: 'Hier beginnt jede Stelle',
      body: '„Position aufnehmen“ ist der wichtigste Knopf. Angefangene Stellen finden Sie hier später unter „Weitermachen“.',
    },
    'c-decide': {
      title: 'Was auf Sie wartet',
      body: '„Braucht Entscheidung“ zeigt Kandidaten und Termine, bei denen Sie am Zug sind. Je schneller Sie reagieren, desto besser die Chancen.',
    },
    'c-start': {
      title: 'Legen wir Ihre erste Stelle an',
      body: 'Fügen Sie Ihre Stellenanzeige ein und klicken Sie auf „Profil bauen“. Keine Anzeige zur Hand? Dann „Von Hand beschreiben“.',
      narrowBody: 'Tippen Sie auf „Position aufnehmen“.',
      action: 'Position aufnehmen',
    },
    'c-kind': {
      title: 'Festanstellung oder Contracting?',
      body: 'Danach richtet sich, wonach wir fragen und was in der Vereinbarung steht. Wählen Sie die passende Art.',
      action: 'Weiter',
    },
    'c-ways': {
      title: 'Der schnellste Weg: Ihre Anzeige',
      body: 'Anzeige einfügen, Link oder PDF: Wir bauen daraus das Profil, Sie prüfen nur noch. Ohne Anzeige beschreiben Sie die Stelle von Hand.',
      action: 'Weiter',
    },
    'c-profile': {
      title: 'Prüfen statt tippen',
      body: 'Ihr Profil steht. Alles aus Ihrer Anzeige ist mit „aus der Anzeige“ markiert: „✓ stimmt“ bestätigt, sonst einfach ändern. „Alle bestätigen“ übernimmt alles auf einmal.',
      wait: 'Der Rundgang wartet, bis Ihr Profil steht.',
    },
    'c-criteria': {
      title: 'Die wichtigste Angabe',
      body: 'Stufen Sie jede Anforderung ein: unverzichtbar, verhandelbar oder lernbar. Daran messen die Headhunter jeden Kandidaten.',
    },
    'c-briefing': {
      title: 'Das Briefing: was in keiner Anzeige steht',
      body: 'Acht Fragen aus echten Vermittlungsgesprächen, etwa warum die Stelle offen ist und wer bei Ihnen Erfolg hat. Genau das macht die Ansprache der Headhunter überzeugend.',
    },
    'c-save': {
      title: 'Nichts geht verloren',
      body: 'Alles wird laufend gespeichert. Mit „Später“ machen Sie jederzeit unter „Weitermachen“ weiter. „Weiter“ führt zum Einreichen, sobald Briefing und Anforderungen stehen.',
    },
    'c-submit': {
      title: 'Füllen Sie in Ruhe aus',
      body: 'Beantworten Sie jetzt die Fragen und reichen Sie ein, wenn Sie so weit sind. Der Rundgang wartet so lange und geht danach unter „Meine Jobs“ weiter.',
    },
    'c-jobs': {
      title: 'Wo steht meine Stelle?',
      body: 'Unter „Meine Jobs“ sehen Sie jede Stelle mit ihrem Stand: Eingereicht → Prüfung durch Matchunt (meist unter 24 Std.) → Live → Erste Kandidaten. Entwürfe stehen unter „Entwürfe“.',
      hold: 'Der Rundgang geht weiter, sobald Sie eingereicht oder „Später“ gewählt haben.',
    },
    'c-navCandidates': {
      title: 'Ihre Kandidaten',
      body: 'Klicken Sie links im Menü auf „Bewerber“.',
      narrowBody: 'Tippen Sie auf „Bewerber öffnen“.',
      action: 'Bewerber öffnen',
    },
    'c-candidates': {
      title: 'Kandidaten kommen anonym',
      body: 'Sie sehen zuerst ein anonymes Profil mit der Einschätzung des Headhunters. Wollen Sie jemanden kennenlernen, fragt der Headhunter die Person. Danach sehen Sie Namen und Lebenslauf.',
    },
    'c-navTeam': {
      title: 'Ihr Team',
      body: 'Klicken Sie links im Menü auf „Team“.',
      narrowBody: 'Tippen Sie auf „Team öffnen“.',
      action: 'Team öffnen',
    },
    'c-team': {
      title: 'Holen Sie Ihr Team dazu',
      body: 'Laden Sie Kollegen ein: HR reicht Stellen ein, der Fachbereich gibt Feedback zu Kandidaten.',
    },
    'c-done': {
      title: 'Geschafft',
      body: 'Sie kennen jetzt die wichtigsten Wege. Den Rundgang starten Sie jederzeit neu über „Rundgang“ im Dashboard.',
    },
  },
};

export default de;
