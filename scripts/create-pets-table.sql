-- Create pets table for storing user pet information
CREATE TABLE IF NOT EXISTS public.pets (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- Reference to auth.users
  customer_id UUID, -- Reference to customers table if exists
  name TEXT NOT NULL,
  breed_id UUID,
  coat_id UUID,
  age INTEGER,
  birthday DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'unknown')),
  weight DECIMAL,
  -- Photo storage
  primary_photo_url TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  -- Additional details
  personality_traits TEXT[],
  special_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT pets_pkey PRIMARY KEY (id),
  CONSTRAINT pets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT pets_breed_id_fkey FOREIGN KEY (breed_id) REFERENCES public.breeds(id),
  CONSTRAINT pets_coat_id_fkey FOREIGN KEY (coat_id) REFERENCES public.coats(id)
);

-- Add customer_id foreign key if customers table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
    ALTER TABLE public.pets 
    ADD CONSTRAINT pets_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES public.customers(id);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pets_user_id ON public.pets(user_id);
CREATE INDEX IF NOT EXISTS idx_pets_customer_id ON public.pets(customer_id);
CREATE INDEX IF NOT EXISTS idx_pets_breed_id ON public.pets(breed_id);
CREATE INDEX IF NOT EXISTS idx_pets_coat_id ON public.pets(coat_id);
CREATE INDEX IF NOT EXISTS idx_pets_created_at ON public.pets(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pets_updated_at
  BEFORE UPDATE ON public.pets
  FOR EACH ROW
  EXECUTE FUNCTION update_pets_updated_at();

-- Create RLS policies for pets table
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own pets
CREATE POLICY "Users can view their own pets"
ON public.pets FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pets"
ON public.pets FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pets"
ON public.pets FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pets"
ON public.pets FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create view for pets with breed and coat information
CREATE OR REPLACE VIEW public.pets_with_details AS
SELECT 
  p.id,
  p.user_id,
  p.customer_id,
  p.name,
  p.age,
  p.birthday,
  p.gender,
  p.weight,
  p.primary_photo_url,
  p.photo_urls,
  p.personality_traits,
  p.special_notes,
  p.is_active,
  p.created_at,
  p.updated_at,
  -- Breed information
  b.id as breed_id,
  b.name as breed_name,
  b.slug as breed_slug,
  b.description as breed_description,
  b.physical_traits as breed_physical_traits,
  b.personality_traits as breed_personality_traits,
  -- Coat information
  c.id as coat_id,
  c.name as coat_name,
  c.slug as coat_slug,
  c.description as coat_description,
  c.hex_color as coat_hex_color,
  c.pattern_type as coat_pattern_type
FROM public.pets p
LEFT JOIN public.breeds b ON p.breed_id = b.id
LEFT JOIN public.coats c ON p.coat_id = c.id
WHERE p.is_active = true;

-- Create function to get user's pets with breed/coat details
CREATE OR REPLACE FUNCTION get_user_pets(user_uuid UUID)
RETURNS TABLE (
  pet_id UUID,
  name TEXT,
  age INTEGER,
  birthday DATE,
  gender TEXT,
  weight DECIMAL,
  primary_photo_url TEXT,
  photo_urls TEXT[],
  personality_traits TEXT[],
  special_notes TEXT,
  breed_id UUID,
  breed_name TEXT,
  breed_slug TEXT,
  coat_id UUID,
  coat_name TEXT,
  coat_slug TEXT,
  coat_hex_color TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.age,
    p.birthday,
    p.gender,
    p.weight,
    p.primary_photo_url,
    p.photo_urls,
    p.personality_traits,
    p.special_notes,
    p.breed_id,
    b.name as breed_name,
    b.slug as breed_slug,
    p.coat_id,
    c.name as coat_name,
    c.slug as coat_slug,
    c.hex_color as coat_hex_color,
    p.created_at
  FROM public.pets p
  LEFT JOIN public.breeds b ON p.breed_id = b.id
  LEFT JOIN public.coats c ON p.coat_id = c.id
  WHERE p.user_id = user_uuid 
    AND p.is_active = true
  ORDER BY p.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_pets TO authenticated;

-- Create function to add a pet for a user
CREATE OR REPLACE FUNCTION create_user_pet(
  p_user_id UUID,
  p_name TEXT,
  p_breed_id UUID DEFAULT NULL,
  p_coat_id UUID DEFAULT NULL,
  p_age INTEGER DEFAULT NULL,
  p_birthday DATE DEFAULT NULL,
  p_gender TEXT DEFAULT 'unknown',
  p_weight DECIMAL DEFAULT NULL,
  p_primary_photo_url TEXT DEFAULT NULL,
  p_personality_traits TEXT[] DEFAULT '{}',
  p_special_notes TEXT DEFAULT NULL
) RETURNS pets AS $$
DECLARE
  new_pet pets;
BEGIN
  INSERT INTO public.pets (
    user_id,
    name,
    breed_id,
    coat_id,
    age,
    birthday,
    gender,
    weight,
    primary_photo_url,
    personality_traits,
    special_notes
  ) VALUES (
    p_user_id,
    p_name,
    p_breed_id,
    p_coat_id,
    p_age,
    p_birthday,
    p_gender,
    p_weight,
    p_primary_photo_url,
    p_personality_traits,
    p_special_notes
  ) RETURNING * INTO new_pet;
  
  RETURN new_pet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_user_pet TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_pet TO anon;

COMMENT ON TABLE public.pets IS 'Store pet information for users';
COMMENT ON FUNCTION get_user_pets IS 'Get all pets for a user with breed and coat details';
COMMENT ON FUNCTION create_user_pet IS 'Create a new pet for a user';