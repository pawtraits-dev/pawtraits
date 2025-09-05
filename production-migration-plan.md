# Production Migration Plan: pawtraits.pics

## Overview
Migration from temporary Vercel deployment to production domain `pawtraits.pics` with comprehensive infrastructure review and optimization.

## Current Architecture
- **Hosting**: Vercel (temp URL)
- **Database**: Single Supabase environment
- **Image Storage**: Single Cloudinary environment  
- **Payments**: Stripe (test/production keys TBD)
- **AI Services**: Gemini API, Claude API
- **Framework**: Next.js 15 with App Router

## Pre-Migration Checklist

### 1. Environment Audit
**Current Status**: Single environment for all services

#### Supabase Configuration
- [ ] Verify production Supabase project is configured
- [ ] Review all RLS (Row Level Security) policies for production readiness
- [ ] Test database performance under expected load
- [ ] Backup current database schema and data
- [ ] Verify all API keys and service role permissions
- [ ] Test database functions: `mark_referral_accessed`, `mark_referral_accepted`, etc.

#### Cloudinary Configuration  
- [ ] Confirm production Cloudinary account has sufficient bandwidth/storage quotas
- [ ] Review transformation quotas for AI upscaling (4096px transformations)
- [ ] Verify image delivery performance from global CDN
- [ ] Test upload API limits and batch processing
- [ ] Confirm watermark assets are uploaded to production account

### 2. API Service Readiness
#### Gemini API
- [ ] Verify production API key with sufficient quota
- [ ] Test current service availability (monitor status page)
- [ ] Review rate limiting settings for batch processing
- [ ] Confirm `gemini-2.5-flash-image-preview` model access

#### Claude API (Anthropic)
- [ ] Verify production API key for prompt generation
- [ ] Test description generation endpoints
- [ ] Review usage quotas for production load

#### Stripe Configuration
- [ ] **CRITICAL**: Switch from test to production Stripe keys
- [ ] Update webhook endpoints to pawtraits.pics domain
- [ ] Verify webhook events: `payment_intent.succeeded`, `payment_intent.payment_failed`
- [ ] Test payment flow end-to-end with real card (small amount)

## Migration Steps

### Phase 1: Infrastructure Preparation (Day 1-2)

#### Vercel Project Configuration
```bash
# 1. Add custom domain
vercel domains add pawtraits.pics
vercel domains add www.pawtraits.pics

# 2. Configure environment variables for production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add CLOUDINARY_CLOUD_NAME production
vercel env add CLOUDINARY_API_KEY production
vercel env add CLOUDINARY_API_SECRET production
vercel env add STRIPE_SECRET_KEY production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add GEMINI_API_KEY production
vercel env add CLAUDE_API_KEY production
```

#### DNS Configuration
**At Domain Registrar (pawtraits.pics)**:
```
Type: A
Name: @
Value: 76.76.19.61 (Vercel IP - verify current)

Type: CNAME  
Name: www
Value: pawtraits.pics

Type: TXT
Name: @
Value: [Vercel verification record]
```

#### Production Environment Variables
```bash
# Supabase - Production Project
NEXT_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-role-key

# Cloudinary - Production Account
CLOUDINARY_CLOUD_NAME=your-prod-cloud-name
CLOUDINARY_API_KEY=your-prod-api-key  
CLOUDINARY_API_SECRET=your-prod-api-secret

# Stripe - PRODUCTION KEYS
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_... (new webhook for pawtraits.pics)

# AI Services - Production Keys
GEMINI_API_KEY=your-prod-gemini-key
CLAUDE_API_KEY=your-prod-claude-key
```

### Phase 2: Database Migration Strategy

#### Option A: Single Environment (Current)
**Pros**: Simplicity, no data migration needed
**Cons**: Dev and prod share same database

**Steps**:
- [ ] Review all RLS policies for production security
- [ ] Clean up test data if needed
- [ ] Set up database monitoring and alerts
- [ ] Configure automated backups

#### Option B: Separate Production Database (Recommended)
**Pros**: Better isolation, cleaner production data
**Cons**: Requires data migration

**Steps**:
```sql
-- Create new Supabase production project
-- Export schema from current project
pg_dump --schema-only current_db > schema.sql

-- Import to production
psql production_db < schema.sql

-- Migrate essential data (exclude test data)
-- Users, breeds, coats, themes, styles, formats, etc.
```

### Phase 3: Domain Migration (Migration Day)

#### Step 1: Stripe Webhook Update (Critical First Step)
```bash
# Before DNS change, create new webhook in Stripe Dashboard:
# URL: https://pawtraits.pics/api/webhooks/stripe
# Events: payment_intent.succeeded, payment_intent.payment_failed, etc.
```

#### Step 2: DNS Propagation
- [ ] Update DNS records
- [ ] Monitor propagation: `dig pawtraits.pics`
- [ ] Test SSL certificate generation (automatic via Vercel)

