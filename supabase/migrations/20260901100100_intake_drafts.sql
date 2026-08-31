-- ============================================================================
-- Jobaufnahme-Links · Gast-Entwuerfe, E-Mail-Verifizierung, Rate-Limit (2/6)
-- ----------------------------------------------------------------------------
-- BEFUND (der strukturelle Blocker): jobs.client_id ist
--   uuid NOT NULL REFERENCES auth.users(id) (20251204171610:29-30). Ein Job
--   kann physisch nicht existieren, bevor ein Konto existiert. client_id
--   nullable zu machen waere der falsche Ausweg: can_access_job/can_edit_job
--   (20260710230444:142-186) gehen bei organization_id IS NULL ausschliesslich
--   ueber client_id = _user_id -- ein Job mit client_id NULL waere fuer
--   niemanden ausser Admin sichtbar.
--
-- ENTSCHEIDUNG: Der Gast-Intake lebt in einer eigenen Tabelle und NIE in jobs.
--   So gelockt in ONBOARDING_INTAKE_MASTERANALYSE.md F.4. Zwei weitere Gruende:
--   unvollstaendige Vorgaenge duerfen die Approval-Queue nicht ueberladen, und
--   ein Entwurf ohne Kunden hat in einer Tabelle mit Fremdschluessel auf
--   auth.users nichts verloren.
--
-- Die Inhaltsspalten spiegeln exakt den draft_state-Vertrag aus
-- JobIntakeStudio.tsx:400 { type, built, answers, freelance, flexibility,
-- revealSetup, dyn } -- damit derselbe Studio-Code beide Welten bedient und
-- die vorhandene Hydratisierung (JobIntakeStudio.tsx:294-322) unveraendert
-- weiterlaeuft.
--
-- HARTE REGEL (J.2.4): niemals Kandidatendaten in einem Gast-Entwurf. Diese
-- Tabelle hat konstruktiv kein Feld dafuer.
--
-- Rein additiv.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Der Entwurf
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.intake_drafts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id                uuid REFERENCES public.intake_links(id) ON DELETE SET NULL,

  -- Zugriffstoken liegen in intake_draft_tokens, nicht hier: ein Entwurf hat
  -- ueber die Zeit mehrere (Erstbearbeiter, weitergeleiteter Entscheider,
  -- neu angeforderter Fortsetzungslink), jeder einzeln widerrufbar. Eine
  -- Spalte am Entwurf haette bedeutet, dass Weiterleiten den Zugriff des
  -- Erstbearbeiters loescht.

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

  -- ---- Unternehmen (Grundlage des Vertragsdokuments) ----------------------
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
  -- Eine Domainuebereinstimmung darf niemandem Rechte an einer bestehenden
  -- Organisation geben. Verknuepfen ist eine ausdrueckliche Admin-Handlung.
  matched_organization_id     uuid REFERENCES public.organizations(id)      ON DELETE SET NULL,
  matched_outreach_company_id uuid REFERENCES public.outreach_companies(id) ON DELETE SET NULL,
  matched_client_user_id      uuid,
  match_confidence            text CHECK (match_confidence IS NULL
                                OR match_confidence IN ('exact_domain', 'exact_email', 'name_similar')),

  -- ---- Fuenf getrennte Zustandsachsen -------------------------------------
  -- Eine Sammelspalte waere genau das Split-Brain, das jobs.status heute hat
  -- (TEXT ohne CHECK, sieben Werte, drei Komponenten mit je eigener Auslegung).
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

  -- ---- Aufbewahrung (J.2.4: 30 Tage ab letzter Aktivitaet) ----------------
  last_activity_at  timestamptz NOT NULL DEFAULT now(),
  purge_after       timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  reminder_sent_at  timestamptz,

  ip_hash           text,
  user_agent        text,
  anonymous_id      text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Ein Job entsteht ausschliesslich aus einem angenommenen Entwurf.
  CONSTRAINT intake_drafts_job_requires_accept
    CHECK (job_id IS NULL OR review_state = 'accepted'),
  -- Eingereicht wird nur, was vollstaendig UND verifiziert ist. Die Bedingung
  -- steht hier und nicht nur im Frontend, weil das Frontend im Gast-Fall
  -- vollstaendig unter der Kontrolle des Aufrufers steht.
  --
  -- Gebunden sind ausschliesslich 'pending_admin' und 'accepted'. NICHT
  -- 'changes_requested': dort arbeitet der Kunde weiter, und wenn er dabei
  -- seine E-Mail-Adresse aendert, faellt identity_state absichtlich auf
  -- 'contact_provided' zurueck. Eine strengere Constraint wuerde genau diese
  -- Korrektur unmoeglich machen.
  CONSTRAINT intake_drafts_submit_requires_verified
    CHECK (review_state NOT IN ('pending_admin', 'accepted')
           OR (capture_state = 'complete' AND identity_state = 'email_verified'))
);

-- Die Pruefliste des Admins.
CREATE INDEX IF NOT EXISTS intake_drafts_queue_idx
  ON public.intake_drafts (submitted_at DESC)
  WHERE review_state = 'pending_admin';
