-- ============================================================================
-- CLIENT TEAM FOUNDATION · Phase 1 — Mandanten-Modell & Berechtigungsschicht
-- Kontext: Client-Teams (Admin/HR/Hiring Manager/Viewer) mit Job-Scoping.
--
-- Was diese Migration tut:
--   1. Rollenmodell: organization_members/-invites um Rolle 'hr' erweitert.
--   2. Einladungen gehärtet: token_hash (Hash statt Klartext), job_ids
--      (Job-Scoping für HM-Einladungen), revoked_at; die offene
--      "Anyone can view invite by token"-Policy (USING true) wird entfernt —
--      Token-Validierung läuft künftig ausschließlich über Edge Functions
--      (Service Role).
--   3. Neue Tabelle job_collaborators: User↔Job-Zuordnung für Hiring
--      Manager & Viewer (org-weite Rollen owner/admin/hr sehen alles).
--   4. Zentrale SECURITY-DEFINER-Helfer (get_org_role, can_access_job,
--      can_edit_job, ...) — sie ersetzen das Legacy-Scoping
--      `jobs.client_id = auth.uid()` überall in RLS & Views.
--      WICHTIG: Der Legacy-Pfad greift nur noch für Jobs OHNE Organisation;
--      bei Org-Jobs zählt allein die (aktive!) Mitgliedschaft → deaktivierte
--      Mitglieder verlieren sofort jeden Zugriff (DSGVO-Anforderung).
--   5. Fix: Die bisherigen organization_members-Policies referenzierten die
--      eigene Tabelle in USING → "infinite recursion" bei jeder Abfrage.
--      Ersetzt durch funktionsbasierte Policies.
--   6. Backfill: pro bestehendem Client-User eine Organisation (owner =
--      dieser User) + Owner-Mitgliedschaft; jobs.organization_id gesetzt.
--   7. Trigger: neue Jobs erben die Organisation des Erstellers; der
--      Ersteller wird automatisch job_collaborator.
--   8. Kern-RLS re-scoped: jobs, submissions, interviews, candidates,
--      candidate_comments, interview_feedback/-notes/-checklist,
--      job_scorecards, scorecard_evaluations, offers, rejections,
--      placements, interview_participants.
--   9. Client-Views (client_candidate_view, client_candidate_experiences_view,
--      client_fit_assessment_view) auf can_access_job() umgestellt —
--      PII-Reveal-Gates (identity_unlocked) bleiben UNVERÄNDERT.
--  10. Audit: activity_logs.organization_id + Auto-Logging von Team-Events
--      (Einladung, Rollenwechsel, Deaktivierung) + RPC log_candidate_access
--      für DSGVO-Protokollierung von Kandidaten-Profilzugriffen.
--  11. Intake-Freigabe: jobs.client_approved_* Spalten + Helper
--      org_intake_approval_required() (Flag in organizations.settings).
--      Neuer Status 'pending_client_approval' (jobs.status ist TEXT ohne
--      CHECK — keine Constraint-Änderung nötig).
--
-- Triple-Blind: Diese Migration ändert KEINE Reveal-Logik. Alle
-- identity_unlocked-/company_revealed-Gates bleiben identisch; es ändert
-- sich nur, WER als "Client-Seite" eines Jobs gilt.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Rollenmodell: 'hr' ergänzen
-- ----------------------------------------------------------------------------
ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('owner', 'admin', 'hr', 'hiring_manager', 'viewer', 'finance'));

ALTER TABLE public.organization_invites
  DROP CONSTRAINT IF EXISTS organization_invites_role_check;
ALTER TABLE public.organization_invites
  ADD CONSTRAINT organization_invites_role_check
  CHECK (role IN ('admin', 'hr', 'hiring_manager', 'viewer', 'finance'));

-- ----------------------------------------------------------------------------
-- 2) Einladungen härten
--    token bleibt vorerst als (deprecated) Spalte bestehen, wird aber nicht
--    mehr befüllt; neue Invites schreiben nur noch token_hash (SHA-256).
-- ----------------------------------------------------------------------------
ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS job_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.organization_invites ALTER COLUMN token DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organization_invites_token_hash_key
  ON public.organization_invites (token_hash) WHERE token_hash IS NOT NULL;

-- Leak schließen: Invites (inkl. Klartext-Token) waren für JEDEN lesbar.
DROP POLICY IF EXISTS "Anyone can view invite by token" ON public.organization_invites;

