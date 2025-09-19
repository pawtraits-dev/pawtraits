# Data Access Patterns

## 🎯 **ARCHITECTURAL PRINCIPLE: API-Only Data Access**

**Frontend components NEVER access database directly. All data flows through API endpoints.**

```
✅ CORRECT FLOW:
Frontend Component → API Endpoint → Database
```

```
❌ WRONG FLOW:
Frontend Component → Database (Direct)
```

## 🏗️ **User-Type Specific Patterns**

### **Admin Routes (`/admin/*`)**

```typescript
// ✅ CORRECT: Use AdminSupabaseService
import { AdminSupabaseService } from '@/lib/admin-supabase';

const adminService = new AdminSupabaseService();
const product = await adminService.getProduct(productId);
const orders = await adminService.getOrders();
```

### **Customer Routes (`/customer/*`)**

```typescript
// ✅ CORRECT: Use API endpoints with email authentication
const { data: { user } } = await supabaseService.getClient().auth.getUser();
const response = await fetch(`/api/shop/products/${id}?email=${user.email}`);
const response = await fetch(`/api/shop/orders?email=${user.email}`);
```

### **Partner Routes (`/partners/*`)**

```typescript
// ✅ CORRECT: Use API endpoints with cookie-based authentication
const response = await fetch('/api/referrals', {
  credentials: 'include'
});
```

## 🚨 **ANTI-PATTERNS (DO NOT USE)**

### ❌ **Direct Database Access in Components**

```typescript
// ❌ WRONG: Direct Supabase queries in React components
export default function MyComponent() {
  const { data } = await supabaseService.getClient()
    .from('products').select('*').eq('id', productId);

  // ❌ This violates the API-only architecture
}
```

### ❌ **Mixed Access Patterns**

```typescript
// ❌ WRONG: Using admin service in customer components
const product = await adminService.getProduct(id); // ❌ WRONG in customer routes

// ❌ WRONG: Bypassing API layer
const { data } = await supabase.from('orders').select('*'); // ❌ WRONG in components

// ❌ WRONG: Direct database access from frontend
import { createClient } from '@supabase/supabase-js'; // ❌ WRONG in components
```

## ✅ **Correct Implementation Examples**

### **Customer Product Display**

```typescript
// ✅ Component: API call only
export default function ProductPage({ productId }: { productId: string }) {
  const [product, setProduct] = useState(null);

  useEffect(() => {
    async function loadProduct() {
      const user = await getCurrentUser();
      const response = await fetch(`/api/shop/products/${productId}?email=${user.email}`);
      const productData = await response.json();
      setProduct(productData);
    }
    loadProduct();
  }, [productId]);

  // Render component...
}
```

```typescript
// ✅ API Route: Database access with proper auth
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();

  // Database query here...
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  return NextResponse.json(product);
}
```

## 🔧 **Service Layer Usage**

### **When to Use SupabaseService**

```typescript
// ✅ CORRECT: Only for authentication checks in components
const supabaseService = new SupabaseService();
const userProfile = await supabaseService.getCurrentUserProfile();
const { data: { user } } = await supabaseService.getClient().auth.getUser();
```

### **When to Use AdminSupabaseService**

```typescript
// ✅ CORRECT: Only in admin components and admin API routes
const adminService = new AdminSupabaseService();
const allOrders = await adminService.getOrders();
```

## 🛡️ **Security Boundaries**

### **Data Flow Security Model**

```
🔒 Frontend (Public)
    ↓ (API calls only)
🔐 API Routes (Authentication Layer)
    ↓ (Database queries)
🗄️ Database (RLS Protected)
```

**Key Principles:**
- **Frontend**: UI logic only, no database secrets
- **API Routes**: Authentication, authorization, database access
- **Database**: Row Level Security (RLS) as final protection

## 🔍 **Validation Checklist**

Before committing data access code:

- [ ] No direct `.from()` calls in React components
- [ ] No `createClient()` imports in frontend components
- [ ] All database access goes through API routes
- [ ] Proper user-type specific patterns followed
- [ ] Authentication handled at API layer, not frontend
- [ ] Service classes used appropriately for their context

## 📋 **Quick Reference**

| Context | Data Access Pattern |
|---------|-------------------|
| **Admin Components** | AdminSupabaseService methods |
| **Customer Components** | `/api/shop/*` endpoints with email |
| **Partner Components** | `/api/partners/*` endpoints with cookies |
| **API Routes** | Direct database queries with auth |
| **Service Classes** | Auth checks only, no business logic in components |