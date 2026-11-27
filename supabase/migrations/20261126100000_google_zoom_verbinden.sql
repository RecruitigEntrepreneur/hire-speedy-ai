-- ============================================================================
-- Google Kalender, Google Meet und Zoom (26.11.2026)
--
-- Kalender je Person: Outlook ODER Google (calendar_connections, provider
-- 'microsoft' | 'google'). Zoom kommt als eigener Anschluss dazu (provider 'zoom').
-- Das Video-Werkzeug eines Interviews steht in interviews.meeting_format
-- ('teams' | 'meet' | 'zoom'; ohne Prüfregel, unverändert).
-- Keine neuen Tabellen, keine Daten, nur Spalten und eine erweiterte Prüfregel.
-- ============================================================================

-- 1) Zoom als Anbieter zulassen
ALTER TABLE public.calendar_connections DROP CONSTRAINT IF EXISTS calendar_connections_provider_check;
ALTER TABLE public.calendar_connections
  ADD CONSTRAINT calendar_connections_provider_check CHECK (provider IN ('microsoft', 'google', 'zoom'));

-- 2) Interviews: in welchem Kalender der Termin steht, Zoom-Besprechung zum Löschen bei Absage
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS calendar_provider text,
  ADD COLUMN IF NOT EXISTS zoom_meeting_id text;
ALTER TABLE public.interviews DROP CONSTRAINT IF EXISTS interviews_calendar_provider_check;
ALTER TABLE public.interviews
  ADD CONSTRAINT interviews_calendar_provider_check CHECK (calendar_provider IS NULL OR calendar_provider IN ('microsoft', 'google'));
COMMENT ON COLUMN public.interviews.calendar_provider IS 'Kalender, in dem der Termin steht (bei meeting_provider = client_calendar): microsoft oder google. Leer = Outlook (ältere Termine).';
COMMENT ON COLUMN public.interviews.zoom_meeting_id IS 'Zoom-Besprechung des Organisators; wird bei Absage gelöscht.';

-- 3) Terminseite des Headhunters: Video-Werkzeug der Seite
ALTER TABLE public.recruiter_booking_pages
  ADD COLUMN IF NOT EXISTS video_tool text NOT NULL DEFAULT 'teams';
ALTER TABLE public.recruiter_booking_pages DROP CONSTRAINT IF EXISTS recruiter_booking_pages_video_tool_check;
ALTER TABLE public.recruiter_booking_pages
  ADD CONSTRAINT recruiter_booking_pages_video_tool_check CHECK (video_tool IN ('teams', 'meet', 'zoom'));
COMMENT ON COLUMN public.recruiter_booking_pages.video_tool IS 'Werkzeug für Gespräche per Video (allow_teams = Video angeboten): teams, meet oder zoom.';

-- 4) Buchungen der Terminseite: Werkzeug, Kalender und Zoom-Besprechung je Termin
ALTER TABLE public.recruiter_bookings
  ADD COLUMN IF NOT EXISTS video_tool text,
  ADD COLUMN IF NOT EXISTS calendar_provider text,
  ADD COLUMN IF NOT EXISTS zoom_meeting_id text;
ALTER TABLE public.recruiter_bookings DROP CONSTRAINT IF EXISTS recruiter_bookings_video_tool_check;
ALTER TABLE public.recruiter_bookings
  ADD CONSTRAINT recruiter_bookings_video_tool_check CHECK (video_tool IS NULL OR video_tool IN ('teams', 'meet', 'zoom'));
ALTER TABLE public.recruiter_bookings DROP CONSTRAINT IF EXISTS recruiter_bookings_calendar_provider_check;
ALTER TABLE public.recruiter_bookings
  ADD CONSTRAINT recruiter_bookings_calendar_provider_check CHECK (calendar_provider IS NULL OR calendar_provider IN ('microsoft', 'google'));
COMMENT ON COLUMN public.recruiter_bookings.video_tool IS 'Bei mode = teams (Video): teams, meet oder zoom. Leer = Teams (ältere Buchungen).';
