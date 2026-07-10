# Ultimate Plan — Dynamische KI-Jobaufnahme (backend-integriert)

**Stand:** 2026-06-19 · gründet auf 2 Research-Wellen (Recruiter-Bedarf + Backend-Verdrahtung)
**Gelockte Entscheidungen:** Client-Intake zuerst · Hybrid-Speicherung · tiefes Briefing (~12, adaptiv) · voll-KI-dynamisch · nie blockieren (nudgen)
**Begleit-Doc:** [JOBAUFNAHME_FRAMEWORK.md](JOBAUFNAHME_FRAMEWORK.md) (die 13-Block-Taxonomie)

---

## 0. Das System, wie es wirklich ist (Grounding)

**Job-Lifecycle:** `draft → pending_approval → published → closed` (+ `paused_at` orthogonal). Kein DB-Enum/Check; alle Übergänge frontend-seitig. **Admin-Approval-Gate** (`JobApprovalDialog`) ruft `format-job-for-recruiters`, setzt dann `published` + `formatted_content` + Fees + `approved_at/by`. → **Das Approval-Gate bleibt; „Übergeben" = `pending_approval`.**

**Edge-Function-Muster:** `parse-job-url/pdf`, `extract-intake-briefing`, `enrich-job-data` sind **stateless Extraktoren** (schreiben NICHT in `jobs`; das Frontend persistiert per `INSERT`). Nur `format-job-for-recruiters` (`formatted_content`) und `generate-job-summary` (`job_summary`) schreiben zurück. Alle HTTP vom Frontend, Lovable-AI-Gateway/Gemini. → **`intake-questions` wird genauso stateless.**

**Matching:** Live = **V3.1** (`calculate-match-v3-1`, keyword/taxonomy, schreibt `match_outcomes`). **Embeddings tot** (64→1536). Score-Pipeline: Hard-Kills → Dealbreaker-Multiplikatoren → Fit (skills/exp/seniority/industry) → Constraints → Policy-Tier.

**Reveal:** `identity_unlocked` (Client sieht Kandidat-PII) vs. `company_revealed`/`full_access_granted` (Recruiter erfährt Firma). 3 Trigger; **Stage-vs-Status-Split-Brain** (s.o.). `reveal_trigger`/`reveal_envelope` = greenfield.

**RLS:** Client besitzt die Zeile (`client_id=auth.uid()`, `FOR ALL`, spaltenblind). Recruiter liest nur `recruiter_jobs_view` (definer, spalten-whitelisted) — **derzeit ungenutzt** (Leak).

### Defekte, die der Plan navigieren/mitfixen muss
| # | Defekt | Konsequenz fürs Intake |
|---|---|---|
| D1 | `must_haves` als Komma-Satz gespeichert | Matcher matcht je Eintrag per Substring/Synonym → **muss saubere Skill-Tokens** liefern |
| D2 | `visa_sponsorship`, `experience_min/max` vom Matcher gelesen, **Spalte fehlt** | Visa-Hard-Kill & Erfahrungs-Score kaputt → **als typisierte Spalten anlegen + Intake befüllt sie** |
| D3 | `required_languages` jsonb `{code,minLevel}`, `onsite_required` bool, `required_certifications` text[] = Hard-Kills | **exakte Shapes** erzeugen, sonst Fehlzündung |
| D4 | `must_have_criteria` & `job_skill_requirements` nie konsumiert | nicht drauf verlassen; `must_haves` bleibt autoritativ |
| D5 | ~13 extrahierte Intake-Felder beim `INSERT` verworfen; `intake_briefing` speichert `company_culture`; `candidates_in_pipeline` parseInt-lossy | in Phase 0 fixen |
| D6 | `recruiter_jobs_view` tot → `company_name` leakt; `quick_facts` halluziniert | Phase 4 (Recruiter-Loop): View verdrahten + Envelope einspeisen |
| D7 | Embeddings tot (64→1536) | Intake **nicht** auf Semantik bauen |
| D8 | Reveal Stage-vs-Status-Split-Brain | beim `reveal_trigger` auf **eine** Achse standardisieren |

---

## 1. Architektur-Leitplanken

1. **Zwei Schreibziele aus dem Intake:**
   - **(A) Typisierte Matching-Felder** (exakte Shapes für V3.1): `must_haves` (Skill-Tokens), `title`, `experience_level`, `salary_max`, `required_languages` `{code,minLevel}`, `required_certifications` text[], `onsite_required` bool, `remote_policy`, `industry`, **neu** `visa_sponsorship`, `experience_min/max`.
   - **(B) `intake_payload jsonb`** (Briefing/Sell/Sourcing/Kontext): Vorgänger-Story, Success/Failure-Profil, Anti-Persona, Comp-Flex/Decke, X-Faktor, Ziel-/No-Go-Firmen, Entscheider, ehrliche Schattenseite usw.
   - **(C) `reveal_envelope jsonb` + `reveal_trigger text`**: ersetzt halluzinierte `quick_facts`/`anonymous_company_pitch` und steuert das Company-Reveal.
