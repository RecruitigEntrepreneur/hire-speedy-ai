# 09 · Security-, Datenschutz- und RLS-Befunde (§3.1–3.3, §9)

**Auditor:** Agent 5 (Security & Datenschutz)
**Datum:** 2026-07-21
**Bewertungsbasis:** aktueller Dateistand auf Platte (nicht Git-Historie), Migrationen `supabase/migrations/`, Edge Functions `supabase/functions/`, Client `src/`.
**Perspektive:** Was gefährdet den Headhunter beim Abschluss und der Bezahlung von Mandaten — und was gefährdet die Kandidaten/Kunden, deren Daten er verarbeitet?

---

## 0. Wichtiger Deployment-Vorbehalt (gilt für ALLE RLS-/View-Befunde)

Aus dem Repo lässt sich **nicht** verifizieren, welche Migrationen tatsächlich auf der produktiven Supabase-DB angewandt sind. Mehrere Härtungs-Migrationen (Triple-Blind Welle C, Interview-Reveal-Gates, Consent-Hardening) tragen im Kopfkommentar den Hinweis „manuell deployen" bzw. „ERST Frontend live, DANN anwenden"; die Projekt-Memory notiert mehrfach „nicht deployed".

Konsequenz: Wo eine Härtungs-Migration den Befund entschärft, ist der reale Schutz **nur wirksam, wenn deployed**. Ist sie es nicht, greift die jeweils ältere, offenere Policy. Deshalb sind mehrere Befunde als `VORHANDEN_ABER_UNVOLLSTÄNDIG` bzw. `NICHT_BEWERTBAR` (für den DB-Stand) markiert. Diese Verifikation kann nur mit DB-Zugriff (`\dp`, `pg_policies`, `storage.buckets`) abgeschlossen werden.

---

## 1. PII im Client — Was erreicht den Browser?

### 1.1 Client-Seiten lesen serverseitig maskierte Views — nachgewiesen positiv

Die Client-Hooks lesen Kandidatendaten **ausschließlich** über reveal-gated Views, nicht über die Rohtabellen:

- `src/hooks/useBewerber.ts:226` → `.from('client_candidate_view')`, `:297` → `.from('client_candidate_experiences_view')`.
- `src/hooks/useClientCandidateView.ts:199–201` Kommentar + Query gegen dieselbe View.
- Kein einziger Client-Screen liest die Rohtabelle `candidates` direkt (Grep über `src/pages/client/` und `src/components/client/` → 0 Treffer für `.from('candidates')`).

Die Views maskieren PII serverseitig: `full_name, email, phone, cv_url, linkedin_url, city, experience_years` sind `NULL` bis `identity_unlocked` (`20260608121000_triple_blind_views_wave_a.sql:121-127`). Gehalt/Region/Erfahrung nur als Band. **Vor dem Reveal sieht der Client-Browser die Klardaten also selbst im Network-Tab nicht** — vorausgesetzt, die Views sind deployed und der Rohzugriff ist entzogen (siehe §2).

**Status:** VORHANDEN_PRODUKTIV (Client-Query-Ebene) · Reifegrad 4 · Sicherheitsrisiko KEIN.

### 1.2 `client_candidate_view` gibt `recruiter_notes` ungated an den Client — teilweise nachgewiesen

`20260616120000_client_candidate_view_cv_summary.sql:25` selektiert `s.recruiter_notes` **ohne** Reveal-Gate. Der Kunde liest damit die internen Notizen des Recruiters zum Kandidaten jederzeit. Ob das gewollt ist (Recruiter-Pitch an Kunde) oder ein Leak interner Bewertung, ist aus dem Code nicht entscheidbar.

**Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 3 · Sicherheitsrisiko NIEDRIG.

### 1.3 `cv_ai_summary` wird vor Reveal nur heuristisch gescrubbt — teilweise nachgewiesen

`20260616120000_...:61-66` ersetzt vor `identity_unlocked` Namens- und Arbeitgeber-Tokens per `scrub_identity_tokens`. Token-Quelle sind `full_name` (+ Teilstücke ≥3 Zeichen) und Arbeitgebernamen (`:74-88`). Das ist Best-Effort: einzigartige Projektnamen, seltene Skill-Kombinationen, Ortsangaben im Fließtext oder Umschreibungen bleiben stehen und ermöglichen Re-Identifikation. Kein hartes Gate, sondern String-Ersetzung.

**Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 3 · Sicherheitsrisiko NIEDRIG.

---

## 2. Triple-Blind-Enforcement — serverseitig oder nur Client-Maskierung?

### 2.1 Grundmechanik: serverseitig via Views + RLS — nachgewiesen (Code vorhanden)

Der Blind ist **in die DB verlegt**, nicht nur clientseitig:
- `client_candidate_view` / `client_candidate_experiences_view` sind Definer-Views mit Eigen-Ownership (`WHERE j.client_id = auth.uid()`) und CASE-Spaltenmaskierung (`20260608121000`).
- Welle C (`20260616140000_triple_blind_welle_c_revoke_client_raw.sql:27,30`) entzieht dem Client den **Rohzugriff** auf `candidates` und `candidate_experiences` (DROP der alten Client-SELECT-Policies) → fail-closed.
- `20260710090000_interview_reveal_gates.sql` + `20260710230444_...:468-477` ersetzen die alte Client-Policy durch „Clients view candidates only after reveal" (SELECT nur bei `identity_unlocked OR identity_revealed`).

**Aber:** Wirksam nur, wenn alle drei Wellen deployed sind. Ist Welle C **nicht** deployed, existiert die Alt-Policy `"Clients can view candidates for their jobs"` (`20251212165255_...:2`) weiter und der Client liest rohe PII an der View vorbei.

**Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG (Code ja, Deploy nicht verifizierbar) · Reifegrad 3 · Sicherheitsrisiko MITTEL.

### 2.2 Einzelverifikation der Prior-Art-Behauptungen

| # | Behauptung (Memory/Godmode) | Verdikt | Beleg |
|---|---|---|---|
| a | Reveal-Gate client-bypassbar | **TEILWEISE / abhängig vom Deploy** | Gate ist DB-seitig, sobald Welle C + reveal_gates deployed sind (`20260616140000`, `20260710090000`). Bypass nur, falls nicht deployed → dann greift `20251212165255`. |
| b | Status-Landmine (`status='interview'` löst Sofort-Reveal aus) | **BEHOBEN** (im späteren File) | `20260616150000_opt_in_reveals_identity.sql:31` enthielt `'interview'` in der Auto-Reveal-Liste; `20260710100000_optin_consent_hardening.sql:39-41` **entfernt** `'interview'` und dokumentiert die Landmine explizit. Wirksam nur wenn die spätere Migration deployed ist. |
| c | „Pfad C revealt nie" | **NICHT_BEWERTBAR (Security)** | Der primäre Accept-Pfad `process-interview-response` revealt korrekt mit Consent (`process-interview-response/index.ts:149-164`). Ob alle 3+1 Interview-Pfade revealt, ist ein Flow-/Funktionsbefund (Agent Interview-Flow), kein Security-Leak. |
| d | IDOR via `get-interview-by-token` | **WIDERLEGT (als IDOR)** | Kein ID-basierter Zugriff: Lookup nur über `response_token`/`selection_token` (`get-interview-by-token/index.ts:59-69`), Rückgabe enthält **keine** Kandidaten-PII, nur Job-Titel/Branche/Firmenname (bewusst). Token-Länge ≥16 geprüft (`:34`). Restrisiko liegt in der Token-Erzeugung, siehe §5. |
| e | Consent-Lücke | **TEILWEISE BEHOBEN** | Accept-Pfad verlangt jetzt aktive Einwilligung (`process-interview-response/index.ts:129-131` `if (consentGiven !== true) throw`). Aber Stage-Transition-Pfad setzt `consent_confirmed=true` **ohne** echte Kandidaten-Aktion (`20260710100000_...:49-57`); consent_meta markiert das ehrlich als `stage_transition`, ändert aber nichts an der schwachen Nachweisbarkeit — siehe §7. |

---

## 3. Recruiter-übergreifender Zugriff & Kandidaten-Ownership

### 3.1 Recruiter A ↔ Recruiter B auf DB-Tabellen — nachgewiesen abgeschottet

- `candidates`: `"Recruiters can manage their own candidates" FOR ALL USING (auth.uid() = recruiter_id)` (`20251204171610_...:203`). Kein OR-Zweig für fremde Recruiter → B kann A's Kandidaten nicht lesen.
- `submissions`: `"Recruiters can manage their submissions" FOR ALL USING (auth.uid() = recruiter_id)` (`:210`). Ebenso abgeschottet.

