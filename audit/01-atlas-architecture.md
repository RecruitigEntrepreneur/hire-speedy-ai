# Team 1 — Atlas (Architektur)

## Executive Summary

Das Projekt hat ernst zu nehmende Architekturprobleme: 4 koexistierende Match-Score-Funktionen (v1 tot, v2/v3/v3-1 live), 320 `any`-Typisierungen im Frontend und 287 in Edge Functions; eine 9430-Zeilen-Supabase-Types-Datei mit nur 5 Importen; God-Components über 1400 LOC ohne State-Refactoring; und massive CORS/Client-Init-Duplikation (75×, 148×) in nur 6 Shared Utils. Academy-Modul ist isoliert, aber mit 18 Rückwärtsimporten zur Hauptapp. TypeScript läuft mit `strict: false`, `noImplicitAny: false`.

## Befunde

### [CRITICAL] [L] Match-Score-Generationen: 3 live + 1 tote Version parallel

- **Fundstelle:** `supabase/functions/calculate-match*` (v1, v2, v3, v3-1); src-Aufrufe: `src/hooks/useMatchScoreV2.ts`, `src/hooks/useMatchScoreV3.ts`, `src/hooks/useMatchScoreV31.ts`
- **Problem:** 4 Funktionen, davon v1 (`calculate-match/index.ts:200` "Error in calculate-match") nirgends aufgerufen. v2/v3/v3-1 nebeneinander in Produktivcode, mit unterschiedlichen Score-Algorithmen (v2: `calculateFactors()`, v3: andere Logik). Unklar, welche Version für welche User-Gruppe gilt.
- **Risiko/Impact:** Maintenance-Albtraum, Sicherheitsupdates müssen 3× repliziert werden. Kandidaten-Matching-Konsistenz fragwürdig.
- **Fix-Empfehlung:** v1 löschen; klar dokumentieren welche Version live ist; Migrationsplan v3→v3-1; Single Source of Truth für Match-Logic.

### [CRITICAL] [XL] TypeScript-Härte: `strict: false`, 320 `any` im Frontend, 287 in Functions

- **Fundstelle:** `tsconfig.app.json:25` (`strict: false`), `tsconfig.json:13` (`strictNullChecks: false`); src grep: 320 Vorkommen `: any`/`as any`/`any[]`; supabase/functions: 287 Vorkommen
- **Problem:** Keine Typensicherheit an kritischen API-Grenzen. Edge Functions haben ungeprüfte Supabase-Responses. Frontend behandelt externe Daten als `any` (Beispiel `RecruiterDashboard.tsx:106` `const getFirstName = (user: any)`).
- **Risiko/Impact:** Runtime-Fehler in Produktion schwer zu fangen. Refactoring unsicher.
- **Fix-Empfehlung:** `strict: true` in tsconfig.app.json; schrittweise `noImplicitAny: true`; Supabase-Responses typisieren; Top-50-`any` auditen.

### [HIGH] [M] Supabase-Types ignoriert: 9430 Zeilen, nur 5 Importe

- **Fundstelle:** `src/integrations/supabase/types.ts` (9430 Zeilen, 1 Export: `Database`); nur 5 Files importieren daraus
- **Problem:** Auto-generierte Types-Datei wird kaum genutzt. Frontend behandelt Rows als `any`. Veraltete Schemaversionen möglich.
- **Risiko/Impact:** Type-Safety-Theater. Schemaänderungen in Supabase brechen Frontend ungemerkt.
- **Fix-Empfehlung:** Types in kritischen Komponenten nutzen; Regeneration + CI-Check automatisieren.

### [HIGH] [XL] God-Components: TaskDetailDialog (1433), CandidateFormDialog (1058), SmartImportDialog (985)

- **Fundstelle:** `src/components/influence/TaskDetailDialog.tsx:1433`, `src/components/candidates/CandidateFormDialog.tsx:1058`, `src/components/outreach/SmartImportDialog.tsx:985`
- **Problem:** Monolithische Components mit 10+ Props, useState-Spaghetti, keine Sub-Component-Zerlegung. Unmöglich zu testen/reusen.
- **Risiko/Impact:** Bugs schwer zu lokalisieren. Re-Render-Performance. Neue Features erfordern 500+-Zeilen-Änderungen.
- **Fix-Empfehlung:** Zerlegen nach Concern; `useReducer` bei State-Komplexität >10 Variablen.

