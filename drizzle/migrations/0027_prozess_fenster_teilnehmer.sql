CREATE OR REPLACE FUNCTION public.recruiter_interview_attendee_roles(p_interview_id uuid)
RETURNS TABLE (title text, is_decision_maker boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(btrim(a.title), ''), COALESCE(a.is_decision_maker, false)
  FROM public.interview_attendees a
  JOIN public.interviews i ON i.id = a.interview_id
  JOIN public.submissions s ON s.id = i.submission_id
  WHERE a.interview_id = p_interview_id
    AND s.recruiter_id = auth.uid()
  ORDER BY COALESCE(a.is_decision_maker, false) DESC, a.created_at;
$$;

REVOKE ALL ON FUNCTION public.recruiter_interview_attendee_roles(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recruiter_interview_attendee_roles(uuid) TO authenticated;