**Status:** VORHANDEN_PRODUKTIV · Reifegrad 4 · Sicherheitsrisiko KEIN (auf Tabellenebene).

### 3.2 ABER: CV-Dateien sind cross-recruiter lesbar (siehe §4.1) — die Abschottung endet am Storage.

### 3.3 Kandidaten-Schutzfristen / Exklusivität — nicht auffindbar

Grep über Migrationen und `src/` nach `schutzfrist|protection_period|candidate_ownership|protected_until|exclusive` → keine Tabelle/Logik. Ownership existiert nur als `recruiter_id`-Spalte. Es gibt **keine** Schutzfrist, die verhindert, dass zwei Recruiter denselben Menschen parallel einreichen; `detect-candidate-conflicts` erkennt Konflikte nur nachträglich (same_client/same_industry/critical_stage, `detect-candidate-conflicts/index.ts:61-97`), sperrt aber nicht.

**Status:** NICHT_VORHANDEN · Reifegrad 0 · Sicherheitsrisiko NIEDRIG (fachliches/Provisions-Risiko, kein Datenleck).

### 3.4 Client→Recruiter-Blind am View vorbei — nachgewiesen

`recruiter_jobs_view` maskiert `company_name`/`company_culture` bis zum Firmen-Reveal (`20260608121000_...:172-174`). **Aber** die Rohtabelle `jobs` ist für Recruiter direkt lesbar: `"Recruiters can view published jobs" FOR SELECT USING (has_role(...,'recruiter') AND status='published')` (`20251204171610_...:194`). Diese Policy wird in keiner späteren Migration gedroppt oder durch Spaltenmaskierung ersetzt (RLS kann ohnehin keine Spalten maskieren). Ein Recruiter kann also `select company_name, company_culture from jobs where status='published'` direkt gegen die REST-API absetzen und die Kundenfirma **vor jedem Reveal** lesen. Der View-Blind ist damit rein kosmetisch.

**Status:** SICHERHEITSRISIKO · Reifegrad 2 · Sicherheitsrisiko HOCH.

---

## 4. Dokumente / CVs — Storage-Buckets

Drei Buckets, alle `public=false`, aber die SELECT-Policies unterscheiden sich massiv:

| Bucket | public | SELECT-Policy | Bewertung |
|---|---|---|---|
| `documents` | false | `bucket_id='documents' AND auth.uid()::text = (storage.foldername(name))[1]` + Admin (`20251204193757_...:77-85`) | **sicher** — pro-User-Ordner |
| `cv-documents` | false | `USING (bucket_id = 'cv-documents')` (`20251211235414_...:14-18`) | **offen für JEDEN authentifizierten Nutzer** |
| `job-documents` | false | `USING (bucket_id = 'job-documents')` (`20251212181114_...`) | **offen für JEDEN authentifizierten Nutzer, inkl. DELETE** |

### 4.1 `cv-documents`: jeder eingeloggte Nutzer liest jedes CV — nachgewiesen KRITISCH

Die Policy `"Users can read CV documents" FOR SELECT TO authenticated USING (bucket_id = 'cv-documents')` hat **keinerlei** Ownership-Check (kein Ordner-, kein Kandidaten-, kein Recruiter-Bezug). Keine spätere Migration verschärft sie (letzte `storage.objects`-Migration ist `20251212181114`). Der Client generiert CV-Links teils via `createSignedUrl(...,3600)` (`useCandidateDocuments.ts:32-33`), teils via `getPublicUrl` (`:114`, `CvUploadDialog.tsx:164`). Da die SELECT-Policy für alle authenticated gilt, kann **jeder eingeloggte Recruiter oder Kunde** für **jeden** Objektpfad im Bucket eine Signed URL erzeugen bzw. den authenticated-Object-Endpoint abrufen. CVs enthalten Klarnamen, Kontaktdaten und vollständige Arbeitgeber-Historie.

Damit ist der gesamte Triple-Blind über den Storage aushebelbar **und** die Recruiter-zu-Recruiter-Abschottung (§3.1) endet hier: Recruiter B lädt die CVs der Kandidaten von Recruiter A.

**Status:** SICHERHEITSRISIKO · Reifegrad 1 · Sicherheitsrisiko KRITISCH.

### 4.2 `job-documents`: jeder eingeloggte Nutzer liest und löscht — nachgewiesen HOCH