-- ----------------------------------------------------------------------------
-- 3) job_collaborators — Job-Scoping für Hiring Manager & Viewer.
--    Die WIRKSAME Berechtigung kommt aus der Org-Rolle des Mitglieds
--    (organization_members.role); die role-Spalte hier ist deskriptiv
--    (Anzeige/spätere Verfeinerung), nicht die Enforcement-Achse.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'hiring_manager'
    CHECK (role IN ('hiring_manager', 'viewer', 'interviewer')),
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_job_collaborators_user ON public.job_collaborators (user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON public.organization_members (user_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_organization ON public.jobs (organization_id);

ALTER TABLE public.job_collaborators ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4) Berechtigungs-Helfer (SECURITY DEFINER: umgehen RLS der Basistabellen,
--    verhindern damit Policy-Rekursion; search_path gepinnt).
-- ----------------------------------------------------------------------------

-- Effektive Org-Rolle eines Users: Org-Owner zählt immer als 'owner',
-- sonst die AKTIVE Mitgliedschaft. NULL = kein Zugriff.
CREATE OR REPLACE FUNCTION public.get_org_role(_org_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN _org_id IS NULL OR _user_id IS NULL THEN NULL
    WHEN EXISTS (SELECT 1 FROM organizations o WHERE o.id = _org_id AND o.owner_id = _user_id)
      THEN 'owner'
    ELSE (
      SELECT om.role FROM organization_members om
      WHERE om.organization_id = _org_id
        AND om.user_id = _user_id
        AND om.status = 'active'
      LIMIT 1
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.get_org_role(_org_id, _user_id) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.get_org_role(_org_id, _user_id) IN ('owner', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_job_collaborator(_job_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM job_collaborators jc
    WHERE jc.job_id = _job_id AND jc.user_id = _user_id
  );
$$;

-- Lesezugriff auf einen Job (Client-Seite):
--   * Job ohne Organisation: Legacy — nur der Ersteller (client_id).
--   * Job mit Organisation:  owner/admin/hr sehen alle Org-Jobs;
--                            hiring_manager/viewer nur mit Collaborator-Eintrag.
--   Deaktivierte Mitglieder: get_org_role liefert NULL → kein Zugriff.
CREATE OR REPLACE FUNCTION public.can_access_job(_job_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = _job_id
      AND (
        (j.organization_id IS NULL AND j.client_id = _user_id)
        OR (
          j.organization_id IS NOT NULL
          AND (
            public.get_org_role(j.organization_id, _user_id) IN ('owner', 'admin', 'hr')
            OR (
              public.get_org_role(j.organization_id, _user_id) IN ('hiring_manager', 'viewer')
              AND public.is_job_collaborator(j.id, _user_id)
            )
          )
        )
      )
  );
$$;

-- Schreibzugriff (Aktionen): wie can_access_job, aber OHNE viewer.
CREATE OR REPLACE FUNCTION public.can_edit_job(_job_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = _job_id
      AND (
        (j.organization_id IS NULL AND j.client_id = _user_id)
        OR (
          j.organization_id IS NOT NULL
          AND (
            public.get_org_role(j.organization_id, _user_id) IN ('owner', 'admin', 'hr')
            OR (
              public.get_org_role(j.organization_id, _user_id) = 'hiring_manager'
              AND public.is_job_collaborator(j.id, _user_id)
            )
          )
        )
      )
  );
$$;

-- Darf ein User neue Jobs (Intakes) anlegen? Alle außer reinen
-- viewer-/finance-Mitgliedern; User ganz ohne Org (Legacy) dürfen weiterhin.
CREATE OR REPLACE FUNCTION public.can_create_job(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    NOT EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = _user_id AND om.status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = _user_id AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'hr', 'hiring_manager')
    )
    OR EXISTS (
      SELECT 1 FROM organizations o WHERE o.owner_id = _user_id
    );
$$;

-- Intake-Freigabe-Pflicht der Organisation (Feature-Flag in settings).
CREATE OR REPLACE FUNCTION public.org_intake_approval_required(_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (o.settings ->> 'intake_approval_required')::boolean
     FROM organizations o WHERE o.id = _org_id),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_org_role(uuid, uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_job_collaborator(uuid, uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_job(uuid, uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_job(uuid, uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_job(uuid)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_intake_approval_required(uuid)      TO authenticated;

-- ----------------------------------------------------------------------------
-- 5) Org-RLS reparieren (Rekursion) & auf Helfer umstellen
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own organizations" ON public.organizations;
CREATE POLICY "Users can view their own organizations" ON public.organizations
  FOR SELECT USING (public.is_org_member(id));

DROP POLICY IF EXISTS "Members can view org members" ON public.organization_members;
CREATE POLICY "Members can view org members" ON public.organization_members
  FOR SELECT USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Org admins can manage members" ON public.organization_members;
CREATE POLICY "Org admins can manage members" ON public.organization_members
  FOR ALL
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Org admins can manage invites" ON public.organization_invites;
CREATE POLICY "Org admins can manage invites" ON public.organization_invites
  FOR ALL
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

-- job_collaborators-Policies
DROP POLICY IF EXISTS "Team can view job collaborators" ON public.job_collaborators;
CREATE POLICY "Team can view job collaborators" ON public.job_collaborators
  FOR SELECT USING (public.can_access_job(job_id));

DROP POLICY IF EXISTS "Org admins can manage job collaborators" ON public.job_collaborators;
CREATE POLICY "Org admins can manage job collaborators" ON public.job_collaborators
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_collaborators.job_id
        AND (
          (j.organization_id IS NULL AND j.client_id = auth.uid())
          OR (j.organization_id IS NOT NULL
              AND public.get_org_role(j.organization_id) IN ('owner', 'admin', 'hr'))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_collaborators.job_id
        AND (
          (j.organization_id IS NULL AND j.client_id = auth.uid())
          OR (j.organization_id IS NOT NULL
              AND public.get_org_role(j.organization_id) IN ('owner', 'admin', 'hr'))
        )
    )
  );

DROP POLICY IF EXISTS "System admins can manage job collaborators" ON public.job_collaborators;
CREATE POLICY "System admins can manage job collaborators" ON public.job_collaborators
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------------------------------------------
-- 6) Backfill: Organisation pro bestehendem Client + Owner-Mitgliedschaft
--    + jobs.organization_id
-- ----------------------------------------------------------------------------

-- 6a) Orgs für alle User mit Client-Rolle, die noch keine Client-Org besitzen
INSERT INTO public.organizations (name, type, owner_id, billing_email)
SELECT DISTINCT ON (u.user_id)
  COALESCE(
    NULLIF(btrim(cp.company_name), ''),
    NULLIF(btrim(p.company_name), ''),
    NULLIF(btrim(p.full_name), ''),
    p.email,
    'Unbenanntes Unternehmen'
  ),
  'client',
  u.user_id,
  cp.billing_email
FROM public.user_roles u
LEFT JOIN public.profiles p          ON p.user_id  = u.user_id
LEFT JOIN public.company_profiles cp ON cp.user_id = u.user_id
WHERE u.role = 'client'
  AND NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.owner_id = u.user_id AND o.type = 'client'
  )
ORDER BY u.user_id;

-- 6b) Sicherheitsnetz: auch Job-Ersteller ohne Client-Rolle bekommen eine Org
INSERT INTO public.organizations (name, type, owner_id)
SELECT DISTINCT ON (j.client_id)
  COALESCE(NULLIF(btrim(j.company_name), ''), 'Unbenanntes Unternehmen'),
  'client',
  j.client_id
FROM public.jobs j
WHERE NOT EXISTS (
  SELECT 1 FROM public.organizations o
  WHERE o.owner_id = j.client_id AND o.type = 'client'
)
ORDER BY j.client_id, j.created_at;

-- 6c) Owner-Mitgliedschaft für jede Client-Org, falls fehlend
INSERT INTO public.organization_members (organization_id, user_id, role, status, joined_at)
SELECT o.id, o.owner_id, 'owner', 'active', now()
FROM public.organizations o
WHERE o.type = 'client'
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = o.id AND om.user_id = o.owner_id
  );

