
# Kanban-Board Layout fuer Talent Hub

## Problem
Aktuell werden alle Kandidaten in einem flachen Grid untereinander angezeigt. Der Kunde wuenscht sich eine horizontale Aufteilung nach Stages -- wie ein Kanban-Board mit Spalten nebeneinander: **Neu | Interview 1 | Interview 2 | Angebot | Eingestellt**.

## Loesung

Das Grid wird durch ein horizontales Spalten-Layout ersetzt. Jede Pipeline-Stage bekommt eine eigene Spalte mit Header (Stage-Name + Anzahl) und vertikal scrollbaren Karten darunter. Leere Spalten werden mit einem Platzhalter angezeigt.

```text
+------------+------------+------------+----------+-------------+
| Neu (6)    | Int. 1 (2) | Int. 2 (1) | Angebot  | Eingestellt |
|            |            |            | (2)      | (1)         |
+------------+------------+------------+----------+-------------+
| [Card]     | [Card]     | [Card]     | [Card]   | [Card]      |
| [Card]     | [Card]     |            | [Card]   |             |
| [Card]     |            |            |          |             |
| [Card]     |            |            |          |             |
| [Card]     |            |            |          |             |
| [Card]     |            |            |          |             |
+------------+------------+------------+----------+-------------+
         <-- horizontal scroll if needed -->
```

---

## Technische Aenderungen

### Datei 1: `src/pages/dashboard/TalentHub.tsx`

**Gruppierungslogik hinzufuegen (nach Zeile 316):**

Ein neues `useMemo` gruppiert `candidatesWithInterviews` nach Stage:
```typescript
const candidatesByStage = useMemo(() => {
  const grouped: Record<string, typeof candidatesWithInterviews> = {};
  PIPELINE_STAGES.forEach(stage => {
    grouped[stage.key] = candidatesWithInterviews.filter(c => c.stage === stage.key);
  });
  return grouped;
}, [candidatesWithInterviews]);
```

**Rendering aendern (Zeilen 610-668):**

Das bisherige `grid grid-cols-4` wird ersetzt durch ein horizontales Kanban-Layout:

- Aeusserer Container: `flex gap-4 overflow-x-auto` mit horizontalem Scroll
- Pro Stage eine Spalte: `flex-shrink-0 w-[300px]` (feste Breite, kein Zusammenstauchen)
- Spalten-Header: Stage-Name mit farbigem Dot + Kandidaten-Anzahl als Badge
- Karten vertikal gestapelt innerhalb jeder Spalte: `flex flex-col gap-3`
- Leere Spalten: Grauer Platzhalter-Text "Keine Kandidaten"
- Wenn ein bestimmter Stage-Filter aktiv ist (nicht "Alle"), wird nur diese eine Spalte angezeigt -- breiter, als Grid wie bisher

**Stage-Tabs behalten ihre Filter-Funktion:**
- "Alle" → Kanban-Board mit allen Spalten
- Einzelner Stage-Tab → Nur diese Spalte, volle Breite, Cards im Grid-Layout wie bisher

### Datei 2: `src/components/talent/CandidateActionCard.tsx`

**Einheitliche Kartenhoehe:**

- Card (Zeile 178): `h-full flex flex-col` hinzufuegen
- CardContent (Zeile 187): `flex flex-col flex-1` hinzufuegen
- Skills-Bereich (ca. Zeile 247): `min-h-[28px]` hinzufuegen damit Karten ohne Skills gleich hoch bleiben
- Action-Buttons Container (ca. Zeile 296): `mt-auto` hinzufuegen damit Buttons immer am unteren Rand kleben

---

## Zusammenfassung

| Datei | Aenderung | Aufwand |
|-------|-----------|--------|
| `TalentHub.tsx` | Kanban-Spalten-Layout statt Grid | M |
| `CandidateActionCard.tsx` | Einheitliche Kartenhoehe via Flex | S |

Keine DB-Aenderungen. Keine neuen Abhaengigkeiten.
