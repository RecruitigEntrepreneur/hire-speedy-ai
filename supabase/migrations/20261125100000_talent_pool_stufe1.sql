-- Talent Pool Stufe 1 (25.11.2026): Pool lebt in „Meine Kandidaten“, Kontakt-Aufgaben am fälligen Tag.
-- Nur Ergänzungen, keine bestehenden Daten werden verändert.

-- Einwilligung des Kandidaten und Speicherfrist je Eintrag
ALTER TABLE public.talent_pool
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_source text,
  ADD COLUMN IF NOT EXISTS retention_until date,
  ADD COLUMN IF NOT EXISTS change_readiness text;

ALTER TABLE public.talent_pool DROP CONSTRAINT IF EXISTS talent_pool_consent_source_check;
ALTER TABLE public.talent_pool ADD CONSTRAINT talent_pool_consent_source_check
  CHECK (consent_source IS NULL OR consent_source = ANY (ARRAY['verbal'::text, 'email'::text]));

ALTER TABLE public.talent_pool DROP CONSTRAINT IF EXISTS talent_pool_change_readiness_check;
ALTER TABLE public.talent_pool ADD CONSTRAINT talent_pool_change_readiness_check
  CHECK (change_readiness IS NULL OR change_readiness = ANY (ARRAY['yes'::text, 'maybe'::text, 'no'::text]));

-- Rhythmus: zusätzlich halbjährlich und „nur einmal“
ALTER TABLE public.talent_pool DROP CONSTRAINT IF EXISTS talent_pool_contact_frequency_check;
ALTER TABLE public.talent_pool ADD CONSTRAINT talent_pool_contact_frequency_check
  CHECK (contact_frequency = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'halfyearly'::text, 'yearly'::text, 'once'::text]));

-- Grund: zusätzlich „ehemals vermittelt“ (für Stufe 3 schon mit angelegt)
ALTER TABLE public.talent_pool DROP CONSTRAINT IF EXISTS talent_pool_pool_type_check;
ALTER TABLE public.talent_pool ADD CONSTRAINT talent_pool_pool_type_check
  CHECK (pool_type = ANY (ARRAY['general'::text, 'silver_medalist'::text, 'future_fit'::text, 'passive'::text, 'alumni'::text]));

-- Fällige Kontakte je Headhunter schnell finden
CREATE INDEX IF NOT EXISTS talent_pool_due_idx ON public.talent_pool (recruiter_id, next_contact_at) WHERE is_active;
