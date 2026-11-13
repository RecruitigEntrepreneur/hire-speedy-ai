import { baseLang, intlLocale, swiss, tr, type Lang, type Texts } from './i18n.ts';

/**
 * Texte des Headhunter-Einstiegs je Sprache: Servermeldungen und Mails.
 *
 * Deutsch ist wortgleich der Stand vor der Mehrsprachigkeit. Anrede: Deutsch
 * „du“ (die Einladungsmail siezt wie bisher), Englisch „you“, Schwedisch und
 * Norwegisch „du“. Fachbegriffe: Rahmenvertrag = framework agreement / ramavtal /
 * rammeavtale; Anlage = annex / bilaga / vedlegg; Gegenzeichnung =
 * countersignature / kontrasignering.
 *
 * Die Vertragsdokumente selbst (recruiter-contract-templates.ts, recruiter-pdf.ts,
 * DocuSign-Inhalte) werden hier NICHT übersetzt: das ist Sache des Anwalts.
 */

// ── Servermeldungen ─────────────────────────────────────────────────────────
// Die Functions werfen ihre Meldungen weiter auf Deutsch (must(...)). Übersetzt
// wird an einer Stelle, kurz vor der Antwort: deutscher Wortlaut → [en, sv, nb].
// Eine Meldung, die hier fehlt, geht auf Deutsch raus statt gar nicht.
const MESSAGES: Record<string, [string, string, string]> = {
  // recruiter-onboarding/index.ts
  'Bitte POST verwenden.': ['Please use POST.', 'Använd POST.', 'Bruk POST.'],
  'Ungültiger Einladungslink.': ['This invitation link is not valid.', 'Inbjudningslänken är ogiltig.', 'Invitasjonslenken er ugyldig.'],
  'Diese Einladung ist für ein anderes bestätigtes E-Mail-Konto bestimmt oder nicht mehr gültig.': [
    'This invitation is meant for a different confirmed email account or is no longer valid.',
    'Den här inbjudan gäller ett annat bekräftat e-postkonto eller är inte längre giltig.',
    'Denne invitasjonen gjelder en annen bekreftet e-postkonto eller er ikke lenger gyldig.'],
  'Keine Berechtigung für diesen Onboarding-Vorgang.': ['You do not have access to this onboarding.', 'Du har inte åtkomst till den här onboardingen.', 'Du har ikke tilgang til denne onboardingen.'],
  'Diese Einladung wurde widerrufen.': ['This invitation has been withdrawn.', 'Den här inbjudan har dragits tillbaka.', 'Denne invitasjonen er trukket tilbake.'],
  'Die Einladung ist abgelaufen oder bereits zugeordnet.': ['The invitation has expired or is already in use.', 'Inbjudan har gått ut eller används redan.', 'Invitasjonen er utløpt eller allerede i bruk.'],
  'Keine Berechtigung.': ['You do not have access.', 'Du har inte åtkomst.', 'Du har ikke tilgang.'],
  'Der Vorgang wurde inzwischen geändert. Bitte neu laden.': ['This has been changed in the meantime. Please reload.', 'Uppgifterna har ändrats under tiden. Ladda om sidan.', 'Dette er endret i mellomtiden. Last inn siden på nytt.'],
  'Die Angaben sind bereits zur Prüfung eingereicht.': ['Your details have already been submitted for review.', 'Uppgifterna har redan skickats in för granskning.', 'Opplysningene er allerede sendt inn til kontroll.'],
  'Der Signaturzugang gehört ausschließlich der benannten unterzeichnenden Person und muss noch offen sein.': [
    'Only the named signatory can open the signature, and it must still be open.',
    'Bara den angivna undertecknaren kan öppna signeringen, och den måste fortfarande vara öppen.',
    'Bare den oppgitte underskriveren kan åpne signeringen, og den må fortsatt være åpen.'],
  'Dokument noch nicht verfügbar.': ['The document is not available yet.', 'Dokumentet är inte tillgängligt ännu.', 'Dokumentet er ikke tilgjengelig ennå.'],
  'Unbekannte Aktion.': ['Unknown action.', 'Okänd åtgärd.', 'Ukjent handling.'],
  // recruiter-onboarding-service.ts
  'Die Recruiter-Onboarding-Migration ist noch nicht installiert.': ['This service is not set up yet.', 'Tjänsten är inte inrättad ännu.', 'Tjenesten er ikke satt opp ennå.'],
  'Der Vorgang konnte nicht gespeichert werden.': ['This could not be saved.', 'Det gick inte att spara.', 'Dette kunne ikke lagres.'],
  'Die Anfrage konnte nicht abgeschlossen werden. Bitte den gespeicherten Stand neu laden.': [
    'The request could not be completed. Please reload the saved version.',
    'Begäran kunde inte slutföras. Ladda om den sparade versionen.',
    'Forespørselen kunne ikke fullføres. Last inn den lagrede versjonen på nytt.'],
  'Bitte anmelden und die E-Mail-Adresse bestätigen.': ['Please sign in and confirm your email address.', 'Logga in och bekräfta din e-postadress.', 'Logg inn og bekreft e-postadressen din.'],
  'Ungültiger Vorgang.': ['This onboarding is not valid.', 'Ogiltigt ärende.', 'Ugyldig sak.'],
  'Vorgang nicht gefunden.': ['Onboarding not found.', 'Ärendet hittades inte.', 'Saken ble ikke funnet.'],
  'Ungültiger Vertragsvorgang.': ['This contract is not valid.', 'Ogiltigt avtalsärende.', 'Ugyldig avtalesak.'],
  'Vertragsvorgang nicht gefunden.': ['Contract not found.', 'Avtalet hittades inte.', 'Avtalen ble ikke funnet.'],
  'Der Vertragsvorgang wurde inzwischen geändert. Bitte neu laden.': ['The contract has been changed in the meantime. Please reload.', 'Avtalet har ändrats under tiden. Ladda om sidan.', 'Avtalen er endret i mellomtiden. Last inn siden på nytt.'],
  'DocuSign für Recruiter ist noch nicht eingerichtet.': ['Signing with DocuSign is not set up yet.', 'Signering med DocuSign är inte inrättad ännu.', 'Signering med DocuSign er ikke satt opp ennå.'],
  'Noch kein DocuSign-Umschlag vorhanden.': ['There is no DocuSign envelope yet.', 'Det finns inget DocuSign-kuvert ännu.', 'Det finnes ingen DocuSign-konvolutt ennå.'],
  'DocuSign hat keinen gültigen PDF-Nachweis geliefert.': ['DocuSign did not return a valid PDF.', 'DocuSign levererade ingen giltig PDF.', 'DocuSign leverte ingen gyldig PDF.'],
  // recruiter-code.ts
  'Dieser Einladungslink ist ungültig.': ['This invitation link is not valid.', 'Den här inbjudningslänken är ogiltig.', 'Denne invitasjonslenken er ugyldig.'],
  'Dieser Link ist abgelaufen. Gib deine E-Mail-Adresse ein, wir schicken dir einen Code.': [
    'This link has expired. Enter your email address and we will send you a code.',
    'Den här länken har gått ut. Ange din e-postadress så skickar vi en kod.',
    'Denne lenken er utløpt. Skriv inn e-postadressen din, så sender vi deg en kode.'],
  'Dieser Link funktioniert nicht mehr. Gib deine E-Mail-Adresse ein, wir schicken dir einen Code.': [
    'This link no longer works. Enter your email address and we will send you a code.',
    'Den här länken fungerar inte längre. Ange din e-postadress så skickar vi en kod.',
    'Denne lenken virker ikke lenger. Skriv inn e-postadressen din, så sender vi deg en kode.'],
  'Dieser Einladungslink wurde zurückgezogen. Sag uns kurz Bescheid, dann bekommst du einen neuen.': [
    'This invitation link has been withdrawn. Let us know and we will send you a new one.',
    'Den här inbjudningslänken har dragits tillbaka. Hör av dig så får du en ny.',
    'Denne invitasjonslenken er trukket tilbake. Gi oss beskjed, så får du en ny.'],
  'Dein Einladungslink ist abgelaufen. Sag uns kurz Bescheid, wir schicken dir einen neuen.': [
    'Your invitation link has expired. Let us know and we will send you a new one.',
    'Din inbjudningslänk har gått ut. Hör av dig så skickar vi en ny.',
    'Invitasjonslenken din er utløpt. Gi oss beskjed, så sender vi deg en ny.'],
  'Bitte gib eine gültige E-Mail-Adresse an.': ['Please enter a valid email address.', 'Ange en giltig e-postadress.', 'Skriv inn en gyldig e-postadresse.'],
  'Der Zugang konnte nicht vorbereitet werden. Bitte versuche es gleich noch einmal.': [
    'Your access could not be prepared. Please try again in a moment.',
    'Det gick inte att förbereda din åtkomst. Försök igen om en stund.',
    'Tilgangen din kunne ikke klargjøres. Prøv igjen om et øyeblikk.'],
  'Gerade wurden mehrere Codes angefordert. Bitte versuche es in einigen Minuten erneut.': [
    'Several codes were requested just now. Please try again in a few minutes.',
    'Flera koder har just begärts. Försök igen om några minuter.',
    'Det er nettopp bedt om flere koder. Prøv igjen om noen minutter.'],
  'Der Code konnte nicht erzeugt werden. Bitte versuche es gleich noch einmal.': [
    'The code could not be created. Please try again in a moment.',
    'Koden kunde inte skapas. Försök igen om en stund.',
    'Koden kunne ikke opprettes. Prøv igjen om et øyeblikk.'],
  'Der Code konnte nicht versendet werden. Bitte versuche es gleich noch einmal.': [
    'The code could not be sent. Please try again in a moment.',
    'Koden kunde inte skickas. Försök igen om en stund.',
    'Koden kunne ikke sendes. Prøv igjen om et øyeblikk.'],
  'Bitte gib den sechsstelligen Code aus der E-Mail ein.': ['Please enter the six-digit code from the email.', 'Ange den sexsiffriga koden från mejlet.', 'Skriv inn den sekssifrede koden fra e-posten.'],
  'Die Anmeldung ist noch nicht eingerichtet.': ['Sign-in is not set up yet.', 'Inloggningen är inte inrättad ännu.', 'Påloggingen er ikke satt opp ennå.'],
  'Zu viele Versuche. Warte einen Moment und fordere dann einen neuen Code an.': [
    'Too many attempts. Wait a moment, then request a new code.',
    'För många försök. Vänta en stund och begär sedan en ny kod.',
    'For mange forsøk. Vent litt, og be deretter om en ny kode.'],
  'Der Code ist falsch oder abgelaufen. Fordere einfach einen neuen an.': [
    'The code is wrong or has expired. Simply request a new one.',
    'Koden är fel eller har gått ut. Begär bara en ny.',
    'Koden er feil eller utløpt. Bare be om en ny.'],
  'Zu oft falsch eingegeben. Fordere bitte einen neuen Code an.': [
    'Entered incorrectly too many times. Please request a new code.',
    'Fel kod har angetts för många gånger. Begär en ny kod.',
    'Feil kode er skrevet inn for mange ganger. Be om en ny kode.'],
  'Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es gleich noch einmal.': [
    'Sign-in could not be completed. Please try again in a moment.',
    'Inloggningen kunde inte slutföras. Försök igen om en stund.',
    'Påloggingen kunne ikke fullføres. Prøv igjen om et øyeblikk.'],
  'Die Anmeldung konnte nicht abgeschlossen werden. Bitte fordere einen neuen Code an.': [
    'Sign-in could not be completed. Please request a new code.',
    'Inloggningen kunde inte slutföras. Begär en ny kod.',
    'Påloggingen kunne ikke fullføres. Be om en ny kode.'],
  // recruiter-entry.ts
  'Bitte die E-Mail-Adresse bestätigen.': ['Please confirm your email address.', 'Bekräfta din e-postadress.', 'Bekreft e-postadressen din.'],
  'Bitte Einzelrecruiter oder Agentur auswählen.': ['Please choose individual recruiter or agency.', 'Välj enskild rekryterare eller byrå.', 'Velg enkeltrekrutterer eller byrå.'],
  'Für diesen Einstieg benötigen Sie ein Recruiter-Konto.': ['You need a recruiter account to start here.', 'Du behöver ett rekryterarkonto för att börja här.', 'Du trenger en rekruttererkonto for å starte her.'],
  // recruiter-enrich.ts
  'Das sieht nicht nach einer Website aus. Bitte prüfe die Adresse.': ['That does not look like a website. Please check the address.', 'Det ser inte ut som en webbplats. Kontrollera adressen.', 'Det ser ikke ut som et nettsted. Sjekk adressen.'],
  'Bitte gib die Website deines Unternehmens an.': ['Please enter your company website.', 'Ange ditt företags webbplats.', 'Oppgi nettstedet til firmaet ditt.'],
  'Gerade viele Anfragen. Bitte versuche es in ein paar Minuten noch einmal.': ['Many requests right now. Please try again in a few minutes.', 'Många förfrågningar just nu. Försök igen om några minuter.', 'Mange forespørsler akkurat nå. Prøv igjen om noen minutter.'],
  'Das Lesen der Website ist noch nicht eingerichtet.': ['Reading the website is not set up yet.', 'Läsning av webbplatsen är inte inrättad ännu.', 'Lesing av nettstedet er ikke satt opp ennå.'],
  'Wir konnten die Website gerade nicht lesen. Trag die Angaben bitte selbst ein.': [
    'We could not read the website just now. Please enter the details yourself.',
    'Vi kunde inte läsa webbplatsen just nu. Fyll i uppgifterna själv.',
    'Vi klarte ikke å lese nettstedet akkurat nå. Fyll inn opplysningene selv.'],
  'Wir konnten deine Website gerade nicht lesen. Trag die Angaben bitte selbst ein.': [
    'We could not read your website just now. Please enter the details yourself.',
    'Vi kunde inte läsa din webbplats just nu. Fyll i uppgifterna själv.',
    'Vi klarte ikke å lese nettstedet ditt akkurat nå. Fyll inn opplysningene selv.'],
  'Auf der Website haben wir kein Impressum gefunden. Trag die Angaben bitte selbst ein.': [
    'We did not find a legal notice on the website. Please enter the details yourself.',
    'Vi hittade inga företagsuppgifter på webbplatsen. Fyll i uppgifterna själv.',
    'Vi fant ingen firmaopplysninger på nettstedet. Fyll inn opplysningene selv.'],
  // recruiter-package.ts, recruiter-envelope-send.ts
  'Bitte zuerst die Vertragsdaten bestätigen.': ['Please confirm your contract details first.', 'Bekräfta först dina avtalsuppgifter.', 'Bekreft avtaleopplysningene dine først.'],
  'Die zugeordnete Vertragsfassung muss vom Matchunt-Team aktualisiert werden.': [
    'The Matchunt team has to update the contract version assigned to you.',
    'Matchunt-teamet behöver uppdatera den avtalsversion som gäller för dig.',
    'Matchunt-teamet må oppdatere avtaleversjonen som gjelder for deg.'],
  'Recruiter und Matchunt benötigen getrennte Unterzeichner.': [
    'Recruiter and Matchunt need different signatories.',
    'Rekryteraren och Matchunt behöver olika undertecknare.',
    'Rekruttereren og Matchunt trenger ulike underskrivere.'],
  'Dieser Vertragsvorgang ist geschlossen.': ['This contract is closed.', 'Det här avtalsärendet är avslutat.', 'Denne avtalesaken er avsluttet.'],
  // recruiter-contract-policy.ts (profileIssues)
  'Vertragsdaten bitte vollständig ergänzen.': ['Please complete your contract details.', 'Fyll i avtalsuppgifterna fullständigt.', 'Fyll ut avtaleopplysningene fullstendig.'],
  'E-Mail der unterzeichnenden Person fehlt.': ['The email address of the signatory is missing.', 'E-postadressen till undertecknaren saknas.', 'E-postadressen til underskriveren mangler.'],
  'Vertretungsberechtigung bitte angeben.': ['Please state the authority to sign.', 'Ange firmateckningsrätten.', 'Oppgi signaturretten.'],
  'Steuerstatus ist noch offen.': ['The tax status is still open.', 'Skattestatus är inte angiven ännu.', 'Skattestatus er ikke oppgitt ennå.'],
};

