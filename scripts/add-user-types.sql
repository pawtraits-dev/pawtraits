-- Create user_profiles table to manage user types and additional metadata
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE, -- Reference to auth.users
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'partner', 'customer')),
  
  -- Admin specific fields
  permissions TEXT[] DEFAULT '{}', -- Array of permission strings
  
  -- Partner specific fields  
  partner_id UUID, -- Reference to partners table
  
  -- Customer specific fields
  customer_id UUID, -- Reference to customers table
  
  -- Common fields
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  
  -- Status and metadata
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add foreign key constraints if the referenced tables exist
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partners') THEN
    ALTER TABLE public.user_profiles 
    ADD CONSTRAINT user_profiles_partner_id_fkey 
    FOREIGN KEY (partner_id) REFERENCES public.partners(id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    ALTER TABLE public.user_profiles 
    ADD CONSTRAINT user_profiles_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES public.customers(id);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_type ON public.user_profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_user_profiles_partner_id ON public.user_profiles(partner_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_customer_id ON public.user_profiles(customer_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public.user_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update their own profile (but not user_type)
CREATE POLICY "Users can update their own profile"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND user_type = (SELECT user_type FROM public.user_profiles WHERE user_id = auth.uid()));

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.user_profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_id = auth.uid() 
    AND user_type = 'admin'
  )
);

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_id = auth.uid() 
    AND user_type = 'admin'
  )
);

-- Function to get user profile with type
CREATE OR REPLACE FUNCTION get_user_profile(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
  profile_id UUID,
  user_id UUID,
  user_type TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  status TEXT,
  permissions TEXT[],
  partner_id UUID,
  customer_id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id,
    up.user_id,
    up.user_type,
    up.first_name,
    up.last_name,
    up.email,
    up.phone,
    up.avatar_url,
    up.status,
    up.permissions,
    up.partner_id,
    up.customer_id,
    up.created_at,
    up.updated_at
  FROM public.user_profiles up
  WHERE up.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create user profile
CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id UUID,
  p_user_type TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_partner_id UUID DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL
) RETURNS user_profiles AS $$
DECLARE
  new_profile user_profiles;
BEGIN
  INSERT INTO public.user_profiles (
    user_id,
    user_type,
    first_name,
    last_name,
    email,
    phone,
    partner_id,
    customer_id
  ) VALUES (
    p_user_id,
    p_user_type,
    p_first_name,
    p_last_name,
    p_email,
    p_phone,
    p_partner_id,
    p_customer_id
  ) RETURNING * INTO new_profile;
  
  RETURN new_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile TO anon;

-- Create initial admin user (replace with your admin email)
-- You'll need to run this after creating your first admin account
-- INSERT INTO public.user_profiles (user_id, user_type, first_name, last_name, email, permissions)
-- SELECT id, 'admin', 'Admin', 'User', email, ARRAY['all']
-- FROM auth.users 
-- WHERE email = 'your-admin-email@example.com'
-- ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE public.user_profiles IS 'Store user types and additional profile information';
COMMENT ON FUNCTION get_user_profile IS 'Get user profile with type information';
COMMENT ON FUNCTION create_user_profile IS 'Create a new user profile with specified type';