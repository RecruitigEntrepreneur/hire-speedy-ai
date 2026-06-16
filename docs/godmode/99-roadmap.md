## 99. Roadmap zum Erfolg

> CTO-Sicht auf **Matchunt** (matchunt.ai). Aggregiert ALLE Reibungspunkte der Domaenen-Analysen 01-13 zu einem priorisierten Plan.
> Backend = Supabase `dngycrrhbnwdohbftpzq`, Frontend = Lovable (`7a26b296-…`), kanonisches Repo = `hire-speedy-ai`. Stand: 2026-06-08.
> Lesart: **P0 = jetzt** (Sicherheit, USP-Bruch, Production-Bug, Geldfluss tot). **P1 = Stabilitaet/Skalierung**. **P2 = Wachstum/Differenzierung**.

---

### 99.1 Management-Summary (der ehrliche Status)

Matchunt hat ein **vollstaendigeres Backend als Frontend** und ein **hoehes Marketing-Versprechen als Codebasis**. Drei Befunde dominieren alles andere:

1. **Der USP ist technisch nicht durchgesetzt.** "Triple-Blind" wird fast ausschliesslich **clientseitig** (Browser-JS, AI-Prompts) erzwungen, waehrend RLS Klardaten (Name, E-Mail, Telefon, Firmenname, Arbeitgeber-Historie) ungefiltert ausliefert. Jeder mit DevTools sieht PII vor dem Opt-In und Recruiter sehen Firmennamen vor dem Reveal. Das widerlegt die zentrale Verkaufsaussage und ist zugleich ein DSGVO-Risiko.
2. **Der Geldfluss ist halb gebaut.** Die Auszahlungsseite (Recruiter-Payout) ist konsistent, aber die **Einnahmeseite (Client → Plattform) existiert nicht im Code**: keine Invoice-/PaymentIntent-Erzeugung, daher springt `escrow_status` nie auf `held`, daher ist der regulaere Payout-Flow ohne manuelle DB-Eingriffe blockiert.
3. **Live haengt hinter Code haengt hinter Realitaet.** Der Lovable-Publish-Gap fuehrt dazu, dass Backend-Trigger und Cron-Jobs Features (Fit-Assessment, Task-Inbox, Trust-Gate) bereits **produktiv feuern und Kosten verursachen**, deren UI im publizierten matchunt.ai gar nicht existiert. Dazu ein verifizierter **React-Render-Loop** (`Maximum update depth exceeded`) im NotificationBell.

Dazu kommen mehrere **Privilege-Escalation-Pfade** (Signup als `admin`, Self-Insert in `user_roles`), **kaputte semantische Suche** (64-dim Vektoren in `vector(1536)`-Spalte) und **vier parallele Matching-Generationen** mit divergierenden Scores.

Die gute Nachricht: Nahezu jeder Befund ist **lokalisiert und mit klarem Fix** versehen. Die Architektur (Supabase + Edge Functions + RLS) ist tragfaehig; die Schulden sind Durchsetzungs- und Konsolidierungsschulden, keine Neubau-Schulden.

---

### 99.2 Konsolidiertes Reibungs- & Risiko-Register

Aggregiert aus 13 Domaenen, sortiert nach Severity, dann nach Blast-Radius. Severity-Legende: **C** = critical, **H** = high, **M** = medium, **L** = low. Spalte "Horizont" verweist auf den Roadmap-Block in 99.3.

#### CRITICAL

| # | Bereich | Problem (Kurz) | Empfehlung (Kurz) | Domaene | Horizont |
|---|---|---|---|---|---|
| C1 | RLS / Client-PII | `Clients can view candidates` gewaehrt SELECT auf ganze `candidates`-Row (Name/E-Mail/Telefon/CV) sobald eine Submission existiert — ohne `identity_unlocked`-Bedingung. PII per DevTools vor Opt-In sichtbar. | SECURITY-INVOKER-View liefert PII nur `WHEN identity_unlocked`; direkten `candidates`-SELECT der Client-Rolle entziehen. | triple-blind, data-model | **P0** |
| C2 | RLS / Recruiter-Firmenname | `Recruiters can view published jobs` liefert ganze `jobs`-Row inkl. `company_name`; nur Browser-Maskierung. Firmenblind per DevTools umgehbar. | Recruiter-Job-View ohne `company_name` (bzw. nur bei eigener `company_revealed`-Submission); direkten `jobs`-SELECT einschraenken. | triple-blind, data-model | **P0** |
| C3 | Privilege Escalation | `handle_new_user()` uebernimmt `raw_user_meta_data->>'role'` ungeprueft; Policy `Users can insert their own role` erlaubt Self-Insert `admin`. `signUp({role:'admin'})` ⇒ System-Admin. | Trigger auf `client`/`recruiter` whitelisten, `admin` ablehnen; Self-Insert-Policy entfernen bzw. `WITH CHECK (role <> 'admin')`. | auth-access | **P0** |
| C4 | Einnahmeseite / Stripe | Kein Code erzeugt `invoices`/PaymentIntent für Clients; `stripe_payment_intent_id` nie gesetzt ⇒ `escrow_status` nie `held` ⇒ Payout-Flow blockiert. | `create-invoice`/`stripe-checkout` EF, die bei Placement Invoice + PaymentIntent anlegt und `stripe_payment_intent_id` persistiert. | financials | **P0** |
| C5 | Embeddings / Vektorsuche | `generate-embeddings` schreibt 64-dim Gemini-Vektoren in `vector(1536)`-Spalte; HNSW-Index/RPCs erwarten 1536. Inserts schlagen fehl, semantische Suche tot. | Entscheiden: echtes 1536d-Modell ODER Schema/Index/RPCs auf `vector(64)`. Sonst Embedding-Fassade entfernen. | candidate-intake, matching-engine | **P0** |
| C6 | Triple-Blind / AI-Output | Anonymisierung in `generate-job-expose`/`format-job-for-recruiters` ist nur LLM-Prompt; keine deterministische Nachkontrolle, ob `company_name` doch im Output steht. Ein LLM-Fehler bricht den USP. | Serverseitiger Regex-Scrub von `company_name` (inkl. Rechtsformen/Varianten) über AI-Output vor `UPDATE jobs`; bei Treffer regenerieren/blocken. | job-lifecycle | **P0** |
| C7 | React / Render-Loop | Verifizierter `Maximum update depth exceeded`: instabile `user`-Ref aus `useAuth` × `useRealtimeNotifications`/`useInfluenceAlerts` + kollidierender Channel-Name + Bell doppelt gemountet. | Effekt-Deps auf `user?.id`; Context-Value `useMemo`; Channel-Name `notifications-${user.id}`. | frontend, automation-engines | **P0** |
| C8 | Theming / Tailwind | `darkMode: ['class', '.light']` invertiert alle 314 `dark:`-Varianten (52 Dateien) — sie greifen im FALSCHEN Modus. Strukturelle Wurzel der Theme-Inkonsistenz. | `darkMode: 'class'` + `.dark`-Klasse ODER alle `dark:`-Varianten raus, nur semantische Tokens. Beide Modi visuell testen. | frontend | **P0** |
| C9 | Automation / Render-Loop-Quelle | (= C7 aus Engine-Sicht) `useAuth` liefert instabile `user`-Ref; `NotificationBell` in Navbar UND DashboardLayout gemountet; Re-Subscribe→setState→Re-Render-Kaskade. | Wurzel-Fix in `useAuth` (memoisieren), siehe C7. Bell nur einmal mounten. | automation-engines | **P0** |

#### HIGH

