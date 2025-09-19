# Authentication Patterns

## 🎯 **STANDARD PATTERN: Cookie-Based Authentication**

**Use for**: All server-side API routes (`app/api/**/route.ts`)

### ✅ **CORRECT Implementation**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET/POST/PUT/DELETE(request: NextRequest) {
  try {
    // ✅ Standard cookie-based authentication
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ User is authenticated, proceed with business logic
    console.log('Authenticated user:', user.id, user.email);

    // Your API logic here...

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 📋 **Frontend Requirements**

Frontend requests automatically include cookies:

```typescript
// ✅ CORRECT: Cookies included automatically
const response = await fetch('/api/your-endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Ensures cookies are sent
  body: JSON.stringify(data)
});
```

## 🚨 **ANTI-PATTERNS (DO NOT USE)**

### ❌ **Client-Side Auth in Server Context**

```typescript
// ❌ WRONG: Using client-side service in API route
import { SupabaseService } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const supabaseService = new SupabaseService(); // ❌ Client-side in server
  const { data: { user } } = await supabaseService.getClient().auth.getUser(); // ❌ No cookies context
}
```

### ❌ **Manual Bearer Token Handling**

```typescript
// ❌ WRONG: Manual token extraction and handling
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization'); // ❌ Unnecessary complexity
  const token = authHeader?.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token); // ❌ Manual token handling
}
```

### ❌ **Mixed Authentication Strategies**

```typescript
// ❌ WRONG: Using different auth patterns in the same codebase
// Some routes use cookies, others use headers, others use email validation
```

## 🔧 **Special Cases**

### **Email-Based Validation (Customer APIs)**

For customer-facing APIs that need email validation:

```typescript
export async function GET(request: NextRequest) {
  // Get email parameter
  const { searchParams } = new URL(request.url);
  const customerEmail = searchParams.get('email');

  // ✅ Standard cookie auth first
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();

  // ✅ Then validate email matches
  if (!user?.email || user.email !== customerEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Proceed with logic...
}
```

## 🎯 **Key Benefits**

- **Consistent**: All routes use same pattern
- **Secure**: HTTP-only cookies, CSRF protection
- **Simple**: No manual token management
- **Reliable**: Built-in session handling

## 🔍 **Validation Checklist**

Before committing authentication code:

- [ ] Uses `createRouteHandlerClient` with cookies
- [ ] No manual token extraction from headers
- [ ] No `SupabaseService` in API routes
- [ ] Frontend includes `credentials: 'include'`
- [ ] Proper error handling for auth failures