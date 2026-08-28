# 01 — Systemkontext

> Stand: 2026-07-21 · Basis: lokaler `main` (mit uncommitteten Änderungen) · Erstellt vom Lead-Agenten des Audit-Teams.
> Alle Aussagen in diesem Dokument sind am Repository verifiziert (Belege inline). Nicht verifizierte Annahmen sind explizit markiert.

## 1. Was Matchunt ist

Matchunt ist eine KI-gestützte Recruiting-Plattform mit drei getrennten Oberflächen in **einer** Single-Page-Application:

| Persona | Routen-Präfix | Seiten | Einstieg |
|---|---|---|---|
| Kunde / Unternehmen | `/dashboard/*` | `src/pages/dashboard/` (15 Dateien) | Rollen-Redirect in `src/App.tsx:138` |
| Recruiter / Headhunter | `/recruiter/*` | `src/pages/recruiter/` (17 Dateien) | `src/App.tsx:242` ff. |
| Admin / Matchunt Ops | `/admin/*` | `src/pages/admin/` (24 Dateien) | `src/App.tsx` Admin-Block |

Kernmodell: **Unternehmen + Jobs → Matchunt Intelligence Layer → Recruiter + Kandidaten → qualifizierte Submission → Interview (Triple-Blind mit Opt-in-Reveal) → Einstellung → Abrechnung → Auszahlung.**

## 2. Tatsächlicher Technik-Stack (Abweichung vom Master-Prompt!)

Der Master-Prompt nennt Next.js. **Das ist nicht der Ist-Zustand.** Nachgewiesen:

- **Vite + React 18 SPA** mit `react-router-dom` — `vite.config.ts`, `src/App.tsx` (84 `<Route>`-Einträge). Es gibt **keine** Server Components, **keine** API-Routes, **keine** Server Actions. Konsequenz: *Jede* Datensicherheit hängt ausschließlich an Supabase RLS und Edge Functions — der Client ist vollständig untrusted.
- **Supabase**: PostgreSQL + Auth + Storage + RLS + Edge Functions (Deno). 118 Migrationen in `supabase/migrations/`, ~85 Edge Functions in `supabase/functions/`.
- **UI**: Tailwind CSS + shadcn/ui (`components.json`, `src/components/ui/`).
- **i18n**: `src/i18n/locales/de.ts` + `en.ts` vorhanden.
- **State/Data**: kein durchgängiges React Query in Recruiter-Seiten (manuelles `useState`/`useEffect`-Muster; Detailbeleg in `10-ui-ux-audit.md` und `11-code-quality-and-technical-debt.md`).
- **Tests**: 2 Testdateien im gesamten Repo (`supabase/tests/001_client_team_permissions_test.sql`, `supabase/functions/_shared/pii-redaction.test.ts`) plus ein Matching-Eval-Harness unter `evals/` (kein CI-Gate). Detail in `12-testing-and-observability.md`.
- **Paketmanager**: bun-Lockfiles (`bun.lock`, `bun.lockb`) **und** `package-lock.json` parallel vorhanden — widersprüchlich.

## 3. Recruiter-Bereich: Oberfläche im Überblick

17 Seiten unter `src/pages/recruiter/` (alle über `ProtectedRoute allowedRoles={['recruiter']}` geschützt, `src/App.tsx:242–330, 451`):

`RecruiterDashboard` (`/recruiter`), `RecruiterJobs` + `JobDetail`, `RecruiterCandidates` + `RecruiterCandidateDetail`, `RecruiterSubmissions` + `SubmissionDetail`, `RecruiterInterviews`, `RecruiterTalentPool`, `RecruiterMessages`, `RecruiterNotifications`, `RecruiterEarnings`, `RecruiterPayouts`, `RecruiterInfluence`, `RecruiterProfile`, `RecruiterIntegrations`, `RecruiterDataPrivacy`, plus `/recruiter/onboarding`.

Dazu 25 Komponenten in `src/components/recruiter/` und ~100 Hooks in `src/hooks/` (recruiter-relevante Teilmenge in `03-route-and-navigation-inventory.md`).

## 4. Backend-Landschaft im Überblick

