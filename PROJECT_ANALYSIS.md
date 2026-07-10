# Hire Speedy AI - Vollständige Projektanalyse

> Erstellt am: 21. Februar 2026
> Projekt: Hire Speedy AI - KI-gestützte Recruiting-Plattform

---

## 1. PROJEKTÜBERSICHT

### 1.1 Was ist Hire Speedy AI?

Hire Speedy AI ist eine umfassende, KI-gestützte Recruiting-Plattform, die drei Benutzergruppen verbindet: **Unternehmen (Clients)**, **Recruiter** und **Plattform-Administratoren**. Die Plattform implementiert ein innovatives **Triple-Blind-Verfahren** zur Anonymisierung von Kandidaten- und Unternehmensdaten, KI-basiertes Matching, Verhaltensanalysen und ein vollständiges Finanzabwicklungssystem.

### 1.2 Tech-Stack

| Kategorie | Technologie |
|-----------|-------------|
| **Frontend-Framework** | React 18 mit TypeScript |
| **Build-Tool** | Vite 5 (mit SWC-Plugin) |
| **Styling** | Tailwind CSS 3.4 + tailwindcss-animate |
| **UI-Komponenten** | shadcn/ui (Radix UI Primitives) |
| **Routing** | React Router DOM 6.30 |
| **State Management** | TanStack React Query 5.83 |
| **Backend/Datenbank** | Supabase (PostgreSQL + Edge Functions) |
| **Formulare** | React Hook Form + Zod-Validierung |
| **Charts** | Recharts 2.15 |
| **Icons** | Lucide React |
| **Toasts** | Sonner + Radix Toast |
| **Datumshandling** | date-fns 3.6 |
| **Theme** | next-themes (Dark Mode) |
| **Linting** | ESLint 9 + TypeScript-ESLint |
| **Entwicklung** | Lovable (lovable-tagger) |

### 1.3 Architektur-Überblick

```
┌─────────────────────────────────────────────────┐
│                  React Frontend                  │
│  (Vite + TypeScript + Tailwind + shadcn/ui)     │
├─────────────────────────────────────────────────┤
│           React Router (SPA-Routing)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  Client   │ │ Recruiter│ │     Admin        │ │
│  │ Dashboard │ │Dashboard │ │   Dashboard      │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
├─────────────────────────────────────────────────┤
│         TanStack React Query (Caching)           │
├─────────────────────────────────────────────────┤
│             Supabase JS Client                   │
├─────────────────────────────────────────────────┤
│                 Supabase Backend                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │PostgreSQL │ │  Edge    │ │  Realtime /      │ │
│  │  + RLS    │ │Functions │ │  Storage         │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 1.4 Projektstatistiken

| Metrik | Anzahl |
|--------|--------|
| **Gesamte Dateien** | ~675 |
| **React-Komponenten** | ~310+ |
| **Seiten (Pages)** | ~70 |
| **Custom Hooks** | 76 |
| **Edge Functions** | 70 |
| **DB-Migrationen** | 78 |
| **UI-Komponenten (shadcn)** | 41 |

---

## 2. DATEISTRUKTUR

```
hire-speedy-ai/
├── .env                          # Supabase-Umgebungsvariablen
├── .lovable/plan.md              # Lovable-Projektplan
├── index.html                    # SPA-Einstiegspunkt
├── package.json                  # Abhängigkeiten & Scripts
├── vite.config.ts                # Vite-Konfiguration mit Pfad-Aliases
├── tailwind.config.ts            # Tailwind-Konfiguration
├── tsconfig.json                 # TypeScript-Konfiguration
├── eslint.config.js              # ESLint-Konfiguration
├── postcss.config.js             # PostCSS-Konfiguration
├── components.json               # shadcn/ui-Konfiguration
│
├── public/
│   ├── favicon.ico
│   ├── placeholder.svg
│   └── robots.txt
│
├── src/
│   ├── App.tsx                   # Haupt-App mit Routing & Providern
│   ├── App.css                   # Globale Styles
│   ├── main.tsx                  # React-Einstiegspunkt
│   ├── vite-env.d.ts             # Vite-Typdeklarationen
│   │
│   ├── assets/
│   │   └── creation-hands.png    # Bild-Asset
│   │
│   ├── components/               # ~310 Komponenten (Details in Sektion 6)
│   │   ├── admin/                # Admin-spezifische Widgets
│   │   ├── analytics/            # Analyse-Komponenten
│   │   ├── behavior/             # Verhaltens-Scoring
│   │   ├── candidates/           # Kandidaten-Management (59 Dateien)
│   │   ├── client/               # Client-spezifische Komponenten
│   │   ├── command/              # Job Command Center
│   │   ├── dashboard/            # Dashboard-Widgets
│   │   ├── dialogs/              # Dialoge & Modals
│   │   ├── expose/               # Kandidaten-Exposés
│   │   ├── files/                # Datei-Upload
│   │   ├── fraud/                # Fraud-Detection UI
│   │   ├── gdpr/                 # DSGVO-Komponenten
│   │   ├── health/               # Deal-Health-Widgets
│   │   ├── influence/            # Recruiter-Influence
│   │   ├── integrations/         # Integration-Einstellungen
│   │   ├── interview/            # Interview-Management (22 Dateien)
│   │   ├── jobs/                 # Job-Verwaltung
│   │   ├── landing/              # Landingpage-Sektionen
│   │   ├── layout/               # Layout-Komponenten
│   │   ├── matching/             # Matching-Konfiguration
│   │   ├── messaging/            # Nachrichtensystem
│   │   ├── notifications/        # Benachrichtigungen
│   │   ├── offers/               # Angebots-Management
│   │   ├── organization/         # Team-Management
│   │   ├── outreach/             # Outreach-System (34 Dateien)
│   │   ├── payment/              # Zahlungsabwicklung
│   │   ├── pipeline/             # Recruiting-Pipeline
│   │   ├── placements/           # Platzierungs-Verwaltung
│   │   ├── ranking/              # Kandidaten-Ranking
│   │   ├── recruiter/            # Recruiter-Komponenten
│   │   ├── references/           # Referenz-Management
│   │   ├── rejection/            # Absage-Management
│   │   ├── sla/                  # SLA-Tracking
│   │   ├── talent/               # Talent-Pool
│   │   ├── ui/                   # shadcn/ui-Basis (41 Dateien)
│   │   └── verification/         # Verifikations-Prozesse
│   │
│   ├── hooks/                    # 76 Custom React Hooks
│   │   ├── use-mobile.tsx
│   │   ├── use-toast.ts
│   │   ├── useAIAssessment.ts
│   │   ├── useBehaviorScore.ts
│   │   ├── useCandidateBehavior.ts
│   │   ├── useClientDashboard.ts
│   │   ├── useMatchScoreV3.ts
│   │   └── ... (weitere 69 Hooks)
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts         # Supabase-Client-Initialisierung
│   │       └── types.ts          # Auto-generierte DB-Typen (273KB)
│   │
│   ├── lib/
│   │   ├── anonymization.ts      # Triple-Blind-Anonymisierung
│   │   ├── anonymousCompanyFormat.ts # Anonyme Firmenformatierung
│   │   ├── auth.tsx              # Auth-Context & Provider
│   │   ├── companyLogo.ts        # Logo-Utilities
│   │   ├── jobPipelineStatus.ts  # Pipeline-Status-Berechnung
│   │   ├── scroll.ts             # Scroll-Hilfsfunktionen
│   │   ├── techStackNormalizer.ts # Tech-Skill-Normalisierung
│   │   └── utils.ts              # Allgemeine Utilities (cn)
│   │
│   └── pages/                    # ~70 Seiten (Details in Sektion 5)
│       ├── admin/                # 22 Admin-Seiten
│       ├── dashboard/            # 19 Client-Dashboard-Seiten
│       ├── interview/            # 2 Interview-Seiten
│       ├── offer/                # 2 Angebots-Seiten
│       ├── onboarding/           # 2 Onboarding-Seiten
│       ├── organization/         # 2 Organisations-Seiten
│       ├── public/               # 9 Öffentliche Seiten
│       ├── recruiter/            # 15 Recruiter-Seiten
│       ├── reference/            # 1 Referenz-Seite
│       ├── Auth.tsx
│       ├── Index.tsx
│       └── NotFound.tsx
│
└── supabase/
    ├── config.toml               # Supabase-Konfiguration
    ├── functions/                 # 70 Edge Functions (Deno/TypeScript)
    └── migrations/               # 78 SQL-Migrationsdateien