2. **`intake-questions` = stateless** (kein DB-Zugriff, kein Service-Role). Input: aktueller Entwurf + bisherige Antworten. Output: nächste Fragen + Chips + gewichtete Completeness + **sauber normalisierte** Matching-Felder. Client persistiert per eigenem JWT (RLS deckt es).
3. **Lifecycle unangetastet:** „Übergeben" → `pending_approval` → Admin-Approval → `published`. Kein Auto-Publish.
4. **Keine per-Spalten-RLS:** alles Matching-/Trust-Relevante = typisierte Spalte, nicht jsonb-Key.

---

## 2. Build — phasiert (jede Phase shipbar)

### Phase 0 — Capture-Integrität (klein, hoher Wert) · ~1 Tag
- `INSERT` in `CreateJob` repariert: alle extrahierten Felder persistieren; `intake_briefing`-Bug fixen (echten Briefing-Text in `intake_payload.briefing_text`); `candidates_in_pipeline`-Coercion fixen.
- **Phantom-Matching-Spalten anlegen** (D2) und ab sofort befüllen: `visa_sponsorship`, `experience_min`, `experience_max` → schaltet Visa-Hard-Kill & Erfahrungs-Score scharf.
- *(Reiner Bugfix, keine neue UI — kann sofort raus.)*

### Phase 1 — Schema-Migration (Hybrid) · ~0,5 Tag
```
ALTER TABLE jobs
  ADD COLUMN intake_payload      jsonb,
  ADD COLUMN reveal_envelope     jsonb,
  ADD COLUMN reveal_trigger      text DEFAULT 'after_first_interview',
  ADD COLUMN search_difficulty   text,
  ADD COLUMN target_companies    text[],
  ADD COLUMN nogo_companies      text[],
  ADD COLUMN visa_sponsorship    boolean,      -- D2
  ADD COLUMN experience_min      integer,      -- D2
  ADD COLUMN experience_max      integer;      -- D2
```
RLS: **keine neue Policy nötig**. `intake_payload`/`reveal_envelope` automatisch recruiter-privat (nicht in `recruiter_jobs_view`).

### Phase 2 — `intake-questions` Edge-Function (voll-KI-dynamisch) · ~2–3 Tage
- Stateless, Gemini via Lovable-Gateway. Encodiert die Orchestrierung: **Fork** auf `contract_type` · **Gate** auf Seniorität/`search_difficulty` (drängt Muss zu kürzen, Flex zu mappen) · conditional firing · **Tension-Flags** · **De-Anonymisierungs-Guardrail** (Green- vs. Red-List) · Frage-Ökonomie (Pflicht: Muss-Kriterien, Reveal/Protect, Ziel-/No-Go-Firmen).
- Output-Contract: `{ next_questions[], chips, weighted_completeness, typed_fields{...}, skill_requirements[{skill,kind,min_years,proficiency,recency}], intake_payload_patch{...}, reveal_envelope_patch{...}, tension_flags[] }`.
- **Strukturierte Skills (Entscheidung 2):** die KI normalisiert Muss/Kann nicht nur zu Tokens, sondern zu per-Skill-Requirements → Client persistiert sie in `job_skill_requirements`.
- **Completeness neu:** gewichteter Impact-Score über die 13 Blöcke (Pflicht zählt mehr), nicht die fixen 10 Felder.

