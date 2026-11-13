/**
 * Texte der Kunden-Aufnahme und der Kunden-Anmeldung in der Sprache des Kunden
 * (Mehrsprachigkeit, 12.11.2026).
 *
 * Der Code denkt weiter in Deutsch: Die Functions melden ihre Fehler im
 * deutschen Wortlaut, und erst kurz vor der Antwort wird übersetzt
 * (`localizeIntakeMessage`, eingehängt über `withIntakeLang` in
 * intake-language.ts). Mails holen ihre Texte hier ab.
 *
 * Deutsch bleibt wortgleich (Kunden werden gesiezt). Englisch „you“, Schwedisch
 * und Norwegisch „du“. de-AT und de-CH lesen die deutschen Texte, de-CH ohne ß.
 *
 * Nicht übersetzt wird alles, was in einen Vertrag, ein Vertrags-PDF oder einen
 * gespeicherten Vertrags-Snapshot einfließt: Diese Wortlaute bleiben deutsch.
 */
import { baseLang, swiss, tr, type Lang, type Texts } from './i18n.ts';
import { legalLinkTexts, localizeMessage as recruiterMessage } from './recruiter-i18n.ts';

// ── Servermeldungen ─────────────────────────────────────────────────────────

/** Deutscher Wortlaut → [Englisch, Schwedisch, Norwegisch]. */
const MESSAGES: Record<string, [string, string, string]> = {
  // intake-core.ts (Zugriff auf den Entwurf, Zustand des Links)
  'Ungültiger Zugriffslink.': ['Invalid access link.', 'Ogiltig åtkomstlänk.', 'Ugyldig tilgangslenke.'],
  'Die Jobaufnahme ist noch nicht freigeschaltet. Bitte melden Sie sich bei uns.': [
    'The job intake is not available yet. Please get in touch with us.',
    'Tjänsteregistreringen är inte tillgänglig ännu. Hör av dig till oss.',
    'Stillingsregistreringen er ikke tilgjengelig ennå. Ta kontakt med oss.'],
  'Zugriff fehlgeschlagen.': ['Access failed.', 'Åtkomsten misslyckades.', 'Tilgangen mislyktes.'],
  'Dieser Zugriffslink ist unbekannt.': ['This access link is unknown.', 'Den här åtkomstlänken är okänd.', 'Denne tilgangslenken er ukjent.'],
  'Dieser Zugriffslink wurde deaktiviert.': ['This access link has been deactivated.', 'Den här åtkomstlänken har inaktiverats.', 'Denne tilgangslenken er deaktivert.'],
  'Dieser Zugriffslink ist abgelaufen. Wir senden Ihnen gern einen neuen.': [
    'This access link has expired. We are happy to send you a new one.',
    'Den här åtkomstlänken har gått ut. Vi skickar gärna en ny till dig.',
    'Denne tilgangslenken er utløpt. Vi sender deg gjerne en ny.'],
  'Diese Aufnahme ist abgelaufen und wurde gelöscht. Bitte beginnen Sie neu.': [
    'This request has expired and was deleted. Please start again.',
    'Den här förfrågan har gått ut och raderats. Börja om från början.',
    'Denne forespørselen er utløpt og slettet. Start på nytt.'],
  'Dieser Link wurde deaktiviert.': ['This link has been deactivated.', 'Den här länken har inaktiverats.', 'Denne lenken er deaktivert.'],
  'Dieser Link ist abgelaufen.': ['This link has expired.', 'Den här länken har gått ut.', 'Denne lenken er utløpt.'],
  'Dieser Link wurde bereits verwendet.': ['This link has already been used.', 'Den här länken har redan använts.', 'Denne lenken er allerede brukt.'],

  // intake-start
  'Ungültiger Link.': ['Invalid link.', 'Ogiltig länk.', 'Ugyldig lenke.'],
  'Die Jobaufnahme ist noch nicht freigeschaltet. Bitte melden Sie sich bei Ihrem Ansprechpartner.': [
    'The job intake is not available yet. Please get in touch with your contact.',
    'Tjänsteregistreringen är inte tillgänglig ännu. Hör av dig till din kontaktperson.',
    'Stillingsregistreringen er ikke tilgjengelig ennå. Ta kontakt med kontaktpersonen din.'],
  'Link konnte nicht geprüft werden.': ['The link could not be checked.', 'Länken kunde inte kontrolleras.', 'Lenken kunne ikke kontrolleres.'],
  'Dieser Link ist unbekannt.': ['This link is unknown.', 'Den här länken är okänd.', 'Denne lenken er ukjent.'],
  'Zu viele Aufrufe in kurzer Zeit. Bitte versuchen Sie es in einer Stunde erneut.': [
    'Too many requests in a short time. Please try again in an hour.',
    'För många anrop på kort tid. Försök igen om en timme.',
    'For mange forespørsler på kort tid. Prøv igjen om en time.'],
  'Die Aufnahme konnte nicht gestartet werden.': ['The request could not be started.', 'Förfrågan kunde inte startas.', 'Forespørselen kunne ikke startes.'],
  'Unerwarteter Fehler.': ['Unexpected error.', 'Oväntat fel.', 'Uventet feil.'],

  // intake-draft
  'Ihre Anfrage liegt bereits bei uns und kann nicht mehr geändert werden.': [
    'We already have your request, and it can no longer be changed.',
    'Vi har redan fått din förfrågan och den kan inte längre ändras.',
    'Vi har allerede mottatt forespørselen din, og den kan ikke lenger endres.'],
  'Zu viele Versuche. Bitte kurz warten.': ['Too many attempts. Please wait a moment.', 'För många försök. Vänta en liten stund.', 'For mange forsøk. Vent et øyeblikk.'],
  'Dieser Vorgang ist abgeschlossen.': ['This request is closed.', 'Det här ärendet är avslutat.', 'Denne saken er avsluttet.'],
  'Zu viele Speichervorgänge. Bitte kurz warten.': ['Too many saves. Please wait a moment.', 'För många sparningar. Vänta en liten stund.', 'For mange lagringer. Vent et øyeblikk.'],
  'Die Aufnahme ist zu groß. Bitte kürzen Sie die Freitexte.': [
    'The request is too large. Please shorten the free-text fields.',
    'Förfrågan är för stor. Korta ner fritexterna.',
    'Forespørselen er for stor. Kort ned fritekstene.'],
  'Ihre Eingaben konnten gerade nicht gespeichert werden. Bitte versuchen Sie es erneut.': [
    'Your entries could not be saved just now. Please try again.',
    'Dina uppgifter kunde inte sparas just nu. Försök igen.',
    'Opplysningene dine kunne ikke lagres akkurat nå. Prøv igjen.'],

  // intake-verify-email
  'Bitte geben Sie eine gültige E-Mail-Adresse an.': ['Please enter a valid email address.', 'Ange en giltig e-postadress.', 'Oppgi en gyldig e-postadresse.'],
  'Bitte verwenden Sie Ihre geschäftliche E-Mail-Adresse. Über eine private Adresse können wir das Unternehmen nicht zuordnen.': [
    'Please use your business email address. With a private address we cannot identify the company.',
    'Använd din e-postadress på jobbet. Med en privat adress kan vi inte koppla ihop dig med företaget.',
    'Bruk jobb-e-postadressen din. Med en privat adresse kan vi ikke knytte deg til selskapet.'],
  'Gerade wurden mehrere Codes angefordert. Bitte versuchen Sie es in einigen Minuten erneut. Ihre Angaben sind gespeichert.': [
    'Several codes were requested just now. Please try again in a few minutes. Your details are saved.',
    'Flera koder har just begärts. Försök igen om några minuter. Dina uppgifter är sparade.',
    'Det er nettopp bedt om flere koder. Prøv igjen om noen minutter. Opplysningene dine er lagret.'],
  'Der Code konnte nicht erzeugt werden.': ['The code could not be created.', 'Koden kunde inte skapas.', 'Koden kunne ikke opprettes.'],
  'Die Bestätigungsmail konnte nicht versendet werden. Bitte versuchen Sie es in einigen Minuten erneut.': [
    'The confirmation email could not be sent. Please try again in a few minutes.',
    'Bekräftelsemejlet kunde inte skickas. Försök igen om några minuter.',
    'Bekreftelses-e-posten kunne ikke sendes. Prøv igjen om noen minutter.'],
  'Bitte geben Sie den sechsstelligen Code ein.': ['Please enter the six-digit code.', 'Ange den sexsiffriga koden.', 'Skriv inn den sekssifrede koden.'],
  'Zu viele Eingaben. Bitte in einigen Minuten erneut probieren — Ihre Angaben sind gespeichert.': [
    'Too many attempts. Please try again in a few minutes — your details are saved.',
    'För många försök. Försök igen om några minuter – dina uppgifter är sparade.',
    'For mange forsøk. Prøv igjen om noen minutter – opplysningene dine er lagret.'],
  'Es liegt kein offener Code vor. Bitte fordern Sie einen neuen an.': [
    'There is no open code. Please request a new one.',
    'Det finns ingen aktiv kod. Begär en ny.',
    'Det finnes ingen aktiv kode. Be om en ny.'],
  'Der Code ist abgelaufen. Bitte fordern Sie einen neuen an.': [
    'The code has expired. Please request a new one.', 'Koden har gått ut. Begär en ny.', 'Koden er utløpt. Be om en ny.'],
  'Zu viele Fehlversuche. Bitte fordern Sie einen neuen Code an.': [
    'Too many failed attempts. Please request a new code.', 'För många felaktiga försök. Begär en ny kod.', 'For mange feil forsøk. Be om en ny kode.'],
  'Der Code stimmt nicht. Bitte fordern Sie einen neuen an.': [
    'The code is not correct. Please request a new one.', 'Koden stämmer inte. Begär en ny.', 'Koden stemmer ikke. Be om en ny.'],

  // intake-resume
  'Wenn zu dieser Adresse eine begonnene Aufnahme vorliegt, ist ein Link zum Fortsetzen unterwegs.': [
    'If there is a request in progress for this address, a link to continue is on its way.',
    'Om det finns en påbörjad förfrågan för den här adressen är en länk för att fortsätta på väg.',
    'Hvis det finnes en påbegynt forespørsel for denne adressen, er en lenke for å fortsette på vei.'],

  // intake-packages
  'Für Contracting gibt es keine Paketwahl. Die Konditionen stehen auf der Seite „Anfragen“.': [
    'There is no package choice for contracting. The terms are on the “Request” page.',
    'För contracting finns inget paketval. Villkoren står på sidan ”Förfrågan”.',
    'For contracting finnes det ikke noe pakkevalg. Vilkårene står på siden «Forespørsel».'],
  'Die Pakete sind noch nicht hinterlegt. Bitte melden Sie sich bei Ihrem Ansprechpartner.': [
    'The packages are not set up yet. Please get in touch with your contact.',
    'Paketen är inte upplagda ännu. Hör av dig till din kontaktperson.',
    'Pakkene er ikke lagt inn ennå. Ta kontakt med kontaktpersonen din.'],
  'Der Auftrag ist bereits angenommen. Bitte wenden Sie sich an Ihren Ansprechpartner.': [
    'The order has already been accepted. Please get in touch with your contact.',
    'Uppdraget är redan antaget. Hör av dig till din kontaktperson.',
    'Oppdraget er allerede akseptert. Ta kontakt med kontaktpersonen din.'],
  'Ihre Konditionen sind im Rahmenvertrag vereinbart und gelten unverändert.': [
    'Your terms are agreed in the framework agreement and apply unchanged.',
    'Dina villkor är avtalade i ramavtalet och gäller oförändrat.',
    'Vilkårene dine er avtalt i rammeavtalen og gjelder uendret.'],
  'Bitte wählen Sie eines der drei angebotenen Pakete.': [
    'Please choose one of the three packages on offer.', 'Välj ett av de tre paket som erbjuds.', 'Velg en av de tre pakkene som tilbys.'],
  'Die Pakete konnten nicht geladen werden.': ['The packages could not be loaded.', 'Paketen kunde inte laddas.', 'Pakkene kunne ikke lastes inn.'],
  // Hinweis unter der Paketwahl: Die Wahl ist eine Anfrage, kein Vertragsschluss.
  'Ihre Auswahl ist eine Anfrage, noch kein Vertrag. Wir prüfen sie und senden Ihnen anschließend den Vertrag zur digitalen Unterschrift. Erst nach beidseitiger Unterschrift starten wir die Suche.': [
    'Your choice is a request, not yet a contract. We review it and then send you the contract for digital signature. We only start the search once both parties have signed.',
    'Ditt val är en förfrågan, ännu inget avtal. Vi går igenom den och skickar sedan avtalet till dig för digital signering. Först när båda parter har undertecknat startar vi sökningen.',
    'Valget ditt er en forespørsel, ennå ingen avtale. Vi går gjennom den og sender deg deretter avtalen til digital signering. Først når begge parter har signert, starter vi søket.'],

  // intake-submit
  'Der Vertragstext ist nicht hinterlegt.': ['The contract text is not set up.', 'Avtalstexten är inte upplagd.', 'Avtaleteksten er ikke lagt inn.'],
  'Die Beauftragungsanfrage konnte nicht gespeichert werden.': [
    'The engagement request could not be saved.', 'Uppdragsförfrågan kunde inte sparas.', 'Oppdragsforespørselen kunne ikke lagres.'],
  'Die Anfrage konnte nicht eingereicht werden.': ['The request could not be submitted.', 'Förfrågan kunde inte skickas in.', 'Forespørselen kunne ikke sendes inn.'],
  'Dieser Vorgang ist bereits abgeschlossen.': ['This request is already closed.', 'Det här ärendet är redan avslutat.', 'Denne saken er allerede avsluttet.'],
  'Es fehlen noch Angaben.': ['Some details are still missing.', 'Några uppgifter saknas fortfarande.', 'Noen opplysninger mangler fortsatt.'],
  'Bitte bestätigen Sie die Konditionen und die Allgemeinen Geschäftsbedingungen.': [
    'Please confirm the terms and the general terms and conditions.',
    'Bekräfta villkoren och de allmänna villkoren.',
    'Bekreft vilkårene og de alminnelige vilkårene.'],
  'Bitte geben Sie Ihren Namen an.': ['Please enter your name.', 'Ange ditt namn.', 'Oppgi navnet ditt.'],
  'Die Prüfung Ihrer Firmenangaben läuft noch. Bitte versuchen Sie es in einem Moment erneut.': [
    'We are still checking your company details. Please try again in a moment.',
    'Kontrollen av dina företagsuppgifter pågår fortfarande. Försök igen om en stund.',
    'Kontrollen av firmaopplysningene dine pågår fortsatt. Prøv igjen om et øyeblikk.'],
  'Für die Vereinbarung fehlen noch Angaben zu Ihrer Firma. Bitte ergänzen Sie sie oben, dann geht es weiter.': [
    'Some details about your company are still missing for the agreement. Please add them above, then you can continue.',
    'För avtalet saknas fortfarande uppgifter om ditt företag. Fyll i dem ovan, så kan du gå vidare.',
    'For avtalen mangler det fortsatt opplysninger om selskapet ditt. Fyll dem inn ovenfor, så kan du gå videre.'],
  'Bitte wählen Sie zuerst eines der drei Pakete aus.': [
    'Please choose one of the three packages first.', 'Välj först ett av de tre paketen.', 'Velg først en av de tre pakkene.'],
  'Das gewählte Paket ist nicht hinterlegt.': ['The chosen package is not set up.', 'Det valda paketet är inte upplagt.', 'Den valgte pakken er ikke lagt inn.'],
  // Liste „Es fehlen noch Angaben“ (Feld `missing`)
  'Bezeichnung der Position': ['Title of the position', 'Tjänstens benämning', 'Stillingens tittel'],
  'Ansprechpartner': ['Contact person', 'Kontaktperson', 'Kontaktperson'],
  'Geschäftliche E-Mail-Adresse': ['Business email address', 'E-postadress på jobbet', 'Jobb-e-postadresse'],
  'Bestätigung Ihrer E-Mail-Adresse': ['Confirmation of your email address', 'Bekräftelse av din e-postadress', 'Bekreftelse av e-postadressen din'],
  'Name des Unternehmens': ['Company name', 'Företagets namn', 'Selskapets navn'],

  // intake-forward
  'Bitte leiten Sie an eine geschäftliche E-Mail-Adresse weiter — die Aufnahme enthält vertrauliche Angaben zu Ihrer Position.': [
    'Please forward to a business email address — the request contains confidential details about your position.',
    'Vidarebefordra till en e-postadress på jobbet – förfrågan innehåller konfidentiella uppgifter om din tjänst.',
    'Videresend til en jobb-e-postadresse – forespørselen inneholder konfidensielle opplysninger om stillingen din.'],
  'Diese Adresse bearbeitet die Aufnahme bereits.': [
    'This address is already working on the request.', 'Den här adressen arbetar redan med förfrågan.', 'Denne adressen jobber allerede med forespørselen.'],
  'Sie haben die Aufnahme bereits mehrfach weitergeleitet. Bitte später erneut.': [
    'You have already forwarded the request several times. Please try again later.',
    'Du har redan vidarebefordrat förfrågan flera gånger. Försök igen senare.',
    'Du har allerede videresendt forespørselen flere ganger. Prøv igjen senere.'],
  'Der Zugang konnte nicht erzeugt werden.': ['The access could not be created.', 'Åtkomsten kunde inte skapas.', 'Tilgangen kunne ikke opprettes.'],
  'Die Einladung konnte nicht versendet werden. Bitte versuchen Sie es erneut.': [
    'The invitation could not be sent. Please try again.', 'Inbjudan kunde inte skickas. Försök igen.', 'Invitasjonen kunne ikke sendes. Prøv igjen.'],

  // intake-clarify (Seite des Kunden)
  'Der Link ist unvollständig.': ['The link is incomplete.', 'Länken är ofullständig.', 'Lenken er ufullstendig.'],
  'Dieser Link ist nicht mehr gültig.': ['This link is no longer valid.', 'Den här länken är inte längre giltig.', 'Denne lenken er ikke lenger gyldig.'],
  'Dieser Link ist abgelaufen. Bitte wenden Sie sich an Ihren Ansprechpartner.': [
    'This link has expired. Please get in touch with your contact.',
    'Den här länken har gått ut. Hör av dig till din kontaktperson.',
    'Denne lenken er utløpt. Ta kontakt med kontaktpersonen din.'],
  'Diese Rückfrage ist bereits erledigt.': ['This question has already been dealt with.', 'Den här frågan är redan hanterad.', 'Dette spørsmålet er allerede behandlet.'],
  'Bitte geben Sie eine Antwort ein.': ['Please enter an answer.', 'Skriv ett svar.', 'Skriv inn et svar.'],
  'Die Rückfrage konnte nicht verarbeitet werden.': ['The question could not be processed.', 'Frågan kunde inte behandlas.', 'Spørsmålet kunne ikke behandles.'],

  // client-code.ts (Kunden-Anmeldung)
  'Dieser Link ist abgelaufen. Geben Sie Ihre E-Mail-Adresse ein, wir senden Ihnen einen Code.': [
    'This link has expired. Enter your email address and we will send you a code.',
    'Den här länken har gått ut. Ange din e-postadress, så skickar vi en kod.',
    'Denne lenken er utløpt. Skriv inn e-postadressen din, så sender vi deg en kode.'],
  'Dieser Link funktioniert nicht mehr. Geben Sie Ihre E-Mail-Adresse ein, wir senden Ihnen einen Code.': [
    'This link no longer works. Enter your email address and we will send you a code.',
    'Den här länken fungerar inte längre. Ange din e-postadress, så skickar vi en kod.',
    'Denne lenken virker ikke lenger. Skriv inn e-postadressen din, så sender vi deg en kode.'],
  'Gerade wurden mehrere Codes angefordert. Bitte versuchen Sie es in einigen Minuten erneut.': [
    'Several codes were requested just now. Please try again in a few minutes.',
    'Flera koder har just begärts. Försök igen om några minuter.',
    'Det er nettopp bedt om flere koder. Prøv igjen om noen minutter.'],
  'Der Code konnte nicht erzeugt werden. Bitte versuchen Sie es gleich noch einmal.': [
    'The code could not be created. Please try again in a moment.',
    'Koden kunde inte skapas. Försök igen om en liten stund.',
    'Koden kunne ikke opprettes. Prøv igjen om et øyeblikk.'],
  'Der Code konnte nicht versendet werden. Bitte versuchen Sie es gleich noch einmal.': [
    'The code could not be sent. Please try again in a moment.',
    'Koden kunde inte skickas. Försök igen om en liten stund.',
    'Koden kunne ikke sendes. Prøv igjen om et øyeblikk.'],
  'Bitte geben Sie den sechsstelligen Code aus der E-Mail ein.': [
    'Please enter the six-digit code from the email.', 'Ange den sexsiffriga koden från mejlet.', 'Skriv inn den sekssifrede koden fra e-posten.'],
  'Die Anmeldung ist noch nicht eingerichtet.': ['Sign-in is not set up yet.', 'Inloggningen är inte inrättad ännu.', 'Påloggingen er ikke satt opp ennå.'],
  'Zu viele Versuche. Warten Sie einen Moment und fordern Sie dann einen neuen Code an.': [
    'Too many attempts. Wait a moment and then request a new code.',
    'För många försök. Vänta en stund och begär sedan en ny kod.',
    'For mange forsøk. Vent et øyeblikk og be deretter om en ny kode.'],
  'Der Code stimmt nicht. Prüfen Sie ihn oder fordern Sie unten einen neuen an.': [
    'The code is not correct. Check it or request a new one below.',
    'Koden stämmer inte. Kontrollera den eller begär en ny nedan.',
    'Koden stemmer ikke. Kontroller den eller be om en ny nedenfor.'],
  'Zu oft falsch eingegeben. Fordern Sie bitte einen neuen Code an.': [
    'Entered incorrectly too many times. Please request a new code.',
    'Fel kod har angetts för många gånger. Begär en ny kod.',
    'Feil kode er skrevet inn for mange ganger. Be om en ny kode.'],
  'Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuchen Sie es gleich noch einmal.': [
    'Sign-in could not be completed. Please try again in a moment.',
    'Inloggningen kunde inte slutföras. Försök igen om en liten stund.',
    'Påloggingen kunne ikke fullføres. Prøv igjen om et øyeblikk.'],
  'Die Anmeldung konnte nicht abgeschlossen werden. Bitte fordern Sie einen neuen Code an.': [
    'Sign-in could not be completed. Please request a new code.',
    'Inloggningen kunde inte slutföras. Begär en ny kod.',
    'Påloggingen kunne ikke fullføres. Be om en ny kode.'],
};

