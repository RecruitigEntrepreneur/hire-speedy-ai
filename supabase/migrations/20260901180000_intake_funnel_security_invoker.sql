-- ============================================================================
-- intake_link_funnel: auf security_invoker umstellen
-- ----------------------------------------------------------------------------
-- BEFUND: Die View wurde ohne security_invoker angelegt und laeuft damit mit
--   den Rechten ihres Eigentuemers -- sie umgeht die RLS der Basistabellen.
--   Der Supabase-Linter meldet das als security_definer_view.
--
--   Funktional war das nicht offen: die View traegt
--   WHERE public.has_role(auth.uid(), 'admin') in sich. Aber die Absicherung
--   haengt damit an einer WHERE-Klausel statt an der RLS -- eine unbedachte
--   spaetere Aenderung der View macht daraus ein Leck, und der Linter kann den
--   Unterschied nicht sehen.
--
-- ENTSCHEIDUNG: security_invoker = true. Das ist hier nicht Linter-Kosmetik,
--   sondern die sachlich richtige Einstellung -- und der Unterschied zu
--   recruiter_jobs_view ist wesentlich:
--
--   recruiter_jobs_view MUSS mit Owner-Rechten laufen. Recruiter haben seit
--   20260725120100 gar kein SELECT mehr auf public.jobs; die View ist ihr
--   einziger Zugang und muss die RLS deshalb umgehen. Genau das haelt die
--   Hausregel in LOVABLE_DB_PROMPTS.md fest.
--
--   intake_link_funnel liegt umgekehrt: Ihre Basistabellen intake_links und
--   intake_link_events haben bereits eine Admin-Policy. Ein Admin sieht ueber
--   security_invoker exakt dieselben Zeilen wie zuvor, ein Nicht-Admin sieht
--   weiterhin nichts -- nur kommt die Absicherung jetzt aus der RLS und nicht
--   aus einer WHERE-Klausel, die jemand herausnehmen koennte.
--
-- Die Rollenpruefung in der View bleibt trotzdem stehen: doppelt gemoppelt
-- kostet hier nichts und macht die Absicht lesbar.
--
-- Rein additiv: dieselbe View, andere Ausfuehrungsrechte.
-- ============================================================================

BEGIN;

DROP VIEW IF EXISTS public.intake_link_funnel;

CREATE VIEW public.intake_link_funnel
WITH (security_invoker = true) AS
SELECT
  l.id                AS link_id,
  l.label,
  l.link_type,
  l.campaign_key,
  l.source,
  l.owner_user_id,
  l.created_at,
  l.revoked_at,
  l.expires_at,
  l.uses_count,
  COUNT(DISTINCT e.anonymous_id) FILTER (WHERE e.event_type = 'link_opened')     AS opened,
  COUNT(DISTINCT e.draft_id)     FILTER (WHERE e.event_type = 'intake_started')  AS started,
  COUNT(DISTINCT e.draft_id)     FILTER (WHERE e.event_type = 'contact_provided')AS contacted,
  COUNT(DISTINCT e.draft_id)     FILTER (WHERE e.event_type = 'email_verified')  AS verified,
  COUNT(DISTINCT e.draft_id)     FILTER (WHERE e.event_type = 'intake_completed')AS completed,
  COUNT(DISTINCT e.draft_id)     FILTER (WHERE e.event_type = 'submitted')       AS submitted,
  COUNT(DISTINCT e.draft_id)     FILTER (WHERE e.event_type = 'accepted')        AS accepted,
  COUNT(DISTINCT e.draft_id)     FILTER (WHERE e.event_type = 'contract_signed') AS signed,
  COUNT(DISTINCT e.draft_id)     FILTER (WHERE e.event_type = 'published')       AS published,
  MAX(e.occurred_at)                                                             AS last_event_at
FROM public.intake_links l
LEFT JOIN public.intake_link_events e ON e.link_id = l.id
WHERE public.has_role(auth.uid(), 'admin')
GROUP BY l.id;

GRANT SELECT ON public.intake_link_funnel TO authenticated;

COMMENT ON VIEW public.intake_link_funnel IS
  'Trichter je Aufnahme-Link: Aufrufe, Starts, Kontaktaufnahmen, verifizierte '
  'Intakes, vollstaendige Aufnahmen, Beauftragungsanfragen, Annahmen, '
  'Unterschriften, Veroeffentlichungen. security_invoker = true: die Absicherung '
  'kommt aus der Admin-RLS der Basistabellen, nicht aus den Owner-Rechten der '
  'View. Anders als recruiter_jobs_view, die die RLS umgehen MUSS, weil '
  'Recruiter kein SELECT auf jobs haben.';

COMMIT;
