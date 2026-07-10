> Quelle: Godmode-Workflow "academy-scrum-master-plan" (20 Agenten, 1,21 Mio Tokens)
> Erstellt: 19. Juni 2026 · 13 Epics · 117 User Stories · 696 Story Points · 42 Sprints

# Matchunt Akademie — Godlevel Scrum-Master & Delivery-Plan

**Produkt:** Matchunt Akademie (Headhunter-Ausbildung) · **Rolle:** Lead Scrum Master / Delivery Lead · **Stand:** 2026-06-19 · **Branch:** `main`
**Moat:** Einzige „Free → Learn → Certify → Earn"-Maschine im DACH-Markt. Umsatz primär aus Marktplatz-Provision (5–15k EUR/Recruiter/Jahr), nicht aus der 2–5% Kurs-Conversion.

---

## 1. Produkt-Vision & Sprint-0-Ziel

### Vision
Die Akademie ist das Akquise- und Qualifizierungs-Vorderende des Matchunt-Marktplatzes: kostenloser Einstieg, getaktete Kohorten, ein server-autoritativ geprüfter Capstone als Gate, ein fälschungssicheres Zertifikat und ein **Admin-kontrollierter Andock-Funnel**, der Absolventen zu bezahlten Recruitern macht. Jede Architektur-Entscheidung dient zwei harten Mandaten: **(1) Server-Autorität** (Score/XP/Entitlement/Rolle nur via SECURITY-DEFINER-RPC/Edge-Fn) und **(2) Mandantentrennung** (Akademie-Signup vergibt NIE eine Plattform-Rolle).

