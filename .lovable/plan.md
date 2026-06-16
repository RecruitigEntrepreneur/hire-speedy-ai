## Plan: Welle A.2 Migration (korrigiert) anwenden

**Datei:** `supabase/migrations/20260616120000_client_candidate_view_cv_summary.sql` (ohne `s.created_at`)

### Schritt 1 — Migration ausführen
`CREATE OR REPLACE VIEW public.client_candidate_view` via `supabase--migration` einspielen. Rein additiv:
- `cv_ai_summary` reveal-gated (vor `identity_unlocked` durch doppeltes `scrub_identity_tokens` für Name + Arbeitgeber maskiert)
- `submitted_at` als Listen-Metadatum
- `GRANT SELECT ... TO authenticated` bleibt
- WHERE `j.client_id = auth.uid()` unverändert

### Schritt 2 — Verifikation per SQL
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='client_candidate_view'
  AND column_name IN ('cv_ai_summary','submitted_at')
ORDER BY column_name;
```
Erwartung: zwei Zeilen.

### Was NICHT geändert wird
- Kein Anwendungscode (`src/`)
- Keine anderen Views, Functions, Policies oder Grants

### Ausgabe an den User
Kurze Bestätigung der beiden neuen Spalten in `client_candidate_view`.
