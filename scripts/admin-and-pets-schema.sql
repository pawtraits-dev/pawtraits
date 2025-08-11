-- Admin and Pet Details Schema Updates
-- Run this after the partner schema

-- 1. Create customers table for B2C users
CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    marketing_consent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create pets table for customer pet details
CREATE TABLE IF NOT EXISTS pets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    breed_id UUID REFERENCES breeds(id) ON DELETE SET NULL,
    coat_id UUID REFERENCES coats(id) ON DELETE SET NULL,
    gender TEXT CHECK (gender IN ('male', 'female', 'unknown')),
    age INTEGER, -- in months
    weight DECIMAL(5,2), -- in pounds
    is_spayed_neutered BOOLEAN,
    personality_traits TEXT[],
    special_notes TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create pet_photos table for storing multiple photos per pet
CREATE TABLE IF NOT EXISTS pet_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Add pet details to referrals table
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referrals' AND column_name='pet_id') THEN
        ALTER TABLE referrals ADD COLUMN pet_id UUID REFERENCES pets(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referrals' AND column_name='pet_name') THEN
        ALTER TABLE referrals ADD COLUMN pet_name TEXT;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referrals' AND column_name='pet_breed_id') THEN
        ALTER TABLE referrals ADD COLUMN pet_breed_id UUID REFERENCES breeds(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referrals' AND column_name='pet_coat_id') THEN
        ALTER TABLE referrals ADD COLUMN pet_coat_id UUID REFERENCES coats(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Add admin fields to partners table for approval workflow
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partners' AND column_name='approval_status') THEN
        ALTER TABLE partners ADD COLUMN approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partners' AND column_name='approved_by') THEN
        ALTER TABLE partners ADD COLUMN approved_by UUID;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partners' AND column_name='approved_at') THEN
        ALTER TABLE partners ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partners' AND column_name='rejection_reason') THEN
        ALTER TABLE partners ADD COLUMN rejection_reason TEXT;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partners' AND column_name='last_login_at') THEN
        ALTER TABLE partners ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 6. Create admins table for admin users
CREATE TABLE IF NOT EXISTS admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    permissions TEXT[] DEFAULT ARRAY['partners:read', 'partners:write', 'customers:read', 'customers:write'],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create activity_log table for audit trail
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- 'partner', 'customer', 'referral', etc.
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create indexes
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_customers_email') THEN
        CREATE INDEX idx_customers_email ON customers(email);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_customers_is_active') THEN
        CREATE INDEX idx_customers_is_active ON customers(is_active);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_pets_customer_id') THEN
        CREATE INDEX idx_pets_customer_id ON pets(customer_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_pets_breed_id') THEN
        CREATE INDEX idx_pets_breed_id ON pets(breed_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_pet_photos_pet_id') THEN
        CREATE INDEX idx_pet_photos_pet_id ON pet_photos(pet_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_pet_photos_is_primary') THEN
        CREATE INDEX idx_pet_photos_is_primary ON pet_photos(is_primary);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_partners_approval_status') THEN
        CREATE INDEX idx_partners_approval_status ON partners(approval_status);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_activity_log_admin_id') THEN
        CREATE INDEX idx_activity_log_admin_id ON activity_log(admin_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_activity_log_entity') THEN
        CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_activity_log_created_at') THEN
        CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
    END IF;
END $$;

-- 9. Create updated_at triggers
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pets_updated_at ON pets;
CREATE TRIGGER update_pets_updated_at 
    BEFORE UPDATE ON pets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_admins_updated_at ON admins;
CREATE TRIGGER update_admins_updated_at 
    BEFORE UPDATE ON admins 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 10. Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- 11. Create RLS policies for customers
DROP POLICY IF EXISTS "Users can view their own profile" ON customers;
CREATE POLICY "Users can view their own profile" ON customers
    FOR SELECT USING (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Users can update their own profile" ON customers;
CREATE POLICY "Users can update their own profile" ON customers
    FOR UPDATE USING (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Admins can view all customers" ON customers;
CREATE POLICY "Admins can view all customers" ON customers
    FOR ALL USING (EXISTS (SELECT 1 FROM admins WHERE auth.uid()::text = id::text));

-- 12. Create RLS policies for pets
DROP POLICY IF EXISTS "Users can manage their own pets" ON pets;
CREATE POLICY "Users can manage their own pets" ON pets
    FOR ALL USING (customer_id IN (SELECT id FROM customers WHERE auth.uid()::text = id::text));

DROP POLICY IF EXISTS "Admins can view all pets" ON pets;
CREATE POLICY "Admins can view all pets" ON pets
    FOR SELECT USING (EXISTS (SELECT 1 FROM admins WHERE auth.uid()::text = id::text));

-- 13. Create RLS policies for pet photos
DROP POLICY IF EXISTS "Users can manage photos of their pets" ON pet_photos;
CREATE POLICY "Users can manage photos of their pets" ON pet_photos
    FOR ALL USING (pet_id IN (
        SELECT p.id FROM pets p 
        JOIN customers c ON p.customer_id = c.id 
        WHERE auth.uid()::text = c.id::text
    ));

-- 14. Create RLS policies for admins
DROP POLICY IF EXISTS "Admins can view admin profiles" ON admins;
CREATE POLICY "Admins can view admin profiles" ON admins
    FOR SELECT USING (auth.uid()::text = id::text OR EXISTS (SELECT 1 FROM admins WHERE auth.uid()::text = id::text AND role = 'super_admin'));

-- 15. Create RLS policies for activity log
DROP POLICY IF EXISTS "Admins can view activity log" ON activity_log;
CREATE POLICY "Admins can view activity log" ON activity_log
    FOR SELECT USING (EXISTS (SELECT 1 FROM admins WHERE auth.uid()::text = id::text));

-- 16. Grant permissions
GRANT ALL ON customers TO authenticated;
GRANT ALL ON pets TO authenticated;
GRANT ALL ON pet_photos TO authenticated;
GRANT ALL ON admins TO authenticated;
GRANT ALL ON activity_log TO authenticated;

GRANT SELECT ON customers TO anon;

-- 17. Create admin views for monitoring
DROP VIEW IF EXISTS admin_partner_overview;
CREATE VIEW admin_partner_overview AS
SELECT 
    p.id,
    p.email,
    p.first_name || ' ' || p.last_name as full_name,
    p.business_name,
    p.business_type,
    p.approval_status,
    p.is_active,
    p.is_verified,
    p.created_at,
    p.last_login_at,
    COUNT(r.id) as total_referrals,
    COUNT(CASE WHEN r.status = 'purchased' THEN 1 END) as successful_referrals,
    COALESCE(SUM(r.commission_amount), 0) as total_commissions
FROM partners p
LEFT JOIN referrals r ON p.id = r.partner_id
GROUP BY p.id, p.email, p.first_name, p.last_name, p.business_name, p.business_type, 
         p.approval_status, p.is_active, p.is_verified, p.created_at, p.last_login_at;

DROP VIEW IF EXISTS admin_customer_overview;
CREATE VIEW admin_customer_overview AS
SELECT 
    c.id,
    c.email,
    c.first_name || ' ' || c.last_name as full_name,
    c.phone,
    c.is_active,
    c.email_verified,
    c.marketing_consent,
    c.created_at,
    COUNT(p.id) as total_pets,
    COUNT(co.id) as total_orders
FROM customers c
LEFT JOIN pets p ON c.id = p.customer_id
LEFT JOIN client_orders co ON c.email = co.client_email
GROUP BY c.id, c.email, c.first_name, c.last_name, c.phone, c.is_active, 
         c.email_verified, c.marketing_consent, c.created_at;

-- Grant permissions on views
GRANT SELECT ON admin_partner_overview TO authenticated;
GRANT SELECT ON admin_customer_overview TO authenticated;

-- 18. Create function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
    p_admin_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO activity_log (admin_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (p_admin_id, p_action, p_entity_type, p_entity_id, p_old_data, p_new_data)
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT 'Admin and pet details schema installed successfully!' as status;