// Meldungen mit Uhrzeit oder Statuscode.
const PATTERNS: [RegExp, Texts][] = [
  [/^Gerade wurden mehrere Codes angefordert\. Ein neuer Code ist ab (\d{1,2}:\d{2}) Uhr möglich\. Ein schon erhaltener Code lässt sich weiterhin eintragen\.$/, {
    de: '',
    en: 'Several codes were requested just now. A new code is possible from {1} (German time). A code you already received can still be entered.',
    sv: 'Flera koder har just begärts. En ny kod kan begäras från kl. {1}. En kod du redan har fått går fortfarande att ange.',
    nb: 'Det er nettopp bedt om flere koder. Du kan be om en ny kode fra kl. {1}. En kode du allerede har fått, kan fortsatt brukes.',
  }],
  [/^DocuSign konnte die Anfrage nicht abschließen \((\d+)\)\.$/, {
    de: '',
    en: 'DocuSign could not complete the request ({1}).',
    sv: 'DocuSign kunde inte slutföra begäran ({1}).',
    nb: 'DocuSign kunne ikke fullføre forespørselen ({1}).',
  }],
];

/**
 * Servermeldung in der Sprache der Person. Ohne `lang` unverändert (Deutsch wie
 * bisher); de-CH ohne Eszett; unbekannte Meldungen bleiben deutsch.
 */
