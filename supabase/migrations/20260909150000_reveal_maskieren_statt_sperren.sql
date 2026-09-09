-- ============================================================================
-- Der Reveal sperrte Prosa und veroeffentlichte die Adresse
-- ============================================================================
-- BEFUND (09.09.2026, an MV-2026-001005 nachgelesen):
--
-- `recruiter_jobs_view` sperrte elf Felder hinter dem Reveal. Die Trennlinie
-- lag aber an der falschen Achse -- sie fragte "ist das Prosa?" statt "nennt
-- das den Kunden?". Vier Folgen, alle nachweisbar:
--
-- 1. Der Deskriptor verraet mehr als alles Gesperrte. `industry`, `location`
--    und `company_size_band` sind ungesperrt und stehen als Ueberschrift auf
--    der Seite: "[Personalberatung | bis 50 | Hybrid Muenchen-Isarvorstadt]".
--    Das sind die Koordinaten. Gesperrt war derweil "Der Monatsanfang gehoert
--    dem Abschluss".
--
-- 2. Gleiche Sorte, gegenteilige Behandlung. `career_example` gesperrt
--    ("Ein Kollege ist 2024 vom Finanzbuchhalter zum Teamleiter geworden") --
--    `career_path` offen, mit "3.000 Euro Weiterbildungsbudget" und der
--    "Rolle einer kaufmaennischen Leitung". `company_culture` gesperrt
--    ("Wir duzen uns"), `failure_profile` offen ("Zwei Kollegen kamen aus
--    einem Konzern-Rechnungswesen").
--
-- 3. Die Sperre war durch die KI umgehbar. `formatted_content` und
--    `job_summary` sind ungesperrt -- und werden aus den GESPERRTEN Feldern
--    erzeugt (format-job-for-recruiters liest unique_selling_points,
--    position_advantages, daily_routine, company_culture, career_path). Der
--    Prompt verbietet nur den Firmennamen. Die Spalte war gesperrt, ihr
--    Inhalt lief durch eine offene Spalte hinaus.
--
-- 4. Gesperrt war genau das, was der Headhunter zum Verkaufen braucht: was
--    die Person den ganzen Tag macht, und warum jemand wechseln sollte. Er
--    sollte Kandidaten ansprechen fuer eine Stelle, die er nicht beschreiben
--    durfte.
--
-- UND: Das Werkzeug dafuer lag ungenutzt herum. Die KI ermittelt waehrend der
-- Aufnahme pro Stelle, welche WOERTER die Firma verraten, und legt sie in
-- `reveal_envelope.red_list` ab (intake-questions/index.ts:189). Ein Grep
-- ueber die Codebasis: red_list wurde geschrieben und nirgends gelesen.
--
-- ENTSCHEIDUNG (Marko, 09.09.2026): Die Achse drehen. Nicht Felder sperren,
-- sondern die bekannten Begriffe maskieren. Hinter dem Reveal bleiben nur
-- Firmenname und die Originalanzeige.
--
-- WAS DAS KOSTET, ehrlich: Eine Maskierung faengt, was die KI erkannt hat --
-- nicht, was ihr entgangen ist. Die alte Sperre war groeber, bei ihren elf
-- Feldern aber absolut. Der Tausch heisst mehr Nutzen gegen weicheren Schutz
-- -- und schliesst dafuer Punkt 3, der heute offen steht.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Maskieren
-- ---------------------------------------------------------------------------
-- Kein regulaerer Ausdruck: ein Firmenname enthaelt Punkte, Klammern und
-- Kaufmanns-Und ("B.O.S. GmbH", "Bluewater & Bridge"). Als Muster gelesen
-- waeren das Metazeichen, und die Maskierung traefe das Falsche oder nichts.
-- Deshalb literal und ueber `position`, damit ohne Escaping auskommt.
CREATE OR REPLACE FUNCTION public.maskiere(_text text, _envelope jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
  MARKE   constant text := '[anonymisiert]';
  begriff text;
  aus     text := _text;
  p       integer;
  runden  integer;
BEGIN
  IF _text IS NULL OR btrim(_text) = '' THEN RETURN _text; END IF;
  IF _envelope IS NULL OR jsonb_typeof(_envelope -> 'red_list') <> 'array' THEN
    RETURN _text;
  END IF;

  -- Der LAENGSTE zuerst, sonst bleibt ein Rest stehen.
  -- BELEG (im eigenen Testlauf gemessen): Mit der Liste
  -- ["Bluewater", "Bluewater & Bridge GmbH"] wurde in dieser Reihenfolge aus
  -- "Wir sind die Bluewater & Bridge GmbH." der Satz
  -- "Wir sind die [anonymisiert] & Bridge GmbH." -- der Firmenname war
  -- weiterhin zu lesen. Die KI schreibt Kurz- und Langform beide auf die
  -- Liste; ihre Reihenfolge ist Zufall, diese hier nicht.
  FOR begriff IN
    SELECT btrim(x)
      FROM jsonb_array_elements_text(_envelope -> 'red_list') AS t(x)
     ORDER BY length(btrim(x)) DESC
     LIMIT 50
  LOOP
    -- Zu kurz ist gefaehrlicher als gar nicht: ein zweibuchstabiger Eintrag
    -- ("IT") zerlegt jeden Text von innen.
    CONTINUE WHEN begriff IS NULL OR length(begriff) < 3;
    -- Ein Begriff, der in der Marke selbst steckt, wuerde sich endlos
    -- ersetzen.
    CONTINUE WHEN position(lower(begriff) IN lower(MARKE)) > 0;

    runden := 0;
    LOOP
      p := position(lower(begriff) IN lower(aus));
      EXIT WHEN p = 0;
      aus := left(aus, p - 1) || MARKE || substr(aus, p + length(begriff));
      runden := runden + 1;
      EXIT WHEN runden > 100;   -- Reissleine, nie erwartet
    END LOOP;
  END LOOP;

  RETURN aus;
END
$fn$;

COMMENT ON FUNCTION public.maskiere(text, jsonb) IS
  'Ersetzt die in reveal_envelope.red_list genannten Begriffe durch '
  '"[anonymisiert]". Literal und ohne Ruecksicht auf Gross-/Kleinschreibung. '
  'Die Liste stammt aus der Aufnahme: die KI benennt dort, was die Firma '
  'verraten wuerde.';

-- Dieselbe Regel fuer Listen. Ohne diese Fassung waeren die
-- Alleinstellungsmerkmale und die Vorteile der Position ungeschuetzt, denn
-- sie sind text[], nicht text.
CREATE OR REPLACE FUNCTION public.maskiere(_werte text[], _envelope jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT CASE
    WHEN _werte IS NULL THEN NULL
    ELSE ARRAY(SELECT public.maskiere(x, _envelope) FROM unnest(_werte) AS t(x))
  END;
$fn$;

-- Und fuer die KI-Texte. Sie entstehen aus den Rohwerten, tragen deren
-- Begriffe also weiter -- genau der Weg, auf dem die alte Sperre umgangen
-- wurde.
--
-- Maskiert wird die serialisierte Form. Schluessel heissen englisch
-- ("headline", "sellingPoints") und treffen keine deutsche red_list; die
-- Marke enthaelt kein JSON-Sonderzeichen. Scheitert der Rueckweg dennoch,
-- gibt es NULL statt Rohtext: ein fehlendes Briefing ist zu beheben, ein
-- verratener Kunde nicht.
CREATE OR REPLACE FUNCTION public.maskiere_json(_wert jsonb, _envelope jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
  roh text;
BEGIN
  IF _wert IS NULL THEN RETURN NULL; END IF;
  roh := public.maskiere(_wert::text, _envelope);
  RETURN roh::jsonb;
EXCEPTION WHEN others THEN
  RAISE WARNING '[maskiere_json] nicht zurueckgewandelt, Feld wird geleert';
  RETURN NULL;
END
$fn$;

-- ---------------------------------------------------------------------------
-- Die Ansicht
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.recruiter_jobs_view;

CREATE VIEW public.recruiter_jobs_view AS
SELECT
  j.id, j.title, j.status, j.industry, j.location,
  j.remote_type, j.employment_type, j.experience_level,
  j.salary_min, j.salary_max, j.fee_percentage, j.recruiter_fee_percentage,
  j.skills, j.must_haves, j.nice_to_haves, j.screening_questions,
  j.company_size_band, j.funding_stage, j.hiring_urgency, j.urgency,
  j.tech_environment, j.required_languages, j.required_certifications,
  j.onsite_required, j.onsite_days_required, j.remote_policy,
  j.benefits, j.deadline, j.created_at, j.updated_at,
  j.embedding,
  j.day_rate_min, j.day_rate_max, j.contract_duration_months,
  j.utilization_days_per_week, j.extension_possible,

  -- Zahlen und Aufzaehlungen: hier steht kein Firmenname drin.
  j.vacancy_reason,
  j.reports_to,
  j.team_size,
  j.department_structure,
  j.task_focus,
  j.task_breakdown,
  j.must_have_criteria,
  j.trainable_skills,
  j.nice_to_have_criteria,
  j.decision_makers,
  j.core_hours,
  j.core_hours_detail,
  j.overtime_policy,
  j.time_tracking_method,
  j.works_council,
  j.works_council_meeting_schedule,
  j.contract_creation_days,
  j.contract_sent_digitally,
  j.contract_limitation,
  j.contract_sensitive_topics,
  j.bonus_structure,
  j.salary_months,

  -- Neu in der Ansicht. Beides hat der Kunde gesagt, beides kam beim
  -- Headhunter nie an -- und der Absprunggrund ist die Information, die er
  -- am dringendsten braucht: er muss das Gegenangebot vorbereiten, bevor er
  -- anruft, nicht danach.
  public.maskiere(j.candidates_dropped_reason, j.reveal_envelope) AS candidates_dropped_reason,
  j.candidates_in_pipeline,

  -- Freitext ueber die Firma. Ab jetzt sichtbar, aber maskiert. Die drei
  -- unten standen schon vorher offen -- ungeschuetzt; sie laufen jetzt
  -- ebenfalls durch die Maskierung.
  public.maskiere(j.success_profile,   j.reveal_envelope) AS success_profile,
  public.maskiere(j.failure_profile,   j.reveal_envelope) AS failure_profile,
  public.maskiere(j.career_path,       j.reveal_envelope) AS career_path,
  public.maskiere(j.daily_routine,     j.reveal_envelope) AS daily_routine,
  public.maskiere(j.company_culture,   j.reveal_envelope) AS company_culture,
  public.maskiere(j.career_example,    j.reveal_envelope) AS career_example,
  public.maskiere(j.unique_selling_points, j.reveal_envelope) AS unique_selling_points,
  public.maskiere(j.position_advantages,   j.reveal_envelope) AS position_advantages,
  public.maskiere(j.negative_impact_if_unfilled, j.reveal_envelope) AS negative_impact_if_unfilled,
  public.maskiere(j.industry_opportunities, j.reveal_envelope) AS industry_opportunities,
  public.maskiere(j.industry_challenges,    j.reveal_envelope) AS industry_challenges,

  -- Die KI-Texte. Sie waren der offene Weg an der Sperre vorbei.
  public.maskiere_json(j.formatted_content, j.reveal_envelope) AS formatted_content,
  public.maskiere_json(j.job_summary,       j.reveal_envelope) AS job_summary,

  -- Was auch maskiert nicht hinausgeht: der Name und die Originalanzeige.
  -- Die Anzeige beschreibt die Firma in ihren eigenen Worten ueber Absaetze
  -- hinweg; eine Begriffsliste haelt das nicht dicht, und ersetzt wird sie
  -- ohnehin durch die strukturierten Felder darueber.
  CASE WHEN rev.revealed THEN j.company_name  ELSE NULL END AS company_name,
  CASE WHEN rev.revealed THEN j.description   ELSE NULL END AS description,
  CASE WHEN rev.revealed THEN j.requirements  ELSE NULL END AS requirements,

  COALESCE(rev.revealed, false) AS company_revealed
FROM jobs j
LEFT JOIN LATERAL (
  SELECT true AS revealed
  FROM submissions s
  WHERE s.job_id = j.id
    AND s.recruiter_id = auth.uid()
    AND s.company_revealed = true
  LIMIT 1
) rev ON true
WHERE public.has_role(auth.uid(), 'recruiter')
  AND j.status = 'published';

GRANT SELECT ON public.recruiter_jobs_view TO authenticated;

COMMENT ON VIEW public.recruiter_jobs_view IS
  'Was ein Recruiter von einer veroeffentlichten Stelle sieht. Seit dem '
  '09.09.2026 wird maskiert statt gesperrt: die in reveal_envelope.red_list '
  'genannten Begriffe werden ersetzt, dafuer sind Arbeitsalltag, '
  'Alleinstellungsmerkmale, Kultur und Karrierebeispiel sichtbar -- der '
  'Headhunter kann die Stelle sonst nicht beschreiben. Hinter dem Reveal '
  'bleiben nur der Firmenname und die Originalanzeige. Die KI-Texte laufen '
  'ebenfalls durch die Maskierung: sie entstehen aus den Rohwerten und waren '
  'vorher der offene Weg an der Sperre vorbei.';

COMMIT;
