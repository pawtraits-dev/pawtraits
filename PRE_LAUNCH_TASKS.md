# 🚀 Pre-Launch Tasks for Pawtraits
## Monday Launch Target - Weekend Completion Plan

**Generated**: 2025-10-24
**Total Estimated Effort**: 15-20 hours
**Status**: Ready to Execute

---

## 🔴 **CRITICAL - Must Fix Before Launch**

### Security & Configuration

#### 1. Remove Stripe Webhook Signature Bypass ⚠️ URGENT
- **File**: `app/api/webhooks/stripe/route.ts` (lines 58-62)
- **Issue**: `STRIPE_SKIP_SIGNATURE_VERIFICATION` flag currently allows bypassing webhook signature verification
- **Action**:
  - Remove or set to `false` in production
  - Verify `STRIPE_WEBHOOK_SECRET` is correctly configured
  - Test webhook with real Stripe events
- **Priority**: P0 - Security vulnerability

#### 2. Remove Development/Debug Routes
- **Issue**: 20+ debug endpoints publicly accessible
- **Routes to Delete/Protect**:
  - `/api/debug/*` (all debug endpoints)
  - `/app/test-auth/page.tsx`
  - `/app/test-cloudinary/page.tsx`
  - `/app/test-raw-auth/page.tsx`
  - `/app/debug-env/page.tsx`
  - `/app/debug-images/page.tsx`
  - `/app/quick-debug/page.tsx`
  - `/app/demo/page.tsx`
  - `/app/css-test/page.tsx`
  - `/app/ui-demo/page.tsx`
  - `/app/preview/*` (entire preview section)
  - `/app/interactions-demo/page.tsx`
  - `/app/test/page.tsx`
  - `/app/test-hero-api/page.tsx`
  - `/app/simple-login/page.tsx`
- **Action**:
  - Delete these files OR
  - Add authentication middleware to protect them
- **Priority**: P0 - Security exposure

#### 3. Review Console.log Exposure
- **Issue**: 2,347 console.log/error/warn statements across 355 files
- **Action**:
  - Short-term: Wrap critical logs in environment check:
    ```typescript
    if (process.env.NODE_ENV !== 'production') {
      console.log(...)
    }
    ```
  - Long-term: Implement proper logging service (Sentry, LogRocket)
- **Priority**: P1 - Data leakage risk

#### 4. Environment Variable Validation
- **Action**: Create production environment checklist
- **Required Variables**:
  ```bash
  # Stripe - MUST BE PRODUCTION KEYS
  STRIPE_SECRET_KEY=sk_live_... (NOT sk_test_...)
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...

  # Supabase - Production
  NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  SUPABASE_SERVICE_ROLE_KEY=...

  # Cloudinary - Production account
  CLOUDINARY_CLOUD_NAME=...
  CLOUDINARY_API_KEY=...
  CLOUDINARY_API_SECRET=...

  # Claude AI
  CLAUDE_API_KEY=...

  # Gelato
  GELATO_API_KEY=...

  # Base URLs
  NEXT_PUBLIC_BASE_URL=https://pawtraits.com
  ```
- **Priority**: P0 - Prevents production failures

#### 5. Verify .gitignore Coverage
- **Action**:
  - Check no `.env` files committed: `git log --all --full-history -- "*.env*"`
  - Scan for hardcoded secrets: `git secrets --scan` or use `truffleHog`
  - Review recent commits for accidental key commits
- **Priority**: P0 - Prevents credential leaks

---

## 🟠 **HIGH PRIORITY - Should Complete**

### Functional Completeness

#### 6. Resolve Critical TODO Comments
**Purchase Verification (SECURITY)**:
- `lib/cloudinary.ts:427` - Verify print fulfillment service access
- `lib/cloudinary.ts:457` - Verify user has purchased image
- `lib/cloudinary.ts:501` - Verify purchase/order exists
- `app/api/secure-images/[imageId]/route.ts:292` - Verify order exists and contains image
- `app/api/secure-images/[imageId]/route.ts:305` - Verify user purchased image

**Commission Calculations**:
- `lib/supabase.ts:2115` - Calculate total purchases for customer referrals
- `lib/supabase.ts:2119-2120` - Fix order join logic
- `lib/supabase.ts:2130` - Look up order value separately
- `lib/supabase.ts:2171` - Calculate purchases for partner referrals
- `lib/supabase.ts:2174-2175` - Fix commission calculation
- `lib/supabase.ts:2182-2183` - Add order value when orders joined
- `lib/supabase.ts:2193-2195` - Fix commission calculation syntax

