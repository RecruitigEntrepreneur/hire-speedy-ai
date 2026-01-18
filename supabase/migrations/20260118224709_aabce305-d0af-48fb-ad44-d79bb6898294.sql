-- Add career_goals column to candidate_client_summary
ALTER TABLE candidate_client_summary 
ADD COLUMN career_goals text;

COMMENT ON COLUMN candidate_client_summary.career_goals IS 
'Mittel- bis langfristige Karriereziele des Kandidaten';