-- Phase 3: Analytics Tables

-- 1. Funnel Metrics - Aggregierte Metriken (täglich berechnet)
CREATE TABLE public.funnel_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('job', 'client', 'recruiter', 'platform')),
  entity_id UUID,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Funnel Metrics
  total_submissions INTEGER DEFAULT 0,
  submissions_to_opt_in INTEGER DEFAULT 0,
  opt_in_to_interview INTEGER DEFAULT 0,
  interview_to_offer INTEGER DEFAULT 0,
  offer_to_placement INTEGER DEFAULT 0,
  
  -- Conversion Rates
  opt_in_rate NUMERIC,
  interview_rate NUMERIC,
  offer_rate NUMERIC,
  acceptance_rate NUMERIC,
  
  -- Time Metrics
  avg_time_to_opt_in_hours NUMERIC,
  avg_time_to_interview_days NUMERIC,
  avg_time_to_offer_days NUMERIC,
  avg_time_to_fill_days NUMERIC,
  
  -- Quality Metrics
  avg_match_score NUMERIC,
  avg_candidate_score NUMERIC,
  
  -- Drop-off Analysis
  drop_offs_by_stage JSONB DEFAULT '{}',
  drop_off_reasons JSONB DEFAULT '{}',
  
  calculated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Recruiter Leaderboard
CREATE TABLE public.recruiter_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  period_start DATE NOT NULL,
  
  placements INTEGER DEFAULT 0,
  submissions INTEGER DEFAULT 0,
  conversion_rate NUMERIC,
  avg_time_to_fill NUMERIC,
  avg_candidate_score NUMERIC,
  total_revenue NUMERIC DEFAULT 0,
  
  rank_position INTEGER,
  rank_change INTEGER DEFAULT 0,
  
  calculated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Employer Scores
CREATE TABLE public.employer_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE,
  
  -- Response Metrics
  avg_response_time_hours NUMERIC,
  response_time_score INTEGER CHECK (response_time_score BETWEEN 0 AND 100),
  
  -- Interview Metrics
  interview_scheduling_speed_days NUMERIC,
  interview_feedback_speed_days NUMERIC,
  no_show_rate NUMERIC,
  interview_quality_score INTEGER CHECK (interview_quality_score BETWEEN 0 AND 100),
  
  -- Offer Metrics
  offer_rate NUMERIC,
  offer_acceptance_rate NUMERIC,
  avg_salary_vs_market NUMERIC,
  
  -- Overall
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  reliability_score INTEGER CHECK (reliability_score BETWEEN 0 AND 100),
  candidate_satisfaction_avg NUMERIC,
  
  -- Counts
  total_submissions INTEGER DEFAULT 0,
  total_interviews INTEGER DEFAULT 0,
  total_placements INTEGER DEFAULT 0,
  
  calculated_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Employer Feedback
CREATE TABLE public.employer_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL,
  
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  process_rating INTEGER CHECK (process_rating BETWEEN 1 AND 5),
  transparency_rating INTEGER CHECK (transparency_rating BETWEEN 1 AND 5),
  respect_rating INTEGER CHECK (respect_rating BETWEEN 1 AND 5),
  
  positive_aspects TEXT[],
  improvement_areas TEXT[],
  would_recommend BOOLEAN,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Candidate Tags
CREATE TABLE public.candidate_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recruiter_id, name)
);

-- 6. Candidate Tag Assignments
CREATE TABLE public.candidate_tag_assignments (
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.candidate_tags(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (candidate_id, tag_id)
);

-- 7. Recruiter Tasks
CREATE TABLE public.recruiter_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL,
  
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT DEFAULT 'other' CHECK (task_type IN ('call', 'email', 'follow_up', 'meeting', 'other')),
  
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  submission_id UUID,
  job_id UUID,
  
  due_at TIMESTAMPTZ,
  reminder_at TIMESTAMPTZ,
  reminder_sent BOOLEAN DEFAULT false,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Recruiter Pipelines (Saved Searches)
CREATE TABLE public.recruiter_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB DEFAULT '{}',
  sort_by TEXT DEFAULT 'created_at',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Company Summaries (AI-generated)
CREATE TABLE public.company_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  summary_type TEXT NOT NULL CHECK (summary_type IN ('opt_in', 'candidate_prep', 'general')),
  content TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  is_approved BOOLEAN DEFAULT false
);

-- Extend company_profiles
ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS culture_values JSONB DEFAULT '[]';
ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS work_style TEXT;
ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS team_size_range TEXT;
ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS benefits JSONB DEFAULT '[]';
ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS perks JSONB DEFAULT '[]';
ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS remote_policy TEXT;
ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS office_locations JSONB DEFAULT '[]';
ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS brand_color_primary TEXT;
ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS brand_color_secondary TEXT;
ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS opt_in_message TEXT;
ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS show_culture_in_opt_in BOOLEAN DEFAULT true;
ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS show_benefits_in_opt_in BOOLEAN DEFAULT true;
ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS show_team_size_in_opt_in BOOLEAN DEFAULT true;

