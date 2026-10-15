-- ============================================================================
-- Verifizierte Firmen (15.10.2026)
-- ============================================================================
-- Ein Kunde darf Stellen nur für Firmen einreichen, die Matchunt verifiziert
-- hat. Neben der Hauptfirma kann er weitere Firmen beantragen (Tochter-,
-- Schwester-, Muttergesellschaft); bei der Jobaufnahme wählt er eine
-- verifizierte Firma, der Firmenname der Stelle kommt dann von dort.
--
--   1. Tabelle client_companies je Kundenkonto (Inhaber + Organisation)
--   2. Schreiben nur über RPCs: Kunde beantragt, Admin entscheidet
--   3. jobs.company_id: Name aus der Firma, Einreichen nur mit verifizierter Firma
--   4. Bestand: Hauptfirma aus dem Firmenprofil, weitere Firmennamen aus den
--      Stellen als „beantragt“, Stellen zugeordnet
--   5. Kundenfrage der Headhunter („Ist X schon dein Kunde?“) je Firma statt je Konto
--   6. client_verifications: Kunde kann den Prüfstatus nicht mehr selbst setzen
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Firmen
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'main' CHECK (role IN ('main', 'subsidiary', 'sister', 'parent')),
  name text NOT NULL,
  legal_name text,
  street text,
  postal_code text,
  city text,
  country text DEFAULT 'DE',
  registration_number text,
  vat_id text,
  website text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  proof_path text,
  check_report jsonb,
  checked_at timestamptz,
  requested_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid,
  decided_at timestamptz,
  reject_reason text,
  admin_question text,
  -- Beantragte Änderung einer verifizierten Firma; bis Matchunt sie freigibt,
  -- gelten die bisherigen Daten.
  pending_change jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_companies IS
  'Firmen eines Kundenkontos. Stellen nur für Firmen mit status = verified; Status setzt nur Matchunt (admin_decide_company).';

CREATE UNIQUE INDEX IF NOT EXISTS uq_client_companies_name
  ON public.client_companies (owner_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS idx_client_companies_org ON public.client_companies (organization_id);
CREATE INDEX IF NOT EXISTS idx_client_companies_pending ON public.client_companies (requested_at)
  WHERE status = 'pending' OR pending_change IS NOT NULL;

ALTER TABLE public.client_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Kunden sehen Firmen ihres Kontos" ON public.client_companies;
CREATE POLICY "Kunden sehen Firmen ihres Kontos" ON public.client_companies
  FOR SELECT USING (
    owner_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()))
  );
