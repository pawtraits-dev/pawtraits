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


### Gelato ORDER API Doc

Use the Order create API to create an order in 1 request.

POST https://order.gelatoapis.com/v4/orders

Request example
$ curl -X POST \
   https://order.gelatoapis.com/v4/orders \
   -H 'Content-Type: application/json' \
   -H 'X-API-KEY: {{apiKey}}' \
   -d '{
        "orderType": "order",
        "orderReferenceId": "{{myOrderId}}",
        "customerReferenceId": "{{myCustomerId}}",
        "currency": "USD",
        "items": [
            {
                "itemReferenceId": "{{myItemId1}}",
                "productUid": "apparel_product_gca_t-shirt_gsc_crewneck_gcu_unisex_gqa_classic_gsi_s_gco_white_gpr_4-4",
                "files": [
                  {
                    "type": "default",
                    "url": "https://cdn-origin.gelato-api-dashboard.ie.live.gelato.tech/docs/sample-print-files/logo.png"
                  },
                  {
                    "type":"back",
                    "url": "https://cdn-origin.gelato-api-dashboard.ie.live.gelato.tech/docs/sample-print-files/logo.png"
                  }
                ],
                "quantity": 1
            }
        ],        
        "shipmentMethodUid": "express",
        "shippingAddress": {
            "companyName": "Example",
            "firstName": "Paul",
            "lastName": "Smith",
            "addressLine1": "451 Clarkson Ave",
            "addressLine2": "Brooklyn",
            "state": "NY",
            "city": "New York",
            "postCode": "11203",
            "country": "US",
            "email": "apisupport@gelato.com",
            "phone": "123456789"
        },
        "returnAddress": {
            "companyName": "My company",
            "addressLine1": "3333 Saint Marys Avenue",
            "addressLine2": "Brooklyn",
            "state": "NY",
            "city": "New York",
            "postCode": "13202",
            "country": "US",
            "email": "apisupport@gelato.com",
            "phone": "123456789"
        },
        "metadata": [
            {
                "key":"keyIdentifier1",
                "value":"keyValue1"
            },
            {
                "key":"keyIdentifier2",
                "value":"keyValue2"
            }
        ]
    }'
