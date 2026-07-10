# Team 5 — Nova (UX & Frontend)

## Executive Summary

Die Kern-Journeys funktionieren, brechen aber an Fehler- und Ladezuständen: Enrichment-Calls können ohne Timeout/Feedback hängen, mehrere Data-Fetches rendern bei Netzwerkfehler einen leeren Screen statt eines Error-States, und CV-Parse-Fehler werden verschluckt (User bekommt „Erfolgreich"-Toast trotz fehlgeschlagenem Parse). Dazu ~50+ hardcodierte deutsche Strings statt `t()` (blockiert EN/DACH-Multi-Language), fehlende wiederverwendbare Loading/Empty/Error-Components und A11y-Lücken (fehlende Label-Verknüpfungen).

## Journey-Analyse

**Client (Job → Shortlist → Deal):** CreateJob (1680 LOC) ist der Engpass — Enrichment ohne Timeout (blockierter Button), Partial-Success wird als „Fehler" statt Warnung gezeigt, PDF-Upload ohne sichtbaren Fortschritt. ClientDashboard-Tiles zeigen im Loading-Zustand blank statt Skeleton.

**Recruiter (Einreichen → Match → Kontakt):** RecruiterDashboard (1107 LOC) hat 5 unkoordinierte useEffect-Fetches ohne Error-Rendering → blank Screen bei Fehler. CandidateSubmitForm verschluckt CV-Parse-Fehler.

## Befunde

### [CRITICAL] [M] Enrichment-API ohne Timeout/Feedback

- **Fundstelle:** `src/pages/dashboard/CreateJob.tsx:293-316` — `enrichJobData()` kann bis ~30s hängen, Button blockiert, kein Nutzer-Feedback.
- **Problem:** User wartet ohne Rückmeldung, wirkt wie Absturz.
- **Fix-Empfehlung:** 15s-Timeout (AbortController), Toast „Enrichment übersprungen", Formular bleibt bedienbar.

### [CRITICAL] [M] RecruiterDashboard rendert keinen Error-State

- **Fundstelle:** `src/pages/recruiter/RecruiterDashboard.tsx:306-331` — 5 Data-Fetches ohne Fehlerbehandlung, nur console.error.
- **Problem:** Netzwerkfehler → leerer Screen.
- **Fix-Empfehlung:** `if (error) return <ErrorState onRetry={refetch}/>`; Fetches über `useQueries()` konsolidieren.

### [HIGH] [M] CV-Parse-Fehler verschluckt in CandidateSubmitForm

- **Fundstelle:** `src/components/recruiter/CandidateSubmitForm.tsx:451-457`
- **Problem:** Bei fehlgeschlagenem CV-Parse trotzdem „Erfolgreich eingereicht"-Toast; User reicht denselben ungültigen CV erneut ein.
- **Fix-Empfehlung:** Separater try/catch für den CV-Schritt, distinkte Fehlermeldung.

### [HIGH] [M] CreateJob: Partial-Success als Error statt Warning

- **Fundstelle:** `src/pages/dashboard/CreateJob.tsx:237-243` — <5 befüllte Felder → „Fehler", obwohl Formular bereits teilbefüllt ist.
- **Fix-Empfehlung:** Auf `warning` heben, fehlende Felder anzeigen.

### [HIGH] [M] CreateJob PDF-Upload ohne Fortschrittsanzeige

- **Fundstelle:** `src/pages/dashboard/CreateJob.tsx:543-553` — nur `loading`-Bool, kein Step-Progress.
- **Fix-Empfehlung:** ParsedJobProfile live im Modal während Extraktion; Dialog erst nach Abschluss schließbar.

### [MEDIUM] [M] Keine wiederverwendbaren Loading/Error/Empty-Components

- **Fundstelle:** Keine `components/ui/states/`-Abstraktion; jede Komponente erfindet Toast/Alert/Skeleton neu.
- **Fix-Empfehlung:** `<FormError>`, `<LoadingSpinner>`, `<EmptyState>`, `<CardSkeleton>` als UI-Patterns etablieren.

### [MEDIUM] [L] i18n: ~50+ hardcodierte DE-Strings statt t()

- **Fundstelle:** CreateJob, ClientDashboard, RecruiterDashboard (Greetings, Error-Toasts, Tile-Labels).
- **Problem:** EN-Support/DACH-Multi-Language blockiert.
- **Fix-Empfehlung:** Systematische Migration zu `t('namespace.key')`.

### [MEDIUM] [S] CandidateFormDialog zu breit auf Mobile

- **Fundstelle:** `src/components/candidates/CandidateFormDialog.tsx:360` — `max-w-4xl` ohne responsive Staffelung.
- **Fix-Empfehlung:** `sm:max-w-2xl md:max-w-4xl`.

### [MEDIUM] [S] Fehlende Label↔Input-Verknüpfung (A11y)

- **Fundstelle:** CandidateFormDialog, CvUploadDialog — Labels ohne `htmlFor`, kaum ARIA in Kernflows.
- **Fix-Empfehlung:** `<Label htmlFor="id">` + `<Input id="id">`.

### [MEDIUM] [M] ClientDashboard-Tiles: blank statt Skeleton

- **Fundstelle:** `src/pages/dashboard/ClientDashboard.tsx:69-71` — `loading` durchgereicht, aber keine Skeleton-Darstellung.
- **Fix-Empfehlung:** `<CardSkeleton/>` in Tiles.

## Quick Wins (S-Effort)

1. `htmlFor` an alle Labels in Kernflows (~30 min).
2. Retry-Button im SubmissionDetail-Error-State.
3. Timeout für `enrichJobData()`.
4. Responsive-Breakpoints für CandidateFormDialog.

## Offene Fragen an Marko

1. i18n-Roadmap — ist EN-Support geplant?
2. Fehler-UX: persistent (Alert) oder transient (Toast)?
3. Mobile-First für CandidateFormDialog gewünscht?
4. Enrichment-Timeout-SLA?
