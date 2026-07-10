# 00 — PROJECT MAP: matchunt.ai

Stand: 2026-07-09, Branch `main` (mit uncommitteten Änderungen). Erstellt in Phase 0 des Audits. Alle Angaben aus dem Repo verifiziert, Heuristiken sind markiert.

## 1. Struktur & Umfang

| Bereich | Files | LOC |
|---|---|---|
| `src/` | 606 | 144.286 |
| `supabase/` | 193 | 38.583 |
| `scripts/` | 1 | 153 |
| `docs/` | 18 (MD) | — |

- 78 Edge Functions + `_shared/` (nur 6 shared Files: `encryption.ts`, `fit-assessment.ts`, `pii-redaction.ts` (+`.test.ts`), `provider-config.ts`, `token-refresh.ts`)
- 107 Migrations (`supabase/migrations/`), letzte: `20260619140000_company_profile_masterprompt_fields.sql`
- Component-Ordner: admin, analytics, behavior, candidates, client, command, dashboard, dialogs, expose, files, fraud, gdpr, health, influence, integrations, interview, interview-intelligence, jobs, landing, layout, matching, notifications, offers, organization, outreach, payment, pipeline, placements, ranking, recruiter, references, rejection, sla, talent, talent-pool, ui, verification
- `src/academy/` — separates Academy-Modul (Subdomain, geteiltes Backend). `src/hooks/`: 90 Hooks. `src/i18n/locales/` vorhanden.

## 2. package.json (Kurzfassung)

- React 18.3, Vite 5, TS 5.8, Tailwind 3.4, Radix/shadcn, @tanstack/react-query 5, react-router-dom 6, i18next 26, zod 3, @supabase/supabase-js 2.86
- Scripts: `dev`, `dev:academy` (Port 8081), `build`, `build:dev`, `lint`, `preview` — **kein `test`, kein `typecheck`-Script**
- devDeps enthalten `lovable-tagger` (Lovable-Ursprung des Projekts)

## 3. Routing-Map (aus src/App.tsx, 497 Zeilen)

- Public: `/`, `/auth`, `/about`, `/contact`, `/blog`, `/guides`, `/docs`, `/help`, `/careers`, `/press`, `/impressum`, `/datenschutz`, `/agb`
- Token-basiert (kein Login): `/interview/select/:token`, `/interview/respond/:token`, `/offer/view/:token`, `/invite/:token`, `/reference/:token`, `/offer/accepted`
- Client-Dashboard: `/dashboard` + jobs, `command/:jobId`, `jobs/new`, `jobs/:id`, interviews, candidates(+`:id`), placements, messages, settings, billing, privacy, offers, analytics, team, integrations (talent/pipeline/command-center → Redirects auf `/dashboard`)
- Recruiter: `/recruiter` + jobs(+`:id`), candidates(+`:id`), submissions(+`:submissionId`), earnings, notifications, messages, profile, payouts, privacy, influence, talent-pool, integrations
- Admin: `/admin` + clients, recruiters, jobs, candidates, interviews, placements, deal-health, payments, activity, payouts, fraud, analytics, settings, matching-config, domains, skill-synonyms, academy(+`courses/:id`), invoices, users, outreach(+`company/:companyId`)
- Onboarding: `/onboarding`, `/recruiter/onboarding`; `/settings`; `*` → NotFound
- Auth-Wrapper pro Route in App.tsx Zeilen 148–475 (Wrapper-Typ pro Route dort verifizieren)

## 4. Edge-Functions-Inventar (Funktion → Tabellen via `.from()`-Grep)

Vollständige Zuordnung (leer = keine direkten Tabellenzugriffe, meist reine AI/Parse-Funktionen):

