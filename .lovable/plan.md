
# Fix: Pipeline nicht klickbar in Client Job Detail

## Problem

Alle Pipeline-bezogenen Links und Buttons in der Job-Detail-Ansicht fuehren zu `/dashboard/pipeline?job=...`. Diese Route wurde entfernt und leitet zum Haupt-Dashboard weiter. Dadurch:

- Der "Verwalten"-Button in der Pipeline-Karte funktioniert nicht
- Der "Pipeline oeffnen"-Button im Hero funktioniert nicht
- "Alle Kandidaten ansehen" funktioniert nicht
- "Alle vergleichen" funktioniert nicht
- "Kalender" funktioniert nicht
- Die Pipeline-Stufen (Neu, Pruefung, Interview, etc.) sind nicht klickbar

## Loesung

Die tote `/dashboard/pipeline?job=...` Route wird ueberall durch `/dashboard/command/:jobId` ersetzt (Command Center), das bereits volle Pipeline-Verwaltung bietet. Zusaetzlich werden die Pipeline-Stufen klickbar gemacht, sodass sie direkt zum Command Center navigieren koennen.

---

## Aenderungen

### Datei 1: `src/components/client/PipelineSnapshotCard.tsx`

**Was:** "Verwalten"-Link reparieren und Stage-Bars klickbar machen

- Zeile 58: Link aendern von `/dashboard/pipeline?job=${jobId}` zu `/dashboard/command/${jobId}`
- Stage-Bars (Zeile 87-103): Die Zeilen in klickbare `Link`-Elemente wrappen, die zum Command Center navigieren
- `useNavigate` importieren fuer Navigation bei Klick auf Stages

### Datei 2: `src/components/client/ClientJobHero.tsx`

**Was:** "Pipeline oeffnen"-Button reparieren

- Zeile 218: Link aendern von `/dashboard/pipeline?job=${job.id}` zu `/dashboard/command/${job.id}`

### Datei 3: `src/pages/dashboard/ClientJobDetail.tsx`

**Was:** Alle `navigate`-Aufrufe mit toter Pipeline-Route reparieren

- Zeile 477: `onViewCandidates` aendern von `navigate(\`/dashboard/pipeline?job=${job.id}\`)` zu `navigate(\`/dashboard/command/${job.id}\`)`
- Zeile 504: `onViewAll` (TopCandidatesCard) aendern zu `navigate(\`/dashboard/command/${job.id}\`)`
- Zeile 526: `onViewAll` (UpcomingInterviewsCard) aendern zu `navigate(\`/dashboard/command/${job.id}\`)`

### Datei 4: `src/pages/dashboard/JobsList.tsx`

**Was:** Dropdown-Link in der Jobs-Liste reparieren

- Zeile 478: Link aendern von `/dashboard/pipeline?job=${job.id}` zu `/dashboard/command/${job.id}`

---

## Zusammenfassung

| Datei | Aenderung | Aufwand |
|-------|-----------|--------|
| `PipelineSnapshotCard.tsx` | Link-Fix + Stages klickbar machen | S |
| `ClientJobHero.tsx` | Link-Fix (1 Zeile) | XS |
| `ClientJobDetail.tsx` | 3x navigate-Fix | XS |
| `JobsList.tsx` | Link-Fix (1 Zeile) | XS |

Keine DB-Aenderungen noetig. Keine neuen Abhaengigkeiten.