// Meldungen mit Uhrzeit, Zähler, Adresse oder Vertragsnummer. Uhrzeiten sind deutsche Zeit.
const PATTERNS: [RegExp, { en: string; sv: string; nb: string }][] = [
  [/^Ein neuer Code ist ab (\d{1,2}:\d{2}) Uhr möglich\. Haben Sie schon einen Code erhalten\? Er ist 15 Minuten gültig und lässt sich oben eintragen\. Ihre Angaben sind gespeichert — Sie können jederzeit zurückkommen\.$/, {
    en: 'A new code is possible from {1} (German time). Have you already received a code? It is valid for 15 minutes and can be entered above. Your details are saved — you can come back at any time.',
    sv: 'En ny kod kan begäras från kl. {1} (tysk tid). Har du redan fått en kod? Den gäller i 15 minuter och kan anges ovan. Dina uppgifter är sparade – du kan komma tillbaka när som helst.',
    nb: 'Du kan be om en ny kode fra kl. {1} (tysk tid). Har du allerede fått en kode? Den er gyldig i 15 minutter og kan skrives inn ovenfor. Opplysningene dine er lagret – du kan komme tilbake når som helst.',
  }],
  [/^Zu viele Eingaben\. Ab (\d{1,2}:\d{2}) Uhr geht es weiter — Ihre Angaben sind gespeichert\.$/, {
    en: 'Too many attempts. You can continue from {1} (German time) — your details are saved.',
    sv: 'För många försök. Du kan fortsätta från kl. {1} (tysk tid) – dina uppgifter är sparade.',
    nb: 'For mange forsøk. Du kan fortsette fra kl. {1} (tysk tid) – opplysningene dine er lagret.',
  }],
  [/^Der Code stimmt nicht\. Noch (1) Versuch\.$/, {
    en: 'The code is not correct. {1} attempt left.',
    sv: 'Koden stämmer inte. {1} försök kvar.',
    nb: 'Koden stemmer ikke. {1} forsøk igjen.',
  }],
  [/^Der Code stimmt nicht\. Noch (\d+) Versuche\.$/, {
    en: 'The code is not correct. {1} attempts left.',
    sv: 'Koden stämmer inte. {1} försök kvar.',
    nb: 'Koden stemmer ikke. {1} forsøk igjen.',
  }],
  [/^Einladung an (\S+) versendet\.$/, {
    en: 'Invitation sent to {1}.',
    sv: 'Inbjudan har skickats till {1}.',
    nb: 'Invitasjonen er sendt til {1}.',
  }],
  [/^Ihre Konditionen stehen im Rahmenvertrag (.+) und gelten unverändert\. Diese Position wird darunter beauftragt — ohne erneute Unterschrift\.$/, {
    en: 'Your terms are set out in framework agreement {1} and apply unchanged. This position is ordered under it — without a further signature.',
    sv: 'Dina villkor står i ramavtalet {1} och gäller oförändrat. Den här tjänsten beställs under det – utan ny underskrift.',
    nb: 'Vilkårene dine står i rammeavtalen {1} og gjelder uendret. Denne stillingen bestilles under den – uten ny signatur.',
  }],
  [/^Ihr Rahmenvertrag (.+) gilt bereits\. Für Ihre erste Festanstellung wählen Sie jetzt einmal Ihr Paket — es gilt dann für alle weiteren Festanstellungen, ohne erneute Unterschrift\.$/, {
    en: 'Your framework agreement {1} already applies. For your first permanent position you now choose your package once — it then applies to all further permanent positions, without a further signature.',
    sv: 'Ditt ramavtal {1} gäller redan. För din första tillsvidareanställning väljer du nu ditt paket en gång – det gäller sedan för alla kommande tillsvidareanställningar, utan ny underskrift.',
    nb: 'Rammeavtalen din {1} gjelder allerede. For den første faste stillingen din velger du nå pakken din én gang – den gjelder deretter for alle senere faste stillinger, uten ny signatur.',
  }],
];