### [HIGH] [L] Edge-Functions: 75× CORS-Header, 148× createClient in nur 6 Shared Utils

- **Fundstelle:** Grep 75× `Access-Control-Allow-Origin`, 148× `createClient`; `supabase/functions/_shared/` enthält nur 6 Files
- **Problem:** Jede der ~78 Functions initialisiert den Supabase-Client neu; CORS-Header hardcoded in jedem Handler; kein zentrales Error-Handling.
- **Risiko/Impact:** CORS-Policy-Änderung erfordert 75 Deploy-Changes. Fehlerbehandlung inkonsistent.
- **Fix-Empfehlung:** `createClient`-Wrapper in `_shared/supabase-client.ts`; CORS-Middleware; ErrorHandler-Util mit Standard-Status-Codes.

### [HIGH] [M] Import-Dialoge-Redundanz: SmartImport (985), LeadImport (887), HubSpot, CvUpload (884)

- **Fundstelle:** SmartImportDialog (CompanyListView), LeadImportDialog (AdminOutreach), HubSpotImportDialog (RecruiterDashboard + RecruiterCandidates + ClientCandidatesOverview), CvUploadDialog (RecruiterDashboard)
- **Problem:** Vier separate Upload-Flows mit ~90% Copy-Paste-Code.
- **Risiko/Impact:** Validierungs-Bugfix muss 4× gemacht werden; inkonsistente UX.
- **Fix-Empfehlung:** Abstraktes BaseImportDialog + Strategy-Pattern (CsvParser | HubSpotParser | CvParser).

### [MEDIUM] [M] Academy-Modul isoliert, aber mit Rückwärtsabhängigkeit

- **Fundstelle:** `src/academy/`; 18 Importe von `@/components`/`@/hooks`/`@/pages` aus academy/; keine Rückimporte
- **Problem:** Academy importiert UI-Components aus der Recruiting-App → Separation-of-Concerns verletzt.
- **Risiko/Impact:** Refactoring der Recruiting-Components bricht Academy; Modularisierung erschwert.
- **Fix-Empfehlung:** Academy-eigene UI oder Radix direkt; nur `@/lib/*` und `@/integrations` teilen.

### [MEDIUM] [S] Mehrfache Candidate-Summary-Patterns

- **Fundstelle:** `useClientCandidateSummary.ts` + `ClientCandidateSummaryCard.tsx`
- **Problem:** Naming-Unterschied Client vs. Standard suggeriert Kontext-Vermischung; unklar ob Legacy-CandidateSummary existiert.
- **Fix-Empfehlung:** Audit auf alte CandidateSummary; einheitliches Naming.

### [LOW] [S] RecruiterDashboard: Props mit `any`

- **Fundstelle:** `src/pages/recruiter/RecruiterDashboard.tsx:106` (`(user: any)`), Zeilen 175–187: 13 useState (teils any[])
- **Problem:** Helfer-Funktionen mit ungeprüften any-Typen; formatEuro/getFirstName schlagen mit null-User fehl.
- **Fix-Empfehlung:** User-Typ aus `@/lib/auth`; Guard-Clause.

## Quick Wins (S-Effort)

1. Supabase v1-Function `calculate-match/` löschen (keine Aufrufer).
2. `tsconfig strict: true` in Feature-Branch pilotieren.
3. CORS-Header zur Konstante `_shared/cors.ts`.
4. Academy-UI isolieren (Radix direkt statt `@/components/ui`).
5. Top-20-`any` als `// TODO: type` markieren.

## Offene Fragen an Marko

1. Match-Score-Strategie: Ist v3-1 Ziel oder Übergang? Wann v2-User migrieren?
2. Academy produktionsreif oder Scaffold?
3. Supabase-Types: CI-synchronisiert oder manuell?
4. State-Management: react-query überall oder Props-Drilling akzeptiert?
5. TypeScript: `strict: true` in Feature-Branch pilotierbar?