| # | Bereich | Problem (Kurz) | Empfehlung (Kurz) | Domaene | Horizont |
|---|---|---|---|---|---|
| H1 | Deployment / Publish-Gap | Git-Push & Backend-Migration aktualisieren Live nicht; "Publish" ist manueller Klick. Backend feuert Features, deren UI fehlt. | Publish als festen Schritt (Checkliste/CI-Reminder); Versions-Badge im UI; Feature-Flags für noch-nicht-publizierte UI. | architecture, frontend | **P0** |
| H2 | Git / Backend-Ownership | Zwei Repos (`hire-speedy-ai` aktiv, `matchunt-platform` eingefroren) teilen DASSELBE Supabase-Projekt; kein Schutz gegen Migration aus eingefrorener Linie. | Kanonisches Repo dokumentieren; `matchunt-platform` entkoppeln/archivieren, Credentials entfernen; Migrationsstand angleichen. | architecture | **P0** |
| H3 | Secrets | `.env` ist im Git getrackt (enthaelt `VITE_SUPABASE_URL` + anon key). Schlechter Default; verschiebt Sicherheitsgewicht implizit auf RLS. | `.env` in `.gitignore`, aus Historie entfernen (filter-repo), Key rotieren, `.env.example` committen. | architecture | **P0** |
| H4 | RLS / Token-Policies | `offers`-Policy `Public can view offers by token` USING `(access_token IS NOT NULL)` filtert nicht auf konkreten Token ⇒ anonymer `select('*')` liefert ALLE Offers (Gehaelter/Signaturen). Gleiches bei `reference_requests`, `organization_invites`. | Auslieferung nur über SECURITY-DEFINER-RPC mit Token-Argument; public-select-Policies entfernen. | data-model, auth-access | **P0** |
| H5 | RLS / Funktionssignatur | `oauth_integrations.sql:101` ruft `has_role('admin', auth.uid())` mit vertauschten Argumenten ⇒ Policy greift nie; maskiert durch permissive `USING(true)`-Service-Policy (gewaehrt jedem Zugriff). | Argumente korrigieren `has_role(auth.uid(),'admin')` UND `USING(true)`-Policy auf `service_role` einschraenken. | data-model, auth-access, integrations | **P0** |
| H6 | Token-Sicherheit | `send-interview-invitation`/`send-offer`/`create-offer` erzeugen public Tokens via `Math.random()` (nicht kryptografisch). Portale zeigen Klarnamen/Gehalt ohne Login. | Durchgaengig `crypto.randomUUID()`/`getRandomValues()`; Tokens mit Ablauf + Single-Use-Invalidierung. | pipeline | **P0** |
| H7 | Triple-Blind / Reveal-Consent | `process-interview-response` (accept) setzt `full_access_granted` und mailt sofort Klarnamen/Telefon; Kandidaten-Opt-In/Consent ist separater manueller Schritt, hier nicht erzwungen. | Reveal an `consent_confirmed`/`opt_in_response` koppeln; Consent als harte Vorbedingung vor Client-Mailing. | pipeline, triple-blind | **P0** |
| H8 | Placement / Dualer Pfad | Placements an 3 Stellen: `process-offer-response` (korrekt+Fees), `ClientInterviews.tsx` (ohne Fees, RLS-Verletzung), `process-talent-hub-action` (nicht-existente Spalten). Kollidiert mit `UNIQUE(submission_id)`. | Auf einen kanonischen Pfad konsolidieren; fehlerhafte Inserts entfernen; vor Insert auf bestehendes Placement pruefen. | pipeline, financials | **P0** |
| H9 | Auszahlungs-Autorisierung | `payout_requests` clientseitig erzeugt; `process-payout` uebernimmt `amount` ungeprueft ⇒ Recruiter kann beliebigen Betrag anfordern. | Transfer-Betrag serverseitig aus `placement.recruiter_payout` ableiten; Escrow-Reife serverseitig verifizieren. | financials | **P0** |
| H10 | RLS / candidate_experiences | Clients duerfen `candidate_experiences` mit echten `company_name` lesen (z.B. "Siemens"); `CandidateExperienceTimeline` umgeht die AI-Anonymisierung ⇒ Re-Identifikation. | `company_name` in Client-View bis `identity_unlocked` auf NULL/Branche maskieren; Direktzugriff über View ersetzen. | triple-blind | **P0** |
| H11 | Trigger / Stufe-1-Reveal feuert nie | `reveal_company_on_opt_in` prueft `NEW.status`, alle Frontend-Pfade setzen aber `stage='candidate_opted_in'` ⇒ `company_revealed` wird im Normalfluss nie gesetzt. | Trigger auf `NEW.stage` umstellen ODER alle Schreibpfade auf `status` vereinheitlichen; mit Test absichern. | triple-blind | **P0** |
| H12 | Reveal-Flags / zwei Systeme | `identity_unlocked` (neu) vs. `identity_revealed` (alt, `process-talent-hub-action`). Talent-Hub-Pfad setzt nur `identity_revealed`, das die Client-View ignoriert ⇒ inkonsistenter Zustand. | Auf ein Flag (`identity_unlocked`) konsolidieren, Legacy migrieren, einheitlicher Reveal-Codepfad. | triple-blind | **P1** |
| H13 | Auth / Race Condition | `fetchUserRole` in `setTimeout(0)` nach `onAuthStateChange`, `loading` unabhaengig auf false ⇒ `role=null` bei gesetztem user ⇒ Fehl-Redirect aufs falsche Dashboard. | `loading` erst false wenn `role` geladen; `fetchUserRole` direkt awaiten, kombinierter Lade-Zustand. | auth-access, frontend | **P0** |
| H14 | Auth / Suspend wirkungslos | `user_roles.status='suspended'`/`verified` werden nirgends ausgewertet (weder ProtectedRoute noch RLS). Suspendierter User behaelt Vollzugriff. | `status`/`verified` in `fetchUserRole` mitladen + in ProtectedRoute erzwingen; `is_active()`-SECURITY-DEFINER in RLS. | auth-access | **P0** |
| H15 | Webhook-Sicherheit (Resend/Inbound) | `resend-webhooks` + beide Inbound-Functions: `verify_jwt=false`, keine Signaturpruefung. Gefaelschter POST kann Leads suppressen, Kampagnen pausieren. | Svix/HMAC-Signatur für `resend-webhooks`; Shared-Secret/Signatur für Inbound-Provider, vor jeder Mutation. | integrations | **P0** |
| H16 | E-Mail-Ingestion-Sicherheit | `process-candidate-email`/`-import` `verify_jwt=false`, keine Provider-Signatur. Wer URL + Inbound-Adresse kennt, kann Importe/Mails ausloesen. | Provider-HMAC oder geheimes Pfad-/Header-Token verifizieren, bevor Import-Job/Mail erzeugt wird. | candidate-intake, integrations | **P0** |
| H17 | E-Mail-Zustellbarkeit | `send-email` versendet als `onboarding@resend.dev` (Sandbox), andere Mailer nutzen `matchunt.ai`. Zentrale Transaktionsmails von nicht-verifizierter Domain. | Absender auf verifizierte `matchunt.ai`-Domain (SPF/DKIM/DMARC); From-Adresse projektweit zentralisieren. | integrations, pipeline | **P0** |
| H18 | ML-Trainingsschleife | `match_outcomes`/`ml_training_events`/Auto-Trigger existieren, aber keine Function/Cron konsumiert sie zur Neukalibrierung. "ML" = Datensammlung + manuelles Tuning. | Kalibrierungs-Cron (Schwellen/Gewichte aus Outcomes) ODER Domaene ehrlich als "Match-Analytics" benennen. | matching-engine | **P1** |
| H19 | Versions-Wildwuchs Matching | v1/v2/v3/v3.1 Edge + zweite clientseitige Logik (`useJobMatching`) gleichzeitig aktiv, divergierende Gewichte ⇒ gleiche Paarung, andere Scores je Komponente. | v3.1 als Single Source of Truth; v1/v2/v3 + clientseitiges Scoring deprecaten/entfernen. | matching-engine | **P1** |
| H20 | Score-Persistenz v3.1 | `calculate-match-v3-1` schreibt `match_score` NICHT zurück und inserted `match_outcomes` ohne `submission_id` ⇒ Feed-Score divergiert, Outcome nie zugeordnet. | v3.1 mit `submissionId` aufrufen, Prediction inkl. `submission_id` speichern; optional `match_score_v3` zurückschreiben. | matching-engine | **P1** |
| H21 | DB-GUCs nie gesetzt | Auto-Fit-Trigger + alle HTTP-Cron-Jobs lesen `app.settings.supabase_url`/`service_role_key`; in keiner Migration gesetzt ⇒ pg_net-Calls scheitern STILL (fire-and-forget). | Bootstrap-Migration `ALTER DATABASE SET` ODER Runbook; pg_net-Calls mit Fehler-Logging in Tabelle absichern; Smoke-Test. | data-model, fit-assessment, architecture, automation-engines | **P0** |
| H22 | Fit-Trigger / JWT-Konflikt | `config.toml` setzt `verify_jwt=true` für `assess-candidate-fit`, Auto-Trigger sendet Service-Role-Bearer (kein User-JWT) ⇒ fragil. | `verify_jwt=false` + Auth in der Function pruefen, ODER dedizierter interner Pfad/Secret. | fit-assessment | **P0** |
| H23 | Embedding-Queue Verarbeitung | `embedding_queue` nur manuell über Admin-Widget gedraint; kein Cron/Worker ⇒ ohne Admin bleibt alles `pending`. | pg_cron-Job (analog `unified_task_inbox`), ruft `generate-embeddings` im Batch mit Backoff. | candidate-intake | **P1** |
| H24 | DB-Migrationen / OAuth-Schema | Zwei Migrationen erstellen `oauth_states`/`recruiter_integrations` + gleichnamige Policies; `CREATE POLICY` ohne `IF NOT EXISTS` ⇒ Bruch bei Replay. | Eine Migration entfernen ODER `DROP POLICY IF EXISTS` + `CREATE`; gegen frische DB in CI testen. | integrations | **P1** |
| H25 | Parse-Schema-Divergenz | `parse-job-url` (27 flache Felder) vs. `parse-job-pdf` (anderes Schema, viele Felder hart `null`, kein Enrichment) ⇒ PDF/Text-Jobs systematisch datenaermer. | Beide Functions auf gemeinsames Ausgabe-Schema vereinheitlichen; Enrichment auch im PDF/Text-Pfad. | job-lifecycle | **P1** |
| H26 | Interview-Scheduling / 2 Systeme | `response_token` (`send-interview-invitation`) vs. `selection_token` (`schedule-interview`) schreiben dieselbe `interviews`-Tabelle mit divergenten Statuswerten/Slot-Schemata. | Auf einen Pfad konsolidieren; den anderen auf No-Show/Cancel reduzieren; Status-Strings vereinheitlichen. | pipeline | **P1** |
| H27 | State-Machine status vs. stage | `submissions` hat zwei unabhaengige Statusfelder; Schreiber setzen mal nur `status`, mal nur `stage`; UI liest `stage`, Outcome-Tracking liest `status` ⇒ Wahrheitsquellen driften. | `stage` als kanonische Wahrheit; alle Schreiber konsistent; `status` per Trigger aus `stage` ableiten. | pipeline | **P1** |
| H28 | Stripe-Webhook Idempotenz | `payment_events.insert` blind ohne `onConflict`/Processed-Check trotz UNIQUE ⇒ Retries = Unique-Violation/Doppelverarbeitung. `transfer.failed` ist kein gültiger Event-Typ ⇒ feuert nie. | Vorab `processed`-Check (Early-Return); `onConflict(stripe_event_id)`; `transfer.failed` → `transfer.reversed`/`payout.failed`. | financials | **P1** |
| H29 | Stripe-Webhook Forgery | `stripe-webhooks` verifiziert Signatur nur wenn `STRIPE_WEBHOOK_SECRET` gesetzt; sonst Fallback `JSON.parse` ohne Pruefung ⇒ Payment-Events faelschbar (service_role, verify_jwt=false). | Fallback entfernen: ohne Secret mit 500 abbrechen; Secret in Prod sicherstellen. | architecture, financials | **P0** |

