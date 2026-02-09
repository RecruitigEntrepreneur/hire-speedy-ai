
# Kanban-Board auch fuer IntegratedTalentSection (Dashboard)

## Problem

Das Kanban-Board wurde nur in `TalentHub.tsx` implementiert. Auf dem Haupt-Dashboard (`/dashboard`) wird aber die `IntegratedTalentSection` angezeigt -- und diese nutzt weiterhin das alte flache Grid-Layout ohne Stage-Gruppierung.

## Loesung

Die gleiche Kanban-Logik aus `TalentHub.tsx` wird in `IntegratedTalentSection.tsx` uebernommen:

- Kandidaten werden per `PIPELINE_STAGES` gruppiert
- Bei "Alle"-Ansicht: horizontale Spalten nebeneinander (Kanban-Board)
- Bei Einzel-Stage-Filter: breites Grid wie bisher
- Leere Spalten zeigen einen Platzhalter

## Technische Aenderungen

### Datei: `src/components/dashboard/IntegratedTalentSection.tsx`

**1. Gruppierungslogik hinzufuegen (nach Zeile 282):**

```typescript
const candidatesByStage = useMemo(() => {
  const grouped: Record<string, typeof candidatesWithInterviews> = {};
  PIPELINE_STAGES.forEach(stage => {
    grouped[stage.key] = candidatesWithInterviews.filter(c => c.stage === stage.key);
  });
  return grouped;
}, [candidatesWithInterviews]);
```

**2. Rendering ersetzen (Zeilen 522-582):**

Das bisherige flache Grid (Zeilen 534-581) wird ersetzt durch eine Verzweigung:

- `stageFilter === 'all'` → Kanban-Board mit horizontalen Spalten
- Einzelner Stage-Filter → Breites Grid wie bisher

Kanban-Layout (identisch zu TalentHub.tsx):
```tsx
<div className="flex gap-4 overflow-x-auto pb-4">
  {PIPELINE_STAGES.map(stage => {
    const stageCandidates = candidatesByStage[stage.key] || [];
    return (
      <div key={stage.key} className="flex-shrink-0 w-[300px] flex flex-col">
        {/* Column Header mit Stage-Farbe, Label, Count */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-t-lg border-t-2 bg-muted/30 {stage.color}">
          <div className="w-2 h-2 rounded-full {stage.dotColor}" />
          <span className="text-xs font-semibold uppercase">{stage.label}</span>
          <Badge>{stageCandidates.length}</Badge>
        </div>
        {/* Karten vertikal gestapelt */}
        <div className="flex-1 bg-muted/10 rounded-b-lg border border-t-0 p-2 min-h-[200px]">
          {stageCandidates.length === 0
            ? <p>Keine Kandidaten</p>
            : stageCandidates.map(candidate => <CandidateActionCard ... />)
          }
        </div>
      </div>
    );
  })}
</div>
```

Multi-Select-Checkbox und alle bestehenden Interaktionen (Interview, Reject, Navigate) bleiben erhalten.

---

## Zusammenfassung

| Datei | Aenderung | Aufwand |
|-------|-----------|--------|
| `IntegratedTalentSection.tsx` | `candidatesByStage` Memo + Kanban-Rendering | M |

Keine DB-Aenderungen. Keine neuen Abhaengigkeiten. Das Pattern ist identisch zu `TalentHub.tsx`.
