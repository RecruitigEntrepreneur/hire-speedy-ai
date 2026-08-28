# 07 — End-to-End-Workflow-Analyse (Recruiter-Prozesse)

**Audit-Agent 4 (Recruiting-Prozesse) · Stand: 2026-07-21 · Basis: Dateistand auf Platte (main, inkl. uncommitteter Änderungen)**

Perspektive: der arbeitende Headhunter. Leitfrage pro Ablauf: *Kann er damit ein Mandat abschließen und bezahlt werden — und wenn nicht: wo genau bricht der Prozess ab?*

Legende Reifegrad: 0 = nicht vorhanden · 1 = Idee/Mock · 2 = technisch begonnen · 3 = grundsätzlich funktionsfähig · 4 = produktiv nutzbar · 5 = vollständig + getestet + sicher + beobachtbar.
Hinweis Testabdeckung: Im gesamten Repo existieren nur 2 Testdateien (`supabase/tests/001_client_team_permissions_test.sql`, `supabase/functions/_shared/pii-redaction.test.ts`). **Kein einziger der 20 folgenden Workflows ist durch Tests abgedeckt** — Reifegrad 5 ist damit systemisch ausgeschlossen.

---

## Prior-Art-Verifikation (Hypothesen aus Vor-Analysen)

| Hypothese (Quelle) | Ergebnis heute |
|---|---|
| „Revenue/Payout blocked" (MATCHUNT_GODMODE_ANALYSIS.md) | **VERIFIZIERT** — keine Rechnungserstellung im Code, keine Zahlungsauslösung (kein `paymentIntents.create`/Checkout im gesamten Repo), Payout-Request-UI nicht gemountet (Beleg: WF-018) |
| „IDOR in send-interview-invitation" (Triple-Blind-Analyse) | **NICHT MEHR AKTUELL** — Aufrufer wird jetzt verifiziert und via `canUserActOnJob` autorisiert (`supabase/functions/send-interview-invitation/index.ts:182-229`) |
| „Status-Landmine: status='interview' reveals" (Triple-Blind-Analyse) | **NICHT MEHR AKTUELL** — 'interview' aus der Auto-Reveal-Liste entfernt (`supabase/migrations/20260710100000_optin_consent_hardening.sql:38-42`) |
| „Pfad C (Dashboard-Widget) erzeugt Geister-Anfragen" | **NICHT MEHR AKTUELL (Daten migriert)** — `20260710101000_migrate_ghost_interview_requests.sql` überführt Alt-Anfragen in echte `interviews`-Zeilen |
| „Consent-Gap: Reveal ohne protokollierte Kandidaten-Einwilligung" | **TEILWEISE VERIFIZIERT** — Kandidaten-Pfad verlangt aktive Zustimmung (`process-interview-response/index.ts:129-131`); der Recruiter kann den Reveal aber weiterhin selbst auslösen, ohne dass der Kandidat je geklickt hat (WF-015) |
| „Slot-Limit greift nie (active_count=0 in Live-DB)" (Migrations-Kommentar) | **VERIFIZIERT als eingestandener Defekt** — Repair-Migration `20260719120000_fix_activation_count_repair.sql:1-12` dokumentiert, dass der Trigger in der Live-DB fehlte; serverseitige Slot-Durchsetzung existiert auch nach Repair nicht (WF-005) |

---

## WF-001 · Recruiter registriert sich

| Aspekt | Befund |
|---|---|
| Auslöser | Nutzer öffnet `/auth?role=recruiter`, Tab „Registrieren" |
| Rolle | anonym → recruiter |
| UI-Schritte | `src/pages/Auth.tsx:96-109` (signUp), Rollenwahl client/recruiter `Auth.tsx:129-142`; Redirect nach Login: recruiter → `/recruiter` (`Auth.tsx:50-51`) |
| Backend | `supabase.auth.signUp` mit `role` in `user_metadata` (`src/lib/auth.tsx:65-81`); DB-Trigger `handle_new_user` (gehärtet: nur client/recruiter, nie admin — `supabase/migrations/20260608120000_auth_hardening_privilege_escalation.sql:16-36`); Trigger `on_recruiter_role_created` legt Inbound-E-Mail-Adresse an (`20260224120000_email_ingestion_tables.sql:121-139`) |
| DB-Änderungen | `auth.users`, `profiles`, `user_roles` (role=recruiter), `recruiter_inbound_addresses` |
| Benachrichtigungen | keine (nur Toast) |
| Berechtigungen | Rollen-Härtung nachgewiesen (Self-Service-Admin ausgeschlossen) |
| Fehler-/Abbruchfälle | „already registered"-Toast (`Auth.tsx:99-101`); keine erzwungene E-Mail-Verifikation im Code nachweisbar (Supabase-Projekt-Setting, aus Repo nicht bewertbar) |
| Audit-Log | keines |
| **Abbruchstelle** | Keine harte. Aber: Recruiter landet nach Signup direkt auf `/recruiter` — nur Clients werden aktiv ins Onboarding geleitet (`Auth.tsx:46-49`). Der Recruiter muss den Onboarding-Banner selbst finden. |
| Reifegrad | **4** |

## WF-002 · Recruiter wird „verifiziert"

