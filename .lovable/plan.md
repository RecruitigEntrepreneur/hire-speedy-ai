## Plan: Welle A.2 Migration anwenden

**Datei:** `supabase/migrations/20260616120000_client_candidate_view_cv_summary.sql`

### Schritt 1 — Migration ausführen
`CREATE OR REPLACE VIEW public.client_candidate_view` mit dem Inhalt der Migration via `supabase--migration` einspielen. Rein additiv: 
- `cv_ai_summary` reveal-gated (vor `identity_unlocked` durch `scrub_identity_tokens` für Name + Arbeitgeber gescrubbt)
- `submitted_at`, `created_at` als Listen-Metadaten
- `GRANT SELECT ... TO authenticated` bleibt bestehen
- WHERE-Klausel `j.client_id = auth.uid()` unverändert

### Schritt 2 — Verifikation per SQL
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='client_candidate_view'
  AND column_name IN ('cv_ai_summary','submitted_at','created_at')
ORDER BY column_name;
```
Erwartung: drei Zeilen.

### Was NICHT geändert wird
- Kein Anwendungscode (`src/`)
- Keine anderen Views, Functions, Policies oder Grants
- Keine Hooks oder Komponenten

### Ausgabe an den User
Kurze Bestätigung der drei neuen Spalten in `client_candidate_view`.