-- 6d) jobs.organization_id aus der (ältesten) Client-Org des Erstellers
UPDATE public.jobs j
SET organization_id = o.id
FROM (
  SELECT DISTINCT ON (owner_id) id, owner_id
  FROM public.organizations
  WHERE type = 'client'
  ORDER BY owner_id, created_at
) o
WHERE j.organization_id IS NULL
  AND j.client_id = o.owner_id;

-- ----------------------------------------------------------------------------
-- 7) Trigger für neue Jobs: Org erben + Ersteller als Collaborator
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.job_set_organization()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT om.organization_id INTO NEW.organization_id
    FROM organization_members om
    JOIN organizations o ON o.id = om.organization_id AND o.type = 'client'
    WHERE om.user_id = NEW.client_id
      AND om.status = 'active'
    ORDER BY (om.role = 'owner') DESC, om.created_at
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_set_organization ON public.jobs;
CREATE TRIGGER trg_job_set_organization
  BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.job_set_organization();

CREATE OR REPLACE FUNCTION public.job_add_creator_collaborator()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO job_collaborators (job_id, user_id, role, added_by)
  VALUES (NEW.id, NEW.client_id, 'hiring_manager', NEW.client_id)
  ON CONFLICT (job_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_add_creator_collaborator ON public.jobs;
CREATE TRIGGER trg_job_add_creator_collaborator
  AFTER INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.job_add_creator_collaborator();

-- Wird eine Client-Org (nachträglich/lazy) angelegt, hängen wir die bereits
-- vorhandenen Org-losen Jobs des Owners an — sonst sähen später eingeladene
-- Teammitglieder die Alt-Jobs nicht.
CREATE OR REPLACE FUNCTION public.org_attach_owner_jobs()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'client' THEN
    UPDATE jobs
    SET organization_id = NEW.id
    WHERE client_id = NEW.owner_id
      AND organization_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_attach_owner_jobs ON public.organizations;
CREATE TRIGGER trg_org_attach_owner_jobs
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.org_attach_owner_jobs();

-- ----------------------------------------------------------------------------
-- 8) Kern-RLS re-scopen: client_id = auth.uid() → can_access_job/can_edit_job
--    (Recruiter- und System-Admin-Policies bleiben unverändert.)
-- ----------------------------------------------------------------------------

