# Roadmap

## Aktuell (Deploy-Anfrage 11:17 UTC)
- [ ] main (inkl. 1a323ec und 6af7072) ausrollen
- [ ] Migration supabase/migrations/20260926100000_vertragswerk_v2_contracting.sql ausführen
- [ ] 9 Edge Functions deployen: intake-submit, intake-packages, docusign-send, docusign-webhook, docusign-status, docusign-sync, contract-admin, intake-admin, generate-mandate-pdf
- [ ] Frontend publishen
- [ ] Keine weiteren Dateien ändern; Erfolg von Migration, Functions und Publish melden

## Parallel / offen
- [ ] DOCUSIGN_HMAC_KEY: Formular zum Überschreiben öffnen (kein eigener Wert erzeugen — DocuSign vergibt den Schlüssel); erster Versuch wurde durch neue Nachricht abgebrochen
- [ ] Cron-Job docusign-client-sync existiert, aber alle 85 Läufe fehlgeschlagen: `unrecognized configuration parameter "app.settings.supabase_url"` — Lovable Cloud hat diese Settings nicht; Wartung durch User/Codex