#### MEDIUM

| # | Bereich | Problem (Kurz) | Empfehlung (Kurz) | Domaene | Horizont |
|---|---|---|---|---|---|
| M1 | RLS / permissive Policies | `recruiter_trust_levels`, `recruiter_job_activations`, `candidate_conflicts`, `integration_mappings` tragen `FOR ALL USING(true)` ⇒ Client koennte eigenen `trust_level=gold`/`max_active_slots` setzen. | Auf `service_role`-Policies umstellen ODER Writes nur über SECURITY-DEFINER; `authenticated` nur SELECT eigener Zeilen. | data-model | **P0** |
| M2 | DSGVO / Consent nie geschrieben | `consent_confirmed`/`consent_document_url` werden nirgends gesetzt; UI zeigt DSGVO-Checkbox, aber Kandidaten-Einwilligung wird nicht persistiert (Recruiter setzt `unlocked_by`). Kein Art-6/7-Nachweis. | Kandidaten-Einwilligung als eigenen Record/Dokument schreiben, ausgeloest durch Kandidaten-Aktion (Magic-Link). | triple-blind | **P0** |
| M3 | DSGVO / Loeschung unvollstaendig | `gdpr-deletion.anonymizeUserData` deckt nur Teilmenge der als personenbezogen gelisteten Tabellen ab (notifications, activity_logs, platform_events mit IP/UA, recruiter_notes, payout/invoice bleiben). | Loeschumfang an Export-Umfang angleichen; alle PII-Tabellen anonymisieren/loeschen (Art. 17). | automation-engines | **P1** |
| M4 | Edge-Function-Drift | Frontend ruft `analyze-interview`, `google-auth`, `microsoft-auth` — keine gleichnamigen Ordner ⇒ tote Calls, evtl. gebrochener OAuth-Login. `extract-intake-briefing` fehlt in `config.toml`. | Verifizieren ob nur in Lovable deployt/fehlend; nachziehen oder Calls entfernen; `extract-intake-briefing` explizit in `config.toml`. | architecture, frontend | **P0** |
| M5 | Typsicherheit | `strict:false`, `noImplicitAny:false`, `strictNullChecks:false` — waehrend CLAUDE.md "strict, keine any" verlangt. Realer Schutz schwaecher als dokumentiert. | `strict` schrittweise aktivieren (zuerst `strictNullChecks`); Doku/Config-Diskrepanz aufloesen. | architecture | **P1** |
| M6 | Datenintegritaet / Status-Felder | `submissions.status`/`.stage` (und `jobs`/`interviews`/`offers.status`) sind freie TEXT ohne CHECK; Triple-Blind-Trigger haengen an Magic-Strings ⇒ Tippfehler verhindert Reveal still. | Enum/CHECK für alle Status-/Stage-Felder; Uebergaenge in zentraler Funktion kapseln. | data-model | **P1** |
| M7 | Trigger / Auto-Fit-Kosten | AFTER-INSERT-Trigger feuert auf JEDEN Submission-Insert ohne Throttle; 15+ Functions schreiben `submissions` ⇒ kostenpflichtiger LLM-Call ungedrosselt. | Trigger auf relevante Status/Quellen (`WHEN`-Klausel) ODER Queue/Debounce. | fit-assessment | **P0** |
| M8 | Cron / Outreach-Scheduling | `process-outreach-queue` nur manuell aus Frontend getriggert; rescheduelte Mails ("morgen 09:00") werden nie automatisch verschickt. | pg_cron-Job (analog `unified_task_inbox`), triggert Queue alle 5-15 min via `net.http_post`. | integrations | **P1** |
| M9 | Inbound-Reply-Duplizierung | `process-inbound-email` (AI, relational) vs. `process-inbound-reply` (Keyword, JSONB, Suppression) ueberschneiden sich; unklar welche am Webhook haengt. | Auf eine kanonische Implementierung konsolidieren; Conversation-Datenmodell vereinheitlichen; ungenutzte entfernen. | integrations | **P1** |
| M10 | Invite-Enumeration | `Anyone can view invite by token` USING `(true)` ⇒ jeder Authentifizierte liest alle `organization_invites` (fremde E-Mails/Tokens/Org-IDs). | Auf `email = auth.jwt()->>'email'` bzw. Token-Match einschraenken; Lookup über SECURITY-DEFINER-RPC. | auth-access | **P0** |
| M11 | Invite-Redirect kaputt | `AcceptInvite.tsx:62` navigiert auf nicht-existentes `/organization/team` (404); `redirectAfterLogin` wird gesetzt aber nie gelesen. | Ziel `/dashboard/team`; `redirectAfterLogin` in `Auth.tsx` nach Login auswerten. | auth-access | **P1** |
| M12 | Edge-Function-Auth dupliziert | Kein geteilter Auth/Authz-Helper; ~81 Functions kopieren `getUser(Bearer)`-Muster, Checks uneinheitlich ⇒ Risiko einzelner ungesicherter Functions. | `_shared/auth.ts` mit `requireUser()/requireRole()/requireOrgRole()`; Functions ohne Check auditieren. | auth-access | **P1** |
| M13 | Reveal / Schema-Drift Zeitstempel | `process-interview-response:147` schreibt `identity_unlocked_at`, Migration definiert `unlocked_at`, `useIdentityUnlock` nutzt `unlocked_at` ⇒ UPDATE schlaegt fehl oder Zeitstempel uneinheitlich. | Spaltennamen vereinheitlichen (eine Quelle), Migration ergaenzen, alle Schreibstellen anpassen. | triple-blind | **P1** |
| M14 | PII / candidate-retrieval | `candidate-retrieval` selektiert `full_name`/`email`/`lat`/`lng` und gibt `fullName` zurück ohne Anonymisierung. Heute nur Service-Role-intern, aber Durchreichung = Leak. | Output auf `candidateId`+Scores reduzieren; Klar-Join erst nach Reveal serverseitig. | triple-blind | **P1** |
| M15 | Normalizer / Achsen-Remapping | `seniority_fit→leadership`, `location_fit→growth_potential` ⇒ UI zeigt Standort-Fit faelschlich als Wachstumspotenzial. | Dimension_scores-Schema angleichen (gleiche Achsen-Keys) ODER Remapping korrigieren. | fit-assessment | **P1** |
| M16 | Normalizer / insufficient_data | `not_met` und `insufficient_data` werden beide auf `gap` gemappt ⇒ fehlende Daten erscheinen als rote "Luecke" entgegen dem Prompt. | Eigenen UI-Zustand für `insufficient_data` (neutrales "Keine Daten"-Badge). | fit-assessment | **P1** |
| M17 | Datenfetching-Architektur | Drei divergierende Muster: TanStack Query (~21 Hooks), imperative `from()` im useEffect (Mehrheit, kein Cache, N+1), ~60 Invokes. Nur ClientDashboard server-aggregiert. | Auf TanStack Query vereinheitlichen; Recruiter/Admin-Dashboards auf `*-dashboard-data` EFs umstellen. | frontend | **P1** |
| M18 | Layout / Komposition | Keine Layout-Routes; jede der 60 Pages rendert `DashboardLayout` selbst. `settingsHref` → `/recruiter/settings` (existiert nicht, NotFound). | Layout-Route mit `<Outlet/>`; Pages auf Inhalt reduzieren; Route ergaenzen/Link korrigieren. | frontend | **P1** |
| M19 | Performance / Bundling | Kein Code-Splitting; `App.tsx` importiert alle ~80 Pages statisch ⇒ ein grosser Bundle, schlechte Initial-Ladezeit. | `React.lazy`+`Suspense` (mind. pro Persona-Bereich); route-basiertes Chunking. | frontend | **P1** |
| M20 | Mobile / Responsiveness | Sidebar `hidden md:block`, kein Hamburger/Drawer ⇒ auf Mobil keine Navigation. `use-mobile` existiert, ungenutzt. | shadcn Sheet/Sidebar + Hamburger; `use-mobile` zum Umschalten. | frontend | **P1** |
| M21 | Domain-Heuristik | `extractCompanyDomain` raet Domain als `name.com` (strippt GmbH/AG); für DACH `.de` oft falsch ⇒ Firecrawl gegen nicht-existente Domain, Anreicherung degradiert still. | Domain aus `company_profiles`/Job-URL ableiten; `.de`/weitere TLDs probieren; Domain als Eingabefeld. | job-lifecycle | **P1** |
| M22 | URL-Parsing ohne JS | `parse-job-url` nutzt naives fetch+Regex; LinkedIn/Stepstone/SPA liefern Login-Walls/leer; UI meldet nur generisch. Firecrawl ist bereits Dependency. | Firecrawl-Scrape (JS-Rendering) statt fetch; spezifischere Fehlermeldungen je HTTP-Status. | job-lifecycle | **P1** |
| M23 | Theming / Toast | `sonner.tsx` importiert `useTheme` aus `next-themes` ohne Provider ⇒ faellt auf `system`, folgt nie App-Theme. | Auf eigenen `@/hooks/useTheme` umstellen; `next-themes` entfernen. | frontend | **P1** |
| M24 | format-content / Race + Stale | `format-job-for-recruiters` schreibt `formatted_content` selbst, `JobApprovalDialog` zusaetzlich, Auto-Trigger parallel ⇒ doppelte/race-anfaellige Writes. JobEdit triggert keine Re-Generierung ⇒ Stale. | Single-Writer (nur Function schreibt); Invalidierung/Re-Gen bei Job-Edit. | job-lifecycle | **P1** |
| M25 | Honorar-/Margen-Logik | Keine Validierung `recruiter_fee_percentage <= fee_percentage` ⇒ `recruiter_payout > total_fee`, `platform_fee` negativ. `custom_fee_percentage` ungenutzt, Tax/Currency hart EUR. | Guard `rec% <= fee%`; `custom_fee_percentage` einbeziehen; Tax/Currency implementieren oder dokumentieren. | financials | **P1** |
| M26 | Parallele manuelle Zahlpfade | `AdminPayments` setzt `payment_status='paid'`, `AdminInvoices` `status='paid'` direkt; `bank_iban` deutet IBAN-Weg an — alle umgehen Stripe/Escrow ⇒ widerspruechliche Finanzstaende. | Manuelle Wechsel entfernen ODER expliziten `manual/offline`-Pfad modellieren; ein Source-of-Truth pro Geldzustand. | financials | **P1** |
| M27 | Frontend-Direktschreibzugriff | `ClientInterviews.handleComplete/NoShow/Save` schreiben `interviews`/`submissions`/`placements` direkt ⇒ ueberspringt Notifications, `offer_events`, Honorar, Audit. | Aktionen über bestehende Edge Functions routen, damit Seiteneffekte konsistent feuern. | pipeline | **P1** |
| M28 | process-rejection Empfaenger | Template `to: candidate.email`, `data.recruiter_email` ebenfalls `candidate.email`; trotz Kommentar "send to recruiter" erhaelt Kandidat Absage direkt (Triple-Blind-Bruch). | Empfaenger eindeutig festlegen; `recruiter_email` mit Recruiter-Adresse fuellen; Absage-Policy klaeren. | pipeline | **P1** |
| M29 | Token-Handling Refresh | `getValidToken` gibt nach Refresh `access_token` im Klartext zurück (nicht re-entschluesselt); Tokens in Naehe von `console.log` ⇒ Leak-Risiko in Function-Logs. | Einheitlich entschluesselten DB-Wert zurückgeben; Tokens nie loggen; Log-Statements auditieren. | integrations | **P1** |
| M30 | Config-Profile Matching | v3.1 fragt `matching_config` nach `profile=tech/finance/sales`, nur `default` geseedet ⇒ für Nicht-default greift still Hardcoded-Fallback, Admin-Config ignoriert. | Profil-Datensaetze seeden ODER UI auf vorhandene Profile beschraenken; bei fehlendem Profil sichtbar warnen. | matching-engine | **P1** |
| M31 | AI-Gateway-Endpoint | `normalize-skills` ruft `api.lovable.dev` statt `ai.gateway.lovable.dev` ⇒ AI-Fallback schlaegt fehl, Skills fallen auf confidence 20. | Endpoint angleichen; Fehlerlogging pruefen. | matching-engine, candidate-intake | **P0** |
| M32 | Tech-Domain-Hardcoding | `TECH_DOMAINS` manuell gepflegte Matrix; inkompatible Domains hart `×0.1` ohne Admin-Steuerung ⇒ Quereinsteiger unfair ausgeschlossen, schwer auditierbar. | Matrix+Penalty in `matching_config` auslagern; im Admin-UI sichtbar/auditierbar. | matching-engine | **P2** |
| M33 | Skill-Normalisierung Timing | `normalize-skills` laeuft erst zur Match-Zeit, nicht beim Intake ⇒ `candidate_skills` unkanonisiert; abweichender Endpunkt. | Normalisierung in Save-Pfad integrieren (kanonische Skills persistieren); Endpunkt vereinheitlichen. | candidate-intake | **P1** |
| M34 | Duplizierte Persistenz-Logik | `saveParsedCandidate`/`normalizeDate` doppelt (`useCvParsing` v2 vs. `process-candidate-import` v3), bereits divergent. | In geteiltes `_shared/`-Modul extrahieren; Frontend nur über invoke. | candidate-intake | **P1** |
| M35 | Re-Import / Datenverlust | CV-Update ersetzt Kind-Tabellen per delete-then-reinsert ⇒ manuell editierte Erfahrungen/Skills gehen verloren (kein Merge). | Re-Import als Merge (Upsert über stabile Keys) ODER Bestaetigung vor Ueberschreiben. | candidate-intake | **P1** |
| M36 | Fehlerbehandlung Speichern | In `saveParsedCandidate` wirft nur `candidates`-Insert; Kind-Insert-Fehler nur `console.error` ⇒ Kandidat "erfolgreich" trotz fehlender Kinddaten. | Kind-Inserts in transaktionale RPC buendeln ODER Fehler aggregieren + Toast. | candidate-intake | **P1** |
| M37 | Duplizierte Recruiter-Score-Logik | `influence-engine` und `calculate-influence-score` schreiben beide `recruiter_influence_scores` mit unterschiedlichen Formeln ⇒ Race/Inkonsistenz je Cron-Reihenfolge. | Eine Score-Quelle festlegen; die andere auf Teilaspekt reduzieren ODER zusammenfuehren. | automation-engines | **P1** |
| M38 | Duplizierte Analytics-Writer | `calculate-analytics` vs. `refresh-analytics` mit kollidierenden `onConflict`-Keys auf `funnel_metrics`. | Auf einen Writer konsolidieren; `onConflict`-Key vereinheitlichen. | automation-engines | **P1** |
| M39 | automation-hub nicht im Repo | Zentrale Notification-Quelle (Webhook) nur in Dashboard-Config, nicht versioniert ⇒ fragil/undokumentiert. | In Repo aufnehmen/dokumentieren; Webhook-Konfiguration versionieren. | automation-engines | **P1** |
| M40 | Duplizierte Tabellen-Migration | `20260305023057` + `20260306000000` legen `candidate_fit_assessments` identisch ohne `IF NOT EXISTS` an ⇒ Replay-Bruch. | Eine Migration entfernen ODER `IF NOT EXISTS`; Verlauf konsolidieren. | fit-assessment | **P1** |
| M41 | extract-intake-briefing Output-Spec | Setzt gleichzeitig `response_format:json_object` UND `tools` mit `tool_choice:forced`; nicht von allen Modellen akzeptiert, nur durch Doppel-Parsing abgefangen. | Auf einen Mechanismus reduzieren (reiner Tool-Call, konsistent zu anderen). | job-lifecycle | **P1** |

