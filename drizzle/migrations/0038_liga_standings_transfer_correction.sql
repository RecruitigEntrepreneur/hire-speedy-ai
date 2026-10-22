CREATE OR REPLACE FUNCTION public.liga_standings(p_season_id uuid)
RETURNS TABLE (recruiter_id uuid, rank integer, participants integer, points integer, placements integer,
               interviews integer, submissions integer, quote numeric, last_at timestamptz, excluded boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (SELECT * FROM public.liga_seasons WHERE id = p_season_id),
  bounds AS (SELECT (starts_on::timestamp AT TIME ZONE 'Europe/Berlin') AS f,
                    ((ends_on + 1)::timestamp AT TIME ZONE 'Europe/Berlin') AS t FROM s),
  ev AS (
    SELECT e.recruiter_id, sum(coalesce(e.corrected_points, e.points))::int AS points,
           count(*) FILTER (WHERE e.kind = 'placement')::int AS placements,
           count(*) FILTER (WHERE e.kind = 'interview_first')::int AS interviews,
           max(e.occurred_at) AS last_at
      FROM public.liga_events e WHERE e.season_id = p_season_id GROUP BY e.recruiter_id
  ),
  subs AS (
    SELECT sub.recruiter_id, count(*)::int AS n,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM public.liga_events e WHERE e.season_id = p_season_id AND e.submission_id = sub.id
               AND e.kind IN ('interview_first', 'interview_more')))::int AS hits
      FROM public.submissions sub, bounds b
     WHERE sub.submitted_at >= b.f AND sub.submitted_at < b.t
     GROUP BY sub.recruiter_id
  ),
  base AS (
    SELECT p.recruiter_id, coalesce(ev.points, 0) AS points, coalesce(ev.placements, 0) AS placements,
           coalesce(ev.interviews, 0) AS interviews, coalesce(subs.n, 0) AS submissions,
           CASE WHEN coalesce(subs.n, 0) > 0 THEN round(subs.hits::numeric / subs.n, 3) END AS quote,
           ev.last_at,
           EXISTS (SELECT 1 FROM public.liga_exclusions x WHERE x.season_id = p_season_id AND x.recruiter_id = p.recruiter_id) AS excluded
      FROM public.liga_participants() p
      LEFT JOIN ev ON ev.recruiter_id = p.recruiter_id
      LEFT JOIN subs ON subs.recruiter_id = p.recruiter_id
  )
  SELECT b.recruiter_id,
         CASE WHEN b.excluded THEN NULL ELSE
           (rank() OVER (PARTITION BY b.excluded ORDER BY b.points DESC, b.placements DESC, b.quote DESC NULLS LAST, b.last_at ASC NULLS LAST))::int END,
         (count(*) FILTER (WHERE NOT b.excluded) OVER ())::int,
         b.points, b.placements, b.interviews, b.submissions, b.quote, b.last_at, b.excluded
    FROM base b;
$$;
