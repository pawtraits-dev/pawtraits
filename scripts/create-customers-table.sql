-- Create customers table for B2C users
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  -- User account details
  user_id UUID, -- Reference to auth.users if they create an account
  is_registered BOOLEAN DEFAULT false,
  -- Pet information
  pets JSONB DEFAULT '[]'::jsonb,
  -- Contact preferences
  marketing_consent BOOLEAN DEFAULT false,
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  -- Order history summary
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  first_order_date TIMESTAMP WITH TIME ZONE,
  last_order_date TIMESTAMP WITH TIME ZONE,
  -- Referral information
  referred_by_partner_id UUID,
  referral_code TEXT,
  referral_date TIMESTAMP WITH TIME ZONE,
  -- Metadata
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  customer_status TEXT DEFAULT 'active' CHECK (customer_status = ANY (ARRAY['active', 'inactive', 'blocked'])),
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_referred_by_partner_id_fkey FOREIGN KEY (referred_by_partner_id) REFERENCES public.partners(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_referred_by_partner_id ON public.customers(referred_by_partner_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customers_updated_at();

-- Create function to migrate existing client_orders data to customers table
CREATE OR REPLACE FUNCTION migrate_client_orders_to_customers()
RETURNS VOID AS $$
BEGIN
  -- Insert unique customers from client_orders
  INSERT INTO public.customers (
    email,
    referred_by_partner_id,
    total_orders,
    total_spent,
    first_order_date,
    last_order_date,
    created_at
  )
  SELECT DISTINCT ON (client_email)
    client_email,
    partner_id,
    COUNT(*) OVER (PARTITION BY client_email) as total_orders,
    SUM(order_value) OVER (PARTITION BY client_email) as total_spent,
    MIN(created_at) OVER (PARTITION BY client_email) as first_order_date,
    MAX(created_at) OVER (PARTITION BY client_email) as last_order_date,
    MIN(created_at) OVER (PARTITION BY client_email) as created_at
  FROM public.client_orders
  WHERE client_email NOT IN (SELECT email FROM public.customers)
  ORDER BY client_email, created_at;
  
  RAISE NOTICE 'Migrated client orders to customers table';
END;
$$ LANGUAGE plpgsql;

-- Create admin view for customers with aggregated data
CREATE OR REPLACE VIEW public.admin_customer_overview AS
SELECT 
  c.id,
  c.email,
  c.first_name,
  c.last_name,
  c.phone,
  c.is_registered,
  c.total_orders,
  c.total_spent,
  c.first_order_date,
  c.last_order_date,
  c.referred_by_partner_id,
  p.business_name as referring_partner_name,
  c.customer_status,
  c.marketing_consent,
  c.created_at,
  c.updated_at,
  -- Calculate customer lifetime value
  CASE 
    WHEN c.total_orders > 0 THEN c.total_spent / c.total_orders 
    ELSE 0 
  END as avg_order_value,
  -- Days since last order
  CASE 
    WHEN c.last_order_date IS NOT NULL THEN 
      EXTRACT(DAYS FROM (now() - c.last_order_date))
    ELSE NULL 
  END as days_since_last_order,
  -- Customer segment
  CASE 
    WHEN c.total_spent >= 500 THEN 'VIP'
    WHEN c.total_spent >= 200 THEN 'Premium'
    WHEN c.total_spent >= 50 THEN 'Regular'
    WHEN c.total_orders > 0 THEN 'New'
    ELSE 'Prospect'
  END as customer_segment
FROM public.customers c
LEFT JOIN public.partners p ON c.referred_by_partner_id = p.id
ORDER BY c.created_at DESC;

-- Add foreign key constraint to client_orders to reference customers
DO $$ 
BEGIN
  -- First add customer_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_orders' AND column_name = 'customer_id') THEN
    ALTER TABLE public.client_orders ADD COLUMN customer_id UUID;
    
    -- Update existing records to link to customers
    UPDATE public.client_orders 
    SET customer_id = c.id
    FROM public.customers c
    WHERE public.client_orders.client_email = c.email;
    
    -- Add foreign key constraint
    ALTER TABLE public.client_orders 
    ADD CONSTRAINT client_orders_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES public.customers(id);
  END IF;
END $$;

-- Create admin function to get customer details with orders
CREATE OR REPLACE FUNCTION admin_get_customer_details(customer_uuid UUID)
RETURNS TABLE (
  customer_info JSONB,
  orders JSONB,
  referral_info JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Customer info
    to_jsonb(c.*) as customer_info,
    -- Recent orders
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', co.id,
          'order_value', co.order_value,
          'order_status', co.order_status,
          'created_at', co.created_at,
          'order_items', co.order_items,
          'discount_applied', co.discount_applied
        ) ORDER BY co.created_at DESC
      )
      FROM public.client_orders co 
      WHERE co.customer_id = customer_uuid),
      '[]'::jsonb
    ) as orders,
    -- Referral information
    CASE 
      WHEN c.referred_by_partner_id IS NOT NULL THEN
        jsonb_build_object(
          'partner_name', p.business_name,
          'partner_email', p.email,
          'referral_date', c.referral_date,
          'referral_code', c.referral_code
        )
      ELSE NULL
    END as referral_info
  FROM public.customers c
  LEFT JOIN public.partners p ON c.referred_by_partner_id = p.id
  WHERE c.id = customer_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.customers IS 'B2C customers who have placed orders or been referred';
COMMENT ON FUNCTION migrate_client_orders_to_customers() IS 'One-time migration function to populate customers from existing client_orders';
COMMENT ON VIEW public.admin_customer_overview IS 'Admin view with customer analytics and segmentation';
COMMENT ON FUNCTION admin_get_customer_details(UUID) IS 'Admin function to get detailed customer information with orders and referral data';