export function localizeMessage(lang: Lang | null | undefined, message: string): string {
  if (!lang) return message;
  const base = baseLang(lang);
  if (base === 'de') return lang === 'de-CH' ? swiss(message) : message;
  const index = base === 'en' ? 0 : base === 'sv' ? 1 : 2;
  const known = MESSAGES[message];
  if (known) return known[index];
  for (const [pattern, texts] of PATTERNS) {
    const m = pattern.exec(message);
    if (m && texts[base]) return texts[base]!.replace(/\{(\d)\}/g, (_all, n) => m[Number(n)] ?? '');
  }
  return message;
}

/** Für Tests: alle deutschen Meldungen, die eine Übersetzung haben. */
export const TRANSLATED_MESSAGES = Object.keys(MESSAGES);

// ── Mails an den Headhunter ─────────────────────────────────────────────────

/** Code-Mail (recruiter-code.ts). `name` und `code` setzt der Aufrufer escaped ein. */
export function codeMailTexts(lang: Lang | null | undefined, input: { code: string; login: boolean }) {
  const t = (texts: Texts, vars?: Record<string, string | number>) => tr(lang, texts, vars);
  return {
    subject: t({ de: '{code} ist dein Matchunt-Code', en: '{code} is your Matchunt code', sv: '{code} är din Matchunt-kod', nb: '{code} er Matchunt-koden din' }, { code: input.code }),
    preheader: t({ de: 'Dein Code: {code}', en: 'Your code: {code}', sv: 'Din kod: {code}', nb: 'Koden din: {code}' }, { code: input.code }),
    heading: input.login
      ? t({ de: 'Dein Anmeldecode', en: 'Your sign-in code', sv: 'Din inloggningskod', nb: 'Påloggingskoden din' })
      : t({ de: 'Dein Code für Matchunt', en: 'Your code for Matchunt', sv: 'Din kod till Matchunt', nb: 'Koden din til Matchunt' }),
    /** Anrede ohne Namen; der Aufrufer hängt „ Vorname“ vor dem Komma an. */
    hello: t({ de: 'Hallo', en: 'Hello', sv: 'Hej', nb: 'Hei' }),
    intro: input.login
      ? t({ de: 'mit diesem Code meldest du dich bei Matchunt an, ganz ohne Passwort:', en: 'use this code to sign in to Matchunt, no password needed:', sv: 'här är din kod.', nb: 'her er koden din.' })
      : t({ de: 'mit diesem Code bestätigst du deine E-Mail-Adresse, ganz ohne Passwort:', en: 'use this code to confirm your email address, no password needed:', sv: 'här är din kod.', nb: 'her er koden din.' }),
    validity: t({
      de: 'Der Code ist eine Stunde gültig. Danach fordere auf der Seite einfach einen neuen an.',
      en: 'The code is valid for one hour. After that, simply request a new one on the page.',
      sv: 'Den gäller i en timme. Därefter begär du bara en ny på sidan.',
      nb: 'Den gjelder i én time. Etterpå ber du bare om en ny på siden.',
    }),
    footnote: t({
      de: 'Wenn du gerade nichts bei Matchunt gestartet hast, ignoriere diese Nachricht. Gib den Code nicht weiter.',
      en: 'If you did not just start something at Matchunt, ignore this message. Do not share the code.',
      sv: 'Om du inte just har påbörjat något hos Matchunt kan du bortse från det här meddelandet. Dela inte koden med någon.',
      nb: 'Hvis du ikke nettopp har startet noe hos Matchunt, kan du se bort fra denne meldingen. Ikke del koden med noen.',
    }),
  };
}

