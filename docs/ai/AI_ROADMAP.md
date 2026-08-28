# AI Roadmap — Matching Engine V2 & Platform AI V2

Status tracker for the AI overhaul. Rules: evals before features; every change flag-gated; no silent model upgrades. See `STATE_OF_THE_UNION.md` for the Phase 0 map.

| Phase | Scope | Status |
|---|---|---|
| 0 | Reconnaissance → `STATE_OF_THE_UNION.md` | ✅ Done 2026-07-16; acknowledged 2026-07-17. Decisions: D1 Migration deploy JA (mit Vorab-Check, wartet auf `npx supabase login`); D2 Golden-Set echt+synthetisch (echt wartet auf Service-Role-Key in `.env.local`); D3 EU-Embedding-Provider einplanen, Auswahl per ADR vor Kosten |
| 1 | Eval harness: golden dataset (`evals/golden/`), Recall@K/nDCG@10/MRR/hard-negative-leak runner, LLM-output evals, CI, baseline report | 🟨 Core done 2026-07-18: frozen v3.1 replica + drift guard, synthetic golden set v1 (14 jobs/66 candidates), metric runner, CI gate (`.github/workflows/ai-evals.yml`), baseline frozen — `v31-live-config`: R@10 0.738, nDCG@10 0.538, MRR 0.605, Leak@10 0.488 (see `evals/README.md`). **Open TODOs:** (a) real golden data from submission outcomes once DB access exists, (b) verify live `matching_config` row against LIVE_CONFIG_ROW assumption, (c) LLM-output evals (schema validity + judge) — need API keys, Phase 1.3 |
| 2.1 | Normalization pipeline (skills/titles/canonical schema) + backfill; fix broken matcher inputs (deploy migration `20260619120000`, adapt language/cert reads to real tables) | 🟨 Built 2026-07-18 (not deployed): `normalize-job-requirements` edge fn writes canonical reqs into `job_skill_requirements` (which v3-1 already prefers natively — extends existing engine, zero matcher changes); flag `MATCH_V4_ENABLED`; measured what-if lever on real data: R@10 0.389→0.444 (curated fixture). Candidate-side normalization + backfill run still open |
| 2.4′ | **V4 shadow layer (pulled forward):** `calculate-match-v4` = v3-1 (unchanged, internal call) + evidence-enforced LLM judge (top-N, PII-redacted, pair-cached in `match_ai_judgements`) + pinned blending (`_shared/match-v4.ts`, unit-tested in harness) + shadow logging. Learning loop: `match_events` table (impression→hire, is_synthetic flag, model/prompt versions) in migration `20260718150000`. | 🟨 Built 2026-07-18, not deployed; needs deploy + `MATCH_V4_ENABLED=true` + shadow run vs. real submissions |
| 2.2 | Hybrid retrieval (hard filters → dense + BM25 → RRF) behind flag; beat baseline Recall@100 | ⬜ |
| 2.3 | Cross-encoder reranking; beat baseline nDCG@10 | ⬜ |
| 2.4 | LLM judge with evidence-grounded rubric + explainability layer | ⬜ |
| 2.5 | Shadow mode V2 vs V1 → gradual rollout, V1 rollback path | ⬜ |
| 2.x | Learning-loop hygiene: `is_synthetic` flag on outcome tables, preview-vs-submission separation, impression→outcome event schema | ⬜ (do early — pollution is unrecoverable) |
| 3.1 | LLM gateway (`_shared/llm-gateway.ts`): model registry, timeouts, retries, structured-output enforcement, cost telemetry, prompt versioning | ⬜ |
| 3.2 | Migrate all ~26 call sites onto gateway, each with evals; roll out PII redaction beyond assess-candidate-fit | ⬜ |
| C | Compliance artifacts: MODEL_CARD.md, BIAS_AUDIT.md, DATA_FLOWS.md; protected-attribute guard test | ⬜ |

## Known defects register (from Phase 0, to be closed by phase)

- ✅ **CLOSED (Phase 1, 2026-07-18):** active `matching_config` row (v3.0) lacked `seniority` in `fit_breakdown` → NaN fallback set **fit=50 and coverage=1.0 for every candidate** (live matcher ranked on constraints only). Hypothesis DB-verified via Lovable (row `e55ba13d…`), fixed same day: row updated to code defaults (`version='v3.1'`), rollback backup row `859a697e…` (`profile='backup-20260718'`). Measured gain on golden set: nDCG@10 0.538→0.820, MRR 0.605→0.885. CI baseline moved to `v31-code-defaults`.
- **DB facts (verified 2026-07-18):** 54 candidates (0 with `language_skills`/`certifications`), 27 jobs (0 with `required_languages`/`required_certifications` → language/cert kills currently never fire), phantom columns confirmed absent from `jobs` (visa kill hits every `visa_required` candidate on every job). Real outcomes for golden set v2: 35 submissions (2 hired / 8 interview / 3 submitted / 22 rejected). `match_outcomes`: 9,188 rows, polluted/unflagged — unusable as labels.
- **REAL-DATA BASELINE (2026-07-18):** `dataset.real.v1.json` built from Lovable export (19 prod jobs, 46 candidates, 19 labels; demo seeds + test artifacts excluded & documented). Current engine on real data: **R@10 0.389, nDCG@10 0.283, MRR 0.261, Leak@10 0.306** — and `ideal-inputs` changes nothing, because 93% of pairs (816/874) are hidden by the must-have coverage gate: real `must_haves` are sentence fragments that never match skills. 7 actually-interviewed candidates get excluded by the engine. → **Requirements/skills normalization (2.1) is the single biggest V2 lever, ahead of retrieval/reranking.** Also: candidate_languages levels are `native/fluent/…`, NOT the a1–c2 scale the matcher compares against (latent kill-landmine once jobs set `required_languages` with `minLevel`).

- Phantom job columns read by live matcher (`visa_sponsorship`, `experience_min/max`) — migration written, undeployed → **2.1 / D1**
- `candidate.language_skills` / `candidate.certifications` never written; hard-kills run on NULL → **2.1**
- `must_haves` are sentence fragments, not skill tokens → **2.1**
- Retrieval = `LIMIT 50 ORDER BY created_at`; job→candidate direction dead → **2.2**
- Embeddings dead (64-dim into `vector(1536)` → NULL; Potemkin SimilarCandidates UI; queue never drained) → **2.2**
- v3-1 score never persisted; clients sort/display legacy NULL `submissions.match_score` → **2.1/2.5**
- `generate-match-recommendation` selects non-existent columns (`importance`, `skill_level`) — silent prompt degradation → **3.2 (or hotfix)**
- `process-interview-notes` calls legacy `api.lovable.dev` with `gpt-4o-mini` — likely broken → **3.2**
- Synthetic seed data unflagged in `match_outcomes`/`ml_training_events` → **2.x**
- No timeouts/retries/cost telemetry on any LLM call → **3.1**
- PII redaction covers 1 of ~24 LLM functions; `parse-pdf` sends full CV PDF incl. photo → **3.2 / C**
- Zombie code: calculate-match v1/v2/v3, skill-matcher.ts (619 lines), talent-pool-match, candidate-retrieval, normalize-skills → deprecate post-V2 rollout
