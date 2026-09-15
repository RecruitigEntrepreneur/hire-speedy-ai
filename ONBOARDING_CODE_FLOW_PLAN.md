# Headhunter-Onboarding: Code statt Konto

Stand 15.09.2026. Entscheidung: Kein Registrieren am Anfang. Erst die E-Mail per
Code bestätigen, dann die Angaben, dann der Vertrag, dann Prüfung und
Freischaltung. Das Passwort kommt erst mit der Freischaltung.

Grundlage ist der Stand auf `origin/main` (12 Commits vor dem lokalen `main`,
enthält das komplette Recruiter-Onboarding). Der lokale `main` wird per
Fast-Forward nachgezogen; die ungespeicherte Änderung an
`RecruiterJobWorkspace.tsx` bleibt unberührt, weil `origin/main` diese Datei
nicht anfasst.

## Ablauf aus Sicht des Headhunters

1. **E-Mail bestätigen.** Link öffnen. Seite sagt „Hallo Marko“ und „Dein Code
   geht an m•••@freenet.de“. Ein Knopf „Code senden“, sechs Ziffern eintippen,
   fertig. Kein Passwort, kein Namensfeld. Bei abgelaufenem oder widerrufenem
   Link eine klare Meldung mit Kontakt.
2. **Deine Angaben.** Wie heute, vorausgefüllt aus der Einladung.
3. **Dein Vertrag.** DocuSign wie heute.
4. **Prüfung & Freischaltung.** Matchunt prüft, zeichnet gegen, schaltet frei.
   Der Headhunter bekommt die Mail „Du bist freigeschaltet“ mit dem Link
   „Zugang einrichten“, setzt auf `/passwort` sein Passwort und landet im
   Dashboard.

Ohne Einladungslink (Einstieg über die Website auf `/recruiter/onboarding`):
Adresse eintippen, Code, dann wie heute die Wahl Einzelrecruiter oder Agentur.
Bestehende Konten mit Passwort gehen denselben Code-Weg; ein kleiner Link
„Lieber mit Passwort anmelden“ führt weiter nach `/auth`.

## Was gebaut wird

### Backend: drei öffentliche Aktionen in `supabase/functions/recruiter-onboarding/index.ts`

Die Aktionen laufen vor der Login-Prüfung. Die Logik liegt in einer neuen
Datei `supabase/functions/_shared/recruiter-code.ts`, damit sie testbar bleibt.

- **`peek` {token}**: Vorgang über den Token-Hash suchen. Antwort: Vorname,
  maskierte Adresse, Ablaufdatum, Status (offen, begonnen, abgelaufen,
  widerrufen). Sonst nichts.
- **`code` {token} oder {email}**:
  - Mit Token: Adresse ist die Einladungsadresse, sie verlässt den Server nie.
    Ohne Token: Adresse aus dem Formular, Plausibilitätsprüfung.
  - Rate-Limit über die bestehende Zähltabelle (`intake_rate_limit_hit`):
    3 Codes je Adresse in 15 Minuten, 20 je IP in der Stunde. Neue
    Voreinstellung `LIMITS.recruiterCode` in `_shared/intake-limits.ts`.
  - Nutzer anlegen, falls er fehlt: `auth.admin.createUser` mit
    `user_metadata { full_name, role: 'recruiter' }`. Der vorhandene Trigger
    `handle_new_user` legt Profil und Recruiter-Rolle an (Whitelist erlaubt
    `recruiter`).
  - Code erzeugen: `auth.admin.generateLink({ type: 'magiclink' })` liefert
    `email_otp`. Supabase verwaltet Gültigkeit und Einmaligkeit.
  - Mail über den vorhandenen Resend-Helfer `sendIntakeMail` im
    Matchunt-Layout, in der Du-Form: Betreff „123456 ist dein Matchunt-Code“,
    Code groß im Text, Gültigkeit genannt.
