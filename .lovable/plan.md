

# Plan: Dashboard aufräumen - Detailansichten auf Unterseiten verschieben

## Problem

Die **"Deine Performance"** und **"Submissions Übersicht"** Sektionen nehmen zu viel Platz auf der Dashboard-Übersicht ein. Diese detaillierten Daten sind besser auf den spezialisierten Unterseiten aufgehoben.

## Lösung

Die detaillierten Komponenten auf die passenden Unterseiten verschieben und auf dem Dashboard nur kompakte Zusammenfassungen zeigen.

### Verschiebungsplan

| Komponente | Von | Nach | Begründung |
|------------|-----|------|------------|
| `RecruiterMetricsSection` | Dashboard | **Verdienste** (`/recruiter/earnings`) | Performance-KPIs passen thematisch zu Earnings |
| `SubmissionsFunnelGrid` | Dashboard | **Pipeline** (`/recruiter/submissions`) | Detaillierte Status-Übersicht gehört zur Pipeline |

### Neues Dashboard-Layout (kompakter)

```text
┌─────────────────────────────────────────────────────────────────┐
│  Stats Grid (bleibt - 4 Karten)                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Open Jobs │ │Candidates│ │Submissions│ │Earnings  │          │
│  │    15    │ │    27    │ │    21     │ │   €0     │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
├─────────────────────────────────────────────────────────────────┤
│  ❌ Deine Performance → verschoben nach /recruiter/earnings    │
├─────────────────────────────────────────────────────────────────┤
│  ❌ Submissions Übersicht → verschoben nach /recruiter/submissions │
├─────────────────────────────────────────────────────────────────┤
│  Available Jobs (bleibt)                                        │
├─────────────────────────────────────────────────────────────────┤
│  Your Talent Pipeline (bleibt)                                  │
├─────────────────────────────────────────────────────────────────┤
│  Quick Actions (bleibt)                                         │
└─────────────────────────────────────────────────────────────────┘
```

## Technische Änderungen

### 1. `src/pages/recruiter/RecruiterDashboard.tsx`

**Entfernen:**
- Import von `RecruiterMetricsSection` und `SubmissionsFunnelGrid`
- Import von `useRecruiterStats` (wird nicht mehr benötigt)
- Die beiden Komponenten-Aufrufe in der JSX (Zeilen 472-481)

**Ergebnis:** Dashboard wird deutlich kompakter

### 2. `src/pages/recruiter/RecruiterSubmissions.tsx`

**Hinzufügen:**
- Import von `SubmissionsFunnelGrid` und `useRecruiterStats`
- Die `SubmissionsFunnelGrid`-Komponente am Anfang der Seite

```jsx
// Am Anfang der Submissions-Seite
<SubmissionsFunnelGrid statusBreakdown={recruiterStats.statusBreakdown} />
```

### 3. `src/pages/recruiter/RecruiterEarnings.tsx`

**Hinzufügen:**
- Import von `RecruiterMetricsSection` und `useRecruiterStats`
- Die `RecruiterMetricsSection`-Komponente oben auf der Seite

```jsx
// Nach den Earnings-Stats
<RecruiterMetricsSection
  interviewInviteRate={recruiterStats.interviewInviteRate}
  hireToInterviewRate={recruiterStats.hireToInterviewRate}
  qcRejectionRate={recruiterStats.qcRejectionRate}
  platformAverages={platformAverages}
/>
```

## Vorteile

1. **Sauberere Übersicht** - Dashboard zeigt nur die wichtigsten Zahlen auf einen Blick
2. **Kontext-passend** - Detaillierte Daten erscheinen dort, wo sie gebraucht werden
3. **Schnellere Navigation** - User findet Submissions-Details unter "Pipeline", Performance unter "Verdienste"
4. **Weniger Scrolling** - Dashboard passt besser auf einen Bildschirm

## Dateien die geändert werden

| Datei | Änderung |
|-------|----------|
| `src/pages/recruiter/RecruiterDashboard.tsx` | Entfernt: Metrics + Funnel Grid |
| `src/pages/recruiter/RecruiterSubmissions.tsx` | Hinzufügt: Submissions Funnel Grid |
| `src/pages/recruiter/RecruiterEarnings.tsx` | Hinzufügt: Performance Metrics |

