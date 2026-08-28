# State of the Union — AI & Matching Engine

**Date:** 2026-07-16 · **Phase:** 0 (read-only reconnaissance) · **Method:** 5 parallel exploration agents over the full repo + direct verification of every load-bearing claim (file:line cited throughout).

**Scope caveat:** Findings are from the repo on `main` + uncommitted working tree. The live Supabase DB (`dngycrrhbnwdohbftpzq`) could not be queried; deployment status is inferred from the generated `src/integrations/supabase/types.ts` (last regenerated 2026-07-11).

---

## 0. Executive summary

Matchunt's matching engine is a hand-rolled heuristic scorer (`calculate-match-v3-1`) with a genuinely decent design on paper — hard-kill gates, dealbreaker multipliers, weighted fit scoring, template-based explanations — **but several of its limbs are unplugged**: it reads job columns that don't exist in the deployed DB, candidate columns that ingestion never writes, and "must-have skills" that are comma-split sentence fragments. There is **no retrieval stage** (it scores the newest 50 published jobs, period), **no semantic layer** (embeddings are dead by construction: 64-dim LLM-hallucinated vectors written into `vector(1536)` columns → always NULL), **no persisted score for clients** (they sort on a legacy NULL column), and **no eval of any kind**. The AI surface is ~26 LLM call sites with no gateway, no timeouts, no retries, no cost telemetry, and PII redaction wired into exactly 1 of them.

The good news: the platform is pre-launch/pilot-scale, the worst defects are cheap to fix (one already-written migration closes two of them), a well-engineered PII-redaction util and a golden-eval script already exist as templates, and the outcome-capture schema (`match_outcomes`, `ml_training_events`) is already in place — it just needs de-pollution and a consumer.

---

## 1. Stack & architecture

| Layer | Reality |
|---|---|
| Frontend | Vite 5 + React 18 + TS 5.8 (**strict: false**), Tailwind, Radix, react-query, react-router. Deployed via Lovable (manual "Publish" — no auto-deploy on push). |
| Backend | Supabase Postgres, **116 migrations**, **83 Deno edge functions**, RLS-heavy. Extensions: pg_cron, pg_net, pgvector (HNSW indexes defined). |
| Async infra | pg_cron → pg_net → edge functions: influence-engine (15 min), escalation-engine (5 min), calculate-influence-score (hourly). No queue/worker beyond `embedding_queue` (filled by triggers, **never drained automatically**). |
| Tests | `supabase/functions/_shared/pii-redaction.test.ts` (Deno, ~15 cases) + `supabase/tests/001_client_team_permissions_test.sql` (pgTAP, ~40 cases). **No frontend tests, no test script in package.json.** |
| CI | **None.** No `.github/workflows`. Deploys are manual (`supabase db push`, `supabase functions deploy`, Lovable Publish). |
| Secrets | `.env` committed (anon key only — public by design, but risky pattern). Server secrets in Supabase dashboard, read via `Deno.env.get`. |
| Existing docs | `docs/godmode/` (17 files, June 2026 audit), `docs/adr/ADR-001` (Stripe), `audit/04-ai-matching.md` (only bias analysis). `docs/ai/` did not exist before this file. |

**Deployment drift risk (verified):** migrations `20260619120000_intake_hybrid_foundation.sql` (adds `jobs.visa_sponsorship`, `experience_min/max`, `intake_payload`, `reveal_envelope`) and `20260716120000_job_close_reason.sql` exist on disk but their columns are **absent from the generated types** → almost certainly not applied to the live DB. Edge functions `intake-questions` and `client-dashboard-data` (new versions) are also undeployed. Frontend code degrades gracefully (`src/lib/intakeCapture.ts`) but the live matcher does not (see §3).

---

## 2. AI surface

**Providers:** ~24 functions → Lovable AI Gateway (`ai.gateway.lovable.dev`, OpenAI-compatible, Gemini models); 2 functions → OpenRouter (`intake-questions`, `extract-intake-briefing`); 1 stray legacy call → `api.lovable.dev` with `gpt-4o-mini` (`process-interview-notes/index.ts:76` — inconsistent endpoint, likely broken).

