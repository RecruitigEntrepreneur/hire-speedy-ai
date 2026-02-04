
# Plan: Profil-Tab Frontend-Optimierungen

## Zusammenfassung

Der aktuelle Profil-Tab zeigt die Daten unstrukturiert und nutzt vorhandene Komponenten nicht. Dieser Plan optimiert die Darstellung durch:
1. Fehlende Daten durchreichen (cv_ai_summary, experiences)
2. Vorhandene Komponenten einbinden (CandidateExperienceTimeline)
3. Bessere visuelle Hierarchie und Leer-Zustande

---

## Analyse: Was existiert bereits

| Feature | Komponente | Status |
|---------|------------|--------|
| Karriere-Timeline | `CandidateExperienceTimeline.tsx` | Existiert, nicht verwendet |
| AI CV Summary | `cv_ai_summary` Feld | Wird nur an ProcessTab ubergeben |
| Profil-Vollstandigkeit | `useExposeReadiness` Hook | Im Header, ohne Details |
| Skills mit Kategorien | Einfache Badge-Liste | Keine Priorisierung |

---

## Anderungen

### 1. CandidateProfileTab Props erweitern

**Datei:** `src/components/candidates/CandidateProfileTab.tsx`

Fehlende Daten zum Interface hinzufugen:

```typescript
interface CandidateProfileTabProps {
  candidate: {
    id: string;
    job_title?: string | null;
    seniority?: string | null;
    experience_years?: number | null;
    city?: string | null;
    expected_salary?: number | null;
    salary_expectation_min?: number | null;
    salary_expectation_max?: number | null;
    current_salary?: number | null;
    notice_period?: string | null;
    availability_date?: string | null;
    remote_possible?: boolean | null;
    remote_preference?: string | null;
    skills?: string[] | null;
    certifications?: string[] | null;
    // NEU: Fehlende Felder
    cv_ai_summary?: string | null;
    cv_ai_bullets?: string[] | null;
  };
  tags: CandidateTag[];
  onViewFullInterview: () => void;
}
```

### 2. RecruiterCandidateDetail: Mehr Daten ubergeben

**Datei:** `src/pages/recruiter/RecruiterCandidateDetail.tsx`

Im CandidateProfileTab-Aufruf die fehlenden Props hinzufugen:

```typescript
<CandidateProfileTab 
  candidate={{
    // ... bestehende Felder
    cv_ai_summary: extCandidate?.cv_ai_summary,
    cv_ai_bullets: extCandidate?.cv_ai_bullets,
  }}
  // ...
/>
```

### 3. Neues Layout fur CandidateProfileTab

**Datei:** `src/components/candidates/CandidateProfileTab.tsx`

Neues, strukturiertes Layout mit klarer Hierarchie:

```text
+------------------------------------------------------------------+
|  ECKDATEN-GRID (8 Kacheln mit Icons)                             |
|  [Rolle] [Erfahrung] [Seniority] [Standort]                      |
|  [Gehalt] [Verfugbar] [Remote] [Fuhrung]                         |
+------------------------------------------------------------------+

+--------------------------------+  +-------------------------------+
|  SKILLS & EXPERTISE            |  |  KARRIERE-TIMELINE            |
|                                |  |                               |
|  Kernkompetenzen (Top 6)       |  |  o Senior Director Finance    |
|  [Skill1] [Skill2] [Skill3]    |  |  |  Company ABC | 2020-heute  |
|  [Skill4] [Skill5] [Skill6]    |  |  o Finance Manager            |
|                                |  |  |  Company XYZ | 2015-2020   |
|  Weitere: [+14 mehr]           |  |                               |
|                                |  |  [Mehr laden]                 |
|  Zertifizierungen              |  |                               |
|  [AWS] [SAP]                   |  |                               |
+--------------------------------+  +-------------------------------+

+--------------------------------+  +-------------------------------+
|  AI-ZUSAMMENFASSUNG (CV)       |  |  INTERVIEW-ERKENNTNISSE       |
|                                |  |                               |
|  "Erfahrener Finance Director  |  |  Noch kein Interview gefuhrt  |
|  mit 25 Jahren Erfahrung..."   |  |                               |
|                                |  |  Fur ein vollstandiges Expose |
|  o Highlight 1                 |  |  fehlen:                      |
|  o Highlight 2                 |  |  x Gehaltsvorstellung         |
|  o Highlight 3                 |  |  x Wechselmotivation          |
|                                |  |  x Verfugbarkeit              |
|  [Mehr anzeigen]               |  |                               |
+--------------------------------+  |  [Interview starten]          |
                                    +-------------------------------+

+--------------------------------+  +-------------------------------+
|  DOKUMENTE (kompakt)           |  |  AHNLICHE KANDIDATEN          |
|                                |  |                               |
|  Lebenslauf.pdf                |  |  Berechnung lauft...          |
|  v1 - 428 KB - 28.01.          |  |  [========    ] 75%           |
|  [Ansehen] [Download]          |  |                               |
|                                |  |  Oder: Keine gefunden         |
|  [+ Hochladen]                 |  |  [Skills anpassen]            |
+--------------------------------+  +-------------------------------+
```

