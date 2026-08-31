-- ============================================================================
-- Jobaufnahme-Links · Gast-Entwuerfe, E-Mail-Verifizierung, Rate-Limit (2/6)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Der Entwurf
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intake_drafts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id                uuid REFERENCES public.intake_links(id) ON DELETE SET NULL,

  contract_type          text NOT NULL DEFAULT 'full-time'
                           CHECK (contract_type IN ('full-time', 'freelance')),

  -- ---- Inhalt der Aufnahme (Spiegel von draft_state) ----------------------
  built                  jsonb,
  answers                jsonb,
  dyn                    jsonb,
  freelance              jsonb,
  flexibility            jsonb,
  reveal_setup           jsonb,
  intake_payload         jsonb,
  skill_requirements     jsonb,
  completeness           integer NOT NULL DEFAULT 0
                           CHECK (completeness BETWEEN 0 AND 100),
  title                  text,

  -- ---- Kontakt ------------------------------------------------------------
  contact_name           text,
  contact_email          text,
  contact_phone          text,
  contact_role           text,
  is_freemail            boolean NOT NULL DEFAULT false,

  -- ---- Unternehmen --------------------------------------------------------
  company_name           text,
  company_legal_name     text,
  company_domain         text,
  company_website        text,
  company_street         text,
  company_postal_code    text,
  company_city           text,
  company_country        text NOT NULL DEFAULT 'DE',
  company_vat_id         text,
  company_registration_number text,
  company_size           text,
  company_industry       text,
  billing_email          text,

  -- ---- Erkannte Bestandskunden: HINWEIS, keine Zuordnung ------------------
  matched_organization_id     uuid REFERENCES public.organizations(id)      ON DELETE SET NULL,
  matched_outreach_company_id uuid REFERENCES public.outreach_companies(id) ON DELETE SET NULL,
  matched_client_user_id      uuid,
  match_confidence            text CHECK (match_confidence IS NULL
                                OR match_confidence IN ('exact_domain', 'exact_email', 'name_similar')),

  -- ---- Zustandsachsen -----------------------------------------------------
  capture_state    text NOT NULL DEFAULT 'started'
                     CHECK (capture_state IN ('started', 'in_progress', 'complete')),
  identity_state   text NOT NULL DEFAULT 'anonymous'
                     CHECK (identity_state IN ('anonymous', 'contact_provided', 'email_verified')),
  commercial_state text NOT NULL DEFAULT 'not_started'
                     CHECK (commercial_state IN ('not_started', 'presented', 'confirmed',
                                                 'discussion_requested', 'declined')),
  review_state     text NOT NULL DEFAULT 'not_submitted'
                     CHECK (review_state IN ('not_submitted', 'pending_admin', 'accepted',
                                             'changes_requested', 'rejected')),

  -- ---- Bearbeitung --------------------------------------------------------
  submitted_at      timestamptz,
  accepted_at       timestamptz,
  accepted_by       uuid,
  rejected_at       timestamptz,
  rejected_by       uuid,
  rejection_reason  text,
  admin_note        text,
  owner_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- ---- Ergebnis -----------------------------------------------------------
  job_id            uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  organization_id   uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  client_user_id    uuid,

  -- ---- Aufbewahrung -------------------------------------------------------
  last_activity_at  timestamptz NOT NULL DEFAULT now(),
  purge_after       timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  reminder_sent_at  timestamptz,

  ip_hash           text,
  user_agent        text,
  anonymous_id      text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT intake_drafts_job_requires_accept
    CHECK (job_id IS NULL OR review_state = 'accepted'),
  CONSTRAINT intake_drafts_submit_requires_verified
    CHECK (review_state NOT IN ('pending_admin', 'accepted')
           OR (capture_state = 'complete' AND identity_state = 'email_verified'))
);

CREATE INDEX IF NOT EXISTS intake_drafts_queue_idx
  ON public.intake_drafts (submitted_at DESC)
  WHERE review_state = 'pending_admin';
CREATE INDEX IF NOT EXISTS intake_drafts_followup_idx
  ON public.intake_drafts (last_activity_at DESC)
  WHERE review_state = 'not_submitted' AND contact_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS intake_drafts_email_idx  ON public.intake_drafts (lower(contact_email));