**Models:** near-monoculture `google/gemini-2.5-flash` (hardcoded per function); `google/gemini-3-flash-preview` in format-job-for-recruiters, generate-match-recommendation, generate-job-expose. No model registry, no routing, no pinning discipline (changing a model = editing a string in one of 26 files).

**Output handling (verified by grep classification):**

| Mechanism | Functions |
|---|---|
| Tool/function-calling (schema-enforced) — GOOD | assess-candidate-fit, parse-cv, parse-job-url, parse-job-pdf, enrich-job-data, format-job-for-recruiters, generate-job-summary, generate-match-recommendation, intake-questions, extract-intake-briefing, process-candidate-import, crawl-company-data |
| `response_format: json` | calculate-match v1/v2 (dead), intake-questions, extract-intake-briefing |
| **Raw `JSON.parse` of free text — FRAGILE** | analyze-reference, client-candidate-summary, enrich-company-from-domain, generate-embeddings, generate-interview-prep, generate-outreach-email, normalize-skills, process-inbound-email, process-interview-notes |

**Reliability hygiene:** **zero timeouts** (no AbortController anywhere in `supabase/functions/` or `src/`), **zero retry/backoff on LLM calls** (429/402 from the gateway is relayed to the user as "AI credits exhausted"), **zero token/cost telemetry** (no `usage` field ever read; only `generation_time_ms` stored in one table). Token caps exist in 4 of ~26 functions.

**Caching:** `candidate_fit_assessments` (SHA-256 input hash + prompt_version), `match_recommendations` (7-day TTL), `candidate_client_summary` (versioned), `routing_cache` (dead with v2).

**Known silent-failure bug:** `generate-match-recommendation/index.ts:242-244` selects `importance, skill_level` from `job_skill_requirements` — **columns that don't exist** (actual: `type`, `min_proficiency`) → query errors → must-have context silently drops out of the LLM prompt.

**PII posture:** the allowlist-based redaction util (`_shared/pii-redaction.ts`, fail-closed leak assertion, well tested) is wired into **exactly 1 function** (assess-candidate-fit). The other ~23 send raw PII: `parse-pdf` ships the **entire CV PDF as base64 (incl. photo)** to Gemini; `candidate-summary` and `generate-interview-prep` interpolate `full_name` + salary; `parse-cv` extracts (and the schema maps) `nationality` and `residence_status`.

---

## 3. Matching engine today

### 3.1 Which of the four versions is live

| Version | Trigger | Status |
|---|---|---|
| calculate-match (v1) | nothing | zombie (1 LLM call/pair) |
| calculate-match-v2 | only from unmounted components | zombie (LLM + 3-provider commute routing) |
| calculate-match-v3 | hook exists, never called | zombie |
| **calculate-match-v3-1** | **frontend-invoked on demand**: `useMatchScoreV31.ts:131` from candidate detail/hero views and `CandidateSubmitForm.tsx:429` | **LIVE** |
| talent-pool-match, candidate-retrieval, normalize-skills | zero callers | zombies |

Also dead: `calculate-match-v3-1/skill-matcher.ts` (619 lines, imported by nothing — v3-1 has its own inline matcher). **No cron or DB trigger ever runs matching**; the only auto-triggered AI is `assess-candidate-fit` (pg_net on submission INSERT).

### 3.2 The live algorithm (plain language)

Input: one candidate × up to 50 job IDs. **No LLM — pure TypeScript heuristics.**

1. **Profile gate:** candidate needs skills OR (title + experience_years), else hidden.
2. **Hard kills** (score 0): visa, language (CEFR min-level), onsite-vs-remote-only, certifications (substring).
3. **Dealbreaker multipliers** (product, floor 0.05): salary gap over `job.salary_max`, start-date distance, seniority-level gap, work-model mismatch, hardcoded 13-domain tech-domain compatibility table.
4. **Fit score** (weights ~ skills .50 / experience .15 / seniority .03 / industry .02, renormalized): per-skill credit via substring → synonyms table → taxonomy aliases → transferability (×0.7).
5. **Strict-mode gate:** must-have coverage < 40% → excluded.
6. **Constraints score** (salary .12 / commute .12 / start date .06).
7. `overall = round(fit×0.70 + constraints×0.30) × dealbreakerMultiplier` → policy tier (hot ≥80, standard ≥65, maybe ≥45, else hidden).
8. Template-generated German explanations (reasons/risks/mitigations/next steps).
9. One `match_outcomes` INSERT **per job inside a sequential loop** (50 round-trips per browse).

