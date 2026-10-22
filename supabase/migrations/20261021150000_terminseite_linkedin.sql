-- ============================================================================
-- Terminseite des Headhunters und LinkedIn-Beiträge (21.10.2026)
-- ============================================================================
-- Kandidaten aus einem LinkedIn-Beitrag buchen auf matchunt.ai/t/<slug>/<stelle>
-- ein Erstgespräch, nur zu Zeiten, die im verbundenen Outlook des Headhunters
-- frei sind. Der Headhunter postet den Beitrag nach seiner Freigabe direkt auf
-- sein LinkedIn-Profil.
--
--   recruiter_booking_pages  Einstellungen der Terminseite je Headhunter
--   recruiter_bookings       gebuchte Erstgespräche (Kandidat, Zeit, Teams/Telefon)
--   recruiter_linkedin       LinkedIn-Verbindung (Token nur verschlüsselt, nur Server)
--   linkedin_oauth_states    kurzlebige OAuth-Zustände (nur Server)
--   job_linkedin_posts       Beiträge je Stelle und Headhunter
--
-- Öffentliche Zugriffe (Terminseite, Buchen, Absagen) laufen ausschließlich über
-- die Function termin-seite mit Service-Role; Kandidaten sehen nie Tabellen.
-- ============================================================================

-- 1) Terminseite ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recruiter_booking_pages (
  recruiter_id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 60 AND slug <> 'termin'),
  active boolean NOT NULL DEFAULT false,
  -- gleiche Form wie client_interview_hours.rules (weekly, bufferMinutes, minNoticeHours, horizonDays, skipHolidays, absences)
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_minutes integer NOT NULL DEFAULT 15 CHECK (duration_minutes IN (15, 30, 45, 60)),
  allow_teams boolean NOT NULL DEFAULT true,
  allow_phone boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_page_one_mode CHECK (allow_teams OR allow_phone)
);
ALTER TABLE public.recruiter_booking_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recruiter manage own booking page" ON public.recruiter_booking_pages;
CREATE POLICY "Recruiter manage own booking page"
  ON public.recruiter_booking_pages FOR ALL
  USING (auth.uid() = recruiter_id)
  WITH CHECK (auth.uid() = recruiter_id AND public.has_role(auth.uid(), 'recruiter'));

