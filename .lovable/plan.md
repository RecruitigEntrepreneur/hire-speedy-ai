## Plan: Drei Triple-Blind / Auth-Migrationen anwenden

Es wird KEIN Anwendungscode geändert. Es werden ausschließlich die drei bereits im Repo liegenden Migrationsdateien gegen die verbundene Datenbank ausgeführt — exakt in dieser Reihenfolge:

1. `supabase/migrations/20260608120000_auth_hardening_privilege_escalation.sql`
   - Ersetzt `public.handle_new_user()` durch eine Version, die nur `client`/`recruiter` als Selbst-Rolle erlaubt; alles andere fällt sicher auf `client`.
   - Entfernt die Policy `"Users can insert their own role"` auf `public.user_roles` (Privilege-Escalation-Fix).

2. `supabase/migrations/20260608121000_triple_blind_views_wave_a.sql`
   - Legt Anonymisierungs-Funktionen an: `anon_region_broad`, `anon_experience_band`, `anon_salary_band` (jeweils `IMMUTABLE`, `EXECUTE` für `authenticated`).
   - Legt Views an: `client_candidate_view`, `client_candidate_experiences_view`, `recruiter_jobs_view` mit eingebauter Ownership-Prüfung und Spalten-Maskierung; `GRANT SELECT` an `authenticated`.

3. `supabase/migrations/20260608122000_client_fit_assessment_view.sql`
   - Legt `public.scrub_identity_tokens(text, text[], text)` an.
   - Legt View `public.client_fit_assessment_view` an (reveal-gated Klartext); `GRANT SELECT` an `authenticated`.

Rein additiv (CREATE FUNCTION / CREATE VIEW / GRANT) bis auf den bewussten `DROP POLICY` in Migration 1.

### Ausführung
- Die drei Migrationen werden über das Migrations-Tool in genau dieser Reihenfolge eingereicht (drei Aufrufe nacheinander, jeweils mit dem unveränderten SQL aus den Dateien). Du bestätigst jede einzelne Migration; ohne Bestätigung wird nichts ausgeführt.

### Verifikation nach erfolgreichem Run
Per SQL-Read-Query gegen `information_schema` / `pg_policies` wird geprüft, dass:

- Views existieren in `public`:
  - `client_candidate_view`
  - `client_candidate_experiences_view`
  - `recruiter_jobs_view`
  - `client_fit_assessment_view`
- Funktionen existieren in `public`:
  - `anon_region_broad`
  - `anon_experience_band`
  - `anon_salary_band`
  - `scrub_identity_tokens`
- Policy `"Users can insert their own role"` auf `public.user_roles` ist NICHT mehr vorhanden.

### Output an dich
Kurze Ergebnis-Tabelle mit Status (✅ vorhanden / ❌ fehlt) je geprüftem Objekt sowie der Bestätigung, dass die Self-Insert-Policy entfernt ist.

### Nicht Teil dieser Aufgabe
- Keine Änderungen an Frontend/Hooks (Welle B kommt separat).
- Keine Änderungen an bestehenden RLS-Policies (außer dem o.g. DROP).
- Keine Bereinigung evtl. unrechtmäßiger Admin-Rollen (gemäß Hinweis in Migration 1 manuell prüfen).