-- jobs -----------------------------------------------------------------------
DROP POLICY IF EXISTS "Clients can manage their own jobs" ON public.jobs;

DROP POLICY IF EXISTS "Client team can view their jobs" ON public.jobs;
CREATE POLICY "Client team can view their jobs" ON public.jobs
  FOR SELECT USING (public.can_access_job(id));

DROP POLICY IF EXISTS "Client team can update their jobs" ON public.jobs;
CREATE POLICY "Client team can update their jobs" ON public.jobs
  FOR UPDATE
  USING (public.can_edit_job(id))
  WITH CHECK (public.can_edit_job(id));

DROP POLICY IF EXISTS "Clients can create jobs" ON public.jobs;
CREATE POLICY "Clients can create jobs" ON public.jobs
  FOR INSERT WITH CHECK (auth.uid() = client_id AND public.can_create_job(auth.uid()));

DROP POLICY IF EXISTS "Client admins can delete jobs" ON public.jobs;
CREATE POLICY "Client admins can delete jobs" ON public.jobs
  FOR DELETE USING (
    (organization_id IS NULL AND client_id = auth.uid())
    OR (organization_id IS NOT NULL
        AND public.get_org_role(organization_id) IN ('owner', 'admin', 'hr'))
    OR (client_id = auth.uid() AND public.can_edit_job(id))  -- Ersteller (z. B. HM-Entwurf)
  );

-- submissions ------------------------------------------------------------------
DROP POLICY IF EXISTS "Clients can view submissions for their jobs" ON public.submissions;
DROP POLICY IF EXISTS "Client team can view submissions for their jobs" ON public.submissions;
CREATE POLICY "Client team can view submissions for their jobs" ON public.submissions
  FOR SELECT USING (public.can_access_job(job_id));

DROP POLICY IF EXISTS "Clients can update submissions for their jobs" ON public.submissions;
DROP POLICY IF EXISTS "Client team can update submissions for their jobs" ON public.submissions;
CREATE POLICY "Client team can update submissions for their jobs" ON public.submissions
  FOR UPDATE USING (public.can_edit_job(job_id));

-- interviews -------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view relevant interviews" ON public.interviews;
CREATE POLICY "Users can view relevant interviews" ON public.interviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = interviews.submission_id
        AND (s.recruiter_id = auth.uid() OR public.can_access_job(s.job_id))
    )
  );

DROP POLICY IF EXISTS "Clients can manage interviews for their jobs" ON public.interviews;
DROP POLICY IF EXISTS "Client team can manage interviews for their jobs" ON public.interviews;
CREATE POLICY "Client team can manage interviews for their jobs" ON public.interviews
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = interviews.submission_id
        AND public.can_edit_job(s.job_id)
    )
  );