/**
 * Servermeldung der Aufnahme in der Sprache des Aufrufs. Ohne `lang` unverändert
 * (Deutsch wie bisher); de-CH ohne Eszett; unbekannte Meldungen bleiben deutsch.
 * Was hier fehlt, sucht die Tabelle des Headhunter-Einstiegs (gemeinsame
 * Meldungen wie „Unbekannte Aktion.“).
 */
export function localizeIntakeMessage(lang: Lang | null | undefined, message: string): string {
  if (!lang) return message;
  const base = baseLang(lang);
  if (base === 'de') return lang === 'de-CH' ? swiss(message) : message;
  const known = MESSAGES[message];
  if (known) return known[base === 'en' ? 0 : base === 'sv' ? 1 : 2];
  for (const [pattern, texts] of PATTERNS) {
    const m = pattern.exec(message);
    if (m) return texts[base].replace(/\{(\d)\}/g, (_all, n) => m[Number(n)] ?? '');
  }
  return recruiterMessage(lang, message);
}

/** Für Tests: alle deutschen Meldungen, die eine Übersetzung haben. */
export const TRANSLATED_INTAKE_MESSAGES = Object.keys(MESSAGES);

// ── Mails an den Kunden ─────────────────────────────────────────────────────
//
// Die Functions bauen das HTML wie bisher und holen hier nur die Sätze ab.
// Platzhalter in geschweiften Klammern ersetzt `tr` nach der Sprachwahl; wo ein
// Wert HTML ist (fett gesetzte Position), setzt ihn der Aufrufer escaped ein.

