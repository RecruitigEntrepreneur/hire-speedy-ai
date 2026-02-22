

# Kandidatenseite Optimierung: Dopplungen entfernen, Pipeline read-only, Sektionen gruppieren

## Aenderungen

### 1. Pipeline read-only machen (`CandidateStagePipeline.tsx`)
- `button` Element wird zu `div` -- kein `onClick`, kein `cursor-pointer`, kein `hover:scale-105`
- `onStageChange` Prop bleibt optional aber wird ignoriert
- Pipeline ist rein visueller Indikator, gesteuert durch `automation-hub` Backend

### 2. Quick Facts aus Sidebar entfernen (`CandidateSidebar.tsx`)
- Gesamten "Quick Facts"-Block entfernen (Gehalt, Verfuegbar, Remote, Seniority Zeilen)
- `QuickFactRow`-Komponente und Label-Maps (`seniorityLabels`, `noticePeriodLabels`, `remoteLabels`) entfernen
- Sidebar behaelt nur: Skills, AI-Summary, Dokumente, Tags
- Props fuer Salary/Availability/Remote/Seniority werden nicht mehr benoetigt

### 3. Hero Badges entfernen (`CandidateHeroHeader.tsx`)
- Inline-Badges fuer Availability und Salary entfernen (bereits im Key Facts Grid)
- Expose-Ready Badge bleibt (das ist kein Duplikat)
- Props `availabilityText` und `salaryText` entfernen
- `onStatusChange` und `statusMutationPending` Props entfernen (Pipeline ist jetzt read-only)

### 4. Hauptbereich in Sektionen gruppieren (`CandidateMainContent.tsx`)
- 4 visuelle Sektionen mit kleinen Ueberschriften:
  - **Uebersicht**: Key Facts Grid
  - **Interview & Prozess**: Interview-Erkenntnisse, Interviews, Offene Aufgaben
  - **Matching & Bewerbungen**: Job Matching V3, AI-Einschaetzung, Alle Bewerbungen
  - **Historie**: Karriere-Timeline, Aehnliche Kandidaten, Letzte Aktivitaeten
- Jede Sektion bekommt ein `div` mit Titel (`text-xs font-semibold uppercase tracking-wider text-muted-foreground`) und `space-y-4`

### 5. RecruiterCandidateDetail aufraumen (`RecruiterCandidateDetail.tsx`)
- `statusMutation` komplett entfernen
- `getAvailabilityText()` und `getSalaryText()` Hilfsfunktionen entfernen
- `availabilityText`/`salaryText`/`onStatusChange`/`statusMutationPending` Props nicht mehr an Hero uebergeben
- Sidebar-Props vereinfachen (keine Salary/Availability/Remote Felder mehr)

## Zusammenfassung

| Datei | Aenderung |
|---|---|
| `CandidateStagePipeline.tsx` | `button` -> `div`, kein onClick/hover |
| `CandidateSidebar.tsx` | Quick Facts Block + QuickFactRow + Label-Maps entfernen |
| `CandidateHeroHeader.tsx` | Availability/Salary Badges + onStatusChange Props entfernen |
| `CandidateMainContent.tsx` | 4 Sektions-Header fuer visuelle Gruppierung |
| `RecruiterCandidateDetail.tsx` | statusMutation + Helper-Funktionen entfernen |

Keine neuen Dateien, keine DB-Aenderungen.

