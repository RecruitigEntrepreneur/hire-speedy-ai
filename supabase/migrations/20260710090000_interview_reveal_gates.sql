-- ============================================================================
-- INTERVIEW REVEAL GATES (Triple-Blind Phase 0, Interview-Teil)
-- ============================================================================
-- Schließt die serverseitigen Lecks rund um Interviews:
--   1. interview_participants war mit USING (true) für JEDEN eingeloggten
--      Nutzer lesbar → nur noch Beteiligte (Teilnehmer, Recruiter, Client, Admin).
--   2. client_interviews_view lieferte candidates.full_name IMMER →
--      Name/ID nur noch nach Opt-In (identity_unlocked / identity_revealed).
--   3. candidates: Client-Lesezugriff nur noch für Submissions mit Reveal —
--      schließt den Join-Leak interviews→submissions→candidates in der API.
--
-- HINWEIS: Bewusst als eigene Migration, manuell deployen. Ergänzt
-- TRIPLE_BLIND_PHASE0_gate_hardening.proposal.sql (Submissions-/View-Teil).
-- Das Frontend (ClientInterviews-Agenda) läuft bereits reveal-sicher und
-- funktioniert vor wie nach dem Deploy dieser Migration.
-- ============================================================================

-- 1) interview_participants: offene Jedermann-Policy ersetzen
DROP POLICY IF EXISTS "Anyone can view interview participants" ON public.interview_participants;

DROP POLICY IF EXISTS "Interview parties can view participants" ON public.interview_participants;
CREATE POLICY "Interview parties can view participants"
  ON public.interview_participants FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.interviews i
      JOIN public.submissions s ON s.id = i.submission_id
      JOIN public.jobs j ON j.id = s.job_id
      WHERE i.id = interview_participants.interview_id
        AND (s.recruiter_id = auth.uid() OR j.client_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- 2) client_interviews_view: Kandidatenname nur nach Reveal
DROP VIEW IF EXISTS public.client_interviews_view;
CREATE VIEW public.client_interviews_view
WITH (security_invoker = true) AS
SELECT
  i.id,
  i.status,
  i.scheduled_at,
  i.created_at,
  i.submission_id,
  s.status AS submission_status,
  s.job_id,
  j.client_id,
  j.title AS job_title,
  j.industry AS job_industry,
  CASE
    WHEN s.identity_unlocked IS TRUE OR s.identity_revealed IS TRUE
    THEN c.full_name
    ELSE NULL
  END AS candidate_name,
  CASE
    WHEN s.identity_unlocked IS TRUE OR s.identity_revealed IS TRUE
    THEN c.id
    ELSE NULL
  END AS candidate_id
FROM public.interviews i
JOIN public.submissions s ON i.submission_id = s.id
JOIN public.jobs j ON s.job_id = j.id
JOIN public.candidates c ON s.candidate_id = c.id
WHERE i.status NOT IN ('cancelled', 'completed', 'no_show')
  AND s.status NOT IN ('rejected', 'withdrawn', 'hired', 'client_rejected');

-- 3) candidates: Client liest Rohdaten erst nach Reveal.
--    (Policies sind OR-verknüpft: Recruiter-/Admin-Zugriffe bleiben unberührt.)
DROP POLICY IF EXISTS "Clients can view candidates for their jobs" ON public.candidates;

DROP POLICY IF EXISTS "Clients view candidates only after reveal" ON public.candidates;
CREATE POLICY "Clients view candidates only after reveal"
  ON public.candidates FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.submissions s
      JOIN public.jobs j ON j.id = s.job_id
      WHERE s.candidate_id = candidates.id
        AND j.client_id = auth.uid()
        AND (s.identity_unlocked IS TRUE OR s.identity_revealed IS TRUE)
    )
  );
