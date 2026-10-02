# Interview-Terminierung: Microsoft einrichten (Outlook + Teams)

Stand 02.10.2026. Ohne diese Einrichtung funktioniert die neue Terminierung trotzdem:
Anfrage, Kandidatenseite, andere Zeit, Bestätigung, Kalendereinladungen per Mail.
Es fehlen dann nur frei/belegt aus Outlook und der automatische Teams-Link.

Dauer: etwa 20 Minuten für Teil A, 15 Minuten für Teil B. Teil D (Herausgeber-Prüfung)
erst vor den ersten echten Kunden außerhalb eures eigenen Microsoft-Mandanten.

---

## A — App bei Microsoft registrieren (Pflicht für Outlook)

Mit einem Konto, das in eurem Microsoft 365 **Anwendungsadministrator** oder **globaler
Administrator** ist (z. B. das Bluewater-Konto):

1. <https://entra.microsoft.com> → **Identität › Anwendungen › App-Registrierungen** →
   **Neue Registrierung**.
   - Name: `Matchunt Kalender`
   - Unterstützte Kontotypen: **Konten in einem beliebigen Organisationsverzeichnis
     (mehrinstanzenfähig)**
   - Umleitungs-URI: Plattform **Web**,
     `https://dngycrrhbnwdohbftpzq.supabase.co/functions/v1/calendar-oauth-callback`
   - **Registrieren**.
2. Auf der Übersichtsseite notieren:
   - **Anwendungs-ID (Client)** → Secret `MS_CLIENT_ID`
   - **Verzeichnis-ID (Mandant)** → Secret `MS_APP_TENANT_ID` (nur für Teil B nötig)
3. **Zertifikate & Geheimnisse › Neuer geheimer Clientschlüssel**, Laufzeit 24 Monate.
   Den **Wert** (nicht die ID) sofort kopieren → Secret `MS_CLIENT_SECRET`.
   Erinnerung in den Kalender: Ablaufdatum des Schlüssels.
4. **API-Berechtigungen › Berechtigung hinzufügen › Microsoft Graph › Delegierte
   Berechtigungen**: `offline_access`, `openid`, `email`, `profile`, `Calendars.ReadWrite`.
   Danach **Administratorzustimmung für <euer Mandant> erteilen** (dann muss beim Test
   niemand mehr zustimmen).
5. **Branding & Eigenschaften**: Name `Matchunt`, Logo, Startseite `https://matchunt.ai`,
   Datenschutz `https://matchunt.ai/datenschutz`, Nutzungsbedingungen `https://matchunt.ai/agb`.
6. Die Secrets in Supabase (über Lovable) anlegen: `MS_CLIENT_ID`, `MS_CLIENT_SECRET`.
   `ENCRYPTION_KEY` existiert bereits.

**Was die App darf:** frei/belegt des Nutzers und seiner Kollegen lesen und Interview-Termine
mit Teams-Link anlegen, ändern und absagen. Keine Rechte auf Mails, Dateien oder Chats.
Matchunt speichert nur das verschlüsselte Zugriffstoken, die Kontoadresse und Termin-ID und
Teams-Link der Matchunt-Interviews. Frei/belegt wird nicht gespeichert.

---

## B — Matchunt-Teams-Konto (für Kunden ohne Outlook-Verbindung)

Damit auch Kunden ohne Verbindung automatisch einen Teams-Link bekommen, erstellt Matchunt
die Besprechung aus einem eigenen Konto. Der Wartebereich ist offen, niemand von Matchunt
muss teilnehmen.

1. Im Microsoft-365-Admin-Center einen Benutzer anlegen, z. B. `interviews@…`, Anzeigename
   **Matchunt Interviews**, mit einer Lizenz, die Teams enthält (z. B. Microsoft 365 Business
   Basic mit Teams).
2. Entra → **Benutzer** → Matchunt Interviews → **Objekt-ID** kopieren → Secret
   `MS_ORGANIZER_USER_ID`. Secret `MS_APP_TENANT_ID` = Verzeichnis-ID aus A2.
