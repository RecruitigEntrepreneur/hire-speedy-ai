-- Phase 2: Payment & Escrow System

-- 1. stripe_accounts - Stripe Connect für Recruiter
CREATE TABLE public.stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stripe_account_id TEXT NOT NULL UNIQUE,
  account_type TEXT DEFAULT 'express',
  charges_enabled BOOLEAN DEFAULT false,
  payouts_enabled BOOLEAN DEFAULT false,
  details_submitted BOOLEAN DEFAULT false,
  onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. payout_requests - Auszahlungsanfragen
CREATE TABLE public.payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id UUID REFERENCES placements(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL,
  amount DECIMAL NOT NULL,
  currency TEXT DEFAULT 'EUR',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'failed', 'cancelled')),
  stripe_transfer_id TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. payment_events - Stripe Webhook Events
CREATE TABLE public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Erweiterungen bestehender Tabellen
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';

ALTER TABLE placements ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT 'pending' CHECK (escrow_status IN ('pending', 'held', 'released', 'disputed', 'refunded'));
ALTER TABLE placements ADD COLUMN IF NOT EXISTS escrow_release_date TIMESTAMPTZ;

-- 5. Enable RLS
ALTER TABLE stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies für stripe_accounts
CREATE POLICY "Users can view their own stripe account"
ON stripe_accounts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stripe account"
ON stripe_accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stripe account"
ON stripe_accounts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all stripe accounts"
ON stripe_accounts FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- 7. RLS Policies für payout_requests
CREATE POLICY "Recruiters can view their own payout requests"
ON payout_requests FOR SELECT
USING (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can create payout requests"
ON payout_requests FOR INSERT
WITH CHECK (auth.uid() = recruiter_id);

CREATE POLICY "Admins can manage all payout requests"
ON payout_requests FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- 8. RLS Policies für payment_events
CREATE POLICY "Admins can manage all payment events"
ON payment_events FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert payment events"
ON payment_events FOR INSERT
WITH CHECK (true);

-- 9. Indexes für Performance
CREATE INDEX idx_stripe_accounts_user_id ON stripe_accounts(user_id);
CREATE INDEX idx_payout_requests_recruiter_id ON payout_requests(recruiter_id);
CREATE INDEX idx_payout_requests_status ON payout_requests(status);
CREATE INDEX idx_payment_events_stripe_event_id ON payment_events(stripe_event_id);
CREATE INDEX idx_placements_escrow_status ON placements(escrow_status);

-- 10. Trigger für updated_at
CREATE TRIGGER update_stripe_accounts_updated_at
BEFORE UPDATE ON stripe_accounts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();