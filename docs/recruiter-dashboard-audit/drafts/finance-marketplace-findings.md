# Finance & Marketplace Governance — Audit-Befunde (Agent 7)

Stand: 2026-07-21 · Bewertet wurde der aktuelle Dateistand auf Platte (main, inkl. uncommitteter Änderungen).
Scope: Provision, Auszahlung, Attribution, Ownership, Umgehungsschutz, Marktplatz-Mechanik, Steuer-/Rechnungsdaten (§3.2, §3.3, §7.5, §7.19).

Leitfrage des arbeitenden Headhunters: **„Ich habe platziert — wann und wie bekomme ich mein Geld?"** Kurzantwort vorweg: Über die Produkt-UI **gar nicht**. Die Kette bricht an vier nachgewiesenen Stellen (Abschnitt 8).

---

## 1. Geldfluss End-to-End — Nachweis am Code

### 1.1 Datenmodell (nachgewiesen)

| Baustein | Beleg | Inhalt |
|---|---|---|
| `jobs.fee_percentage` (Default 20,00) / `jobs.recruiter_fee_percentage` (Default 15,00) | `supabase/migrations/20251204171610_730adba7….sql:44-45` | Provisionsbasis pro Job |
| `placements` (`total_fee`, `platform_fee`, `recruiter_payout`, `payment_status` Default `'pending'`, `paid_at`) | `20251204171610…:106-117` | 1:1 zu `submissions` (UNIQUE `submission_id`, Z. 108) |
| `placements.escrow_status` CHECK (`pending/held/released/disputed/refunded`), `escrow_release_date` | `20251204195741_f49d09d2….sql:49-50` | Escrow-Zustandsmaschine |
| `invoices` (`invoice_number` UNIQUE, `amount`, `tax_amount` Default 0, `total_amount`, `status`, `pdf_url`, später `stripe_invoice_id`, `stripe_payment_intent_id`) | `20251204182100_8abd5457….sql:106-120` + `20251204195741…:45-47` | Kundenrechnung |
| `stripe_accounts` (Connect Express, `payouts_enabled`, `onboarding_complete`) | `20251204195741…:4-15` | Auszahlungsziel des Recruiters |
| `payout_requests` (`placement_id`, `recruiter_id`, `amount`, `status` pending→…→completed, `stripe_transfer_id`) | `20251204195741…:18-31` | **Kein UNIQUE auf `placement_id`** — Mehrfachanfragen pro Placement sind auf DB-Ebene möglich |
| `payment_events` (Stripe-Webhook-Log, `stripe_event_id` UNIQUE) | `20251204195741…:34-42` | Idempotenz-Puffer |

### 1.2 Placement-Erzeugung (Schritt „Vermittlung wird Geld-Objekt")

**Pfad A — Angebots-Flow (funktionsfähig):** `create-offer` (Client-eigener Job wird geprüft, `supabase/functions/create-offer/index.ts:76-78`) → Kandidat nimmt per Token an → `process-offer-response/index.ts:125-144` berechnet `totalFee = salary_offered * fee_percentage/100`, `recruiterPayout = totalFee * recruiter_fee/fee`, `platformFee = Differenz` und legt Placement mit `escrow_status: 'pending'`, `payment_status: 'pending'`, `escrow_release_date = start + 90 Tage` an. UI-Anbindung nachgewiesen: `src/hooks/useOffers.ts:138/170`, genutzt in `ClientOffers.tsx`, `OfferCreationForm.tsx`, `ViewOffer.tsx`.

**Pfad B — Talent-Hub „hired" (FEHLERHAFT):** `process-talent-hub-action/index.ts:245-254` insertiert in `placements` die Spalten `job_id, candidate_id, recruiter_id, client_id, status, placement_date` — **keine dieser Spalten existiert** auf `placements` (Tabellendefinition `20251204171610…:106-117`, generierte Typen `src/integrations/supabase/types.ts:6897-6911`). Der Insert schlägt zur Laufzeit fehl; zudem würden keinerlei Fee-Beträge gesetzt. Wer über diesen Pfad „hired" setzt, erzeugt **kein** Placement.

**Zwei-Wahrheiten-Problem Status:** Pfad A setzt `submissions.status = 'placed'` (`process-offer-response/index.ts:121`). Aber:
- `RecruiterEarnings.tsx:92` filtert `.eq('status', 'hired')` → **Placements aus dem Angebots-Flow erscheinen nie auf der Earnings-Seite.**
- `recalculate_trust_level()` zählt ebenfalls `status = 'hired'` (`20260302160000_recruiter_trust_system.sql:173-175`) → Placements aus Pfad A erhöhen das Trust-Level nie.
- Nirgendwo im Code wird `submissions.status = 'hired'` programmatisch gesetzt (Vollsuche src/ + functions/; nur Lese-/Anzeige-Treffer).

### 1.3 Rechnung an den Kunden — NICHT VERBUNDEN

