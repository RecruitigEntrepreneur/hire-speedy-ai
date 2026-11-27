# Google Kalender, Google Meet und Zoom einrichten (für Marko)

Stand 26.11.2026. Der Code ist gebaut (Lovable-Auftrag Nr. 65). Damit Kunden und Headhunter Google und Zoom
wirklich verbinden können, braucht Matchunt bei beiden Anbietern eine eigene „App“. Die legst du an, nicht ich.
Solange die Schlüssel fehlen, zeigt die App Google und Zoom als „Bald“, es geht nichts kaputt.

Rücksprung-Adresse für beide (genau so eintragen):

    https://dngycrrhbnwdohbftpzq.supabase.co/functions/v1/calendar-oauth-callback

---

## Teil A: Google (Kalender + Meet)

Google Meet braucht nichts Eigenes: Der Meet-Link entsteht, wenn Matchunt den Termin in den Google-Kalender einträgt.

1. https://console.cloud.google.com mit dem Matchunt-Google-Konto öffnen, oben **Neues Projekt** „Matchunt“ anlegen.
2. **APIs & Dienste › Bibliothek** › „Google Calendar API“ › **Aktivieren**. (Sonst nichts aktivieren.)
3. **Google Auth Platform › Branding** (früher „OAuth-Zustimmungsbildschirm“):
   - App-Name: Matchunt · Support-Mail: eure Matchunt-Adresse · Logo (optional, verlängert die Prüfung um Tage)
   - Startseite: `https://matchunt.ai` · Datenschutz: `https://matchunt.ai/datenschutz` · Bedingungen: `https://matchunt.ai/agb`
   - Autorisierte Domain: `matchunt.ai` (Google verlangt, dass die Domain in der Google Search Console auf euch bestätigt ist)
4. **Zielgruppe**: „Extern“ (sonst können nur Konten aus eurer eigenen Google-Firma verbinden).
   Zum Testen erst im Modus **Testen** lassen und unter **Testnutzer** deine eigene Google-Adresse eintragen.
5. **Datenzugriff › Bereiche hinzufügen**, genau diese drei, sonst keine:
   - `openid` und `.../auth/userinfo.email` (wer sich verbunden hat)
   - `https://www.googleapis.com/auth/calendar.events` (Termin mit Meet-Link eintragen und absagen)
   - `https://www.googleapis.com/auth/calendar.freebusy` (nur frei/belegt lesen, keine Inhalte)
   Begründung für Google (kann so rein): „Matchunt liest nur frei/belegt, damit Kandidaten nur freie Zeiten
   buchen, und trägt ausschließlich die über Matchunt gebuchten Interviews mit Google-Meet-Link ein.“
6. **Clients › Client erstellen** › Typ „Webanwendung“, Name „Matchunt Kalender“,
   **Autorisierte Weiterleitungs-URIs**: die Rücksprung-Adresse von oben. Speichern.
   Google zeigt dann **Client-ID** und **Clientschlüssel**.
7. In Lovable (Cloud › Secrets) zwei Secrets anlegen, Werte aus Schritt 6 einfügen:
   - `GOOGLE_CALENDAR_CLIENT_ID`
   - `GOOGLE_CALENDAR_CLIENT_SECRET`
   (`ENCRYPTION_KEY` gibt es schon für Outlook, wird mitbenutzt.)
8. Testen (Modus „Testen“ reicht): in Matchunt als Test-Kunde › Einstellungen › Kalender › Google Kalender ›
   Verbinden, mit deiner Google-Adresse anmelden, alle Häkchen setzen. Dann ein Test-Interview mit „Google Meet“
   anfragen und als Kandidat (deine Bluewater-Adresse) buchen. Erst wenn der Termin mit Meet-Link in deinem
   Google-Kalender steht, gilt Google als verbunden.
