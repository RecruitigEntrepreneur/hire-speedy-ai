
# Plan: Realistische Interview-Testdaten für Horst Schmid

## Kandidaten-Profil (aus DB)
- **Name:** Horst Schmid
- **Kandidat-ID:** `e1d0db66-0117-4901-932c-836b2d0b2ace`
- **Position:** Group-Director Finance and Accounting und Prokurist
- **Standort:** Weiden
- **Erfahrung:** 25 Jahre
- **Seniority:** Director
- **Skills:** Treasury, Controlling, Buchhaltung, Steuern, SAP, Reporting, Cash Management, KPI-Tracking, Führung
- **Zusammenfassung:** Erfahrener Finanz- und Controlling-Experte mit 15+ Jahren Führungserfahrung, Expertise in Prozessoptimierung und Liquiditätssteigerung

## Aktueller Stand
- Horst Schmid hat **keine aktive Submission** für einen Job
- Es existieren mehrere "Buchhalter (m/w/d)" Stellen - passt perfekt zu seinem Profil

## Datenbankoperationen

### Schritt 1: Submission erstellen
```sql
INSERT INTO submissions (
  id,
  job_id,
  candidate_id,
  recruiter_id,
  status,
  stage,
  match_score,
  match_policy,
  recruiter_notes,
  submitted_at,
  updated_at,
  consent_confirmed,
  company_revealed,
  identity_revealed
) VALUES (
  gen_random_uuid(),
  '8ddba02c-078b-4384-b449-2b0a7447f9cf',  -- Buchhalter (m/w/d) - published
  'e1d0db66-0117-4901-932c-836b2d0b2ace',  -- Horst Schmid
  '1503a289-a7da-4d95-93f0-2fb431d78b9f',  -- Recruiter
  'interview',                              -- Status: Interview-Phase
  'interview_scheduled',                    -- Stage: Interview geplant
  92,                                       -- High Match Score (25J Erfahrung, Director)
  'hot',                                    -- Hot Candidate
  'Horst Schmid ist ein idealer Kandidat für die Buchhalter-Position. Seine 25 Jahre Erfahrung als Group-Director Finance mit Prokura und seine SAP-Kenntnisse machen ihn zu einem Hot-Lead.',
  NOW() - INTERVAL '3 days',                -- Vor 3 Tagen eingereicht
  NOW(),
  true,                                     -- Consent confirmed
  true,                                     -- Company revealed
  true                                      -- Identity revealed (Director-Level)
);
```

### Schritt 2: Interview erstellen
```sql
INSERT INTO interviews (
  id,
  submission_id,
  scheduled_at,
  duration_minutes,
  meeting_link,
  meeting_type,
  status,
  notes,
  client_confirmed,
  client_confirmed_at,
  candidate_confirmed,
  candidate_confirmed_at,
  proposed_slots,
  selected_slot_index
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM submissions WHERE candidate_id = 'e1d0db66-0117-4901-932c-836b2d0b2ace' ORDER BY submitted_at DESC LIMIT 1),
  NOW() + INTERVAL '2 days' + INTERVAL '10 hours',  -- Übermorgen um 10:00
  60,                                                -- 60 Minuten (Director-Level)
  'https://teams.microsoft.com/l/meetup-join/...',   -- Teams-Link
  'video',                                           -- Video-Interview
  'scheduled',                                       -- Status: Geplant
  'Erstes Kennenlerngespräch mit Herrn Schmid. Fokus auf: 
  - Führungserfahrung als Group-Director Finance
  - SAP-Kenntnisse und Prozessoptimierung
  - Motivation für Wechsel nach 25 Jahren Erfahrung
  - Gehaltsvorstellungen und Verfügbarkeit',
  true,                                              -- Client bestätigt
  NOW() - INTERVAL '1 day',                          -- Gestern bestätigt
  true,                                              -- Kandidat bestätigt
  NOW() - INTERVAL '12 hours',                       -- Vor 12h bestätigt
  '[
    {"date": "2026-01-30", "time": "10:00", "label": "Do 30.01. um 10:00 Uhr"},
    {"date": "2026-01-30", "time": "14:00", "label": "Do 30.01. um 14:00 Uhr"},
    {"date": "2026-01-31", "time": "09:00", "label": "Fr 31.01. um 09:00 Uhr"}
  ]'::jsonb,
  0                                                  -- Erster Slot gewählt
);
```

## Realistische Interview-Details

| Feld | Wert | Begründung |
|------|------|------------|
| **Dauer** | 60 Minuten | Director-Level Kandidat benötigt ausführliches Gespräch |
| **Status** | `scheduled` | Vollständig bestätigt, bereit zum Start |
| **Match Score** | 92 | Hoher Score wegen 25J Erfahrung + Director + Finance-Expertise |
| **Match Policy** | `hot` | Perfekter Fit für Buchhalter-Stelle |
| **Meeting Type** | `video` | Standard für erstes Interview |
| **Termin** | Übermorgen 10:00 | Realistischer Zeitrahmen |

## Erwartetes Ergebnis

Nach Ausführung:
1. **Dashboard:** Horst Schmid erscheint als "Interview geplant" bei der Buchhalter-Stelle
2. **Interview Command Center:** Zeigt das bevorstehende Interview mit Countdown
3. **Kandidaten-Detail:** Stage-Pipeline zeigt "Interview" aktiv
4. **Workflow-Test:** Alle Interview-Actions (Starten, Feedback, No-Show) können getestet werden

## Dateien die geändert werden

Keine Dateiänderungen erforderlich - nur Datenbankoperationen via SQL Tool.