-- Die Nachfassliste: unvollstaendig, aber Kontakt vorhanden. Strikt getrennt
-- von der Queue -- genau das war die Anforderung.
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
-- Mehrere Token je Entwurf, weil die gelockte Regel aus J.2.4 lautet: ein
-- weitergeleiteter Link erzeugt einen NEUEN Token statt Zugriff zu gewaehren.
-- Mit einer Token-Spalte am Entwurf haette Weiterleiten den Zugriff des
-- Erstbearbeiters geloescht -- oder man haette den Link einfach herumgereicht,
-- was genau die Sessionbindung aushebelt, die hier Firmengeheimnisse schuetzt.
--
-- Jeder Token traegt, an wen er ging. Damit ist im Nachhinein beantwortbar,
-- wer Zugriff auf ein Briefing mit Gehaltsbaendern hatte -- und jeder Zugang
-- ist einzeln widerrufbar, ohne die anderen zu treffen.
CREATE TABLE IF NOT EXISTS public.intake_draft_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id        uuid NOT NULL REFERENCES public.intake_drafts(id) ON DELETE CASCADE,
  token_hash      text NOT NULL,
  -- Woher der Zugang stammt.
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

-- Der bislang lose draft_id-Verweis bekommt jetzt seinen Fremdschluessel.
ALTER TABLE public.intake_link_events
  DROP CONSTRAINT IF EXISTS intake_link_events_draft_id_fkey;
ALTER TABLE public.intake_link_events
  ADD CONSTRAINT intake_link_events_draft_id_fkey
  FOREIGN KEY (draft_id) REFERENCES public.intake_drafts(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 2) E-Mail-Verifizierung
-- ----------------------------------------------------------------------------
-- Es gibt im Repo kein Verifizierungs-Primitiv: kein signInWithOtp, kein
-- verifyOtp, kein generateLink, kein resetPasswordForEmail. Alle bestehenden
-- Token gehen an eine bereits bekannte Adresse; "der Nutzer traegt seine
-- Adresse selbst ein und weist sie nach" existiert nicht.
CREATE TABLE IF NOT EXISTS public.intake_email_verifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id     uuid NOT NULL REFERENCES public.intake_drafts(id) ON DELETE CASCADE,
  email        text NOT NULL,
  -- Sechsstelliger Code, nur als Hash (mit Pfeffer aus INTAKE_TOKEN_PEPPER).
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
-- Es gibt im gesamten Repo kein Rate-Limiting auf irgendeinem no-auth- oder
-- KI-Endpunkt; die einzige rate_limit-Tabelle (outreach_rate_limits) betrifft
-- Mailversand. Ein oeffentlicher Link ohne Bremse stellt LLM- und
-- Firecrawl-Budget ungebremst ins offene Netz.
CREATE TABLE IF NOT EXISTS public.intake_rate_limits (
  scope        text        NOT NULL CHECK (scope IN ('ip', 'link', 'draft', 'email', 'ai', 'mail')),
  key_hash     text        NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, key_hash, window_start)
);

CREATE INDEX IF NOT EXISTS intake_rate_limits_window_idx
  ON public.intake_rate_limits (window_start);

COMMENT ON TABLE public.intake_rate_limits IS
  'Zaehler je (Bereich, gehashter Schluessel, Zeitfenster) fuer die login-freien '
  'Aufnahme-Endpunkte. Schluessel sind IP-Hashes, Link-IDs, Entwurfs-IDs oder '
  'E-Mail-Hashes -- nie Klartext.';

-- Zaehlen und pruefen in einem Schritt. Gibt true zurueck, wenn der Aufruf
-- ERLAUBT ist. SECURITY DEFINER, damit die Edge Functions sie auch ohne
-- Tabellenrechte aufrufen koennen.
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
    RETURN true;   -- ohne Schluessel keine Aussage; nicht faelschlich sperren
  END IF;

  -- Feste Fenster (kein Sliding Window): billig, ausreichend, und der
  -- Worst Case ist die doppelte Rate an einer Fenstergrenze.
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

-- Alte Fenster wegraeumen; wird vom Aufraeumlauf mitgerufen.
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
-- 4) Aufbewahrung: harte Loeschung nach 30 Tagen Inaktivitaet
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.intake_drafts_purge_expired()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_deleted integer;
BEGIN
  -- Angenommene Entwuerfe sind Teil der Kundenbeziehung und fallen nicht
  -- unter die 30-Tage-Regel; fuer sie gilt die normale Aufbewahrung.
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
ALTER TABLE public.intake_drafts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_draft_tokens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_rate_limits         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage intake drafts" ON public.intake_drafts;
CREATE POLICY "Admins manage intake drafts"
  ON public.intake_drafts FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Der Admin sieht, WER Zugriff auf eine Aufnahme hat -- aber nie den Token.
-- token_hash ist ohne den Pfeffer aus INTAKE_TOKEN_PEPPER wertlos, und der
-- liegt nur in der Function-Umgebung.
DROP POLICY IF EXISTS "Admins read draft tokens" ON public.intake_draft_tokens;
CREATE POLICY "Admins read draft tokens"
  ON public.intake_draft_tokens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins revoke draft tokens" ON public.intake_draft_tokens;
CREATE POLICY "Admins revoke draft tokens"
  ON public.intake_draft_tokens FOR UPDATE TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Verifizierungscodes und Zaehler sind fuer NIEMANDEN per API lesbar,
-- auch nicht fuer Admins. Nur Service-Role (umgeht RLS) kommt heran.
-- Absichtlich keine Policy: RLS aktiv + keine Policy = kein Zugriff.

COMMENT ON TABLE public.intake_rate_limits IS
  'RLS aktiv, bewusst OHNE Policy: nur Service-Role greift zu.';

DROP TRIGGER IF EXISTS trg_intake_drafts_touch ON public.intake_drafts;
CREATE TRIGGER trg_intake_drafts_touch
  BEFORE UPDATE ON public.intake_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMIT;