#### LOW

| # | Bereich | Problem (Kurz) | Empfehlung (Kurz) | Domaene | Horizont |
|---|---|---|---|---|---|
| L1 | Wartbarkeit / updated_at | Zwei Triggerfunktionen `update_updated_at()` vs. `update_updated_at_column()` parallel ⇒ Verwechslung, Doppelpflege. | Auf eine Funktion konsolidieren. | data-model | **P2** |
| L2 | Matching-Strategie unklar | `candidate_fit_assessments` koexistiert mit `match_outcomes`/`match_recommendations`/`match_score`; autoritative Quelle ueber mehrere Hooks unklar. | Auf eine Quelle konsolidieren, Legacy deprecaten, autoritatives Feld dokumentieren. | data-model | **P1** |
| L3 | Integration-Test Schein | `integration-api-key` action `test` ist No-op, gibt immer Erfolg ⇒ Nutzer glauben ATS-Creds gueltig. | Provider-spezifischen Test implementieren ODER Button deaktivieren. | auth-access, integrations | **P2** |
| L4 | Instabiles Context-Value | `AuthContext.Provider value={{...}}` Inline-Literal ohne `useMemo`; `signUp/signIn/signOut` ohne `useCallback` ⇒ alle Consumer re-rendern. | `value` via `useMemo`, Funktionen via `useCallback` (deckt auch C7/C9 mit ab). | auth-access | **P0** |
| L5 | Toter Code / candidate-summary | `candidate-summary` ohne Caller, baut Prompt mit `full_name`/`email` ⇒ versehentlicher Aufruf = PII ans LLM. | Orphaned Function loeschen (oder durch `client-candidate-summary` ersetzen). | candidate-intake, triple-blind | **P1** |
| L6 | Toter Code / skill-matcher | Ausgefeiltes `skill-matcher.ts` (Levenshtein, Skill-Level) wird von v3.1 nicht aufgerufen; stattdessen simple `matchSingleSkill`. | Verdrahten (inkl. Skill-Level) ODER Modul entfernen. | matching-engine | **P2** |
| L7 | Synthetische Seed-Daten | `seed-ml-training-data` mischt 200 Zufalls-Outcomes in echte Tabellen; Calibrate kann nicht trennen ⇒ Reports verfaelscht. | `is_synthetic`-Flag, aus Kalibrierung ausschliessen; Seed nur Non-Prod. | matching-engine | **P1** |
| L8 | Frontend nicht ausgerollt (Fit) | `CandidateFitAssessmentCard` nur im Repo, nicht live; Auto-Assessments sammeln sich + LLM-Kosten ohne Nutzer. | Auto-Trigger erst aktivieren wenn Card live, ODER Feature-Flag. | fit-assessment | **P0** |
| L9 | CV-Link 403 | `cvUrl` nach Reveal gesetzt, aber `documents`-Bucket hat keine Client-Storage-Policy ⇒ Link fuehrt zu 403. | CV nach Reveal über kurzlebige `createSignedUrl` ODER Storage-RLS für Clients mit `identity_unlocked`. | triple-blind | **P1** |
| L10 | E-Mail-Import Rate-Limit | Kommentar "20/h, 100/day", implementiert nur Stundenlimit; Tageslimit fehlt. | Tageszaehlung ergaenzen ODER Kommentar korrigieren. | integrations | **P2** |
| L11 | Stille E-Mail-Fehler | Mehrere Mail-Calls in try/catch nur `console.log`; kein Retry/Dead-Letter ⇒ Versandfehler unsichtbar. | Fehler persistieren (`communication_log.status=failed`); Retry-Queue; bei kritischen Mails warnen. | pipeline | **P1** |
| L12 | Benachrichtigungs-Fragmentierung | Drei Kanaele (`notifications`, `client_notifications`, E-Mail) + drei Absenderdomaenen (matchunt.ai/lovable.app/recruitflow.app). Offer-Accept sendet keine Bestaetigung. | Auf eine Absenderdomain + ein Mail-Mechanismus; `client_notifications` mergen; Offer-Accept-Mail ergaenzen. | pipeline | **P1** |
| L13 | Interview-Reminder versendet nie | `sendReminderEmail` nur `console.log`, kein Resend-Call; kein Cron triggert `send-reminders` ⇒ Reminder faktisch nie. | Echten Versand implementieren + pg_cron (stuendlich) für `action=send-reminders`. | pipeline | **P1** |
| L14 | Toter/verwaister Code (Intake) | `candidate-summary` in `config.toml` ohne Caller; `candidate_ai_assessment` (alt) vs. `candidate_fit_assessments` (neu) koexistieren. | `candidate-summary` deprecaten; Verhaeltnis der Assessment-Tabellen dokumentieren/konsolidieren. | candidate-intake | **P1** |
| L15 | Urgency-Enum-Mismatch | `mapHiringUrgency` liefert `ASAP`, Form/DB erwartet `hot`/`urgent`/`standard` ⇒ unverarbeitet ins Formular. | Mapping auf kanonisches Enum normalisieren. | job-lifecycle | **P1** |
| L16 | Performance JobsList N+1 | `fetchJobs` feuert pro Job 3 Queries (submissions/interviews count, recruiter set) ⇒ lineare Verschlechterung. | Aggregierende View/RPC für Stats pro Client-Job in einer Query. | job-lifecycle | **P1** |
| L17 | UI-Kit / Toast-Redundanz | Zwei Toast-Systeme (Radix `use-toast` + Sonner); uneinheitliche Imports. | Auf ein System (Sonner) standardisieren; das andere + Provider entfernen. | frontend | **P2** |
| L18 | Routing / Toter Code | `ClientCandidatesOverview`/`TalentHub` importiert aber nicht geroutet; mehrere `/dashboard/*`-Altrouten nur Redirects. | Ungenutzte Imports/Pages entfernen ODER bewusst routen; Redirects bereinigen. | frontend | **P2** |
| L19 | Hardcodierte Benchmarks | `calculate-influence-score` mit `platformAvgOptIn=36`, `platformShowRate=85` hart. | Aus echten Daten berechnen ODER als konfigurierbare Konstante. | automation-engines | **P2** |