-- candidates (Reveal-Gate bleibt!) ----------------------------------------------
DROP POLICY IF EXISTS "Clients view candidates only after reveal" ON public.candidates;
CREATE POLICY "Clients view candidates only after reveal" ON public.candidates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.candidate_id = candidates.id
        AND public.can_access_job(s.job_id)
        AND (s.identity_unlocked IS TRUE OR s.identity_revealed IS TRUE)
    )
  );

-- interview_participants ---------------------------------------------------------
DROP POLICY IF EXISTS "Interview parties can view participants" ON public.interview_participants;
CREATE POLICY "Interview parties can view participants"
  ON public.interview_participants FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.interviews i
      JOIN public.submissions s ON s.id = i.submission_id
      WHERE i.id = interview_participants.interview_id
        AND (s.recruiter_id = auth.uid() OR public.can_access_job(s.job_id))
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- candidate_comments (Viewer darf kommentieren → can_access_job) -----------------
DROP POLICY IF EXISTS "Users can view comments on their job submissions" ON public.candidate_comments;
CREATE POLICY "Users can view comments on their job submissions"
  ON public.candidate_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = candidate_comments.submission_id
        AND (s.recruiter_id = auth.uid() OR public.can_access_job(s.job_id))
    )
  );

DROP POLICY IF EXISTS "Users can insert comments on their job submissions" ON public.candidate_comments;
CREATE POLICY "Users can insert comments on their job submissions"
  ON public.candidate_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = candidate_comments.submission_id
        AND public.can_access_job(s.job_id)
    )
  );

-- interview_feedback --------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view feedback for interviews they're involved in" ON public.interview_feedback;
CREATE POLICY "Users can view feedback for interviews they're involved in"
  ON public.interview_feedback FOR SELECT
  USING (
    evaluator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.interviews i
      JOIN public.submissions s ON s.id = i.submission_id
      WHERE i.id = interview_feedback.interview_id
        AND (s.recruiter_id = auth.uid() OR public.can_access_job(s.job_id))
    )
  );

-- interview_notes -------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view interview notes for their interviews" ON public.interview_notes;
CREATE POLICY "Users can view interview notes for their interviews"
  ON public.interview_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.interviews i
      JOIN public.submissions s ON i.submission_id = s.id
      WHERE i.id = interview_notes.interview_id
        AND public.can_access_job(s.job_id)
    )
  );

DROP POLICY IF EXISTS "Users can create notes for their interviews" ON public.interview_notes;
CREATE POLICY "Users can create notes for their interviews"
  ON public.interview_notes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      JOIN public.submissions s ON i.submission_id = s.id
      WHERE i.id = interview_notes.interview_id
        AND public.can_access_job(s.job_id)
    )
  );

-- interview_checklist_progress --------------------------------------------------------
DROP POLICY IF EXISTS "Users can view checklist progress for their interviews" ON public.interview_checklist_progress;
CREATE POLICY "Users can view checklist progress for their interviews"
  ON public.interview_checklist_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.interviews i
      JOIN public.submissions s ON i.submission_id = s.id
      WHERE i.id = interview_checklist_progress.interview_id
        AND public.can_access_job(s.job_id)
    )
  );

DROP POLICY IF EXISTS "Users can manage checklist progress for their interviews" ON public.interview_checklist_progress;
CREATE POLICY "Users can manage checklist progress for their interviews"
  ON public.interview_checklist_progress FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.interviews i
      JOIN public.submissions s ON i.submission_id = s.id
      WHERE i.id = interview_checklist_progress.interview_id
        AND public.can_edit_job(s.job_id)
    )
  );

-- job_scorecards -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view scorecards for their jobs" ON public.job_scorecards;
CREATE POLICY "Users can view scorecards for their jobs"
  ON public.job_scorecards FOR SELECT
  USING (
    public.can_access_job(job_id)
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.submissions s ON s.job_id = j.id
      WHERE j.id = job_scorecards.job_id
        AND s.recruiter_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Clients can manage scorecards for their jobs" ON public.job_scorecards;
DROP POLICY IF EXISTS "Client team can manage scorecards for their jobs" ON public.job_scorecards;
CREATE POLICY "Client team can manage scorecards for their jobs"
  ON public.job_scorecards FOR ALL
  USING (public.can_edit_job(job_id));

-- scorecard_evaluations -----------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view evaluations they created or are involved in" ON public.scorecard_evaluations;
CREATE POLICY "Users can view evaluations they created or are involved in"
  ON public.scorecard_evaluations FOR SELECT
  USING (
    evaluator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.interviews i
      JOIN public.submissions s ON s.id = i.submission_id
      WHERE i.id = scorecard_evaluations.interview_id
        AND (s.recruiter_id = auth.uid() OR public.can_access_job(s.job_id))
    )
  );

