-- 1. Drop and recreate client_interviews_view with submission status filter
DROP VIEW IF EXISTS client_interviews_view;
CREATE VIEW client_interviews_view 
WITH (security_invoker = true) AS
SELECT 
  i.id,
  i.status,
  i.scheduled_at,
  i.created_at,
  i.submission_id,
  s.status as submission_status,
  s.job_id,
  j.client_id,
  j.title as job_title,
  j.industry as job_industry,
  c.full_name as candidate_name,
  c.id as candidate_id
FROM interviews i
JOIN submissions s ON i.submission_id = s.id
JOIN jobs j ON s.job_id = j.id
JOIN candidates c ON s.candidate_id = c.id
WHERE i.status NOT IN ('cancelled', 'completed', 'no_show')
  AND s.status NOT IN ('rejected', 'withdrawn', 'hired', 'client_rejected');

-- 2. Drop and recreate client_offers_view with submission status filter
DROP VIEW IF EXISTS client_offers_view;
CREATE VIEW client_offers_view 
WITH (security_invoker = true) AS
SELECT 
  o.id,
  o.status,
  o.created_at,
  o.submission_id,
  s.status as submission_status,
  s.job_id,
  j.client_id,
  j.title as job_title,
  c.full_name as candidate_name,
  c.id as candidate_id
FROM offers o
JOIN submissions s ON o.submission_id = s.id
JOIN jobs j ON s.job_id = j.id
JOIN candidates c ON s.candidate_id = c.id
WHERE o.status NOT IN ('accepted', 'rejected', 'cancelled', 'expired')
  AND s.status NOT IN ('rejected', 'withdrawn', 'hired', 'client_rejected');

-- 3. Create trigger function to auto-cancel interviews/offers when submission is rejected
CREATE OR REPLACE FUNCTION cancel_orphaned_interviews_offers()
RETURNS TRIGGER AS $$
BEGIN
  -- When submission is rejected/withdrawn/hired
  IF NEW.status IN ('rejected', 'withdrawn', 'hired', 'client_rejected') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('rejected', 'withdrawn', 'hired', 'client_rejected')) THEN
    
    -- Cancel pending/scheduled interviews
    UPDATE interviews 
    SET status = 'cancelled',
        notes = COALESCE(notes, '') || E'\n\n[Auto-cancelled: Kandidat ' || NEW.status || ']'
    WHERE submission_id = NEW.id 
      AND status NOT IN ('completed', 'cancelled', 'no_show');
    
    -- Cancel pending offers
    UPDATE offers 
    SET status = 'cancelled'
    WHERE submission_id = NEW.id 
      AND status NOT IN ('accepted', 'rejected', 'cancelled', 'expired');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Create the trigger
DROP TRIGGER IF EXISTS trigger_cancel_orphaned_interviews_offers ON submissions;
CREATE TRIGGER trigger_cancel_orphaned_interviews_offers
  AFTER UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION cancel_orphaned_interviews_offers();

-- 5. Clean up existing orphaned interviews (one-time data fix)
UPDATE interviews i
SET status = 'cancelled',
    notes = COALESCE(i.notes, '') || E'\n\n[Auto-cancelled: Bestandsdaten-Bereinigung]'
FROM submissions s
WHERE i.submission_id = s.id
  AND s.status IN ('rejected', 'withdrawn', 'hired', 'client_rejected')
  AND i.status NOT IN ('completed', 'cancelled', 'no_show');

-- 6. Clean up existing orphaned offers (one-time data fix)
UPDATE offers o
SET status = 'cancelled'
FROM submissions s
WHERE o.submission_id = s.id
  AND s.status IN ('rejected', 'withdrawn', 'hired', 'client_rejected')
  AND o.status NOT IN ('accepted', 'rejected', 'cancelled', 'expired');