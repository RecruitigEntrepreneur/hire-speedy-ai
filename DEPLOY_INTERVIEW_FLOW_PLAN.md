# Deploy-Plan: Interview-Flow + Mail-Versand-Test

Stand: 2026-07-10 · Alles Code-seitig fertig und lokal verifiziert, wartet nur auf Deploy.

## Ziel
1. Einladungs-E-Mail an Kandidaten geht nachweisbar raus (Test: marko.benko@bluewater-bridge.de).
2. Der Link in der Mail funktioniert für anonyme Kandidaten (Opt-In-Seite + Consent).
3. Reveal-Gates & Consent-Härtung greifen serverseitig.

## Schritt 1 — Resend prüfen/einrichten (Voraussetzung für Mail)
- [ ] Supabase Dashboard → Project Settings → Edge Functions → Secrets: existiert `RESEND_API_KEY`?
  - Logs des letzten Tests ansehen: Edge Functions → `send-interview-invitation` → Logs.
- [ ] Falls nein: resend.com-Account (Free reicht), **Domain `matchunt.ai` verifizieren** (SPF/DKIM-DNS-Records) — Pflicht, weil Absender `noreply@matchunt.ai`.
- [ ] API-Key als Secret setzen:
  `npx supabase secrets set RESEND_API_KEY=re_xxx --project-ref dngycrrhbnwdohbftpzq`

## Schritt 2 — Edge Functions deployen
```
npx supabase login   # einmalig
npx supabase functions deploy send-interview-invitation get-interview-by-token process-interview-response --project-ref dngycrrhbnwdohbftpzq
```
Was dadurch live geht:
- `get-interview-by-token` (NEU): macht den Kandidaten-Link überhaupt erst funktionsfähig (bisher blockte RLS anonyme Zugriffe → „Ungültiger Link").
- `send-interview-invitation`: Firmenname in Mail + Betreff; meldet jetzt ehrlich `emailSent`/`emailError` (Resend-SDK wirft nicht — vorher waren Versandfehler unsichtbar).
- `process-interview-response`: Accept nur noch mit aktiver Einwilligung (`consentGiven`), protokolliert Consent (Zeit + Textversion).

## Schritt 3 — Migrationen gezielt ausführen (SQL-Editor, NICHT `db push`!)
`db push` würde auch die ungepushten Juni-Migrationen (Academy, Intake, Company-Profile) mitnehmen. Stattdessen die drei Dateien einzeln im SQL-Editor laufen lassen, in dieser Reihenfolge:
- [ ] `supabase/migrations/20260710090000_interview_reveal_gates.sql` — participants-USING(true)-Fix, client_interviews_view reveal-gated, candidates-Client-Read nur nach Reveal
- [ ] `supabase/migrations/20260710100000_optin_consent_hardening.sql` — Status-Landmine ('interview') entschärft, consent_meta-Spalte + ehrliches Consent-Audit
- [ ] `supabase/migrations/20260710101000_migrate_ghost_interview_requests.sql` — Alt-Anfragen aus client_notes → echte interviews-Zeilen

## Schritt 4 — Mail-Test wiederholen
- [ ] Im Dashboard bei einem Marko-Benko-Kandidaten „Interview anfragen" durchklicken
      (offene Test-Anfrage existiert bereits: Interview `b8fbf6e2…`, Job „Gruppenleiter (m/w/d) Wareneingangsprüfung").
- [ ] Netzwerk-Antwort prüfen: `emailSent: true`? Sonst steht der Grund in `emailError`.
- [ ] Posteingang marko.benko@bluewater-bridge.de: Firmenname, 5 Slots, 3 Buttons.
- [ ] Button „Termin annehmen" klicken → Antwortseite lädt (jetzt via Edge Function), Consent-Schritt mit Firmenname → bestätigen → Reveal + Bestätigungs-Mails an alle drei Parteien.

## Aufräumen nach Test (optional)
- Test-Anfragen über die Interview-Agenda „Anfrage zurückziehen" (sauberer Absage-Flow, benachrichtigt Recruiter).