- accept-invite: organization_invites, organization_members
- analyze-reference: reference_responses
- assess-candidate-fit: candidate_ai_assessment, candidate_experiences, candidate_fit_assessments, candidate_interview_notes, candidate_languages, candidate_skills, candidates, jobs, submissions
- automation-hub: candidates, interviews, jobs, notifications, offers, placements, submissions
- calculate-analytics: funnel_metrics, interviews, jobs, offers, placements, recruiter_leaderboard, rejections, submissions
- calculate-influence-score: influence_alerts, interviews, recruiter_influence_scores, submissions, user_roles
- calculate-match: candidates, jobs, submissions
- calculate-match-v2: candidates, commute_overrides, jobs, routing_cache, submissions
- calculate-match-v3: candidates, jobs, match_outcomes, matching_config, skill_taxonomy, submissions
- calculate-match-v3-1: candidates, job_skill_requirements, jobs, match_outcomes, matching_config, skill_synonyms, skill_taxonomy
- calculate-scores: candidate_behavior, communication_log, interviews, jobs, placements, platform_events, recruiter_performance, sla_deadlines, submissions, user_behavior_scores, user_roles
- candidate-retrieval: candidates, jobs, submissions
- candidate-summary: — (AI)
- client-candidate-summary: candidate_ai_assessment, candidate_behavior, candidate_client_summary, candidate_experiences, candidate_interview_notes, candidates, submissions
- client-dashboard-data: activity_logs, candidates, client_interviews_view, client_offers_view, client_submissions_view, interviews, jobs, submissions
- crawl-career-page(+bulk): outreach_leads
- crawl-company-data: outreach_companies, outreach_leads
- create-offer: offer_events, offers, submissions
- deal-health: deal_health, platform_events, sla_deadlines, submissions, user_behavior_scores
- detect-candidate-conflicts: candidate_conflicts, notifications, submissions
- enrich-company-from-domain / enrich-job-data / extract-intake-briefing / geocode-address / parse-cv / parse-job-pdf / parse-job-url / parse-pdf: — (AI/extern)
- escalation-engine: notifications, platform_events, sla_deadlines, user_behavior_scores, user_roles
- format-job-for-recruiters: jobs
- fraud-detection: candidates, fraud_signals, notifications, platform_events, submissions, user_roles
- gdpr-deletion: candidates, data_deletion_requests, messages, profiles, stripe_accounts  ← auffällig klein
- gdpr-export: activity_logs, candidates, company_profiles, consents, data_export_requests, documents, invoices, jobs, messages, notifications, payout_requests, profiles, stripe_accounts, submissions, user_roles
- generate-company-insights: company_intelligence, outreach_companies
- generate-cv-pdf: candidate_documents, candidate_educations, candidate_experiences, candidate_interview_notes, candidate_languages, candidate_skills, candidates
- generate-embeddings: candidates, embedding_queue, jobs
- generate-interview-prep: company_profiles, interview_intelligence, interviews, notifications
- generate-job-expose / generate-job-summary: jobs
- generate-match-recommendation: candidate_interview_notes, candidates, job_skill_requirements, jobs, match_recommendations
- generate-outreach-email: outreach_campaigns, outreach_emails, outreach_leads
- hubspot-sync: candidate_activity_log, candidates, recruiter_integrations
- import-outreach-leads: outreach_import_jobs, outreach_leads, outreach_suppression_list
- influence-engine: candidate_behavior, candidates, coaching_playbooks, deal_health, influence_alerts, interviews, jobs, recruiter_influence_scores, submissions, user_roles
- integration-api-key / integration-disconnect: recruiter_integrations
- normalize-skills: skill_taxonomy
- oauth-callback: oauth_states, recruiter_integrations; oauth-connect: oauth_states
- organization-invite: organization_invites, organization_members, organizations
- process-candidate-email: candidate_import_jobs, recruiter_inbound_addresses
- process-candidate-import: candidate_activity_log, candidate_documents, candidate_educations, candidate_experiences, candidate_import_jobs, candidate_languages, candidate_notes, candidate_skills, candidates
- process-inbound-email / process-inbound-reply / process-outreach-queue / process-sequences / resend-webhooks: outreach_* Tabellen
- process-interview-notes: candidate_ai_assessment
- process-interview-response: interviews, notifications, profiles, submissions
- process-offer-response: notifications, offer_events, offers, placements, submissions
- process-payout: notifications, payout_requests, placements, stripe_accounts, user_roles
- process-rejection: activity_logs, notifications, rejection_templates, rejections, submissions
- process-talent-hub-action: activity_logs, interviews, notifications, offers, placements, profiles, submissions
- refresh-analytics: deal_health, funnel_metrics, placements, submissions
- request-reference: candidates, reference_requests
- schedule-interview: client_notifications, interviews, notifications, platform_events, submissions
- seed-ml-training-data: candidates, jobs, match_outcomes, ml_training_events
- send-email: candidate_behavior, email_events
- send-interview-invitation: influence_alerts, interviews, notifications, submissions
- send-offer: communication_log, notifications, offer_events, offers
- stripe-connect: profiles, stripe_accounts
- stripe-webhooks: invoices, payment_events, payout_requests, placements, stripe_accounts
- talent-pool-match: jobs, talent_alerts, talent_pool
- track-candidate-engagement: candidate_behavior, platform_events
- track-event: platform_events, sla_deadlines, sla_rules, submissions, user_roles
- track-match-outcome: match_outcomes, submissions
- track-outreach-engagement: outreach_campaigns, outreach_emails