### Sprint-0 / „Jetzt zuerst" — was als Nächstes passiert, um testbar zu werden
Das bereits gebaute Phase-0/1-Artefakt existiert nur auf der Platte. Es ist **nicht lauffähig**, weil die DB-Tabellen real fehlen. Sprint 0 (= Sprint 1 „E0 Fundament") macht das Gebaute produktiv und schließt die zwei P0-Sicherheitsfallen, **bevor irgendein Feature gebaut wird**:

| # | Aktion | Warum jetzt | Artefakt |
|---|--------|-------------|----------|
| 1 | **Migrationen anwenden** `20260616130000_academy_foundation.sql` (13.7 KB) + `20260616140000_academy_seed_content.sql` (22.8 KB) via Dashboard-SQL-Editor, zuerst Preview | Ohne Tabellen läuft das Frontend gegen fehlende Relationen → nichts ist testbar | E0-S1 |
| 2 | **Stripe-Webhook-P0 fixen** `supabase/functions/stripe-webhooks/index.ts` Z.26 `constructEvent` → `constructEventAsync`, Z.29 `JSON.parse(body)`-Fallback ersatzlos entfernen | **Bestätigter Live-Bug**: gefälschte Events werden ohne Secret akzeptiert; berührt Marktplatz-Geldfluss | E0-S3 |
| 3 | **types.ts regenerieren** + `as any`-Casts in `useAcademy.ts`/Admin entfernen | Schema-Drift soll als Compile-Fehler auffallen, nicht als Laufzeitcrash | E0-S2 |
| 4 | **RLS härten + Privilege-Escalation-pgTAP** (nested EXISTS → SECURITY-DEFINER-Helfer; Negativtest „academy-Signup schreibt keine `user_roles`-Zeile") | Geteiltes Backend = Blast Radius; Eskalations-Invariante muss vor Skalierung stehen | E9-S1, E9-S2, E9-S7 |
| 5 | **Admin-Test-Konto + EU-Secrets + DNS** `akademie.matchunt.de` + **End-to-End-Smoke-Test** inkl. Eskalations-Negativtest | Go-Live-Gate: ein interner Tester klickt Signup → Kurs → Lektion → Fortschritt | E0-S4/S5/S6/S7, E10-S3 |

**Sprint-0-Exit:** `SELECT count(*) FROM academy_courses` ≥ 2 published · `grep 'JSON.parse(body)'` = 0 Treffer · 0 `as any` in `src/academy/**` · pgTAP-Eskalationstest grün · akademie.matchunt.de liefert AcademyApp.

---

## 2. Epic-Übersicht

| Epic | Ziel (Kurzform) | Stories | Σ Points | Priorität |
|------|-----------------|:------:|:------:|-----------|
| **E0** | Go-Live-Fundament & Tech-Debt: Gebautes testbar & produktionsreif | 7 | 23 | **Must** |
| **E1** | LMS-Kern-Vertiefung: typisierte Blocks, immutable Versionen, a11y, Suche, RAG | 7 | 50 | Must/Should/Could |
| **E2** | Prüfung & Zertifikat: server-autoritative Bewertung, Mastery, Capstone, Open Badge | 7 | 44 | Must/Should |
| **E3** | Kohorten, Community & Coaching: Drip, Pods, Peer-Review, Clinics, Forum, Nudges | 7 | 52 | Must/Should/Could |
| **E4** | Gamification & Retention: XP-Ledger, Streaks, FSRS-SRS, Leaderboard, At-Risk-Outreach | 7 | 46 | Must/Should |
| **E5** | Freemium & Billing: Entitlements-Cache als RLS-Wahrheit, Stripe, VAT, Dunning, Widerruf | 8 | 39 | Must/Should |
| **E6** | Andocken: Absolvent → bezahlter Recruiter, server-autoritativ, kein Self-Service | 7 | 34 | Must/Should |
| **E7** | KI-Layer: Bedrock eu-central-1, RAG-Tutor, Quiz-Gen, Lernpfade, Guardrails, PII | 8 | 56 | Must/Should/Could |
| **E8** | Video-Pipeline (Bunny EU): Signed Playback, Upload, Webhook, Resume, Untertitel | 7 | 39 | Must/Should |
| **E9** | Security, RLS & DSGVO-Härtung: Helfer, Audit-Log, Export/Löschung, EU-Residenz | 8 | 44 | Must/Should |
| **E10** | Observability, Testing & CI/CD: pgTAP, Playwright, Vitest, Preview-Migration, Sentry | 7 | 39 | Must/Should/Could |
| **E11** | Content-Produktion & Akquise-Funnel: Hub, Newsletter, SEO, Challenge, Badge-Loop | 8 | 71 | Must/Should/Could |
| **E12** | Ergänzungen & Querschnitt: Onboarding, Cockpits, Recht/Consent, Deliverability, DR | 30 | 159 | Must/Should/Could |
| **Σ** | **13 Epics** | **117** | **696** | — |

> **Lesehilfe Priorität:** Die `Must`-Stories der Epics E0, E2, E5, E6, E9 plus die Legal/Consent/Deliverability/DR-Musts aus E12 bilden das harte Go-Live-Gate. Alles andere ist Skalierungs-/Tiefen-Arbeit.

---

## 3. Sprint-Plan (Sprint für Sprint)

**Kapazitäts-Annahme:** ~18 Points / 2-Wochen-Sprint (stabiles Team, geteiltes Backend zwingt Preview-Disziplin). 42 Sprints ≈ 84 Wochen. Jeder Sprint endet mit Demo auf **Preview**; ein Phasen-Gate wird erst auf realen Daten passiert.

| # | Name | Sprint-Ziel | Stories (ID — Titel) | Pts | Demo |
|---|------|-------------|----------------------|:--:|------|
| **1** | E0 Fundament | Migration/Typen/Webhook/EU härten | E0-S1 Migrationen anwenden · E0-S2 types.ts+Casts · E0-S3 Stripe-Webhook-P0 · E0-S4 Admin-Test-Konto · E0-S5 Env/Secrets · E9-S6 EU-Residenz-Invariante | 17 | Migrierte DB + unsignierter Webhook → 400 |
| **2** | Live + Tests | Subdomain live, E2E+Vitest+Preview | E0-S6 DNS · E0-S7 Smoke-Test · E10-S1 Vitest-Harness · E10-S5 Branch/Preview-Migration | 18 | akademie.matchunt.de: Signup→Kurs→Lektion→Fortschritt |
| **3** | Quiz + Mastery | Server-Grading + 80%-Hürde | E2-S1 answer_keys default-deny · E2-S2 grade-quiz Edge-Fn · E2-S3 Quiz-Player · E2-S4 Mastery/Retake | 23 | Manipulierter Client-Submit ändert Score nicht |
| **4** | Zertifikat | PDF + Verify | E2-S5 issue-certificate · E2-S6 Open Badge 3.0 + Verify-URL | 13 | Verify-URL bestätigt gültig / meldet revoked |
| **5** | Billing-Kern | Checkout + Entitlement-RLS | E5-S1 Tier/Entitlement-Schema · E5-S2 Pro-Checkout+Trial · E5-S3 Gehärteter Webhook+Idempotenz | 21 | Test-Checkout → Premium-Gate öffnet via Cache |
| **6** | Andocken | Recruiter-Freigabe server-autoritativ | E6-S1 Application-State-Machine · E6-S2 Eligibility-Gate · E6-S3 Bewerber-UI · E6-S5 process-application Edge-Fn | 21 | Nicht-Admin-Grant → 403 |
| **7** | Andock-Funnel | Cockpit/Attribution + pgTAP | E6-S4 Admin-Review-Queue · E6-S6 Provisions-Attribution · E6-S7 Akademie-Zugang-Kontinuität · E10-S2 pgTAP-RLS | 21 | answer_keys is_empty für authenticated |
| **8** | Blöcke | lesson_blocks + DnD-Editor | E1-S1 Typisierte lesson_blocks · E1-S2 Block-Editor DnD | 16 | Lektion rendert aus Blocks statt body-TEXT |
| **9** | Versionen | Immutable Snapshots + Editor | E1-S3 course_versions · E1-S7 Editor-Vorschau/Publish | 18 | UPDATE auf published Version → deny |
| **10** | A11y + Suche | Transkripte + Volltext | E1-S4 VTT/Transkripte · E1-S5 Volltextsuche (FTS) | 13 | Untertitel + Treffer-Deeplink |
| **11** | Capstone + XP | State-Machine + Ledger | E2-S7 Capstone-Review · E4-S1 XP-Ledger · E4-S2 Read-Modelle | 21 | UPDATE/DELETE auf xp_ledger → deny |
| **12** | Retention-UI | Streaks/XP/Sub-24h | E4-S3 Streak/XP/Level-UI · E4-S6 Week-1-Aktivierung · E12-S3 Sub-24h-Flow | 18 | Checkliste → first_success-Event |
| **13** | Kohorten | Drip + Pods | E3-S1 Kohorten-Drip/unlock_at · E3-S2 Pods 8–12 | 13 | Future-unlock_at-Bypass → deny |
| **14** | Peer-Review | State-Machine + Clinics | E3-S3 Peer-Review-Maschine · E3-S4 Live-Clinics | 18 | Self-Review/illegaler Sprung → deny |
| **15** | Forum | Realtime + Lektion-Diskurs | E3-S5 Forum Threads/Posts · E12-S7 Lektions-Diskussion | 13 | Cross-Pod-Read → 0 rows |
| **16** | SRS + Leaderboard | FSRS + ohne-PII | E4-S4 FSRS-SRS-Queue · E4-S5 Leaderboard ohne Leak | 21 | Leaderboard ohne E-Mail/user_id |
| **17** | Nudges | At-Risk-Outreach | E3-S6 FOMO-Nudges Queue · E4-S7 At-Risk-Outreach | 16 | Doppelversand bei Re-Run = 0 |
| **18** | Billing-Tiefe | Einmal/VAT/Portal | E5-S4 CMH/Bundle Einmalkauf · E5-S5 EU-VAT/Tax · E5-S6 Billing-Portal · E5-S7 Dunning | 16 | Reverse-Charge mit USt-IdNr |
| **19** | Billing-Recht | Widerruf/AZAV/B2B + Admin | E5-S8 14-Tage-Widerruf/AZAV/B2B · E3-S7 Kohorten-Admin-Cockpit | 13 | Widerruf entzieht Entitlement |
| **20** | RLS-Härtung | Helfer + Eskalations-pgTAP | E9-S1 SECURITY-DEFINER-Helfer · E9-S2 Eskalations-Invariante · E9-S7 Entitlement-RLS-Wahrheit | 18 | pg_policies: 0 nested EXISTS |
| **21** | Audit + Export | Audit-Log + DSGVO-Export | E9-S3 Append-only Audit-Log · E9-S4 Art.15/20-Export | 10 | Fremder Export per Manipulation → eigene Daten |
| **22** | Löschung + Gate | Art.17 + E2E-Security + Rate-Limit | E9-S5 Art.17-Löschung · E9-S8 E2E-Privilege/IDOR · E12-S29 Rate-Limit/2FA | 18 | IDOR auf fremde Enrollments → 0 rows |
| **23** | CI/CD + Sentry | Selektiv-Deploy + Sentry-EU | E10-S3 Playwright-E2E · E10-S4 Selektive CI/CD · E10-S6 Sentry-EU | 18 | PR deployt nur academy-* |
| **24** | KI-Fundament | Bedrock-EU + RAG + PII | E7-S1 Bedrock-Gateway/RAG · E7-S6 PII-Redaction fail-closed | 18 | Region≠eu-central-1 → fail-closed |
| **25** | KI-Guardrails | Eval-Gate + Tutor | E7-S5 Guardrails/Eval-Suite · E7-S2 RAG-Tutor mit Zitaten | 16 | Faithfulness <95% blockt Deploy |
| **26** | KI-Mehrwert | Quiz-Gen/Lernpfade/Kosten | E7-S3 Quiz-Generierung · E7-S4 Lernpfade · E7-S7 KI-Entitlements/Kosten · E7-S8 types-Regen | 21 | KI-Quiz bleibt draft bis Admin-Approval |
| **27** | Video-Fundament | Bunny-EU + Webhook | E8-S1 Video-Datenmodell/RLS · E8-S2 Upload-Workflow · E8-S3 Bunny-Webhook idempotent | 18 | Doppel-Webhook = No-Op |
| **28** | Playback | Signed + Resume + Watch | E8-S4 Signed Playback Token · E8-S5 Watch-Progress server-autoritativ | 13 | Abgelaufenes Token → kein Playback |
| **29** | Untertitel + Index | WCAG + RAG + EU-Gate | E8-S6 Transkripte/Untertitel · E8-S7 Observability/EU-Gate/Backfill · E1-S6 RAG-Indizierung | 16 | Roher iframe-Pfad deaktiviert |
| **30** | Shell + Account | Registry + Lifecycle | E12-S1 Route-Registry/Error-Boundary · E12-S2 Planning-Prompt · E12-S4 Account-Lifecycle · E12-S5 Empty-States | 16 | 404/Offline-State statt Spinner |
| **31** | Readiness + Cockpits | Score + Review/Content/Coach | E12-S6 Readiness-Score · E12-S8 Capstone-Cockpit · E12-S9 Authoring-Workflow · E12-S10 Coach-Verwaltung | 23 | Schritt X/7 bis Bewerbung |
| **32** | Geld + Support | Refund + Ticket | E12-S11 Refund/Connect-Reversal · E12-S12 Support-Inbox | 13 | Refund-Pfad inkl. Transfer-Reversal |
| **33** | Recht + Consent | Rechtstexte + Cookies + UWG + AVV | E12-S13 AGB/Widerruf/Datenschutz · E12-S14 Cookie-Consent · E12-S15 UWG-Outcome-Komponente · E12-S16 Subprozessor-Liste | 14 | Tracking erst nach Consent |
| **34** | Deliver + Mobile + i18n | Mail/Mobile/DE-EN | E12-S17 Deliverability SPF/DKIM/DMARC · E12-S18 Mobile/Cross-Browser-QA · E12-S19 i18n-Vollständigkeit | 15 | Suppression-List greift |
| **35** | Runbooks + DR | Rollback/Resilienz/DR | E12-S20 Migrations-/Rollback-Runbook · E12-S30 Resilienz/DR/Audit/Observability | 13 | Restore-Drill aus PITR erfolgreich |
| **36** | Content + Newsletter | Hub + Double-Opt-In | E11-S1 Content-Hub/Publishing · E11-S2 Newsletter Double-Opt-In | 16 | DOI bestätigt + One-Click-Unsubscribe |
| **37** | SEO | SSR + Sitemap + Schema | E11-S3 SEO-Programm „Ausbildung zum Headhunter" | 13 | Lighthouse-SEO ≥95, JSON-LD valide |
| **38** | Challenge + Attribution | 3-Tage + Funnel | E11-S4 3-Tage-Sourcing-Challenge · E11-S5 Funnel-Attribution-Dashboard | 21 | Day-2 gated bis unlock_at |
| **39** | Lern-Analytik | Nordstern + Kohorten-Cockpit | E12-S22 Funnel-Analytics-Pipeline · E12-S23 Kohorten-/Completion-Cockpit | 13 | 28-Tage-Completion + Drop-off-Heatmap |
| **40** | Badge + Flags | LinkedIn-Loop + Feature-Flags | E11-S6 LinkedIn-Badge-Loop · E10-S7 Feature-Flags | 11 | Add-to-LinkedIn + OG-Image |
| **41** | KI-Praxis | Sparring/Feedback/Pod-Match | E12-S25 KI-Sparring · E12-S26 KI-Artefakt-Feedback · E12-S27 KI-Pod-Matching | 18 | Rollenspiel-Feedback grounded |
| **42** | Lifecycle + Last + Marke | Win-Back/A-B/Last/Personenmarke | E12-S28 Win-Back · E12-S24 A/B-Framework · E12-S21 Lasttest · E11-S7 Personenmarke · E11-S8 Specialist-Tracks | 23 | Kohorten-Start-Lastszenario p95 |

> **Phasen-Mapping zu Sprints:** Phase 2 (Prüfung/Zertifikat) = S3–4 · Phase 4 (Billing) = S5,18,19 · Phase 5 (Andocken) = S6–7 · Phase 1-Vertiefung = S8–10 · Phase 3 (Community) = S13–17 · KI (E7) = S24–26 · Video (E8) = S27–29.

---

## 4. Release-Roadmap / Milestones

| Meilenstein | Ziel | Enthält (Schlüssel-Stories) | Exit-Kriterien (hart) | Zeit |
|-------------|------|----------------------------|------------------------|------|
| **M0 — Internes Testbar** | Gebautes real lauffähig, P0 geschlossen, RLS gehärtet | E0-S1..S7, E9-S1/S2/S6/S7, E10-S5, E10-S3 | • `count(*) academy_courses` ≥ 2 published, alle `academy_*` mit RLS · • `grep 'JSON.parse(body)'` = 0; unsignierter Webhook → 400 · • 0 `as any` in `src/academy/**`, `tsc` grün · • pgTAP: academy-Signup → 0 `user_roles`-Zeilen, academy-INSERT in `user_roles` throws · • Premium-Body ohne Entitlement per PostgREST leer/403 (nicht nur UI) · • akademie.matchunt.de liefert AcademyApp, Test-Mitglied klickt Kern-Flow fehlerfrei · • Migration zuerst auf Preview, kein Schema-Drift auf Plattform | **Woche 0–2** |
| **M1 — Moat-Kern** | Abschluss messbar, verifizierbar, nicht client-fälschbar | E1-S1/S2/S3/S7, E2-S1..S7, E10-S1/S2/S4 | • PostgREST-SELECT auf `academy_quiz_answer_keys` (authenticated) = 0 Zeilen · • grade-quiz server-seitig; gefälschtes `passed=true` ändert nichts · • bestandener Capstone → genau 1 Zertifikat (UNIQUE), Ed25519-signiert, **keine** `user_roles`-Zeile · • Verify-URL: gültig ohne PII / revoked korrekt · • ≥1 Kurs auf `lesson_blocks` + `course_version` migriert · • CI deployt nur geänderte `academy-*` | **Woche 3–7** |
| **M2 — Closed Beta** | 1 echte Kohorte, zahlend, mit Video & Billing | E5-S1..S6/S8, E3-S1..S7, E8-S1..S5, E9-S4/S5/S6, E10-S6/S8 | • Test-Checkout → `entitlements.active`; Gate öffnet nur via Cache (kein Live-Stripe im Request) · • selber `stripe_event_id` 2× → 1× verarbeitet · • Stripe Tax korrekt auf Session+Recurring; B2B-Reverse-Charge nur mit USt-IdNr · • ≥8 reale Teilnehmer in 1 Kohorte, Pods, materialisierte `unlock_at` · • ≥1 Bunny-Video nur signed; Completion server-seitig bei ≥90% · • DSGVO-Export/Löschung deckt Video/Push/Transkripte · • Playwright-E2E inkl. IDOR-Negativtest grün | **Woche 8–15** |
| **M3 — Public Launch DACH** | Wertkette geschlossen: Andocken, Retention, Akquise | E6-S1..S7, E4-S1..S7, E5-S7, E7-S1/S2/S6/S7, E1-S4/S5, E9-S3, E11-S1..S4/S6, E10-S7 | • Nur Zertifizierter kann bewerben (UI+Server) · • `process-application` grantet recruiter-Rolle nur bei `accepted` UND `has_role(admin)`; pgTAP+Playwright beweisen kein Self-Service · • ≥1 Absolvent real angedockt, via `academy_attribution` zugeordnet, behält Akademie-Zugang · • XP nur aus Ledger; Client-INSERT unmöglich; Farming via UNIQUE verhindert · • KI-Tutor nur grounded mit Zitaten + No-Coverage-Fallback; PII-Leak-Assertion fail-closed · • SEO-Landing indexierbar; Newsletter DOI-konform; Challenge → Premium-Funnel attribuiert | **Woche 16–28** |
| **M4 — Skalierung** | KI-Tiefe, Specialist-Tracks, Betriebshärte | E7-S3/S4/S5/S8, E1-S6, E11-S5/S7/S8, E8-S6/S7, E9-S8, E10-Partitionierung/PITR | • KI-Quiz nur draft → Admin-Review vor published · • Eval-Suite fail-closed in CI · • ≥1 Specialist-Track als eigener Funnel besetzt, 2. Track-Kohorte parallel · • Lernpfade per deterministischem Knowledge-Tracing (kein Art.-22-Verstoß) · • Seed-Videos mit korrigierten VTT; protokollierter Restore-Drill (RPO/RTO dokumentiert) · • Event-Tabellen RANGE-partitioniert; Eskalations-/IDOR-Tests grün bei mehreren parallelen Kohorten | **Woche 29+** |

---

## 5. Produkt-Backlog im Detail

> Format pro Story: **ID · Titel** — *As-a / I-want / so-that* · **AC** (verdichtet) · **Pts** · **MoSCoW** · **Deps** · **Tech**

### E0 — Go-Live-Fundament & Tech-Debt
**Goal:** Die fertig gebaute Akademie (Phase 0+1) ist auf akademie.matchunt.de produktiv erreichbar, E2E-smoke-getestet, mit angewandten Migrationen, getypten DB-Zugriffen, abgesichertem Stripe-Webhook und nutzbarem Admin-Test-Konto.

**E0-S1 · Akademie-Migrationen via Dashboard anwenden** — *Betreiber will die zwei Migrationen idempotent in die geteilte DB einspielen, damit Tabellen/RLS/Seed real existieren.* · **AC:** Foundation erzeugt `academy_profiles/courses/modules/lessons/enrollments/lesson_progress` mit RLS + partiellem Index ohne Fehler; Seed = genau 2 Kurse / 24 Lektionen; Wiederholung erzeugt keine Duplikate (IF NOT EXISTS / ON CONFLICT); `app_role/user_roles/handle_new_user` unverändert (Blast-Radius 0); Versionsstempel im Run-Log dokumentiert. · **3 · Must · Deps —** · **Tech:** Idempotenz härten; Reihenfolge 130000→140000; gegen Preview, dann Prod; `\d`/`pg_policies` verifizieren; `schema_migrations` manuell eintragen.

**E0-S2 · types.ts regenerieren & as-any entfernen** — *Entwickler will echte Typen, damit Schema-Drift Compile-Fehler wird.* · **AC:** `Database`-Interface enthält alle `academy_*`; grep `as any` im academy-Code = 0; `tsc --noEmit`/`vite build` grün; Spalten-Rename bricht Build mit klarem Typfehler. · **3 · Must · Deps E0-S1** · **Tech:** `supabase gen types` gegen Projekt-Ref → `src/integrations/supabase/types.ts`; Casts in `useAcademy.ts`+Admin entfernen; `tsc --noEmit` als CI-Gate.

**E0-S3 · Stripe-Webhook P0** — *Sicherheitsverantwortlicher will JSON.parse-Fallback weg + Deno-kompatible async-Verifikation.* · **AC:** kein `JSON.parse(body)`-Fallback, ungültige/fehlende Signatur → 400; `constructEventAsync` (SubtleCrypto) statt sync; gültiges Testevent → 200; manipulierter Body mit Altsignatur → abgelehnt; fehlendes `STRIPE_WEBHOOK_SECRET` → fail-closed. · **5 · Must · Deps —** · **Tech:** `await constructEventAsync`; Fallback ersatzlos entfernen; `event.id`-Dedupe vorbereiten; signierter Payload-Unit-Test; selektiver Deploy nur dieser Function. *(Bestätigt: index.ts Z.26 sync + Z.29 Fallback.)*

**E0-S4 · Admin-Test-Konto + Akademie-Test-Mitglied** — *QA will reproduzierbare Konten mit dokumentierten Credentials.* · **AC:** Admin-User mit admin-Rolle in `user_roles` + Zugriff `/admin/academy`; Test-Mitglied via academy-Signup hat `academy_profiles` plan='free' und KEINE `user_roles`-Zeile; Credentials außerhalb Repo (Secrets-Manager); Admin kann Kurs/Lektion editieren. · **2 · Must · Deps E0-S1** · **Tech:** Admin via Dashboard + SECURITY-DEFINER-konforme INSERT (kein Self-Service); Negativtest academy-User; 1Password/Notiz.

**E0-S5 · Env/Secrets konfigurieren** — *DevOps will alle Edge-/Frontend-Secrets (insb. STRIPE_WEBHOOK_SECRET) für Staging+Prod.* · **AC:** Webhook-Secret in beiden Umgebungen = Dashboard-Endpoint; `VITE_SUPABASE_*` korrekt (keine Hardcodes); Secrets-Inventar dokumentiert (ohne Werte im Repo); fehlendes kritisches Secret → fail-closed. · **2 · Must · Deps E0-S3** · **Tech:** Stripe-Endpoint registrieren, Signing-Secret setzen; Frontend-Env prüfen; Inventar pflegen; Sentry-EU-DSN vorbereiten.

**E0-S6 · DNS akademie.matchunt.de** — *Betreiber will Subdomain auf Build-Artefakt + TLS.* · **AC:** Subdomain liefert AcademyApp (nicht Hauptapp); gültiges TLS; app/matchunt.de unverändert; SPA-Deeplink → Rewrite auf index.html (kein 404). · **3 · Should · Deps —** · **Tech:** CNAME/ALIAS; Auto-Cert/ACME; SPA-Rewrite; `isAcademyHost()` in `src/main.tsx` gegen realen Hostnamen.

**E0-S7 · End-to-End Smoke-Test Kern-Flow** — *QA will Signup→Katalog→Detail→Lektion→Fortschritt→Premium-Gate reproduzierbar.* · **AC:** frischer Account landet im Dashboard ohne Plattform-Rolle; Lektion via `completeLesson` → `progress_pct` server steigt, persistiert nach Reload; Free→Premium-Gate greift; Admin-Editor-Änderung im Frontend sichtbar; Playwright enthält Privilege-Escalation-Negativtest, grün. · **5 · Must · Deps E0-S1/S2/S4/S6** · **Tech:** Playwright-Skript; server-autoritativ verifizieren; Negativtest academy-Token; Staging→Prod-Lauf; Go-Live-Gate-Report.

### E1 — LMS-Kern-Vertiefung
**Goal:** Strukturierte, versionierte, barrierefreie, durchsuchbare Inhalte statt freier TEXT-Bodies, mit immutable Snapshots als Single Source of Truth.

**E1-S1 · Typisierte lesson_blocks statt body TEXT** — *Autor will typisierte Blöcke.* · **AC:** `academy_lesson_blocks` (FK CASCADE, block_type CHECK, content JSONB, sort_order); Alt-body als 1 richtext-Block backfilled (body deprecated, nicht gelöscht); ungültiger block_type → CHECK-Fail; zod-Validierung je Typ vorm Persist; anon liest unveröffentlichte Blocks → RLS-deny; Renderer-Registry nach sort_order (kein `dangerouslySetInnerHTML`); image/video ohne alt → Editor-Block. · **8 · Must · Deps E0** · **Tech:** Migration + CHECK + Index + RLS via `academy_lesson_is_published`; Backfill; types-Regen; `lessonBlocks.ts` zod; `blocks/`-Registry; Player umstellen.

**E1-S2 · Block-Editor mit DnD-Reorder** — *Autor will Blöcke/Module/Lektionen per DnD ordnen.* · **AC:** Reorder via RPC `academy_reorder_blocks(lesson_id, ordered_ids[])` lücken-/kollisionsfrei (0..n), admin-only; typspezifischer Editor + zod; gleiche Mechanik für Module/Lektionen; Teil-Fehler → alte Reihenfolge bleibt (Transaktion); Löschen renummeriert. · **8 · Must · Deps E1-S1** · **Tech:** RPCs SECURITY DEFINER admin-guarded; `@dnd-kit/sortable`; BlockEditor je Typ (tiptap, ImageUpload→Storage); Optimistic+Rollback; Bucket `academy-content`.

**E1-S3 · Immutable course_versions** — *Betreiber will Snapshot beim Publish.* · **AC:** `academy_publish_course_version` erzeugt immutablen Snapshot (version_no monoton, snapshot JSONB), markiert current; UPDATE/DELETE auf published → verhindert (append-only); Lerner bedient current-Version (enrollment pinnt `course_version_id`); Republish → version_no+1; Diff-Ansicht; keine current → nicht belegbar. · **13 · Must · Deps E1-S1/S2** · **Tech:** Migration append-only + `enrollments.course_version_id` + Trigger; Publish-RPC atomar; useAcademyCourse liest current; Diff-Viewer; Enroll setzt Version.

**E1-S4 · Video-Transkripte & VTT (BFSG)** — *Lerner will Untertitel + Transkript.* · **AC:** Player bietet VTT-Spur + aufklappbares Transkript; Admin-Upload → `academy-transcribe` erzeugt VTT/plaintext in `academy_transcripts`; Sprachumschaltung (de Pflicht); Korrektur → Suchindex/RAG stale; Untertitel tastaturbedienbar (axe-core sauber); fehlendes Transkript → sichtbarer Hinweis. · **8 · Should · Deps E1-S1** · **Tech:** Migration + RLS; Bunny EU Captions / `academy-transcribe` (Idempotenz+Queue); `<track>`-Renderer; Transkript-Editor; axe-core-Test.

**E1-S5 · Volltextsuche über Kursinhalte** — *Lerner will Stichwortsuche mit Sprung zur Trefferstelle.* · **AC:** `academy_search(q)` FTS (config german) mit Rang+Snippet (ts_headline); Klick → Lektion/Block-Anchor bzw. Transkript-Zeitstempel; nur published current für Nicht-Berechtigte; Trigger pflegt `search_vector`; leere Anfrage → Hinweis; GIN-Index unter NFR-Budget. · **5 · Should · Deps E1-S1/S4** · **Tech:** generierte tsvector + GIN; Search-RPC RLS-bewusst; `AcademySearch.tsx`; Deep-Link-Routing.

**E1-S6 · RAG-Indizierung (pgvector)** — *Plattform will Chunks embedden mit PII-Redaction.* · **AC:** Block/Transkript-Änderung → `academy_embedding_queue`; Worker `academy-embed` chunked + redigiert (`pii-redaction.ts`) + schreibt `academy_content_chunks` (vector, model); semantische Suche via HNSW top-k mit Quelle; nicht-current → Chunks inaktiv; Modell+Dimension festgehalten. · **8 · Could · Deps E1-S3/S4** · **Tech:** Migration vector+HNSW+Queue; `academy-embed` (Chunking+Redaction+Bedrock); Enqueue-Trigger; `academy_semantic_search`; pg_cron nur Taktgeber.

**E1-S7 · Editor-Vorschau & Draft/Publish-Status** — *Autor will Live-Vorschau wie im Lerner-Player + Statusfluss.* · **AC:** Vorschau nutzt dieselbe Renderer-Registry; Badge „Unveröffentlichte Änderungen" + betroffene Lektionen; unvollständiger Block blockt Publish mit Fehlerliste; published=false → nicht im Katalog; ungespeicherte Änderungen → Warn-Dialog. · **5 · Should · Deps E1-S1/S3** · **Tech:** Shared Renderer; Diff-Indikator; Publish-Validierungs-Hook (zod+alt-Text); `useBlocker`/Prompt.

### E2 — Prüfung & Zertifikat
**Goal:** Kompetenznachweis über server-autoritative Quizze, 80%-Mastery, begutachtetes Capstone, verifizierbares fälschungssicheres Zertifikat (PDF + Open Badge 3.0) als Andock-Gate.

**E2-S1 · Frage-Bank & default-deny answer_keys** — *Architekt will Lösungen in client-gesperrter Tabelle.* · **AC:** `academy_question_keys` per anon/authenticated → 0 Zeilen (default-deny); `quiz_questions` ohne correct_index/Erklärung; Schema mit FKs/CHECK/Indizes; eigene Attempts nur `user_id=auth.uid()`; Admin Vollzugriff; `passing_score` CHECK 0..100 Default 80. · **5 · Must · Deps E0** · **Tech:** Migration `academy_assessment.sql`; default-deny RLS auf keys; attempts/answers ohne Client-INSERT/UPDATE; Indizes; pgTAP-Negativtests.

**E2-S2 · academy-grade-quiz Edge-Fn** — *Studierende will server-autoritative Bewertung.* · **AC:** vergleicht gegen keys (Service-Role), schreibt score/passed/is_correct; Response ohne korrekte Option-IDs falscher Fragen; ohne JWT/fremde user_id → 401/403, kein Write; idempotent bei gegradetem attemptId; multi exakt-Set sonst false; passed bei ≥passing_score → Mastery anstoßen. · **8 · Must · Deps E2-S1** · **Tech:** Deno + Service-Role; JWT-User (nie aus Body); RPC `academy_record_quiz_grade` atomar; Response-Shaping; Hook `gradeQuiz()`; selektiver Deploy.

**E2-S3 · Quiz-Player UI mit Attempt-Lifecycle** — *Studierende will Quiz starten/absenden/Ergebnis.* · **AC:** content_type='quiz' → Attempt (in_progress) + Fragen ohne Lösungen; Absenden → grade-quiz + Lade-/Disabled; Ergebnis: Score%, Pass/Fail, je Frage; Nichtbestehen → „Erneut versuchen"; passed → Progress aktualisiert; Netzfehler → Attempt bleibt, kein Doppel-Score. · **5 · Must · Deps E2-S2** · **Tech:** `QuizPlayer.tsx`; Branch im Lesson-Player; Hooks `useQuiz/startAttempt/gradeQuiz`; State-Maschine; i18n; bei passed `recomputeCourseProgress`.

**E2-S4 · Mastery: Retakes mit 80% & Cooldown** — *Studierende will beliebig oft, ab 80% gemeistert.* · **AC:** bester ≥passing_score → mastered bleibt; Retakes unbegrenzt, attempt_no server-inkrementiert; Cooldown (Default 0, parametrisierbar) erzwungen; `academy_quiz_mastery` server-autoritativ; alle Pflicht-Quizze gemeistert → Zertifikats-Eligibility. · **5 · Must · Deps E2-S2** · **Tech:** `academy_quiz_mastery`-Read-Modell; grade-RPC upsert best_score; Cooldown-Guard; `academy_course_certificate_eligible`; Mastery-Badge.

**E2-S5 · Zertifikat-Ausstellung (PDF)** — *Absolvent will PDF mit eindeutiger Nummer.* · **AC:** Eligibility=true → genau 1 `academy_certificate` (unique number), PDF in Storage; nicht eligible → 403 not_eligible; idempotent pro (user,course,version); PDF mit Name/Kurs/Datum/Nummer/Verify-QR/Hash; pdf_url via Signed-URL (kein offener Bucket). · **8 · Must · Deps E2-S4** · **Tech:** `academy_certificates`; Edge-Fn pdf-lib, Eligibility re-checken, MCH-YYYY-seq; privater Bucket+Signed-URL; UNIQUE+ON CONFLICT; payload_hash SHA-256; Cert-Seite.

**E2-S6 · Open Badge 3.0 / VC + Verify-URL** — *Dritte will maschinell+manuell verifizieren.* · **AC:** `/verify/<id>` zeigt gültig/ungültig/revoked + Name/Kurs/Datum ohne Login; revoked → klar; OB3.0/W3C-VC-JSON (issuer/credentialSubject/proof); gefälschte Nummer → invalid; PDF-QR → Verify-URL. · **5 · Should · Deps E2-S5** · **Tech:** `academy-verify-certificate` (public read-only); Ed25519-Issuer-Key; `AcademyVerify.tsx`; QR; `.well-known/issuer`-Metadaten.

**E2-S7 · Capstone & Peer/Mentor-Review** — *Studierende will Capstone-Bewertung.* · **AC:** Einreichung → `submitted`, für Reviewer sichtbar; State-Machine submitted→under_review→(revisions/passed/rejected) mit Begründung; revisions→neu→Version+1, submitted (Audit-Trail); passed = Pflichtkriterium Eligibility; fremde Einreichung → RLS-deny (kein IDOR); ungültiger Übergang → Server-deny. · **8 · Should · Deps E2-S5** · **Tech:** `academy_capstone_submissions/_reviews` (Audit); RLS Autor/Reviewer/Admin; RPC `academy_capstone_transition` Whitelist; Reviewer-UI; Student-UI; Eligibility erweitern; privater Bucket.

### E3 — Kohorten, Community & Coaching
**Goal:** Getaktete Kohorten mit Pods, Peer-Review, Live-Clinics und Forum → 70–90% Completion und bindungsstarke Führung zum Andocken.

**E3-S1 · Kohorten-Drip + materialisierte Termine** — *Lerner will datierte Kohorte mit Zeitplan.* · **AC:** Beitritt → `unlock_at`/`deadline_at` je Lektion server-materialisiert in `cohort_members/_schedule`; Future-`unlock_at` → RLS/RPC-deny + „Schaltet frei am"; bei Erreichen ohne Deploy lesbar; `start_date`-Änderung → RPC rematerialisiert; fremde `cohort_members` → 0 rows. · **8 · Must · Deps E1** · **Tech:** Migration cohorts/members/schedule; RPC `academy_join_cohort`+`recompute_cohort_schedule`; Helfer `academy_lesson_unlocked`; Hook+Gate; pgTAP.

**E3-S2 · Pods (8–12)** — *Mitglied will feste Lerngruppe.* · **AC:** Zuteilung 8–12, kein Pod <6/>12; Pseudonym+Fortschritt sichtbar, keine PII; Cross-Pod → 0 rows; Nachzügler in Restkapazität (idempotent); Admin-Button. · **5 · Must · Deps E3-S1** · **Tech:** `academy_pods/_pod_members`; RPC `academy_assign_pods` Greedy/Balanced; Helfer `academy_user_pod`; PodCard; pgTAP.

**E3-S3 · Peer-Review State-Machine** — *Lerner will Peer-Feedback.* · **AC:** Einreichung → 2–3 Pod-Peers, submitted→in_review; Reviewer-Feedback nur in_review→reviewed; letzter Review → Aggregat append-only (Client setzt nichts); kein Self-Review/Client-Status; >X Tage → Reminder; Cross-Pod → keine Zeile. · **13 · Must · Deps E3-S2** · **Tech:** submissions/review_assignments/feedback append-only; RPCs `submit/assign/finalize`; `academy_assert_transition`; RLS Pod-Scope; UI; pgTAP.

**E3-S4 · Live-Clinics** — *Mitglied will Anmeldung+Link.* · **AC:** Kapazität K erreicht → atomar Warteliste (kein Race); Link erst <60min sichtbar; freier Slot → Warteliste rückt nach+Benachrichtigung; nicht-Kohorte → deny; Admin-Anlage im Kalender (Europe/Berlin). · **5 · Should · Deps E3-S1** · **Tech:** `academy_sessions/_session_signups`; RPC signup/cancel mit advisory lock; Link via View/RPC; SessionCalendar; Clinic-Editor.

**E3-S5 · Forum** — *Mitglied will Threads/Posts mit Scope.* · **AC:** Thread in erlaubter Kategorie, author_id gesetzt (kein Spoofing); pod-scoped extern → 0 rows; neuer Post near-realtime; eigene Posts editier-/löschbar, fremde nicht; Admin pin/hide. · **8 · Should · Deps E3-S1/S2** · **Tech:** threads/posts + RLS Scope-Helfer; Realtime auf posts; ForumList/ThreadView; pgTAP Spoofing.

**E3-S6 · FOMO-Nudges via Queue+Worker** — *Lerner will Reminder.* · **AC:** Cron schreibt nur Queue (keine Side-Effects); Worker sendet+markiert processed (idempotent); Pod-Vorsprung → sozialer FOMO-Nudge; Opt-out respektiert; Fehler → Backoff, nach M Versuchen failed. · **8 · Should · Deps E3-S1/S3/S4** · **Tech:** `notification_queue/_prefs`; pg_cron `enqueue_nudges` (UNIQUE); `academy-process-notifications` (Backoff); FOMO-Berechnung; Opt-out-UI.

**E3-S7 · Kohorten-Admin-Cockpit** — *Admin will Kohorten steuern+überwachen.* · **AC:** Anlegen mit start_date/Kapazität/Drip/Status; Cockpit zeigt Fortschritt/überfällige/Reviews/Clinics aus Read-Modellen; Nicht-Admin → 403; Pod-Zuteilung/Recompute mit Erfolg/Fehler; completed → Alumni-Zugang bleibt. · **5 · Could · Deps E3-S1/S2/S4** · **Tech:** Cohorts-UI+CohortCockpit; View/RPC `academy_cohort_progress`; has_role-Guards; Playwright-Negativtest.

### E4 — Gamification & Retention-Engine
**Goal:** Server-autoritative Streaks/XP/Level/Leaderboard, FSRS-SRS, garantierter Sub-24h-Ersterfolg und At-Risk-Outreach → messbare Bindung.

**E4-S1 · Append-only XP/Event-Ledger** — *Plattform will manipulationssichere Wahrheit.* · **AC:** Abschluss → genau 1 `academy_xp_ledger`-Zeile (user/event/points/source/idempotency_key); Doppelmeldung mit gleichem key → 1 Zeile (UNIQUE); Nicht-Admin INSERT/UPDATE/DELETE → deny (nur SELECT eigener); UPDATE/DELETE → append-only-Fehler; Regeländerung gilt nur künftig. · **8 · Must · Deps E1** · **Tech:** Migration ledger + UNIQUE(user,key); `academy_xp_rules`; RPC `award_xp` ON CONFLICT DO NOTHING; RLS; Trigger; `completeLesson` → RPC; Index.

**E4-S2 · Read-Modelle XP/Level/Streak** — *Frontend will schnelle Reads.* · **AC:** `academy_user_stats` = SUM(points)/level/xp_to_next konsistent; After-Insert-Trigger aktualisiert in selber Transaktion; Streak +1/Tag (Europe/Berlin), Lücke >1 → reset, longest bleibt; `recompute_user_stats` idempotent; nur eigene Zeile lesbar. · **5 · Must · Deps E4-S1** · **Tech:** `academy_user_stats`; `level_for_xp` + thresholds; `recompute_user_stats`; Trigger; `useAcademyStats`; pgTAP Streak.

**E4-S3 · Streak/XP/Level-UI** — *Lerner will sofortiges Feedback.* · **AC:** Dashboard zeigt Streak/Level/XP-Balken; Abschluss → XP-Toast + optimistic Update; Hinweis „heute aktiv bleiben"; Level-Up einmalige Feier; Lade/Fehler → Skeleton/nicht-blockierend. · **5 · Must · Deps E4-S2** · **Tech:** StreakBadge/XpProgressBar/LevelBadge; Stats-Header; Toast+setQueryData; Level-Up-Detektion; i18n.

**E4-S4 · Spaced Repetition (FSRS)** — *Lerner will gezielte Wiederholung.* · **AC:** Lektion-Abschluss → `academy_srs_cards` Initialzustand; `get_due_reviews` nur due_at≤now, ohne Klartext-Lösung; `submit_review` (again/hard/good/easy) berechnet FSRS-State + append-only log; client kann due_at/State nicht setzen; korrekte Antwort → `award_xp('srs_review')` idempotent. · **13 · Should · Deps E4-S1, E2** · **Tech:** srs_cards/review_log; review_cards default-deny; `fsrs_next_state` plpgsql; RPCs get_due/submit; seed-Trigger; ReviewSession+`/review`; pgTAP Monotonie.

**E4-S5 · Kohorten-Leaderboard ohne Leak** — *Lerner will Rangliste.* · **AC:** Rang/Anzeigename/Perioden-XP absteigend, eigene Zeile hervorgehoben; keine Kohorte → globales/leeres Board; nur display_name+XP+rank, keine E-Mail/user_id; Opt-out respektiert; aus periodischem Snapshot (nicht Live-Aggregation). · **8 · Should · Deps E4-S1/S2, E3** · **Tech:** `leaderboard_snapshot`; `get_cohort_leaderboard` (nur display_name+xp+rank); `leaderboard_opt_in`; pg_cron refresh; pgTAP Leak/Opt-out.

**E4-S6 · Sub-24h-Ersterfolg & Week-1-Tracking** — *Produkt will instrumentierten Quick-Win.* · **AC:** erste Quick-Win-Lektion → `first_success`-Event + Badge/XP; kein first_success in 24h → `at_risk_day1`; Onboarding-Checkliste mit 3 Schritten (erster <5min); Meilensteine als Flags; Admin sieht aggregierte Week-1-Rate. · **5 · Must · Deps E4-S1/S2** · **Tech:** `academy_activation_state`; `is_quickwin`-Flag; Trigger first_lesson/first_success + award_xp; OnboardingChecklist; Admin-Kachel; KPI-Doku.

**E4-S7 · At-Risk-Outreach via Queue** — *Retention-System will reaktivieren.* · **AC:** >N Tage inaktiv/day1-at-risk → genau 1 Queue-Eintrag (idempotent/Tag); Worker sendet DE-Template, status=sent; Opt-out hart respektiert; Fehler → Backoff, Max-Retries → failed; wieder aktiv vor Versand → skipped (Re-Check); jede Mail mit Abmeldelink + append-only Log. · **8 · Should · Deps E4-S2/S6** · **Tech:** `outreach_queue/_log` + UNIQUE; `email_opt_in`+token; `enqueue_at_risk_outreach`; pg_cron→`academy-outreach-worker`; DE-Templates; selektiver Deploy.

### E5 — Freemium & Billing
**Goal:** Rechtssichere Anmeldung für jedes Tier; server-autoritativer Entitlements-Cache steuert über RLS jeden Inhaltszugriff.

**E5-S1 · Tier-Katalog & Entitlements-Schema** — *Architekt will Single Source of Truth.* · **AC:** `academy_products` mit allen Tiers (stripe_price_id/interval/price_cents/eur/tax_behavior); `academy_entitlements` (product_key/status/valid_until/source), nicht client-beschreibbar (default-deny INSERT/UPDATE); Schreiben nur via SECURITY-DEFINER + append-only `entitlement_events`; Helfer `academy_has_entitlement` ersetzt EXISTS + Index; altes `plan` → denormalisierter Read-Cache. · **8 · Must · Deps E0** · **Tech:** `academy_billing_foundation.sql`; Helfer+`academy_active_tier`; default-deny RLS; Trigger→plan; Indizes; types-Regen.

**E5-S2 · Stripe Checkout Pro + 14-Tage-Trial** — *Free-Nutzer will Pro buchen.* · **AC:** Upgrade → `academy-create-checkout` (mode=subscription) korrekte price_id + Redirect; Customer get-or-create idempotent; Trial → trialing, valid_until=trial_end, Premium nutzbar; Rückkehr → aktiver Status aus Cache; account_type≠academy → abgewiesen. · **5 · Must · Deps E5-S1** · **Tech:** `academy-create-checkout` (JWT+account_type-Check); `stripe_customer_id`; UpgradeProDialog+Toggle; Success/Cancel-Routen; Preis-IDs in DB.

**E5-S3 · Gehärteter Akademie-Webhook + Idempotenz** — *Betreiber will Entitlement-Sync.* · **AC:** fehlende/ungültige Signatur → 400, kein JSON.parse-Fallback; `constructEventAsync`; gleiches Event 2× → Unique auf `stripe_event_id` verhindert Doppel; subscription.*/invoice.* → Status via RPC + Ledger; unbekannter Typ → 200 ohne Effekt; selektiver Deploy. · **8 · Must · Deps E5-S1/S2** · **Tech:** `academy-stripe-webhook` (getrennt); `ACADEMY_STRIPE_WEBHOOK_SECRET` fail-closed; `academy_webhook_events` UNIQUE; RPC `academy_apply_subscription_state`; Handler; Endpoint registrieren.

**E5-S4 · Einmalkäufe CMH (590) & Bundle (990)** — *Lerner will dauerhafte Berechtigung.* · **AC:** CMH (mode=payment) → dauerhafte Entitlement (valid_until=null) via Webhook; Bundle → alle product_keys im selben Ledger-Batch; idempotent bei Retry; CMH-Berechtigung am Prüfungs-Gate sichtbar, stellt Zertifikat nicht automatisch aus. · **5 · Should · Deps E5-S1/S3** · **Tech:** Bundle als Komposit `includes_product_keys`; checkout um mode=payment; Webhook `checkout.session.completed` → mehrere Entitlements; Pricing-UI.

**E5-S5 · EU-VAT / Stripe Tax & Rechnungen** — *DACH-Kunde will korrekte USt.* · **AC:** Stripe Tax aktiv → korrekter Satz DE/AT/CH (automatic_tax); B2B-USt-IdNr validiert → ggf. Reverse-Charge; Rechnung mit Pflichtangaben + fortlaufender Nummer, im Konto abrufbar; EU-Region + AVV-konformer Datenfluss. · **5 · Must · Deps E5-S2/S3** · **Tech:** Stripe Tax + tax_behavior; tax_id_collection; Webhook `invoice.finalized` → `academy_invoices`; Rechnungs-Historie; Rechtsprüfung.

**E5-S6 · Self-Service Billing-Portal** — *Abonnent will Abo verwalten.* · **AC:** `academy-billing-portal` liefert Portal-URL; Kündigung (cancel_at_period_end) → Berechtigung bis valid_until, dann expired (kein Sofort-Lockout); Upgrade M→J → Cache korrekt; nach valid_until → RLS-Gating greift. · **3 · Should · Deps E5-S3** · **Tech:** Portal-Edge-Fn; Mein-Abo-UI; Webhook cancel_at_period_end; pg_cron expired-Übergang via Queue.

**E5-S7 · Dunning bei Zahlungsausfall** — *Betreiber will Mahnprozess.* · **AC:** payment_failed → past_due (Grace, Zugang bleibt) + Dunning-Event; erfolgreicher Retry → active; alle Retries scheitern → expired + Entzug; past_due → nicht-blockierendes Banner mit Portal-CTA. · **3 · Should · Deps E5-S3/S6** · **Tech:** Smart-Retries; Handler past_due/active + `dunning_events`; PastDueBanner; optional send-email-Mahnstufen.

**E5-S8 · 14-Tage-Widerruf & AZAV/B2B** — *Verbraucher/B2B will Widerruf + Sonderpfade.* · **AC:** Widerruf in 14 Tagen → Refund + Entitlement-Entzug (Ledger); sofortiger Zugang nur mit ausdrücklicher Einwilligung (protokolliert); AZAV (0 EUR) → source=azav ohne Stripe, RLS-gegated; B2B 10 Seats → je source=b2b_seat, widerrufbar, nicht überbuchbar. · **8 · Should · Deps E5-S1/S3** · **Tech:** `academy-refund` (Refund+Revoke+Ledger); Einwilligungs-Checkbox; `academy_b2b_seats` + Überbuchungs-Constraint; Admin-UI; Widerrufsbelehrung.

### E6 — Andocken / Recruiter-Funnel
**Goal:** Zertifizierte Absolventen werden über kontrollierten Bewerbungs-/Admin-Review-Funnel server-autoritativ zu bezahlten Recruitern — ohne jeden Self-Service-Eskalationspfad.

**E6-S1 · Bewerbungs-Schema + State-Machine** — *Architekt will append-sichere Wahrheitsquelle.* · **AC:** `academy_recruiter_applications` (user_id UNIQUE, status CHECK, motivation, eligibility_credential_id, reviewer_id, …); Nutzer bewegt status nur draft→submitted/withdrawn; Nicht-Admin schreibt reviewer/status='accepted' → verworfen; `validate_application_transition` blockt illegale Kanten; pgTAP: Bewerber-Self-Escalation → deny. · **5 · Must · Deps E2** · **Tech:** Migration + UNIQUE + partieller Index; Trigger SECURITY DEFINER Kanten-Matrix; RLS own/admin; pgTAP; types-Regen.

**E6-S2 · Eligibility-Gate** — *Absolvent will nur mit gültigem Zertifikat bewerben.* · **AC:** ohne Zertifikat → `academy_can_apply_as_recruiter()` deny + Grund certificate_required; mit gültigem Credential → eligible=true + credential_id; submit-Trigger erzwingt Credential-Ownership; bereits recruiter → already_recruiter; UI disabled mit Begründung. · **3 · Must · Deps E6-S1, E2** · **Tech:** RPC SECURITY DEFINER (Credential-Check + keine recruiter-Rolle); Trigger-Erweiterung; Hook; Grund-Codes für i18n.

**E6-S3 · Bewerber-UI** — *Absolvent will Bewerbung erstellen/verfolgen.* · **AC:** eligibler Absolvent: Formular (Motivation/Spezialisierung/Erfahrung vorbelegt), draft speicherbar; Einreichen → submitted + Read-Only-Status; submitted/under_review → Stepper; Zurückziehen → withdrawn, erneut bewerbbar; nicht-eligibel → Grund + Zertifizierungs-CTA. · **5 · Must · Deps E6-S1/S2** · **Tech:** `AcademyRecruiterApplication.tsx`+Route; react-hook-form+zod; Mutations upsert/submit/withdraw; Stepper; i18n.

**E6-S4 · Admin-Review-Queue** — *Admin will Bewerbungen prüfen/entscheiden.* · **AC:** `/admin/academy/applications` nach submitted_at sortiert + Filter; Nicht-Admin → ProtectedRoute blockt; Detail zeigt Motivation/Profil/Zertifikatsstatus/Kursfortschritt; „In Prüfung" → under_review + reviewer_id; „Annehmen/Ablehnen" + Pflicht-Notiz → ruft NUR `academy-process-application` (kein direktes user_roles-Update). · **5 · Must · Deps E6-S1/S5** · **Tech:** `AdminAcademyApplications.tsx`; Nav-Eintrag; admin-RLS-Select + Join; invoke process-application; Query-Invalidation.

**E6-S5 · academy-process-application Edge-Fn** — *Security will server-autoritative Freigabe.* · **AC:** ohne Admin-Token → 403, keine Mutation; accept → in Transaktion `user_roles(recruiter)` ON CONFLICT idempotent + status=accepted + Onboarding-Init; reject → keine Rolle, status=rejected + Mail; doppelter accept → identisch (UNIQUE+Status-Guard); jede Entscheidung → append-only Audit (actor/action/before-after). · **8 · Must · Deps E6-S1** · **Tech:** Deno (auth.getUser + has_role-Check, dann Service-Role); RPC `academy_grant_recruiter` atomar; `academy_application_events`; send-email fehlertolerant; selektiver Deploy.

**E6-S6 · Provisions-Attribution** — *Geschäftsführung will Akademie-Herkunft.* · **AC:** accept → unveränderliche Attribution (recruiter, source='academy', application_id, cohort_id?, accepted_at); spätere Provision joinbar; manueller Recruiter → keine academy-Attribution; Report liefert Andock-Quote + produktive Recruiter je Kohorte; gdpr-deletion berücksichtigt Attribution. · **5 · Should · Deps E6-S5** · **Tech:** `academy_recruiter_attribution` append-only; Insert in `grant_recruiter`-Transaktion; View `academy_andock_metrics`; gdpr-Erweiterung.

**E6-S7 · Kontinuität des Akademie-Zugangs** — *Recruiter will weiter lernen.* · **AC:** user mit academy_profile UND recruiter-Rolle: Akademie-Zugang bleibt; Matchunt-App parallel ohne Konflikt; own_all-Policies wirken weiter; Premium folgt plan/Entitlement (nicht Rolle); Playwright: beide Pfade + Eskalations-Negativtest grün. · **3 · Should · Deps E6-S5, E4** · **Tech:** Zugang an academy_profile+Entitlement binden (nicht an Rollen-Abwesenheit); RLS-Review; Host-Split-Routing; E2E; ADR-Notiz.

### E7 — KI-Layer (Bedrock eu-central-1, PII-sicher)
**Goal:** Kontextgebundener EU-konformer KI-Tutor + generierte/personalisierte Inhalte, ausschließlich aus verifizierten Kursinhalten (RAG), server-autoritativ bewertet, durch Guardrails/PII/Eval abgesichert.

**E7-S1 · Bedrock-Gateway & RAG-Infra** — *Entwickler will einzigen Choke-Point + pgvector.* · **AC:** jeder KI-Call nur via `academy-ai-gateway` gegen eu-central-1 (fail-closed bei Region≠); published Lektion → `academy_content_chunks` (vector(1024)+HNSW), unpublished/Premium per RLS nicht abrufbar; `match_academy_chunks` nur Entitlement-Chunks; Fehler → definierter Code + `academy_ai_events` + idempotenter Retry; gleicher idempotency_key → einmal aufgerufen. · **13 · Must · Deps E1, E7-S7** · **Tech:** Migration chunks+HNSW; RLS-Helfer `academy_can_access_lesson`; Retrieval-RPC; Gateway (SigV4, Region-Assertion); `academy_ai_events` UNIQUE; `academy-embed-content`; `_shared/academy-bedrock.ts`.

**E7-S2 · KI-Tutor-Chat mit Grounding+Zitaten** — *Lerner will fundierte Antwort mit Quelle.* · **AC:** Antwort nur aus `match_academy_chunks` + nennt Quell-Lektion; unter Schwellwert → „dazu liegt nichts vor" + Lektionsvorschlag (keine Halluzination); Free über Quota → server-gedrosselt + Upgrade-Hinweis; Verlauf an user_id gebunden (RLS); gestreamt, bei Guardrail-Verstoß abgebrochen. · **8 · Must · Deps E7-S1/S5/S6** · **Tech:** tutor_sessions/_messages RLS; `academy-tutor-chat` (embed→match→grounding-Prompt→Stream→Guardrail); Quota `academy_ai_usage`+RPC; `TutorChat.tsx` Streaming; i18n.

**E7-S3 · Auto-Quiz-Generierung** — *Admin will KI-Quizze mit Human-Gate.* · **AC:** „Quiz generieren" → N Fragen via Tool-Calling mit Distraktoren/Begründung/Schwierigkeit, je Quell-Chunk; answer_keys in default-deny-Tabelle (nur Grading-RPC); Status draft bis approved (Lerner sehen nur approved); ungültige Frage (0/≥2 korrekt, kein Chunk) → invalid; idempotent pro lesson+version. · **8 · Should · Deps E7-S1/S5, E2** · **Tech:** quiz_questions + getrennte answer_keys default-deny; `academy-generate-quiz` (QUIZ_TOOL+Validierung); RPC `grade_academy_quiz`; Admin-Review-Editor; pgTAP keys nicht lesbar.

**E7-S4 · Personalisierte Lernpfade** — *Lerner will Empfehlung aus Schwächen.* · **AC:** Dashboard zeigt geordnete Lektionen + KI-Begründung; niedriger Quiz-Score → Wiederholung priorisiert (SRS-Verzahnung); nur pseudonymisierte/aggregierte Daten an Modell, nur freigegebene Lektionen; neuer Nutzer → deterministischer Fallback (Outline); unveränderte Empfehlung → Cache (kein Call je Render). · **5 · Should · Deps E7-S1/S3, E1** · **Tech:** `academy_learning_path`-Read-Modell; `academy-recommend-path` (Progress+Scores pseudonym, RECOMMEND_TOOL, Post-Filter); Fallback; Dashboard-Block; Recompute nur bei Event.

**E7-S5 · Guardrails & Eval-Suite** — *KI-Qualitätsverantwortlicher will Halluzinations-/Injection-Schutz + Eval-Gate.* · **AC:** Injection-Input → erkannt/abgebrochen + flag=injection; Output-Guardrail (Off-Topic/Toxizität/ungesicherte Behauptung) → ersetzt/blockiert; Golden-Set-Eval misst Faithfulness/Citation/No-Coverage + GO/NO-GO (≥95%); Unterschreitung → CI-Gate blockt Deploy; Negativtest „Frage ohne Abdeckung" beweist keine Halluzination. · **8 · Must · Deps E7-S1** · **Tech:** `_shared/academy-guardrails.ts`; `scripts/golden-eval-academy.ts`; ai_events-Flags; CI-Pre-Deploy-Gate; Deno-Unit (Injection-Payloads).

**E7-S6 · PII-Redaction für alle KI-Calls** — *Datenschutzverantwortlicher will fail-closed Leak-Assertion.* · **AC:** Klarname→[LERNENDE], E-Mail/Tel/Links entfernt, nur Allowlist-Felder (kein `select('*')`); `assertNoLeak` vor fetch → bei Treffer nicht gesendet; freie Tutor-Fragen redigiert ohne fachliche Zerstörung; Flag `ACADEMY_PII_REDACTION_MODE` Default 'on'; wiederverwendet `pii-redaction.ts` ohne Kandidaten-Pfad zu brechen. · **5 · Must · Deps E7-S1, K3** · **Tech:** `_shared/academy-pii.ts` (Allowlist); im Gateway als Choke-Point; ENV-Flag; Deno-Unit-Tests; redaction_meta-Logging (Art. 30).

**E7-S7 · KI-Entitlements, Kosten & Observability** — *Betreiber will Limits + Sentry-EU.* · **AC:** Free vs. Pro unterschiedliche server-autoritative Limits (nicht umgehbar); Tagesbudget überschritten → Circuit-Breaker; Fehler/Guardrail → Sentry-EU (ohne PII) korrelierbar mit ai_events; Admin-Dashboard aggregierte Nutzung/Kosten je Feature/Tier (keine Roh-Prompts); fremde ai_usage/-events → deny. · **5 · Should · Deps E7-S1, E4** · **Tech:** RPC `check_academy_ai_entitlement`; Circuit-Breaker (Kostenaggregat+ENV-Budget); Sentry-EU; Admin-Tab; RLS+pgTAP owner/admin-only.

**E7-S8 · types-Regen & typsichere KI-Anbindung** — *Frontend will keine neuen Casts.* · **AC:** types enthalten alle `academy_ai_*`; Hooks ohne `as any`; tsc/Vite grün; Migrationen auf Preview idempotent+RLS-gehärtet vor Prod. · **3 · Could · Deps E7-S1..S7** · **Tech:** gen types; Hooks umstellen; Preview-Apply; Typecheck-Gate.

### E8 — Video-Pipeline (Bunny Stream EU)
**Goal:** EU-datensouveräne Lektionsvideos mit signierter, nicht teilbarer Wiedergabe, server-autoritativem Upload/Webhook-Lifecycle, exaktem Resume/Watch-Tracking, Transkripten/Untertiteln.

**E8-S1 · Datenmodell & RLS Video** — *Architekt will gehärtetes Modell.* · **AC:** Asset mit bunny_video_id/status/duration/captions_status/lesson_id; fremder/nicht-freigeschalteter Zugriff → 0 rows; Premium-Video für Free → nur Metadaten, kein Playback; RLS via denormalisierte Spalten + SECURITY-DEFINER statt EXISTS, Index je Spalte; idempotente Migration + types-Regen. · **5 · Must · Deps E0** · **Tech:** `academy_video_pipeline.sql` (assets/progress/transcripts/events append-only); RLS-Helfer `academy_can_access_lesson`; Indizes; pgTAP.

**E8-S2 · Admin-Upload nach Bunny EU** — *Admin will Upload aus Editor.* · **AC:** Dateiauswahl → `academy-video-create-upload` erstellt EU-Video + scoped Upload-URL (API-Key bleibt server); TUS-Resumable bei Abbruch fortsetzbar + Progress; Erfolg → status='encoding', Lektion verweist auf Asset; Fehler/falscher Typ → fail-closed status='failed' + Meldung; EU-Zone in Metadaten. · **8 · Must · Deps E8-S1** · **Tech:** Edge-Fn (Create+TUS-Session, Secrets in Vault); VideoUploadField (TUS-Client); RPC `academy_register_video_asset`; EU-Library; Sentry-EU.

**E8-S3 · Bunny-Webhook idempotent+signiert** — *System will Encode-Lifecycle.* · **AC:** ungültige Signatur → 401 fail-closed (kein JSON.parse-Fallback); video.ready → status='ready' + duration/thumbnail + Untertitel-Trigger; Doppel-Zustellung (bunny_event_id im Ledger) → No-Op; video.failed → status='failed' + error_reason; Verarbeitung nach Annahme fehlerresistent wiederholbar. · **5 · Must · Deps E8-S1/S2** · **Tech:** `academy-video-webhook` (HMAC async); Insert `video_events` UNIQUE → früh 200; Side-Effects via RPC/Queue; Endpoint registrieren; Sentry-EU.

**E8-S4 · Signed Playback Token & Player** — *Lerner will nicht teilbare Wiedergabe.* · **AC:** Player → `academy-video-playback-token` nach Enrollment/Premium-Check → signierte URL (TTL≤4h, an user+lesson gebunden); Free/ohne Enrollment → 403 + Gating-CTA; abgelaufene/geteilte URL → Bunny verweigert; alter iframe-Pfad hinter Feature-Flag deaktiviert; `BUNNY_TOKEN_KEY` nie im Bundle. · **5 · Must · Deps E8-S1/S2** · **Tech:** Token-Edge-Fn; AcademyVideoPlayer (HLS lazy, Refetch vor Ablauf); Flag `ACADEMY_VIDEO_SIGNED`+Backfill; Token-Auth-Restriktionen; Playwright-Negativtest.

**E8-S5 · Resume & Watch-Progress** — *Lerner will geräteübergreifendes Resume + gating-taugliche Completion.* · **AC:** Resume an last_position_sec; Heartbeat (15s+Pause/Ende) committet nur serverseitig watched_ranges/max_watched_pct; ≥90% effektiv → completed + recomputeCourseProgress; gefälschte 100% ohne Ranges → verworfen; parallele Sessions → höchster max_watched_pct bleibt (kein Rückschritt). · **8 · Must · Deps E8-S1/S4** · **Tech:** RPC `academy_commit_video_progress`; Dünnschicht+Rate-Limit; Heartbeat; Plausibilitäts-Check; Integration completeLesson; pgTAP Race + E2E Resume.

**E8-S6 · Transkripte & Untertitel** — *Lerner mit Barrierebedarf will Captions + Transkript.* · **AC:** status='ready' → DE-VTT (source='ai', draft); Admin korrigiert → manual/published, nur published ausgespielt; Captions DE ein-/ausschaltbar (WCAG AA); Transkript-Volltext lesbar; published ohne Transkript → Barrierefreiheits-Warnung. · **5 · Should · Deps E8-S1/S3** · **Tech:** Bunny-Auto-Caption/`academy-video-transcribe`; RPC `academy_publish_transcript`; Captions-UI+Transkript-Panel; captions_status+Warnung; RAG-fähig ablegen.

**E8-S7 · Observability, EU-Gate & Backfill** — *Betreiber will produktiv ohne Rückstände.* · **AC:** Go-Live-Gate blockt bis Bunny-AVV/DPA + EU-Region verifiziert; Datenschutz listet Bunny als Auftragsverarbeiter EU; Seed-Lektionen migriert oder als „kein Signed-Video" markiert (kein verwaister Embed); Fehler/Denials in Sentry-EU + Dashboard (Encode-Erfolg/Token-Denial); Branch/Preview + selektiver academy-video-*-Deploy. · **3 · Should · Deps E8-S2/S3/S4/S5** · **Tech:** Go-Live-Checkliste; Backfill-Skript; Sentry-Dashboards+Alerts+Budget; Deploy-Runbook; Post-Deploy-Smoke E2E.

### E9 — Security, RLS & DSGVO-Härtung
**Goal:** Server-autoritative gehärtete RLS mit SECURITY-DEFINER-Helfern, lückenloses Audit-Logging, EU-Residenz, vollständige DSGVO-Export/Löschpfade, maschinell getestete Privilege-Escalation-Invariante.

**E9-S1 · RLS-Härtung: nested EXISTS → Helfer + denormalisierte course_id** — *Betreiber will performante, nicht umgehbare RLS.* · **AC:** anon liest unpublizierte Lektion → 0 Zeilen (kein Modul/Lesson-Join-Leak); Helfer `academy_course_is_published` STABLE/SECURITY DEFINER/search_path; denormalisierte course_id per Trigger → Index statt Seq Scan; `pg_policies` ohne nested EXISTS+JOIN; Admin-Vollzugriff unverändert. · **5 · Must · Deps E9-S6** · **Tech:** Migration Helfer; course_id NOT NULL + Backfill + Trigger; Policies umschreiben; Indizes; Muster für künftige Tabellen.

**E9-S2 · Privilege-Escalation-Invariante (pgTAP)** — *Security will Invariante in CI.* · **AC:** academy-Signup → academy_profiles + keine user_roles-Zeile; Signup mit meta role='admin' → Rolle 'client'; Nicht-Admin INSERT user_roles role='admin' → fehlschlägt; pgTAP in CI rot bei Verletzung; Nicht-Admin liest fremde enrollments/progress → 0 Zeilen. · **5 · Must · Deps E9-S1** · **Tech:** `supabase/tests/pgtap/`; `set_config(request.jwt.claims)`-Helper; Testfälle; GitHub-Actions pgtap-Step; Migrations-Kommentar.

**E9-S3 · Append-only Audit-Log** — *Compliance will gerichtsfeste Protokolle.* · **AC:** Andock-Freigabe/Plan-Änderung → genau 1 `academy_audit_log`-Zeile (actor/target/action/before-after); UPDATE/DELETE (auch Admin) → blockiert; Admin filtert nach Actor/Target/Zeitraum, Nicht-Admin kein Read; Log-Insert in selber Transaktion; Indizes auf target/action. · **5 · Must · Deps E9-S1** · **Tech:** Migration audit_log; RLS SELECT admin / INSERT via RPC / UPDATE-DELETE-Trigger; zentrale RPC `academy_audit`; Indizes; AuditLog-UI; Hook in Andock-/Entitlement-RPCs.

**E9-S4 · DSGVO Datenexport (Art.15/20)** — *Mitglied will maschinenlesbaren Export.* · **AC:** „Daten exportieren" → JSON nur eigene Daten; `academy-data-export` validiert JWT, user_id nur aus Token; Export → audit `gdpr_export`; Datei mit Profil/enrollments/progress/credentials/Timestamp; manipulierter Parameter → eigene Daten (IDOR-sicher). · **5 · Should · Deps E9-S3** · **Tech:** Edge-Fn JWT-Verify; RPC `academy_export_self`; Export-Schema; Audit; Export-UI; selektiver Deploy.

**E9-S5 · DSGVO Löschung/Anonymisierung (Art.17)** — *Mitglied/Admin will Recht auf Löschung.* · **AC:** Löschantrag → Profil/enrollments/progress gelöscht/anonymisiert, auth-Verknüpfung entfernt; Audit-Records mit Aufbewahrung → target_user_id pseudonymisiert; Löschung → audit `gdpr_erasure` mit Pseudonym; Zertifikate revoked/anonymisiert; Nicht-Admin/Nicht-Betroffener → deny. · **8 · Should · Deps E9-S3/S4** · **Tech:** RPC `academy_erase_user` (Betroffener/Admin); Anonymisierungs-Strategie je Tabelle; stabiles Pseudonym; `academy-erasure-request`; Zertifikat-Revocation+Stripe-Customer-Löschung; Aufbewahrungs-Kommentar.

**E9-S6 · EU-Datenresidenz-Invariante** — *Datenschutzverantwortlicher will EU belegen + CI-Guard.* · **AC:** Supabase-Region EU im ADR; KI nur Bedrock eu-central-1 (kein US); Video Bunny EU als ENV-Invariante; Edge-Fn mit Nicht-EU-Endpunkt → CI-Lint-Fail (Allowlist); Verfahrensverzeichnis listet Subprozessoren mit Region+AVV. · **3 · Must · Deps —** · **Tech:** Region verifizieren+ADR; ENV/Endpunkt-Allowlist; CI-Guard grept US-Endpunkte; Subprozessor-Tabelle; Legal-Verknüpfung.

**E9-S7 · Server-autoritative Entitlements als RLS-Wahrheit** — *Betreiber will kein Client-Bypass von Premium.* · **AC:** Free ohne Entitlement liest is_premium=true per REST → 0 Zeilen; Entitlement nur via Webhook/Admin-RPC, Nutzer-Schreiben → deny; Premium-Policy prüft `academy_has_entitlement` gegen indizierte Spalten; Playwright Free→Premium → kein Inhalt; abgelaufenes Entitlement → Zugriff entzogen. · **8 · Must · Deps E9-S1/S3** · **Tech:** `academy_entitlements`+Indizes; Helfer `academy_has_entitlement`; Premium-Policies default-deny; Schreibpfad nur Webhook/Admin; Playwright-E2E.

**E9-S8 · E2E Privilege-Escalation- & IDOR-Negativtests** — *QA will Auth-Pfad-Verifikation.* · **AC:** frischer Nutzer → /admin/academy abgewiesen; INSERT user_roles role='admin' → RLS denied; A liest Bs enrollments/progress → 0 Zeilen; roter Negativtest blockt Merge; Nicht-Admin Andock-Aktion → server-deny. · **5 · Should · Deps E9-S2/S7** · **Tech:** Playwright-Setup gegen Preview; Test-Fixtures 2 Akademie + 1 Admin; Negativtests; CI-Step required; Sentry-EU-Tagging optional.

### E10 — Observability, Testing & CI/CD
**Goal:** Jeder Akademie-Merge durch pgTAP-RLS-Negativtests, Playwright-Eskalation, Vitest-Engine-Tests, Preview-Migration und Sentry-EU abgesichert — kein Invariant bricht unbemerkt, kein geteilter Blast-Radius.

**E10-S1 · Vitest-Harness für Engines** — *Entwickler will Coverage-Gate für Progress/XP/SRS.* · **AC:** `npm run test:unit` headless, eingebauter Fehler in recomputeCourseProgress → rot; FSRS-Szenario deterministisch = Golden-Werte; doppelte XP-Events → idempotent; <80% Statements-Coverage → Exit≠0; bestehende `pii-redaction.test.ts`+`golden-eval-fit.ts` werden erfasst. · **5 · Must · Deps —** · **Tech:** vitest+coverage-v8; `vitest.config.ts`; Engine-Logik in pure Funktionen extrahieren; Golden-Fixtures; pii-Test in include. *(Bestätigt: package.json hat keine Test-Deps.)*

**E10-S2 · pgTAP RLS-Negativtests alle Tabellen** — *Security will „darf NICHT" beweisen.* · **AC:** B liest/updatet As enrollments/progress/profiles → 0/Fehler; answer_keys SELECT (normaler User) → 0, nur Grading-RPC; Nicht-Admin Schreibpfad courses/modules/lessons → deny (Admin erlaubt); server-autoritative Felder direkt → deny; `npm run test:rls` not-ok=0, deckt jede Tabelle. · **8 · Must · Deps E10-S5** · **Tech:** pgTAP+pg_prove gegen `supabase db start`; `set_test_user`-Helper; Negativ-Plans je Tabelle; Positiv-Gegenproben; `run-pgtap.sh`.

**E10-S3 · Playwright E2E inkl. Eskalation** — *Security will Auth-Pfad-Tests.* · **AC:** academy-Signup → 0 user_roles; manipulierter app_role-Set → abgewiesen; LMS-Happy-Path (Kurs→Lektion→completeLesson→Progress); Premium ohne Entitlement per URL → Server blockt 403/Redirect; CI grün, sonst Pipeline bricht. · **8 · Must · Deps E10-S5/S6** · **Tech:** @playwright/test+config; Auth-Fixtures via Service-Role; `privilege-escalation.spec.ts`; `lms-happy-path.spec.ts`; `entitlement-gate.spec.ts`; Teardown.

**E10-S4 · Selektive CI/CD nur academy-*** — *Betreiber will Blast-Radius begrenzen.* · **AC:** PR nur academy-*-Functions → nur diese deployt, keine fremde berührt; PR ohne Function-Änderung → Deploy übersprungen; lint/unit/rls/e2e nicht grün → kein Deploy; Secrets nur in GitHub-Secrets, nicht in Logs; verify_jwt-Flags erhalten. · **5 · Must · Deps E10-S1/S2/S3** · **Tech:** `academy-ci.yml` (lint/test/deploy + paths-filter); dorny/paths-filter; supabase-cli im Runner; Repo-Secrets; Concurrency+required checks.

**E10-S5 · Branch/Preview-Migrationstests** — *Betreiber will geteiltes Backend abschirmen.* · **AC:** PR mit Migration → `db push` gegen Replikat aller bestehenden Migrationen erfolgreich; fehlerhafte/nicht-idempotente Migration → Job-Fail blockt Merge; pgTAP zeigt auf Branch-Stand; CI regeneriert types.ts (Diff sichtbar, Casts entfallbar); Merge → deterministisch auf Prod (kein manuelles Dashboard mehr). · **5 · Must · Deps —** · **Tech:** CI-Job migration-test (Branch/`db reset`); up/down + Idempotenz; gen types Artifact+Diff; Branch-URL an pgTAP/E2E; Pfad für die 2 offenen Migrationen.

**E10-S6 · Sentry EU Observability** — *Betreiber will EU-Fehler-Sichtbarkeit + PII-Scrubbing.* · **AC:** AcademyApp-Fehler in Sentry EU (region=de) + Release-Tag; academy-*-Fehler mit Function/Request-Kontext; beforeSend scrubbt E-Mail/Namen/Tokens; getrennt von Matchunt-Sentry (kein Doppel-Reporting); CI-Deploy → Sentry-Release+Sourcemaps an Commit. · **5 · Should · Deps E10-S4** · **Tech:** @sentry/react im Academy-Boundary EU-DSN; beforeSend (pii-redaction); Sentry-Deno in `_shared/observability.ts`; EU-Projekt; sentry-cli im ci.yml.

**E10-S7 · Server-autoritative Feature-Flags** — *Produkt-Owner will sichere Rollouts.* · **AC:** Flag off → Feature in Frontend UND RPC/Edge inaktiv (Server entscheidet); Toggle nur has_role('admin') schreibbar, alle lesbar; fehlendes Flag → fail-closed off; Test deckt on/off; Änderungen append-only protokolliert. · **3 · Could · Deps E10-S2** · **Tech:** `academy_feature_flags` + RLS; RPC `is_feature_enabled`; useFeatureFlag (fail-closed); Admin-Toggle; Event-Ledger-Trigger.

### E11 — Content-Produktion & Akquise-Funnel
**Goal:** Mehrkanalige Content-Maschine (Newsletter/Podcast/Blog) + SEO/LinkedIn-Badge/3-Tage-Challenge → organischer „Ausbildung zum Headhunter"-Traffic in Free-Signups und Free→Premium, auditierbar + DSGVO-konform.

**E11-S1 · Content-Hub & Publishing** — *Marketing-Admin will typisiertes Schema + Workflow.* · **AC:** Eintrag content_type ∈ (article/newsletter/podcast_episode) → `academy_content` (slug unique, draft, locale de) + immutable `content_versions`; scheduled + publish_at erreicht → Worker setzt published (kein Side-Effect im Cron); Nicht-Admin RLS → nur published; Body als typisierte content_blocks (kein HTML); Republish → alte Version bleibt. · **8 · Must · Deps E0** · **Tech:** Migration content/versions append-only; RLS published-only via `is_academy_admin`+partieller Index; `academy-content-worker` idempotent; pg_cron Taktgeber; ContentEditor; types-Regen.

**E11-S2 · Newsletter Double-Opt-In** — *Besucher will DOI-Newsletter.* · **AC:** Signup → `subscribers` pending + signiertes Confirm-Token + DOI-Mail (send-email); Klick → confirmed + Consent (IP/Quelle, append-only); jede Mail → One-Click-Unsubscribe (signiert, ohne Login); content_type='newsletter' published → Versand nur confirmed, je 1× (send_log-Idempotenz); gdpr-deletion anonymisiert. · **8 · Must · Deps E11-S1** · **Tech:** Migration subscribers/consent_log/send_log; subscribe/confirm/unsubscribe Edge-Fns (Token-Hash); Worker-Batch; NewsletterSignup+Landings; RLS default-deny; gdpr-Erweiterung; i18n de/at/ch.

**E11-S3 · SEO-Programm „Ausbildung zum Headhunter"** — *Suchende will indexierte Rich-Snippet-Seiten.* · **AC:** valide title/meta/canonical + OG/Twitter aus seo_meta, hreflang de-DE/AT/CH; /sitemap.xml + /robots.txt mit allen published URLs+lastmod, bei Publish aktualisiert; gültiges JSON-LD (Article/Course); Lighthouse-SEO ≥95, LCP <2,5s; Crawler ohne JS sieht Title/Meta+Haupttext (Prerender/SSR). · **13 · Must · Deps E11-S1** · **Tech:** react-helmet-async+SeoHead; `academy-sitemap` Edge-Fn; Prerender/SSG für /blog/*+Landings; JSON-LD-Generator; hreflang/canonical; Pillar-Landing; Lighthouse-CI.

**E11-S4 · 3-Tage-Sourcing-Challenge** — *Free-Mitglied will geführte Challenge → Premium-Brücke.* · **AC:** Anmeldung → `challenge_enrollment` mit materialisiertem unlock_at je Tag (server); Tag-2 future → server-gated; Tagesaufgabe → XP append-only + Progress via RPC (kein Client-Write); Tag-3-Abschluss → Completion-Event + Abschluss-Mail mit Premium-CTA + track-event; Drip-Mails nur via Queue+Worker; ohne enrollment → RLS-deny. · **13 · Should · Deps E11-S2/S6** · **Tech:** Migration challenges/cohorts/tasks/enrollments/submissions; xp_ledger+RPC award/recompute; server-Gating via `is_challenge_enrolled`; Drip-Queue+Worker; ChallengeLanding/Day/SubmissionForm; track-event; Premium-CTA.

**E11-S5 · Funnel-Attribution & Dashboard** — *Wachstum will ROI je Kanal.* · **AC:** UTM-Link → first/last-touch in `attribution_events` (keine PII ohne Consent); Signup → Attribution verknüpft, keine Roh-Tracking-PII; `/admin/academy/funnel` zeigt Trichter je Kanal aus Read-Modellen; KPIs Free→Pro/Completion/Activation konsistent mit Ledger; Aggregation via RPC/MV (pg_cron-Refresh). · **8 · Should · Deps E11-S2/S3/S4** · **Tech:** `attribution_events` append-only + Consent-gated Link; track-event-Erweiterung + pii-redaction; `mv_academy_funnel_by_channel`; FunnelDashboard; RLS Admin-only; Sentry-EU.

**E11-S6 · LinkedIn-Badge-Loop** — *Absolventin will teilbares verifizierbares Badge.* · **AC:** Meilenstein server-verifiziert → `badge_award` append-only + public_id + `/verify/{id}`; Verify ohne Login zeigt nur freigegebene Felder + valid/revoked; Share → korrekte OG-Tags + dynamisches OG-Image; OB3.0/W3C-VC + vorausgefüllter Add-to-LinkedIn-Deeplink; revoked/expired eindeutig; Dritter auf Verify → Funnel-CTA mit Attribution. · **8 · Should · Deps E11-S1/S5** · **Tech:** Migration badges/badge_awards append-only; `academy-issue-badge` (VC, signiert); `academy-og-image`; BadgeVerify-Seite (Whitelist-View); Add-to-LinkedIn-Builder; Funnel-CTA+track-event.

**E11-S7 · Plattform-getragene Personenmarke & Repurposing** — *Marketing-Admin will konsistente Marke + KI-Repurpose.* · **AC:** konsistente Autoren-Byline + öffentliche Autoren-Hub-Seite; „Repurpose" → KI (Bedrock eu-central-1) erzeugt editierbare Drafts (LinkedIn/Newsletter/Hooks/Show Notes), nie auto-published; PII-Redaction vor Modell, eu-central-1; Podcast als Content mit Audio (EU-Storage)/Dauer/Transkript im RSS /podcast.xml; akzeptierter Draft → `content_derivative` im Publishing-Workflow. · **8 · Could · Deps E11-S1** · **Tech:** Migration authors/derivatives; `academy-repurpose-content` (Bedrock EU+Redaction); `academy-podcast-rss`; EU-Audio-Bucket; AuthorHub; Repurpose-Panel; RLS.

**E11-S8 · Specialist-Track-Framework** — *Produkt-Owner will wiederverwendbare Nischen-Funnel.* · **AC:** neuer Track ohne neue Tabellen (Kurse+Content-Cluster+Challenge-Vorlage zuordenbar); Track-Landing SEO-optimiert mit Kursen/Content/Challenge-CTA; Conversion track-spezifisch im Funnel-Dashboard segmentiert; getaggter Beitrag erscheint im Track-Cluster + verwandte Beiträge; nicht-published Track → RLS-deny. · **5 · Could · Deps E11-S1/S3/S4/S5** · **Tech:** Migration tracks + Join-Tabellen; TrackLanding; Content-Tagging-UI+Auto-Cluster; Funnel-Track-Segment; RLS published-only.

### E12 — Ergänzungen & Querschnitt
**Goal:** Schließt die Backlog-Lücken quer über E0–E11: stärkster Completion-Hebel (Onboarding/Aktivierung), menschliche Admin-/Betriebsprozesse, Go-Live-Pflicht-Recht, Lern-/Conversion-Analytik, KI-Mehrwert, Betriebs-NFRs. Jede Story dockt an bestehende Epics an.

| ID | Titel | As-a / I-want / so-that (Kurz) | AC (verdichtet) | Pts | MoSCoW | Deps |
|----|-------|-------------------------------|-----------------|:--:|--------|------|
| **S1** | Akademie-Shell: Registry, Error-Boundary, 404, Offline | Frontend-Dev will zentrale Shell, damit Folge-Stories nur andocken | Deklarative Route-Registry; Lazy-Stubs /quiz,/verify,/community,/billing,/bewerbung; globale Error-Boundary→Sentry EU; 404-Seite mit Katalog-CTA; Offline-Retry-Banner statt Dauer-Spinner | 5 | Must | E0-S8 |
| **S2** | Planning-Prompt beim Enrollment | Lerner will Selbstbindung (Lernzeit+Ziel-Mandatsdatum) | Pflicht-Dialog bei 1. Enrollment → planned_schedule+target_mandate_date in enrollments, editierbar; speist Readiness+Reminder-Tageszeit; Skip nur via „später erinnern" | 3 | Must | E12-S1 |
| **S3** | Gef.. Week-1-Aktivierungs-Flow (Sub-24h) | Lerner an Tag 1 will gefährten Quick-Win | 3-Schritt-Checkliste (Lektion+Quiz+Forum-Intro) mit Live-Fortschritt; Mikro-Feedback; alle 3 → first_success-Event; erzwungener Mini-Win <24h; Abschluss trackbar | 8 | Must | E12-S1/S2 |
| **S4** | Account-Lifecycle-Basis | Mitglied will Verify/Reset/Email-Change | DOI + Resend + Fehlerzustände; Self-Service Passwort-Reset + Email-Change re-verify; Magic-Link-Fehler recovery; Session-Invalidierung bei PW-Wechsel; Mails über Akademie-Domain | 5 | Must | E12-S1 |
| **S5** | Empty-States, Skeletons, First-Use | Neuer Nutzer will Leitfaden statt leerer Flächen | Dashboard ohne Enrollment → Aktivierungs-CTA; Empty-States Katalog/Community/SRS; konsistente Skeletons; einmalige dismissbare First-Use-Hints | 3 | Should | E12-S1 |
| **S6** | Readiness-Score & Andock-Progress-Bar | Lerner will Nordstern „Schritt X/7" | Server-Score (Completion/Quizze/SRS/Capstone, nie Client); globale X/7-Bar klickbar; materialisiert in profiles via Trigger; Gate erfüllt → Bewerbungs-CTA | 5 | Should | E12-S1/S2 |
| **S7** | Lektions-Diskussions-Layer (Phase-1-Vorzug) | Lerner will Thread je Lektion | Thread je Lektion (threads/posts mit lesson_id); Login+Rate-Limit 10/min (BEFORE-INSERT-Trigger); Realtime; melden/löschen für Admin; FREE liest/Premium postet | 5 | Should | E12-S1 |
| **S8** | Capstone-/Submission-Review-Cockpit | Admin/Mentor will effizientes Review | Queue mit Filter/SLA; Rubrik-Scoring+Feedback; Transitions via Guard-RPC+Audit; Score fließt server-autoritativ in Readiness/Capstone-Gate; KI-First-Pass nur Vorbefüllung | 8 | Must | E12-S6 |
| **S9** | Content-Authoring-/Mehr-Augen-Freigabe | Redakteur will Author/Reviewer-Workflow | Rollen Author/Reviewer (entkoppelt von app_role); Draft→Review→Approved/Changes→Published mit Guard+Audit; Publish nur nach Approval anderer Person; immutable course_version; Diff | 5 | Should | E12-S8 |
| **S10** | Coach-/Mentor-Onboarding & -Verwaltung | Ops-Admin will Angebotsseite für Coaches | Coach-Profile+Spezialisierung+Status; Verfügbarkeit/Slots+Zuteilung Pods/Kohorten; Connect-Alignment-Felder; Zuteilung im Cockpit; RLS Admin verwaltet | 5 | Should | E12-S8 |
| **S11** | Admin-Refund/Storno + Connect-Reversal | Ops-Admin will Erstattungs-Workflow | Refund/Storno+Grund atomar/idempotent; Andock-Mandate: anteilige fee-Rücknahme+Transfer-Reversal; Zugriffsentzug nur via Webhook/Server; append-only Audit; Refund-Pfad getestet | 8 | Should | E12-S8 |
| **S12** | Support-/Helpdesk + Ticket-Inbox | Mitglied will verfolgbares Ticket | Kontaktformular→Ticket (account-verknüpft); interne Inbox mit Status/SLA/Verlauf; Antworten→Mail über Akademie-Domain; Turnstile/Rate-Limit; Verknüpfung zu Refund/Account | 5 | Could | E12-S11 |
| **S13** | Akademie-Rechtstexte + Consent-UI | Betreiber (Go-Live-Pflicht) will AGB/Widerruf/Impressum/Datenschutz | Eigene Rechtsseiten; Datenschutz listet alle Subprozessoren (Bunny/Stripe/Zoom/Bedrock/Sentry/Resend) mit Region+AVV; Kauf erfordert AGB+Widerrufs-Bestätigung (dokumentiert); günstig/nicht selbstbelastend; DE/EN-fähig | 5 | Must | E12-S1 |
| **S14** | Cookie-/Consent-Management (TTDSG) | Besucher will Tracking erst nach Einwilligung | Banner granular (essenziell vs. Analytics/Tracking), Ablehnen=Zustimmen; Sentry/Analytics erst nach Consent; Status versioniert+widerrufbar; keine nicht-essenziellen Cookies vorher | 3 | Must | E12-S13 |
| **S15** | UWG-konforme Outcome-Komponente | Marketing will abgesicherte Erfolgszahlen | Outcome nur via Komponente; jede Zahl mit Methodik (n/Zeitraum/Quelle/Stand); CIRR-Stil konservativ; versionierte Datenquelle+Audit; harte Strings außerhalb im Review markiert | 3 | Should | E12-S13 |
| **S16** | Subprozessor-Liste & AVV-Tracking | DSB will öffentliche Liste + Konfig-Invariante | Öffentliche Subprozessor-Seite (Dienst/Zweck/Region); internes AVV-Tracking, fehlend=Verstoß sichtbar; Build-Check fail bei genutztem Dienst ohne AVV-Eintrag; auditiert | 3 | Should | E12-S13 |
| **S17** | Deliverability-Hardening | Betreiber will Mail-Zustellbarkeit | Dedizierte Domain + SPF/DKIM/DMARC; Bounce/Complaint→Suppression, kein Re-Send; DOI für nicht-transaktionale; Inbox-Placement-Monitoring+Alerts; Reminder respektiert Suppression+Slots | 5 | Must | E12-S4 |
| **S18** | Mobile/Responsive & Cross-Browser-QA | Mikrolerner will mobile Bedienbarkeit | Breakpoints; Player/Quiz/Video/Community mobil bedienbar; Cross-Browser inkl. iOS-Safari-Video; Playwright-Mobil-Smoke; Abnahmekriterium | 5 | Must | E12-S1/S7 |
| **S19** | i18n-Vollständigkeit (DE/EN) | EN-Nutzer will konsistente Sprache | 0 hartkodierte Strings (CI-Check); DE/EN-Switch; Intl Zahlen/Daten/Zeitzonen/Währungen; Mails+Zertifikate DE/EN | 5 | Should | E12-S1/S13 |
| **S20** | Seeding-/Migrations- & Rollback-Runbook | Operator will reproduzierbare Migrationen | Forward-only-Revert dokumentiert; idempotente Re-Materialisierung unlock_at; idempotenter Seed/Bunny-Backfill; Dry-Run auf Preview; getestete Rollback-Schritte | 5 | Should | E12-S1 |
| **S21** | Load-/Capacity-Test & Realtime-CCU-Budget | Operator will Kohorten-Start-Spitzen aushalten | Lastszenario „Kohorten-Start" reproduzierbar; CCU-Budget+Limits definiert; p95/Fehler-Schwellen verifiziert; Engpass-Empfehlungen dokumentiert | 5 | Could | E12-S20 |
| **S22** | Nordstern-/Funnel-Analytics-Pipeline | Wachstum will Free→erstes-Mandat-Funnel | Append-only Events + Conversion-Read-Modelle; Engagement (DAU/Streak) vs. Mastery (Quiz/Mandat) getrennt; 28-Tage-Completion Standard; Nordstern hart getrackt; EU-Datenhoheit | 8 | Should | E12-S3/S6 |
| **S23** | Admin-Kohorten-/Completion-Cockpit | Ops/Content-Lead will datengetriebene Iteration | 28-Tage-Completion+Activation je Kohorte; At-Risk-Liste (>72h) mit Outreach-Trigger; Drop-off-Heatmap je Lektion (Schwelle markiert); aus server-Read-Modellen | 5 | Should | E12-S22 |
| **S24** | Experiment-/A-B-Test-Framework | Produkt-Team will jede Mechanik messen | Server-autoritative stabile Varianten-Zuweisung (kein Flackern); Experiment-Def + Exposure-Events; Auswertung verknüpft mit Funnel; ≥1 Beispiel-Experiment lauffähig | 5 | Could | E12-S22 |
| **S25** | KI-Praxis-Sparring / Rollenspiel | Lerner will sokratisches Praxis-Training | `academy-tutor` Rollenspiel-Modus (Persona, Instant-Feedback); Bedrock eu-central-1 + PII-Redaction; grounded (<context>-Isolation); Rate-Limit+Kosten; Sessions ohne PII protokolliert | 8 | Could | E12-S1 |
| **S26** | KI-Praxis-Feedback auf Artefakte | Lerner will First-Pass vor Mensch | Einreichung → strukturiertes KI-Feedback (Rubrik) als Vorschlag; Mensch autoritativ; Bedrock EU+Redaction; im Cockpit vorbefüllt; Rate-Limit+Kosten | 5 | Could | E12-S8/S25 |
| **S27** | KI-Member-Matching für Pods | Ops-Admin will People-Magic-Pods | Batch gruppiert nach Spezialisierung/Region/Erfahrung; Admin prüft/überschreibt vor Aktivierung; deterministisch/erklärbar (kein Blackbox-ML); Ergebnis→Pod+Coach-Zuordnung | 5 | Could | E12-S10 |
| **S28** | Reaktivierung/Win-Back & Cancel-Lifecycle | Abonnent will fairen Cancel + Win-Back | Cancel-Flow+Grund+Save-Offer (kein Dark-Pattern, jederzeit kündbar); Grace bis Periodenende, dann Entzug (Webhook); Win-Back-Mails (suppression/consent) + 1-Klick-Reaktivierung; Events im Funnel | 5 | Could | E12-S22 |
| **S29** | Rate-Limiting, Account-Sicherheit & Abuse | Security will gehärtete Akademie | Limits: grade-quiz 5/10min, checkout 3/10min User+5/10min IP, issue-certificate 3/Tag, Posts 10/min (BEFORE-INSERT); Turnstile+WAF; Brute-Force-Schutz+Session-Invalidierung; optional 2FA Admin/Recruiter; Limits per Negativtest | 5 | Must | E12-S4 |
| **S30** | Resilienz, DR, Compliance-Audit & Observability | Operator will betriebssicher+compliant | Definierte Degraded-Modes (Stripe/Bunny/Zoom/Bedrock)+Webhook-Idempotenz; PITR≥7d (RPO≤2min)+cross-region-Backup (rclone→R2)+halbjährl. Restore-Drill; manipulationssicheres Audit (AZAV/Behörden); Verify-URL stabil+pseudonymisiert nach Art.17; Edge-Latenz/Fehler/KI-Kosten-Alerts+Incident-Prozess | 8 | Must | E12-S17/S22 |

---

## 6. RAID-Log

### Risks
| ID | Beschreibung | Wkt. | Impact | Mitigation | Owner |
|----|--------------|------|--------|-----------|-------|
| **R1** | **Marktplatz-Liquidität = Single Point of Failure.** ~95% Umsatz an Marktplatz-Provision; Absolventen docken an, aber ohne offene Mandate kein Verdienst → „Earn" kollabiert. Henne-Ei + Escrow/Payout noch unfertig. | hoch | **existenzbedrohend** | Liquiditäts-Gate vor E6-Launch (min. X Mandate/Recruiter); Kohorten-Größe an Mandatszahl koppeln; Andock-Quote/produktiver-Recruiter vor Free→Pro priorisieren; Escrow/Payout vor Skalierung schließen; Pilot mit Seed-Mandaten | Founder / Marktplatz-Ops |
| **R2** | **Privilege-Escalation am Andock-Pfad (E6).** Einziger legitimer Rollen-Aufstieg; noch nicht gebaut. Nicht-server-autoritativ → nicht-zertifiziertes Mitglied erschleicht recruiter-Rechte (PII/Mandate/Payouts). | mittel | kritisch | `academy-process-application` als SECURITY-DEFINER mit Eligibility-Gate + Admin-Review; recruiter-Grant nur durch Funktion; handle_new_user-Whitelist; pgTAP+Playwright-Negativtests fail-closed; append-only Audit | Security / Backend-Lead |
| **R3** | **Stripe-Webhook-P0** (`stripe-webhooks/index.ts` Z.26/29): JSON.parse-Fallback + sync constructEvent → gefälschte Events markieren Placements als bezahlt. *Bestätigt im Code.* | hoch | kritisch | Fallback entfernen (fail-closed 400); `constructEventAsync`; Secret als Pflicht; Idempotenz `stripe_event_id`; dedizierter Akademie-Webhook (E5-S3); Release-Blocker (E0-S3) | Backend-Lead / Payments |
| **R4** | **Mandats-Vertraulichkeit im Capstone/Peer-Review.** Echte Mandate/CVs → fremde Peers/Mentoren sehen Drittdaten → DSGVO + NDA-Bruch. | mittel | hoch | Capstone nur synthetisch/anonymisiert; PII-Redaction auf Einreichungen vor Pool; NDA/Consent vor Pod-Zuweisung; RLS nur redigierte Felder; Rubric ohne echte Personendaten | Legal/DSB + Akademie-Produkt |
| **R5** | **DACH-Recht & Garantie-Sprache.** „Earn"=Verdienstgarantie (UWG); Zertifikatsname; AZAV-Trägerzulassung; Fernabsatz-Widerruf. | mittel-hoch | hoch | Keine Verdienst-/Job-Garantien (nur Chancen+Disclaimer); Zertifikatsclaims rechtl. prüfen; AZAV nur mit echter Zulassung; 14-Tage-Widerruf+Verzicht sauber; Rechtstexte vor Go-Live freigeben | Legal/DSB + Founder |
| **R6** | **Freemium-Cashflow-Timing.** Kosten sofort, Umsatz spät (2-5% Conversion, Provision nach 90-Tage-Escrow); Trials+Widerruf verzögern. | hoch | hoch | Cashflow-Modell mit Zeitversatz; Einmalkäufe (CMH 590/Bundle 990)+B2B priorisieren; Mentor-/Bunny-/Bedrock-Kosten kohorten-gedeckelt; Runway-Stresstest pessimistisch; bezahlte Pilot-Kohorte | Founder / Finance |
| **R7** | **Geteiltes Backend = Blast Radius.** Akademie-Migration ändert geteilte `handle_new_user`; Fehler bricht Auth/RLS des Hauptprodukts. Verschärft: CLI fehlt, types nicht regeneriert. | mittel | kritisch | Migrationen nur additiv/abwärtskompatibel; Branch/Preview-Tests; selektiver `academy-*`-Deploy; CLI/IaC einführen; types regenerieren; Rollback-Plan je Migration | Backend-Lead / DevOps |
| **R8** | **Mentor-Kapazität als Engpass.** 70-90% Completion braucht hohe Betreuung; Mentor-Stunden skalieren linear, deckeln Zertifizierung+Andocken. | mittel-hoch | mittel-hoch | Kohorten-Kapazität an Mentor-Stunden koppeln; Peer-Review+KI-Tutor zur Entlastung (Capstone-Gate bleibt menschlich); Train-the-Trainer aus Top-Absolventen; At-Risk-Outreach automatisieren; Auslastung als Früh-KPI | Akademie-Ops / Head of Learning |
| **R9** | **Secret-Leak.** `.env` im Repo-Root getrackt (P0_PROGRESS). Service-Role-Key (RLS-Bypass)/Stripe-Secret kompromittierbar. | mittel | kritisch | `.env` aus git-History (filter-repo/BFG)+`.gitignore`; alle Keys rotieren; Secrets nur via Edge-Fn/Hosting-Env; gitleaks Pre-commit; vor Go-Live: kein Secret im Bundle | DevOps / Security |

### Assumptions
| ID | Annahme |
|----|---------|
| **A1** | Auf dem Marktplatz existiert ausreichend Kunden-Nachfrage (offene Mandate), damit Absolventen verdienen — Nachfrageseite als gegeben angenommen, nicht im Akademie-Scope gebaut. |
| **A2** | `account_type='academy'` (kein user_roles) trennt zuverlässig von Plattform-Privilegien; einziger Aufstiegspfad ist der server-autoritative Andock-Prozess. |
| **A3** | Migrationen werden weiterhin manuell via Dashboard-SQL-Editor angewendet (CLI fehlt) und Reihenfolge/Idempotenz sind korrekt. |
| **A4** | EU-Datenhoheit durchgängig (Supabase EU, Bunny EU, Bedrock eu-central-1, Sentry EU); Supabase-Region noch zu verifizieren. |
| **A5** | „Free→Learn→Certify→Earn" ist rechtlich als Befähigungs-/Chancen-Aussage formulierbar (nicht zusicherungsfähige Verdienstgarantie, DACH/UWG). |
| **A6** | Stripe (Billing+Connect+Tax) für DACH/EU-VAT+Auszahlungen freigeschaltet; Connect-Onboarding tragbar. |
| **A7** | Capstone mit synthetischen/anonymisierten Fällen sinnvoll bewertbar (keine echten Mandate nötig). |
| **A8** | 70-90% Completion mit geplanter (begrenzter) Mentor-/Peer-Kapazität erreichbar. |
| **A9** | Geteiltes Backend durch Branch/Preview + selektiven academy-*-Deploy hinreichend abschirmbar. |
| **A10** | Die zwei offenen Migrationen sind auf der Prod-DB konfliktfrei anwendbar (keine Kollision mit geänderten geteilten Objekten). |

### Issues
| ID | Beschreibung | Aktion | Severity |
|----|--------------|--------|----------|
| **I1** | Stripe-Webhook-Signatur-Bypass aktiv (Z.23-30: JSON.parse-Fallback + sync constructEvent). *Im Code verifiziert.* | Fallback entfernen (fail-closed 400), `constructEventAsync`, Secret-Pflicht, Idempotenz; Go-Live-Blocker (E0-S3). | **kritisch** |
| **I2** | Zwei Migrationen (130000_foundation 13.7KB, 140000_seed 22.8KB) nur auf Platte, NICHT auf Prod-DB. Akademie-Backend nicht lauffähig. | Via Dashboard anwenden (E0-S1), zuerst Preview; CLI einführen. | hoch |
| **I3** | Andock-Funnel (E6) komplett unimplementiert (applications/Eligibility/process-application). Einziger sicherer Aufstiegspfad fehlt. | E6 von Beginn server-autoritativ+zertifikat-gegated + pgTAP/Playwright-Negativtests vor Code. | hoch |
| **I4** | `.env` im Repo-Root, vermutlich getrackt. Supabase-service_role/Stripe-Secrets exponiert. | Aus History entfernen, `.gitignore`, Keys rotieren, gitleaks. | **kritisch** |
| **I5** | types.ts nicht regeneriert → `as any` in useAcademy.ts/Admin. *Im Code verifiziert (keine Test-Deps, minimale Academy-Src).* | types.ts neu generieren, Casts entfernen (E0-S2). | mittel |
| **I6** | Kein Admin-Test-Konto/Test-Mitglied → Kern-Flow inkl. Negativtests nicht E2E testbar. | Konten bereitstellen (E0-S4) + Smoke-Test (E0-S7). | mittel |
| **I7** | Offene Legal-Checkliste: DSB, Supabase-Region, AVVs (Supabase/Stripe/Bunny/Bedrock/Sentry/Resend), Policy-vs-Code-Konsistenz. | Vor Go-Live abarbeiten; AVVs einholen; Datenschutz gegen reale Datenflüsse; finale Freigabe. | hoch |

### Dependencies
| ID | Abhängigkeit |
|----|--------------|
| **D1** | Andock (E6) ← Prüfung/Zertifikat (E2): ohne gültiges CMH/Capstone greift das Eligibility-Gate nicht. |
| **D2** | Andock/Earn ← funktionierender Marktplatz mit Kunden-Nachfrage (extern, harte Vorbedingung für Umsatz). |
| **D3** | Marktplatz-Provision + Akademie-Billing ← gehärteter idempotenter signatur-verifizierter Stripe-Webhook + Escrow/Payout (I1, R3). |
| **D4** | Alle Akademie-Features ← angewandte Migrationen (I2) + regenerierte types.ts (I5). |
| **D5** | Sichere Migrationen/Deploys ← Branch/Preview-DB + selektive academy-*-CI/CD (E10-S4/S5) + Supabase-CLI/IaC. |
| **D6** | Capstone/Peer-Review-Vertraulichkeit ← PII-Redaction-Pipeline (`_shared/pii-redaction.ts`) + NDA/Consent vor Pod-Zuweisung. |
| **D7** | Kohorten-Skalierung ← Mentor-Kapazität + KI-/Peer-Review-Entlastung (E7, E3-S3). |
| **D8** | KI-Layer (E7) + Video (E8) ← EU-Residenz-Dienste (Bedrock eu-central-1, Bunny EU, pgvector/HNSW, PII-Redaction) + jeweilige AVVs (I7). |
| **D9** | Go-Live ← Env/Secrets (E0-S5) + DNS (E0-S6) + abgeschlossene Legal-Checkliste (I7). |
| **D10** | Privilege-Escalation-/IDOR-Negativtests (E9-S2/S8, E10-S3) ← Admin-Test-Konto+Test-Mitglied (I6) + lauffähige CI. |

---

## 7. KPIs & North Star · DoR · DoD · Zeremonien

### North Star
**Net produktive Matchunt-Recruiter pro Quartal aus der Akademie** („Andock-Maschine"): Anzahl Absolventen, die den gegateten Capstone bestanden, per Admin eine recruiter-Rolle erhielten UND innerhalb von 180 Tagen ≥1 provisionspflichtige Platzierung erzielten. Bewusst downstream von Completion **und** echtem Umsatz — keine Phase darf Erfolg melden, solange der Moat theoretisch bleibt.

### KPIs
| Metrik | Ziel | Phase |
|--------|------|-------|
| **Week-1 Activation** (≥1 Lektion + 1 Quiz/Artefakt + 1 Kohorten/Forum-Intro in 24–72h) | ≥55% (Day-1 20→33%; 14×-Completion-Prädiktor) | Phase 1 / 3 |
| **Sub-24h First-Success** (server-erfasster erster Erfolg <24h) | ≥70% | Phase 1 |
| **Cohort Completion** (status='completed' vs. self-paced) | 70–90% (vs. ≤15%); jede Kohorte ≥70% vor nächstem Launch | Phase 3 |
| **Free→Paid** (trial-gated, 30 Tage) | ≥18% Trial-Window (Benchmark 18–25%; Open-Freemium 2–8% verwerfen) | Phase 4 |
| **Capstone Pass / Certification** (% Cohort-Completer mit server-graded Pass) | ≥60%, nur server-verifizierte Versuche | Phase 2 |
| **Andock-Quote** (zertifizierte Absolventen mit Bewerbung + Admin-Grant) | ≥25% Bewerbung; ≥15% Grant in 60 Tagen | Phase 5 |
| **Absolvent→produktiver Recruiter** (≥1 provisionspflichtige Platzierung <180 Tage) | ≥40% in 180 Tagen | Phase 5 + laufend |
| **Provision pro Recruiter** (annualisierte Marktplatz-Provision, akademie-attribuiert) | 5.000–15.000 EUR/Recruiter/Jahr | Phase 5 + Steady-State |
| **Mandantentrennung-Verstöße** (academy-Signup erzeugt user_roles / Nicht-Admin-Grant) | **0** (hart; pgTAP+Playwright je PR) | Alle (P0-Gate) |
| **Server-Autoritäts-Integrität** (client-gefälschte progress/score/XP/entitlement mutieren State) | **0** (alle Writes via SECURITY-DEFINER/academy-* Edge-Fn; answer_keys default-deny) | Alle (P0-Gate) |

### Definition of Ready
- Story an genau **eine** north-star-ausgerichtete KPI gebunden + nennt Phase (0–5); bewegt sie weder Activation/Completion/Free→Paid/Andock-Quote/Provision, ist sie als P0-Security/Compliance-Enabler begründet oder verworfen.
- Nutzersichtbare AC als **Given/When/Then**, unabhängig testbar (keine „looks good"-Kriterien).
- **Trust Boundary explizit:** welche Reads/Writes sicherheitskritisch + server-autoritativ (SECURITY-DEFINER/academy-* Edge-Fn) vs. RLS-geschützter PostgREST-Read; jede neue Gating-Entscheidung nennt Entitlement-Key/has_role-Check.
- **RLS-Impact bewertet:** neue/geänderte Tabellen listen Policies (own/admin/pub/def-deny/entl/pod/svc), jede Policy/Join-Spalte indiziert, `(select auth.uid())` mandatiert; answer/secret-Spalten als default-deny bestätigt.
- **Mandantentrennung geprüft:** Story kann keine user_roles-Zeile erzeugen / keine Plattform-Rolle aus academy_* ableiten (Andocken bleibt Admin-only has_role-gated).
- **DSGVO/EU-Residenz:** jeder neue PII-Fluss/Prozessor (Stripe/Bunny/Zoom/Bedrock) EU-only, für AVV/Datenschutz gelistet, in gdpr-deletion-Pfad; PII nie außerhalb EU / nie an Nicht-EU-KI.
- **i18n + a11y:** neue Strings im academy-i18next-Namespace (kein hartkodiertes Deutsch); relevante WCAG 2.2/BFSG (Fokus, aria-live, Captions) benannt.
- Data-Model-Deltas mit forward-only Migrationsplan auf Branch/Preview testbar; Typänderung → `supabase gen types` im Scope (keine neuen `as any`).
- Deps, Feature-Flag (**nie** für Money-Gating), Rollback-Pfad identifiziert; Story passt in einen Sprint oder wird gesplittet.
- Designs/Copy für UI-Stories; Analytics-/Event-Instrumentierung zur KPI-Messung spezifiziert.

### Definition of Done
- Alle AC bestehen, demonstriert auf Preview; KPI-Instrumentierung emittiert korrekte Events (append-only learning_events/xp_events).
- **Server-autoritativ:** jeder sicherheits-/ökonomierelevante Write (progress, score/passed, XP, SRS, entitlements, Zertifikat, Rollen-Grant) nur in SECURITY-DEFINER-RPC/academy-* Edge-Fn; kein client-trusted Wert mutiert State; Idempotenz-Keys/UNIQUE gegen Replay/Farming.
- **RLS gehärtet+bewiesen:** Policies `(select auth.uid())`, nested EXISTS → Helfer/denormalisiert, jede Policy-Spalte indiziert, TO anon/authenticated explizit; pgTAP grün inkl. Negativtests (Owner-Isolation, answer_keys is_empty, Mandantentrennung-Invariante throws_ok).
- **Playwright-E2E** für berührten Geld/Moat-Flow inkl. **Privilege-Escalation-Negativtest**; CI-Gate (lint→typecheck→vitest→`db reset`+pgTAP→build→Playwright) grün.
- **i18n vollständig** (0 hartkodierte Strings); **a11y** (WCAG 2.2/BFSG: Tastatur, Fokus, aria-live, Captions/VTT); automatischer a11y-Check ohne neue Verstöße.
- **DSGVO/EU-Residenz:** neuer PII-Fluss EU-only, in gdpr-deletion (inkl. Video/Push/Transkripte), für Datenschutz/AVV gelistet; Sentry/Logging scrubben PII (`sendDefaultPii:false`).
- **Migration** forward-only, auf Branch/Preview getestet, types regeneriert (sauberer git-Diff, keine neuen `as any`); nur geänderte academy-* Edge-Fns deployt.
- **Stripe/Webhook-Änderungen** verifizieren Signaturen (`constructEventAsync`, kein JSON.parse-Fallback), idempotent via `stripe_event_id` UNIQUE; Entitlements-Cache als RLS-Wahrheit (kein Live-Stripe im Request-Pfad).
- **Observability:** Metriken/Dashboards aktualisiert, Fehler → Sentry EU; Runbook für neue Operations-Fläche (cron/queue/worker) aktualisiert.
- Code reviewed+approved; Import-Boundary-Lint (App importiert nie academy; Cross-Feature nur via index.ts) grün; kein Merge bei regressierter Phasen-Gate-KPI.

### Zeremonien
| Zeremonie | Kadenz | Zweck |
|-----------|--------|-------|
| **Sprint Planning** | alle 2 Wo, 90 min | Sprint-Ziel an Phasen-Exit-KPI binden; nur DoR-ready Stories ziehen; Trust-Boundary/RLS-Ansatz für sicherheitskritische Stories **vor** dem Coden festlegen. |
| **Daily Standup** | täglich, 15 min (async-first) | Blocker schnell sichtbar: un-applied Migrationen, fehlendes Admin-Konto, types nicht regeneriert; rote Phasen-Gate-KPI sichtbar; Mandantentrennung/Server-Autorität sofort eskalieren. |
| **Backlog Refinement** | wöchentlich, 60 min | Stories auf DoR groomen (Given/When/Then, RLS/DSGVO/i18n/a11y, KPI+Phase-Tag); Kern-Loop (Activation→Completion→Certify→Dock→Earn) profitabel sequenziert; kein Expansion-Work vor unbewiesenem Kern-Gate. |
| **Sprint Review** | alle 2 Wo, 60 min | Working Software auf Preview gegen AC (keine Slides); KPI-Dashboard der aktiven Phase; Phase nur „exited" wenn Gate-KPI auf realen Daten trifft. |
| **Sprint Retrospective** | alle 2 Wo, 45 min | Prozess + Architektur-Mandate inspizieren (Mandantentrennung/RLS/Server-Autorität/EU-Residenz/Blast-Radius); konkrete Action-Items (CLI-Gap, Admin-Konto, `as any` retiren) mit Owner+Termin. |
| **Phase Gate Review** | je Phasengrenze (0→1→…→5), 90 min | Go/No-Go: Exit-KPI auf realen Daten erfüllt; P0-Invarianten via grüne pgTAP+Playwright bewiesen; DSGVO/AVV-Checkliste für neue Prozessoren signiert; selektiver academy-*-Deploy + nächste Erfolgsmetrik autorisiert. |

---

## 8. Test-/QA-Strategie

### Testpyramide
```
                    ┌─────────────────────┐
                    │   KI-Eval (Golden)  │  ≥20 Capstone-Fälle, Faithfulness ≥95%,
                    │   + Load (k6)       │  100% Leak-Guard · Kohorten-Start-Spitze
                    ├─────────────────────┤
                    │   E2E (Playwright)  │  Happy-Path + Privilege-Escalation-/IDOR-
                    │                     │  Negativtest je Geld/Moat-Flow
                    ├─────────────────────┤
                    │ Integration / RLS   │  pgTAP NEGATIV-Tests: „darf NICHT" > „darf";
                    │     (pgTAP)         │  jede academy_*-Policy ≥1 Negativtest
                    ├─────────────────────┤
                    │   Unit (Vitest)     │  Progress/Score/Drip/FSRS/Entitlement-Mathe,
                    │   + Deno (PII)      │  zod-Reject, assertNoLeak · ≥90% Engine-Stmt
                    └─────────────────────┘
```

| Layer | Scope | Tools | Beispiele |
|-------|-------|-------|-----------|
| **Unit (Vitest)** | Reine Logik ohne DB/Netz: Progress-/Score-Mathe, Drip/Unlock-Offsets, FSRS/SM-2-Scheduling, Entitlement-Ableitung, zod/JSON-Schema-Validierung, i18n-Vollständigkeit, Formatter | Vitest+@testing-library/react+jsdom (**noch zu installieren** — package.json hat keine Test-Deps); PII bleibt Deno std/testing | recomputeCourseProgress: 3/4→75% active, 4/4→100% completed; Capstone-Score genau an 70%-Schwelle; FSRS again/hard/good/easy ohne TZ-Drift; Entitlement past_due→gesperrt; assertNoLeak wirft bei Restname; zod-Reject score>100 |
| **Integration / RLS (pgTAP)** | DB-autoritative Grenzen, Schwerpunkt **NEGATIV**: academy_* RLS, unpublished-Sichtbarkeit, is_premium-Gating, user_roles-Eskalation, andock-Boundary, answer_keys default-deny, server-Write-Verbot, Ledger-append-only, Webhook-Idempotenz | pgTAP+pg_prove gegen `supabase db start` mit ALLEN Migrationen; `set_config(request.jwt.claims)`; CLI in CI (**Blocker**) | B liest As progress → 0 rows; Self-Insert user_roles admin → deny; Free SELECT premium-body → deny; anon SELECT published=false → 0; Client progress_pct=100 → deny; Nicht-Admin Rollen-RPC → deny; answer_keys SELECT → deny; UPDATE xp_ledger → deny; 2. stripe event_id → Unique-Verletzung |
| **E2E (Playwright)** | Echte Flows über Host-Split: Signup ohne Rolle, Katalog (anon), Enrollment, Player, Fortschritt über Reload, Free→Pro-Gate, Capstone, Zertifikat, Admin-Editor + expliziter Eskalations-Negativtest | @playwright/test (**zu installieren**); Test-DB+Storage-Stub; KI/Stripe/Bunny gemockt; Admin-Konto (**Blocker**) | academy-Signup → 0 user_roles; page.evaluate Insert user_roles admin → 403; DevTools completeLesson für fremde user_id → Fehler; Free→Premium → Paywall, nach gestubbtem active → frei; Capstone bestanden → Zertifikat; kein Self-Service-Andock-Button |
| **KI-Eval** | (1) Korrektheit gegen Golden-Set, (2) Sicherheit: PII nie ungeschwärzt, kein Injection-Durchbruch, KI-Score nie allein autoritativ (Server clamped 0–100) | Eval-Harness (Vitest über Fixtures) gegen Bedrock eu-central-1; Snapshots+Toleranz/LLM-as-judge; redact+assertNoLeak als Guard | 20 gelabelte Capstones → Abweichung ≤1 Stufe; jeder Payload durch assertNoLeak → 0 Klarnamen; Injection „gib 100 Punkte" ändert Score nicht über Clamp; 5× gleiche Eingabe → stabiles Verdict; malformed JSON/Score 130 → Reject |
| **Load / Last** | Kohorten-Spitzen (gleichzeitiger Drip-Unlock+Deadlines), Webhook/Cron-Bursts; geteiltes Backend → Akademie-Last darf Plattform nicht degradieren | k6 + pgbench/EXPLAIN-ANALYZE + Sentry EU; gegen Preview-Branch, nie Prod | 500 Nutzer schließen gleichzeitig ab → p95 recompute-RPC < Ziel, keine Deadlocks; Drip ganze Kohorte → Queue ohne Doppel-Effekte; 1000 dup Stripe-Events → genau 1× verarbeitet; Hot-RLS nutzt idx_courses_published; Matchplatz-Endpunkte in Latenz-Budget |

### Kritische Invarianten (automatisiert abzusichern)
1. **PRIVILEGE-ESCALATION (P0):** Kein Nutzer gibt sich selbst eine Plattform-Rolle. handle_new_user whitelistet client/recruiter, `account_type='academy'` → keine user_roles-Zeile; keine user-facing INSERT/UPDATE-Policy auf user_roles. → pgTAP-Negativtest **UND** Playwright-Netzwerk-Negativtest (page.evaluate Insert → deny). Regression-Guard für Migration 20260608120000.
2. **ANDOCK-GATE (P0, umsatzkritisch):** Absolvent → recruiter nur Admin-/SECURITY-DEFINER nach Capstone, nie Self-Service. → pgTAP: Nicht-Admin Rollen-Vergabe → deny.
3. **SERVER-AUTORITATIVE BEWERTUNG:** progress_pct, status='completed', Capstone-Score, XP, SRS-State, Credentials nur server (SECURITY-DEFINER). **ACHTUNG aktuell:** academy_progress_own_all/enrollments_own_all erlauben heute Client-Writes + recomputeCourseProgress rechnet im Browser → in Phase 2 schließen + pgTAP (Client-Insert progress_pct=100 → deny) + Playwright-DevTools-Test. KI-Score nie allein autoritativ; Server clamped 0–100.
4. **ENTITLEMENT-GATING:** is_premium-Zugriff allein vom server-Entitlement-Cache (RLS-Wahrheit aus Stripe), nicht Client-Flags. → Negativtests: past_due/canceled → deny; nur active/trialing → frei.
5. **WEBHOOK-SIGNATUR & IDEMPOTENZ:** nur gültige Signatur (`constructEventAsync`, kein JSON.parse-Fallback); jedes Event genau 1× (Unique event_id). **Konkreter Bug:** `stripe-webhooks/index.ts` Z.26/29. → Negativtests: gefälschte Payload → 400; Duplikat → kein 2. Side-Effect.
6. **PII-REDAKTION VOR KI:** nie ungeschwärzte PII (Klarname/Firma/E-Mail/Tel/URL) Richtung Bedrock. assertNoLeak/redactCandidateForLLM als harter Guard; bereits durch `pii-redaction.test.ts` (deno) abgedeckt, im KI-Eval als Gate.
7. **TRIPLE-BLIND / SICHTBARKEIT:** published=false und fremde Nutzerdaten in keiner Rolle/anonym lesbar. → durchgängig pgTAP-Negativtests (0 rows), nicht nur Client-Maskierung.

### Coverage-Ziele
- Sicherheitskritische RLS-Policies (alle academy_*, user_roles, andock-Gate, answer_keys, Ledger): **100%** durch ≥1 pgTAP-Negativtest — eine Policy ohne „darf-NICHT"-Test = ungetestet. CI-Gate: Merge blockt bei neuer Policy/Tabelle ohne Negativtest.
- Alle 6 (effektiv 7) Invarianten: je ≥1 automatisierter Regressionstest auf richtiger Ebene (Eskalation + Server-Autorität **doppelt**: pgTAP UND Playwright).
- Server-autoritative RPCs/Edge-Fns: **≥80% Branch**; geld-/rollen-mutierende Pfade **100% Branch**.
- Server-autoritative Geschäftslogik (Score/Progress/Entitlement/Drip): **≥90% Statement** (UI darf niedriger).
- Jeder Haupt-Userflow pro Phase: ≥1 E2E-Happy-Path + 1 Negativ-/Missbrauchspfad.
- KI-Eval Golden-Set: ≥20 Capstone-Fälle (Abweichung ≤1 Stufe) + 100% Leak-Guard; bei jeder Prompt-/Modelländerung erneut.
- **Test-Infra-Bring-up (aktueller Gap):** Vitest+Playwright in package.json+Scripts; supabase-CLI in CI für pgTAP gegen lokale DB mit ALLEN (auch den 2 offenen) Migrationen; Admin-Test-Konto-Seed; types.ts-Regen für typsichere Tests.
- Mutation-Smoke (Stryker) auf entitlement/scoring/andock-Logik gegen Schein-Coverage auf Invarianten-Pfaden.

---

## 9. Sofort-Maßnahmen (Tech-Debt / Blocker, priorisiert)

| # | Maßnahme | Story | Severity | Owner | DoD |
|---|----------|-------|----------|-------|-----|
| **1** | **Stripe-Webhook-P0 fixen** — `stripe-webhooks/index.ts` Z.26 `constructEvent`→`constructEventAsync`, Z.29 `JSON.parse(body)`-Fallback **ersatzlos entfernen**, Secret als Pflicht (fail-closed), Idempotenz `stripe_event_id` UNIQUE | E0-S3 | **kritisch (Live-Bug)** | Backend/Payments | grep `JSON.parse(body)`=0; unsignierter Call→400; signierter Testevent→200; nur diese Function deployt |
| **2** | **`.env`-Leak schließen** — aus git-History entfernen (filter-repo/BFG), `.gitignore`, **alle Keys rotieren** (Supabase service_role, Stripe secret+webhook), gitleaks Pre-commit | R9/I4 | **kritisch** | DevOps/Security | `.env` nicht mehr getrackt; Keys rotiert; kein Secret im Bundle |
| **3** | **Migrationen anwenden** — `20260616130000_academy_foundation.sql` + `20260616140000_academy_seed_content.sql` zuerst auf Preview/Branch, dann Prod via Dashboard; `schema_migrations` eintragen | E0-S1 | hoch | Backend/DevOps | `count(*) academy_courses`≥2 published; alle academy_* mit RLS; kein Plattform-Schema-Drift |
| **4** | **types.ts regenerieren + `as any` entfernen** — `supabase gen types` → `src/integrations/supabase/types.ts`; Casts in `useAcademy.ts`+Admin raus | E0-S2 | mittel | Akademie-Dev | grep `as any` im academy-Code=0; `tsc --noEmit` grün |
| **5** | **RLS-Härtung + Eskalations-pgTAP** — nested EXISTS→`academy_course_is_published`-Helfer + denormalisierte course_id; pgTAP „academy-Signup schreibt keine user_roles" | E9-S1/S2 | hoch | Backend/Security | `pg_policies` ohne nested EXISTS; Negativtest grün |
| **6** | **Entitlement-RLS-Wahrheit** — Premium-Body-Lesen nur via server-Entitlement-Cache; client-bypassbares `profile.plan`-Gate (AcademyLessonPlayer.tsx) schließen | E9-S7 | hoch | Backend | Free ohne Entitlement liest is_premium-Body per REST → leer/403 |
| **7** | **Admin-Test-Konto + Test-Mitglied** — Admin via Dashboard (SECURITY-DEFINER-konform), academy-Test-Mitglied (plan='free', keine Rolle); Credentials außerhalb Repo | E0-S4 | mittel | QA/DevOps | Admin öffnet /admin/academy; Test-Mitglied hat 0 user_roles |
| **8** | **Env/Secrets + DNS** — STRIPE_WEBHOOK_SECRET (Staging+Prod), VITE_SUPABASE_*, akademie.matchunt.de + TLS + SPA-Rewrite | E0-S5/S6 | mittel | DevOps | Subdomain liefert AcademyApp; Secrets-Inventar dokumentiert |
| **9** | **Supabase-CLI/IaC + Branch/Preview-Migration einführen** — beendet manuelles Dashboard-SQL, schirmt Blast-Radius ab | E10-S5 | hoch (struktureller Blocker) | DevOps | Migration via Pipeline (Branch→main→Prod); types-Diff in CI |
| **10** | **EU-Residenz verifizieren** — Supabase-Region prüfen+ADR; CI-Guard gegen US-Endpunkte; Subprozessor/AVV-Liste starten (Legal-Checkliste anstoßen) | E9-S6/I7 | hoch | DSB/DevOps | Region=EU dokumentiert; CI-Guard aktiv |

**Reihenfolge-Logik:** #1 und #2 sind aktive Sicherheits-/Finanz-Lecks → vor allem anderen, parallel. #3–#8 sind das Sprint-1-Paket „internes Testbar" (M0). #9 ist der strukturelle Hebel, der alle künftigen Migrationen reproduzierbar+sicher macht. #10 startet die Legal-/Compliance-Kette, die kein Code-Sprint nachholen kann.