-- offers ---------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Clients can manage their own offers" ON public.offers;
DROP POLICY IF EXISTS "Client team can view offers" ON public.offers;
DROP POLICY IF EXISTS "Client team can manage offers" ON public.offers;
CREATE POLICY "Client team can view offers" ON public.offers
  FOR SELECT USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = offers.submission_id
        AND public.can_access_job(s.job_id)
    )
  );

CREATE POLICY "Client team can manage offers" ON public.offers
  FOR ALL USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = offers.submission_id
        AND public.can_edit_job(s.job_id)
    )
  );

-- rejections -------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Clients can create rejections for their job submissions" ON public.rejections;
DROP POLICY IF EXISTS "Client team can create rejections for their job submissions" ON public.rejections;
CREATE POLICY "Client team can create rejections for their job submissions" ON public.rejections
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = rejections.submission_id
        AND public.can_edit_job(s.job_id)
    )
  );

DROP POLICY IF EXISTS "Users can view rejections for their submissions" ON public.rejections;
CREATE POLICY "Users can view rejections for their submissions" ON public.rejections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = rejections.submission_id
        AND (s.recruiter_id = auth.uid() OR public.can_access_job(s.job_id))
    )
  );

-- placements ----------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view relevant placements" ON public.placements;
CREATE POLICY "Users can view relevant placements" ON public.placements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = placements.submission_id
        AND (s.recruiter_id = auth.uid() OR public.can_access_job(s.job_id))
    )
  );

-- ----------------------------------------------------------------------------
-- 9) Client-Views auf Team-Scoping umstellen (Definer-Views erzwingen den
--    Zugriff selbst). Spaltenreihenfolge bleibt identisch; organization_id
--    wird jeweils am ENDE angehängt (CREATE OR REPLACE-kompatibel).
--    PII-Gates (identity_unlocked) unverändert.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.client_candidate_view AS
SELECT
  s.id                          AS submission_id,
  s.candidate_id,
  s.job_id,
  j.client_id,
  s.status,
  s.stage,
  s.match_score,
  s.identity_unlocked,
  s.recruiter_notes,
  j.title                       AS job_title,
  j.industry                    AS job_industry,
  j.company_name                AS job_company_name,
  c.job_title                   AS candidate_role,
  c.seniority,
  c.skills,
  c.certifications,
  c.language_skills,
  c.industry_experience,
  c.target_roles,
  c.notice_period,
  c.availability_date,
  c.remote_preference,
  c.relocation_willing,
  c.remote_days_preferred,
  public.anon_region_broad(c.city)               AS region_broad,
  public.anon_experience_band(c.experience_years) AS experience_band,
  public.anon_salary_band(COALESCE(c.expected_salary, c.salary_expectation_max)) AS salary_band,
  CASE WHEN s.identity_unlocked THEN c.full_name        END AS full_name,
  CASE WHEN s.identity_unlocked THEN c.email            END AS email,
  CASE WHEN s.identity_unlocked THEN c.phone            END AS phone,
  CASE WHEN s.identity_unlocked THEN c.cv_url           END AS cv_url,
  CASE WHEN s.identity_unlocked THEN c.linkedin_url     END AS linkedin_url,
  CASE WHEN s.identity_unlocked THEN c.city             END AS city,
  CASE WHEN s.identity_unlocked THEN c.experience_years END AS experience_years,
  CASE
    WHEN s.identity_unlocked THEN c.cv_ai_summary
    ELSE public.scrub_identity_tokens(
           public.scrub_identity_tokens(c.cv_ai_summary, nm.toks, 'der Kandidat'),
           emp.toks, '[ein Unternehmen]')
  END AS cv_ai_summary,
  s.submitted_at,
  j.organization_id
FROM submissions s
JOIN jobs j        ON j.id = s.job_id
JOIN candidates c  ON c.id = s.candidate_id
CROSS JOIN LATERAL (
  SELECT ARRAY[c.full_name] || ARRAY(
    SELECT p FROM unnest(string_to_array(COALESCE(c.full_name, ''), ' ')) p WHERE length(p) >= 3
  ) AS toks
) nm
CROSS JOIN LATERAL (
  SELECT ARRAY(
    SELECT DISTINCT x FROM (
      SELECT c.company AS x
      UNION
      SELECT ce.company_name FROM candidate_experiences ce WHERE ce.candidate_id = c.id
    ) q WHERE x IS NOT NULL AND length(btrim(x)) >= 3
  ) AS toks
) emp
WHERE public.can_access_job(s.job_id);

