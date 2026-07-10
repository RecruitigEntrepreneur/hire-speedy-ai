# Team 6 — Quality & Delivery

## Executive Summary

Marketplace-kritische Operationen (Payments, Anonymisierung, Matching) hängen allein an Code-Review: Es gibt genau eine Testdatei (`pii-redaction.test.ts`), keinen konfigurierten Test-Runner, keine CI-Pipeline und keine strukturierte Observability/Alerting. Dazu eine potenzielle Doppel-Auszahlungs-Lücke in `process-payout` (kein UNIQUE auf stripe_transfer_id) und uneinheitliche Migrations-Idempotenz.

## Befunde

### [CRITICAL] [XL] Praktisch keine Test-Coverage kritischer Pfade

- **Fundstelle:** Einzige Testdatei: `supabase/functions/_shared/pii-redaction.test.ts`. Kein test-Script in package.json, kein vitest/deno-Test-Config.
- **Problem:** Matching (calculate-match-v3-1), Anonymisierung (triple-blind Views), Payment (stripe-webhooks, process-payout), E-Mail-Processing ohne jede Regressionsabsicherung.
- **Risiko/Impact:** Payment-Fehlfunktion → Doppel-Auszahlung/Umsatzverlust; Anonymisierungs-Bug → PII-Leak — beides unbemerkt.
- **Fix-Empfehlung:** test-Script (vitest für shared libs), Deno-Test-Config für Edge Functions; Tests zuerst für Payment-Idempotenz, Payout-Double-Spend, Triple-Blind-Masking.

### [CRITICAL] [M] Keine CI/CD-Pipeline

- **Fundstelle:** Kein `.github/workflows/`; kein Build/Lint/Test-Gate vor Merge.
- **Problem:** Jeder Commit kann tsc/eslint brechen, ohne dass es auffällt.
- **Risiko/Impact:** Typ-/Lint-Fehler gelangen ungeprüft in Produktion.
- **Fix-Empfehlung:** `.github/workflows/ci.yml` mit `npm run build`, `npm run lint`, `tsc --noEmit` (+ Tests) als Gate.

### [HIGH] [S] process-payout ohne Idempotenz-Constraint (Doppel-Auszahlung)

- **Fundstelle:** `supabase/functions/process-payout/index.ts:113-135` erzeugt Stripe-Transfers ohne Prüfung auf doppelte stripe_transfer_id; Schema `20251204195741_*.sql` hat `stripe_transfer_id TEXT` ohne UNIQUE.
- **Problem:** Webhook-Retry oder erneute Admin-Freigabe kann denselben payout_request mehrfach auszahlen.
- **Risiko/Impact:** Finanzieller Verlust, Betrugsvektor.
- **Fix-Empfehlung:** `UNIQUE(stripe_transfer_id)`; vor Transfer auf bestehende Auszahlung prüfen; Idempotency-Key an Stripe.

### [HIGH] [M] Migrations-Idempotenz uneinheitlich

- **Fundstelle:** Nur ein Teil der 107 Migrations nutzt `IF NOT EXISTS`; gemischte Namensschemata (UUID vs. sprechend).
- **Problem:** Wiederholtes Ausführen kann an CREATE-Konflikten scheitern; Rollback undokumentiert.
- **Fix-Empfehlung:** `IF NOT EXISTS` konsequent; Rollback-Ansatz dokumentieren; Namensschema vereinheitlichen.

### [HIGH] [L] Observability-Lücke: kein strukturiertes Error-Tracking

- **Fundstelle:** ~333 console.log in Edge Functions (z.B. `stripe-webhooks:39`); kein Sentry/Rollbar/DataDog.
- **Problem:** Webhook-/Payout-Fehler nur in console.error; keine Alerts.
- **Risiko/Impact:** Payment-Degradation bleibt unentdeckt; Recruiter-Auszahlungen hängen unbemerkt.
- **Fix-Empfehlung:** Sentry (Free-Tier), strukturierte JSON-Logs, Slack/E-Mail-Alerts bei Webhook-Fehlern.

### [MEDIUM] [M] Dokumentations-Rückstand

- **Fundstelle:** README verweist auf Lovable, keine Supabase-Setup-/Migrations-/Seed-Anleitung.
- **Problem:** Neue Entwickler können lokal weder migrieren noch seeden.
- **Fix-Empfehlung:** README-Abschnitte „Local Setup", „Running Tests", „CI/CD-Gate".

## Quick Wins (S-Effort)

1. `UNIQUE(stripe_transfer_id)` + Idempotency-Key in process-payout.
2. test-Script in package.json (vitest) + `tsc --noEmit`-Script.
3. Sentry-Init in Edge-Function-Wrapper (später).

## Build-Status

`npm run lint` / `tsc --noEmit` konnten im Subagent nicht ausgeführt werden (Sandbox). Beide Scripts sind in package.json vorhanden (lint) bzw. müssen ergänzt werden (typecheck). **In Phase 2 als Erstes verifizieren.**

## Offene Fragen an Marko

1. GitHub als Remote vorhanden (für Actions-CI)?
2. Sentry-Budget/Datenschutz (EU-Region) ok?
3. Wie wird aktuell deployed (Lovable-Auto-Deploy? Supabase CLI)?
