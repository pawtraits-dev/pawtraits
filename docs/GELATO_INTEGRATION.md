# Gelato Print-on-Demand Integration

This document outlines the complete Gelato integration for automatic print fulfillment.

## Overview

When customers complete a Stripe checkout, the system automatically:
1. **Creates order in database** (via Stripe webhook)
2. **Submits order to Gelato** for print fulfillment
3. **Tracks order status** via Gelato webhooks
4. **Updates customers** on shipping and delivery

## Architecture

```
Customer Payment (Stripe) 
    ↓
Stripe Webhook → Database Order → Gelato Order
    ↓                              ↓
Order Confirmation              Print & Ship
    ↓                              ↓
Gelato Webhook ← Order Updates ← Gelato API
    ↓
Customer Notifications
```

## Setup Requirements

### 1. Gelato Account Setup
- Sign up at [Gelato Developer Portal](https://developers.gelato.com/)
- Get API key from dashboard
- Configure webhook endpoint: `https://yourdomain.com/api/webhooks/gelato`

### 2. Environment Variables
```bash
# Required
GELATO_API_KEY=gto_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
GELATO_API_BASE_URL=https://api.gelato.com
GELATO_WEBHOOK_SECRET=your_webhook_secret

# Optional
GELATO_ENVIRONMENT=sandbox # or production
```

### 3. Database Schema
Run the schema update:
```sql
\i scripts/gelato-integration-schema.sql
```

## Key Components

### GelatoService (`lib/gelato-service.ts`)
Main service class handling:
- **Product catalog** queries
- **Order creation** and tracking
- **Image URL generation** for print quality
- **Data mapping** between our format and Gelato's

### Stripe Webhook Integration
Enhanced webhook (`app/api/webhooks/stripe/route.ts`) now:
- Creates Gelato orders automatically
- Stores order items with print specifications
- Handles fulfillment errors gracefully

### Gelato Webhook Handler (`app/api/webhooks/gelato/route.ts`)
Processes Gelato status updates:
- `order.confirmed` → Update status to "processing"
- `order.production` → Update status to "printing"
- `order.shipped` → Update status + tracking info
- `order.delivered` → Mark as delivered
- `order.cancelled/failed` → Handle errors

## Order Flow

### 1. Customer Checkout
1. Customer completes Stripe payment
2. Stripe webhook creates database order
3. System extracts cart items from payment metadata
4. High-quality print images generated via Cloudinary
5. Gelato order created with print specifications

### 2. Print Fulfillment
```javascript
// Example Gelato order structure
{
  externalId: "PW-1234567-abc123",
  shippingAddress: {
    firstName: "John",
    lastName: "Doe", 
    address1: "123 Main St",
    city: "London",
    postalCode: "SW1A 1AA",
    country: "GB",
    email: "john@example.com"
  },
  items: [{
    productUid: "premium-canvas-prints_premium-canvas-portrait-210gsm",
    variantUid: "30x30-cm",
    quantity: 1,
    printFileUrl: "https://res.cloudinary.com/.../high-res-image.jpg"
  }],
  currency: "GBP"
}
```

### 3. Status Tracking
Orders progress through statuses:
- `confirmed` → Payment received, order created
- `processing` → Gelato confirmed order
- `printing` → Order in production
- `shipped` → Package sent with tracking
- `delivered` → Customer received order

## Product Mapping

### Medium Types → Gelato Products
```javascript
const productMapping = {
  'Canvas': 'premium-canvas-prints_premium-canvas-portrait-210gsm',
  'Paper/Poster': 'premium-posters_premium-poster-portrait-210gsm', 
  'Metal': 'metal-prints_metal-print-white-base',
  'Acrylic': 'acrylic-prints_acrylic-print-3mm'
};
```

### Size Mapping → Gelato Variants
```javascript
const sizeMapping = {
  '20x20cm': '20x20-cm',
  '30x30cm': '30x30-cm', 
  '40x40cm': '40x40-cm',
  '20x30cm': '20x30-cm',
  '30x40cm': '30x40-cm',
  '40x60cm': '40x60-cm'
};
```

## Image Quality Requirements

### Print Resolution
- **300 DPI minimum** for professional quality
- **sRGB color profile** for optimal printing
- **PNG/JPEG formats** supported

### Size Calculations
```javascript
// For 30x30cm at 300 DPI:
const pixelWidth = Math.ceil((30 / 2.54) * 300); // 3543 pixels
const pixelHeight = Math.ceil((30 / 2.54) * 300); // 3543 pixels
```

### Cloudinary Transformation
```javascript
const transformation = [
  `w_${pixelWidth}`,
  `h_${pixelHeight}`, 
  'c_fill',
  'f_auto',
  'q_auto:best',
  'dpr_1.0'
].join(',');
```

## Testing

### Test Gelato Integration
```bash
# Test API connection
curl "https://yourdomain.com/api/admin/test-gelato?action=products"

# Test product details
curl "https://yourdomain.com/api/admin/test-gelato?action=product&uid=premium-canvas-prints_premium-canvas-portrait-210gsm"

# Test shipping methods
curl "https://yourdomain.com/api/admin/test-gelato?action=shipping&country=GB"

# Test image URL generation  
curl "https://yourdomain.com/api/admin/test-gelato?action=image-url&imageId=test&width=30&height=30"
```

### Sandbox Testing
```bash
# Create test order (sandbox only!)
curl "https://yourdomain.com/api/admin/test-gelato?action=test-order"
```

## Error Handling

### Gelato Order Creation Fails
- Order status set to `fulfillment_error`
- Error message stored in database
- Admin notification sent
- Customer shown generic "processing" message

### Webhook Processing Fails  
- Failed webhooks logged in `gelato_webhooks` table
- Automatic retry mechanism (TODO)
- Manual intervention dashboard (TODO)

## Partner Orders

Partner orders include additional metadata:
```javascript
{
  metadata: {
    isPartnerOrder: 'true',
    partnerDiscount: '1500', // 15% in pence
    businessName: 'Pet Grooming Co',
    clientName: 'Client Name', // if order is for client
    clientEmail: 'client@example.com'
  }
}
```

## Monitoring & Analytics

### Key Metrics to Track
- **Order conversion rate** (Stripe → Gelato)
- **Fulfillment success rate** 
- **Average delivery time**
- **Error rates by product type**
- **Customer satisfaction** post-delivery

### Database Queries
```sql
-- Orders by status
SELECT status, gelato_status, COUNT(*) 
FROM orders 
WHERE created_at > now() - interval '30 days'
GROUP BY status, gelato_status;

-- Average delivery time
SELECT AVG(delivered_at - created_at) as avg_delivery_time
FROM orders 
WHERE delivered_at IS NOT NULL;

-- Error analysis
SELECT error_message, COUNT(*)
FROM orders 
WHERE status = 'fulfillment_error'
GROUP BY error_message;
```

## Future Enhancements

### Phase 2 Features
- [ ] **Inventory management** integration
- [ ] **Bulk order processing** for large orders
- [ ] **Custom packaging** options
- [ ] **Multi-location fulfillment** optimization

### Phase 3 Features
- [ ] **Real-time inventory** checking
- [ ] **Dynamic pricing** based on Gelato costs
- [ ] **Quality assurance** photo approvals
- [ ] **Customer returns** processing

## Troubleshooting

### Common Issues

**"Gelato API key not found"**
- Check `GELATO_API_KEY` environment variable
- Verify API key format: `gto_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`

**"Product UID not found"**
- Check product mapping in `mapProductToGelatoUID()`
- Verify Gelato catalog has required products

**"Invalid image URL"**
- Ensure Cloudinary is configured
- Check image exists in catalog
- Verify URL accessibility from Gelato servers

**"Webhook signature verification failed"**
- Check `GELATO_WEBHOOK_SECRET` configuration
- Verify webhook endpoint URL in Gelato dashboard

### Support Contacts
- **Gelato Support**: developers@gelato.com
- **API Documentation**: https://developers.gelato.com/docs
- **Status Page**: https://status.gelato.com