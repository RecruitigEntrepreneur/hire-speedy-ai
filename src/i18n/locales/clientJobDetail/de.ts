// Stellenseite des Kunden im Entwurf und in der Prüfung. Deutsch ist die Quelle.
// Die Texte des Live-Cockpits liegen im Namespace translation unter „jobdetail“.
const de = {
  toast: {
    submitError: 'Einreichen fehlgeschlagen',
    submittedInternal: 'Zur internen Freigabe eingereicht — Admin/HR Ihres Teams wurden benachrichtigt.',
    submitted: 'Zur Prüfung eingereicht — wir benachrichtigen Sie, sobald die Stelle live ist.',
    withdrawn: 'Zurückgezogen — die Stelle ist wieder ein Entwurf.',
    approveError: 'Freigabe fehlgeschlagen',
    approved: 'Freigegeben — die Stelle geht jetzt an Matchunt zur Prüfung.',
    returnError: 'Zurückgeben fehlgeschlagen',
    returned: 'Zurückgegeben — der Fachbereich wurde benachrichtigt.',
  },
  draft: {
    package: 'Paket {{name}}',
    packageFee: 'Paket {{name}} {{pct}} %',
    returnedReview: 'Aus der Prüfung zurückgegeben',
    returnedTeam: 'Vom Team zurückgegeben',
    reason: 'Grund: {{reason}}',
    badge: 'Entwurf',
    submittedOn: 'Eingereicht am {{date}}',
    submitted: 'Eingereicht',
    lastEdited_one: 'zuletzt bearbeitet vor {{count}} Tag',
    lastEdited_other: 'zuletzt bearbeitet vor {{count}} Tagen',
    reviewInfo: 'Wir prüfen Ihre Angaben und schreiben daraus die anonyme Anzeige für Headhunter. Fehlt etwas, geben wir Ihnen die Stelle mit einem Hinweis zurück. Sobald sie live ist, bekommen Sie Bescheid.',
    approveSend: 'Freigeben & an Matchunt senden',
    returnWithComment: 'Mit Kommentar zurückgeben',
    approversNotified: 'Admin/HR Ihres Teams wurden benachrichtigt und geben die Aufnahme frei.',
    withdraw: 'Zurückziehen',
    continueIntake: 'Aufnahme fortsetzen und einreichen',
    supportHint: 'Etwas stimmt nicht oder die Stelle hat sich erledigt?',
    supportLink: 'E-Mail an Matchunt',
  },
  returnDialog: {
    title: 'An den Fachbereich zurückgeben',
    description: 'Die Aufnahme geht als Entwurf zurück. Ihr Kommentar wird dem Ersteller angezeigt.',
    placeholder: 'Was soll angepasst werden? (Pflichtfeld)',
    cancel: 'Abbrechen',
    submit: 'Zurückgeben',
  },
  live: {
    pausedUntil: 'Pausiert bis {{date}}',
  },
};
export default de;
