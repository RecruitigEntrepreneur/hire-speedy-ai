# Recruiter-Dashboard — Godmode-Analyse & Ausarbeitung

> Stand: 2026-07-18 · Basis: main (lokal) · 16 Seiten unter `/recruiter/*`, 27 Komponenten unter `src/components/recruiter/`, ~20 Recruiter-Hooks
> Ziel: Pro Seite den Ist-Zustand, die konkreten Schwächen und das maximale UI/UX- und Funktions-Potenzial ("Godmode") herausarbeiten.

---

## 1. Executive Summary

Das Recruiter-Dashboard ist funktional das reifste der drei Personas (RecruiterDashboard.tsx allein 1.107 Zeilen, Bento-Grid, Influence-Engine, Trust-Level, Triple-Blind-Aktivierung), aber es leidet an **vier systemischen Problemen**, die jede Einzelseite betreffen:

1. **Zwei-Wahrheiten-Probleme überall.** `status` vs. `stage` auf Submissions (Kanban zeigt 7 Stages, SubmissionDetail 8 — ein Kandidat kann in zwei Spalten zugleich erscheinen), `payment_status` vs. `payout_requests.status`, zwei Influence-Score-Engines mit divergierenden Formeln, drei Match-Score-Quellen. Der Recruiter sieht je nach Seite andere Zahlen für dieselbe Sache.
2. **Der Geld-Kreislauf ist in der UI eine Attrappe.** Escrow bleibt ewig `pending`/`held` (kein Invoice-Flow, kein Status-Übergang), die Auszahlungs-Karte (`PayoutRequestCard`) wird importiert aber nie gerendert, "Verfügbar" wird client-seitig errechnet ohne Aktionsmöglichkeit. Die wichtigste Motivationsseite des Recruiters (Earnings/Payouts) zeigt Zustände, die nie eintreten.
3. **Datenreichtum ungenutzt.** Das Backend hat `candidate_behavior` (closing_probability, engagement_level), `candidate_ai_assessment`, `interview_intelligence`, `reference_responses`, `match_outcomes` — fast nichts davon erreicht die Recruiter-UI. Die Pipeline-Prognose rechnet mit fixen Prozenten (10/20/40/75), obwohl echte KI-Wahrscheinlichkeiten pro Kandidat existieren.
4. **Architektur-Inkonsistenz.** Kein React Query (überall manuelles useState/useEffect), Realtime nur auf 5 von 16 Seiten, 0 % i18n-Nutzung (alle Strings hartkodiert deutsch, obwohl de.ts/en.ts existieren), keine GlobalSearch für Recruiter, kein Mobile-Menü (Sidebar `hidden md:block` ohne Hamburger), 7 von 27 Recruiter-Komponenten verwaist (26 % toter Code).

**Godmode-Leitidee:** Das Recruiter-Dashboard soll sich vom "Datenanzeiger" zum **Deal-Cockpit** entwickeln: Jede Seite beantwortet die Frage *"Was ist jetzt die eine Aktion mit dem höchsten Einfluss auf meinen nächsten Placement?"* — gestützt auf die bereits vorhandenen KI-Signale.

---

## 2. Querschnitts-Findings (betreffen alle Seiten)

### 2.1 Status/Stage-Split-Brain (KRITISCH)
- `RecruiterSubmissions.tsx:34-40` matcht `s.status === key || s.stage === key` → Kandidat kann doppelt/gar nicht erscheinen.
- `SubmissionDetail.tsx:47-100` nutzt ein 8-Stufen-Modell (inkl. `interview_requested`, `candidate_opted_in`), das Kanban ein 7-Spalten-Modell ohne diese Stufen.
- Bereits im Godmode-Dokument als Reveal-Trigger-Bug notiert: Trigger horcht auf `status`, Frontend schreibt `stage` → Company-Reveal feuert nicht automatisch.
- **Fix-Richtung:** Ein kanonisches Stage-Modell in einer Datei/DB-Enum, `status` nur noch für Terminalzustände (active/rejected/withdrawn/hired), Migration + beide Seiten umstellen.

