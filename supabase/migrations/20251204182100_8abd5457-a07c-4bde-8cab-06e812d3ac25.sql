-- Phase 1: Database Extensions for Client Dashboard

-- Add stage column to submissions for Kanban pipeline
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS stage text DEFAULT 'submitted';

-- Add paused_at to jobs for pause functionality
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS paused_at timestamp with time zone;

-- Create candidate_comments table for internal hiring team comments
CREATE TABLE public.candidate_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on candidate_comments
ALTER TABLE public.candidate_comments ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view comments on submissions for their jobs
CREATE POLICY "Users can view comments on their job submissions"
ON public.candidate_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM submissions s
    JOIN jobs j ON j.id = s.job_id
    WHERE s.id = candidate_comments.submission_id
    AND (j.client_id = auth.uid() OR s.recruiter_id = auth.uid())
  )
);

-- RLS: Users can insert comments on submissions for their jobs
CREATE POLICY "Users can insert comments on their job submissions"
ON public.candidate_comments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM submissions s
    JOIN jobs j ON j.id = s.job_id
    WHERE s.id = candidate_comments.submission_id
    AND j.client_id = auth.uid()
  )
);

-- RLS: Users can update their own comments
CREATE POLICY "Users can update their own comments"
ON public.candidate_comments
FOR UPDATE
USING (auth.uid() = user_id);

-- RLS: Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
ON public.candidate_comments
FOR DELETE
USING (auth.uid() = user_id);

-- RLS: Admins can manage all comments
CREATE POLICY "Admins can manage all comments"
ON public.candidate_comments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create company_profiles table
CREATE TABLE public.company_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  company_name text NOT NULL,
  logo_url text,
  industry text,
  website text,
  description text,
  address text,
  tax_id text,
  billing_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on company_profiles
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for company_profiles
CREATE POLICY "Users can view their own company profile"
ON public.company_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own company profile"
ON public.company_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own company profile"
ON public.company_profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all company profiles"
ON public.company_profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create invoices table
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  placement_id uuid NOT NULL REFERENCES public.placements(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  invoice_number text NOT NULL UNIQUE,
  amount numeric NOT NULL,
  tax_amount numeric DEFAULT 0,
  total_amount numeric NOT NULL,
  status text DEFAULT 'pending',
  due_date date,
  paid_at timestamp with time zone,
  pdf_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoices
CREATE POLICY "Clients can view their own invoices"
ON public.invoices FOR SELECT
USING (auth.uid() = client_id);

CREATE POLICY "Admins can manage all invoices"
ON public.invoices FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at on new tables
CREATE TRIGGER update_candidate_comments_updated_at
BEFORE UPDATE ON public.candidate_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_company_profiles_updated_at
BEFORE UPDATE ON public.company_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();