-- ============================================================================
-- Jobaufnahme-Links · Fundament (Teil 1/6)
-- ----------------------------------------------------------------------------
-- BEFUND: Es gibt im gesamten Repo nichts Link-, Kampagnen- oder Attributions-
--   artiges. Ein Grep ueber alle 130 Migrationen nach utm_/campaign_id/
--   referral/intake_token/magic_link findet genau zwei Treffer, beide im
--   Outreach-Zweig und ohne jeden Bezug zu jobs. jobs traegt weder source noch
--   einen zustaendigen Betreuer -- nur client_id, den Kunden selbst.
--
-- ENTSCHEIDUNG: Eine eigene Link-Tabelle statt neuer Spalten auf jobs. Ein Link
--   existiert, bevor irgendein Job existiert, und ueberlebt ihn; er gehoert
--   nicht in die Job-Zeile.
--
-- Drei Linktypen, ein Mechanismus:
--   personal  -- bekanntes Unternehmen/Ansprechpartner, mit Vorbelegung,
--                festem Owner und vorbereiteter Konditionsvorlage
--   campaign  -- wiederverwendbar fuer LinkedIn/Outbound/Partner, mit
--                campaign_key und source fuer die Auswertung
--   public    -- Website/organisch, ohne Vorbelegung
--
-- Der Link ist bei ALLEN Typen mehrfach oeffenbar. Die Einmal-Bindung aus
-- ONBOARDING_INTAKE_MASTERANALYSE.md J.2.4 liegt bewusst NICHT hier, sondern
-- eine Ebene tiefer am Entwurfs-Token (Migration 2): ein Link traegt nur
-- Vorbelegung (Firmenname, Branche, Region) und ist kein Geheimnis; ein
-- Entwurf traegt Gehaltsbaender und gescheiterte Suchversuche und ist eines.
-- So kann derselbe Ansprechpartner eine zweite Stelle aufnehmen, ohne dass
-- ein weitergeleiteter Link je fremde Entwuerfe oeffnet.
--
-- Vom Token liegt nur der SHA-256-Hash in der DB (Muster:
-- supabase/functions/organization-invite/index.ts:19-32, der einzige CSPRNG-
-- Tokengenerator im Repo). Der Klartext existiert genau einmal, in der Antwort
-- des Erzeugungsaufrufs.
--
-- Rein additiv. Keine bestehende Tabelle, Policy oder View wird veraendert.
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
  -- outreach_companies ist die einzige Tabelle im System mit einem belastbaren
  -- Firmenschluessel (domain TEXT UNIQUE NOT NULL, 20251216151239:6).
  outreach_company_id      uuid REFERENCES public.outreach_companies(id) ON DELETE SET NULL,
  outreach_lead_id         uuid REFERENCES public.outreach_leads(id)     ON DELETE SET NULL,
  organization_id          uuid REFERENCES public.organizations(id)      ON DELETE SET NULL,

  -- Freie Vorbelegung fuer den Aufnahmedialog. Erlaubte Schluessel:
  --   company_name, company_domain, industry, location, company_size,
  --   contact_name, contact_email, contact_role,
  --   seed_title, seed_text, contract_type
  -- KEINE Kandidatendaten -- harte Regel aus J.2.4.
  prefill                  jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Konditionsvorlage; FK wird in Migration 3 nachgezogen, damit die
  -- Reihenfolge der Lovable-Prompts frei bleibt.
  terms_template_id        uuid,
  -- Abweichung innerhalb der in der Vorlage veroeffentlichten Bandbreite.
  -- NULL = Vorlagenwert. Die Bandbreitenpruefung sitzt in Migration 3.
  fee_percentage           numeric(5,2),
  recruiter_fee_percentage numeric(5,2),

  -- Freemail am oeffentlichen Link: Standard ist Ablehnung (Entscheidung
  -- 2026-08-31). Pro Link uebersteuerbar, etwa fuer Einzelunternehmer.
  allow_freemail           boolean NOT NULL DEFAULT false,

  -- Nutzung. max_uses NULL = unbegrenzt. Jeder Aufruf erzeugt einen eigenen
  -- Entwurf mit eigenem Token; der Zaehler begrenzt Missbrauch, nicht den Kunden.
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
-- Eigene Tabelle statt platform_events: dort ist user_id NOT NULL, ein
-- anonymes Akquise-Ereignis waere unspeicherbar. Ein Ereignis gehoert
-- ausserdem einem Link, nicht einem Nutzer (Evidence Map P1.35).
CREATE TABLE IF NOT EXISTS public.intake_link_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id      uuid REFERENCES public.intake_links(id) ON DELETE CASCADE,
  -- FK auf intake_drafts folgt in Migration 2 (Reihenfolgefreiheit).
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
  -- Pseudonym des Browsers; kein Personenbezug ohne die Draft-Zeile.
  anonymous_id text,
  -- IP ausschliesslich gehasht (J.2.4).
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
-- Der Gast-Zugriff laeuft ausschliesslich ueber Edge Functions mit
-- Service-Role. Es entsteht KEINE neue Policy fuer anon/public; die
-- Ausnahmeliste aus 20260829110000_rls_close_open_policies.sql wird nicht
-- erweitert. Belegt in supabase/tests/002_intake_permissions_test.sql.
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
