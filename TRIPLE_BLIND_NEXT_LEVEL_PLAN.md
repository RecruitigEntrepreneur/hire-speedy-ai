# Triple-Blind Interview-Flow → Next Level

**Stand:** 2026-06-18 · Branch `main` (Welle A/B/C + Gap #20 committet) · verifiziert gegen Code
**Ziel:** Aus einem fragmentierten, client-umgehbaren Prozess **eine kanonische, DB-erzwungene, auditierbare und nachweisbare Triple-Blind-Pipeline** machen — vom Submit bis zum terminierten Interview.

---

## 0. Leitprinzipien (North Star)

1. **Fail-closed, server-only Reveal.** Identität wird ausschließlich serverseitig freigegeben. Der Client kann seinen eigenen Reveal-Status technisch **nie** beeinflussen. Default = anonym.
2. **Ein Pfad statt vier.** Eine State-Machine, eine Kandidaten-Antwortseite, ein Token-System, eine Reveal-Funktion. Heute: 3+1 parallele Implementierungen.
3. **Auditierbarer Consent.** Jeder Reveal erzeugt einen unveränderlichen Ledger-Eintrag (wer/wann/warum/auf welcher Rechtsgrundlage). DSGVO-Auskunft per Knopfdruck.
4. **Ehrliche Semantik.** „Triple-Blind" ist nur dann ein USP, wenn er technisch erzwungen **und beweisbar** ist — nicht kosmetisch. Das wird zum Vertriebshebel.
5. **Produktniveau-Terminierung.** Echte Meeting-Links, Zeitzonen, automatische Reminder, Cancel/Reschedule, geschlossener Counter-Loop.
6. **Regressionssicher.** RLS- und E2E-Tests beweisen die Garantie bei jeder Migration in CI.

---

## 1. Zielarchitektur

### 1.1 Eine State-Machine (Single Source of Truth)

Heute existieren **zwei** überlappende Vokabulare (`submissions.stage` und `submissions.status`), die mal synchron, mal divergent geschrieben werden — die Wurzel der `COALESCE(stage,status)`-Landmine.

**Ziel:** `stage` ist die einzige Wahrheit. `status` wird abgeleitet (Generated Column oder entfernt). Erlaubte Werte + Übergänge als DB-`CHECK` + Transitions-Trigger erzwungen.

```
new → submitted → screening → shortlisted
   → interview_requested        (Client fragt an; ANONYM)
   → candidate_opted_in         (Kandidat stimmt zu → REVEAL)
   → interview_scheduled        (Termin bestätigt)
   → interview_completed
   → offer → hired → placed
   ⊥ rejected / declined / withdrawn   (Endzustände, ANONYM bleibend)
```

**Invariante:** `identity_unlocked = TRUE  ⟺  stage ≥ candidate_opted_in`. Reveal wird nie zurückgenommen (Daten werden maskiert, nie gelöscht).

### 1.2 Eine Reveal-Funktion (server-only RPC)

Alle Reveal-Auslöser rufen **eine** `SECURITY DEFINER`-Funktion auf, die als einzige `identity_unlocked` setzen darf:

```
reveal_identity(p_submission_id uuid, p_basis text, p_actor uuid, p_proof jsonb)
  → setzt identity_unlocked, unlocked_at/by, consent_confirmed(_at),
    identity_revealed (legacy synchron), schreibt reveal_ledger-Zeile.
  → idempotent; niemals Rücknahme.
```

Direkte `UPDATE submissions SET identity_unlocked=…` durch irgendeinen Nicht-Service-Aktor wird per Guard-Trigger abgelehnt.

### 1.3 Eine Kandidaten-Antwortseite, ein Token

`/interview/respond/:token` (`InterviewResponsePage` + `process-interview-response`) bleibt. `/interview/select/:token` + `schedule-interview select-slot` werden zurückgebaut (oder zu dünnem Wrapper). **Ein** kryptografisch starker Token.

---

## 2. Phasen

> Jede Phase ist eigenständig shippbar. Reihenfolge = Wirkung × (1/Risiko).

### ✅ Phase 0 — Gate dichtmachen (Sicherheit, P0) · ~1–2 Tage

**Ziel:** Der Reveal-Bypass und der vorzeitige Reveal sind geschlossen, bevor irgendetwas anderes passiert. Reine additive Migration + 2 Edge-Fn-Fixes, **kein** UI-Umbau.

| # | Task | Datei |
|---|------|-------|
| 0.1 | **Guard-Trigger** `protect_reveal_columns`: `BEFORE UPDATE`, wenn Aktor nicht Service-Role/Admin **und** eine geschützte Spalte (`identity_unlocked`, `identity_revealed`, `stage`, `consent_*`, `unlocked_*`, `*_revealed*`, `full_access_*`) sich ändert → `RAISE EXCEPTION`. | neue Migration |
| 0.2 | Client-`UPDATE`-Policy auf `submissions` per `WITH CHECK` auf unkritische Spalten beschränken (Bestätigung von Aktionen statt Reveal-Felder). | neue Migration (ersetzt [20251204171610:218](supabase/migrations/20251204171610_730adba7-3b30-4be5-9a37-d9d16d9eecbe.sql)) |
| 0.3 | **Status-Landmine entfernen:** in `sync_identity_unlock_with_stage` den Status-Wert `'interview'` streichen; Trigger nur noch auf `stage` (nicht `COALESCE(stage,status)`) prüfen. | [20260616150000](supabase/migrations/20260616150000_opt_in_reveals_identity.sql) → Folge-Migration |
| 0.4 | **IDOR-Fix:** `send-interview-invitation` validiert `auth.getUser()` ↔ `job.client_id` vor jeder Aktion. | [send-interview-invitation/index.ts:162](supabase/functions/send-interview-invitation/index.ts) |
| 0.5 | **Reveal-Ledger** `reveal_events` (append-only: submission_id, basis, actor, proof, created_at) + Schreiben in `reveal_identity`. | neue Migration |
| 0.6 | **Consent immer schreiben:** `process-interview-response` (accept) ruft künftig `reveal_identity(...)` statt direktem Update → schließt die Consent-Lücke (heute übersprungen, weil Trigger short-circuitet). | [process-interview-response/index.ts:142](supabase/functions/process-interview-response/index.ts) |

**Definition of Done:** Ein eingeloggter Client kann per direktem PostgREST-Call **weder** `identity_unlocked` setzen **noch** über Status/Stage-Tricks einen Reveal erzwingen; jeder echte Reveal erzeugt eine `reveal_events`-Zeile; Accept-Pfad schreibt Consent.

---

### Phase 1 — Konsolidierung auf EINEN Pfad (Architektur) · ~3–5 Tage

**Ziel:** Die 3+1 Implementierungen verschwinden. Ein Eingang, eine Antwortseite, eine Reveal-Funktion, ein Trigger.

| # | Task | Betroffen |
|---|------|-----------|
| 1.1 | **State-Machine fixieren:** Enum/`CHECK` für `stage`, Transitions-Trigger, `status` als generierte Spalte ableiten oder deprecaten. | Migration + `useHiringPipeline`, `TalentHub:401` |
| 1.2 | **Ein Client-Eingang:** gemeinsamer `useRequestInterview`-Hook → ruft immer `send-interview-invitation`. Ersetzt: `InterviewRequestWithOptInDialog` (7 Widgets), `ClientCandidates.handleRequestInterview`. | 7 Dashboard-Widgets + [ClientCandidates.tsx:170](src/pages/dashboard/ClientCandidates.tsx) |
| 1.3 | **Eine Antwortseite:** `SelectSlot.tsx` + `schedule-interview` *select-slot* zurückbauen; `/respond` + `process-interview-response` ist kanonisch. `schedule-interview` behält nur Slot-Generierung/Reminder/No-Show. | [SelectSlot.tsx](src/pages/interview/SelectSlot.tsx), [schedule-interview](supabase/functions/schedule-interview/index.ts), [App.tsx:451](src/App.tsx) |
| 1.4 | **Trigger-Suppe auflösen:** `reveal_company_on_opt_in` + `grant_full_access_on_interview_confirm` in `reveal_identity` zusammenführen; Legacy-Trigger droppen. | [20260122110726](supabase/migrations/20260122110726_906435bc-239f-4faf-9300-94eb9491b83c.sql) |
| 1.5 | **Token härten:** `generateToken()` → `crypto.getRandomValues`/`randomUUID`; Token-Ablauf (TTL) + Single-Use. | [send-interview-invitation/index.ts:28](supabase/functions/send-interview-invitation/index.ts) |
| 1.6 | **Spaltendrift bereinigen:** auf `unlocked_at`/`revealed_at` vereinheitlichen, `identity_unlocked_at` deprecaten; `identity_revealed` als reines Legacy-Mirror dokumentieren. | Migration + `process-interview-response` |

**Definition of Done:** `grep` findet genau **einen** Client-Eingang, **eine** Antwortseite, **eine** Reveal-Funktion. Alte Dialoge/Funktionen entfernt oder als Wrapper markiert.

---

### Phase 2 — Terminierung auf Produktniveau (Experience) · ~5–8 Tage

**Ziel:** Aus „Freitext-Link + .ics" wird ein echter Scheduler.

| # | Task | Heute |
|---|------|-------|
| 2.1 | **Tote Mail-Pfade beseitigen:** alle Interview-Mails über echte Resend-/`send-email`-Templates; `schedule-interview` console.log-Mails entfernen. | nur `console.log` ([schedule-interview:407+](supabase/functions/schedule-interview/index.ts)) |
| 2.2 | **Reminder via pg_cron:** `send-reminders` an Cron hängen (Repo nutzt pg_cron bereits für Influence/Escalation) + echte Mails. | Struktur da, kein Cron |
| 2.3 | **Zeitzonen:** `candidate_tz`/`client_tz` erfassen, Slots lokal rendern, UTC speichern. | keine TZ-Logik |
| 2.4 | **Echte Meeting-Links:** Microsoft Graph (Teams) + Google Calendar (Meet) via `user_integrations`-OAuth; Auto-Erzeugung bei `meeting_format ∈ {teams,meet}`, Fallback Freitext. | Spalten leer, nur Freitext |
| 2.5 | **Cancel/Reschedule:** Flows implementieren (Schema existiert: `cancelled_*`, `rescheduled_from`) inkl. Benachrichtigung + Slot-Reopen + Ledger. | nur Schema |
| 2.6 | **Counter-Loop schließen:** Client-Antwortfläche auf Kandidaten-Gegenvorschlag (accept/counter-back); heute endet Counter in einer Recruiter-Mail. | Sackgasse |

**Definition of Done:** Kandidat akzeptiert → Termin mit echtem Meeting-Link in lokaler Zeit, alle drei Parteien erhalten Mail+.ics, automatische 24h/1h-Reminder, Cancel/Reschedule funktioniert.

---

### Phase 3 — Compliance, Trust & Vertrieb (der eigentliche „Level-Up") · ~4–6 Tage

**Ziel:** Triple-Blind vom Marketing-Claim zur **beweisbaren** Garantie machen — das verkauft.

| # | Task |
|---|------|
| 3.1 | **Consent-Modell ehrlich machen:** Unterscheidung *kandidaten-bewiesen* (Klick auf E-Mail-Link = Gold-Standard) vs. *recruiter-behauptet* (manueller Opt-In). Recruiter-Opt-In erzwingt Proof-Eingabe (Kanal/Zeitpunkt) im Ledger. UI-Labels entsprechend. |
| 3.2 | **Reveal-History / DSGVO-Auskunft:** pro Kandidat „Wer hat wann welche Daten gesehen, auf welcher Grundlage" — exportierbar. |
| 3.3 | **Anomalie-Erkennung:** Alert bei Client-Direktwrites/ungewöhnlicher Reveal-Velocity (Guard-Trigger feuert → Security-Event). |
| 3.4 | **Beweisbarer USP:** Client-seitiges „Triple-Blind verifiziert"-Audit-Badge (zeigt: Plattform hat Anonymität technisch erzwungen). Aus Kosmetik wird demonstrierbare Garantie. |

**Definition of Done:** Auf Knopfdruck zeigbar, dass kein Client vor Opt-In PII gesehen hat; jeder Reveal hat dokumentierte Rechtsgrundlage.

---

### Phase 4 — Härtung & Verifikation (nicht zurückfallen) · ~3–4 Tage

| # | Task |
|---|------|
| 4.1 | **RLS-Testsuite** (pgTAP oder Deno-Tests als Client-Rolle): Client liest keine PII vor Reveal, kann `identity_unlocked` nicht selbst setzen, sieht keine fremden Submissions. |
| 4.2 | **E2E** (Playwright): Client fragt an → Kandidat nimmt an → Reveal sichtbar → Termin gebucht. |
| 4.3 | **CI-Gate:** 4.1/4.2 laufen bei jeder Migration/PR. |
| 4.4 | **Observability:** Funnel-Dashboard requested → opted_in → scheduled → completed → no_show + Reveal-Events. |

---

## 3. Getroffene Entscheidungen (2026-06-18)

1. **Consent-Modell = Kandidaten-Klick (Gold-Standard).** Reveal wird serverseitig an den aktiven Klick des Kandidaten gebunden (`basis='candidate_link_accept'`). Recruiter-behaupteter Opt-In ist nur mit dokumentiertem Proof im Ledger erlaubt (`basis='recruiter_asserted_opt_in'`, `proof` Pflicht).
2. **Meeting-Integration = beides, state of the art.** Automatische E-Mail mit Kalender-Anhang (.ics) zum Annehmen **und** direkt generierter, echter Meeting-Link: Microsoft Graph (Teams) **und** Google Calendar (Meet). Siehe erweiterte Phase 2.4.
3. **Start = Phase-0-Migration als Vorschlag.** Wird als kommentierter Entwurf (`TRIPLE_BLIND_PHASE0_gate_hardening.proposal.sql`, **außerhalb** des auto-deploy-Pfads) zum Review geliefert — nicht angewendet, nicht committet.
4. **`status` vs. `stage`:** offen → Default-Empfehlung: `stage` = Single Source of Truth, `status` als Ableitung deprecaten (Phase 1.1).

### Phase 2.4 (erweitert) — Echte Meeting-Links, state of the art

- Bei `meeting_format ∈ {teams, meet}` wird beim Bestätigen automatisch ein echtes Online-Meeting erzeugt:
  - **Teams:** Microsoft Graph `POST /me/onlineMeetings` (bzw. Calendar-Event mit `isOnlineMeeting=true`) via `user_integrations`-OAuth-Token des Clients.
  - **Google Meet:** Google Calendar `events.insert` mit `conferenceData.createRequest` via Google-OAuth-Token.
- `interviews.teams_join_url` / `google_meet_link` / `*_event_id` werden befüllt (Spalten existieren bereits, [20260118203625](supabase/migrations/20260118203625_50c54952-89f6-4e1f-bf71-12698304c8f1.sql)).
- **Fallback** auf validierten Freitext-Link, wenn kein OAuth-Token verbunden ist.
- `.ics` mit korrekter Zeitzone + Meeting-Link an alle Parteien (Resend-Attachment, bereits real).
- Voraussetzung: OAuth-Connect für Microsoft/Google Kalender (heute existiert OAuth nur für CRM/HubSpot, [oauth-connect](supabase/functions/oauth-connect/index.ts)) → Calendar-Scopes ergänzen.

---

## 4. Empfohlene Reihenfolge

```
Phase 0  (Gate dicht — sofort, niedrigstes Risiko, höchste Wirkung)
   ↓
Phase 1  (Konsolidierung — entfernt die strukturelle Ursache)
   ↓
Phase 2  (Experience — sichtbarer Produktwert)
   ↓
Phase 3  (Trust/Vertrieb — macht den USP verkaufbar)
   ↓
Phase 4  (Tests/Observability — friert die Garantie ein)
```

**Quick Wins in Phase 0**, die heute schon Wirkung zeigen: 0.1 Guard-Trigger, 0.3 Status-Landmine, 0.4 IDOR.

---

*Referenzen: [godmode-analysis], [triple-blind-interview-flow], [pii-redaction-plan] · Verifizierte Befunde siehe Memory.*