/** Namen der Rechtsseiten im Fuß der Mails. */
export function legalLinkTexts(lang: Lang | null | undefined) {
  return {
    imprint: tr(lang, { de: 'Impressum', en: 'Legal notice', sv: 'Företagsuppgifter', nb: 'Firmaopplysninger' }),
    privacy: tr(lang, { de: 'Datenschutz', en: 'Privacy', sv: 'Integritetspolicy', nb: 'Personvern' }),
  };
}

/** Einladungsmail mit persönlichem Link (recruiter-onboarding-admin: mail, reissue). */
export function invitationMailTexts(lang: Lang | null | undefined, input: { expiresAt: string }) {
  const t = (texts: Texts, vars?: Record<string, string | number>) => tr(lang, texts, vars);
  const date = new Date(input.expiresAt).toLocaleDateString(intlLocale(lang), { timeZone: 'Europe/Berlin' });
  return {
    subject: t({ de: 'Ihre Einladung zum Matchunt Recruiter-Netzwerk', en: 'Your invitation to the Matchunt recruiter network', sv: 'Din inbjudan till Matchunts rekryterarnätverk', nb: 'Din invitasjon til Matchunts rekrutterernettverk' }),
    preheader: t({ de: 'Ihr persönlicher Einstieg bei Matchunt', en: 'Your personal way into Matchunt', sv: 'Din personliga väg in till Matchunt', nb: 'Din personlige vei inn til Matchunt' }),
    heading: t({ de: 'Willkommen bei Matchunt', en: 'Welcome to Matchunt', sv: 'Välkommen till Matchunt', nb: 'Velkommen til Matchunt' }),
    /** Anrede ohne Namen. Deutsch mit vollem Namen wie bisher, sonst mit Vornamen. */
    hello: t({ de: 'Guten Tag', en: 'Hello', sv: 'Hej', nb: 'Hei' }),
    firstNameOnly: baseLang(lang) !== 'de',
    lead: t({
      de: 'wir freuen uns, die Zusammenarbeit mit Ihnen vorzubereiten.',
      en: 'we are looking forward to working with you and would like to set everything up.',
      sv: 'vi ser fram emot att förbereda samarbetet med dig.',
      nb: 'vi ser frem til å forberede samarbeidet med deg.',
    }),
    link: t({
      de: 'Über Ihren persönlichen Link können Sie Ihre bereits hinterlegten Angaben prüfen, ergänzen und den Vertragsprozess starten. Bitte verwenden Sie dafür die E-Mail-Adresse, an die diese Einladung gesendet wurde.',
      en: 'With your personal link you can check and complete the details we already have on file and start the contract process. Please use the email address this invitation was sent to.',
      sv: 'Via din personliga länk kan du kontrollera och komplettera de uppgifter vi redan har och starta avtalsprocessen. Använd den e-postadress som den här inbjudan skickades till.',
      nb: 'Med den personlige lenken din kan du kontrollere og utfylle opplysningene vi allerede har, og starte avtaleprosessen. Bruk e-postadressen denne invitasjonen ble sendt til.',
    }),
    process: t({
      de: 'Nach Bestätigung Ihrer Angaben wird Ihr persönliches Vertragspaket erstellt. Sie können es direkt mit DocuSign prüfen und unterschreiben. Anschließend prüft Matchunt Ihre Unterlagen und zeichnet ausdrücklich gegen. Danach informieren wir Sie über die Freischaltung.',
      en: 'Once you have confirmed your details, we prepare your personal contract package. You can review and sign it right away with DocuSign. Matchunt then reviews your documents and countersigns. After that we let you know that your access is active.',
      sv: 'När du har bekräftat dina uppgifter tar vi fram ditt personliga avtalspaket. Du kan granska och signera det direkt med DocuSign. Därefter granskar Matchunt dina underlag och kontrasignerar. Sedan hör vi av oss när din åtkomst är aktiverad.',
      nb: 'Når du har bekreftet opplysningene dine, lager vi din personlige avtalepakke. Du kan lese gjennom og signere den direkte med DocuSign. Deretter går Matchunt gjennom dokumentene dine og kontrasignerer. Så gir vi deg beskjed når tilgangen din er aktivert.',
    }),
    questions: t({
      de: 'Bei Fragen antworten Sie gern direkt auf diese Nachricht.',
      en: 'If you have any questions, just reply to this message.',
      sv: 'Har du frågor? Svara bara på det här meddelandet.',
      nb: 'Har du spørsmål? Bare svar på denne meldingen.',
    }),
    /** HTML (Zeilenumbruch). */
    regards: t({ de: 'Mit freundlichen Grüßen<br>Ihr Matchunt-Team', en: 'Kind regards<br>Your Matchunt team', sv: 'Vänliga hälsningar<br>Ditt Matchunt-team', nb: 'Vennlig hilsen<br>Matchunt-teamet' }),
    cta: t({ de: 'Persönliches Onboarding starten', en: 'Start your onboarding', sv: 'Starta din onboarding', nb: 'Start onboardingen din' }),
    /** Vor den Links zu Impressum und Datenschutz; das Datum ist schon eingesetzt. */
    validUntil: t({
      de: 'Dieser persönliche Link ist bis {date} gültig. Bitte nicht weiterleiten.',
      en: 'This personal link is valid until {date}. Please do not forward it.',
      sv: 'Den här personliga länken gäller till och med {date}. Vidarebefordra den inte.',
      nb: 'Denne personlige lenken er gyldig til og med {date}. Ikke videresend den.',
    }, { date }),
    ...legalLinkTexts(lang),
  };
}

