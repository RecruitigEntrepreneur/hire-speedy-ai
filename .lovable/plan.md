

# T-001 Fix: Triple-Blind-Verletzung beheben

## Zusammenfassung

Der Recruiter kann in mehreren Stellen der Anwendung den echten Firmennamen sehen, obwohl `company_revealed` noch nicht `true` ist. Dieses Ticket behebt die **3 vom User definierten Dateien** und dokumentiert **4 weitere Leak-Stellen** als Follow-up.

---

## Analyse: Was ist bereits korrekt?

Zwei Seiten implementieren das `revealedJobIds`-Pattern **bereits korrekt**:

- **RecruiterJobs.tsx**: Laedt `revealedJobIds` via separaten Query, zeigt `company_name` nur wenn `revealedJobIds.has(job.id)`
- **RecruiterDashboard.tsx** (Available Jobs Section): Gleicher korrekter Pattern

Diese Dateien werden **nicht angefasst**.

---

## Fix 1: CandidateJobMatchingV3.tsx (Hauptproblem)

### Aktuelle Leaks

| Zeile | Problem |
|-------|---------|
| 68 | `company_name` im `JobInfo`-Interface |
| 120 | `company_name` wird per SELECT geladen und in React State gehalten |
| 460 | `company_name` wird an `CommuteConfirmationDialog` weitergegeben |
| 575-588 | Render zeigt anonymisiert, aber ohne Revealed-Check (revealed Jobs zeigen nie den echten Namen) |

### Aenderungen

**1. `company_name` aus dem Interface und Query entfernen**

```typescript
interface JobInfo {
  id: string;
  title: string;
  // company_name ENTFERNT
  industry: string | null;
  company_size_band: string | null;
  funding_stage: string | null;
  tech_environment: string[] | null;
  location: string | null;
  salary_max: number | null;
  salary_min: number | null;
  remote_type: string | null;
}
```

**2. useEffect umbauen: Jobs + Revealed-Map parallel laden**

Der bestehende `useEffect` (Zeilen 113-150) wird so umgebaut, dass er gleichzeitig:
- Published Jobs laedt (OHNE `company_name`)
- Revealed-Submissions laedt (mit `company_name` via Join)

```typescript
useEffect(() => {
  async function loadJobsAndMatches() {
    setJobsLoading(true);
    try {
      const [jobsRes, revealedRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, title, industry, company_size_band, funding_stage, tech_environment, location, salary_max, salary_min, remote_type')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('submissions')
          .select('job_id, jobs(company_name)')
          .eq('recruiter_id', user!.id)
          .eq('company_revealed', true)
      ]);

      if (jobsRes.error) throw jobsRes.error;

      const fetchedJobs = jobsRes.data || [];
      setJobs(fetchedJobs);

      // Map: job_id -> company_name (nur fuer revealed)
      const map = new Map<string, string>();
      revealedRes.data?.forEach((s: any) => {
        if (s.jobs?.company_name) {
          map.set(s.job_id, s.jobs.company_name);
        }
      });
      setRevealedMap(map);

      // ... Matching-Berechnung bleibt gleich
    }
  }
}, [candidate.id, user?.id]);
```

**3. Display-Helper erstellen**

```typescript
const getJobDisplayName = (jobId: string, job: JobInfo): string => {
  const revealedName = revealedMap.get(jobId);
  if (revealedName) return revealedName;

  return formatAnonymousCompany({
    industry: job.industry,
    companySize: job.company_size_band,
    fundingStage: job.funding_stage,
    techStack: job.tech_environment,
    location: job.location,
    remoteType: job.remote_type,
  });
};
```

**4. Render-Logik (Zeile 575-588) vereinfachen**

Vorher:
```tsx
{job.industry || job.company_size_band || ...
  ? formatAnonymousCompany({...})
  : formatSimpleAnonymousCompany(job.industry)
}
```

Nachher:
```tsx
{getJobDisplayName(job.id, job)}
```

**5. CommuteConfirmationDialog-Aufruf (Zeile 457-462) anonymisieren**

```typescript
job={{
  id: commuteDialog.job.id,
  title: commuteDialog.job.title,
  company_name: getJobDisplayName(commuteDialog.job.id, commuteDialog.job),
  location: commuteDialog.job.location || '',
}}
```

Der Recruiter sieht im Commute-Dialog nur den anonymisierten Namen. Da der Commute-Dialog eine Nachricht an den Kandidaten generiert, wird auch dort nur der anonymisierte Name erscheinen. Das ist akzeptabel, weil:
- Die "Direkt senden"-Funktion im Dialog ist ohnehin defekt (sendet `html`/`text` direkt, aber die Edge Function erwartet `template`/`data`)
- Der "Mail-Client"-Button oeffnet nur einen `mailto:`-Link -- hier muss der Recruiter die Nachricht ohnehin manuell senden
- In der Praxis wird der Commute-Dialog VOR einer Submission benutzt, also bevor der Kandidat ueberhaupt den Firmennamen kennt

---

## Fix 2: CandidateJobsOverview.tsx

### Aktuelle Leaks

