

# T-003 + T-004: Defense-in-Depth und Dashboard-Leak beheben

---

## T-003: Submissions-Query ohne recruiter_id-Filter

### Problem
In `RecruiterCandidateDetail.tsx` (Zeile 82-91) filtert die Submissions-Query nur nach `candidate_id`, nicht nach `recruiter_id`. Die Sicherheit haengt ausschliesslich an RLS.

### Fix
Eine Zeile hinzufuegen: `.eq('recruiter_id', user!.id)` zur Query. Kostet nichts, schuetzt gegen zukuenftige RLS-Aenderungen.

**Datei: `src/pages/recruiter/RecruiterCandidateDetail.tsx`**

Vorher:
```typescript
const { data, error } = await supabase
  .from('submissions')
  .select(`id, status, submitted_at, job:jobs(id, title)`)
  .eq('candidate_id', id!)
  .order('submitted_at', { ascending: false });
```

Nachher:
```typescript
const { data, error } = await supabase
  .from('submissions')
  .select(`id, status, submitted_at, job:jobs(id, title)`)
  .eq('candidate_id', id!)
  .eq('recruiter_id', user!.id)
  .order('submitted_at', { ascending: false });
```

Zusaetzlich: `enabled: !!id` aendern zu `enabled: !!id && !!user` damit die Query nicht feuert bevor `user` geladen ist.

---

## T-004: Dashboard zeigt company_name im Client-State

### Analyse-Ergebnis

Die **Render-Logik** im Available Jobs Abschnitt ist bereits **korrekt**:
- Zeile 550-565: `revealedJobIds.has(job.id)` → zeigt Logo + company_name
- Zeile 566-616: Nicht revealed → zeigt Briefcase-Icon + `formatAnonymousCompany()`
- `formatAnonymousCompany()` verwendet korrekt nur industry/size/funding/techStack/location -- **kein company_name Leak**

Das Problem ist der **Client-State-Leak**:

| Stelle | Problem |
|--------|---------|
| Zeile 98-99: `select('*')` | Laedt `company_name` fuer ALLE Jobs in React State (sichtbar in DevTools) |
| Zeile 206: `fetchRecentSubmissions` | Laedt `company_name` via Jobs-Join und gibt es an SubmissionsPipeline weiter |
| SubmissionsPipeline.tsx Z.38 | Hat `company_name` im Interface, rendert es aber nirgends |

### Fix 1: Jobs-Query explizite Spalten statt `select('*')`

**Datei: `src/pages/recruiter/RecruiterDashboard.tsx`**

Vorher (Zeile 97-102):
```typescript
const { data: jobs, error: jobsError } = await supabase
  .from('jobs')
  .select('*')
  .eq('status', 'published')
  .order('created_at', { ascending: false })
  .limit(5);
```

Nachher:
```typescript
const { data: jobs, error: jobsError } = await supabase
  .from('jobs')
  .select('id, title, industry, company_size_band, funding_stage, tech_environment, location, salary_min, salary_max, remote_type, recruiter_fee_percentage, hiring_urgency, client_id, created_at')
  .eq('status', 'published')
  .order('created_at', { ascending: false })
  .limit(5);
```

`company_name` ist NICHT in der Liste. Nur revealed Jobs (via `revealedJobIds`) brauchen den Namen -- und die werden bereits korrekt ueber den Revealed-Branch im Render behandelt.

Aber Moment: Im Revealed-Branch (Zeile 585) wird `job.company_name` direkt gerendert. Wenn wir es aus dem Query entfernen, bricht das. Loesung: `company_name` fuer revealed Jobs separat laden, analog zum Pattern in CandidateJobMatchingV3.

Erweiterter Fix: `fetchRevealedJobs` auch `company_name` laden lassen:

```typescript
const fetchRevealedJobs = async () => {
  if (!user) return;
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('job_id, jobs(company_name)')
      .eq('recruiter_id', user.id)
      .eq('company_revealed', true);

    if (!error && data) {
      const ids = new Set<string>();
      const nameMap = new Map<string, string>();
      data.forEach((s: any) => {
        ids.add(s.job_id);
        if (s.jobs?.company_name) {
          nameMap.set(s.job_id, s.jobs.company_name);
        }
      });
      setRevealedJobIds(ids);
      setRevealedCompanyNames(nameMap);
    }
  } catch (error) {
    console.error('Error fetching revealed jobs:', error);
  }
};
```

State hinzufuegen:
```typescript
const [revealedCompanyNames, setRevealedCompanyNames] = useState<Map<string, string>>(new Map());
```

Render-Logik (Zeile 585) aendern:
```tsx
<p className="text-sm font-medium text-foreground">
  {revealedCompanyNames.get(job.id) || job.title}
</p>
```

Und Logo-Fallback (Zeile 554-563) ebenfalls:
```tsx
src={getCompanyLogoUrl(
  profile?.logo_url,
  profile?.website,
  revealedCompanyNames.get(job.id) || ''
)}
alt={revealedCompanyNames.get(job.id) || 'Company'}
onError={(e) => {
  const name = revealedCompanyNames.get(job.id) || 'U';
  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e3a5f&color=fff&size=96&bold=true`;
}}
```

### Fix 2: fetchRecentSubmissions - company_name entfernen

**Datei: `src/pages/recruiter/RecruiterDashboard.tsx`**

Zeile 206 aendern:
```typescript
// Vorher
.select('id, title, company_name, salary_min, salary_max, recruiter_fee_percentage')
// Nachher
.select('id, title, salary_min, salary_max, recruiter_fee_percentage')
```

Zeile 277 aendern:
```typescript
// Vorher
company_name: job.company_name,
// Nachher
company_name: null,  // Triple-Blind: not loaded
```

### Fix 3: SubmissionsPipeline Interface bereinigen

**Datei: `src/components/recruiter/SubmissionsPipeline.tsx`**

`company_name` aus dem PipelineSubmission-Interface entfernen (Zeile 38). Da es nirgends gerendert wird, ist das ein reiner Cleanup.

---

## Dateien-Uebersicht

| Datei | Aenderung | Aufwand |
|-------|-----------|--------|
| `src/pages/recruiter/RecruiterCandidateDetail.tsx` | `.eq('recruiter_id', user!.id)` hinzufuegen, `enabled` erweitern | XS |
| `src/pages/recruiter/RecruiterDashboard.tsx` | `select('*')` durch explizite Spalten ersetzen, `revealedCompanyNames` Map fuer Revealed-Branch, `company_name` aus fetchRecentSubmissions entfernen | S |
| `src/components/recruiter/SubmissionsPipeline.tsx` | `company_name` aus Interface entfernen | XS |

## Nicht veraendert

- DB-Trigger
- Edge Functions
- `formatAnonymousCompany()` (korrekt, kein Leak)
- Reveal-Flow (unveraendert)

