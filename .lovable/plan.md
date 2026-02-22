

# Expose-Readiness umfassend erweitern

## Problem

Aktuell prueft `useExposeReadiness` nur 7 Felder. Ein CV-Upload allein genuegt fuer 86% (6/7) und markiert den Kandidaten faelschlicherweise als "Expose-Ready" -- obwohl Name, Telefon, E-Mail, Gehaltsvorstellung, Jobtitel und Interview-Daten fehlen koennen.

## Neuer Feldkatalog

Der Readiness-Check wird auf **13 Pflichtfelder** erweitert, gruppiert nach Quelle:

### Stammdaten (manuell/Import)
| Feld | Check | Aufgabe wenn fehlt |
|---|---|---|
| Name (`full_name`) | nicht leer | "Name eintragen" -> Bearbeiten |
| E-Mail (`email`) | nicht leer | "E-Mail eintragen" -> Bearbeiten |
| Telefon (`phone`) | nicht leer | "Telefonnummer eintragen" -> Bearbeiten |
| Jobtitel (`job_title`) | nicht leer | "Jobtitel eintragen" -> Bearbeiten |
| Standort (`city`) | nicht leer | "Standort eintragen" -> Bearbeiten |

### CV-basiert (automatisch via CV-Upload)
| Feld | Check | Aufgabe wenn fehlt |
|---|---|---|
| Skills (`skills`) | mind. 3 | Zusammengefasst als "CV hochladen" |
| Erfahrung (`experience_years`) | > 0 | Zusammengefasst als "CV hochladen" |
| CV Summary (`cv_ai_summary`) | nicht leer | Zusammengefasst als "CV hochladen" |
| CV Highlights (`cv_ai_bullets`) | mind. 1 | Zusammengefasst als "CV hochladen" |

### Interview-basiert (automatisch via Interview)
| Feld | Check | Aufgabe wenn fehlt |
|---|---|---|
| Gehalt (`expected_salary`) | > 0 | Zusammengefasst als "Interview durchfuehren" |
| Verfuegbarkeit (`availability_date` oder `notice_period`) | eins davon gesetzt | Zusammengefasst als "Interview durchfuehren" |
| Wechselmotivation (`change_motivation`) | nicht leer | Zusammengefasst als "Interview durchfuehren" |
| Empfehlung (`would_recommend`) | nicht null | Zusammengefasst als "Interview durchfuehren" |

### Neuer Schwellenwert

- 13 Felder total, 85%-Schwelle = mind. 12 von 13 muessen erfuellt sein
- Damit ist ein Kandidat erst "Expose-Ready" wenn Stammdaten, CV UND Interview komplett sind

## Auswirkung auf Tasks-Sektion

Die `CandidateTasksSection` gruppiert die fehlenden Felder weiterhin smart:

1. **Stammdaten-Luecken** -> Einzel-Aufgaben mit "Bearbeiten"-Button
2. **CV fehlt** -> eine Aufgabe "CV hochladen und analysieren lassen"
3. **Interview fehlt** -> eine Aufgabe "Interview durchfuehren"
4. **Residuale Luecken** (CV/Interview da, aber Feld trotzdem leer) -> Einzel-Aufgaben

Die neuen Felder `change_motivation` und `would_recommend` werden aus `candidate_interview_notes` geladen und dem Readiness-Check uebergeben.

## Technische Umsetzung

| Datei | Aenderung |
|---|---|
| `src/hooks/useExposeReadiness.ts` | `CandidateData` um 6 Felder erweitern (`full_name`, `email`, `phone`, `job_title`, `change_motivation`, `would_recommend`). 6 neue Checks in beiden Funktionen. |
| `src/components/candidates/CandidateTasksSection.tsx` | `CV_FIELDS` und `INTERVIEW_FIELDS` um neue Felder erweitern. Neues Array `PROFILE_FIELDS` fuer Stammdaten. `candidate`-Interface um neue Felder erweitern. `fieldTaskMap` um 6 neue Eintraege. |
| `src/pages/recruiter/RecruiterCandidateDetail.tsx` | Interview-Notes laden (`change_motivation`, `would_recommend`) und ans Readiness-Objekt uebergeben. |
| `src/components/candidates/CandidateDetailSheet.tsx` | Gleiche Interview-Notes-Erweiterung fuer die Sheet-Ansicht. |

Keine DB-Aenderungen, keine neuen Dependencies.