- **Edge Functions** (~85): Matching (5 Versionen: `calculate-match` bis `calculate-match-v4` + `run-v4-shadow-batch`), Parsing (`parse-cv`, `parse-job-pdf`, `parse-job-url`, `parse-pdf`), E-Mail-Ingestion (`process-inbound-email`, `process-candidate-email`, `process-candidate-import`), Interview-Flow (`schedule-interview`, `send-interview-invitation`, `get-interview-by-token`, `process-interview-response`), Finance (`stripe-connect`, `stripe-webhooks`, `process-payout`, `create-offer`, `send-offer`, `process-offer-response`), Integrationen (`hubspot-sync`, `oauth-connect`, `oauth-callback`), Automatisierung (`influence-engine`, `calculate-influence-score`, `escalation-engine`, `automation-hub`), GDPR (`gdpr-deletion`, `gdpr-export`), AI-Insights (`assess-candidate-fit`, `candidate-summary`, `generate-interview-prep`, `deal-health`, `fraud-detection`). Vollinventar mit Aufrufer-Nachweis: `02-repository-map.md`.
- **Migrations-Schwerpunkte der letzten Monate** (Dateinamen als Beleg): Auth-Härtung (`20260608120000_auth_hardening_privilege_escalation.sql`), Triple-Blind-Wellen A/C (`20260608121000`, `20260616140000`), Opt-in-Reveal (`20260616150000`), Interview-Reveal-Gates + Consent-Härtung (`20260710090000`, `20260710100000`), Academy-Fundament (`20260616130000`, `20260616140000_academy_seed_content`), Client-Team (`20260710130000`), Intake-Hybrid (`20260619120000`), Match-V4-Fundament (`20260718150000`).

## 5. Fachliche Leitplanken (Soll, gegen das auditiert wird)

1. **Triple-Blind**: Kandidaten-PII bleibt für Kunden anonym bis zum Opt-in-Reveal; Firmenname bleibt für Recruiter verdeckt bis zur Aktivierung. Muss **serverseitig** durchgesetzt sein (RLS/Views/Edge) — clientseitige Maskierung zählt nicht als Enforcement. Befund: `09-security-privacy-rls.md`.
2. **Recruiter-Attribution**: Jede Submission eindeutig einem Recruiter (+ Agency, Zeitpunkt, Provision) zugeordnet; Recruiter-Kontaktdaten gegenüber Kunden geschützt. Befund: `drafts/finance-marketplace-findings.md`.
3. **Candidate Ownership & Umgehungsschutz**: Schutzfristen, Doppel-Einreichungs-Erkennung, Off-Platform-Umgehungserkennung, Streitfall-Prozess. Befund: ebd.
4. **Qualität vor Masse**: Pflicht-Qualifizierung und Consent vor Submission. Befund: `07-end-to-end-workflows.md`.
5. **Academy-Zugang**: Zertifizierung als späterer Plattform-Gatekeeper. Fundament-Migrationen existieren (`20260616130000_academy_foundation.sql`); Verbindung zum Recruiter-Zugang wird in `07-end-to-end-workflows.md` geprüft.

## 6. Prior-Art-Landkarte (Hypothesenquellen dieses Audits)

Dieses Audit ist nicht das erste. Folgende Dokumente wurden als **Hypothesenquellen** benutzt und von den Domänen-Agenten am aktuellen Code verifiziert bzw. widerlegt:

| Dokument | Inhalt | Verhältnis zu diesem Audit |
|---|---|---|
| `RECRUITER_DASHBOARD_GODMODE_ANALYSE.md` (2026-07-18) | 16 Recruiter-Seiten, Querschnitts-Findings, Godmode-Potenzial | direkteste Vorlage; Behauptungen einzeln verifiziert |
| `MATCHUNT_GODMODE_ANALYSIS.md` (4.600 Z.) + `docs/godmode/` (18 Dateien) | A–Z-Architektur, Triple-Blind, Finance-Blocker | Architektur-Basis |
| `audit/` (6 Dateien) | älteres Multi-Agent-Audit (Projekt-Map, Security, AI, UX, Quality) | Vorgänger-Audit |
| `docs/ai/` (3 Dateien) | AI-Architektur, State of the Union, Roadmap | AI-Basis |
| `P0_PROGRESS.md`, `TRIPLE_BLIND_NEXT_LEVEL_PLAN.md`, `DEPLOY_INTERVIEW_FLOW_PLAN.md` | Triple-Blind-Baustand | Security-Basis |
| `ULTIMATE_INTAKE_PLAN.md`, `JOBAUFNAHME_FRAMEWORK.md`, `KERNPROZESS_PLAN.md` | Intake-/Kernprozess-Planung | Prozess-Soll |
| `AKADEMIE_PLAN.md` (+5 weitere AKADEMIE_*) | Academy-Konzept | Academy-Soll |

## 7. Abgrenzung dieses Audits

- **Untersucht**: alles mit Recruiter-Bezug — Routen, Komponenten, Hooks, Edge Functions, Tabellen, RLS, Workflows, Finance, AI, Tests. Client- und Admin-Bereiche nur dort, wo sie Recruiter-Prozesse berühren (Submission-Review, Payout-Approval, Interview-Flow, Reveal).
- **Nicht untersucht**: Landing/Marketing-Seiten, reine Client-UX, Outreach-/Lead-Gen-Modul (nur als Randnotiz), Akademie-Lerninhalte.
- **Keine Codeänderungen** im Rahmen dieses Audits; einziges Artefakt ist `docs/recruiter-dashboard-audit/`.
