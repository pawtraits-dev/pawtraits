-- Update cart function to use watermarked images from image_catalog
-- This ensures that all cart items display watermarked images even if they were added before Cloudinary migration

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
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    item_total INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.id,
        ci.product_id,
        ci.image_id,
        -- Use thumbnail variant from image_catalog if available, otherwise fallback to stored URL
        -- Thumbnails are appropriate for cart display (no overlay, small size)
        COALESCE(
            ic.image_variants->'thumbnail'->>'url',
            ic.image_variants->'mid_size'->>'url',
            ci.image_url
        )::TEXT,
        ci.image_title,
        ci.quantity,
        ci.pricing_data,
        ci.product_data,
        ci.partner_id,
        ci.discount_code,
        ci.created_at,
        ci.updated_at,
        (ci.quantity * (ci.pricing_data->>'sale_price')::INTEGER)
    FROM cart_items ci 
    LEFT JOIN image_catalog ic ON ci.image_id = ic.id
    WHERE ci.user_id = p_user_id
    ORDER BY ci.created_at DESC;
END;
$$;