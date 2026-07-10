# Team 2 — Shield (Security & Compliance)

## Executive Summary

Der Kernbefund: Das Triple-Blind-Versprechen und die DSGVO-Konformität sind an mehreren Stellen brüchig. 23 der 24 AI-Funktionen senden Kandidaten-PII ungeredacted an einen externen AI-Provider (Lovable) — nur `assess-candidate-fit` redacted. Das Triple-Blind-Reveal ist an den Submission-Stage gekoppelt und dadurch client-seitig erzwingbar. Die DSGVO-Löschung (`gdpr-deletion`) erfasst nur 3–5 von 20+ Kandidaten-Tabellen. Interview-Token-Flows sind IDOR-anfällig ohne TTL. EU-AI-Act-Annex-III-Pflichten (Deadline Aug 2026) sind faktisch nicht adressiert.

## Befunde

### [CRITICAL] [S→M] PII-Datenleck an externe AI (DSGVO Art. 28/44)

- **Fundstelle:** 23 der 24 AI-Funktionen, u.a. `supabase/functions/candidate-summary/index.ts:34-49` (sendet full_name, email, current_salary, expected_salary im Klartext), `supabase/functions/analyze-reference/index.ts:59-76` (Referenz- + Kandidatenname). Nur `assess-candidate-fit` nutzt `_shared/pii-redaction.ts`.
- **Problem:** LOVABLE_API_KEY-Calls übertragen Klartext-PII an einen externen Provider ohne durchgängige AVV-Absicherung/Redaction.
- **Risiko/Impact:** DSGVO-Verstoß (Art. 6, Art. 28 Auftragsverarbeitung, Art. 44 Drittlandtransfer). Bußgeld bis 20 Mio € / 4% Umsatz. Direkter Bruch des Datenschutzversprechens gegenüber Kandidaten.
- **Fix-Empfehlung:** `redactCandidateForLLM()` als Pflicht-Wrapper vor JEDEM AI-Call. Whitelist-Modell aus `pii-redaction.ts` zentralisieren.

### [CRITICAL] [M] Triple-Blind-Reveal an Stage gekoppelt — client-seitig erzwingbar

- **Fundstelle:** `supabase/migrations/20260616150000_opt_in_reveals_identity.sql:24-50` — Trigger `sync_identity_unlock_with_stage()` setzt `identity_unlocked=TRUE` automatisch bei `stage IN ('candidate_opted_in','interview_scheduled',...)`.
- **Problem:** Wenn eine RLS-Policy Clients erlaubt, `submissions.stage` zu ändern, kann der Client den Reveal erzwingen — ohne Opt-in des Kandidaten. Reveal ist nicht unabhängig gated.
- **Risiko/Impact:** Kernversprechen bricht: Client sieht Klarnamen ohne Kandidaten-Consent.
- **Fix-Empfehlung:** Separate Spalte `consent_confirmed` mit eigener RLS (nur Kandidat + Admin schreibbar), Reveal daran koppeln statt an Stage. CHECK-Constraint erzwingt Konsistenz.

### [CRITICAL] [S] Unvollständige DSGVO-Löschung (Art. 17)

- **Fundstelle:** `supabase/functions/gdpr-deletion/index.ts:158-175`
- **Problem:** Löscht nur profiles, candidates (wenn creator), messages, stripe_accounts. NICHT gelöscht: candidate_experiences, candidate_skills, candidate_languages, candidate_interview_notes, reference_requests, reference_responses, outreach-Verlauf, submissions (wo user Kandidat ist). 15+ Satellitentabellen bleiben mit PII zurück.
- **Risiko/Impact:** Art.-17-Verstoß; verwaiste PII in Satellitentabellen.
- **Fix-Empfehlung:** RPC-Funktion mit vollständiger Kandidaten-Kaskade oder `ON DELETE CASCADE` FKs; alle candidate_*- und outreach_*-Tabellen einbeziehen.

### [CRITICAL→HIGH] [M] Token-basierte IDOR im Interview-Flow

- **Fundstelle:** `src/pages/interview/InterviewResponsePage.tsx:109`, `supabase/functions/process-interview-response/index.ts:101-102`
- **Problem:** Autorisierung allein über `response_token` (`WHERE response_token = $1`), keine zusätzliche Identitätsprüfung, kein TTL/`expires_at`. Wer den Token kennt, kann Interviews annehmen/absagen.
- **Risiko/Impact:** Manipulation fremder Interviews bei Token-Leak (E-Mail-Weiterleitung, Link-Hijack).
- **Fix-Empfehlung:** Token + `expires_at`-TTL (24–48h) + Rate-Limiting; optional Kandidaten-E-Mail-Bestätigung.