Response example
{
  "id": "37365096-6628-4538-a9c2-fbf9892deb85",
  "orderType": "order",
  "orderReferenceId": "{{myOrderId}}",
  "customerReferenceId": "{{myCustomerId}}",
  "fulfillmentStatus": "printed",
  "financialStatus": "paid",
  "currency": "USD",
  "channel": "api",
  "createdAt": "2021-01-14T12:30:03+00:00",
  "updatedAt": "2021-01-14T12:32:03+00:00",
  "orderedAt": "2021-01-14T12:32:03+00:00",
  "items": [
    {
      "id": "0549170c-bd7d-4d43-b7a1-34c855e6aefb",
      "itemReferenceId": "{{myItemId1}}",
      "productUid": "apparel_product_gca_t-shirt_gsc_crewneck_gcu_unisex_gqa_classic_gsi_s_gco_white_gpr_4-4",
      "files": [
        {
          "type": "default",
          "url": "https://cdn-origin.gelato-api-dashboard.ie.live.gelato.tech/docs/sample-print-files/logo.png"
        },
        {
          "type": "back",
          "url": "https://cdn-origin.gelato-api-dashboard.ie.live.gelato.tech/docs/sample-print-files/logo.png"
        }
      ],
      "processedFileUrl": "https://gelato-api-live.s3.eu-west-1.amazonaws.com/order/order_product_file/file_processed",
      "quantity": 1,
      "fulfillmentStatus": "printed",
      "previews": [
        {
          "type": "preview_default",
          "url": "https://gelato-api-live.s3.eu-west-1.amazonaws.com/order/order_product_file/preview_default"
        }
      ]
    }
  ],
  "metadata": [
    {
      "key": "keyIdentifier1",
      "value": "keyValue1"
    },
    {
      "key": "keyIdentifier2",
      "value": "keyValue2"
    }
  ],
  "shipment": {
    "id": "87cb3d74-de74-4bce-a682-e92f2652a4a2",
    "shipmentMethodName": "UPS Surepost",
    "shipmentMethodUid": "ups_surepost",
    "minDeliveryDays": 6,
    "maxDeliveryDays": 7,
    "minDeliveryDate": "2019-08-29",
    "maxDeliveryDate": "2019-08-30",
    "totalWeight": 613,
    "fulfillmentCountry": "US",
    "packagesCount": 1,
    "packages": [
      {
        "id": "4a771ca0-7de4-4f0b-a7d4-9c952093af6c",
        "orderItemIds": [
          "0549170c-bd7d-4d43-b7a1-34c855e6aefb",
          "13c165fe-de51-4ea9-86e6-98503ae14486"
        ],
        "trackingCode": "12345678990",
        "trackingUrl": "http://test.tracking.url"
      }
    ]
  },
  "billingEntity": {
    "id": "87cb3d74-de74-4bce-a682-e92f2652a4a2",
    "companyName": "Example",
    "companyNumber": "Example Number",
    "companyVatNumber": "Example VAT1234567890",
    "country": "US",
    "recipientName": "Paul Smith",
    "addressLine1": "451 Clarkson Ave",
    "addressLine2": "Brooklyn",
    "city": "New York",
    "postCode": "11203",
    "state": "NY",
    "email": "apisupport@gelato.com",
    "phone": "123456789"
  },
  "shippingAddress": {
    "id": "d6bcf17f-3a48-4ec8-888e-70766ae8b56a",
    "orderId": "37365096-6628-4538-a9c2-fbf9892deb85",
    "country": "US",
    "firstName": "Paul",
    "lastName": "Smith",
    "companyName": "Example",
    "addressLine1": "451 Clarkson Ave",
    "addressLine2": "Brooklyn",
    "city": "New York",
    "postCode": "11203",
    "state": "NY",
    "email": "apisupport@gelato.com",
    "phone": "123456789"
  },
  "returnAddress": {
    "id": "d6bcf17f-3a48-4ec8-888e-70766ae8b56b",
    "orderId": "37365096-6628-4538-a9c2-fbf9892deb85",
    "lastName": "Draker",
    "addressLine1": "3333 Saint Marys Avenue",
    "addressLine2": "Brooklyn",
    "state": "NY",
    "city": "New York",
    "postCode": "13202",
    "country": "US",
    "email": "apisupport@gelato.com",
    "phone": "123456789"
  },
  "receipts": [
    {
      "id": "c74447e5-c543-4baf-8239-3620422b8d81",
      "orderId": "37365096-6628-4538-a9c2-fbf9892deb85",
      "transactionType": "purchase",
      "currency": "USD",
      "items": [
        {
          "id": "b65bb8f3-c2a3-425e-a366-7e19c32c93e2",
          "receiptId": "c74447e5-c543-4baf-8239-3620422b8d81",
          "referenceId": "0549170c-bd7d-4d43-b7a1-34c855e6aefb",
          "type": "product",
          "title": "cards_pf_bx_pt_110-lb-cover-uncoated_cl_4-4_hor",
          "currency": "USD",
          "priceBase": 12.47,
          "amount": 1,
          "priceInitial": 12.47,
          "discount": 0,
          "price": 12.47,
          "vat": 0.75,
          "priceInclVat": 13.22,
          "createdAt": "2021-01-14T12:30:03+00:00",
          "updatedAt": "2021-01-14T12:32:03+00:00"
        },
        {
          "id": "3126e362-8369-4900-bcd3-6990d373b69c",
          "receiptId": "c74447e5-c543-4baf-8239-3620422b8d81",
          "referenceId": "13c165fe-de51-4ea9-86e6-98503ae14486",
          "type": "product",
          "title": "cards_pf_bx_pt_110-lb-cover-uncoated_cl_4-4_hor",
          "currency": "USD",
          "priceBase": 12.47,
          "amount": 1,
          "priceInitial": 12.47,
          "discount": 0,
          "price": 12.47,
          "vat": 0.75,
          "priceInclVat": 13.22,
          "createdAt": "2021-01-14T12:30:03+00:00",
          "updatedAt": "2021-01-14T12:32:03+00:00"
        },
        {
          "id": "762f3563-ff24-4d4e-b6c7-fee19bfc878b",
          "receiptId": "c74447e5-c543-4baf-8239-3620422b8d81",
          "referenceId": "87cb3d74-de74-4bce-a682-e92f2652a4a2",
          "type": "shipment",
          "title": "Delivery using SmartPost",
          "currency": "USD",
          "priceBase": 4.91,
          "amount": 1,
          "priceInitial": 4.91,
          "discount": 0,
          "price": 4.91,
          "vat": 0.3,
          "priceInclVat": 5.21,
          "createdAt": "2021-01-14T12:30:03+00:00",
          "updatedAt": "2021-01-14T12:32:03+00:00"
        },
        {
          "id": "bb4c9eee-91a0-44a1-8ee0-a3cef29820f1",
          "receiptId": "c74447e5-c543-4baf-8239-3620422b8d81",
          "referenceId": "87cb3d74-de74-4bce-a682-e92f2652a4a2",
          "type": "packaging",
          "title": "Packaging",
          "currency": "USD",
          "priceBase": 1.7,
          "amount": 1,
          "priceInitial": 1.7,
          "discount": 0,
          "price": 1.7,
          "vat": 0.1,
          "priceInclVat": 1.8,
          "createdAt": "2021-01-14T12:30:03+00:00",
          "updatedAt": "2021-01-14T12:32:03+00:00"
        }
      ],
      "productsPriceInitial": 24.94,
      "productsPriceDiscount": 0,
      "productsPrice": 24.94,
      "productsPriceVat": 1.5,
      "productsPriceInclVat": 26.44,
      "packagingPriceInitial": 1.7,
      "packagingPriceDiscount": 0,
      "packagingPrice": 1.7,
      "packagingPriceVat": 0.1,
      "packagingPriceInclVat": 1.8,
      "shippingPriceInitial": 4.91,
      "shippingPriceDiscount": 0,
      "shippingPrice": 4.91,
      "shippingPriceVat": 0.3,
      "shippingPriceInclVat": 5.21,
      "discount": 0,
      "discountVat": 0,
      "discountInclVat": 0,
      "totalInitial": 31.55,
      "total": 31.55,
      "totalVat": 1.9,
      "totalInclVat": 33.45
    }
  ]
}
Request
Parameter	Type	Description
orderType (optional)	string	Type of the order. Draft orders can be edited from the dashboard and they don't go into production until you decide to convert draft into a regular order via UI or programmatically via Order Patch API. It can be order or draft.
Default value: order.
orderReferenceId (required)	string	Reference to your internal order id.
customerReferenceId (required)	string	Reference to your internal customer id.
currency (required)	string	Currency iso code in ISO 4217 standard. Currency that the order should be charged in.
Supported currencies: EUR, USD, JPY, BGN, CZK, DKK, GBP, HUF, PLN, RON, SEK, CHF, ISK, NOK, HRK, RUB, TRY, AUD, BRL, CAD, CNY, HKD, IDR, ILS, INR, KRW, MXN, MYR, NZD, PHP, SGD, THB, ZAR, CLP, AED
Note: It is applicable only for customers using wallets or credit cards for payments.
items (required)	ItemObject[]	A list of line item objects, each containing information about an item in the order.
metadata (optional)	MetadataObject[]	A list of key value pair objects used for storing additional, structured information on an order. (Max number of entries: 20).
shippingAddress (required)	ShippingAddressObject	Shipping address information.
shipmentMethodUid (optional)	string	This parameter specifies the preferred shipping method identifier. It accepts values such as normal, standard, express, or a shipmentMethodUid value returned in the Quote API call response. You can also pass multiple values separated by commas. If multiple values are passed, the cheapest matching shipping method will be chosen by default. If no value is provided, the system will select the cheapest available shipping method.
returnAddress (optional)	ReturnAddressObject	Return address information.
ItemObject