**Secrets-Nutzung (Grep-Zählung):** SUPABASE_SERVICE_ROLE_KEY in 75 Stellen (!), LOVABLE_API_KEY 24, RESEND_API_KEY 8, FIRECRAWL_API_KEY 4, STRIPE_SECRET_KEY 3, STRIPE_WEBHOOK_SECRET 1, PII_REDACTION_MODE 1, ENCRYPTION_KEY 1, GOOGLE_MAPS_API_KEY 1, OPENROUTE_API_KEY 1, OPENROUTER_API_KEY 1.

**verify_jwt = false (24 Funktionen, aus supabase/config.toml):** seed-ml-training-data, calculate-scores, stripe-webhooks, escalation-engine, influence-engine, track-candidate-engagement, calculate-influence-score, process-offer-response, calculate-analytics, accept-invite, talent-pool-match, analyze-reference, geocode-address, process-outreach-queue, track-outreach-engagement, process-inbound-email, process-sequences, process-inbound-reply, resend-webhooks, refresh-analytics, process-interview-response, process-candidate-email, process-candidate-import, oauth-callback

**AI-Calls (LOVABLE_API_KEY, 24 Funktionen):** analyze-reference, assess-candidate-fit, calculate-match, calculate-match-v2, candidate-summary, client-candidate-summary, enrich-company-from-domain, enrich-job-data, format-job-for-recruiters, generate-company-insights, generate-interview-prep, generate-job-expose, generate-job-summary, generate-match-recommendation, generate-outreach-email, generate-embeddings, normalize-skills, parse-cv, parse-job-pdf, parse-job-url, parse-pdf, process-candidate-import, process-inbound-email, process-interview-notes

## 5. Supabase-Schema (aus Migrations, Heuristik)

~125 Tabellen. `ENABLE ROW LEVEL SECURITY` gefunden für praktisch alle — **AUSSER (zu verifizieren!):** `academy_courses`, `academy_enrollments`, `academy_lessons`, `academy_modules`, `academy_profiles` (nur `academy_lesson_progress` taucht im RLS-Grep auf; die Academy-Migration `20260616130000` prüfen — evtl. andere Syntax). RLS *enabled* ≠ RLS *korrekt* — Policy-Qualität ist Team-2-Aufgabe.

Wichtige Domänen: candidates + 20 `candidate_*`-Satellitentabellen, jobs/job_skill_requirements/job_scorecards, submissions, interviews + interview_*, offers/offer_events, placements, payout_requests/stripe_accounts/invoices/payment_events, outreach_* (14 Tabellen), organizations/organization_members/organization_invites, profiles/user_roles, consents/data_deletion_requests/data_export_requests, identity_unlock_logs, match_outcomes/ml_training_events/matching_config, academy_*.

Triple-Blind-relevante Migrations: `20260608120000_auth_hardening_privilege_escalation`, `20260608121000_triple_blind_views_wave_a`, `20260608122000_client_fit_assessment_view`, `20260616120000_client_candidate_view_cv_summary`, `20260616140000_triple_blind_welle_c_revoke_client_raw`, `20260616150000_opt_in_reveals_identity`. Views: client_interviews_view, client_offers_view, client_submissions_view (+ client_candidate_view).

## 6. Datenfluss-Skizze (wo entstehen/verlassen Daten das System)

