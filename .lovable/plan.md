
# Zurueck zum einheitlichen Grid (ohne Kanban-Spalten)

## Was wird geaendert

Die Kanban-Spalten werden in beiden Dateien entfernt und durch ein einfaches, einheitliches Grid ersetzt. Die gleichmaessige Kartenhoehe (via `h-full`, `flex flex-col`, `mt-auto`) bleibt erhalten -- nur das Spalten-Layout geht weg.

## Aenderungen

### Datei 1: `src/pages/dashboard/TalentHub.tsx`

**1. `candidatesByStage` Memo entfernen** (Zeilen 317-326)
- Die Gruppierungslogik wird nicht mehr gebraucht.

**2. Rendering vereinfachen** (Zeilen 631-709)
- Die Verzweigung `stageFilter === 'all' ? Kanban : Grid` wird entfernt.
- Stattdessen wird immer ein einheitliches Grid gerendert:

```
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4
```

- `candidatesWithInterviews` wird direkt im Grid gemappt (wie es vorher bei der "single stage"-Ansicht schon der Fall war).
- Multi-Select-Checkbox und alle Interaktionen bleiben identisch.

### Datei 2: `src/components/dashboard/IntegratedTalentSection.tsx`

**1. `candidatesByStage` Memo entfernen** (Zeilen 284-292)

**2. Rendering vereinfachen** (Zeilen 542-621)
- Gleiche Aenderung: Kanban-Verzweigung raus, einheitliches Grid rein.
- Multi-Select-Checkbox und alle Interaktionen bleiben identisch.

### Datei 3: `src/components/talent/CandidateActionCard.tsx`

Keine Aenderung -- die einheitliche Kartenhoehe (`h-full`, `flex flex-col`, `mt-auto`, `min-h-[28px]` fuer Skills) bleibt bestehen.

---

## Ergebnis

- Alle Kandidaten erscheinen in einem gleichmaessigen Grid
- Karten sind alle gleich hoch (Action-Buttons immer unten)
- Stage-Tabs filtern wie gewohnt (kein Scrollen zu Spalten mehr)
- Kein verschwendeter Platz durch leere Kanban-Spalten