Parameter	Type	Description
itemReferenceId (required)	string	Reference to your internal order item id. Must be unique within your order.
productUid (required)	string	Type of printing product in product uid format.
pageCount (optional)	integer	The page count for multipage products. This parameter is only needed for multi-page products. All pages in the product, including front and back cover are included in the count. For example for a Wire-o Notebook there are 112 inner pages (56 leaves), 2 front (outer and inside) and 2 back cover (outer and inside) pages, total 116 pages. The pageCount is 116. Read more
files (optional)	File[]	Files that would be used to generate product file. Files are required for printable products only. Supported file formats are: PDF, PNG, TIFF, SVG and JPEG. For PDF files, please use one of the compatible PDF/X standards, for example in PDF/X-1a:2003 or PDF/X-4 standard.
quantity (required)	integer	The product quantity. Defines how many copies of product should be printed. The minimum value is 1
adjustProductUidByFileTypes (optional)	bool	If true, the productUid will automatically be adjusted based on the file types submitted.
File

Parameter	Type	Description
id (optional)	string	When you order an embroidery product, the submitted files are assigned a unique ID. This ID enables you to easily reuse the file, ultimately helping you cut down on digitization costs.
type (conditional)	FileType	Defines print area where file is supposed to fill. The field is required for Embroidery. For DTG, the default value is "default".
url (conditional)	string	A URL from where the file can be downloaded. This field is optional, if a valid ID is provided.
threadColors (optional)	string[]	This list contains hex color codes specifically for embroidery products. You can input up to six colors. If no colors are specified, a default palette will be applied, limiting the design to 6 colors.

