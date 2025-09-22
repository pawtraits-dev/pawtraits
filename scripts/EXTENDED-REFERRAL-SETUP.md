# Extended Referral System Database Setup Guide

This guide will help you set up the extended referral system in your Supabase database.

## 📋 Prerequisites

- Access to Supabase SQL Editor
- Admin permissions to run DDL statements
- Existing Pawtraits database with current schema

## 🗄️ Database Scripts Overview

### Files Created:
1. **`extended-referral-system-migration.sql`** - Main migration script
2. **`extended-referral-functions.sql`** - Database functions
3. **`extended-referral-rls-policies.sql`** - Security policies

## 🚀 Installation Steps

### Step 1: Run Main Migration
Execute `extended-referral-system-migration.sql` in Supabase SQL Editor:

**What it does:**
- Creates 4 new tables for the extended referral system
- Extends existing `referrals` and `customers` tables
- Adds performance indexes
- Sets up triggers for timestamp updates
- Enables RLS on new tables

**New Tables Created:**
- `pre_registration_codes` - For partner acquisition via QR codes
- `customer_referrals` - Customer-to-customer referral tracking
- `customer_credits` - Customer credit balance management
- `customer_credit_transactions` - Credit transaction history

### Step 2: Install Database Functions
Execute `extended-referral-functions.sql` in Supabase SQL Editor:

**Functions Added:**
- **Pre-registration:** `create_pre_registration_code()`, `use_pre_registration_code()`
- **Customer referrals:** `create_customer_referral()`, `track_customer_referral_access()`
- **Credit management:** `award_referral_credit()`, `apply_customer_credits()`
- **Utilities:** `get_customer_referral_stats()`, `expire_old_referrals()`

### Step 3: Apply Security Policies
Execute `extended-referral-rls-policies.sql` in Supabase SQL Editor:

**Security Features:**
- Row Level Security policies for all new tables
- Admin access controls
- Customer data isolation
- Public access for QR code scanning
- Service role permissions for API operations

## 📊 New Database Schema

### Pre-Registration Codes Table
```sql
pre_registration_codes (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE,
    status 'active' | 'used' | 'expired' | 'deactivated',
    business_category VARCHAR(100),
    expiration_date TIMESTAMP,
    marketing_campaign VARCHAR(255),
    partner_id UUID, -- Set when used
    scans_count INTEGER DEFAULT 0,
    conversions_count INTEGER DEFAULT 0
)
```

### Customer Referrals Table
```sql
customer_referrals (
    id UUID PRIMARY KEY,
    referrer_customer_id UUID, -- Who made the referral
    referee_customer_id UUID,  -- Who was referred
    referral_code VARCHAR(50) UNIQUE,
    referee_email VARCHAR(255),
    status 'pending' | 'accessed' | 'signed_up' | 'purchased' | 'credited',
    credit_amount INTEGER, -- Credits earned by referrer
    order_id UUID, -- Order that triggered credit
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '90 days')
)
```

### Customer Credits Table
```sql
customer_credits (
    id UUID PRIMARY KEY,
    customer_id UUID UNIQUE,
    total_earned INTEGER DEFAULT 0,
    available_balance INTEGER DEFAULT 0,
    pending_credits INTEGER DEFAULT 0
)
```

## 🔧 Key Features Implemented

### Multi-Tier Referral System
- **Admin → Partner:** Pre-registration codes for partner acquisition
- **Partner → Customer:** Existing system enhanced with new tracking
- **Customer → Friend:** New customer referral system with credit rewards

### QR Code Integration
- Pre-registration QR codes for partner acquisition
- Customer referral QR codes for sharing
- Scan tracking and analytics

### Credit System
- 20% credit reward for successful customer referrals
- Credit balance tracking and transaction history
- Automatic credit application during checkout

### Commission Structure
- **Partner referrals:** 20% commission (first order), 5% (subsequent)
- **Customer referrals:** 20% credit reward (zero cash cost)
- **Multi-level attribution** tracking

## 🔒 Security Features

### Row Level Security (RLS)
- All new tables have comprehensive RLS policies
- Users can only access their own data
- Admins have oversight access
- Public access limited to necessary operations

### Data Validation
- Referral code format validation
- Non-negative credit constraints
- Status transition validation
- Expiration date enforcement

## 📈 Analytics & Tracking

### Metrics Available
- Pre-registration code performance
- Customer referral conversion rates
- Credit earn/usage patterns
- Multi-tier attribution data

### Database Functions for Analytics
- `get_customer_referral_stats()` - Individual customer metrics
- Scan and conversion tracking
- Commission calculations
- Credit transaction history

## 🧪 Testing the Setup

After running all scripts, you can test with:

```sql
-- Create a test pre-registration code
SELECT create_pre_registration_code(
    'TESTVET001',
    'Veterinarian',
    NOW() + INTERVAL '30 days',
    'Q1 2024 Campaign'
);

-- Check if it was created
SELECT * FROM pre_registration_codes WHERE code = 'TESTVET001';

-- Test customer referral creation (replace with actual customer ID)
SELECT * FROM create_customer_referral(
    'customer-uuid-here',
    'friend@example.com'
);
```

## 🚨 Post-Installation Tasks

1. **Update Application Code:**
   - Extend TypeScript types
   - Create API endpoints
   - Build admin interfaces
   - Update customer portal

2. **Test Thoroughly:**
   - Pre-registration flow
   - Customer referral flow
   - Credit system
   - Commission calculations

3. **Configure Monitoring:**
   - Set up alerts for failed referrals
   - Monitor credit system usage
   - Track conversion rates

## 📞 Support

If you encounter any issues during setup:

1. Check the Supabase logs for detailed error messages
2. Verify all prerequisites are met
3. Ensure scripts are run in the correct order
4. Contact the development team if problems persist

## 🎉 What's Next?

After successful database setup:

1. **Admin Portal Development** - Build interfaces for managing pre-registration codes
2. **Customer Referral System** - Create customer-facing referral tools
3. **Enhanced QR Generation** - Implement brand-styled QR codes for print
4. **API Integration** - Build endpoints for the new referral flows
5. **Testing & Validation** - Comprehensive testing of all referral scenarios

---

**Database setup complete!** 🎊 Your extended referral system is ready for application integration.