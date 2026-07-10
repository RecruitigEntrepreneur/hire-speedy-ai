-- ============================================================================
-- Unternehmensprofil · Masterprompt-Felder (Phase 1 des COMPANY_PROFILE_MASTERPLAN)
-- Additiv: nur neue Spalten auf company_profiles. Kein Datenverlust.
-- RLS unverändert ("owner manages own company_profile" deckt neue Spalten ab).
-- WICHTIG: contacts / target_companies / excluded_companies / data_sources sind
-- client-privat und dürfen NIE an Recruiter/Kandidaten exponiert werden.
-- ============================================================================

ALTER TABLE public.company_profiles
  -- ── A. Unternehmensdaten (Identifikation/Stammdaten) ──────────────────────
  ADD COLUMN IF NOT EXISTS legal_name              text,
  ADD COLUMN IF NOT EXISTS linkedin_url            text,
  ADD COLUMN IF NOT EXISTS career_page_url         text,
  ADD COLUMN IF NOT EXISTS sub_industry            text,
  ADD COLUMN IF NOT EXISTS company_size            text,        -- Größen-Bucket (1-10 … 10.000+), getrennt von headcount(int)
  ADD COLUMN IF NOT EXISTS email_domains           text[]  DEFAULT '{}',

  -- ── B. Employer Branding ──────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS employer_selling_points jsonb   DEFAULT '[]',  -- priorisierte 3-5 Arbeitgeberargumente (geordnet)
  ADD COLUMN IF NOT EXISTS products_services       jsonb   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS target_markets          jsonb   DEFAULT '[]',

  -- ── C. Kultur & Fit ───────────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS personality_fit         jsonb   DEFAULT '[]',  -- passende Persönlichkeiten (Mehrfachauswahl)
  ADD COLUMN IF NOT EXISTS personality_no_fit      text,                  -- nicht passende Persönlichkeiten (Freitext)

  -- ── F. Hiring-Prozess ─────────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS default_hiring_process  jsonb   DEFAULT '[]',  -- geordnete Standard-Prozessschritte
  ADD COLUMN IF NOT EXISTS interview_rounds        integer,
  ADD COLUMN IF NOT EXISTS feedback_speed          text,                  -- z.B. "innerhalb 48h"
  ADD COLUMN IF NOT EXISTS average_hiring_duration text,                  -- z.B. "4-6 Wochen"

  -- ── G. Zielkandidaten & Marktumfeld (CLIENT-PRIVAT) ──────────────────────
  ADD COLUMN IF NOT EXISTS target_companies        text[]  DEFAULT '{}',  -- firmenweite Default-Zielunternehmen
  ADD COLUMN IF NOT EXISTS excluded_companies      text[]  DEFAULT '{}',  -- No-Go-Unternehmen

  -- ── H. Ansprechpartner & Rollen (CLIENT-PRIVAT, Stammdaten ≠ Login) ───────
  ADD COLUMN IF NOT EXISTS contacts                jsonb   DEFAULT '[]',  -- {first_name,last_name,position,email,phone,role}

  -- ── Verifizierungs- & Provenienz-Status (für Enrichment, Phase 5) ────────
  ADD COLUMN IF NOT EXISTS field_verification      jsonb   DEFAULT '{}',  -- feld -> erkannt|bestaetigt|bearbeitet|manuell|unsicher|veraltet|nicht_gefunden
  ADD COLUMN IF NOT EXISTS data_sources            jsonb   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS last_customer_verified_at timestamptz,

  -- ── Onboarding & Profilqualität ──────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS onboarding_status       jsonb   DEFAULT '{}',  -- first_login_completed, company_identified, company_profile_reviewed
  ADD COLUMN IF NOT EXISTS quality_score           numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_breakdown       jsonb   DEFAULT '{}';

COMMENT ON COLUMN public.company_profiles.contacts IS
  'Client-privat: Ansprechpartner-Stammdaten (kein Login-Account). NIE an Recruiter/Kandidaten exponieren.';
COMMENT ON COLUMN public.company_profiles.excluded_companies IS
  'Client-privat: No-Go-Unternehmen. NIE exponieren (Re-Identifikationsrisiko).';
COMMENT ON COLUMN public.company_profiles.target_companies IS
  'Client-privat: Default-Zielunternehmen fürs Sourcing. NIE an Kandidaten exponieren.';
COMMENT ON COLUMN public.company_profiles.employer_selling_points IS
  'Geordnete Liste der wichtigsten 3-5 Arbeitgeberargumente (Masterprompt §11 Bereich 6).';
COMMENT ON COLUMN public.company_profiles.onboarding_status IS
  'Profil-Wizard-Fortschritt: {first_login_completed, company_identified, company_profile_reviewed}.';
COMMENT ON COLUMN public.company_profiles.quality_score IS
  'Gewichteter Profilqualität-Score 0-100 (Masterprompt §13).';
