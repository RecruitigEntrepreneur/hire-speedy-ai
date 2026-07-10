# Team 4 — AI-Matching & Datenqualität

## Executive Summary

Live ist **calculate-match-v3-1** (aufgerufen über `useMatchScoreV31` in CandidateJobMatchingV3, CandidateHeroMatching, CandidateSubmitForm). Die Pipeline ist regelbasiert und kalibriert, hat aber drei strukturelle Schwächen: LLM-Outputs werden ohne Schema-Validierung/try-catch geparst (Crash-/Corruption-Risiko), die `embedding_queue` wird befüllt aber nie konsumiert (totes Feature, verschwendete Credits, keine semantische Ähnlichkeit im Matching), und es gibt keinen echten Feedback-Loop von `match_outcomes` zurück ins Live-Scoring. Bias-Risiko besteht v.a. durch das vorhandene `nationality`-Feld und Domain-Stereotype.

## Matching-Pipeline (Live-Version v3-1)

`supabase/functions/calculate-match-v3-1/index.ts` (1903 Zeilen). Ablauf:
1. **Hard Kills:** Visumspflicht, Sprachen, Präsenzpflicht, Zertifikate
2. **Dealbreaker-Multipliers:** Gehalt, Startdatum, Seniority, Remote-Präferenz, Tech-Domain-Mismatch
3. **Fit Score:** Skills 50%, Experience 15%, Seniority 3%, Industry 2%
4. **Constraints Score:** Salary, Commute, StartDate
5. **Policy Tiers:** hot ≥80%, standard ≥65%, maybe ≥45%, hidden
- **Datenquellen:** job_skill_requirements, skill_synonyms, skill_taxonomy, matching_config (alle genutzt).

## Befunde

### [CRITICAL] [S] JSON.parse ohne Error-Handling in assess-candidate-fit

- **Fundstelle:** `supabase/functions/assess-candidate-fit/index.ts:232` — `JSON.parse(toolCall.function.arguments)` ohne try/catch.
- **Problem:** Malformed/halluzinierter LLM-Output → ungefangene Exception → kein Assessment in DB, User-Fehler ohne Debug-Info.
- **Risiko/Impact:** Sporadische Crashes des Fit-Assessments.
- **Fix-Empfehlung:** try/catch + Zod-Validierung des FIT_TOOL-Outputs vor Upsert.

### [HIGH] [M] embedding_queue befüllt, aber nie konsumiert

- **Fundstelle:** `supabase/functions/generate-embeddings/index.ts` (schreibt) vs. `src/components/admin/EmbeddingHealthWidget.tsx` (nur Monitoring). Kein systematischer Consumer.
- **Problem:** Queue-Items bleiben pending; v3-1 nutzt nur Substring/Synonym-Matching, keine Embeddings/pgvector.
- **Risiko/Impact:** Totes Feature; Matching-Qualität suboptimal; Embedding-Credits verschwendet.
- **Fix-Empfehlung:** Entweder Consumer-Function bauen und Embeddings ins Scoring integrieren, oder Feature sauber entfernen. Entscheidung erforderlich.

### [HIGH] [M] Keine Schema-Validierung des LLM-Outputs (fit-assessment)

- **Fundstelle:** `supabase/functions/_shared/fit-assessment.ts:8`, `assess-candidate-fit/index.ts:232`
- **Problem:** LLM-Output direkt in DB; dimension_scores/rejection_reasoning optional aber unvalidiert; keine Längen-Limits auf Strings.
- **Risiko/Impact:** DB-Corruption/DoS durch übergroße oder null/undefined-Werte.
- **Fix-Empfehlung:** Zod-Schema für FIT_TOOL-Output, vor Upsert validieren, Längen-Limits.

### [HIGH] [Bias, Zulieferung Team 2] `nationality`-Feld im Kandidatenschema

- **Fundstelle:** `src/integrations/supabase/types.ts` (candidates.nationality). In v3-1 nicht direkt genutzt (Grep), aber vorhanden.
- **Problem:** Diskriminierungs-Proxy (ethnische Herkunft) im Schema — Risiko der (künftigen) Nutzung im Scoring.
- **Risiko/Impact:** EU-AI-Act-/AGG-Compliance-Risiko.
- **Fix-Empfehlung:** Entfernen oder explizit als Non-Matching-Feld dokumentieren + technisch vom Matching ausschließen.

### [MEDIUM] [M] Keine Schema-Validierung bei parse-cv / parse-job-pdf u.a.

- **Fundstelle:** `supabase/functions/parse-cv/index.ts`, `parse-job-pdf/index.ts` — JSON.parse teils ohne try/catch, uneinheitliche Fallbacks.
- **Fix-Empfehlung:** Einheitliche Zod-Validierung für alle LLM-Output-Parser.

### [MEDIUM] [L] Kein Feedback-Loop ins Matching

- **Fundstelle:** `calculate-match-v3-1/index.ts:679` (insert match_outcomes), `seed-ml-training-data/index.ts` (synthetische Events).
- **Problem:** predicted_scores werden gespeichert, aber tatsächliche Outcomes (hired/rejected/withdrawn) fließen nicht ins Live-Scoring zurück. Kalibrierung nur im Batch-Seed.
- **Risiko/Impact:** Matching verbessert sich nicht automatisch; Modell wird nie kalibriert.
- **Fix-Empfehlung:** Outcome-Tracking → adaptive Gewichte (später, nach Compliance/Datenleck).

### [MEDIUM] [S] Domain-Mismatch-Multiplikator zu aggressiv

- **Fundstelle:** `calculate-match-v3-1/index.ts:1050-1071` — inkompatible Domains 0.1×, transferable 0.6×, confidence-Threshold nur 0.15.
- **Problem:** False Positives bei Umsteigern/Generalisten (z.B. Junior mit „Python" → fälschlich Data/ML, 0.6×).
- **Fix-Empfehlung:** Confidence-Threshold auf ~0.25 anheben oder Übergangsheuristik für verwandte Domains.

## Bias-Risiken (Zulieferung an Team 2 / EU AI Act)

| Feature | Diskriminierungs-Proxy? | Fundstelle | Severity |
|---|---|---|---|
| `nationality` | Ethnische Herkunft | types.ts | HIGH |
| `city`/region | Proxy für Herkunft | calculate-match-v3-1:~1044 | MEDIUM |
| job_title + Domain-Detection | Gender-Stereotype | index.ts:209-227 | MEDIUM |
| Salary expectation | Sozioökonomischer Proxy | index.ts:~980 | LOW |

Keine direkten age/gender/photo/marital-Felder im Matching gefunden.

## Quick Wins (S-Effort)

1. try/catch um JSON.parse in assess-candidate-fit:232.
2. Domain-Mismatch-Confidence 0.15 → 0.25.
3. `nationality` als Non-Matching dokumentieren + hart ausschließen.
4. embedding_queue-Status-Logging im Admin-Panel.

## Offene Fragen an Marko

1. Sind Embeddings absichtlich dormant oder sollen sie aktiviert werden?
2. Soll match_outcomes → Score-Kalibrierung gebaut werden, oder ist der Score final?
3. Welche AI-Funktionen sollen PII-Redaction bekommen (→ überschneidet Team 2)?
4. `nationality`: Legacy oder aktiv genutzt?