- **`verify` {token|email, code}**: Server ruft `POST /auth/v1/verify` mit
  `{ type: 'magiclink', email, token: code }` und dem Anon-Key. Antwort an den
  Browser: `access_token`, `refresh_token`. Damit bestätigt Supabase die
  Adresse, was `verifiedUser()` für alle weiteren Aktionen voraussetzt.
  Fehler: „Der Code ist falsch oder abgelaufen.“

Alle weiteren Aktionen (`load`, `resume`, `begin`, `save`, `submit`, `start`,
`sync`, `document`, `signature`, `access`) bleiben unverändert.

### Frontend: `src/pages/onboarding/RecruiterInvitation.tsx`

- Schritt 1 neu: Begrüßung aus `peek`, „Code senden“, Code-Feld (sechs Ziffern,
  `inputmode="numeric"`, `autocomplete="one-time-code"`), „Bestätigen“,
  „Neuen Code senden“. Nach `verify`: `supabase.auth.setSession(...)`, danach
  greift der bestehende Ablauf und lädt den Vorgang über den Token.
- Weg: Passwortfeld, Namensfeld, 12-Zeichen-Regel, `signUp`,
  `signInWithPassword`, `emailRedirectTo`, der Umschalter „Konto erstellen /
  Jetzt anmelden“. Damit entfällt auch der Umweg über die Bestätigungsmail, bei
  dem der Token verloren ging und die Wahl Einzelrecruiter/Agentur ein zweites
  Mal kam.
- Nach vollständiger Unterschrift: statt „Zum Dashboard, nach Freischaltung“
  der Satz „Sobald wir freigeschaltet haben, bekommst du eine Mail mit deinem
  Zugang.“

### Rahmen und Texte: `src/components/onboarding/OnboardingFrame.tsx`

- Stufe 1 heißt „E-Mail bestätigen“.
- Seitenleiste Stufe 1: „Kurz bestätigen. Ein Code an deine E-Mail-Adresse,
  kein Passwort.“ Stufe 4: „Nach der Freischaltung bekommst du eine Mail und
  richtest deinen Zugang ein.“
- Titel Stufe 1 mit Vornamen: „Hallo Marko, schön, dass du dabei bist.“

### Freischaltung: `supabase/functions/recruiter-onboarding-admin/index.ts`

- Neue Aktion **`activate` {case_id}**: Voraussetzung Vorgang `approved`,
  Umschlag `completed`, `claimed_by` gesetzt. Setzt `user_roles.verified = true`
  und `status = 'active'` und sendet die Mail „Du bist freigeschaltet“ mit dem
  Knopf „Zugang einrichten“. Mehrfach auslösbar, falls die Mail nicht ankam.
- `list` liefert je Vorgang zusätzlich `activated` (aus `user_roles`). Keine
  Datenbank-Migration nötig.

**Abweichung vom ursprünglichen Plan (umgesetzt):** Der Knopf in der Mail
führt nicht über einen Recovery-Link auf `/passwort`, sondern auf
`/recruiter/onboarding`. Grund: Recovery-Links laufen mit derselben
Supabase-Einstellung ab wie die Codes, in der Regel nach einer Stunde. Wer die
Mail am nächsten Morgen öffnet, stünde vor einer toten Tür, und eine
„Passwort vergessen“-Strecke gibt es nicht. Auf der Onboarding-Seite meldet
sich der Headhunter stattdessen jederzeit per Code an und sieht dann, weil
`activated` gesetzt ist, das Formular „Passwort festlegen“ (mindestens 8
Zeichen, wie bei Kunden) mit dem Weg ins Dashboard. `SetPassword.tsx` bleibt
unverändert.

### Admin-Oberfläche: `src/components/admin/RecruiterInvitations.tsx`

- Bei vollständig unterzeichnetem Vertrag und geprüftem Vorgang der Knopf
  „Freischalten & Zugang senden“, danach Status „Freigeschaltet“ und der Knopf
  „Zugangsmail erneut senden“.

