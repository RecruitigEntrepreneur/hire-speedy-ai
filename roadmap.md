# Roadmap

## Deployment 37219c3 (22.10.2026)
- [x] Current checkout verified at 37219c3; journal ends at 0032_interview_umfeld_lernwoerterbuch.
- [x] Apply a–b as 0033_firmenlogo and 0034_einreichen_rahmen_pflicht; database schema and trigger verified.
- [ ] Apply c–g: blocked at c by missing service_role table GRANT; requires corrected SQL in Codex. Later files also have missing grants; g references auth.users from application tables.
- [ ] Deploy the 15 requested functions after migrations are complete (blocked by c).
- [x] Leave protected secrets unchanged.
- [ ] Request frontend publication after migrations, function deployment and security check (blocked by c).

## Erledigt (Abschnitte 15 + 16, 06.10.2026)
- [x] Arbeitskopie auf 29cd415 und 204351c gebracht, keine Migration
- [x] interview-request, get-interview-by-token, process-interview-response, interview-client-link deployed
- [x] Alle Build-Fehler behoben (SHA-256-Puffer, admin.email, fehlender preheader, status-Doppelung, Synonym-Typen, fehlendes qrcode-generator)
- [x] 18 betroffene Functions neu deployed; alle 116 Functions type-checken sauber
- [x] Publish angefordert — matchunt.ai liefert assets/index-C_DX4Aif.js

## Offen
- [ ] 4 kritische Security-Bestandsbefunde: outreach_leads (Löschen durch beliebige Nutzer), interview_participants (alle lesbar), cv-documents und job-documents (Download durch beliebige Nutzer) — Prüfung und Entscheidung in der Sicherheitsansicht
- [ ] Outlook-Kalender: AADSTS7000215 — in Azure der Secret-*Wert* (nicht die Secret-ID) für MS_CLIENT_SECRET eintragen, dann Verbindung erneut starten
- [ ] DocuSign läuft in der Demo-Umgebung; Produktivumgebung fehlt
- [ ] marko.benko@freenet.de bleibt unangetastet; Gegenzeichnung marko.benko@bluewater-bridge.de (Danny Kostic) ausstehend
