# Headhunter-Onboarding, Schritt 2 „Deine Angaben“: Plan

Stand 16.09.2026. Ziel: Der Headhunter tippt fast nichts. Er nennt seine Website
oder Firma, das System liest das Impressum, er bestätigt. Was der Vertrag an
Compliance braucht, kommt als kurze Karten mit klugen Vorgaben. Keine Dropdowns,
keine Formularwüste. Profilfragen für die Vermittlung erst nach der Freischaltung.

## Was heute stört (Sicht des Headhunters)

- Rund zwanzig Felder auf drei Unterseiten, davon zwölf Freitext-Pflichtfelder
  mit juristischen Namen („Drittlandprüfung / Übermittlungsgarantien“).
- Beim Website-Einstieg ist außer dem Namen nichts vorbelegt, der Satz „Bekannte
  Angaben sind bereits vorbereitet“ stimmt dort nicht.
- „Wer unterschreibt?“ fragt den Einzelrecruiter nach sich selbst.
- Rechtsform und Steuerstatus als Auswahl, obwohl beides aus Firmierung und
  USt-IdNr. folgt.
- Zwei Ja/Nein-Fragen (Einkünfte, Doppelrolle) sind Freitextfelder.

## Was der Vertrag wirklich braucht

Pflicht für jeden: Vertragspartner mit Rechtsform, Anschrift, Sitzland;
Register- oder Tätigkeitsnachweis; Steuerangaben (USt-IdNr. oder Steuernummer,
Kleinunternehmer ja/nein); unterzeichnende Person und ihre Berechtigung;
Datenschutz-Ansprechpartner; Zugriffsländer und Drittlandfrage; Erlaubnisse;
Einkommenskonzentration; Doppelrolle; Entscheidung zum Gutschriftverfahren.
Agentur zusätzlich: verantwortliche Person, Nutzer und Befugnisse, Versicherung
optional. Das Datenmodell bleibt, die Werte entstehen nur anders.

## Der neue Ablauf: vier Karten

**Karte 1 „Wer bist du?“**
Ein Feld: Website oder Firmenname. Bei Einladung schon gefüllt. Der Server
liest das Impressum (vorhandene Function `enrich-company-from-domain`, Firecrawl
plus KI über das Lovable-Gateway, wie in der Jobaufnahme) und zeigt eine Karte:
„Bluewater Bridge GmbH · Musterstraße 1, 20095 Hamburg · HRB 12345 ·
USt-IdNr. DE… · vertreten durch Marko Benko“. Darunter „Stimmt so“ oder je
Zeile ein Stift. Abgeleitet ohne Frage: Rechtsform aus der Firmierung, Sitzland
aus der Anschrift, Steuerstatus aus der USt-IdNr. Fehlt sie, eine einzige
Frage: „Kleinunternehmer?“ Ohne Website, etwa Einzelrecruiter ohne Firma: ein
Satz in eigenen Worten („Ich arbeite als selbstständiger Recruiter in Köln,
Steuernummer …“), die KI füllt die Felder, er bestätigt.

**Karte 2 „Du unterschreibst selbst?“**
Vorbelegt mit Ja, Name aus dem Konto, Funktion aus dem Impressum (Geschäftsführer,
Inhaber). Nur bei „Nein, jemand anderes“ erscheinen Name, E-Mail und Funktion
der anderen Person. Die Berechtigung ist bei Selbstunterzeichnung ein Satz
(„laut Impressum vertretungsberechtigt“), der Haken bleibt nur für Fremd-
unterzeichner. Ob der Satz juristisch reicht, entscheidet eure Rechtsprüfung.

**Karte 3 „Vier kurze Fragen“**
Jede Frage eine Zeile mit Vorgabe und zwei Antworten: „Ja, so ist es“ oder
„Anders“. Erst bei „Anders“ öffnet sich ein Feld.
- „Du greifst nur aus Deutschland oder der EU auf Kandidatendaten zu?“
  Vorgabe aus dem Sitzland. Ergebnis: Zugriffsländer und „Keine Drittlandzugriffe“.
- „Du vermittelst nur, keine Arbeitnehmerüberlassung?“ Vorgabe Ja. Ergebnis:
  „Keine Erlaubnis erforderlich“.
