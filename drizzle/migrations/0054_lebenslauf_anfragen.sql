-- ============================================================================
-- Lebenslauf anfragen (05.11.2026)
-- ----------------------------------------------------------------------------
-- Der Headhunter legt Kandidaten oft nur mit Name und E-Mail an und fragt den
-- Lebenslauf an: mit der Einladung zum Gespräch (Häkchen „Lebenslauf anfragen“)
-- oder allein aus dem Profil, z. B. nach dem Gespräch. Der Kandidat lädt ihn auf
-- seiner Einladungsseite oder unter /t/lebenslauf/<token> hoch, freiwillig; Pflicht
-- ist er erst beim Einreichen (trg_require_candidate_cv).
--
-- Eine Zeile je Anfrage. Ein eigener Link entsteht nur ohne Einladung oder beim
-- Erinnern; in der Datenbank liegt nur sein Hash. Geschrieben wird nur über die
-- Functions termin-einladung und termin-seite.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cv_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id  uuid NOT NULL,
  candidate_id  uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  invite_id     uuid REFERENCES public.candidate_invites(id) ON DELETE SET NULL,
  weg           text NOT NULL CHECK (weg IN ('einladung', 'mail', 'selbst')),
  token_hash    text UNIQUE,
  expires_at    timestamptz,
  sent_at       timestamptz,
  reminded_at   timestamptz,
  upload_id     uuid REFERENCES public.booking_cv_uploads(id) ON DELETE SET NULL,
  fulfilled_at  timestamptz,
  linkedin_at   timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cv_requests_candidate_idx
  ON public.cv_requests (candidate_id, created_at DESC);

COMMENT ON TABLE public.cv_requests IS
  'Lebenslauf-Anfragen des Headhunters an den Kandidaten. Nur der Hash eines eigenen Links wird gespeichert.';

-- Lovable: GRANT vor dem Einschalten von RLS
GRANT ALL ON public.cv_requests TO service_role;
GRANT SELECT ON public.cv_requests TO authenticated;
ALTER TABLE public.cv_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recruiter liest eigene Lebenslauf-Anfragen" ON public.cv_requests;
CREATE POLICY "Recruiter liest eigene Lebenslauf-Anfragen"
  ON public.cv_requests FOR SELECT
  TO authenticated
  USING (recruiter_id = auth.uid());
