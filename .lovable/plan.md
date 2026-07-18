## Diagnose + gezielter Fix an `matching_config`

### Teil A — Diagnose (nur lesen)
Fünf SELECT-Queries via `psql` ausführen und die Ergebnisse vollständig als Tabellen im Chat ausgeben:
1. Aktive Konfigurations-Zeilen aus `matching_config` (id, version, name, profile, active, weights, gate_thresholds, hard_kill_defaults, dealbreaker_multipliers, display_policies)
2. Aggregierte Counts über `candidates` (language_skills, certifications) und `jobs` (required_languages, required_certifications)
3. Prüfen, ob `jobs.visa_sponsorship`, `experience_min`, `experience_max` existieren
4. `submissions.status`-Verteilung
5. Anzahl Zeilen in `match_outcomes`

### Teil B — Konditionaler Fix (nur wenn Bedingung erfüllt)
**Bedingung:** Die aktive Zeile mit `profile='default'` hat im `weights.fit_breakdown` KEINEN Key `seniority`.
- Wenn NICHT erfüllt: nichts ändern, kurze Meldung.
- Wenn erfüllt: als Migration ausführen:
  1. Backup-Zeile in `matching_config` einfügen (`profile='backup-20260718'`, `active=false`) mit den aktuellen Werten
  2. UPDATE der aktiven `default`-Zeile: `version='v3.1'`, neue `weights` (inkl. `seniority: 0.03` und `industry: 0.02`), neue `dealbreaker_multipliers`, neue `display_policies` — exakt die im Prompt vorgegebenen JSON-Werte
  3. Sicherstellen, dass danach genau EINE Zeile mit `active=true AND profile='default'` existiert

### Teil C — Kontrolle
`SELECT id, version, profile, active, weights->'fit_breakdown' FROM matching_config ORDER BY active DESC` ausführen und Ergebnis ausgeben.

### Ablauf technisch
- Teil A und C laufen über `psql` (Read-only), da nur SELECTs.
- Teil B (falls erforderlich) läuft als eine einzige Supabase-Migration — INSERT + UPDATE zusammen, damit atomar und reviewbar.
- Kein Schema-Change, keine Edge Function, kein Frontend-Code.