### 2.2 Geldfluss-UI ohne Geldfluss
- Kein Invoice/Checkout-Flow ⇒ `escrow_status` wird nie `held`→`released` (Godmode-Analyse, Critical #4).
- `RecruiterPayouts.tsx:103` zählt abgelaufene Escrow-Perioden client-seitig als "verfügbar", DB-Status bleibt aber `held` — Anzeige und Wahrheit divergieren.
- `PayoutRequestCard` importiert (`RecruiterPayouts.tsx:8`), nie gerendert → Recruiter kann Auszahlung nirgends anfordern.
- `RecruiterEarnings.tsx` lädt `platform_fee`/`total_fee`, zeigt sie nie an; kein Export (CSV/PDF) für Steuer.

### 2.3 Score-Fragmentierung
- Drei Match-Score-Quellen: `submissions.match_score` (SubmissionDetail), `candidate_behavior[0].confidence_score` (Kanban), `useMatchScoreV31` (Matching-Ansicht). Keine ist als autoritativ markiert.
- Zwei Influence-Engines (Cron `*/15` influence-engine vs. stündlich calculate-influence-score) mit unterschiedlichen Formeln → `RecruiterInfluence` kann widersprüchliche Scores zeigen.

### 2.4 Frontend-Architektur
- **Kein React Query** in Recruiter-Seiten: jede Seite eigenes useState/useEffect-Geflecht (RecruiterDashboard: 14+ useState), kein Caching, kein Refetch-on-Focus, inkonsistente Loading-States.
- **Realtime inkonsistent:** Submissions/Tasks/Alerts/Messages/Notifications haben Subscriptions, aber ausgerechnet das Dashboard (Jobs, Pipeline, Interviews) fetcht nur einmal beim Mount.
- **i18n = 0 %:** `grep useTranslation src/pages/recruiter/` → 0 Treffer. Alle 16 Seiten hartkodiert deutsch, teils deutsch/englisch gemischt ("Earnings & Payouts"-Header mit deutschem Subtitle, `RecruiterEarnings.tsx:174`).
- **Keine GlobalSearch für Recruiter:** `GlobalSearch.tsx:34-219` filtert hart auf `client_id` — Cmd+K ist für Recruiter tot.
- **Kein Mobile-Menü:** Sidebar `fixed … hidden md:block` (`DashboardLayout.tsx:146-187`), kein Hamburger — Recruiter-Dashboard ist mobil faktisch nicht navigierbar. JobPreviewPanel auf Mobile schlicht versteckt statt als Modal (`RecruiterJobs.tsx:749`).
- **Keine Error-States:** Muster überall: `loading ? Spinner : UI` — fehlgeschlagene Queries enden in stumm-leeren Widgets.

### 2.5 Toter Code (verifiziert per Import-Grep)
Verwaist (0 Referenzen außerhalb der eigenen Datei): `CommitmentUpdateDialog`, `EarningsKpiCards`, `JobCompactCard`, `JobGroupSection`, `MyActiveJobs`, `RiskReportDialog`, `SubmissionsPipeline`. Dazu `PayoutRequestCard` (importiert, nie gerendert) und leere Handler (`onAddToPool` → nur Toast, `onSubmitToJob={() => {}}`).

### 2.6 Triple-Blind: UI sauber, Fundament undicht
Die UI-Schicht ist diszipliniert (`formatAnonymousCompany`, `CompanyRevealBadge`, `getDisplayCompanyName` als zentraler Router), aber:
- RLS liefert `company_name`/PII trotzdem an den Browser (Godmode Critical #2) — die UI-Anonymisierung ist Kosmetik über einem undichten API-Layer.
- `JobDetail.tsx` ermittelt den Access-Status manuell aus Submissions (Z. 218-227) statt über eine zentrale RPC; `PartnerFactsCard` rendert Firmen-Facts, sobald Props da sind — Guard hängt am Aufrufer, nicht an der Komponente.
- `generate-job-expose` verlässt sich auf Prompt-Disziplin ("Firmenname darf nicht genannt werden") ohne serverseitigen Scrub des AI-Outputs.

---

## 3. Seiten-Steckbriefe

### 3.1 RecruiterDashboard (`/recruiter`, 1.107 Z.)

**Ist:** Bento-Grid 2×2 — Aufgaben (influence_alerts, max 5), Pipeline (4 Stages + gewichtete Earning-Prognose + 3 Interviews), Top-4-Jobs, KPI-Kacheln. Header mit dynamischem Greeting + 4 Kandidaten-Intake-Kanälen (Formular, CV, HubSpot, Inbound-E-Mail).

**Schwächen (Auswahl):**
- Alerts unsortiert nach Priorität (`slice(0,5)` auf created_at-Reihenfolge) — Dringendes kann unter dem Fold liegen; `impact_score` wird geladen, nie angezeigt.
- Pipeline-Prognose mit fixen Konversionsraten (10/20/40/75 %; Worst-Case nur „50 % der Offers") statt `candidate_behavior.closing_probability`.
- Kein Realtime: neue Jobs/Submissions/Interviews erscheinen erst nach F5; `fetchRevealedJobs` nur beim Mount → falsche Lock-Icons nach Reveal.
- N+1: fehlende Interview-Alerts werden im Loop einzeln geinsertet statt als Batch.
- Interview-Filter nur `status='scheduled'` — `pending_opt_in`-Interviews unsichtbar; Limit 3 ohne „+N weitere".
- Inbound-E-Mail-Adresse wird client-seitig aus der User-UUID generiert (Z. 557-561) statt serverseitig persistiert.
- `insert(insertData as never)` beim Kandidaten-Anlegen — Typ-Escape ohne Validierung.
- Logo-Fallback via externem ui-avatars.com.

**Godmode-Potenzial:**
- **Action-First-Umbau:** Aufgaben-Widget → priorisierte „Next Best Action"-Liste (Sortierung nach `priority` × `impact_score` × Deadline), mit Inline-Aktionen (Anrufen, E-Mail, Snooze) und Engagement-Signalen aus `candidate_behavior`.
- **KI-Pipeline-Prognose:** Erwartungswert pro Stage aus echten `closing_probability`-Werten, Top-Kandidat und Risiko-Flag (z.B. Gehalts-Mismatch) pro Stage.
- **Interview-Briefing:** pro anstehendem Interview Readiness/Engagement + 1-Satz-Insight aus `interview_intelligence`.
- **Momentum-Widget** (Gamification): Wochenvergleich Submissions→Interviews→Offers, Trust-Level-Fortschritt („2 Placements bis Gold").
- Realtime-Subscriptions auf jobs/submissions/interviews; ein konsolidierter Dashboard-RPC (oder Materialized View) statt 7+ Einzelqueries.

### 3.2 RecruiterJobs (`/recruiter/jobs`, 807 Z.)

**Ist:** Hero mit KPI-Strip, „Meine aktiven Jobs"-Scroller, Suche + 3 Dropdown-Filter, 5 Tabs (Alle/Dringend/Neu/Top/Enthüllt), 2-Spalten-Layout Feed + JobPreviewPanel, Aktivierung mit Trust-Level-Slots (ActivationConfirmDialog, SlotLimitDialog).

**Schwächen:**
- Keine Pagination/Virtualisierung (`select('*')` aller published Jobs); Submissions doppelt gefetcht (revealed + active).
- Empty-State erscheint auch während `loading`; kein Error-State.
- Preview-Panel auf Mobile versteckt statt Modal/Sheet.
- Match-Score des Recruiters zu den Jobs fehlt komplett auf der Liste — die wichtigste Sortier-Dimension („Wo habe ich passende Kandidaten?") existiert nicht.
- Dringende Jobs nur Badge, nicht gepinnt; Filter nicht speicherbar; keine Watchlist.

**Godmode-Potenzial:**
- **„Jobs für meine Kandidaten"**: Batch-Match (calculate-match-v3-1 existiert!) → pro Job „3 deiner Kandidaten passen ≥80 %" mit Quick-Submit.
- **Marktplatz-Transparenz:** Wettbewerbsdichte (X Recruiter aktiv, Submissions-Trend), erwartete Time-to-Fill, Fee-Ranking → Recruiter kann seine Zeit dort investieren, wo ROI am höchsten ist.
- Saved Searches + Job-Alerts („Neuer FinTech-Job ≥90k in München → Push").
- Aktivierungs-Flow: nach „Ich suche" sofort Kandidaten-Vorschläge aus eigenem Pool anzeigen statt nur Link.

### 3.3 JobDetail (`/recruiter/jobs/:id`, 568 Z.)

**Ist:** AI-Hero (headline/highlights aus `formatted_content`, Self-Healing-Autoformat), Candidate-Process-Cards, Quick Facts, 60/40-Layout (Pitch/Facts/Role/Skills links, FeeCalculator/SellingPoints/Stats rechts), CandidateSubmitForm-Dialog, AnonymousExposeDialog.

**Schwächen:**
- Autoformat-Race: fetch + Autoformat können parallel feuern (Z. 143-161); `isFormatting` wird gesetzt, aber nie angezeigt.
- Access-Status manuell abgeleitet statt zentraler RPC; `PartnerFactsCard` ohne eigenen Reveal-Guard.
- `submissions.match_score`/`stage` werden geladen, aber nicht angezeigt; `jobs.job_summary` (Benefits, AI-Insights) ungenutzt.
- Keine Pagination der Submissions; Sidebar nicht sticky; hartkodierte EN-Strings („Job not found", „Hot").

**Godmode-Potenzial:**
- **Kandidaten-Ranking im Job:** Eigene Kandidaten nach Match-Score sortiert mit „Einreichen"-CTA — der Job-Detail wird zum Submission-Launcher.
- **Reveal-Zentralisierung:** `get_recruiter_job_access_status(job_id)`-RPC + Audit-Log (Compliance & Triple-Blind-Vertrauen).
- Exposé-Sharing-Flow (anonymes Exposé direkt an Kandidat senden, Tracking ob geöffnet).
- Interview-Prozess-Transparenz: wo stehen meine Kandidaten, was ist der nächste Schritt des Clients.

### 3.4 RecruiterCandidates (`/recruiter/candidates`, 409 Z.)

**Ist:** 3 Ansichten (Cards/List/Table), StatsBar, Filter (Suche, Erfahrung, Gehalt, Verfügbarkeit, Tags, Sort), Bulk-Actions, 4 Dialoge (Formular, Tags, HubSpot, CV-Upload).

**Schwächen:**
- `onAddToPool` = Toast-Placeholder (Z. 320/337/352) → Talent-Pool-Zufuhr ist tot (der Pool verhungert).
- `activeJobs: 0` hartkodiert (Z. 113); Tag-Filter nur AND-Logik; CSV-Export ohne Tags/Status/CV.
- Submissions nachgelagert pro Kandidat geladen (Performance); keine Filter nach Submission-/Interview-Status.

**Godmode-Potenzial:**
- **Pool-Integration reparieren** (Quick Win #1) + „Beste offene Jobs je Kandidat" als Spalte (Match-V3-Batch).
- Kandidaten-Health: Engagement-Level, letzte Aktivität, „seit 14 Tagen kein Kontakt"-Flags.
- Bulk-Submission (mehrere Kandidaten auf einen Job), Excel-Export, gespeicherte Segmente.

### 3.5 RecruiterCandidateDetail (`/recruiter/candidates/:id`, 296 Z.)

**Ist:** HeroHeader (Readiness, Exposure-Ready), optional PlaybookPanel, 2-Spalten-MainContent (Matching, Skills, CV, Activities | Interviews, Dokumente, Tags), Sticky ActionBar, InterviewCardSlider.

**Schwächen:**
- `onSubmitToJob={() => {}}` (Z. 276) — Kern-Aktion leer.
- Readiness lokal berechnet statt aus der DB-View; `change_motivation`/`would_recommend` geladen, nie angezeigt; Exposé-`window.open` ohne Ready-Validierung.
- Kein Status-Workflow (new→contacted→…), kein DSGVO-Consent-Status sichtbar, keine Activity-Filter.

**Godmode-Potenzial:**
- **Ein-Klick-Vermarktung:** „Top-3-Jobs für diesen Kandidaten" mit Score-Breakdown + Submit-Flow direkt aus der Detailseite.
- Interview-Notizen als strukturierte Insights (Motivation, Empfehlung, Red Flags) statt verstecktem Rohtext.
- Consent/Compliance-Kachel (Opt-In-Historie, Datenfreigaben) — zahlt direkt auf Triple-Blind-Vertrauen ein.

### 3.6 RecruiterTalentPool (`/recruiter/talent-pool`, 19 Z. Wrapper → TalentPoolDashboard)

**Ist:** Stats (Silver Medalists, Pending Contact, Alerts), Match-Alerts, 5 Pool-Typ-Tabs, TalentPoolCards.

**Schwächen:** Zulauf kaputt (siehe 3.4); „Pending Contact" zählt nur Überfälliges; keine Suche/Bulk-Ops; kein Reason-Tracking (warum im Pool).

**Godmode-Potenzial:** **Reaktivierungs-Maschine** — neuer passender Job → Alert + „Quick Submit aus dem Pool"; Wiedervorlage-Cadence (30/60/90 Tage) mit Aufgaben-Integration in die Influence-Inbox; Silver-Medalist-Auto-Zufuhr bei Rejection mit Grund.

### 3.7 RecruiterSubmissions (`/recruiter/submissions`, 694 Z.)

**Ist:** Funnel-Grid (10 Stages mit Earning), Kanban (7 Spalten) + Listenansicht, Suche/Alert-/Status-Filter, ScoreBadges (confidence/readiness/closing), QuickActions (Phone/Email/Playbook), Playbook-Sheet + Viewer.

**Schwächen:**
- Status/Stage-Vermischung (s. 2.1) — Kernproblem der Seite.
- Kein Inline-Stage-Update, kein Drag & Drop; Alert-Badge zeigt nur Count statt Typ; `match_score` fehlt im Kanban; `engagement_level` geladen, nicht gezeigt.
- Alles ungepaginiert mit 5-fach-Nested-Select; Frontend-Filterung.
- `rejection_reason` unstrukturierter String; keine Bulk-Ops, kein Export.

**Godmode-Potenzial:**
- **Deal-Board statt Status-Board:** Drag & Drop mit serverseitiger Stage-Transition (inkl. Reveal-Trigger korrekt), pro Karte: Match-Score, Closing-Probability, Alter in Stage, „stalled"-Indikator (X Tage ohne Bewegung), Alert-Typ inline.
- Forecast-Leiste über dem Board: gewichteter Pipeline-Wert + Vergleich Vormonat.
- Stage-spezifische Aktionen direkt auf der Karte (Interview anfragen, Opt-In nachfassen, Angebot pushen).

### 3.8 SubmissionDetail (`/recruiter/submissions/:submissionId`, 839 Z.)

**Ist:** Header (Company revealed/anonym, Match, Kandidat), FullStagePipeline (8 Stufen), Opt-In-Banner, links Details/Notes/Alerts, rechts Interview-Card (Slots, Meeting-Link) + deduplizierte Timeline.

**Schwächen:**
- Eigenes Stage-Modell (s. 2.1); Timeline-Dedup über title+16-Zeichen-Timestamp (fragil); declined/cancelled Interviews fehlen in der Timeline.
- Notes als String-Konkatenation mit Timestamp-Prefix statt eigener Tabelle.
- Opt-In-Bestätigung schreibt nur `stage`, ohne `opted_in_at`/Methode; Alert-Erledigung ohne Outcome.
- `recommended_action` der Alerts nicht actionable; kein Slot-Update/kein neuer Interview-Request aus der UI; kein „Kandidat auch auf Job Y eingereicht"-Kontext.

**Godmode-Potenzial:**
- **Deal-Room:** eine Seite = kompletter Deal — strukturierte Notiz-Threads, Interview-Slot-Verwaltung (vorschlagen/umbuchen), Referenz-Checks starten/verfolgen (`reference_responses` existiert!), Gehalts-Delta Kandidat vs. Job mit Verhandlungs-Hinweisen, Follow-up-Reminder mit Influence-Inbox-Anbindung.
- Match-Score-Breakdown (Skills/Location/Salary/Seniorität) statt nackter Prozentzahl.

### 3.9 RecruiterEarnings (`/recruiter/earnings`, 334 Z.)

**Ist:** 4 KPI-Cards (Ausstehend/Bestätigt/Ausgezahlt/Gesamt), RecruiterMetricsSection (Performance vs. Plattform-Schnitt), Placements-Tabelle, statischer Info-Block.

**Schwächen:** `platform_fee`/`total_fee` geladen, nie gezeigt; kein Escrow-Bezug (Status, Countdown); DE/EN-Mix im Header; „monatlich zum 15." hartkodiert; kein Export, keine Filter, kein Zeitverlauf.

**Godmode-Potenzial:** **Umsatz-Cockpit** — Earnings-Chart über Zeit, Fee-Breakdown (Gesamt/Plattform/Ich), Escrow-Countdown je Placement, Forecast aus Pipeline (verzahnt mit 3.7), CSV/PDF-Export (Steuer), Ziel-Tracking („€50k-Jahresziel: 62 %").

### 3.10 RecruiterPayouts (`/recruiter/payouts`, 283 Z.)

**Ist:** 4 Stats (Ausstehend/In Escrow/Verfügbar/Ausgezahlt), StripeOnboarding, Placements-Tabelle mit EscrowStatusBadge.

**Schwächen:** Escrow-„verfügbar" nur client-seitig errechnet (Z. 103), DB-Status ändert sich nie; doppelte Wahrheit `payment_status` vs. `payout_requests.status`; **kein Auszahlungs-Button** (PayoutRequestCard nie gerendert); kein KYC-/Verification-Status; keine Transfer-Historie.

**Godmode-Potenzial:** Der eigentliche Fix ist Backend (Invoice-Flow, Escrow-Cron) — UI-seitig: „Jetzt anfordern"-CTA sobald released, Stripe-KYC-Statuskarte, Auszahlungs-Historie mit Transfer-IDs, klare Escrow-Zeitachse pro Placement. **Ohne Backend-Fix ist jede UI-Verbesserung hier Fassade — Reihenfolge beachten.**

### 3.11 RecruiterInfluence (`/recruiter/influence`, 425 Z.)

**Ist:** Score-Badge, Session-Start-CTA (geschätzte Minuten), Filter-Tabs, Urgent/Open-Tasks, Sidebar (PerformanceIntel, TeamLeaderboard, Erledigt-Counter), Playbook-Viewer, ActionSession + Summary, Shortcut Shift+S.

**Schwächen:** Hook-`error` ignoriert (Score-Widget stumm leer); `alerts_ignored` nie gezeigt; Session nicht persistent (Refresh = weg); 3 Min/Task hartkodiert; Shortcut undokumentiert; keine Undo/Bulk-Ops; dazu die Doppel-Engine (2.3).

**Godmode-Potenzial:** Stärkste Godmode-Basis der App — ausbauen zur **Coaching-Zentrale**: Score-Erklärung („Was hebt/senkt meinen Score"), personalisierte Empfehlungen aus Score-Deltas, Session-Persistenz (localStorage), Streaks/Wochenziele, Leaderboard mit Opt-In. Voraussetzung: eine Score-Engine abschalten.

### 3.12 RecruiterNotifications (`/recruiter/notifications`, 332 Z.)

**Ist:** Alle/Ungelesen-Tabs, Icon/Farbe je Typ, relative Zeit, Opt-In-Response-Dialog.

**Schwächen:** **Kein Realtime** (nur Mount-Fetch); Opt-In-Dialog erhält hartkodierte Platzhalter (`candidateName="Kandidat"`, `jobIndustry="Branche"` — Z. 319-329: Entscheidungen ohne Kontext!); `respondToOptIn` ohne Error-Handling/Loading; Submission-Links führen auf die generische Liste statt zum Deal; keine Pagination/Gruppierung/Typ-Filter.

**Godmode-Potenzial:** Realtime + Badge im Header live; Typ-Gruppierung (Heute/Gestern, nach Kategorie); Inline-Quick-Actions je Typ (Approve/Deny, Kalender, „Warum abgelehnt?"); Opt-In-Dialog mit echtem Deal-Kontext (Kandidat, Job, Match, Historie). Mittelfristig: mit der Influence-Inbox zu **einer** Aufgaben-Oberfläche konsolidieren — aktuell hat der Recruiter zwei konkurrierende To-do-Listen.

### 3.13 RecruiterMessages (`/recruiter/messages`, 376 Z.)

**Ist:** 3-Spalten-Messenger (Konversationsliste mit Suche, Nachrichtenbereich, Input).

**Schwächen:** Lädt ALLE Messages aller Konversationen, dann N+1-Profile-Fetches; `candidate_id`/`job_id` vorhanden, aber nie als Kontext gerendert; kein Edit/Delete/Attachments/Typing; Read-Status-Sync-Probleme bei mehreren Tabs.

**Godmode-Potenzial:** Deal-Kontext-Header („Konversation zu: Max M. → Senior Dev @ [FinTech | Series B]") mit Link in den Deal-Room; Realtime konsequent; Nachrichten-Templates (Opt-In-Nachfrage, Interview-Bestätigung) aus Playbooks; Datei-Anhänge (CV, Exposé).

### 3.14 RecruiterProfile (`/recruiter/profile`, 471 Z.)

**Ist:** Persönliche Daten, Firmendaten, Bank (IBAN/BIC), Dokumente (AGB/NDA/Vertrag-Akzeptanz), Quality-Scores, Verified-Badge.

**Schwächen:** `avgResponseTime: 2.4` hartkodierter Fake (Z. 113) und die Progress-Formel `100 - avg*10` ist semantisch sinnlos (Z. 444); Verified-Badge statisch; Dokument-Akzeptanz ohne Version/IP/Audit-Trail und ohne Links zu den Dokumenten; keine IBAN/BIC-Validierung; `avatar_url` im Interface, nie gerendert.

**Godmode-Potenzial:** Trust-Center: echte Response-Time aus `candidate_activity_log`, Verified-Kriterien transparent (Checkliste), Dokument-Versionierung, Avatar-Upload, öffentliches Recruiter-Profil (Trust-Level, Erfolgsquote) als Marktplatz-Signal Richtung Clients.

### 3.15 RecruiterIntegrations (`/recruiter/integrations`, 434 Z.)

**Ist:** E-Mail-Interview-Info, verbundene Integrationen (Status, LastSync, Fehler, Reconnect/Disconnect), verfügbare Provider, Auto-Sync-Toggles, API-Docs-Link.

**Schwächen:** **Auto-Sync-Toggles ohne onChange — reine Deko** (Z. 305/315); kein manueller Sync-Trigger, kein Verbindungstest, keine Sync-Historie; OAuth via Full-Redirect statt Popup; API-Key ohne Format-Validierung; „Neu verbinden" nur für OAuth, nicht für API-Key-Fehler.

**Godmode-Potenzial:** Toggles funktional machen (DB-persistiert), „Jetzt synchronisieren" + Fortschritt, Sync-Log (wann/wie viele Kontakte), Feld-Mapping-Editor, Verbindungstest-Button, Token-Ablauf-Warnung.

### 3.16 RecruiterDataPrivacy (`/recruiter/privacy`, 46 Z. Wrapper)

**Ist:** 3 Tabs (Einwilligungen, Datenexport, Konto löschen) — Logik in Kind-Komponenten.

**Schwächen:** Tab-State nicht in URL; keine Status-Übersicht laufender Anfragen; keine Bestätigungs-/Fristen-Anzeige.

**Godmode-Potenzial:** Klein halten — URL-Tabs, Request-Timeline („Export beantragt am …, Lieferung binnen 24h"), Lösch-Bedenkfrist-Countdown. (Verzahnt mit der offenen Legal-Checkliste.)

---

## 4. Priorisierte Roadmap

### P0 — Fundament (ohne das ist Godmode-UI Fassade)
| # | Maßnahme | Betroffen |
|---|---|---|
| P0.1 | **Stage-Modell vereinheitlichen** (kanonisches Enum, Migration, Kanban + Detail + Reveal-Trigger auf dieselbe Quelle) | 3.7, 3.8, Reveal-Flow |
| P0.2 | **Geldfluss real machen**: Invoice/Checkout-Flow + Escrow-Status-Cron; erst danach Payout-CTA in der UI | 3.9, 3.10 |
| P0.3 | **Eine Influence-Engine** (zweite abschalten), **eine Match-Score-Wahrheit** definieren | 3.7, 3.11, Dashboard |
| P0.4 | **Opt-In-Dialog mit echten Daten** statt „Kandidat"/„Branche"-Platzhaltern (kleiner Fix, große Entscheidungsqualität) | 3.12 |
| P0.5 | Reveal-Logik in zentrale RPC + Audit-Log (Triple-Blind-Konsistenz zur laufenden P0-Arbeit) | 3.2, 3.3 |

### P1 — Quick Wins (je ≤1 Tag, sofort spürbar)
- Talent-Pool-Zufuhr aktivieren (`onAddToPool` implementieren) + `onSubmitToJob` füllen.
- Alerts nach Priorität/Impact sortieren + `impact_score` visualisieren (Dashboard & Influence).
- `PayoutRequestCard` rendern bzw. bewusst entfernen; `platform_fee` in Earnings-Tabelle; CSV-Export Earnings.
- Realtime für Notifications + Dashboard-Kernwidgets; Notification-Links auf konkrete Deals.
- Auto-Sync-Toggles: implementieren oder entfernen (Deko-UI schadet Vertrauen).
- 7 verwaiste Komponenten löschen; `activeJobs`-Hardcode und `avgResponseTime`-Fake ersetzen oder ausblenden.
- Mobile: Hamburger-Menü + JobPreview als Sheet.

### P2 — Struktureller Ausbau (je 3–5 Tage)
- React Query flächendeckend (Caching, Refetch, konsistente Loading/Error-States).
- Kanban Drag & Drop mit serverseitigen Stage-Transitions + Forecast-Leiste.
- Interview-Management zentralisieren (Slots vorschlagen/umbuchen aus SubmissionDetail).
- Notes-Tabelle statt String-Konkatenation; strukturierte Rejection-Reasons.
- GlobalSearch für Recruiter (Jobs, Kandidaten, Deals); i18n-Migration der 16 Seiten.
- Pagination/Virtualisierung für Jobs/Submissions/Messages/Notifications.

### P3 — Godmode-Features (Differenzierung)
- **Next-Best-Action-Dashboard** (KI-priorisierte Aktionen mit Impact-Begründung).
- **Match-Marktplatz**: „Deine Kandidaten passen auf diese Jobs" beidseitig (Jobliste ↔ Kandidatenliste), Ein-Klick-Submission.
- **Deal-Room** (SubmissionDetail als vollwertige Deal-Zentrale inkl. Referenz-Checks, Gehalts-Delta, Follow-up-Automatik).
- **Talent-Pool-Reaktivierungs-Engine** (Cadence + Auto-Match-Alerts + Quick Submit).
- **Umsatz-Cockpit** mit Pipeline-Forecast und Zielen.
- **Coaching-Zentrale** (Score-Erklärbarkeit, personalisierte Playbook-Empfehlungen, Streaks).

---

## 5. Offene Entscheidungen

1. **Stage-Modell:** Ein Feld (`stage` kanonisch, `status` nur terminal) oder saubere Zwei-Feld-Semantik? (Empfehlung: ein kanonisches `stage`-Enum.)
2. **Aufgaben-Konsolidierung:** Influence-Inbox und Notifications zu einer Oberfläche verschmelzen oder getrennt lassen?
3. **Reihenfolge:** P0-Fundament zuerst (empfohlen) oder parallel P1-Quick-Wins für sichtbaren Fortschritt?
4. **i18n:** Jetzt mitziehen (teuer, 16 Seiten) oder bewusst auf Deutsch-only einfrieren bis nach dem Go-Live?
5. **Design-Angleich:** Recruiter-Seiten auf die Bento-/Zero-Training-Sprache des Client-Redesigns heben (eine Designsprache) oder eigenständig lassen?
