

## Plan: Migration + Edge Function fuer Intelligent Fit Assessment

### Schritt 1: Datenbank-Migration

Erstelle die Tabelle `candidate_fit_assessments` mit dem bereitgestellten SQL (Indices, RLS Policies, Trigger). Die Migration wird exakt den SQL-Code verwenden, den du angegeben hast.

### Schritt 2: Edge Function `assess-candidate-fit`

Da die Datei `supabase/functions/assess-candidate-fit/index.ts` **nicht im Repo existiert**, werde ich sie neu erstellen mit folgender Logik:

1. **Input**: `{ submissionId, force? }` als JSON Body
2. **Submission aufloesen**: submission laden, daraus `candidate_id` und `job_id` extrahieren
3. **Daten parallel laden**: `candidates`, `candidate_experiences`, `candidate_languages`, `candidate_skills`, `candidate_interview_notes`, `candidate_ai_assessment`, `jobs` -- alles per `Promise.all`
4. **SHA-256 Input-Hash**: Aus den gesammelten Daten einen Hash berechnen; wenn `force` nicht gesetzt und ein Assessment mit gleichem Hash existiert, cached zurueckgeben
5. **Lovable AI Gateway aufrufen**: `https://ai.gateway.lovable.dev/v1/chat/completions` mit `google/gemini-2.5-flash`, Function Calling (tool_choice) fuer strukturiertes Output mit dem Schema der Tabelle (overall_verdict, overall_score, executive_summary, requirement_assessments, gap_analysis, etc.)
6. **Upsert**: Ergebnis in `candidate_fit_assessments` speichern (ON CONFLICT submission_id)
7. **Response**: Assessment-Daten zurueckgeben

### Schritt 3: config.toml

Eintrag `[functions.assess-candidate-fit]` mit `verify_jwt = true` hinzufuegen.

### Aenderungen

| Datei | Aktion |
|---|---|
| `supabase/migrations/xxx.sql` | Neue Migration (Tabelle + RLS + Trigger) |
| `supabase/functions/assess-candidate-fit/index.ts` | Neue Edge Function |
| `supabase/config.toml` | Neuer Eintrag fuer die Function |

Keine weiteren Dateien werden geaendert. Types werden automatisch regeneriert nach der Migration.

