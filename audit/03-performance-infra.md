# Team 3 — Performance & Infrastruktur

## Executive Summary

Zwei strukturelle Themen: (1) Alle ~80 Pages werden in `src/App.tsx` eager importiert → ein einziger großer JS-Chunk, kein Route-basiertes Code-Splitting. (2) Fehlende Indizes auf `submissions` (job_id/candidate_id/recruiter_id) plus verbreitetes `select('*')` ohne Pagination → langsame Dashboards ab wenigen tausend Rows. Dazu sequenzielle DB-/AI-Calls, die parallelisierbar wären, mögliche Realtime-Subscription-Leaks und ein undokumentiertes Ausfall-/Backup-Konzept.

## Befunde

### [CRITICAL] [L] Kein Route-Code-Splitting — alle ~80 Pages eager geladen

- **Fundstelle:** `src/App.tsx:7-106` (statische Imports aller Pages), keine `lazy(`/`import(`.
- **Problem:** Vite bündelt alles in einen großen Initial-Chunk (~800 KB+ geschätzt/UNVERIFIED-Größe). Kein manualChunks für schwere Deps (recharts, embla, radix).
- **Risiko/Impact:** Langsames First Load / TTI, besonders mobil.
- **Fix-Empfehlung:** `React.lazy()` + `<Suspense>` pro Route; `manualChunks` in `vite.config.ts` für recharts/radix.

### [CRITICAL] [XL] Infrastruktur-SPOF ohne dokumentiertes DR/Backup

- **Fundstelle:** Supabase-Cloud-Projekt (ID in .env), kein `docs/INFRASTRUKTUR.md` / Backup-/DR-Konzept im Repo.
- **Problem:** Kein dokumentiertes RTO/RPO, kein Health-Monitoring, kein Ausfall-Fallback.
- **Risiko/Impact:** Ausfall = Prod-Down ohne Wiederherstellungsplan.
- **Fix-Empfehlung:** `docs/INFRASTRUKTUR.md` mit RTO/RPO, Backup-Strategie (PITR), Health-Monitoring. (Hinweis: Projekt-Map nannte Mac-Mini-Hosting — Diskrepanz mit Supabase-Cloud in Phase 2 klären.)

### [HIGH] [M] Sequenzielle DB-Fetches im Matcher

- **Fundstelle:** `supabase/functions/calculate-match-v3/index.ts:81-117` — 4 separate `await` (config, candidate, job, taxonomy) statt `Promise.all()`.
- **Problem:** Vermeidbare Latenz (~250–400ms geschätzt).
- **Fix-Empfehlung:** Unabhängige Fetches in `Promise.all()` bündeln.

### [HIGH] [M] Fehlende Indizes auf `submissions`

- **Fundstelle:** Migrations enthalten keine Indizes auf submissions.job_id/candidate_id/recruiter_id (Grep CREATE INDEX vs. Filterspalten).
- **Problem:** Seq-Scans bei jedem Dashboard-Filter über eine zentrale, wachsende Tabelle.
- **Risiko/Impact:** Dashboard-Queries verlangsamen sich linear mit dem Volumen.
- **Fix-Empfehlung:** `CREATE INDEX` auf den drei FKs (+ ggf. Composite mit status/stage) in einer neuen Migration.

### [HIGH] [M] select('*') + fehlende Pagination

- **Fundstelle:** `client-dashboard-data`, `src/hooks/useAcademy.ts`, RecruiterDashboard-Queries — alle Spalten ohne `.limit()`.
- **Problem:** Über-Fetching + unbegrenzte Result-Sets.
- **Fix-Empfehlung:** Spezifische `.select(spalten)` + `.limit()` + Offset/Keyset-Pagination.

### [HIGH] [M] Mögliche Realtime-Subscription-Leaks

- **Fundstelle:** `src/hooks/useUnifiedTaskInbox.ts`, `src/hooks/useRecruiterTasks.ts` — Cleanup-Muster unklar/UNVERIFIED.
- **Problem:** Ohne `supabase.removeChannel()` im useEffect-Cleanup stapeln sich Subscriptions bei Route-Wechsel.
- **Fix-Empfehlung:** Beide Hooks auf Cleanup auditen; removeChannel in return.

### [HIGH] [M] RecruiterDashboard Re-Render (1107 LOC)

- **Fundstelle:** `src/pages/recruiter/RecruiterDashboard.tsx` — 18 Hooks, wenige useMemo, kein React.memo auf Child-Listen.
- **Problem:** Jede State-Änderung re-rendert alles.
- **Fix-Empfehlung:** Sections splitten + `React.memo` + `useCallback`.

## Quick Wins (S-Effort)

1. `manualChunks` für recharts/radix in vite.config.ts.
2. Fehlende submissions-Indizes in einer Migration nachziehen.
3. `Promise.all()` im Matcher.

## Offene Fragen an Marko

1. Ist die App Supabase-Cloud oder self-hosted auf dem Mac Mini? (Projekt-Map vs. Team-3-Fund widersprechen sich.)
2. Existiert PITR/Backup außerhalb des Repos?
3. Erwartete Row-Zahlen (submissions/candidates) für Index-Priorisierung?
