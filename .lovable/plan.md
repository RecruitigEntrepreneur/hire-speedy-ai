

# "Empfehlung" aus den Expose-Pflichtfeldern entfernen

## Aenderung

Das Feld "Empfehlung" (`would_recommend`) wird aus der Expose-Readiness-Pruefung entfernt. Die Recruiter-Empfehlung ist ein optionales Qualitaetssignal, aber keine Voraussetzung fuer das Expose.

## Auswirkung

- **Vorher**: 13 Pflichtfelder, 85% Schwelle = mind. 12 noetig
- **Nachher**: 12 Pflichtfelder, 85% Schwelle = mind. 11 noetig

## Technische Umsetzung

| Datei | Aenderung |
|---|---|
| `src/hooks/useExposeReadiness.ts` | Den Check `{ field: 'Empfehlung', valid: candidate.would_recommend != null }` aus beiden Funktionen (`useExposeReadiness` und `getExposeReadiness`) entfernen. Das Interface bleibt unveraendert (Feld wird weiterhin optional akzeptiert, aber nicht mehr geprueft). |
| `src/components/candidates/CandidateTasksSection.tsx` | "Empfehlung" aus der `fieldTaskMap` und aus `INTERVIEW_FIELDS` entfernen, damit keine Aufgabe "Empfehlung abgeben" mehr erscheint. |

Keine weiteren Dateien betroffen. Keine DB-Aenderungen.