### [HIGH] [M] 23 AI-Funktionen ohne eigenen Auth-Check

- **Fundstelle:** 23 der 24 AI-Functions (z.B. candidate-summary, parse-cv, generate-outreach-email) — kein Authorization-Header-Check wie in `assess-candidate-fit:26-32`.
- **Problem:** Falls `verify_jwt=false` gesetzt ist/wird, sind diese Endpunkte offen aufrufbar und liefern PII/Gehaltsdaten.
- **Risiko/Impact:** Unbefugter Zugriff auf Kandidatendaten.
- **Fix-Empfehlung:** Expliziter authHeader-Check ODER `verify_jwt=true`; Muster aus assess-candidate-fit übernehmen.

### [HIGH] [S] PII_REDACTION_MODE nur an 1 Stelle wirksam

- **Fundstelle:** `supabase/functions/_shared/pii-redaction.ts:109` — Env nur in assess-candidate-fit gelesen.
- **Problem:** Das Redaction-Flag steuert faktisch nur eine Funktion; 23 andere kennen es nicht.
- **Risiko/Impact:** Redaction wirkt praktisch nicht.
- **Fix-Empfehlung:** `_shared/redaction-wrapper.ts` extrahieren, von allen AI-Funktionen vor dem Call aufrufen.

### [MEDIUM] [S] Reveal-Status auf mehrere Flags verteilt (Split-Brain)

- **Fundstelle:** `supabase/migrations/20260616150000_opt_in_reveals_identity.sql` — identity_unlocked, identity_revealed, consent_confirmed + Stage manuell synchronisiert.
- **Problem:** Keine Single Source of Truth; künftige Änderungen können auseinanderlaufen.
- **Fix-Empfehlung:** Ein Boolean `identity_revealed_for_client` + Trigger mit striktem CHECK.

### [MEDIUM] [M] Interview-Token ohne TTL

- **Fundstelle:** `supabase/functions/process-interview-response/index.ts` — keine expires_at-Prüfung.
- **Problem:** Token unbegrenzt gültig; geleakte Token funktionieren dauerhaft.
- **Fix-Empfehlung:** expires_at in interviews, TTL-Check.

### [MEDIUM] [L] PII in Fehler-Logs

- **Fundstelle:** `supabase/functions/assess-candidate-fit/index.ts:171` (console.error mit prompt/candidate), `analyze-reference/index.ts` (console.log).
- **Problem:** Produktions-Logs (Supabase Console) können PII enthalten.
- **Risiko/Impact:** Admin-seitiges Datenleck, DSGVO Art. 32.
- **Fix-Empfehlung:** Redaction auch in Log-Statements; sensible Felder als `[REDACTED]`.

### [MEDIUM] [S→M] EU AI Act Annex III — Compliance-Gaps (High-Risk-Recruiting)

- **Fundstelle:** calculate-match*, generate-match-recommendation, assess-candidate-fit.
- **Problem:** Nicht adressiert: Risk-Management-System, Traceability/Audit-Trail der Matching-Entscheidungen, Human Oversight, Kandidaten-Transparenz (weiß der Kandidat vom AI-Scoring?), technische Doku.
- **Risiko/Impact:** Bis 6% Umsatz Strafe nach Aug 2026; Vertriebsblocker bei Enterprise-Clients.
- **Fix-Empfehlung:** Risk-Management-Plan (ISO 42001 / AI-Act-Template), Audit-Log aller Scoring-Outputs, Transparenz-Banner im Frontend, Human-Oversight-Dokumentation.

## Quick Wins (S-Effort)

1. gdpr-deletion um alle candidate_*- und outreach_*-Tabellen erweitern (bzw. RPC-Kaskade).
2. Redaction-Wrapper zentralisieren und in allen AI-Funktionen aktivieren.
3. PII aus console.log/error-Statements entfernen.
4. Reveal-Status auf ein Boolean konsolidieren.

## Offene Fragen an Marko

1. Existiert ein AVV mit Lovable/dem AI-Provider? EU-Region gehostet?
2. Darf ein Client `submissions.stage` direkt ändern (RLS prüfen)?
3. Ist die AI-Act-Transparenz gegenüber Kandidaten juristisch bereits abgedeckt (Datenschutzerklärung)?
4. Soll PII-Redaction hart erzwingen (fail-closed) oder nur bei aktivem Flag?
