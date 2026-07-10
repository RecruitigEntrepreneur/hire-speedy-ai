-- ============================================================================
-- Jobaufnahme · Hybrid-Storage-Foundation (P0/P1 des ULTIMATE_INTAKE_PLAN)
-- Additiv: nur neue Spalten auf jobs. Kein Datenverlust, RLS unverändert
-- ("Clients can manage their own jobs" FOR ALL deckt die neuen Spalten ab;
--  via recruiter_jobs_view bleiben intake_payload/reveal_envelope recruiter-privat).
-- ============================================================================

-- Reiches Briefing/Sell/Sourcing/Kontext (narrativ, nicht matching-relevant)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS intake_payload   jsonb,
  ADD COLUMN IF NOT EXISTS reveal_envelope  jsonb,
  ADD COLUMN IF NOT EXISTS reveal_trigger   text DEFAULT 'after_first_interview',
  ADD COLUMN IF NOT EXISTS search_difficulty text,
  ADD COLUMN IF NOT EXISTS target_companies text[],
  ADD COLUMN IF NOT EXISTS nogo_companies   text[];

-- Phantom-Matching-Spalten: der V3.1-Matcher LIEST diese bereits, sie
-- existierten aber nie -> Visa-Hard-Kill & Erfahrungs-Score waren kaputt.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS visa_sponsorship boolean,
  ADD COLUMN IF NOT EXISTS experience_min   integer,
  ADD COLUMN IF NOT EXISTS experience_max   integer;

COMMENT ON COLUMN public.jobs.intake_payload IS
  'Hybrid-Storage: reiches Briefing/Sell/Sourcing/Kontext aus der dynamischen Jobaufnahme (client-privat).';
COMMENT ON COLUMN public.jobs.reveal_envelope IS
  'Triple-Blind: was anonym gezeigt werden darf (Green/Red-List, Descriptor) — ersetzt halluzinierte quick_facts.';
COMMENT ON COLUMN public.jobs.reveal_trigger IS
  'Wann die Firmen-Identität freigegeben wird: opt_in | after_first_interview | offer.';
COMMENT ON COLUMN public.jobs.visa_sponsorship IS
  'Vom V3.1-Matcher gelesener Visa-Hard-Kill (vorher fehlende Spalte).';
