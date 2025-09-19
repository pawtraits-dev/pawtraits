# 🏗️ Architecture Compliance Checklist

**Use this checklist before implementing any feature to ensure architectural consistency.**

## 🔐 Authentication (Required for all user-facing features)

### **Server-Side API Routes (`app/api/**/route.ts`)**
- [ ] Uses `createRouteHandlerClient` with cookies
- [ ] Imports `cookies` from `'next/headers'`
- [ ] No `SupabaseService` imports
- [ ] No `createClientComponentClient` imports
- [ ] No manual Bearer token handling
- [ ] Proper error handling for auth failures (401)
- [ ] Logs authenticated user info for debugging

### **Frontend Components**
- [ ] Uses `SupabaseService` ONLY for authentication checks
- [ ] No direct `createClient` from `@supabase/supabase-js`
- [ ] All data access through API endpoints
- [ ] Includes `credentials: 'include'` in fetch calls
- [ ] Proper loading states during API calls

**📖 Reference**: `docs/patterns/authentication.md`

---

## 🗄️ Data Access (Critical architectural boundary)

### **Component Data Access**
- [ ] No `.from()` calls in React components
- [ ] No direct database queries in frontend
- [ ] All data flows through API endpoints
- [ ] Uses appropriate user-type patterns:
  - **Admin**: AdminSupabaseService methods
  - **Customer**: `/api/shop/*` with email param
  - **Partner**: `/api/partners/*` with cookies

### **API Route Data Access**
- [ ] Database queries only in API routes
- [ ] Proper RLS policies respected
- [ ] User association for data isolation
- [ ] Error handling for database failures

**📖 Reference**: `docs/patterns/data-access.md`

---

## 👤 User Type Patterns

### **Admin Routes (`/admin/*`)**
- [ ] Uses `AdminSupabaseService` methods
- [ ] No direct API calls to customer endpoints
- [ ] Admin-only navigation components

### **Customer Routes (`/customer/*`)**
- [ ] API calls with `?email=` parameter
- [ ] Email validation in API routes
- [ ] Customer-specific data scoping

### **Partner Routes (`/partners/*`)**
- [ ] Cookie-based API authentication
- [ ] Partner-specific data isolation
- [ ] Commission tracking integration

**📖 Reference**: `CLAUDE.md` - User Type System section

---

## 🌐 API Design (RESTful consistency)

### **Endpoint Patterns**
- [ ] RESTful resource naming (`/api/[resource]/[id]`)
- [ ] Consistent HTTP methods (GET, POST, PUT, DELETE)
- [ ] Proper status codes (200, 201, 400, 401, 404, 500)
- [ ] Standardized error response format

### **Request/Response Format**
- [ ] JSON content type headers
- [ ] Consistent error object structure: `{ error: string }`
- [ ] Proper parameter validation
- [ ] Request logging for debugging

---

## 🛡️ Security (Data protection)

### **Authentication Security**
- [ ] No tokens in client-side code
- [ ] HTTP-only cookies for session management
- [ ] CSRF protection through cookie strategy
- [ ] Proper logout handling

### **Data Security**
- [ ] Row Level Security (RLS) policies active
- [ ] User data isolation by user_id
- [ ] No sensitive data in client logs
- [ ] Input validation and sanitization

---

## 📱 Frontend Architecture

### **Component Structure**
- [ ] Clear separation of concerns
- [ ] API calls in useEffect or event handlers
- [ ] Proper error boundaries
- [ ] Consistent loading states

### **State Management**
- [ ] Local state for component data
- [ ] Context for shared authentication state
- [ ] No global database state

---

## 🚀 Performance & UX

### **Loading States**
- [ ] Loading indicators during API calls
- [ ] Error states with retry options
- [ ] Optimistic updates where appropriate
- [ ] Proper cache invalidation

### **Error Handling**
- [ ] User-friendly error messages
- [ ] Console logging for debugging
- [ ] Graceful degradation
- [ ] Network error handling

---

## 🧪 Testing Readiness

### **API Testing**
- [ ] Clear API endpoint documentation
- [ ] Predictable error responses
- [ ] Consistent authentication patterns
- [ ] Database transaction safety

### **Component Testing**
- [ ] Mockable API interfaces
- [ ] Testable business logic
- [ ] Clear component responsibilities

---

## 📋 Pre-Commit Checklist

**Before committing code, verify:**

### **Automated Checks**
- [ ] `npm run lint` passes (includes architectural rules)
- [ ] `npm run type-check` passes
- [ ] No ESLint architectural violations
- [ ] All imports resolve correctly

### **Manual Review**
- [ ] Follows established patterns in `docs/patterns/`
- [ ] Uses templates from `docs/templates/` as reference
- [ ] No architectural anti-patterns introduced
- [ ] Consistent with existing codebase style

### **Documentation**
- [ ] Complex patterns documented
- [ ] API changes noted
- [ ] Breaking changes highlighted

---

## 🔧 Quick Pattern References

### **Need Authentication?**
```typescript
// API Route
const cookieStore = await cookies();
const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
const { data: { user } } = await supabase.auth.getUser();
```

### **Need Data in Component?**
```typescript
// Component
const response = await fetch('/api/endpoint', { credentials: 'include' });
```

### **Need Database Query?**
```typescript
// API Route Only
const { data } = await supabase.from('table').select('*');
```

---

## ⚡ Enforcement Tools

- **ESLint Rules**: Automatic detection of violations
- **File Templates**: Copy correct patterns from `docs/templates/`
- **Pattern Docs**: Reference implementations in `docs/patterns/`
- **Architecture Subagent**: Use for complex architectural questions

---

**🎯 Goal**: Every feature follows the same architectural patterns, making the codebase predictable, maintainable, and secure.