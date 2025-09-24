-- Create customer referral tracking table for QR scans and link clicks
CREATE TABLE IF NOT EXISTS public.customer_referral_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  referral_code TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('qr_scan', 'link_click', 'share')),
  platform TEXT DEFAULT 'unknown',
  tracked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  referrer_url TEXT,

  CONSTRAINT customer_referral_tracking_pkey PRIMARY KEY (id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_referral_tracking_code
ON public.customer_referral_tracking(referral_code);

CREATE INDEX IF NOT EXISTS idx_customer_referral_tracking_action
ON public.customer_referral_tracking(action);

CREATE INDEX IF NOT EXISTS idx_customer_referral_tracking_tracked_at
ON public.customer_referral_tracking(tracked_at);

-- Enable RLS
ALTER TABLE public.customer_referral_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow service role to manage all tracking data
CREATE POLICY "Service role can manage customer referral tracking"
ON public.customer_referral_tracking FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT ALL ON TABLE public.customer_referral_tracking TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

COMMENT ON TABLE public.customer_referral_tracking IS 'Track QR code scans, link clicks and shares for customer referrals';
COMMENT ON COLUMN public.customer_referral_tracking.action IS 'Type of action: qr_scan, link_click, or share';
COMMENT ON COLUMN public.customer_referral_tracking.platform IS 'Platform or source of the action';