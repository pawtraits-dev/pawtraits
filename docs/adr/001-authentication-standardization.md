# ADR-001: Authentication Pattern Standardization

**Status**: Adopted
**Date**: 2025-01-19
**Context**: Mixed authentication patterns causing user interaction failures

## Problem

The codebase had inconsistent authentication patterns across API routes:

1. **Cookie-based auth**: `createRouteHandlerClient` with cookies (cart, orders, auth)
2. **Bearer token auth**: Manual token extraction and validation (interactions, referrals)
3. **Email validation auth**: Cookie auth + email parameter validation (user-interactions)

This inconsistency caused:
- User interactions recording with `user_id: null`
- Gallery not displaying liked/shared images
- Authentication failures in different contexts
- Increased complexity and maintenance burden

## Decision

**Standardize on cookie-based authentication** for all server-side API routes:

```typescript
// ✅ STANDARD PATTERN
const cookieStore = await cookies();
const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
const { data: { user } } = await supabase.auth.getUser();
```

## Rationale

**Cookie-based authentication chosen because:**

1. **Already working**: Most APIs (cart, orders, auth) used this successfully
2. **More secure**: HTTP-only cookies, built-in CSRF protection
3. **Simpler frontend**: No manual token management required
4. **Next.js best practice**: Recommended pattern for App Router
5. **Supabase integration**: Seamless with Supabase Auth Helpers

**Alternatives considered and rejected:**

- **Bearer tokens**: Added complexity, manual token management, security concerns
- **Mixed patterns**: Confusing, error-prone, maintenance overhead

## Consequences

### Positive
- ✅ Consistent authentication across all routes
- ✅ Proper user association for user interactions
- ✅ Simplified frontend code (no token handling)
- ✅ Better security through HTTP-only cookies
- ✅ Reduced cognitive load for developers

### Negative
- ❌ Required refactoring existing Bearer token routes
- ❌ All requests must include cookies (minor overhead)

## Implementation

### Phase 1: API Routes
- Updated `/api/interactions/route.ts` to use cookies
- Updated `/api/user-interactions/route.ts` to use cookies
- Removed Bearer token logic

### Phase 2: Frontend
- Added `credentials: 'include'` to all fetch calls
- Removed manual token extraction from localStorage
- Simplified request handling

## Validation

**Success metrics:**
- User interactions properly record `user_id`
- Gallery displays liked/shared images correctly
- All authentication flows use same pattern
- ESLint rules prevent pattern violations

## Future Considerations

- All new API routes must use this pattern
- ESLint rules enforce compliance
- Templates provide correct implementation
- Documentation maintains pattern consistency

## References

- `docs/patterns/authentication.md` - Implementation details
- `docs/templates/api-route.ts` - Template with correct pattern
- `.eslintrc.json` - Enforcement rules