See supported colors.
isVisible (optional)	bool	Indicates whether or not this file should appear in the list of Files in the dashboard. It only applies if an Embroidery product is ordered.
FileType

Parameter	Description
default	The design is printed on the primary area of the product. For apparel, it is the front, while for folded cards, it is the cover+back pages.

If you provide a multipage PDF, the number of pages should match the print areas as it will be used to print on all of them.

Note: that for apparel, only DTG production is supported for the default type.
front	Print the file on the front of the product.
back	Print the file on the back of the product.
neck-inner	Print the file on the inner neck of the apparel product.
neck-outer	Print the file on the outer neck of the apparel product.
sleeve-left	Print the file on the left sleeve of the apparel product.
sleeve-right	Print the file on the right sleeve of the apparel product.
inside	Print the file on the inner pages of folded cards.
chest-left-embroidery	Embroider the file on the left chest of the apparel product.
chest-center-embroidery	Embroider the file on the center chest of the apparel product.
chest-large-embroidery	Embroider the file on the front of the apparel product.
sleeve-left-embroidery	Embroider the file on the left sleeve of the apparel product.
sleeve-right-embroidery	Embroider the file on the right sleeve of the apparel product.
wrist-left-embroidery	Embroider the file on the left wrist of the apparel product.
wrist-right-embroidery	Embroider the file on the right wrist of the apparel product.
MetadataObject

Parameter	Type	Description
key (required)	string	A reference value to identify the metadata entry. (Max character length: 100)
value (required)	string	The value assigned to the metadata entry. (Max character length: 100)
ShippingAddressObject

Please note that addresses for China (CN), Japan (JP), South Korea (KR) and Russia (RU) must be entered in local language due to shipping providers' requirements. Please see detailed requirements by field below

