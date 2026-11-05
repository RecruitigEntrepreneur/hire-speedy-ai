-- ============================================================================
-- Kandidat zum Gespräch einladen (01.11.2026)
-- ----------------------------------------------------------------------------
-- Der Headhunter lädt aus dem Kandidatenprofil zum eigenen Gespräch ein und wählt
-- je Einladung, was er anbietet (Teams, Telefon oder beides). Jede Zeile ist ein
-- persönlicher Link /t/einladung/<token>: In der Datenbank liegt nur der Hash, der
-- Klartext steht einmal in der Mail oder im kopierten Text. Ein neuer Link (Erinnern,
-- Link kopieren) ist eine neue Zeile; ältere Links bleiben bis zum Ablauf gültig.
--
-- Der Termin landet immer beim Kandidaten aus der Akte, auch wenn er eine andere
-- E-Mail hat. Mit der Buchung werden alle offenen Links des Kandidaten geschlossen.
-- Geschrieben wird nur über die Functions termin-einladung und termin-seite.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.candidate_invites (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id   uuid NOT NULL,
  candidate_id   uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  arten          text[] NOT NULL CHECK (cardinality(arten) > 0 AND arten <@ ARRAY['teams', 'phone']::text[]),
  weg            text NOT NULL CHECK (weg IN ('mail', 'selbst')),
  token_hash     text NOT NULL UNIQUE,
  expires_at     timestamptz NOT NULL,
  sent_at        timestamptz,
  opened_at      timestamptz,
  last_opened_at timestamptz,
  booking_id     uuid REFERENCES public.recruiter_bookings(id) ON DELETE SET NULL,
  booked_at      timestamptz,
  revoked_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS candidate_invites_candidate_idx
  ON public.candidate_invites (candidate_id, created_at DESC);

COMMENT ON TABLE public.candidate_invites IS
  'Persönliche Einladungen des Headhunters zum Gespräch mit dem Kandidaten. Nur der Hash des Links wird gespeichert.';

-- Lovable: GRANT vor dem Einschalten von RLS
GRANT ALL ON public.candidate_invites TO service_role;
GRANT SELECT ON public.candidate_invites TO authenticated;
ALTER TABLE public.candidate_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recruiter liest eigene Einladungen" ON public.candidate_invites;
CREATE POLICY "Recruiter liest eigene Einladungen"
  ON public.candidate_invites FOR SELECT
  TO authenticated
  USING (recruiter_id = auth.uid());

-- Aufgaben vor der Einreichung: „Nicht relevant“ blendet den Kandidaten dauerhaft aus den Aufgaben aus.
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS prep_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS prep_dismissed_reason text;
