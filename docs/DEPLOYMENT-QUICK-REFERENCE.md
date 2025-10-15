# Vercel Deployment Quick Reference

## 🚀 Quick Start

### Current Branch Structure

```
main (production)          ← pawtraits.pics
  ├── staging              ← staging-pawtraits.vercel.app
  └── feature/* branches   ← <branch>-pawtraits.vercel.app (auto-preview)
```

## 📋 Environment Summary

| Environment | Branch | URL | Database | Stripe | Auto-Deploy | Banner |
|------------|--------|-----|----------|--------|-------------|--------|
| **Production** | `main` | pawtraits.pics | Production | Live Keys | ✅ | None |
| **Staging** | `staging` | staging-pawtraits.vercel.app | Production | Test Keys | ✅ | 🟡 Yellow |
| **Preview** | feature/* | <branch>-pawtraits.vercel.app | Production | Test Keys | ✅ | 🔵 Blue |
| **Development** | local | localhost:3000 | Local/Prod | Test Keys | N/A | 🟢 Green |

## 🔧 Common Tasks

### Deploy to Staging

```bash
git checkout staging
git pull origin staging
git merge feature/your-feature  # or cherry-pick commits
git push origin staging
# ✅ Auto-deploys to staging-pawtraits.vercel.app
```

### Deploy to Production

```bash
git checkout main
git pull origin main
git merge staging
git push origin main
# ✅ Auto-deploys to pawtraits.com
```

### Create Preview Deployment

```bash
git checkout -b feature/new-feature
# Make changes
git add .
git commit -m "feat: new feature"
git push -u origin feature/new-feature
# ✅ Auto-creates preview at feature-new-feature-pawtraits.vercel.app
```

### View Deployments

```bash
# Using Vercel CLI (optional)
vercel ls

# Or visit Vercel Dashboard:
# https://vercel.com/your-team/pawtraits/deployments
```

## 🔑 Environment Variables

### Where to Set Them

1. **Vercel Dashboard** → Settings → Environment Variables
2. Select environment: Production, Preview, or Development
3. Click "Add Another" and configure

### Critical Variables by Environment

#### Production Only
- `STRIPE_SECRET_KEY=sk_live_...`
- `STRIPE_WEBHOOK_SECRET=whsec_production_...`
- `NEXT_PUBLIC_BASE_URL=https://pawtraits.pics`

#### Preview/Staging Only
- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_preview_...`
- `NEXT_PUBLIC_BASE_URL=https://${VERCEL_URL}`

#### All Environments (Same Values)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLAUDE_API_KEY`
- `GEMINI_API_KEY`
- `CLOUDINARY_*`

## 🎯 Testing Checklist

### Before Merging to Staging
- [ ] Feature works on preview deployment
- [ ] No console errors
- [ ] Test with Stripe test card: `4242 4242 4242 4242`
- [ ] Check environment banner shows "PREVIEW"
- [ ] Database operations work correctly
- [ ] Build completes successfully

### Before Merging to Production
- [ ] Feature tested on staging
- [ ] No console errors on staging
- [ ] All stakeholders reviewed
- [ ] Performance tested
- [ ] Check environment banner shows "STAGING"
- [ ] Customer flows tested end-to-end
- [ ] Admin features tested (if applicable)

### After Deploying to Production
- [ ] No environment banner visible (production)
- [ ] Test critical user flows
- [ ] Verify Stripe webhook receives events
- [ ] Check error monitoring (Vercel Dashboard)
- [ ] Monitor first 15 minutes of traffic

## 🔐 Stripe Webhooks

### Production Webhook
- URL: `https://pawtraits.pics/api/webhooks/stripe`
- Key: `whsec_production_...` (from Stripe Dashboard)
- Mode: Live

### Staging/Preview Webhook
- URL: `https://staging-pawtraits.vercel.app/api/webhooks/stripe`
- Key: `whsec_preview_...` (from Stripe Test Mode)
- Mode: Test

### Test Webhook Locally
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## 🚨 Rollback Procedure

### If Production Has Issues

1. **Quick Rollback** (Vercel Dashboard):
   - Go to Deployments
   - Find last working deployment
   - Click "..." → "Promote to Production"

2. **Git Rollback**:
   ```bash
   git checkout main
   git revert <bad-commit-sha>
   git push origin main
   # Auto-deploys reverted version
   ```

## 🔍 Monitoring

### Vercel Dashboard

- **Real-time Logs**: Deployments → Click deployment → Logs tab
- **Analytics**: Analytics tab (page views, errors, performance)
- **Functions**: Functions tab (API route metrics)

### Useful URLs

- Production: https://pawtraits.pics
- Staging: https://staging-pawtraits.vercel.app
- Vercel Dashboard: https://vercel.com/dashboard
- GitHub Repo: [Your repo URL]

## 💡 Pro Tips

1. **Preview Every PR**: Always create a preview deployment before merging
2. **Test Staging First**: Never skip staging for features (hotfixes exception)
3. **Monitor After Deploy**: Watch logs for 15 minutes after production deploy
4. **Use Meaningful Commits**: Makes rollback easier to identify good version
5. **Environment Banners**: If you see a banner in production, something is wrong!
6. **Database Caution**: All environments share production database - be careful!

## 📞 Emergency Contacts

- **Vercel Status**: https://www.vercel-status.com
- **Support**: support@vercel.com
- **Team Lead**: [Your contact info]

## 📚 Full Documentation

For complete setup instructions, see:
- [`docs/VERCEL-DEPLOYMENT-SETUP.md`](./VERCEL-DEPLOYMENT-SETUP.md)

---

**Last Updated**: October 2025