CREATE INDEX IF NOT EXISTS intake_drafts_domain_idx ON public.intake_drafts (company_domain);
CREATE INDEX IF NOT EXISTS intake_drafts_link_idx   ON public.intake_drafts (link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS intake_drafts_purge_idx  ON public.intake_drafts (purge_after);
CREATE INDEX IF NOT EXISTS intake_drafts_job_idx    ON public.intake_drafts (job_id) WHERE job_id IS NOT NULL;

COMMENT ON TABLE public.intake_drafts IS
  'Jobaufnahme ohne Login. Enthaelt ausschliesslich Job- und Firmendaten -- '
  'niemals Kandidatendaten (harte Regel, ONBOARDING_INTAKE_MASTERANALYSE J.2.4). '
  'Wird bei Annahme in einen jobs-Datensatz ueberfuehrt; client_id entsteht dabei '
  'ausschliesslich im INSERT-Pfad, nie per UPDATE.';
COMMENT ON COLUMN public.intake_drafts.matched_organization_id IS
  'Nur ein Hinweis fuer den Admin. Eine Domainuebereinstimmung vergibt KEINE '
  'Rechte an einer bestehenden Organisation -- das Verknuepfen ist eine '
  'ausdrueckliche Admin-Handlung.';
COMMENT ON COLUMN public.intake_drafts.purge_after IS
  '30 Tage ab letzter Aktivitaet, danach harte Loeschung (J.2.4). Erinnerung an Tag 7.';

-- ----------------------------------------------------------------------------
-- 1b) Zugriffstoken eines Entwurfs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intake_draft_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id        uuid NOT NULL REFERENCES public.intake_drafts(id) ON DELETE CASCADE,
  token_hash      text NOT NULL,
  origin          text NOT NULL DEFAULT 'start'
                    CHECK (origin IN ('start', 'forward', 'resume', 'admin')),
  recipient_email text,
  recipient_name  text,
  note            text,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  revoked_at      timestamptz,
  last_used_at    timestamptz,
  use_count       integer NOT NULL DEFAULT 0,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS intake_draft_tokens_hash_key
  ON public.intake_draft_tokens (token_hash);
CREATE INDEX IF NOT EXISTS intake_draft_tokens_draft_idx
  ON public.intake_draft_tokens (draft_id, created_at DESC);
CREATE INDEX IF NOT EXISTS intake_draft_tokens_active_idx
  ON public.intake_draft_tokens (draft_id) WHERE revoked_at IS NULL;

COMMENT ON TABLE public.intake_draft_tokens IS
  'Zugriffstoken einer Gast-Aufnahme, nur als SHA-256-Hash. Mehrere je Entwurf: '
  'Erstbearbeiter, weitergeleiteter Entscheider, neu angeforderter '
  'Fortsetzungslink. Jeder einzeln widerrufbar; recipient_email dokumentiert, '
  'wer Zugriff auf das Briefing hatte.';

ALTER TABLE public.intake_link_events
  DROP CONSTRAINT IF EXISTS intake_link_events_draft_id_fkey;
ALTER TABLE public.intake_link_events
  ADD CONSTRAINT intake_link_events_draft_id_fkey
  FOREIGN KEY (draft_id) REFERENCES public.intake_drafts(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 2) E-Mail-Verifizierung
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intake_email_verifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id     uuid NOT NULL REFERENCES public.intake_drafts(id) ON DELETE CASCADE,
  email        text NOT NULL,
  code_hash    text NOT NULL,
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  attempts     integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  verified_at  timestamptz,
  consumed     boolean NOT NULL DEFAULT false,
  ip_hash      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intake_email_verifications_draft_idx
  ON public.intake_email_verifications (draft_id, created_at DESC);
CREATE INDEX IF NOT EXISTS intake_email_verifications_open_idx
  ON public.intake_email_verifications (draft_id) WHERE consumed = false;

COMMENT ON TABLE public.intake_email_verifications IS
  'Sechsstelliger Code zur Verifizierung der Geschaefts-E-Mail. 15 Minuten, '
  'maximal 5 Versuche. Nur der Hash wird gespeichert.';

