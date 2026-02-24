

## Temporäre Edge Function zum Abrufen der Database URL

### Was passiert
Eine temporäre Edge Function wird erstellt, die den `SUPABASE_DB_URL` Secret ausliest und zurückgibt. Das Database Password ist darin enthalten. Nach dem Abrufen wird die Function sofort wieder gelöscht.

### Sicherheitshinweis
- Die Function hat `verify_jwt = false` fuer direkten Zugriff
- Wird sofort nach Verwendung geloescht
- Das Database Password darf niemals im Frontend oder oeffentlich verwendet werden

### Technische Schritte

1. **Edge Function erstellen:** `supabase/functions/get-db-url/index.ts`
   - Liest `SUPABASE_DB_URL` aus `Deno.env.get()`
   - Gibt die URL als JSON zurueck
   - CORS-Header fuer direkten Aufruf

2. **config.toml erweitern:** Eintrag mit `verify_jwt = false`

3. **Function deployen und aufrufen** um die DB URL anzuzeigen

4. **Function sofort loeschen** nach erfolgreichem Abruf (Code-Datei entfernen + config.toml bereinigen)

