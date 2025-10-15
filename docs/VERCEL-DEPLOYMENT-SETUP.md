# Vercel Multi-Environment Deployment Setup

## Overview

This guide walks through setting up Production, Staging, and Preview environments on Vercel for the Pawtraits application.

## Architecture

```
┌─────────────────┐
│  Git Branches   │
└────────┬────────┘
         │
    ┌────┼────┐
    │    │    │
    v    v    v
  main staging feature/*
    │    │    │
    │    │    └──► Preview Deployments
    │    │         (automatic for all branches)
    │    │         URL: <branch>-pawtraits.vercel.app
    │    │
    │    └──────► Staging Environment
    │             URL: staging-pawtraits.vercel.app
    │             Test Stripe, Production DB
    │
    └───────────► Production Environment
                 URL: pawtraits.pics
                 Live Stripe, Production DB
```

## Prerequisites

- ✅ Vercel account with project connected
- ✅ GitHub repository connected to Vercel
- ✅ Supabase production database
- ✅ Stripe account (test and live keys)
- ✅ Cloudinary account
- ✅ Claude API key
- ✅ Google Gemini API key

## Step 1: Vercel Project Settings

### 1.1 Access Project Settings

1. Log in to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your Pawtraits project
3. Navigate to **Settings**

### 1.2 Verify Git Integration

**Go to Settings → Git:**