type Vars = Record<string, string | number>;
const texter = (lang: Lang | null | undefined) => (texts: Texts, vars?: Vars) => tr(lang, texts, vars);

/** Anrede ohne Namen; der Aufrufer hängt den Namen an. */
export const helloText = (lang: Lang | null | undefined) => tr(lang, { de: 'Guten Tag', en: 'Hello', sv: 'Hej', nb: 'Hei' });

/** „die Position“, wenn die Aufnahme noch keinen Titel hat. */
export const thePositionText = (lang: Lang | null | undefined) =>
  tr(lang, { de: 'die Position', en: 'the position', sv: 'tjänsten', nb: 'stillingen' });

/** Bestätigungscode der Aufnahme (intake-verify-email). */
export function verifyCodeMailTexts(lang: Lang | null | undefined, input: { code: string; minutes: number }) {
  const t = texter(lang);
  return {
    subject: t({ de: '{code} ist Ihr Matchunt-Bestätigungscode', en: '{code} is your Matchunt confirmation code', sv: '{code} är din bekräftelsekod för Matchunt', nb: '{code} er bekreftelseskoden din for Matchunt' }, input),
    preheader: t({ de: 'Ihr Bestätigungscode: {code}', en: 'Your confirmation code: {code}', sv: 'Din bekräftelsekod: {code}', nb: 'Bekreftelseskoden din: {code}' }, input),
    heading: t({ de: 'Ihr Bestätigungscode', en: 'Your confirmation code', sv: 'Din bekräftelsekod', nb: 'Bekreftelseskoden din' }),
    hello: helloText(lang),
    intro: t({
      de: 'bitte bestätigen Sie Ihre geschäftliche E-Mail-Adresse mit diesem Code:',
      en: 'please confirm your business email address with this code:',
      sv: 'bekräfta din e-postadress på jobbet med den här koden:',
      nb: 'bekreft jobb-e-postadressen din med denne koden:',
    }),
    validity: t({ de: 'Der Code ist {minutes} Minuten gültig.', en: 'The code is valid for {minutes} minutes.', sv: 'Koden gäller i {minutes} minuter.', nb: 'Koden er gyldig i {minutes} minutter.' }, input),
    footnote: t({
      de: 'Wenn Sie keine Stellenaufnahme bei Matchunt begonnen haben, können Sie diese Nachricht ignorieren. Der Code allein gibt niemandem Zugriff.',
      en: 'If you have not started a position request at Matchunt, you can ignore this message. The code alone does not give anyone access.',
      sv: 'Om du inte har påbörjat en förfrågan om en tjänst hos Matchunt kan du bortse från det här meddelandet. Enbart koden ger ingen åtkomst.',
      nb: 'Hvis du ikke har startet en forespørsel om en stilling hos Matchunt, kan du se bort fra denne meldingen. Koden alene gir ingen tilgang.',
    }),
  };
}