-- Extend candidate_comments
ALTER TABLE public.candidate_comments ADD COLUMN IF NOT EXISTS activity_type TEXT DEFAULT 'note';
ALTER TABLE public.candidate_comments ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private';

-- Enable RLS on all new tables
ALTER TABLE public.funnel_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for funnel_metrics
CREATE POLICY "Admins can manage all funnel metrics" ON public.funnel_metrics FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Clients can view their own metrics" ON public.funnel_metrics FOR SELECT USING (entity_type = 'client' AND entity_id = auth.uid());
CREATE POLICY "Recruiters can view their own metrics" ON public.funnel_metrics FOR SELECT USING (entity_type = 'recruiter' AND entity_id = auth.uid());
CREATE POLICY "System can insert funnel metrics" ON public.funnel_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update funnel metrics" ON public.funnel_metrics FOR UPDATE USING (true);

-- RLS Policies for recruiter_leaderboard
CREATE POLICY "Admins can manage all leaderboard entries" ON public.recruiter_leaderboard FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Recruiters can view all leaderboard entries" ON public.recruiter_leaderboard FOR SELECT USING (public.has_role(auth.uid(), 'recruiter'));
CREATE POLICY "System can insert leaderboard entries" ON public.recruiter_leaderboard FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update leaderboard entries" ON public.recruiter_leaderboard FOR UPDATE USING (true);

-- RLS Policies for employer_scores
CREATE POLICY "Admins can manage all employer scores" ON public.employer_scores FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Recruiters can view all employer scores" ON public.employer_scores FOR SELECT USING (public.has_role(auth.uid(), 'recruiter'));
CREATE POLICY "Clients can view their own employer score" ON public.employer_scores FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "System can insert employer scores" ON public.employer_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update employer scores" ON public.employer_scores FOR UPDATE USING (true);

-- RLS Policies for employer_feedback
CREATE POLICY "Admins can manage all employer feedback" ON public.employer_feedback FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Candidates can insert their own feedback" ON public.employer_feedback FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = candidate_id AND c.recruiter_id = auth.uid()) OR true);
CREATE POLICY "Clients can view their own feedback" ON public.employer_feedback FOR SELECT USING (auth.uid() = client_id);

-- RLS Policies for candidate_tags
CREATE POLICY "Recruiters can manage their own tags" ON public.candidate_tags FOR ALL USING (auth.uid() = recruiter_id);
CREATE POLICY "Admins can view all tags" ON public.candidate_tags FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for candidate_tag_assignments
CREATE POLICY "Recruiters can manage their own tag assignments" ON public.candidate_tag_assignments FOR ALL USING (EXISTS (SELECT 1 FROM public.candidate_tags t WHERE t.id = tag_id AND t.recruiter_id = auth.uid()));
CREATE POLICY "Admins can view all tag assignments" ON public.candidate_tag_assignments FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for recruiter_tasks
CREATE POLICY "Recruiters can manage their own tasks" ON public.recruiter_tasks FOR ALL USING (auth.uid() = recruiter_id);
CREATE POLICY "Admins can view all tasks" ON public.recruiter_tasks FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for recruiter_pipelines
CREATE POLICY "Recruiters can manage their own pipelines" ON public.recruiter_pipelines FOR ALL USING (auth.uid() = recruiter_id);
CREATE POLICY "Admins can view all pipelines" ON public.recruiter_pipelines FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for company_summaries
CREATE POLICY "Admins can manage all company summaries" ON public.company_summaries FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Clients can view their own summaries" ON public.company_summaries FOR SELECT USING (EXISTS (SELECT 1 FROM public.company_profiles cp WHERE cp.id = company_profile_id AND cp.user_id = auth.uid()));
CREATE POLICY "Recruiters can view approved summaries" ON public.company_summaries FOR SELECT USING (is_approved = true AND public.has_role(auth.uid(), 'recruiter'));
CREATE POLICY "System can insert summaries" ON public.company_summaries FOR INSERT WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_funnel_metrics_entity ON public.funnel_metrics(entity_type, entity_id);
CREATE INDEX idx_funnel_metrics_period ON public.funnel_metrics(period_start, period_end);
CREATE INDEX idx_recruiter_leaderboard_period ON public.recruiter_leaderboard(period, period_start);
CREATE INDEX idx_recruiter_leaderboard_recruiter ON public.recruiter_leaderboard(recruiter_id);
CREATE INDEX idx_employer_scores_client ON public.employer_scores(client_id);
CREATE INDEX idx_employer_feedback_client ON public.employer_feedback(client_id);
CREATE INDEX idx_candidate_tags_recruiter ON public.candidate_tags(recruiter_id);
CREATE INDEX idx_recruiter_tasks_recruiter ON public.recruiter_tasks(recruiter_id);
CREATE INDEX idx_recruiter_tasks_due ON public.recruiter_tasks(due_at) WHERE status = 'pending';
CREATE INDEX idx_recruiter_pipelines_recruiter ON public.recruiter_pipelines(recruiter_id);