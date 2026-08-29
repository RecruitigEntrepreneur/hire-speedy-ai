-- ============================================================================
-- RLS-Haertung: offene "System can ..."-Policies entfernen
-- ----------------------------------------------------------------------------
-- BEFUND (gemessen am 2026-08-29 gegen Produktion, nur mit dem oeffentlichen
-- anon-Key aus dem ausgelieferten Browser-Bundle, ohne Login):
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
--
-- URSACHE: Policies vom Muster
--     CREATE POLICY "System can manage X" ON X FOR ALL USING (true) WITH CHECK (true);
--   ohne TO-Klausel. Sie gelten damit fuer PUBLIC einschliesslich anon. Da
--   PostgreSQL permissive Policies mit ODER verknuepft, hebt eine einzige solche
--   Regel alle korrekten Policies derselben Tabelle auf. In match_outcomes stehen
--   direkt darueber drei sauber gebaute Policies fuer Recruiter, Kunden und
--   Admins -- sie sind wirkungslos.
--
-- WARUM DAS ENTFERNEN SICHER IST: Die Absicht dieser Policies war, den Edge
--   Functions Zugriff zu geben. Die nutzen ausnahmslos den SERVICE_ROLE_KEY
--   (geprueft: track-match-outcome, calculate-match-v3-1, calculate-match-v3,
--   calculate-match-v4, seed-ml-training-data, process-outreach-queue,
--   generate-outreach-email, import-outreach-leads, normalize-job-requirements).
--   Der service_role umgeht RLS grundsaetzlich und hat diese Policies nie
--   gebraucht. Lesende Frontend-Zugriffe laufen ueber die jeweils vorhandenen
--   Rollen-Policies.
--
-- NICHT TEIL DIESER MIGRATION (bewusst):
--   Die vier Token-Flow-Policies auf reference_requests, reference_responses,
--   organization_invites und interview_participants. Sie erlauben zwar ebenfalls
--   anonymen Zugriff auf ALLE Zeilen statt nur auf die zum Token gehoerende,
--   aber sie tragen oeffentliche Seiten (/reference/:token, /invite/:token).
--   Sie sauber zu machen heisst, den Zugriff in eine Edge Function zu verlegen
--   -- eine eigene Aufgabe mit eigenem Test, kein Beifang hier.
--
-- Idempotent: DROP POLICY IF EXISTS. Mehrfaches Ausfuehren ist folgenlos.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------- A) entfernen


-- activity_logs
DROP POLICY IF EXISTS "System can insert logs" ON public.activity_logs;

-- candidate_behavior
DROP POLICY IF EXISTS "System can insert candidate behavior" ON public.candidate_behavior;
DROP POLICY IF EXISTS "System can update candidate behavior" ON public.candidate_behavior;

-- candidate_conflicts
DROP POLICY IF EXISTS "System can manage conflicts" ON public.candidate_conflicts;

-- candidate_import_jobs
DROP POLICY IF EXISTS "Service role can manage import jobs" ON public.candidate_import_jobs;

-- communication_log
DROP POLICY IF EXISTS "System can insert communication log" ON public.communication_log;

-- company_intelligence
DROP POLICY IF EXISTS "Authenticated users can delete company intelligence" ON public.company_intelligence;
DROP POLICY IF EXISTS "Authenticated users can insert company intelligence" ON public.company_intelligence;
DROP POLICY IF EXISTS "Authenticated users can update company intelligence" ON public.company_intelligence;
DROP POLICY IF EXISTS "Authenticated users can view company intelligence" ON public.company_intelligence;

-- company_summaries
DROP POLICY IF EXISTS "System can insert summaries" ON public.company_summaries;

-- consents
DROP POLICY IF EXISTS "System can insert consents" ON public.consents;

-- deal_health
DROP POLICY IF EXISTS "System can insert deal health" ON public.deal_health;
DROP POLICY IF EXISTS "System can update deal health" ON public.deal_health;

-- email_events
DROP POLICY IF EXISTS "System can insert email events" ON public.email_events;

-- embedding_queue
DROP POLICY IF EXISTS "Service role full access to embedding_queue" ON public.embedding_queue;

-- employer_scores
DROP POLICY IF EXISTS "System can insert employer scores" ON public.employer_scores;
DROP POLICY IF EXISTS "System can update employer scores" ON public.employer_scores;

-- fraud_signals
DROP POLICY IF EXISTS "System can insert fraud signals" ON public.fraud_signals;

-- funnel_metrics
DROP POLICY IF EXISTS "System can insert funnel metrics" ON public.funnel_metrics;
DROP POLICY IF EXISTS "System can update funnel metrics" ON public.funnel_metrics;

-- identity_unlock_logs
DROP POLICY IF EXISTS "System can insert unlock logs" ON public.identity_unlock_logs;

-- influence_alerts
DROP POLICY IF EXISTS "System can insert alerts" ON public.influence_alerts;

-- integration_mappings
DROP POLICY IF EXISTS "System can manage mappings" ON public.integration_mappings;

