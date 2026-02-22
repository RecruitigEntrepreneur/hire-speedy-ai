

# Expose-kritische Aufgaben in der Hero-Sektion

## Kernidee

Statt jedes einzelne Feld als separate Aufgabe anzuzeigen, werden die fehlenden Daten auf **zwei Haupt-Aktionen** reduziert, weil CV-Upload und Interview den Grossteil der Expose-Daten automatisch befuellen:

1. **"CV hochladen und analysieren lassen"** -- fehlt wenn `cv_ai_summary` oder `cv_ai_bullets` leer sind. Befuellt automatisch: Skills, Erfahrung, Standort, CV Summary, CV Highlights.
2. **"Interview durchfuehren"** -- fehlt wenn keine `candidate_interview_notes` vorhanden sind. Befuellt automatisch: Gehaltsvorstellung, Wechselmotivation, Verfuegbarkeit, Empfehlung.

Falls **nach** CV + Interview trotzdem noch einzelne Felder fehlen (z.B. Gehalt wurde im Interview nicht besprochen), erscheinen diese als zusaetzliche Einzel-Aufgaben.

## Layout

```text
+---------------------------------------------------+
| Aufgaben                              2 offen      |
| ! Opt-In bestaetigen (DB-Task, falls vorhanden)    |
| i CV hochladen und analysieren lassen              |
|   [CV hochladen]                                   |
| i Interview durchfuehren                           |
|   [Interview starten]                              |
+---------------------------------------------------+
```

Nach CV + Interview, falls z.B. Gehalt immer noch fehlt:

```text
+---------------------------------------------------+
| Aufgaben                              1 offen      |
| i Gehaltsvorstellung erfragen                      |
|   [Anrufen] [Bearbeiten]                           |
+---------------------------------------------------+
```

Wenn alles vollstaendig ist, erscheinen keine Expose-Aufgaben.

## Logik

1. Pruefe ob `cv_ai_summary` ODER `cv_ai_bullets` fehlen --> eine Aufgabe "CV hochladen"
2. Pruefe ob `candidate_interview_notes` fuer diesen Kandidaten existieren --> falls nein, eine Aufgabe "Interview durchfuehren"
3. Falls CV und Interview vorhanden, aber `expected_salary`, `availability_date`/`notice_period` oder `city` trotzdem leer --> Einzel-Aufgaben fuer die verbleibenden Luecken
4. Die Expose-Aufgaben erscheinen **nach** den bestehenden DB-Tasks (Influence Alerts) in der gleichen Liste
5. Blaues Info-Icon statt amber/rot, um sie optisch von kritischen DB-Tasks zu unterscheiden

## Technische Umsetzung

### `CandidateTasksSection.tsx`
- Neue Props: `candidate` (Kandidaten-Objekt mit den Expose-relevanten Feldern), `onEdit` (Profil bearbeiten), `onCvUpload` (CV-Dialog oeffnen), `onStartInterview` (Interview-Slider oeffnen)
- Nutzt `getExposeReadiness(candidate)` um fehlende Felder zu ermitteln
- Laedt zusaetzlich `candidate_interview_notes` (count-Check, ob mindestens eine Zeile existiert)
- Generiert Pseudo-Tasks: zuerst die zwei grossen (CV / Interview), dann Einzel-Reste
- CV Summary + CV Highlights werden zu einer Aufgabe zusammengefasst
- Skills + Erfahrung werden der CV-Aufgabe zugeordnet (nicht separat angezeigt, wenn CV fehlt)
- Gehalt + Verfuegbarkeit werden der Interview-Aufgabe zugeordnet (nicht separat, wenn Interview fehlt)

### `CandidateHeroHeader.tsx`
- Uebergibt `candidate`, `onEdit`, `onCvUpload` an `CandidateTasksSection`
- Neues Prop `onStartInterview` wird durchgereicht

### `RecruiterCandidateDetail.tsx`
- Uebergibt `onStartInterview` (oeffnet Interview-Slider) an `CandidateHeroHeader`

| Datei | Aenderung |
|---|---|
| `src/components/candidates/CandidateTasksSection.tsx` | Neue Props, Expose-Readiness-Check, Interview-Notes-Check, Pseudo-Tasks |
| `src/components/candidates/CandidateHeroHeader.tsx` | Neue Props durchreichen an TasksSection |
| `src/pages/recruiter/RecruiterCandidateDetail.tsx` | `onStartInterview` Callback uebergeben |

Keine DB-Aenderungen, keine neuen Dependencies.

