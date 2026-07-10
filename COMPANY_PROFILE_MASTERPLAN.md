# Matchunt — Geerdeter, phasierter Bauplan (Firmenprofil, Onboarding, Jobaufnahme, Outputs, Triple-Blind)

> Stand 2026-06-19, gegen `main` verifiziert (7-Agenten-Audit). Deploy nur via Lovable. UI Sie-Form, B2B, niemals „Bluewater Bridge". Alle Migrationen additiv (`ADD COLUMN IF NOT EXISTS`, keine NOT-NULL ohne DEFAULT, keine Renames/Drops von Spalten).

---

## 1. Kurz-Verdikt

Geschätzt **~40 % des Masterprompts steht bereits** — aber fast alles als **Infrastruktur ohne Verdrahtung**: `company_profiles` hat 31 Spalten, von denen ClientSettings nur 13 schreibt (über die Hälfte tot); eine vollständige Enrichment-/Crawl-Pipeline existiert, zielt aber auf `outreach_companies` statt aufs Kundenprofil; eine maskierende `recruiter_jobs_view` ist gebaut, wird vom Frontend aber **nirgends genutzt** (verifiziert: 0 Treffer in `src/pages/recruiter/*`, stattdessen `jobs.select('*')`).

**Größter Hebel:** die reiche Jobaufnahme (`IntakeBriefing.tsx`, ~21 gewichtete Fragen) strukturiert speichern statt als TEXT-Blob in `briefing_notes` — damit fallen Suchstrategie, Scores und Reveal-Logik fast geschenkt ab.

**Größte Lücke (und Risiko):** Triple-Blind ist Client→Recruiter **DB-seitig offen** — `company_name` und künftig `nogo_companies`/`target_companies` sind für jede Recruiter-Session über `jobs.select('*')` im Netzwerk lesbar; der Blind hängt allein am Frontend. Das ist kein Feature-Gap, das ist ein Leak und muss **vor** dem Deploy der Intake-Migration geschlossen werden.

---

## 2. Was wir wiederverwenden (Anti-Parallelbau)

| Asset (existiert, verifiziert) | Wird zur Basis für | Statt neu |
|---|---|---|
| `company_profiles` (31 Spalten, `user_id` UNIQUE, RLS owner-only) | gesamtes Profil-Datenmodell — nur **additiv** erweitern | keine neue `companies`-Tabelle |
| `src/pages/dashboard/ClientSettings.tsx` (CRUD, `select('*')`) | Profil-Editor; die 12 toten Spalten + neue Felder anschließen | keine neue Settings-Seite |
| `src/components/client/ProfileCompletenessCard.tsx` (7-Feld-%) | Quality-Score-Logik (gewichten, persistieren) | kein Score-Modul from scratch |
| `src/pages/onboarding/ClientOnboarding.tsx` (4-Step-Wizard, KYC) | **STEPS/Progress-Gerüst kopieren** — Inhalt NICHT anfassen (das ist KYC) | kein Wizard-Framework neu |
| `src/hooks/useClientVerification.ts` (auto-create + update) | Vorlage für `useCompanyOnboarding.ts` | kein Persistenz-Hook neu |
| `src/components/verification/VerificationStatusBanner.tsx` (in ClientDashboard:51) | Muster + Slot für Profil-Setup-Banner | kein Banner-Mechanismus neu |
| `JobIntakeStudio.tsx` + `IntakeBriefing.tsx` (~21 gewichtete Fragen, `appliesTo`-Verzweigung) | 3-Modell-Jobaufnahme + Prefill + strukturierte Speicherung | keine neue Intake-UI |
| `NeueStelleBar.tsx` (2-Wege-Toggle `full-time`/`freelance`) | auf 3 Modelle erweitern | kein Launcher neu |
| `enrich-company-from-domain` + `crawl-company-data` + `useCompanyEnrichment.ts` | Enrichment-Backend — **Zieltabelle auf `company_profiles` umhängen** | Crawler nicht neu schreiben |
| `src/components/outreach/company-profile/CrawlSourcesWidget.tsx` (Quellen-Status-UI) | Verifizierungs-/Quellen-Anzeige am Profil | kein Quellen-Widget neu |
| `parse-job-url/index.ts` (Lovable-Gateway, `google/gemini-2.5-flash`, Tool-Calling) | KI-Backend-Muster für `identify-company`, `generate-search-strategy`, `generate-open-questions` | kein AI-Gateway-Wiring neu |
| `format-job-for-recruiters` (anonymer Pitch) + `generate-job-expose` + `generate-job-summary` | Output 1/2 — umwidmen & in getrennte Felder schreiben | keine Output-Functions neu |
| `supabase/functions/_shared/pii-redaction.ts` (existiert) | PII-Redaction vor KI auch für jobs-Felder | keine Redaction neu |
| `recruiter_jobs_view` (Wave A, maskiert korrekt) | Recruiter-Lesepfad — **endlich vom Frontend nutzen** | keine neue View |
| `organizations` / `organization_members` (Rollen owner/admin/hiring_manager/viewer/finance) | Rollen-Vokabular für `contacts` wiederverwenden | kein Rollen-Enum neu |