/** „Später fortsetzen“ und „Link erneut senden“ (intake-resume). */
export function resumeMailTexts(lang: Lang | null | undefined) {
  const t = texter(lang);
  return {
    subject: t({ de: 'Ihre Stellenaufnahme bei Matchunt fortsetzen', en: 'Continue your position request at Matchunt', sv: 'Fortsätt med din tjänst hos Matchunt', nb: 'Fortsett med stillingen din hos Matchunt' }),
    preheader: t({ de: 'Hier geht es weiter mit Ihrer Stellenaufnahme.', en: 'Pick up your position request where you left off.', sv: 'Här fortsätter du med din tjänst.', nb: 'Her fortsetter du med stillingen din.' }),
    heading: t({ de: 'Ihre Stellenaufnahme fortsetzen', en: 'Continue your position request', sv: 'Fortsätt med din tjänst', nb: 'Fortsett med stillingen din' }),
    hello: helloText(lang),
    /** Wenn die Aufnahme noch keinen Titel hat. */
    positionFallback: t({ de: 'Ihre Position', en: 'your position', sv: 'din tjänst', nb: 'stillingen din' }),
    /** `position` ist HTML (fett, escaped). */
    body: (position: string) => t({
      de: 'Ihre begonnene Aufnahme für {position} ist gespeichert. Über den Link machen Sie genau dort weiter, wo Sie aufgehört haben.',
      en: 'Your request for {position} is saved. Use the link to continue exactly where you left off.',
      sv: 'Det du har påbörjat för {position} är sparat. Via länken fortsätter du precis där du slutade.',
      nb: 'Det du har begynt på for {position}, er lagret. Via lenken fortsetter du akkurat der du slapp.',
    }, { position }),
    cta: t({ de: 'Aufnahme fortsetzen', en: 'Continue request', sv: 'Fortsätt', nb: 'Fortsett' }),
    footnote: t({
      de: 'Der Link gilt 14 Tage. Ohne Aktivität löschen wir die begonnene Aufnahme 30 Tage nach der letzten Änderung.',
      en: 'The link is valid for 14 days. Without activity, we delete a request you have started 30 days after the last change.',
      sv: 'Länken gäller i 14 dagar. Utan aktivitet raderar vi en påbörjad förfrågan 30 dagar efter den senaste ändringen.',
      nb: 'Lenken er gyldig i 14 dager. Uten aktivitet sletter vi en påbegynt forespørsel 30 dager etter siste endring.',
    }),
  };
}

/** Weiterleitung an Kollegen oder Unterzeichner (intake-forward). */
export function forwardMailTexts(lang: Lang | null | undefined) {
  const t = texter(lang);
  return {
    senderFallback: t({ de: 'Ein Kollege', en: 'A colleague', sv: 'En kollega', nb: 'En kollega' }),
    positionFallback: t({ de: 'eine offene Position', en: 'an open position', sv: 'en ledig tjänst', nb: 'en ledig stilling' }),
    subject: (position: string) => t({
      de: 'Freigabe erbeten: Stellenaufnahme {position}',
      en: 'Approval requested: position request {position}',
      sv: 'Godkännande önskas: förfrågan om tjänsten {position}',
      nb: 'Godkjenning ønskes: forespørsel om stillingen {position}',
    }, { position }),
    preheader: (sender: string) => t({
      de: '{sender} bittet Sie um Freigabe.', en: '{sender} asks for your approval.',
      sv: '{sender} ber om ditt godkännande.', nb: '{sender} ber om godkjenningen din.',
    }, { sender }),
    heading: t({ de: 'Freigabe einer Stellenaufnahme', en: 'Approval of a position request', sv: 'Godkännande av en förfrågan om en tjänst', nb: 'Godkjenning av en forespørsel om en stilling' }),
    hello: helloText(lang),
    /** `sender` (Name samt Firma in Klammern) und `position` sind HTML (escaped). */
    lead: (sender: string, position: string) => t({
      de: '{sender} hat bei Matchunt eine Stellenaufnahme für {position} vorbereitet und bittet Sie um Prüfung und Freigabe.',
      en: '{sender} has prepared a position request for {position} at Matchunt and asks you to review and approve it.',
      sv: '{sender} har förberett en förfrågan om tjänsten {position} hos Matchunt och ber dig granska och godkänna den.',
      nb: '{sender} har forberedt en forespørsel om stillingen {position} hos Matchunt og ber deg gå gjennom og godkjenne den.',
    }, { sender, position }),
    link: t({
      de: 'Über den Link sehen Sie die vollständige Aufnahme, können sie ergänzen und die Anfrage abschicken.',
      en: 'Via the link you can see the complete request, add to it and submit it.',
      sv: 'Via länken ser du hela underlaget, kan komplettera det och skicka in förfrågan.',
      nb: 'Via lenken ser du hele grunnlaget, kan utfylle det og sende inn forespørselen.',
    }),
    cta: t({ de: 'Aufnahme öffnen', en: 'Open request', sv: 'Öppna förfrågan', nb: 'Åpne forespørselen' }),
    footnote: t({
      de: 'Dieser Zugang gilt 14 Tage und ist ausschließlich für Sie bestimmt. Bitte leiten Sie ihn nicht weiter — nutzen Sie stattdessen die Weiterleitungsfunktion in der Aufnahme, damit jeder Zugang nachvollziehbar bleibt.',
      en: 'This access is valid for 14 days and is intended for you only. Please do not forward it — use the forwarding function in the request instead, so that every access remains traceable.',
      sv: 'Den här åtkomsten gäller i 14 dagar och är endast avsedd för dig. Vidarebefordra den inte – använd i stället vidarebefordringsfunktionen i förfrågan, så att varje åtkomst går att följa.',
      nb: 'Denne tilgangen er gyldig i 14 dager og er bare ment for deg. Ikke videresend den – bruk heller videresendingsfunksjonen i forespørselen, slik at hver tilgang kan spores.',
    }),
  };
}

/** Rückfrage mit engem Antwortlink (intake-clarify, Aktion ask). */
export function clarifyMailTexts(lang: Lang | null | undefined, input: { days: number }) {
  const t = texter(lang);
  return {
    subject: t({ de: 'Rückfrage zu Ihrer Anfrage', en: 'A question about your request', sv: 'En fråga om din förfrågan', nb: 'Et spørsmål om forespørselen din' }),
    preheader: t({ de: 'Wir haben eine kurze Rückfrage zu Ihrer Anfrage.', en: 'We have a quick question about your request.', sv: 'Vi har en kort fråga om din förfrågan.', nb: 'Vi har et kort spørsmål om forespørselen din.' }),
    heading: t({ de: 'Eine kurze Rückfrage', en: 'A quick question', sv: 'En kort fråga', nb: 'Et kort spørsmål' }),
    hello: helloText(lang),
    positionFallback: thePositionText(lang),
    /** `position` ist HTML (fett, escaped). */
    lead: (position: string) => t({
      de: 'zu Ihrer Anfrage für {position} haben wir eine Rückfrage:',
      en: 'we have a question about your request for {position}:',
      sv: 'vi har en fråga om din förfrågan för {position}:',
      nb: 'vi har et spørsmål om forespørselen din for {position}:',
    }, { position }),
    link: t({
      de: 'Über den folgenden Link können Sie direkt antworten. Er ist {days} Tage gültig und öffnet ausschließlich diese Rückfrage.',
      en: 'You can answer directly via the following link. It is valid for {days} days and opens this question only.',
      sv: 'Via länken nedan kan du svara direkt. Den gäller i {days} dagar och öppnar enbart den här frågan.',
      nb: 'Via lenken nedenfor kan du svare direkte. Den er gyldig i {days} dager og åpner bare dette spørsmålet.',
    }, input),
    cta: t({ de: 'Rückfrage beantworten', en: 'Answer the question', sv: 'Svara på frågan', nb: 'Svar på spørsmålet' }),
  };
}

