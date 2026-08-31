-- ============================================================================
-- RLS-Haertung: alle unbedingt-wahren Policies fuer PUBLIC entfernen
-- Idempotent. Mehrfaches Ausfuehren ist folgenlos.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE _rls_keep (tablename text, policyname text) ON COMMIT DROP;
INSERT INTO _rls_keep VALUES
  ('reference_requests',     'Anyone can view request by token'),
  ('reference_responses',    'Anyone can insert reference response'),
  ('organization_invites',   'Anyone can view invite by token'),
  ('interview_participants', 'Anyone can view interview participants');

DO $$
DECLARE
  r        record;
  dropped  int := 0;
  kept     int := 0;
BEGIN
  FOR r IN
    SELECT p.tablename, p.policyname
      FROM pg_policies p
     WHERE p.schemaname = 'public'
       AND p.permissive = 'PERMISSIVE'
       AND (p.roles = '{public}' OR 'anon' = ANY(p.roles))
       AND (p.qual = 'true' OR p.with_check = 'true')
     ORDER BY p.tablename, p.policyname
  LOOP
    IF EXISTS (SELECT 1 FROM _rls_keep k
                WHERE k.tablename = r.tablename AND k.policyname = r.policyname) THEN
      kept := kept + 1;
      RAISE NOTICE 'behalten (Token-Flow): %.%', r.tablename, r.policyname;
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    dropped := dropped + 1;
  END LOOP;

  RAISE NOTICE 'RLS-Haertung: % Policies entfernt, % bewusst behalten', dropped, kept;
END $$;

DROP POLICY IF EXISTS "Authenticated can read skill taxonomy" ON public.skill_taxonomy;
CREATE POLICY "Authenticated can read skill taxonomy"
  ON public.skill_taxonomy FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read SLA rules" ON public.sla_rules;
CREATE POLICY "Authenticated can read SLA rules"
  ON public.sla_rules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read routing cache" ON public.routing_cache;
CREATE POLICY "Authenticated can read routing cache"
  ON public.routing_cache FOR SELECT TO authenticated USING (true);

DO $$
DECLARE leftover text;
BEGIN
  SELECT string_agg(format('%s.%s', p.tablename, p.policyname), ', ' ORDER BY p.tablename)
    INTO leftover
    FROM pg_policies p
   WHERE p.schemaname = 'public'
     AND p.permissive = 'PERMISSIVE'
     AND (p.roles = '{public}' OR 'anon' = ANY(p.roles))
     AND (p.qual = 'true' OR p.with_check = 'true')
     AND NOT EXISTS (SELECT 1 FROM _rls_keep k
                      WHERE k.tablename = p.tablename AND k.policyname = p.policyname);
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'Es existieren weiterhin offene Policies: %', leftover;
  END IF;
END $$;

DO $$
DECLARE orphans text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
    INTO orphans
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND c.relrowsecurity
     AND NOT EXISTS (SELECT 1 FROM pg_policies p
                      WHERE p.schemaname = 'public' AND p.tablename = c.relname);
  IF orphans IS NOT NULL THEN
    RAISE NOTICE 'Ohne jede Policy (nur noch service_role): %', orphans;
  END IF;
END $$;

COMMIT;