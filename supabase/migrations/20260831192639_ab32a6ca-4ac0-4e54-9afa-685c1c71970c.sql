-- ============================================================================
-- intake_link_funnel: auf security_invoker umstellen
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
  'Unterschriften, Veroeffentlichungen. security_invoker = true.';

COMMIT;

-- ============================================================================
-- Aufnahme-Links wieder anzeigbar machen
-- ============================================================================

BEGIN;

ALTER TABLE public.intake_links
  ADD COLUMN IF NOT EXISTS token_encrypted   text,
  ADD COLUMN IF NOT EXISTS token_rotated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS token_rotated_by  uuid;

COMMENT ON COLUMN public.intake_links.token_encrypted IS
  'Der Link-Token, AES-256-GCM verschluesselt mit ENCRYPTION_KEY.';
COMMENT ON COLUMN public.intake_links.token_rotated_at IS
  'Wann der Token zuletzt ersetzt wurde.';

COMMIT;