### Phase 3 — Frontend: „Sie suchen?"-Sektion + Vollbild-Intake-Studio · ~3–4 Tage
- **Dashboard-Sektion „Sie suchen?"** mit 2 Buttons: **Festanstellung / Contracting** (ersetzt die Button-Suppe).
- Klick → **Vollbild-Overlay (Studio)**: eine Eingabefläche (Text/PDF/Link/ATS) → **Live-Build** (Felder füllen sich nacheinander mit Häkchen) → **editierbare Profil-Karte in Sektionen** (Eckdaten/Skills/Remote/Firma — alle alten Wizard-Felder, KI-gefüllt) → **dynamisches Briefing in Kapiteln** (`intake-questions`, jede Frage expliziter Klick inkl. „Weiß ich nicht") → **Übergeben** (direkt, `status:'pending_approval'`).
- Contracting = echter Fork (Tagessatz/Dauer/Auslastung statt Gehalt).
- **Team-Delegation:** „an Fachbereich geben" (ganze Aufnahme od. einzelne Fragen) — nutzt bestehende Org-Rollen (`hiring_manager`). **Speichern & Fortsetzen.**
- Persistenz: typisierte Matching-Felder **+** `intake_payload`/`reveal_envelope` (Client-JWT). Alter `CreateJob`-Wizard bleibt als Tiefen-Editor.
- *Produkt-Entscheidungen (2026-06-19): Studio = Vollbild-Overlay · Sie/sachlich · KI füllt, Kunde bestätigt nur Lücken · alle Eingabewege gleichwertig · nie blockieren · direkt übergeben.*

### Phase 4 — Recruiter-Loop schließen (zweite Hälfte) · ~3–4 Tage
- `format-job-for-recruiters` mit `reveal_envelope` + echten Intake-Feldern füttern → **Schluss mit halluzinierten** `quick_facts`; echte Teamgröße/Kultur/Prozess/Success-Profil/Sell/Benefits ausspielen.
- **`recruiter_jobs_view` verdrahten** (D6-Leak schließen): Recruiter-UI von `jobs.*` auf die maskierte View umstellen, Projektion um die freigegebenen Envelope-Felder erweitern.
- **`reveal_trigger` erzwingen:** `company_revealed`-Writes (in `reveal_company_on_opt_in`, `grant_full_access_on_interview_confirm`, `schedule-interview`, `process-interview-response`) auf `jobs.reveal_trigger` gaten; Stage-vs-Status-Split-Brain (D8) auf eine Achse standardisieren.

### Phase 5 — Matching-Anschluss + Verifikation · ~3 Tage
- Sicherstellen, dass Intake-Hard-Kill-Felder in exakter Shape ankommen (D1/D3) und V3.1 sie konsumiert; Phantom-Bugs (D2) verifiziert behoben.
- **`job_skill_requirements` scharf schalten (Entscheidung 2):** Tabelle aus dem Intake befüllen; verifizieren, dass V3.1 den `skill-matcher.ts`-Pfad (min-years/proficiency/recency) nutzt statt des `must_haves`-Fallbacks.
- **Tests:** RLS (Client sieht keine fremden Jobs; Recruiter sieht kein `intake_payload`/rohes `company_name`), E2E (Intake → Job → Match-Score), Shape-Test (typisierte Felder + `job_skill_requirements` in V3.1-erwarteter Form).

---

## 3. Feld-Routing (Intake → Backend)

| Intake-Block | Typisierte Spalte (Matching/Commercial) | `intake_payload` / `reveal_envelope` |
|---|---|---|
| Rolle & Scope | `title`, `experience_level`, `experience_min/max` | reports_to, team_size, scope, `search_difficulty` |
| Muss/Kann/Anti | `must_haves` (Tokens!), `nice_to_haves`, `skills` | anti_persona, #1-Kriterium, must_ranked |
| Harte K.O. | `required_languages{code,minLevel}`, `required_certifications`, `onsite_required`, `visa_sponsorship` | non_compete/conflicts, tenure |
| Vergütung | `salary_min/max` | comp_flex/Decke, Bonus, Equity, Benefits |
| Arbeitsmodell | `remote_policy`/`remote_type`, `onsite_days_required` | Kultur, Reise, On-Call |
| Timing & Vertrag | `contract_type`/`employment_type`, `hiring_urgency` | Kündigungs-Toleranz, Freelance-Dauer/Verläng./Auslastung |
| Sell/EVP | — | mission, manager_pitch, x_faktor, career_path |
| Prozess | — | interview_rounds, decision_makers |
| Sourcing | `target_companies[]`, `nogo_companies[]` | current_titles, adjacent_profiles |
| Risiken | — | works_council, why_failed, downside |
| Triple-Blind | `reveal_trigger` | `reveal_envelope` (green/red list, descriptor) |

---

## 4. Getroffene Entscheidungen (2026-06-19)
1. **Phantom-Bugs (D2): JA, jetzt** — `visa_sponsorship`, `experience_min/max` in P0/P1 anlegen, Intake befüllt sie → Visa-Hard-Kill & Erfahrungs-Score scharf.
2. **`job_skill_requirements` (D4): JA, jetzt strukturiert verdrahten** — das Intake erzeugt pro Skill `{skill, kind: must|nice, min_years, proficiency, recency}`, persistiert in die Tabelle `job_skill_requirements`, und V3.1 konsumiert sie (der `skill-matcher.ts`-Pfad existiert, wird heute aber **nie befüllt** → fällt immer auf `must_haves` zurück). `must_haves`-Tokens bleiben als Fallback. → erweitert P1/P2/P5.
3. **Recruiter-Loop (P4): nachgelagert** — erst Client-Intake end-to-end (P0–P3, P5).

---

## 5. Reihenfolge & Aufwand (Richtwert)
```
P0 Capture-Fix (1d) → P1 Schema (0.5d) → P2 intake-questions (2–3d)
→ P3 Composer/Briefing-UI (3–4d) → P5 Matching+Tests (3d) → [P4 Recruiter-Loop, später]
```
Kern-Lieferung (P0–P3, P5) = die dynamische Client-Jobaufnahme end-to-end **inkl. strukturiertem Skill-Matching**, ~10–12 Tage. P4 (Recruiter-Ausspielung + Leak-Fix + Reveal-Trigger) als bewusst nachgelagerter zweiter Wurf.

*Referenzen: Backend-Map `tasks/w0rx0o0xf.output`, Bedarfs-Research `tasks/wgvnvj0gt.output`.*