> **Aggregat:** 9 Critical, 29 High, 41 Medium, 19 Low = **98 katalogisierte Reibungspunkte**. Beachte: mehrere Punkte sind **dieselbe Wurzel aus verschiedenen Domaenen-Linsen** (z.B. C7/C9/L4 = `useAuth`-Instabilitaet; C5 = Embeddings doppelt in zwei Domaenen; H21 = GUCs vierfach genannt). Die Roadmap unten gruppiert nach Wurzelursache, nicht nach Zeilenanzahl.

---

### 99.3 Roadmap in drei Horizonten

Jedes Item: **Ziel · Schritte · Dateien/Funktionen · Aufwand** (S = <1 Tag, M = 1-3 Tage, L = 1-2 Wochen, XL = >2 Wochen). Items sind nach Reihenfolge der Bearbeitung gelistet; Register-IDs in Klammern.

#### P0 — SOFORT (Sicherheit, USP-Bruch, Production-Bug, Geldfluss tot)

> Leitsatz: **Nichts Neues bauen, bis Live ehrlich, sicher und konsistent ist.** Reihenfolge bewusst: erst der Loop (App benutzbar), dann Publish (Sichtbarkeit), dann Sicherheit (kein Schaden), dann USP (kein Vertragsbruch), dann Geld (kein Stillstand).