You'll see a card titled **"Connected Git Repository"** showing:
- Your GitHub repository name
- Branch: `main` (or your production branch)
- Last deployed commit
- "Disconnect" button (don't click this!)

**What You WON'T See (These have moved or are automatic):**
- ❌ "Production Branch" dropdown (moved to Settings → General)
- ❌ "Enable Automatic Deployments" checkbox (always enabled)
- ❌ Branch-specific settings (automatic for all branches)

### 1.3 Check Production Branch Setting

**Go to Settings → General:**

Scroll down to find the **"Production Branch"** field:
- Should show: `main`
- This is the branch that deploys to your custom domain (pawtraits.pics)
- All other branches automatically create preview deployments

**You don't need to change anything here** - just verify `main` is set as production.

### 1.4 How Vercel Deployment Works (Current Behavior)

```
Push to main branch
    ↓
Vercel automatically detects push
    ↓
Builds and deploys to Production
    ↓
Updates pawtraits.pics

Push to any other branch (staging, feature/*)
    ↓
Vercel automatically detects push
    ↓
Builds and deploys as Preview
    ↓
Creates URL: <branch-name>-pawtraits.vercel.app
```

**Key Point:** Since you mentioned deployments are already triggered by git pushes, your setup is already correct! You don't need to change anything in Settings → Git.

## Step 2: Configure Environments

Vercel has three built-in environments:
- **Production** - Connected to `main` branch
- **Preview** - All other branches (automatic)
- **Development** - Local development

We'll configure environment variables for each.

### 2.1 Environment Variable Types

| Variable Name | Production | Preview | Development |
|--------------|------------|---------|-------------|
| Database (Supabase) | Production | Production* | Local/Production |
| Stripe | Live Keys | Test Keys | Test Keys |
| AI APIs | Production | Production | Development |
| Cloudinary | Production | Production | Production |

*⚠️ Using production database in preview - be careful with destructive operations!

## Step 3: Set Environment Variables

### 3.1 Navigate to Environment Variables

1. Go to **Settings → Environment Variables**
2. You'll see three columns: **Production**, **Preview**, **Development**

### 3.2 Add Variables (One by One)

For each variable below, click **Add Another** and configure:

#### Supabase Variables (All Environments - Same Values)

```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: <your-production-supabase-url>
Environments: ☑ Production ☑ Preview ☑ Development
```

```
Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: <your-production-anon-key>
Environments: ☑ Production ☑ Preview ☑ Development
```

```
Name: SUPABASE_SERVICE_ROLE_KEY
Value: <your-production-service-role-key>
Environments: ☑ Production ☑ Preview ☑ Development
Type: Secret (encrypted)
```

#### Stripe Variables (Different for Production vs Preview)

**Production:**
```
Name: STRIPE_SECRET_KEY
Value: sk_live_<your-live-key>
Environments: ☑ Production
Type: Secret (encrypted)
```

```
Name: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
Value: pk_live_<your-live-key>
Environments: ☑ Production
```

```
Name: STRIPE_WEBHOOK_SECRET
Value: whsec_<your-production-webhook>
Environments: ☑ Production
Type: Secret (encrypted)
```

**Preview/Development:**
```
Name: STRIPE_SECRET_KEY
Value: sk_test_<your-test-key>
Environments: ☑ Preview ☑ Development
Type: Secret (encrypted)
```

```
Name: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
Value: pk_test_<your-test-key>
Environments: ☑ Preview ☑ Development
```

```
Name: STRIPE_WEBHOOK_SECRET
Value: whsec_<your-preview-webhook>
Environments: ☑ Preview ☑ Development
Type: Secret (encrypted)
```

#### Claude AI (All Environments - Same)

```
Name: CLAUDE_API_KEY
Value: <your-claude-api-key>
Environments: ☑ Production ☑ Preview ☑ Development
Type: Secret (encrypted)
```

#### Google Gemini (All Environments - Same)

```
Name: GEMINI_API_KEY
Value: <your-gemini-api-key>
Environments: ☑ Production ☑ Preview ☑ Development
Type: Secret (encrypted)
```

#### Cloudinary (All Environments - Same)

```
Name: CLOUDINARY_URL
Value: cloudinary://<api_key>:<api_secret>@<cloud_name>
Environments: ☑ Production ☑ Preview ☑ Development
```

```
Name: CLOUDINARY_CLOUD_NAME
Value: <your-cloud-name>
Environments: ☑ Production ☑ Preview ☑ Development
```

```
Name: CLOUDINARY_API_KEY
Value: <your-api-key>
Environments: ☑ Production ☑ Preview ☑ Development
```

```
Name: CLOUDINARY_API_SECRET
Value: <your-api-secret>
Environments: ☑ Production ☑ Preview ☑ Development
Type: Secret (encrypted)
```

```
Name: CLOUDINARY_WATERMARK_PUBLIC_ID
Value: pawtraits_watermark_logo
Environments: ☑ Production ☑ Preview ☑ Development
```

```
Name: CLOUDINARY_WATERMARK_OPACITY
Value: 20
Environments: ☑ Production ☑ Preview ☑ Development
```

```
Name: CLOUDINARY_BRAND_LOGO_PUBLIC_ID
Value: pawtraits_brand_logo
Environments: ☑ Production ☑ Preview ☑ Development
```

#### Base URL Configuration

**Production:**
```
Name: NEXT_PUBLIC_BASE_URL
Value: https://pawtraits.pics
Environments: ☑ Production
```

```
Name: QR_CODE_BASE_URL
Value: https://pawtraits.pics/shop
Environments: ☑ Production
```

**Preview:**
```
Name: NEXT_PUBLIC_BASE_URL
Value: https://${VERCEL_URL}
Environments: ☑ Preview ☑ Development
```

```
Name: QR_CODE_BASE_URL
Value: https://${VERCEL_URL}/shop
Environments: ☑ Preview ☑ Development
```

#### Environment Indicator

```
Name: NEXT_PUBLIC_ENVIRONMENT
Value: production
Environments: ☑ Production
```

```
Name: NEXT_PUBLIC_ENVIRONMENT
Value: preview
Environments: ☑ Preview ☑ Development
```

#### QR Code Default Discount

```
Name: QR_CODE_DEFAULT_DISCOUNT
Value: 10
Environments: ☑ Production ☑ Preview ☑ Development
```

## Step 4: Configure Production Domain

### 4.1 Add Custom Domain (Production Only)

1. Go to **Settings → Domains**
2. Click **Add Domain**
3. Enter your domain: `pawtraits.pics`
4. Follow DNS configuration instructions
5. Also add `www.pawtraits.pics` and set redirect to `pawtraits.pics`

### 4.2 Staging Domain

The staging deployment will automatically get a Vercel domain:
- Format: `staging-pawtraits.vercel.app` or `<branch-name>-pawtraits.vercel.app`
- You can optionally add a custom subdomain like `staging.pawtraits.com`

## Step 5: Configure Webhook URLs in Stripe

### 5.1 Production Webhook

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Enter URL: `https://pawtraits.pics/api/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.dispute.created`
5. Copy the **Signing secret** and add to Vercel environment variables (Production)

### 5.2 Staging/Preview Webhook

1. In Stripe Dashboard (Test Mode), add webhook endpoint
2. Enter URL: `https://staging-pawtraits.vercel.app/api/webhooks/stripe`
3. Select same events as production
4. Copy the **Signing secret** and add to Vercel environment variables (Preview)

## Step 6: Deploy Staging Branch

### 6.1 Push Staging Branch

```bash
# Ensure you're on staging branch
git checkout staging

# Push to GitHub
git push -u origin staging
```

### 6.2 Verify Deployment

1. Vercel will automatically detect the new branch and create a preview deployment
2. Go to **Deployments** tab in Vercel Dashboard
3. You should see a deployment for the `staging` branch
4. Click to view the deployment URL (will be something like `staging-pawtraits.vercel.app`)
5. Test the deployment

### 6.3 Understanding Branch Deployments

**How Vercel Handles Branches:**

- **Production Branch** (typically `main`):
  - Deploys to your production domain (pawtraits.pics)
  - Uses "Production" environment variables

- **All Other Branches** (including `staging`):
  - Create preview deployments
  - Get automatic Vercel URLs: `<branch-name>-<project>.vercel.app`
  - Use "Preview" environment variables

- **Configuration Location**:
  - View which branch is production: **Settings → General → Production Branch**
  - Cannot be changed in Settings → Git (that just shows connection status)

**Note:** The `staging` branch will automatically get preview deployments with the URL format `staging-pawtraits.vercel.app`. To assign a custom domain to staging, see Step 4.2.

## Step 7: Test the Setup

### 7.1 Test Production

1. Visit `https://pawtraits.pics`
2. Verify no environment banner appears (production)
3. Test a small purchase with live Stripe
4. Verify webhook receives events

### 7.2 Test Staging

1. Visit `https://staging-pawtraits.vercel.app`
2. Verify **yellow "STAGING ENVIRONMENT" banner** appears
3. Test purchase with test Stripe card: `4242 4242 4242 4242`
4. Verify test webhook receives events

### 7.3 Test Preview Deployments

1. Create a new feature branch: `git checkout -b feature/test-preview`
2. Make a small change and commit
3. Push to GitHub: `git push -u origin feature/test-preview`
4. Vercel automatically creates preview deployment
5. Visit the preview URL (shown in GitHub PR or Vercel dashboard)
6. Verify **blue "PREVIEW ENVIRONMENT" banner** appears with branch name

## Step 8: Workflow Going Forward

### Development Workflow

```bash
# 1. Create feature branch from staging
git checkout staging
git pull origin staging
git checkout -b feature/your-feature-name

# 2. Develop and test locally
npm run dev

# 3. Push to GitHub - automatic preview deployment
git add .
git commit -m "feat: your feature"
git push -u origin feature/your-feature-name

# 4. Test on preview URL (check Vercel dashboard or GitHub)

# 5. Create PR to staging
# GitHub: Create Pull Request → base: staging ← compare: feature/your-feature-name

# 6. Merge to staging - automatic staging deployment
# Test on staging

# 7. Create PR from staging to main
# GitHub: Create Pull Request → base: main ← compare: staging

# 8. Merge to main - automatic production deployment
```

### Hotfix Workflow

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-fix

# 2. Fix and test locally
npm run dev

# 3. Push - automatic preview deployment
git push -u origin hotfix/critical-fix

# 4. Test on preview

# 5. Merge directly to main (skip staging for critical fixes)
# GitHub: Create Pull Request → base: main ← compare: hotfix/critical-fix

# 6. Backport to staging
git checkout staging
git cherry-pick <hotfix-commit-sha>
git push origin staging
```

## Troubleshooting

### Git Settings Look Different

**Current Vercel UI (2025):**
- **Settings → Git** only shows "Connected Git Repository" card
- No options to enable/disable automatic deployments (always enabled)
- Production branch is set in **Settings → General** not in Git settings
- All branches automatically create preview deployments when pushed

**What You'll See:**
- Settings → Git: Shows connection status only
- Settings → General: Shows which branch is production
- Deployments tab: Shows all deployment history by branch

### Environment Variable Not Working

1. Ensure variable is added to correct environment (Production/Preview/Development)
2. Redeploy the project after adding variables (Vercel caches env vars)
3. Check variable name matches exactly (case-sensitive)
4. For changes to take effect, trigger a new deployment by pushing a commit

### Branch Deployment Not Working

1. Go to **Deployments** tab to see if deployment was triggered
2. If no deployment appears:
   - Check Git connection in **Settings → Git**
   - Ensure repository permissions allow Vercel access
   - Check for build errors in deployment logs
3. All branches automatically create preview deployments (no setting to enable/disable)

### Stripe Webhook Not Receiving Events

1. Check webhook URL is correct
2. Ensure events are selected in Stripe dashboard
3. Check signing secret matches Vercel environment variable
4. Test webhook with Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

### Database Changes Not Reflected

⚠️ Remember: All environments use the same production database
- Database migrations affect all environments immediately
- Test migrations carefully on staging first
- Consider adding environment checks for destructive operations

## Security Best Practices

1. ✅ Never commit `.env.local` files (contains real secrets)
2. ✅ Reference files (`.env.production`, `.env.staging`, `.env.preview`) contain only placeholders
3. ✅ Rotate API keys periodically
4. ✅ Use different Stripe keys for production vs preview
5. ✅ Monitor Vercel deployment logs for security issues
6. ✅ Enable Vercel's Built-in Security Headers
7. ✅ Use environment-specific webhook secrets

## Monitoring

### Vercel Analytics

Enable Vercel Analytics:
1. Go to **Analytics** tab
2. Click **Enable Analytics**
3. Monitor:
   - Page load times
   - Error rates
   - Geographic distribution
   - Device types

### Deployment Notifications

Set up Slack/Email notifications:
1. Go to **Settings → Notifications**
2. Add Slack webhook or email
3. Configure for:
   - Deployment started
   - Deployment successful
   - Deployment failed

## Next Steps

- [ ] Set up branch protection rules on GitHub (require PR reviews)
- [ ] Configure automatic preview deployment comments on PRs
- [ ] Set up Vercel's built-in monitoring alerts
- [ ] Create runbook for common deployment scenarios
- [ ] Document rollback procedures
- [ ] Consider setting up separate staging database (future enhancement)

## Support

If you need help:
- Vercel Documentation: https://vercel.com/docs
- Vercel Support: support@vercel.com
- GitHub Issues: Create an issue in the repository