#### Step 3: Functionality Testing
```bash
# Test all critical paths:
# 1. User registration (all types: admin, partner, customer)
# 2. Image generation and variation creation  
# 3. Shop functionality and product pricing
# 4. Payment processing (test with small real payment)
# 5. Referral system
# 6. Admin catalog management
```

### Phase 4: Performance Optimization

#### Vercel Configuration Updates
```json
// vercel.json - Production optimizations
{
  "functions": {
    "app/api/admin/generate-variations/route.ts": {
      "maxDuration": 300,
      "memory": 1024
    },
    "app/api/admin/save-variations/route.ts": {
      "maxDuration": 120,
      "memory": 512
    }
  },
  "regions": ["cle1"],
  "buildCommand": "npm run build",
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=60, stale-while-revalidate=300"
        }
      ]
    }
  ]
}
```

#### Database Performance
- [ ] Enable connection pooling in Supabase
- [ ] Review query performance for large datasets
- [ ] Set up database monitoring and alerts
- [ ] Configure automated daily backups

#### Cloudinary Optimization
- [ ] Enable auto-optimization for web delivery
- [ ] Configure responsive image delivery
- [ ] Set up usage monitoring and alerts
- [ ] Verify bandwidth limits for expected traffic

### Phase 5: Monitoring & Analytics

#### Application Monitoring
```bash
# Vercel Analytics
vercel analytics enable

# Error tracking
# Consider: Sentry, LogRocket, or built-in Vercel monitoring
```

#### Business Metrics
- [ ] Google Analytics 4 integration
- [ ] Conversion tracking for shop purchases
- [ ] User interaction analytics (existing in codebase)
- [ ] Partner referral performance tracking

## Security Considerations

### Production Security Review
- [ ] All environment variables use production values
- [ ] Supabase RLS policies tested with production data
- [ ] CORS settings appropriate for pawtraits.pics domain
- [ ] CSP (Content Security Policy) headers updated
- [ ] API rate limiting configured

### Data Protection
- [ ] GDPR compliance review
- [ ] User data retention policies
- [ ] Payment data handling (PCI compliance via Stripe)
- [ ] Image rights and usage terms

## Rollback Strategy

### Immediate Rollback (DNS Level)
```bash
# If critical issues occur, revert DNS:
# Point pawtraits.pics back to temp URL
# Update time: 5-10 minutes
```

### Application Rollback
```bash
# Vercel deployment rollback
vercel rollback [deployment-url]

# Database rollback (if separate prod DB)
# Restore from pre-migration backup
```

## Post-Migration Tasks (Week 1)

### Performance Monitoring
- [ ] Monitor page load times
- [ ] Track API response times
- [ ] Monitor database query performance
- [ ] Review Cloudinary bandwidth usage

### User Testing
- [ ] Test all user journeys end-to-end
- [ ] Verify payment processing works correctly
- [ ] Test image generation and variation system
- [ ] Validate referral system functionality

### SEO & Marketing
- [ ] Update Google Search Console for new domain
- [ ] Submit sitemap to search engines  
- [ ] Update social media links
- [ ] Update any external integrations

## Critical Dependencies

### External Services Status
- **Gemini API**: Monitor https://ai.google.dev/status for availability
- **Stripe**: Verify webhook delivery and payment processing
- **Cloudinary**: Monitor image delivery performance
- **Vercel**: Platform status and deployment health

### Code Dependencies
- **React 19**: Ensure `--legacy-peer-deps` flag used for installs
- **Database Migrations**: All schema changes deployed
- **API Endpoints**: All routes tested and functional

## Success Metrics

### Technical KPIs
- [ ] Zero downtime migration
- [ ] Page load time < 3 seconds
- [ ] API response time < 2 seconds
- [ ] 99.9% uptime in first week

### Business KPIs  
- [ ] Payment processing success rate > 95%
- [ ] Image generation success rate > 90%
- [ ] User registration flow completion > 80%
- [ ] Partner referral tracking accuracy 100%

## Emergency Contacts

### Service Providers
- **Vercel Support**: Dashboard or GitHub issues
- **Supabase Support**: Dashboard support tickets
- **Stripe Support**: Dashboard chat or phone
- **Domain Registrar**: Account dashboard

### Key Files for Migration
- `/vercel.json` - Deployment configuration
- `/app/api/webhooks/stripe/route.ts` - Payment processing
- `/lib/supabase.ts` - Database connections
- `CLAUDE.md` - Environment setup documentation

## Timeline Estimate
- **Preparation**: 1-2 days (testing, backups, verification)
- **Migration**: 4-6 hours (domain setup, DNS propagation)  
- **Monitoring**: 1 week intensive, ongoing thereafter
- **Optimization**: Ongoing based on usage patterns

## Notes
- Keep temporary URL active during transition for rollback capability
- Gemini API currently has availability issues - plan migration when stable
- Consider gradual traffic migration using DNS TTL settings
- Monitor user feedback channels for any post-migration issues

---

**Next Step**: Review this plan and confirm which approach you prefer for database (single vs separate production environment) and timeline for migration.