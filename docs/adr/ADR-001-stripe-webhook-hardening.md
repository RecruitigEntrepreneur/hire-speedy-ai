# ADR-001 — Stripe-Webhook-Härtung (Signatur-Bypass schließen)

- **Status:** Vorgeschlagen — wartet auf Owner-Ratifikation + Deploy (L3-Gate: GELD)
- **Datum:** 2026-06-19
- **Ritual:** D02 · R3 Adversarial-Security-Review (Default-Veto) + R2 ADR
- **Beteiligte Personas:** Argus (Refuter), Cerberus (Security/Veto), Vitruv (Architect), Themis (Legal — Geldfluss)

## Kontext

`supabase/functions/stripe-webhooks/index.ts` (verify_jwt = false, öffentlich erreichbar) verifizierte die Stripe-Signatur nur, wenn `STRIPE_WEBHOOK_SECRET` gesetzt war; sonst akzeptierte ein `JSON.parse(body)`-Fallback **jedes unsignierte Event**. Derselbe Webhook trägt den Marktplatz-Geldfluss (Rechnung→paid, Placement-Escrow→held, Stripe-Connect payouts_enabled, transfer→completed).

**Adversariale Befunde (gegen reale Daten exploitierbar):**
1. Gefälschtes `payment_intent.succeeded` → Rechnung als paid + Escrow „held" + payment_status confirmed.
2. Gefälschtes `account.updated` → `payouts_enabled` eines Betrügers freischalten.
3. Gefälschtes `transfer.created/failed` → Auszahlungsstatus manipulieren.
4. `stripe.webhooks.constructEvent` (sync) wirft in Deno → selbst MIT Secret schlugen echte Webhooks fehl ⇒ der unsichere Pfad lief vermutlich live.
5. `payment_events.stripe_event_id` ist UNIQUE, wurde aber nicht als Idempotenz-Guard genutzt → Stripe-Retries verarbeiten doppelt.

## Entscheidung

1. `JSON.parse(body)`-Fallback **ersatzlos entfernen** → **fail closed**: ohne `STRIPE_WEBHOOK_SECRET` oder ohne `stripe-signature`-Header → HTTP 400, kein Event wird verarbeitet.
2. Signaturprüfung auf **`constructEventAsync` + `createSubtleCryptoProvider`** umstellen (Deno-kompatibel).
3. **Idempotenz-Guard:** Upsert mit `onConflict: stripe_event_id, ignoreDuplicates`; bei Duplikat (Retry) früh 200 zurückgeben, ohne erneut zu verarbeiten.

## Konsequenzen

- **Positiv:** gefälschte/unsignierte Events unmöglich; echte Webhooks funktionieren in Deno; exactly-once-Verarbeitung.
- **Betrieblich (wichtig):** Nach Deploy **muss** `STRIPE_WEBHOOK_SECRET` in den Supabase-Function-Secrets gesetzt sein — sonst geben ALLE Webhooks 400 (sicher, aber blockiert legitime Zahlungen, bis das Secret gesetzt ist).
- **Gate:** Deploy = L3 (nur Mensch). Agent liefert Diff + Verifikation + Rollback; Owner deployt.

## Verifikation (R3-Exit, code-seitig grün)

`grep 'JSON.parse(body)'` = 0 · `constructEventAsync` vorhanden · alter sync-Aufruf = 0 · fail-closed-Guard vorhanden · `ignoreDuplicates` vorhanden.
Runtime-Exit (auf Preview/Prod nach Deploy): unsignierter Request → 400 · fehlendes Secret → 400 · doppelter `stripe_event_id` → genau 1× verarbeitet.

## Rollback

`git revert` des Commits stellt den vorherigen Handler wieder her; anschließend `stripe-webhooks` neu deployen. Forward-only, keine DB-Migration betroffen.