**P0-1 · Render-Loop fixen (App wird benutzbar)** — *(C7, C9, L4)*
- **Ziel:** `Maximum update depth exceeded` eliminieren; stabile Auth-Referenzen.
- **Schritte:** (1) `useAuth` Context-Value mit `useMemo` memoisieren, `signUp/signIn/signOut` mit `useCallback`. (2) Effekt-Deps von `[user]`/`[user, fetchX]` auf `[user?.id]` umstellen. (3) Realtime-Channel-Namen eindeutig machen (`notifications-${user.id}`). (4) `NotificationBell` nur EINMAL mounten (Navbar ODER DashboardLayout, nicht beide).
- **Dateien:** `src/lib/auth.tsx:25-51,97`, `src/hooks/useRealtimeNotifications.ts:24-42,73-123`, `src/hooks/useInfluenceAlerts.ts:60-87`, `src/components/layout/NotificationBell.tsx`, `Navbar.tsx:229`, `DashboardLayout.tsx:153`.
- **Aufwand:** S-M. *Verifikation per React-DevTools-Profiler auf betroffener Live-Route.*

**P0-2 · Publish-Gap schliessen & Drift stoppen** — *(H1, H2, H3, M4)*
- **Ziel:** Live = `main`; Backend hat keine zweite Schreib-Linie; Secrets sauber.
- **Schritte:** (1) Publish-Runbook + CI-Reminder nach jedem Merge; Versions-/Commit-Hash-Badge ins UI. (2) Klaeren ob Lovable-Publish den Git-Head oder einen Snapshot baut. (3) `matchunt-platform` vom Supabase-Projekt entkoppeln (Credentials entfernen, archivieren), kanonisches Repo dokumentieren. (4) `.env` in `.gitignore`, aus Historie entfernen (`git filter-repo`), anon key rotieren, `.env.example` committen. (5) Edge-Function-Drift aufloesen: `analyze-interview`/`google-auth`/`microsoft-auth` verifizieren (deployt? fehlt?), `extract-intake-briefing` in `config.toml` mit explizitem `verify_jwt`.
- **Dateien:** Lovable-Projekt-Settings, `.gitignore`, `.env`/`.env.example`, `supabase/config.toml`, beide `supabase/config.toml` (Drift), CI-Konfig.
- **Aufwand:** M. *Org-/Prozess-lastig, aber blockierend für alles Sichtbare.*

**P0-3 · Privilege-Escalation & Auth-Gating schliessen** — *(C3, H13, H14, M1, M10, L4)*
- **Ziel:** Niemand kann sich `admin` verschaffen; Suspend/verified wirken; keine Race-Redirects.
- **Schritte:** (1) `handle_new_user()` auf `client`/`recruiter` whitelisten, `admin` ablehnen. (2) Policy `Users can insert their own role` entfernen bzw. `WITH CHECK (role <> 'admin')`. (3) `status`/`verified` in `fetchUserRole` mitladen, in ProtectedRoute erzwingen; `is_active()`-SECURITY-DEFINER in relevante RLS. (4) `loading` erst false wenn `role` geladen (kein `setTimeout`). (5) Permissive `FOR ALL USING(true)` auf `recruiter_trust_levels`/`recruiter_job_activations`/`candidate_conflicts`/`integration_mappings` auf `service_role` einschraenken. (6) Invite-Enumeration-Policy einschraenken.
- **Dateien:** Migration `20251204171610` (`handle_new_user`), `src/lib/auth.tsx:25-63`, `src/App.tsx:109-127`, RLS-Migrationen der genannten Tabellen, `20251204231510:290`.
- **Aufwand:** M.

**P0-4 · Triple-Blind in RLS verankern (USP technisch durchsetzen)** — *(C1, C2, C6, H7, H10, H11, M2)*
- **Ziel:** PII/Firmenname sind NICHT mehr per DevTools vor Reveal abgreifbar; Reveal an Consent gekoppelt.
- **Schritte:** (1) SECURITY-INVOKER-Views für Client-Kandidatensicht (`candidates`, `candidate_experiences`): PII/`company_name` nur `WHEN s.identity_unlocked`, sonst NULL/Branche; direkten Tabellen-SELECT der Client-Rolle entziehen. (2) Recruiter-Job-View ohne `company_name` (nur bei eigener `company_revealed`-Submission). (3) Serverseitiger Regex-Scrub von `company_name` (inkl. Rechtsformen) über AI-Output in `format-job-for-recruiters`/`generate-job-expose` vor `UPDATE jobs`; bei Treffer regenerieren. (4) `process-interview-response` (accept) an `consent_confirmed`/`opt_in_response` koppeln, Consent als harte Vorbedingung vor Client-Mailing. (5) Stufe-1-Trigger `reveal_company_on_opt_in` auf `NEW.stage` umstellen + Test. (6) Kandidaten-Einwilligung als eigenen Record schreiben (Magic-Link-Aktion des Kandidaten, nicht Recruiter).
- **Dateien:** RLS-Migrationen `20251212165255`/`20260305002156`/`20260305100000`/`20251204171610:194`, neue View-Migration, `useClientCandidateView.ts`, `RecruiterJobs.tsx:66`, `JobDetail.tsx:346`, `format-job-for-recruiters/index.ts:266`, `generate-job-expose`, `process-interview-response/index.ts:147,215-260`, Trigger-Migration `20260122110726`, Consent-Flow.
- **Aufwand:** L. *Wichtigstes inhaltliches P0 — der USP ist hier.*

**P0-5 · Token-Sicherheit der oeffentlichen Portale** — *(H6, H4)*
- **Ziel:** Keine Enumeration/Forgery von Offer-/Interview-/Reference-Tokens.
- **Schritte:** (1) Alle public Tokens auf `crypto.randomUUID()`/`getRandomValues()`; Ablauf + Single-Use. (2) `offers`/`reference_requests`/`organization_invites` public-select-Policies entfernen; Auslieferung über SECURITY-DEFINER-RPC mit Token-Argument.
- **Dateien:** `send-interview-invitation`, `send-offer`, `create-offer` (generateToken/generateAccessToken), RLS-Migration `20251204215330:177` u.a.
- **Aufwand:** M.

**P0-6 · Stripe-Forgery & DB-GUCs absichern** — *(H29, H21, H22, M7)*
- **Ziel:** Keine faelschbaren Payment-Events; Trigger/Cron scheitern nicht mehr STILL; Fit-Trigger korrekt autorisiert.
- **Schritte:** (1) `stripe-webhooks` Fallback entfernen: ohne `STRIPE_WEBHOOK_SECRET` mit 500 abbrechen. (2) Bootstrap-Migration `ALTER DATABASE … SET app.settings.supabase_url/service_role_key`; pg_net-Calls mit Fehler-Logging in Tabelle; Smoke-Test. (3) `assess-candidate-fit` `verify_jwt=false` + Auth in Function (Service-Role-Pfad). (4) Auto-Fit-Trigger throtteln (`WHEN`-Klausel auf relevante Status/Quellen) ODER hinter Feature-Flag, bis Card live.
- **Dateien:** `stripe-webhooks/index.ts:26-30`, neue Bootstrap-Migration, `supabase/config.toml:233`, Trigger-Migration `20260307000000`/`20260306221420`.
- **Aufwand:** M.

**P0-7 · Einnahmeseite (Geldfluss reaktivieren)** — *(C4, H8, H9)*
- **Ziel:** `escrow_status` erreicht `held`; regulaerer Payout-Flow funktioniert ohne manuelle DB-Eingriffe.
- **Schritte:** (1) `create-invoice`/`stripe-checkout` EF: bei Placement Invoice + PaymentIntent/Checkout anlegen, `stripe_payment_intent_id` persistieren (triggert bestehenden Webhook → `held`). (2) Placement-Erzeugung auf EINEN kanonischen Pfad (`process-offer-response`/zentrale RPC) konsolidieren; fehlerhafte Inserts in `ClientInterviews.tsx:190` + `process-talent-hub-action:245` entfernen; Pre-Insert-Check auf bestehendes Placement. (3) `process-payout`: Betrag serverseitig aus `placement.recruiter_payout`, Escrow-Reife serverseitig verifizieren.
- **Dateien:** neue `create-invoice`/`stripe-checkout` EF, `process-offer-response/index.ts:134`, `ClientInterviews.tsx:190`, `process-talent-hub-action/index.ts:245`, `process-payout/index.ts`, `stripe-webhooks` (held-Match).
- **Aufwand:** L. *Ohne dies gibt es kein Umsatzmodell im Betrieb.*

