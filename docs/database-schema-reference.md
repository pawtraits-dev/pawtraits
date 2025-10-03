# Database Schema Reference

Generated: 2025-10-03T10:23:54.106Z

This document provides the actual database schema for the influencer system.
**Use this as the source of truth when writing tests and implementing features.**

## Purpose

This schema reference prevents assumptions about database structure by documenting
the actual schema as it exists in the database. Always refer to this document
when writing tests or implementing features that interact with the database.

## Tables

### influencers

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | text | ❌ | - |
| email | text | ❌ | - |
| first_name | text | ❌ | - |
| last_name | text | ❌ | - |
| username | text | ❌ | - |
| bio | text | ❌ | - |
| avatar_url | text | ✅ | - |
| phone | text | ✅ | - |
| is_active | text | ❌ | - |
| is_verified | text | ❌ | - |
| commission_rate | numeric | ❌ | - |
| payment_method | text | ✅ | - |
| payment_details | text | ✅ | - |
| notification_preferences | text | ❌ | - |
| approval_status | text | ❌ | - |
| approved_by | text | ✅ | - |
| approved_at | text | ✅ | - |
| rejection_reason | text | ✅ | - |
| last_login_at | text | ✅ | - |
| created_at | text | ❌ | - |
| updated_at | text | ❌ | - |

**Column Count:** 21

### influencer_social_channels

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | text | ❌ | - |
| influencer_id | text | ❌ | - |
| platform | text | ❌ | - |
| username | text | ❌ | - |
| profile_url | text | ✅ | - |
| follower_count | numeric | ❌ | - |
| engagement_rate | text | ✅ | - |
| verified | text | ❌ | - |
| is_primary | text | ❌ | - |
| is_active | text | ❌ | - |
| last_updated | text | ❌ | - |
| created_at | text | ❌ | - |

**Column Count:** 12

### influencer_referral_codes

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | text | ❌ | - |
| influencer_id | text | ❌ | - |
| code | text | ❌ | - |
| qr_code_url | text | ✅ | - |
| description | text | ❌ | - |
| usage_count | numeric | ❌ | - |
| conversion_count | numeric | ❌ | - |
| total_revenue | numeric | ❌ | - |
| total_commission | numeric | ❌ | - |
| is_active | text | ❌ | - |
| expires_at | text | ✅ | - |
| created_at | text | ❌ | - |
| updated_at | text | ❌ | - |

**Column Count:** 13

### influencer_referrals

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | unknown | ❌ | - |
| referral_code_id | unknown | ❌ | - |
| customer_email | unknown | ❌ | - |
| status | unknown | ❌ | - |
| amount | unknown | ❌ | - |
| commission_amount | unknown | ❌ | - |
| created_at | unknown | ❌ | - |
| updated_at | unknown | ❌ | - |

**Column Count:** 8

## Development Guidelines

### Before Writing Tests
1. **Always check this document** for actual column names and types
2. **Do not assume** relationships or column names
3. **Validate your assumptions** using this schema reference

### When Schema Changes
1. Run `npm run validate:schema` to update this documentation
2. Update any affected tests to match new schema
3. Commit both code changes and updated schema documentation

### Test Data Structure
When creating test data, use the exact column names and types documented above.

Example for influencers table:
```javascript
const testInfluencer = {
  // Use actual column names from schema above
  first_name: 'John',        // ✅ Correct
  last_name: 'Doe',          // ✅ Correct
  email: 'john@example.com', // ✅ Correct
  // user_id: 'abc123',      // ❌ Wrong - this column doesn't exist
};
```

This approach eliminates false assumptions and reduces debugging time.
