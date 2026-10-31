-- Matchunt Liga: der echte Wochenlauf stürzte ab.
--
-- In liga_weekly_rows kollidierte `ON CONFLICT (season_id, recruiter_id, taken_on)` mit
-- der Ergebnisspalte `recruiter_id` („column reference is ambiguous“), die Montagsmail
-- wäre also nie rausgegangen. Vorschau und Testmail enden vor dieser Zeile.
-- Geändert ist nur die Zeile mit ON CONFLICT. Rechte bleiben durch CREATE OR REPLACE erhalten.
-- Mehrfach ausführbar.

CREATE OR REPLACE FUNCTION public.liga_weekly_rows(p_dry_run boolean DEFAULT false)
RETURNS TABLE (recruiter_id uuid, email text, full_name text, season_label text, days_left integer,
               rank integer, participants integer, points integer, previous_rank integer, gap_above integer,
               top_n integer, next_hold date, hold_points integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season uuid;
  s public.liga_seasons%ROWTYPE;
BEGIN
  SELECT id INTO v_season FROM public.liga_seasons
   WHERE closed_at IS NULL AND current_date BETWEEN starts_on AND ends_on ORDER BY starts_on DESC LIMIT 1;
  IF v_season IS NULL THEN RETURN; END IF;
  SELECT * INTO s FROM public.liga_seasons WHERE id = v_season;
  PERFORM public.liga_recompute(v_season);

  RETURN QUERY
    WITH st AS (SELECT * FROM public.liga_standings(v_season) WHERE NOT excluded)
    SELECT st.recruiter_id, coalesce(p.email, u.email)::text, p.full_name, s.label, (s.ends_on - current_date)::int,
           st.rank, st.participants, st.points,
           (SELECT sn.rank FROM public.liga_snapshots sn WHERE sn.season_id = v_season AND sn.recruiter_id = st.recruiter_id
             ORDER BY sn.taken_on DESC LIMIT 1),
           (SELECT min(o.points) - st.points FROM st o WHERE o.points > st.points)::int,
           s.top_n,
           (SELECT min(pl.continuity_end_date) FROM public.placements pl JOIN public.submissions sub ON sub.id = pl.submission_id
             WHERE sub.recruiter_id = st.recruiter_id AND pl.continuity_state = 'running' AND pl.continuity_end_date <= s.ends_on),
           (public.liga_rules(v_season)->>'placement_holds')::int
      FROM st
      LEFT JOIN public.profiles p ON p.user_id = st.recruiter_id
      LEFT JOIN auth.users u ON u.id = st.recruiter_id
      LEFT JOIN public.liga_preferences pr ON pr.recruiter_id = st.recruiter_id
     WHERE coalesce(pr.weekly_mail, true);

  IF p_dry_run THEN RETURN; END IF;
  INSERT INTO public.liga_snapshots (season_id, recruiter_id, taken_on, rank, points)
  SELECT v_season, st.recruiter_id, current_date, st.rank, st.points
    FROM public.liga_standings(v_season) st WHERE NOT st.excluded
  ON CONFLICT ON CONSTRAINT liga_snapshots_pkey DO UPDATE SET rank = excluded.rank, points = excluded.points;
END;
$$;
