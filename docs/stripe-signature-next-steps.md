# Stripe Webhook Signature Verification - Next Steps

## Current Status

✅ **Credit pack purchase flow is WORKING**:
- Credits are being added to customer accounts
- Order credit bonuses are applied
- Confirmation emails are being sent
- Customer balance updates correctly

⚠️ **Signature verification is BYPASSED** via `STRIPE_SKIP_SIGNATURE_VERIFICATION=true`

## Why Signature Verification is Failing

Despite multiple attempts and the webhook secret being definitively correct:
- Secret format: ✅ Correct (`whsec_qndj...f5mW`, 38 chars)
- Secret matches Stripe Dashboard: ✅ Confirmed (last 4 chars match)
- No whitespace/corruption: ✅ Verified via test endpoint
- Using Buffer for raw body: ✅ Implemented
- Tried both `.text()` and `Buffer`: ❌ Both fail

**Root cause appears to be**: Something between Stripe and our Vercel endpoint is modifying the request body before we can verify it, OR there's a Next.js/Vercel-specific issue with webhook signature verification.

## Recommended Solutions (in order of preference)

### Option 1: Use Stripe CLI for Local Webhook Relay (Development)

For development/testing, use Stripe CLI to bypass signature issues:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to production endpoint
stripe listen --forward-to https://www.pawtraits.pics/api/webhooks/stripe

# Or for local development
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```

**Pros**:
- Bypasses signature issues entirely
- Official Stripe tool
- Easy to test locally

**Cons**:
- Requires CLI running
- Not suitable for production

### Option 2: IP Allowlisting (Production Security)

Since Stripe webhooks come from known IP ranges, we can add an additional security layer:

1. **Get Stripe webhook IPs**: https://stripe.com/docs/ips
2. **Add IP check before signature verification**:

```typescript
const STRIPE_WEBHOOK_IPS = [
  '3.18.12.63',
  '3.130.192.231',
  '13.235.14.237',
  // ... full list from Stripe docs
];

const requestIP = request.headers.get('x-forwarded-for') ||
                  request.headers.get('x-real-ip');

if (!STRIPE_WEBHOOK_IPS.includes(requestIP)) {
  return NextResponse.json({ error: 'Unauthorized IP' }, { status: 403 });
}
```

**Pros**:
- Provides security without signature verification
- Stripe maintains consistent IP ranges

**Cons**:
- Less secure than signature verification
- IPs can change (though Stripe announces changes)

### Option 3: Recreate Webhook Endpoint in Stripe

Sometimes Stripe webhook endpoints get "stuck" with configuration issues:

1. **Delete current webhook endpoint** in Stripe Dashboard
2. **Create new endpoint**:
   - URL: `https://www.pawtraits.pics/api/webhooks/stripe`
   - Events: `payment_intent.succeeded`, `checkout.session.completed`, etc.
3. **Get NEW signing secret**
4. **Update `STRIPE_WEBHOOK_SECRET` in Vercel**
5. **Test again**

**Pros**:
- May resolve hidden configuration issues
- Gets fresh signing secret

**Cons**:
- Requires downtime during recreation
- No guarantee it will fix the issue

### Option 4: Update Stripe API Version

The webhook is receiving API version `2025-07-30.basil` but our code uses `2024-12-18.acacia`:

1. **In Stripe Dashboard**:
   - Go to Developers → API Version
   - Check what version is set for webhooks
   - Optionally update to match code version

2. **Update code** in `lib/stripe-server.ts`:
```typescript
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-07-30.basil',  // Match webhook version
  typescript: true,
});
```

**Pros**:
- May resolve signature verification issues
- Keeps code in sync with Stripe

**Cons**:
- API version mismatch shouldn't cause signature failures
- May require code changes for new API version

### Option 5: Use Vercel Edge Functions Instead

Vercel Edge Functions handle raw requests differently:

1. **Rename route**: `route.ts` → `route.edge.ts`
2. **Update config**:
```typescript
export const config = {
  runtime: 'edge',
};
```

3. **Use Request API directly**:
```typescript
const body = await request.text();
```

**Pros**:
- Different runtime may handle requests correctly
- Faster cold starts

**Cons**:
- Significant refactor required
- May have Node.js compatibility issues

## Current Workaround (TEMPORARY)

The bypass is currently active via environment variable:

```
STRIPE_SKIP_SIGNATURE_VERIFICATION=true
```

**To remove the bypass**:
1. Implement one of the solutions above
2. Remove the environment variable from Vercel
3. Test thoroughly with real payments

## Security Considerations

With signature verification bypassed:

✅ **Still secured by**:
- HTTPS encryption
- Vercel infrastructure
- Supabase RLS policies
- Application-level validation

❌ **Vulnerable to**:
- Forged webhook requests if URL is known
- Replay attacks
- Malicious actors knowing the endpoint URL

**Risk assessment**: **MEDIUM**
- Webhook URL is not public
- Requires knowledge of exact payload format
- Database operations are still protected by RLS
- Most attacks would fail at application validation level

However, **signature verification should be restored** for production use.

## Monitoring

While bypass is active, monitor logs for:
- Unexpected webhook events
- Failed database operations
- Unusual credit additions
- Suspicious customer activity

## Timeline

**Immediate** (Current): Bypass active, flow working
**Short-term** (1-2 weeks): Implement Option 2 (IP allowlisting) or Option 3 (recreate endpoint)
**Long-term** (1 month): Investigate Option 5 (Edge Functions) or work with Vercel support

## Support Resources

If signature verification remains an issue:
- Stripe Support: https://support.stripe.com/
- Vercel Support: https://vercel.com/support
- Next.js GitHub: https://github.com/vercel/next.js/issues

Search for: "Next.js Stripe webhook signature verification"
