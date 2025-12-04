-- =====================================================
-- RECRUITER INFLUENCE ENGINE - Phase 1: Database Tables
-- =====================================================

-- 1. candidate_behavior - Kandidaten-Engagement-Tracking
CREATE TABLE public.candidate_behavior (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES public.submissions(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  
  -- Engagement Tracking
  opt_in_response_time_hours NUMERIC,
  emails_sent INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  links_clicked INTEGER DEFAULT 0,
  prep_materials_viewed INTEGER DEFAULT 0,
  company_profile_viewed BOOLEAN DEFAULT false,
  salary_tool_used BOOLEAN DEFAULT false,
  
  -- Calculated Scores (0-100)
  confidence_score INTEGER DEFAULT 50 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  interview_readiness_score INTEGER DEFAULT 50 CHECK (interview_readiness_score >= 0 AND interview_readiness_score <= 100),
  closing_probability INTEGER DEFAULT 50 CHECK (closing_probability >= 0 AND closing_probability <= 100),
  engagement_level TEXT DEFAULT 'neutral' CHECK (engagement_level IN ('low', 'neutral', 'high', 'very_high')),
  
  -- Signals
  hesitation_signals JSONB DEFAULT '[]'::jsonb,
  motivation_indicators JSONB DEFAULT '[]'::jsonb,
  last_engagement_at TIMESTAMPTZ,
  days_since_engagement INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. influence_alerts - Handlungsempfehlungen für Recruiter
CREATE TABLE public.influence_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL,
  
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'opt_in_pending', 'opt_in_pending_24h', 'opt_in_pending_48h',
    'interview_prep_missing', 'interview_reminder',
    'salary_mismatch', 'salary_negotiation',
    'ghosting_risk', 'engagement_drop',
    'client_feedback_positive', 'client_feedback_negative',
    'closing_opportunity', 'culture_concern',
    'document_missing', 'follow_up_needed'
  )),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  playbook_id UUID,
  
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  action_taken TEXT,
  action_taken_at TIMESTAMPTZ,
  
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. coaching_playbooks - Telefon-Skripte und Coaching-Materialien
CREATE TABLE public.coaching_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'opt_in_delay', 'interview_no_show_risk', 'interview_prep',
    'salary_negotiation', 'salary_expectation_management',
    'ghosting_prevention', 'engagement_boost',
    'client_positive_feedback', 'closing_preparation',
    'culture_fit_concerns', 'counter_offer_handling'
  )),
  title TEXT NOT NULL,
  description TEXT,
  
  phone_script TEXT,
  email_template TEXT,
  whatsapp_template TEXT,
  
  talking_points JSONB DEFAULT '[]'::jsonb,
  objection_handlers JSONB DEFAULT '[]'::jsonb,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. recruiter_influence_scores - Einfluss-Metriken pro Recruiter
CREATE TABLE public.recruiter_influence_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL UNIQUE,
  
  -- Influence Metrics (0-100)
  influence_score INTEGER DEFAULT 50 CHECK (influence_score >= 0 AND influence_score <= 100),
  opt_in_acceleration_rate NUMERIC DEFAULT 0,
  show_rate_improvement NUMERIC DEFAULT 0,
  candidate_satisfaction_score NUMERIC DEFAULT 0,
  closing_speed_improvement NUMERIC DEFAULT 0,
  
  -- Activity Metrics
  alerts_actioned INTEGER DEFAULT 0,
  alerts_ignored INTEGER DEFAULT 0,
  playbooks_used INTEGER DEFAULT 0,
  total_influenced_placements INTEGER DEFAULT 0,
  
  calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. candidate_support_content - Kandidaten-Hilfs-Materialien
CREATE TABLE public.candidate_support_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN (
    'interview_guide', 'salary_benchmark', 'company_culture',
    'confidence_builder', 'preparation_checklist', 'faq',
    'negotiation_tips', 'industry_insights'
  )),
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  industry TEXT,
  
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  
  view_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- INDEXES for Performance
-- =====================================================

CREATE INDEX idx_candidate_behavior_submission ON public.candidate_behavior(submission_id);
CREATE INDEX idx_candidate_behavior_candidate ON public.candidate_behavior(candidate_id);
CREATE INDEX idx_candidate_behavior_scores ON public.candidate_behavior(confidence_score, interview_readiness_score, closing_probability);

CREATE INDEX idx_influence_alerts_recruiter ON public.influence_alerts(recruiter_id);
CREATE INDEX idx_influence_alerts_submission ON public.influence_alerts(submission_id);
CREATE INDEX idx_influence_alerts_active ON public.influence_alerts(recruiter_id, is_dismissed, is_read) WHERE is_dismissed = false;
CREATE INDEX idx_influence_alerts_priority ON public.influence_alerts(priority, created_at DESC);

CREATE INDEX idx_coaching_playbooks_trigger ON public.coaching_playbooks(trigger_type) WHERE is_active = true;

CREATE INDEX idx_recruiter_influence_scores_recruiter ON public.recruiter_influence_scores(recruiter_id);
CREATE INDEX idx_recruiter_influence_scores_score ON public.recruiter_influence_scores(influence_score DESC);

CREATE INDEX idx_candidate_support_content_type ON public.candidate_support_content(content_type) WHERE is_active = true;
CREATE INDEX idx_candidate_support_content_industry ON public.candidate_support_content(industry) WHERE is_active = true;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.candidate_behavior ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influence_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_influence_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_support_content ENABLE ROW LEVEL SECURITY;

-- candidate_behavior RLS
CREATE POLICY "Recruiters can view behavior for their submissions"
ON public.candidate_behavior FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = candidate_behavior.submission_id
    AND s.recruiter_id = auth.uid()
  )
);

CREATE POLICY "Clients can view behavior for their job submissions"
ON public.candidate_behavior FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.jobs j ON j.id = s.job_id
    WHERE s.id = candidate_behavior.submission_id
    AND j.client_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all candidate behavior"
ON public.candidate_behavior FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert candidate behavior"
ON public.candidate_behavior FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update candidate behavior"
ON public.candidate_behavior FOR UPDATE
USING (true);