/** Willkommensmail nach der Gegenzeichnung (recruiter-activation.ts). */
export function welcomeMailTexts(lang: Lang | null | undefined, input: { days: number }) {
  const t = (texts: Texts, vars?: Record<string, string | number>) => tr(lang, texts, vars);
  return {
    subject: t({ de: 'Dein Vertrag ist komplett – willkommen bei Matchunt', en: 'Your contract is complete – welcome to Matchunt', sv: 'Ditt avtal är klart – välkommen till Matchunt', nb: 'Avtalen din er komplett – velkommen til Matchunt' }),
    preheader: t({ de: 'Dein Zugang ist frei. In zwei Minuten bist du drin.', en: 'Your access is active. You will be in within two minutes.', sv: 'Din åtkomst är aktiverad. Du är inne på två minuter.', nb: 'Tilgangen din er aktivert. Du er inne på to minutter.' }),
    heading: t({ de: 'Willkommen im Netzwerk', en: 'Welcome to the network', sv: 'Välkommen till nätverket', nb: 'Velkommen til nettverket' }),
    hello: t({ de: 'Hallo', en: 'Hello', sv: 'Hej', nb: 'Hei' }),
    lead: t({
      de: 'wir haben deinen Vertrag gegengezeichnet. Er ist jetzt komplett, und dein Zugang ist freigeschaltet.',
      en: 'we have countersigned your contract. It is now complete, and your access is active.',
      sv: 'vi har kontrasignerat ditt avtal. Det är nu komplett och din åtkomst är aktiverad.',
      nb: 'vi har kontrasignert avtalen din. Den er nå komplett, og tilgangen din er aktivert.',
    }),
    how: t({ de: 'So kommst du rein:', en: 'How to get in:', sv: 'Så kommer du in:', nb: 'Slik kommer du inn:' }),
    stepLink: t({ de: 'Tippe auf „Jetzt anmelden“.', en: 'Tap “Sign in now”.', sv: 'Tryck på ”Logga in nu”.', nb: 'Trykk på «Logg inn nå».' }),
    stepAddress: t({
      de: 'Tippe auf „Jetzt anmelden“ und gib deine E-Mail-Adresse ein.',
      en: 'Tap “Sign in now” and enter your email address.',
      sv: 'Tryck på ”Logga in nu” och ange din e-postadress.',
      nb: 'Trykk på «Logg inn nå» og skriv inn e-postadressen din.',
    }),
    stepCode: t({ de: 'Bestätige mit dem Code, den wir dir dann schicken.', en: 'Confirm with the code we then send you.', sv: 'Bekräfta med koden som vi då skickar till dig.', nb: 'Bekreft med koden vi da sender deg.' }),
    stepPassword: t({
      de: 'Leg dein Passwort fest. Dann bist du in deinem Dashboard, und ein kurzer Rundgang zeigt dir das Wichtigste.',
      en: 'Set your password. Then you are in your dashboard, and a short tour shows you the essentials.',
      sv: 'Välj ditt lösenord. Sedan är du i din dashboard, och en kort rundtur visar det viktigaste.',
      nb: 'Velg passordet ditt. Da er du i dashbordet ditt, og en kort omvisning viser deg det viktigste.',
    }),
    cta: t({ de: 'Jetzt anmelden', en: 'Sign in now', sv: 'Logga in nu', nb: 'Logg inn nå' }),
    linkValid: t({
      de: 'Der Link ist persönlich und {days} Tage gültig.',
      en: 'The link is personal and valid for {days} days.',
      sv: 'Länken är personlig och gäller i {days} dagar.',
      nb: 'Lenken er personlig og gyldig i {days} dager.',
    }, { days: input.days }),
    questions: t({
      de: 'Bei Fragen antworte einfach auf diese Mail.',
      en: 'If you have any questions, just reply to this email.',
      sv: 'Har du frågor? Svara bara på det här mejlet.',
      nb: 'Har du spørsmål? Bare svar på denne e-posten.',
    }),
    /** HTML (Zeilenumbruch). */
    regards: t({ de: 'Viele Grüße<br>dein Matchunt-Team', en: 'Best regards<br>Your Matchunt team', sv: 'Vänliga hälsningar<br>Ditt Matchunt-team', nb: 'Vennlig hilsen<br>Matchunt-teamet' }),
    ...legalLinkTexts(lang),
  };
}