| Aspekt | Befund |
|---|---|
| Auslöser | Banner auf Dashboard (`RecruiterVerificationBanner`, gemountet ausschließlich in `src/pages/recruiter/RecruiterDashboard.tsx:566`) → `/recruiter/onboarding` (`src/App.tsx:451`) |
| Rolle | recruiter (Selbstbedienung) |
| UI-Schritte | 6-Schritte-Wizard `src/pages/onboarding/RecruiterOnboarding.tsx:30-139`: Willkommen → AGB → NDA → Rahmenvertrag (Text-„Unterschrift") → Profil (Firma, Steuer-Nr., IBAN) → Fertig |
| Backend | **kein Backend-Schritt.** Alle Updates laufen als direkte Client-Writes auf `recruiter_verifications` (`src/hooks/useRecruiterVerification.ts:89-215`) |
| DB-Änderungen | `recruiter_verifications`: Flags + Zeitstempel; `completeProfile` setzt **selbst** `verification_status='verified'` und `verified_at` (`useRecruiterVerification.ts:195-203`) |
| Benachrichtigungen | keine; kein Admin wird informiert |
| Berechtigungen | RLS erlaubt dem Recruiter UPDATE auf die eigene Zeile **ohne Spaltenschutz** (`20251211164340_c70c5f66…sql:60-63`) — d. h. auch `verification_status` direkt via API setzbar |
| Fehler-/Abbruchfälle | Toast bei fehlenden Feldern; keine IBAN-/USt-ID-Validierung, keine Dokumentenprüfung |
| Audit-Log | nur Zeitstempel in der Zeile selbst; `digital_signature` ist ein freies Textfeld |
| **Abbruchstelle** | Der Prozess „bricht" nicht ab — er ist **wirkungslos**: `canSubmitCandidates`/`isFullyVerified` werden außer im Banner **nirgends** durchgesetzt (kein Gate in `CandidateSubmitForm.tsx`, keine RLS-Kopplung an `submissions`). Ein Recruiter kann ohne einen einzigen Onboarding-Klick Kandidaten einreichen. Zudem: `verification_status: 'in_review'` existiert im Typ, aber kein Review-Prozess/Admin-UI setzt ihn. |
| Reifegrad | **2** · Status: VORHANDEN_ABER_UNVOLLSTÄNDIG + SICHERHEITSRISIKO (Selbst-Verifizierung; IBAN/Steuer-ID im Klartext clientseitig geschrieben/gelesen) |

## WF-003 · Academy / Zertifizierung

| Aspekt | Befund |
|---|---|
| Auslöser | Aufruf der Akademie-Subdomain: Host-Split `akademie.*` bzw. Dev-Port :8081 → `AcademyApp` (`src/main.tsx:6-26`) |
| Rolle | eigener Academy-Nutzer (`academy_profiles.user_id` → `auth.users`, `20260616130000_academy_foundation.sql:15-24`) |
| UI-Schritte | `src/academy/` (App, Pages, Components); Admin-Pflege: `/admin/academy` (`src/App.tsx:414-419`, `AdminAcademy.tsx`, `AdminAcademyCourse.tsx`) |
| Backend | Tabellen `academy_profiles/-courses/-modules/-lessons/-enrollments/-lesson_progress` (`20260616130000`), Seed-Content (`20260616140000_academy_seed_content.sql`) |
| DB-Änderungen | Enrollment/Progress-Zeilen |
| **Verbindung zum Recruiter-Zugang** | **nicht verbunden.** `grep academy` über `src/pages/recruiter/`, `src/components/recruiter/`, `src/hooks/` liefert 0 Treffer. Kein Zertifikat, kein Einfluss auf `recruiter_verifications`, `recruiter_trust_levels` oder Job-Zugriff. |
| Fehler-/Abbruchfälle | Deploy-Status der Migration aus Repo nicht bewertbar (Memory: nicht angewandt) |
| **Abbruchstelle** | Zwischen Academy-Abschluss und Plattform-Privilegien existiert keinerlei Brücke — als „Zertifizierungsprozess für Recruiter" endet der Ablauf im Nichts. |
| Reifegrad | **2** (als LMS begonnen; als Recruiter-Zertifizierung 0) |

## WF-004 · Agency-/Organisationszuordnung

| Aspekt | Befund |
|---|---|
| Auslöser | Team-Verwaltung `/dashboard/team` — **nur für Rolle client** (`src/App.tsx:230-234`) |
| Backend | `organizations` (type: 'client' **oder 'agency'**, `20251204231510…sql:9-21`), `organization_members`, `organization_invites`; Edge Functions `organization-invite` (Admin-Check `index.ts:89-101`, Token nur als SHA-256-Hash gespeichert `index.ts:150-168`), `accept-invite` (Modus A eingeloggt / Modus B Konto-Neuanlage, Single-Use, `index.ts:42-177`), `validate-invite`; Annahme-Seite `/invite/:token` (`src/App.tsx:473`) |
| Berechtigungen | sauber: nur Org-Owner/Admin lädt ein; E-Mail-Match bei Annahme; Job-Scoping via `job_collaborators` (`accept-invite/index.ts:156-171`) |
| **Recruiter-Sicht** | Der `type='agency'`-Zweig ist **totes Schema**: kein Recruiter-Screen, kein Hook, keine Route bindet einen Recruiter an eine Organisation (`grep organization src/pages/recruiter/*.tsx` = 0 Treffer). Recruiter arbeiten ausschließlich als Einzelkämpfer. |
| **Abbruchstelle** | Für Recruiter beginnt der Prozess gar nicht erst — es gibt keinen Einstiegspunkt. |
| Reifegrad | Client-Team: **4** · Recruiter-Agency: **0** (NICHT_VORHANDEN aus Recruiter-Sicht; Backend-Schema vorhanden) |

## WF-005 · Job-Zugriff / Mandat annehmen (Aktivierung)

| Aspekt | Befund |
|---|---|
| Auslöser | Recruiter öffnet `/recruiter/jobs` |
| UI-Schritte | `RecruiterJobs.tsx:283-285` lädt Jobs **direkt aus `jobs`** mit `.eq('status','published')`; Karte `JobActionCard.tsx` („Ich suche", Z. 205-227), Bestätigung `ActivationConfirmDialog.tsx:101-114` (Checkbox + Firmen-Reveal im Success-Step Z. 238-331), Slot-Limit-Dialog `RecruiterJobs.tsx:365` |
| Backend | Client-Insert in `recruiter_job_activations` (`useJobActivation.ts:64-113`); DB-Trigger: `on_job_activation` (Zähler, `20260302160000:271-300`), `check_bulk_activation` (>5/h → `fraud_signals`, Z. 302-343); `mark_activation_submitted` bei erster Submission (Z. 113-149) |
| DB-Änderungen | `recruiter_job_activations` (UNIQUE recruiter+job), `recruiter_trust_levels` (Zähler), ggf. `fraud_signals` |
| Benachrichtigungen | keine (weder Client noch Admin erfahren von der Aktivierung) |
| Berechtigungen | RLS-Insert prüft nur `auth.uid() = recruiter_id` (`20260302160000:75-77`). **Kein** serverseitiger Check auf `max_active_slots` oder `trust_level='suspended'` — das Slot-Limit ist reine UI-Logik (`RecruiterJobs.tsx:365`); ein suspendierter Recruiter kann per API weiter aktivieren und einreichen. |
| Fehler-/Abbruchfälle | Duplikat → Fehlermeldung (`useJobActivation.ts:79-83`); **kritisch:** bei jedem anderen DB-Fehler meldet der Hook trotzdem `success:true` und zeigt die Firma („Fallback for preview/dev", `useJobActivation.ts:99-113`) — der Recruiter glaubt aktiviert zu sein, die DB weiß nichts davon. |
| Triple-Blind | `jobs`-Query liefert `company_name` bereits **vor** Aktivierung an den Browser (`RecruiterJobs.tsx:283`, `JobActionCard`-Props Z. 31); die Anonymisierung (`formatAnonymousCompany`) ist kosmetisch. Die dafür gebaute `recruiter_jobs_view` (`20260608121000:156-193`) wird von der Seite **nicht verwendet** → nicht verbunden. |
| Audit-Log | `activated_at`, `trust_level_at` in der Aktivierungszeile |
| **Abbruchstelle** | Prozess funktioniert Happy-Path; bricht integritätsseitig: (a) Fake-Success bei DB-Fehler, (b) Slot/Suspend-Gate nur clientseitig, (c) Firmenname leakt vor Reveal. |
| Reifegrad | **3** · SICHERHEITSRISIKO HOCH |

## WF-006 · Kandidatenimport per Formular/CV

| Aspekt | Befund |
|---|---|
| Auslöser | „Kandidat einreichen" im Job (`CandidateSubmitForm`) oder Kandidaten-Anlage |
| UI-Schritte | `CandidateSubmitForm.tsx:548-745` (Formular), CV-Text-Parser Z. 574-610, Datei-Upload (`FileUpload`, `.pdf/.doc/.docx`, 10 MB, Z. 655-662) |
| Backend | `parse-cv` (Text → strukturierte Felder via Lovable-AI, `verify_jwt=true`, `parse-cv/index.ts`), `parse-pdf` (Upload-Extraktion) — beide über `useCvParsing.ts:149,179` |
| DB-Änderungen | `candidates` (Insert mit `recruiter_id`, `CandidateSubmitForm.tsx:388-408`) |
| Fehler-/Abbruchfälle | Parser-Fehler → Toast; kein Feld-Mapping-Review |
| **Abbruchstelle** | keine harte; Schwäche: Skills-Matching gegen Must-haves ist eine hartkodierte Keyword-/Synonymliste im Frontend (`CandidateSubmitForm.tsx:206-259`) statt der zentralen `normalize-skills`-Function → doppelte, divergierende Logik. |
| Reifegrad | **4** |

## WF-007 · Kandidatenimport per E-Mail

| Aspekt | Befund |
|---|---|
| Auslöser | Recruiter leitet CV-Mail an persönliche Adresse `r_<8 Zeichen>@inbound.matchunt.ai` weiter (Dialog `RecruiterDashboard.tsx:1028-1070`, Adresse clientseitig berechnet Z. 514-517; identische Ableitung serverseitig geseedet + Trigger `20260224120000:111-139`) |
| Backend | Webhook `process-candidate-email` (`verify_jwt=false`, config.toml): Adresse → `recruiter_inbound_addresses`-Lookup, Idempotenz via `message_id`, Rate-Limit (429), Attachment-Upload nach `email-imports/…`, Insert `candidate_import_jobs` (status pending), dann Fire-and-forget-Aufruf `process-candidate-import` (`index.ts:241`); dieser klassifiziert per KI (new_candidate/update/notes/multi/unprocessable) und legt `candidates`/`candidate_notes` an (`process-candidate-import/index.ts`, 902 Z.) |
| DB-Änderungen | `candidate_import_jobs` (Statusmaschine pending→…→completed/failed/needs_review), `candidates`, `candidate_notes` (source='email') |
| Benachrichtigungen | keine an den Recruiter über Erfolg/Fehlschlag nachweisbar |
| Berechtigungen | RLS: Recruiter liest nur eigene Import-Jobs (`20260224120000:80-86`) — aber: **kein Frontend liest sie** (`grep candidate_import_jobs src` = nur types.ts) |
| Fehler-/Abbruchfälle | Unbekannte Adresse → 404; deaktivierte Adresse → 403 |
| **Abbruchstellen** | (1) **Webhook ungeschützt:** keine Signaturprüfung (Mailgun/Resend-HMAC fehlt komplett in `process-candidate-email/index.ts`) — jeder, der die URL kennt, kann per POST beliebige „Kandidaten" in fremde Recruiter-Pools injizieren (Adresse aus User-ID ableitbar). (2) **Kein UI:** Status `needs_review`/`failed` ist für den Recruiter unsichtbar — fehlgeschlagene Importe verschwinden lautlos. (3) Externes E-Mail-Routing (Mailgun-Route → Function-URL) aus Repo nicht verifizierbar. |
| Reifegrad | **3** (Backend) / UI **1** · SICHERHEITSRISIKO HOCH |

## WF-008 · Kandidatenimport aus HubSpot

| Aspekt | Befund |
|---|---|
| Auslöser | `/recruiter/integrations` → HubSpot verbinden (OAuth, `RecruiterIntegrations.tsx:57-65` → `oauth-connect` mit PKCE/State, `oauth-callback`); Import-Dialog auf Dashboard und `/recruiter/candidates` (`HubSpotImportDialog`, gemountet `RecruiterDashboard.tsx:1020`, `RecruiterCandidates.tsx:390`) |
| Backend | `hubspot-sync` (`verify_jwt=true`, Auth-Check `index.ts:31-54`): `fetch_contacts` (Token aus `recruiter_integrations`, Refresh/Expiry-Handling Z. 83-105), `import_contact` → Insert `candidates` + Activity-Log (Z. 140-185) |
| DB-Änderungen | `recruiter_integrations`, `candidates`, Activity-Tabelle |
| Fehler-/Abbruchfälle | 401 → Integration als `expired` markiert; **ohne Verbindung liefert die Function Demo-Kontakte** (`index.ts:66-77`) — Gefahr, dass Demo-Personen als echte Kandidaten importiert werden |
| **Abbruchstelle** | funktioniert, sofern HubSpot-OAuth-Credentials im Projekt konfiguriert sind (aus Repo nicht verifizierbar); Demo-Fallback ist im UI nicht klar genug abgegrenzt |
| Reifegrad | **3** |

## WF-009 · Duplikat-/Konflikt-Erkennung

| Aspekt | Befund |
|---|---|
| Vorab-Check im Formular | `CandidateSubmitForm.tsx:179-203` prüft E-Mail gegen Submissions **desselben Jobs** — unter RLS sieht der Recruiter aber nur *eigene* Submissions (`20251204171610:210-211`) → Cross-Recruiter-Duplikate werden clientseitig **nie** erkannt |
| Serverseitig | `UNIQUE(job_id, candidate_id)` auf submissions (`20251204171610:87`) — greift nur, wenn es derselbe `candidates`-Datensatz ist; da jeder Recruiter eigene Kandidaten-Zeilen anlegt, blockt das Cross-Recruiter-Doppeleinreichungen **nicht** |
| Edge Function | `detect-candidate-conflicts` (same_client/same_industry/critical_stage → `candidate_conflicts` + Notification, `index.ts:56-133`) — **verwaist:** die Hooks `useCandidateConflicts`/`useDetectConflicts`/`useResolveConflict` (`src/hooks/useCandidateConflicts.ts`) werden von keiner Komponente importiert |
| Fraud-Pfad | `fraud-detection` trigger `candidate_submission` erkennt `duplicate_candidate` (`fraud-detection/index.ts:150-200`) — wird aber nirgends automatisch nach Submission aufgerufen (einziger Konsument: Admin-Hook `useFraudSignals`, `AdminFraud.tsx:42`) |
| **Abbruchstelle** | Der fachlich entscheidende Fall — *zwei Recruiter reichen denselben Menschen beim selben Kunden ein* — wird von keinem aktiven Pfad verhindert oder auch nur angezeigt. Ownership-Streit ist vorprogrammiert und unentscheidbar (kein First-Submit-Timestamp-Vergleich im UI). |
| Reifegrad | **2** · Status: BACKEND_VORHANDEN_UI_FEHLT |

## WF-010 · Kandidatenqualifizierung (Screening/Pflichtfelder)

| Aspekt | Befund |
|---|---|
| Readiness-Modell | `useExposeReadiness.ts:44-60`: 12 Checks (Stammdaten, ≥3 Skills, Erfahrung, CV-Summary/-Bullets, Gehalt, Verfügbarkeit, Wechselmotivation) |
| Durchsetzung | Gate in `CandidateSubmitForm.tsx:369-377` + Button-Disable Z. 810-815 — **aber nur für bestehende Kandidaten** (`selectedCandidate`). Der Zweig „Neuen Kandidaten anlegen" umgeht das Gate vollständig (nur Name+E-Mail required, Z. 612-633; Hinweistext Z. 551-558 räumt das offen ein). |
| Interview-Notizen | `candidate_interview_notes` (u. a. `change_motivation`, gelesen in `CandidateSubmitForm.tsx:327-333`); KI-Auswertung `process-interview-notes` → `candidate_ai_assessment` (Upsert, `index.ts:124-148`) — Function hat **keinerlei Auth-Prüfung** im Code (Aufrufer-Identität wird nicht verifiziert; `verify_jwt=true` verlangt nur irgendein gültiges JWT) |
| **Abbruchstelle** | Qualitäts-Gate existiert, ist aber über den „Neu anlegen"-Pfad trivial umgehbar → Kunde kann halbleere Profile erhalten. |
| Reifegrad | **3** |

## WF-011 · Consent-Einholung (Kandidat)

| Aspekt | Befund |
|---|---|
| Bei Einreichung | GDPR-Checkbox des **Recruiters** (Behauptung der Einwilligung), gespeichert als `submissions.consent_confirmed/-_at` (`CandidateSubmitForm.tsx:788-816, 429-431`) — reine Selbstauskunft, UI-seitig erzwungen, serverseitig nicht (Insert ohne Checkbox via API möglich) |
| Beim Interview-Opt-In | Kandidaten-Antwortseite verlangt aktive Zustimmung: `process-interview-response/index.ts:129-131` wirft ohne `consentGiven=true`; Protokoll in `submissions.consent_meta` (source, text_version, consented_at — `index.ts:166-180`, Spalte aus `20260710100000:26-30`) |
| Trigger-Ableitung | `sync_identity_unlock_with_stage` setzt `consent_confirmed=true` bei Stage-Übergang und markiert ehrlich `source='stage_transition'` (`20260710100000:32-61`) |
| `useConsent` / `consents`-Tabelle | betrifft **Cookie-/Plattform-Consents des eingeloggten Nutzers**, nicht Kandidaten (`src/hooks/useConsent.ts:5, 57-61`) — für diesen Workflow irrelevant; eine Tabelle `candidate_consents` ist **nicht auffindbar** (grep über alle Migrationen) |
| **Abbruchstelle** | Es gibt keinen Pfad, auf dem der **Kandidat selbst** vor der Ersteinreichung irgendetwas bestätigt (keine Kandidaten-E-Mail bei Submission). Das erste echte Kandidaten-Consent-Ereignis ist das Interview-Opt-In. |
| Reifegrad | **3** |

## WF-012 · Submission einreichen

| Aspekt | Befund |
|---|---|
| Auslöser | Formular-Submit (`CandidateSubmitForm.tsx:356-471`) |
| Backend | **kein Edge-Function-Pfad** — direkter Client-Insert in `submissions` (Z. 422-434, status='submitted'); danach Frontend-Invoke `calculate-match-v3-1` (`useMatchScoreV31.ts:131`) |
| DB-Trigger (AFTER INSERT) | `mark_activation_submitted` (Aktivierungs-/Trust-Zähler, `20260302160000:113-149`), Fit-Assessment-Trigger (`20260307000000:33`), `sync_identity_unlock_with_stage` (BEFORE, Reveal-Invariante) |
| Serverseitige Prüfungen | nur `UNIQUE(job_id,candidate_id)` und RLS `auth.uid()=recruiter_id`. **Nicht geprüft:** Verifizierungsstatus (WF-002), Aktivierung des Jobs (Submission ohne „Ich suche" möglich), Consent, Cross-Recruiter-Duplikat, Trust-Suspendierung, Job-Status (Einreichung auf geschlossene Jobs nur durch UI verhindert) |
| Benachrichtigungen | keine an den Client bei neuer Submission nachweisbar (nur Match-Score-Toast an den Recruiter) |
| Fehler-/Abbruchfälle | DB-Fehler → Toast; Match-Score-Fehler wird geschluckt (Z. 451-455) |
| Audit-Log | `submissions_activity_log`-Trigger (`20251212185019:53-55`) |
| **Abbruchstelle** | Happy-Path funktioniert. Governance-Bruch: sämtliche Geschäftsregeln (Verifizierung, Aktivierung, Consent) sind UI-Konventionen ohne Server-Durchsetzung. |
| Reifegrad | **3** |

## WF-013 · Matchunt-Review der Submission

| Aspekt | Befund |
|---|---|
| Erwartung | Plattform prüft Submission, bevor der Kunde sie sieht |
| Befund | **nicht vorhanden.** RLS zeigt dem Client jede Submission seines Jobs sofort (`20251204171610:213-216`); kein Zwischenstatus (submitted → direkt sichtbar), kein Admin-Freigabe-Screen (AdminCandidates listet nur, `AdminCandidates.tsx:127-135`). `'screening'` ist eine **Kunden**-Stage (`SubmissionsFunnelGrid.tsx:18`), kein Matchunt-Review. Einzig `fraud-detection` könnte blocken (`status='blocked'`, `index.ts:517-546`) — wird aber nicht automatisch aufgerufen. |
| **Abbruchstelle** | Prozess existiert nicht; Qualitäts-/Blindheitskontrolle vor Kundenkontakt fehlt vollständig. |
| Reifegrad | **0** · Status: NICHT_VORHANDEN |

## WF-014 · Kunde sieht anonymes Profil → Interview-Einladung

| Aspekt | Befund |
|---|---|
| Auslöser | Client wählt Kandidat, startet `ProfessionalInterviewWizard` (`src/components/dialogs/interview-wizard/ProfessionalInterviewWizard.tsx:51` → invoke `send-interview-invitation`) |
| Backend | `send-interview-invitation` (`verify_jwt=true` + echte Autorisierung `canUserActOnJob`, `index.ts:182-229`): erzeugt `interviews`-Zeile (status `pending_response`, `pending_opt_in=true`, Z. 238-254), setzt Submission auf `stage='interview_requested'`/`status='interview'` (Z. 262-268), E-Mail an Kandidat via Resend mit Accept/Counter/Decline-Links (Fehler werden erfasst, Z. 283-326), `influence_alert` „Opt-In einholen" für den Recruiter (Z. 344-354), Notification an Recruiter (Z. 329-341) |
| Tokens | `response_token` = 32 Zeichen aus **`Math.random()`** (`index.ts:29-36`) — nicht kryptografisch sicher; Token schaltet später den Identitäts-Reveal frei |
| Kandidaten-Seite | `/interview/respond/:token` lädt Daten über `get-interview-by-token` (`verify_jwt=false`, Service-Role, bewusst ohne Kandidaten-PII; Firmenname bewusst enthalten — `index.ts:9-19`) |
| Fehler-/Abbruchfälle | fehlender RESEND_API_KEY oder fehlende Kandidaten-E-Mail → `emailSent:false` mit Fehlertext im Response (Z. 286-295) |
| Alt-Pfad | `InterviewRequestWithOptInDialog` (Geister-Anfragen in `client_notes`) — per Migration `20260710101000` in echte Interviews überführt |
| **Abbruchstelle** | Wenn die Einladungs-E-Mail scheitert, hängt der Prozess: Es gibt keinen Retry und keine Recruiter-Aktion „Link manuell teilen" im Recruiter-UI (der Token wird dem Client-Aufrufer zurückgegeben, nicht dem Recruiter). |
| Reifegrad | **3** |

## WF-015 · Opt-in / Offenlegung der Identität

| Aspekt | Befund |
|---|---|
| Regulärer Pfad | Kandidat akzeptiert Slot + Consent-Checkbox → `process-interview-response` (`verify_jwt=false`, Token-Lookup `index.ts:85-108`, Doppelverarbeitung blockiert Z. 111-113): Interview `scheduled`, Submission `stage='interview_scheduled'` + `identity_unlocked/company_revealed/full_access_granted/consent_*` (Z. 137-180); E-Mails an Kandidat, Recruiter und **Client inkl. voller PII** (Z. 242-287); Notifications (Z. 291-306) |
| Invariante | DB-Trigger `sync_identity_unlock_with_stage`: Opt-In-Stufen ⇒ `identity_unlocked=true`, nie Rollback (`20260616150000:24-51`, gehärtet `20260710100000:32-61` — 'interview' entfernt) |
| Sichtbarkeits-Gates | `client_interviews_view` liefert Namen nur nach Reveal; `candidates`-RLS für Clients nur nach Reveal (`20260710090000:37-85`) |
| Recruiter-Handpfad | `SubmissionDetail.tsx:264-281`: Recruiter klickt „Opt-In bestätigt" → setzt `stage='candidate_opted_in'` per Client-Update → Trigger revealt Identität mit `consent_meta.source='stage_transition'` — **Reveal ohne jede Kandidaten-Aktion möglich** (bewusste Produktentscheidung lt. Migrationskommentar, bleibt aber DSGVO-Restrisiko) |
| Counter/Decline | `counter` → status `counter_proposed` + Stage `interview_counter_proposed`; es gibt jedoch **keinen nachweisbaren Client-Flow, der Counter-Slots annimmt** (kein Aufrufer, der aus `counter_proposed` wieder `pending_response`/`scheduled` macht — nicht auffindbar in src) → Gegenvorschlag ist eine Sackgasse, die nur per manueller Neu-Einladung auflösbar ist |
| **Abbruchstelle** | Counter-Proposal-Sackgasse; schwacher Token (WF-014); Handpfad-Consent |
| Reifegrad | **3** |

## WF-016 · Interview terminiert → Feedback

| Aspekt | Befund |
|---|---|
| Terminierung | via WF-015 (`scheduled_at` gesetzt) oder Legacy `schedule-interview` (`generate-slots`/`select-slot`, `index.ts:59-247`) |
| Sicherheitsloch Legacy | `schedule-interview` prüft **keinerlei Aufrufer-Identität** (Service-Role, kein `getUser`, `index.ts:14-57`): jeder eingeloggte Nutzer kann mit geratener/bekannter `interview_id` Slots generieren, No-Shows melden (`report-no-show`), Teilnahme bestätigen; `select-slot` setzt zudem `full_access_granted=true` (Z. 218-231) |
| Erinnerungen | `send-reminders` (24h/1h, Z. 270-328) — **kein Aufrufer nachweisbar**: kein `cron.schedule` dafür (einzige Crons: influence/escalation/score/cleanup, `20260225200000:136-195`) → Reminder laufen nie |
| Feedback | Tabelle `interview_feedback` + Hook `useInterviewFeedback` + `FeedbackFormDialog`/`FeedbackSummaryCard` existieren — **beide Komponenten werden nirgends gemountet** (grep = nur Eigen-Definition) → es gibt keinen Weg, nach dem Interview strukturiertes Feedback zu erfassen |
| Recruiter-Interview-Notizen | `process-interview-notes` → `candidate_ai_assessment` (WF-010) — das ist Recruiter-Screening, kein Kunden-Feedback |
| **Abbruchstelle** | Nach dem Interview reißt der Prozess ab: kein Feedback-Formular erreichbar, keine automatische Statusfortschreibung `scheduled → completed`, keine Erinnerungen. Der Recruiter erfährt das Ergebnis nur außerhalb des Systems. |
| Reifegrad | **2** · Status: VORHANDEN_ABER_UNVOLLSTÄNDIG + SICHERHEITSRISIKO (Legacy-Function) |

## WF-017 · Offer → Hire

| Aspekt | Befund |
|---|---|
| Auslöser | Client erstellt Angebot: `create-offer` (`verify_jwt=true`; Owner-Check `submission.jobs.client_id !== user.id` → **nicht Team-fähig**: Org-Admins/HR desselben Kunden scheitern, `index.ts:75-78`) |
| Backend | `offers`-Insert (status draft, `access_token` 32 Zeichen via `Math.random()`, `index.ts:9-16`, Ablauf 7 Tage), `offer_events` 'created', Submission → `stage='offer_pending'`/`status='offer_extended'` (Z. 122-136); Versand: `send-offer` (Owner-Check, Resend-Mail mit `/offer/view/:token`, Offer → 'sent', `index.ts:53-129`) |
| Kandidat | öffentliche Seite `/offer/view/:token` (`src/App.tsx:472`, `ViewOffer.tsx`) → `process-offer-response` (`verify_jwt=false`, Token-Lookup, Expiry-/Status-Guards `index.ts:47-54`): view/accept/reject/counter_offer |
| Accept-Kaskade | Offer 'accepted' + Signatur; Submission `status/stage='placed'`; **`placements`-Insert** mit Fee-Berechnung: `total_fee = salary × fee_percentage (Default 20 %)`, `recruiter_payout = total_fee × recruiter_fee/fee`, `platform_fee` = Rest; `escrow_status='pending'`, `escrow_release_date = start + 90 Tage` (`process-offer-response/index.ts:118-144`); Notifications an Client + Recruiter mit Provisionshöhe (Z. 147-164) |
| Fehler-/Abbruchfälle | abgelaufen/bereits entschieden → Fehler; Verhandlungsrunden gezählt (Z. 209-243) |
| Audit-Log | `offer_events` je Schritt |
| **Abbruchstellen** | (a) Team-Clients können kein Offer erstellen (Owner-only-Check); (b) `Math.random()`-Token schützt Gehalts- und Vertragsdaten; (c) nach `counter_offer` gibt es keinen nachweisbaren Client-Flow, der das Angebot revidiert (kein `update-offer`-Function) — Verhandlung endet im UI-Nirwana; (d) kein Schritt erzeugt eine Rechnung (→ WF-018). |
| Reifegrad | **3** |

## WF-018 · Rechnung → Kundenzahlung → Escrow → Auszahlung

**Der Geldfluss ist an drei Stellen tot — der Headhunter kann derzeit auf der Plattform nicht bezahlt werden.**

| Schritt | Befund |
|---|---|
| 1. Rechnung erstellen | `invoices`-Tabelle existiert (`20251204182100:106-121`), aber **kein Code erzeugt Rechnungen** (`grep invoices .insert` über src + functions = 0 Treffer; `AdminInvoices.tsx` liest nur). **Abbruch #1.** |
| 2. Kunde zahlt | **keine Zahlungsauslösung im Repo** (kein `paymentIntents.create`, keine Checkout-Session). `stripe-webhooks` würde bei `payment_intent.succeeded` die Rechnung auf paid setzen und `placements.escrow_status='held'` (+90 Tage) — matcht aber über `stripe_payment_intent_id`, das nie gesetzt wird (`stripe-webhooks/index.ts:64-96`). **Abbruch #2.** Webhook selbst ist solide: fail-closed Signatur (Z. 26-37), Idempotenz über `payment_events` UNIQUE (Z. 41-60). |
| 3. Stripe-Onboarding Recruiter | funktioniert: `stripe-connect` create-account / account-link / account-status (`index.ts:66-206`), UI `RecruiterStripeOnboarding` auf `/recruiter/payouts` (`RecruiterPayouts.tsx:196`) |
| 4. Auszahlungsanfrage | `payout_requests`-RLS erlaubt Recruiter-Insert (`20251204195741:79-82`); Komponente `PayoutRequestCard` (Insert `PayoutRequestCard.tsx:55`) wird in `RecruiterPayouts.tsx:8` **importiert, aber nie gerendert** — der Recruiter hat keinen Button, um die Auszahlung anzufordern. **Abbruch #3.** |
| 5. Admin-Freigabe | funktioniert (sofern eine Anfrage existiert): `AdminPayoutApproval.tsx:112,136` → `process-payout` (Admin-Check `index.ts:44-55`, Stripe-Transfer Z. 115-123, Placement → paid/released Z. 138-145, Notification Z. 148-155; Reject-Pfad Z. 183-215) |
| 6. Escrow-Freigabe nach 90 Tagen | kein Automatismus (kein Cron); „Verfügbar" wird nur clientseitig aus dem Datum abgeleitet (`RecruiterPayouts.tsx:100-109`) |
| **Abbruchstelle (exakt)** | Kette bricht **zwischen Placement-Erstellung (WF-017) und Rechnung**: `placements` entsteht, dann passiert nichts mehr, bis ein Admin manuell in der DB eine Rechnung + Zahlung + Payout-Request fingiert. |
| Reifegrad | **2** · Status: FEHLERHAFT (End-to-End), Teilstücke einzeln funktionsfähig |

## WF-019 · Garantie/Ersatz, Ownership-Streit, Umgehung, Suspendierung

| Teilprozess | Befund |
|---|---|
| Garantie-/Ersatzfall | **nicht vorhanden.** Einziger Mechanismus: 90-Tage-Escrow-Datum (`process-offer-response/index.ts:129-133`) und `escrow_status`-Werte inkl. 'disputed'/'refunded' (`20251204195741:49`) — kein Code setzt 'disputed'/'refunded', kein Replacement-Workflow, keine Garantie-Tabelle (grep „garantie/guarantee/replacement" = 0 relevante Treffer) |
| Ownership-Streit | keine Entscheidungslogik; `candidate_conflicts` (same_client) wäre die Datenbasis, ist aber verwaist (WF-009) |
| Umgehungsversuch | `fraud-detection` mit Signalen duplicate/velocity/inconsistency/**circumvention**/IP/CV-Similarity, Risiko-Aggregation und Auto-Aktionen: critical → Submission `status='blocked'` + Admin-Notification, high → 'flagged' (`fraud-detection/index.ts:72-146, 510-556`); Aufruf **nur manuell** aus Admin-UI (`useFraudSignals` → `AdminFraud.tsx:42`); kein Trigger nach Submission |
| Suspendierung | `recalculate_trust_level`: confirmed critical fraud oder Bronze-Ratio < 0.2 → 'suspended', slots=0, kein Selbst-Downgrade (`20260302160000:196-247`); **aber:** keine Durchsetzung — weder Aktivierungs- noch Submissions-RLS prüfen `trust_level` (WF-005/012); `recalculate_all_trust_levels` ist „für Cron" gebaut, ein Cron existiert nicht (`20260225200000:136-195` enthält ihn nicht) |
| Risk-Report durch Recruiter | `RiskReportDialog.tsx` existiert, wird **nirgends importiert** → nicht erreichbar |
| **Abbruchstelle** | Das gesamte Schutzsystem ist eine Sammlung nicht verdrahteter Einzelteile: Erkennung manuell, Sanktion wirkungslos, Ersatzfall inexistent. |
| Reifegrad | **1-2** |

## WF-020 · GDPR-Löschung/-Export (Recruiter-Sicht)

| Aspekt | Befund |
|---|---|
| UI | `/recruiter/privacy` (`src/App.tsx:302-305`) → `RecruiterDataPrivacy.tsx` mit Tabs Einwilligungen (`ConsentManagement`), Export (`DataExportRequest`), Löschung (`DataDeletionRequest`) |
| Export | `gdpr-export` (`verify_jwt=true`, Auth `index.ts:19-38`): sammelt profile, candidates, submissions, invoices u. a., legt `data_export_requests` an, JSON in Storage `documents/gdpr-exports/`, signierte URL 7 Tage, E-Mail-Benachrichtigung (`index.ts:180-222`) |
| Löschung | `gdpr-deletion` (`verify_jwt=true`): request → confirm (Token) → `anonymizeUserData` → `auth.admin.deleteUser` (`index.ts:46-127`); Anonymisierung: profiles, **eigene candidates** (Name/E-Mail/Telefon/LinkedIn/cv_url), messages, stripe_accounts delete (`index.ts:158-175`) |
| Lücken | (a) CV-**Dateien** im Storage werden nicht gelöscht (nur `cv_url`-Spalte genullt); (b) Kandidaten-PII in `notifications`-Texten, `offers` (`candidate_signature`), `interviews`/E-Mail-Historie bleibt; (c) `consent`-Confirm-Token wird per JSON-Response zurückgegeben, nicht per E-Mail-Doppelbestätigung (Function gibt `request_id` zurück, das Frontend bestätigt direkt) — Zwei-Faktor-Charakter der Löschbestätigung fraglich; (d) kein Prozess für **Kandidaten**-GDPR-Anfragen (der Recruiter kann einen einzelnen Kandidaten nicht DSGVO-konform „vergessen") |
| **Abbruchstelle** | Für das eigene Konto durchlaufbar; für Kandidatendaten (das eigentliche DSGVO-Risiko des Headhunters) existiert kein Lösch-Workflow. |
| Reifegrad | **3** |

---

## Abschluss: Welche Kernprozesse kann ein Recruiter heute vollständig abschließen — und wo brechen sie ab?

| Kernprozess | End-to-End möglich? | Exakte Abbruchstelle |
|---|---|---|
| Registrieren + Onboarding | **Ja** | — (Onboarding ist aber wirkungslos, da nirgends durchgesetzt) |
| Mandat finden + aktivieren | **Ja** | Integritätsrisiko: Fake-Success in `useJobActivation.ts:100-113`; Firmenname leakt vor Aktivierung (`RecruiterJobs.tsx:283`) |
| Kandidat anlegen (Formular/CV/HubSpot) | **Ja** | — |
| Kandidat per E-Mail importieren | **Bedingt** | Kein UI für Import-Status (`candidate_import_jobs` ohne Frontend); externes Mail-Routing unverifizierbar; ungeschützter Webhook |
| Kandidat einreichen | **Ja** | Kein Server-Gate (Verifizierung/Aktivierung/Consent nur UI); kein Kunden-Alert bei Eingang |
| Opt-In + Interview | **Ja (Happy-Path)** | Counter-Proposal endet in Sackgasse (kein Annahme-Flow); Reminder laufen nie (kein Cron für `send-reminders`) |
| Interview-Feedback erhalten | **Nein** | `FeedbackFormDialog`/`FeedbackSummaryCard` nirgends gemountet — Feedback kann systemisch nicht erfasst werden |
| Offer → Placement | **Ja (Happy-Path)** | `create-offer/index.ts:75-78` sperrt Team-Clients aus; Counter-Offer ohne Fortsetzungspfad |
| **Bezahlt werden** | **Nein** | Dreifachbruch: keine Rechnungserstellung (kein Insert-Code für `invoices`) → keine Zahlungsauslösung (kein PaymentIntent/Checkout im Repo) → Payout-Request-UI nicht gerendert (`RecruiterPayouts.tsx:8` importiert, nie verwendet) |
| Schutz (Ownership/Garantie/Fraud) | **Nein** | Konflikt-Hooks ohne Konsument; fraud-detection nur manuell; Suspendierung ohne Durchsetzung; Garantiefall inexistent |
| GDPR (eigenes Konto) | **Ja** | Kandidaten-bezogene Löschung fehlt; Storage-CVs bleiben liegen |

**Kernaussage für den Headhunter:** Er kann heute suchen, einreichen und Interviews orchestrieren — aber er kann weder strukturiertes Kundenfeedback erhalten noch auch nur einen Euro über die Plattform abrechnen. Das wirtschaftliche Ende der Kette (Rechnung → Zahlung → Escrow → Auszahlung) ist der größte einzelne Baustopp des Produkts.

---

## Feature-Zeilen für Master-Matrix

| ID | Domäne | Bereich | Feature | Nutzerrolle | UI-Pfad | Frontend-Dateien | Backend | Tabellen | Status | Reifegrad | Sicherheitsrisiko | Beleg | Empfehlung |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| WF-001 | Recruiting-Prozesse | Onboarding | Registrierung mit Rollenwahl | recruiter | /auth | src/pages/Auth.tsx, src/lib/auth.tsx | supabase.auth.signUp + handle_new_user | auth.users, profiles, user_roles, recruiter_inbound_addresses | VORHANDEN_PRODUKTIV | 4 | NIEDRIG | Auth.tsx:96-109; 20260608120000:16-36 | Recruiter nach Signup aktiv nach /recruiter/onboarding leiten |
| WF-002 | Recruiting-Prozesse | Onboarding | Verifizierung (AGB/NDA/Vertrag/Profil) | recruiter | /recruiter/onboarding | RecruiterOnboarding.tsx, useRecruiterVerification.ts, RecruiterVerificationBanner.tsx | keines (Client-Writes) | recruiter_verifications | SICHERHEITSRISIKO | 2 | HOCH | useRecruiterVerification.ts:195-203; 20251211164340:60-63 | verification_status serverseitig schützen; Gate an submissions-RLS koppeln; Admin-Review bauen |
| WF-003 | Recruiting-Prozesse | Qualifikation | Academy/Zertifizierung | recruiter | akademie.* (Subdomain) | src/academy/, src/main.tsx | academy_*-Migrationen | academy_profiles, academy_courses, academy_enrollments | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | KEIN | main.tsx:6-26; 20260616130000; grep academy in recruiter-src = 0 | Zertifikat mit Trust-Level/Job-Zugang verbinden oder Scope klar trennen |
| WF-004 | Recruiting-Prozesse | Organisation | Agency-/Org-Zuordnung für Recruiter | recruiter | — (nur Client: /dashboard/team) | TeamManagement.tsx, AcceptInvite.tsx | organization-invite, accept-invite, validate-invite | organizations, organization_members, organization_invites, job_collaborators | NICHT_VORHANDEN | 0 | KEIN | App.tsx:230-234; 20251204231510:9-21 (type 'agency' ungenutzt) | Entscheiden: Agency-Feature bauen oder Schema-Zweig entfernen |
| WF-005 | Recruiting-Prozesse | Mandat | Job-Aktivierung (Trust-Gate) | recruiter | /recruiter/jobs | RecruiterJobs.tsx, JobActionCard.tsx, ActivationConfirmDialog.tsx, useJobActivation.ts | Trigger on_job_activation, check_bulk_activation | recruiter_job_activations, recruiter_trust_levels, fraud_signals | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | HOCH | useJobActivation.ts:100-113 (Fake-Success); RecruiterJobs.tsx:283 (company_name-Leak); 20260719120000:1-12 | Slot-/Suspend-Check als DB-Trigger; recruiter_jobs_view verwenden; Fallback-Success entfernen |
| WF-006 | Recruiting-Prozesse | Kandidaten | Import per Formular/CV-Parsing | recruiter | /recruiter/jobs/:id (Submit-Dialog) | CandidateSubmitForm.tsx, useCvParsing.ts | parse-cv, parse-pdf | candidates | VORHANDEN_PRODUKTIV | 4 | NIEDRIG | CandidateSubmitForm.tsx:388-408; useCvParsing.ts:149,179 | Frontend-Skill-Synonymliste durch normalize-skills ersetzen |
| WF-007 | Recruiting-Prozesse | Kandidaten | Import per E-Mail (Inbound) | recruiter | Dashboard-Dialog | RecruiterDashboard.tsx:514-517,1028-1070 | process-candidate-email, process-candidate-import | recruiter_inbound_addresses, candidate_import_jobs, candidates, candidate_notes | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | HOCH | process-candidate-email/index.ts (keine Signaturprüfung); grep candidate_import_jobs src = 0 UI | Webhook-Signatur (Mailgun-HMAC) prüfen; Import-Status-UI bauen |
| WF-008 | Recruiting-Prozesse | Kandidaten | HubSpot-Import (OAuth) | recruiter | /recruiter/integrations + Dialoge | RecruiterIntegrations.tsx, HubSpotImportDialog.tsx | oauth-connect, oauth-callback, hubspot-sync | recruiter_integrations, candidates | VORHANDEN_PRODUKTIV | 3 | NIEDRIG | HubSpotImportDialog.tsx:64,104; hubspot-sync/index.ts:56-133 | Demo-Daten-Fallback deutlich kennzeichnen/entfernen |
| WF-009 | Recruiting-Prozesse | Qualität | Duplikat-/Konflikt-Erkennung | recruiter/admin | — (nicht erreichbar) | useCandidateConflicts.ts (ohne Konsument) | detect-candidate-conflicts | candidate_conflicts, submissions | BACKEND_VORHANDEN_UI_FEHLT | 2 | MITTEL | Hooks ohne Import-Stelle; UNIQUE(job_id,candidate_id) 20251204171610:87 | Conflict-Check automatisch nach Submission triggern + UI in SubmissionDetail |
| WF-010 | Recruiting-Prozesse | Qualität | Kandidaten-Readiness/Screening | recruiter | Submit-Dialog, Kandidaten-Detail | useExposeReadiness.ts, CandidateSubmitForm.tsx | process-interview-notes | candidates, candidate_interview_notes, candidate_ai_assessment | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | MITTEL | Gate nur für Bestandskandidaten (CandidateSubmitForm.tsx:369-377); Neu-Anlage umgeht es | Readiness-Gate auch für neue Kandidaten; Auth in process-interview-notes |
| WF-011 | Recruiting-Prozesse | Compliance | Consent-Einholung Kandidat | recruiter/candidate | Submit-Checkbox + /interview/respond/:token | CandidateSubmitForm.tsx:788-816 | process-interview-response | submissions (consent_confirmed, consent_meta) | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | MITTEL | process-interview-response:129-131; 20260710100000:32-61 | Kandidaten-Consent bereits bei Ersteinreichung einholen (Double-Opt-in-Mail) |
| WF-012 | Recruiting-Prozesse | Pipeline | Submission einreichen | recruiter | Job-Detail Submit | CandidateSubmitForm.tsx:422-434 | Trigger mark_activation_submitted, fit-assessment, sync_identity_unlock; calculate-match-v3-1 | submissions, recruiter_job_activations, candidate_fit_assessments | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | MITTEL | Kein Server-Gate (RLS 20251204171610:210-211); keine Client-Notification | Submission über Edge Function mit Regelprüfung leiten; Client benachrichtigen |
| WF-013 | Recruiting-Prozesse | Qualität | Matchunt-Review vor Kundensicht | admin | — | — | — (nur fraud-detection manuell) | submissions | NICHT_VORHANDEN | 0 | MITTEL | RLS 20251204171610:213-216 (Client sieht sofort) | Entscheiden: kuratierter Marktplatz (Review-Status) oder bewusst direkt |
| WF-014 | Recruiting-Prozesse | Interview | Interview-Einladung an Kandidat | client | Kandidaten-Detail (Client) | ProfessionalInterviewWizard.tsx | send-interview-invitation, get-interview-by-token | interviews, submissions, influence_alerts, notifications | VORHANDEN_PRODUKTIV | 3 | MITTEL | send-interview-invitation:29-36 (Math.random-Token), 182-229 (Auth ok) | crypto.getRandomValues für Tokens; Retry-/Link-teilen-Aktion für Recruiter |
| WF-015 | Recruiting-Prozesse | Interview | Opt-In & Identitäts-Reveal | candidate/recruiter | /interview/respond/:token; SubmissionDetail | SubmissionDetail.tsx:264-281 | process-interview-response; Trigger sync_identity_unlock_with_stage | submissions, interviews | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | MITTEL | 20260616150000:24-51; 20260710090000:37-85; Counter-Sackgasse (kein Annahme-Flow auffindbar) | Counter-Annahme-Flow bauen; Recruiter-Handpfad mit Nachweispflicht versehen |
| WF-016 | Recruiting-Prozesse | Interview | Termin, Reminder, Feedback | alle | /recruiter/interviews, ClientInterviews | RecruiterInterviews.tsx; FeedbackFormDialog.tsx (verwaist) | schedule-interview (ohne Auth!), send-reminders (ohne Cron) | interviews, interview_feedback | FEHLERHAFT | 2 | HOCH | schedule-interview/index.ts:14-57; FeedbackFormDialog ohne Mount; Cron-Liste 20260225200000:136-195 | schedule-interview absichern oder abschalten; Feedback-Dialog mounten; Reminder-Cron anlegen |
| WF-017 | Recruiting-Prozesse | Abschluss | Offer → Placement | client/candidate | /dashboard/offers, /offer/view/:token | ViewOffer.tsx, OfferAccepted.tsx | create-offer, send-offer, process-offer-response | offers, offer_events, submissions, placements | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | MITTEL | create-offer:75-78 (nicht Team-fähig); process-offer-response:118-144 (Placement+Fee) | canUserActOnJob auch in create-offer; Counter-Offer-Fortsetzung; sichere Tokens |
| WF-018 | Recruiting-Prozesse | Geld | Rechnung→Zahlung→Escrow→Payout | client/recruiter/admin | /recruiter/payouts, /admin/payouts | RecruiterPayouts.tsx, PayoutRequestCard.tsx (nicht gerendert), AdminPayoutApproval.tsx | stripe-connect, stripe-webhooks, process-payout; KEINE Invoice-/Payment-Erzeugung | invoices, placements, payout_requests, stripe_accounts, payment_events | FEHLERHAFT | 2 | HOCH | RecruiterPayouts.tsx:8 (Import ohne Render); grep paymentIntents.create = 0; stripe-webhooks:64-96 (toter Match) | P0: Invoice-Erzeugung bei Placement, Stripe-Checkout für Client, PayoutRequestCard mounten, Escrow-Release-Cron |
| WF-019 | Recruiting-Prozesse | Schutz | Garantie/Ownership/Fraud/Suspendierung | admin/recruiter | /admin/fraud | AdminFraud.tsx, useFraudSignals.ts; RiskReportDialog.tsx (verwaist) | fraud-detection (manuell), recalculate_trust_level (ohne Cron) | fraud_signals, candidate_conflicts, recruiter_trust_levels, user_behavior_scores | VORHANDEN_ABER_UNVOLLSTÄNDIG | 2 | HOCH | fraud-detection:510-556; 20260302160000:196-247; kein Enforcement in RLS | fraud-detection nach jeder Submission triggern; Suspend in RLS durchsetzen; Garantie-/Ersatzprozess definieren |
| WF-020 | Recruiting-Prozesse | Compliance | GDPR-Export/-Löschung | recruiter | /recruiter/privacy | RecruiterDataPrivacy.tsx, DataExportRequest, DataDeletionRequest | gdpr-export, gdpr-deletion | data_export_requests, data_deletion_requests, profiles, candidates | VORHANDEN_ABER_UNVOLLSTÄNDIG | 3 | MITTEL | gdpr-deletion:158-175 (Storage-CVs bleiben); kein Kandidaten-Löschworkflow | Storage-Bereinigung ergänzen; DSGVO-Löschung für einzelne Kandidaten bauen |