Analog offen für SELECT **und** DELETE (`20251212181114_...`: „Authenticated users can delete job documents" USING `bucket_id='job-documents'`). Jeder authentifizierte Nutzer kann fremde Job-Anhänge (Stellenbeschreibungen, evtl. interne Dokumente) lesen und **löschen** (Datenzerstörung).

**Status:** SICHERHEITSRISIKO · Reifegrad 1 · Sicherheitsrisiko HOCH.

---

## 5. Auth — Privilege-Escalation & Rollenwechsel

### 5.1 Auth-Härtung schließt die dokumentierten Vektoren — nachgewiesen (bei Deploy)

`20260608120000_auth_hardening_privilege_escalation.sql`:
- `handle_new_user()` whitelisted die Signup-Rolle auf `client|recruiter`, alles andere fällt auf `client` (`:34-37`) → `admin` per Signup-Metadaten nicht mehr setzbar.
- DROP der Policy `"Users can insert their own role"` (`:53`) → kein user-facing INSERT-Pfad in `user_roles` mehr.

Reststand der `user_roles`-Policies danach: nur `"Users can view their own role"` (SELECT) und `"Admins can manage all roles"` (ALL). Es gibt **keine** Self-UPDATE/DELETE-Policy → RLS-default-deny blockt Selbst-Änderung. Rollen liegen in separater Tabelle `user_roles`; `profiles` hat **keine** `role`-Spalte (`20251204171610_...` CREATE TABLE profiles → nur email/full_name/company_name/phone/avatar_url). Ein User kann seine Rolle also weder über `profiles` noch über `user_roles` selbst hochstufen.

**Reicht sie?** Für die zwei dokumentierten Vektoren: ja, **sofern deployed**. Zwei Restpunkte:
1. Bereits unrechtmäßig vergebene `admin`-Rollen werden bewusst **nicht** bereinigt (`:56-63`, manueller Schritt) → NICHT_BEWERTBAR ohne DB.
2. Deploy-Status nicht aus Repo verifizierbar.

**Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 3 · Sicherheitsrisiko NIEDRIG.

### 5.2 Interview-Token via `Math.random()` — nachgewiesen HOCH

`send-interview-invitation/index.ts:29-35`:
```
function generateToken(): string {
  const chars = '...62 Zeichen...';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
}
```
`Math.random()` ist **kein** CSPRNG (V8: xorshift128+, aus wenigen Outputs rekonstruierbar). Dieser `response_token` ist der **einzige** Zugangsschutz des Kandidaten-Antwort-Flows: er autorisiert `process-interview-response` (Accept → Identitäts-Reveal an den Kunden) und `get-interview-by-token`. Der Parallel-Pfad `schedule-interview` nutzt korrekt `crypto.randomUUID()` (`schedule-interview/index.ts:144`) — beide Tokens werden aber von denselben öffentlichen Functions akzeptiert. Der schwächere Pfad zieht das Sicherheitsniveau nach unten.

**Status:** FEHLERHAFT · Reifegrad 2 · Sicherheitsrisiko HOCH.

---

## 6. Service-Role-Exposure & öffentliche Edge Functions

### 6.1 Service-Role-Key clientseitig — nicht auffindbar (positiv)

Grep `SERVICE_ROLE|serviceRole` über `src/` → **0 Treffer**. Der Key wird nur in Edge Functions via `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` genutzt.

**Status:** VORHANDEN_PRODUKTIV (korrekte Trennung) · Reifegrad 4 · Sicherheitsrisiko KEIN.

### 6.2 Functions mit `verify_jwt = false` + Service-Role — Missbrauchspotenzial

Aus `supabase/config.toml` sind u. a. offen (kein JWT): `get-interview-by-token`, `validate-invite`, `accept-invite`, `process-interview-response`, `process-offer-response`, `process-inbound-email`, `process-inbound-reply`, `resend-webhooks`, `stripe-webhooks`, `process-outreach-queue`, `track-*`, `calculate-*`, `talent-pool-match`, `oauth-callback`, `escalation-engine`, `influence-engine`, `refresh-analytics`, `seed-ml-training-data`. Bewertung der sicherheitsrelevanten:

| Function | Schutz vorhanden? | Missbrauchspotenzial (1–2 Sätze) |
|---|---|---|
| `stripe-webhooks` | **Ja** — HMAC + fail-closed + Idempotenz (`stripe-webhooks/index.ts:26-37,43-49`) | Kein: gefälschte Events werden abgewiesen, kein Doppel-Payout. Positivbefund. |
| `validate-invite` | Ja — SHA-256-Token-Hash, Expiry/Revoke/Used geprüft (`validate-invite/index.ts:43-62`) | Gering: mit gültigem Token erhält man Org-Name/Logo + `account_exists`. Kein IDOR. |
| `get-interview-by-token` | Teilweise — Token-Lookup, keine PII zurück (`:80-96`) | Bei erratenem/rekonstruiertem Token (schwacher `response_token`, §5.2) Interview-Metadaten lesbar. |
| `process-interview-response` | Teilweise — Consent-Gate für Accept (`:129-131`) | Bei erratenem Token: Interview annehmen/ablehnen und **Identitäts-Reveal auslösen**. Schwere hängt an Token-Stärke (§5.2). |
| `resend-webhooks` | **Nein** — keine Svix-Signaturprüfung (`resend-webhooks/index.ts` liest `req.json()` direkt) | Forgery: beliebige Leads als „bounced/complained" markieren → Suppression-Liste vergiften, Sequenzen pausieren, ganze Kampagnen auto-pausieren (`:191-205`). |
| `process-inbound-email` | **Nein** — kein Sender-/Signatur-Check (`process-inbound-email/index.ts:49-74`) | Forgery: durch gefälschtes `from` fremde Lead-Konversationen anlegen/ändern, Lead-Status auf „qualified/closed" setzen, Sequenzen pausieren; zusätzlich wird der Roh-Text an Lovable-AI geschickt. |
| `process-offer-response` | (nicht gelesen) | `verify_jwt=false` + Angebots-/Geldfluss-nah → gesonderte Prüfung empfohlen (Token-/Signaturschutz verifizieren). |

**Status (Sammelzeile resend/inbound):** SICHERHEITSRISIKO · Reifegrad 2 · Sicherheitsrisiko MITTEL.

---

## 7. Audit-Logs & Consent-Nachweise

### 7.1 `activity_logs` — nicht manipulationssicher (Insert-Forgery) — nachgewiesen

Policies: `"Users can view their own logs"` (SELECT), `"Admins can view all logs"`, und `"System can insert logs" FOR INSERT WITH CHECK (true)` (`20251212185019_...:106-110`, ersetzt die engere `auth.uid()=user_id`-Variante). `WITH CHECK (true)` erlaubt **jedem** authenticated das Einfügen von Log-Zeilen mit **beliebiger** `user_id` → fabrizierte Einträge / Repudiation. Immerhin: keine UPDATE/DELETE-Policy für Nicht-Admins → bestehende Zeilen sind für reguläre Nutzer nicht änderbar (append-only), aber die Integrität „wer hat's getan" ist nicht garantiert.

**Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 2 · Sicherheitsrisiko MITTEL.

### 7.2 `candidate_activity_log` — vom Recruiter selbst editier-/löschbar — nachgewiesen

`20251211212741_...:23-38`: Recruiter haben INSERT, **UPDATE und DELETE** auf ihre eigenen Aktivitäts-Logs (Calls, Notizen, Status-Changes). Ein Audit-Trail, den die protokollierte Partei selbst umschreiben und löschen kann, ist nicht revisionssicher (keine Non-Repudiation).

**Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 2 · Sicherheitsrisiko MITTEL.

### 7.3 Consent-Nachweis liegt auf mutabler `submissions`-Zeile — nachgewiesen

Einwilligung wird in `submissions.consent_confirmed`/`consent_meta`/`identity_unlocked` gehalten. Recruiter haben `FOR ALL` auf ihre Submissions (`20251204171610_...:210`) → sie können diese Consent-Felder **selbst überschreiben**. Zusätzlich setzt der Trigger `sync_identity_unlock_with_stage` `consent_confirmed=true`, sobald der Recruiter die Stage auf `candidate_opted_in`/`interview_scheduled`/… setzt (`20260710100000_...:44-57`) — also **ohne** nachweisbare Kandidaten-Handlung; `consent_meta.source='stage_transition'` dokumentiert das ehrlich, ersetzt aber keinen belastbaren Nachweis. Es existiert **kein** separater, unveränderlicher Reveal-/Consent-Audit (append-only). DSGVO-relevant: Art. 7 Abs. 1 (Nachweis der Einwilligung), Art. 5 Abs. 2 (Rechenschaftspflicht).

**Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 2 · Sicherheitsrisiko MITTEL.

### 7.4 PII-Redaktion vor LLM — teilweise verdrahtet

`assess-candidate-fit/index.ts:3,109-117` importiert und nutzt `redactCandidateForLLM` (`_shared/pii-redaction.ts`), Default `PII_REDACTION_MODE="on"`, plus `assertNoLeak`. Positiv. Aber: (a) per Env-Flag `off` abschaltbar (Kill-Switch), (b) `process-inbound-email` sendet den **Roh-E-Mail-Text** ungeredacht an das Lovable-AI-Gateway (`process-inbound-email/index.ts:132-148`).

**Status:** VORHANDEN_ABER_UNVOLLSTÄNDIG · Reifegrad 3 · Sicherheitsrisiko NIEDRIG.

---

## 8. Webhook-Security

| Webhook | Signaturprüfung | Beleg | Bewertung |
|---|---|---|---|
| `stripe-webhooks` | **Ja** (HMAC, async SubtleCrypto, fail-closed) | `stripe-webhooks/index.ts:26-37` | Sicher + idempotent (`:43-49`). |
| `resend-webhooks` | **Nein** (kein Svix `svix-signature`-Check) | `resend-webhooks/index.ts:9-30` | Forgery möglich (§6.2). |
| `process-inbound-email` | **Nein** (kein Provider-Signatur-/Sender-Check) | `process-inbound-email/index.ts:49-74` | Forgery möglich (§6.2). |
| `process-inbound-reply` | (gleiche Klasse `verify_jwt=false`, nicht im Detail gelesen) | `config.toml` | Gesondert prüfen. |

---

## 9. Top-Sicherheitsrisiken (priorisiert)

### P0 — sofort

1. **SEC-001 · `cv-documents`-Bucket ist für alle eingeloggten Nutzer lesbar.**
   *Angriffsskizze:* Ein beliebiger Recruiter- oder Kunden-Account ruft `storage.from('cv-documents').createSignedUrl(pfad,3600)` für fremde Objektpfade auf und lädt CVs anderer Recruiter/Kandidaten mit Klarnamen, Kontakt und Arbeitgeberhistorie — Triple-Blind und Recruiter-Abschottung ausgehebelt.
   *Fundstelle:* `20251211235414_...:14-18`.

### P1 — kurzfristig

2. **SEC-002 · `job-documents`-Bucket weltoffen für SELECT + DELETE.**
   *Angriffsskizze:* Jeder authentifizierte Nutzer liest fremde Job-Anhänge und kann sie löschen (Datenzerstörung). *Fundstelle:* `20251212181114_...`.

3. **SEC-003 · Client→Recruiter-Blind am View vorbei.**
   *Angriffsskizze:* Ein Recruiter fragt `jobs` direkt ab (`select company_name from jobs where status='published'`) und liest die Kundenfirma vor jedem Firmen-Reveal, weil die Roh-Policy nie gedroppt wurde. *Fundstelle:* `20251204171610_...:194`.

4. **SEC-004 · Reveal-Token via `Math.random()` vorhersagbar.**
   *Angriffsskizze:* Aus beobachteten Tokens rekonstruiert ein Angreifer den PRNG-Zustand, rät gültige `response_token` und löst über `process-interview-response` einen Identitäts-Reveal an den Kunden aus. *Fundstelle:* `send-interview-invitation/index.ts:29-35`.

5. **SEC-005 · Triple-Blind-/Reveal-Härtung Deploy-abhängig.**
   *Angriffsskizze:* Sind Welle C / reveal_gates nicht deployed, greift die alte Policy `"Clients can view candidates for their jobs"` und der Kunde liest rohe Kandidaten-PII vor Opt-In. *Fundstelle:* `20260616140000`, `20260710090000` vs. `20251212165255`.

6. **SEC-007 · Consent-Nachweis nicht revisionssicher.**
   *Angriffsskizze:* Recruiter setzt Stage → Trigger stempelt `consent_confirmed=true` ohne Kandidaten-Handlung; Recruiter kann `consent_meta` per `FOR ALL` überschreiben. Kein unveränderlicher Nachweis (DSGVO Art. 7/5(2)). *Fundstelle:* `20260710100000_...:44-57`, `20251204171610_...:210`.

### P2 — mittelfristig

7. **SEC-009/010 · Webhook-/Inbound-Forgery (resend-webhooks, process-inbound-email).**
   *Angriffsskizze:* Ungeprüfte Payloads erlauben, beliebige Leads zu sperren, Kampagnen zu pausieren und fremde Konversationen zu manipulieren. *Fundstelle:* `resend-webhooks/index.ts:9-30`, `process-inbound-email/index.ts:49-74`.

8. **SEC-013/014 · Audit-Logs manipulierbar** (`activity_logs` Insert-Forgery; `candidate_activity_log` vom Recruiter löschbar). *Fundstelle:* `20251212185019_...:106-110`, `20251211212741_...:23-38`.

### Positivbefunde (kein Handlungsbedarf)

- Service-Role-Key nicht clientseitig (`src/` clean).
- Client-Screens lesen ausschließlich reveal-gated Views.
- `stripe-webhooks` signaturgeprüft, fail-closed, idempotent.
- Auth-Härtung schließt die dokumentierte Privilege-Escalation (bei Deploy); Rollen in separater `user_roles`-Tabelle ohne Self-Write.
- PII-Redaktion vor LLM in `assess-candidate-fit` verdrahtet.

---

## Feature-Zeilen für Master-Matrix

| ID | Domäne | Bereich | Feature | Nutzerrolle | UI-Pfad | Frontend-Dateien | Backend | Tabellen | Status | Reifegrad | Sicherheitsrisiko | Beleg | Empfehlung |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SEC-001 | Security | Storage | CV-Dateien Zugriffsschutz | Recruiter/Client | (kein UI; Storage-API) | useCandidateDocuments.ts, CvUploadDialog.tsx | Supabase Storage RLS | storage.objects (cv-documents) | SICHERHEITSRISIKO | 1 | KRITISCH | `20251211235414_...:14-18`; `useCandidateDocuments.ts:114` | SELECT/DELETE-Policy auf Kandidaten-/Recruiter-Ownership (foldername) einschränken; Signed URLs nur serverseitig nach Reveal-Check |
| SEC-002 | Security | Storage | Job-Dokumente Zugriffsschutz | alle | (kein UI; Storage-API) | FileUpload.tsx | Supabase Storage RLS | storage.objects (job-documents) | SICHERHEITSRISIKO | 1 | HOCH | `20251212181114_...` | SELECT/DELETE an job.client_id bzw. Zuständigkeit binden |
| SEC-003 | Security | RLS | Client→Recruiter Firmen-Blind | Recruiter | /recruiter/jobs | recruiter_jobs_view-Konsumenten | PostgREST | jobs, recruiter_jobs_view | SICHERHEITSRISIKO | 2 | HOCH | `20251204171610_...:194`; View `20260608121000_...:172-174` | Recruiter-Rohzugriff auf jobs entziehen; Recruiter lesen ausschließlich recruiter_jobs_view |
| SEC-004 | Security | Auth/Token | Interview-Reveal-Token-Stärke | Kandidat (Public) | /interview/respond/:token | (extern per E-Mail) | Edge: send-interview-invitation | interviews.response_token | FEHLERHAFT | 2 | HOCH | `send-interview-invitation/index.ts:29-35` | `crypto.randomUUID()`/`crypto.getRandomValues` statt `Math.random()`; Token-Ablauf + Single-Use |
| SEC-005 | Datenschutz | RLS/Views | Triple-Blind serverseitig (Deploy) | Client | Bewerber-Pipeline | useBewerber.ts, useClientCandidateView.ts | PostgREST Views | candidates, client_candidate_view | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | MITTEL | `20260616140000`; `20260710090000`; vs `20251212165255` | Deploy-Status aller Wellen in DB verifizieren (pg_policies); fail-closed sicherstellen |
| SEC-006 | Datenschutz | Reveal-Trigger | Status-Landmine `interview` | System | – | – | Trigger sync_identity_unlock_with_stage | submissions | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | MITTEL | behoben `20260710100000_...:39-41`; alt `20260616150000_...:31` | Sicherstellen, dass die spätere (behobene) Migration deployed ist |
| SEC-007 | Datenschutz | Consent | Reveal-Consent-Integrität | Kandidat/Recruiter | Interview-Flow | – | Edge: process-interview-response; Trigger | submissions.consent_meta | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | MITTEL | `process-interview-response/index.ts:129-131`; `20260710100000_...:44-57` | Unveränderlichen Consent-/Reveal-Audit (append-only) einführen; consent_meta gegen Recruiter-Overwrite schützen |
| SEC-008 | Security | Edge Function | get-interview-by-token IDOR | Kandidat (Public) | /interview/respond/:token | – | Edge: get-interview-by-token | interviews | VORHANDEN_PRODUKTIV | 3 | NIEDRIG | `get-interview-by-token/index.ts:59-96` | Kein IDOR; Token-Stärke via SEC-004 heben; Rate-Limit ergänzen |
| SEC-009 | Security | Webhook | resend-webhooks Signaturprüfung | System (Public) | – | – | Edge: resend-webhooks | outreach_* | SICHERHEITSRISIKO | 2 | MITTEL | `resend-webhooks/index.ts:9-30` | Svix-Signatur (`svix-*` Header) verifizieren, fail-closed |
| SEC-010 | Security | Webhook | process-inbound-email Absenderprüfung | System (Public) | – | – | Edge: process-inbound-email | outreach_leads/conversations | SICHERHEITSRISIKO | 2 | MITTEL | `process-inbound-email/index.ts:49-74` | Provider-Signatur/SPF-DKIM-verifizierten Header prüfen; Roh-Text vor LLM redigieren |
| SEC-011 | Security | Webhook | stripe-webhooks Signaturprüfung | System (Public) | – | – | Edge: stripe-webhooks | payment_events, invoices, placements | VORHANDEN_PRODUKTIV | 4 | KEIN | `stripe-webhooks/index.ts:26-49` | Beibehalten (Positivbefund) |
| SEC-012 | Security | Auth | Privilege-Escalation-Härtung | alle | Signup | – | Trigger handle_new_user; RLS | user_roles, profiles | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | NIEDRIG | `20260608120000_...:34-37,53` | Deploy verifizieren; Alt-Admins per SQL prüfen/bereinigen |
| SEC-013 | Security | Audit | activity_logs Manipulationsschutz | alle | /admin/activity | AdminActivity.tsx | PostgREST | activity_logs | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | MITTEL | `20251212185019_...:106-110` | INSERT auf `user_id=auth.uid()` oder Service-Role beschränken; sonst append-only |
| SEC-014 | Security | Audit | candidate_activity_log Revisionssicherheit | Recruiter | Kandidaten-Timeline | useCandidateActivityLog.ts | PostgREST | candidate_activity_log | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | MITTEL | `20251211212741_...:23-38` | UPDATE/DELETE für Recruiter entziehen (append-only) |
| SEC-015 | Business/Security | Ownership | Kandidaten-Schutzfrist/Exklusivität | Recruiter | – | – | – | (keine) | NICHT_VORHANDEN | 0 | NIEDRIG | Grep 0 Treffer; `detect-candidate-conflicts/index.ts:61-97` | Schutzfrist-Tabelle + serverseitige Sperre bei Doppel-Einreichung erwägen |
| SEC-016 | Security | Secrets | Service-Role-Key clientseitig | – | – | src/ (clean) | – | – | VORHANDEN_PRODUKTIV | 4 | KEIN | Grep `SERVICE_ROLE` in src/ = 0 | Beibehalten (Positivbefund) |
| SEC-017 | Datenschutz | KI/PII | PII-Redaktion vor LLM | System | – | – | Edge: assess-candidate-fit; _shared/pii-redaction.ts | candidates | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | NIEDRIG | `assess-candidate-fit/index.ts:3,109-117`; `process-inbound-email/index.ts:132-148` | Kill-Switch entfernen/absichern; Inbound-Text vor LLM redigieren |
| SEC-018 | Datenschutz | View | recruiter_notes/cv_ai_summary Exposure | Client | Bewerber-Pipeline | useClientCandidateView.ts | PostgREST View | client_candidate_view | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | NIEDRIG | `20260616120000_...:25,61-66` | recruiter_notes-Sichtbarkeit klären; cv_ai_summary-Scrub härten/gaten |
| SEC-019 | Security | RLS | interview_participants Sichtbarkeit | alle | Interview-Detail | – | PostgREST | interview_participants | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | MITTEL | behoben `20260710090000_...:19-35`; alt „Anyone can view" | Deploy der reveal_gates-Migration verifizieren |
| SEC-020 | Security | Storage | documents-Bucket (pro-User) | alle | Datei-Upload | FileUpload.tsx | Supabase Storage RLS | storage.objects (documents) | VORHANDEN_PRODUKTIV | 4 | KEIN | `20251204193757_...:77-85` | Beibehalten (Referenzmuster für SEC-001/002) |
