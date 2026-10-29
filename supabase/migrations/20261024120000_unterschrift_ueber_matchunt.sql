-- ============================================================================
-- Unterschrift über Matchunt (23.10.2026)
-- ============================================================================
-- Live-Befund: Firmen-Mailserver (Microsoft 365, Proofpoint …) halten die Mail von
-- DocuSign fest, der Arbeitsvertrag bleibt liegen. Neue Umschläge legen deshalb
-- beide Unterzeichner eingebettet an (DocuSign schickt keine Mail). Die
-- Unterschrift startet in Matchunt:
--   Firma    „Ich selbst“ im Bewerberprofil, sonst persönlicher Link per Matchunt-Mail
--   Kandidat persönlicher Link per Matchunt-Mail, sobald die Firma unterschrieben hat
--
-- signing_mode: 'email' = alter Weg (DocuSign mailt), 'embedded' = über Matchunt.
-- employment_sign_links: je Unterzeichner ein Link; in der Datenbank liegt nur der
-- Hash, der Klartext steht einmal in der Mail. Gültig 14 Tage, neuer Link widerruft
-- den alten. Gelesen und geschrieben nur über die Functions (Service-Role).
-- ============================================================================

ALTER TABLE public.employment_contracts
  ADD COLUMN IF NOT EXISTS signing_mode text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS company_signer_user_id uuid;

ALTER TABLE public.employment_contracts DROP CONSTRAINT IF EXISTS employment_contracts_signing_mode_check;
ALTER TABLE public.employment_contracts
  ADD CONSTRAINT employment_contracts_signing_mode_check CHECK (signing_mode IN ('email', 'embedded'));

CREATE TABLE IF NOT EXISTS public.employment_sign_links (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id       uuid NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
  envelope_id       text NOT NULL,
  signer_role       text NOT NULL CHECK (signer_role IN ('company', 'candidate')),
  name              text NOT NULL CHECK (length(name) <= 200),
  email             text NOT NULL CHECK (length(email) <= 320),
  token_hash        text NOT NULL UNIQUE,
  expires_at        timestamptz NOT NULL,
  sent_at           timestamptz,
  opened_at         timestamptz,
  last_opened_at    timestamptz,
  signed_at         timestamptz,
  revoked_at        timestamptz,
  reminders_sent    integer NOT NULL DEFAULT 0,
  last_reminded_at  timestamptz,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employment_sign_links_contract_idx
  ON public.employment_sign_links (contract_id, signer_role, created_at DESC);

-- Lovable: GRANT vor dem Einschalten von RLS
GRANT ALL ON public.employment_sign_links TO service_role;
ALTER TABLE public.employment_sign_links ENABLE ROW LEVEL SECURITY;
-- Keine Leseregel für angemeldete Nutzer: Stand und Zeitpunkte liefert die Function.
