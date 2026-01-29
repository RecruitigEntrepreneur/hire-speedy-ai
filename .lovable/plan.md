

# Plan: Recruiter Dashboard Stats & Analytics Integration

## Identifizierte Probleme

### 1. Falsche "Open Jobs" Zahl
**Aktuell:** Zeigt nur 5 (wegen `limit(5)` in der Query)
**Korrekt:** Es gibt 15 offene Jobs in der Datenbank

**Fix:** Separate Count-Query für Open Jobs statt nur die Anzahl der geladenen Jobs

### 2. Total Earnings zeigt €0
**Aktuell:** Keine Berechnung implementiert
**Berechnung:** Summe aller Provisions aus `hired` Submissions

### 3. Fehlende Performance-Metriken
Diese Metriken aus dem Screenshot sollen integriert werden:

| Metrik | Beschreibung | Berechnung |
|--------|--------------|------------|
| Interview Invite Ratio | % der Kandidaten mit Interview-Einladung | `(interview + offer + hired) / total * 100` |
| Hire to Interview Ratio | % der interviewten Kandidaten die eingestellt wurden | `hired / (interview + offer + hired) * 100` |
| Quality Control Ratio | % der abgelehnten Kandidaten in QC | `rejected_in_qc / total * 100` |
| Market Feedback | Anzahl bereitgestellter Feedbacks | Count aus einer separaten Tabelle (falls vorhanden) |
| Company Referrals | Empfohlene Unternehmen | Count (falls Referral-System existiert) |

### 4. Detaillierte Submissions Pipeline mit Earnings
Die untere Hälfte des Screenshots zeigt eine detaillierte Status-Übersicht:

| Status | Count | Potential € |
|--------|-------|-------------|
| Submitted | 0 | 0€ |
| In Review | 0 | 0€ |
| Forwarded | 0 | 0€ |
| Screening | 0 | 0€ |
| Rejected | 33 | €625 |
| IV Invited | 0 | 0€ |
| 1st Interview | 0 | 0€ |
| 2nd Interview | 0 | 0€ |
| Hired | 1 | €7,307.5 |

## Lösung: Erweitertes Dashboard

### Neue Komponente: `RecruiterMetricsSection.tsx`

Eine kompakte Metrik-Sektion die folgendes zeigt:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Deine Performance                                    [30 Tage ▼]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐              │
│  │ Interview     │  │ Hire-to-IV    │  │ QC Rejection  │              │
│  │ Invite Rate   │  │ Rate          │  │ Rate          │              │
│  │    33.3%      │  │    22.2%      │  │    0.0%       │              │
│  │ ⌀ Platform:   │  │ ⌀ Platform:   │  │ ⌀ Platform:   │              │
│  │   23.5%       │  │   11.9%       │  │   18.2%       │              │
│  └───────────────┘  └───────────────┘  └───────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Neue Komponente: `SubmissionsFunnelGrid.tsx`

Eine Grid-Ansicht aller Status mit Counts und Earnings:

```text
┌───────────────────────────────────────────────────────────────────────────────────────┐
│  Submissions Übersicht                                                                │
├───────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│  │ Submitted  │  │ In Review  │  │ Forwarded  │  │ Screening  │  │ IV Invited │      │
│  │     4      │  │     0      │  │     0      │  │     0      │  │     6      │      │
│  │  ~€37.6k   │  │    €0      │  │    €0      │  │    €0      │  │  ~€67k     │      │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘  └────────────┘      │
│                                                                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐                      │
│  │ 1st IV     │  │ 2nd IV     │  │ Offer      │  │  HIRED ✓   │                      │
│  │     1      │  │     0      │  │     1      │  │     2      │                      │
│  │  ~€11.6k   │  │    €0      │  │  ~€7.5k    │  │  €29.1k    │  ← Realized         │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘                      │
│                                                                                       │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

## Technische Implementierung

### Dateien die geändert werden

| Datei | Aktion | Beschreibung |
|-------|--------|--------------|
| `src/components/recruiter/RecruiterMetricsSection.tsx` | **NEU** | Performance-Metriken Karten |
| `src/components/recruiter/SubmissionsFunnelGrid.tsx` | **NEU** | Detaillierte Status-Grid mit Earnings |
| `src/hooks/useRecruiterStats.ts` | **NEU** | Hook für alle Recruiter-Statistiken |
| `src/pages/recruiter/RecruiterDashboard.tsx` | Bearbeiten | Integration der neuen Komponenten, Fix Open Jobs Query |

### Neue Datenabfragen

**1. Korrekter Open Jobs Count:**
```typescript
const { count: openJobsCount } = await supabase
  .from('jobs')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'published');
```

**2. Performance-Metriken:**
```typescript
// Interview Invite Rate
const interviewInviteRate = 
  (interviewCount + offerCount + hiredCount) / totalSubmissions * 100;

// Hire to Interview Rate  
const hireToInterviewRate = 
  hiredCount / (interviewCount + offerCount + hiredCount) * 100;

// QC Rejection Rate (last 3 months)
const qcRejectionRate = 
  rejectedInQCCount / totalSubmissionsLast3Months * 100;
```

**3. Submissions by Status with Earnings:**
```typescript
const { data } = await supabase
  .from('submissions')
  .select(`
    status,
    stage,
    job:jobs(salary_min, salary_max, recruiter_fee_percentage)
  `)
  .eq('recruiter_id', user.id);

// Group and calculate potential earnings per status
```

**4. Total Realized Earnings (nur hired):**
```typescript
const { data: hiredSubmissions } = await supabase
  .from('submissions')
  .select(`job:jobs(salary_min, salary_max, recruiter_fee_percentage)`)
  .eq('recruiter_id', user.id)
  .eq('status', 'hired');

const totalEarnings = hiredSubmissions.reduce((sum, s) => {
  return sum + calculateEarning(s.job);
}, 0);
```

### Status-Mapping für Grid

| DB Status/Stage | Display Label | Farbe |
|-----------------|---------------|-------|
| submitted | Submitted | Amber |
| in_review | In Review | Blue |
| forwarded | Forwarded | Indigo |
| screening | Screening | Cyan |
| rejected | Rejected | Red |
| interview_requested | IV Invited | Purple |
| interview_1 | 1st Interview | Purple |
| interview_2 | 2nd Interview | Purple |
| offer | Offer | Emerald |
| hired | Hired | Green (special highlight) |

### Layout im Dashboard

Die neuen Komponenten werden wie folgt platziert:

```text
1. Header + Browse Jobs Button
2. Verification Banner (if applicable)
3. Behavior Score Card
4. Heute zu tun (Task Cards)
5. ─────────────────────────────────────
6. Stats Grid (Open Jobs, Candidates, Submissions, Total Earnings)  ← FIX
7. ─────────────────────────────────────
8. Deine Performance (Interview Rate, Hire Rate, QC Rate)  ← NEU
9. ─────────────────────────────────────
10. Submissions Funnel Grid (Status × Earnings)  ← NEU
11. ─────────────────────────────────────
12. Available Jobs
13. Your Talent Pipeline
14. Quick Actions
```

## Erwartetes Ergebnis

1. **Korrekte Stats:** Open Jobs zeigt die echte Anzahl (15), Total Earnings basierend auf Hired
2. **Performance-Transparenz:** Interview-Rate, Hire-Rate und QC-Rate auf einen Blick
3. **Detaillierte Pipeline:** Alle Status mit Counts und potenziellen/realisierten Earnings
4. **Platform-Vergleich:** Recruiter sieht wie er im Vergleich zur Platform performt

