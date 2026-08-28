# Eval-Harness (Phase 1)

Messsystem für die Matching-Engine und (künftig) alle LLM-Features.
**Prime Directive: Keine AI-Änderung shippt ohne Eval-Beweis.**

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run eval:matching` | Komplette Metrik-Suite gegen alle Baseline-Varianten, Report nach `evals/reports/` |
| `npm run eval:matching -- --write-baseline` | Friert `v31-live-config` als CI-Baseline ein (`evals/baselines/baseline.v1.json`) |
| `npm run eval:check` | CI-Gate: Regression > ±0.02 gegen die Baseline ⇒ Exit 1 |
| `npm run test:evals` | Unit-Tests (Metriken, Drift-Guard) |
| `npm run typecheck:evals` | Typecheck des Harness |

## Aufbau

```
evals/
├── golden/matching/
│   ├── schema.ts               # Zod-Schema des Golden-Datasets
│   ├── generate-dataset.ts     # deterministischer Generator (synthetisch, Handarbeit)
│   ├── dataset.v1.json         # 14 Jobs, 66 Kandidaten, 32 Positives, 24 Hard-Negatives
│   └── taxonomy.fixture.json   # eingefrorene skill_taxonomy/skill_synonyms (aus Seed-Migrationen)
├── adapters/
│   ├── types.ts                # MatcherAdapter-Interface (auch für V2-Engines)
│   └── v31-baseline/
│       ├── matcher.ts          # EINGEFRORENE verbatim-Replika des Live-Matchers (nicht editieren!)
│       ├── drift.test.ts       # schlägt fehl, wenn calculate-match-v3-1 von der Replika abweicht
│       └── index.ts            # 3 Varianten: live-config / code-defaults / ideal-inputs
├── metrics/ranking.ts          # Recall@K, nDCG@10, MRR, Hard-Negative-Leak@10 (+ Tests)
├── lib/evaluate.ts             # Ranking + Metrik-Aggregation (Runner & CI-Gate teilen sich das)
├── run-matching-eval.ts        # Report-Runner
├── compare-to-baseline.ts      # CI-Gate
├── baselines/baseline.v1.json  # die Zahl, die V2 schlagen muss
├── reports/                    # timestamped JSON+MD-Reports (committet)
└── tools/build-taxonomy-fixture.ts
```

## Methodik

- **Richtung:** Job → Kandidaten; pro Job wird der gesamte Pool (66) gerankt.
  Ungelabelte Kandidaten anderer Job-Pools + 10 fachfremde Distraktoren wirken
  als Easy Negatives. Recall@100 ist bei 66 Kandidaten trivialerweise 1.0 —
  aussagekräftig sind Recall@10/50, nDCG@10, MRR und Leak@10.
- **Labels:** hired (Grade 3), interviewed/shortlisted (2) = Positives;
  rejected (0) = Hard-Negatives mit dokumentierter Begründung.
- **Determinismus:** Datumslogik relativ zu `reference_date`; `Date.now` wird
  im Adapter gepatcht; Tie-Breaks über `sha256(job_id::candidate_id)` (IDs
  korrelieren mit Pools — alphabetisch wäre verzerrt).
- **Drei Baseline-Varianten**, gleiche Golden-Wahrheit, unterschiedliche
  Config-/Daten-Realität — so ist bezifferbar, was Config- vs. Datendefekte
  kosten und wo die Obergrenze der heutigen Engine liegt:
  1. `v31-live-config` — HISTORISCH: Live-Zustand bis 2026-07-18. v3.0-Config
     ohne `seniority`-Gewicht → NaN-Fallback: Fit=50 für alle. Per DB-Abfrage
     verifiziert und am 2026-07-18 gefixt (Config-Update via Lovable,
     Backup-Zeile `profile='backup-20260718'`).
  2. `v31-code-defaults` — Code-Default-Config, Live-Datenrealität.
     **Seit dem Config-Fix der Live-Zustand → CI-Baseline.**
  3. `v31-ideal-inputs` — Code-Defaults + vollständige Inputs (Obergrenze).

## Baseline (2026-07-18, Dataset v1 synthetisch)

| Adapter | R@10 | R@50 | nDCG@10 | MRR | Leak@10 |
|---|---|---|---|---|---|
| `v31-live-config` (historisch, pre-fix) | 0.738 | 0.952 | 0.538 | 0.605 | **0.488** |
| `v31-code-defaults` **(CI-Baseline = live)** | 0.821 | 0.952 | 0.820 | 0.885 | 0.488 |
| `v31-ideal-inputs` | 1.000 | 1.000 | 0.965 | 1.000 | 0.393 |

Lesart: Der Config-Defekt kostete ~0.28 nDCG / ~0.28 MRR — durch den Fix vom
2026-07-18 realisiert. Selbst mit perfekten Daten leakt die heutige Engine 39%
der explizit Abgelehnten in die Top-10 — das ist der strukturelle Raum für V2
(Reranking + LLM-Judge). Achtung: synthetisches Dataset, wohlwollend
konstruiert; echte Daten werden härter sein.

## Baseline auf ECHTEN Daten (2026-07-18, dataset.real.v1.json)

Aus dem Lovable-Export gebaut (`build-real-dataset.ts`): 19 produktive Jobs,
46 Kandidaten, 19 Labels (7 interviewed, 3 submitted, 9 rejected, 0 hired) —
Demo-Seeds und Test-Artefakte ausgeschlossen und im `_meta` dokumentiert.
Pseudonymisiert (Hash-IDs, Städte entfernt).

| Adapter | R@10 | nDCG@10 | MRR | Leak@10 |
|---|---|---|---|---|
| `v31-live-config` (historisch) | 0.389 | 0.208 | 0.160 | 0.306 |
| `v31-code-defaults` **(CI-Baseline)** | 0.389 | 0.283 | 0.261 | 0.306 |
| `v31-ideal-inputs` | 0.389 | 0.283 | 0.261 | 0.306 |
| `v31-normalized-reqs` (What-if 2.1) | 0.444 | 0.297 | 0.259 | 0.306 |

Kernbefunde: (1) Das synthetische Set ist deutlich zu wohlwollend (nDCG 0.82
vs. 0.28 auf echt). (2) `ideal-inputs` bringt auf echten Daten NICHTS — die
Defekte liegen in den Daten selbst: Must-haves sind Satzfragmente
(„Abgeschlossene Ausbildung oder vergleichbare Qualifikation…"), die nie gegen
Skills matchen → **93% aller Paare (816/874) werden vom Coverage-Gate
versteckt**, darunter 7 real interviewte Kandidaten. (3) Das What-if
`v31-normalized-reqs` (kuratierte Anforderungs-Normalisierung, Fixture
`normalized-reqs.real-v1.fixture.json`) beweist: Job-seitige Normalisierung
allein bringt nur +0.06 R@10 / +0.01 nDCG und lässt 807/874 Paare hidden —
**einseitige Reparatur reicht nicht.** Konsequenz: volle V2-Pipeline
(beidseitige Normalisierung, semantisches Retrieval statt Substring,
Reranker, LLM-Judge) ist der Weg; jede Stufe wird hier einzeln gemessen.

## DB-Verifikation (2026-07-18, via Lovable)

- `matching_config`: aktive Zeile war exakt die angenommene v3.0-Seed-Zeile
  (NaN-Hypothese bestätigt) → auf Code-Defaults korrigiert (`version='v3.1'`).
- Datenrealität bestätigt: 0/54 Kandidaten mit `language_skills` oder
  `certifications`; 0/27 Jobs mit `required_languages` oder
  `required_certifications` (Sprach-/Zertifikats-Kills aktuell nicht scharf);
  `visa_sponsorship`/`experience_min`/`experience_max` fehlen in `jobs`
  (Visa-Kill trifft jeden `visa_required`-Kandidaten auf jedem Job).
- Echte Outcomes für Golden-Set v2: 35 Submissions (2 hired, 8 interview,
  3 submitted, 22 rejected); `match_outcomes` hat 9.188 Zeilen (verschmutzt,
  ungeflaggt synthetisch — nicht als Labels verwenden).

## Baseline ändern — Prozess

1. Änderung am Matcher/Harness umsetzen; `npm run eval:matching` liefert Delta.
2. Drift-Test schlägt bei Matcher-Änderungen absichtlich fehl → Replika-Segmente
   bewusst aktualisieren (verbatim, per `sed` aus der Quelle) ODER Änderung verwerfen.
3. Verbesserung mit Zahlen im PR dokumentieren, `--write-baseline` ausführen.
   Stille Baseline-Updates sind verboten.
