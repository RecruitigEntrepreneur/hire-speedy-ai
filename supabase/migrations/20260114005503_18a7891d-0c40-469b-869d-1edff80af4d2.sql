-- Add unique constraint on candidate_id for proper upsert functionality
ALTER TABLE candidate_client_summary 
ADD CONSTRAINT candidate_client_summary_candidate_id_unique 
UNIQUE (candidate_id);