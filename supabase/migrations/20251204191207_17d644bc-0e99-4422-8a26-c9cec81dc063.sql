-- Triple-Blind Mode: Neue Felder für submissions
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS consent_confirmed BOOLEAN DEFAULT false;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS consent_document_url TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS consent_confirmed_at TIMESTAMPTZ;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS identity_unlocked BOOLEAN DEFAULT false;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS unlocked_by UUID;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS opt_in_requested_at TIMESTAMPTZ;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS opt_in_response TEXT;

-- Audit Log Tabelle für Identity Unlocks
CREATE TABLE IF NOT EXISTS identity_unlock_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL,
    performed_by UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on identity_unlock_logs
ALTER TABLE identity_unlock_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies für identity_unlock_logs
CREATE POLICY "Admins can manage all unlock logs"
ON identity_unlock_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view unlock logs for their submissions"
ON identity_unlock_logs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM submissions s
        JOIN jobs j ON j.id = s.job_id
        WHERE s.id = identity_unlock_logs.submission_id
        AND (s.recruiter_id = auth.uid() OR j.client_id = auth.uid())
    )
);

CREATE POLICY "System can insert unlock logs"
ON identity_unlock_logs
FOR INSERT
WITH CHECK (true);