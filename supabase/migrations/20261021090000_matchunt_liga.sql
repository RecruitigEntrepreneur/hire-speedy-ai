-- Matchunt Liga (Konzept und Wireframes freigegeben 20.10.2026).
--
-- Eine Saisonwertung für Headhunter mit Partnerstatus: Punkte nur für Ergebnisse,
-- die Kunde oder Kandidat bestätigen (Interview, Angebot, Einstellung, Einstellung
-- hält), dazu Abzüge (Nichterscheinen, Einstellung endet in der Garantiezeit).
-- Am Saisonende vergibt der Admin Auszeichnungen (Headhunter der Saison, Top
-- Performer, Aufsteiger) und die von ihm festgelegten Preise.
--
-- Leitplanken (mit dem Nutzer besprochen):
--   * Nur Anerkennung: keine Plätze, kein Erstzugriff, keine Konditionen am Rang
--     (BAG 9 AZR 102/20, Crowdworker).
--   * Name „Matchunt Liga“, nie „Bundesliga“ (Marke der DFL).
--   * Regeln je Saison eine Fassung; eine laufende Saison ändert sie nicht.
--   * Namen in der Tabelle nur mit Einwilligung (liga_preferences.show_name).
--
-- Mehrfach ausführbar. Der Wochenstand (Edge Function liga-weekly) läuft montags
-- über pg_cron mit eigenem Schlüssel (Muster wie docusign-sync).

-- ---------------------------------------------------------------------------
-- 1. Tabellen
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.liga_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 2 AND 40),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  grace_days integer NOT NULL DEFAULT 10 CHECK (grace_days BETWEEN 0 AND 60),
  visible_from date,
  top_n integer NOT NULL DEFAULT 10 CHECK (top_n BETWEEN 1 AND 100),
  min_placements integer NOT NULL DEFAULT 1 CHECK (min_placements BETWEEN 0 AND 50),
  newcomer_months integer NOT NULL DEFAULT 6 CHECK (newcomer_months BETWEEN 1 AND 36),
  budget_eur integer CHECK (budget_eur IS NULL OR budget_eur >= 0),
  tax_checked_on date,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on > starts_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS liga_seasons_starts_on_idx ON public.liga_seasons (starts_on);

COMMENT ON TABLE public.liga_seasons IS 'Matchunt Liga: eine Zeile je Saison mit ihrer Regelfassung (rules, Punkte je Ereignis). Nur Anerkennung, keine Wirkung auf Plätze oder Konditionen.';

CREATE TABLE IF NOT EXISTS public.liga_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.liga_seasons(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('season_winner', 'top_performer', 'newcomer', 'accurate')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 80),
  prize text CHECK (prize IS NULL OR length(prize) <= 400),
  value_eur integer NOT NULL DEFAULT 0 CHECK (value_eur >= 0),
  image_url text CHECK (image_url IS NULL OR image_url ~ '^https://'),
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  UNIQUE (season_id, kind)
);

CREATE TABLE IF NOT EXISTS public.liga_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.liga_seasons(id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('interview_first', 'interview_more', 'offer', 'placement', 'placement_holds',
                                     'fast_hit', 'accuracy_bonus', 'no_show', 'placement_ended')),
  points integer NOT NULL,
  occurred_at timestamptz NOT NULL,
  submission_id uuid,
  job_id uuid,
  label text,
  source_key text NOT NULL,
  corrected_points integer,
  correction_reason text,
  corrected_by uuid,
  corrected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, source_key),
  CHECK (corrected_points IS NULL OR (correction_reason IS NOT NULL AND length(btrim(correction_reason)) >= 3))
);
CREATE INDEX IF NOT EXISTS liga_events_recruiter_idx ON public.liga_events (season_id, recruiter_id, occurred_at DESC);

COMMENT ON TABLE public.liga_events IS 'Punkte-Protokoll der Matchunt Liga. Wird aus den Quelltabellen abgeleitet (liga_recompute); Korrekturen des Admins bleiben über Neuberechnungen erhalten.';

CREATE TABLE IF NOT EXISTS public.liga_exclusions (
  season_id uuid NOT NULL REFERENCES public.liga_seasons(id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, recruiter_id)
);

CREATE TABLE IF NOT EXISTS public.liga_results (
  season_id uuid NOT NULL REFERENCES public.liga_seasons(id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL,
  rank integer NOT NULL,
  participants integer NOT NULL,
  points integer NOT NULL,
  placements integer NOT NULL,
  interviews integer NOT NULL,
  submissions integer NOT NULL,
  quote numeric,
  awards text[] NOT NULL DEFAULT '{}',
  prize_done_at timestamptz,
  award_mailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, recruiter_id)
);

