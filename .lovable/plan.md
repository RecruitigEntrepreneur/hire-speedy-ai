
# Plan: Job-Liste mit Reveal-Status + Company Profile Completeness

## Übersicht

Zwei zusammenhängende Verbesserungen:

1. **Job-Listen (RecruiterJobs.tsx + Dashboard)**: Zeige pro Job, ob der Recruiter eine Submission mit `company_revealed = true` hat - wenn ja, zeige den echten Firmennamen statt der anonymisierten Version
2. **Company Profile Completeness**: Stelle sicher, dass Kunden die Partner Facts ausfüllen oder wir sie automatisch crawlen

---

## Teil 1: Reveal-Status in Job-Listen

### Aktuelle Situation

| Datei | Problem |
|-------|---------|
| `RecruiterJobs.tsx` | Zeigt ALLE Jobs anonym - prüft nicht den Submission-Status |
| `RecruiterDashboard.tsx` | Gleiches Problem bei "Available Jobs" |

### Lösung: Zusätzlicher Query für Recruiter's revealed Jobs

```typescript
// Neuer Hook oder Query in beiden Dateien:
const { data: myRevealedJobs } = await supabase
  .from('submissions')
  .select('job_id')
  .eq('recruiter_id', user.id)
  .eq('company_revealed', true);

const revealedJobIds = new Set(myRevealedJobs?.map(s => s.job_id) || []);
```

### UI-Änderung pro Job-Karte

```text
VORHER (immer anonym):
┌──────────────────────────────────────────────────┐
│  🔒 [FinTech | Startup | München]               │
└──────────────────────────────────────────────────┘

NACHHER (wenn revealed):
┌──────────────────────────────────────────────────┐
│  ✓ Bayerische Versorgungskammer                 │  ← Mit Checkmark
│    [Interview bestätigt]                         │
└──────────────────────────────────────────────────┘
```

### Technische Änderungen

**`src/pages/recruiter/RecruiterJobs.tsx`**:
1. Import `useAuth` für User ID
2. Neuer State: `revealedJobIds: Set<string>`
3. Zusätzlicher Supabase Query für `submissions.company_revealed = true`
4. In der Job-Karte: Conditional Rendering basierend auf `revealedJobIds.has(job.id)`
5. Lock-Icon ersetzen durch Checkmark wenn revealed

**`src/pages/recruiter/RecruiterDashboard.tsx`**:
1. Gleiche Logik wie oben
2. "Available Jobs" Sektion anpassen

---

## Teil 2: Company Profile Completeness

### Problem

Die `company_profiles` Tabelle hat alle Felder, aber sie sind meist leer:

| Feld | Aktuelle Befüllung |
|------|-------------------|
| `headcount` | 0% (alle NULL) |
| `annual_revenue` | 0% (alle NULL) |
| `founded_year` | 0% (alle NULL) |
| `unique_selling_point` | 0% (alle NULL) |

### Zwei-Wege-Lösung

#### Weg 1: Client-Seite - Profile Completion Check

In `ClientSettings.tsx` oder beim Job-Erstellen einen "Profile Completeness" Indikator anzeigen:

```text
┌─────────────────────────────────────────────────────┐
│  ⚠️ Dein Profil ist zu 40% vollständig            │
│                                                     │
│  Fehlende Angaben:                                  │
│  • Mitarbeiteranzahl                               │
│  • Gründungsjahr                                   │
│  • Jahresumsatz                                    │
│                                                     │
│  Diese Infos helfen Recruitern, dein Unternehmen   │
│  besser zu präsentieren.                           │
│                                                     │
│  [Jetzt vervollständigen]                          │
└─────────────────────────────────────────────────────┘
```

#### Weg 2: Auto-Enrichment via Crawler

Der bestehende `crawl-company-data` Edge Function kann bereits Firmendaten crawlen. Wir können:

1. Bei Job-Erstellung oder Client-Login prüfen, ob `company_profiles` leer ist
2. Automatisch den Crawler triggern, um Daten von der Website zu extrahieren
3. `headcount`, `founded_year`, `annual_revenue` aus dem Crawler-Ergebnis übernehmen

---

## Dateien die geändert werden

| Datei | Änderung |
|-------|----------|
| `src/pages/recruiter/RecruiterJobs.tsx` | + Revealed-Jobs Query, + Conditional Company Display |
| `src/pages/recruiter/RecruiterDashboard.tsx` | + Revealed-Jobs Query, + Conditional Company Display |
| `src/pages/dashboard/ClientSettings.tsx` | + Profile Completeness Banner |
| `src/components/client/ProfileCompletenessCard.tsx` | NEU - Wiederverwendbare Komponente |

---

## Beispiel: Revealed Job in der Liste

```jsx
// In RecruiterJobs.tsx - Job-Karte anpassen
<div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
  {revealedJobIds.has(job.id) ? (
    <>
      <CheckCircle className="h-3 w-3 text-emerald" />
      <span className="text-foreground font-medium">{job.company_name}</span>
      <Badge variant="outline" className="ml-2 text-xs">Enthüllt</Badge>
    </>
  ) : (
    <>
      <Lock className="h-3 w-3" />
      {formatAnonymousCompany({...})}
    </>
  )}
</div>
```

---

## Erwartetes Ergebnis

1. **Job-Liste**: Der Job "Referent Bereichsleitung IT" zeigt jetzt "Bayerische Versorgungskammer" statt "[Technology | Konzern | München]"
2. **Dashboard**: Gleiche Verbesserung in "Available Jobs"
3. **Client Settings**: Warnung wenn Partner Facts fehlen + Aufforderung zum Ausfüllen
4. **Langfristig**: Auto-Enrichment kann fehlende Daten automatisch crawlen