**P0-8 · Webhook- & Mail-Sicherheit/Zustellbarkeit** — *(H15, H16, H17)*
- **Ziel:** Keine gefaelschten Inbound/Resend-Webhooks; Transaktionsmails von verifizierter Domain.
- **Schritte:** (1) Svix/HMAC-Signaturpruefung in `resend-webhooks`; Shared-Secret/Signatur in `process-inbound-email`/`-reply` und `process-candidate-email`/`-import` vor jeder Mutation. (2) `send-email` Absender auf verifizierte `matchunt.ai`-Domain (SPF/DKIM/DMARC), From-Adresse projektweit zentralisieren.
- **Dateien:** `resend-webhooks`, `process-inbound-email`, `process-inbound-reply`, `process-candidate-email`, `process-candidate-import`, `send-email`.
- **Aufwand:** M.

**P0-9 · Embeddings-Entscheidung & AI-Endpoint** — *(C5, M31)*
- **Ziel:** Semantische Suche entweder ehrlich funktionsfaehig oder ehrlich entfernt; AI-Fallback der Skills funktioniert.
- **Schritte:** (1) Entscheidung treffen: echtes 1536d-Embedding-Modell anbinden UND ins Matching integrieren, ODER Schema/Index/RPCs auf `vector(64)` migrieren, ODER Embedding-Fassade (Widget/Queue/RPCs) entfernen. (2) `normalize-skills`-Endpoint von `api.lovable.dev` auf `ai.gateway.lovable.dev` korrigieren.
- **Dateien:** `generate-embeddings`, Embedding-Migration (Spalte/Index), `find_similar_candidates`/`search_candidates_hybrid` RPCs, `EmbeddingHealthWidget`, `normalize-skills`.
- **Aufwand:** M (Endpoint S; Embedding-Pfad M-L je nach Entscheidung).

**P0-10 · Theming-Inversion fixen** — *(C8, M23)*
- **Ziel:** Hell/Dunkel korrekt; Live wirkt nicht faelschlich "fest dunkel".
- **Schritte:** (1) `darkMode: 'class'` + konsequente `.dark`-Klasse ODER alle `dark:`-Varianten entfernen und nur semantische Tokens. (2) `sonner.tsx` auf eigenen `@/hooks/useTheme`, `next-themes` entfernen. (3) Beide Modi visuell regressionstesten.
- **Dateien:** `tailwind.config.ts:4`, `index.css` (Tokens), 52 Dateien mit `dark:`-Varianten, `src/components/ui/sonner.tsx:7`.
- **Aufwand:** M. *Hoher sichtbarer Effekt, geringes Risiko.*

> **P0-Definition of Done:** Live == main, kein Render-Loop, kein PII/Firmen-Leak per DevTools, kein Self-Admin, Reveal an Consent, Payout-Flow durchlaufbar (Invoice→held→Transfer), signierte Webhooks, korrekte Themes. *Erst danach P1.*

#### P1 — STABILITAET & SKALIERUNG

> Leitsatz: **Eine Wahrheit pro Konzept.** Doppelte Pfade konsolidieren, Daten-Hygiene, Performance, Automatisierung der bereits gebauten Engines.

**P1-1 · Matching auf v3.1 als Single Source of Truth** — *(H19, H20, H18, M30, L2, L6, L7)*
- **Ziel:** Eine konsistente Score-Quelle; Outcomes zuordenbar; Konfiguration wirkt.
- **Schritte:** v1/v2/v3 + clientseitiges `useJobMatching` deprecaten; v3.1 mit `submissionId` aufrufen und Prediction inkl. `submission_id` speichern; optional `match_score_v3` zurückschreiben; Profil-Datensaetze seeden oder UI beschraenken; `skill-matcher.ts` verdrahten oder entfernen; Seed-Daten `is_synthetic` flaggen; Kalibrierungs-Cron ODER ehrliche Umbenennung zu "Match-Analytics".
- **Dateien:** `calculate-match*`, `useJobMatching`/`useMatchScoreV2/V3/V31`, `matching_config`-Seeds, `skill-matcher.ts`, `seed-ml-training-data`, `track-match-outcome`.
- **Aufwand:** L.

**P1-2 · Submission-State-Machine & Pipeline-Konsolidierung** — *(H26, H27, M27, M28, L11, L12, L13, M6)*
- **Ziel:** Eine kanonische Pipeline-Wahrheit; ein Scheduling-Pfad; konsistente Seiteneffekte.
- **Schritte:** `stage` als kanonisch definieren, `status` per Trigger ableiten; CHECK/Enum für alle Status-Felder; Interview-Scheduling auf einen Pfad (`send-interview-invitation`), anderen auf No-Show/Cancel reduzieren; `ClientInterviews`-Direktschreibzugriffe über Edge Functions routen; Empfaenger in `process-rejection` korrigieren; Reminder-Versand + Cron implementieren; stille Mail-Fehler persistieren; `client_notifications` mit `notifications` mergen, Absenderdomain vereinheitlichen.
- **Dateien:** `submissions`-Trigger/Migration, `schedule-interview`, `send-interview-invitation`, `process-interview-response`, `ClientInterviews.tsx`, `process-rejection`, pg_cron-Migration, `communication_log`.
- **Aufwand:** L-XL.

**P1-3 · Cron-Automatisierung der gebauten Engines** — *(H23, M8, L13)*
- **Ziel:** Embedding-Queue, Outreach-Queue, Interview-Reminder laufen ohne manuellen Klick.
- **Schritte:** pg_cron-Jobs (analog `20260225200000_unified_task_inbox.sql`) für `generate-embeddings` (Batch+Backoff), `process-outreach-queue` (alle 5-15 min), `schedule-interview action=send-reminders` (stuendlich).
- **Dateien:** neue pg_cron-Migration(en), `generate-embeddings`, `process-outreach-queue`, `schedule-interview:530-572`.
- **Aufwand:** M.

**P1-4 · Datenfetching & Frontend-Struktur** — *(M17, M18, M19, M20, L17, L18)*
- **Ziel:** Caching, weniger N+1, kleinerer Bundle, Mobile-Nav.
- **Schritte:** Datenzugriff auf TanStack Query vereinheitlichen; `recruiter-dashboard-data`/`admin-dashboard-data` EFs (analog `client-dashboard-data`); Layout-Route mit `<Outlet/>`, fehlende `/recruiter/settings`; `React.lazy`+`Suspense` pro Persona-Bereich; Mobile Sheet/Sidebar; ein Toast-System; toten Routing-Code entfernen.
- **Dateien:** Dashboard-Hooks/-Pages, neue EFs, `src/App.tsx`, `DashboardLayout.tsx:138,186`, `src/components/ui/*`.
- **Aufwand:** L.

**P1-5 · Finanz-Konsolidierung** — *(H28, M25, M26)*
- **Ziel:** Idempotente Webhooks; korrekte Margen; ein Source-of-Truth pro Geldzustand.
- **Schritte:** Webhook-Idempotenz (`processed`-Check, `onConflict(stripe_event_id)`), `transfer.failed`→`transfer.reversed`/`payout.failed`; Guard `recruiter_fee% <= fee%`, `custom_fee_percentage` einbeziehen; manuelle Zahlpfade entfernen oder als `manual/offline` modellieren.
- **Dateien:** `stripe-webhooks/index.ts`, `process-offer-response` (Fee-Logik), `AdminPayments`, `AdminInvoices`.
- **Aufwand:** M.

**P1-6 · Intake-Konsolidierung & Datenintegritaet** — *(M33, M34, M35, M36, L5, L14, L9)*
- **Ziel:** Eine Persistenz-Logik, kein Datenverlust, Skill-Normalisierung beim Intake.
- **Schritte:** `saveParsedCandidate`/`normalizeDate` in `_shared/`-Modul; transaktionale RPC für Kind-Inserts mit Fehler-Aggregation; Re-Import als Merge; Skill-Normalisierung in Save-Pfad; `candidate-summary` deprecaten; `candidate_ai_assessment` vs. `candidate_fit_assessments` dokumentieren/konsolidieren; CV nach Reveal über `createSignedUrl`.
- **Dateien:** `useCvParsing.ts`, `process-candidate-import`, neues `_shared/save-candidate.ts`, `normalize-skills`, `candidate-summary`.
- **Aufwand:** L.