| Zeile | Problem |
|-------|---------|
| 46 | `company_name` im Query ohne Reveal-Check |
| 112 | `company_name` direkt im UI angezeigt |

### Aenderungen

**1. Query erweitern um `company_revealed`**

```typescript
const { data, error } = await supabase
  .from('submissions')
  .select(`
    id,
    status,
    submitted_at,
    company_revealed,
    job:jobs(id, title, company_name, industry, status)
  `)
  .eq('candidate_id', candidateId)
  .order('submitted_at', { ascending: false });
```

**2. Interface aktualisieren**

```typescript
interface JobSubmission {
  id: string;
  status: string;
  submitted_at: string;
  company_revealed: boolean;
  job: {
    id: string;
    title: string;
    company_name: string;
    industry: string | null;
    status: string;
  };
}
```

**3. Bedingte Anzeige (Zeile 112)**

```tsx
<p className="text-sm text-muted-foreground">
  {submission.company_revealed 
    ? submission.job.company_name 
    : formatSimpleAnonymousCompany(submission.job.industry)
  }
</p>
```

Hier bleibt `company_name` im Query, weil es nur angezeigt wird wenn `company_revealed = true`. Das ist korrekt: Bei Submissions hat der Recruiter eingereicht, und wenn `company_revealed = true`, hat der Kandidat angenommen.

Import hinzufuegen:
```typescript
import { formatSimpleAnonymousCompany } from '@/lib/anonymousCompanyFormat';
```

---

## Fix 3: CommuteConfirmationDialog.tsx

### Bewertung

Der Dialog selbst muss **nicht geaendert** werden. Das Problem liegt im **Aufrufer** (CandidateJobMatchingV3.tsx, Zeile 460), der den echten `company_name` uebergibt. Durch Fix 1 Punkt 5 wird stattdessen der anonymisierte Name uebergeben.

Der Dialog zeigt dann:
- Recruiter sieht: `[FinTech | 200-500 MA | Series B | Hybrid Muenchen]` als Firmenbezeichnung
- Kandidaten-Nachricht enthaelt ebenfalls den anonymisierten Namen (akzeptabel, da kein Reveal stattgefunden hat)
- Die "Direkt senden"-Email-Funktion ist ohnehin nicht funktionsfaehig (falsches Format fuer die Edge Function)

---

## Pruefung: anonymousCompanyFormat.ts

Die Funktion `getDisplayCompanyName` auf Zeile 135-152 hat **keinen Leak**. Sie nimmt `companyRevealed` als Parameter und gibt `realCompanyName` nur zurueck wenn `companyRevealed === true`. Das Verhalten ist korrekt.

---

## Weitere Leak-Stellen (ausserhalb Scope, als Notiz)

Diese Dateien haben aehnliche Probleme, wurden aber vom User nicht in den Scope aufgenommen:

| Datei | Problem | Schwere |
|-------|---------|---------|
| `RecruiterCandidateDetail.tsx` Zeile 88 | Laedt `company_name` in Submissions-Query, aber HeroHeader zeigt nur `job.title` -- kein visueller Leak, aber im Client-State (React DevTools) | Niedrig |
| `RecruiterSubmissions.tsx` Zeile 570 | Zeigt `company_name` direkt ohne Reveal-Check (Desktop-Ansicht) | Hoch |
| `RecruiterSubmissions.tsx` Zeile 658 | Uebergibt `company_name` an `PlaybookViewer` ohne Reveal-Check | Mittel |
| `CompactTaskList.tsx` Zeile 117-119 | Zeigt `companyName` aus Dashboard-CandidateMap ohne Reveal-Check | Mittel |
| `RecruiterEarnings.tsx` Zeile 279 | Zeigt `company_name` bei Placements -- OK, da Placements = hired = revealed | Kein Problem |
| `RecruiterDashboard.tsx` Zeile 329 | Laedt `company_name` fuer Alert-CandidateMap ohne Reveal-Check | Mittel |

---

## Dateien-Uebersicht

| Datei | Aenderung | Aufwand |
|-------|-----------|--------|
| `src/components/candidates/CandidateJobMatchingV3.tsx` | `company_name` aus Query/Interface entfernen, `revealedMap` laden, Display-Helper, Commute-Dialog anonymisieren | S |
| `src/components/candidates/CandidateJobsOverview.tsx` | `company_revealed` laden, bedingte Anzeige mit `formatSimpleAnonymousCompany` | XS |
| `src/components/candidates/CommuteConfirmationDialog.tsx` | Keine Aenderung noetig (Fix im Aufrufer) | - |
| `src/lib/anonymousCompanyFormat.ts` | Keine Aenderung noetig (korrekt) | - |

## Nicht veraendert

- DB-Trigger (`reveal_company_on_opt_in`, `grant_full_access_on_interview_confirm`)
- Edge Functions (`send-email`)
- `CandidateExperienceTimeline` (CV-Arbeitgeber, kein Triple-Blind)
- `RecruiterJobs.tsx` (bereits korrekt)
- `RecruiterDashboard.tsx` Available Jobs (bereits korrekt)