GRANT SELECT ON public.client_candidate_view TO authenticated;

CREATE OR REPLACE VIEW public.client_candidate_experiences_view AS
SELECT
  ce.id,
  s.id          AS submission_id,
  ce.candidate_id,
  ce.job_title,
  ce.start_date,
  ce.end_date,
  ce.is_current,
  ce.sort_order,
  s.identity_unlocked,
  CASE WHEN s.identity_unlocked THEN ce.company_name END AS company_name,
  CASE WHEN s.identity_unlocked THEN ce.description  END AS description
FROM candidate_experiences ce
JOIN submissions s ON s.candidate_id = ce.candidate_id
JOIN jobs j        ON j.id = s.job_id
WHERE public.can_access_job(s.job_id);

GRANT SELECT ON public.client_candidate_experiences_view TO authenticated;

CREATE OR REPLACE VIEW public.client_fit_assessment_view AS
SELECT
  a.id,
  a.submission_id,
  a.candidate_id,
  a.job_id,
  s.identity_unlocked,
  a.overall_verdict,
  a.overall_score,
  a.verdict_confidence,
  a.dimension_scores,
  a.model_used,
  a.prompt_version,
  a.generation_time_ms,
  a.generated_by,
  a.generated_at,
  a.created_at,
  a.updated_at,
  a.input_data_hash,
  CASE WHEN s.identity_unlocked THEN a.executive_summary
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(a.executive_summary, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')
  END AS executive_summary,
  CASE WHEN s.identity_unlocked THEN a.rejection_reasoning
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(a.rejection_reasoning, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')
  END AS rejection_reasoning,
  CASE WHEN s.identity_unlocked THEN a.requirement_assessments
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(a.requirement_assessments::text, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')::jsonb
  END AS requirement_assessments,
  CASE WHEN s.identity_unlocked THEN a.gap_analysis
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(a.gap_analysis::text, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')::jsonb
  END AS gap_analysis,
  CASE WHEN s.identity_unlocked THEN a.bonus_qualifications
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(a.bonus_qualifications::text, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')::jsonb
  END AS bonus_qualifications,
  CASE WHEN s.identity_unlocked THEN a.career_trajectory
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(a.career_trajectory::text, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')::jsonb
  END AS career_trajectory,
  CASE WHEN s.identity_unlocked THEN a.implicit_competencies
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(a.implicit_competencies::text, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')::jsonb
  END AS implicit_competencies,
  CASE WHEN s.identity_unlocked THEN a.motivation_fit
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(a.motivation_fit::text, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')::jsonb
  END AS motivation_fit
FROM candidate_fit_assessments a
JOIN submissions s ON s.id = a.submission_id
JOIN jobs       j ON j.id = s.job_id
JOIN candidates c ON c.id = a.candidate_id
CROSS JOIN LATERAL (
  SELECT ARRAY[c.full_name] || ARRAY(
    SELECT p FROM unnest(string_to_array(COALESCE(c.full_name, ''), ' ')) p WHERE length(p) >= 3
  ) AS toks
) nm
CROSS JOIN LATERAL (
  SELECT ARRAY(
    SELECT DISTINCT x FROM (
      SELECT c.company AS x
      UNION
      SELECT ce.company_name FROM candidate_experiences ce WHERE ce.candidate_id = c.id
    ) q WHERE x IS NOT NULL AND length(btrim(x)) >= 3
  ) AS toks
) emp
WHERE public.can_access_job(s.job_id);

GRANT SELECT ON public.client_fit_assessment_view TO authenticated;

-- ----------------------------------------------------------------------------
-- 10) Audit: Mandanten-Scoping für activity_logs + Team-Event-Logging
--     + DSGVO-Protokoll für Kandidaten-Profilzugriffe
-- ----------------------------------------------------------------------------
ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS organization_id uuid;

CREATE INDEX IF NOT EXISTS idx_activity_logs_org
  ON public.activity_logs (organization_id, created_at DESC);

DROP POLICY IF EXISTS "Org admins can view org audit logs" ON public.activity_logs;
CREATE POLICY "Org admins can view org audit logs" ON public.activity_logs
  FOR SELECT USING (
    organization_id IS NOT NULL AND public.is_org_admin(organization_id)
  );

-- Team-Events automatisch protokollieren
CREATE OR REPLACE FUNCTION public.log_org_member_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_logs (user_id, organization_id, action, entity_type, entity_id, details)
    VALUES (
      COALESCE(auth.uid(), NEW.invited_by, NEW.user_id),
      NEW.organization_id,
      'team_member_added',
      'organization_member',
      NEW.id,
      jsonb_build_object('member_user_id', NEW.user_id, 'role', NEW.role, 'status', NEW.status)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      INSERT INTO activity_logs (user_id, organization_id, action, entity_type, entity_id, details)
      VALUES (
        COALESCE(auth.uid(), NEW.user_id),
        NEW.organization_id,
        'team_role_changed',
        'organization_member',
        NEW.id,
        jsonb_build_object('member_user_id', NEW.user_id, 'old_role', OLD.role, 'new_role', NEW.role)
      );
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO activity_logs (user_id, organization_id, action, entity_type, entity_id, details)
      VALUES (
        COALESCE(auth.uid(), NEW.user_id),
        NEW.organization_id,
        CASE WHEN NEW.status = 'inactive' THEN 'team_member_deactivated'
             WHEN NEW.status = 'active'   THEN 'team_member_reactivated'
             ELSE 'team_member_status_changed' END,
        'organization_member',
        NEW.id,
        jsonb_build_object('member_user_id', NEW.user_id, 'old_status', OLD.status, 'new_status', NEW.status)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_org_member_change ON public.organization_members;
CREATE TRIGGER trg_log_org_member_change
  AFTER INSERT OR UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.log_org_member_change();

CREATE OR REPLACE FUNCTION public.log_org_invite_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_logs (user_id, organization_id, action, entity_type, entity_id, details)
    VALUES (
      COALESCE(auth.uid(), NEW.invited_by),
      NEW.organization_id,
      'team_invite_created',
      'organization_invite',
      NEW.id,
      jsonb_build_object('email', NEW.email, 'role', NEW.role, 'job_ids', NEW.job_ids)
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.accepted_at IS NOT NULL AND OLD.accepted_at IS NULL THEN
    INSERT INTO activity_logs (user_id, organization_id, action, entity_type, entity_id, details)
    VALUES (
      COALESCE(auth.uid(), NEW.invited_by),
      NEW.organization_id,
      'team_invite_accepted',
      'organization_invite',
      NEW.id,
      jsonb_build_object('email', NEW.email, 'role', NEW.role)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO activity_logs (user_id, organization_id, action, entity_type, entity_id, details)
    VALUES (
      COALESCE(auth.uid(), OLD.invited_by),
      OLD.organization_id,
      'team_invite_deleted',
      'organization_invite',
      OLD.id,
      jsonb_build_object('email', OLD.email, 'role', OLD.role)
    );
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_org_invite_change ON public.organization_invites;
CREATE TRIGGER trg_log_org_invite_change
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_invites
  FOR EACH ROW EXECUTE FUNCTION public.log_org_invite_change();

-- DSGVO: Zugriff von Client-Usern auf Kandidatenprofile protokollieren.
-- Frontend ruft dies beim Öffnen eines Kandidatenprofils auf (Phase 4).
CREATE OR REPLACE FUNCTION public.log_candidate_access(_submission_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_job_id   uuid;
  v_org_id   uuid;
  v_unlocked boolean;
BEGIN
  SELECT s.job_id, j.organization_id, s.identity_unlocked
    INTO v_job_id, v_org_id, v_unlocked
  FROM submissions s
  JOIN jobs j ON j.id = s.job_id
  WHERE s.id = _submission_id;

  IF v_job_id IS NULL OR auth.uid() IS NULL OR NOT public.can_access_job(v_job_id) THEN
    RETURN;
  END IF;

  INSERT INTO activity_logs (user_id, organization_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    v_org_id,
    'candidate_profile_viewed',
    'submission',
    _submission_id,
    jsonb_build_object('identity_unlocked', v_unlocked)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_candidate_access(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 11) Intake-Freigabe (kundeninterner Approval-Schritt, Phase 3 nutzt das)
-- ----------------------------------------------------------------------------
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS client_approved_by uuid,
  ADD COLUMN IF NOT EXISTS client_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_approval_note text;