DROP POLICY IF EXISTS "Admins verwalten Firmen" ON public.client_companies;
CREATE POLICY "Admins verwalten Firmen" ON public.client_companies
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Kundenkonto eines Nutzers: aktive Kunden-Organisation (Inhaber zuerst), sonst er selbst.
CREATE OR REPLACE FUNCTION public.client_account_of(p_user_id uuid)
RETURNS TABLE (owner_id uuid, organization_id uuid, can_manage boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(o.owner_id, p_user_id), o.id,
         COALESCE(om.role IN ('owner', 'admin'), true)
    FROM (SELECT 1) x
    LEFT JOIN LATERAL (
      SELECT m.organization_id, m.role FROM organization_members m
        JOIN organizations org ON org.id = m.organization_id AND org.type = 'client'
       WHERE m.user_id = p_user_id AND m.status = 'active'
       ORDER BY (m.role = 'owner') DESC, m.created_at
       LIMIT 1
    ) om ON true
    LEFT JOIN organizations o ON o.id = om.organization_id;
$$;

-- Gehört eine Firma zum Konto einer Stelle?
CREATE OR REPLACE FUNCTION public.company_matches_job(p_company client_companies, p_client_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (p_org_id IS NOT NULL AND p_company.organization_id = p_org_id)
      OR p_company.owner_id = p_client_id
      OR (p_org_id IS NOT NULL AND p_company.owner_id = (SELECT owner_id FROM organizations WHERE id = p_org_id));
$$;

-- ----------------------------------------------------------------------------
-- 2. Beantragen und entscheiden
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.client_request_company(
  p_id uuid,
  p_name text,
  p_legal_name text,
  p_street text,
  p_postal_code text,
  p_city text,
  p_country text,
  p_registration_number text,
  p_vat_id text,
  p_website text,
  p_role text,
  p_proof_path text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_acc record;
  v_row client_companies%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Bitte anmelden.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(btrim(p_name), '') = '' THEN
    RAISE EXCEPTION 'Bitte den Firmennamen angeben.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_acc FROM public.client_account_of(v_uid);
  IF NOT v_acc.can_manage THEN
    RAISE EXCEPTION 'Firmen beantragen kann der Inhaber oder ein Admin Ihres Kontos.' USING ERRCODE = '42501';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO client_companies (owner_id, organization_id, role, name, legal_name, street, postal_code, city, country,
                                  registration_number, vat_id, website, status, proof_path, requested_by)
    VALUES (v_acc.owner_id, v_acc.organization_id,
            CASE WHEN EXISTS (SELECT 1 FROM client_companies WHERE owner_id = v_acc.owner_id)
                 THEN COALESCE(NULLIF(p_role, 'main'), 'subsidiary') ELSE 'main' END,
            btrim(p_name), NULLIF(btrim(p_legal_name), ''), NULLIF(btrim(p_street), ''), NULLIF(btrim(p_postal_code), ''),
            NULLIF(btrim(p_city), ''), COALESCE(NULLIF(btrim(p_country), ''), 'DE'), NULLIF(btrim(p_registration_number), ''),
            NULLIF(btrim(p_vat_id), ''), NULLIF(btrim(p_website), ''), 'pending', p_proof_path, v_uid)
    RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_row FROM client_companies WHERE id = p_id AND owner_id = v_acc.owner_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Firma nicht gefunden.' USING ERRCODE = 'P0001';
    END IF;
    IF v_row.status = 'verified' THEN
      -- Verifizierte Firma: Änderung in Prüfung, bis dahin gelten die alten Daten.
      UPDATE client_companies
         SET pending_change = jsonb_build_object(
               'name', btrim(p_name), 'legal_name', NULLIF(btrim(p_legal_name), ''),
               'street', NULLIF(btrim(p_street), ''), 'postal_code', NULLIF(btrim(p_postal_code), ''),
               'city', NULLIF(btrim(p_city), ''), 'country', COALESCE(NULLIF(btrim(p_country), ''), 'DE'),
               'registration_number', NULLIF(btrim(p_registration_number), ''),
               'vat_id', NULLIF(btrim(p_vat_id), ''), 'website', NULLIF(btrim(p_website), ''),
               'role', CASE WHEN role = 'main' THEN 'main' ELSE COALESCE(NULLIF(p_role, 'main'), role) END,
               'proof_path', COALESCE(p_proof_path, proof_path)),
             reject_reason = NULL, admin_question = NULL, check_report = NULL, checked_at = NULL,
             requested_by = v_uid, requested_at = now(), updated_at = now()
       WHERE id = p_id
       RETURNING * INTO v_row;
      PERFORM public.notify_admins('company_request', 'Firmenänderung zur Prüfung',
        format('%s möchte die Daten von „%s“ ändern.', COALESCE((SELECT full_name FROM profiles WHERE user_id = v_uid), 'Ein Kunde'), v_row.name),
        'client_company', v_row.id);
      RETURN v_row.id;
    END IF;
    -- Noch nicht verifiziert: Angaben ersetzen, wieder in die Prüfung.
    UPDATE client_companies
       SET name = btrim(p_name), legal_name = NULLIF(btrim(p_legal_name), ''), street = NULLIF(btrim(p_street), ''),
           postal_code = NULLIF(btrim(p_postal_code), ''), city = NULLIF(btrim(p_city), ''),
           country = COALESCE(NULLIF(btrim(p_country), ''), 'DE'), registration_number = NULLIF(btrim(p_registration_number), ''),
           vat_id = NULLIF(btrim(p_vat_id), ''), website = NULLIF(btrim(p_website), ''),
           role = CASE WHEN role = 'main' THEN 'main' ELSE COALESCE(NULLIF(p_role, 'main'), role) END,
           proof_path = COALESCE(p_proof_path, proof_path),
           status = 'pending', decided_by = NULL, decided_at = NULL, reject_reason = NULL, admin_question = NULL,
           check_report = NULL, checked_at = NULL, requested_by = v_uid, requested_at = now(), updated_at = now()
     WHERE id = p_id
     RETURNING * INTO v_row;
  END IF;

  -- Hauptfirma: leere Felder im Firmenprofil gleich füllen (Vertrag, „Noch offen“).
  -- Überschrieben wird erst, wenn Matchunt verifiziert.
  IF v_row.role = 'main' THEN
    UPDATE company_profiles
       SET legal_name = COALESCE(NULLIF(btrim(legal_name), ''), v_row.legal_name, v_row.name),
           street = COALESCE(NULLIF(btrim(street), ''), v_row.street),
           postal_code = COALESCE(NULLIF(btrim(postal_code), ''), v_row.postal_code),
           city = COALESCE(NULLIF(btrim(city), ''), v_row.city),
           registration_number = COALESCE(NULLIF(btrim(registration_number), ''), v_row.registration_number),
           tax_id = COALESCE(NULLIF(btrim(tax_id), ''), v_row.vat_id),
           website = COALESCE(NULLIF(btrim(website), ''), v_row.website),
           updated_at = now()
     WHERE user_id = v_row.owner_id;
    IF NOT FOUND THEN
      INSERT INTO company_profiles (user_id, company_name, legal_name, street, postal_code, city, registration_number, tax_id, website)
      VALUES (v_row.owner_id, v_row.name, COALESCE(v_row.legal_name, v_row.name), v_row.street, v_row.postal_code,
              v_row.city, v_row.registration_number, v_row.vat_id, v_row.website);
    END IF;
  END IF;

  PERFORM public.notify_admins('company_request', 'Firma zur Prüfung',
    format('%s bittet um Prüfung von „%s“.', COALESCE((SELECT full_name FROM profiles WHERE user_id = v_uid), 'Ein Kunde'), v_row.name),
    'client_company', v_row.id);
  RETURN v_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_decide_company(p_id uuid, p_decision text, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row client_companies%ROWTYPE;
  v_change jsonb;
  v_audience uuid[];
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Nur Matchunt kann Firmen prüfen.' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('verify', 'reject', 'question') THEN
    RAISE EXCEPTION 'Unbekannte Entscheidung.' USING ERRCODE = 'P0001';
  END IF;
  IF p_decision IN ('reject', 'question') AND COALESCE(btrim(p_note), '') = '' THEN
    RAISE EXCEPTION 'Bitte einen Grund oder eine Frage angeben.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row FROM client_companies WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Firma nicht gefunden.' USING ERRCODE = 'P0001';
  END IF;

  IF v_row.status = 'verified' AND v_row.pending_change IS NOT NULL THEN
    -- Beantragte Änderung: übernehmen, verwerfen oder nachfragen. Die Firma bleibt verifiziert.
    v_change := v_row.pending_change;
    UPDATE client_companies
       SET name = CASE WHEN p_decision = 'verify' THEN v_change->>'name' ELSE name END,
           legal_name = CASE WHEN p_decision = 'verify' THEN v_change->>'legal_name' ELSE legal_name END,
           street = CASE WHEN p_decision = 'verify' THEN v_change->>'street' ELSE street END,
           postal_code = CASE WHEN p_decision = 'verify' THEN v_change->>'postal_code' ELSE postal_code END,
           city = CASE WHEN p_decision = 'verify' THEN v_change->>'city' ELSE city END,
           country = CASE WHEN p_decision = 'verify' THEN COALESCE(v_change->>'country', country) ELSE country END,
           registration_number = CASE WHEN p_decision = 'verify' THEN v_change->>'registration_number' ELSE registration_number END,
           vat_id = CASE WHEN p_decision = 'verify' THEN v_change->>'vat_id' ELSE vat_id END,
           website = CASE WHEN p_decision = 'verify' THEN v_change->>'website' ELSE website END,
           role = CASE WHEN p_decision = 'verify' THEN COALESCE(v_change->>'role', role) ELSE role END,
           proof_path = CASE WHEN p_decision = 'verify' THEN COALESCE(v_change->>'proof_path', proof_path) ELSE proof_path END,
           pending_change = CASE WHEN p_decision = 'question' THEN pending_change ELSE NULL END,
           decided_by = CASE WHEN p_decision = 'question' THEN decided_by ELSE v_uid END,
           decided_at = CASE WHEN p_decision = 'question' THEN decided_at ELSE now() END,
           reject_reason = CASE WHEN p_decision = 'reject' THEN btrim(p_note) ELSE NULL END,
           admin_question = CASE WHEN p_decision = 'question' THEN btrim(p_note) ELSE NULL END,
           updated_at = now()
     WHERE id = p_id
     RETURNING * INTO v_row;
  ELSE
  UPDATE client_companies
     SET status = CASE p_decision WHEN 'verify' THEN 'verified' WHEN 'reject' THEN 'rejected' ELSE 'pending' END,
         decided_by = CASE WHEN p_decision = 'question' THEN decided_by ELSE v_uid END,
         decided_at = CASE WHEN p_decision = 'question' THEN decided_at ELSE now() END,
         reject_reason = CASE WHEN p_decision = 'reject' THEN btrim(p_note) ELSE NULL END,
         admin_question = CASE WHEN p_decision = 'question' THEN btrim(p_note) ELSE NULL END,
         updated_at = now()
   WHERE id = p_id
   RETURNING * INTO v_row;
  END IF;

  -- Hauptfirma verifiziert: das Konto gilt als geprüft (Abzeichen im Firmenprofil),
  -- und Vertrag und Rechnung lesen dieselben Daten aus dem Firmenprofil.
  IF p_decision = 'verify' AND v_row.role = 'main' THEN
    INSERT INTO client_verifications (client_id, kyc_status, kyc_verified_at, kyc_verified_by)
    VALUES (v_row.owner_id, 'verified', now(), v_uid)
    ON CONFLICT (client_id) DO UPDATE
      SET kyc_status = 'verified', kyc_verified_at = now(), kyc_verified_by = v_uid, kyc_rejection_reason = NULL;
    UPDATE company_profiles
       SET legal_name = COALESCE(v_row.legal_name, v_row.name), street = v_row.street,
           postal_code = v_row.postal_code, city = v_row.city,
           registration_number = v_row.registration_number, tax_id = v_row.vat_id,
           website = COALESCE(NULLIF(btrim(website), ''), v_row.website), updated_at = now()
     WHERE user_id = v_row.owner_id;
    IF NOT FOUND THEN
      INSERT INTO company_profiles (user_id, company_name, legal_name, street, postal_code, city, registration_number, tax_id, website)
      VALUES (v_row.owner_id, v_row.name, COALESCE(v_row.legal_name, v_row.name), v_row.street, v_row.postal_code,
              v_row.city, v_row.registration_number, v_row.vat_id, v_row.website);
    END IF;
  END IF;

  v_audience := ARRAY(
    SELECT v_row.owner_id
    UNION
    SELECT m.user_id FROM organization_members m
     WHERE v_row.organization_id IS NOT NULL AND m.organization_id = v_row.organization_id
       AND m.status = 'active' AND m.role IN ('owner', 'admin'));
  PERFORM public.notify_users(v_audience, 'company_decision',
    CASE WHEN v_change IS NOT NULL THEN
           CASE p_decision WHEN 'verify' THEN format('Änderung an „%s“ übernommen', v_row.name)
                           WHEN 'reject' THEN format('Änderung an „%s“ nicht übernommen', v_row.name)
                           ELSE format('Rückfrage zu „%s“', v_row.name) END
         ELSE
    CASE p_decision WHEN 'verify' THEN format('„%s“ ist verifiziert', v_row.name)
                    WHEN 'reject' THEN format('„%s“ wurde nicht verifiziert', v_row.name)
                    ELSE format('Rückfrage zu „%s“', v_row.name) END END,
    CASE WHEN p_decision = 'verify' AND v_change IS NOT NULL THEN 'Die neuen Firmendaten gelten ab sofort für neue Stellen.'
         WHEN p_decision = 'verify' THEN 'Sie können jetzt Stellen für diese Firma einreichen.'
         WHEN p_decision = 'reject' THEN format('Grund: %s', btrim(p_note))
         ELSE btrim(p_note) END,
    'client_company', v_row.id);
END;
$$;

REVOKE ALL ON FUNCTION public.client_request_company(uuid, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_request_company(uuid, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_decide_company(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_decide_company(uuid, text, text) TO authenticated;

-- Beleg (optional): eigener Ordner je Kundenkonto, nur Matchunt und der Kunde lesen.
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-proofs', 'company-proofs', false)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Kunden laden Firmenbelege hoch" ON storage.objects;
CREATE POLICY "Kunden laden Firmenbelege hoch" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Firmenbelege lesen" ON storage.objects;
CREATE POLICY "Firmenbelege lesen" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'company-proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));

-- ----------------------------------------------------------------------------
-- 3. Stellen hängen an einer Firma
-- ----------------------------------------------------------------------------
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.client_companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_company ON public.jobs (company_id);

-- ----------------------------------------------------------------------------
-- 4. Bestand
-- ----------------------------------------------------------------------------
-- Kundenkonten mit Stellen oder Firmenprofil; Konto = Inhaber (Organisation oder Kunde).
CREATE TEMP TABLE _accounts ON COMMIT DROP AS
SELECT DISTINCT ON (a.owner_id) a.owner_id, a.organization_id
  FROM (
    SELECT COALESCE(o.owner_id, j.client_id) AS owner_id,
           COALESCE(j.organization_id, (SELECT om.organization_id FROM organization_members om
                                          JOIN organizations org ON org.id = om.organization_id AND org.type = 'client'
                                         WHERE om.user_id = j.client_id AND om.role = 'owner' AND om.status = 'active'
                                         LIMIT 1)) AS organization_id
      FROM jobs j LEFT JOIN organizations o ON o.id = j.organization_id
     WHERE j.client_id IS NOT NULL
    UNION ALL
    SELECT cp.user_id, (SELECT om.organization_id FROM organization_members om
                          JOIN organizations org ON org.id = om.organization_id AND org.type = 'client'
                         WHERE om.user_id = cp.user_id AND om.role = 'owner' AND om.status = 'active' LIMIT 1)
      FROM company_profiles cp
     WHERE COALESCE(btrim(cp.company_name), '') <> ''
  ) a
 WHERE a.owner_id IS NOT NULL
 ORDER BY a.owner_id, a.organization_id NULLS LAST;

-- Hauptfirma: aus dem Firmenprofil, sonst der häufigste Firmenname der Stellen.
-- Verifiziert, wenn das Konto schon freigegebene Stellen hat oder geprüft ist.
INSERT INTO client_companies (owner_id, organization_id, role, name, legal_name, street, postal_code, city,
                              registration_number, vat_id, website, status, decided_at, requested_at)
SELECT a.owner_id, a.organization_id, 'main',
       COALESCE(NULLIF(btrim(cp.company_name), ''), top.company_name),
       NULLIF(btrim(cp.legal_name), ''), NULLIF(btrim(cp.street), ''), NULLIF(btrim(cp.postal_code), ''), NULLIF(btrim(cp.city), ''),
       NULLIF(btrim(cp.registration_number), ''), NULLIF(btrim(cp.tax_id), ''), NULLIF(btrim(cp.website), ''),
       CASE WHEN EXISTS (SELECT 1 FROM jobs j LEFT JOIN organizations o ON o.id = j.organization_id
                          WHERE COALESCE(o.owner_id, j.client_id) = a.owner_id
                            AND j.status IN ('published', 'paused', 'closed', 'filled'))
              OR EXISTS (SELECT 1 FROM client_verifications v WHERE v.client_id = a.owner_id AND v.kyc_status = 'verified')
            THEN 'verified' ELSE 'pending' END,
       now(), now()
  FROM _accounts a
  LEFT JOIN company_profiles cp ON cp.user_id = a.owner_id
  LEFT JOIN LATERAL (
    SELECT btrim(j.company_name) AS company_name FROM jobs j LEFT JOIN organizations o ON o.id = j.organization_id
     WHERE COALESCE(o.owner_id, j.client_id) = a.owner_id AND COALESCE(btrim(j.company_name), '') <> ''
     GROUP BY btrim(j.company_name) ORDER BY count(*) DESC, min(j.created_at) LIMIT 1
  ) top ON true
 WHERE COALESCE(NULLIF(btrim(cp.company_name), ''), top.company_name) IS NOT NULL
ON CONFLICT DO NOTHING;

-- Weitere Firmennamen aus den Stellen: beantragt, Matchunt prüft.
INSERT INTO client_companies (owner_id, organization_id, role, name, status, requested_at)
SELECT DISTINCT ON (a.owner_id, lower(btrim(j.company_name)))
       a.owner_id, a.organization_id, 'subsidiary', btrim(j.company_name), 'pending', now()
  FROM jobs j
  LEFT JOIN organizations o ON o.id = j.organization_id
  JOIN _accounts a ON a.owner_id = COALESCE(o.owner_id, j.client_id)
 WHERE COALESCE(btrim(j.company_name), '') <> ''
   AND NOT EXISTS (SELECT 1 FROM client_companies c
                    WHERE c.owner_id = a.owner_id
                      AND lower(btrim(j.company_name)) IN (lower(btrim(c.name)), lower(btrim(COALESCE(c.legal_name, c.name)))))
ON CONFLICT DO NOTHING;

-- Stellen ihrer Firma zuordnen (gleicher Name oder Name laut Handelsregister).
UPDATE jobs j
   SET company_id = c.id
  FROM client_companies c
 WHERE j.company_id IS NULL
   AND c.owner_id = COALESCE((SELECT owner_id FROM organizations WHERE id = j.organization_id), j.client_id)
   AND lower(btrim(j.company_name)) IN (lower(btrim(c.name)), lower(btrim(COALESCE(c.legal_name, c.name))));

-- Name aus der Firma, Zuordnung, Sperre beim Einreichen.
-- Läuft nach trg_job_set_organization (Organisation steht schon fest).
CREATE OR REPLACE FUNCTION public.jobs_company_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin boolean := auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin');
  v_owner uuid;
  v_company client_companies%ROWTYPE;
BEGIN
  v_owner := COALESCE((SELECT owner_id FROM organizations WHERE id = NEW.organization_id), NEW.client_id);

  -- Ohne Firma: nur einer vorhandenen Firma desselben Kontos zuordnen. Legt Matchunt
  -- die Stelle an (Annahme aus dem Aufnahme-Link), entsteht die Firma gleich verifiziert.
  IF NEW.company_id IS NULL AND COALESCE(btrim(NEW.company_name), '') <> '' AND v_owner IS NOT NULL THEN
    SELECT * INTO v_company FROM client_companies c
     WHERE c.owner_id = v_owner
       AND lower(btrim(NEW.company_name)) IN (lower(btrim(c.name)), lower(btrim(COALESCE(c.legal_name, c.name))))
     ORDER BY (c.status = 'verified') DESC
     LIMIT 1;
    IF FOUND THEN
      NEW.company_id := v_company.id;
    ELSIF v_admin AND TG_OP = 'INSERT' THEN
      INSERT INTO client_companies (owner_id, organization_id, role, name, status, decided_by, decided_at)
      VALUES (v_owner, NEW.organization_id,
              CASE WHEN EXISTS (SELECT 1 FROM client_companies WHERE owner_id = v_owner) THEN 'subsidiary' ELSE 'main' END,
              btrim(NEW.company_name), 'verified', auth.uid(), now())
      RETURNING * INTO v_company;
      NEW.company_id := v_company.id;
    END IF;
  END IF;

  IF NEW.company_id IS NOT NULL THEN
    IF v_company.id IS DISTINCT FROM NEW.company_id THEN
      SELECT * INTO v_company FROM client_companies WHERE id = NEW.company_id;
    END IF;
    IF v_company.id IS NULL THEN
      RAISE EXCEPTION 'Firma nicht gefunden.' USING ERRCODE = 'P0001';
    END IF;
    IF NOT v_admin AND NOT public.company_matches_job(v_company, NEW.client_id, NEW.organization_id) THEN
      RAISE EXCEPTION 'Diese Firma gehört nicht zu Ihrem Konto.' USING ERRCODE = '42501';
    END IF;
    NEW.company_name := COALESCE(NULLIF(btrim(v_company.legal_name), ''), v_company.name);
  END IF;

  -- Einreichen (aus dem Entwurf) nur mit verifizierter Firma. Pausieren, Fortsetzen
  -- und Schließen bestehender Stellen bleiben frei.
  IF NOT v_admin
     AND NEW.status IN ('pending_approval', 'pending_client_approval', 'published')
     AND (TG_OP = 'INSERT' OR OLD.status = 'draft')
     AND (v_company.id IS NULL OR v_company.status <> 'verified') THEN
    RAISE EXCEPTION 'Stellen können nur für eine von Matchunt verifizierte Firma eingereicht werden.'
      USING ERRCODE = '42501', HINT = 'company_not_verified';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_zz_company ON public.jobs;
CREATE TRIGGER trg_jobs_zz_company
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_company_sync();

-- ----------------------------------------------------------------------------
-- 5. Kundenfrage je Firma
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.job_client_key(p_job_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE('company:' || company_id::text, organization_id::text, client_id::text) FROM jobs WHERE id = p_job_id;
$$;

-- Bisherige Antworten der Headhunter gelten für die Firma der Stelle, zu der sie gegeben wurden.
UPDATE recruiter_client_declarations d
   SET client_key = 'company:' || j.company_id::text, updated_at = now()
  FROM jobs j
 WHERE j.id = d.job_id AND j.company_id IS NOT NULL
   AND d.client_key IS DISTINCT FROM 'company:' || j.company_id::text;

-- Suche starten, Einreichen, Antwort speichern und „Meine Suchen“ wie in
-- 20261008120000, nur mit dem Schlüssel je Firma (public.job_client_key).

CREATE OR REPLACE FUNCTION public.start_job_search(p_job_id uuid, p_for_submission boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_job jobs%ROWTYPE;
  v_act recruiter_job_activations%ROWTYPE;
  v_found boolean;
  v_used int;
  v_limit int;
  v_tier text;
  v_over boolean := false;
  v_needs_answer boolean;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'recruiter') THEN
    RAISE EXCEPTION 'Nur Headhunter können suchen.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_uid AND role = 'recruiter' AND suspended_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Dein Konto ist gesperrt.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND OR v_job.status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'Diese Stelle ist nicht mehr offen.' USING ERRCODE = 'P0001', HINT = 'job_not_open';
  END IF;
  IF v_job.paused_at IS NOT NULL THEN
    RAISE EXCEPTION 'Der Kunde hat die Stelle pausiert%.',
      COALESCE(' bis ' || to_char(v_job.pause_until AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY'), '')
      USING ERRCODE = 'P0001', HINT = 'job_paused';
  END IF;

  SELECT tier INTO v_tier FROM recruiter_partner_status WHERE user_id = v_uid AND ended_at IS NULL;

  SELECT * INTO v_act FROM recruiter_job_activations WHERE recruiter_id = v_uid AND job_id = p_job_id FOR UPDATE;
  v_found := FOUND;

  IF v_job.confidential_search AND COALESCE(v_tier, '') <> 'gold' AND NOT v_found THEN
    RAISE EXCEPTION 'Vertrauliche Suche: Diese Stelle ist Gold Partnern vorbehalten.' USING ERRCODE = 'P0001', HINT = 'confidential';
  END IF;

  IF NOT (v_found AND v_act.status IN ('active', 'paused')) THEN
    IF v_found AND v_act.end_reason = 'direct_position' THEN
      RAISE EXCEPTION 'Diese Stelle bearbeitest du direkt mit dem Kunden.' USING ERRCODE = 'P0001', HINT = 'direct_position';
    END IF;

    v_used := public.search_slots_used(v_uid, p_job_id);
    v_limit := public.search_slot_limit(v_uid);
    IF v_used >= v_limit THEN
      -- Wer direkt einreicht, darf genau eine Suche über die Grenze starten.
      IF p_for_submission AND v_used < v_limit + 1 THEN
        v_over := true;
      ELSE
        RAISE EXCEPTION 'Alle % Plätze für offene Suchen sind belegt. Reiche bei einer Suche ein, dann ist der Platz sofort frei.', v_limit
          USING ERRCODE = 'P0001', HINT = 'no_slot';
      END IF;
    END IF;

    IF v_found THEN
      UPDATE recruiter_job_activations
         SET status = 'active',
             activated_at = now(),
             ends_at = CASE WHEN COALESCE(has_submitted, false) THEN NULL ELSE now() + interval '30 days' END,
             ended_at = NULL, end_reason = NULL, slot_until = NULL, paused_at = NULL,
             review_hold = false, reminder_sent_at = NULL, over_limit = v_over,
             company_revealed_at = COALESCE(company_revealed_at, now())
       WHERE id = v_act.id
       RETURNING * INTO v_act;
    ELSE
      INSERT INTO recruiter_job_activations
        (recruiter_id, job_id, trust_level_at, status, ends_at, company_revealed_at, over_limit)
      VALUES
        (v_uid, p_job_id, COALESCE(v_tier, 'partner'), 'active', now() + interval '30 days', now(), v_over)
      RETURNING * INTO v_act;
    END IF;

    PERFORM public.notify_users(
      ARRAY(SELECT public.job_client_audience(p_job_id)),
      'search_started',
      'Ein Headhunter sucht jetzt für Sie',
      format('%s sucht jetzt für „%s“.', public.recruiter_display_name(v_uid), v_job.title),
      'job', p_job_id);
  END IF;

  v_needs_answer := NOT EXISTS (
    SELECT 1 FROM recruiter_client_declarations d
     WHERE d.recruiter_id = v_uid
       AND d.client_key = public.job_client_key(v_job.id)
       AND d.answer IN ('no', 'client'));

  RETURN jsonb_build_object(
    'activation_id', v_act.id,
    'status', v_act.status,
    'company_name', v_job.company_name,
    'location', v_job.location,
    'ends_at', v_act.ends_at,
    'needs_client_answer', v_needs_answer,
    'slots_used', public.search_slots_used(v_uid),
    'slot_limit', public.search_slot_limit(v_uid),
    'over_limit', v_act.over_limit
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_submission_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_act recruiter_job_activations%ROWTYPE;
  v_job jobs%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
  IF NOT FOUND OR v_job.status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'Diese Stelle ist nicht mehr offen.' USING ERRCODE = 'P0001', HINT = 'job_not_open';
  END IF;
  IF v_job.paused_at IS NOT NULL THEN
    RAISE EXCEPTION 'Der Kunde hat die Stelle pausiert. Einreichen geht wieder, wenn sie weiterläuft.'
      USING ERRCODE = 'P0001', HINT = 'job_paused';
  END IF;

  SELECT * INTO v_act FROM recruiter_job_activations WHERE recruiter_id = NEW.recruiter_id AND job_id = NEW.job_id;
  IF NOT FOUND OR v_act.status = 'ended' THEN
    RAISE EXCEPTION 'Einreichen geht nur bei laufender Suche. Bitte zuerst „Ich suche“ drücken.'
      USING ERRCODE = 'P0001', HINT = 'job_not_activated';
  END IF;
  IF v_act.status = 'paused' THEN
    RAISE EXCEPTION 'Deine Suche ruht gerade. Einreichen geht danach wieder.'
      USING ERRCODE = 'P0001', HINT = 'search_paused';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM recruiter_client_declarations d
     WHERE d.recruiter_id = NEW.recruiter_id
       AND d.client_key = public.job_client_key(v_job.id)
       AND d.answer IN ('no', 'client')
  ) THEN
    RAISE EXCEPTION 'Bitte zuerst beantworten, ob das Unternehmen schon dein Kunde ist.'
      USING ERRCODE = 'P0001', HINT = 'client_question_open';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.answer_client_question(p_job_id uuid, p_answer text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_job jobs%ROWTYPE;
  v_key text;
  v_stichtag timestamptz;
  v_client recruiter_client_declarations%ROWTYPE;
  v_direct recruiter_client_declarations%ROWTYPE;
BEGIN
  IF p_answer NOT IN ('no', 'client', 'direct_position') THEN
    RAISE EXCEPTION 'Unbekannte Antwort.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM recruiter_job_activations
                  WHERE recruiter_id = v_uid AND job_id = p_job_id AND status IN ('active', 'paused')) THEN
    RAISE EXCEPTION 'Für diese Stelle läuft keine Suche.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  v_key := public.job_client_key(v_job.id);
  SELECT min(a.activated_at) INTO v_stichtag
    FROM recruiter_job_activations a JOIN jobs j ON j.id = a.job_id
   WHERE a.recruiter_id = v_uid AND public.job_client_key(j.id) = v_key;

  SELECT * INTO v_client FROM recruiter_client_declarations
   WHERE recruiter_id = v_uid AND client_key = v_key AND answer IN ('no', 'client');

  IF p_answer = 'no' THEN
    IF NOT FOUND THEN
      INSERT INTO recruiter_client_declarations (recruiter_id, client_key, organization_id, client_user_id, job_id, answer, status, stichtag)
      VALUES (v_uid, v_key, v_job.organization_id, v_job.client_id, p_job_id, 'no', 'none', v_stichtag)
      RETURNING * INTO v_client;
    END IF;
    RETURN jsonb_build_object('client_declaration_id', v_client.id);
  END IF;

  -- Ja: Kunde (Beleg folgt); bei „Stelle schon direkt“ zusätzlich je Stelle.
  IF NOT FOUND THEN
    INSERT INTO recruiter_client_declarations (recruiter_id, client_key, organization_id, client_user_id, job_id, answer, status, stichtag)
    VALUES (v_uid, v_key, v_job.organization_id, v_job.client_id, p_job_id, 'client', 'pending', v_stichtag)
    RETURNING * INTO v_client;
  ELSIF v_client.answer = 'no' THEN
    UPDATE recruiter_client_declarations
       SET answer = 'client', status = 'pending', job_id = p_job_id, updated_at = now()
     WHERE id = v_client.id
     RETURNING * INTO v_client;
  END IF;

  IF p_answer = 'direct_position' THEN
    INSERT INTO recruiter_client_declarations (recruiter_id, client_key, organization_id, client_user_id, job_id, answer, status, stichtag)
    VALUES (v_uid, v_key, v_job.organization_id, v_job.client_id, p_job_id, 'direct_position', 'pending', v_stichtag)
    RETURNING * INTO v_direct;

    UPDATE recruiter_job_activations
       SET status = 'paused', review_hold = true, paused_at = COALESCE(paused_at, now())
     WHERE recruiter_id = v_uid AND job_id = p_job_id AND status IN ('active', 'paused');

    PERFORM public.notify_users(
      ARRAY(SELECT public.job_client_audience(p_job_id)),
      'direct_position_request', 'Kurze Rückfrage zu Ihrer Stelle',
      format('%s gibt an, dass Sie ihm die Stelle „%s“ schon vor Ihrer Beauftragung von Matchunt direkt übertragen haben. Bitte bestätigen Sie das auf der Stellenseite.',
             public.recruiter_display_name(v_uid), v_job.title),
      'job', p_job_id);
  END IF;

  PERFORM public.notify_admins('client_declaration', 'Bestandskunde gemeldet',
    format('%s meldet %s als Kunden%s.', public.recruiter_display_name(v_uid), v_job.company_name,
           CASE WHEN p_answer = 'direct_position' THEN format(' und hat „%s“ schon direkt', v_job.title) ELSE '' END),
    'admin_review', COALESCE(v_direct.id, v_client.id));

  RETURN jsonb_build_object('client_declaration_id', v_client.id, 'direct_declaration_id', v_direct.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.my_searches()
RETURNS TABLE (
  job_id uuid,
  title text,
  company_name text,
  location text,
  status text,
  started_at timestamptz,
  ends_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  slot_until timestamptz,
  review_hold boolean,
  job_status text,
  job_paused_until timestamptz,
  job_pause_reason text,
  submissions integer,
  in_process integer,
  last_submission_at timestamptz,
  client_declaration text,
  client_declaration_id uuid,
  direct_declaration text,
  direct_declaration_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.job_id,
         j.title,
         CASE WHEN a.company_revealed_at IS NOT NULL THEN j.company_name END,
         j.location,
         a.status,
         a.activated_at,
         a.ends_at,
         a.ended_at,
         a.end_reason,
         a.slot_until,
         a.review_hold,
         j.status,
         CASE WHEN j.paused_at IS NOT NULL THEN j.pause_until END,
         CASE WHEN j.paused_at IS NOT NULL THEN j.pause_reason END,
         (SELECT count(*)::int FROM submissions s WHERE s.job_id = a.job_id AND s.recruiter_id = a.recruiter_id),
         (SELECT count(*)::int FROM submissions s WHERE s.job_id = a.job_id AND s.recruiter_id = a.recruiter_id
             AND s.stage NOT IN ('rejected', 'client_rejected', 'withdrawn', 'placed')),
         (SELECT max(s.submitted_at) FROM submissions s WHERE s.job_id = a.job_id AND s.recruiter_id = a.recruiter_id),
         (SELECT d.answer || ':' || d.status FROM recruiter_client_declarations d
           WHERE d.recruiter_id = a.recruiter_id AND d.client_key = public.job_client_key(j.id)
             AND d.answer IN ('no', 'client') LIMIT 1),
         (SELECT d.id FROM recruiter_client_declarations d
           WHERE d.recruiter_id = a.recruiter_id AND d.client_key = public.job_client_key(j.id)
             AND d.answer IN ('no', 'client') LIMIT 1),
         (SELECT d.status FROM recruiter_client_declarations d
           WHERE d.recruiter_id = a.recruiter_id AND d.job_id = a.job_id AND d.answer = 'direct_position'
           ORDER BY d.created_at DESC LIMIT 1),
         (SELECT d.id FROM recruiter_client_declarations d
           WHERE d.recruiter_id = a.recruiter_id AND d.job_id = a.job_id AND d.answer = 'direct_position'
           ORDER BY d.created_at DESC LIMIT 1)
    FROM recruiter_job_activations a
    JOIN jobs j ON j.id = a.job_id
   WHERE a.recruiter_id = auth.uid()
   ORDER BY CASE a.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
            a.ends_at NULLS LAST, a.activated_at DESC;
$$;

-- ----------------------------------------------------------------------------
-- 6. Prüfstatus setzt nur Matchunt
-- ----------------------------------------------------------------------------
-- Bisher durfte ein Kunde seine Zeile in client_verifications frei ändern und sich
-- so selbst als geprüft markieren. Firmendaten (HRB, USt-ID) darf er weiter pflegen.
CREATE OR REPLACE FUNCTION public.client_verifications_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.kyc_status := 'pending';
    NEW.kyc_verified_at := NULL;
    NEW.kyc_verified_by := NULL;
    NEW.kyc_rejection_reason := NULL;
  ELSE
    NEW.kyc_status := OLD.kyc_status;
    NEW.kyc_verified_at := OLD.kyc_verified_at;
    NEW.kyc_verified_by := OLD.kyc_verified_by;
    NEW.kyc_rejection_reason := OLD.kyc_rejection_reason;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_verifications_guard ON public.client_verifications;
CREATE TRIGGER trg_client_verifications_guard
  BEFORE INSERT OR UPDATE ON public.client_verifications
  FOR EACH ROW EXECUTE FUNCTION public.client_verifications_guard();