- **Entstehung Kandidatendaten:** CV-Upload (`parse-cv`, `parse-pdf`, CvUploadDialog), manuelles Formular (CandidateFormDialog), E-Mail-Ingestion (`process-candidate-email` → `process-candidate-import`), HubSpot-Import (HubSpotImportDialog, `hubspot-sync`)
- **Entstehung Firmendaten:** CreateJob/JobIntakeStudio (`extract-intake-briefing`), Crawling (`crawl-company-data`, Firecrawl), `enrich-company-from-domain`
- **Abfluss an AI:** 24 Funktionen → Lovable AI Gateway (LOVABLE_API_KEY) + 1× OPENROUTER. PII-Redaction-Modul existiert in `_shared/pii-redaction.ts`, `PII_REDACTION_MODE` wird nur an 1 Stelle gelesen → Abdeckungsgrad prüfen!
- **Abfluss per E-Mail:** Resend (send-email, send-offer, send-interview-invitation, resend-webhooks, outreach-Queue, request-reference, organization-invite)
- **Abfluss extern:** Stripe (connect/webhooks/payout), HubSpot, OAuth-Integrationen, Firecrawl (Crawling), Google Maps/OpenRoute (Geocoding)

## 7. TODO-Inventar (9 Treffer, vollständig)

- src/components/jobs/JobBoostDialog.tsx:66 — Boost-Notification nicht implementiert
- src/pages/admin/AdminAnalytics.tsx:35 — CSV-Export nicht implementiert
- supabase/functions/calculate-analytics/index.ts:197–201 — 4 KPIs hart auf 0 (time_to_interview/offer/fill, candidate_score)
- supabase/functions/calculate-analytics/index.ts:319 — rank_change hart 0
- supabase/functions/integration-api-key/index.ts:108 — Provider-Testcalls fehlen
- src/pages/recruiter/RecruiterProfile.tsx:329 — False Positive (BIC-Placeholder "XXX")

## 8. Hotspots (größte Dateien)

types.ts 9430 (generiert) · calculate-match-v3-1/index.ts 1902 · crawl-company-data/index.ts 1758 · CreateJob.tsx 1680 · TaskDetailDialog.tsx 1433 · RecruiterDashboard.tsx 1107 · CandidateFormDialog.tsx 1058 · SmartImportDialog.tsx 985 · ExtractedDataWidgetV2.tsx 926 · process-candidate-import/index.ts 902 · LeadImportDialog.tsx 887 · CvUploadDialog.tsx 884 · calculate-match-v2/index.ts 845 · SubmissionDetail.tsx 839 · CandidateSubmitForm.tsx 826

## 9. Sonstiges (verifiziert)

- `.env` ist git-getrackt, enthält aber nur VITE_SUPABASE_PROJECT_ID / PUBLISHABLE_KEY / URL (public). Trotzdem: `.env` fehlt in .gitignore.
- Kein Test-Runner konfiguriert (kein `test`-Script), aber `_shared/pii-redaction.test.ts` existiert. Kein `.github/`-CI im Tree gesehen (zu verifizieren).
- 4 Matching-Generationen koexistieren: calculate-match, -v2, -v3, -v3-1 (+ talent-pool-match, generate-match-recommendation).
- Uncommittete Änderungen u.a. an: assess-candidate-fit, stripe-webhooks, CreateJob, App.tsx, types.ts; neu: src/academy/, JobIntakeStudio, _shared/fit-assessment.ts, pii-redaction.ts, 4 neue Migrations (Academy ×2, Intake ×2).

## 10. Vorbefunde aus früheren Sessions (Hinweise — RE-VERIFIZIEREN, Stand ~2026-06-19)

- Triple-Blind-Reveal-Lücken: Gate client-seitig umgehbar; "Status-Landmine" (Reveal an Statuswechsel gekoppelt); Interview-Pfad C revealed nie; IDOR in Interview-Pfaden; Consent-Lücke. 3+1 fragmentierte Interview-Pfade.
- Reveal-Split-Brain: zwei konkurrierende Reveal-Mechanismen (Status vs. Opt-in/identity_unlock).
- Backend-Defekte: V3.1-Matcher fehlerhaft, tote Embeddings (Queue ohne Verbraucher?), Phantom-Matching-Spalten, toter `recruiter_jobs_view`-Leak.
- PII-Redaction vor AI geplant (macht "K3" zu), Modul existiert — Wiring-Grad unklar.
- Academy Phase 0 gebaut, Migration evtl. noch nicht angewandt.