**Customer Referral Endpoints**:
- `components/referrals/CustomerReferralsView.tsx:341` - Create `/api/customers/referrals` endpoint
- `components/referrals/CustomerReferralsView.tsx:364` - Create `/api/customers/redemptions` endpoint

**Webhook TODOs**:
- `app/api/webhooks/stripe/route.ts:295` - Notify admin of new order
- `app/api/webhooks/stripe/route.ts:296` - Update inventory if applicable

**Priority**: P1 - Affects core functionality

#### 7. Error Handling Improvements
**Files to Update**:
- `components/account/CustomerAccountView.tsx` (lines 112, 151, 180)
- `components/account/PartnerAccountView.tsx` (lines 142, 191, 230, 269, 304, 356, 386)

**Pattern to Implement**:
```typescript
} catch (error) {
  console.error('Error:', error);
  // Add user-facing message
  setError('Failed to update profile. Please try again.');
  toast.error('Failed to update profile');
}
```

**Priority**: P1 - Poor user experience without feedback

#### 8. Complete Checkout Flow Testing
**Test Scenarios**:
- [ ] Browse gallery → Add to cart → Checkout
- [ ] Guest checkout flow
- [ ] Authenticated customer checkout
- [ ] Apply referral code (valid & invalid)
- [ ] Apply reward balance
- [ ] Test all Stripe test cards:
  - `4242424242424242` - Success
  - `4000000000000002` - Declined
  - `4000000000009995` - Insufficient funds
- [ ] Verify Gelato order creation
- [ ] Check email notifications sent
- [ ] Verify order appears in customer orders page
- [ ] Test order confirmation page displays correctly

**Priority**: P0 - Core revenue flow

#### 9. Review System Testing
- [ ] Verify 189 generated reviews display on homepage
- [ ] Test carousel auto-rotation (6 seconds)
- [ ] Test manual prev/next navigation
- [ ] Test review submission from orders page
- [ ] Verify 5-star reviews auto-approve
- [ ] Verify 4-star reviews auto-approve
- [ ] Verify 1-3 star reviews require approval
- [ ] Check admin can see pending reviews
- [ ] Test multilingual reviews display correctly (EN, FR, ES, IT, DE)

**Priority**: P1 - Social proof is critical for launch

---

## 🟡 **MEDIUM PRIORITY - Usability**

### User Experience

#### 10. Mobile Responsiveness Check
**Pages to Test**:
- [ ] Homepage (including reviews carousel)
- [ ] Gallery/Browse page
- [ ] Product selection modal
- [ ] Cart page
- [ ] Checkout flow (all steps)
- [ ] Order confirmation
- [ ] Customer orders page
- [ ] Navigation menu

**Devices to Test**:
- iPhone (Safari)
- Android (Chrome)
- iPad (Safari)

**Priority**: P2 - Mobile traffic expected

#### 11. Loading States & Spinners
**Verify These Work**:
- [ ] Gallery image loading
- [ ] Cart operations (add/remove/update)
- [ ] Checkout shipping calculation
- [ ] Payment processing
- [ ] Order submission
- [ ] Review submission
- [ ] Product price loading

**Priority**: P2 - User experience polish

#### 12. Form Validation
**Forms to Test**:
- [ ] Checkout shipping form
  - Required field validation
  - Email format validation
  - Postcode format (optional)
  - Address validation
- [ ] Review submission form
  - Star rating required
  - Comment minimum 10 chars
  - Comment maximum 1000 chars
- [ ] Signup forms (customer & partner)
- [ ] Login form

**Priority**: P2 - Prevents bad data

#### 13. Navigation Consistency
- [ ] UserAwareNavigation displays correct links per user type
- [ ] Cart icon shows correct item count
- [ ] User menu shows appropriate options
- [ ] Breadcrumbs work on all pages
- [ ] Back buttons function correctly
- [ ] All internal links work

**Priority**: P2 - Core UX

#### 14. Image Performance
- [ ] Cloudinary lazy loading works
- [ ] Watermarks apply correctly
- [ ] Thumbnails generate properly
- [ ] Full-size images load on click
- [ ] Image modal works correctly
- [ ] Share functionality works
- [ ] Download functionality works (if implemented)

**Priority**: P2 - Core product feature

---

## 🟢 **NICE TO HAVE - Polish**

### Performance & Optimization

