## 07. Matching-Engine & ML

> Domaenen-Tiefenanalyse fuer das Matchunt-CTO-Team. Quelle ist der Quellcode (Stand der Analyse), nicht `PROJECT_ANALYSIS.md`. Alle Referenzen als `pfad/datei.ts:zeile`.

Die Matching-Domaene ist das algorithmische Herz der Plattform: Sie entscheidet, welche Kandidaten welchen Jobs zugeordnet, wie stark sie bewertet und ob sie im (Triple-Blind-)Feed angezeigt werden. Sie ist in **vier Generationen** (v1 -> v3.1) gewachsen, von denen die aelteren Versionen weiterhin im Code und teils im UI aktiv sind. Daneben existiert eine zweite, **rein client-seitige** Matching-Implementierung sowie eine ML-Daten-Pipeline (Outcome-Tracking + Training-Events), deren Trainings-Rueckkopplung jedoch nicht geschlossen ist.

### 07.1 Komponenten-Landkarte

| Edge Function | Datei | Rolle | Schreibt in |
|---|---|---|---|
| `calculate-match` (v1) | `supabase/functions/calculate-match/index.ts` | AI-only Match (Gemini), feste Gewichte | `submissions.match_score` |
| `calculate-match-v2` | `supabase/functions/calculate-match-v2/index.ts` | 5-Faktoren-Score (Skills/Exp/Salary/Commute/Culture), Routing-Engine, Blocker/Warnings | `submissions.match_score` |
| `calculate-match-v3` | `supabase/functions/calculate-match-v3/index.ts` | Gates + Fit + Constraints, config-getrieben, Single-Pair | `submissions.match_score`, `submissions.match_score_v3`, `match_outcomes` |
| `calculate-match-v3-1` | `supabase/functions/calculate-match-v3-1/index.ts` (+ `skill-matcher.ts`) | **Produktiv**: Batch (1 Kandidat x N Jobs), Hard-Kills, Dealbreaker-Multiplikatoren, Tech-Domain-Inkompatibilitaet, Policy-Tiers | nur `match_outcomes` (kein `submissions`-Writeback) |
| `generate-match-recommendation` | `supabase/functions/generate-match-recommendation/index.ts` | KI-Textempfehlung auf Basis eines v3.1-Ergebnisses (Triple-Blind-anonymisiert) | `match_recommendations` (Cache) |
| `normalize-skills` | `supabase/functions/normalize-skills/index.ts` | Skill -> Canonical via `skill_taxonomy` + AI-Fallback | – (read-only) |
| `generate-embeddings` | `supabase/functions/generate-embeddings/index.ts` | 64-dim "Feature-Vektor" via Gemini Self-Rating, Queue-Verarbeitung | `candidates.embedding`, `jobs.embedding`, `embedding_queue` |
| `talent-pool-match` | `supabase/functions/talent-pool-match/index.ts` | Job -> Talent-Pool-Reverse-Match, erzeugt Alerts | `talent_alerts` |
| `track-match-outcome` | `supabase/functions/track-match-outcome/index.ts` | Outcome-Recording + Kalibrierungs-Statistik | `match_outcomes` |
| `seed-ml-training-data` | `supabase/functions/seed-ml-training-data/index.ts` | Synthetische Trainingsdaten (Random) | `ml_training_events`, `match_outcomes` |
| `refresh-analytics` | `supabase/functions/refresh-analytics/index.ts` | Funnel-Metriken + Deal-Health (nicht eng matching-spezifisch) | `funnel_metrics`, `deal_health` |
| `calculate-scores` | `supabase/functions/calculate-scores/index.ts` | Recruiter-/Candidate-**Behavior**-Scores (NICHT Match-Score) | `user_behavior_scores`, `candidate_behavior` |

Begleitende DB-Objekte: Tabellen `matching_config`, `match_outcomes`, `ml_training_events`, `skill_taxonomy`, `skill_synonyms`, `job_skill_requirements`, `embedding_queue`, `talent_pool`/`talent_alerts`, `routing_cache`, `commute_overrides`; pgvector-RPCs `find_similar_candidates`, `search_candidates_hybrid`, `find_similar_candidates_by_skills`.

