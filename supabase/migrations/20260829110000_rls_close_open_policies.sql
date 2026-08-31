-- ============================================================================
-- RLS-Haertung: alle unbedingt-wahren Policies fuer PUBLIC entfernen
-- ----------------------------------------------------------------------------
-- BEFUND (2026-08-29, gemessen mit dem oeffentlichen anon-Key aus dem
-- ausgelieferten Browser-Bundle, ohne Login):
--
--   match_outcomes        10.081 Zeilen lesbar  (candidate_id x job_id x rejection_reason)
--   skill_taxonomy           103
--   embedding_queue           81
--   match_events              77
--   match_ai_judgements       14
--   outreach_emails           11  (Betreff, Body, Prompt, Empfaengerrolle)
--   outreach_rate_limits       5  (sender_email, target_domain)
--   sla_rules                  5
--   outreach_send_queue        3
--
--   Dazu 39 weitere Tabellen, die heute leer sind und sich im Betrieb fuellen --
--   darunter notifications, consents, identity_unlock_logs und payment_events.
--   consents und identity_unlock_logs sind der DSGVO-Nachweis; sie stehen per
--   FOR ALL nicht nur zum Lesen, sondern auch zum Loeschen offen.
--
-- URSACHE: Policies vom Muster
--     CREATE POLICY "System can manage X" ON X FOR ALL USING (true) WITH CHECK (true);
--   ohne TO-Klausel. Sie gelten damit fuer PUBLIC einschliesslich anon. Da
--   PostgreSQL permissive Policies mit ODER verknuepft, hebt eine einzige solche
--   Regel alle korrekten Policies derselben Tabelle auf. Auf match_outcomes
--   stehen direkt darueber drei sauber gebaute Policies fuer Recruiter, Kunden
--   und Admins -- sie sind wirkungslos.
--
-- WARUM DAS ENTFERNEN SICHER IST: Die Absicht war, den Edge Functions Zugriff zu
--   geben. Die nutzen ausnahmslos den SERVICE_ROLE_KEY (geprueft:
--   track-match-outcome, calculate-match-v3-1, calculate-match-v3,
--   calculate-match-v4, seed-ml-training-data, process-outreach-queue,
--   generate-outreach-email, import-outreach-leads, normalize-job-requirements).
--   Der service_role umgeht RLS grundsaetzlich und hat diese Policies nie
--   gebraucht.
--
-- WARUM DYNAMISCH STATT NAMENTLICH: Eine Zaehlung gegen die laufende Datenbank
--   ergab 83 solcher Policies, waehrend in den Migrationsdateien nur 54 stehen.
--   Der Rest ist ausserhalb des Migrationspfads entstanden. Eine Liste von
--   Namen wuerde diese uebersehen -- deshalb sucht dieser Block sie im Katalog.
--
-- Idempotent. Mehrfaches Ausfuehren ist folgenlos.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Ausnahmen: Policies, die bewusst stehen bleiben.
--
--    Die vier Token-Flow-Policies tragen oeffentliche Seiten (/reference/:token,
--    /invite/:token). Sie sind ebenfalls zu weit gefasst -- sie erlauben Zugriff
--    auf ALLE Zeilen statt nur auf die zum Token gehoerende --, aber sie hier
--    mitzudroppen wuerde funktionierende Seiten abschalten. Der saubere Umbau
--    verlegt den Zugriff in eine Edge Function und ist eine eigene Aufgabe.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _rls_keep (tablename text, policyname text) ON COMMIT DROP;
INSERT INTO _rls_keep VALUES
  ('reference_requests',     'Anyone can view request by token'),
  ('reference_responses',    'Anyone can insert reference response'),
  ('organization_invites',   'Anyone can view invite by token'),
  ('interview_participants', 'Anyone can view interview participants');

-- ---------------------------------------------------------------------------
-- 2) Alles andere, was fuer PUBLIC/anon unbedingt wahr ist, entfernen.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3) Nachschlagedaten bleiben lesbar, aber nur fuer eingeloggte Nutzer.
--    Kein Personenbezug, aber es gibt keinen Grund, sie anonym auszuliefern.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read skill taxonomy" ON public.skill_taxonomy;
CREATE POLICY "Authenticated can read skill taxonomy"
  ON public.skill_taxonomy FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read SLA rules" ON public.sla_rules;
CREATE POLICY "Authenticated can read SLA rules"
  ON public.sla_rules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read routing cache" ON public.routing_cache;
CREATE POLICY "Authenticated can read routing cache"
  ON public.routing_cache FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 4) Gegenprobe: bricht ab, falls doch etwas uebrig ist.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 5) Hinweis, KEIN Abbruch: Tabellen, die nach dem Aufraeumen gar keine Policy
--    mehr haben. Mit aktiviertem RLS heisst das "nur service_role" -- fuer
--    reine Systemtabellen richtig, fuer eine Tabelle, die das Frontend liest,
--    ein Fehler. Bitte die Liste einmal durchsehen.
-- ---------------------------------------------------------------------------
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
