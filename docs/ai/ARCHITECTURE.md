# Matching-Architektur — V4 erweitert V3.1

Stand 2026-07-18. Leitprinzip: **V4 ersetzt die bestehende Engine nicht — sie
baut sie aus.** V3.1 (Hard-Kills, Dealbreaker, strukturierter Fit) kodiert
echte Geschäftsregeln und bleibt Stufe 1. Die neuen Stufen docken an drei
existierende Punkte an, jede hinter dem Flag `MATCH_V4_ENABLED`, jede einzeln
per Eval-Harness gemessen (`evals/`).

```
Job-Anlage / Job-Änderung
   │
   ▼
[N] NORMALIZER (normalize-job-requirements, async at write time)
    LLM übersetzt Satzfragment-Must-haves → kanonische Skill-Anforderungen
    und schreibt sie nach job_skill_requirements.
    ➜ ANDOCKPUNKT 1: Diese Tabelle liest calculate-match-v3-1 BEREITS nativ
      (bevorzugt vor rohen must_haves) — der Normalizer verbessert die
      bestehende Engine, ohne eine Zeile an ihr zu ändern.
    Bewusst NICHT: required_languages schreiben (Language-Kill-Landmine,
    solange candidates.language_skills leer ist).
   │
   ▼
[1] V3.1 GATES + FIT (calculate-match-v3-1, UNVERÄNDERT)
    Hard-Kills (Visa/Sprache/Präsenz/Zertifikate), Dealbreaker-Multiplikatoren,
    Skill-/Erfahrungs-/Senioritäts-Fit. Gekillte Paare enden hier — 
    Geschäftsregeln bleiben führend.
   │
   ▼
[2] JUDGE (calculate-match-v4, Top-N nicht-gekillte Paare)
    Evidenzbasierter LLM-Judge (5 Dimensionen à 0-100, Zitat-Pflicht,
    ohne Beleg → 0). Versteht Bedeutung statt Wortgleichheit; bewertet
    bewusst AUCH excluded/hidden-Paare (93%-Hidden-Befund: der Judge kann
    zu Unrecht Versteckte rehabilitieren).
    ➜ ANDOCKPUNKT 2: läuft auf der BESTEHENDEN LLM-Infrastruktur
      (Lovable-Gateway) und der BESTEHENDEN PII-Redaktion
      (_shared/pii-redaction.ts, fail-closed Leak-Check).
    Cache: match_ai_judgements (pair-level, input_hash-invalidiert).
   │
   ▼
[3] BLENDING (pure Logik in _shared/match-v4.ts)
    final = 0.45·V3.1 + 0.55·Judge (gepinnt; Tuning nur via Eval).
    Identischer Code in Produktion und Eval-Harness (Import beider Seiten).
   │
   ▼
[4] LERN-SCHLEIFE (match_events)
    ➜ ANDOCKPUNKT 3: jede Bewertung und (künftig) jede Recruiter-Interaktion
      (impression→click→shortlist→hire/reject) landet versioniert und mit
      is_synthetic-Flag in match_events. Speist wöchentlich den Eval-Harness
      (Golden-Set wächst mit echten Outcomes) und später das Training eines
      eigenen Rankers (~ab 1.000 gelabelten Paaren).
```

## Rollout & Rollback

- **Shadow (jetzt):** `calculate-match-v4` wird von keiner UI aufgerufen;
  Ergebnisse werden nur geloggt. Flag aus ⇒ Funktionen antworten 403,
  V3.1 unberührt.
- **Vergleich:** Shadow-Ergebnisse vs. V3.1 auf echten Submissions; V4 geht
  erst in die UI, wenn es die Baseline auf `dataset.real.v1.json` schlägt
  (nDCG@10 > 0.283, Leak@10 < 0.306 — CI-Gate `npm run eval:check`).
- **Rollback:** Flag aus. Kein Migrations-Rollback nötig (alles additiv).

## Skalierungs-Slots (bewusst vorbereitet, noch nicht gebaut)

- **Retrieval (Embeddings + BM25 + RRF):** Bei heutigem Pool (~50 Kandidaten)
  ist All-Pairs-Scoring korrekt und billig. Ab ~500+ Kandidaten wird zwischen
  Stufe [N] und [1] eine Recall-Stufe eingezogen (pgvector ist vorhanden;
  Embedding-Modellwahl dann per ADR mit frischem Benchmark-Check + EU-Residenz,
  Entscheidung D3).
- **Cross-Encoder-Reranker:** zwischen [1] und [2], wenn die Judge-Kosten pro
  Anfrage relevant werden (Top-100 → Top-25 vor dem Judge).
- **Eigener Ranker:** trainiert auf match_events, sobald genug echte Labels
  existieren — der Daten-Burggraben.

## Gepinnte Versionen

Alle Modell-/Prompt-Versionen leben in `_shared/match-v4.ts`
(`JUDGE_MODEL`, `JUDGE_PROMPT_VERSION`, `NORMALIZER_*`, `BLEND_JUDGE_WEIGHT`,
`MATCH_V4_VERSION`). Änderung ⇒ Versions-Bump + Eval-Lauf; das CI-Gate und
der Drift-Guard der V3.1-Replika erzwingen das.