---

## 3. Phasierter Plan

Leitplanke ist der MVP-Gedanke: **erst die „warum 16 Fragen"-Lücke schließen** (Profil befüllen + im Intake vorausfüllen), dann Outputs/Scores, Enrichment zuletzt. **Phase 0 ist nicht verhandelbar** — sie ist das Sicherheits-Gate.

### Phase 0 — Triple-Blind-Gate + Migrations-Reihenfolge (Pflicht, blockierend)
- **Ziel:** Client→Recruiter-Blind DB-seitig erzwingen, bevor sensible Intake-Spalten live gehen.
- **Änderungen:**
  - **Frontend zuerst** auf View umstellen: `RecruiterJobs.tsx:256`, `JobDetail.tsx:167`, `RecruiterDashboard.tsx:279/289` von `.from('jobs').select('*')` → `.from('recruiter_jobs_view')`. `revealedCompanyNames`-Logik (`RecruiterJobs.tsx:287-309`, `getRevealedCompanyName:358-360`) durch `company_name`/`company_revealed` aus der View ersetzen.
  - **Dann** Migration `2026xxxx_triple_blind_welle_c_jobs.sql`: `DROP POLICY "Recruiters can view published jobs" ON public.jobs` (definiert in `20251204171610_*.sql:194-197`); Recruiter lesen Jobs künftig nur über die View.
  - `recruiter_jobs_view` per `CREATE OR REPLACE` erweitern: `intake_payload`, `target_companies`, `nogo_companies`, `search_difficulty` **nie** selektieren (client-privat, auch nach Reveal); `reveal_envelope` nur freigegebene Teilmenge; `company_name` weiter `CASE WHEN rev.revealed`.
  - Migration `20260619120000_intake_hybrid_foundation.sql` **erst nach** dem View-Umbau deployen. Der Kommentar Zeile 4-5 („recruiter-privat via View") ist heute faktisch falsch — korrigieren.
- **Neu:** 1 Migration. **Erweitert:** 3 Recruiter-Seiten, `recruiter_jobs_view`.
- **Abhängigkeit:** keine.
- **Deploy-Gate:** Lovable-Deploy nötig (Frontend + Migration). **Reihenfolge zwingend:** Frontend live → dann Policy-Drop, sonst leere Recruiter-Listen.
- **Größe:** M

### Phase 1 — Profil-Schema-Erweiterung + ClientSettings vervollständigen
- **Ziel:** Alle Profilfelder, die der Intake voraussetzt, sind speicherbar — kein `select('*')`-geladen-aber-nie-gespeichert mehr.
- **Änderungen:**
  - Migration `2026xxxx_company_profile_masterprompt_fields.sql` (siehe §4).
  - `ClientSettings.tsx`: Interface (Z.33-49), `setProfile`-Init (Z.73-87), update-Block (Z.128-142), insert-Block (Z.150-165) um die **12 bereits existierenden toten Spalten** (`benefits`, `perks`, `culture_values`, `office_locations`, `remote_policy`, `work_style`, `tagline`, `team_size_range`, `brand_color_primary/secondary`, `opt_in_message` + 3 Toggles) **und** die neuen Felder erweitern.
  - Team-Platzhalter (Z.407-425) → `contacts`-Editor (jsonb-Array, Add/Remove, Rollen-Select aus `organization_members`-Vokabular). Klar abgrenzen: `contacts` = Ansprechpartner-Stammdaten, nicht Login-Accounts.
- **Neu:** 1 Migration, contacts-Editor-Komponente. **Erweitert:** `ClientSettings.tsx`.
- **Abhängigkeit:** keine (parallel zu Phase 0 möglich; types.ts erst nach beiden Migrationen neu generieren).
- **Deploy-Gate:** Migration + types.ts-Regen via Lovable.
- **Größe:** M

### Phase 2 — Onboarding-Wizard MVP + Gating + Dashboard-Banner
- **Ziel:** Erst-Login landet zuverlässig im Firmenprofil-Wizard; „später fortfahren" ist möglich.
- **Änderungen:**
  - `onboarding_status jsonb` auf `company_profiles` (in Phase-1-Migration mitnehmen).
  - **Neu** `src/hooks/useCompanyOnboarding.ts` (Vorlage `useClientVerification.ts`): liest/auto-created Profilzeile, liefert Flags + `markFirstLoginComplete`/`markReviewed`/`setQualityScore`.
  - **Neu** `src/pages/onboarding/CompanyProfileWizard.tsx` (STEPS/Progress aus `ClientOnboarding.tsx:18-157` kopiert) + Route `/onboarding/company` (`allowedRoles=['client']`). **`ClientOnboarding.tsx` (KYC) nicht anfassen.**
  - Gating in `App.tsx` ProtectedRoute (Z.113): `role==='client' && !onboarding_status.first_login_completed && pfad≠/onboarding/company` → `<Navigate to="/onboarding/company" replace>`. „Später fortfahren" setzt `first_login_completed=true`.
  - `Auth.tsx:46-49`: transientes `justSignedUp` durch persistierten Flag ersetzen; Redirect-Ziel auf `/onboarding/company`.
  - **Neu** `src/components/client/CompanyProfileSetupBanner.tsx` (Muster `VerificationStatusBanner`), gerendert in `ClientDashboard.tsx` direkt nach Z.51. Strings „Ihr Unternehmensprofil ist noch nicht eingerichtet" / „Später fortfahren" (heute 0 Treffer).
- **Neu:** Hook, Wizard, Banner, Route. **Erweitert:** `App.tsx`, `Auth.tsx`, `ClientDashboard.tsx`.
- **Abhängigkeit:** Phase 1 (Felder müssen speicherbar sein).
- **Deploy-Gate:** kein neues Backend (außer `onboarding_status`-Spalte aus Phase 1).
- **Größe:** L

### Phase 3 — Vorausgefüllte Jobaufnahme, 3 Modelle, strukturierte Speicherung, Draft/Resume
- **Ziel:** Schließt die „warum 16 Fragen"-Lücke und macht Briefing-Daten maschinell nutzbar.
- **Änderungen:**
  - Migration `2026xxxx_employment_models.sql`: `jobs.employment_model text DEFAULT 'permanent'`, `permanent_details/contracting_details/anue_details jsonb`. `employment_type` (unconstrained TEXT, kein CHECK — verifiziert) **nicht** anfassen.
  - `NeueStelleBar.tsx:40-52`: `JobType`-Union → `'permanent' | 'contracting' | 'anue'`, Toggle auf 3 Buttons; Typ bis Studio/Briefing durchreichen.
  - `IntakeBriefing.tsx`: `appliesTo` auf 3-Modell-Enum; **ANÜ-Fragen** (`hourly_rate`, `equal_pay_status`, `shift_schedule`, `deployment_site`, `required_certs`, `occupational_safety`, `onsite_contact`); fehlende 17/18/19-Fragen nachziehen (`alt_titles`, `headcount`, `priority`, `tasks`, `tools`, `vertragsart`, `benefits`, `decision_makers`, `budget_model`).
  - `serializeBriefing()` → **zusätzlich** `buildIntakePayload()` (strukturiertes Objekt). `JobIntakeStudio.tsx:187-221`-Insert um `intake_payload`, `target_companies`/`nogo_companies` (text[]), `reveal_envelope` (jsonb), `employment_model`, passendes `*_details` erweitern. `briefing_notes` als lesbarer Fallback behalten.
  - **Prefill aus `company_profiles`** beim Studio-Mount (`company_name`, `industry`, `benefits`, `culture_values`, `brand_color_*`) → genau diese Felder nie doppelt erfragen.
  - **Draft/Resume:** zweiter Button „Als Entwurf speichern" (`status:'draft'` statt hartcodiert `'pending_approval'` in `JobIntakeStudio.tsx:208`); beim Wiederöffnen `intake_payload` zurück in `answers` laden (Umkehrung von `prefillFromBuilt`). Drafts werden in `JobsList` bereits gelistet.
- **Neu:** 1 Migration, `buildIntakePayload`. **Erweitert:** `NeueStelleBar`, `IntakeBriefing`, `JobIntakeStudio`.
- **Abhängigkeit:** Phase 0 (Spalten dürfen nicht leaken) + Phase 1 (Prefill-Quelle).
- **Deploy-Gate:** Migration + Intake-Hybrid-Migration müssen live sein.
- **Größe:** L

### Phase 4 — 4 Outputs + persistierte Quality-Scores
- **Ziel:** Bei Einreichung entstehen automatisch internes Briefing, anonymer Pitch, Suchstrategie, offene Rückfragen — plus zwei gespeicherte Scores.
- **Änderungen:**
  - Migration `2026xxxx_job_outputs_and_quality.sql`: `jobs.internal_briefing/candidate_pitch/search_strategy/open_questions jsonb`, `jobs.briefing_quality_score numeric`; `company_profiles.quality_score numeric` + `quality_breakdown jsonb`.
  - **Neu** `generate-search-strategy/index.ts` (Output 3) → `jobs.search_strategy`. **Neu** `generate-open-questions/index.ts` (Output 4) → `jobs.open_questions`; an Toast-Platzhalter `PendingDecisionsWidget.tsx:118` / `ExposeQuickDecisionWidget.tsx:126` anschließen.
  - `format-job-for-recruiters` → klar als Output 2 (`jobs.candidate_pitch`, anonym). `generate-job-summary` → Output 1 (`jobs.internal_briefing`), **anonymisieren**: `company_name` aus Prompt (Z.91) raus bzw. `pii-redaction.ts` vorschalten. Recruiter-privat → in `recruiter_jobs_view` aus Phase 0 **nicht** exponieren; `candidate_pitch` bleibt anonym.
  - **On-Submit-Orchestrator** `generate-job-outputs`: bei `status:'pending_approval'` (`JobIntakeStudio.tsx:208`) die 4 Functions sequenziell, statt erst bei Admin-Genehmigung (`JobApprovalDialog.tsx:109`).
  - `briefing_quality_score` serverseitig aus `IntakeBriefing.tsx:207-220`-Logik (um ANÜ erweitert) → `jobs.briefing_quality_score`. `company_profile_quality_score`: `ProfileCompletenessCard.tsx:29-45` gewichten, beim Save in `ClientSettings` → `company_profiles.quality_score`. Banner/Gating/Recruiter-Prio lesen denselben Wert.
- **Neu:** 2 Edge-Functions, 1 Orchestrator, 1 Migration. **Erweitert:** 3 Output-Functions, 2 Widgets, `ProfileCompletenessCard`.
- **Abhängigkeit:** Phase 3 (`intake_payload` als Input).
- **Deploy-Gate:** Migration + 3 neue Edge-Functions via Lovable.
- **Größe:** L

### Phase 5 — Company-Identification + Enrichment aufs eigene Profil
- **Ziel:** Profil wird halbautomatisch vorbefüllt (öffentliche Recherche), mit Match-Score, Quellen, robots.txt-Compliance.
- **Änderungen:**
  - Migration `2026xxxx_company_profile_enrichment.sql`: `match_quality text`, `match_confidence int`, `identified_domain text`, `enrichment_status text`, `enrichment_sources jsonb`, `field_provenance jsonb`. (`last_enriched_at` existiert bereits — nicht neu anlegen.)
  - **Neu** `identify-company/index.ts` (Input Name/Domain/E-Mail/LinkedIn/Standort → `candidates[]` mit `match_score`/`match_quality`; <50 → `unknown`). **Neu** `enrich-company-profile/index.ts` (auf `enrich-company-from-domain` aufbauend, `EnrichmentResult` um `benefits/perks/culture_values/office_locations/...` erweitern, schreibt nach `company_profiles` per `user_id`, jedes Feld mit `{value, source_url, verified, confidence}` in `field_provenance`).
  - **Neu** `_shared/crawl-compliance.ts` (robots.txt vor jedem Firecrawl-Call; heute 0 Treffer). In `enrich-company-profile` **und** `crawl-company-data` einhängen.
  - **Neu** `useCompanyProfileEnrichment.ts` (Vorlage `useCompanyEnrichment.ts`, Zieltabelle `company_profiles`, **ohne** `outreach_status`/`warm_score`). In `ClientSettings` + Wizard-Schritt einbinden, `CrawlSourcesWidget` wiederverwenden (gespeist aus `company_profiles.enrichment_sources`).
- **Neu:** 2 Edge-Functions, 1 Compliance-Helper, 1 Hook, 1 Migration. **Erweitert:** `ClientSettings`, `ProfileCompletenessCard` (Provenance-Anzeige).
- **Abhängigkeit:** Phase 1 (Schreibziel-Spalten) + Phase 2 (Wizard-Slot).
- **Deploy-Gate:** Migration + Edge-Functions; `FIRECRAWL_API_KEY` (Pflicht), `LOVABLE_API_KEY` müssen gesetzt sein.
- **Größe:** L

---

## 4. Konsolidierte additive Migration-Skizze

> Pro Phase eine eigene Datei (Reihenfolge wie §3). Hier zusammengefasst. Alles `IF NOT EXISTS`, keine NOT-NULL ohne DEFAULT, keine Drops/Renames.

```sql
-- ── Phase 1: company_profiles Masterprompt-Felder ──────────────────────────
ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS legal_name              text,
  ADD COLUMN IF NOT EXISTS linkedin_url            text,
  ADD COLUMN IF NOT EXISTS career_page_url         text,
  ADD COLUMN IF NOT EXISTS sub_industry            text,
  ADD COLUMN IF NOT EXISTS company_size            text,        -- Größen-Bucket, getrennt von headcount(int)
  ADD COLUMN IF NOT EXISTS interview_rounds        integer,
  ADD COLUMN IF NOT EXISTS feedback_speed          text,
  ADD COLUMN IF NOT EXISTS average_hiring_duration text,
  ADD COLUMN IF NOT EXISTS personality_no_fit      text,
  ADD COLUMN IF NOT EXISTS last_customer_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_domains           text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_companies        text[]  DEFAULT '{}',  -- firmenweite Defaults
  ADD COLUMN IF NOT EXISTS excluded_companies      text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contacts                jsonb   DEFAULT '[]',  -- {first_name,last_name,position,email,phone,role}
  ADD COLUMN IF NOT EXISTS default_hiring_process  jsonb   DEFAULT '[]',  -- geordnete Schritte
  ADD COLUMN IF NOT EXISTS employer_selling_points jsonb   DEFAULT '[]',  -- priorisierte 3-5 Argumente
  ADD COLUMN IF NOT EXISTS products_services       jsonb   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS target_markets          jsonb   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS personality_fit         jsonb   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS field_verification      jsonb   DEFAULT '{}',  -- feld->erkannt|bestaetigt|bearbeitet|manuell|unsicher|veraltet|nicht_gefunden
  ADD COLUMN IF NOT EXISTS data_sources            jsonb   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS onboarding_status       jsonb   DEFAULT '{}',  -- first_login_completed, company_identified, company_profile_reviewed
  ADD COLUMN IF NOT EXISTS quality_score           numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_breakdown       jsonb   DEFAULT '{}';

-- ── Phase 3: jobs Besetzungsmodelle ────────────────────────────────────────
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS employment_model    text DEFAULT 'permanent',  -- permanent|contracting|anue
  ADD COLUMN IF NOT EXISTS permanent_details   jsonb,
  ADD COLUMN IF NOT EXISTS contracting_details jsonb,
  ADD COLUMN IF NOT EXISTS anue_details        jsonb;
-- intake_payload/reveal_envelope/target_companies/nogo_companies/search_difficulty/
-- visa_sponsorship/experience_min/experience_max kommen aus 20260619120000_intake_hybrid_foundation.sql
-- (NICHT duplizieren — diese Migration in Phase 3 deployen, NACH Phase 0)

-- ── Phase 4: jobs Outputs + Scores ─────────────────────────────────────────
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS internal_briefing     jsonb,   -- Output 1, recruiter-privat (NICHT in recruiter_jobs_view)
  ADD COLUMN IF NOT EXISTS candidate_pitch       jsonb,   -- Output 2, anonym
  ADD COLUMN IF NOT EXISTS search_strategy       jsonb,   -- Output 3, client/recruiter-privat
  ADD COLUMN IF NOT EXISTS open_questions        jsonb,   -- Output 4
  ADD COLUMN IF NOT EXISTS briefing_quality_score numeric;

-- ── Phase 5: company_profiles Enrichment-Provenienz ────────────────────────
ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS match_quality      text CHECK (match_quality IN ('high','medium','low','unknown')),
  ADD COLUMN IF NOT EXISTS match_confidence   int,
  ADD COLUMN IF NOT EXISTS identified_domain  text,
  ADD COLUMN IF NOT EXISTS enrichment_status  text,
  ADD COLUMN IF NOT EXISTS enrichment_sources jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS field_provenance   jsonb DEFAULT '{}';  -- feld->{source_url,verified,confidence}

-- ── Optional (statt jsonb-contacts): eigene Tabelle, RLS owner-only ─────────
CREATE TABLE IF NOT EXISTS public.company_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id uuid NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  first_name text, last_name text, position text, email text, phone text, role text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.company_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages contacts" ON public.company_contacts FOR ALL
  USING (EXISTS (SELECT 1 FROM public.company_profiles cp
                 WHERE cp.id = company_profile_id AND cp.user_id = auth.uid()));
-- KEIN GRANT/View Richtung Recruiter oder Kandidat.
```

> Nach jeder Migration `types.ts` via Supabase-Typegen neu generieren.

---

## 5. Offene Entscheidungen

1. **`employment_model` als `jobs`-Spalte vs. eigene `positions`-Tabelle?** Empfehlung: **Spalte** auf `jobs` (additiv, non-breaking — `employment_type` ist unconstrained TEXT).
2. **`contacts` als `jsonb` auf `company_profiles` vs. eigene `company_contacts`-Tabelle?** Empfehlung: **jsonb** für MVP. **`organization_members` NICHT verwenden** — das sind Login-Accounts, nicht Stammdaten.
3. **ANÜ jetzt (Phase 3) oder später?** ANÜ berührt AÜG (Equal-Pay, Überlassungshöchstdauer) — der Build leistet **nur Datenerhebung, keine Rechtsberatung**.
4. **Enrichment selbst bauen (Phase 5) vs. zunächst manuelles Profil?**
5. **On-Submit-Orchestrator (4 Outputs sofort) vs. Beibehaltung des Admin-Genehmigungs-Triggers?**

---

## 6. Empfohlener Startpunkt

**Phase 0 zuerst, unmittelbar gefolgt von Phase 1.**

Phase 0, weil sie das **einzige echte Sicherheitsrisiko** schließt: `company_name` und künftig `nogo_companies`/`target_companies` sind heute über `jobs.select('*')` für jede Recruiter-Session lesbar (verifiziert — die maskierende View ist gebaut, aber tot). Sobald die Intake-Migration deployt wird, leaken die No-Go-/Ziel-Firmenlisten mit — das ermöglicht Re-Identifikation des Kunden und bricht die Triple-Blind-Zusage.

Phase 1 direkt danach, weil sie den **größten Produktwert pro Aufwand** liefert und die „warum 16 Fragen"-Lücke an der Wurzel öffnet.