3. In der App-Registrierung aus A: **API-Berechtigungen › Microsoft Graph ›
   Anwendungsberechtigungen** → `OnlineMeetings.ReadWrite.All` → Administratorzustimmung
   erteilen.
4. Teams-PowerShell (einmalig, als Teams-Administrator):

   ```powershell
   Install-Module MicrosoftTeams
   Connect-MicrosoftTeams
   New-CsApplicationAccessPolicy -Identity Matchunt-Interviews -AppIds "<MS_CLIENT_ID>" -Description "Matchunt erstellt Interview-Besprechungen"
   Grant-CsApplicationAccessPolicy -PolicyName Matchunt-Interviews -Identity "<Objekt-ID aus B2>"
   ```

   Die Richtlinie wirkt nach bis zu 30 Minuten.
5. Damit Besprechungen ohne Organisator starten (unsicher, ob in jedem Mandanten nötig):

   ```powershell
   New-CsTeamsMeetingPolicy -Identity Matchunt-Interviews -AllowAnonymousUsersToStartMeeting $true -AutoAdmittedUsers Everyone
   Grant-CsTeamsMeetingPolicy -Identity "<Objekt-ID aus B2>" -PolicyName Matchunt-Interviews
   ```

---

## C — Absender für Kalendereinladungen

Einladungen kommen von `termine@matchunt.ai` (änderbar über Secret `INTERVIEW_FROM_EMAIL`).
Kalender schicken Zu- und Absagen an diese Adresse. Bitte als Postfach oder Weiterleitung
anlegen, sonst kommen Unzustellbarkeits-Meldungen zurück. Die Domain ist in Resend bereits
verifiziert. Die Einladungen gehen über Resend-SMTP (Port 465), damit Outlook sie als Termin
erkennt; scheitert das, gehen sie mit `.ics`-Anhang über die normale Resend-API.

---

## D — Herausgeber-Prüfung (vor echten Kunden)

Ohne Prüfung können Mitarbeiter anderer Firmen der App nicht selbst zustimmen; Microsoft
verlangt dann immer die IT (die Freigabe-Mail an die IT ist eingebaut). Mit Prüfung erscheint
„Matchunt (verifiziert)“ im Zustimmungsfenster.

1. Microsoft Partner Center: dem **Microsoft AI Cloud Partner Program** beitreten (kostenlos),
   Verifizierung mit Handelsregisterauszug und Domain abschließen (meist 3–5 Werktage).
2. Eigene Domain (z. B. `matchunt.ai`) im Entra-Mandanten per DNS verifizieren und in der
   App unter **Branding & Eigenschaften › Herausgeberdomäne** setzen.
3. In der App-Registrierung: **Branding & Eigenschaften › MPN-ID hinzufügen, um Herausgeber
   zu überprüfen** → Partner-ID (Partner Global Account) eintragen.

---

## E — Testablauf (nach Lovable-Abschnitt 12)

1. Als Kunde Bluewater anmelden → **Einstellungen › Kalender und Interview-Zeiten** →
   **Outlook verbinden** mit `marko.benko@bluewater-bridge.de`. Danach steht dort „Outlook
   ist verbunden“.
2. **Bewerber** → Katharina Brenner (Mail = Testadresse) → **Interview anfragen**. Im Raster
   sind eure echten Outlook-Termine grau. Optional eine Kollegin hinzufügen.
3. 2–3 Termine antippen → **Anfrage senden**. Die Einladung kommt an die Testadresse
   (Absender „Tim Weber über Matchunt“ bzw. der Headhunter der Einreichung).
4. In der Mail einen Termin wählen → Seite öffnet sich mit dem Termin vorausgewählt →
   Einwilligung → **Interview bestätigen**.
5. Prüfen: Termin mit Teams-Link steht im Outlook; Kandidat und Headhunter haben eine eigene
   Einladung; in Matchunt erscheint der Name; unter Interviews steht der Termin.
6. Zweiter Durchlauf: **Keiner passt? Andere Zeit wählen** testen (mit Outlook sofort
   gebucht, ohne Outlook kommt die Mail „Der Kandidat fragt eine andere Zeit an“).
