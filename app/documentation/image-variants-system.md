# Image Variants System

## Overview

The Pawtraits application uses Cloudinary to generate and serve multiple variants of each pet portrait image, with different sizes, quality levels, and overlay protections based on usage and access rights.

## Variant Types

| Variant | Use Case | Quality | Overlay | Access Control |
|---------|----------|---------|---------|----------------|
| **Original** | Print fulfillment | 300 DPI | None | Print service only |
| **Download** | Customer download after purchase | 300 DPI | Brand overlay (bottom right) | Signed URL after purchase |
| **Full Size** | Detail page/modal views | High quality | Watermark (center) | Public |
| **Thumbnail** | Cart items, small previews | 150x150px | None | Public |
| **Mid Size** | Shop catalog cards | 400x500px | None | Public |
| **Social Media** | Social sharing after purchase | Optimized sizes | Brand overlay | Authenticated after purchase |

## Security Model

### Access Levels

1. **Public Access**: No authentication required
   - Thumbnail: Small, no overlay
   - Mid Size: Medium, no overlay  
   - Full Size: Large with watermark protection

2. **Authenticated Access**: Requires user login and purchase verification
   - Download: High quality with brand overlay
   - Social Media: Multiple formats with brand overlay

3. **Print Fulfillment Only**: Highest security
   - Original: No overlay, maximum quality, restricted to print services

### Protection Strategy

- **Watermarks**: Center overlay on public full-size images prevents unauthorized use
- **Brand Overlays**: Bottom-right brand logo on download/social variants provides attribution
- **Signed URLs**: Time-limited authenticated access for premium variants
- **Size Limiting**: Public variants are size-restricted to prevent high-quality theft

## Implementation

### Environment Variables

```bash
# Cloudinary Overlays
CLOUDINARY_WATERMARK_PUBLIC_ID=pawtraits_watermark_logo
CLOUDINARY_WATERMARK_OPACITY=60
CLOUDINARY_BRAND_LOGO_PUBLIC_ID=pawtraits_brand_logo
```

### API Endpoints

#### Get Image Variant
```
GET /api/images/{id}?variant={type}&userId={id}&orderId={id}
```

**Public Variants** (no auth required):
- `variant=thumbnail` - 150x150px, no overlay
- `variant=mid_size` - 400x500px, no overlay  
- `variant=full_size` - 1200x1500px, watermarked

**Authenticated Variants** (requires userId + orderId):
- `variant=download` - 300 DPI, brand overlay
- `variant=social_media_post` - Multiple formats, brand overlay

**Print Fulfillment** (requires orderId):
- `variant=original` - 300 DPI, no overlay

### React Components

#### Basic Image Display
```tsx
import { SecureImageDisplay } from '@/components/SecureImageDisplay';

// Thumbnail in cart
<SecureImageDisplay 
  imageId="uuid" 
  variant="thumbnail" 
  alt="Pet portrait" 
/>

// Detail modal
<SecureImageDisplay 
  imageId="uuid" 
  variant="full_size" 
  alt="Pet portrait" 
/>
```

#### Convenience Components
```tsx
import { ThumbnailImage, CardImage, DetailImage } from '@/components/SecureImageDisplay';

<ThumbnailImage imageId="uuid" alt="Pet portrait" />
<CardImage imageId="uuid" alt="Pet portrait" />  
<DetailImage imageId="uuid" alt="Pet portrait" />
```

#### Purchased Content
```tsx
import { PurchasedDownload, SocialMediaShare } from '@/components/SecureImageDisplay';

<PurchasedDownload 
  imageId="uuid" 
  userId="user-uuid"
  orderId="order-uuid"
  alt="Pet portrait" 
/>

<SocialMediaShare 
  imageId="uuid"
  userId="user-uuid" 
  orderId="order-uuid"
  alt="Pet portrait"
/>
```

### Database Integration

The `get_user_cart()` function automatically serves appropriate variants:

