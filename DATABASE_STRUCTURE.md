# Database Structure - Authoritative Reference

Based on complete_schema.sql - the definitive source of truth for the database structure.

## Core Tables

### 🛒 **Order & Commerce**
- `orders` - Main order records with payment and shipping info
- `order_items` - Line items within orders (has: unit_price, total_price, product_id, image_id)
- `client_orders` - Commission tracking for partner referrals
- `cart_items` - User shopping cart items

### 👥 **Users & Authentication**
- `user_profiles` - Central user management (admin/partner/customer)
- `partners` - Business partner details and approval status
- `customers` - End customer records with purchase history
- `pets` - Customer pet information
- `commission_payments` - Partner commission payment records

### 🎨 **AI Content System**
- `image_catalog` - AI-generated images with metadata
- `breeds` - Dog/cat breed definitions (with animal_type)
- `themes` - Artistic theme templates
- `styles` - Style definitions for image generation
- `coats` - Pet coat colors/patterns (with animal_type)
- `formats` - Image format specifications
- `media` - Physical print media types

### 🔗 **Referral & Tracking**
- `referrals` - Partner referral codes and tracking
- `referral_analytics` - Referral interaction events
- `qr_code_tracking` - QR code scan tracking

### 📊 **Analytics & Interactions**
- `user_interactions` - User engagement (like, share, view, unlike)
- `interaction_analytics` - Aggregated interaction statistics
- `platform_analytics` - Platform-specific sharing data
- `share_events` - Detailed sharing event tracking

### 🛍️ **Product & Pricing**
- `products` - Physical product definitions
- `product_pricing` - Multi-country pricing with profit calculations
- `countries` - Supported countries and currencies

### 🔒 **Security & Auditing**
- `audit_events` - Security and compliance event logging
- `audit_rules` - Automated audit rule definitions
- `data_protection_events` - GDPR/privacy compliance tracking
- `api_keys` - API access key management
- `rate_limits` - API rate limiting data

### 🎭 **Content Management**
- `carousels` - Homepage/page carousel configurations
- `carousel_slides` - Individual carousel slide content
- `outfits` - Pet outfit/clothing descriptions for AI generation

## Key Schema Facts

### **Order Items Structure** ✅
```sql
order_items (
  id, order_id, product_id, image_id, image_title, quantity,
  unit_price INTEGER,           -- ✅ EXISTS
  total_price INTEGER,          -- ✅ EXISTS  
  image_url TEXT,              -- ✅ EXISTS
  product_data JSONB,          -- ✅ EXISTS
  print_image_url TEXT,        -- ✅ EXISTS
  captured_* fields            -- Cost tracking fields
)
```

### **Tables That DON'T Exist** ❌
- `cost_snapshots` - Referenced in other scripts but doesn't exist
- `gelato_webhooks` - Referenced but not in current schema

### **Animal Type Support** 🐕🐱
- `breeds.animal_type` - 'dog' | 'cat'
- `coats.animal_type` - 'dog' | 'cat' 
- `pets.animal_type` - 'dog' | 'cat'

### **Image Analytics Fields** 📈
```sql
image_catalog (
  like_count INTEGER DEFAULT 0,     -- Built-in counters
  view_count INTEGER DEFAULT 0,     -- Built-in counters  
  share_count INTEGER DEFAULT 0,    -- Built-in counters
  cloudinary_public_id TEXT,        -- Cloudinary integration
  image_variants JSONB             -- Multiple image sizes
)
```

### **User Interaction Types** 👆
- `like`, `share`, `unlike`, `view` - stored in user_interactions table
- Note: NO 'purchase' interaction_type in schema constraint

### **Referral Status Flow** 🔄
- `invited` → `accessed` → `accepted` → `applied` → `expired`

## API Structure Implications

### **Safe Tables for Cleanup** ✅
- `orders` - Always exists
- `order_items` - Always exists, has pricing fields
- `referrals` - Always exists
- `client_orders` - Always exists
- `referral_analytics` - Always exists
- `user_interactions` - Always exists

### **Optional/Missing Tables** ⚠️
- Tables not in schema should be checked before operations
- Use `information_schema.tables` to verify existence

### **Revenue Analytics Requirements** 💰
- Use `order_items.unit_price * quantity` for revenue calculations
- `order_items.image_id` links to `image_catalog.id` 
- `captured_*` fields store cost tracking data when available

This structure allows for comprehensive business analytics while maintaining data integrity and supporting the multi-tenant partner system.