- Es existiert **kein einziger Code-Pfad, der eine `invoices`-Zeile erzeugt.** Vollsuche `from('invoices')`/`from("invoices")`: nur Lesen (`AdminInvoices.tsx:68`, `ClientBilling.tsx:92`, `AdminDashboard.tsx:275`, `gdpr-export/index.ts:158`) und Status-Updates (`stripe-webhooks/index.ts:70`, `AdminInvoices.tsx:114/134`). Kein Insert in src/, functions/ oder Migrationen (keine Trigger/Functions mit `INSERT INTO invoices`).
- `AdminInvoices.tsx` kann nur „als bezahlt markieren" (`:114-124`, setzt **nur** `invoices.status/paid_at`, **nicht** `placements.escrow_status`) und „überfällig" (`:134-138`). Kein Anlegen, kein PDF-Erzeugen (`pdf_url` wird nirgends befüllt; nur verlinkt, `AdminInvoices.tsx:363-364`, `ClientBilling.tsx:337-339`).
- `ClientBilling.tsx` (355 Z.) zeigt Rechnungen und Placement-Fees an, hat aber **keinen Bezahl-Button, kein Stripe-Checkout** (Vollsuche „bezahlen/checkout/stripe" in der Datei: 0 Treffer).

### 1.4 Zahlungseingang — Webhook läuft ins Leere

`stripe-webhooks/index.ts` ist handwerklich solide (fail-closed Signaturprüfung `:26-37`, Idempotenz über UNIQUE `stripe_event_id` `:43-60`) und verarbeitet genau 4 Events (`:63-145`): `payment_intent.succeeded`, `account.updated`, `transfer.created`, `transfer.failed`.

**Bruchstelle:** `payment_intent.succeeded` aktualisiert die Rechnung per `.eq("stripe_payment_intent_id", paymentIntent.id)` (`:76`) — dieses Feld wird **nirgendwo im Code jemals gesetzt**, weil kein Code einen PaymentIntent oder eine Checkout-Session erzeugt (Vollsuche `paymentIntents.create` / `checkout.session`: 0 Treffer außerhalb des Webhooks). Das Update trifft 0 Zeilen, `invoice?.placement_id` bleibt null, der Escrow-Übergang `pending → held` (`:85-92`) feuert nie.

### 1.5 Escrow — Zustandsmaschine ohne Antrieb

| Übergang | Einziger Setzer | Status |
|---|---|---|
| (Anlage) `pending` | `process-offer-response/index.ts:141` | nachgewiesen |
| `pending → held` (+ `payment_status: 'confirmed'`) | `stripe-webhooks/index.ts:85-92` | technisch vorhanden, wird nie erreicht (1.4) |
| `held → released` | `process-payout/index.ts:138-145` (bei Payout-Approval) | erreichbar nur mit Payout-Request (1.6) |
| Ablauf `escrow_release_date` (90 Tage) → automatischer Release | **nicht auffindbar** — kein pg_cron-Job (einzige Cron-Migration `20260225200000_unified_task_inbox.sql:133-190` betrifft Task-Inbox), keine Edge Function | NICHT_VORHANDEN |
| `disputed` / `refunded` | **kein Code setzt diese Werte** (nur Badge-Rendering `EscrowStatusBadge.tsx:30-40`, `PaymentStatusBadge.tsx:50`) | NICHT_VORHANDEN |

Folge: `RecruiterPayouts.tsx:100-110` rechnet „Verfügbar" **clientseitig** aus (`escrow_status === 'held'` && `escrow_release_date <= now`) — die DB kennt diesen Zustand nicht; Anzeige und Wahrheit divergieren dauerhaft.

### 1.6 Auszahlungsanforderung — UI-Pfad existiert nicht

- Einziger Insert-Pfad in `payout_requests`: `PayoutRequestCard.tsx:55-61`.
- `PayoutRequestCard` wird in `RecruiterPayouts.tsx:8` **importiert, aber im gesamten JSX nie gerendert** (vollständige Datei geprüft, 283 Z.; kein weiterer Verwender in src/). Der Recruiter hat **keinen Klickpfad**, um eine Auszahlung anzufordern.
- `RecruiterPayouts` zeigt stattdessen nur Badges des (nie existierenden) `payout_request` (`:252-271`).

### 1.7 Admin-Approval & Stripe-Transfer

- `AdminPayoutApproval.tsx` (Route `/admin/payouts`, `App.tsx:379`; Nav `DashboardLayout.tsx:134`) listet `payout_requests` und ruft `process-payout` (`:112-117` approve, `:136-142` reject).
- `process-payout/index.ts`: Admin-Check (`:50-55`), lädt Request + Placement (`:62-77`), prüft Stripe-Onboarding (`:88-101`), erstellt `stripe.transfers.create` (`:115-123`), setzt Request `completed` und Placement `released/paid` (`:128-145`), Notification (`:148-155`).
- **KRITISCHE Lücken (nachgewiesen durch Abwesenheit im Code):**
  1. Der Transferbetrag ist `payoutRequest.amount` (`:116`) — **vom Recruiter frei gewählt** (RLS erlaubt INSERT mit beliebigem `amount`/`placement_id`, solange `recruiter_id = auth.uid()`, `20251204195741…:79-81`). Es gibt **keine Validierung** `amount <= placement.recruiter_payout`.
  2. **Keine Prüfung des Escrow-Status** (weder `held` noch `released` noch Kundenzahlung) vor dem Transfer.
  3. **Keine Prüfung, dass das Placement dem anfragenden Recruiter gehört** (das geladene `placement.submission.recruiter_id` wird nie mit `payoutRequest.recruiter_id` verglichen; `placement_id` darf sogar NULL/fremd sein).
  4. **Kein UNIQUE(placement_id)** auf `payout_requests` und keine Duplikat-Prüfung in `process-payout` → zweifacher Admin-Approve = Doppel-Transfer. (Die Idempotenz im Webhook schützt nur gegen Stripe-Retries desselben Events, nicht gegen zwei echte Transfers.)
  → Ein direkter API-Call eines Recruiters plus ein unachtsamer Admin-Klick genügen für eine überhöhte oder doppelte Auszahlung. SICHERHEITSRISIKO KRITISCH.

### 1.8 Stripe-Connect-Onboarding (Recruiter-Seite)

`stripe-connect/index.ts`: `create-account` (Express, Country fest `"DE"`, `business_type: "individual"`, `:85-97`), `create-account-link` (`:125-163`), `account-status` (`:165-206`). UI: `RecruiterStripeOnboarding` wird in `RecruiterPayouts.tsx:196` gerendert. Status-Sync zusätzlich über Webhook `account.updated` (`stripe-webhooks/index.ts:99-114`). Funktionsfähig; Einschränkungen: nur DE, nur Einzelperson (keine Kapitalgesellschaft als `business_type: company`), keine Tests.

---

## 2. Prior-Art-Verifikation (RECRUITER_DASHBOARD_GODMODE_ANALYSE.md, Stand 2026-07-18)

| # | Behauptung | Ergebnis | Beleg |
|---|---|---|---|
| 1 | Escrow bleibt ewig `pending`/`held`, kein Status-Übergang | **VERIFIZIERT** | Abschnitte 1.4/1.5: kein PaymentIntent-Erzeuger, kein Release-Cron |
| 2 | Kein Invoice-/Checkout-Flow | **VERIFIZIERT** | Abschnitt 1.3: kein `invoices`-Insert im gesamten Code |
| 3 | `PayoutRequestCard` importiert, nie gerendert | **VERIFIZIERT** | `RecruiterPayouts.tsx:8` (Import), kein Render in 283 Z.; kein anderer Verwender |
| 4 | „Verfügbar" clientseitig errechnet, DB bleibt `held` | **VERIFIZIERT** | `RecruiterPayouts.tsx:100-110` |
| 5 | `platform_fee`/`total_fee` geladen, nie angezeigt | **VERIFIZIERT** | `RecruiterEarnings.tsx:83-84` (Select) vs. Tabelle `:257-299` (keine Spalte) |
| 6 | Revenue/Payout insgesamt blockiert | **VERIFIZIERT UND VERSCHÄRFT** | Zusätzlich neu gefunden: Status-Split `'placed'` vs. `'hired'` (1.2) blendet Placements auf der Earnings-Seite aus; fehlende Betrags-/Ownership-Validierung in `process-payout` (1.7) |
| 7 | `EarningsKpiCards` verwaist | **VERIFIZIERT** | Definiert `src/components/recruiter/EarningsKpiCards.tsx:22`, 0 Verwender in src/ |
| 8 | Doppelte Wahrheit `payment_status` vs. `payout_requests.status` | **VERIFIZIERT** | `AdminPayments.tsx:87-105` setzt `payment_status='paid'` ohne payout_request; `process-payout:138-145` setzt beides parallel |

---

## 3. Recruiter-Attribution (§3.2)

| Frage | Befund | Beleg | Bewertung |
|---|---|---|---|
| `recruiter_id` an jeder Submission? | Ja, NOT NULL mit FK auf auth.users | `20251204171610…:79` | nachgewiesen, Reifegrad 4 |
| Zeitpunkt eindeutig? | Ja, `submitted_at` NOT NULL DEFAULT now() | `20251204171610…:85` | nachgewiesen |
| Agency-Zuordnung? | **Keine Agency-Struktur vorhanden** — Recruiter ist Einzeluser; keine `agencies`-Tabelle (Vollsuche Migrationen) | Vollsuche `agency/agentur` in Migrationen: 0 Schema-Treffer | NICHT_VORHANDEN |
| Provision zum Einreichzeitpunkt eingefroren? | **Nein.** Kein Fee-Snapshot auf `submissions` oder `offers` (Offers-Schema `20251204215330…:13-60` ohne Fee-Spalten). Berechnung erst bei Offer-Annahme aus der **live** `jobs`-Zeile (`process-offer-response/index.ts:125-127`). Client kann `fee_percentage`/`recruiter_fee_percentage` jederzeit ändern — RLS „Clients can manage their own jobs" FOR ALL (`20251204171610…:191-192`), keine Spaltenrestriktion, kein Audit | widersprüchlich / SICHERHEITSRISIKO HOCH: Provisionsbasis bis zur Annahme einseitig manipulierbar |
| `custom_fee_percentage` pro Recruiter | Spalte existiert (`20251204184027…:10`), Admin-UI setzt sie (`AdminRecruiters.tsx:191`), aber **keine einzige Berechnung verwendet sie** (Vollsuche functions/: 0 Treffer) | technisch vorhanden, fachlich nicht nutzbar |
| Sieht der Kunde den Recruiter (Name/Badge)? | **Nein.** `client_submissions_view` enthält keinerlei Recruiter-Felder (`20260122221123…:8-29`); ebenso `client_interviews_view`/`client_offers_view` | Kontaktschutz erfüllt (Triple-Blind-konform), aber null Attributions-Sichtbarkeit — der Kunde weiß nicht einmal anonymisiert („Recruiter #3"), von wem der Kandidat kommt |
| Recruiter-Kontaktdaten geschützt? | Ja auf View-Ebene (s.o.); `profiles`-RLS erlaubt nur eigenes Profil + Admin (`20251204171610…:168-178`) | nachgewiesen |

---

## 4. Ownership & Umgehungsschutz (§3.3)

| Mechanismus | Befund | Beleg | Status |
|---|---|---|---|
| Doppel-Einreichung gleicher Kandidat, **gleicher** Recruiter | UNIQUE(`job_id`,`candidate_id`) auf submissions | `20251204171610…:87` | VORHANDEN_PRODUKTIV |
| Doppel-Einreichung gleiche Person, **zwei Recruiter** | **Nicht verhindert.** `candidates` sind pro Recruiter (`recruiter_id` NOT NULL, `:56`) → gleiche Person = zwei Zeilen = zwei gültige Submissions. Kein E-Mail-Unique, kein First-Come-Ownership, keine Schutzfrist-Tabelle (Vollsuche `ownership/protection_period/schutzfrist`: 0 Schema-Treffer) | NICHT_VORHANDEN, Risiko HOCH (Provisionsstreit ist bei Doppel-Placement programmiert) |
| Duplikat-Warnung im Submit-Formular | Prüft nur Submissions, die der Recruiter per RLS sehen darf = **nur eigene** (`CandidateSubmitForm.tsx:179-203`; RLS `20251204171610…:210-216`) | VORHANDEN_ABER_UNVOLLSTÄNDIG |
| Cross-Recruiter-Duplikat-Erkennung | `fraud-detection` erkennt E-Mail-/Telefon-Duplikate über Recruiter hinweg mit severity `high` (`fraud-detection/index.ts:147-196`), wird aber **nur manuell** via Admin-Batch-Scan getriggert (`AdminFraud.tsx:71`); kein Aufruf bei Submission (CandidateSubmitForm ruft nur `calculate-match`) | BACKEND_VORHANDEN_UI_FEHLT (kein automatischer Trigger) |
| Konflikt-Erkennung (`detect-candidate-conflicts`) | Prüft nur Submissions **desselben** `candidate_id` (gleicher Recruiter): same_client / same_industry / critical_stage (`detect-candidate-conflicts/index.ts:58-95`). Einziger Aufrufer `useCandidateConflicts.ts:67` — **der Hook wird von keiner Komponente importiert** (Vollsuche src/: 0 Consumer) | nicht verbunden |
| Off-Platform-Umgehung (Kunde stellt am Marktplatz vorbei ein) | **Keinerlei Erkennung, keine Nachwirkfrist-Logik, kein Abgleich Einstellungen vs. Submissions** | Vollsuche `bypass/off.?platform`: 0 Treffer | NICHT_VORHANDEN |
| Meldeprozess für Umgehung/Streitfälle | Nicht vorhanden. `RiskReportDialog.tsx` (`candidate_risk_reports`, `20251212172934…:22`) meldet Deal-Risiken (Gegenangebot etc.), nicht Umgehung. `escrow_status='disputed'` wird von keinem Code gesetzt; keine `disputes`-Tabelle | NICHT_VORHANDEN |
| Sperren von Recruitern | Admin-UI setzt `user_roles.status='suspended'` (`AdminRecruiters.tsx:166-174`; Spalte `20251204184027…:2-4`). **Aber:** `has_role()` prüft `status` nicht (`20251204171610…:141-154`), `src/lib/auth.tsx` prüft nicht (0 Treffer `suspended`) → ein gesperrter Recruiter behält **vollen Zugriff** auf Jobs, Submissions, Payout-Requests | FEHLERHAFT / SICHERHEITSRISIKO HOCH |
| Trust-Level-Sperre (`trust_level='suspended'`) | Blockt Aktivierungen **nur clientseitig** (`RecruiterJobs.tsx:260-262`); DB-RLS erlaubt Insert weiterhin (`20260302160000…:75-77`) | VORHANDEN_ABER_UNVOLLSTÄNDIG |

---

## 5. Marktplatz-Mechanik (§7.5)

| Aspekt | Befund | Beleg | Status |
|---|---|---|---|
| Job-Zugriff | Offen für **alle** Recruiter bei `status='published'` (RLS `20251204171610…:194-197`); zusätzlich `recruiter_jobs_view` (Client-blind, `20260616104941…:114-142`). Keine Zuweisung, keine Freigabe pro Recruiter | VORHANDEN_PRODUKTIV (Modell: offener Marktplatz) |
| Aktivierung (Trust-Gate) | `recruiter_job_activations` UNIQUE(recruiter, job) (`20260302160000…:35-44`); Dialog + Insert `RecruiterJobs.tsx:819/373`, `useJobActivation.ts:64-114`; Zähler-Trigger `:271-300`; Bulk-Fraud-Trigger >5/h (`:302-343`) | VORHANDEN_ABER_UNVOLLSTÄNDIG |
| Slot-Limits (bronze 5 / silver 10 / gold 15) | Werte in `recalculate_trust_level` (`20260302160000…:239-243`). Durchsetzung **nur clientseitig** (`RecruiterJobs.tsx:259-262`); kein DB-Trigger/Constraint gegen Insert über Limit. Eigener Code-Kommentar bestätigt, dass `active_count` live nicht gepflegt wird (`RecruiterJobs.tsx:257-259`) | VORHANDEN_ABER_UNVOLLSTÄNDIG, Risiko MITTEL |
| **Trust-Level-RLS** | „System can manage trust levels" FOR ALL USING(true) WITH CHECK(true) (`20260302160000…:65-68`) + „Recruiters can update own trust level" (`20260302185119…:50-53`) + „System can update activations" USING(true) (`20260302160000…:84-87`) → **jeder authentifizierte Nutzer kann beliebige Trust-Level lesen/ändern; ein Recruiter kann sich selbst auf gold/15 Slots setzen oder `has_submitted` manipulieren** | SICHERHEITSRISIKO KRITISCH |
| `activateJob`-Fehlerbehandlung | Bei DB-Fehler wird trotzdem `success: true` zurückgegeben und lokal „aktiviert" (`useJobActivation.ts:99-113`) — UI lügt bei fehlgeschlagener Aktivierung | FEHLERHAFT |
| Exklusivität | Nicht vorhanden (kein Feld, keine Logik) | NICHT_VORHANDEN |
| Wettbewerbsanzeige („X Recruiter aktiv auf diesem Job") | Nicht vorhanden — kein Count je Job in Recruiter-UI (Vollsuche `active recruiters/recruiter_count` in pages/components recruiter: 0) | NICHT_VORHANDEN |
| SLA/Fristen | `sla_rules`-Seed `recruiter_first_submission` 72h/24h (`20251204204702…:201`), `sla_deadlines`-Tabelle (`:207`), `escalation-engine` verarbeitet Warnungen/Breaches, `SlaWarningBanner.tsx` existiert. **Kein Cron/Trigger ruft `escalation-engine` auf** (0 Treffer in Migrationen/src) | BACKEND_VORHANDEN_UI_FEHLT (Motor nicht angeschlossen) |
| Mandat zurückgeben / Aktivierung beenden | **Nicht möglich**: kein DELETE-Policy für Recruiter auf `recruiter_job_activations` (nur SELECT/INSERT, `20260302160000…:71-77`), kein Deaktivier-Pfad in `useJobActivation.ts`, `active_count` wird nie dekrementiert → Slots verbrauchen sich dauerhaft | NICHT_VORHANDEN, blockiert das Slot-Modell fachlich |

---

## 6. Steuer- und Rechnungsdaten des Recruiters (§7.19)

| Aspekt | Befund | Beleg | Status |
|---|---|---|---|
| Bankdaten | **Drei parallele Systeme:** (1) `profiles.bank_iban` (`20251204173818…:84`, editierbar `RecruiterProfile.tsx:315-319`), (2) `recruiter_verifications.iban` + `tax_id` (Onboarding Step 5, `20251211164340…:29-32`, `RecruiterOnboarding.tsx:492-496`, `useRecruiterVerification.ts:188-198`), (3) Stripe Connect (`stripe_accounts`). Auszahlung nutzt nur (3); AdminPayments zeigt (1) für manuelle Überweisung (`AdminPayments.tsx:69/260`) | widersprüchlich; VORHANDEN_ABER_UNVOLLSTÄNDIG |
| IBAN im Klartext | `profiles.bank_iban` und `recruiter_verifications.iban` unverschlüsselt; Admin-Tabelle rendert IBAN offen (`AdminPayments.tsx:260`) | Risiko MITTEL (sensible Zahlungsdaten) |
| USt-Behandlung | `invoices.tax_amount` Default 0, kein Steuersatz-Handling, keine USt-ID-Validierung | NICHT_VORHANDEN |
| Gutschriftverfahren (Recruiter-Gutschrift statt Rechnung) | Keinerlei Beleg-Erzeugung für Recruiter (kein Dokument, kein PDF, keine Tabelle) | NICHT_VORHANDEN |
| Rechnungsdokumente / Export (CSV/DATEV/PDF) | `invoices.pdf_url` wird nie befüllt; kein Export auf `RecruiterEarnings`/`RecruiterPayouts`/`AdminInvoices` (Vollsuche `csv/export`: 0 funktionale Treffer) | NICHT_VORHANDEN |
| Auszahlungstexte | „Auszahlungen erfolgen monatlich zum 15." ist hartkodierter Text ohne dahinterliegende Logik (`RecruiterEarnings.tsx:313-316`) | NUR_MOCK_ODER_PLACEHOLDER |

---

## 7. Beobachtbarkeit & Tests

- Für den gesamten Geldfluss existieren **null Tests** (Repo-weit nur `supabase/tests/001_client_team_permissions_test.sql` und `pii-redaction.test.ts`).
- `payment_events` bietet Webhook-Logging (gut), aber „System can insert payment events" WITH CHECK(true) (`20251204195741…:92-94`) erlaubt jedem authentifizierten Nutzer, Fake-Events in das Admin-Log zu schreiben (Verwässerung/Verwirrung; Verarbeitung selbst läuft nur im Webhook) — Risiko NIEDRIG-MITTEL.

---

## 8. Abschluss: Kann heute ein Recruiter für ein Placement tatsächlich Geld erhalten?

**Nein — nicht über die Produkt-UI.** Die Kette und ihre exakten Bruchstellen:

| # | Schritt | Soll | Ist | Bricht? | Beleg |
|---|---|---|---|---|---|
| 1 | Kandidat angenommen → Placement mit Beträgen | Placement mit `total_fee/recruiter_payout/platform_fee` | Funktioniert über Offer-Flow (Pfad A); Talent-Hub-Pfad B schlägt fehl | teilweise | `process-offer-response:125-144`; `process-talent-hub-action:245-254` |
| 2 | Rechnung an Kunden erzeugen | `invoices`-Zeile + Stripe-Referenz | **Kein Code erzeugt Rechnungen** | **JA — Bruch 1** | Vollsuche Abschnitt 1.3 |
| 3 | Kunde bezahlt | PaymentIntent/Checkout → Webhook | **Kein Code erzeugt PaymentIntent/Checkout; Webhook-Match auf nie gesetztes Feld** | **JA — Bruch 2** | `stripe-webhooks:76`; Vollsuche 1.4 |
| 4 | Escrow `pending → held` | Durch Webhook bei Zahlung | Wird nie erreicht (Folge von 3) | JA (Folge) | `stripe-webhooks:85-92` |
| 5 | Escrow-Release nach 90 Tagen | Cron/Job setzt `released` | **Kein Cron existiert**; „verfügbar" nur clientseitig gerechnet | **JA — Bruch 3** | Abschnitt 1.5; `RecruiterPayouts.tsx:100-110` |
| 6 | Recruiter fordert Auszahlung an | `payout_requests`-Insert per UI | **Einzige UI (`PayoutRequestCard`) wird nie gerendert** | **JA — Bruch 4** | `RecruiterPayouts.tsx:8` + fehlendes Render |
| 7 | Admin genehmigt | `process-payout` approve | Funktioniert technisch — aber ohne Schritt 6 leere Liste; zudem ohne Betrags-/Escrow-/Ownership-Validierung | bedingt | `AdminPayoutApproval.tsx:112-117`; `process-payout:115-145` |
| 8 | Stripe-Transfer an Recruiter | `stripe.transfers.create` auf Connect-Konto | Funktioniert, wenn Recruiter Stripe-Onboarding abgeschlossen hat | nein | `process-payout:115-123`; `stripe-connect:85-97` |

**Einziger heute gangbarer Weg (außerhalb der UI):** Recruiter schließt Stripe-Onboarding ab → jemand insertiert `payout_requests` direkt per API/SQL → Admin klickt „Genehmigen". Genau dieser Weg ist gleichzeitig das kritischste Sicherheitsloch, weil `amount` frei wählbar ist und weder Escrow-Status noch Placement-Zugehörigkeit noch Einmaligkeit geprüft werden (Abschnitt 1.7).

**Minimal nötige Fixes, damit die Kette schließt (Reihenfolge):**
1. Invoice-Erzeugung bei Placement-Anlage (Function oder DB-Trigger) inkl. Stripe PaymentIntent/Checkout und Persistierung von `stripe_payment_intent_id`.
2. Escrow-Release-Cron (`escrow_release_date` abgelaufen ∧ `held` → `released`).
3. `PayoutRequestCard` rendern; serverseitige Validierung in `process-payout` (Betrag = `placement.recruiter_payout`, Escrow `released`, Placement gehört Recruiter, UNIQUE offener Request pro Placement).
4. Status-Vereinheitlichung `'placed'`/`'hired'` (Earnings-Filter + Trust-Berechnung).
5. Trust-Level-RLS härten (USING(true)-Policies und Self-Update entfernen).

---

## Feature-Zeilen für Master-Matrix

| ID | Domäne | Bereich | Feature | Nutzerrolle | UI-Pfad | Frontend-Dateien | Backend | Tabellen | Status | Reifegrad | Sicherheitsrisiko | Beleg | Empfehlung |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FIN-001 | Finance | Placement | Placement-Erzeugung via Offer-Annahme (Fee-Berechnung, 90-Tage-Escrow-Datum) | Kandidat (Token), Client | /offer/view/:token | ViewOffer.tsx, OfferCreationForm.tsx, useOffers.ts | create-offer, process-offer-response | offers, offer_events, placements, submissions | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | MITTEL | process-offer-response/index.ts:125-144 | Fee-Snapshot bei Submission einfrieren; Status 'placed' vs 'hired' vereinheitlichen |
| FIN-002 | Finance | Placement | Placement-Erzeugung via Talent-Hub-Stage „hired" | Recruiter/Client | Talent-Hub-Aktionen | — | process-talent-hub-action | placements | FEHLERHAFT | 1 | NIEDRIG | process-talent-hub-action/index.ts:245-254 insertiert nicht existierende Spalten (types.ts:6897-6911) | Insert auf reales Schema umbauen oder Pfad entfernen |
| FIN-003 | Finance | Provision | Provisionsmodell (fee_percentage 20 % / recruiter_fee 15 % pro Job) | Client/Recruiter | Jobdetail-Sidebar | FeeCalculatorCard.tsx (JobDetail.tsx:502) | process-offer-response | jobs | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | HOCH | jobs-Spalten 20251204171610:44-45; kein Snapshot; Client-RLS FOR ALL 20251204171610:191-192 | Fee bei Submission snapshotten; Spaltenänderung nach erster Submission sperren/auditieren |
| FIN-004 | Finance | Rechnung | Rechnungserzeugung an Kunden | Admin/System | — | — | nicht auffindbar | invoices | NICHT_VORHANDEN | 0 | HOCH | Kein INSERT in invoices im gesamten Code (Vollsuche) | Invoice-Function bei Placement-Anlage bauen (P0) |
| FIN-005 | Finance | Rechnung | Rechnungsansicht + Status (Client/Admin) | Client, Admin | /dashboard/billing, /admin/invoices | ClientBilling.tsx, AdminInvoices.tsx | — | invoices, placements | UI_VORHANDEN_BACKEND_FEHLT | 2 | NIEDRIG | ClientBilling.tsx:92; AdminInvoices.tsx:114-138 (nur Status-Toggle) | Nach FIN-004: Bezahl-Link (Checkout) + PDF-Erzeugung |
| FIN-006 | Finance | Zahlung | Stripe-Webhook (Signatur, Idempotenz, 4 Events) | System | — | — | stripe-webhooks | payment_events, invoices, placements, stripe_accounts, payout_requests | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | MITTEL | stripe-webhooks/index.ts:26-60 (fail-closed), :63-145; Match auf nie gesetztes stripe_payment_intent_id (:76) | PaymentIntent-Erzeugung bauen; weitere Events (payment_intent.payment_failed, charge.dispute.*) |
| FIN-007 | Finance | Escrow | Escrow-Zustandsmaschine (pending/held/released/disputed/refunded) | System | Badges auf Payouts-Seite | EscrowStatusBadge.tsx | stripe-webhooks, process-payout | placements | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | HOCH | Übergänge nur stripe-webhooks:85-92 u. process-payout:138-145; kein Release-Cron; disputed/refunded ohne Setzer | Escrow-Release-Cron (pg_cron) + Dispute-Pfad bauen |
| FIN-008 | Finance | Auszahlung | Auszahlungsanforderung durch Recruiter | Recruiter | /recruiter/payouts (vorgesehen) | PayoutRequestCard.tsx (importiert, nie gerendert: RecruiterPayouts.tsx:8) | — | payout_requests | BACKEND_VORHANDEN_UI_FEHLT | 2 | KRITISCH | Insert-Pfad PayoutRequestCard.tsx:55-61; RLS erlaubt freien amount 20251204195741:79-81; kein UNIQUE(placement_id) | Karte rendern + serverseitige Validierung (Betrag, Escrow, Ownership, Einmaligkeit) |
| FIN-009 | Finance | Auszahlung | Admin-Payout-Approval + Stripe-Transfer | Admin | /admin/payouts | AdminPayoutApproval.tsx | process-payout | payout_requests, placements, stripe_accounts, notifications | SICHERHEITSRISIKO | 3 | KRITISCH | process-payout/index.ts:115-123 transferiert payoutRequest.amount ohne Prüfung gegen placement.recruiter_payout/escrow_status/Recruiter-Zugehörigkeit; Doppel-Approve möglich | Validierungen + Idempotenz in process-payout (P0) |
| FIN-010 | Finance | Auszahlung | Stripe-Connect-Onboarding (Express, DE) | Recruiter | /recruiter/payouts | RecruiterStripeOnboarding.tsx (RecruiterPayouts.tsx:196) | stripe-connect | stripe_accounts | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | NIEDRIG | stripe-connect/index.ts:85-97 (nur country DE, business_type individual) | Länder/Firmenkonten unterstützen; KYC-Status prominenter |
| FIN-011 | Finance | Earnings | Earnings-Seite (KPIs, Placement-Tabelle) | Recruiter | /recruiter/earnings | RecruiterEarnings.tsx | — | submissions, placements, jobs | FEHLERHAFT | 2 | NIEDRIG | Filter status='hired' (RecruiterEarnings.tsx:92) vs. Flow setzt 'placed' (process-offer-response:121); platform_fee geladen nie gezeigt (:83) | Filter auf 'placed' erweitern; Fee-Breakdown + Export |
| FIN-012 | Finance | Payouts-Seite | Payout-Übersicht (4 KPIs, Escrow-Badges) | Recruiter | /recruiter/payouts | RecruiterPayouts.tsx | — | placements, payout_requests | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | MITTEL | „Verfügbar" clientseitig errechnet (RecruiterPayouts.tsx:100-110), DB-Status bleibt held | Erst Backend (FIN-007), dann CTA |
| FIN-013 | Finance | Admin | Manuelle Zahlungsabwicklung (Mark-as-paid, IBAN-Anzeige) | Admin | /admin/payments | AdminPayments.tsx | — | placements, profiles | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | MITTEL | AdminPayments.tsx:60 zeigt nur payment_status confirmed/paid (durch Bruch 2 leer); :87-105 setzt paid ohne payout_request; IBAN klartext :260 | Nach Geldfluss-Fix konsolidieren oder entfernen |
| FIN-014 | Attribution | Submission | Recruiter-Attribution (recruiter_id + Zeitstempel je Submission) | System | — | — | RLS/Schema | submissions | VORHANDEN_PRODUKTIV | 4 | KEIN | 20251204171610:79,85 | Fee-Snapshot ergänzen (siehe FIN-003) |
| FIN-015 | Attribution | Client-Sicht | Recruiter-Sichtbarkeit beim Kunden (Name/Badge) | Client | Bewerber-Ansichten | — | client_submissions_view | — | NICHT_VORHANDEN | 0 | KEIN | View ohne Recruiter-Felder 20260122221123:8-29 | Anonymisierte Attribution („Partner #n" + Trust-Badge) erwägen |
| FIN-016 | Attribution | Fee-Override | custom_fee_percentage pro Recruiter | Admin | /admin/recruiters | AdminRecruiters.tsx:191 | keine Verwendung in Berechnungen | user_roles | NUR_MOCK_ODER_PLACEHOLDER | 1 | NIEDRIG | Spalte 20251204184027:10; 0 Treffer in functions/ | In Fee-Berechnung einbinden oder Feld entfernen |
| FIN-017 | Ownership | Doppel-Einreichung | Schutz gegen Cross-Recruiter-Doppeleinreichung derselben Person | System | — | — | nicht auffindbar | submissions, candidates | NICHT_VORHANDEN | 0 | HOCH | UNIQUE nur (job_id,candidate_id) 20251204171610:87; candidates pro Recruiter :56 | E-Mail-normalisierte Identität + First-Submit-Ownership + Schutzfrist bauen |
| FIN-018 | Ownership | Konflikte | detect-candidate-conflicts (same_client/industry/critical_stage) | System | — | useCandidateConflicts.ts (0 Consumer) | detect-candidate-conflicts | candidate_conflicts | BACKEND_VORHANDEN_UI_FEHLT | 2 | NIEDRIG | Function index.ts:58-95; Hook ohne Verwender | Bei Submission automatisch triggern; Admin-/Recruiter-UI |
| FIN-019 | Ownership | Fraud | Duplikat-/Velocity-/Fraud-Erkennung | Admin | /admin/fraud | AdminFraud.tsx:71 (nur batch_scan) | fraud-detection | fraud_signals, candidates | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | MITTEL | Cross-Recruiter-E-Mail-Duplikat severity high (fraud-detection:147-176), aber kein Auto-Trigger bei Submission | trigger 'candidate_submission' beim Submit aufrufen |
| FIN-020 | Ownership | Umgehung | Off-Platform-Bypass-Erkennung + Meldeprozess | Recruiter/Admin | — | — | nicht auffindbar | — | NICHT_VORHANDEN | 0 | HOCH | Vollsuche bypass/off-platform: 0 Treffer; RiskReportDialog = Deal-Risiken | Meldeweg + Nachwirkfrist-Klausel-Tracking (mind. Prozess) |
| FIN-021 | Ownership | Streitfälle | Dispute-Handling auf Escrow/Placement | Admin | — | PaymentStatusBadge (nur Anzeige) | nicht auffindbar | placements (CHECK-Wert 'disputed') | NICHT_VORHANDEN | 0 | MITTEL | Kein Code setzt disputed/refunded (Vollsuche) | Dispute-Statusübergänge + Admin-UI |
| FIN-022 | Ownership | Sperren | Recruiter-Suspendierung | Admin | /admin/recruiters | AdminRecruiters.tsx:166-174 | has_role ohne Statusprüfung | user_roles | FEHLERHAFT | 1 | HOCH | has_role prüft status nicht (20251204171610:141-154); auth.tsx ohne Prüfung | status='active' in has_role() bzw. RLS-Gate ergänzen |
| FIN-023 | Marktplatz | Zugriff | Offener Job-Zugriff für Recruiter (published) | Recruiter | /recruiter/jobs | RecruiterJobs.tsx | RLS + recruiter_jobs_view | jobs | VORHANDEN_PRODUKTIV | 4 | NIEDRIG | RLS 20251204171610:194-197; View 20260616104941:114-142 | — |
| FIN-024 | Marktplatz | Trust-Gate | Job-Aktivierung + Trust-Level + Slots (bronze/silver/gold) | Recruiter | /recruiter/jobs (Dialog) | RecruiterJobs.tsx:253-262/819, ActivationConfirmDialog.tsx, TrustLevelBadge.tsx, useJobActivation.ts | Trigger/Functions 20260302160000 | recruiter_trust_levels, recruiter_job_activations | SICHERHEITSRISIKO | 2 | KRITISCH | RLS USING(true) 20260302160000:65-68/84-87 + Self-Update 20260302185119:50-53 → Selbst-Upgrade auf gold möglich; Slot-Limit nur clientseitig (RecruiterJobs.tsx:259-262); activateJob meldet success bei DB-Fehler (useJobActivation.ts:99-113) | RLS härten, Slot-Check als DB-Trigger, Fehlerpfad ehrlich machen |
| FIN-025 | Marktplatz | Wettbewerb | Anzeige aktiver Recruiter pro Job / Exklusivität | Recruiter | — | — | — | — | NICHT_VORHANDEN | 0 | KEIN | Vollsuche 0 Treffer | Anonymen Wettbewerbs-Count anzeigen (Motivation + Erwartungsmanagement) |
| FIN-026 | Marktplatz | Mandat | Mandat zurückgeben / Aktivierung beenden | Recruiter | — | useJobActivation.ts (kein Deaktivieren) | keine DELETE-Policy | recruiter_job_activations | NICHT_VORHANDEN | 0 | MITTEL | Policies nur SELECT/INSERT 20260302160000:71-77; active_count nie dekrementiert | Deaktivier-Flow + Slot-Freigabe bauen (sonst läuft jeder Recruiter voll) |
| FIN-027 | Marktplatz | SLA | Fristen/Eskalation (recruiter_first_submission 72h) | System | Banner | SlaWarningBanner.tsx | escalation-engine (kein Cron/Aufrufer) | sla_rules, sla_deadlines | BACKEND_VORHANDEN_UI_FEHLT | 2 | NIEDRIG | Seed 20251204204702:201; kein Invoker (Vollsuche) | Cron für escalation-engine einrichten |
| FIN-028 | Steuer | Stammdaten | Bank-/Steuerdaten des Recruiters (IBAN, tax_id) | Recruiter | /recruiter/onboarding, /recruiter/profile | RecruiterOnboarding.tsx:492-496, RecruiterProfile.tsx:315-319 | useRecruiterVerification | profiles, recruiter_verifications, stripe_accounts | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | MITTEL | Drei parallele Speicherorte; IBAN klartext; Auszahlung nutzt nur Stripe | Auf Stripe Connect als Single Source konsolidieren; IBAN-Felder deprecaten |
| FIN-029 | Steuer | Belege | Gutschriften/Rechnungsdokumente/Steuer-Export für Recruiter | Recruiter | — | — | nicht auffindbar | — | NICHT_VORHANDEN | 0 | MITTEL | pdf_url nie befüllt; kein Export (Vollsuche); Auszahlungstext hartkodiert RecruiterEarnings.tsx:313-316 | Gutschrift-PDF je Payout + CSV-Export (Steuerpflicht des Recruiters) |
| FIN-030 | Finance | Observability | Webhook-Event-Log payment_events | Admin/System | — | — | stripe-webhooks | payment_events | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | NIEDRIG | Insert-Policy WITH CHECK(true) 20251204195741:92-94 erlaubt Fremd-Inserts | Policy auf service_role beschränken |
