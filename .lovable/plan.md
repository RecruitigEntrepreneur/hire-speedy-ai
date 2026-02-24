

## Temporäre Edge Function zum Abrufen des Service Role Keys

### Was passiert
Eine temporäre Edge Function wird erstellt, die den `SUPABASE_SERVICE_ROLE_KEY` zurückgibt. Nach dem Abrufen wird die Function sofort wieder gelöscht.

### Sicherheitshinweis
- Die Function hat `verify_jwt = false`, damit sie ohne Auth aufgerufen werden kann
- **Muss sofort nach Verwendung gelöscht werden** -- der Key darf nicht dauerhaft über eine öffentliche URL abrufbar sein

### Technische Schritte

1. **Edge Function erstellen:** `supabase/functions/get-service-key/index.ts`
   - Liest `SUPABASE_SERVICE_ROLE_KEY` aus `Deno.env.get()`
   - Gibt den Key als JSON zurück
   - CORS-Header für direkten Aufruf

2. **config.toml erweitern:** Eintrag mit `verify_jwt = false`

3. **Function deployen und aufrufen** um den Key anzuzeigen

4. **Function sofort löschen** nach erfolgreichem Abruf (Code-Datei entfernen + config.toml bereinigen)

