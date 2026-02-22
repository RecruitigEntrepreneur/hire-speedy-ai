

# Hero-Sektion: CV-Button, Firma anzeigen, kompakteres Layout

## Aenderungen

### 1. Aktuelle Firma neben Titel anzeigen (CandidateHeroHeader.tsx)
In der Meta-Zeile unter dem Namen wird `candidate.company` eingefuegt:

**Vorher:** `Geschaeftsfuehrer & CEO . Muenchen . 30J Erfahrung`
**Nachher:** `Geschaeftsfuehrer & CEO bei AIS Management . Muenchen . 30J Erfahrung`

Falls `candidate.company` leer ist, wird nur der Titel gezeigt (wie bisher).

### 2. CV-Button neben LinkedIn/Mail/Telefon (CandidateHeroHeader.tsx)
Ein neuer `FileText`-Icon-Button wird in die Action-Buttons-Reihe eingefuegt (zwischen LinkedIn und dem "..."-Menue). Klick oeffnet den aktuellen CV ueber `useCandidateDocuments`:
- Hook `useCandidateDocuments(candidateId)` importieren
- `getCurrentDocuments()` aufrufen, den ersten CV-Typ-Eintrag finden
- Button oeffnet die signierte URL in neuem Tab
- Button nur sichtbar wenn ein CV-Dokument existiert
- Tooltip: "CV oeffnen"

### 3. Aktive Prozesse subtiler gestalten (CandidateActiveProcesses.tsx)
Der Block nimmt aktuell zu viel Platz ein. Aenderungen:
- Jede Submission wird als einzeilige kompakte Zeile statt als Karte dargestellt
- Kein `border`, kein `rounded-lg`, kein `p-3` pro Eintrag
- Stattdessen eine einfache Liste mit `py-1.5` pro Zeile:
  - Links: Firmenname + Job-Titel in einer Zeile, getrennt durch " -- "
  - Mitte: Stage-Badge (kleiner)
  - Rechts: Interview-Countdown (falls vorhanden) + Meeting-Icon
- Kein separater Container pro Prozess, nur horizontale Trennung via `divide-y`

## Technische Details

| Datei | Aenderung |
|---|---|
| `CandidateHeroHeader.tsx` | `company` in Meta-Zeile; CV-Button mit `useCandidateDocuments` Hook; `FileText` Icon importieren |
| `CandidateActiveProcesses.tsx` | Kompaktes einzeiliges Layout statt Karten |

Keine DB-Aenderungen. Neue Abhaengigkeit: `useCandidateDocuments` Hook wird in der Hero-Komponente importiert.
