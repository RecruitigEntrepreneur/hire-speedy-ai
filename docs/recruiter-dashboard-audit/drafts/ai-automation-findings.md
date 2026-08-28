# AI, Matching & Task-Automatisierung — Inventur (Agent 6, §7.10 / §7.13)

**Audit-Datum:** 2026-07-21 · **Bewertungsgrundlage:** aktueller Dateistand auf Platte (main + uncommittete Änderungen), nicht Git-Historie. Laufzeitzustand der Live-Datenbank (Cron-Ausführung, gesetzte `app.settings`, Env-Flags, angewandte Migrationen) ist aus dem Repo nicht verifizierbar und wird explizit als NICHT_BEWERTBAR markiert, wo er entscheidend ist.

**Leitfrage (Headhunter-Perspektive):** Welche KI hilft dem Recruiter HEUTE nachweislich, Mandate zu besetzen und bezahlt zu werden — und welche ist Fassade, Zombie oder Risiko?

---

## 1. Kernbefund in einem Absatz

Das produktive Matching ist eine deterministische Regel-Engine (`calculate-match-v3-1`) ohne LLM, die im Recruiter-Flow nur noch an zwei schmalen Stellen wirkt: als Hero-Widget-Zähler auf der Kandidaten-Detailseite und als Einmal-Score beim Einreichen (nur Toast). Die reichhaltige Erklär-UI (MatchScoreCardV31, Explainability, KI-Empfehlung) ist durch die aktuellen Working-Tree-Umbauten **verwaist** — alle drei Eltern-Komponenten sind nirgends mehr gemountet. Der in Pipeline und Submission-Detail angezeigte `submissions.match_score` wird von keinem aktiven Matcher mehr geschrieben (Split-Brain). Embeddings sind konstruktionsbedingt tot (64-dim-Output in `vector(1536)`-Spalten). Parallel existiert eine saubere, aber noch unsichtbare neue Generation: Match V4 (Shadow-LLM-Judge mit PII-Redaction, Evidenz-Zwang, Pair-Cache), ein Eval-Harness mit eingefrorener Baseline und eine Lern-Schleife (`match_events`). Das Task-/Action-Center (Unified Inbox + ActionSession) ist das reifste Recruiter-Stück — hängt aber für systemgenerierte Aufgaben an einer pg_cron-Verdrahtung, deren Funktionieren im Repo nicht nachweisbar ist. Dazu kommen unauthentifiziert aufrufbare Engine-Funktionen und `USING (true)`-RLS-Policies auf ML-Tabellen.

---

## 2. Prior-Art-Verifikation

Geprüfte Quellen: `docs/godmode/07-matching-engine.md`, `docs/godmode/12-automation-engines.md`, `docs/ai/STATE_OF_THE_UNION.md` (2026-07-16), `RECRUITER_DASHBOARD_GODMODE_ANALYSE.md` (2026-07-18).

