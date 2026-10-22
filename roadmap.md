# Roadmap

## Deployment 168f270 (22.10.2026)
- [x] Current checkout verified at 168f270; prior journal ends at 0034_einreichen_rahmen_pflicht.
- [x] Apply a–b as 0033_firmenlogo and 0034_einreichen_rahmen_pflicht; database schema and trigger verified.
- [x] Complete preflight for c–g; user corrected seeds and queue wake/drain behavior in 168f270.
- [x] Apply c–g individually: 0035_nachgespraech, 0036_aufnahme_mussfragen, 0037_matchunt_liga, 0039_kandidatenprofil_kunde, 0040_terminseite_linkedin; database objects verified. 0038_liga_standings_transfer_correction restores the source expression after a transfer typo in 0037. f includes the tool-required cron review comment; SQL body matches source.
- [x] Deploy all 15 requested functions successfully with verify_jwt from config.toml.
- [x] Leave protected secrets unchanged.
- [ ] Request frontend publication: fresh security scan reports five critical findings (the four known plus feedback_settings public reads); awaiting user's decision whether to publish unchanged.

## Erledigt (Abschnitte 15 + 16, 06.10.2026)
- [x] Arbeitskopie auf 29cd415 und 204351c gebracht, keine Migration
- [x] interview-request, get-interview-by-token, process-interview-response, interview-client-link deployed
- [x] Alle Build-Fehler behoben (SHA-256-Puffer, admin.email, fehlender preheader, status-Doppelung, Synonym-Typen, fehlendes qrcode-generator)
- [x] 18 betroffene Functions neu deployed; alle 116 Functions type-checken sauber
- [x] Publish angefordert — matchunt.ai liefert assets/index-C_DX4Aif.js

## Offen
- [ ] 5 kritische Security-Bestandsbefunde: outreach_leads (Löschen durch beliebige Nutzer), interview_participants und feedback_settings (alle lesbar), cv-documents und job-documents (Download durch beliebige Nutzer) — Korrekturen außerhalb des Deployment-Auftrags
- [ ] Outlook-Kalender: AADSTS7000215 — in Azure der Secret-*Wert* (nicht die Secret-ID) für MS_CLIENT_SECRET eintragen, dann Verbindung erneut starten
- [ ] DocuSign läuft in der Demo-Umgebung; Produktivumgebung fehlt
- [ ] marko.benko@freenet.de bleibt unangetastet; Gegenzeichnung marko.benko@bluewater-bridge.de (Danny Kostic) ausstehend