### 4. Neue Komponente: CandidateKeyFactsGrid

**Datei:** `src/components/candidates/CandidateKeyFactsGrid.tsx` (NEU)

Ein 8-Kachel Grid fur die wichtigsten Eckdaten:

```typescript
interface KeyFactTile {
  icon: LucideIcon;
  label: string;
  value: string | null;
  missing?: boolean;
  highlight?: 'green' | 'blue' | 'amber';
}

const tiles: KeyFactTile[] = [
  { icon: User, label: 'Rolle', value: candidate.job_title },
  { icon: Briefcase, label: 'Erfahrung', value: `${candidate.experience_years}J` },
  { icon: TrendingUp, label: 'Seniority', value: seniorityLabels[candidate.seniority] },
  { icon: MapPin, label: 'Standort', value: candidate.city },
  { icon: Euro, label: 'Gehalt', value: salaryRange, highlight: 'green', missing: !salaryRange },
  { icon: Clock, label: 'Verfugbar', value: availabilityText, missing: !availabilityText },
  { icon: Home, label: 'Remote', value: remoteText, highlight: 'blue' },
  { icon: Users, label: 'Fuhrung', value: leadershipText },
];
```

**Features:**
- Fehlende Werte: Orange Badge "Fehlt"
- Quellenindikator-Icon unten rechts (CV/Interview)
- Hover zeigt "Im Interview erfassen"

### 5. Neue Komponente: CandidateCvAiSummaryCard

**Datei:** `src/components/candidates/CandidateCvAiSummaryCard.tsx` (NEU)

Zeigt das AI-Summary aus dem CV-Parsing:

```typescript
interface Props {
  summary: string | null;
  bullets: string[] | null;
}

// Kompakte Karte mit:
// - Collapsible fur lange Summaries
// - Bullet-Points als Liste
// - "Sparkles" Icon fur AI-Indikator
```

### 6. Verbesserte QuickInterviewSummary (Leer-Zustand)

**Datei:** `src/components/candidates/QuickInterviewSummary.tsx`

Wenn kein Interview existiert, zeige eine Checkliste was fehlt:

```typescript
// Ersetze:
<p className="text-sm text-muted-foreground">
  Noch kein Interview gefuhrt...
</p>

// Mit:
<div className="space-y-2">
  <p className="text-sm font-medium">
    Fur ein vollstandiges Expose fehlen:
  </p>
  <ul className="text-sm space-y-1">
    <li className="flex items-center gap-2 text-muted-foreground">
      <XCircle className="h-3 w-3 text-amber-500" />
      Gehaltsvorstellung (Wunsch + Minimum)
    </li>
    <li className="flex items-center gap-2 text-muted-foreground">
      <XCircle className="h-3 w-3 text-amber-500" />
      Wechselmotivation
    </li>
    <li className="flex items-center gap-2 text-muted-foreground">
      <XCircle className="h-3 w-3 text-amber-500" />
      Verfugbarkeit / Kundigungsfrist
    </li>
    <li className="flex items-center gap-2 text-muted-foreground">
      <XCircle className="h-3 w-3 text-amber-500" />
      Deine Einschatzung & Empfehlung
    </li>
  </ul>
</div>
```

### 7. Verbesserte SimilarCandidates (Loading/Leer)

**Datei:** `src/components/candidates/SimilarCandidates.tsx`

**Loading-Zustand:**
```typescript
// Ersetze Skeleton mit Progress-Bar
<div className="space-y-2">
  <p className="text-sm text-muted-foreground">AI-Analyse lauft...</p>
  <Progress value={75} className="h-1.5" />
</div>
```

**Leer-Zustand:**
```typescript
<div className="text-center py-4">
  <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
  <p className="text-sm text-muted-foreground mb-2">
    Keine ahnlichen Kandidaten gefunden
  </p>
  <p className="text-xs text-muted-foreground">
    Mehr Skills hinzufugen fur bessere Matches
  </p>
</div>
```

### 8. Kompaktere CandidateDocumentsManager

**Datei:** `src/components/candidates/CandidateDocumentsManager.tsx`

Vereinfachtes Layout fur den Profil-Tab:

- Header kleiner machen
- Upload-Bereich nur als Button (nicht als volle Section)
- Dokument-Liste ohne Collapsible wenn nur 1-2 Dokumente
- Inline Actions (Ansehen, Download, Loschen) in einer Zeile

---

## Dateien

| Datei | Aktion |
|-------|--------|
| `src/pages/recruiter/RecruiterCandidateDetail.tsx` | ANDERN - cv_ai_summary Props durchreichen |
| `src/components/candidates/CandidateProfileTab.tsx` | ANDERN - Neues Layout, mehr Props |
| `src/components/candidates/CandidateKeyFactsGrid.tsx` | NEU - 8-Kachel Eckdaten-Grid |
| `src/components/candidates/CandidateCvAiSummaryCard.tsx` | NEU - AI-Summary Anzeige |
| `src/components/candidates/QuickInterviewSummary.tsx` | ANDERN - Besserer Leer-Zustand |
| `src/components/candidates/SimilarCandidates.tsx` | ANDERN - Loading/Leer-Zustande |
| `src/components/candidates/CandidateDocumentsManager.tsx` | ANDERN - Kompakteres Design |

---

## Reihenfolge der Implementierung

1. **Props erweitern** - RecruiterCandidateDetail + CandidateProfileTab Interface
2. **CandidateKeyFactsGrid** erstellen - Ersetzt CandidateKeyFactsCard
3. **CandidateCvAiSummaryCard** erstellen - Zeigt AI-Summary
4. **CandidateProfileTab Layout** - Neues Grid mit allen Komponenten
5. **QuickInterviewSummary** - Leer-Zustand verbessern
6. **SimilarCandidates** - Loading/Leer verbessern
7. **CandidateDocumentsManager** - Kompakteres Design

---

## Technische Details

### Grid-Layout fur CandidateProfileTab

```tsx
<div className="space-y-6">
  {/* Eckdaten-Grid - Volle Breite */}
  <CandidateKeyFactsGrid candidate={candidate} />
  
  {/* Zwei-Spalten Layout */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* Linke Spalte */}
    <div className="space-y-6">
      {/* Skills Card */}
      <CandidateSkillsCard skills={candidate.skills} certifications={candidate.certifications} />
      
      {/* AI Summary aus CV */}
      {candidate.cv_ai_summary && (
        <CandidateCvAiSummaryCard 
          summary={candidate.cv_ai_summary} 
          bullets={candidate.cv_ai_bullets} 
        />
      )}
      
      {/* Dokumente (kompakt) */}
      <CandidateDocumentsManager candidateId={candidate.id} compact />
    </div>
    
    {/* Rechte Spalte */}
    <div className="space-y-6">
      {/* Karriere-Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Karriere-Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CandidateExperienceTimeline candidateId={candidate.id} />
        </CardContent>
      </Card>
      
      {/* Interview-Erkenntnisse */}
      <QuickInterviewSummary 
        candidateId={candidate.id}
        onViewDetails={onViewFullInterview}
      />
      
      {/* Ahnliche Kandidaten */}
      <SimilarCandidates candidateId={candidate.id} limit={3} />
    </div>
  </div>
</div>
```

### CandidateKeyFactsGrid Styling

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
  {tiles.map((tile, i) => (
    <div 
      key={i}
      className={cn(
        "p-3 rounded-lg border text-center",
        tile.missing && "border-dashed border-amber-300 bg-amber-50/50",
        tile.highlight === 'green' && "bg-green-50/50 border-green-200",
        tile.highlight === 'blue' && "bg-blue-50/50 border-blue-200",
        !tile.missing && !tile.highlight && "bg-card"
      )}
    >
      <tile.icon className={cn(
        "h-5 w-5 mx-auto mb-1",
        tile.missing ? "text-amber-500" : "text-primary"
      )} />
      <p className="text-xs text-muted-foreground">{tile.label}</p>
      <p className={cn(
        "text-sm font-medium mt-0.5",
        tile.missing && "text-amber-600"
      )}>
        {tile.value || 'Fehlt'}
      </p>
    </div>
  ))}
</div>
```

---

## Erwartetes Ergebnis

Nach der Implementierung:

1. **Eckdaten auf einen Blick** - 8 Kacheln zeigen sofort alle wichtigen Fakten
2. **Fehlende Daten sichtbar** - Orange markierte Kacheln zeigen was fehlt
3. **AI-Summary sichtbar** - CV-Parsing-Ergebnisse werden angezeigt
4. **Karriere-Timeline** - Berufserfahrung als Timeline dargestellt
5. **Actionable Leer-Zustande** - Interview-Box zeigt genau was fehlt
6. **Kompaktere Dokumente** - Weniger Platz fur 1-2 Dokumente
