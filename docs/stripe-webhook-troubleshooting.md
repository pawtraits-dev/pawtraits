# Stripe Webhook Signature Verification Troubleshooting

## Current Issue
Webhook signature verification is failing with error: "No signatures found matching the expected signature for payload"

## Diagnostic Information from Logs
- Webhook secret is configured: `whsec_qndj...` (38 chars) ✅
- Secret starts with correct prefix ✅
- Payment is in TEST mode (`"livemode": false`) ✅
- Metadata IS present in payload ✅

## Common Causes & Solutions

### 1. Environment Variable Whitespace/Newlines

**Problem**: Trailing spaces or newlines in the webhook secret environment variable

**Check**:
```bash
# In Vercel Dashboard, check the STRIPE_WEBHOOK_SECRET variable
# It should be EXACTLY the value from Stripe with no extra spaces
```

**Solution**:
```bash
# Remove and re-add the environment variable in Vercel
vercel env rm STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_WEBHOOK_SECRET production
# Then redeploy
vercel --prod
```

### 2. Test vs Live Mode Mismatch

**Problem**: Using test mode webhook secret with live payments (or vice versa)

**Check**:
- Payment shows `"livemode": false` → Must use TEST webhook secret
- Payment shows `"livemode": true` → Must use LIVE webhook secret

**Solution**:
1. Go to Stripe Dashboard: https://dashboard.stripe.com/
2. Toggle between "Test mode" and "Live mode" in top right
3. Navigate to: Developers → Webhooks
4. Ensure you're copying the secret from the CORRECT mode
5. Update `STRIPE_WEBHOOK_SECRET` environment variable accordingly

### 3. Multiple Webhook Endpoints

**Problem**: Multiple webhook endpoints configured, each with different secrets

**Check**:
1. Go to: https://dashboard.stripe.com/test/webhooks
2. Look for ALL endpoints with URL: `https://www.pawtraits.pics/api/webhooks/stripe`
3. Check if multiple exist with different secrets

**Solution**:
- Delete duplicate webhook endpoints
- Keep only ONE endpoint per environment (test/live)
- Use the signing secret from the active endpoint

### 4. Wrong Webhook Secret Copy/Paste

**Problem**: Accidentally copied the wrong secret or webhook endpoint ID

**Check**:
- Webhook signing secrets start with `whsec_` ✅
- Webhook endpoint IDs start with `we_` (NOT the secret)

**Solution**:
1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click on your webhook endpoint
3. Click "Reveal" under "Signing secret"
4. Copy the ENTIRE secret (including `whsec_` prefix)
5. Paste into Vercel environment variable
6. Redeploy

### 5. Next.js Body Parsing Issue

**Problem**: Next.js `request.text()` may not preserve exact byte representation

**Current Implementation**: Using `request.text()` to get raw body

**Enhanced Logging Added**:
- Body start/end characters
- Content-Type header
- Error stack trace

**Wait for Next Test**: The enhanced logging will show if the body is being corrupted

### 6. Vercel Deployment Environment

**Problem**: Environment variable not deployed to production

**Check**:
```bash
# Verify environment variable is set in production
vercel env ls
```

**Solution**:
```bash
# Ensure variable is set for production environment
vercel env add STRIPE_WEBHOOK_SECRET production
# Trigger new deployment
git commit --allow-empty -m "Trigger deployment for env var update"
git push
```

## Testing Steps

### Step 1: Verify Webhook Secret in Stripe Dashboard

1. Login to Stripe: https://dashboard.stripe.com/
2. **IMPORTANT**: Enable TEST mode (toggle in top right)
3. Navigate to: Developers → Webhooks
4. Find endpoint: `https://www.pawtraits.pics/api/webhooks/stripe`
5. Click "Reveal" under "Signing secret"
6. Copy the entire secret (should be ~38 characters starting with `whsec_`)

### Step 2: Update Environment Variable in Vercel

1. Go to: https://vercel.com/dev-7833s-projects/pawtraits (adjust to your project)
2. Settings → Environment Variables
3. Find `STRIPE_WEBHOOK_SECRET`
4. Edit → Replace with the secret from Step 1
5. **IMPORTANT**: Ensure no extra spaces before/after
6. Save

### Step 3: Redeploy Application

```bash
# Trigger a new deployment to pick up environment variable
git commit --allow-empty -m "Update Stripe webhook secret"
git push
```

### Step 4: Test Credit Purchase

1. Go to: https://www.pawtraits.pics/customize
2. Purchase a credit pack using test card: `4242 4242 4242 4242`
3. Check Vercel logs for enhanced debugging output

### Step 5: Analyze New Logs

Look for these in Vercel logs:

```
🔐 Webhook signature verification:
  signatureHeader: "t=...,v1=..."
  bodyLength: 2409
  bodyType: "string"
  secretConfigured: true
  secretLength: 38
  bodyStart: "{\"id\":\"evt_..."
  bodyEnd: "...created\":1761...}"
```

If signature verification STILL fails, check:
- `webhookSecretPrefix`: Should match what you see in Stripe
- `contentType`: Should be `application/json`
- `errorStack`: Will show exact error from Stripe library

## Advanced Debugging: Use Stripe CLI

If all else fails, test locally with Stripe CLI to isolate the issue:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe

# In another terminal, trigger test webhook
stripe trigger payment_intent.succeeded
```

This bypasses signature verification issues and confirms the rest of your code works.

## Expected Successful Output

When signature verification works, you should see:

```
🔐 Webhook signature verification: { ... }
✅ Webhook signature verified successfully
Stripe webhook event received: { id: 'evt_...', type: 'checkout.session.completed', ... }
🎫 Checkout Session Completed: { ... }
💳 Processing credit pack purchase: { customerId: '...', credits: 10, ... }
✅ Customization credits added successfully
💰 Adding order credit to commissions table: { orderCreditAmount: 1000 }
✅ Order credit commission record created: ...
✅ Customer credit balance updated: { newBalance: 1000 }
📧 Preparing credit pack purchase email for: ...
✅ Credit pack purchase email queued successfully
```

## Next Steps

1. Follow Steps 1-4 above to verify and update webhook secret
2. Test credit purchase
3. Check Vercel logs for new enhanced debugging output
4. If still failing, report the following from logs:
   - `webhookSecretPrefix`
   - `secretLength`
   - `bodyStart` and `bodyEnd`
   - `errorStack`
   - Full error message

## Related Documentation

- [Stripe Webhook Setup Guide](./stripe-webhook-setup.md)
- [Stripe Webhook Signature Verification](https://stripe.com/docs/webhooks/signatures)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
