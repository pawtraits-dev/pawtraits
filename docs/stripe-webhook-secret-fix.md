# How to Fix Webhook Secret Mismatch

## Current Status
✅ Webhook secret is properly formatted (whsec_qndj...f5mW, 38 chars)
✅ No whitespace or newline contamination
❌ Signature verification still failing

## Root Cause
The webhook secret in your environment doesn't match the secret that Stripe is using to sign the webhook requests.

## Step-by-Step Fix

### Step 1: Identify Active Webhook Endpoint

1. Go to Stripe Dashboard: https://dashboard.stripe.com/
2. **IMPORTANT**: Toggle to **TEST mode** (your payments show `livemode: false`)
3. Navigate to: **Developers → Webhooks**
4. You should see one or more webhook endpoints listed

### Step 2: Find the Correct Endpoint

Look for the endpoint with URL: `https://www.pawtraits.pics/api/webhooks/stripe`

**Check these things:**
- Is there MORE than one endpoint with this URL? (If yes, delete duplicates)
- Is the endpoint **Enabled**? (Should have green checkmark)
- What events is it listening to? (Should include `checkout.session.completed` and `payment_intent.succeeded`)

### Step 3: Get the Signing Secret

1. Click on your webhook endpoint
2. Scroll down to **Signing secret** section
3. Click **Reveal**
4. Copy the ENTIRE secret (should look like: `whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

### Step 4: Compare Secrets

**Current secret in Vercel:** `whsec_qndj...f5mW` (38 chars)
**Secret from Stripe Dashboard:** `whsec_????...????` (what is it?)

If they DON'T match → That's your problem!

### Step 5: Update Vercel Environment Variable

**Option A: Via Vercel Dashboard**
1. Go to your Vercel project: https://vercel.com/dev-7833s-projects/pawtraits
2. Settings → Environment Variables
3. Find `STRIPE_WEBHOOK_SECRET`
4. Click Edit
5. Replace with the secret from Step 3
6. Save
7. Redeploy: `git commit --allow-empty -m "Trigger redeploy" && git push`

**Option B: Via Vercel CLI**
```bash
vercel env rm STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_WEBHOOK_SECRET production
# When prompted, paste the secret from Step 3
vercel --prod
```

### Step 6: Alternative - Update Stripe to Match Vercel

If you want to keep the current secret in Vercel (`whsec_qndj...f5mW`), you can instead update Stripe:

1. In Stripe Dashboard (TEST mode)
2. Go to: Developers → Webhooks
3. Delete the existing webhook endpoint
4. Create a new endpoint:
   - **Endpoint URL**: `https://www.pawtraits.pics/api/webhooks/stripe`
   - **Events to send**:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `payment_intent.canceled`
5. Copy the NEW signing secret from Stripe
6. **Verify it matches** `whsec_qndj...f5mW` in Vercel

## Common Mistakes

### Mistake 1: Using Live Secret for Test Payments
- Your payments show `"livemode": false`
- This means you're in TEST mode
- You MUST use the TEST webhook secret (not LIVE)

### Mistake 2: Multiple Endpoints
- Having multiple webhook endpoints with same URL
- Each has a different secret
- Stripe picks one randomly (causing intermittent failures)
- **Fix**: Delete duplicate endpoints, keep only one

### Mistake 3: Recently Changed Endpoint
- If you recently deleted/recreated the webhook endpoint in Stripe
- The signing secret changed
- Your Vercel env var still has the OLD secret
- **Fix**: Update Vercel with the NEW secret

## Verification

After updating the secret:

1. Redeploy your application
2. Make a test purchase: https://www.pawtraits.pics/customize
3. Use test card: `4242 4242 4242 4242`
4. Check Vercel logs for:

```
✅ Webhook signature verified successfully
Stripe webhook event received: { id: 'evt_...', type: 'payment_intent.succeeded' }
💳 Payment Intent Succeeded: { ... }
ℹ️  Credit pack purchase detected - will be handled by checkout.session.completed event
```

Then shortly after:

```
✅ Webhook signature verified successfully
Stripe webhook event received: { id: 'evt_...', type: 'checkout.session.completed' }
🎫 Checkout Session Completed: { ... }
💳 Processing credit pack purchase: { ... }
✅ Customization credits added successfully
```

## Still Not Working?

If signature verification still fails after matching the secrets:

1. Check Stripe API version mismatch:
   - Webhook payload shows: `"api_version": "2025-07-30.basil"`
   - Your code uses: `apiVersion: '2024-12-18.acacia'`
   - This shouldn't cause signature issues, but update to match

2. Try Stripe CLI for local testing:
   ```bash
   stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
   stripe trigger checkout.session.completed
   ```

3. Check Vercel function logs for any proxy/middleware interference

## Need Help?

Report these details:
- Full URL of webhook endpoint in Stripe Dashboard
- Number of webhook endpoints configured
- Last 4 chars of signing secret from Stripe: `????`
- Last 4 chars of secret in Vercel: `f5mW`
- Do they match? YES / NO