### 3.3 Why its output is currently unreliable (all verified in code)

- **Phantom job columns:** the matcher reads `job.visa_sponsorship` (`index.ts:916`) and `job.experience_min/max` (`:1388-1389`) — columns added by the **undeployed** migration `20260619120000`. Live effect: visa hard-kill kills every visa-requiring candidate on every job (`!undefined` = true), experience scoring runs on defaults 0–20 for all jobs.
- **Never-written candidate columns:** language kill reads `candidate.language_skills` jsonb (`:922`) and cert kill reads `candidate.certifications` text[] (`:954`) — **zero writers in the entire codebase**; CV ingestion writes the `candidate_languages`/`candidate_skills` *tables* instead. Both hard-kills operate on perpetually-empty data.
- **Sentences, not skills:** `jobs.must_haves` is comma-split free text from a textarea (`CreateJob.tsx:601-633`) → substring matching against sentence fragments. `job_skill_requirements` (the structured table the matcher prefers) is only populated by the new Intake Studio path.
- **No retrieval:** candidate→jobs = `SELECT id FROM jobs WHERE status='published' ORDER BY created_at LIMIT 50` (`CandidateJobMatchingV3.tsx:124`, `CandidateHeroMatching.tsx:27`). Job 51+ is invisible. Job→candidates direction exists only in dead code.
- **Dead embeddings:** `generate-embeddings` prompts *a chat model* to emit "exactly 64 floats" (`index.ts:223`) and writes them into `vector(1536)` columns (`20260122214438:6,12`) → pgvector dimension check fails → columns stay NULL → `find_similar_candidates` / `search_candidates_hybrid` RPCs and the SimilarCandidates UI silently return nothing. HNSW indexes index nothing. The queue-retry migration re-queues the same doomed writes forever.
- **Score split-brain:** v3-1 **never persists** a score to `submissions.match_score` (only dead v1–v3 wrote it). Client UI sorts and displays that now-NULL/legacy column (`useBewerber.ts:244`, `AnonymizedCandidateCard.tsx:104`). What clients actually experience as "match quality" is the separate `assess-candidate-fit` LLM pipeline — two uncoordinated truths that can contradict each other.

### 3.4 Feedback loop

Predictions land in `match_outcomes` (incl. browse-mode noise); a DB trigger syncs terminal submission statuses into `actual_outcome`; `ml_training_events` snapshots every stage change. **Nothing is ever read back** — the calibration endpoint (`track-match-outcome?action=calibrate`) has no UI callers, and no weight/threshold is ever adjusted. Worse: `seed-ml-training-data` (admin button, `verify_jwt=false`) injects **synthetic outcomes into the same tables with no `is_synthetic` flag**.

---

## 4. Data model & quality

**Candidates** (~90 cols): structured basics exist (skills text[], seniority, experience_years, city+geo, availability_date, visa_required) but with heavy duplication — **salary ×4** (`current_salary`, `expected_salary`, `salary_expectation_min/max`), **remote ×5** (`remote_preference/_possible/_days_preferred/_flexibility`, `work_model`), **certifications ×2** (text[] vs jsonb), languages ×2 (table vs jsonb — matcher reads the never-written jsonb). `cv_raw_text` keeps the full unredacted CV forever. Protected-adjacent: `nationality`, `residence_status` on candidates; `graduation_year` in educations (age proxy); `team_avg_age` on jobs.

**Jobs** (~90 cols): matcher-authoritative `must_haves`/`skills`/`nice_to_haves` (free-text fragments); duplicates `must_have_criteria`/`nice_to_have_criteria` never consumed; structured `job_skill_requirements` table only written by the new Studio; hard-kill inputs `required_languages` jsonb / `required_certifications` / `onsite_required` exist and are read correctly.

**Lifecycle:** `submissions` has the known **stage-vs-status split-brain** (canonical interpretation only in frontend code, `useBewerber.ts:79-111`; no CHECK constraints — vocabulary is whatever ~10 components write). Rejections live in three places (`submissions.rejection_reason` free text, `rejections` table with `reason_category`, `match_outcomes.rejection_category`). Reveal ladder (`identity_unlocked` + trigger `sync_identity_unlock_with_stage`) must gate any matching output surface.