- „Matchunt wird weniger als die Hälfte deiner Einkünfte ausmachen?“ Vorgabe Ja.
- „Du bist an keinem Unternehmen beteiligt, das Kunde von Matchunt sein könnte?“
  Vorgabe Ja. Ergebnis: Doppelrolle „Keine“.
Dazu ohne Frage: Datenschutz-Ansprechpartner ist die Person selbst, bei Agenturen
der Datenschutzbeauftragte aus dem Impressum. Gutschriftverfahren mit einem
Satz erklärt („Wir rechnen per Gutschrift ab, du schreibst keine Rechnung“),
Vorgabe Ja, abwählbar.

**Karte 4 „So steht es im Vertrag“**
Zusammenfassung in der Form des späteren Datenblatts, Stift je Zeile, ein
Knopf „Angaben bestätigen“. Danach wie heute die Prüfung durch Matchunt.

Agentur: Karte 1 fragt zusätzlich „Wer arbeitet bei euch damit?“ (Name, E-Mail,
Befugnis je Person), Versicherungsnachweis später als Upload, nicht hier.

## Modern und dynamisch, konkret

- Eine Karte nach der anderen, Erledigtes bleibt eingeklappt sichtbar, Fortschritt
  oben. Entwurf speichert automatisch (die Aktion `save` existiert).
- Keine Dropdowns. Text, wo etwas neu ist; Vorgabe mit „Stimmt“ oder „Anders“,
  wo das System es weiß.
- Herkunft sichtbar: „aus deinem Impressum übernommen“ als kleiner Hinweis, damit
  der Headhunter weiß, warum es schon dasteht, und Matchunt in der Prüfung sieht,
  woher die Angabe kommt.
- Handy zuerst: eine Spalte, große Knöpfe, die Karten funktionieren mit dem Daumen.

## Was Matchunt sonst noch braucht, und wann

Für den Vertrag fehlt nichts. Für die Vermittlung fehlt heute:
Branchen und Funktionen, Regionen, Sprachen, Kapazität (parallele Suchen),
Erfahrung (Jahre, Platzierungen pro Jahr), Arbeitsweise (Active Sourcing,
eigener Pool), LinkedIn-Profil, Foto (Zustimmung existiert schon).
Empfehlung: nicht vor dem Vertrag. Als „Dein Profil“ beim ersten Dashboard-Login,
mit sichtbarem Nutzen: „damit du sofort passende Positionen siehst“. Schwerpunkt
und Region aus der Einladung bleiben als Vorbelegung erhalten.

## Technik, ohne Migration

- Neue Aktion `enrich` in `recruiter-onboarding` (nur mit bestätigter Sitzung,
  Rate-Limit je Konto): nimmt Website oder Firmenname, ruft
  `enrich-company-from-domain`, mappt das Ergebnis in `RecruiterProfile` und die
  Vertragsfelder (Registerangaben, Steuerangaben, verantwortliche Person,
  Berechtigung, Datenschutzkontakt). Rohseiten werden nicht gespeichert.
- Freitext-Karte ohne Website: kleine KI-Auswertung über dasselbe Gateway,
  Ergebnis wieder nur als Vorschlag, der bestätigt wird.
- Frontend: `RecruiterProfileForm.tsx` wird zum Kartenfluss; `ContractDetailsFields`
  geht in Karte 3 auf. Die vier Fragen schreiben die heutigen Textwerte, die
  Vertragsvorlagen und die Admin-Prüfung bleiben unverändert.
- Vorschau-Seite und Tests wie beim Code-Schritt.

Aufwand grob: Backend ein halber Tag, Kartenfluss anderthalb bis zwei Tage,
Tests und Vorschau ein halber Tag. Deploy: Function und Frontend, keine Migration.

## Entscheidungen

1. Impressum-Lesen über die vorhandene Function einbauen? Kostet je Aufruf
   Firecrawl und KI, wie in der Jobaufnahme. Empfehlung: ja.
2. Profilfragen nach der Freischaltung statt davor? Empfehlung: ja.
3. Gutschriftverfahren mit Vorgabe Ja? Empfehlung: ja, mit Ein-Satz-Erklärung.
4. Berechtigung bei Selbstunterzeichnung als Satz statt Haken: Freigabe durch
   eure Rechtsprüfung nötig.
5. Reihenfolge: Karten 1 und 2 zuerst (größter Effekt), Karte 3 und 4 danach?
