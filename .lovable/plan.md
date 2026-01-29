

# Plan: Fix Dashboard Layout - Doppelte Komponenten entfernen

## Problem

Die Komponenten `RecruiterMetricsSection` und `SubmissionsFunnelGrid` werden **4 mal angezeigt** - einmal unter jeder Stats-Karte (Open Jobs, My Candidates, Submissions, Total Earnings).

## Ursache

In `src/pages/recruiter/RecruiterDashboard.tsx` (Zeilen 454-481) sind die schließenden Tags der Stats-Karten-Map-Schleife falsch verschachtelt:

```text
Zeile 454: <div className="grid">
Zeile 455:   {statCards.map((stat) => (
Zeile 456:     <Card>
Zeile 457:       <CardContent>
Zeile 458:         <div className="flex">
Zeile 459-465:       ...content...
Zeile 466:     </div>  ← PROBLEM: Schließt flex-div, aber...
                       
Zeile 468-477:   RecruiterMetricsSection + SubmissionsFunnelGrid
                 ↑ Diese sind INNERHALB der map() Schleife!
                       
Zeile 478:       </CardContent>
Zeile 479:     </Card>
Zeile 480:   ))}  ← Map endet erst hier
Zeile 481: </div>
```

## Lösung

Die schließenden Tags korrekt platzieren:

| Zeile | Aktuell | Korrektur |
|-------|---------|-----------|
| 466 | `</div>` | Bleibt (schließt flex-div) |
| 467-477 | RecruiterMetricsSection + SubmissionsFunnelGrid | **ENTFERNEN** (werden nach der Map eingefügt) |
| 478 | `</CardContent>` | Bleibt |
| 479 | `</Card>` | Bleibt |
| 480 | `))}` | Bleibt |
| 481 | `</div>` | Bleibt (schließt grid-div) |
| NEU 482+ | - | `<RecruiterMetricsSection ... />` + `<SubmissionsFunnelGrid ... />` |

## Technische Änderung

### Datei: `src/pages/recruiter/RecruiterDashboard.tsx`

**Korrigierte Struktur:**

```jsx
{/* Stats Grid */}
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  {statCards.map((stat) => (
    <Card key={stat.title} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{stat.title}</p>
            <p className="text-3xl font-bold mt-1">{stat.value}</p>
          </div>
          <div className={`p-3 rounded-xl ${stat.color}`}>
            {stat.icon}
          </div>
        </div>
      </CardContent>
    </Card>
  ))}
</div>

{/* Performance Metrics - JETZT AUSSERHALB DER MAP-SCHLEIFE */}
<RecruiterMetricsSection
  interviewInviteRate={recruiterStats.interviewInviteRate}
  hireToInterviewRate={recruiterStats.hireToInterviewRate}
  qcRejectionRate={recruiterStats.qcRejectionRate}
  platformAverages={platformAverages}
/>

{/* Submissions Funnel Grid - JETZT AUSSERHALB DER MAP-SCHLEIFE */}
<SubmissionsFunnelGrid statusBreakdown={recruiterStats.statusBreakdown} />
```

## Erwartetes Ergebnis

Nach dem Fix wird das Dashboard wie folgt strukturiert sein:

```text
┌─────────────────────────────────────────────────────────────────┐
│  Stats Grid (4 Karten nebeneinander)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Open Jobs │ │Candidates│ │Submissions│ │Earnings  │          │
│  │    15    │ │    27    │ │    21     │ │   €0     │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
├─────────────────────────────────────────────────────────────────┤
│  Deine Performance (EINMAL)                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │ Interview   │ │ Hire-to-IV  │ │ QC Rejection│              │
│  │ Invite Rate │ │ Rate        │ │ Rate        │              │
│  │   38.1%     │ │    0.0%     │ │   28.6%     │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│  Submissions Übersicht (EINMAL)                                │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐     │
│  │ 10 │ │ 0  │ │ 0  │ │ 0  │ │ 2  │ │ 4  │ │ 2  │ │ 2  │     │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘     │
└─────────────────────────────────────────────────────────────────┘
```