**CV ingestion:** upload → parse-pdf → parse-cv (Gemini tool-call) → client-side save; email → process-candidate-import (server-side port, plus dedup that **auto-merges at 0.40 fuzzy-name confidence** — wrong-candidate risk). No per-field confidence. Re-import **deletes and reinserts** all child rows — manual enrichments are destroyed. parse-cv's tool schema never asks for salary/nationality/remote yet code maps them with `|| null` → nearly always NULL from this path.

**Volume:** pilot-scale (demo fixtures, pre-go-live). **Real labeled outcomes ≈ zero; synthetic rows may outnumber real ones in outcome tables.** The Phase 1 golden dataset will need synthetic augmentation from day one, clearly flagged.

---

## 5. Constraints

- **Providers:** Lovable AI Gateway (→ Google Gemini, US transfer possible), OpenRouter, Resend, Stripe, Firecrawl, Google Maps + OpenRouteService + **keyless public OSRM** (dead v2 path, but received candidate geo-coords with no DPA). Env-var hazard: `OPENROUTER_API_KEY` vs `OPENROUTE_API_KEY` near-collision.
- **Latency:** every LLM call is user-blocking and unbounded (no timeouts). CV upload chains two sequential LLM calls in a dialog.
- **Cost:** no tiering, no quotas, no telemetry. 402 handling = error toast.
- **GDPR:** `gdpr-export`/`gdpr-deletion` exist but miss AI-derived tables, `cv_raw_text`, storage files, generated CV PDFs; **candidates (the actual data subjects) have no self-serve Art. 15/17 path** (they aren't auth users). The Datenschutz page (`src/pages/public/Datenschutz.tsx`) is unusually precise — it self-classifies fit assessment as **high-risk AI (EU AI Act Annex III 4(a)/(b))**, names all processors, and does *not* over-promise pseudonymization — but §12(8) ("not designed to evaluate Art. 9 data") sits uneasily with parse-pdf shipping full CV PDFs incl. photos.
- **AI Act artifacts:** none beyond the privacy policy. Only bias analysis: `audit/04-ai-matching.md` (nationality = HIGH risk, not yet hard-excluded).

---

## 6. Brutally honest assessment

The matching engine is **a 2019-era keyword matcher with good bones and several limbs unplugged**. Its architecture (gates → multipliers → weighted fit → tiers → explanations) is a sensible heuristic baseline, and the explanation templates are genuinely better than what most platforms show. But in production today: visa/language/cert hard-kills misfire or never fire, experience scoring runs on defaults, skill matching does substring math on sentence fragments, only the newest 50 jobs are ever considered, semantic search is a Potemkin feature (NULL embeddings behind real UI), and the score clients see is a NULL column. **Nobody can currently say whether matching works, because nothing measures it and the truth data is polluted with unflagged synthetic rows.**

The AI platform layer is pre-industrial: 26 uncoordinated call sites, model IDs as string literals, a third of output parsing on raw `JSON.parse`, no timeouts/retries/cost visibility, and a compliance posture where the best-in-class redaction util protects exactly one of ~24 PII-touching functions.

What's genuinely good and should be kept/extended: the v3-1 gate/multiplier structure as the future hard-filter stage, `_shared/pii-redaction.ts` + its tests, `_shared/fit-assessment.ts` (prompt centralization pattern), `scripts/golden-eval-fit.ts` (eval template), the `match_outcomes`/`ml_training_events` capture schema, tool-calling discipline in the newer functions, and the fit-assessment caching pattern (input-hash + prompt_version).

---

## 7. Top 10 gaps, ranked by expected impact × implementation cost

| # | Gap | Impact | Cost | Evidence |
|---|---|---|---|---|
| 1 | **Matcher inputs broken at source** — phantom job columns (undeployed migration), never-written candidate columns, sentence-fragment must_haves | Every match today is partially garbage; fixing inputs improves all downstream stages for free | **Low** — migration `20260619120000` is already written; language/cert reads need a 10-line adapter to the real tables; skill normalization is Phase 2 step 1 anyway | §3.3 |
| 2 | **No eval harness / no baseline / polluted truth data** — and near-zero real labels | Blocks *everything* (prime directive); synthetic pollution silently poisons any future metric | Medium — golden-eval-fit.ts is a template; needs `is_synthetic` flag + fixtures + metrics | §3.4, §4 |
| 3 | **Client-facing score split-brain** — v3-1 unpersisted, clients sort on NULL, fit-assessment tells a different story | Clients make decisions on dead data; trust risk for the core product promise | Low-medium — persist v3-1 at submission, reconcile with fit assessment | §3.3 |
| 4 | **No retrieval stage** — LIMIT 50 by created_at; job→candidate dead | Silent total blindness beyond 50 jobs; blocks marketplace scale | Medium — hard filters + FTS/BM25 first, dense later | §3.3 |
| 5 | **Dead embeddings** — fake 64-dim vectors, NULL columns, Potemkin UI | Semantic matching entirely absent; UI features silently no-op; queue burns credits | Medium — real embedding model (SOTA + EU-residency check at build time), backfill, un-Potemkin the UI | §3.3 |
| 6 | **No LLM gateway** — no timeouts/retries/telemetry/registry; 9 raw-JSON.parse sites; 1 broken endpoint; 1 silent column-select bug | Reliability, cost blindness, and un-auditable model changes across all 26 call sites | Medium — one `_shared/llm-gateway.ts`, migrate call sites incrementally | §2 |
| 7 | **PII reaches LLMs unredacted in ~23 of 24 functions**; nationality column live (own audit: HIGH) | GDPR + AI-Act exposure on a self-declared high-risk system; bias vector | Medium — util exists; wire it into the pipeline order parse → summaries → outreach | §2, §5 |
| 8 | **Feedback loop open + polluted** | The future moat (training data) is being contaminated *now*; every week of pollution is unrecoverable | Low — `is_synthetic` flag, separate preview vs submission predictions, keep capturing | §3.4 |
| 9 | **Zombie sprawl + competing columns** — 4 matcher versions, dead functions/components, salary×4, remote×5, stage-vs-status | Every future change risks editing a dead path; onboarding cost; hides the live path | Low-medium — delete/deprecate + canonical accessors; destructive changes only post-V2 | §3.1, §4 |
| 10 | **No CI** — no tests run anywhere automatically | Eval-gated development (prime directive) is impossible without it | Low — GitHub Actions: lint + tsc + deno test + eval suite | §1 |

---

## 8. What happens next (Phase 1 proposal)

Per the operating principles, **Phase 1 (eval harness) blocks all feature work**. Concretely proposed:

1. `evals/golden/` fixtures: mine what real submission outcomes exist (excluding synthetic + demo rows), augment with an LLM-generated synthetic labeled set (flagged as such), covering edge cases (career changers, sparse CVs, overqualified, adjacent skills).
2. Metrics runner (Deno/TS, matching the stack): Recall@10/50/100, nDCG@10, MRR, hard-negative leak rate, runnable against any matcher implementation via one command; timestamped JSON + MD reports to `evals/reports/`.
3. LLM-output evals for the generative features (schema-validity rate, faithfulness judge with pinned model + rubric), calibrated against ~30 human-labeled examples.
4. GitHub Actions CI: lint + typecheck + deno tests + eval suite on PRs touching AI paths, with regression thresholds.
5. Baseline report: current v3-1 scores = the number to beat.

**Decisions needed from you (only these):**
- **D1 — Deploy pending migrations?** `20260619120000` (+ `20260710120000`) must reach the live DB for gap #1; they are additive, but it's a production DB change and deploys have been manual/yours so far.
- **D2 — Real data in the golden set?** OK to use real (anonymized per the existing redaction util) submission outcomes as eval fixtures in-repo, or synthetic-only until go-live?
- **D3 — Embedding provider** will eventually need a paid, EU-residency-compatible choice (verified against current MTEB/provider docs at build time, per operating principle 6) — decision point comes in Phase 2, flagged now.

---

*Maintained under `docs/ai/`. Companion docs to follow per roadmap: ARCHITECTURE.md, MODEL_CARD.md, BIAS_AUDIT.md, DATA_FLOWS.md, AI_ROADMAP.md, ADRs per major decision.*