| # | Behauptung (Prior-Art) | Ergebnis | Beleg |
|---|---|---|---|
| P1 | „Drei divergierende Match-Score-Quellen" | **VERIFIZIERT** — (a) `submissions.match_score` (Alt-Writer v1/v2/v3), (b) Live-V3.1-Batch ohne Persistenz, (c) clientseitiges `useJobMatching` mit eigenen Gewichten 0.35/0.25/0.25/0.15. (c) ist inzwischen tot (Komponenten unmounted) — es bleiben zwei divergierende Quellen plus Fit-Assessment als dritte Score-Familie für Clients | `calculate-match-v3/index.ts:188-191`; `calculate-match-v3-1/index.ts:679-695` (kein submissions-Writeback); `src/hooks/useJobMatching.ts:103-106`; Anzeige: `src/pages/recruiter/SubmissionDetail.tsx:456-541` |
| P2 | „V3.1-Matcher defekt" | **TEILWEISE VERIFIZIERT / NICHT MEHR AKTUELL** — Der NaN-Config-Defekt (fehlendes `seniority`-Gewicht → Fit=50 für alle) ist dokumentiert und laut Eval-README am 2026-07-18 per Config-Update gefixt (Commit `1f91a13` „Fixed missing seniority config"). Engine-Code selbst ist funktionsfähig; Rest-Defekte: Config-Profil-Lücke, Reads auf fraglich deployte Spalten | `evals/README.md` (Abschnitt „Drei Baseline-Varianten", Variante 1); `calculate-match-v3-1/index.ts:916-955` liest `jobs.visa_sponsorship`/`required_languages` — beide fehlen in `src/integrations/supabase/types.ts` (0 Treffer für `visa_sponsorship`) |
| P3 | „Tote Embeddings" | **VERIFIZIERT** — `generate-embeddings` erzwingt exakt 64 Dimensionen, Schema ist `vector(1536)` mit HNSW-Index; keine Folge-Migration ändert die Dimension | `supabase/functions/generate-embeddings/index.ts:223-225`; `supabase/migrations/20260122214438_…sql:6,12,38-42` |
| P4 | „Phantom-Matching-Spalten" | **VERIFIZIERT** — `generate-match-recommendation` selektiert `importance, skill_level` aus `job_skill_requirements`; die Tabelle hat `type, weight` | `generate-match-recommendation/index.ts:243`; Schema: `20260114011942_…sql:44-53` |
| P5 | „pg_cron fehlerhaft, doppelte Alerts" | **TEILWEISE VERIFIZIERT** — Dubletten-Ursache ist behoben (Cleanup + partieller UNIQUE-Index). Cron-Jobs hängen an `current_setting('app.settings.…')` ohne Fallback — ob sie laufen, ist im Repo nicht nachweisbar (NICHT_BEWERTBAR) | `20260225200000_unified_task_inbox.sql:28-41` (Dedup), `:136-195` (4 Cron-Jobs mit `current_setting`) |
| P6 | „Zwei Influence-Engines mit unterschiedlichen Formeln" | **VERIFIZIERT** — beide schreiben `recruiter_influence_scores`; `calculate-influence-score` mit Gewichten 0.3/0.25/0.25/0.2 und hartkodierten Mock-Plattform-Durchschnitten; `influence-engine` mit eigener Berechnung | `calculate-influence-score/index.ts:134-137,154`; `influence-engine/index.ts:181,549,612` |
| P7 | „CandidateJobMatchingV3 ist die produktive V3.1-Ansicht" | **NICHT MEHR AKTUELL** — alle drei Mount-Punkte (`CandidateProcessTab`, `CandidateOverviewTab`, `CandidateDetailSheet`) sind im aktuellen Dateistand nirgends gemountet; die Erklär-UI ist verwaist | grep über `src/`: keine Verwendung von `CandidateProcessTab`/`CandidateOverviewTab`/`CandidateDetailSheet` außerhalb der eigenen Dateien |
| P8 | „PII-Redaction nur in 1 von ~26 LLM-Funktionen" | **NICHT MEHR AKTUELL** — jetzt 2: `assess-candidate-fit` und `calculate-match-v4` (beide fail-closed mit `assertNoLeak`) | `assess-candidate-fit/index.ts:111-177`; `calculate-match-v4/index.ts:128,155-162` |
| P9 | „normalize-skills ruft falschen Host `api.lovable.dev`" | **VERIFIZIERT** — zusätzlich betrifft dies `process-interview-notes` (dort mit `gpt-4o-mini`) | `normalize-skills/index.ts:121`; `process-interview-notes/index.ts:76,83` |
| P10 | „Alerts im Dashboard unsortiert (`slice(0,5)` nach created_at)" | **NICHT MEHR AKTUELL** — Dashboard nutzt jetzt dieselbe Unified Inbox, die nach Priorität → Impact → Datum sortiert | `RecruiterDashboard.tsx:199,459`; `useUnifiedTaskInbox.ts:444-448` |
| P11 | „9.188 verschmutzte match_outcomes-Zeilen (synthetisch)" | **TEILWEISE VERIFIZIERT** — Zahl stammt aus dem Migrations-Kommentar (DB-Zustand nicht prüfbar); der Mechanismus ist belegt: `seed-ml-training-data` schreibt ohne Synthetik-Flag in dieselben Tabellen wie echte Outcomes | `20260718150000_match_v4_foundation.sql:4-5`; `seed-ml-training-data/index.ts:255-284` (kein `is_synthetic`-Feld im Insert) |

---

## 3. Matching-Landschaft (§7.10)

### 3.1 Welche Version ist produktiv?

| Engine | Aufrufer im aktuellen Dateistand | Persistiert | Status |
|---|---|---|---|
| `calculate-match` (v1, LLM) | **keine** (0 Invokes in src/ und functions/) | `submissions.match_score` (`index.ts:167-176`) | Zombie |
| `calculate-match-v2` (LLM+Routing) | nur `useMatchScoreV2` → `CandidateJobMatchingV2.tsx`, `talent/CandidateDetailPanel.tsx` — **beide nirgends gemountet** | `submissions.match_score` (`index.ts:817-827`) | Zombie |
| `calculate-match-v3` | nur `useMatchScoreV3` — **kein Komponenten-Consumer** | `submissions.match_score(_v3)` + `match_outcomes` (`index.ts:188-191`) | Zombie |
| **`calculate-match-v3-1`** | `useMatchScoreV31.ts:131` ← `CandidateHeroMatching.tsx:17` (via `CandidateMainContent.tsx:61` in `RecruiterCandidateDetail.tsx:237`) und `recruiter/CandidateSubmitForm.tsx:64,439` | **nur** `match_outcomes` ohne `submission_id` (`index.ts:679-695`) | **PRODUKTIV** |
| `calculate-match-v4` (Shadow) | keine UI; nur `run-v4-shadow-batch` (manuell); Flag `MATCH_V4_ENABLED` (`index.ts:57`) | `match_ai_judgements`, `match_events` | Shadow/Experiment |
| `talent-pool-match` | **keine** (0 Invokes; kein Cron in Migrationen) | `talent_alerts` | Zombie |
| clientseitig `useJobMatching` | nur in unmounted `CandidateJobMatching(V2).tsx` | — | Zombie |

### 3.2 Welche Scores sieht der Recruiter wo — und aus welcher Quelle?

| UI-Stelle | Angezeigter Score | Quelle | Problem |
|---|---|---|---|
| `/recruiter/submissions/:id` (`SubmissionDetail.tsx:456-541`) | „Match X%" + Fortschrittsbalken | `submissions.match_score` | Wird von **keinem aktiven** Matcher geschrieben — Alt-Writer v1/v2/v3 sind Zombies. Für neue Submissions bleibt die Spalte leer, alte Werte stammen aus toten Engines mit anderen Formeln |
| Pipeline-Karten (`SubmissionsPipeline.tsx:119-123`, `JobCandidateProcessCards.tsx:242-248`) | „X% Match" | `submissions.match_score` | dito |
| Kandidaten-Detail Hero (`CandidateHeroMatching.tsx:138-146`) | Tier-Zähler („🔥 N Hot") | Live-V3.1-Batch (preview-Mode) | Wird nicht persistiert; „Details"-Klick ruft `onNavigateToMatching={() => {}}` — **leerer Callback** (`CandidateMainContent.tsx:61`), führt nirgendwohin |
| Einreichen (`CandidateSubmitForm.tsx:439-450`) | Score nur im Erfolgs-Toast | Live-V3.1-Single | Danach nirgends wieder auffindbar |
| Erklär-UI (`MatchScoreCardV31`, Explainability, `AIRecommendationBadge`) | Reasons/Risks/Empfehlung | V3.1 + `generate-match-recommendation` | **Verwaist** — nur in `CandidateJobMatchingV3.tsx:709,718` verbaut, dessen sämtliche Eltern unmounted sind |

**Konsequenz für den Headhunter:** Er trifft Submit-Entscheidungen auf Basis eines Scores, den er nach dem Toast nie wieder sieht, und verhandelt mit Clients über einen Pipeline-Score, der aus einer toten Engine stammt oder fehlt. Das begründet Status FEHLERHAFT für die Score-Anzeige.

### 3.3 Embeddings & Vektorsuche

- `generate-embeddings` lässt Gemini ein 64-dim-„Feature-Vektor" selbst raten (`index.ts:37-73,146-167`) und validiert hart auf Länge 64 (`:223-225`).
- Schema: `candidates.embedding`/`jobs.embedding` = `vector(1536)`, HNSW-Index, RPCs `find_similar_candidates`/`search_candidates_hybrid` erwarten 1536 (`20260122214438_…sql:6,12,38-42,100-129`). Keine Migration ändert die Dimension → Inserts können nicht gelingen.
- **UI läuft ins Leere:** `SimilarCandidates.tsx` ist gemountet (`CandidateProfileTab.tsx:166`, `CandidateDetailSheet.tsx:369`) und ruft `find_similar_candidates`/`search_candidates_hybrid` (`useSimilarCandidates.ts:32,76`) — liefert systembedingt nichts. Einziger Function-Aufrufer: Admin-`EmbeddingHealthWidget.tsx:68`.
- Kein Matcher nutzt Embeddings; es gibt **keine Retrieval-Stufe** (V3.1 scort die per UI übergebenen bis zu 50 Jobs).

### 3.4 Konfiguration & Qualitätssicherung

- V3.1 liest `matching_config` per `profile`; Default-Fallback in `buildConfig` (`calculate-match-v3-1/index.ts:718-729`). Der historische Live-Defekt (fehlendes seniority-Gewicht → NaN → Fit=50 für alle) ist im Eval-README dokumentiert und als am 2026-07-18 gefixt beschrieben (Backup-Zeile `profile='backup-20260718'`) — Live-DB-Zustand hier NICHT_BEWERTBAR.
- **Eval-Harness (`evals/`):** Golden-Dataset (synthetisch `dataset.v1.json` + real `dataset.real.v1.json`), eingefrorene V3.1-Replika mit Drift-Test (`evals/adapters/v31-baseline/drift.test.ts`), Metriken Recall@K/nDCG@10/MRR/Leak@10, CI-Gate `npm run eval:check`, Baselines und Report vom 2026-07-18 committet (`evals/baselines/baseline.v1.json`, `evals/reports/2026-07-18T09-43-59-matching.md`). npm-Scripts: `package.json:13-16`. Das ist das methodisch sauberste AI-Artefakt im Repo — aber reines Dev-Tooling, kein Recruiter-Feature.

### 3.5 Match V4 (Shadow) — Stand des Umbaus

`calculate-match-v4/index.ts`: V3.1 bleibt Stufe 1 (interner Aufruf `:75-89`); LLM-Judge (Gemini 2.5 Flash, Tool-Call-erzwungen `:170-178`) nur für Top-N nicht-gekillte Paare; PII-Redaction pro Job mit fail-closed Leak-Check (`:128,155-162`); Pair-Cache über `input_hash` in `match_ai_judgements` (`:138-151,195-210`); Blending + Shadow-Log nach `match_events` (`:219-238`). Versionierung: `MATCH_V4_VERSION='v4.0.0-shadow'`, `JUDGE_MODEL`, `JUDGE_PROMPT_VERSION='judge-v1'` (`_shared/match-v4.ts:19-21`), Blending-Logik im Harness getestet (`evals/v4/match-v4.test.ts`). `run-v4-shadow-batch` verarbeitet echte Submissions batchweise mit Seed-/Testdaten-Ausschluss (`index.ts:30-35`). Beides flag-gated (`MATCH_V4_ENABLED`), **keinerlei UI-Wirkung** — sauberes Shadow-Design, Nutzen für den Recruiter heute: null.

---

## 4. Parsing-Kette

| Function | Modell/Provider | Aufrufer (UI-Pfad) | Absicherung |
|---|---|---|---|
| `parse-pdf` (PDF→Text) | `google/gemini-2.5-flash`, ganzes PDF als base64 an Gateway, `max_tokens: 8000` (`index.ts:70,103-104`) | `useCvParsing.ts:149` (CV-Upload in `CvUploadDialog`, `CandidateProfileTab`, `recruiter/CandidateSubmitForm`); intern von `process-candidate-import/index.ts:651` | 429-Pass-Through (`:112`), kein Retry, kein Timeout |
| `parse-cv` (Text→Struktur) | `gemini-2.5-flash`, Tool-Calling-Schema (`index.ts:52-59`) | `useCvParsing.ts:179`; `process-candidate-import/index.ts:671` | 429-Handling (`:156-159`); keine Eingabelängen-Begrenzung |
| `parse-job-pdf` | 2-stufig `gemini-2.5-flash`, `max_tokens: 8000`, `temperature: 0.1` (`index.ts:86,100-101,145`) | `useJobPdfParsing.ts:54,84` → `JobIntakeStudio`, `CreateJob` (Client-Intake) | wie oben |
| `parse-job-url` | `gemini-2.5-flash` (`index.ts:168`) | `useJobParsing.ts:58,88` → `JobIntakeStudio`, `CreateJob` | 429 (`:253-256`) |
| `extract-intake-briefing` | **OpenRouter** (`index.ts:73-76`), `temperature: 0.2` | `useIntakeBriefing.ts:59` → `IntakeBriefingSection`, `CreateJob` | separater `OPENROUTER_API_KEY` — zweiter Provider-Pfad |
| `intake-questions` | **OpenRouter** (`index.ts:190-193`) | `DynamicBriefing.tsx:92` | dito |
| `normalize-skills` | `gemini-2.5-flash` über **falschen Host `api.lovable.dev`** (`index.ts:121`) | nur `useMatchScoreV3.ts:79` — **toter Pfad** | AI-Fallback schlägt fehl → confidence-20-Fallback |
| `normalize-job-requirements` | `NORMALIZER_MODEL` mit Versions-Stempel `requirements_normalization_version` und `match_events`-Log (`index.ts:107,163-173`) | **keine Aufrufer** (weder src/ noch Migration/Cron) | idempotent über `requirements_normalized_at` (`:81`) |

**Querschnitt Kostenkontrolle:** Token-Limits nur in den PDF-Parsern; kein Retry/Backoff, kein Timeout (kein `AbortController` im Repo), keine Token-/Kosten-Telemetrie (kein `usage`-Read) — deckt sich mit `docs/ai/STATE_OF_THE_UNION.md` §2, stichprobenverifiziert. Fehlerfall 429 wird dem Nutzer als Fehlermeldung durchgereicht.

**PII:** `parse-pdf` sendet den kompletten CV (inkl. Foto) unredigiert an den Gateway; `parse-cv` extrahiert u.a. Nationalität/Aufenthaltsstatus. Redaction existiert nur in `assess-candidate-fit` und `calculate-match-v4`.

---

## 5. Assessment & Insights — was erreicht den Recruiter nachweislich?

| Capability | Backend | UI-Erreichbarkeit (aktueller Stand) | Befund |
|---|---|---|---|
| Fit-Assessment | `assess-candidate-fit` mit PII-Redaction (fail-closed, `index.ts:167-177`), Cache per `input_hash`+`prompt_version` (`:143-150`), Modell `google/gemini-2.5-flash` (`_shared/fit-assessment.ts:8`), Tests `_shared/pii-redaction.test.ts`; Auto-Trigger auf Submission-INSERT (`20260307000000_fit_assessment_auto_trigger.sql`) | **Client**-Seite (`pages/dashboard/CandidateDetail.tsx`, `CandidateFitAssessmentCard`); Recruiter sieht es nicht | Reifstes LLM-Feature; Trigger-Landmine: die zeitlich spätere Migration `20260307000000:20-23` nutzt `current_setting` **ohne** missing_ok — bei fehlenden `app.settings` wirft der Trigger und kann den Submission-INSERT abbrechen (die tolerante Variante `20260306221420:12-18` wird von ihr überschrieben) |
| KI-Match-Empfehlung | `generate-match-recommendation` (Gemini 3 Flash Preview `index.ts:272`, Cache `match_recommendations` 7 Tage `:144-156`, Triple-Blind-Anonymisierung, `model_version` gespeichert `:411`) | nur via `AIRecommendationBadge` in `CandidateJobMatchingV3.tsx:709` — **verwaist** | Zusätzlich Phantom-Spalten-Read (`:243`) → Must-have-Kontext fehlt still im Prompt |
| Interview-Notizen-KI | `process-interview-notes` → `candidate_ai_assessment` (`index.ts:125-155`) | Recruiter-erreichbar: `useAIAssessment.ts:71` ← `CandidateInterviewTab` (gemountet in `RecruiterCandidateDetail.tsx:208`), `QuickInterviewSummary.tsx:80` | **FEHLERHAFT-Verdacht:** Aufruf gegen `api.lovable.dev` mit `gpt-4o-mini` (`:76,83`) — inkonsistenter Host wie bei normalize-skills |
| Interview-Prep | `generate-interview-prep` → `interview_intelligence` (`index.ts:257`), 3 Gemini-Calls | Hook `useInterviewIntelligence` hat **0 Consumer**; `CandidatePrepView`/`InterviewerGuide`/`RecruiterInsightsPanel` nirgends gemountet | BACKEND_VORHANDEN_UI_FEHLT |
| Kandidaten-Summary | `candidate-summary` | **0 Aufrufer** | Zombie |
| Client-Summary/Exposé | `client-candidate-summary` (`useClientCandidateSummary.ts:145`, `useExposeData.ts:168`), `generate-job-expose` (`AnonymousExposeDialog.tsx:32` — Recruiter-Komponente) | Client bzw. Recruiter-Exposé-Dialog | produktiv |
| Job-Aufbereitung | `format-job-for-recruiters` — Auto-Format bei fehlendem `formatted_content` | `pages/recruiter/JobDetail.tsx:148` | produktiv im Recruiter-Flow |
| Deal-Health | `deal-health` (regelbasiert, → `deal_health`-Tabelle, `index.ts:130-181`) | Admin (`AdminDealHealth.tsx:165`, `DealHealthCard` im AdminDashboard); Recruiter-`RiskReportDialog.tsx:88` existiert, ist aber **nirgends gemountet** | Recruiter-Nutzen: nicht verbunden |
| Verhaltens-Scores | `calculate-scores`, `influence-engine` → `candidate_behavior.closing_probability` etc. | Recruiter-erreichbar: `useCandidateBehavior` ← `CandidateScoreCard`/`CandidatePipelineCard` (RecruiterSubmissions), `RecruiterDashboard` | abhängig von Cron (s. §6) |
| Fraud-Detection | `fraud-detection` (6 Heuristiken, Auto-Block) | Admin-only (`AdminFraud.tsx`, `useFraudSignals.ts:98`) | produktiv, kein ML |

---

## 6. Task-/Action-Center (§7.13)

### 6.1 Erzeugung systemgenerierter Aufgaben — drei Quellen

1. **`influence-engine`** (Cron */15): 7 Alert-Typen, `impact_score`, Playbook-Mapping, idempotenter Upsert `onConflict: 'submission_id,alert_type'` — abgesichert durch partiellen UNIQUE-Index `idx_influence_alerts_active_unique` (`20260225200000:39-41`). Dubletten-Problem der Prior-Art ist damit strukturell behoben.
2. **Clientseitig abgeleitete Aufgaben** (neu, uncommittet): `useUnifiedTaskInbox.ts:193-277` erzeugt `derived`-Items ohne DB-Zeile — „Keine Client-Reaktion seit N Tagen" (ab 3 Tagen, kritisch ab 7) und „Debrief fällig" (Interview vorbei, `feedback IS NULL`), mit €-Fee-Gewichtung (`calcFee`, `:102-111`) und Reveal-sicherer Firmenanzeige (`safeCompany`, `:113-117`). Dedup gegen Engine-Alerts über `alertKeys` (`:432-441`).
3. **Clientseitige Notfall-Erzeugung**: `RecruiterDashboard.ensureInterviewAlerts` inserted fehlende `interview_prep_missing`-Alerts einzeln im Loop (N+1; Duplikate scheitern jetzt am UNIQUE-Index statt sich zu stapeln).

### 6.2 Lifecycle: expires_at, Snooze, Erledigen

- **expires_at:** Query filtert `expires_at.is.null,expires_at.gt.now` (`useUnifiedTaskInbox.ts:310`); täglicher Cleanup-Cron dismisst Abgelaufene (`20260225200000:184-195`).
- **Snooze:** Alerts → `snoozed_until` (Spalte `:11-13`), Tasks → `due_at`-Verschiebung, Derived → **nur localStorage** (`SUPPRESS_KEY`, `:73-100`) — geräteabhängig, nicht synchronisiert; im Code selbst als „Übergangslösung" markiert (`:66-72`).
- **Erledigen:** Alerts → `action_taken='completed'`; Tasks → `status='completed'`; Derived → 3-Tage-Suppression mit Wiederkehr (`:564-588`). Aktivitäts-Log via `logActivity` (`RecruiterInfluence.tsx:73-82`).
- **Konsum:** `/recruiter/influence` (Filter-Tabs, TaskCard, TaskDetailDialog mit 9 kategoriespezifischen Aktionsformularen inkl. Playbook-Telefonskript, `TaskDetailDialog.tsx:151-700,1073`; ActionSession-Fokusmodus `useActionSession.ts`) und Dashboard-Top-5 aus derselben Quelle (`RecruiterDashboard.tsx:199,459`). Realtime-Refetch auf beide Quelltabellen (`useUnifiedTaskInbox.ts:476-502`).
- Die DB-View `unified_task_inbox` (`20260225200000:44-128`) wird vom aktuellen Hook **nicht mehr benutzt** (Direkt-Queries mit Joins) — View ist toter Schema-Ballast mit PII-Spalten (candidate_phone/email) ohne eigene RLS-Definition im Repo.

### 6.3 Zwei Engines, eine Zieltabelle

`influence-engine` (`:549-629`) und `calculate-influence-score` (Gewichte `:134-137`, Mock-Durchschnitte, Upsert `:154`) schreiben beide `recruiter_influence_scores`, mit unterschiedlichen Formeln und unterschiedlicher Cron-Frequenz (15 min vs. stündlich) → der Score-Badge in `RecruiterInfluence` (`useRecruiterInfluenceScore.ts:36`) kann je nach letztem Writer springen. VERIFIZIERT (P6).

### 6.4 Cron-Abhängigkeit — läuft es nachweislich?

**NICHT_BEWERTBAR aus dem Repo, mit konkretem Risikobefund:** Alle 4 Cron-Jobs (`influence-engine-run` */15, `escalation-engine-run` */5, `influence-score-calc` stündlich, `cleanup-expired-alerts` täglich; `20260225200000:136-195`) bauen die URL aus `current_setting('app.settings.supabase_url')` **ohne missing_ok**. Keine Migration setzt diese GUCs (`ALTER DATABASE … SET` fehlt im Repo). Sind sie in der Live-DB nicht gesetzt, wirft jeder Lauf einen Fehler → keine Alerts, keine Scores, kein Cleanup — und der Task-Feed besteht dann nur aus manuellen + abgeleiteten Aufgaben. Dieselbe Abhängigkeit gilt für den Fit-Assessment-Trigger (§5). `escalation-engine` hängt zusätzlich an `sla_deadlines`, die nur `track-event` befüllt (`useEventTracking`-Consumer existieren: `RecruiterDashboard`, Client-Seiten). `automation-hub` (Notification-Fan-out) ist als Database-Webhook verdrahtet — **nicht im Repo versioniert** (VERIFIZIERT, `automation-hub/index.ts:9-14` erwartet Webhook-Payload; keine Migration/Config).

---

## 7. Lern-Schleife

| Baustein | Zustand | Beleg |
|---|---|---|
| `match_outcomes` (Prediction→Outcome) | V3.1 inserted ohne `submission_id` (`calculate-match-v3-1/index.ts:681-692`) → `sync_submission_outcome_to_match`-Trigger (matcht über submission_id) kann V3.1-Predictions nie mit Outcomes verheiraten. Zusätzlich synthetisch verschmutzt (P11) | `20260122214002_…sql:57-77` |
| `ml_training_events` | Trigger-befüllt; **kein Konsument** (keine Function liest sie zur Kalibrierung) | grep: kein Reader außer Admin-Widget |
| `seed-ml-training-data` | Random-Generator, mischt Fake in Echt-Tabellen ohne Flag, `verify_jwt=false`, kein interner Auth-Check | `config.toml:3-4`; `seed-ml-training-data/index.ts:255-284` |
| `track-match-outcome` (record/calibrate) | einziger Invoker ist der tote `useMatchScoreV3.ts:105` → faktisch nur Admin-seitig via MLHealthWidget-Seed erreichbar; `calibrate` ist reines Reporting | `AdminAnalytics.tsx:141` |
| **Neu: `match_events`** (V4) | sauberes Event-Schema mit `is_synthetic`, `model`, `prompt_version`, `rank` — beschrieben von `calculate-match-v4:221-238` und `normalize-job-requirements:168-174`; **kein Konsument, kein UI, Shadow-only** | `20260718150000:17-53` |
| Kalibrierungs-Rückkopplung | **NICHT_VORHANDEN** — nichts schreibt aus Outcomes zurück in `matching_config`; Gewichte werden manuell in `AdminMatchingConfig` gepflegt | VERIFIZIERT (Prior-Art 07.5) |

**Fazit:** „Lern-Schleife" ist heute Datensammlung mit zwei Generationen (alt: verschmutzt und unverknüpfbar; neu: sauber designt, aber leer laufend im Shadow). Es findet kein Lernen statt.

---

## 8. AI-Auditierbarkeit

| Kriterium | Befund |
|---|---|
| Prompt-/Modell-Versionierung | Nur 3 Familien versioniert: Fit-Assessment (`prompt_version` v1/v2-redacted + `model_used`, `assess-candidate-fit/index.ts:125,269-270`), V4-Judge (`JUDGE_PROMPT_VERSION`, `input_hash`), Normalizer (`requirements_normalization_version`). Restliche ~20 LLM-Funktionen: Modell als hartkodierter String, keine Version, kein Registry |
| Logging der AI-Aufrufe | Kein zentrales Log. `match_events` (nur V4/Normalizer), `match_recommendations.model_version`, `candidate_ai_assessment.model_version`. Keine Token-/Kosten-Erfassung, keine Latenz-Metriken (nur `generation_time_ms` vereinzelt) |
| Menschliche Freigabe vor Wirkung | Faktisch gegeben, weil KI nirgends automatisch entscheidet: V3.1 zeigt nur an (Submit bleibt Recruiter-Klick), V4 ist Shadow, Fit-Assessment ist Anzeige für Clients, fraud-detection blockt allerdings **automatisch** (`submissions.status='blocked'` bei critical — einzige KI-lose Automatik mit direkter Wirkung) |
| Reproduzierbarkeit | V4-Pfad reproduzierbar (input_hash + Versionen + Eval-Baseline); V3.1 deterministisch, aber Config-Zustand der Live-DB nicht versioniert; LLM-Parser nicht reproduzierbar |

---

## 9. Sicherheits- und Risiko-Befunde (AI-Domäne)

| # | Befund | Schwere | Beleg |
|---|---|---|---|
| S1 | `USING (true)`-RLS-Policies ohne Rollenbindung auf `match_outcomes` („System can manage match outcomes"), `match_events`, `match_ai_judgements`, `embedding_queue` → für **jede** Rolle (inkl. anon/authenticated via PostgREST) les- und schreibbar. `match_ai_judgements` enthält Kandidaten-Summaries/Red-Flags → Leak- und Manipulationsfläche | **HOCH** | `20251213030355_…sql:93-94`; `20260718150000:47-49,81-83`; `20260122214438:33-34` |
| S2 | `seed-ml-training-data` mit `verify_jwt=false` und ohne internen Auth-Check → jeder kann ML-/Outcome-Tabellen mit Fake-Daten fluten | **HOCH** | `config.toml:3-4`; Function ohne Auth-Prüfung |
| S3 | `influence-engine`, `escalation-engine`, `calculate-influence-score`, `talent-pool-match`, `calculate-scores`, `track-candidate-engagement` mit `verify_jwt=false` und ohne Shared-Secret → öffentlich triggerbar (Kosten/DoS, Notification-Spam, Alert-Erzeugung) | MITTEL | `config.toml:18-19,67-68,79-80,85-86,121-122,82-83` |
| S4 | PII an LLM ohne Redaction in ~20 Funktionen; `parse-pdf` sendet komplettes CV-PDF base64 (inkl. Foto) | **HOCH** (DSGVO) | `parse-pdf/index.ts:63-104`; Redaction nur in 2 Funktionen (P8) |
| S5 | Fit-Assessment-Trigger (strikte Variante) kann bei fehlenden `app.settings` Submission-INSERTs abbrechen | MITTEL | `20260307000000:20-23` (kein missing_ok, kein Exception-Handler) |
| S6 | `unified_task_inbox`-View exponiert candidate_phone/email ohne im Repo definierte View-RLS (security_invoker nicht gesetzt) | MITTEL | `20260225200000:44-128` |

---

## 10. Abschluss-Tabelle: AI-Capabilities → Nutzen für den Recruiter HEUTE

| Capability | Status | Produktiver Nutzen HEUTE | Reifegrad |
|---|---|---|---|
| V3.1-Matching (Engine) | VORHANDEN_PRODUKTIV | Tier-Zähler + Submit-Toast — Entscheidungshilfe stark verengt | 3 |
| Match-Score-Anzeige Pipeline | FEHLERHAFT | irreführend (tote Quelle) | 1 |
| Match-Erklärungen/Empfehlung | VERSTECKT_ODER_NICHT_VERLINKT | keiner (verwaiste UI) | 2 |
| Match V4 + Eval + match_events | VORHANDEN_ABER_UNVOLLSTÄNDIG (Shadow) | keiner (Investition in Zukunft) | 2 |
| Embeddings/Ähnliche Kandidaten | FEHLERHAFT | keiner (leere Ergebnisse) | 1 |
| CV-/Job-Parsing | VORHANDEN_PRODUKTIV | hoch (Kandidaten-/Job-Anlage) | 3 |
| Fit-Assessment (Client) | VORHANDEN_PRODUKTIV | indirekt (Client-Vertrauen) | 4 |
| Interview-Notizen-KI | FEHLERHAFT (Endpoint) | fraglich | 2 |
| Interview-Prep | BACKEND_VORHANDEN_UI_FEHLT | keiner | 2 |
| Task-Center (Unified Inbox + Session) | VORHANDEN_PRODUKTIV | hoch — beste AI-nahe Hilfe zum Geldverdienen | 4 |
| System-Alerts (influence-engine) | VORHANDEN_ABER_UNVOLLSTÄNDIG | abhängig von unbeweisbarem Cron | 3 |
| Lern-Schleife | VORHANDEN_ABER_UNVOLLSTÄNDIG | keiner | 2 |
| Talent-Pool-Match | VORHANDEN_ABER_UNVOLLSTÄNDIG | keiner (nie getriggert) | 2 |
| Deal-Health für Recruiter | VERSTECKT_ODER_NICHT_VERLINKT | keiner (Dialog unmounted) | 3 |

---

## Feature-Zeilen für Master-Matrix

| ID | Domäne | Bereich | Feature | Nutzerrolle | UI-Pfad | Frontend-Dateien | Backend | Tabellen | Status | Reifegrad | Sicherheitsrisiko | Beleg | Empfehlung |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AI-001 | AI & Automatisierung | Matching | KI-Matching V3.1 (Batch-Engine, Hard-Kills, Policy-Tiers) | Recruiter | /recruiter/candidates/:id (Hero) + Submit-Dialog | CandidateHeroMatching.tsx, CandidateSubmitForm.tsx:64/439, useMatchScoreV31.ts:131 | calculate-match-v3-1 | matching_config, job_skill_requirements, skill_taxonomy, skill_synonyms, match_outcomes | VORHANDEN_PRODUKTIV | 3 | NIEDRIG | calculate-match-v3-1/index.ts:676-695; RecruiterCandidateDetail.tsx:237 | Score persistieren; Erklär-UI wieder anbinden; Retrieval-Stufe ergänzen |
| AI-002 | AI & Automatisierung | Matching | Match-Score-Anzeige in Pipeline/Submission (persistiert) | Recruiter | /recruiter/submissions, /recruiter/submissions/:id | SubmissionDetail.tsx:456-541, SubmissionsPipeline.tsx:119-123, JobCandidateProcessCards.tsx:242-248 | kein aktiver Writer (nur Zombie v1/v2/v3) | submissions.match_score | FEHLERHAFT | 1 | KEIN | v3-1 ohne submissions-Writeback (index.ts:679-695); v3-Writer tot | V3.1-Writeback inkl. Versions-Spalte bauen, Altwerte kennzeichnen |
| AI-003 | AI & Automatisierung | Matching | calculate-match v1 (LLM-Match) | — | — | — | calculate-match | submissions | VERSTECKT_ODER_NICHT_VERLINKT | 1 | NIEDRIG | 0 Aufrufer (grep src/ + functions/) | löschen |
| AI-004 | AI & Automatisierung | Matching | calculate-match-v2 (5-Faktoren + Routing) | — | — | CandidateJobMatchingV2.tsx, talent/CandidateDetailPanel.tsx (beide unmounted) | calculate-match-v2 | submissions, routing_cache | BACKEND_VORHANDEN_UI_FEHLT | 2 | NIEDRIG | useMatchScoreV2.ts:51; keine Mounts | löschen inkl. routing_cache |
| AI-005 | AI & Automatisierung | Matching | calculate-match-v3 + track-match-outcome-Clientpfad | — | — | useMatchScoreV3.ts (0 Consumer) | calculate-match-v3, track-match-outcome | submissions, match_outcomes | BACKEND_VORHANDEN_UI_FEHLT | 2 | NIEDRIG | useMatchScoreV3.ts:59,105; kein Komponenten-Import | löschen; calibrate-Report in Admin überführen |
| AI-006 | AI & Automatisierung | Matching | Match V4 Shadow (LLM-Judge, Blending, PII-redaktiert) | — (Shadow) | — | — | calculate-match-v4, _shared/match-v4.ts | match_ai_judgements, match_events | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | NIEDRIG | calculate-match-v4/index.ts:57,128,195-238; Flag MATCH_V4_ENABLED | Shadow-Messung fahren, Go/No-Go-Kriterium aus Eval ableiten |
| AI-007 | AI & Automatisierung | Matching | V4-Shadow-Batch-Runner | Admin/Dev | — (manueller Invoke) | — | run-v4-shadow-batch | match_ai_judgements, match_events | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | NIEDRIG | run-v4-shadow-batch/index.ts:30-60 | nach Messfahrt behalten oder in Cron überführen |
| AI-008 | AI & Automatisierung | Matching | Anforderungs-Normalizer (Job → job_skill_requirements) | — | — | — | normalize-job-requirements | job_skill_requirements, jobs.requirements_normalized_*, match_events | BACKEND_VORHANDEN_UI_FEHLT | 2 | NIEDRIG | 0 Aufrufer; index.ts:148-174 | an Job-Publish-Flow oder Cron anbinden |
| AI-009 | AI & Automatisierung | Matching | Embeddings & Vektorsuche (Ähnliche Kandidaten, Hybrid-Suche) | Recruiter | Kandidaten-Profil (SimilarCandidates-Widget) | SimilarCandidates.tsx, useSimilarCandidates.ts:32/76, EmbeddingHealthWidget.tsx:68 | generate-embeddings | candidates.embedding, jobs.embedding, embedding_queue | FEHLERHAFT | 1 | MITTEL | 64-dim-Check index.ts:223 vs. vector(1536) Migration 20260122214438:6,12 | entweder echtes 1536d-Modell + Drain-Cron oder komplett entfernen |
| AI-010 | AI & Automatisierung | Matching | Talent-Pool-Reverse-Match (Job → Pool-Alerts) | Recruiter | /recruiter/talent-pool (Alert-Anzeige) | useTalentPool.ts:218,246 | talent-pool-match (0 Trigger) | talent_alerts, talent_pool | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | MITTEL | kein Invoke/Cron; config.toml:121-122 verify_jwt=false | bei Job-Publish triggern; Auth-Guard ergänzen |
| AI-011 | AI & Automatisierung | Parsing | CV-Parsing (PDF→Text→Struktur) | Recruiter | CV-Upload (Kandidat anlegen, Submit-Form, Import) | useCvParsing.ts:149/179, CvUploadDialog.tsx | parse-pdf, parse-cv, process-candidate-import | candidates, candidate_experiences, candidate_skills | VORHANDEN_PRODUKTIV | 3 | HOCH | parse-pdf/index.ts:63-104 (CV base64 unredigiert an Gateway) | PII-Redaction/AV-Prüfung vorschalten; Retry+Timeout |
| AI-012 | AI & Automatisierung | Parsing | Job-Parsing (PDF/URL) im Intake | Client | /dashboard/create-job, JobIntakeStudio | useJobPdfParsing.ts:54/84, useJobParsing.ts:58/88 | parse-job-pdf, parse-job-url | jobs | VORHANDEN_PRODUKTIV | 3 | MITTEL | max_tokens 8000, temp 0.1 (parse-job-pdf:100-101) | Fehler-Retry; Ergebnis-Validierung gegen Pflichtfelder |
| AI-013 | AI & Automatisierung | Parsing | Dynamisches Intake-Briefing (Fragen + Extraktion) | Client | CreateJob (DynamicBriefing, IntakeBriefingSection) | useIntakeBriefing.ts:59, DynamicBriefing.tsx:92 | extract-intake-briefing, intake-questions (OpenRouter) | jobs, intake_* | VORHANDEN_PRODUKTIV | 3 | MITTEL | OpenRouter-Endpoint index.ts:73/190 — zweiter Provider, eigener Key | Provider konsolidieren oder Registry einführen |
| AI-014 | AI & Automatisierung | Parsing | Skill-Normalisierung (LLM-Fallback) | — | — | useMatchScoreV3.ts:79 (toter Pfad) | normalize-skills | skill_taxonomy | FEHLERHAFT | 1 | NIEDRIG | falscher Host api.lovable.dev (index.ts:121); 0 lebende Aufrufer | löschen oder auf ai.gateway fixen und in Intake einbauen |
| AI-015 | AI & Automatisierung | Assessment | Fit-Assessment mit PII-Redaction + Auto-Trigger | Client (indirekt Recruiter) | Client-Kandidatendetail | CandidateFitAssessmentCard.tsx, useCandidateFitAssessment.ts:148 | assess-candidate-fit, _shared/pii-redaction(+.test).ts, Trigger trg_generate_fit_assessment | candidate_fit_assessments, submissions | VORHANDEN_PRODUKTIV | 4 | MITTEL | Redaction fail-closed index.ts:167-177; Trigger-Landmine 20260307000000:20-23 | Trigger auf missing_ok+Exception-Handler härten; app.settings versionieren |
| AI-016 | AI & Automatisierung | Assessment | Kandidaten-Summary (Standalone) | — | — | — | candidate-summary | — | BACKEND_VORHANDEN_UI_FEHLT | 1 | NIEDRIG | 0 Aufrufer | löschen |
| AI-017 | AI & Automatisierung | Assessment | Client-Kandidaten-Summary / Exposé-Texte | Client, Recruiter | Client-Ansicht; Recruiter-Exposé-Dialog | useClientCandidateSummary.ts:145, useExposeData.ts:168, AnonymousExposeDialog.tsx:32 | client-candidate-summary, generate-job-expose | candidate_client_summary | VORHANDEN_PRODUKTIV | 3 | MITTEL | Cache versioniert | Redaction nachrüsten |
| AI-018 | AI & Automatisierung | Assessment | KI-Match-Empfehlung (Triple-Blind-Text) | Recruiter (verwaist) | — (nur in unmounted CandidateJobMatchingV3) | AIRecommendationBadge.tsx, useMatchRecommendation.ts:120 | generate-match-recommendation | match_recommendations | VERSTECKT_ODER_NICHT_VERLINKT | 2 | NIEDRIG | Phantom-Spalten index.ts:243 (importance/skill_level ≠ type/weight); Mounts fehlen | Spalten fixen; UI-Anbindung entscheiden |
| AI-019 | AI & Automatisierung | Assessment | Interview-Prep-Generator (Kandidat/Interviewer/Recruiter) | — | — | interview-intelligence/*-Komponenten (unmounted), useInterviewIntelligence (0 Consumer) | generate-interview-prep | interview_intelligence | BACKEND_VORHANDEN_UI_FEHLT | 2 | MITTEL | index.ts:257; keine Consumer | an Interview-Flow anbinden (Wert fürs Closing hoch) |
| AI-020 | AI & Automatisierung | Assessment | Interview-Notizen → KI-Assessment | Recruiter | Kandidaten-Detail (Interview-Tab, QuickInterviewSummary) | CandidateInterviewTab.tsx, useAIAssessment.ts:71, QuickInterviewSummary.tsx:80 | process-interview-notes | candidate_ai_assessment | FEHLERHAFT | 2 | MITTEL | Endpoint api.lovable.dev + gpt-4o-mini (index.ts:76,83) | auf ai.gateway umstellen, Ergebnis verifizieren |
| AI-021 | AI & Automatisierung | Insights | Deal-Health-Score | Admin (Recruiter-Dialog verwaist) | /admin/deal-health | AdminDealHealth.tsx:165, DealHealthCard.tsx; RiskReportDialog.tsx:88 (unmounted) | deal-health (regelbasiert) | deal_health | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | NIEDRIG | RiskReportDialog ohne Mount | Recruiter-Sicht anbinden oder Dialog löschen |
| AI-022 | AI & Automatisierung | Insights | Fraud-Detection (6 Heuristiken, Auto-Block) | Admin | /admin/fraud | AdminFraud.tsx, useFraudSignals.ts:98 | fraud-detection | fraud_signals, submissions | VORHANDEN_PRODUKTIV | 3 | NIEDRIG | Auto-Action blocked/flagged | Auto-Block-Fälle mit Vier-Augen-Review versehen |
| AI-023 | AI & Automatisierung | Task-Center | Influence-Engine (7 Alert-Typen, Impact-Score, Playbooks) | Recruiter | /recruiter/influence, Dashboard-Top-5 | konsumiert via useUnifiedTaskInbox | influence-engine (Cron */15) | influence_alerts, candidate_behavior, coaching_playbooks, recruiter_influence_scores | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | MITTEL | Dedup-UNIQUE 20260225200000:39-41; Cron-GUC-Abhängigkeit :136-149; verify_jwt=false config.toml:79-80 | Cron-Settings versionieren + Heartbeat-Monitoring; Shared-Secret |
| AI-024 | AI & Automatisierung | Task-Center | calculate-influence-score (Zweit-Engine) | Recruiter (indirekt) | Score-Badge /recruiter/influence | useRecruiterInfluenceScore.ts:36 | calculate-influence-score (Cron stündlich) | recruiter_influence_scores | FEHLERHAFT | 2 | MITTEL | Mock-Durchschnitte + Formel-Divergenz zu influence-engine (index.ts:134-137) | eine Engine als Single Source festlegen, andere löschen |
| AI-025 | AI & Automatisierung | Task-Center | Escalation-Engine (SLA-Wächter + Behavior-Scores) | Recruiter/Client (Notifications) | Notifications | — | escalation-engine (Cron */5), track-event | sla_deadlines, sla_rules, user_behavior_scores, platform_events | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | MITTEL | index.ts:28-154; Cron-GUC-Abhängigkeit; verify_jwt=false | wie AI-023 |
| AI-026 | AI & Automatisierung | Task-Center | Automation-Hub (Notification-Fan-out, Auto-Pipeline) | alle | Notifications, Kandidaten-Status | — | automation-hub (Database-Webhook, nicht versioniert) | notifications, candidates, submissions | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | MITTEL | Webhook-Verdrahtung nur in Supabase-Dashboard (index.ts:9-14) | Webhook-Config als IaC dokumentieren/versionieren |
| AI-027 | AI & Automatisierung | Task-Center | Unified Task Inbox + abgeleitete Aufgaben + ActionSession + TaskDetail | Recruiter | /recruiter/influence, /recruiter/dashboard | useUnifiedTaskInbox.ts, useActionSession.ts, TaskCard.tsx, TaskDetailDialog.tsx, RecruiterInfluence.tsx | Direkt-Queries + Realtime | influence_alerts, recruiter_tasks, submissions, interviews | VORHANDEN_PRODUKTIV | 4 | NIEDRIG | Sortierung :444-448; derived :193-277; Snooze/Done :564-625 | Derived-Suppression serverseitig persistieren; Session persistent machen |
| AI-028 | AI & Automatisierung | Infrastruktur | pg_cron/pg_net-Verdrahtung (app.settings-GUCs) | — | — | — | 4 Cron-Jobs + 1 Trigger via current_setting | cron.job | NICHT_BEWERTBAR | 2 | HOCH | 20260225200000:136-195; 20260307000000:20-23; kein ALTER DATABASE…SET im Repo | Live prüfen (cron.job_run_details), GUCs setzen + dokumentieren |
| AI-029 | AI & Automatisierung | Lern-Schleife | Outcome-/Trainingsdaten alt (match_outcomes, ml_training_events, Seed) | Admin | /admin/analytics (MLHealthWidget) | MLHealthWidget.tsx:67 | seed-ml-training-data, Trigger sync/log | match_outcomes, ml_training_events | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | HOCH | Seed ohne Flag + verify_jwt=false (config.toml:3-4); USING(true)-RLS 20251213030355:93-94 | Seed absichern/löschen; Daten de-pollutieren; RLS fixen |
| AI-030 | AI & Automatisierung | Lern-Schleife | Lern-Schleife neu (match_events, match_ai_judgements) | — (Shadow) | — | — | calculate-match-v4, normalize-job-requirements | match_events, match_ai_judgements | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | HOCH | Schema 20260718150000; USING(true)-RLS :47-49,81-83 | RLS auf service_role beschränken; Konsumenten bauen |
| AI-031 | AI & Automatisierung | Qualitätssicherung | Eval-Harness (Golden-Dataset, Baseline, CI-Gate, Drift-Test) | Dev | npm run eval:* | evals/ (komplett), package.json:13-16 | — | — | VORHANDEN_PRODUKTIV | 4 | KEIN | evals/README.md; baselines + Report 2026-07-18 committet | in CI verankern (es gibt keine CI); auf LLM-Features ausweiten |
| AI-032 | AI & Automatisierung | Governance | AI-Auditierbarkeit querschnittlich (Versionierung, Logging, Kosten) | — | — | — | verteilt | match_events, match_recommendations, candidate_fit_assessments | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | MITTEL | Versionierung nur in 3 von ~26 LLM-Funktionen; kein usage-Read im Repo | zentrales Gateway-Wrapper-Modul (Timeout, Retry, usage-Log, Modell-Registry) |