### 07.2 Evolution v1 -> v3.1 (was sich aenderte)

| Aspekt | v1 | v2 | v3 | v3.1 |
|---|---|---|---|---|
| Aufruf-Signatur | `{candidateId, jobId}` | `{candidateId, jobId}` | `{candidateId, jobId, submissionId?}` | `{candidateId, jobIds[], mode, configProfile}` (**Batch**) |
| Skill-Logik | 1x Gemini-Call bewertet alles | Gemini-Skill-Call + Fallback-Substring | Taxonomie-Substring + Transferability | Mehrstufig: exact -> synonym (`skill_synonyms`) -> Taxonomie-Alias -> reverse-Taxonomie -> Keyword-Extraktion (Finance/IT). **Kein LLM** |
| Faktoren | Skills/Exp/Salary/Location | Skills/Exp/Salary/Commute/Culture | Fit{Skills,Exp,Industry} + Constraints{Salary,Commute,StartDate} + 4 Gates | Fit{Skills,Exp,Seniority,Industry} + Constraints{Salary,Commute,StartDate} |
| Gewichte | Hardcoded `DEFAULT_WEIGHTS` (`:21`) | Hardcoded (`:62`) | aus `matching_config` (Fallback hardcoded) | aus `matching_config` per `profile` (Fallback `buildConfig` `:718`) |
| K.O.-Kriterien | keine | `isBlocker`-Flags pro Faktor | Gate `fail` deckelt Score auf 35 | **Hard-Kills** (Visa/Sprache/Onsite/Zertifikat) + **Dealbreaker-Multiplikatoren** (multiplikativ) + **Tech-Domain-Inkompatibilitaet** (x0.1) |
| Routing/Pendeln | – | echtes Routing (Google/ORS/OSRM/Haversine) mit `routing_cache` (`:116`) | nur `max_commute_minutes`-Heuristik | nur `max_commute_minutes`-Heuristik (Routing **entfernt**) |
| Output | `overallScore` + Analyse | `MatchResult` mit blockers/warnings/recs | `dealProbability` + `explainability` | + `policy` (hot/standard/maybe/hidden), `gateMultiplier`, `mustHaveCoverage`, `enhancedReasons/Risks`, `recruiterAction` |
| Persistenz | `submissions.match_score` | `submissions.match_score` | `submissions.match_score(_v3)` + `match_outcomes` upsert | nur `match_outcomes` insert (ohne `submission_id`) |
| LLM-Abhaengigkeit | hoch (jeder Match) | mittel (Skills) | **keine** | **keine** (deterministisch) |

Kern-Architekturbruch: **v1/v2 sind LLM-getrieben**, **v3/v3.1 sind deterministische Regel-Engines**, die nur noch `matching_config` als Stellschraube nutzen. v3.1 ergaenzt v3 um drei Dinge: Batch-Verarbeitung (Performance bei N Jobs), eine **harte Tech-Domain-Trennung** (`TECH_DOMAINS`, `calculate-match-v3-1/index.ts:14`) und ein **Display-Policy-System**, das die Anzeige im Recruiter-Feed steuert.

### 07.3 v3.1 Scoring-Pipeline im Detail

`calculateMatch()` (`calculate-match-v3-1/index.ts:771`) durchlaeuft 5 Stufen:

1. **Profile-Completeness-Gate** (`:783`) – ohne Skills/Erfahrung -> `excluded`, Policy `hidden`.
2. **Stage A: Hard-Kills** (`evaluateHardKills`, `:914`) – Visum, Pflichtsprachen (mit CEFR-Level-Vergleich), Onsite-Pflicht vs. Remote-only, Pflichtzertifikate. Treffer => `createKilledResult` (`:1832`), Score 0.
3. **Stage A.2: Dealbreaker-Multiplikatoren** (`calculateDealbreakers`, `:973`) – Salary-Gap, Startdatum, Seniority-Gap, Work-Model und **Tech-Domain** werden zu einem **multiplikativen** `gateMultiplier` (min 0.05) verrechnet. Domain-Inkompatibilitaet (z.B. `embedded_hardware` vs. `backend_cloud`) => x0.1.
4. **Stage B: Fit-Score** (`calculateFitScore`, `:1092`) – gewichtete Summe aus `calculateSkillScore` (`:1158`), Experience, Seniority, Industry; mit NaN-Schutz und Gewichts-Normalisierung auf `totalWeight`.
5. **Stage C: Constraints** (`calculateConstraintsScore`, `:1443`) + **Stage D: Policy** (`determinePolicy`, `:1522`).

Endscore: `finalScore = round(round(fit*w_fit + constraints*w_constraints) * gateMultiplier)` (`:855`–`:861`). Danach Policy aus `finalScore` + `mustHaveCoverage` + `gateMultiplier`.

Die Skill-Coverage hat einen eigenen Gate: `mustHaveCoverage < 0.40` schliesst im `strict`-Modus aus (`:846`). Wichtig: Das Default-`fit_breakdown` in `buildConfig` (`:723`) summiert sich auf 0.70, nicht 1.0 – funktioniert nur, weil `calculateFitScore` durch `totalWeight` normalisiert.

#### Skill-Matcher-Module
Zwei verschiedene Skill-Matcher existieren parallel:
- `calculate-match-v3-1/skill-matcher.ts` – exportiert `matchSkill`/`matchAllSkills` mit **Levenshtein-Fuzzy** (`:143`), hardcodierten `SKILL_SYNONYMS` (`:40`), Transferability und Skill-Level-Matching (Years/Proficiency/Recency, `:469`).
- Die **tatsaechlich verwendete** Logik liegt aber inline in `index.ts:1259` (`getSkillCredit` -> `matchSingleSkill`) und nutzt **keinen** Levenshtein, sondern Substring + DB-Synonyme + Taxonomie. D.h. das ausgefeiltere `skill-matcher.ts` (inkl. Skill-Level) wird vom Haupt-Handler **nicht aufgerufen** (siehe Friction).

### 07.4 Embeddings & Vektorsuche (Bruchstelle)

`generate-embeddings/index.ts` erzeugt KEIN echtes Embedding. Es laesst Gemini (`google/gemini-2.5-flash`) ein **64-dimensionales Feature-Vektor** selbst "scoren" (`FEATURE_DIMENSIONS`, `:38`; `generateEmbedding`, `:146`) und schreibt es als `gemini-2.5-flash-64d` nach `candidates.embedding` / `jobs.embedding`.

Die Migration `20260122214438_...sql` definiert die Spalten jedoch als **`vector(1536)`** mit HNSW-`vector_cosine_ops`-Index und Default-Model `text-embedding-3-small` (`:6`, `:12`, `:38`). Die RPCs `find_similar_candidates` (`:100`) und `search_candidates_hybrid` (`:128`) erwarten ebenfalls `vector(1536)`.

=> **Dimensions-Konflikt**: 64-dim-Inserts passen nicht in eine `vector(1536)`-Spalte; pgvector lehnt das ab. Es gibt in `supabase/migrations/` keine Folge-Migration, die die Dimension auf 64 aendert. Konsequenz: Embeddings sind real wahrscheinlich nicht befuellbar, die Vektorsuche (`useSimilarCandidates.ts:32`, `useHybridCandidateSearch`) liefert leer, und **keine** `calculate-match`-Version nutzt die Embeddings ueberhaupt – das Matching ist vollstaendig regelbasiert. Das `EmbeddingHealthWidget` (`src/components/admin/EmbeddingHealthWidget.tsx`) und die Queue-Trigger (`queue_candidate_embedding_update`, Migration `:50`) bleiben damit weitgehend Fassade.

### 07.5 ML-Trainingsschleife (Outcome -> Training)

