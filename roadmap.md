# Roadmap

## Auftrag 38 (29.10.2026)
- [x] Stand 2a42f78 geprüft; Journal endet bei 0045, beide angeforderten Migrationen fehlen dort; alle 15 Functions vorhanden und verify_jwt geprüft.
- [ ] Migrationen angebot_an_kandidat und stand_meiner_einreichungen einzeln ausführen — blockiert: erste Migration setzt RLS vor GRANT (Zeilen 40–41); Korrektur in Codex.
- [ ] offer-answer und die 14 angeforderten Functions deployen — nach korrigierter Vorprüfung.
- [x] Keine Secrets verändert; RESEND_API_URL nicht online setzen. Kein Publish beauftragt.
- [ ] Vorschaufehler src/lib/zipStore.ts:56 (TS2322, Uint8Array/BlobPart) — Korrektur in Codex außerhalb des Deployment-Auftrags.

## Auftrag 34 (23.10.2026) — Live-Test Interview: Fixes aus dem ersten Durchlauf
- [x] Stand 751bd75; keine Migration, keine Secrets.
- [x] interview-request neu deployt (verify_jwt = true laut config.toml, Source-SHA ed55d19d…).
- [x] Publish für https://matchunt.ai angefordert; 5 bekannte kritische Bestandsbefunde blockieren hier nicht.
## Deployment 168f270 (22.10.2026)


- [x] Current checkout verified at 168f270; prior journal ends at 0034_einreichen_rahmen_pflicht.
- [x] Apply a–b as 0033_firmenlogo and 0034_einreichen_rahmen_pflicht; database schema and trigger verified.
- [x] Complete preflight for c–g; user corrected seeds and queue wake/drain behavior in 168f270.
- [x] Apply c–g individually: 0035_nachgespraech, 0036_aufnahme_mussfragen, 0037_matchunt_liga, 0039_kandidatenprofil_kunde, 0040_terminseite_linkedin; database objects verified. 0038_liga_standings_transfer_correction restores the source expression after a transfer typo in 0037. f includes the tool-required cron review comment; SQL body matches source.
- [x] Deploy all 15 requested functions successfully with verify_jwt from config.toml.
- [x] Leave protected secrets unchanged.
- [x] Frontend publication requested for https://matchunt.ai after user's approval; tool scheduled deployment and reported four persisted critical findings. Fresh scan additionally flagged feedback_settings. Deployment completion not verified.

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
