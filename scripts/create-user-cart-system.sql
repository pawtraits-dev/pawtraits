-- Create server-side cart system tied to user accounts
-- This replaces the client-side localStorage cart system

BEGIN;

-- Create cart_items table to store user-specific cart items
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL, -- References auth.users.id
    product_id TEXT NOT NULL,
    image_id UUID NOT NULL REFERENCES image_catalog(id),
    image_url TEXT NOT NULL,
    image_title TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    pricing_data JSONB NOT NULL, -- Store ProductPricing object
    product_data JSONB NOT NULL, -- Store Product object  
    partner_id UUID REFERENCES partners(id), -- For referral tracking
    discount_code TEXT, -- For referral/discount codes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate items (same product + image combination per user)
    UNIQUE(user_id, product_id, image_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_image_id ON cart_items(image_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_partner_id ON cart_items(partner_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_created_at ON cart_items(created_at);

-- Enable RLS for security
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Users can only access their own cart items
CREATE POLICY "Users can view own cart items" ON cart_items
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own cart items" ON cart_items  
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own cart items" ON cart_items
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own cart items" ON cart_items
    FOR DELETE USING (user_id = auth.uid());

-- Function to get user's cart with totals and watermarked images
CREATE OR REPLACE FUNCTION get_user_cart(p_user_id UUID)
RETURNS TABLE (
    cart_item_id UUID,
    product_id TEXT,
    image_id UUID,
    image_url TEXT,
    image_title TEXT,
    quantity INTEGER,
    pricing_data JSONB,
    product_data JSONB,
    partner_id UUID,
    discount_code TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    item_total INTEGER -- Total price for this item in pence
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.id as cart_item_id,
        ci.product_id,
        ci.image_id,
        -- Use watermarked URL from image_catalog if available, otherwise fallback to stored URL
        COALESCE(
            ic.image_variants->'catalog_watermarked'->>'url',
            ci.image_url
        ) as image_url,
        ci.image_title,
        ci.quantity,
        ci.pricing_data,
        ci.product_data,
        ci.partner_id,
        ci.discount_code,
        ci.created_at,
        ci.updated_at,
        (ci.quantity * (ci.pricing_data->>'sale_price')::INTEGER) as item_total
    FROM cart_items ci 
    LEFT JOIN image_catalog ic ON ci.image_id = ic.id
    WHERE ci.user_id = p_user_id
    ORDER BY ci.created_at DESC;
END;
$$;

-- Function to add/update cart item
CREATE OR REPLACE FUNCTION upsert_cart_item(
    p_user_id UUID,
    p_product_id TEXT,
    p_image_id UUID,
    p_image_url TEXT,
    p_image_title TEXT,
    p_quantity INTEGER,
    p_pricing_data JSONB,
    p_product_data JSONB,
    p_partner_id UUID DEFAULT NULL,
    p_discount_code TEXT DEFAULT NULL
)
RETURNS cart_items
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result_item cart_items;
BEGIN
    -- Insert or update cart item
    INSERT INTO cart_items (
        user_id, product_id, image_id, image_url, image_title,
        quantity, pricing_data, product_data, partner_id, discount_code
    ) VALUES (
        p_user_id, p_product_id, p_image_id, p_image_url, p_image_title,
        p_quantity, p_pricing_data, p_product_data, p_partner_id, p_discount_code
    )
    ON CONFLICT (user_id, product_id, image_id) 
    DO UPDATE SET 
        quantity = cart_items.quantity + p_quantity,
        pricing_data = p_pricing_data,
        product_data = p_product_data,
        partner_id = COALESCE(p_partner_id, cart_items.partner_id),
        discount_code = COALESCE(p_discount_code, cart_items.discount_code),
        updated_at = NOW()
    RETURNING * INTO result_item;
    
    RETURN result_item;
END;
$$;

-- Function to clear user's cart
CREATE OR REPLACE FUNCTION clear_user_cart(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cart_items WHERE user_id = p_user_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON cart_items TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_cart TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_cart_item TO authenticated;
GRANT EXECUTE ON FUNCTION clear_user_cart TO authenticated;

SELECT 'User cart system created successfully!' as result;

COMMIT;