Parameter	Type	Description
firstName (required)	string	The first name of the recipient at this address.
Maximum length is 25 characters. It can be any symbol or character.
lastName (required)	string	The last name of the recipient at this address.
Maximum length is 25 characters. It can be any symbol or character.
companyName (optional)	string	The company name of the recipient at this address.
Maximum length is 60 characters. It can be any symbol or character.
addressLine1 (required)	string	The first line of the address. For example, number, street, and so on.
Maximum length is 35 characters. It must be in local language for Russia (RU), China (CN), Japan (JP) and South Korea (KR) and up to 10 Latin characters are allowed.
addressLine2 (optional)	string	The second line of the address. For example, suite or apartment number.
Maximum length is 35 characters. It must be in local language for Russia (RU), China (CN), Japan (JP) and South Korea (KR) and up to 10 Latin characters are allowed.
city (required)	string	The city name.
Maximum length is 30 characters. It must be in local language for Russia (RU), China (CN), Japan (JP) and South Korea (KR).
postCode (required)	string	The postal code, which is the zip code or equivalent. Typically required for countries with a postal code or an equivalent. See postal code.
Maximum length is 15 characters
state (optional)	string	The code for a US state or the equivalent for other countries. Required for requests if the address is in one of these countries: Australia, Canada or United States.
Maximum length is 35 characters. See list of state codes
country (required)	string	The two-character ISO 3166-1 code that identifies the country or region. Please note: the country code for United Kingdom is GB and not UK as used in the top-level domain names for that country.
Pattern: ^[A-Z]{2}$
email (required)	string	The email address for the recipient.
Pattern: .+@["-].+$
phone (optional)	string	The phone number, in E.123 format.
Maximum length is 25 characters
isBusiness (optional)	bool	Boolean value, declares the recipient being a business. Use if tax for recipient country is different for private and business customers (e.g. in Brazil) to change federalTaxId field type. Mandatory for Brazil if recipient is a company.
federalTaxId (optional)	string	The Federal Tax identification number of recipient. Use to provide CPF/CNPJ of a Brazilian recipient. Mandatory for Brazil. In order to supply CNPJ instead of CPF, set isBusiness field to true.
stateTaxId (optional)	string	The State Tax identification number of recipient. Use to provide IE of a Brazilian recipient. Mandatory for Brazil if recipient is a company. In order to supply this field, set isBusiness field to true.
registrationStateCode (optional)	string	The code number for a US state or the equivalent for other countries that defines state where recipient company is registered. Mandatory for Brazil if recipient is a company. In order to supply this field, set isBusiness field to true.
ReturnAddressObject

Return address object allows overriding one or multiple fields within sender address of the parcel.

Parameter	Type	Description
companyName (optional)	string	The company name of the recipient at return address.
Maximum length is 60 characters. It can be any symbol or character.
addressLine1 (optional)	string	The first line of the address. For example, number, street, and so on.
Maximum length is 35 characters.
addressLine2 (optional)	string	The second line of the address. For example, suite or apartment number.
Maximum length is 35 characters.
city (optional)	string	The city name.
Maximum length is 30 characters.
postCode (optional)	string	The postal code, which is the zip code or equivalent. See postal code.
Maximum length is 15 characters
state (optional)	string	The code for a US state or the equivalent for other countries. Required for requests if the address is in one of these countries: Australia, Canada or United States.
Maximum length is 35 characters. See list of state codes
country (optional)	string	The two-character ISO 3166-1 code that identifies the country or region. Please note: the country code for United Kingdom is GB and not UK as used in the top-level domain names for that country.
Pattern: ^[A-Z]{2}$
email (optional)	string	The email address for the recipient.
Pattern: .+@["-].+$
phone (optional)	string	The phone number, in E.123 format.
Maximum length is 25 characters
Response
Response has the same structure as on Order Get API

Gives a list of available catalogs

GET https://product.gelatoapis.com/v3/catalogs

Request example
$  curl -X GET https://product.gelatoapis.com/v3/catalogs \
    -H 'X-API-KEY: {{apiKey}}'
Response example
[
    {
        "catalogUid": "cards",
        "title": "cards"
    },
    {
        "catalogUid": "posters",
        "title": "Posters"
    },
    {
        "catalogUid": "multipage-brochures",
        "title": "Multipage Brochures"
    }
]
Response parameters
Response is a collection Catalog objects.

Catalog parameters

Parameter	Type	Description
catalogUid (required)	string	Catalog unique identifier.
title (required)	string	Title of the catalog.


Get catalog
Get information about a specific catalog. Includes a catalogs attributes which defines the products stored inside of the catalog.

GET https://product.gelatoapis.com/v3/catalogs/{{catalogUid}}

Request example
$ curl -X GET "https://product.gelatoapis.com/v3/catalogs/posters" \
    -H 'X-API-KEY: {{apiKey}}'
Response example
{
  "catalogUid": "posters",
  "title": "Posters",
  "productAttributes": [
    {
      "productAttributeUid": "Orientation",
      "title": "Orientation",
      "values": [
        {
          "productAttributeValueUid": "hor",
          "title": "Landscape"
        },
        {
          "productAttributeValueUid": "ver",
          "title": "Portrait"
        }
      ]
    },
    {
      "productAttributeUid": "PaperFormat",
      "title": "Paper Format",
      "values": [
        {
          "productAttributeValueUid": "A1",
          "title": "A1"
        },
        {
          "productAttributeValueUid": "A2",
          "title": "A2"
        },
        {
          "productAttributeValueUid": "A3",
          "title": "A3"
        }
      ]
    }
  ]
}
Query Parameters
Parameter	Type	Description
catalogUid (required)	string	Catalog unique identifier. Value be taken as catalogUidfield in Catalog list API call.
Response Parameters
Parameter	Type	Description
catalogUid (required)	string	Catalog unique identifier.
title (required)	string	Title of the catalog.
productAttributes (required)	ProductAttribute[]	Array of product attributes and their possible values. All products in the catalog are defined by these attributes.
ProductAttribute parameters

Parameter	Type	Description
productAttributeUid (required)	string	Attribute unique identifier.
title (required)	string	Attribute title.
values (required)	ProductAttributeValue[]	Array of possible values for the attribute.
ProductAttributeValue parameters

Parameter	Type	Description
productAttributeValueUid (required)	string	Attribute value unique identifier.
title (required)	string	Attribute title.