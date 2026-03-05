

## Temporaere Edge Function zum Auslesen der Secrets

### Was passiert
1. Eine Edge Function `reveal-secrets` wird erstellt, die `SUPABASE_SERVICE_ROLE_KEY` und `SUPABASE_DB_URL` aus den Backend-Secrets liest und als JSON zurueckgibt
2. Die Function wird aufgerufen, damit du die Werte kopieren kannst
3. Danach wird die Function sofort wieder geloescht

### Technische Details
- `verify_jwt = false` damit sie ohne Auth aufrufbar ist
- Gibt nur die zwei Werte zurueck die du fuer Claude Code brauchst
- Wird nach dem Auslesen sofort entfernt (Sicherheit)

### Ergebnis
Du erhaeltst eine kopierbare `.env`-Konfiguration mit allen Zugangsdaten:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

