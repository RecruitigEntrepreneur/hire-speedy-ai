
# Plan: Interview-Erkenntnisse nach oben verschieben

## Problem

Die `QuickInterviewSummary` (Interview-Erkenntnisse) ist aktuell:

1. **Versteckt im Profil-Tab** - innerhalb der rechten Spalte des Two-Column-Layouts
2. **Ganz unten** - nach Karriere-Timeline, vor Similar Candidates
3. **Nicht sofort sichtbar** - User müssen scrollen

Das widerspricht dem Ziel, Interview-Daten prominent zu platzieren, da diese für das Exposé essentiell sind.

---

## Lösung: Neue Position direkt unter Hero

Die `QuickInterviewSummary` wird aus dem Tab herausgeholt und direkt unter der Hero-Section platziert, in einem neuen Two-Column-Layout:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Hero Header                                   │
│  [Avatar] Juliane Hotarek · Scrum Master · 14J                      │
│  [Stage Pipeline] [Stats Bar]                                        │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌────────────────────────────────────┬────────────────────────────────┐
│                                    │  Interview-Erkenntnisse        │
│  [Tabs: Profil | Prozess]          │  ┌───────────────────────────┐ │
│                                    │  │ Für Exposé fehlen:        │ │
│  Profil-Inhalt...                  │  │ ✗ Gehaltsvorstellung      │ │
│                                    │  │ ✗ Wechselmotivation       │ │
│                                    │  │ ✗ Verfügbarkeit           │ │
│                                    │  │ ✗ Einschätzung            │ │
│                                    │  │ [Interview jetzt starten] │ │
│                                    │  └───────────────────────────┘ │
└────────────────────────────────────┴────────────────────────────────┘
```

---

## Technische Umsetzung

### Datei 1: `src/pages/recruiter/RecruiterCandidateDetail.tsx`

1. **Import hinzufügen**: `QuickInterviewSummary` importieren
2. **Neues Layout erstellen**: Nach Hero ein Two-Column-Grid
   - Linke Spalte (2/3): Tabs + Tab-Content
   - Rechte Spalte (1/3): QuickInterviewSummary + optional weitere Cards (sticky)

```typescript
// Nach dem Hero Header (Zeile ~394):
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  {/* Main Content - 2/3 */}
  <div className="lg:col-span-2">
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      ...
    </Tabs>
  </div>
  
  {/* Right Sidebar - 1/3 */}
  <div className="space-y-4">
    <div className="lg:sticky lg:top-4">
      <QuickInterviewSummary 
        candidateId={candidate.id}
        onViewDetails={() => setInterviewSliderOpen(true)}
      />
    </div>
  </div>
</div>
```

### Datei 2: `src/components/candidates/CandidateProfileTab.tsx`

1. **QuickInterviewSummary entfernen** aus dem Right Column (Zeile 151-155)
2. Die rechte Spalte enthält dann nur noch: Karriere-Timeline + Similar Candidates

---

## Vorteile der neuen Position

| Aspekt | Vorher | Nachher |
|--------|--------|---------|
| Sichtbarkeit | Versteckt im Tab | Sofort sichtbar |
| Position | Nach Karriere-Timeline | Neben Hero |
| Verhalten | Scrollt mit Content | Sticky in Sidebar |
| CTA | Leicht übersehen | Prominent oben rechts |

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `src/pages/recruiter/RecruiterCandidateDetail.tsx` | Neues Grid-Layout mit rechter Sidebar |
| `src/components/candidates/CandidateProfileTab.tsx` | QuickInterviewSummary entfernen |

---

## Erwartetes Ergebnis

Die "Interview-Erkenntnisse" Card mit dem "Interview jetzt starten" Button erscheint nun:
- Direkt unter dem Hero Header
- Auf der rechten Seite (1/3 Breite)
- Sticky beim Scrollen
- Auf allen Tabs sichtbar (nicht nur im Profil-Tab)