Die Daten-Foundation existiert (Migration `20260122214002_...sql`):
- **`match_outcomes`** – Predictions (von v3/v3.1) + tatsaechliches Ergebnis. v3.1 inserted hier ohne `submission_id` (`index.ts:681`), v3 upsertet mit `submission_id` (`calculate-match-v3/index.ts:172`).
- **`ml_training_events`** – Snapshot je Submission-Event (Skills/Requirements/Salary-Delta/Outcome).
- **Trigger** auf `submissions`: `sync_submission_outcome_to_match()` (`:57`) schreibt Outcomes automatisch zurueck; `log_ml_training_event()` (`:79`) protokolliert Insert/Status-Change.
- `track-match-outcome` bietet `record` / `calibrate` (Score-Bucket-Accuracy, Over-/Underconfidence) / `rejection-analysis`.
- `seed-ml-training-data` generiert 200 synthetische Outcomes per Zufall (`OUTCOME_SCENARIOS`, `:10`).

**Die Schleife ist offen**: Es gibt keine Function/Cron, die `match_outcomes`/`ml_training_events` konsumiert und daraus `matching_config` (Gewichte/Schwellen) neu kalibriert oder ein Modell trainiert. `calibrate` ist reines Reporting; `AdminMatchingConfig` schreibt Gewichte **manuell** (`src/pages/admin/AdminMatchingConfig.tsx:205`). "ML" ist heute Daten-Sammlung + Heuristik-Tuning von Hand, kein Lernen.

### 07.6 Frontend-Anzeige (KI-Matching V3.1) und Versions-Wildwuchs

Es existieren **vier** Kandidaten-Matching-UIs nebeneinander:

| Komponente | Engine | Hinweis |
|---|---|---|
| `CandidateJobMatching.tsx` | `useJobMatching` (**client-seitig**) | re-implementiert eigene Gewichte 0.35/0.25/0.25/0.15, kein Edge-Call |
| `CandidateJobMatchingV2.tsx` | `useMatchScoreV2` (+ `useJobMatching`) | mischt Edge-v2 mit Client-Liste |
| `CandidateJobMatchingV3.tsx` | `useMatchScoreV31` | **die "KI-Matching V3.1"-Ansicht** |
| `CandidateHeroMatching.tsx` | `useMatchScoreV31` | Hero-Variante |

Die produktive V3.1-Ansicht (`src/components/candidates/CandidateJobMatchingV3.tsx`) laedt bis zu 50 `published` Jobs **ohne** `company_name` (Triple-Blind, `:119`), ruft `calculateBatchMatch(candidate.id, jobIds, 'preview')` (`:148`) auf, sortiert via `sortByRelevance` und zeigt anonymisierte Firmen per `formatAnonymousCompany` (`:189`); erst nach `company_revealed`-Submission wird der echte Name eingeblendet (`revealedMap`, `:139`). Pro Job rendert `MatchScoreCardV31` Policy-Badge (hot/standard/maybe), Score, Coverage, Multiplikator und `explainability`.

Weitere Konsumenten von v3.1: `recruiter/CandidateSubmitForm.tsx:63` (Single-Match vor Einreichung), `talent/*`. KI-Textempfehlung via `AIRecommendationBadge.tsx` -> `useMatchRecommendation` -> `generate-match-recommendation`.

Admin-Steuerung: `AdminMatchingConfig` (Gewichte/Schwellen in `matching_config`), `AdminSkillSynonyms` (`skill_synonyms`), `AdminDomains` (Transferability), `MLHealthWidget` (Outcome-Statistik + Seed-Button), `EmbeddingHealthWidget` (Queue).

### 07.7 Datenfluss-Diagramm