-- integration_sync_log
DROP POLICY IF EXISTS "System can manage sync logs" ON public.integration_sync_log;

-- interview_intelligence
DROP POLICY IF EXISTS "System can insert interview intelligence" ON public.interview_intelligence;
DROP POLICY IF EXISTS "System can update interview intelligence" ON public.interview_intelligence;

-- match_ai_judgements
DROP POLICY IF EXISTS "System can manage match judgements" ON public.match_ai_judgements;

-- match_events
DROP POLICY IF EXISTS "System can manage match events" ON public.match_events;

-- match_outcomes
DROP POLICY IF EXISTS "System can manage match outcomes" ON public.match_outcomes;

-- notifications
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- offer_events
DROP POLICY IF EXISTS "System can insert offer events" ON public.offer_events;

-- outreach_conversations
DROP POLICY IF EXISTS "System can manage outreach_conversations" ON public.outreach_conversations;

-- outreach_emails
DROP POLICY IF EXISTS "System can manage outreach_emails" ON public.outreach_emails;

-- outreach_leads
DROP POLICY IF EXISTS "System can update outreach_leads" ON public.outreach_leads;

-- outreach_messages
DROP POLICY IF EXISTS "System can manage outreach_messages" ON public.outreach_messages;

-- outreach_rate_limits
DROP POLICY IF EXISTS "System can manage rate limits" ON public.outreach_rate_limits;

-- outreach_send_queue
DROP POLICY IF EXISTS "System can manage outreach_send_queue" ON public.outreach_send_queue;

-- outreach_sequences
DROP POLICY IF EXISTS "System can manage outreach_sequences" ON public.outreach_sequences;

-- outreach_suppression_list
DROP POLICY IF EXISTS "System can insert suppression entries" ON public.outreach_suppression_list;

-- payment_events
DROP POLICY IF EXISTS "System can insert payment events" ON public.payment_events;

-- platform_events
DROP POLICY IF EXISTS "System can insert events" ON public.platform_events;

-- recruiter_influence_scores
DROP POLICY IF EXISTS "System can insert influence scores" ON public.recruiter_influence_scores;
DROP POLICY IF EXISTS "System can update influence scores" ON public.recruiter_influence_scores;

-- recruiter_integrations
DROP POLICY IF EXISTS "Service role manages integrations" ON public.recruiter_integrations;

-- recruiter_job_activations
DROP POLICY IF EXISTS "System can update activations" ON public.recruiter_job_activations;

-- recruiter_leaderboard
DROP POLICY IF EXISTS "System can insert leaderboard entries" ON public.recruiter_leaderboard;
DROP POLICY IF EXISTS "System can update leaderboard entries" ON public.recruiter_leaderboard;

-- recruiter_trust_levels
DROP POLICY IF EXISTS "System can manage trust levels" ON public.recruiter_trust_levels;

-- sla_deadlines
DROP POLICY IF EXISTS "System can insert deadlines" ON public.sla_deadlines;
DROP POLICY IF EXISTS "System can update deadlines" ON public.sla_deadlines;

-- talent_alerts
DROP POLICY IF EXISTS "System can insert alerts" ON public.talent_alerts;

-- user_behavior_scores
DROP POLICY IF EXISTS "System can insert behavior scores" ON public.user_behavior_scores;
DROP POLICY IF EXISTS "System can update behavior scores" ON public.user_behavior_scores;

-- ------------------------------------------- B) Nachschlagedaten: nur eingeloggt
-- Kein Personenbezug, aber es gibt keinen Grund, sie anonym auszuliefern.
DROP POLICY IF EXISTS "Anyone can view skill taxonomy" ON public.skill_taxonomy;
CREATE POLICY "Authenticated can read skill taxonomy"
  ON public.skill_taxonomy FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read SLA rules" ON public.sla_rules;
CREATE POLICY "Authenticated can read SLA rules"
  ON public.sla_rules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read routing cache" ON public.routing_cache;
DROP POLICY IF EXISTS "System can manage routing cache" ON public.routing_cache;
CREATE POLICY "Authenticated can read routing cache"
  ON public.routing_cache FOR SELECT TO authenticated USING (true);

-- ------------------------------------------------------------ C) Gegenprobe
-- Bricht ab, falls auf den schwersten Tabellen weiterhin eine Policy fuer
-- PUBLIC/anon existiert. Damit kann die Migration nicht scheinbar durchlaufen.
DO $$
DECLARE leftover text;
BEGIN
  SELECT string_agg(format('%s.%s', tablename, policyname), ', ')
    INTO leftover
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('match_outcomes','match_events','match_ai_judgements',
                       'embedding_queue','outreach_emails','outreach_send_queue',
                       'outreach_rate_limits','notifications','consents',
                       'identity_unlock_logs','payment_events')
     AND (roles = '{public}' OR 'anon' = ANY(roles))
     AND (qual = 'true' OR with_check = 'true');
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'Es existieren weiterhin offene Policies: %', leftover;
  END IF;
END $$;

COMMIT;