### Lokale Vorschau: `__preview/recruiter-onboarding.html`

- Entwicklungsseite mit nachgestellter API und Auth, Code immer `123456`,
  Szenarien `invite`, `website`, `expired`, `claimed`, `completed`, `activated`.
  Nicht veröffentlichen; wie die übrigen `__preview`-Seiten nur im Dev-Modus
  lauffähig.

### Tests

- Neu `supabase/tests/recruiter-code.test.ts`: `peek` bei gültigem, abgelaufenem,
  widerrufenem Link; `code` mit Token und mit Adresse, Rate-Limit, Nutzer
  fehlt oder vorhanden; `verify` richtig, falsch, abgelaufen. Supabase-Aufrufe
  gemockt wie in `recruiter-entry.test.ts`.
- Bestehend: `npx tsc -p tsconfig.app.json --noEmit`, Vitest der Vertragslogik,
  Deno-Checks der drei Functions, `npm run build`.

## Deploy, in dieser Reihenfolge

1. Edge Functions `recruiter-onboarding` und `recruiter-onboarding-admin` neu
   deployen (inklusive `_shared`).
2. Supabase Auth: Gültigkeit des E-Mail-Codes prüfen und auf 15 Minuten setzen,
   damit der Mailtext stimmt. Redirect-Allowlist enthält `/passwort` bereits
   für Kunden.
3. Resend: Die Domain `matchunt.ai` muss verifiziert sein, sonst kommt kein
   Code an. Vorab im Admin mit „Einladung per E-Mail senden“ testen.
4. Frontend über Lovable veröffentlichen.
5. Keine Migration.

Live-Test danach: Neue Einladung im Admin anlegen, Link öffnen, Code kommt an,
Angaben, Vertrag bis vor DocuSign. Die Unterschrift und die Freischaltung mit
echtem Konto nur nach ausdrücklicher Freigabe.

## Sicherheit, kurz

- `peek` zeigt Vorname und maskierte Adresse jedem, der den Link hat. Bewusst
  in Kauf genommen für die persönliche Ansprache. Die Einladungsmail sagt
  weiterhin „bitte nicht weiterleiten“.
- `code` mit Token schickt nur an die Einladungsadresse, Deckel 3 je 15
  Minuten. `code` mit freier Adresse entspricht der heutigen offenen
  Registrierung, mit Deckel je Adresse und IP.
- Session-Tokens gehen nur über HTTPS als JSON zurück, wie bei jedem Login.
- Alle Vorgangsdaten bleiben hinter der bestätigten Sitzung; der Token allein
  öffnet nichts außer `peek` und `code`.

## Paket 2, danach: Texte und Angaben

Nicht Teil dieses Umbaus, aber bereit:

- Durchgehend Du: Einladungsmail, DocuSign-Rückkehrtext, Fehlermeldung
  „benötigen Sie ein Recruiter-Konto“.
- „Ich unterschreibe selbst“ als Standard in Schritt 2, die drei
  Unterzeichner-Felder nur bei „andere Person“.
- Ja/Nein-Schalter statt Freitext für „Mehr als die Hälfte der Erwerbseinkünfte
  über Matchunt“ und „Eigene Unternehmen zugleich Kunde“, je ein Satz, warum
  Matchunt fragt.
- Ansprechpartner mit Telefonnummer und Zeitangabe auf der Seite.
- „Sechs Anlagen“ nur noch einmal, erklärt als Anlagen zum Nachlesen.
- „Deine Unterschrift ersetzt nicht die Gegenzeichnung“ als Zusage mit Frist
  formulieren.
- Cookie-Banner auf der Einladungsseite nicht über dem Formular.
- Alte Datei `src/pages/onboarding/RecruiterOnboarding.tsx` („MatchHub“,
  IBAN-Feld) löschen, keine Route zeigt mehr darauf.
