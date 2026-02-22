

# Hero-Sektion aufraumen: Dopplungen entfernen, Tasks integrieren, Layout optimieren

## Problem
Die Hero-Sektion zeigt Rolle, Standort und Erfahrung doppelt -- einmal in der Meta-Zeile unter dem Namen und nochmal im Key Facts Grid. Ausserdem fehlen die offenen Aufgaben in der Hero-Sektion, und die Interview-Erkenntnisse nehmen zu viel Platz ein.

## Aenderungen

### 1. Dopplungen im Key Facts Grid entfernen
Die drei Tiles **Rolle**, **Standort** und **Erfahrung** werden aus dem `CandidateKeyFactsGrid` entfernt, da diese Infos bereits in der Hero-Meta-Zeile stehen. Das Grid reduziert sich von 8 auf 5 Tiles:

| Vorher (8 Tiles) | Nachher (5 Tiles) |
|---|---|
| ~~Rolle~~ / ~~Erfahrung~~ / Seniority / ~~Standort~~ / Gehalt / Verfuegbar / Remote / Fuehrung | Seniority / Gehalt / Verfuegbar / Remote / Fuehrung |

Grid-Klasse wird von `lg:grid-cols-8` auf `lg:grid-cols-5` angepasst.

**Datei: `CandidateKeyFactsGrid.tsx`**

### 2. Tasks in die Hero-Sektion integrieren
Die `CandidateTasksSection` wird zusaetzlich in die Hero-Card eingebaut -- unterhalb des Key Facts Grid, als kompakte Aufgaben-Leiste. Die Hero-Komponente bekommt `candidateId` und `activeTaskId` als neue Props.

**Datei: `CandidateHeroHeader.tsx`**
- Neue Props: `candidateId`, `activeTaskId`
- Import und Einbau von `CandidateTasksSection` nach dem Key Facts Grid

**Datei: `RecruiterCandidateDetail.tsx`**
- `candidateId` und `activeTaskId` an `CandidateHeroHeader` weitergeben

### 3. Interview-Erkenntnisse halbieren und rechtsbuendig
Die `QuickInterviewSummary` wird aus der vollen Breite (100%) in ein 2-Spalten-Layout verschoben -- rechtsbuendig, also in die rechte Haelfte. Die linke Spalte bleibt frei oder wird vom Skills-Block genutzt.

**Datei: `CandidateMainContent.tsx`**
- QuickInterviewSummary aus dem Full-Width-Bereich entfernen
- In die rechte Spalte des bestehenden 2-Column-Grids verschieben (vor Karriere-Timeline)
- Dokumente ans Ende der rechten Spalte verschieben

### 4. Dokumente nach unten verschieben
`CandidateDocumentsManager` wird in der rechten Spalte nach unten verschoben -- unter die Karriere-Timeline.

## Neues Layout

```text
HERO CARD:
+------------------------------------------------------------------+
| Avatar | Name, Rolle, Standort, Erfahrung  | Actions              |
|--------|--------------------------------------------------------------|
| Pipeline: [Neu] [Kontakt] [Interview] [Angebot] [Platziert]      |
|--------|--------------------------------------------------------------|
| Seniority | Gehalt | Verfuegbar | Remote | Fuehrung               |
|--------|--------------------------------------------------------------|
| Offene Aufgaben (kompakt)                                         |
+------------------------------------------------------------------+

UEBERSICHT TAB:
+-------------------------------+-------------------------------+
| Skills & Zertifikate          | Interview-Erkenntnisse        |
| CV AI Summary                 | Tags                          |
|                               | Karriere-Timeline             |
|                               | Dokumente                     |
+-------------------------------+-------------------------------+
```

## Technische Details

| Datei | Aenderung |
|---|---|
| `CandidateKeyFactsGrid.tsx` | 3 doppelte Tiles entfernen, Grid auf 5 Spalten |
| `CandidateHeroHeader.tsx` | Props erweitern, CandidateTasksSection einbauen |
| `CandidateMainContent.tsx` | QuickInterviewSummary in rechte Spalte, Dokumente ans Ende |
| `RecruiterCandidateDetail.tsx` | Neue Props an HeroHeader durchreichen |

Keine DB-Aenderungen, keine neuen Dateien.
