

# Fix: Interview-Erkenntnisse in rechte Spalte des Profil-Tabs verschieben

## Problem

Aktuell haben wir ein **3-Spalten-Layout** auf Page-Level:
```
┌─────────────────────────────────────────────────────────────────────┐
│                         Hero Header                                  │
└─────────────────────────────────────────────────────────────────────┘
┌────────────────────────────┬─────────────────┬──────────────────────┐
│                            │                 │  Interview-          │
│   Tabs (2/3)               │                 │  Erkenntnisse        │
│                            │                 │                      │
└────────────────────────────┴─────────────────┴──────────────────────┘
                 ↑ Das ist falsch - 3 Spalten!
```

## Lösung

Die `QuickInterviewSummary` gehört **in die rechte Spalte des Profil-Tabs** (50/50 Layout), direkt **über** der Karriere-Timeline:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Hero Header                                  │
└─────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│   [Tabs: Profil | Prozess]                                          │
├─────────────────────────────────────────────────────────────────────┤
│                           Profil Tab (50/50)                        │
│  ┌────────────────────────────┬────────────────────────────────────┐│
│  │  Skills Card               │  Interview-Erkenntnisse  ← NEU     ││
│  │                            │  [Interview jetzt starten]         ││
│  │  AI Summary                ├────────────────────────────────────┤│
│  │                            │  Karriere-Timeline                 ││
│  │  Documents                 │                                    ││
│  │                            │  Similar Candidates                ││
│  └────────────────────────────┴────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technische Änderungen

### Datei 1: `src/pages/recruiter/RecruiterCandidateDetail.tsx`

**Änderung**: 3-Spalten-Grid zurück auf normales Layout ändern

Zeilen 407-504 (aktuelles Grid) vereinfachen:
- Entferne `grid-cols-3` Layout
- Entferne die separate rechte Sidebar mit `QuickInterviewSummary`
- Tabs bleiben volle Breite

```typescript
// Vorher (Zeile 407-408):
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2">

// Nachher:
<div>
  {/* Keine separate Sidebar mehr - QuickInterviewSummary wandert in CandidateProfileTab */}
```

### Datei 2: `src/components/candidates/CandidateProfileTab.tsx`

**Änderung**: `QuickInterviewSummary` in die rechte Spalte einfügen, über der Karriere-Timeline

```typescript
interface CandidateProfileTabProps {
  candidate: { ... };
  tags: CandidateTag[];
  onViewFullInterview?: () => void;  // ← NEU: Callback hinzufügen
}

export function CandidateProfileTab({ candidate, tags, onViewFullInterview }: CandidateProfileTabProps) {
  // ...

  return (
    <div className="space-y-6">
      {/* Key Facts Grid - Full Width */}
      <CandidateKeyFactsGrid candidate={candidate} />
      
      {/* Two-Column Layout (50/50) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <CandidateSkillsCard ... />
          <CandidateCvAiSummaryCard ... />
          <CandidateDocumentsManager ... />
        </div>
        
        {/* Right Column */}
        <div className="space-y-6">
          {/* NEU: Interview-Erkenntnisse OBEN */}
          <QuickInterviewSummary 
            candidateId={candidate.id}
            onViewDetails={onViewFullInterview}
          />
          
          {/* Karriere-Timeline (darunter) */}
          <Card>
            <CardHeader>
              <CardTitle>Karriere-Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <CandidateExperienceTimeline ... />
            </CardContent>
          </Card>
          
          {/* Similar Candidates */}
          <SimilarCandidates ... />
        </div>
      </div>
    </div>
  );
}
```

### Datei 3: `src/pages/RecruiterCandidateDetail.tsx` (Prop weitergeben)

```typescript
<CandidateProfileTab 
  candidate={...}
  tags={candidateTags}
  onViewFullInterview={() => setInterviewSliderOpen(true)}  // ← NEU
/>
```

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `RecruiterCandidateDetail.tsx` | 3-Spalten-Grid entfernen, normales Layout |
| `CandidateProfileTab.tsx` | `QuickInterviewSummary` in rechte Spalte einfügen (über Timeline) |
| `CandidateProfileTab.tsx` | Neues Prop `onViewFullInterview` für Interview-Slider |

---

## Erwartetes Ergebnis

- **2 Spalten (50/50)** im Profil-Tab bleiben erhalten
- **Interview-Erkenntnisse** erscheint ganz oben in der rechten Spalte
- **Karriere-Timeline** direkt darunter
- **Kein 3-Spalten-Layout** mehr auf Page-Level

