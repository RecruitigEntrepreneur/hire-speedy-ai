-- Phase 1: Erweiterte Match-Score Felder

-- 1.1 Neue Felder für candidates Tabelle (Pendel-Präferenzen)
ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS max_commute_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS commute_mode TEXT DEFAULT 'car',
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_zip TEXT,
ADD COLUMN IF NOT EXISTS address_lat NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS address_lng NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS remote_days_preferred INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS remote_flexibility TEXT DEFAULT 'flexible';

-- 1.2 Neue Felder für jobs Tabelle (Standort & Remote-Policy)
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS office_address TEXT,
ADD COLUMN IF NOT EXISTS office_lat NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS office_lng NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS onsite_days_required INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS remote_policy TEXT DEFAULT 'hybrid',
ADD COLUMN IF NOT EXISTS commute_flexibility TEXT DEFAULT 'standard';

-- 1.3 Neue Tabelle: commute_overrides (Kandidaten-Antworten zu Pendelfragen)
CREATE TABLE IF NOT EXISTS public.commute_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  accepted_commute_minutes INTEGER,
  response TEXT CHECK (response IN ('yes', 'conditional', 'no')),
  response_notes TEXT,
  asked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(candidate_id, job_id)
);

-- 1.4 Neue Tabelle: routing_cache (Caching für Routing-Ergebnisse)
CREATE TABLE IF NOT EXISTS public.routing_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_lat NUMERIC(10, 7) NOT NULL,
  origin_lng NUMERIC(10, 7) NOT NULL,
  dest_lat NUMERIC(10, 7) NOT NULL,
  dest_lng NUMERIC(10, 7) NOT NULL,
  mode TEXT NOT NULL DEFAULT 'car',
  duration_minutes INTEGER NOT NULL,
  distance_km NUMERIC(8, 2),
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_routing_cache_lookup ON public.routing_cache (
  origin_lat, origin_lng, dest_lat, dest_lng, mode
);

CREATE INDEX IF NOT EXISTS idx_commute_overrides_candidate ON public.commute_overrides(candidate_id);
CREATE INDEX IF NOT EXISTS idx_commute_overrides_job ON public.commute_overrides(job_id);

-- RLS für commute_overrides aktivieren
ALTER TABLE public.commute_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies für commute_overrides
CREATE POLICY "Recruiters can manage overrides for their candidates"
ON public.commute_overrides
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = commute_overrides.candidate_id
    AND c.recruiter_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all overrides"
ON public.commute_overrides
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS für routing_cache aktivieren (öffentlich lesbar für Performance)
ALTER TABLE public.routing_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read routing cache"
ON public.routing_cache
FOR SELECT
USING (true);

CREATE POLICY "System can manage routing cache"
ON public.routing_cache
FOR ALL
USING (true);