-- influence_alerts RLS
CREATE POLICY "Recruiters can view their own alerts"
ON public.influence_alerts FOR SELECT
USING (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can update their own alerts"
ON public.influence_alerts FOR UPDATE
USING (auth.uid() = recruiter_id);

CREATE POLICY "Admins can manage all alerts"
ON public.influence_alerts FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert alerts"
ON public.influence_alerts FOR INSERT
WITH CHECK (true);

-- coaching_playbooks RLS (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view active playbooks"
ON public.coaching_playbooks FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage all playbooks"
ON public.coaching_playbooks FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- recruiter_influence_scores RLS
CREATE POLICY "Recruiters can view their own influence score"
ON public.recruiter_influence_scores FOR SELECT
USING (auth.uid() = recruiter_id);

CREATE POLICY "Admins can manage all influence scores"
ON public.recruiter_influence_scores FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert influence scores"
ON public.recruiter_influence_scores FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update influence scores"
ON public.recruiter_influence_scores FOR UPDATE
USING (true);

-- candidate_support_content RLS (read for all authenticated, write for admins)
CREATE POLICY "Authenticated users can view active content"
ON public.candidate_support_content FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage all support content"
ON public.candidate_support_content FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- TRIGGERS for updated_at
-- =====================================================

CREATE TRIGGER update_candidate_behavior_updated_at
  BEFORE UPDATE ON public.candidate_behavior
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_coaching_playbooks_updated_at
  BEFORE UPDATE ON public.coaching_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_recruiter_influence_scores_updated_at
  BEFORE UPDATE ON public.recruiter_influence_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_candidate_support_content_updated_at
  BEFORE UPDATE ON public.candidate_support_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- SEED DATA: Coaching Playbooks
-- =====================================================

INSERT INTO public.coaching_playbooks (trigger_type, title, description, phone_script, email_template, whatsapp_template, talking_points, objection_handlers) VALUES
(
  'opt_in_delay',
  'Opt-In Nachfassen',
  'Playbook für Kandidaten, die ihr Opt-In noch nicht bestätigt haben',
  E'Hallo [Name], hier ist [Recruiter] von [Firma]. Ich rufe kurz an wegen der Stelle bei [Unternehmen]. Ich habe Ihnen vor [X] Tagen eine Anfrage geschickt – haben Sie die erhalten? \n\nSuper! Was denken Sie – passt die Stelle grundsätzlich zu Ihren Vorstellungen?\n\n[Falls Bedenken:] Verstehe ich total. Was genau macht Sie unsicher? Lassen Sie uns das kurz besprechen.\n\n[Falls positiv:] Perfekt! Können Sie die Bestätigung heute noch abschließen? Das Unternehmen ist sehr interessiert.',
  E'Betreff: Kurze Rückfrage zu Ihrer Bewerbung bei [Unternehmen]\n\nHallo [Name],\n\nich hoffe, es geht Ihnen gut! Ich wollte kurz nachfragen, ob Sie meine Anfrage bezüglich der Position [Titel] bei [Unternehmen] erhalten haben.\n\nDas Unternehmen ist sehr an Ihrem Profil interessiert und ich würde Sie gerne im Prozess unterstützen.\n\nHaben Sie noch Fragen zur Stelle oder gibt es etwas, das ich klären kann?\n\nBeste Grüße,\n[Recruiter]',
  E'Hi [Name]! 👋 Kurze Frage zur Stelle bei [Unternehmen] – haben Sie meine Anfrage gesehen? Das Unternehmen ist echt interessiert! Kann ich irgendwie helfen? 🚀',
  '["Fragen Sie nach dem Grund für die Verzögerung", "Bieten Sie an, offene Fragen zu klären", "Betonen Sie die Dringlichkeit ohne Druck", "Erinnern Sie an die Matching-Qualität"]'::jsonb,
  '[{"objection": "Ich bin mir nicht sicher, ob die Stelle passt", "response": "Verstehe ich! Was genau macht Sie unsicher? Oft können wir Bedenken im Gespräch klären."}, {"objection": "Ich habe gerade keine Zeit", "response": "Kein Problem! Die Bestätigung dauert nur 2 Minuten. Soll ich Ihnen den Link nochmal schicken?"}, {"objection": "Ich bin in anderen Prozessen", "response": "Das ist völlig normal! Diese Stelle könnte aber perfekt sein – schauen Sie sie sich parallel an?"}]'::jsonb
),
(
  'interview_no_show_risk',
  'Interview No-Show Prävention',
  'Playbook um No-Shows bei Interviews zu verhindern',
  E'Hallo [Name], hier ist [Recruiter]. Ich wollte Sie kurz an Ihr Interview morgen um [Zeit] mit [Unternehmen] erinnern.\n\nIst alles startklar bei Ihnen? Haben Sie noch Fragen zur Vorbereitung?\n\n[Falls Unsicherheit:] Was genau beschäftigt Sie? Lassen Sie uns das gemeinsam durchgehen.\n\nIch schicke Ihnen gleich noch einen kurzen Vorbereitungsleitfaden – damit fühlen Sie sich garantiert sicherer!',
  E'Betreff: Ihr Interview morgen – Sind Sie bereit? 🎯\n\nHallo [Name],\n\nmorgen ist es soweit – Ihr Interview bei [Unternehmen] um [Zeit]!\n\nKurze Checkliste:\n✅ Meeting-Link: [Link]\n✅ Dauer: ca. [X] Minuten\n✅ Gesprächspartner: [Name, Position]\n\nTipp: Bereiten Sie 2-3 Fragen ans Unternehmen vor – das zeigt echtes Interesse!\n\nIch drücke Ihnen die Daumen! Bei Fragen bin ich erreichbar.\n\nViel Erfolg!\n[Recruiter]',
  E'Hey [Name]! 📅 Morgen ist Ihr Interview bei [Unternehmen]! Alles bereit? Ich hab noch ein paar Last-Minute-Tipps, wenn Sie möchten! 💪',
  '["Bestätigen Sie Datum und Uhrzeit", "Klären Sie technische Details (Link, Plattform)", "Fragen Sie nach der Vorbereitung", "Bieten Sie Last-Minute-Support an"]'::jsonb,
  '[{"objection": "Ich bin mir nicht mehr sicher, ob ich teilnehmen möchte", "response": "Was hat sich verändert? Lassen Sie uns kurz sprechen – oft sind es nur kalte Füße!"}, {"objection": "Ich habe mich nicht richtig vorbereitet", "response": "Kein Stress! Ich habe einen Quick-Guide – in 15 Minuten sind Sie ready!"}, {"objection": "Ich habe ein besseres Angebot bekommen", "response": "Gratulation! Aber schauen Sie sich dieses Interview trotzdem an – Vergleichen ist immer gut!"}]'::jsonb
),
(
  'interview_prep',
  'Interview-Vorbereitung',
  'Playbook zur Unterstützung der Kandidaten-Vorbereitung',
  E'Hallo [Name], [Recruiter] hier! Ihr Interview bei [Unternehmen] steht an – ich wollte sichergehen, dass Sie bestens vorbereitet sind.\n\nHaben Sie sich das Unternehmensprofil angesehen? \n\nEin paar Dinge, die Sie wissen sollten:\n- Das Team legt Wert auf [Wert]\n- Typische Fragen sind [Beispiele]\n- Der Interviewer [Name] achtet besonders auf [Aspekt]\n\nSoll ich Ihnen ein kurzes Briefing-Dokument schicken?',
  NULL,
  NULL,
  '["Teilen Sie Insider-Infos zum Unternehmen", "Bereiten Sie auf typische Fragen vor", "Erklären Sie die Unternehmenskultur", "Geben Sie Tipps zum Interviewer"]'::jsonb,
  '[]'::jsonb
),
(
  'salary_negotiation',
  'Gehaltsverhandlung vorbereiten',
  'Playbook um Kandidaten auf Gehaltsverhandlungen vorzubereiten',
  E'Hallo [Name], super Neuigkeiten! [Unternehmen] ist begeistert und es geht Richtung Angebot.\n\nLassen Sie uns kurz über die Gehaltsverhandlung sprechen:\n- Ihr aktuelles Gehalt: [X]\n- Ihre Erwartung: [Y]\n- Das Budget liegt bei: [Z]\n\n[Falls Gap:] Wie flexibel sind Sie hier? Es gibt auch andere Benefits wie [Benefits].\n\nMein Tipp: Nennen Sie nie als Erstes eine Zahl. Sagen Sie: "Was ist das Budget für diese Position?" Das gibt Ihnen Verhandlungsspielraum.',
  NULL,
  NULL,
  '["Klären Sie die Gehaltserwartungen früh", "Informieren Sie über realistische Ranges", "Bereiten Sie auf Benefits-Verhandlung vor", "Coachen Sie Verhandlungstaktiken"]'::jsonb,
  '[{"objection": "Das ist unter meiner Erwartung", "response": "Verstehe ich! Aber schauen Sie sich das Gesamtpaket an – Benefits, Entwicklung, Kultur. Was wäre Ihr Minimum?"}, {"objection": "Ich habe ein höheres Angebot von woanders", "response": "Gut zu wissen! Darf ich fragen, von wem? Manchmal können wir nachverhandeln."}]'::jsonb
),
(
  'salary_expectation_management',
  'Erwartungsmanagement Gehalt',
  'Playbook wenn Gehaltserwartung über Budget liegt',
  E'Hallo [Name], ich muss offen mit Ihnen sein: Ihre Gehaltsvorstellung liegt über dem Budget für diese Position.\n\nDas heißt nicht, dass es nicht klappt! Hier sind Optionen:\n1. Das Unternehmen bietet [Benefits] zusätzlich\n2. Nach [X] Monaten gibt es eine Gehaltsreview\n3. Die Entwicklungsmöglichkeiten sind [Optionen]\n\nWas denken Sie – wie wichtig ist das Fixgehalt vs. das Gesamtpaket für Sie?',
  NULL,
  NULL,
  '["Seien Sie transparent über Budget-Limits", "Zeigen Sie alternative Benefits auf", "Betonen Sie Entwicklungsperspektiven", "Finden Sie den wahren Motivator des Kandidaten"]'::jsonb,
  '[]'::jsonb
),
(
  'ghosting_prevention',
  'Ghosting-Prävention',
  'Playbook wenn Kandidat nicht mehr reagiert',
  E'Hallo [Name], hier ist [Recruiter]. Ich habe versucht, Sie zu erreichen – ist bei Ihnen alles okay?\n\nIch verstehe, dass Jobsuche stressig sein kann. Falls Sie Bedenken haben oder sich anders entschieden haben, lassen Sie es mich einfach wissen – das ist völlig okay!\n\nWenn Sie noch interessiert sind: [Unternehmen] wartet auf Ihre Rückmeldung. Kann ich irgendwie helfen?',
  E'Betreff: Alles okay bei Ihnen? 🤔\n\nHallo [Name],\n\nich habe ein paar Mal versucht, Sie zu erreichen. Ich hoffe, bei Ihnen ist alles in Ordnung!\n\nFalls Sie Ihre Meinung geändert haben – kein Problem, sagen Sie mir einfach Bescheid.\n\nFalls Sie noch interessiert sind: [Unternehmen] wartet auf Ihr Feedback. Lassen Sie uns kurz telefonieren?\n\nBeste Grüße,\n[Recruiter]',
  E'Hey [Name], ich wollte kurz nachfragen – alles okay? 🙂 Melden Sie sich gerne, auch wenn Sie nicht mehr interessiert sind. Feedback hilft mir!',
  '["Zeigen Sie Verständnis, nicht Druck", "Geben Sie einen einfachen Ausweg", "Fragen Sie nach dem wahren Grund", "Bieten Sie erneut Unterstützung an"]'::jsonb,
  '[{"objection": "Ich habe mich anders entschieden", "response": "Danke für die Ehrlichkeit! Darf ich fragen, was der Grund war? Ihr Feedback hilft mir sehr."}, {"objection": "Ich war einfach zu beschäftigt", "response": "Verstehe ich total! Ist die Stelle noch interessant? Ich kann den Prozess für Sie vereinfachen."}]'::jsonb
),
(
  'client_positive_feedback',
  'Positives Kundenfeedback nutzen',
  'Playbook wenn Kunde begeistert ist',
  E'Hallo [Name], tolle Nachrichten! [Unternehmen] ist absolut begeistert von Ihrem Interview!\n\n[Konkretes Feedback einfügen]\n\nJetzt ist der perfekte Moment, um über die nächsten Schritte zu sprechen:\n1. Es wird wahrscheinlich ein Angebot geben\n2. Wie stehen Sie aktuell zur Stelle?\n3. Gibt es noch offene Fragen?\n\nLassen Sie uns vorbereiten, damit Sie das beste Angebot bekommen!',
  NULL,
  NULL,
  '["Teilen Sie das positive Feedback sofort", "Nutzen Sie den Momentum-Effekt", "Bereiten Sie auf Angebot vor", "Klären Sie finale Bedenken"]'::jsonb,
  '[]'::jsonb
),
(
  'closing_preparation',
  'Closing vorbereiten',
  'Playbook für die finale Phase vor dem Angebot',
  E'Hallo [Name], wir sind auf der Zielgeraden! [Unternehmen] bereitet ein Angebot vor.\n\nBevor es soweit ist:\n1. Haben Sie noch offene Fragen zum Team oder zur Rolle?\n2. Wie ist Ihre Kündigungsfrist?\n3. Gibt es andere Angebote, die Sie erwägen?\n\nMein Ziel ist, dass Sie die beste Entscheidung treffen. Was brauchen Sie noch?',
  NULL,
  NULL,
  '["Klären Sie alle offenen Punkte", "Fragen Sie nach Konkurrenz-Angeboten", "Bereiten Sie auf Kündigungsgespräch vor", "Besprechen Sie Startdatum"]'::jsonb,
  '[{"objection": "Ich habe noch ein anderes Angebot", "response": "Das ist eine gute Position! Lassen Sie uns beide Angebote vergleichen – was sind die Unterschiede?"}, {"objection": "Ich muss noch mit meiner Familie sprechen", "response": "Absolut! Gibt es Fragen, die ich beantworten kann, um die Entscheidung zu erleichtern?"}]'::jsonb
),
(
  'culture_fit_concerns',
  'Kulturelle Bedenken adressieren',
  'Playbook wenn Kandidat unsicher bzgl. Unternehmenskultur ist',
  E'Hallo [Name], ich habe bemerkt, dass Sie bezüglich der Unternehmenskultur bei [Unternehmen] unsicher sind. Lassen Sie uns darüber sprechen!\n\nWas genau macht Sie unsicher?\n\n[Nach Antwort:] Das kann ich verstehen. Hier sind ein paar Einblicke:\n- Das Team ist [Beschreibung]\n- Die Arbeitsweise ist [Beschreibung]\n- Mitarbeiter sagen [Zitate]\n\nSoll ich einen informellen Coffee-Chat mit jemandem aus dem Team organisieren?',
  NULL,
  NULL,
  '["Fragen Sie nach konkreten Bedenken", "Teilen Sie authentische Einblicke", "Bieten Sie informelle Gespräche an", "Seien Sie ehrlich über die Kultur"]'::jsonb,
  '[]'::jsonb
),
(
  'counter_offer_handling',
  'Counter-Offer Handling',
  'Playbook wenn aktueller Arbeitgeber ein Gegenangebot macht',
  E'Hallo [Name], Glückwunsch zum Gegenangebot! Das zeigt, dass Ihr Arbeitgeber Sie schätzt.\n\nAber lassen Sie uns ehrlich sein:\n1. Warum wollten Sie ursprünglich wechseln?\n2. Löst das Gegenangebot diese Gründe?\n3. Statistik: 80% der Mitarbeiter, die ein Gegenangebot annehmen, verlassen das Unternehmen innerhalb von 12 Monaten trotzdem.\n\nWas hat sich wirklich geändert außer dem Gehalt?',
  NULL,
  NULL,
  '["Erinnern Sie an die ursprünglichen Wechselgründe", "Hinterfragen Sie die Nachhaltigkeit des Gegenangebots", "Teilen Sie Statistiken zu Counter-Offers", "Bleiben Sie neutral und supportiv"]'::jsonb,
  '[{"objection": "Mein Arbeitgeber hat mir mehr Gehalt geboten", "response": "Verstehe ich! Aber: Warum brauchte es Ihre Kündigung, damit sie Ihren Wert erkennen?"}, {"objection": "Ich fühle mich meinem Team verpflichtet", "response": "Das zeigt Loyalität! Aber denken Sie langfristig: Was ist besser für Ihre Karriere?"}]'::jsonb
),
(
  'engagement_boost',
  'Engagement steigern',
  'Playbook um passives Kandidaten-Engagement zu erhöhen',
  E'Hallo [Name], ich wollte kurz einchecken! Wie geht es Ihnen mit dem Prozess bei [Unternehmen]?\n\nIch habe ein paar interessante Infos für Sie:\n- [Aktuelle News über das Unternehmen]\n- [Spannendes über das Team]\n- [Entwicklungsmöglichkeiten]\n\nGibt es etwas, das ich für Sie tun kann?',
  NULL,
  NULL,
  '["Teilen Sie relevante Neuigkeiten", "Halten Sie regelmäßigen Kontakt", "Fragen Sie nach Bedenken", "Bieten Sie proaktiv Hilfe an"]'::jsonb,
  '[]'::jsonb
);