```sql
-- Cart function uses thumbnail variants for optimal display
COALESCE(
    ic.image_variants->'thumbnail'->>'url',
    ic.image_variants->'mid_size'->>'url', 
    ci.image_url
) as image_url
```

## Setup Instructions

### 1. Upload Brand Assets

```bash
# Upload watermark (for public variants)
npx tsx scripts/test-watermark.ts

# Upload brand logo (for download/social variants)  
npx tsx scripts/upload-brand-logo.ts
```

### 2. Update Database Function

```bash
# Apply updated cart function
# Execute scripts/fix-cart-watermark-function.sql in Supabase
```

### 3. Migrate Existing Images

```bash
# Run Cloudinary migration to generate new variants
npx tsx scripts/migrate-to-cloudinary.ts
```

## Variant Specifications

### Original (Print Fulfillment)
- **Format**: PNG
- **Quality**: 100% 
- **DPI**: 300
- **Overlay**: None
- **Access**: Print fulfillment service only
- **URL**: Signed with 1-hour expiry

### Download (Customer Purchase)
- **Format**: PNG
- **Quality**: 100%
- **DPI**: 300  
- **Overlay**: Brand logo (bottom-right, 80% opacity)
- **Access**: Authenticated customers with verified purchase
- **URL**: Signed with 1-hour expiry

### Full Size (Detail Views)
- **Size**: 1200x1500px
- **Quality**: 85%
- **Format**: Auto-optimized
- **Overlay**: Watermark (center, 60% opacity)
- **Access**: Public
- **URL**: Standard Cloudinary URL

### Thumbnail (Cart/Previews)  
- **Size**: 150x150px
- **Quality**: 80%
- **Format**: Auto-optimized
- **Overlay**: None
- **Access**: Public
- **URL**: Standard Cloudinary URL

### Mid Size (Catalog Cards)
- **Size**: 400x500px  
- **Quality**: 85%
- **Format**: Auto-optimized
- **Overlay**: None
- **Access**: Public
- **URL**: Standard Cloudinary URL

### Social Media (Post-Purchase Sharing)
Multiple formats with brand overlay:

- **Instagram Post**: 1080x1080px, JPG, brand overlay
- **Instagram Story**: 1080x1920px, JPG, brand overlay  
- **Facebook Post**: 1200x630px, JPG, brand overlay
- **Twitter Card**: 1200x675px, JPG, brand overlay

All social formats:
- **Quality**: 85%
- **Overlay**: Brand logo (bottom-right, 90% opacity)
- **Access**: Authenticated customers with verified purchase

## Error Handling

The system gracefully handles various error scenarios:

1. **Missing Cloudinary Assets**: Falls back to stored URLs
2. **Authentication Failures**: Returns appropriate HTTP status codes
3. **Missing Variants**: Generates URLs dynamically using Cloudinary service
4. **Network Issues**: Shows loading states and error messages in UI

## Best Practices

### Frontend Usage

1. **Use appropriate variants**: Thumbnail for lists, mid-size for cards, full-size for modals
2. **Handle loading states**: Components include built-in loading indicators
3. **Provide fallbacks**: Always include alt text and fallback URLs
4. **Respect access control**: Don't attempt to access authenticated variants without proper credentials

### Backend Security

1. **Verify purchases**: Always validate user ownership before serving premium variants
2. **Use signed URLs**: For sensitive content, use time-limited signed URLs
3. **Log access attempts**: Monitor for unauthorized access attempts
4. **Rate limiting**: Consider implementing rate limiting for variant API endpoints

## Testing

Test the complete variant system:

```bash
# Test watermark upload
npx tsx scripts/test-watermark.ts

# Test brand logo upload  
npx tsx scripts/upload-brand-logo.ts

# Test Cloudinary integration
npx tsx scripts/test-cloudinary.ts
```

Verify in browser:
1. Shop page should show mid-size variants (no overlay)
2. Cart should show thumbnail variants (no overlay)  
3. Detail modals should show full-size variants (watermarked)
4. Download links should require authentication
5. Social sharing should require purchase verification