-- Eigene Talent Pools (25.11.2026): der Headhunter legt Pools mit Namen an, ein Kandidat kann in mehreren liegen.
-- Bestehende Einträge bleiben unverändert (pool_id leer); die App ordnet sie beim nächsten Speichern einem Pool zu.

CREATE TABLE IF NOT EXISTS public.talent_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  description text,
  default_frequency text NOT NULL DEFAULT 'quarterly'
    CHECK (default_frequency = ANY (ARRAY['quarterly'::text, 'halfyearly'::text, 'yearly'::text, 'once'::text])),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

-- Je Headhunter jeder Name nur einmal (ohne Groß-/Kleinschreibung), archivierte zählen nicht
CREATE UNIQUE INDEX IF NOT EXISTS talent_pools_recruiter_name_key
  ON public.talent_pools (recruiter_id, lower(btrim(name))) WHERE archived_at IS NULL;

GRANT ALL ON public.talent_pools TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.talent_pools TO authenticated;

ALTER TABLE public.talent_pools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recruiters manage their own pools" ON public.talent_pools;
CREATE POLICY "Recruiters manage their own pools" ON public.talent_pools
  FOR ALL TO authenticated
  USING (recruiter_id = auth.uid())
  WITH CHECK (recruiter_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all pools" ON public.talent_pools;
CREATE POLICY "Admins can view all pools" ON public.talent_pools
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Eintrag gehört zu einem Pool
ALTER TABLE public.talent_pool
  ADD COLUMN IF NOT EXISTS pool_id uuid REFERENCES public.talent_pools(id) ON DELETE CASCADE;

-- Bisher: ein Eintrag je Kandidat. Neu: ein Eintrag je Kandidat und Pool.
ALTER TABLE public.talent_pool DROP CONSTRAINT IF EXISTS talent_pool_candidate_id_recruiter_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS talent_pool_candidate_recruiter_pool_key
  ON public.talent_pool (candidate_id, recruiter_id, COALESCE(pool_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS talent_pool_pool_idx ON public.talent_pool (pool_id) WHERE is_active;
