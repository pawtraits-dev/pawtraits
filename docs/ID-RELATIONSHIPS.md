# Database ID Relationships - Verified Documentation

**Last Updated:** 2025-01-12
**Verified Against:** Production database with 18 partners, 22 customers

## Overview

This document defines the **verified** relationships between `user_profiles`, `partners`, and `customers` tables. This eliminates assumptions and provides a single source of truth for ID lookups.

## Table Relationships

### Partners → User Profiles

```
partners.id (UUID) ← user_profiles.partner_id (UUID)
                  ≠ user_profiles.id (UUID)

✅ VERIFIED: partners.id = user_profiles.partner_id (NOT user_profiles.id)
```

**Example:**
- Partner p-020: `partners.id` = `2f35baaf-6896-4a16-86df-19208ae93f97`
- Has `user_profiles.partner_id` = `2f35baaf-6896-4a16-86df-19208ae93f97`
- But `user_profiles.id` = different UUID

**Query Pattern:**
```sql
-- ✅ CORRECT: Lookup partner by user_profiles.id
SELECT p.* FROM partners p
JOIN user_profiles up ON p.id = up.partner_id
WHERE up.id = :user_profile_id;

-- ❌ WRONG: This won't work
SELECT * FROM partners WHERE id = :user_profile_id;
```

### Customers → User Profiles

```
customers.id (UUID) ← user_profiles.customer_id (UUID)
customers.user_id (UUID) = user_profiles.user_id (UUID) → auth.users.id
                         ≠ user_profiles.id (UUID)
```

**Example (c-016):**
- `customers.id` = `58b1e760-ef18-48a4-90a0-8393ff181a35`
- `customers.user_id` = `f231f3e4-f75f-4fd3-b5bf-9d4239b7e927` (auth.users.id)
- `user_profiles.id` = `8a26cea9-9638-4eab-aeac-2b354ca0a017` ← **URL parameter**
- `user_profiles.user_id` = `f231f3e4-f75f-4fd3-b5bf-9d4239b7e927` (auth.users.id)
- `user_profiles.customer_id` = `58b1e760-ef18-48a4-90a0-8393ff181a35` (customers.id)

**Query Patterns:**
```sql
-- ✅ CORRECT: Lookup customer by user_profiles.id
SELECT c.* FROM customers c
JOIN user_profiles up ON c.id = up.customer_id
WHERE up.id = :user_profile_id;

-- ✅ ALSO CORRECT: Lookup by user_id
SELECT c.* FROM customers c
JOIN user_profiles up ON c.user_id = up.user_id
WHERE up.id = :user_profile_id;

-- ❌ WRONG: This won't work
SELECT * FROM customers WHERE id = :user_profile_id;
SELECT * FROM customers WHERE user_id = :user_profile_id;
```

## Admin Routing Pattern

Admin pages use `user_profiles.id` in URLs:
- `/admin/partners/[user_profiles.id]`
- `/admin/customers/[user_profiles.id]`

**Why?** Admin customer list queries `user_profiles` table and returns `user_profiles.id` as the primary identifier.

## API Implementation Patterns

### Partner Attribution API
```typescript
// /app/api/admin/partners/[id]/attribution/route.ts
// id = user_profiles.id from URL

// ✅ CORRECT: Join through user_profiles
const { data: partner } = await supabase
  .from('partners')
  .select('personal_referral_code, business_name')
  .eq('id', (
    await supabase
      .from('user_profiles')
      .select('partner_id')
      .eq('id', id)
      .single()
  ).data.partner_id)
  .single();

// OR use a JOIN query
const { data: partner } = await supabase
  .from('user_profiles')
  .select('partners!inner(personal_referral_code, business_name)')
  .eq('id', id)
  .single();
```

### Customer Attribution API
```typescript
// /app/api/admin/customers/[id]/attribution/route.ts
// id = user_profiles.id from URL

// ✅ CORRECT: Join through user_profiles
const { data: customer } = await supabase
  .from('customers')
  .select('personal_referral_code, email')
  .eq('id', (
    await supabase
      .from('user_profiles')
      .select('customer_id')
      .eq('id', id)
      .single()
  ).data.customer_id)
  .single();

// OR use a JOIN query
const { data: customer } = await supabase
  .from('user_profiles')
  .select('customers!inner(personal_referral_code, email)')
  .eq('id', id)
  .single();
```

## Verification Queries

Run these to verify relationships in any environment:

```sql
-- 1. Verify partner relationships
SELECT
  COUNT(*) as total_partners,
  COUNT(CASE WHEN p.id = up.partner_id THEN 1 END) as correct_relationships,
  COUNT(CASE WHEN p.id = up.id THEN 1 END) as incorrect_assumptions
FROM partners p
LEFT JOIN user_profiles up ON p.id = up.partner_id;

-- 2. Verify customer relationships
SELECT
  COUNT(*) as total_customers,
  COUNT(CASE WHEN c.user_id = up.user_id THEN 1 END) as matching_user_ids,
  COUNT(CASE WHEN c.id = up.customer_id THEN 1 END) as matching_customer_ids
FROM customers c
LEFT JOIN user_profiles up ON c.id = up.customer_id;

-- 3. Test specific customer lookup (replace ID with actual user_profiles.id)
SELECT
  up.id as url_parameter,
  c.id as customers_id,
  c.user_id as customers_user_id,
  c.email,
  c.personal_referral_code
FROM user_profiles up
JOIN customers c ON c.id = up.customer_id
WHERE up.id = '8a26cea9-9638-4eab-aeac-2b354ca0a017';
```

## Common Mistakes to Avoid

❌ **Assuming `partners.id` = `user_profiles.id`**
- They are different UUIDs with a foreign key relationship

❌ **Querying `customers` table with `user_profiles.id` directly**
- Must join through `user_profiles.customer_id`

❌ **Querying `customers.user_id` = `user_profiles.id`**
- `customers.user_id` = `auth.users.id` = `user_profiles.user_id` (NOT `user_profiles.id`)

## Summary Table

| URL Parameter | Table to Query | Join Condition |
|---------------|----------------|----------------|
| `user_profiles.id` | `partners` | `partners.id = (SELECT partner_id FROM user_profiles WHERE id = ?)` |
| `user_profiles.id` | `customers` | `customers.id = (SELECT customer_id FROM user_profiles WHERE id = ?)` |

**Bottom Line:** Never assume IDs match across tables. Always join properly through `user_profiles`.
