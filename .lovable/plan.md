

# Plan: RecruiterJobs - Cutting-Edge UI Redesign

## Problem

Die aktuelle Job-Liste sieht "gequetscht" aus:
- Sehr kleine `p-3` Padding und `gap-2` zwischen Karten
- Alles in einer horizontalen Zeile gepresst
- Keine visuelle Hierarchie oder "breathing room"
- Kein modernes Glassmorphism/Animation-Design

## Vision: Premium Job Marketplace Design

Das neue Design nutzt moderne UI-Patterns für eine luftigere, professionellere Darstellung.

## Design-Elemente

### 1. Erweiterte Job-Karten mit mehr Platz

| Element | Aktuell | Neu |
|---------|---------|-----|
| Card Padding | `p-3` | `p-5` |
| Grid Gap | `gap-2` | `gap-4` |
| Icon Size | `h-10 w-10` | `h-12 w-12` |
| Layout | Einzeilig horizontal | Zweizeilig mit klarer Hierarchie |

### 2. Glassmorphism & Premium-Effekte

- Glass-Card-Effekt mit Backdrop-Blur
- Subtle Gradient-Overlays auf dem Icon
- Hover-Glow-Effekte
- Animierte Übergänge beim Hover

### 3. Neue Kartenstruktur (zweizeilig)

```text
┌────────────────────────────────────────────────────────────────────┐
│  ┌────┐   Senior Frontend Engineer              [Remote] [🔥 Dringend] │
│  │ 🏢 │   🔒 Fintech Startup · München · Series B                    │
│  └────┘                                                              │
│  ─────────────────────────────────────────────────────────────────── │
│  React  TypeScript  Node.js  +2                     €12.5k  →       │
│                                                     €85k-110k        │
└────────────────────────────────────────────────────────────────────┘
```

**Zeile 1:** Titel + Badges (Remote, Urgency)
**Zeile 2:** Anonyme Company-Info
**Zeile 3 (Footer):** Skills links + Earning rechts

### 4. Visuelle Verbesserungen

- **Gradient Icon:** Navy-Gradient statt flacher Farbe
- **Urgency Badge:** Pulsierendes Badge für dringende Jobs
- **Skill Chips:** Mit Hover-Effekt und besserer Lesbarkeit
- **Earning Highlight:** Grün mit leichtem Glow-Effekt
- **Hover State:** Karte hebt sich an mit Shadow und Border-Glow

### 5. Animationen

- `animate-fade-in` beim Laden
- `hover:scale-[1.01]` für subtile Vergrößerung
- `transition-all duration-300` für smooth Transitions
- Staggered Animation für die Liste

## Technische Umsetzung

### Datei: `src/pages/recruiter/RecruiterJobs.tsx`

**Änderungen am Grid:**
```jsx
// Alt
<div className="grid gap-2">

// Neu
<div className="grid gap-4">
```

**Änderungen an der Job-Karte:**
```jsx
<Card className="
  border-border/40 
  bg-card/80 
  backdrop-blur-sm
  hover:border-emerald/40 
  hover:shadow-lg 
  hover:shadow-emerald/5
  hover:scale-[1.01]
  transition-all 
  duration-300 
  cursor-pointer 
  group
">
  <CardContent className="p-5">
    {/* Zweizeiliges Layout */}
    <div className="space-y-3">
      
      {/* Row 1: Icon + Title + Badges */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-navy 
          flex items-center justify-center 
          shadow-md group-hover:shadow-lg transition-shadow">
          <Briefcase className="h-6 w-6 text-primary-foreground" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base">{job.title}</h3>
            <Badge variant="secondary">{job.remote_type}</Badge>
            {job.hiring_urgency === 'urgent' && (
              <Badge className="bg-destructive/10 text-destructive animate-pulse">
                🔥 Dringend
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            🔒 {formatAnonymousCompany(...)}
          </p>
        </div>
      </div>
      
      {/* Row 2: Skills + Earning */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div className="flex items-center gap-2 flex-wrap">
          {job.skills?.slice(0, 4).map(skill => (
            <Badge variant="outline" className="hover:bg-primary/10">
              {skill}
            </Badge>
          ))}
        </div>
        
        <div className="text-right">
          <p className="font-bold text-lg text-emerald">
            €{potentialEarning?.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatSalary(min, max)}
          </p>
        </div>
      </div>
    </div>
  </CardContent>
</Card>
```

### Neue Features

1. **Urgency Badge** - Zeigt dringende Jobs mit pulsierendem Badge
2. **Bessere Skill-Anzeige** - 4 Skills statt 3, mit Hover-Effekt
3. **Größere Icons** - Professionellere Optik
4. **Zweizeiliges Layout** - Mehr Platz für alle Infos
5. **Glassmorphism** - Moderner Backdrop-Blur-Effekt
6. **Hover-Animations** - Scale + Shadow + Border-Glow

## Erwartetes Ergebnis

- Karten sind ~40% größer mit besserer Lesbarkeit
- Moderne, premium Optik mit Glass-Effekten
- Klare visuelle Hierarchie (Titel > Company > Skills > Earning)
- Responsive: Funktioniert auf Desktop und Mobile
- Performance: Nur CSS-basierte Animationen

