ALTER TABLE public.intake_drafts DROP CONSTRAINT IF EXISTS intake_drafts_submit_requires_verified;
ALTER TABLE public.intake_drafts
  ADD CONSTRAINT intake_drafts_submit_requires_verified
  CHECK (review_state NOT IN ('pending_admin', 'accepted')
         OR (capture_state = 'complete'
             AND identity_state = 'email_verified'
             AND company_state NOT IN ('not_checked', 'checking')
             AND (selected_package_key IS NOT NULL OR contract_type = 'freelance')));