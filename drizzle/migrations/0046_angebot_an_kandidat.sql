-- ============================================================================
-- Angebot schriftlich an den Kandidaten, Zusage nur vom Kandidaten (G + H, 25.10.2026)
-- ----------------------------------------------------------------------------
-- Der Kandidat bekommt die Eckdaten per Mail („<Headhunter> über Matchunt“) und
-- antwortet auf einer Seite ohne Konto: Zusage, mit dem Headhunter sprechen oder
-- Absage. Meldet der Headhunter eine Zusage, bestätigt der Kandidat sie dort.
-- Erst dann gilt die Zusage und der Arbeitsvertrag beginnt.
--
-- Die Mail geht sofort nach „Gespräch geführt“, sonst nach 2 Stunden (nachts um
-- 8 Uhr). Zeitversetzt verschickt der Mail-Dienst (Resend „scheduled_at“), deshalb
-- braucht es keinen Zeitplan in der Datenbank; die Kennungen der geplanten Mails
-- stehen am Angebot, damit sie sich abbrechen lassen.
--
--   offer_candidate_links  persönliche Links (nur Hash), Zweck answer oder confirm
--   offers                 Nachricht an den Kandidaten, Mail und Erinnerung,
--                          Rückrufwunsch, gemeldete und bestätigte Zusage,
--                          optional hinterlegter Arbeitsvertrag
-- Neuer Zustand offers.status = 'accept_reported' (Zusage gemeldet, Bestätigung
-- des Kandidaten steht aus). offers.status hat keine CHECK-Regel.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.offer_candidate_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('answer', 'confirm')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  opened_at timestamptz,
  last_opened_at timestamptz,
  answered_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offer_candidate_links_offer_idx ON public.offer_candidate_links (offer_id, created_at DESC);

COMMENT ON TABLE public.offer_candidate_links IS
  'Persönliche Links des Kandidaten zur Antwortseite /angebot/:token. Nur der Hash wird gespeichert; Zugriff ausschließlich über die Function offer-answer.';

-- Lovable: GRANT vor dem Einschalten von RLS (29.10.2026)
GRANT ALL ON public.offer_candidate_links TO service_role;
ALTER TABLE public.offer_candidate_links ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS candidate_message text
    CHECK (candidate_message IS NULL OR length(candidate_message) <= 2000),
  ADD COLUMN IF NOT EXISTS candidate_mail_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS candidate_mail_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS candidate_mail_id text,
  ADD COLUMN IF NOT EXISTS candidate_reminder_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS candidate_reminder_mail_id text,
  ADD COLUMN IF NOT EXISTS recruiter_talked_at timestamptz,
  ADD COLUMN IF NOT EXISTS candidate_answered_at timestamptz,
  ADD COLUMN IF NOT EXISTS callback_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS callback_topic text
    CHECK (callback_topic IS NULL OR length(callback_topic) <= 500),
  ADD COLUMN IF NOT EXISTS callback_done_at timestamptz,
  ADD COLUMN IF NOT EXISTS accept_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS accept_reported_by uuid,
  ADD COLUMN IF NOT EXISTS candidate_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS contract_document_path text;

COMMENT ON COLUMN public.offers.candidate_confirmed_at IS
  'Zeitpunkt, an dem der Kandidat selbst zugesagt oder die gemeldete Zusage bestätigt hat. Erst dann gilt die Zusage.';
COMMENT ON COLUMN public.offers.contract_document_path IS
  'Optional mit dem Angebot hinterlegter Arbeitsvertrag (PDF); nach der Zusage geht er direkt zur Unterschrift über Matchunt.';

GRANT ALL ON public.offers TO service_role;
