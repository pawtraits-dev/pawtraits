# 🏗️ Architecture Documentation

This directory contains architectural governance tools to ensure consistent development patterns.

## 📁 Directory Structure

```
docs/
├── README.md                 # This file - overview of architectural governance
├── ARCHITECTURE_CHECKLIST.md # Pre-implementation compliance checklist
├── patterns/                 # Detailed pattern documentation
│   ├── authentication.md     # Cookie-based auth patterns
│   └── data-access.md        # API-only data access patterns
├── templates/                # Code templates with correct patterns
│   ├── api-route.ts          # Standard API route template
│   └── component-with-api.tsx # Standard component template
└── adr/                      # Architectural Decision Records
    └── 001-authentication-standardization.md
```

## 🎯 Quick Start Guide

### Before Implementing ANY Feature:

1. **📋 Review Checklist**: Read `ARCHITECTURE_CHECKLIST.md`
2. **📖 Check Patterns**: Reference relevant docs in `patterns/`
3. **📝 Use Templates**: Copy from `templates/` as starting point
4. **🔧 Run Linting**: ESLint catches architectural violations

### Common Tasks:

| Task | Reference |
|------|-----------|
| **New API Route** | `templates/api-route.ts` + `patterns/authentication.md` |
| **Component with Data** | `templates/component-with-api.tsx` + `patterns/data-access.md` |
| **Authentication Issues** | `patterns/authentication.md` |
| **Database Access** | `patterns/data-access.md` |

## 🛡️ Enforcement Tools

### **ESLint Rules**
Automatic detection of architectural violations in `.eslintrc.json`:

```bash
npm run lint  # Catches violations like:
# ❌ Direct createClient in components
# ❌ SupabaseService in API routes
# ❌ Client auth in server contexts
```

### **Error Messages**
ESLint provides helpful guidance:
```
❌ ARCHITECTURAL VIOLATION: Direct database queries in components.
Use API endpoints instead. See docs/patterns/data-access.md
```

## 🚨 Key Anti-Patterns to Avoid

### **Authentication**
```typescript
// ❌ WRONG: Manual token handling
const token = request.headers.get('authorization');

// ✅ CORRECT: Cookie-based auth
const cookieStore = await cookies();
const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
```

### **Data Access**
```typescript
// ❌ WRONG: Direct DB in components
const { data } = await supabase.from('table').select('*');

// ✅ CORRECT: API endpoint
const response = await fetch('/api/endpoint', { credentials: 'include' });
```

## 📊 Pattern Adoption Status

### ✅ **Standardized Patterns**
- **Authentication**: Cookie-based across all routes
- **Data Access**: API-only architecture
- **User Types**: Role-based routing patterns
- **Error Handling**: Consistent response formats

### 🔄 **Enforcement Active**
- **ESLint Rules**: Prevent architectural violations
- **Templates**: Provide correct starting points
- **Documentation**: Clear guidance for all patterns
- **ADRs**: Record architectural decisions

## 🎯 Benefits Achieved

1. **Consistency**: All routes follow same patterns
2. **Maintainability**: Predictable code structure
3. **Security**: Standardized authentication approach
4. **Developer Experience**: Clear guidance and templates
5. **Quality**: Automated violation detection

## 🔄 Process Integration

### **Development Workflow**
1. **Before coding**: Check `ARCHITECTURE_CHECKLIST.md`
2. **During coding**: Use templates and patterns
3. **Before commit**: Run `npm run lint`
4. **Architecture review**: Use architectural subagent for complex cases

### **New Pattern Addition**
1. Identify new pattern need
2. Document in `patterns/`
3. Create template if needed
4. Add ESLint rule if enforceable
5. Create ADR for significant decisions

## 🧰 Tools & Commands

```bash
# Run architectural linting
npm run lint

# Type checking
npm run type-check

# Copy template for new API route
cp docs/templates/api-route.ts app/api/new-endpoint/route.ts

# Copy template for new component
cp docs/templates/component-with-api.tsx components/NewComponent.tsx
```

## 📞 Getting Help

- **Pattern Questions**: Check `patterns/` documentation
- **Implementation Help**: Use templates in `templates/`
- **Complex Architecture**: Use architectural subagent
- **Violations**: ESLint errors include documentation links

## 🎖️ Success Metrics

The architectural governance is successful when:
- ✅ New features follow established patterns automatically
- ✅ ESLint catches violations before code review
- ✅ Developers can find correct patterns quickly
- ✅ Code reviews focus on business logic, not architecture
- ✅ Maintenance is predictable and straightforward

---

**🏗️ Goal**: Make following good architecture easier than not following it.