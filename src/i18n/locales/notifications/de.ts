// Glocke in der Kopfleiste (Kunden und Headhunter). Deutsch ist die Quelle.
// Titel und Text der einzelnen Benachrichtigungen kommen aus der Datenbank und bleiben, wie sie sind.
const de = {
  title: 'Benachrichtigungen',
  markAllRead: 'Alle gelesen',
  empty: 'Keine Benachrichtigungen',
  showAll: 'Alle anzeigen',
  justNow: 'Gerade eben',
  minutesAgo: 'vor {{count}} Min.',
  hoursAgo: 'vor {{count}} Std.',
  daysAgo: 'vor {{count}} Tagen',
  // Sprechblase oben neben der Glocke (Posteingang)
  inbox: 'Posteingang',
  inboxWaiting: 'Posteingang, {{count}} warten auf dich',
  inboxWaitingClient: 'Posteingang, {{count}} warten auf Sie',
  // Glocke bündelt gleiche Meldungen, die direkt aufeinander folgen (17.11.2026)
  bundle: {
    searchStartedBy_one: '{{name}} sucht jetzt für {{count}} Stelle',
    searchStartedBy_other: '{{name}} sucht jetzt für {{count}} Stellen',
    searchStarted_one: 'Headhunter suchen jetzt für {{count}} Stelle',
    searchStarted_other: 'Headhunter suchen jetzt für {{count}} Stellen',
    pauseEnded_one: '{{count}} Stelle läuft wieder',
    pauseEnded_other: '{{count}} Stellen laufen wieder',
    pauseEnding_one: 'Bei {{count}} Stelle endet die Pause bald',
    pauseEnding_other: 'Bei {{count}} Stellen endet die Pause bald',
    expand: 'Einzeln anzeigen',
    collapse: 'Zuklappen',
  },
};
export default de;
