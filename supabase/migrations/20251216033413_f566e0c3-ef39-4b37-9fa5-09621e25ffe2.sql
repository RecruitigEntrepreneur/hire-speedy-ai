-- Add RLS policies for outreach_leads table for authenticated users

-- Users can insert outreach_leads
CREATE POLICY "Users can insert outreach_leads" 
ON outreach_leads FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Users can view outreach_leads
CREATE POLICY "Users can view outreach_leads" 
ON outreach_leads FOR SELECT 
TO authenticated
USING (true);

-- Users can update outreach_leads
CREATE POLICY "Users can update outreach_leads" 
ON outreach_leads FOR UPDATE 
TO authenticated
USING (true);

-- Users can delete outreach_leads
CREATE POLICY "Users can delete outreach_leads" 
ON outreach_leads FOR DELETE 
TO authenticated
USING (true);