/** Ablehnung oder Rückfrage aus der Prüfung (intake-admin: reject, request_changes). */
export function reviewMailTexts(lang: Lang | null | undefined, input: { reject: boolean }) {
  const t = texter(lang);
  const about = { de: 'Zu Ihrer Anfrage', en: 'About your request', sv: 'Om din förfrågan', nb: 'Om forespørselen din' };
  return {
    subject: input.reject
      ? t({ de: 'Zu Ihrer Beauftragungsanfrage', en: 'About your engagement request', sv: 'Om din uppdragsförfrågan', nb: 'Om oppdragsforespørselen din' })
      : t({ de: 'Rückfrage zu Ihrer Beauftragungsanfrage', en: 'A question about your engagement request', sv: 'En fråga om din uppdragsförfrågan', nb: 'Et spørsmål om oppdragsforespørselen din' }),
    preheader: input.reject ? t(about)
      : t({ de: 'Wir haben noch eine Rückfrage.', en: 'We have one more question.', sv: 'Vi har en fråga till.', nb: 'Vi har et spørsmål til.' }),
    heading: input.reject ? t(about)
      : t({ de: 'Eine Rückfrage zu Ihrer Anfrage', en: 'A question about your request', sv: 'En fråga om din förfrågan', nb: 'Et spørsmål om forespørselen din' }),
    hello: helloText(lang),
    /** `position` ist HTML (fett, escaped). */
    lead: (position: string) => input.reject
      ? t({
        de: 'wir können Ihre Anfrage für {position} derzeit leider nicht annehmen.',
        en: 'unfortunately we cannot accept your request for {position} at the moment.',
        sv: 'tyvärr kan vi för närvarande inte anta din förfrågan för {position}.',
        nb: 'dessverre kan vi for øyeblikket ikke akseptere forespørselen din for {position}.',
      }, { position })
      : t({
        de: 'zu Ihrer Anfrage für {position} haben wir noch eine Rückfrage.',
        en: 'we have one more question about your request for {position}.',
        sv: 'vi har en fråga till om din förfrågan för {position}.',
        nb: 'vi har et spørsmål til om forespørselen din for {position}.',
      }, { position }),
    closing: t({
      de: 'Für Rückfragen erreichen Sie uns jederzeit über diese Adresse.',
      en: 'If you have any questions, you can reach us at this address at any time.',
      sv: 'Har du frågor når du oss när som helst via den här adressen.',
      nb: 'Har du spørsmål, når du oss når som helst på denne adressen.',
    }),
    cta: t({ de: 'Aufnahme ergänzen', en: 'Complete your request', sv: 'Komplettera förfrågan', nb: 'Utfyll forespørselen' }),
  };
}

/** Einladung zum Aufnahme-Link (intake-link-admin: create mit Versand, send). */
export function linkInvitationMailTexts(lang: Lang | null | undefined, input: { title: string }) {
  const t = texter(lang);
  const withTitle = t({ de: 'Ihre Position aufnehmen: {title}', en: 'Submit your position: {title}', sv: 'Lägg upp din tjänst: {title}', nb: 'Legg inn stillingen din: {title}' }, input);
  return {
    subject: input.title ? withTitle
      : t({ de: 'Ihre offene Position bei Matchunt aufnehmen', en: 'Submit your open position to Matchunt', sv: 'Lägg upp din lediga tjänst hos Matchunt', nb: 'Legg inn den ledige stillingen din hos Matchunt' }),
    preheader: t({
      de: 'Ihre Position in wenigen Minuten aufnehmen — ohne Registrierung.',
      en: 'Submit your position in a few minutes — no registration needed.',
      sv: 'Lägg upp din tjänst på några minuter – utan registrering.',
      nb: 'Legg inn stillingen din på noen minutter – uten registrering.',
    }),
    heading: input.title ? withTitle
      : t({ de: 'Ihre Position aufnehmen', en: 'Submit your position', sv: 'Lägg upp din tjänst', nb: 'Legg inn stillingen din' }),
    hello: helloText(lang),
    /** Steht nur, wenn der Admin keinen eigenen Text schreibt. */
    intro: t({
      de: 'über den folgenden Link nehmen wir Ihre offene Position auf — Stellenanzeige einfügen, Link oder PDF hochladen, oder einfach beschreiben. Der Rest geht automatisch. Eine Registrierung ist dafür nicht nötig.',
      en: 'via the following link we take in your open position — paste the job ad, upload a link or PDF, or simply describe it. The rest happens automatically. You do not need to register.',
      sv: 'via länken nedan tar vi emot din lediga tjänst – klistra in annonsen, ladda upp en länk eller PDF, eller beskriv den bara. Resten sker automatiskt. Du behöver inte registrera dig.',
      nb: 'via lenken nedenfor tar vi imot den ledige stillingen din – lim inn annonsen, last opp en lenke eller PDF, eller bare beskriv den. Resten skjer automatisk. Du trenger ikke å registrere deg.',
    }),
    terms: t({
      de: 'Die Konditionen sehen Sie von Anfang an: Erfolgshonorar, keine Fixkosten, kein Retainer.',
      en: 'You see the terms from the start: success fee, no fixed costs, no retainer.',
      sv: 'Du ser villkoren från början: arvode vid tillsättning, inga fasta kostnader, ingen retainer.',
      nb: 'Du ser vilkårene fra starten: honorar ved ansettelse, ingen faste kostnader, ingen retainer.',
    }),
    cta: t({ de: 'Position aufnehmen', en: 'Submit position', sv: 'Lägg upp tjänsten', nb: 'Legg inn stillingen' }),
    footnote: t({
      de: 'Ihre Angaben werden fortlaufend gespeichert — Sie können jederzeit unterbrechen und später weitermachen.',
      en: 'Your details are saved continuously — you can stop at any time and continue later.',
      sv: 'Dina uppgifter sparas löpande – du kan avbryta när som helst och fortsätta senare.',
      nb: 'Opplysningene dine lagres fortløpende – du kan avbryte når som helst og fortsette senere.',
    }),
  };
}

/** Zugangsmail nach der Gegenzeichnung (client-access.ts). */
export function clientAccessMailTexts(lang: Lang | null | undefined, input: { days: number }) {
  const t = texter(lang);
  return {
    subject: t({ de: 'Ihre Position ist auf Matchunt – jetzt loslegen', en: 'Your position is on Matchunt – get started', sv: 'Din tjänst finns på Matchunt – kom igång', nb: 'Stillingen din er på Matchunt – kom i gang' }),
    preheader: t({
      de: 'Ihr Zugang ist bereit. Ein Klick, dann sind Sie in Ihrem Dashboard.',
      en: 'Your access is ready. One click and you are in your dashboard.',
      sv: 'Din åtkomst är klar. Ett klick, så är du i din dashboard.',
      nb: 'Tilgangen din er klar. Ett klikk, så er du i dashbordet ditt.',
    }),
    heading: t({ de: 'Ihre Position ist auf Matchunt', en: 'Your position is on Matchunt', sv: 'Din tjänst finns på Matchunt', nb: 'Stillingen din er på Matchunt' }),
    hello: helloText(lang),
    /** `number` ist leer oder „ MV-…“ mit führendem Leerzeichen (escaped). */
    signed: (number: string) => t({
      de: 'Ihr Auftrag{number} ist beidseitig unterzeichnet.',
      en: 'Your order{number} has been signed by both parties.',
      sv: 'Ditt uppdrag{number} är undertecknat av båda parter.',
      nb: 'Oppdraget ditt{number} er signert av begge parter.',
    }, { number }),
    accepted: (number: string) => t({
      de: 'wir haben Ihren Auftrag{number} angenommen.',
      en: 'we have accepted your order{number}.',
      sv: 'vi har antagit ditt uppdrag{number}.',
      nb: 'vi har akseptert oppdraget ditt{number}.',
    }, { number }),
    /** `title` ist HTML (fett, escaped). */
    placed: (title: string) => t({
      de: 'Ihre Position {title} liegt jetzt in Ihrem Matchunt-Bereich. Wir prüfen sie noch einmal und geben sie dann für unsere Recruiter frei.',
      en: 'Your position {title} is now in your Matchunt area. We review it once more and then release it to our recruiters.',
      sv: 'Din tjänst {title} finns nu i ditt Matchunt-konto. Vi går igenom den en gång till och släpper den sedan till våra rekryterare.',
      nb: 'Stillingen din {title} ligger nå i Matchunt-området ditt. Vi går gjennom den én gang til og frigir den deretter til rekruttererne våre.',
    }, { title }),
    accessLabel: t({ de: 'Ihr Zugang:', en: 'Your access:', sv: 'Din inloggning:', nb: 'Din pålogging:' }),
    cta: t({ de: 'Jetzt loslegen', en: 'Get started', sv: 'Kom igång', nb: 'Kom i gang' }),
    withLink: t({
      de: 'Der Link ist persönlich und {days} Tage gültig. Beim Öffnen senden wir Ihnen einen Anmeldecode an diese Adresse.',
      en: 'The link is personal and valid for {days} days. When you open it, we send a sign-in code to this address.',
      sv: 'Länken är personlig och gäller i {days} dagar. När du öppnar den skickar vi en inloggningskod till den här adressen.',
      nb: 'Lenken er personlig og gyldig i {days} dager. Når du åpner den, sender vi en påloggingskode til denne adressen.',
    }, input),
    withoutLink: t({
      de: 'Auf der Seite geben Sie Ihre Adresse ein, wir senden Ihnen einen Anmeldecode.',
      en: 'On the page, enter your address and we will send you a sign-in code.',
      sv: 'På sidan anger du din adress, så skickar vi en inloggningskod.',
      nb: 'På siden skriver du inn adressen din, så sender vi deg en påloggingskode.',
    }),
    questions: t({
      de: 'Bei Fragen antworten Sie einfach auf diese Mail.',
      en: 'If you have any questions, just reply to this email.',
      sv: 'Har du frågor? Svara bara på det här mejlet.',
      nb: 'Har du spørsmål? Bare svar på denne e-posten.',
    }),
    /** HTML (Zeilenumbruch). */
    regards: t({ de: 'Viele Grüße<br>Ihr Matchunt-Team', en: 'Best regards<br>Your Matchunt team', sv: 'Vänliga hälsningar<br>Ditt Matchunt-team', nb: 'Vennlig hilsen<br>Matchunt-teamet' }),
    ...legalLinkTexts(lang),
  };
}

