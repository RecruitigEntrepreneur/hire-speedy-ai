

# Plan: Kandidaten-Hero-Section Professionalisieren

## Ist-Zustand Analyse

Die aktuelle Hero-Section hat folgende Probleme:

1. **Quick Actions (oben rechts)**: Icon-only Buttons wirken unfertig und sind nicht sofort verständlich
2. **Visuelle Hierarchie**: Flache Struktur ohne klare Prioritäten
3. **Stage Pipeline**: In einem grauen Kasten versteckt, keine Premium-Anmutung
4. **Keine Key-Stats**: Anders als bei `ClientJobHero` fehlt eine Statistik-Übersicht
5. **Gradient**: Schwacher Gradient, wenig visueller Impact

## Referenz: ClientJobHero

Das `ClientJobHero` verwendet:
- Starkes `bg-gradient-to-br from-card via-card to-accent/20`
- Overlay: `bg-gradient-to-r from-primary/5`
- Stats-Bar mit `bg-background/60 backdrop-blur-sm`
- Strukturierte Button-Actions statt Icon-Only

---

## Lösung: Neues "CandidateHeroHeader" Component

### Komponenten-Struktur

```
CandidateHeroHeader.tsx
├── Back Link (diskret)
├── Main Hero Card (Gradient)
│   ├── Avatar (größer, mit Status-Ring)
│   ├── Name & Title
│   ├── Meta-Info (Location, Experience, Salary)
│   ├── Status Badges (Completeness, Availability)
│   ├── Quick Actions (grupiert, mit Labels)
│   └── Stage Pipeline (eingebettet)
├── Stats Bar (4-5 KPIs)
│   ├── Profile Completeness
│   ├── Active Submissions
│   ├── Days in Pipeline
│   └── Interview Score
└── Active Submissions Pills
```

### Neue Quick Actions Gruppierung

**Statt: 5 einzelne Icon-Buttons**
```
[📞] [📧] [🔗] [🔄] [✏️]  ← Aktuell: verwirrend
```

**Neu: 2 Gruppen mit Labels**
```
Kontakt:  [📞 Anrufen] [📧 E-Mail] [🔗 LinkedIn]
Aktionen: [✏️ Bearbeiten] [🔄 CV aktualisieren]
```

### Design-Elemente

| Element | Aktuell | Neu |
|---------|---------|-----|
| Avatar | 64px, flach | 80px, Gradient-Ring + Status |
| Gradient | `from-primary/5` schwach | `from-primary/10 via-card to-accent/20` |
| Quick Actions | Icon-only, verstreut | Gruppiert mit Labels |
| Pipeline | In grauem Kasten | Inline mit subtilen Dots |
| Stats | Keine | 4 KPIs in glassmorphism Bar |

---

## Technische Änderungen

### Datei 1: `src/components/candidates/CandidateHeroHeader.tsx` (NEU)

Neue extrahierte Komponente für die Hero-Section:

```typescript
interface CandidateHeroHeaderProps {
  candidate: Candidate;
  readiness: { score: number; isReady: boolean } | null;
  currentStatus: string;
  onStatusChange: (status: string) => void;
  onEdit: () => void;
  onCvUpload: () => void;
  submissions: { id: string; status: string; job: { title: string } }[];
  statusMutationPending: boolean;
}

export function CandidateHeroHeader({...}: CandidateHeroHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Back Link */}
      <Link to="/recruiter/candidates">...</Link>
      
      {/* Hero Card */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-accent/20">
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent" />
        
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar with Status Ring */}
            <div className="relative">
              <Avatar className="h-20 w-20 ring-4 ring-primary/20">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-2xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {readiness?.isReady && (
                <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-success rounded-full border-2 border-background flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                {/* Name & Meta */}
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold">{candidate.full_name}</h1>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-muted-foreground">
                    {/* Meta items with icons */}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {/* Badges */}
                  </div>
                </div>
                
                {/* Quick Actions - Grouped */}
                <div className="flex flex-col gap-2">
                  {/* Contact Group */}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Phone className="h-4 w-4 mr-1.5" />
                      Anrufen
                    </Button>
                    <Button variant="outline" size="sm">
                      <Mail className="h-4 w-4 mr-1.5" />
                      E-Mail
                    </Button>
                  </div>
                  {/* Action Group */}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={onEdit}>
                      <Edit className="h-4 w-4 mr-1.5" />
                      Bearbeiten
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onCvUpload}>
                      <RefreshCw className="h-4 w-4 mr-1.5" />
                      CV
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Stage Pipeline - Inline */}
          <div className="mt-6">
            <CandidateStagePipeline ... />
          </div>
        </div>
        
        {/* Stats Bar */}
        <div className="px-6 pb-6">
          <div className="p-4 rounded-lg bg-background/60 backdrop-blur-sm border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{readiness?.score || 0}%</p>
                <p className="text-xs text-muted-foreground">Profil vollständig</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{submissions.length}</p>
                <p className="text-xs text-muted-foreground">Bewerbungen</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{daysInPipeline}</p>
                <p className="text-xs text-muted-foreground">Tage in Pipeline</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{candidate.experience_years || '-'}</p>
                <p className="text-xs text-muted-foreground">Jahre Erfahrung</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Active Submissions Pills */}
        {submissions.length > 0 && (
          <div className="px-6 pb-6 flex flex-wrap gap-2">
            {/* Submission Pills */}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Datei 2: `src/pages/recruiter/RecruiterCandidateDetail.tsx`

- Import der neuen `CandidateHeroHeader` Komponente
- Ersetzen der Zeilen 400-582 (aktuelle Hero-Section) durch:

```typescript
<CandidateHeroHeader
  candidate={candidate}
  readiness={readiness}
  currentStatus={currentStatus}
  onStatusChange={(stage) => statusMutation.mutate(stage)}
  onEdit={() => setFormDialogOpen(true)}
  onCvUpload={() => setCvUploadOpen(true)}
  submissions={activeSubmissions}
  statusMutationPending={statusMutation.isPending}
/>
```

---

## Visuelles Konzept

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Zurück zu Kandidaten                                             │
├─────────────────────────────────────────────────────────────────────┤
│  ╔═══════════════════════════════════════════════════════════════╗  │
│  ║  ┌────┐                                                       ║  │
│  ║  │ JH │   Juliane Hotarek                    [Anrufen] [Mail] ║  │
│  ║  │ ✓  │   Scrum Master · Kirchseeon · 14J    [Bearbeiten][CV] ║  │
│  ║  └────┘                                                       ║  │
│  ║           [Exposé-Ready ✓] [Sofort verfügbar] [85k €]         ║  │
│  ║                                                               ║  │
│  ║  ───────────────── Stage Pipeline ─────────────────           ║  │
│  ║  (●)Neu ──── (●)Kontakt ──── (○)Interview ──── ...            ║  │
│  ║                                                               ║  │
│  ╠═══════════════════════════════════════════════════════════════╣  │
│  ║     71%        │     2        │    14       │    14J          ║  │
│  ║   Vollständig  │  Bewerbungen │  Tage       │  Erfahrung      ║  │
│  ╠═══════════════════════════════════════════════════════════════╣  │
│  ║  [Senior PM @ TechCorp - Interview] [Dev Lead @ StartupX]    ║  │
│  ╚═══════════════════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/candidates/CandidateHeroHeader.tsx` | NEU: Extrahierte Hero-Komponente |
| `src/pages/recruiter/RecruiterCandidateDetail.tsx` | Import + Verwendung der neuen Komponente |

---

## Erwartetes Ergebnis

1. **Quick Actions**: Gruppiert mit Labels statt einzelner Icon-Buttons
2. **Stats Bar**: 4 KPIs auf einen Blick (Completeness, Submissions, Days, Experience)
3. **Premium Design**: Glassmorphism + stärkere Gradients
4. **Avatar mit Status**: Ring + Checkmark für Exposé-Ready
5. **Bessere Hierarchie**: Name dominant, Meta-Info sekundär, Pipeline eingebettet

