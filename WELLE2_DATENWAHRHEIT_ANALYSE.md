# Welle 2 — Datenwahrheit: Analyse & Entscheidungsvorlage

**Stand:** 2026-07-25 · Grundlage: 29 Submissions des Test-Recruiters, vollständige Code- und Edge-Function-Auswertung.

---

## 1. Warum es überhaupt zwei Felder gibt

| Zeitpunkt | Migration | Was passierte |
|---|---|---|
| 04.12.2025, 17:16 | `20251204171610` | `submissions.status TEXT DEFAULT 'submitted'` |
| 04.12.2025, 18:21 | `20251204182100` | `submissions.stage text DEFAULT 'submitted'` — Kommentar: *„Add stage column to submissions for Kanban pipeline"* |

**Beide sind freies `text`.** Kein CHECK-Constraint, kein Enum, kein Trigger, der sie synchron hält. Es gibt technisch nichts, was Widersprüche verhindert — sie sind nicht die Ausnahme, sondern der Normalfall.

---

## 2. Der Ist-Zustand in den Daten

Kreuztabelle über 29 Submissions (`stage | status`):

| stage | status | Anzahl | konsistent? |
|---|---|---|---|
| submitted | rejected | **11** | ❌ |
| interview_requested | rejected | **3** | ❌ |
| interview_1 | rejected | **1** | ❌ |
| offer | rejected | **1** | ❌ |
| candidate_opted_in | interview | 4 | ✅ |
| interview_requested | interview | 4 | ✅ |
| rejected | rejected | 2 | ✅ |
| client_rejected | rejected | 1 | ✅ |
| submitted | submitted | 2 | ✅ |

**16 von 29 (55 %) widersprechen sich.**

### Welches Feld hat bei den 16 recht?

Von den 16 widersprüchlichen Zeilen tragen **14 einen `rejection_reason`** (`culture_fit`, `other`, …). Die Absage ist also real — **`status='rejected'` ist die Wahrheit, `stage` wurde schlicht nie nachgezogen.**

Das ist wichtig für die Migration: Bei diesen Zeilen muss `stage` korrigiert werden, nicht `status`.

---

## 3. Die Ursache: wer schreibt was

| Schreibt **nur `stage`** | Schreibt **nur `status`** | Schreibt **beide** |
|---|---|---|
| `CandidateTasksSection` (opt-in) | `ExposeQuickDecisionWidget` → `'rejected'` | `useHiringPipeline` → `stage: X, status: X` |
| `TaskDetailDialog` (opt-in) | `NewCandidateFeed` → `newStatus` | `AdminCandidates` → `status: X, stage: X` |
| `SubmissionDetailDialog` (opt-in) | `process-rejection` → `'rejected'` | `send-interview-invitation` → `stage: interview_requested`, `status: interview` |
| `SubmissionDetail` (opt-in) | `fraud-detection` → `'blocked'`, `'flagged'` | `create-offer` → `stage: offer_pending`, `status: offer_extended` |
| `process-interview-response` → `interview_scheduled`, `interview_counter_proposed`, `interview_declined` | | `process-offer-response` → beide `'placed'` |

**Genau hier entstehen die 16 Widersprüche:** Der Kunde lehnt über `ExposeQuickDecisionWidget` ab — das schreibt ausschließlich `status='rejected'`. Der Recruiter holt das Opt-In ein — das schreibt ausschließlich `stage`. Keiner der beiden Pfade fasst das jeweils andere Feld an.

Erschwerend: `useHiringPipeline` und `AdminCandidates` schreiben **Stage-Werte in das Status-Feld** (`status: newStage`). `status` ist dadurch bereits mit Stage-Vokabular verunreinigt.

---

## 4. Drei Vokabulare, die nicht zueinander passen

**`stage`** (aus dem Code): `submitted`, `candidate_opted_in`, `interview_requested`, `interview_scheduled`, `interview_counter_proposed`, `interview_declined`, `interview_1`, `interview_2`, `offer_pending`, `offer`, `placed`, `hired`, `rejected`, `client_rejected`

**`status`** (aus dem Code): `submitted`, `interview`, `offer_extended`, `placed`, `rejected`, `blocked`, `flagged` — **plus das gesamte Stage-Vokabular** über `useHiringPipeline`/`AdminCandidates`

**Was die Oberfläche erwartet — passt zu keinem von beiden:**
- `RecruiterSubmissions` Kanban: `submitted`, `reviewing`, `interview_scheduled`, `interviewed`, `offer`, `hired`, `rejected`
- `RecruiterDashboard` Pipeline: `submitted`/`pending`, `in_review`, `interview`, `offer`
- `useHiringPipeline`: `submitted`, `interview_1`, `interview_2`, `offer`, `hired`

Deshalb ist der Kanban leer: Er filtert `status === 'interview_scheduled'`, in der DB steht aber `status = 'interview'`.

---

## 5. Empfehlung

**`stage` wird die Wahrheit. `status` wird ein abgeleiteter Spiegel, den ein Trigger pflegt.**

Begründung:
1. `stage` ist das einzige Feld mit einem zusammenhängenden Prozess-Vokabular. `status` kennt nur 3 reale Werte und kann den Prozess gar nicht abbilden.
2. `status` ist bereits mit Stage-Werten verunreinigt — es ist kein sauberes Feld mehr, das man retten könnte.
3. Die reveal-relevante Logik (Opt-In, Interview-Freigabe) hängt schon heute an `stage`. Das ist der sicherheitskritische Pfad und sollte nicht umgehängt werden.
4. `status` als Trigger-gepflegten Spiegel zu behalten heißt: **kein einziges Widget bricht.** 99 Dateien lesen `.status` — die dürfen weiterlaufen und werden später schrittweise umgestellt statt in einem Big Bang.

### Vorgehen

1. **Kanonisches Stage-Vokabular festlegen** + als CHECK-Constraint erzwingen, damit sich das Problem nicht neu bildet.
2. **Bestand migrieren:** die 16 Zeilen mit `status='rejected'` und aktiver `stage` auf eine abgelehnte Stage setzen (Evidenz: 14 haben `rejection_reason`). Restliche Werte auf das kanonische Vokabular normalisieren (`interview_1`/`interview_2` → `interview_scheduled` o. ä.).
3. **Trigger:** `status` wird bei jedem Schreiben aus `stage` abgeleitet. Beide Felder können danach nicht mehr auseinanderlaufen.
4. **Schreibstellen bereinigen:** die 4 status-only-Writer auf `stage` umstellen (v. a. `ExposeQuickDecisionWidget` — die Quelle der 16 Widersprüche).
5. **Kanban & KPIs** auf das kanonische Vokabular mappen — damit werden die 8 unsichtbaren Interview-Kandidaten wieder sichtbar (P0-3).

### Risiko

Der Trigger überschreibt `status` — Code, der `status` eigenständig auf einen Wert setzt, der nicht aus `stage` ableitbar ist (`fraud-detection`: `blocked`/`flagged`), verliert diesen Wert. Das braucht eine eigene Behandlung: entweder eigene Spalte (`is_blocked`) oder eine Ausnahme im Trigger.