-- ----------------------------------------------------------------------------
-- 3) Rate-Limit
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intake_rate_limits (
  scope        text        NOT NULL CHECK (scope IN ('ip', 'link', 'draft', 'email', 'ai', 'mail')),
  key_hash     text        NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, key_hash, window_start)
);

CREATE INDEX IF NOT EXISTS intake_rate_limits_window_idx
  ON public.intake_rate_limits (window_start);

CREATE OR REPLACE FUNCTION public.intake_rate_limit_hit(
  _scope   text,
  _key     text,
  _limit   integer,
  _window  interval DEFAULT interval '1 hour'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_bucket timestamptz;
  v_count  integer;
BEGIN
  IF _key IS NULL OR _key = '' THEN
    RETURN true;
  END IF;

  v_bucket := to_timestamp(floor(extract(epoch FROM now()) / extract(epoch FROM _window))
                           * extract(epoch FROM _window));

  INSERT INTO public.intake_rate_limits (scope, key_hash, window_start, count)
  VALUES (_scope, _key, v_bucket, 1)
  ON CONFLICT (scope, key_hash, window_start)
  DO UPDATE SET count = public.intake_rate_limits.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= _limit;
END;
$fn$;

REVOKE ALL ON FUNCTION public.intake_rate_limit_hit(text, text, integer, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.intake_rate_limit_hit(text, text, integer, interval) TO service_role;

CREATE OR REPLACE FUNCTION public.intake_rate_limits_prune()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.intake_rate_limits WHERE window_start < now() - interval '2 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$fn$;

REVOKE ALL ON FUNCTION public.intake_rate_limits_prune() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.intake_rate_limits_prune() TO service_role;

-- ----------------------------------------------------------------------------
-- 4) Aufbewahrung
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.intake_drafts_purge_expired()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_deleted integer;
BEGIN
  INSERT INTO public.intake_link_events (link_id, draft_id, event_type, meta)
  SELECT d.link_id, NULL, 'purged',
         jsonb_build_object('draft_id', d.id, 'had_contact', d.contact_email IS NOT NULL)
    FROM public.intake_drafts d
   WHERE d.purge_after < now()
     AND d.review_state <> 'accepted'
     AND d.job_id IS NULL;

  DELETE FROM public.intake_drafts
   WHERE purge_after < now()
     AND review_state <> 'accepted'
     AND job_id IS NULL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  PERFORM public.intake_rate_limits_prune();
  RETURN v_deleted;
END;
$fn$;

REVOKE ALL ON FUNCTION public.intake_drafts_purge_expired() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.intake_drafts_purge_expired() TO service_role;

COMMENT ON FUNCTION public.intake_drafts_purge_expired() IS
  'Loescht Gast-Entwuerfe 30 Tage nach der letzten Aktivitaet (J.2.4). '
  'Angenommene Entwuerfe mit Job bleiben -- sie gehoeren zur Kundenbeziehung.';

-- ----------------------------------------------------------------------------
-- 5) RLS -- Admin-only, kein anon
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_drafts TO authenticated;
GRANT ALL ON public.intake_drafts TO service_role;
GRANT SELECT, UPDATE ON public.intake_draft_tokens TO authenticated;
GRANT ALL ON public.intake_draft_tokens TO service_role;
GRANT ALL ON public.intake_email_verifications TO service_role;
GRANT ALL ON public.intake_rate_limits TO service_role;

ALTER TABLE public.intake_drafts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_draft_tokens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_rate_limits         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage intake drafts" ON public.intake_drafts;
CREATE POLICY "Admins manage intake drafts"
  ON public.intake_drafts FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read draft tokens" ON public.intake_draft_tokens;
CREATE POLICY "Admins read draft tokens"
  ON public.intake_draft_tokens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins revoke draft tokens" ON public.intake_draft_tokens;
CREATE POLICY "Admins revoke draft tokens"
  ON public.intake_draft_tokens FOR UPDATE TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.intake_rate_limits IS
  'RLS aktiv, bewusst OHNE Policy: nur Service-Role greift zu.';

DROP TRIGGER IF EXISTS trg_intake_drafts_touch ON public.intake_drafts;
CREATE TRIGGER trg_intake_drafts_touch
  BEFORE UPDATE ON public.intake_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMIT;