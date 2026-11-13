# Roadmap

## Mehrsprachigkeit (13.11.2026)
- [x] Aktuelles lokales main 6b072956 geprüft; Vorschau build OK; alle 69 angeforderten Function-Dateien vorhanden; Journal endet bei 0056_buchhaltung_umbau.
- [x] Nutzer klärt: recruiter_public_link_open bewusst ohne SECURITY DEFINER; SQL unverändert ausführen, EXECUTE ausschließlich service_role.
- [x] Ausschließlich 20261112120000_mehrsprachigkeit.sql bytegleich als 0057_mehrsprachigkeit angewendet; vier language-Spalten, source_key, RLS und service_role-Rechte live geprüft; recruiter_public_link_open ohne SECURITY DEFINER, search_path=public, EXECUTE nur service_role.
- [x] Alle 69 angeforderten Functions erfolgreich mit unveränderten Einstellungen deployt; keine manuellen Code- oder Secret-Änderungen, Schema-Typen automatisch regeneriert; build OK.
- [x] Sicherheitsprüfung: sieben bekannte kritische Befunde, 13 Warnungen und ein Hinweis.
- [x] Nutzer hat „Jetzt veröffentlichen“ trotz sieben kritischer Bestandsbefunde gewählt.
- [x] Publish für https://matchunt.ai erfolgreich angefordert; Abschluss noch unbestätigt, sieben kritische Bestandsbefunde laut Tool nicht blockierend.

## Auftrag 47 (12.11.2026) — Kundenaufnahme in Etappen
- [x] Arbeitskopie und GitHub main identisch: cce25e4, enthält 324c371 (EtappenAnsicht, CaptureStep, AbteilungsTreppe, ClientIntake u. a.).
- [x] Keine Migration ausgeführt; Journal unverändert bei 0056_buchhaltung_umbau; keine Akademie-Dateien 20261022… angefasst.
- [x] Keine Edge Function deployt, keine Secrets geändert, kein Anwendungscode geändert.
- [x] Vorschau build OK (12.11.2026 17:06 UTC); frische Sicherheitsprüfung: sieben kritische Befunde, 13 Warnungen, ein Hinweis; Freigabe zur Veröffentlichung wie in den Aufträgen 45 und 46 erteilt.
- [x] Publish für https://matchunt.ai angefordert und geprüft: ausgelieferte Seite trägt Commit-Kennung cce25e4, zugehöriger Programmteil lädt mit 200, die neuen Etappen-Texte (u. a. „Etappen der Aufnahme“) stecken im live ausgelieferten Code.

## Auftrag 46 (11.11.2026) — Buchhaltung und Nachbesetzung
- [x] Aktuelles main 5df7f12 geprüft; Auftrag 46 aus LOVABLE_DB_PROMPTS.md: Buchhaltung-Umbau, nicht der ältere Wartezustand-Auftrag.
- [x] Vorprüfung: alle 15 neuen Tabellen mit GRANT vor RLS; zwölf Functions und verify_jwt vorhanden; Journal endet bei 0055, keine Buchhaltung-Migration enthalten.
- [x] Ausschließlich 20261111100000_buchhaltung_umbau.sql bytegleich als 0056_buchhaltung_umbau angewendet; alle 15 Tabellen mit RLS/GRANTs und neue Spalten live bestätigt; Cron buchhaltung-taeglich aktiv, 30 6 * * *, mit privatem Cron-Schlüssel.
- [x] Alle zwölf beauftragten Functions erfolgreich deployt: abrechnung, buchhaltung, buchhaltung-taeglich, placement, client-tasks, process-payout, recruiter-onboarding, contract-followups, contract-sign, contract-status, employment-contract, employment-docusign-webhook; keine manuellen Code- oder Secret-Änderungen, Schema-Typen automatisch regeneriert.
- [x] Vorschau build OK; Sicherheitsprüfung unverändert sieben kritische Befunde (Freigabe zur Veröffentlichung bereits erteilt); Publish wird für matchunt.ai angefordert, Abschluss unbestätigt.

## Auftrag 45 (11.11.2026) — Einsatz anfragen
- [x] Arbeitskopie und GitHub main identisch: 76a6fda; offer enthält einsatz_anfragen.
- [x] Alle neun Functions erfolgreich deployt: offer, offer-answer, placement, process-rejection, contract-followups, contract-sign, contract-status, employment-contract, employment-docusign-webhook; Einstellungen laut config.toml.
- [x] Keine Migration, Code- oder Secret-Änderung; Journal unverändert bei 0055_fuehrung_beides.
- [x] Sicherheitsprüfung aktualisiert: sieben kritische Befunde, 13 Warnungen, ein Hinweis; kein aktuelles Vorschau-Buildsignal verfügbar.
- [x] Nutzerentscheidung: Jetzt veröffentlichen trotz sieben kritischer Sicherheitsbefunde; Publish wird angefordert, Abschluss noch unbestätigt.

## Auftrag 43 (06.11.2026)
- [x] GitHub main mit Arbeitskopie abgeglichen: 61f35dd, enthält d6f12b1.
- [x] Alle 19 beauftragten Functions erfolgreich deployt; verify_jwt laut config.toml, Vorschau build OK.
- [x] Sicherheitsprüfung: vier kritische Bestandsbefunde; Nutzer hat „Jetzt veröffentlichen“ gewählt.
- [x] Publish für https://matchunt.ai angefordert; Tool meldet fünf persistierte kritische Bestandsbefunde, nicht blockierend. Abschluss nicht bestätigt.
- [x] Keine Migrationen, Anwendungscode- oder Secret-Änderungen.

## Auftrag 38 (29.10.2026)
- [x] Stand d1a6d87 geprüft; Journal endete bei 0045; beide früheren Befunde korrigiert, Vorschau build OK.
- [x] Migrationen einzeln erfolgreich als 0046_angebot_an_kandidat und 0047_stand_meiner_einreichungen ausgeführt; beide bytegleich mit den Quelldateien.
- [x] offer-answer und alle 14 angeforderten Functions erfolgreich deployt; verify_jwt laut config.toml.
- [x] Keine Secrets verändert; RESEND_API_URL nicht online gesetzt. Keine Anwendungscodeänderungen.
- [x] Publish für matchunt.ai nach ausdrücklicher Freigabe trotz fünf unveränderter kritischer Sicherheitsbefunde angefordert; Abschluss der Veröffentlichung noch nicht bestätigt.

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

## Auftrag 49 (13.11.2026) — Kundenaufnahme: PDF-Leser, Zitate, Stellenkopf
- [x] Arbeitskopie auf main 5a2fa37 (enthält 294ad00 und 041bfc1); keine Migration (Journal bleibt bei 0057_mehrsprachigkeit), keine Secrets, kein Code.
- [x] 3 Functions deployt: parse-job-url, parse-job-pdf (verify_jwt = true), intake-ai (verify_jwt = false) — Einstellungen wie in config.toml.
- [x] Publish für https://matchunt.ai angefordert; Abschluss nicht bestätigt. 7 kritische Bestandsbefunde gemeldet, blockieren hier nicht.
- [ ] Befund für Codex: TS2769 in supabase/functions/_shared/linkedin-api.ts:98:162 (Uint8Array nicht zuweisbar an BodyInit) — betrifft linkedin und linkedin-callback, nicht Teil dieses Auftrags.