#### 15. Build Optimization
**Known Issues**:
- 160+ warnings about `<img>` tags that should use Next.js `<Image />`
- React Hook dependency array warnings
- Unescaped entity warnings in JSX

**Action**:
- Can defer most of these
- Fix any that cause actual build failures
- Document for future sprint

**Priority**: P3 - Not blocking launch

#### 16. SEO Readiness
- [ ] Add meta descriptions to main pages
- [ ] Verify Open Graph tags for social sharing
- [ ] Check robots.txt configuration
- [ ] Add sitemap.xml
- [ ] Test preview on Twitter/Facebook
- [ ] Verify Google Search Console setup

**Priority**: P3 - Can add post-launch

#### 17. Analytics Setup
- [ ] Implement Google Analytics or Plausible
- [ ] Set up conversion tracking
- [ ] Track critical events:
  - Page views
  - Add to cart
  - Checkout started
  - Purchase completed
  - Review submitted
- [ ] Monitor error rates

**Priority**: P3 - Critical for growth but not blocking

#### 18. Content Review
- [ ] Proofread all customer-facing text
- [ ] Verify Privacy Policy is complete
- [ ] Verify Terms of Service are complete
- [ ] Check email template content
- [ ] Review error messages for tone
- [ ] Spell check all pages

**Priority**: P3 - Quality polish

---

## 📊 **MONITORING - Set Up Before Launch**

#### 19. Set Up Monitoring
**Services to Configure**:
- [ ] Error tracking (Sentry or Rollbar)
  - Connect to Vercel project
  - Set up source maps
  - Configure alert thresholds
- [ ] Performance monitoring (Vercel Analytics)
  - Enable in Vercel dashboard
  - Set up custom events
- [ ] Database monitoring
  - Supabase dashboard alerts
  - Query performance tracking
- [ ] API monitoring
  - Response time tracking
  - Error rate alerts
- [ ] Stripe webhook monitoring
  - Success rate tracking
  - Failure notifications

**Priority**: P1 - Need visibility on launch day

#### 20. Create Launch Runbook
**Document Should Include**:
- [ ] Rollback procedure
  - Previous deployment hash
  - Rollback command: `vercel rollback [deployment-url]`
- [ ] Emergency contact list
  - Your mobile
  - Payment processor support
  - Hosting provider support
- [ ] Database backup verification
  - Last backup time
  - Restore procedure
- [ ] Monitoring dashboard URLs
  - Vercel dashboard
  - Stripe dashboard
  - Supabase dashboard
  - Error tracking dashboard
- [ ] Common issues troubleshooting
  - Payment failures → Check Stripe dashboard
  - Order not created → Check webhook logs
  - Image not loading → Check Cloudinary
- [ ] Post-launch smoke test checklist

**Priority**: P1 - Safety net for launch

---

## ⚡ **QUICK WINS - Low Effort, High Impact**

#### 21. Delete Unused Files
**Files to Remove**:
- `app/referrals/page-old.tsx`
- Any other `-old` files
- Test components in `/app/test-*`
- Demo pages

**Command**:
```bash
find . -name "*-old.*" -type f
find . -name "test-*.tsx" -path "*/app/*" -type f
```

**Priority**: P3 - Cleanup

#### 22. Favicon & PWA
- [ ] Ensure `favicon.ico` exists in `/public`
- [ ] Check `manifest.json` for mobile
- [ ] Test "Add to Home Screen" on mobile
- [ ] Verify app icon displays correctly

**Priority**: P3 - Brand polish

#### 23. 404 & Error Pages
- [ ] Create custom `app/not-found.tsx`
- [ ] Create `app/error.tsx` for error boundary
- [ ] Test 404 handling
- [ ] Test error boundary with forced error

**Priority**: P3 - User experience

---

## 🎯 **RECOMMENDED COMPLETION ORDER**

### **Saturday Morning** (4-6 hours) - Security First
**Goal**: Make the app secure for launch

1. ✅ **Task #1**: Remove Stripe webhook bypass (30 min)
   - Edit `app/api/webhooks/stripe/route.ts`
   - Set `STRIPE_SKIP_SIGNATURE_VERIFICATION=false`
   - Test with Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

2. ✅ **Task #2**: Delete debug routes (1 hour)
   - Delete all `/app/test-*` pages
   - Delete `/app/debug-*` pages
   - Delete `/app/demo` and `/app/css-test`
   - Delete `/app/preview` directory
   - Commit: "chore: Remove debug and test routes for production"