```mermaid
flowchart TD
    subgraph FE[Frontend]
      CJM[CandidateJobMatchingV3.tsx<br/>KI-Matching V3.1]
      HOOK[useMatchScoreV31]
      SUBMIT[CandidateSubmitForm]
      AREC[AIRecommendationBadge]
      ADMIN[AdminMatchingConfig / MLHealthWidget]
    end

    subgraph EF[Edge Functions]
      V31[calculate-match-v3-1]
      REC[generate-match-recommendation]
      EMB[generate-embeddings]
      SEED[seed-ml-training-data]
      TRACK[track-match-outcome]
    end

    subgraph DB[(Postgres)]
      CFG[(matching_config)]
      CAND[(candidates)]
      JOBS[(jobs)]
      JSR[(job_skill_requirements)]
      TAX[(skill_taxonomy)]
      SYN[(skill_synonyms)]
      SUB[(submissions)]
      MO[(match_outcomes)]
      MLE[(ml_training_events)]
      EQ[(embedding_queue)]
    end

    CJM --> HOOK --> V31
    SUBMIT --> HOOK
    AREC --> REC
    V31 -->|read| CFG & CAND & JOBS & JSR & TAX & SYN
    V31 -->|insert prediction| MO
    REC -->|read result| V31
    REC -->|Gemini anonymisiert| LLM[(Lovable AI Gateway)]

    SUB -- trigger sync_submission_outcome_to_match --> MO
    SUB -- trigger log_ml_training_event --> MLE
    SUB -- trigger trg_generate_fit_assessment --> FIT[assess-candidate-fit]

    CAND -- trigger queue_candidate_embedding_update --> EQ
    JOBS -- trigger queue_job_embedding_update --> EQ
    ADMIN -->|process queue| EMB --> EQ
    EMB -->|64d vector ✗ vs vector(1536)| CAND & JOBS
    ADMIN -->|seed| SEED --> MLE & MO
    ADMIN -->|calibrate report only| TRACK --> MO
    ADMIN -->|manual weights| CFG

    classDef broken fill:#fdd,stroke:#c00;
    class EMB broken;
```

### 07.8 Interconnections (kritische Verknuepfungen)

- `CandidateJobMatchingV3.tsx` -> `useMatchScoreV31.calculateBatchMatch` -> `supabase.functions.invoke('calculate-match-v3-1')` -> liest `matching_config/candidates/jobs/job_skill_requirements/skill_taxonomy/skill_synonyms`, schreibt `match_outcomes`.
- `submissions` (INSERT/UPDATE) -> Trigger `sync_submission_outcome_to_match` + `log_ml_training_event` -> `match_outcomes` / `ml_training_events` (ML-Datenerfassung, vollautomatisch).
- `submissions` (INSERT) -> Trigger `trg_generate_fit_assessment` -> `pg_net` HTTP POST -> `assess-candidate-fit` (Matching grenzt hier an die Fit-Assessment-Domaene).
- `candidates`/`jobs` (UPDATE relevanter Felder) -> Trigger `queue_*_embedding_update` -> `embedding_queue`; `EmbeddingHealthWidget` -> `generate-embeddings` (batch) -> schreibt 64d-Vektor (Konflikt mit `vector(1536)`).
- `generate-match-recommendation` haengt am v3.1-Output (Client uebergibt `matchResult`) und ruft den LLM mit **anonymisiertem** Firmenprofil (`anonymizeCompanyForAI`, `:51`) – Triple-Blind-konform.
- `AdminMatchingConfig` ist die **einzige** Schreibquelle fuer `matching_config.weights/gate_thresholds`; v3 und v3.1 lesen denselben Datensatz (`active = true`), v3.1 zusaetzlich gefiltert nach `profile`.

### 07.9 Friction- und Risikopunkte