CREATE TABLE IF NOT EXISTS public.liga_preferences (
  recruiter_id uuid PRIMARY KEY,
  show_name boolean NOT NULL DEFAULT false,
  weekly_mail boolean NOT NULL DEFAULT true,
  award_seen_season uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.liga_snapshots (
  season_id uuid NOT NULL REFERENCES public.liga_seasons(id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL,
  taken_on date NOT NULL,
  rank integer NOT NULL,
  points integer NOT NULL,
  PRIMARY KEY (season_id, recruiter_id, taken_on)
);

-- ---------------------------------------------------------------------------
-- 2. Rechte
-- ---------------------------------------------------------------------------

ALTER TABLE public.liga_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liga_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liga_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liga_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liga_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liga_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liga_snapshots ENABLE ROW LEVEL SECURITY;

-- Saisons und Preise liest der Headhunter nur über liga_me/liga_seasons_list (ohne Budget und Wert).
DROP POLICY IF EXISTS "Liga: Saisons sehen" ON public.liga_seasons;
DROP POLICY IF EXISTS "Liga: Saisons pflegen" ON public.liga_seasons;
CREATE POLICY "Liga: Saisons pflegen" ON public.liga_seasons FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Liga: Preise sehen" ON public.liga_awards;
DROP POLICY IF EXISTS "Liga: Preise pflegen" ON public.liga_awards;
CREATE POLICY "Liga: Preise pflegen" ON public.liga_awards FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Liga: eigene Punkte" ON public.liga_events;
CREATE POLICY "Liga: eigene Punkte" ON public.liga_events FOR SELECT
  USING (recruiter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Liga: eigener Ausschluss" ON public.liga_exclusions;
CREATE POLICY "Liga: eigener Ausschluss" ON public.liga_exclusions FOR SELECT
  USING (recruiter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Liga: eigene Ergebnisse" ON public.liga_results;
CREATE POLICY "Liga: eigene Ergebnisse" ON public.liga_results FOR SELECT
  USING (recruiter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Liga: eigene Einstellungen" ON public.liga_preferences;
CREATE POLICY "Liga: eigene Einstellungen" ON public.liga_preferences FOR SELECT
  USING (recruiter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Liga: eigene Stände" ON public.liga_snapshots;
CREATE POLICY "Liga: eigene Stände" ON public.liga_snapshots FOR SELECT
  USING (recruiter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.liga_seasons, public.liga_awards, public.liga_events, public.liga_exclusions,
                public.liga_results, public.liga_preferences, public.liga_snapshots TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.liga_seasons, public.liga_awards TO authenticated;
GRANT ALL ON public.liga_seasons, public.liga_awards, public.liga_events, public.liga_exclusions,
              public.liga_results, public.liga_preferences, public.liga_snapshots TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Regeln und Hilfen
-- ---------------------------------------------------------------------------

-- Die Punkte der Saison: was in `rules` fehlt, gilt aus der Grundfassung.
CREATE OR REPLACE FUNCTION public.liga_rules(p_season_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'interview_first', 3, 'interview_more', 2, 'offer', 5, 'placement', 15, 'placement_holds', 10,
    'fast_hit', 2, 'fast_days', 5, 'accuracy_bonus', 10, 'accuracy_quote', 0.35, 'accuracy_min', 5,
    'no_show', -3, 'placement_ended', -10, 'accurate_award_min', 10
  ) || coalesce((SELECT rules FROM public.liga_seasons WHERE id = p_season_id), '{}'::jsonb);
$$;

-- Regeln ändern sich nie mitten in der Saison: ab Saisonstart ist die Fassung gesperrt.
CREATE OR REPLACE FUNCTION public.liga_seasons_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.starts_on <= current_date AND NEW.rules IS DISTINCT FROM OLD.rules THEN
    RAISE EXCEPTION 'Die Punkteregeln einer begonnenen Saison bleiben, wie sie sind.';
  END IF;
  IF OLD.starts_on <= current_date AND (NEW.starts_on <> OLD.starts_on OR NEW.ends_on <> OLD.ends_on) THEN
    RAISE EXCEPTION 'Der Zeitraum einer begonnenen Saison bleibt, wie er ist.';
  END IF;
  IF OLD.closed_at IS NOT NULL AND NEW.closed_at IS NULL THEN
    RAISE EXCEPTION 'Eine abgeschlossene Saison bleibt abgeschlossen.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS liga_seasons_guard ON public.liga_seasons;
CREATE TRIGGER liga_seasons_guard BEFORE UPDATE ON public.liga_seasons
  FOR EACH ROW EXECUTE FUNCTION public.liga_seasons_guard();

-- Werktage (Mo–Fr) zwischen zwei Zeitpunkten, ohne den ersten Tag.
CREATE OR REPLACE FUNCTION public.liga_workdays(p_from timestamptz, p_to timestamptz)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p_to <= p_from THEN 0 ELSE (
    SELECT count(*)::integer FROM generate_series((p_from AT TIME ZONE 'Europe/Berlin')::date + 1,
                                                  (p_to AT TIME ZONE 'Europe/Berlin')::date, interval '1 day') d
     WHERE extract(isodow FROM d) < 6) END;
$$;

-- Die Saison, die gerade zählt: laufend, sonst in der Nachfrist, sonst die zuletzt sichtbare.
CREATE OR REPLACE FUNCTION public.liga_current_season()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.liga_seasons
   WHERE coalesce(visible_from, starts_on) <= current_date OR public.has_role(auth.uid(), 'admin')
   ORDER BY (current_date BETWEEN starts_on AND ends_on) DESC,
            (closed_at IS NULL AND current_date BETWEEN starts_on AND ends_on + grace_days) DESC,
            (starts_on <= current_date) DESC,
            starts_on DESC
   LIMIT 1;
$$;

-- Wer mitmacht: Headhunter mit aktivem Partnerstatus (Vertrag ab 2.1).
CREATE OR REPLACE FUNCTION public.liga_participants()
RETURNS TABLE (recruiter_id uuid, granted_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ps.user_id, ps.granted_at FROM public.recruiter_partner_status ps WHERE ps.ended_at IS NULL;
$$;

-- ---------------------------------------------------------------------------
-- 4. Punkte ableiten
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.liga_recompute(p_season_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.liga_seasons%ROWTYPE;
  r jsonb;
  v_from timestamptz;
  v_to timestamptz;
  v_count integer;
BEGIN
  SELECT * INTO s FROM public.liga_seasons WHERE id = p_season_id;
  IF NOT FOUND OR s.closed_at IS NOT NULL THEN RETURN 0; END IF;
  r := public.liga_rules(p_season_id);
  v_from := (s.starts_on::timestamp AT TIME ZONE 'Europe/Berlin');
  v_to := ((s.ends_on + 1)::timestamp AT TIME ZONE 'Europe/Berlin');

  CREATE TEMP TABLE IF NOT EXISTS liga_tmp (
    recruiter_id uuid, kind text, points integer, occurred_at timestamptz,
    submission_id uuid, job_id uuid, label text, source_key text
  ) ON COMMIT DROP;
  TRUNCATE liga_tmp;

  -- Interviews, die stattgefunden haben: vorbei, nicht abgesagt, nicht ersetzt.
  WITH iv AS (
    SELECT i.id, i.submission_id, sub.recruiter_id, sub.job_id, i.scheduled_at, i.no_show_by,
           row_number() OVER (PARTITION BY i.submission_id ORDER BY i.scheduled_at) AS nr
      FROM public.interviews i
      JOIN public.submissions sub ON sub.id = i.submission_id
      JOIN public.liga_participants() p ON p.recruiter_id = sub.recruiter_id
     WHERE i.scheduled_at IS NOT NULL
       AND i.superseded_by IS NULL
       AND i.cancelled_at IS NULL
       AND coalesce(i.status, '') NOT IN ('cancelled', 'declined', 'pending_response', 'counter_proposed', 'expired')
       AND i.scheduled_at + make_interval(mins => coalesce(i.duration_minutes, 60)) <= now()
       AND (i.no_show_by IS NULL OR i.no_show_by = 'candidate')
  )
  INSERT INTO liga_tmp
  SELECT iv.recruiter_id,
         CASE WHEN iv.no_show_by = 'candidate' THEN 'no_show' WHEN iv.nr = 1 THEN 'interview_first' ELSE 'interview_more' END,
         CASE WHEN iv.no_show_by = 'candidate' THEN (r->>'no_show')::int
              WHEN iv.nr = 1 THEN (r->>'interview_first')::int ELSE (r->>'interview_more')::int END,
         iv.scheduled_at, iv.submission_id, iv.job_id, j.title, 'iv:' || iv.id
    FROM iv LEFT JOIN public.jobs j ON j.id = iv.job_id
   WHERE iv.scheduled_at >= v_from AND iv.scheduled_at < v_to;

  -- Angebot: das erste versandte je Einreichung.
  INSERT INTO liga_tmp
  SELECT DISTINCT ON (o.submission_id) sub.recruiter_id, 'offer', (r->>'offer')::int, o.sent_at,
         o.submission_id, sub.job_id, j.title, 'offer:' || o.submission_id
    FROM public.offers o
    JOIN public.submissions sub ON sub.id = o.submission_id
    JOIN public.liga_participants() p ON p.recruiter_id = sub.recruiter_id
    LEFT JOIN public.jobs j ON j.id = sub.job_id
   WHERE o.sent_at IS NOT NULL AND o.sent_at >= v_from AND o.sent_at < v_to
   ORDER BY o.submission_id, o.sent_at;

  -- Einstellung, Einstellung hält, Einstellung endet früh.
  INSERT INTO liga_tmp
  SELECT sub.recruiter_id, 'placement', (r->>'placement')::int, pl.created_at, pl.submission_id, sub.job_id, j.title, 'pl:' || pl.id
    FROM public.placements pl
    JOIN public.submissions sub ON sub.id = pl.submission_id
    JOIN public.liga_participants() p ON p.recruiter_id = sub.recruiter_id
    LEFT JOIN public.jobs j ON j.id = sub.job_id
   WHERE coalesce(pl.placement_state, 'agreed') <> 'cancelled'
     AND pl.created_at >= v_from AND pl.created_at < v_to;

  INSERT INTO liga_tmp
  SELECT sub.recruiter_id, 'placement_holds', (r->>'placement_holds')::int,
         (pl.continuity_end_date::timestamp AT TIME ZONE 'Europe/Berlin'), pl.submission_id, sub.job_id, j.title, 'plhold:' || pl.id
    FROM public.placements pl
    JOIN public.submissions sub ON sub.id = pl.submission_id
    JOIN public.liga_participants() p ON p.recruiter_id = sub.recruiter_id
    LEFT JOIN public.jobs j ON j.id = sub.job_id
   WHERE pl.continuity_state = 'passed' AND pl.continuity_end_date IS NOT NULL
     AND (pl.continuity_end_date::timestamp AT TIME ZONE 'Europe/Berlin') >= v_from
     AND (pl.continuity_end_date::timestamp AT TIME ZONE 'Europe/Berlin') < v_to;

  INSERT INTO liga_tmp
  SELECT sub.recruiter_id, 'placement_ended', (r->>'placement_ended')::int, pl.ended_at, pl.submission_id, sub.job_id, j.title, 'plend:' || pl.id
    FROM public.placements pl
    JOIN public.submissions sub ON sub.id = pl.submission_id
    JOIN public.liga_participants() p ON p.recruiter_id = sub.recruiter_id
    LEFT JOIN public.jobs j ON j.id = sub.job_id
   WHERE pl.placement_state = 'ended_early' AND pl.ended_at IS NOT NULL
     AND pl.ended_at >= v_from AND pl.ended_at < v_to;

  -- Schneller Treffer: erste Einreichung kurz nach „Ich suche“, die zum Interview führte.
  INSERT INTO liga_tmp
  SELECT a.recruiter_id, 'fast_hit', (r->>'fast_hit')::int, f.submitted_at, f.id, a.job_id, j.title, 'fast:' || a.id
    FROM public.recruiter_job_activations a
    JOIN public.liga_participants() p ON p.recruiter_id = a.recruiter_id
    CROSS JOIN LATERAL (
      SELECT sub.id, sub.submitted_at FROM public.submissions sub
       WHERE sub.recruiter_id = a.recruiter_id AND sub.job_id = a.job_id
         AND sub.submitted_at >= a.activated_at
       ORDER BY sub.submitted_at LIMIT 1
    ) f
    LEFT JOIN public.jobs j ON j.id = a.job_id
   WHERE a.activated_at IS NOT NULL
     AND f.submitted_at >= v_from AND f.submitted_at < v_to
     AND public.liga_workdays(a.activated_at, f.submitted_at) <= (r->>'fast_days')::int
     AND EXISTS (SELECT 1 FROM liga_tmp t WHERE t.submission_id = f.id AND t.kind IN ('interview_first', 'interview_more')
                 UNION ALL
                 SELECT 1 FROM public.interviews i WHERE i.submission_id = f.id AND i.superseded_by IS NULL AND i.cancelled_at IS NULL
                   AND i.scheduled_at + make_interval(mins => coalesce(i.duration_minutes, 60)) <= now()
                   AND i.no_show_by IS NULL);

  -- Treffsicherheit: Quote der Einreichungen dieser Saison.
  INSERT INTO liga_tmp
  SELECT q.recruiter_id, 'accuracy_bonus', (r->>'accuracy_bonus')::int, LEAST(now(), v_to - interval '1 second'),
         NULL, NULL, NULL, 'acc:' || q.recruiter_id
    FROM (
      SELECT sub.recruiter_id, count(*) AS n,
             count(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM public.interviews i WHERE i.submission_id = sub.id AND i.superseded_by IS NULL
                 AND i.cancelled_at IS NULL AND i.no_show_by IS NULL
                 AND i.scheduled_at + make_interval(mins => coalesce(i.duration_minutes, 60)) <= now())) AS hits
        FROM public.submissions sub
        JOIN public.liga_participants() p ON p.recruiter_id = sub.recruiter_id
       WHERE sub.submitted_at >= v_from AND sub.submitted_at < v_to
       GROUP BY sub.recruiter_id
    ) q
   WHERE q.n >= (r->>'accuracy_min')::int AND q.hits::numeric / q.n >= (r->>'accuracy_quote')::numeric;

  -- Abgleich: was die Quelle nicht mehr trägt, fällt weg (Korrekturen bleiben).
  DELETE FROM public.liga_events e
   WHERE e.season_id = p_season_id AND e.corrected_points IS NULL
     AND NOT EXISTS (SELECT 1 FROM liga_tmp t WHERE t.source_key = e.source_key);

  INSERT INTO public.liga_events (season_id, recruiter_id, kind, points, occurred_at, submission_id, job_id, label, source_key)
  SELECT p_season_id, t.recruiter_id, t.kind, t.points, t.occurred_at, t.submission_id, t.job_id, t.label, t.source_key
    FROM liga_tmp t
  ON CONFLICT (season_id, source_key) DO UPDATE
     SET recruiter_id = excluded.recruiter_id, kind = excluded.kind, points = excluded.points,
         occurred_at = excluded.occurred_at, submission_id = excluded.submission_id,
         job_id = excluded.job_id, label = excluded.label;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Stand der Saison
-- ---------------------------------------------------------------------------

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

-- Wie der Headhunter in der Tabelle heißt: mit Einwilligung Name und Firma, sonst anonym.
CREATE OR REPLACE FUNCTION public.liga_display_name(p_recruiter_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN coalesce((SELECT show_name FROM public.liga_preferences WHERE recruiter_id = p_recruiter_id), false)
              THEN nullif(btrim(concat_ws(' · ', nullif(btrim(p.full_name), ''), nullif(btrim(p.company_name), ''))), '')
         END
    FROM public.profiles p WHERE p.user_id = p_recruiter_id;
$$;

-- Ohne Einwilligung steht nur der Ort aus der Firmenadresse da („Headhunter aus Köln“).
CREATE OR REPLACE FUNCTION public.liga_city(p_recruiter_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nullif(btrim((regexp_match(coalesce(p.company_address, ''), '\m\d{5}\s+([^,\n\d]+)'))[1]), '')
    FROM public.profiles p WHERE p.user_id = p_recruiter_id;
$$;

-- ---------------------------------------------------------------------------
-- 6. Für den Headhunter
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.liga_seasons_list()
RETURNS TABLE (id uuid, label text, starts_on date, ends_on date, grace_days integer, closed boolean, running boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.label, s.starts_on, s.ends_on, s.grace_days, s.closed_at IS NOT NULL,
         current_date BETWEEN s.starts_on AND s.ends_on
    FROM public.liga_seasons s
   WHERE coalesce(s.visible_from, s.starts_on) <= current_date OR public.has_role(auth.uid(), 'admin')
   ORDER BY s.starts_on DESC;
$$;

DROP FUNCTION IF EXISTS public.liga_table(uuid);
CREATE OR REPLACE FUNCTION public.liga_table(p_season_id uuid DEFAULT NULL)
RETURNS TABLE (rank integer, participants integer, name text, city text, is_me boolean, points integer, placements integer,
               interviews integer, quote numeric, awards text[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season uuid := coalesce(p_season_id, public.liga_current_season());
  v_closed boolean;
BEGIN
  IF v_season IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.liga_seasons s WHERE s.id = v_season
                  AND (coalesce(s.visible_from, s.starts_on) <= current_date OR public.has_role(auth.uid(), 'admin'))) THEN
    RETURN;
  END IF;
  SELECT closed_at IS NOT NULL INTO v_closed FROM public.liga_seasons WHERE id = v_season;
  IF v_closed THEN
    RETURN QUERY
      SELECT r.rank, r.participants, public.liga_display_name(r.recruiter_id), public.liga_city(r.recruiter_id),
             r.recruiter_id = auth.uid(), r.points, r.placements, r.interviews, r.quote, r.awards
        FROM public.liga_results r WHERE r.season_id = v_season ORDER BY r.rank;
  ELSE
    RETURN QUERY
      SELECT st.rank, st.participants, public.liga_display_name(st.recruiter_id), public.liga_city(st.recruiter_id),
             st.recruiter_id = auth.uid(), st.points, st.placements, st.interviews, st.quote, '{}'::text[]
        FROM public.liga_standings(v_season) st
       WHERE NOT st.excluded AND (st.points <> 0 OR st.recruiter_id = auth.uid())
       ORDER BY st.rank;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.liga_me(p_season_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_season uuid := coalesce(p_season_id, public.liga_current_season());
  s public.liga_seasons%ROWTYPE;
  me record;
  v_above integer;
  v_top integer;
  v_participant boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  v_participant := EXISTS (SELECT 1 FROM public.liga_participants() p WHERE p.recruiter_id = v_uid);
  IF v_season IS NULL THEN
    RETURN jsonb_build_object('participant', v_participant, 'season', NULL);
  END IF;
  SELECT * INTO s FROM public.liga_seasons WHERE id = v_season;

  IF s.closed_at IS NOT NULL THEN
    SELECT r.rank, r.participants, r.points, r.placements, r.interviews, r.submissions, r.quote, false AS excluded, r.awards
      INTO me FROM public.liga_results r WHERE r.season_id = v_season AND r.recruiter_id = v_uid;
  ELSE
    SELECT st.rank, st.participants, st.points, st.placements, st.interviews, st.submissions, st.quote, st.excluded, '{}'::text[] AS awards
      INTO me FROM public.liga_standings(v_season) st WHERE st.recruiter_id = v_uid;
    SELECT min(st.points) INTO v_above FROM public.liga_standings(v_season) st
     WHERE NOT st.excluded AND st.points > coalesce(me.points, 0);
    SELECT st.points INTO v_top FROM public.liga_standings(v_season) st
     WHERE NOT st.excluded AND st.rank <= s.top_n ORDER BY st.rank DESC LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'participant', v_participant,
    'name', (SELECT nullif(btrim(p.full_name), '') FROM public.profiles p WHERE p.user_id = v_uid),
    'season', jsonb_build_object(
      'id', s.id, 'label', s.label, 'starts_on', s.starts_on, 'ends_on', s.ends_on, 'grace_days', s.grace_days,
      'closed', s.closed_at IS NOT NULL, 'top_n', s.top_n, 'min_placements', s.min_placements,
      'newcomer_months', s.newcomer_months, 'rules', public.liga_rules(s.id),
      'days_left', GREATEST(0, s.ends_on - current_date)),
    'me', CASE WHEN me IS NULL THEN NULL ELSE jsonb_build_object(
      'rank', me.rank, 'participants', me.participants, 'points', me.points, 'placements', me.placements,
      'interviews', me.interviews, 'submissions', me.submissions, 'quote', me.quote, 'excluded', me.excluded,
      'awards', me.awards,
      'gap_above', CASE WHEN v_above IS NULL THEN NULL ELSE v_above - me.points END,
      'gap_top', CASE WHEN v_top IS NULL OR coalesce(me.rank, 999) <= s.top_n THEN NULL ELSE GREATEST(0, v_top - me.points + 1) END) END,
    'exclusion', (SELECT x.reason FROM public.liga_exclusions x WHERE x.season_id = v_season AND x.recruiter_id = v_uid),
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'kind', e.kind, 'points', coalesce(e.corrected_points, e.points), 'original', e.points,
        'corrected', e.corrected_points IS NOT NULL, 'reason', e.correction_reason,
        'occurred_at', e.occurred_at, 'label', e.label) ORDER BY e.occurred_at DESC)
      FROM public.liga_events e WHERE e.season_id = v_season AND e.recruiter_id = v_uid), '[]'::jsonb),
    -- Was noch kommt: Einstellungen in der Garantiezeit (Fakten, keine Aufforderung)
    'pending_holds', coalesce((SELECT jsonb_agg(jsonb_build_object('label', j.title, 'until', pl.continuity_end_date) ORDER BY pl.continuity_end_date)
      FROM public.placements pl JOIN public.submissions sub ON sub.id = pl.submission_id
      LEFT JOIN public.jobs j ON j.id = sub.job_id
     WHERE sub.recruiter_id = v_uid AND pl.continuity_state = 'running' AND pl.continuity_end_date IS NOT NULL), '[]'::jsonb),
    'awards', coalesce((SELECT jsonb_agg(jsonb_build_object('kind', a.kind, 'title', a.title, 'prize', a.prize, 'image_url', a.image_url) ORDER BY a.sort, a.kind)
      FROM public.liga_awards a WHERE a.season_id = v_season AND a.active), '[]'::jsonb),
    'prefs', (SELECT jsonb_build_object('show_name', p.show_name, 'weekly_mail', p.weekly_mail, 'award_seen_season', p.award_seen_season)
      FROM public.liga_preferences p WHERE p.recruiter_id = v_uid)
  );
END;
$$;

-- Ehrentafel: Siegerinnen und Sieger abgeschlossener Saisons und die eigenen Auszeichnungen.
DROP FUNCTION IF EXISTS public.liga_hall_of_fame();
CREATE OR REPLACE FUNCTION public.liga_hall_of_fame()
RETURNS TABLE (season_id uuid, season_label text, ends_on date, name text, city text, is_me boolean, points integer,
               placements integer, awards text[], rank integer, participants integer, interviews integer, quote numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.label, s.ends_on, public.liga_display_name(r.recruiter_id), public.liga_city(r.recruiter_id),
         r.recruiter_id = auth.uid(),
         r.points, r.placements, r.awards, r.rank, r.participants,
         CASE WHEN r.recruiter_id = auth.uid() THEN r.interviews END, CASE WHEN r.recruiter_id = auth.uid() THEN r.quote END
    FROM public.liga_results r JOIN public.liga_seasons s ON s.id = r.season_id
   WHERE s.closed_at IS NOT NULL
     AND ('season_winner' = ANY (r.awards) OR 'newcomer' = ANY (r.awards) OR r.recruiter_id = auth.uid())
   ORDER BY s.starts_on DESC, r.rank;
$$;

-- Die jüngste Auszeichnung je Headhunter: für „Wer sucht für Sie“, Prüfseite und Signatur.
-- Öffentliche Aussage (steht auf der Prüfseite), deshalb für angemeldete Nutzer lesbar.
CREATE OR REPLACE FUNCTION public.liga_awards_of(p_recruiter_ids uuid[])
RETURNS TABLE (recruiter_id uuid, award text, season_label text, rank integer, participants integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (r.recruiter_id) r.recruiter_id,
         CASE WHEN 'season_winner' = ANY (r.awards) THEN 'season_winner'
              WHEN 'top_performer' = ANY (r.awards) THEN 'top_performer'
              WHEN 'newcomer' = ANY (r.awards) THEN 'newcomer' ELSE 'accurate' END,
         s.label, r.rank, r.participants
    FROM public.liga_results r JOIN public.liga_seasons s ON s.id = r.season_id
   WHERE r.recruiter_id = ANY (p_recruiter_ids) AND s.closed_at IS NOT NULL AND cardinality(r.awards) > 0
   ORDER BY r.recruiter_id, s.starts_on DESC;
$$;

CREATE OR REPLACE FUNCTION public.liga_set_preferences(p_show_name boolean DEFAULT NULL, p_weekly_mail boolean DEFAULT NULL,
                                                       p_award_seen_season uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet.'; END IF;
  INSERT INTO public.liga_preferences (recruiter_id, show_name, weekly_mail, award_seen_season)
  VALUES (auth.uid(), coalesce(p_show_name, false), coalesce(p_weekly_mail, true), p_award_seen_season)
  ON CONFLICT (recruiter_id) DO UPDATE
     SET show_name = coalesce(p_show_name, liga_preferences.show_name),
         weekly_mail = coalesce(p_weekly_mail, liga_preferences.weekly_mail),
         award_seen_season = coalesce(p_award_seen_season, liga_preferences.award_seen_season),
         updated_at = now();
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Für den Admin
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_liga_table(p_season_id uuid)
RETURNS TABLE (recruiter_id uuid, rank integer, participants integer, full_name text, company_name text, tier text,
               points integer, placements integer, holds integer, offers integer, interviews integer, submissions integer,
               quote numeric, deductions integer, previous_rank integer, excluded boolean, exclusion_reason text,
               newcomer boolean, awards text[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.liga_seasons%ROWTYPE;
  v_prev uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Nur für Admins.'; END IF;
  SELECT * INTO s FROM public.liga_seasons WHERE id = p_season_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT id INTO v_prev FROM public.liga_seasons WHERE starts_on < s.starts_on AND closed_at IS NOT NULL ORDER BY starts_on DESC LIMIT 1;
  RETURN QUERY
    WITH st AS (
      SELECT x.recruiter_id, x.rank, x.participants, x.points, x.placements, x.interviews, x.submissions, x.quote, x.excluded, '{}'::text[] AS awards
        FROM public.liga_standings(p_season_id) x WHERE s.closed_at IS NULL
      UNION ALL
      SELECT r.recruiter_id, r.rank, r.participants, r.points, r.placements, r.interviews, r.submissions, r.quote,
             EXISTS (SELECT 1 FROM public.liga_exclusions e WHERE e.season_id = p_season_id AND e.recruiter_id = r.recruiter_id), r.awards
        FROM public.liga_results r WHERE r.season_id = p_season_id AND s.closed_at IS NOT NULL
    )
    SELECT st.recruiter_id, st.rank, st.participants, p.full_name, p.company_name, ps.tier,
           st.points, st.placements,
           (SELECT count(*)::int FROM public.liga_events e WHERE e.season_id = p_season_id AND e.recruiter_id = st.recruiter_id AND e.kind = 'placement_holds'),
           (SELECT count(*)::int FROM public.liga_events e WHERE e.season_id = p_season_id AND e.recruiter_id = st.recruiter_id AND e.kind = 'offer'),
           st.interviews, st.submissions, st.quote,
           (SELECT coalesce(sum(coalesce(e.corrected_points, e.points)), 0)::int FROM public.liga_events e
             WHERE e.season_id = p_season_id AND e.recruiter_id = st.recruiter_id AND coalesce(e.corrected_points, e.points) < 0),
           (SELECT r.rank FROM public.liga_results r WHERE r.season_id = v_prev AND r.recruiter_id = st.recruiter_id),
           st.excluded,
           (SELECT e.reason FROM public.liga_exclusions e WHERE e.season_id = p_season_id AND e.recruiter_id = st.recruiter_id),
           ps.granted_at > (s.starts_on - make_interval(months => s.newcomer_months)),
           st.awards
      FROM st
      LEFT JOIN public.profiles p ON p.user_id = st.recruiter_id
      LEFT JOIN public.recruiter_partner_status ps ON ps.user_id = st.recruiter_id
     ORDER BY st.excluded, st.rank NULLS LAST, st.points DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_liga_events(p_season_id uuid, p_recruiter_id uuid)
RETURNS SETOF public.liga_events
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Nur für Admins.'; END IF;
  RETURN QUERY SELECT * FROM public.liga_events WHERE season_id = p_season_id AND recruiter_id = p_recruiter_id ORDER BY occurred_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_liga_correct(p_event_id uuid, p_points integer, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Nur für Admins.'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN RAISE EXCEPTION 'Bitte einen Grund angeben.'; END IF;
  IF EXISTS (SELECT 1 FROM public.liga_events e JOIN public.liga_seasons s ON s.id = e.season_id
              WHERE e.id = p_event_id AND s.closed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Die Saison ist abgeschlossen.';
  END IF;
  UPDATE public.liga_events
     SET corrected_points = p_points, correction_reason = btrim(p_reason), corrected_by = auth.uid(), corrected_at = now()
   WHERE id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_liga_exclude(p_season_id uuid, p_recruiter_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Nur für Admins.'; END IF;
  IF EXISTS (SELECT 1 FROM public.liga_seasons WHERE id = p_season_id AND closed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Die Saison ist abgeschlossen.';
  END IF;
  IF p_reason IS NULL THEN
    DELETE FROM public.liga_exclusions WHERE season_id = p_season_id AND recruiter_id = p_recruiter_id;
    RETURN;
  END IF;
  IF length(btrim(p_reason)) < 3 THEN RAISE EXCEPTION 'Bitte einen Grund angeben.'; END IF;
  INSERT INTO public.liga_exclusions (season_id, recruiter_id, reason, decided_by)
  VALUES (p_season_id, p_recruiter_id, btrim(p_reason), auth.uid())
  ON CONFLICT (season_id, recruiter_id) DO UPDATE SET reason = excluded.reason, decided_by = excluded.decided_by, created_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_liga_recompute(p_season_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Nur für Admins.'; END IF;
  RETURN public.liga_recompute(p_season_id);
END;
$$;

-- Wer welche Auszeichnung bekäme. Gleiche Regel für Vorschau und Abschluss.
CREATE OR REPLACE FUNCTION public.liga_award_plan(p_season_id uuid)
RETURNS TABLE (recruiter_id uuid, rank integer, participants integer, points integer, placements integer,
               interviews integer, submissions integer, quote numeric, awards text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (SELECT * FROM public.liga_seasons WHERE id = p_season_id),
  st AS (SELECT * FROM public.liga_standings(p_season_id) WHERE NOT excluded),
  active AS (SELECT kind FROM public.liga_awards WHERE season_id = p_season_id AND active),
  accurate AS (
    SELECT st.recruiter_id FROM st, s
     WHERE st.submissions >= (public.liga_rules(p_season_id)->>'accurate_award_min')::int AND st.quote IS NOT NULL
     ORDER BY st.quote DESC, st.placements DESC, st.rank LIMIT 1
  ),
  newcomer AS (
    SELECT st.recruiter_id FROM st
      JOIN public.recruiter_partner_status ps ON ps.user_id = st.recruiter_id, s
     WHERE ps.granted_at > (s.starts_on - make_interval(months => s.newcomer_months))
       AND st.placements >= s.min_placements AND st.points > 0
     ORDER BY st.rank LIMIT 1
  )
  SELECT st.recruiter_id, st.rank, st.participants, st.points, st.placements, st.interviews, st.submissions, st.quote,
         array_remove(ARRAY[
           CASE WHEN st.rank = 1 AND st.placements >= s.min_placements AND st.points > 0
                 AND EXISTS (SELECT 1 FROM active WHERE kind = 'season_winner') THEN 'season_winner' END,
           CASE WHEN st.rank <= s.top_n AND st.placements >= s.min_placements AND st.points > 0
                 AND EXISTS (SELECT 1 FROM active WHERE kind = 'top_performer') THEN 'top_performer' END,
           CASE WHEN st.recruiter_id IN (SELECT recruiter_id FROM newcomer)
                 AND EXISTS (SELECT 1 FROM active WHERE kind = 'newcomer') THEN 'newcomer' END,
           CASE WHEN st.recruiter_id IN (SELECT recruiter_id FROM accurate)
                 AND EXISTS (SELECT 1 FROM active WHERE kind = 'accurate') THEN 'accurate' END
         ], NULL)
    FROM st, s;
$$;

CREATE OR REPLACE FUNCTION public.admin_liga_preview(p_season_id uuid)
RETURNS TABLE (recruiter_id uuid, full_name text, rank integer, points integer, placements integer, awards text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Nur für Admins.'; END IF;
  PERFORM public.liga_recompute(p_season_id);
  RETURN QUERY SELECT a.recruiter_id, p.full_name, a.rank, a.points, a.placements, a.awards
    FROM public.liga_award_plan(p_season_id) a LEFT JOIN public.profiles p ON p.user_id = a.recruiter_id
   WHERE cardinality(a.awards) > 0 ORDER BY a.rank;
END;
$$;

-- Saison abschließen: neu rechnen, Ergebnis einfrieren, Auszeichnungen vergeben.
CREATE OR REPLACE FUNCTION public.admin_liga_close(p_season_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.liga_seasons%ROWTYPE;
  v_awarded integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Nur für Admins.'; END IF;
  SELECT * INTO s FROM public.liga_seasons WHERE id = p_season_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saison nicht gefunden.'; END IF;
  IF s.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Die Saison ist schon abgeschlossen.'; END IF;
  IF current_date <= s.ends_on + s.grace_days THEN
    RAISE EXCEPTION 'Die Nachfrist läuft noch bis %.', to_char(s.ends_on + s.grace_days, 'DD.MM.YYYY');
  END IF;

  PERFORM public.liga_recompute(p_season_id);

  INSERT INTO public.liga_results (season_id, recruiter_id, rank, participants, points, placements, interviews, submissions, quote, awards)
  SELECT p_season_id, a.recruiter_id, a.rank, a.participants, a.points, a.placements, a.interviews, a.submissions, a.quote, a.awards
    FROM public.liga_award_plan(p_season_id) a
   WHERE a.points <> 0 OR cardinality(a.awards) > 0
  ON CONFLICT (season_id, recruiter_id) DO UPDATE
     SET rank = excluded.rank, participants = excluded.participants, points = excluded.points, placements = excluded.placements,
         interviews = excluded.interviews, submissions = excluded.submissions, quote = excluded.quote, awards = excluded.awards;

  UPDATE public.liga_seasons SET closed_at = now(), closed_by = auth.uid(), updated_at = now() WHERE id = p_season_id;

  INSERT INTO public.notifications (user_id, type, title, message, related_type, related_id)
  SELECT r.recruiter_id, 'liga_award',
         CASE WHEN 'season_winner' = ANY (r.awards) THEN 'Du bist Headhunter der Saison ' || s.label
              WHEN 'top_performer' = ANY (r.awards) THEN 'Du bist Top Performer ' || s.label
              WHEN 'newcomer' = ANY (r.awards) THEN 'Du bist Aufsteiger der Saison ' || s.label
              ELSE 'Du bist Treffsicher der Saison ' || s.label END,
         'Platz ' || r.rank || ' von ' || r.participants || ' in der Matchunt Liga. Dein Abzeichen ist im Partnerstatus.',
         'liga_season', p_season_id
    FROM public.liga_results r
   WHERE r.season_id = p_season_id AND cardinality(r.awards) > 0;
  GET DIAGNOSTICS v_awarded = ROW_COUNT;

  RETURN jsonb_build_object('awarded', v_awarded,
    'participants', (SELECT count(*) FROM public.liga_results WHERE season_id = p_season_id));
END;
$$;

-- Saisonübersicht (A1): Teilnehmer, Einstellungen, Preise, offene Preise.
CREATE OR REPLACE FUNCTION public.admin_liga_seasons()
RETURNS TABLE (id uuid, label text, starts_on date, ends_on date, grace_days integer, visible_from date,
               closed_at timestamptz, budget_eur integer, participants integer, placements integer,
               awards_active integer, prizes_open integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Nur für Admins.'; END IF;
  RETURN QUERY
    SELECT s.id, s.label, s.starts_on, s.ends_on, s.grace_days, s.visible_from, s.closed_at, s.budget_eur,
           CASE WHEN s.closed_at IS NOT NULL THEN (SELECT max(r.participants) FROM public.liga_results r WHERE r.season_id = s.id)
                WHEN s.starts_on <= current_date THEN (SELECT count(*)::int FROM public.liga_standings(s.id) x WHERE NOT x.excluded) END,
           CASE WHEN s.starts_on <= current_date THEN (SELECT count(*)::int FROM public.liga_events e WHERE e.season_id = s.id AND e.kind = 'placement') END,
           (SELECT count(*)::int FROM public.liga_awards a WHERE a.season_id = s.id AND a.active),
           CASE WHEN s.closed_at IS NOT NULL THEN (SELECT count(*)::int FROM public.liga_results r
             WHERE r.season_id = s.id AND r.prize_done_at IS NULL AND EXISTS (
               SELECT 1 FROM public.liga_awards a WHERE a.season_id = s.id AND a.active AND a.value_eur > 0 AND a.kind = ANY (r.awards))) END
      FROM public.liga_seasons s
     ORDER BY s.starts_on DESC;
END;
$$;

-- Nach dem Abschluss: Preise ausgeben (Reise buchen, Kurs freischalten) und abhaken.
DROP FUNCTION IF EXISTS public.admin_liga_results(uuid);
CREATE OR REPLACE FUNCTION public.admin_liga_results(p_season_id uuid)
RETURNS TABLE (recruiter_id uuid, full_name text, company_name text, email text, rank integer, points integer,
               placements integer, awards text[], prizes text[], prize_value integer, prize_done_at timestamptz,
               award_mailed_at timestamptz, participants integer, season_label text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Nur für Admins.'; END IF;
  RETURN QUERY
    SELECT r.recruiter_id, p.full_name, p.company_name, p.email, r.rank, r.points, r.placements, r.awards,
           (SELECT array_agg(a.title || coalesce(': ' || a.prize, '') ORDER BY a.sort) FROM public.liga_awards a
             WHERE a.season_id = p_season_id AND a.active AND a.kind = ANY (r.awards)),
           (SELECT coalesce(sum(a.value_eur), 0)::int FROM public.liga_awards a
             WHERE a.season_id = p_season_id AND a.active AND a.kind = ANY (r.awards)),
           r.prize_done_at, r.award_mailed_at, r.participants,
           (SELECT s.label FROM public.liga_seasons s WHERE s.id = p_season_id)
      FROM public.liga_results r LEFT JOIN public.profiles p ON p.user_id = r.recruiter_id
     WHERE r.season_id = p_season_id AND cardinality(r.awards) > 0
     ORDER BY r.rank;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_liga_prize_done(p_season_id uuid, p_recruiter_id uuid, p_done boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Nur für Admins.'; END IF;
  UPDATE public.liga_results SET prize_done_at = CASE WHEN p_done THEN coalesce(prize_done_at, now()) END
   WHERE season_id = p_season_id AND recruiter_id = p_recruiter_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Zeitpläne: täglich rechnen, montags Wochenstand
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.liga_recompute_running()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_total integer := 0;
BEGIN
  FOR v_id IN SELECT id FROM public.liga_seasons
               WHERE closed_at IS NULL AND current_date BETWEEN starts_on AND ends_on + grace_days LOOP
    v_total := v_total + public.liga_recompute(v_id);
  END LOOP;
  RETURN v_total;
END;
$$;

-- Für die Wochenmail: Stand jetzt, Stand der letzten Woche, und der neue Stand wird gemerkt.
DROP FUNCTION IF EXISTS public.liga_weekly_rows();
DROP FUNCTION IF EXISTS public.liga_weekly_rows(boolean);
-- p_dry_run: nur lesen (Vorschau im Admin), ohne den Wochenstand zu merken.
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
  ON CONFLICT (season_id, recruiter_id, taken_on) DO UPDATE SET rank = excluded.rank, points = excluded.points;
END;
$$;

-- Rechte der Funktionen: intern nur für den Server, nach außen für angemeldete Nutzer.
REVOKE ALL ON FUNCTION public.liga_recompute(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.liga_recompute_running() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.liga_weekly_rows(boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.liga_standings(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.liga_award_plan(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.liga_participants() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.liga_display_name(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.liga_city(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.liga_weekly_rows(boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.liga_recompute_running() TO service_role;
GRANT EXECUTE ON FUNCTION public.liga_rules(uuid), public.liga_current_season(), public.liga_seasons_list(),
                         public.liga_table(uuid), public.liga_me(uuid), public.liga_hall_of_fame(),
                         public.liga_awards_of(uuid[]), public.liga_set_preferences(boolean, boolean, uuid),
                         public.admin_liga_table(uuid), public.admin_liga_events(uuid, uuid),
                         public.admin_liga_correct(uuid, integer, text), public.admin_liga_exclude(uuid, uuid, text),
                         public.admin_liga_recompute(uuid), public.admin_liga_preview(uuid), public.admin_liga_close(uuid),
                         public.admin_liga_seasons(), public.admin_liga_results(uuid), public.admin_liga_prize_done(uuid, uuid, boolean)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.liga_awards_of(uuid[]) TO service_role;

-- Schlüssel für liga-weekly: angelegt beim ersten Lauf (nicht in der Migration).
-- Gleiche Funktion wie in 20261009140000_kandidatenprofil_kunde.sql; mehrfach ausführbar.
CREATE OR REPLACE FUNCTION private.cron_token_for(_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_token text;
BEGIN
  INSERT INTO private.cron_tokens (name, token)
  VALUES (_name, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
  ON CONFLICT (name) DO NOTHING;
  SELECT token INTO v_token FROM private.cron_tokens WHERE name = _name;
  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION private.cron_token_for(text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('liga-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'liga-daily');
    PERFORM cron.schedule('liga-daily', '50 3 * * *', 'select public.liga_recompute_running()');
    PERFORM cron.unschedule('liga-weekly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'liga-weekly');
    PERFORM cron.schedule('liga-weekly', '0 6 * * 1', $job$
      SELECT net.http_post(
        url := 'https://dngycrrhbnwdohbftpzq.supabase.co/functions/v1/liga-weekly',
        headers := jsonb_build_object('Content-Type', 'application/json',
                                      'x-cron-token', private.cron_token_for('liga-weekly')),
        body := '{}'::jsonb);
    $job$);
  END IF;
END;
$$;