3. ✅ **Task #4**: Validate environment variables (30 min)
   - Create `.env.production.example` with required variables
   - Document in README.md
   - Verify production keys are ready

4. ✅ **Task #6a**: Fix purchase verification TODOs (2-3 hours)
   - Implement purchase checks in Cloudinary access
   - Add order verification in secure image endpoint
   - Test with real purchase flow

### **Saturday Afternoon** (3-4 hours) - Core Flow Testing
**Goal**: Ensure checkout works perfectly

5. ✅ **Task #8**: End-to-end checkout testing (2 hours)
   - Test complete purchase flow
   - Try all Stripe test cards
   - Verify order creation
   - Check email notifications
   - Test order confirmation page

6. ✅ **Task #7**: Add error messages (1 hour)
   - Update account view components
   - Add toast notifications for errors
   - Test error scenarios

7. ✅ **Task #10**: Mobile responsiveness spot checks (1 hour)
   - Test on iPhone and Android
   - Fix critical layout issues
   - Verify checkout works on mobile

### **Saturday Evening** (2-3 hours) - Polish & Testing
**Goal**: Clean up and test reviews

8. ✅ **Task #3**: Console.log cleanup strategy (1 hour)
   - Wrap sensitive logs in environment check
   - Document logging strategy
   - Or set up Sentry for production logging

9. ✅ **Task #9**: Review system testing (1 hour)
   - Test homepage carousel
   - Test review submission
   - Verify auto-approval logic

10. ✅ **Task #21-23**: Quick wins (30 min)
    - Delete unused files
    - Add favicon
    - Create 404 page

### **Sunday Morning** (2-3 hours) - Monitoring & Documentation
**Goal**: Be ready to monitor launch

11. ✅ **Task #19**: Set up monitoring (1-2 hours)
    - Configure Sentry or similar
    - Set up Vercel Analytics
    - Configure alert thresholds

12. ✅ **Task #20**: Create launch runbook (1 hour)
    - Document rollback procedure
    - List emergency contacts
    - Create troubleshooting guide

13. ✅ **Task #16**: SEO basics (30 min)
    - Add meta descriptions
    - Verify OG tags
    - Submit to Google Search Console

### **Sunday Afternoon** (Buffer Time)
**Goal**: Final verification and fixes

14. Final smoke test of entire application
15. Address any issues found during testing
16. Do one more security review
17. Verify all environment variables set correctly
18. Test production build locally

---

## 📋 **FINAL LAUNCH CHECKLIST**

### Before Deploying to Production:
- [ ] All security issues resolved (#1-5)
- [ ] Stripe in production mode (live keys, not test)
- [ ] Webhook signature verification enabled
- [ ] No debug routes accessible
- [ ] Environment variables validated
- [ ] `.gitignore` preventing credential leaks

### After Deploying:
- [ ] Database backups configured and tested
- [ ] Monitoring dashboards accessible
- [ ] Error tracking working
- [ ] Emergency contacts documented
- [ ] Rollback procedure tested
- [ ] Customer support ready
- [ ] Social media posts ready

### Post-Launch (First 24 Hours):
- [ ] Monitor error rates
- [ ] Check webhook success rate
- [ ] Verify orders creating correctly
- [ ] Monitor payment failures
- [ ] Track conversion funnel
- [ ] Respond to customer support quickly

---

## 🚨 **KNOWN ISSUES TO MONITOR**

1. **Commission Calculations**: Some TODOs remain - monitor referral payouts closely
2. **Rate Limiting**: No rate limiting implemented on most endpoints - watch for abuse
3. **Image Download**: Some download functionality marked as TODO - may need to disable
4. **Admin Dashboards**: Some admin views incomplete - may need manual data review

---

## 📞 **EMERGENCY CONTACTS**

- **Stripe Support**: https://support.stripe.com
- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://supabase.com/support
- **Cloudinary Support**: https://support.cloudinary.com

---

## ✅ **SUCCESS CRITERIA**

Launch is ready when:
1. ✅ Security vulnerabilities closed
2. ✅ Complete checkout flow works end-to-end
3. ✅ Mobile experience is functional
4. ✅ Monitoring is in place
5. ✅ Rollback plan documented
6. ✅ Production environment configured

**Estimated Total Time**: 15-20 hours
**Realistic Weekend Goal**: Complete all Critical & High Priority tasks
**Nice to Have items**: Can be done post-launch

---

Good luck with the launch! 🚀 You've got this!