```

---

## 3. ROUTING & SEITEN

### 3.1 Öffentliche Routen (ohne Auth)

| Route | Seite | Beschreibung |
|-------|-------|-------------|
| `/` | Index | Landingpage mit Hero, Features, Preise, FAQ |
| `/auth` | Auth | Login/Registrierung (Client, Recruiter, Admin) |
| `/about` | About | Unternehmensseite mit Mission & Vision |
| `/contact` | Contact | Kontaktformular und Firmenkontakt |
| `/blog` | Blog | Blog-Artikel zu KI-Recruiting |
| `/guides` | Guides | Anleitungen, Whitepapers, Videos |
| `/docs` | Docs | API-Dokumentation & Integrationsguides |
| `/help` | Help | Help-Center mit FAQ |
| `/careers` | Careers | Karriere-Seite mit offenen Stellen |
| `/press` | Press | Pressemitteilungen & Media-Assets |
| `/impressum` | Impressum | Rechtliche Angaben (TMG) |
| `/interview/select/:token` | SelectSlot | Kandidaten-Terminwahl |
| `/interview/respond/:token` | InterviewResponsePage | Interview-Antwort (Zusage/Absage/Gegenvorschlag) |
| `/offer/view/:token` | ViewOffer | Angebotsansicht mit digitaler Signatur |
| `/offer/accepted` | OfferAccepted | Bestätigungsseite nach Angebotsannahme |
| `/invite/:token` | AcceptInvite | Team-Einladung annehmen |
| `/reference/:token` | ProvideReference | Referenz abgeben |

### 3.2 Client-Routen (Rolle: client)

| Route | Seite | Beschreibung |
|-------|-------|-------------|
| `/dashboard` | ClientDashboard | Hauptübersicht mit KPIs, Jobs, Talent-Integration |
| `/dashboard/jobs` | JobsList | Alle Stellenausschreibungen |
| `/dashboard/jobs/new` | CreateJob | Neue Stelle anlegen (mit KI-Parsing) |
| `/dashboard/jobs/:id` | ClientJobDetail | Job-Detailansicht mit Pipeline |
| `/dashboard/command/:jobId` | JobCommandCenter | Job-Kontrollzentrum |
| `/dashboard/interviews` | ClientInterviews | Interview-Verwaltung mit Kalender |
| `/dashboard/candidates/:id` | CandidateDetail | Kandidaten-Detailseite (anonymisiert) |
| `/dashboard/placements` | ClientPlacements | Erfolgreiche Vermittlungen |
| `/dashboard/offers` | ClientOffers | Angebots-Verwaltung |
| `/dashboard/messages` | ClientMessages | Messaging-Center |
| `/dashboard/analytics` | ClientAnalytics | Analyse-Dashboard mit Funnels |
| `/dashboard/settings` | ClientSettings | Profil & Firmeneinstellungen |
| `/dashboard/billing` | ClientBilling | Rechnungen & Zahlungen |
| `/dashboard/privacy` | DataPrivacy | DSGVO-Hub (Export, Löschung) |
| `/dashboard/team` | TeamManagement | Team-Verwaltung & Einladungen |
| `/dashboard/integrations` | IntegrationSettings | ATS/HRIS-Integrationen |
| `/onboarding` | ClientOnboarding | Verifikationsprozess (AGB, KYC) |

### 3.3 Recruiter-Routen (Rolle: recruiter)

| Route | Seite | Beschreibung |
|-------|-------|-------------|
| `/recruiter` | RecruiterDashboard | Hauptübersicht mit Pipeline & Alerts |
| `/recruiter/jobs` | RecruiterJobs | Verfügbare Stellen (anonymisiert) |
| `/recruiter/jobs/:id` | JobDetail | Job-Details mit Einreichungsformular |
| `/recruiter/candidates` | RecruiterCandidates | Eigener Kandidaten-Pool |
| `/recruiter/candidates/:id` | RecruiterCandidateDetail | Kandidaten-Details mit Coaching |
| `/recruiter/submissions` | RecruiterSubmissions | Alle Einreichungen mit Funnel |
| `/recruiter/earnings` | RecruiterEarnings | Verdienstübersicht |
| `/recruiter/payouts` | RecruiterPayouts | Auszahlungen & Stripe-Onboarding |
| `/recruiter/notifications` | RecruiterNotifications | Benachrichtigungen |
| `/recruiter/messages` | RecruiterMessages | Messaging |
| `/recruiter/profile` | RecruiterProfile | Profil & Bankverbindung |
| `/recruiter/influence` | RecruiterInfluence | Einfluss-Score & Coaching |
| `/recruiter/talent-pool` | RecruiterTalentPool | Talent-Pool-Verwaltung |
| `/recruiter/integrations` | RecruiterIntegrations | Externe Integrationen |
| `/recruiter/privacy` | RecruiterDataPrivacy | DSGVO-Hub |
| `/recruiter/onboarding` | RecruiterOnboarding | Onboarding (NDA, Vertrag) |

### 3.4 Admin-Routen (Rolle: admin)

| Route | Seite | Beschreibung |
|-------|-------|-------------|
| `/admin` | AdminDashboard | Plattform-Übersicht & Fraud-Alerts |
| `/admin/clients` | AdminClients | Klientenverwaltung & KYC |
| `/admin/recruiters` | AdminRecruiters | Recruiter-Verwaltung & Performance |
| `/admin/jobs` | AdminJobs | Stellenverwaltung & Genehmigung |
| `/admin/candidates` | AdminCandidates | Kandidaten mit Identity-Unlock |
| `/admin/interviews` | AdminInterviews | Globale Interview-Verwaltung |
| `/admin/placements` | AdminPlacements | Alle Platzierungen & Gebühren |
| `/admin/payments` | AdminPayments | Zahlungsabwicklung |
| `/admin/payouts` | AdminPayoutApproval | Auszahlungs-Genehmigung |
| `/admin/invoices` | AdminInvoices | Rechnungsverwaltung |
| `/admin/deal-health` | AdminDealHealth | Deal-Risiko-Analyse |
| `/admin/fraud` | AdminFraud | Fraud-Detection |
| `/admin/analytics` | AdminAnalytics | Plattform-Analytics |
| `/admin/activity` | AdminActivity | Audit-Logs |
| `/admin/users` | AdminUsers | Benutzerverwaltung |
| `/admin/settings` | AdminSettings | Plattform-Konfiguration |
| `/admin/matching-config` | AdminMatchingConfig | KI-Matching-Algorithmus |
| `/admin/domains` | AdminDomains | Fachbereichs-Verwaltung |
| `/admin/skill-synonyms` | AdminSkillSynonyms | Skill-Synonym-Verwaltung |
| `/admin/outreach` | OutreachSlim | Outreach-Kampagnen |
| `/admin/outreach/company/:id` | CompanyDetail | Firmen-Detailseite |

---

## 4. DATENBANKSTRUKTUR (Supabase/PostgreSQL)

### 4.1 Übersicht der Tabellen

Die Datenbank umfasst über 40 Tabellen, gruppiert nach Geschäftsbereichen:

### 4.2 Authentifizierung & Benutzer

#### profiles
Benutzerprofile mit Kontaktdaten, Bankverbindung und Admin-Notizen.
- Spalten: id, user_id (FK → auth.users), email, full_name, company_name, phone, avatar_url, internal_notes, bank_iban, bank_bic, tax_id, company_address, created_at, updated_at

#### user_roles
Rollenzuweisung mit Verifikation und Suspendierung.
- Spalten: id, user_id, role (ENUM: client/recruiter/admin), verified, status, suspended_at, suspension_reason, custom_fee_percentage
- Unique: (user_id, role)

### 4.3 Unternehmen & Verifikation

#### company_profiles
Erweiterte Unternehmensprofile.
- Spalten: id, user_id, company_name, logo_url, industry, website, description, address, tax_id, billing_email, headcount, annual_revenue, founded_year, unique_selling_point, company_awards[], last_enriched_at

#### client_verifications
KYC/KYB-Verifikationsprozess.
- Spalten: id, client_id, terms_accepted, terms_version, contract_signed, contract_pdf_url, digital_signature, kyc_status (pending/verified/rejected), kyc_verified_at, kyc_verified_by, company_registration_number, vat_id

### 4.4 Jobs

#### jobs
Stellenausschreibungen mit umfangreichen Metadaten.
- Spalten: id, client_id, title, company_name, description, requirements, skills[], must_haves[], nice_to_haves[], salary_min, salary_max, location, remote_type, employment_type, experience_level, fee_percentage, recruiter_fee_percentage, status, deadline, screening_questions (JSONB), urgency, industry, tech_environment[], hiring_urgency

### 4.5 Kandidaten & Bewerbungen

#### candidates
Kandidatenprofile (verwaltet durch Recruiter).
- Spalten: id, recruiter_id, full_name, email, phone, linkedin_url, cv_url, video_url, summary, current_salary, expected_salary, notice_period, availability_date, skills[], experience_years, preferred_channel, phone_verified, whatsapp_opt_in, sms_opt_in

#### submissions
Bewerbungen mit Triple-Blind-Feldern.
- Spalten: id, job_id, candidate_id, recruiter_id, status, match_score, client_notes, recruiter_notes, rejection_reason, stage
- **Triple-Blind-Felder**: consent_confirmed, identity_unlocked, unlocked_at, unlocked_by, company_revealed, company_revealed_at, full_access_granted, full_access_granted_at
- Unique: (job_id, candidate_id)
- **Realtime aktiviert**

#### candidate_behavior
Engagement-Tracking mit KI-Bewertungen.
- Spalten: id, submission_id, candidate_id, opt_in_response_time_hours, emails_sent/opened, links_clicked, confidence_score (0-100), interview_readiness_score (0-100), closing_probability (0-100), engagement_level, hesitation_signals (JSONB), motivation_indicators (JSONB)
- **Realtime aktiviert**

#### candidate_conflicts
Konflikterkennung bei Mehrfachbewerbungen.
- Spalten: id, candidate_id, submission_a_id, submission_b_id, conflict_type, severity, resolved, resolution_notes

### 4.6 Interviews & Angebote

#### interviews
Interview-Planung mit Kalender-Integration.
- Spalten: id, submission_id, scheduled_at, duration_minutes, meeting_link, meeting_type, status, notes, feedback, proposed_slots (JSONB), selected_slot_index, calendar_event_id, meeting_format (teams/meet/video/phone/onsite), selection_token, response_token, counter_slots (JSONB)
- **Realtime aktiviert**

#### offers
Jobangebote mit Verhandlungssupport.
- Spalten: id, submission_id, job_id, candidate_id, position_title, salary_offered, salary_currency, bonus_amount, equity_percentage, benefits (JSONB), start_date, contract_type, remote_policy, counter_offer_salary, negotiation_rounds, status, access_token, candidate_signature, client_signature
- **Realtime aktiviert**

### 4.7 Platzierungen & Finanzen

#### placements
Erfolgreiche Vermittlungen.
- Spalten: id, submission_id, start_date, agreed_salary, total_fee, platform_fee, recruiter_payout, payment_status, escrow_status (pending/held/released/disputed/refunded), escrow_release_date

#### invoices
Rechnungen mit Stripe-Integration.
- Spalten: id, placement_id, client_id, invoice_number (unique), amount, tax_amount, total_amount, status, due_date, paid_at, pdf_url, stripe_invoice_id, stripe_payment_intent_id, currency (EUR)

#### payout_requests
Recruiter-Auszahlungsanfragen.
- Spalten: id, placement_id, recruiter_id, amount, currency, status (pending/approved/processing/completed/failed), stripe_transfer_id, approved_by, failure_reason

#### stripe_accounts
Stripe Connect für Recruiter-Auszahlungen.
- Spalten: id, user_id, stripe_account_id, account_type, charges_enabled, payouts_enabled, details_submitted, onboarding_complete

### 4.8 Kommunikation

#### messages
Direktnachrichten (Realtime aktiviert).
- Spalten: id, conversation_id, sender_id, recipient_id, job_id, candidate_id, content, is_read

#### notifications
Benachrichtigungen (Realtime aktiviert).
- Spalten: id, user_id, type, title, message, related_id, related_type, is_read

#### communication_log
Kommunikationshistorie über alle Kanäle.
- Spalten: id, candidate_id, submission_id, channel, message_type, subject, body, status, sent_at, delivered_at, read_at, links_clicked (JSONB)

#### email_events / email_templates / message_templates
E-Mail-Tracking, Vorlagen und Automation.

### 4.9 Recruiter-Management

#### recruiter_performance
Performance-Metriken (Placement Rate, Interview Rate, Response Time, Quality Score).

#### influence_alerts (Realtime aktiviert)
Handlungsempfehlungen mit Prioritäten und Playbook-Verknüpfung. Alert-Typen: opt_in_pending, interview_prep_missing, ghosting_risk, engagement_drop, closing_opportunity, etc.

#### recruiter_influence_scores
Einfluss-Score (0-100) mit Teilmetriken für Opt-In-Beschleunigung, Show-Rate-Verbesserung, Closing-Speed.

#### coaching_playbooks
Strukturierte Sales-Playbooks mit Telefon-Scripts, E-Mail-Templates, WhatsApp-Templates, Talking Points und Objection Handlers.

### 4.10 Deal-Management & Risiko

#### deal_health
Gesundheitsbewertung pro Deal (Health Score 0-100, Risk Level, Drop-Off-Wahrscheinlichkeit, Bottleneck-Erkennung, KI-Assessment).

#### fraud_signals
Fraud-Detection mit Severity, Confidence Score, automatischen Aktionen und manueller Überprüfung.

#### user_behavior_scores
Verhaltensbewertung (Response Time, Ghost Rate, SLA Compliance, Interview Show Rate, Risk Score).

### 4.11 SLA & Events

#### sla_rules / sla_deadlines
SLA-Regeln mit Deadline-Tracking, Eskalation und automatischen Erinnerungen.

#### platform_events
Plattform-übergreifende Events mit Metadaten, Response-Zeit und Session-Tracking.

#### activity_logs
Allgemeine Audit-Logs für Compliance.

### 4.12 DSGVO & Compliance

#### consents
Einwilligungsverwaltung (Typ, Version, Scope, IP, User-Agent).

#### data_export_requests / data_deletion_requests
DSGVO-Export- und Löschanfragen mit Status-Tracking.

#### identity_unlock_logs
Audit-Trail für Identity-Reveals im Triple-Blind-System.

### 4.13 Skill-Management

#### skill_taxonomy
Kanonische Skills mit Aliases, Kategorien und Transferbarkeits-Mapping.

#### skill_synonyms
Bidirektionale Synonyme für verbessertes Matching.

### 4.14 Wichtige Datenbankfunktionen

| Funktion | Zweck |
|----------|-------|
| `has_role(user_id, role)` | Rollenprüfung (SECURITY DEFINER) |
| `get_user_role(user_id)` | Rolle abrufen |
| `handle_new_user()` | Auto-Profilerstellung bei Signup (Trigger) |
| `update_updated_at()` | Automatische Timestamp-Aktualisierung |
| `reveal_company_on_opt_in()` | Triple-Blind Stufe 1: Firma offenlegen |
| `grant_full_access_on_interview_confirm()` | Triple-Blind Stufe 2: Vollzugriff |

### 4.15 Row Level Security (RLS)

Alle Tabellen verwenden RLS-Policies mit folgenden Strategien:
- **Profil-basiert**: Benutzer sehen nur eigene Daten
- **Rollen-basiert**: Unterschiedliche Zugriffe je Rolle (Client/Recruiter/Admin)
- **Beziehungs-basiert**: Zugriff auf verwandte Entitäten (z.B. Submissions → Jobs)
- **System-basiert**: Nur Backend-Funktionen dürfen bestimmte Tabellen beschreiben (Events, Fraud)
- **Admin**: Vollzugriff auf alle Daten

### 4.16 Realtime-Tabellen

Folgende Tabellen sind für Echtzeit-Updates via Supabase Realtime aktiviert: notifications, messages, submissions, interviews, offers, offer_events, influence_alerts, candidate_behavior.

---

## 5. SEITEN IM DETAIL

### 5.1 Öffentliche Seiten

| Seite | Beschreibung |
|-------|-------------|
| **Index** | Landingpage mit Hero, Features, Lösungen für Unternehmen/Recruiter, Fallstudien, Preise, Sicherheit, FAQ |
| **Auth** | Tab-basierte Anmeldung/Registrierung mit Rollenwahl und Dashboard-Weiterleitung |
| **About** | Unternehmensseite mit Mission, Vision und Werten |
| **Contact** | Kontaktformular mit Telefon, E-Mail und Adresse |
| **Blog** | Artikel zu KI-Recruiting mit Autor und Lesezeit |
| **Guides** | Step-by-Step-Guides, Whitepapers, Videos |
| **Docs** | API-Referenz und Integrationsanleitungen |
| **Help** | FAQ-Center mit Kategorien und Suchfunktion |
| **Careers** | Offene Stellen mit Abteilungsübersicht |
| **Press** | Pressemitteilungen und Media-Assets |
| **Impressum** | Rechtliche Angaben gemäß TMG |

### 5.2 Client-Dashboard

| Seite | Beschreibung |
|-------|-------------|
| **ClientDashboard** | Hauptübersicht mit Verifikations-Banner, Live-Jobs, Metriken |
| **JobsList** | Alle Stellen mit Health-Indikatoren und Filtern |
| **CreateJob** | Job-Erstellung mit KI-Parsing aus PDF/Text |
| **ClientJobDetail** | Job-Details mit Pipeline, Top-Kandidaten, Recruiter-Aktivität |
| **JobCommandCenter** | Kontrollzentrum mit Health-Scores pro Job |
| **CandidateDetail** | Anonymisierte Kandidatenansicht mit Deal-Health und Match-Score |
| **ClientInterviews** | Kalender, Stats, Feedback-Formulare, Keyboard-Shortcuts |
| **ClientPlacements** | Erfolgreiche Vermittlungen mit Zahlungsstatus |
| **ClientOffers** | Angebotsverwaltung mit Status-Tracking |
| **ClientAnalytics** | Conversion-Funnels und Export-Funktionalität |
| **ClientMessages** | Messaging mit Recruitern |
| **ClientSettings** | Profil- und Firmeneinstellungen |
| **ClientBilling** | Rechnungen und Zahlungen |
| **DataPrivacy** | DSGVO: Export, Löschung, Einwilligungen |
| **TeamManagement** | Team-Mitglieder und Einladungen |
| **IntegrationSettings** | ATS/HRIS-Verbindungen |
| **ClientOnboarding** | Verifikation: AGB, Vertrag, KYC |

### 5.3 Recruiter-Dashboard

| Seite | Beschreibung |
|-------|-------------|
| **RecruiterDashboard** | Übersicht mit Stats, Influence-Alerts, Pipeline |
| **RecruiterJobs** | Verfügbare Stellen (anonymisierte Firmen) |
| **JobDetail** | Stellendetails mit Einreichungsformular und Gebührenrechner |
| **RecruiterCandidates** | Kandidatenpool mit HubSpot-Import und CV-Upload |
| **RecruiterCandidateDetail** | Kandidaten mit Coaching-Playbook-Panel |
| **RecruiterSubmissions** | Einreichungen mit Funnel und Verhaltensmetriken |
| **RecruiterEarnings** | Verdienstübersicht pro Platzierung |
| **RecruiterPayouts** | Auszahlungen mit Stripe Connect |
| **RecruiterNotifications** | Benachrichtigungszentrum |
| **RecruiterMessages** | Messaging mit Clients |
| **RecruiterProfile** | Profil, Bankdaten, Performance-Stats |
| **RecruiterInfluence** | Einfluss-Score, Leaderboard, Coaching |
| **RecruiterTalentPool** | Talent-Pool für zukünftige Positionen |
| **RecruiterIntegrations** | Externe Service-Verbindungen |
| **RecruiterDataPrivacy** | DSGVO-Hub |
| **RecruiterOnboarding** | Onboarding: NDA, Rahmenvertrag, Profil |

### 5.4 Admin-Dashboard

| Seite | Beschreibung |
|-------|-------------|
| **AdminDashboard** | Plattform-KPIs, Fraud-Alerts, ausstehende KYC |
| **AdminClients** | Klientenverwaltung mit Verifikationsstatus |
| **AdminRecruiters** | Recruiter mit Gebühren und Performance |
| **AdminJobs** | Stellengenehmigung und Status-Tracking |
| **AdminCandidates** | Kandidaten mit Identity-Unlock |
| **AdminInterviews** | Globale Interview-Verwaltung |
| **AdminPlacements** | Platzierungen mit Gebührenaufschlüsselung |
| **AdminPayments** | Zahlungsabwicklung |
| **AdminPayoutApproval** | Auszahlungs-Genehmigungsworkflow |
| **AdminInvoices** | Rechnungsverwaltung |
| **AdminDealHealth** | Deal-Risiko-Analyse |
| **AdminFraud** | Fraud-Detection mit Severity-Klassifizierung |
| **AdminAnalytics** | Funnel-Analyse und Recruiter-Leaderboard |
| **AdminActivity** | Audit-Logs für Compliance |
| **AdminUsers** | Benutzerverwaltung über alle Rollen |
| **AdminSettings** | Gebühren, E-Mail, Automatisierungsregeln |
| **AdminMatchingConfig** | KI-Matching-Gewichtungen und Schwellwerte |
| **AdminDomains** | Fachbereiche und Transferbarkeitsregeln |
| **AdminSkillSynonyms** | Skill-Synonyme für Matching |
| **OutreachSlim** | Outreach mit Leads, Kontakten, E-Mails |
| **CompanyDetail** | Firmen-Details für Outreach |

---

## 6. KOMPONENTEN IM DETAIL

### 6.1 Admin-Komponenten (3 Dateien)

| Komponente | Beschreibung |
|-----------|-------------|
| EmbeddingHealthWidget | Zeigt Gesundheitsstatus der KI-Embeddings |
| JobApprovalDialog | Dialog zur Stellengenehmigung durch Admins |
| MLHealthWidget | Dashboard-Widget für ML-System-Gesundheit |

### 6.2 Analytics-Komponenten (6 Dateien)

| Komponente | Beschreibung |
|-----------|-------------|
| ConversionRateCard | Conversion-Rate-Anzeige mit Trend |
| DropOffAnalysis | Analyse der Abbruchpunkte im Funnel |
| FunnelChart | Visualisierung des Recruiting-Funnels |
| MetricCard | Wiederverwendbare Metrik-Karte |
| PeriodSelector | Zeitraumselektor (7/30/90 Tage) |
| RecruiterLeaderboardComponent | Recruiter-Rangliste |

### 6.3 Behavior-Komponente (1 Datei)

| Komponente | Beschreibung |
|-----------|-------------|
| BehaviorScoreBadge | Farbcodiertes Badge für Verhaltens-Score |

### 6.4 Kandidaten-Komponenten (59 Dateien)

| Komponente | Beschreibung |
|-----------|-------------|
| AIAssessmentPanel | KI-Bewertungspanel mit Risiken und Chancen |
| AnonymizedCandidateCard | Anonymisierte Kandidatenkarte (Triple-Blind) |
| CandidateActionButtons | Aktions-Buttons (Interview, Ablehnung, etc.) |
| CandidateActivityTimeline | Zeitstrahl der Kandidatenaktivitäten |
| CandidateBehaviorPanel | Engagement-Metriken und Verhaltensdaten |
| CandidateCard | Standard-Kandidatenkarte |
| CandidateCompareDialog | Seite-an-Seite-Vergleich von Kandidaten |
| CandidateConflictsPanel | Konflikterkennung bei Mehrfachbewerbungen |
| CandidateDetailHeader | Header mit Name, Foto, Status |
| CandidateDocuments | Dokument-Upload und -Verwaltung |
| CandidateEngagementTimeline | Engagement-Verlauf |
| CandidateFilterBar | Such- und Filter-Leiste |
| CandidateFormDialog | Formular zur Kandidatenerfassung |
| CandidateHeroSection | Hero-Bereich der Detailseite |
| CandidateInfluencePanel | Einfluss-Panel für Recruiter |
| CandidateList | Kandidaten-Listenansicht |
| CandidateMatchBreakdown | Aufschlüsselung des Match-Scores |
| CandidateProjects | Projekt-Portfolio des Kandidaten |
| CandidateProfileTabs | Tabs für verschiedene Profilbereiche |
| CandidateRankingBadge | Ranking-Position-Badge |
| CandidateStageProgress | Fortschrittsanzeige durch Pipeline-Phasen |
| CandidateSupportContent | Vorbereitungsmaterialien |
| CandidateTable | Tabellarische Kandidatenansicht |
| CandidateTags | Tag-Verwaltung |
| CandidateTimeline | Prozess-Timeline |
| ClientSummaryPanel | KI-generierte Client-Zusammenfassung |
| CoachingPlaybookPanel | Coaching-Panel mit Scripts und Templates |
| DealHealthBadge | Deal-Gesundheits-Badge |
| IdentityRevealSection | Triple-Blind Identity-Reveal |
| InterviewSection | Interview-Bereich in Kandidatendetails |
| MatchScoreCircle | Kreisdiagramm für Match-Score |
| OptInStatusBanner | Opt-In-Statusanzeige |
| ProcessTracker | Bewerbungsprozess-Tracker |
| SubmissionFunnelGrid | Funnel-Grid für Einreichungen |
| TripleBlindExplainer | Erklärung des Triple-Blind-Systems |
| ... | (und weitere spezialisierte Komponenten) |

### 6.5 Client-Komponenten (7 Dateien)

| Komponente | Beschreibung |
|-----------|-------------|
| ClientDashboardStats | KPI-Karten im Dashboard |
| ClientJobHealthCard | Job-Gesundheitsanzeige |
| JobImportSection | Schneller Job-Import |
| TalentIntegrationSection | Talent-Integration-Hub |
| UnifiedActionCenter | Zentrales Aktions-Center |
| VerificationBanner | Verifikations-Status-Banner |
| ... | (weitere Client-spezifische Widgets) |

### 6.6 Command-Komponenten (3 Dateien)

| Komponente | Beschreibung |
|-----------|-------------|
| JobCommandCard | Kontrollkarte pro Job |
| RecruitingHealthScore | Gesundheits-Score der Recruiting-Pipeline |
| ... | (weitere Command-Center-Widgets) |

### 6.7 Dashboard-Komponenten (17 Dateien)

Allgemeine Dashboard-Widgets wie Sidebar, Navbar, StatsCards und spezifische Verwaltungskomponenten für Jobs, Interviews und Kandidaten.

### 6.8 Dialog-Komponenten (7+ Dateien)

Interview-Wizard-Dialoge, Confirmation-Dialoge und spezialisierte Eingabeformulare.

### 6.9 Expose-Komponenten (3 Dateien)

Kandidaten-Exposé-Erstellung mit anonymisierten Profildaten für Clients.

### 6.10 Fraud-Komponenten (2 Dateien)

Fraud-Signal-Liste und Detail-Ansicht für Admin-Überprüfung.

### 6.11 GDPR-Komponenten (4 Dateien)

| Komponente | Beschreibung |
|-----------|-------------|
| CookieConsentBanner | Cookie-Einwilligungsbanner |
| ConsentManager | Einwilligungsverwaltung |
| DataExportPanel | Datenexport-Anfrage |
| DataDeletionPanel | Datenlöschung-Anfrage |

### 6.12 Health-Komponenten (2 Dateien)

Deal-Health-Badge und Detail-Widgets.

### 6.13 Influence-Komponenten (12 Dateien)

Einfluss-Score-Anzeige, Power-Three-Aktionen, Performance-Metriken, Team-Leaderboard und Coaching-Integration.

### 6.14 Integration-Komponenten (4 Dateien)

Konfiguration für ATS, HRIS und Kalender-Integrationen.

### 6.15 Interview-Komponenten (22 Dateien)

| Komponente | Beschreibung |
|-----------|-------------|
| InterviewCalendar | Kalenderansicht für Interviews |
| InterviewCard | Interview-Karte mit Status |
| InterviewFeedbackForm | Feedback-Formular nach Interviews |
| InterviewNotesEditor | Notiz-Editor mit KI-Analyse |
| InterviewScheduleDialog | Terminplanungs-Dialog |
| InterviewSlotPicker | Zeitfenster-Auswahl |
| InterviewStatsCards | Interview-Statistiken |
| InterviewTimeline | Interview-Prozess-Timeline |
| ... | (weitere spezialisierte Interview-Komponenten) |

### 6.16 Jobs-Komponenten (13 Dateien)

Job-Karten, Job-Formulare, Job-Parser, Screening-Fragen-Editor, Skill-Tag-Verwaltung.

### 6.17 Landing-Komponenten (18 Dateien)

Navbar, Hero-Section, Features, Pricing, FAQ, Footer und weitere Landingpage-Sektionen.

### 6.18 Layout-Komponenten (4 Dateien)

| Komponente | Beschreibung |
|-----------|-------------|
| DashboardLayout | Haupt-Layout mit Sidebar und Header |
| RecruiterLayout | Recruiter-spezifisches Layout |
| AdminLayout | Admin-spezifisches Layout |
| PublicLayout | Layout für öffentliche Seiten |

### 6.19 Messaging-Komponenten (4+ Dateien)

Konversationsliste, Nachrichtenchat, Nachrichtenformular.

### 6.20 Offers-Komponenten (5 Dateien)

Angebotserstellung, Angebotsansicht, Verhandlungsdialog, Signatur-Pad.

### 6.21 Organization-Komponenten (3 Dateien)

Team-Einladungsdialog, Mitgliederliste, Rollenauswahl.

### 6.22 Outreach-Komponenten (34 Dateien)

Lead-Import, Kampagnenverwaltung, E-Mail-Composer, Sequenz-Builder, CareerCrawl-Integration, Kontaktverwaltung, Unternehmensprofile.

### 6.23 Payment-Komponenten (3 Dateien)

Stripe-Onboarding, Auszahlungsanfrage, Zahlungsstatus.

### 6.24 Pipeline-Komponenten (4 Dateien)

Kanban-Board, Pipeline-Spalten, Drag-Drop-Karten.

### 6.25 Ranking-Komponenten (3 Dateien)

Ranking-Tabelle, Score-Vergleich, Position-Badge.

### 6.26 Recruiter-Komponenten (15 Dateien)

Recruiter-spezifische Dashboard-Widgets, Performance-Karten, Einreichungsformulare.

### 6.27 References-Komponenten (2 Dateien)

Referenzanfrage und Referenzformular.

### 6.28 Rejection-Komponenten (2 Dateien)

Absage-Dialog mit Templates und KI-Verbesserungsvorschlägen.

### 6.29 SLA-Komponenten (2 Dateien)

SLA-Timeline und Deadline-Tracker.

### 6.30 Talent-Komponenten (11 Dateien)

Talent-Pool-Karten, Talent-Hub-Aktionen, Talent-Vergleich.

### 6.31 UI-Komponenten (shadcn/ui - 41 Dateien)

Vollständige shadcn/ui-Bibliothek: Accordion, Alert, Avatar, Badge, Button, Calendar, Card, Checkbox, Command, Dialog, Dropdown-Menu, Form, Input, Label, Popover, Progress, Radio-Group, ScrollArea, Select, Separator, Sheet, Sidebar, Skeleton, Slider, Switch, Table, Tabs, Textarea, Toast, Toggle, Tooltip und weitere.

### 6.32 Verification-Komponenten (2 Dateien)

Verifikations-Wizard und Dokumenten-Upload für KYC.

---

## 7. LIBRARY-DATEIEN (src/lib/)

| Datei | Beschreibung |
|-------|-------------|
| **anonymization.ts** | Triple-Blind-Hilfsfunktionen: anonyme IDs, regionaler Anonymisierung, Gehalts-/Erfahrungsanonymisierung |
| **anonymousCompanyFormat.ts** | Formatierung anonymer Firmeninformationen für Recruiter-Ansicht |
| **auth.tsx** | Auth-Context mit useAuth() Hook, signUp/signIn/signOut, automatische Rollensynchronisierung |
| **companyLogo.ts** | Logo-URLs mit Fallback (direkt → Clearbit → UI Avatar) |
| **jobPipelineStatus.ts** | Pipeline-Stage-Berechnung und Health-Status (excellent/good/warning/critical) |
| **scroll.ts** | Glattes Scrollen mit Header-Offset |
| **techStackNormalizer.ts** | Tech-Skill-Normalisierung und Kategorisierung (Frontend/Backend/Cloud/Data/Mobile/AI) |
| **utils.ts** | cn() für Tailwind-Klassenkombination |

---

## 8. HOOKS IM DETAIL (76 Custom Hooks)

### 8.1 KI & Assessment
- **useAIAssessment**: KI-Bewertung mit Risiken, Chancen, Placement-Wahrscheinlichkeit
- **useMatchScoreV2/V3/V31**: Match-Engine in verschiedenen Versionen
- **useClientCandidateSummary**: KI-generierte Zusammenfassungen

### 8.2 Kandidaten-Management
- **useCandidateBehavior**: Engagement-Tracking (Emails, Links, Confidence)
- **useCandidateActivityLog**: Aktivitätsverlauf und Logger
- **useCandidateConflicts**: Konflikterkennung und -lösung
- **useCandidateDocuments**: Upload/Download mit Versionierung
- **useCandidateProjects**: Projekt-Portfolio
- **useCandidateRanking**: Ranking nach Match-Score
- **useCandidateTags**: Tag-System mit Farben

### 8.3 Client-Interface
- **useClientDashboard**: Aggregierte Dashboard-Daten (30s Cache)
- **useClientCandidateView**: Zentrale Triple-Blind-Ansicht
- **useClientTasks**: Task-Aggregation mit Dringlichkeitsberechnung
- **useClientVerification**: KYC-Status und Fortschritt

### 8.4 Interview & Scheduling
- **useInterviewScheduling**: Terminplanung
- **useInterviewNotes**: Notizen mit KI-Analyse
- **useCalendarAvailability**: Google/Microsoft-Kalender-Integration

### 8.5 Job & Matching
- **useJobParsing**: KI-gestütztes Parsen von Job-PDFs/URLs
- **useJobEnrichment**: Datenanreicherung
- **useHiringPipeline**: Pipeline-Verwaltung

### 8.6 Outreach & Recruiting
- **useOutreach / useOutreachCompanies**: Lead-Verwaltung
- **useCompanyImport**: Firmen-Import
- **useCareerCrawl**: Career-Page Web-Scraping

### 8.7 Realtime
- **useRealtimeMessages**: Live-Chat
- **useRealtimeNotifications**: Live-Benachrichtigungen
- **useRealtimeSubmissions**: Live-Bewerbungs-Updates

### 8.8 Finanzen & Zahlungen
- **usePayouts**: Auszahlungsverwaltung
- **useStripeConnect**: Stripe-Onboarding

### 8.9 Sonstige
- **useBehaviorScore**: Verhaltens-Scoring mit SLA-Deadlines
- **useCoachingPlaybook**: Sales-Playbooks und Scripts
- **usePermissions**: Rollen-basierte Zugriffskontrolle
- **useOrganization**: Team-Verwaltung
- **useOffers**: Angebots-CRUD
- **useTalentPool**: Talent-Pool-Verwaltung

---

## 9. EDGE FUNCTIONS (70 Serverless Functions)

### 9.1 Matching & Scoring
| Funktion | Beschreibung |
|----------|-------------|
| calculate-match (v1-v3.1) | KI-Matching in 4 Generationen |
| calculate-scores | Score-Berechnung |
| candidate-retrieval | Kandidaten-Suche und -Abruf |
| generate-embeddings | Vektor-Embeddings für Matching |
| generate-match-recommendation | KI-Empfehlungen |
| normalize-skills | Skill-Normalisierung |
| talent-pool-match | Talent-Pool-Matching |

### 9.2 KI & Analyse
| Funktion | Beschreibung |
|----------|-------------|
| candidate-summary | Kandidaten-Zusammenfassung |
| client-candidate-summary | Client-Zusammenfassung |
| generate-interview-prep | Interview-Vorbereitung |
| generate-job-summary | Job-Zusammenfassung |
| process-interview-notes | Interview-Notizen-Analyse |
| analyze-reference | Referenz-Analyse |
| deal-health | Deal-Gesundheitsbewertung |
| fraud-detection | Betrugs-Erkennung |
| influence-engine | Einfluss-Engine |

### 9.3 Kommunikation
| Funktion | Beschreibung |
|----------|-------------|
| send-email | E-Mail-Versand |
| send-interview-invitation | Interview-Einladung |
| send-offer | Angebot versenden |
| generate-outreach-email | KI-Outreach-Emails |
| process-inbound-email/reply | Eingehende E-Mails verarbeiten |
| process-rejection | Absagen verarbeiten |

### 9.4 Interview & Offer
| Funktion | Beschreibung |
|----------|-------------|
| schedule-interview | Interview planen |
| process-interview-response | Interview-Antworten |
| create-offer | Angebot erstellen |
| process-offer-response | Angebotsantworten |
| request-reference | Referenz anfordern |

### 9.5 Job-Verarbeitung
| Funktion | Beschreibung |
|----------|-------------|
| parse-cv / parse-pdf | CV/PDF-Parsing |
| parse-job-pdf / parse-job-url | Job-Parsing aus PDF/URL |
| enrich-job-data | Job-Datenanreicherung |
| extract-intake-briefing | Intake-Briefing |
| format-job-for-recruiters | Job-Formatierung für Recruiter |
| generate-cv-pdf | CV-PDF-Generierung |

### 9.6 Outreach & Enrichment
| Funktion | Beschreibung |
|----------|-------------|
| crawl-career-page(s-bulk) | Career-Page Scraping |
| crawl-company-data | Firmendaten-Scraping |
| enrich-company-from-domain | Domain-basierte Anreicherung |
| generate-company-insights | Firmen-Insights |
| geocode-address | Adress-Geocoding |
| import-outreach-leads | Lead-Import |
| process-outreach-queue | Outreach-Queue |
| process-sequences | E-Mail-Sequenzen |

### 9.7 Tracking & Events
| Funktion | Beschreibung |
|----------|-------------|
| track-event | Event-Tracking |
| track-candidate-engagement | Engagement-Tracking |
| track-match-outcome | Match-Ergebnis-Tracking |
| track-outreach-engagement | Outreach-Engagement |
| calculate-analytics | Analytik-Berechnung |
| refresh-analytics | Analytik-Refresh |
| calculate-influence-score | Einfluss-Score |

### 9.8 Finanzen & Integration
| Funktion | Beschreibung |
|----------|-------------|
| stripe-webhooks | Stripe-Webhook-Handler |
| stripe-connect | Stripe-Connect-Onboarding |
| process-payout | Auszahlungsverarbeitung |
| resend-webhooks | Resend (E-Mail-Provider) |
| hubspot-sync | HubSpot-Synchronisierung |

### 9.9 DSGVO & Compliance
| Funktion | Beschreibung |
|----------|-------------|
| gdpr-export | Datenexport |
| gdpr-deletion | Datenlöschung |
| detect-candidate-conflicts | Kandidaten-Konflikte |

### 9.10 Organisation & Automation
| Funktion | Beschreibung |
|----------|-------------|
| organization-invite | Team-Einladungen |
| accept-invite | Einladung annehmen |
| automation-hub | Automatisierungszentrale |
| escalation-engine | Eskalations-Engine |
| process-talent-hub-action | Talent-Hub-Aktionen |
| client-dashboard-data | Dashboard-Daten |
| seed-ml-training-data | ML-Trainingsdaten |

---

## 10. AKTUELLER STATUS

### 10.1 Was funktioniert (implementiert)

**Frontend komplett aufgebaut:**
- Vollständige SPA mit 70+ Seiten und 310+ Komponenten
- Rollenbasiertes Routing (Client, Recruiter, Admin)
- Responsive Design mit Dark Mode
- Umfangreiche UI mit shadcn/ui
- DSGVO-Cookie-Banner

**Datenbank vollständig migriert:**
- 40+ Tabellen mit RLS-Policies
- Realtime-Subscriptions für 8 Tabellen
- Vollständige Trigger und Funktionen
- Storage Bucket für Dokumente

**Backend-Logik:**
- 70 Edge Functions für alle Geschäftsprozesse
- KI-Matching in 4 Generationen (v1-v3.1)
- Triple-Blind-Anonymisierung
- Stripe-Integration für Zahlungen
- E-Mail-Versand über Resend
- HubSpot-Synchronisierung

**Kernprozesse:**
- Kompletter Recruiting-Workflow (Job → Submission → Interview → Offer → Placement)
- Onboarding-Flows für Clients und Recruiter
- KYC/Verifikation mit digitaler Signatur
- Coaching-Playbooks mit Telefon-Scripts
- Influence-Score-System für Recruiter
- Deal-Health-Monitoring
- Fraud-Detection

### 10.2 Was möglicherweise fehlt / zu verbessern

**Infrastruktur:**
- Keine Unit-Tests vorhanden (kein Test-Framework in dependencies)
- Keine E2E-Tests (kein Playwright/Cypress)
- Kein CI/CD-Pipeline konfiguriert
- Keine Storybook-Dokumentation der UI-Komponenten

**Frontend:**
- Keine i18n/Lokalisierung (UI-Texte sind gemischt Deutsch/Englisch)
- Keine PWA-Konfiguration
- Keine Service Worker für Offline-Funktionalität
- Error Boundaries könnten umfassender sein

**Backend:**
- Edge Functions haben vermutlich keine Unit-Tests
- Kein Rate-Limiting auf API-Ebene dokumentiert
- Backup-Strategie nicht im Code sichtbar
- Monitoring/Alerting nicht konfiguriert

**Sicherheit:**
- .env-Datei enthält Supabase-Keys (sollte in CI/CD-Variablen sein)
- CORS-Konfiguration nicht explizit dokumentiert
- API-Keys für externe Services nicht im Repo (gut, aber Dokumentation fehlt)

**Dokumentation:**
- Keine API-Dokumentation (OpenAPI/Swagger) für Edge Functions
- Keine Architekturdokumentation (bis jetzt)
- Keine Contributing-Guidelines
- Keine Deployment-Dokumentation

---

## 11. BESONDERE ARCHITEKTUR-MERKMALE

### 11.1 Triple-Blind-System

Das Herzstück der Plattform ist ein dreistufiges Anonymisierungssystem:

1. **Stufe 1 (Blindbewerbung)**: Kandidaten und Unternehmen sind füreinander vollständig anonym. Recruiter sehen anonymisierte Firmenprofile, Clients sehen anonymisierte Kandidatenprofile.

2. **Stufe 2 (Opt-In → Firmenoffenlegung)**: Nach Kandidaten-Opt-In wird der Firmenname offengelegt (Trigger: `reveal_company_on_opt_in`).

3. **Stufe 3 (Interview-Bestätigung → Vollzugriff)**: Nach Interview-Bestätigung erhalten alle Parteien vollständigen Zugriff (Trigger: `grant_full_access_on_interview_confirm`).

### 11.2 KI-Matching-Evolution

Das Matching-System wurde in 4 Generationen entwickelt:
- **V1**: Basis-Matching
- **V2**: Erweitertes Scoring
- **V3**: Embedding-basiertes Matching
- **V3.1**: Optimiertes Matching mit Feedback-Loop

### 11.3 Influence-Engine

Einzigartiges System zur Recruiter-Optimierung:
- Echtzeit-Alerts mit priorisierten Handlungsempfehlungen
- Coaching-Playbooks mit konkreten Telefon-Scripts
- Influence-Score (0-100) basierend auf Aktionserfolg
- Team-Leaderboard für gamifizierte Motivation

### 11.4 Deal-Health-Monitoring

Proaktive Überwachung aller aktiven Deals:
- Health-Score (0-100) mit Risiko-Klassifizierung
- Bottleneck-Erkennung (wer blockiert?)
- Drop-Off-Wahrscheinlichkeit
- KI-generierte Handlungsempfehlungen

---

## 12. ZUSAMMENFASSUNG

Hire Speedy AI ist eine technisch anspruchsvolle, voll ausgestattete Recruiting-Plattform mit ca. 675 Dateien und einem ausgereiften Tech-Stack. Die Plattform zeichnet sich besonders durch das innovative Triple-Blind-System, die KI-gestützte Matching-Engine, das Influence-System für Recruiter und das umfassende Deal-Health-Monitoring aus. Das Frontend ist komplett aufgebaut und das Backend bietet 70 Edge Functions für alle Geschäftsprozesse. Hauptsächliche Verbesserungspotenziale liegen bei Tests, Dokumentation und Infrastruktur-Automation.