/** Anmeldecode der Kunden-Anmeldung (client-code.ts). */
export function clientLoginCodeMailTexts(lang: Lang | null | undefined, input: { code: string }) {
  const t = texter(lang);
  return {
    subject: t({ de: '{code} ist Ihr Matchunt-Anmeldecode', en: '{code} is your Matchunt sign-in code', sv: '{code} är din inloggningskod för Matchunt', nb: '{code} er påloggingskoden din for Matchunt' }, input),
    preheader: t({ de: 'Ihr Anmeldecode: {code}', en: 'Your sign-in code: {code}', sv: 'Din inloggningskod: {code}', nb: 'Påloggingskoden din: {code}' }, input),
    heading: t({ de: 'Ihr Anmeldecode', en: 'Your sign-in code', sv: 'Din inloggningskod', nb: 'Påloggingskoden din' }),
    hello: helloText(lang),
    intro: t({
      de: 'mit diesem Code melden Sie sich bei Matchunt an:',
      en: 'use this code to sign in to Matchunt:',
      sv: 'med den här koden loggar du in på Matchunt:',
      nb: 'med denne koden logger du inn på Matchunt:',
    }),
    validity: t({
      de: 'Der Code ist eine Stunde gültig. Danach fordern Sie auf der Seite einfach einen neuen an.',
      en: 'The code is valid for one hour. After that, simply request a new one on the page.',
      sv: 'Koden gäller i en timme. Därefter begär du bara en ny på sidan.',
      nb: 'Koden er gyldig i én time. Etterpå ber du bare om en ny på siden.',
    }),
    footnote: t({
      de: 'Wenn Sie sich gerade nicht bei Matchunt anmelden wollten, ignorieren Sie diese Nachricht. Geben Sie den Code nicht weiter.',
      en: 'If you did not just try to sign in to Matchunt, ignore this message. Do not share the code.',
      sv: 'Om du inte just försökte logga in på Matchunt kan du bortse från det här meddelandet. Dela inte koden med någon.',
      nb: 'Hvis du ikke nettopp prøvde å logge inn på Matchunt, kan du se bort fra denne meldingen. Ikke del koden med noen.',
    }),
  };
}

/**
 * Eingangsbestätigung der Beauftragungsanfrage (intake-submit), für
 * Festanstellung und Contracting. Der Klick des Kunden ist eine Anfrage, kein
 * Vertragsschluss; unter einem bestehenden Rahmenvertrag ist es ein Auftrag.
 *
 * Die Konditionen des Contracting (Punkte, Schlusssatz, Budgethinweis) kommen
 * aus dem Vertragswerk und bleiben im deutschen Wortlaut; `germanTermsNote`
 * sagt das dem Kunden in seiner Sprache.
 */
