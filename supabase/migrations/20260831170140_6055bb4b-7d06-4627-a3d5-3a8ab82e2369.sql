-- ============================================================================
-- Jobaufnahme-Links · Fundament (Teil 1/6)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Die Links
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intake_links (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nur der Hash. Der Klartext-Token verlaesst das System einmalig bei der
  -- Erzeugung und ist danach nicht wiederherstellbar.
  token_hash               text NOT NULL,

  link_type                text NOT NULL
                             CHECK (link_type IN ('personal', 'campaign', 'public')),
  label                    text NOT NULL,
  internal_note            text,

  -- Zustaendigkeit auf Matchunt-Seite. Nicht zu verwechseln mit jobs.approved_by
  -- (das ist der pruefende Admin, kein Betreuer).
  owner_user_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Attribution
  campaign_key             text,
  source                   text,

  -- Vorbelegung: woher die Firmendaten stammen duerfen.
  outreach_company_id      uuid REFERENCES public.outreach_companies(id) ON DELETE SET NULL,
  outreach_lead_id         uuid REFERENCES public.outreach_leads(id)     ON DELETE SET NULL,
  organization_id          uuid REFERENCES public.organizations(id)      ON DELETE SET NULL,

  -- Freie Vorbelegung fuer den Aufnahmedialog.
  prefill                  jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Konditionsvorlage; FK wird in Migration 3 nachgezogen.
  terms_template_id        uuid,
  fee_percentage           numeric(5,2),
  recruiter_fee_percentage numeric(5,2),

  allow_freemail           boolean NOT NULL DEFAULT false,

  max_uses                 integer CHECK (max_uses IS NULL OR max_uses > 0),
  uses_count               integer NOT NULL DEFAULT 0 CHECK (uses_count >= 0),

  expires_at               timestamptz,
  revoked_at               timestamptz,
  revoked_by               uuid,

  created_by               uuid NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  -- Der oeffentliche Link darf keine Person vorbelegen.
  CONSTRAINT intake_links_public_no_contact
    CHECK (link_type <> 'public'
           OR NOT (prefill ? 'contact_email' OR prefill ? 'contact_name')),
  CONSTRAINT intake_links_fee_range
    CHECK (recruiter_fee_percentage IS NULL
           OR fee_percentage IS NULL
           OR recruiter_fee_percentage <= fee_percentage)
);

CREATE UNIQUE INDEX IF NOT EXISTS intake_links_token_hash_key
  ON public.intake_links (token_hash);
CREATE INDEX IF NOT EXISTS intake_links_active_idx
  ON public.intake_links (link_type, created_at DESC)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS intake_links_owner_idx
  ON public.intake_links (owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS intake_links_campaign_idx
  ON public.intake_links (campaign_key) WHERE campaign_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS intake_links_company_idx
  ON public.intake_links (outreach_company_id) WHERE outreach_company_id IS NOT NULL;

COMMENT ON TABLE public.intake_links IS
  'Jobaufnahme-Links (persoenlich / Kampagne / oeffentlich). Nur der SHA-256-Hash '
  'des Tokens wird gespeichert. Nie fuer anon lesbar -- der Einstieg laeuft '
  'ausschliesslich ueber die Edge Function intake-start mit Service-Role.';
COMMENT ON COLUMN public.intake_links.prefill IS
  'Vorbelegung des Aufnahmedialogs. Niemals Kandidatendaten (J.2.4).';
COMMENT ON COLUMN public.intake_links.owner_user_id IS
  'Zustaendiger Matchunt-Betreuer. Attributionskopie -- die Lead-Eigentuemerschaft '
  'bleibt laut F.5 im CRM.';

-- ----------------------------------------------------------------------------
-- 2) Ereignisse -- die Datenbasis des Funnels
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intake_link_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id      uuid REFERENCES public.intake_links(id) ON DELETE CASCADE,
  draft_id     uuid,
  event_type   text NOT NULL CHECK (event_type IN (
                 'link_opened',
                 'intake_started',
                 'first_value',
                 'contact_provided',
                 'email_verification_sent',
                 'email_verified',
                 'intake_completed',
                 'terms_presented',
                 'terms_confirmed',
                 'terms_discussion_requested',
                 'forwarded',
                 'resume_requested',
                 'submitted',
                 'accepted',
                 'changes_requested',
                 'rejected',
                 'contract_sent',
                 'contract_signed',
                 'published',
                 'abandoned',
                 'purged')),
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  anonymous_id text,
  ip_hash      text,
  user_agent   text,
  actor_user_id uuid,
  meta         jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS intake_link_events_link_idx
  ON public.intake_link_events (link_id, event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS intake_link_events_draft_idx
  ON public.intake_link_events (draft_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS intake_link_events_type_time_idx
  ON public.intake_link_events (event_type, occurred_at DESC);

COMMENT ON TABLE public.intake_link_events IS
  'Funnel-Ereignisse je Aufnahme-Link. IP nur gehasht, kein Klartext (J.2.4). '
  'Bewusst nicht platform_events: dort ist user_id NOT NULL.';

-- ----------------------------------------------------------------------------
-- 3) RLS -- Admin-only, kein anon, kein authenticated
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_links TO authenticated;
GRANT ALL ON public.intake_links TO service_role;
GRANT SELECT ON public.intake_link_events TO authenticated;
GRANT ALL ON public.intake_link_events TO service_role;

ALTER TABLE public.intake_links       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_link_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage intake links"  ON public.intake_links;
CREATE POLICY "Admins manage intake links"
  ON public.intake_links FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read intake link events" ON public.intake_link_events;
CREATE POLICY "Admins read intake link events"
  ON public.intake_link_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------------------------------------------
-- 4) updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_intake_links_touch ON public.intake_links;
CREATE TRIGGER trg_intake_links_touch
  BEFORE UPDATE ON public.intake_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMIT;