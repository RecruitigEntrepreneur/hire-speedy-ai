

# Readiness-Score Fix: Interview-Daten in Stammdaten uebernehmen

## Problem
Marko Benko hat 71% statt 100%, weil zwei Felder in der `candidates`-Tabelle leer sind:
- `expected_salary` = null (Interview sagt: 200.000 EUR Wunschgehalt)
- `notice_period` = null (Interview sagt: 6 Monate zum Quartalsende)

Die Daten existieren in `candidate_interview_notes`, wurden aber nie in die Stammdaten synchronisiert.

## Loesung

### Schritt 1: Marko Benkos Stammdaten aktualisieren (Datenbank)
SQL-Update um die fehlenden Felder zu fuellen:
- `expected_salary` = 200000
- `salary_expectation_min` = 185000
- `salary_expectation_max` = 220000
- `notice_period` = '6_months'

Damit springt der Score sofort auf 100%.

### Schritt 2: Interview-Save synchronisiert Stammdaten (Code-Aenderung)
Damit das Problem nicht bei jedem Kandidaten erneut auftritt, wird die `handleSave`-Funktion im `CandidateInterviewTab.tsx` erweitert: Wenn der Recruiter das Interview abschliesst, werden Gehalt und Kuendigungsfrist automatisch in die `candidates`-Tabelle geschrieben.

**Datei: `CandidateInterviewTab.tsx`**
- Nach dem erfolgreichen Speichern der Interview-Notizen: Supabase-Update auf `candidates` mit den relevanten Feldern (Gehalt, Kuendigungsfrist), sofern diese in den Notizen ausgefuellt sind und in den Stammdaten noch fehlen.

| Aenderung | Datei |
|---|---|
| Marko Benkos Stammdaten fuellen | SQL-Migration (einmalig) |
| Interview-Save synchronisiert Stammdaten | `CandidateInterviewTab.tsx` |

Keine neuen Tabellen, keine Schema-Aenderungen.
