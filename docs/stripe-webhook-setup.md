# Stripe Webhook Configuration

## Overview

The Pawtraits application uses Stripe webhooks to handle two distinct payment flows:
1. **Print Orders** - Physical products (canvas, paper, etc.) via Gelato
2. **Credit Pack Purchases** - Digital customization credits

## Webhook Endpoint

**Production URL**: `https://www.pawtraits.pics/api/webhooks/stripe`

## Required Events

Configure your Stripe webhook to listen for these events:

### For Print Orders
- ✅ `payment_intent.succeeded` - Creates order, sends to Gelato, handles commissions
- ✅ `payment_intent.payment_failed` - Logs failed payment attempts
- ✅ `payment_intent.canceled` - Tracks cancellations
- ⚠️  `charge.dispute.created` - Handles payment disputes

### For Credit Pack Purchases (CRITICAL)
- ✅ `checkout.session.completed` - **MUST BE ENABLED** - Adds credits, sends confirmation email

## Setup Instructions

1. **Login to Stripe Dashboard**
   - Go to: https://dashboard.stripe.com/

2. **Navigate to Webhooks**
   - Click: Developers → Webhooks

3. **Add/Edit Webhook Endpoint**
   - Endpoint URL: `https://www.pawtraits.pics/api/webhooks/stripe`
   - Select events to listen to:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `payment_intent.canceled`
     - `charge.dispute.created`
     - **`checkout.session.completed`** ← Most important for credits

4. **Save Webhook Secret**
   - Copy the webhook signing secret
   - Add to Vercel environment variables:
     ```
     STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
     ```

## Event Flow

### Credit Pack Purchase Flow
```
Customer clicks "Purchase Credits"
    ↓
Stripe Checkout Session Created (mode: payment)
    ↓
Customer completes payment
    ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TWO webhooks fire (in this order):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ↓
1. payment_intent.succeeded
   - Has purchaseType='customization_credits' in metadata
   - Logs info message
   - SKIPS order creation
   - Returns early
    ↓
2. checkout.session.completed
   - Has full metadata with packId, credits, etc.
   - Calls add_customization_credits() function
   - Adds order credit bonus
   - Sends confirmation email
   - Customer receives credits
```

### Print Order Flow
```
Customer checks out with physical prints
    ↓
Payment Intent Created (with shipping metadata)
    ↓
Customer completes payment
    ↓
payment_intent.succeeded fires
    - Has orderType and shippingAddress metadata
    - Creates order record
    - Creates Gelato order
    - Handles commissions/referrals
    - Sends order confirmation email
```

## Troubleshooting

### Credits Not Being Added

**Symptom**: Customer pays but credits don't appear

**Check**:
1. Is `checkout.session.completed` enabled in Stripe webhook?
2. Check Vercel logs for:
   ```
   🎫 Checkout Session Completed: { ... }
   ```
3. If you only see:
   ```
   💳 Payment Intent Succeeded: { ... }
   ℹ️  Credit pack purchase detected - will be handled by checkout.session.completed
   ```
   Then the session.completed event is not firing or not configured.

**Solution**: Add `checkout.session.completed` to your Stripe webhook events

### False Success Messages

**Symptom**: Logs say "✅ Order created successfully" but no credits added

**This was fixed in commit 9ee5221**. The webhook now:
- Detects credit purchases via `purchaseType` metadata
- Returns early with info log
- Waits for `checkout.session.completed` to handle credits

### Payment Intent Has No Metadata

**Symptom**: `metadataKeys: []` in logs

**Cause**: Metadata not passed from checkout session to payment intent

**Solution**: Ensure `payment_intent_data.metadata` is set in checkout session creation (fixed in commit 9ee5221)

## Testing

### Test Credit Purchase Flow

1. **Make test purchase** with Stripe test card: `4242 4242 4242 4242`

2. **Check Vercel logs** for both events:
   ```
   💳 Payment Intent Succeeded:
   {
     purchaseType: 'customization_credits',
     hasShippingData: false,
     metadataKeys: ['purchaseType', 'customerId', 'customerEmail']
   }
   ℹ️  Credit pack purchase detected - will be handled by checkout.session.completed event

   🎫 Checkout Session Completed:
   {
     purchaseType: 'customization_credits',
     metadataKeys: ['purchaseType', 'customerId', 'customerEmail', 'packId', 'credits', 'orderCreditAmount', 'pricePaid']
   }
   ✅ Customization credits added successfully
   📧 Preparing credit pack purchase email...
   ✅ Credit pack purchase email queued successfully
   ```

3. **Verify in database**:
   ```sql
   SELECT * FROM customer_customization_credits
   WHERE customer_id = 'YOUR_CUSTOMER_ID';

   SELECT * FROM commissions
   WHERE recipient_id = 'YOUR_CUSTOMER_ID'
   AND commission_type = 'customer_credit'
   ORDER BY created_at DESC LIMIT 1;
   ```

4. **Check customer email** for confirmation

## Security

- Webhook signature verification is handled automatically by `constructWebhookEvent()`
- Always use HTTPS endpoint
- Never expose webhook secrets in client-side code
- Webhook secret is stored in `STRIPE_WEBHOOK_SECRET` environment variable

## Related Files

- `/app/api/webhooks/stripe/route.ts` - Main webhook handler
- `/app/api/customers/credits/checkout/route.ts` - Checkout session creation
- `/db/add-customization-credits-function.sql` - Database function
- `/db/add-credit-pack-purchased-template.sql` - Email template
