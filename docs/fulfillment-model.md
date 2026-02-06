# Multi-Fulfillment Product Model

## Overview

The Pawtraits fulfillment system supports two product purchase models:

1. **Digital-Only Products** (Entry Level)
   - Customer purchases only a digital download
   - No physical product shipped
   - Instant delivery after payment

2. **Physical Products** (Premium)
   - Customer purchases a physical print
   - **Automatically includes a bundled digital download**
   - Physical product fulfilled via Gelato (or other POD provider)
   - Digital download available immediately while print ships

## Database Schema

### Products Table

```sql
product_type: 'digital_download' | 'physical_print'
fulfillment_method: 'gelato' | 'manual' | 'prodigi' | 'download'
requires_shipping: boolean
```

**Examples:**
- Digital-only product: `product_type='digital_download'`, `requires_shipping=false`
- Physical product: `product_type='physical_print'`, `requires_shipping=true`

### Order Items Table

```sql
is_physical: boolean  -- Requires physical fulfillment (Gelato/POD)
is_digital: boolean   -- Includes digital download
```

**Examples:**
- Digital-only order item: `is_physical=false`, `is_digital=true`
- Physical order item: `is_physical=true`, `is_digital=true` (bundled!)

## Fulfillment Flow

### Scenario 1: Digital-Only Purchase

```
Customer buys digital download → Payment succeeds →
└─ DigitalDownloadService
   ├─ Generate signed Cloudinary URL
   ├─ Store download URL in order_items
   ├─ Send email with download link
   └─ Mark order as fulfilled
```

### Scenario 2: Physical Purchase (with bundled digital)

```
Customer buys physical print → Payment succeeds →
├─ GelatoFulfillmentService
│  ├─ Create Gelato print order
│  ├─ Store Gelato order ID
│  └─ Mark as processing
│
└─ DigitalDownloadService (runs in parallel)
   ├─ Generate signed Cloudinary URL
   ├─ Store download URL in order_items
   ├─ Send email with download link
   └─ Mark digital portion as fulfilled

Customer receives:
- Immediate: Digital download link via email
- Later: Physical print via shipping
```

### Scenario 3: Hybrid Cart

```
Customer buys:
- 1x Digital-only portrait (dog portrait)
- 1x Physical print (cat portrait)

Payment succeeds →
├─ DigitalDownloadService (processes BOTH items)
│  └─ Item 1: Digital-only dog portrait
│  └─ Item 2: Bundled digital for cat portrait
│
└─ GelatoFulfillmentService (processes ONLY physical)
   └─ Item 2: Physical cat portrait print

Result: Customer gets 2 immediate downloads, 1 physical print
```

## Service Capabilities

### DigitalDownloadService

**Can Fulfill:**
- ✅ Digital-only products (`product_type='digital_download'`)
- ✅ Physical products (`product_type='physical_print'`) - for bundled digital

**Logic:**
```typescript
canFulfill(orderItem: OrderItem): boolean {
  const productType = orderItem.product_data?.product_type;
  return productType === 'digital_download' ||
         productType === 'physical_print';
}
```

### GelatoFulfillmentService

**Can Fulfill:**
- ✅ Physical products only (`product_type='physical_print'`)
- ❌ Digital-only products

**Logic:**
```typescript
canFulfill(orderItem: OrderItem): boolean {
  const productType = orderItem.product_data?.product_type;
  return productType === 'physical_print' ||
         productType === undefined; // Legacy products
}
```

## FulfillmentRouter Behavior

The router groups items by service capability:

```typescript
// Example order: 1 digital-only, 1 physical
orderItems = [
  { product_type: 'digital_download' },     // Item 1
  { product_type: 'physical_print' }        // Item 2
]

// Grouped by service:
{
  'DigitalDownloadService': [Item 1, Item 2],  // Both items
  'GelatoFulfillmentService': [Item 2]         // Only physical
}
```

**Both services execute in parallel**, each processing their assigned items.

## Product Creation Guidelines

### Creating Digital-Only Products

```typescript
{
  product_type: 'digital_download',
  fulfillment_method: 'download',
  requires_shipping: false,
  digital_file_formats: ['jpg', 'png', 'pdf'],
  digital_resolution: 'high',
  price: 9.99  // Entry level pricing
}
```

### Creating Physical Products (with bundled digital)

```typescript
{
  product_type: 'physical_print',
  fulfillment_method: 'gelato',
  requires_shipping: true,
  gelato_sku: 'poster_18x24',
  // Digital download automatically included
  // No need to specify digital_* fields - uses defaults
  price: 29.99  // Premium pricing (includes both physical + digital)
}
```

## Customer Benefits

1. **Entry-Level Access**: Digital downloads at affordable price point
2. **Premium Value**: Physical purchases include "free" digital copy
3. **Instant Gratification**: Digital access while waiting for shipping
4. **Backup Copy**: Keep digital version even if physical gets damaged
5. **Multiple Use Cases**: Print at home, share digitally, order more later

## Business Benefits

1. **Upsell Path**: Digital customers can upgrade to physical later
2. **Higher Perceived Value**: Physical products include digital "for free"
3. **Reduced Support**: Customer has backup if physical delivery issues
4. **Marketing Tool**: Digital downloads can drive physical sales
5. **Flexible Pricing**: Separate digital/physical price points

## Technical Implementation Status

### ✅ Phase 1 Complete (Backend Infrastructure)
- Database schema migrations ready
- Service layer architecture implemented
- FulfillmentRouter with bundled digital support
- Stripe webhook integration updated
- Download API endpoint created

### 🚧 Phase 1 Remaining (UI Components)
- Digital product creation admin page
- Admin products list filters
- Customer downloads page
- Order detail pages (show digital + physical status)

### 📋 Phase 2 (Manual Fulfillment)
- Support for non-API POD providers
- Manual order processing workflow

### 📋 Phase 3 (Multi-Provider)
- Prodigi integration
- Provider selection logic
- Unified admin interface