9. **Veröffentlichen und prüfen lassen**: Zielgruppe › „App veröffentlichen“, dann „Bestätigung vorbereiten“.
   Google verlangt dafür ein kurzes Video (Bildschirmaufnahme: Verbinden, Häkchen, Termin entsteht) und prüft
   Branding und die beiden Kalender-Rechte.

**Was das für den Zeitplan heißt (offen gesagt):**
- Die beiden Kalender-Rechte gelten bei Google als „sensibel“. Ohne Prüfung sehen fremde Nutzer die Warnung
  „Google hat diese App nicht überprüft“, und insgesamt dürfen nur 100 Nutzer verbinden. Im Modus „Testen“
  läuft die Verbindung außerdem nach 7 Tagen ab.
- Google nennt für die Prüfung der sensiblen Rechte bis zu 10 Tage, für das Branding 2–3 Tage; Rückfragen
  verlängern das. Realistisch: 2–4 Wochen bis Kunden ohne Warnung verbinden können.
- Viele Firmen mit Google Workspace sperren ungeprüfte Apps ganz. Vor der Prüfung also nur mit eigenen Konten testen.
- Eine teure Sicherheitsprüfung (wie bei Gmail-Rechten) ist für Kalender nicht nötig.
- Die Datenschutzseite muss vor der Prüfung sagen, dass Matchunt Kalenderdaten von Google nur für die
  Terminfindung nutzt (Google-Regel „Limited Use“). Das ist ein Punkt für den Anwalt.

---

## Teil B: Zoom

Entscheidung: jeder Nutzer verbindet sein eigenes Zoom-Konto (nicht die Firma einmal für alle).

1. https://marketplace.zoom.us mit dem Matchunt-Zoom-Konto öffnen › **Develop › Build App** › **General App**.
2. Art der Nutzung: **User-managed** (jeder Nutzer verbindet sich selbst).
3. **OAuth Redirect URL** und **OAuth Allow List**: die Rücksprung-Adresse von oben.
4. **Scopes**, genau diese drei, sonst keine:
   - `user:read:user` (wer sich verbunden hat)
   - `meeting:write:meeting` (Besprechung beim Buchen anlegen)
   - `meeting:delete:meeting` (Besprechung bei Absage löschen)
5. Unter **App Credentials** (Development) stehen **Client ID** und **Client Secret**.
6. In Lovable (Cloud › Secrets) anlegen:
   - `ZOOM_CLIENT_ID`
   - `ZOOM_CLIENT_SECRET`
7. Testen mit deinem eigenen Zoom-Konto (Nutzer im selben Zoom-Konto dürfen ohne Freigabe testen):
   Einstellungen › Kalender › Zoom › Verbinden. Dann ein Test-Interview mit „Zoom“ anfragen und buchen.
8. Für fremde Firmen: unter **Production** die App zur Prüfung einreichen (als „unlisted“, also nicht öffentlich
   im Marketplace gelistet, geht auch). Vorher kann man über **Beta Test › Request to Share** einen begrenzten
   Kreis außerhalb freischalten lassen (laut Zoom-Forum meist nach etwa einem Arbeitstag genehmigt, gilt 30 Tage).
   Zoom will für die Prüfung Datenschutz, Support-Adresse und eine Testanleitung.

**Zeitplan Zoom:** Ohne Prüfung funktioniert es nur für Nutzer in eurem eigenen Zoom-Konto. Prüfung meist einige
Tage bis wenige Wochen.

---

## Wann darf auf der Website „Verbunden“ stehen?

Erst wenn der jeweilige Test oben (Schritt A8 bzw. B7) in der echten App durch ist UND die Anbieter-Prüfung
durch ist (sonst sehen Kunden Warnungen oder können sich gar nicht verbinden). Bis dahin in
`matchunt-website-labor/src/matchunt/s60-3-plattform/Werkzeuge.tsx` (Liste `DA_UNTEN`) Google Kalender,
Google Meet und Zoom NICHT als verbunden zeigen.