-- Ist ein Slug noch frei? (für den Vorschlag im Profil, ohne fremde Zeilen zu lesen)
CREATE OR REPLACE FUNCTION public.booking_slug_free(p_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM recruiter_booking_pages WHERE slug = lower(p_slug) AND recruiter_id <> auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.booking_slug_free(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.booking_slug_free(text) TO authenticated;

-- 2) Buchungen -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recruiter_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  mode text NOT NULL CHECK (mode IN ('teams', 'phone')),
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled')),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  linkedin_url text,
  note text,
  cv_path text,
  source text NOT NULL DEFAULT 'terminseite' CHECK (source IN ('linkedin_beitrag', 'terminseite')),
  post_id uuid,
  manage_token_hash text NOT NULL UNIQUE,
  outlook_event_id text,
  join_url text,
  cancel_reason text,
  cancelled_at timestamptz,
  cancelled_by text CHECK (cancelled_by IN ('candidate', 'recruiter')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_time_order CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS recruiter_bookings_recruiter_time ON public.recruiter_bookings (recruiter_id, starts_at);
CREATE INDEX IF NOT EXISTS recruiter_bookings_candidate ON public.recruiter_bookings (candidate_id);
CREATE INDEX IF NOT EXISTS recruiter_bookings_email_day ON public.recruiter_bookings (lower(email), created_at);
-- Dieselbe Startzeit kann beim selben Headhunter nur einmal gebucht sein.
CREATE UNIQUE INDEX IF NOT EXISTS recruiter_bookings_no_double
  ON public.recruiter_bookings (recruiter_id, starts_at) WHERE status = 'booked';
ALTER TABLE public.recruiter_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recruiter read own bookings" ON public.recruiter_bookings;
CREATE POLICY "Recruiter read own bookings"
  ON public.recruiter_bookings FOR SELECT
  USING (auth.uid() = recruiter_id);
-- Schreiben (Buchen, Verschieben, Absagen) nur über die Function termin-seite.

-- Lebensläufe, die ein Kandidat vor dem Buchen hochlädt (liegen in cv-documents
-- im Ordner des Headhunters; werden beim Buchen an Kandidat und Akte gehängt).
CREATE TABLE IF NOT EXISTS public.booking_cv_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL,
  path text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  mime_type text,
  raw_text text,
  hints jsonb NOT NULL DEFAULT '{}'::jsonb,
  used_by uuid REFERENCES public.recruiter_bookings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.booking_cv_uploads ENABLE ROW LEVEL SECURITY;
-- keine Policies: nur Service-Role

-- 3) LinkedIn-Verbindung (nur Server) -----------------------------------------
CREATE TABLE IF NOT EXISTS public.recruiter_linkedin (
  recruiter_id uuid PRIMARY KEY,
  member_id text NOT NULL,
  name text,
  picture_url text,
  access_token_enc text NOT NULL,
  expires_at timestamptz NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  reminder_sent_at timestamptz
);
ALTER TABLE public.recruiter_linkedin ENABLE ROW LEVEL SECURITY;
-- keine Policies: das Token verlässt den Server nie. Status über my_linkedin().

CREATE OR REPLACE FUNCTION public.my_linkedin()
RETURNS TABLE (connected boolean, name text, picture_url text, expires_at timestamptz, connected_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT true, l.name, l.picture_url, l.expires_at, l.connected_at
    FROM recruiter_linkedin l
   WHERE l.recruiter_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_linkedin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_linkedin() TO authenticated;

CREATE TABLE IF NOT EXISTS public.linkedin_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL,
  return_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.linkedin_oauth_states ENABLE ROW LEVEL SECURITY;
-- keine Policies: nur Service-Role

-- 4) Beiträge je Stelle --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_linkedin_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL,
  -- posted: direkt über die Schnittstelle · manual: selbst gepostet und abgehakt
  status text NOT NULL CHECK (status IN ('posted', 'manual', 'failed', 'deleted')),
  post_urn text,
  text text NOT NULL,
  template text,
  format text,
  visibility text CHECK (visibility IN ('PUBLIC', 'CONNECTIONS')),
  show_salary boolean NOT NULL DEFAULT true,
  error text,
  posted_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS job_linkedin_posts_job ON public.job_linkedin_posts (job_id, recruiter_id, posted_at DESC);
ALTER TABLE public.job_linkedin_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recruiter read own posts" ON public.job_linkedin_posts;
CREATE POLICY "Recruiter read own posts"
  ON public.job_linkedin_posts FOR SELECT
  USING (auth.uid() = recruiter_id);

-- „Ich habe gepostet“ (Rückfallweg) darf der Headhunter selbst eintragen.
DROP POLICY IF EXISTS "Recruiter log manual posts" ON public.job_linkedin_posts;
CREATE POLICY "Recruiter log manual posts"
  ON public.job_linkedin_posts FOR INSERT
  WITH CHECK (auth.uid() = recruiter_id AND status = 'manual' AND public.has_role(auth.uid(), 'recruiter'));

-- 5) Stand je Stelle für den Kopf: letzter Beitrag und Zahl der Buchungen ------
CREATE OR REPLACE FUNCTION public.my_job_post_status(p_job_id uuid)
RETURNS TABLE (posted_at timestamptz, status text, post_urn text, bookings integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.posted_at, p.status, p.post_urn,
         (SELECT count(*)::int FROM recruiter_bookings b
           WHERE b.recruiter_id = auth.uid() AND b.job_id = p_job_id AND b.status = 'booked')
    FROM job_linkedin_posts p
   WHERE p.recruiter_id = auth.uid() AND p.job_id = p_job_id AND p.status IN ('posted', 'manual')
   ORDER BY p.posted_at DESC
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.my_job_post_status(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_job_post_status(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Tabellenrechte (wie die RLS-Regeln oben): Headhunter lesen bzw. schreiben nur,
-- was ihre Regeln erlauben; alles Übrige läuft über die Edge Functions (service_role).
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruiter_booking_pages TO authenticated;
GRANT SELECT ON public.recruiter_bookings TO authenticated;
GRANT SELECT, INSERT ON public.job_linkedin_posts TO authenticated;
GRANT ALL ON public.recruiter_booking_pages, public.recruiter_bookings, public.booking_cv_uploads,
             public.recruiter_linkedin, public.linkedin_oauth_states, public.job_linkedin_posts TO service_role;