1. **Embedding-Dimensions-Konflikt (kritisch)**: `generate-embeddings` schreibt 64d, Schema ist `vector(1536)`. Vektorsuche faktisch tot, Inserts schlagen vermutlich fehl. Entweder echtes 1536d-Embedding-Modell anbinden oder Schema/RPCs/Index auf `vector(64)` umstellen – und dann tatsaechlich im Matching nutzen.
2. **Offene ML-Schleife**: Viel Infrastruktur (`match_outcomes`, `ml_training_events`, Trigger, `calibrate`), aber kein Training/Auto-Tuning. "ML" suggeriert Lernen, das nicht stattfindet. Empfehlung: Kalibrierungs-Cron, der Schwellen/Gewichte aus Outcomes ableitet, oder klare Umbenennung in "Analytics".
3. **Vier parallele Matching-Implementierungen** (v1, v2, v3, v3.1) + **zweite client-seitige** (`useJobMatching`) mit **unterschiedlichen Gewichten**. Nutzer sehen je nach Komponente abweichende Scores fuer dieselbe Paarung. Empfehlung: v3.1 als Single Source of Truth, Alt-Versionen + `useJobMatching`-Scoring deprecaten/entfernen.
4. **v3.1 schreibt `submissions.match_score` nicht zurueck**: Der angezeigte Score (Feed) und der in `submissions`/`match_outcomes` persistierte Score koennen divergieren (Letzterer stammt aus v1/v2/v3 oder fehlt). `match_outcomes`-Insert ohne `submission_id` (`:681`) erschwert die spaetere Outcome-Zuordnung; `sync_submission_outcome_to_match` matcht aber nur ueber `submission_id` -> viele v3.1-Predictions bekommen nie ihr Outcome.
5. **Toter, ausgefeilter Code**: `skill-matcher.ts` (Levenshtein-Fuzzy + Skill-Level Years/Proficiency/Recency) wird vom Haupt-Handler nicht aufgerufen; stattdessen laeuft die simplere Inline-`matchSingleSkill`. Wartungslast ohne Wirkung; potenziell schlechtere Match-Qualitaet als beabsichtigt.
6. **`config.profile`-Luecke**: v3.1 fragt `matching_config` nach `profile = configProfile` (z.B. `tech/finance/sales`, `index.ts:622`), gesetzt ist aber nur ein `default`-Datensatz (`profile`-Spalte erst nachtraeglich mit Default `'default'` ergaenzt). Fuer Nicht-`default`-Profile greift still der Hardcoded-Fallback – Admin-Konfig wird unbemerkt ignoriert.
7. **Inkonsistenter AI-Gateway-Endpoint**: `normalize-skills` ruft `https://api.lovable.dev/v1/chat/completions` (`:121`), alle anderen `https://ai.gateway.lovable.dev/...`. Sehr wahrscheinlich falscher Host -> AI-Fallback im Skill-Normalizer schlaegt fehl (faellt auf confidence-20 zurueck).
8. **Tech-Domain-Hardcoding**: `TECH_DOMAINS` (`index.ts:14`) ist eine grosse, manuell gepflegte Keyword/Inkompatibilitaets-Matrix. Neue Felder/Quereinsteiger werden hart mit x0.1 bestraft (`:1052`), ohne dass Admins das ueber `matching_config` steuern koennen – potenziell unfaire Ausschluesse, schwer auditierbar.
9. **`talent-pool-match` mit drittem Scoring-Schema**: Eigene Faktor-Mittelung (Average statt gewichtet, Schwelle 70), unabhaengig von `matching_config` – noch eine Scoring-Logik, die separat driftet.
10. **Synthetische Seed-Daten verfaelschen Kalibrierung**: `seed-ml-training-data` mischt zufaellige Outcomes in dieselben Tabellen wie echte. `track-match-outcome calibrate` kann reale und Fake-Daten nicht trennen -> Accuracy/Calibration-Reports irrefuehrend.

### 07.10 Offene Fragen

- Soll Vektorsuche/Embeddings echt produktiv werden (dann 1536d-Modell + Integration ins Matching), oder ersatzlos entfernt werden?
- Welche `calculate-match`-Version ist kanonisch? Koennen v1/v2/v3 und das client-seitige `useJobMatching`-Scoring abgeschaltet werden?
- Wie wird der v3.1-Feed-Score persistiert/auditierbar gemacht, damit `match_outcomes` ihn dem realen Outcome zuordnen kann (fehlende `submission_id`-Verknuepfung)?
- Ist eine echte Kalibrierungs-/Trainings-Pipeline geplant (Outcomes -> Gewichte/Schwellen), und falls ja: per Cron-Job oder Offline-Training?
- Welche `matching_config`-`profile`-Datensaetze (tech/finance/sales) muessen seedmaessig angelegt werden, damit `configProfile` ueberhaupt wirkt?
