
# Plan: Erweiterte Revealed-Job Karte mit Firmenlogo und Details

## Problem

Bei enthüllten Jobs im Dashboard und der Jobs-Liste wird aktuell nur angezeigt:
- ✅ Firmenname
- ✅ "Enthüllt" Badge

**Fehlend:**
- ❌ Firmenlogo
- ❌ Unternehmensgröße (Headcount)
- ❌ Branche/Industrie
- ❌ Skills (bereits vorhanden, aber nicht prominent)
- ❌ Remote-Typ + Standort

## Lösung: Erweiterte "Revealed Job Card"

### Design für enthüllte Jobs

```text
┌─────────────────────────────────────────────────────────────────────┐
│  ┌────────┐   Referent Bereichsleitung IT          [Hybrid] [Enthüllt] │
│  │  LOGO  │   Bayerische Versorgungskammer         ← Echter Name    │
│  │  BVK   │   🏢 1000+ MA · 📍 München · 🏭 Technology               │
│  └────────┘                                                          │
│  ──────────────────────────────────────────────────────────────────  │
│  SAP  Excel  Projektmanagement  +2                     €12.500 →    │
│                                                        €85k-110k     │
└─────────────────────────────────────────────────────────────────────┘
```

vs. Anonyme Jobs (unverändert):

```text
┌─────────────────────────────────────────────────────────────────────┐
│  ┌────────┐   Senior Frontend Developer              [Remote] [🔥]  │
│  │   💼   │   🔒 [FinTech | 200-500 MA | Series B | München]         │
│  └────────┘                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Technische Umsetzung

#### 1. Logo-Anzeige mit Fallback

Da `logo_url` in `company_profiles` meist NULL ist, nutzen wir einen Logo-Service als Fallback:

```typescript
// Generiere Logo-URL aus Website-Domain
const getCompanyLogoUrl = (website: string | null, companyName: string): string => {
  if (website) {
    // Clearbit Logo API (kostenlos)
    const domain = new URL(website).hostname;
    return `https://logo.clearbit.com/${domain}`;
  }
  // Fallback: UI-Avatar mit Initialen
  const initials = companyName.split(' ').map(w => w[0]).join('').slice(0, 2);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=1e3a5f&color=fff&size=48`;
};
```

#### 2. Erweiterter Jobs-Query

Die aktuelle Query muss erweitert werden um `company_profiles` Daten zu joinen:

```typescript
// In fetchJobs() - JOIN mit company_profiles
const { data } = await supabase
  .from('jobs')
  .select(`
    *,
    company_profiles!jobs_client_id_fkey (
      logo_url,
      website,
      headcount,
      industry
    )
  `)
  .eq('status', 'published')
  .order('created_at', { ascending: false });
```

#### 3. Änderungen in `RecruiterJobs.tsx`

**Job Interface erweitern:**
```typescript
interface Job {
  // ... bestehende Felder
  company_profiles?: {
    logo_url: string | null;
    website: string | null;
    headcount: number | null;
    industry: string | null;
  } | null;
}
```

**Job-Karte für enthüllte Jobs:**
```tsx
{revealedJobIds.has(job.id) ? (
  // REVEALED: Zeige Logo + alle Details
  <>
    <div className="h-12 w-12 rounded-xl overflow-hidden bg-white border border-border/50 flex items-center justify-center">
      <img 
        src={getCompanyLogoUrl(job.company_profiles?.website, job.company_name)}
        alt={job.company_name}
        className="h-10 w-10 object-contain"
        onError={(e) => {
          // Fallback zu Initialen-Avatar
          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company_name)}&background=1e3a5f&color=fff`;
        }}
      />
    </div>
    
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">{job.title}</h3>
        <Badge variant="outline" className="text-emerald">Enthüllt</Badge>
      </div>
      <p className="font-medium text-foreground">{job.company_name}</p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
        {job.company_profiles?.headcount && (
          <span>🏢 {formatHeadcount(job.company_profiles.headcount)}</span>
        )}
        <span>📍 {job.location}</span>
        <span className="capitalize">{job.remote_type}</span>
        {job.industry && <span>🏭 {job.industry}</span>}
      </div>
    </div>
  </>
) : (
  // ANONYMOUS: Bestehende Darstellung
  ...
)}
```

#### 4. Änderungen in `RecruiterDashboard.tsx`

Gleiche Logik wie oben für die "Available Jobs" Sektion anwenden.

### Helper-Funktion für Headcount-Formatierung

```typescript
const formatHeadcount = (count: number): string => {
  if (count < 50) return '< 50 MA';
  if (count < 200) return '50-200 MA';
  if (count < 500) return '200-500 MA';
  if (count < 1000) return '500-1000 MA';
  return '1000+ MA';
};
```

## Dateien die geändert werden

| Datei | Änderungen |
|-------|------------|
| `src/pages/recruiter/RecruiterJobs.tsx` | Erweiterter Query mit company_profiles JOIN, Logo-Anzeige, erweiterte Revealed-Card |
| `src/pages/recruiter/RecruiterDashboard.tsx` | Gleiche Erweiterungen für Available Jobs Sektion |
| `src/lib/companyLogo.ts` | NEU: Helper für Logo-URL Generierung mit Fallbacks |

## Daten-Abhängigkeiten

Da `logo_url` und `headcount` in `company_profiles` meist NULL sind:

1. **Logo:** Nutze Clearbit Logo API als Fallback (kostenlos, basiert auf Website-Domain)
2. **Headcount:** Zeige nur wenn vorhanden, sonst auslassen
3. **Industry:** Bereits in `jobs` Tabelle vorhanden - wird angezeigt

## Erwartetes Ergebnis

| Element | Anonym | Enthüllt |
|---------|--------|----------|
| Logo | 💼 Icon (navy) | Firmenlogo oder Initialen |
| Firmenname | `[FinTech \| München]` | "Bayerische Versorgungskammer" |
| Details | Keine | 🏢 1000+ MA · 📍 München · Hybrid |
| Badge | Keins | ✅ "Enthüllt" (grün) |
