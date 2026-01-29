

# Plan: Pipeline-Ansicht "Your Talent Submissions"

## Aktuelles Problem

Die bisherige Implementierung zeigt Submissions als **vertikale Liste** - nicht ideal für einen Prozess-Überblick. Der Recruiter will auf einen Blick sehen:
1. Wo stehen meine Kandidaten im Prozess?
2. Wie viel verdiene ich wenn dieser Kandidat vermittelt wird?
3. Welche Quick Actions kann ich direkt ausführen?

## Neue Lösung: Horizontale Pipeline

Eine Kanban-ähnliche Pipeline von **links nach rechts** mit Status-Spalten:

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│  📋 Your Talent Submissions                              [Alle anzeigen →]       │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│  │ EINGEREICHT │   │ IN PRÜFUNG │   │  INTERVIEW  │   │   ANGEBOT   │          │
│  │     (2)     │   │    (1)     │   │     (1)     │   │     (0)     │          │
│  ├─────────────┤   ├─────────────┤   ├─────────────┤   ├─────────────┤          │
│  │             │   │             │   │             │   │             │          │
│  │ ┌─────────┐ │   │ ┌─────────┐ │   │ ┌─────────┐ │   │             │          │
│  │ │ HS     │←── Scrollable ──→ │   │             │   │   (leer)    │          │
│  │ │ 92%    │ │   │ │ Max M.  │ │   │ │ Horst S.│ │   │             │          │
│  │ │ ~€12k  │ │   │ │ 78%     │ │   │ │ 92%     │ │   │             │          │
│  │ │ 📞 ✉️  │ │   │ │ ~€8k    │ │   │ │ ~€12k   │ │   │             │          │
│  │ └─────────┘ │   │ └─────────┘ │   │ │ 31.01.  │ │   │             │          │
│  │             │   │             │   │ │ 📞 ✉️   │ │   │             │          │
│  │ ┌─────────┐ │   │             │   │ └─────────┘ │   │             │          │
│  │ │ Maria K.│ │   │             │   │             │   │             │          │
│  │ │ 85%    │ │   │             │   │             │   │             │          │
│  │ └─────────┘ │   │             │   │             │   │             │          │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘          │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Komponenten-Struktur

### Neue Komponente: `SubmissionsPipeline.tsx`

**Status-Spalten (von links nach rechts):**

| Spalte | Status | Farbe |
|--------|--------|-------|
| Eingereicht | `submitted`, `pending` | Amber |
| In Prüfung | `in_review` | Blue |
| Interview | `interview` | Purple |
| Angebot | `offer` | Emerald |

**Kompakte Kandidaten-Karte pro Spalte:**
- Avatar mit Initialen
- Name (truncated)
- Match Score mit Farb-Indikator
- **Potenzielle Provision** (berechnet aus Job-Daten)
- Interview-Datum (falls vorhanden)
- Alert-Badge (falls vorhanden)
- Quick Actions: Anrufen + Email

### Erweiterte Datenabfrage

Zusätzlich zu den bisherigen Daten brauchen wir:
- `jobs.salary_min`
- `jobs.salary_max`
- `jobs.recruiter_fee_percentage`

Diese werden verwendet um die potenzielle Provision zu berechnen:
```
Provision = ((salary_min + salary_max) / 2) * (recruiter_fee_percentage / 100)
```

## Interface-Erweiterung

```typescript
export interface PipelineSubmission extends RecentSubmission {
  job: {
    id: string;
    title: string;
    company_name: string | null;
    salary_min: number | null;
    salary_max: number | null;
    recruiter_fee_percentage: number | null;
  };
  potential_earning: number | null;
}
```

## Responsive Verhalten

- **Desktop:** 4 Spalten nebeneinander mit horizontalem Scroll
- **Tablet:** Horizontaler Scroll sichtbar
- **Mobile:** Cards werden gestapelt mit Status-Header

## Technische Details

### Dateien die geändert werden

| Datei | Aktion | Beschreibung |
|-------|--------|--------------|
| `src/components/recruiter/SubmissionsPipeline.tsx` | **NEU** | Kanban-Pipeline Komponente |
| `src/components/recruiter/RecentSubmissionsCard.tsx` | Löschen | Wird durch Pipeline ersetzt |
| `src/pages/recruiter/RecruiterDashboard.tsx` | Bearbeiten | Neue Komponente importieren, erweiterte Query für Job-Salary-Daten |

### Pipeline-Spalten Definition

```typescript
const PIPELINE_STAGES = [
  { key: 'submitted', label: 'Eingereicht', color: 'amber', statuses: ['submitted', 'pending'] },
  { key: 'in_review', label: 'In Prüfung', color: 'blue', statuses: ['in_review'] },
  { key: 'interview', label: 'Interview', color: 'purple', statuses: ['interview'] },
  { key: 'offer', label: 'Angebot', color: 'emerald', statuses: ['offer'] },
];
```

## Erwartetes Ergebnis

1. **Visuelle Pipeline:** Recruiter sieht sofort wo jeder Kandidat im Prozess steht
2. **Provisions-Transparenz:** Jede Karte zeigt die potenzielle Provision (z.B. "~12.000 EUR")
3. **Quick Actions:** Direkter Kontakt per Telefon/Email ohne Navigation
4. **Horizontales Scrolling:** Bei vielen Kandidaten pro Stage scrollbar
5. **Alert-Integration:** Kritische Tasks werden prominent angezeigt
6. **Responsive:** Funktioniert auf Desktop und Mobile

