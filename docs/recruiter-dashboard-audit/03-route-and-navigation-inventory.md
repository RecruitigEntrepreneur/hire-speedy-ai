# 03 — Routen- und Navigationsinventar (Recruiter-Dashboard)

> Audit-Agent 1 (Frontend & Navigation) · Stand: 2026-07-21 · Basis: aktueller Dateistand auf Platte (main, uncommittete Änderungen)
> Belegformat: `Datei:Zeile`. Statuswerte und Reifegrade gemäß Audit-Regelwerk.

---

## 1. Routentabelle (alle Recruiter-Routen aus `src/App.tsx`)

Alle Recruiter-Routen sind mit `<ProtectedRoute allowedRoles={['recruiter']}>` geschützt. Admins passieren jede ProtectedRoute (`src/App.tsx:133-135`). Es gibt **kein gemeinsames Parent-Layout auf Routenebene** — jede Seite rendert selbst `<DashboardLayout>` (z. B. `src/pages/recruiter/RecruiterDashboard.tsx:555`, `RecruiterJobs.tsx:503`).

| Pfad | Komponente | Rollen-Guard | Beleg (App.tsx) | In Sidebar sichtbar? |
|---|---|---|---|---|
| `/recruiter` | RecruiterDashboard | recruiter | 242-246 | Ja („Übersicht", DashboardLayout.tsx:100) |
| `/recruiter/interviews` | RecruiterInterviews | recruiter | 247-251 | Ja (DashboardLayout.tsx:102) |
| `/recruiter/jobs` | RecruiterJobs | recruiter | 252-256 | Ja (DashboardLayout.tsx:103) |
| `/recruiter/jobs/:id` | JobDetail | recruiter | 257-261 | — (Detailseite) |
| `/recruiter/candidates` | RecruiterCandidates | recruiter | 262-266 | Ja (DashboardLayout.tsx:104) |
| `/recruiter/candidates/:id` | RecruiterCandidateDetail | recruiter | 267-271 | — (Detailseite) |
| `/recruiter/submissions` | RecruiterSubmissions | recruiter | 272-276 | Ja („Pipeline", DashboardLayout.tsx:105) |
| `/recruiter/submissions/:submissionId` | SubmissionDetail | recruiter | 322-326 | — (Detailseite) |
| `/recruiter/earnings` | RecruiterEarnings | recruiter | 277-281 | Ja (DashboardLayout.tsx:107) |
| `/recruiter/payouts` | RecruiterPayouts | recruiter | 297-301 | Ja (DashboardLayout.tsx:108) |
| `/recruiter/notifications` | RecruiterNotifications | recruiter | 282-286 | Ja (DashboardLayout.tsx:109) |
| `/recruiter/messages` | RecruiterMessages | recruiter | 287-291 | Ja (DashboardLayout.tsx:110) |
| `/recruiter/profile` | RecruiterProfile | recruiter | 292-296 | Ja (DashboardLayout.tsx:111) |
| `/recruiter/privacy` | RecruiterDataPrivacy | recruiter | 302-306 | Ja („Datenschutz", DashboardLayout.tsx:112) |
| `/recruiter/influence` | RecruiterInfluence | recruiter | 307-311 | Ja („Aufgaben", DashboardLayout.tsx:101) |
| `/recruiter/talent-pool` | RecruiterTalentPool | recruiter | 312-316 | Ja (DashboardLayout.tsx:106) |
| `/recruiter/integrations` | RecruiterIntegrations | recruiter | 317-321 | **Nein** — nicht in Sidebar |
| `/recruiter/onboarding` | RecruiterOnboarding | recruiter | 451-455 | Nein (Onboarding-Flow, erwartbar) |

### 1.1 Verlinkte Ziele, die es NICHT gibt (kaputte Navigation)

| Link/Aktion | Quelle (Beleg) | Ziel | Ergebnis | Bewertung |
|---|---|---|---|---|
| „Einstellungen" (Profilmenü + Sidebar-Footer) | `DashboardLayout.tsx:144` (`settingsHref = … : '/recruiter/settings'`), gerendert Z. 173-178 u. 219-230 | `/recruiter/settings` | Keine Route in App.tsx → Catch-all `*` → NotFound (`App.tsx:484`) | **FEHLERHAFT** — der Recruiter hat keine Einstellungsseite, der Link führt auf 404 |
| Shortcut `g`+`s` | `useDashboardKeyboardShortcuts.ts:64-69` | `/recruiter/settings` | 404 (s. o.) | FEHLERHAFT |
| Shortcut `g`+`t` („Talent Hub") | `useDashboardKeyboardShortcuts.ts:46-51` | `/recruiter/talent` | Keine Route (korrekt wäre `/recruiter/talent-pool`) → 404 | FEHLERHAFT |
| Shortcut `n`+`j` („Neuer Job") | `useDashboardKeyboardShortcuts.ts:71-76` | `/recruiter/jobs/new` | Matcht `/recruiter/jobs/:id` mit id=`new` → JobDetail-Query scheitert → „Job not found" (`JobDetail.tsx:293-306`). Für Recruiter fachlich ohnehin sinnlos (Recruiter legen keine Jobs an) | FEHLERHAFT |
| „Exposé ansehen" (Kandidaten-Detail) | `RecruiterCandidateDetail.tsx:170` (`window.open('/expose/'+id)`) | `/expose/:id` | Keine Route im gesamten Router (grep `path="/expose` = 0 Treffer) → 404 in neuem Tab | **FEHLERHAFT** — beworbene Kernaktion endet auf NotFound |

### 1.2 Existierende Seiten, die nicht (oder nur versteckt) verlinkt sind

| Seite | Erreichbarkeit | Bewertung |
|---|---|---|
| `/recruiter/integrations` | Nicht in Sidebar (`DashboardLayout.tsx:99-113` enthält keinen Eintrag). Erreichbar nur über Dropdown „CRM verbinden" im Dashboard-Header (`RecruiterDashboard.tsx:605-608`) und im Kandidaten-Dropdown (`RecruiterCandidates.tsx:274-279`) | VERSTECKT_ODER_NICHT_VERLINKT (in der Hauptnavigation) |
| `/recruiter/onboarding` | Nirgends verlinkt (nur Redirect-Ziel im Auth-Flow) | erwartetes Verhalten, kein Defekt |

---

## 2. Navigation im Detail

### 2.1 Sidebar (DashboardLayout)
- 13 flache Einträge für die Rolle recruiter (`DashboardLayout.tsx:99-113`), keine Gruppierung, keine Badges (z. B. keine Unread-Zahl an „Nachrichten"/„Benachrichtigungen", keine Aufgaben-Zahl an „Aufgaben").
- Active-State via `location.pathname.startsWith` (`DashboardLayout.tsx:196-197`) — funktioniert, aber `/recruiter/submissions/:id` markiert korrekt „Pipeline".
- Sidebar ist `fixed … hidden md:block` (`DashboardLayout.tsx:192`). **Es existiert kein Hamburger-Menü, kein Sheet, kein Bottom-Nav** — auf Mobile (<768px) ist die gesamte Navigation unerreichbar; nur Logo (→ Home), Suche, Bell und Profilmenü im Header (`DashboardLayout.tsx:149-188`). Status: Mobile-Navigation **NICHT_VORHANDEN**.

### 2.2 GlobalSearch (Cmd+K)
Für die Rolle recruiter **funktional tot und falsch verdrahtet** (`src/components/layout/GlobalSearch.tsx`):
- Jobs-Suche filtert hart auf `client_id = user.id` (`GlobalSearch.tsx:67-72`) — ein Recruiter besitzt keine Jobs als Client → 0 Treffer.
- Kandidaten-Suche geht über `client_candidate_view` (`GlobalSearch.tsx:87-90`) — eine Client-View; für Recruiter liefert sie keine (eigenen) Kandidaten.
- Ergebnis-Navigation führt in Client-Routen: `/dashboard/jobs/:id`, `/dashboard/candidates/:id`, `/dashboard/interviews` (`GlobalSearch.tsx:128-138`) — ProtectedRoute wirft den Recruiter zurück auf `/recruiter` (`App.tsx:137-140`).
- Alle 6 „Schnellaktionen" sind Client-Pfade inkl. „Neuen Job erstellen" (`GlobalSearch.tsx:141-148`).
Status: **FEHLERHAFT** für Recruiter (Prior-Art-Behauptung „keine GlobalSearch für Recruiter" damit VERIFIZIERT).

### 2.3 NotificationBell (Header)
- Realtime über `useRealtimeNotifications` (Channel-Subscription, `src/hooks/useRealtimeNotifications.ts:83`) — Badge aktualisiert live. Nachgewiesen funktional.
- Rollenbewusste Links (`NotificationBell.tsx:20-48`), aber: `submission` → generische Liste `/recruiter/submissions` statt Deal (`Z. 27-30`), `interview` → ebenfalls `/recruiter/submissions` (`Z. 35-38`). Kein Deep-Link auf `/recruiter/submissions/:id`, obwohl `related_id` vorhanden ist.
- „Alle anzeigen" → `/recruiter/notifications` (korrekt, `Z. 147`).

### 2.4 Profilmenü
- Zeigt E-Mail + Rolle, „Einstellungen" (→ 404, s. 1.1), „Abmelden" (`DashboardLayout.tsx:161-185`). Kein Link zum Recruiter-Profil (`/recruiter/profile`) — das Profil ist nur über die Sidebar erreichbar.

### 2.5 Breadcrumbs
- Nicht vorhanden. grep „Breadcrumb" über `src/pages/recruiter/`, `src/components/layout/`, `src/components/recruiter/` = 0 Treffer. Detailseiten nutzen stattdessen „Zurück"-Links (`JobDetail.tsx:315-319`, `SubmissionDetail.tsx:421-427`). Status: NICHT_VORHANDEN.

### 2.6 Tastatur-Shortcuts / Quick Actions
- `useDashboardKeyboardShortcuts` (eingebunden in jedem DashboardLayout, `DashboardLayout.tsx:68`) bietet g+d/g+j/g+t/g+i/g+m/g+s, n+j, `?`-Hilfe. Für Recruiter sind **3 von 7 Navigationszielen kaputt** (g+t, g+s, n+j — s. 1.1). Hilfe-Modal existiert (`KeyboardShortcutsHelp`, `DashboardLayout.tsx:248-252`).
- Seiten-Shortcut Shift+S (Session-Start) nur auf `/recruiter/influence` (`RecruiterInfluence.tsx:146-158`), im UI nirgends dokumentiert (kein Hinweis-Text, nicht im Hilfe-Modal, das nur die Layout-Shortcuts listet).

---

## 3. Seiten-Inventar (alle 17 Seiten unter `src/pages/recruiter/`)

Legende Zustands-Spalten: L = Loading-State, E = Empty-State, F = Fehler-State (sichtbar für Nutzer).

### 3.1 RecruiterDashboard (`/recruiter`, 1.079 Z.)
- **Datenquellen:** Direkt-Queries `jobs` (Top 4 + Count, `RecruiterDashboard.tsx:301-316`), `company_profiles` (Z. 320-323), `candidates`-Count (Z. 335-338), `placements` (Z. 344-347), `submissions` für Pipeline (Z. 363-367), `influence_alerts` Insert-Loop (Z. 238-267). Hooks: `useUnifiedTaskInbox` (Z. 199; Tabellen `influence_alerts`, `recruiter_tasks`-Äquivalent, Realtime-Channels `useUnifiedTaskInbox.ts:477,491`), `useRecruiterInterviewAgenda` (Z. 200; React Query auf `interviews`+`submissions`, reveal-gated).
- **L:** Ja, Vollseiten-Spinner (Z. 553-561). **E:** Ja für Aufgaben (Z. 651-656) und Jobs (Z. 865-869). **F:** Nein — alle catch-Blöcke nur `console.error` (Z. 353-357, 417-419); fehlgeschlagene Queries enden stumm mit Nullwerten.
- **Aktionen:** Kandidat anlegen (Insert mit `as never`-Typ-Escape, Z. 537), CV-Upload, HubSpot-Import, Inbound-E-Mail-Dialog (Adresse client-seitig aus User-UUID generiert, Z. 514-518 — nicht serverseitig persistiert), Aufgabe erledigen, Task-/Interview-/Job-Navigation.
- **Verlinkungen:** `/recruiter/influence`, `/recruiter/submissions(/:id)`, `/recruiter/interviews`, `/recruiter/jobs(/:id)`, `/recruiter/candidates(/:id)`, `/recruiter/earnings`, `/recruiter/integrations`.
- **Geladen, aber nicht gerendert:** `jobs.company_size_band`, `funding_stage`, `tech_environment`, `remote_type`, `hiring_urgency` (Query Z. 303) erscheinen im Top-Jobs-Widget nicht (nur `industry`+`location`, Z. 902-913); `company_profiles.headcount`+`industry` (Z. 322) ungenutzt (nur Logo). Pipeline-Prognose mit **fixen Gewichten 10/20/40/75 %** (Z. 379-385), Worst Case = 50 % der Offers (Z. 402-404) — obwohl `candidate_behavior.closing_probability` im System existiert (`RecruiterSubmissions.tsx:206`).
- **Totes UI:** „Alert-Einstellungen"-Button (Settings2-Icon) ohne onClick (Z. 641-648) — reine Dekoration.
- **Sonstiges:** N+1-Insert-Loop für fehlende Interview-Alerts (Z. 255-267); Logo-Fallback via externem ui-avatars.com (Z. 888); kein Realtime für Jobs/Pipeline/Stats (nur Aufgaben via Hook).
- **Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 3.

### 3.2 RecruiterJobs (`/recruiter/jobs`, 908 Z.)
- **Datenquellen:** `jobs` `select('*')` aller published Jobs ohne Pagination (Z. 282-286), `company_profiles` (Z. 293-296), `submissions` (revealed, Z. 317-321; aktive, Z. 346-351). Hooks: `useJobSubmissionStats` (`submissions`), `useRecruiterTrustLevel` (`recruiter_trust_levels`), `useJobActivation` (`recruiter_job_activations`).
- **L:** Ja (Z. 501-509). **E:** Ja (Z. 750-761), erscheint nicht mehr während Loading (Early Return). **F:** Nein (Z. 307-311 nur console.error).
- **Aktionen:** Job aktivieren (ActivationConfirmDialog + SlotLimitDialog, Z. 815-864), Kandidat einreichen (Quick-Submit-Dialog, Z. 887-905), Suche/3 Filter/Sortierung (inkl. „Wenig Konkurrenz"), 5 Tabs, Preview-Panel (Desktop inline Z. 793-810, **Mobile als Sheet** Z. 867-884).
- **Geladen, aber nicht gerendert:** `select('*')` lädt sämtliche Job-Spalten inkl. `company_name` in den Client-State — `getRevealedCompanyName` liest den Klartext-Firmennamen direkt aus `jobs.find(...).company_name` (Z. 386-388). Die Anonymisierung ist reine Anzeige-Logik über vollständig ausgelieferten Daten (bekanntes Triple-Blind-Grundproblem, hier im UI-Code nachgewiesen).
- **Workaround-Kommentar im Code:** „active_count in der DB wird nicht gepflegt (Trigger fehlt live)" — Frontend zählt Aktivierungen selbst (Z. 256-262). Frontend kompensiert fehlende Backend-Migration.
- **Fehlend:** Match-Score des Recruiters zu Jobs (wichtigste Sortier-Dimension) existiert nirgends auf der Liste.
- **Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 3 · Sicherheitsrisiko HOCH (company_name im Client trotz Blind-Modus).

### 3.3 JobDetail (`/recruiter/jobs/:id`, 568 Z.)
- **Datenquellen:** `jobs` single (Z. 166-170), `company_profiles` (Z. 182-186), eigene `submissions` inkl. `match_score`, `stage` (Z. 195-213), Submissions-Count (Z. 230-234). Edge Function `format-job-for-recruiters` als Self-Healing-Autoformat (Z. 148-150).
- **L:** Ja (Z. 283-291). **E/NotFound:** Ja, aber englisch („Job not found", Z. 297). **F:** Nein (Z. 237-241).
- **Aktionen:** Kandidat einreichen (CandidateSubmitForm-Dialog, Z. 396-417), Exposé generieren (AnonymousExposeDialog, Z. 560-564).
- **Reveal-Logik:** Access-Status manuell aus eigenen Submissions abgeleitet statt zentraler RPC (Z. 218-227). **PartnerFactsCard rendert Firmen-Facts (headcount, revenue, founded_year, USP, awards) sobald `company_profiles`-Daten da sind — ohne Reveal-Guard** (Z. 452-454); der Guard hängt nicht an der Komponente.
- **Geladen, aber nicht gerendert:** `match_score` (Z. 204) erscheint nirgends; `stage` wird inzwischen über JobCandidateProcessCards visualisiert (Z. 423-428) — Prior-Art hier TEILWEISE NICHT MEHR AKTUELL.
- **Sonstiges:** `isFormatting` gesetzt, nie angezeigt (Z. 128, 145-156); EN-Reste („Not specified" Z. 245, „Hot"/„Urgent" Z. 256-262).
- **Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 3 · Sicherheitsrisiko MITTEL (PartnerFacts ohne Guard).

### 3.4 RecruiterCandidates (`/recruiter/candidates`, 409 Z.)
- **Datenquellen:** `candidates` (Z. 66-70), `submissions` batch (Z. 81-84), `consents`-Insert bei Neuanlage (Z. 162-173). Hook `useCandidateTags`.
- **L:** Ja (Z. 228-234). **E:** Ja (Z. 295-307). **F:** Nein (Fehler nur implizit).
- **Aktionen:** CRUD Kandidaten, CV-Upload, HubSpot-Import, Tags, Bulk (Export/Delete/Tag), 3 Ansichten (Cards/List/Table). CSV-Import als „bald" deaktiviert (Z. 269-272).
- **Platzhalter:** `onAddToPool` ist auf allen 4 Einbindungen nur `toast.info('Talent Pool Feature')` (Z. 320, 337, 352, 365) — **die Talent-Pool-Zufuhr existiert nicht**. `activeJobs: 0` hartkodiert (Z. 113) — StatsBar zeigt dauerhaft 0 aktive Zuordnungen.
- **Datenschutz-Geruch:** `console.log` mit allen Kandidatennamen bei jedem Fetch (Z. 65-74) — PII im Browser-Log.
- **Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 3.

### 3.5 RecruiterCandidateDetail (`/recruiter/candidates/:id`, 296 Z.)
- **Datenquellen:** `candidates` single mit recruiter_id-Scope (Z. 93-98), `submissions` via React Query (Z. 60-73), `candidate_interview_notes` via React Query (Z. 113-126), `influence_alerts`-Titel (Z. 78-87). Hooks: Tags, ActivityLog, CoachingPlaybook.
- **L:** Ja (Z. 173-181). **E/NotFound:** Toast + Redirect (Z. 99-103) plus Fallback-Ansicht (Z. 183-195). **F:** teilweise (Toast).
- **Aktionen:** Bearbeiten, CV-Upload, Interview starten, Aktivität loggen. **`onSubmitToJob={() => {}}` (Z. 276) — der zentrale „Auf Job einreichen"-CTA in der Sticky ActionBar tut nichts** (Button ruft leere Funktion, `CandidateActionBar.tsx:65,125`). **„Exposé ansehen" öffnet `/expose/:id` → 404** (Z. 170, keine Route).
- **Prior-Art-Abgleich:** `change_motivation`/`would_recommend` fließen inzwischen in die Readiness-Berechnung ein (Z. 141-142) — Behauptung „geladen, nie genutzt" NICHT MEHR AKTUELL; Readiness weiterhin lokal berechnet (`getExposeReadiness`, Z. 128-143), nicht aus DB-View.
- **Status:** FEHLERHAFT (2 tote Kern-CTAs) · Reifegrad 2.

### 3.6 RecruiterSubmissions (`/recruiter/submissions`, 694 Z.)
- **Datenquellen:** `submissions` mit 5-fach-Nested-Select (`jobs`, `candidates`, `interviews`, `candidate_behavior`, `influence_alerts`; Z. 199-210, ungepaginiert), `coaching_playbooks` (Z. 222-227). Hook `useRecruiterStats` (Funnel).
- **L:** Ja (Z. 279-287). **E:** Ja (Kanban-Spalten Z. 483-487; Liste Z. 500-514). **F:** Nein.
- **Kanban:** 7 Status-Spalten (Z. 102-110), Matching nur noch über `sub.status === key` (Z. 243-245) — die Prior-Art-Doppelmatch-Logik (`status || stage`) ist NICHT MEHR AKTUELL. **Der Status/Stage-Split-Brain besteht aber weiter:** SubmissionDetail führt ein 8-Stufen-`stage`-Modell (`SubmissionDetail.tsx:47-56`) und schreibt Opt-In nur nach `stage` (`SubmissionDetail.tsx:268-271`); Kandidaten, deren Fortschritt in `stage` steht, bewegen sich im Kanban (status-basiert) nicht.
- **Geladen, aber nicht gerendert:** `engagement_level` (Interface Z. 53, Query Z. 206) erscheint nirgends; `match_score` (via `*`) fehlt auf den Karten; `rejection_reason` als roher String (Z. 467-471).
- **Aktionen:** Anrufen/E-Mail/Playbook je Karte; **kein Inline-Stage-Update, kein Drag & Drop**.
- **Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 3 (Board-Datenmodell FEHLERHAFT, s. Doc 10).

### 3.7 SubmissionDetail (`/recruiter/submissions/:submissionId`, 839 Z.)
- **Datenquellen:** React Query (Z. 188-236): `submissions`+`candidates`+`jobs`, `interviews`, `candidate_activity_log` (limit 20), `influence_alerts`.
- **L:** Ja (Z. 306-314). **F:** **Ja — einzige Seite mit echtem Fehler-State** („Einreichung nicht gefunden", Z. 316-328). **E:** Timeline-Empty (Z. 829-831).
- **Aktionen:** Notiz speichern (String-Konkatenation mit Timestamp-Prefix statt Notes-Tabelle, Z. 243-246), Opt-In bestätigen (schreibt **nur** `stage='candidate_opted_in'`, kein `opted_in_at`, keine Methode, kein Consent-Datensatz, Z. 268-271), Alert erledigen (Z. 292-303), Meeting beitreten, tel:/mailto:.
- **Timeline:** Dedup über `title + 16-Zeichen-Timestamp` (Z. 408-414) — fragil; declined/cancelled Interviews fehlen (nur `pending_response`/`scheduled` verarbeitet, Z. 373-390).
- **Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 3 · Sicherheitsrisiko MITTEL (Recruiter bestätigt Kandidaten-Opt-In per Klick ohne Nachweis).

### 3.8 RecruiterEarnings (`/recruiter/earnings`, 334 Z.)
- **Datenquellen:** `submissions`(hired)+nested `placements` inkl. `platform_fee`, `total_fee` (Z. 73-92). Hook `useRecruiterStats` (Performance vs. Plattform).
- **L:** Ja (Z. 159-167). **E:** Ja (Z. 248-255). **F:** Nein.
- **Geladen, aber nicht gerendert:** `platform_fee` und `total_fee` (Query Z. 82-84, Interface Z. 32-33) tauchen in der Tabelle (Spalten Z. 258-267) **nicht** auf — der Recruiter sieht nie den Fee-Split. VERIFIZIERT.
- **Hartkodiert:** „Auszahlungen erfolgen monatlich zum 15." (Z. 315), „Probezeit 3-6 Monate" (Z. 324) — keine Datenbasis. DE/EN-Mix im Titel „Earnings & Payouts" (Z. 173). Kein Export, keine Filter, kein Zeitverlauf.
- **Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 2 (Geldkreislauf dahinter unecht, s. 3.9).

### 3.9 RecruiterPayouts (`/recruiter/payouts`, 283 Z.)
- **Datenquellen:** `placements` mit submission-Join (Z. 56-76), `payout_requests` (Z. 81-84). Komponenten: RecruiterStripeOnboarding (zeigt `charges_enabled`/`payouts_enabled`, `RecruiterStripeOnboarding.tsx:121-125` — Prior-Art „kein KYC-Status" damit TEILWEISE WIDERLEGT), EscrowStatusBadge.
- **L:** Ja (Z. 131-139). **E:** Ja (Z. 207-210). **F:** Nein.
- **Kernbefund (VERIFIZIERT):** „Verfügbar" wird client-seitig errechnet — abgelaufene `escrow_release_date` bei Status `held` zählt als verfügbar (Z. 100-109), während der DB-Status `held` bleibt. **`PayoutRequestCard` wird importiert (Z. 8), aber nie gerendert** (kein `<PayoutRequestCard` im JSX) → **es gibt keinerlei Auszahlungs-CTA**. Die Seite zeigt Geld an, das der Recruiter nicht anfordern kann.
- **Status:** FEHLERHAFT (Anzeige ≠ DB-Wahrheit, Kernaktion fehlt) · Reifegrad 2.

### 3.10 RecruiterInfluence (`/recruiter/influence`, 452 Z.)
- **Datenquellen:** `useUnifiedTaskInbox` (merged: `influence_alerts` + manuelle Tasks + abgeleitete Aufgaben; Sortierung Priorität→Impact→Datum `useUnifiedTaskInbox.ts:443-446`; Realtime-Channels Z. 477, 491), `useRecruiterInfluenceScore` (`recruiter_influence_scores`), `useCoachingPlaybook`, `useActionSession`.
- **L:** Ja (Z. 286-289). **E:** Ja (Z. 290-298). **F:** Nein — der Hook liefert `error` (`useUnifiedTaskInbox.ts:284,634`), die Seite destrukturiert ihn nicht (Z. 32-43); Score-Widget verschwindet bei Fehler stumm (Z. 221-223). VERIFIZIERT.
- **Aktionen:** Erledigen/Snoozen/Löschen, manuelle Aufgabe anlegen, Action-Session (Start-Dialog, Overlay, Summary), Playbook öffnen, Zeitgruppierung (Überfällig/Heute/Woche/Später, Z. 180-205).
- **Befunde:** Session **nicht persistent** — `useActionSession` ohne localStorage/sessionStorage (grep = 0 Treffer): Refresh beendet die Session. 3 Min/Aufgabe hartkodiert (Z. 176). Shift+S-Shortcut (Z. 152) im UI undokumentiert. `alerts_ignored` des Scores wird nie angezeigt (nur `alerts_actioned`, Z. 340).
- **Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 3.

### 3.11 RecruiterInterviews (`/recruiter/interviews`, 359 Z.)
- **Datenquellen:** `useRecruiterInterviewAgenda` — React Query auf `interviews` mit submission-Join; **reveal-gated**: Firmenname nur bei `company_revealed`, sonst Branchen-Label (`useRecruiterInterviewAgenda.ts:33-34, 127, 155`).
- **L:** **Skeletons** (einzige Seite; Z. 208, 216-221). **E:** Ja (Z. 305-314). **F:** Nein (nur isLoading destrukturiert, Z. 163).
- **Vollständig i18n:** einzige Recruiter-Seite mit `useTranslation` (Z. 3, 47, 161); Keys in beiden Locales vorhanden (`de.ts`/`en.ts` grep `recruiterInterviews` = je 1 Block).
- **Aktionen:** Meeting beitreten, Submission öffnen, Debrief-Sektion, „Warten auf Terminierung" mit Slots-abgelaufen-Badge, Vergangene (collapsible).
- **Status:** VORHANDEN_PRODUKTIV · Reifegrad 4 (Referenz-Implementierung der Zielarchitektur).

### 3.12 RecruiterNotifications (`/recruiter/notifications`, 332 Z.)
- **Datenquellen:** `notifications` (Z. 84-88), `useIdentityUnlock` (schreibt `submissions`, `notifications`, `identity_unlock_logs`; `useIdentityUnlock.ts:27-176`).
- **L:** Ja (Z. 185-193). **E:** Ja (Z. 233-242). **F:** Nein. **Kein Realtime** (nur Mount-Fetch, Z. 76-80) — die Bell im Header ist realtime, die Seite nicht: zwei Frische-Zustände derselben Daten. VERIFIZIERT.
- **Kritisch (VERIFIZIERT):** Opt-In-Dialog erhält hartkodierte Platzhalter `candidateName="Kandidat"`, `jobIndustry="Branche"` (Z. 324-325) — der Recruiter entscheidet über Identitätsfreigabe **ohne zu sehen, um welchen Kandidaten und welchen Job es geht**.
- **Links:** `submission` → generische Liste (Z. 151-152), `placement` → `/recruiter/earnings`; kein Deal-Deep-Link. Keine Pagination/Gruppierung/Typ-Filter.
- **Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 2.

### 3.13 RecruiterMessages (`/recruiter/messages`, 376 Z.)
- **Datenquellen:** `messages` — lädt **alle** Nachrichten aller Konversationen des Users (Z. 72-76), dann **N+1** `profiles`-Fetch pro Konversation im Loop (Z. 96-101).
- **L:** Ja (Z. 209-217). **E:** Ja (Konversationen Z. 247-253; kein Chat gewählt Z. 361-370). **F:** teilweise (Send-Fehler-Toast Z. 180-186).
- **Kein Realtime:** neue Nachrichten erscheinen erst nach Reload — für einen Messenger fachlich kaum nutzbar. `candidate_id`/`job_id` werden geladen (Interface Z. 28-29), aber nie als Kontext gerendert; `jobTitle` im Conversation-Interface (Z. 39) wird nie befüllt (totes Feld).
- **Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 2.

### 3.14 RecruiterProfile (`/recruiter/profile`, 471 Z.)
- **Datenquellen:** `profiles` (Z. 78-82), `recruiter_documents` (Z. 89-92), `submissions` für Stats (Z. 97-100).
- **L:** Ja (Z. 196-204). **E:** n/a. **F:** teilweise (Save-Fehler-Toast Z. 144-150).
- **Fake-Daten (VERIFIZIERT):** `avgResponseTime: 2.4` hartkodiert mit Kommentar „Placeholder" (Z. 113); Progress-Formel `100 - avgResponseTime*10` semantisch sinnlos (Z. 444). **„Verifizierter Recruiter"-Badge wird bedingungslos angezeigt** — unabhängig davon, ob Dokumente akzeptiert wurden (Z. 456-466).
- **Compliance-Lücken:** Dokument-Akzeptanz ohne Version/IP/Audit-Trail und ohne Link zum Dokumenttext (Z. 156-190: nur `is_accepted`+Timestamp); IBAN/BIC ohne Validierung als Klartext in `profiles` (Z. 314-331); `avatar_url` im Interface (Z. 38), nie gerendert.
- **Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 2 · Sicherheitsrisiko MITTEL (Bankdaten, Schein-Verifizierung).

### 3.15 RecruiterIntegrations (`/recruiter/integrations`, 434 Z.)
- **Datenquellen:** `useRecruiterIntegrations` → `recruiter_integrations` (`useRecruiterIntegrations.ts:53`), Edge Functions `oauth-connect` (Z. 109), `integration-api-key` (Z. 144, 182), `integration-disconnect` (Z. 216).
- **L:** Ja (Z. 101-108). **E:** implizit (Sektion erscheint nur bei Integrationen). **F:** Fehlerstatus je Integration wird angezeigt (Z. 161-210) — positiv.
- **Deko-UI (VERIFIZIERT):** Beide Auto-Sync-Switches ohne onChange/State (Z. 305, 315) — schalten nichts. „API Dokumentation öffnen"-Button ohne href/onClick (Z. 329-332) — tut nichts. Kein manueller Sync-Trigger, keine Sync-Historie, kein Verbindungstest (keine entsprechende Edge-Function-Invocation im Hook).
- **Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 2 (Verbinden/Trennen funktioniert; Sync-Steuerung ist Attrappe).

### 3.16 RecruiterTalentPool (`/recruiter/talent-pool`, 19 Z. Wrapper)
- **Datenquellen:** `TalentPoolDashboard` → `useTalentPool` (`talent_pool`, CRUD `useTalentPool.ts:62-181`), `useTalentAlerts` (`talent_alerts`, Z. 218-246).
- **L:** Ja (`TalentPoolDashboard.tsx:38`). **F:** nicht auffindbar.
- **Kernproblem:** Der Zulauf ist tot — der einzige UI-Weg in den Pool (`onAddToPool` in Kandidatenliste) ist ein Toast-Platzhalter (s. 3.4). Technisch vorhanden, fachlich nicht befüllbar.
- **Status:** BACKEND_VORHANDEN_UI_FEHLT (für den Zulauf) / Gesamt VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 2.

### 3.17 RecruiterDataPrivacy (`/recruiter/privacy`, 46 Z. Wrapper)
- **Datenquellen:** GDPR-Komponenten (`ConsentManagement`, `DataExportRequest`, `DataDeletionRequest`).
- Tab-State nicht in der URL (Z. 24: `defaultValue="consents"` ohne Routing) — Deep-Links auf „Datenexport"/„Konto löschen" unmöglich.
- **Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 3.

---

## 4. Kernbefunde aus Headhunter-Sicht

1. **Der Weg zum Geld ist an zwei Stellen durchtrennt:** Kandidat → Job einreichen aus dem Kandidaten-Detail ist ein toter Button (`onSubmitToJob={() => {}}`), und verdientes Geld ist nicht anforderbar (kein Payout-CTA). Ein Headhunter kann einreichen (über Job-Seiten) und verdienen, aber die zwei wichtigsten Abschluss-Klicks fehlen.
2. **Entscheidung ohne Information:** Der Opt-In-Dialog in den Benachrichtigungen zeigt „Kandidat"/„Branche" als Platzhalter — die folgenreichste Entscheidung (Identitätsfreigabe) wird kontextlos getroffen.
3. **Vier kaputte Navigationsziele** (Einstellungen, g+t, n+j, /expose) erzeugen 404-Erlebnisse mitten im Arbeitsfluss.
4. **Mobile ist das Dashboard nicht navigierbar** — für einen Beruf, der zwischen Terminen am Handy lebt, fehlt die komplette Navigation.
5. **Suche existiert für Recruiter nicht** (Cmd+K ist auf Client verdrahtet).

---

## Feature-Zeilen für Master-Matrix

| ID | Domäne | Bereich | Feature | Nutzerrolle | UI-Pfad | Frontend-Dateien | Backend | Tabellen | Status | Reifegrad | Sicherheitsrisiko | Beleg | Empfehlung |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FE-001 | Frontend & Navigation | Routing | Recruiter-Routenschutz (ProtectedRoute, Admin-Bypass) | recruiter/admin | alle /recruiter/* | src/App.tsx | Supabase Auth (useAuth) | profiles/user_roles | VORHANDEN_PRODUKTIV | 4 | NIEDRIG | App.tsx:117-143, 242-326 | Admin-Bypass dokumentieren; Rollenprüfung serverseitig (RLS) bleibt maßgeblich |
| FE-002 | Frontend & Navigation | Navigation | Sidebar-Navigation Rolle recruiter (13 Einträge) | recruiter | alle Seiten | src/components/layout/DashboardLayout.tsx | — | — | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | KEIN | DashboardLayout.tsx:99-113, 192-237 | Gruppierung + Unread-/Task-Badges ergänzen |
| FE-003 | Frontend & Navigation | Navigation | Mobile-Navigation (Hamburger/Sheet/Bottom-Nav) | recruiter | alle Seiten | src/components/layout/DashboardLayout.tsx | — | — | NICHT_VORHANDEN | 0 | KEIN | DashboardLayout.tsx:192 (`hidden md:block`), kein Hamburger im Header Z.149-188 | Sheet-basiertes Mobile-Menü nachrüsten (P1) |
| FE-004 | Frontend & Navigation | Navigation | Einstellungen-Link Recruiter (`/recruiter/settings`) | recruiter | Profilmenü + Sidebar-Footer | src/components/layout/DashboardLayout.tsx, src/App.tsx | — | — | FEHLERHAFT | 0 | KEIN | DashboardLayout.tsx:144 vs. App.tsx (keine Route) → NotFound App.tsx:484 | Settings-Seite bauen oder Link auf /recruiter/profile mappen |
| FE-005 | Frontend & Navigation | Suche | GlobalSearch (Cmd+K) für Recruiter | recruiter | Header, alle Seiten | src/components/layout/GlobalSearch.tsx | Supabase Query | jobs, client_candidate_view | FEHLERHAFT | 1 | NIEDRIG | GlobalSearch.tsx:67-72 (client_id-Filter), 128-148 (Client-Routen) | Rollenbewusste Suche (eigene Kandidaten, Jobs, Deals) implementieren |
| FE-006 | Frontend & Navigation | Benachrichtigung | NotificationBell (Realtime, rollenbewusste Links) | recruiter | Header | src/components/layout/NotificationBell.tsx, src/hooks/useRealtimeNotifications.ts | Supabase Realtime | notifications | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | KEIN | NotificationBell.tsx:20-48; useRealtimeNotifications.ts:83 | Deep-Links auf /recruiter/submissions/:id statt generischer Liste |
| FE-007 | Frontend & Navigation | Shortcuts | Tastatur-Shortcuts (g+…, n+j, ?) | recruiter | alle Seiten | src/hooks/useDashboardKeyboardShortcuts.ts | — | — | FEHLERHAFT | 2 | KEIN | useDashboardKeyboardShortcuts.ts:46-51 (g+t→/recruiter/talent 404), 64-69 (g+s 404), 71-76 (n+j) | Rollen-spezifische Shortcut-Ziele; kaputte Ziele fixen |
| FE-008 | Frontend & Navigation | Navigation | Breadcrumbs auf Detailseiten | recruiter | Detailseiten | — | — | — | NICHT_VORHANDEN | 0 | KEIN | grep Breadcrumb src/pages/recruiter src/components/layout = 0 Treffer | Zurück-Links reichen vorerst; Breadcrumbs bei tieferer Hierarchie |
| FE-009 | Frontend & Navigation | Dashboard | RecruiterDashboard (Bento: Aufgaben/Pipeline/Jobs/Stats) | recruiter | /recruiter | src/pages/recruiter/RecruiterDashboard.tsx | Supabase Queries + useUnifiedTaskInbox + useRecruiterInterviewAgenda | jobs, candidates, placements, submissions, influence_alerts, company_profiles, interviews | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | MITTEL | RecruiterDashboard.tsx:299-420 (Queries), 379-385 (fixe Gewichte), 553-561 (kein Error-State) | Error-States, Realtime für Kernwidgets, echte closing_probability statt Fixgewichte |
| FE-010 | Frontend & Navigation | Jobs | RecruiterJobs (Marktplatz, Tabs, Aktivierung, Preview) | recruiter | /recruiter/jobs | src/pages/recruiter/RecruiterJobs.tsx + JobActionCard/JobPreviewPanel/ActivationConfirmDialog | Supabase Queries; Hooks useJobActivation/useRecruiterTrustLevel/useJobSubmissionStats | jobs, submissions, company_profiles, recruiter_job_activations, recruiter_trust_levels | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | HOCH | RecruiterJobs.tsx:282-286 (select * inkl. company_name), 386-388 (Klartextname aus Client-State), 256-262 (Trigger-fehlt-Workaround) | RLS-seitige Spalten-Redaktion (Triple-Blind); Pagination; Match-Score-Spalte |
| FE-011 | Frontend & Navigation | Jobs | JobDetail (AI-Hero, Fee-Rechner, Submit-Dialog) | recruiter | /recruiter/jobs/:id | src/pages/recruiter/JobDetail.tsx + 11 recruiter-Komponenten | Edge Fn format-job-for-recruiters | jobs, company_profiles, submissions | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | MITTEL | JobDetail.tsx:218-227 (manuelle Reveal-Ableitung), 452-454 (PartnerFacts ohne Guard) | Zentrale Reveal-RPC; Guard in PartnerFactsCard; match_score anzeigen |
| FE-012 | Frontend & Navigation | Kandidaten | RecruiterCandidates (Liste, 3 Views, Bulk, Import) | recruiter | /recruiter/candidates | src/pages/recruiter/RecruiterCandidates.tsx + candidates-Komponenten | Supabase CRUD; consents-Logging | candidates, submissions, consents, candidate_tags | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | NIEDRIG | RecruiterCandidates.tsx:320/337/352/365 (onAddToPool-Platzhalter), 113 (activeJobs:0), 65-74 (PII-console.log) | Pool-Zufuhr implementieren; Debug-Logs entfernen; activeJobs berechnen |
| FE-013 | Frontend & Navigation | Kandidaten | RecruiterCandidateDetail (Hero, Readiness, ActionBar) | recruiter | /recruiter/candidates/:id | src/pages/recruiter/RecruiterCandidateDetail.tsx + CandidateActionBar u. a. | React Query auf Supabase | candidates, submissions, candidate_interview_notes, influence_alerts | FEHLERHAFT | 2 | NIEDRIG | RecruiterCandidateDetail.tsx:276 (onSubmitToJob leer), 170 (/expose ohne Route) | Submit-Flow anbinden (Quick Win); Exposé-Route bauen oder CTA entfernen |
| FE-014 | Frontend & Navigation | Pipeline | RecruiterSubmissions (Kanban 7 Spalten + Liste + Funnel) | recruiter | /recruiter/submissions | src/pages/recruiter/RecruiterSubmissions.tsx + SubmissionsFunnelGrid | Supabase Nested-Select; useRecruiterStats | submissions, jobs, candidates, interviews, candidate_behavior, influence_alerts, coaching_playbooks | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | NIEDRIG | RecruiterSubmissions.tsx:102-110 (7 Status-Spalten), 243-245 (status-only) vs. SubmissionDetail.tsx:47-56 (8 stages) | Kanonisches Stage-Modell; Drag&Drop mit serverseitiger Transition |
| FE-015 | Frontend & Navigation | Pipeline | SubmissionDetail (Deal-Seite, Timeline, Opt-In, Interview) | recruiter | /recruiter/submissions/:submissionId | src/pages/recruiter/SubmissionDetail.tsx | React Query auf Supabase | submissions, interviews, candidate_activity_log, influence_alerts | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | MITTEL | SubmissionDetail.tsx:268-271 (Opt-In nur stage, ohne Consent-Nachweis), 244-246 (Notiz-Konkatenation) | Opt-In mit opted_in_at+Methode+Consent-Log; Notes-Tabelle |
| FE-016 | Frontend & Navigation | Geld | RecruiterEarnings (KPIs, Placements-Tabelle, Metrics) | recruiter | /recruiter/earnings | src/pages/recruiter/RecruiterEarnings.tsx + RecruiterMetricsSection | Supabase Query; useRecruiterStats | submissions, placements | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | KEIN | RecruiterEarnings.tsx:82-84 (platform_fee/total_fee geladen) vs. 258-296 (nicht gerendert), 315 (Zyklus hartkodiert) | Fee-Split + Escrow-Bezug anzeigen; CSV-Export |
| FE-017 | Frontend & Navigation | Geld | RecruiterPayouts (Escrow-Stats, Stripe, Auszahlung anfordern) | recruiter | /recruiter/payouts | src/pages/recruiter/RecruiterPayouts.tsx + PayoutRequestCard/EscrowStatusBadge/RecruiterStripeOnboarding | Supabase Query; Stripe-Edge-Fns (via Onboarding-Komponente) | placements, payout_requests | FEHLERHAFT | 2 | MITTEL | RecruiterPayouts.tsx:100-109 (client-seitiges „verfügbar" vs. DB held), 8 (PayoutRequestCard importiert, nie gerendert) | Erst Backend-Escrow-Flow, dann Payout-CTA rendern; bis dahin Anzeige ehrlich machen |
| FE-018 | Frontend & Navigation | Aufgaben | RecruiterInfluence (Unified Inbox, Session, Score) | recruiter | /recruiter/influence | src/pages/recruiter/RecruiterInfluence.tsx + influence-Komponenten | useUnifiedTaskInbox (Realtime) / useRecruiterInfluenceScore / useActionSession | influence_alerts, recruiter_influence_scores, (Tasks), coaching_playbooks | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | KEIN | RecruiterInfluence.tsx:32-43 (error ignoriert), 176 (3min hartkodiert); useActionSession ohne Persistenz (grep localStorage=0) | Fehler anzeigen; Session in localStorage; Shift+S dokumentieren |
| FE-019 | Frontend & Navigation | Interviews | RecruiterInterviews (Agenda, Debrief, Skeletons, i18n) | recruiter | /recruiter/interviews | src/pages/recruiter/RecruiterInterviews.tsx | useRecruiterInterviewAgenda (React Query, reveal-gated) | interviews, submissions | VORHANDEN_PRODUKTIV | 4 | KEIN | RecruiterInterviews.tsx:3 (i18n), 216-221 (Skeletons); useRecruiterInterviewAgenda.ts:127,155 (reveal-gate) | Error-State ergänzen; als Referenzmuster für übrige Seiten nutzen |
| FE-020 | Frontend & Navigation | Benachrichtigung | RecruiterNotifications (Liste, Opt-In-Dialog) | recruiter | /recruiter/notifications | src/pages/recruiter/RecruiterNotifications.tsx + OptInResponseDialog | Supabase Query; useIdentityUnlock | notifications, submissions, identity_unlock_logs | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | HOCH | RecruiterNotifications.tsx:324-325 (Platzhalter „Kandidat"/„Branche" im Opt-In-Dialog), 76-80 (kein Realtime) | Opt-In-Dialog mit echten Deal-Daten befüllen (P0); Realtime |
| FE-021 | Frontend & Navigation | Kommunikation | RecruiterMessages (3-Spalten-Messenger) | recruiter | /recruiter/messages | src/pages/recruiter/RecruiterMessages.tsx | Supabase Query (kein Realtime) | messages, profiles | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | NIEDRIG | RecruiterMessages.tsx:72-76 (alle Messages), 96-101 (N+1), 28-29/39 (Kontextfelder ungenutzt) | Realtime-Subscription; Konversations-RPC; Deal-Kontext-Header |
| FE-022 | Frontend & Navigation | Profil | RecruiterProfile (Stammdaten, Bank, Dokumente, Scores) | recruiter | /recruiter/profile | src/pages/recruiter/RecruiterProfile.tsx | Supabase CRUD | profiles, recruiter_documents, submissions | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | MITTEL | RecruiterProfile.tsx:113 (avgResponseTime-Fake), 444 (sinnlose Formel), 456-466 (Verified-Badge bedingungslos), 314-331 (IBAN ohne Validierung) | Fake-Metriken entfernen/berechnen; Verified an Kriterien knüpfen; IBAN-Validierung |
| FE-023 | Frontend & Navigation | Integrationen | RecruiterIntegrations (OAuth/API-Key, Status, Auto-Sync) | recruiter | /recruiter/integrations | src/pages/recruiter/RecruiterIntegrations.tsx | Edge Fns oauth-connect / integration-api-key / integration-disconnect | recruiter_integrations | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | NIEDRIG | RecruiterIntegrations.tsx:305,315 (Switches ohne onChange), 329-332 (API-Doku-Button ohne Aktion); Seite nicht in Sidebar (DashboardLayout.tsx:99-113) | Deko-Toggles implementieren oder entfernen; Sidebar-Eintrag; Sync-Trigger |
| FE-024 | Frontend & Navigation | Talent Pool | RecruiterTalentPool (Pool-Dashboard, Alerts) | recruiter | /recruiter/talent-pool | src/pages/recruiter/RecruiterTalentPool.tsx + talent-pool-Komponenten | useTalentPool/useTalentAlerts | talent_pool, talent_alerts | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | KEIN | RecruiterTalentPool.tsx:1-19 (Wrapper); Zulauf tot via RecruiterCandidates.tsx:320 | onAddToPool implementieren — sonst verhungert der Pool |
| FE-025 | Frontend & Navigation | Datenschutz | RecruiterDataPrivacy (Consents, Export, Löschung) | recruiter | /recruiter/privacy | src/pages/recruiter/RecruiterDataPrivacy.tsx + gdpr-Komponenten | GDPR-Komponenten | consents, (export/deletion requests) | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | KEIN | RecruiterDataPrivacy.tsx:24 (Tabs ohne URL-State) | URL-Tabs; Status laufender Anfragen anzeigen |