export function submittedMailTexts(lang: Lang | null | undefined, input: { order: boolean; contracting: boolean }) {
  const t = texter(lang);
  const { order, contracting } = input;
  const kind = contracting ? ' (Contracting)' : '';
  return {
    subject: (number: string) => order
      ? t({ de: 'Ihr Auftrag {number} ist eingegangen', en: 'We have received your order {number}', sv: 'Vi har tagit emot ditt uppdrag {number}', nb: 'Vi har mottatt oppdraget ditt {number}' }, { number })
      : t({ de: 'Ihre Beauftragungsanfrage {number} ist eingegangen', en: 'We have received your engagement request {number}', sv: 'Vi har tagit emot din uppdragsförfrågan {number}', nb: 'Vi har mottatt oppdragsforespørselen din {number}' }, { number }),
    preheader: (title: string) => order
      ? t({ de: 'Ihr Auftrag für {title} ist eingegangen.', en: 'We have received your order for {title}.', sv: 'Vi har tagit emot ditt uppdrag för {title}.', nb: 'Vi har mottatt oppdraget ditt for {title}.' }, { title })
      : t({ de: 'Ihre Anfrage für {title} ist bei uns eingegangen.', en: 'We have received your request for {title}.', sv: 'Vi har tagit emot din förfrågan för {title}.', nb: 'Vi har mottatt forespørselen din for {title}.' }, { title }),
    heading: order
      ? t({ de: 'Ihr Auftrag ist eingegangen', en: 'We have received your order', sv: 'Vi har tagit emot ditt uppdrag', nb: 'Vi har mottatt oppdraget ditt' })
      : t({ de: 'Ihre Beauftragungsanfrage ist eingegangen', en: 'We have received your engagement request', sv: 'Vi har tagit emot din uppdragsförfrågan', nb: 'Vi har mottatt oppdragsforespørselen din' }),
    hello: helloText(lang),
    positionFallback: thePositionText(lang),
    /** `title` ist HTML (fett, escaped). */
    lead: (title: string) => order
      ? t({
        de: 'vielen Dank. Wir haben Ihren Auftrag für {title}{kind} erhalten.',
        en: 'thank you. We have received your order for {title}{kind}.',
        sv: 'tack. Vi har tagit emot ditt uppdrag för {title}{kind}.',
        nb: 'takk. Vi har mottatt oppdraget ditt for {title}{kind}.',
      }, { title, kind })
      : t({
        // „prüfen ihn“ steht so in der Mail zur Festanstellung, „prüfen sie“ beim Contracting.
        de: contracting
          ? 'vielen Dank. Wir haben Ihre Anfrage für {title}{kind} erhalten und prüfen sie.'
          : 'vielen Dank. Wir haben Ihre Anfrage für {title}{kind} erhalten und prüfen ihn.',
        en: 'thank you. We have received your request for {title}{kind} and are reviewing it.',
        sv: 'tack. Vi har tagit emot din förfrågan för {title}{kind} och går igenom den.',
        nb: 'takk. Vi har mottatt forespørselen din for {title}{kind} og går gjennom den.',
      }, { title, kind }),
    /** Festanstellung unter Rahmenvertrag. `number` ist HTML (fett, escaped). */
    underFramework: (number: string) => t({
      de: 'Der Auftrag läuft unter Ihrem bestehenden Rahmenvertrag {number}. Eine erneute Unterschrift ist nicht nötig — die vereinbarten Konditionen gelten unverändert.',
      en: 'The order runs under your existing framework agreement {number}. No further signature is needed — the agreed terms apply unchanged.',
      sv: 'Uppdraget löper under ditt befintliga ramavtal {number}. Ingen ny underskrift behövs – de avtalade villkoren gäller oförändrat.',
      nb: 'Oppdraget løper under den eksisterende rammeavtalen din {number}. Ingen ny signatur er nødvendig – de avtalte vilkårene gjelder uendret.',
    }, { number }),
    rows: {
      reference: t({ de: 'Vorgangsnummer', en: 'Reference number', sv: 'Ärendenummer', nb: 'Saksnummer' }),
      package: t({ de: 'Paket', en: 'Package', sv: 'Paket', nb: 'Pakke' }),
      fee: t({ de: 'Erfolgshonorar', en: 'Success fee', sv: 'Arvode vid tillsättning', nb: 'Honorar ved ansettelse' }),
      feeValue: (percent: number | string) => t({
        de: '{percent} % des Bruttojahreszielgehalts', en: '{percent} % of the gross annual target salary',
        sv: '{percent} % av bruttoårslönen vid måluppfyllelse', nb: '{percent} % av brutto årslønn ved måloppnåelse',
      }, { percent }),
      due: t({ de: 'Fällig', en: 'Due', sv: 'Förfaller', nb: 'Forfaller' }),
      dueValue: (days: number | string) => t({
        de: 'nur im Erfolgsfall, {days} Tage netto', en: 'only in case of success, {days} days net',
        sv: 'endast vid tillsättning, {days} dagar netto', nb: 'kun ved ansettelse, {days} dager netto',
      }, { days }),
      continuity: t({ de: 'Erneuter Suchlauf', en: 'Renewed search', sv: 'Ny sökning', nb: 'Nytt søk' }),
      continuityValue: (days: number | string) => t({
        de: 'bei Ausscheiden in den ersten {days} Tagen', en: 'if the person leaves within the first {days} days',
        sv: 'om personen slutar inom de första {days} dagarna', nb: 'hvis personen slutter i løpet av de første {days} dagene',
      }, { days }),
      agbVersion: t({ de: 'AGB-Fassung', en: 'Version of the terms and conditions', sv: 'Version av de allmänna villkoren', nb: 'Versjon av de alminnelige vilkårene' }),
      contractType: t({ de: 'Vertragsart', en: 'Contract type', sv: 'Avtalstyp', nb: 'Avtaletype' }),
      dayRate: t({ de: 'Tagessatz', en: 'Day rate', sv: 'Dagsarvode', nb: 'Dagsats' }),
    },
    /** Nur außerhalb des Deutschen: Die Contracting-Konditionen stehen im deutschen Wortlaut. */
    germanTermsNote: baseLang(lang) === 'de' ? '' : t({
      de: '',
      en: 'The terms below are shown in the German wording recorded with your request.',
      sv: 'Villkoren nedan visas i den tyska lydelse som har sparats med din förfrågan.',
      nb: 'Vilkårene nedenfor vises i den tyske ordlyden som er lagret med forespørselen din.',
    }),
    nextHeading: t({ de: 'Wie es weitergeht', en: 'What happens next', sv: 'Så går det vidare', nb: 'Slik går det videre' }),
    /** `number` (Rahmenvertrag, nur Contracting unter Rahmenvertrag) ist HTML (fett, escaped). */
    next: (number = '') => contracting
      ? (order
        ? t({
          de: 'Der Auftrag läuft unter Ihrem Rahmenvertrag {number}. Eine erneute Unterschrift ist nicht nötig. Wir sichten die Position und starten die Suche.',
          en: 'The order runs under your framework agreement {number}. No further signature is needed. We review the position and start the search.',
          sv: 'Uppdraget löper under ditt ramavtal {number}. Ingen ny underskrift behövs. Vi går igenom tjänsten och startar sökningen.',
          nb: 'Oppdraget løper under rammeavtalen din {number}. Ingen ny signatur er nødvendig. Vi går gjennom stillingen og starter søket.',
        }, { number })
        : t({
          de: 'Sie unterschreiben den Rahmenvertrag und die Auftragsbestätigung digital. Erst wenn beide Seiten unterzeichnet haben, starten wir die Suche.',
          en: 'You sign the framework agreement and the order confirmation digitally. We only start the search once both parties have signed.',
          sv: 'Du signerar ramavtalet och uppdragsbekräftelsen digitalt. Först när båda parter har undertecknat startar vi sökningen.',
          nb: 'Du signerer rammeavtalen og oppdragsbekreftelsen digitalt. Først når begge parter har signert, starter vi søket.',
        }))
      : (order
        ? t({
          de: 'Wir sichten die Position und starten die Suche. Sie hören von uns, sobald sie läuft.',
          en: 'We review the position and start the search. You will hear from us as soon as it is running.',
          sv: 'Vi går igenom tjänsten och startar sökningen. Du hör från oss så snart den är igång.',
          nb: 'Vi går gjennom stillingen og starter søket. Du hører fra oss så snart det er i gang.',
        })
        : t({
          de: 'Wir prüfen Ihre Anfrage und senden Ihnen anschließend den Vertrag zur digitalen Unterschrift zu. Erst wenn beide Seiten unterzeichnet haben, starten wir die Suche.',
          en: 'We review your request and then send you the contract for digital signature. We only start the search once both parties have signed.',
          sv: 'Vi går igenom din förfrågan och skickar sedan avtalet till dig för digital signering. Först när båda parter har undertecknat startar vi sökningen.',
          nb: 'Vi går gjennom forespørselen din og sender deg deretter avtalen til digital signering. Først når begge parter har signert, starter vi søket.',
        })),
    cta: t({ de: 'Anfrage ansehen', en: 'View request', sv: 'Visa förfrågan', nb: 'Se forespørselen' }),
    footnote: order
      ? (contracting
        ? t({
          de: 'Diese Bestätigung dokumentiert Ihre Auftragserteilung unter dem bestehenden Rahmenvertrag. Kosten entstehen erst ab dem ersten Einsatztag.',
          en: 'This confirmation documents that you placed the order under the existing framework agreement. Costs only arise from the first day of the assignment.',
          sv: 'Den här bekräftelsen dokumenterar att du har lagt uppdraget under det befintliga ramavtalet. Kostnader uppstår först från den första uppdragsdagen.',
          nb: 'Denne bekreftelsen dokumenterer at du har gitt oppdraget under den eksisterende rammeavtalen. Kostnader oppstår først fra første oppdragsdag.',
        })
        : t({
          de: 'Diese Bestätigung dokumentiert Ihre Auftragserteilung unter dem bestehenden Rahmenvertrag. Kosten entstehen ausschließlich im Erfolgsfall.',
          en: 'This confirmation documents that you placed the order under the existing framework agreement. Costs arise only in case of success.',
          sv: 'Den här bekräftelsen dokumenterar att du har lagt uppdraget under det befintliga ramavtalet. Kostnader uppstår endast vid tillsättning.',
          nb: 'Denne bekreftelsen dokumenterer at du har gitt oppdraget under den eksisterende rammeavtalen. Kostnader oppstår kun ved ansettelse.',
        }))
      : (contracting
        ? t({
          de: 'Diese Bestätigung dokumentiert den Eingang Ihrer Anfrage. Ein Vertrag kommt erst mit beidseitiger Unterschrift zustande. Bis dahin entstehen Ihnen keine Kosten.',
          en: 'This confirmation documents that we have received your request. A contract is only concluded once both parties have signed. Until then, you incur no costs.',
          sv: 'Den här bekräftelsen dokumenterar att vi har tagit emot din förfrågan. Ett avtal ingås först när båda parter har undertecknat. Fram till dess uppstår inga kostnader för dig.',
          nb: 'Denne bekreftelsen dokumenterer at vi har mottatt forespørselen din. En avtale inngås først når begge parter har signert. Frem til da påløper det ingen kostnader for deg.',
        })
        : t({
          de: 'Diese Bestätigung dokumentiert den Eingang Ihrer Anfrage. Ein Vertrag kommt erst mit unserer ausdrücklichen Annahme zustande. Bis dahin entstehen Ihnen keine Kosten.',
          en: 'This confirmation documents that we have received your request. A contract is only concluded once we expressly accept it. Until then, you incur no costs.',
          sv: 'Den här bekräftelsen dokumenterar att vi har tagit emot din förfrågan. Ett avtal ingås först när vi uttryckligen accepterar den. Fram till dess uppstår inga kostnader för dig.',
          nb: 'Denne bekreftelsen dokumenterer at vi har mottatt forespørselen din. En avtale inngås først når vi uttrykkelig aksepterer den. Frem til da påløper det ingen kostnader for deg.',
        })),
  };
}