**P1-7 · Job-Lifecycle-Robustheit** — *(H25, M21, M22, M24, M41, L15, L16)*
- **Ziel:** PDF/Text-Jobs gleichwertig; zuverlaessiges Crawling; Single-Writer für formatted_content.
- **Schritte:** Parse-Schemata vereinheitlichen + Enrichment im PDF/Text-Pfad; Domain aus `company_profiles`/Job-URL statt raten (.de/TLDs); `parse-job-url` auf Firecrawl-Scrape; Single-Writer für `formatted_content`, Re-Gen bei Job-Edit; `extract-intake-briefing` Output-Mechanismus reduzieren; Urgency-Enum normalisieren; JobsList-N+1 über View/RPC.
- **Dateien:** `parse-job-url`, `parse-job-pdf`, `enrich-job-data`, `useJobEnrichment.ts:35`, `format-job-for-recruiters`, `JobApprovalDialog.tsx`, `extract-intake-briefing`, `JobsList.tsx:111-146`.
- **Aufwand:** L.

**P1-8 · Auth-/Integrations-Hygiene** — *(H12, H24, M3, M9, M11, M12, M13, M14, M29, L3, L10)*
- **Ziel:** Ein Reveal-Flag, idempotente Migrationen, vollstaendige DSGVO-Loeschung, geteilter Auth-Helper.
- **Schritte:** Reveal-Flags auf `identity_unlocked` konsolidieren (Legacy migrieren); doppelte OAuth-Migration bereinigen (`DROP POLICY IF EXISTS`); `gdpr-deletion` auf vollen Export-Umfang erweitern; Inbound-Reply-Handler konsolidieren; Invite-Redirect/`redirectAfterLogin` fixen; `_shared/auth.ts` (`requireUser/requireRole/requireOrgRole`); Reveal-Zeitstempel-Spalten vereinheitlichen; `candidate-retrieval`-Output reduzieren; Token nie loggen; Integration-Test echt oder deaktivieren; E-Mail-Tageslimit.
- **Dateien:** `process-talent-hub-action:136`, OAuth-Migrationen, `gdpr-deletion/index.ts:157-175`, `process-inbound-*`, `AcceptInvite.tsx`/`Auth.tsx`, neues `_shared/auth.ts`, `process-interview-response:147`/`useIdentityUnlock.ts:83`, `candidate-retrieval`, `token-refresh.ts:152`.
- **Aufwand:** L.

**P1-9 · Engine-Deduplizierung & Typsicherheit** — *(M5, M37, M38, M39, M40, M15, M16)*
- **Ziel:** Keine konkurrierenden Writer; Compiler-Schutz an Doku angeglichen.
- **Schritte:** `strict` schrittweise aktivieren (zuerst `strictNullChecks`); Recruiter-Score-Logik auf eine Quelle; Analytics-Writer konsolidieren (`onConflict` vereinheitlichen); `automation-hub`-Webhook versionieren/dokumentieren; doppelte Fit-Migration `IF NOT EXISTS`; Normalizer-Achsen + `insufficient_data`-Badge korrigieren.
- **Dateien:** `tsconfig*.json`, `influence-engine`/`calculate-influence-score`, `calculate-analytics`/`refresh-analytics`, automation-hub-Doku, `20260305023057`/`20260306000000`, `fitAssessmentNormalizer.ts:129-132,296-301`.
- **Aufwand:** M-L (strict kann iterativ XL sein).

#### P2 — WACHSTUM & DIFFERENZIERUNG

> Leitsatz: **Jetzt darf neu gebaut werden** — auf einem Fundament, das hält.

**P2-1 · Echte ML-Kalibrierungsschleife** — *(baut auf H18, M32)*
- **Ziel:** Aus Match-Outcomes lernen statt manuell tunen; Tech-Domain-Matrix konfigurierbar.
- **Schritte:** Offline-Training/Kalibrierungs-Cron, der Gewichte/Schwellen in `matching_config` aus realen Outcomes ableitet; `TECH_DOMAINS`-Matrix + Penalty in `matching_config` auslagern, im Admin-UI auditierbar; A/B-Infrastruktur für Matching-Profile.
- **Aufwand:** XL.

**P2-2 · Embedding-gestuetztes semantisches Matching** — *(baut auf C5)*
- **Ziel:** Vektorsuche aktiv im Ranking (nachdem Dimension/Modell entschieden ist).
- **Schritte:** Embeddings in v3.1-Scoring integrieren (Hybrid: deterministisch + semantisch); `find_similar_candidates` produktiv für Talent-Pool/Sourcing.
- **Aufwand:** L-XL.

**P2-3 · Integrations-Tiefe (ATS/CRM)** — *(baut auf P0-8, L3)*
- **Ziel:** Über HubSpot hinaus produktive ATS-Sync (Greenhouse/Personio); echte Verbindungstests; serverseitiger Batch-Import.
- **Schritte:** Provider-spezifische Tests, Bulk-Import in `hubspot-sync`, weitere OAuth-Provider produktiv schalten.
- **Aufwand:** L.

**P2-4 · Wartbarkeit & Bundle-Feinschliff** — *(L1, L6, L8, L18, L19, M5-Folge)*
- **Ziel:** Letzte Redundanzen entfernen, Performance-Budget etablieren.
- **Schritte:** `update_updated_at`-Konsolidierung; toten Code endgueltig entfernen; hardcodierte Benchmarks dynamisieren; Bundle-Budget + Lighthouse-Gate in CI.
- **Aufwand:** M.

---

### 99.4 Definition of Success (Plattform)

Matchunt ist erfolgreich, wenn ALLE folgenden Aussagen gleichzeitig wahr und verifizierbar sind:

**A. Vertrauen / USP technisch erfüllt**
- Kein Client kann Kandidaten-PII (Name/E-Mail/Telefon/CV/echte Arbeitgebernamen) vor `identity_unlocked` abrufen — auch nicht per Direct-API/DevTools (RLS-verankert, per Test belegt).
- Kein Recruiter kann `company_name` vor `company_revealed` abrufen — RLS-verankert.
- Jeder Reveal ist an einen **persistierten Kandidaten-Consent-Record** gekoppelt (Art. 6/7 nachweisbar); `gdpr-deletion` loescht/anonymisiert ALLE personenbezogenen Tabellen.

**B. Betrieb / Konsistenz**
- Live (matchunt.ai) == `main`; Commit-Hash im UI sichtbar; ein kanonisches Repo, eine Schreib-Linie aufs Backend.
- Kein Render-Loop, kein PII-Leak, kein Self-Admin-Pfad; alle public Tokens kryptografisch + ablaufend + single-use.
- Alle Webhooks signaturverifiziert; Transaktionsmails von verifizierter `matchunt.ai`-Domain; DB-GUCs gesetzt + Smoke-Test gruen.

**C. Geldfluss durchgaengig**
- Eine Angebotsannahme erzeugt: Placement (mit Fees) → Invoice + PaymentIntent → `escrow_status=held` → nach 90d freigebbar → Stripe-Transfer — **ohne manuelle DB-Eingriffe**. Webhooks idempotent. Auszahlungsbetrag serverseitig aus `recruiter_payout` abgeleitet (nicht manipulierbar).

**D. Daten / Matching glaubwuerdig**
- Eine Kandidat-Job-Paarung hat EINEN Score (v3.1) in Feed und DB. Outcomes sind jeder Prediction zugeordnet. "ML" lernt entweder aus Outcomes (Kalibrierungs-Cron) oder ist ehrlich als "Match-Analytics" deklariert. Semantische Suche ist entweder funktionsfaehig oder entfernt.

**E. Engineering-Hygiene**
- Status-Felder sind getypt (Enum/CHECK); keine konkurrierenden Writer auf `recruiter_influence_scores`/`funnel_metrics`/`formatted_content`/`placements`. `tsconfig` `strict`/`strictNullChecks` aktiv und gruen. Die gebauten Engines (Embedding-/Outreach-Queue, Reminder) laufen per Cron, nicht per Klick.

**F. Erlebnis**
- Hell/Dunkel korrekt; Mobile-Navigation vorhanden; Dashboards server-aggregiert + gecacht (kein N+1); Initial-Bundle code-split.

> **Nordstern-Metrik:** *Time-to-Trust* — die Zeitspanne von Submission bis zum sicheren, consent-gedeckten Identity-Reveal mit funktionierender Bezahlung — ist kurz, fehlerfrei und vollstaendig auditierbar. Erst wenn diese Kette technisch garantiert ist, ist das Triple-Blind-Versprechen mehr als Marketing.
