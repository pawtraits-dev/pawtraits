# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 MANDATORY DEVELOPMENT PROCESS

**CRITICAL**: This process MUST be followed for ALL development tasks. No exceptions.

### Step 1: Requirements Understanding ✅
Before starting ANY implementation:
- [ ] Read and understand the complete user request
- [ ] Ask clarifying questions if requirements are ambiguous
- [ ] Identify all affected components, pages, and API routes
- [ ] Determine scope and complexity of changes needed

### Step 2: Schema Validation & Implementation Planning 📋
**🚨 CRITICAL**: Schema validation prevents false assumptions about database structure.
Before writing ANY code:
- [ ] **VALIDATE DATABASE SCHEMA**: Run `npm run validate:schema` to generate current schema documentation
- [ ] **REVIEW SCHEMA REFERENCE**: Check `docs/database-schema-reference.md` for actual table structure
- [ ] **NO ASSUMPTIONS**: Use actual column names and types from schema documentation
- [ ] Document the planned approach in detail
- [ ] Identify which files will be modified/created
- [ ] Plan the data flow: Frontend → API → Database
- [ ] Map out authentication and authorization requirements
- [ ] Consider error handling and edge cases

### Step 3: Architectural Compliance Validation ⚖️
**MANDATORY CHECKPOINT** - Validate against established patterns:
- [ ] **API-Only Data Access**: No direct database/RPC calls from pages/components
- [ ] **Authentication Flow**: Use existing API endpoints (e.g., `/api/auth/check`)
- [ ] **Data Layer Separation**: Frontend → API Routes → Database Services
- [ ] **User Type Routing**: Follow established user-aware patterns
- [ ] **Component Reuse**: Use existing components where possible
- [ ] **Security Boundaries**: Proper authentication and authorization
- [ ] **Error Handling**: Consistent error patterns across the application

### Step 4: Implementation ⚙️
Only after Steps 1-3 are complete:
- [ ] Use TodoWrite tool to track implementation progress
- [ ] Follow established code patterns and naming conventions
- [ ] Implement error handling and loading states
- [ ] Add appropriate logging for debugging
- [ ] Write clean, readable code with minimal comments unless necessary

### Step 5: Quality Assurance 🧪
After implementation, ALWAYS:
- [ ] Run `npm run build` to ensure no compilation errors
- [ ] Run `npm run lint` to check code quality
- [ ] Test the implementation manually if possible
- [ ] Verify no architectural governance violations
- [ ] Check that error handling works correctly

### Step 6: Documentation & Commit 📝
Before presenting work:
- [ ] Update TodoWrite with completion status
- [ ] Document any new patterns or deviations
- [ ] Create clear commit messages with architectural context
- [ ] Push changes only after successful build and lint

## ❌ RED FLAGS - STOP IMMEDIATELY IF:
- Planning to make direct database calls from components/pages
- Creating new authentication patterns instead of using existing ones
- Bypassing established API endpoints
- Not following existing user-type routing patterns
- Creating duplicate functionality that already exists
- **Writing tests without validating database schema first**
- **Making assumptions about column names or table structure**
- **Using SupabaseService.getCurrentPartner/getCurrentCustomer in API routes** (causes RLS infinite recursion)
- **Using SupabaseService or createClientComponentClient() in API routes** (causes auth failures)

## 🏗️ ARCHITECTURAL GOVERNANCE CHECKPOINTS

Every implementation MUST pass these checks:

**Data Access Pattern**:
```
✅ CORRECT: Component → API Endpoint → Database Service
❌ WRONG:   Component → Direct Database/RPC Call
```

**Authentication Pattern**:
```
✅ CORRECT: Use /api/auth/check or existing endpoints
❌ WRONG:   Direct Supabase auth calls from components
```

**User Type Routing**:
```
✅ CORRECT: Unified pages with user-type aware routing
❌ WRONG:   Separate pages for each user type
```

**Database Schema Validation**:
```
✅ CORRECT: Run npm run validate:schema → Check docs/database-schema-reference.md → Use actual column names
❌ WRONG:   Assume database structure → Write tests based on assumptions → Debug schema mismatches
```

## 📋 PROCESS EXAMPLE

When receiving a request like "Fix the orders page authentication":

**Step 1: Requirements**
- User reports orders page redirecting to login when they're already authenticated
- Need to investigate why server-side authentication is failing
- Must maintain existing user-type aware routing

**Step 2: Planning**
```
FILES TO INVESTIGATE:
- app/orders/page.tsx (main page)
- components/orders/* (view components)
- app/api/auth/* (authentication endpoints)

PLANNED APPROACH:
- Check current authentication flow in orders page
- Identify if using client-side vs server-side auth patterns
- Verify if following API-only data access pattern
- Plan fix using existing API endpoints
```

**Step 3: Architectural Validation**
```
COMPLIANCE CHECK:
✅ Will use /api/auth/check endpoint (existing)
✅ No direct database calls planned
✅ Maintains server-side rendering pattern
✅ Follows user-type aware routing
❌ STOP: Currently planning direct RPC call - REVISE APPROACH
```

**Step 4-6: Implementation, QA, Commit**
Only proceed after Step 3 passes all checks.

## 🔍 DATABASE SCHEMA VALIDATION SYSTEM

### Problem Solved
Previously, tests failed because they were written based on assumptions about database structure rather than actual schema. For example:
- **Assumption**: Tests expected `user_id` column in influencers table
- **Reality**: Influencers table uses standalone structure without `user_id`
- **Result**: Time wasted debugging test failures instead of real functionality

### Solution: Schema-First Development
**New Command**: `npm run validate:schema`

**What it does**:
1. **Connects to actual database** and reads current schema
2. **Generates documentation** at `docs/database-schema-reference.md`
3. **Validates expected vs actual** column names and types
4. **Prevents false assumptions** by providing source of truth

### When to Run Schema Validation
**MANDATORY** in these situations:
- [ ] Before writing tests for new database features
- [ ] After any database migrations
- [ ] When onboarding new developers
- [ ] Before implementing features that touch the database
- [ ] As part of CI/CD pipeline (recommended)

### Example Workflow
```bash
# 1. Validate current schema
npm run validate:schema

# 2. Check generated documentation
cat docs/database-schema-reference.md

# 3. Write tests using ACTUAL column names
const testInfluencer = {
  first_name: 'John',        // ✅ Actual column name
  last_name: 'Doe',          // ✅ From schema doc
  email: 'john@example.com', // ✅ Verified exists
  // user_id: 'abc123',      // ❌ This column doesn't exist
};

# 4. No more schema assumption failures!
npm run test:influencers
```

### Benefits
- **Eliminates debugging time** wasted on schema mismatches
- **Provides single source of truth** for database structure
- **Catches breaking changes** early in development process
- **Improves developer onboarding** with actual schema docs
- **Enables confident test writing** with verified column names

## 🔒 ACCOUNTABILITY & ENFORCEMENT

**FOR CLAUDE CODE:**
- MUST state "Following mandatory development process" when starting work
- MUST explicitly validate Steps 1-3 before implementation
- MUST ask for approval if any architectural uncertainty exists
- MUST use TodoWrite tool throughout process
- NO EXCEPTIONS: Process violation = immediate work stoppage

**FOR REVIEWER:**
- Has authority to halt work if process not followed
- Can request re-planning if architectural concerns exist
- Expects explicit process validation before implementation proceeds

## Development Commands

```bash
# Development server
npm run dev

# Build for production  
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Type checking
npm run type-check

# Install dependencies (required for React 19 compatibility)
npm install --legacy-peer-deps

# Database schema validation (prevents false assumptions)
npm run validate:schema                 # Generate current schema documentation

# Utility testing scripts (run with tsx from scripts/ directory)
tsx scripts/test-cloudinary.ts          # Test Cloudinary integration
tsx scripts/test-watermark.ts           # Test watermark functionality  
tsx scripts/test-api-routes.ts          # Test API route structure
tsx scripts/validate-api-structure.ts   # Validate API structure
tsx scripts/upload-watermark.ts         # Upload watermark assets
tsx scripts/migrate-to-cloudinary.ts    # Migrate to Cloudinary storage
tsx scripts/check-storage-structure.ts  # Check storage structure
tsx scripts/test-component-updates.ts   # Test component updates
tsx scripts/debug-env.ts                # Debug environment variables
tsx scripts/debug-sales-data.ts         # Debug sales data and analytics
tsx scripts/load-countries.ts           # Load country/pricing data
tsx scripts/upload-brand-logo.ts        # Upload brand assets
tsx scripts/test-image-variants.ts      # Test image variation generation
tsx scripts/test-image-security.ts      # Test image security and access
tsx scripts/setup-hero-images-bucket.ts # Setup hero image storage
tsx scripts/run-carousel-migration.ts   # Migrate carousel data

# Enhanced Cart & Gelato Integration Tests
./scripts/run-step1-tests.sh            # Run all Step 1 enhanced cart tests
tsx scripts/test-enhanced-cart.ts       # Test enhanced cart data structure
tsx scripts/test-cart-api-integration.ts # Test cart API integration with enhanced data

# Database Management & Migration Scripts
tsx scripts/create-batch-tables-direct.ts # Create batch processing tables
tsx scripts/fix-foreign-key-constraint.ts # Fix foreign key constraints
tsx scripts/debug-partner-lookup.ts     # Debug partner lookup functionality

# End-to-End Testing (Playwright)
npx playwright test                      # Run all E2E tests
npx playwright test --ui                 # Run tests with UI mode
npx playwright test --headed             # Run tests in headed mode
npx playwright show-report               # View test results
```

## Environment Setup

### Required Environment Variables
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Claude AI
CLAUDE_API_KEY=your_claude_api_key

# Google GenAI (for image variations)
GEMINI_API_KEY=your_gemini_api_key
```

### Stripe Webhook Configuration
For payment processing to work properly:
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select these events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.dispute.created`

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth with custom user types
- **UI**: React 19, Tailwind CSS, Radix UI components
- **TypeScript**: Strict mode enabled
- **AI Integration**: Anthropic Claude SDK for prompt generation
- **Image Storage**: Cloudinary for optimized image delivery
- **Print Fulfillment**: Gelato integration for physical products

## 🏗️ CRITICAL ARCHITECTURAL PATTERNS - MUST FOLLOW

### Prerender Error Prevention (CRITICAL)

**❌ Common Build-Breaking Pattern:**
```typescript
// ❌ NEVER: Direct Supabase client initialization in component body
'use client'
import { getSupabaseClient } from '@/lib/supabase-client'

export default function MyComponent() {
  const supabase = getSupabaseClient() // ❌ Causes "Cannot access 'y' before initialization"
  // ...
}
```

**✅ Correct Patterns:**
```typescript
// ✅ OPTION 1: Use API endpoints (PREFERRED)
'use client'
export default function MyComponent() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('/api/my-endpoint')
      .then(res => res.json())
      .then(setData)
  }, [])
}

// ✅ OPTION 2: Initialize in useEffect if absolutely needed
'use client'
export default function MyComponent() {
  useEffect(() => {
    const supabase = getSupabaseClient() // ✅ Safe inside useEffect
    // Use supabase here...
  }, [])
}
```

**⚠️ Dependency Array Management:**
Circular dependencies in React Hooks cause prerender failures:

```typescript
// ❌ WRONG: Circular dependencies
const funcA = useCallback(() => funcB(), [funcB])
const funcB = useCallback(() => funcA(), [funcA]) // ❌ Circular!

// ✅ CORRECT: Break circular dependencies
const funcA = useCallback(() => {
  // Inline the logic instead of calling funcB
}, [])
const funcB = useCallback(() => {
  // Inline the logic instead of calling funcA
}, [])
```

### Data Access Layer Architecture

**✅ CORRECT PATTERNS - ALWAYS USE THESE:**

#### Admin Routes (`/admin/*`)
```typescript
// ✅ CORRECT: Use AdminSupabaseService
import { AdminSupabaseService } from '@/lib/admin-supabase';

const adminService = new AdminSupabaseService();
const product = await adminService.getProduct(productId);      // ✅ Good
const orders = await adminService.getOrders();                 // ✅ Good  
const media = await adminService.getMedia();                   // ✅ Good
```

#### Customer Routes (`/customer/*`)
```typescript
// ✅ CORRECT: Use API endpoints with email authentication
const { data: { user } } = await supabaseService.getClient().auth.getUser();
const response = await fetch(`/api/shop/products/${id}?email=${user.email}`);  // ✅ Good
const response = await fetch(`/api/shop/orders?email=${user.email}`);          // ✅ Good
```

#### Partner Routes (`/partners/*`)
```typescript
// ✅ CORRECT: Use API endpoints with bearer token authentication
const { data: { session } } = await supabase.auth.getSession();
const response = await fetch('/api/referrals', {
  headers: { 'Authorization': `Bearer ${session.access_token}` }
});  // ✅ Good
```

**❌ ANTI-PATTERNS - NEVER DO THESE:**

```typescript
// ❌ NEVER: Direct Supabase queries in frontend components
const { data } = await supabaseService.getClient()
  .from('products').select('*').eq('id', productId);           // ❌ WRONG

// ❌ NEVER: Mixing admin and customer access patterns  
const product = await adminService.getProduct(id);             // ❌ WRONG in customer routes

// ❌ NEVER: Bypassing the API layer
const { data } = await supabase.from('orders').select('*');    // ❌ WRONG

// ❌ NEVER: Direct database access from frontend
import { createClient } from '@supabase/supabase-js';          // ❌ WRONG in components
```

### Authentication Flow Patterns

**🚨 CRITICAL: Authentication Consistency Rule**

Each user type MUST use consistent authentication patterns across ALL their routes:

**✅ Server-Side Authentication Pattern** (Pages that need SEO/immediate security):
```typescript
// Server Component (no 'use client')
export default async function MyPage() {
  const supabaseService = new SupabaseService();
  const userProfile = await supabaseService.getCurrentUserProfile();

  if (!userProfile) {
    redirect('/auth/login');
  }

  // Render based on user type...
}
```

**✅ Client-Side Authentication Pattern** (Interactive pages):
```typescript
// Client Component ('use client')
export default function MyPage() {
  return (
    <UserAccessControl allowedUserTypes={['partner']}>
      <MyPageContent />
    </UserAccessControl>
  );
}

function MyPageContent() {
  const { userProfile } = useUserRouting();
  // Render content...
}
```

**❌ NEVER MIX THESE PATTERNS within the same user type routes!**

**Why Consistency Matters:**
- Mixed patterns create different auth failure behaviors
- Server-side fails before rendering → immediate redirect
- Client-side renders first → shows loading then auth check
- Users experience confusing inconsistent behavior
- Debugging becomes complex with different failure modes

**✅ Frontend Authentication (All Routes)**
```typescript
// ✅ CORRECT: Only use SupabaseService for auth checks
const supabaseService = new SupabaseService();
const userProfile = await supabaseService.getCurrentUserProfile();
const { data: { user } } = await supabaseService.getClient().auth.getUser();
```

**✅ API Route Authentication**
```typescript
// ✅ CORRECT: Validate auth in API routes, not frontend
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const customerEmail = searchParams.get('email');

  const supabaseService = new SupabaseService();
  const { data: { user } } = await supabaseService.getClient().auth.getUser();

  if (!user?.email || user.email !== customerEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... proceed with data access
}
```

### Security Boundaries & Data Flow

**🔒 SECURITY PRINCIPLE: Frontend → API Routes → Database**
- **Frontend components** only handle UI and call API endpoints
- **API routes** handle authentication, authorization, and database access  
- **Database access** only happens in API routes or service classes

**✅ Correct Data Flow Examples:**

```
Customer Order Details Page:
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │───▶│  /api/shop/      │───▶│   SupabaseService│
│   Component     │    │  orders/[id]     │    │   + Database    │
└─────────────────┘    └──────────────────┘    └─────────────────┘

Admin Product Management:
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin         │───▶│ AdminSupabase    │───▶│   API Routes    │
│   Component     │    │ Service          │    │   + Database    │  
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

**❌ Wrong Data Flow (NEVER DO):**
```
┌─────────────────┐                           ┌─────────────────┐
│   Frontend      │──────────────────────────▶│   Database      │
│   Component     │    (Direct Supabase)      │   Direct Access │
└─────────────────┘                           └─────────────────┘
```

### API Endpoint Patterns

**✅ Customer APIs (Public with Email Auth)**
- `/api/shop/orders/[id]?email=user@example.com`
- `/api/shop/products/[id]?email=user@example.com`  
- `/api/customers/pets/[id]` (with Bearer token)

**✅ Partner APIs (Bearer Token Auth)**
- `/api/referrals` (with Authorization header)
- `/api/partners/[id]/analytics` (with Bearer token)

**✅ Admin APIs (Service Role Access)**
- Used via `AdminSupabaseService` methods
- `/api/admin/products`, `/api/admin/orders`, etc.
- Never called directly from customer/partner frontend

**❌ NEVER create direct database access patterns:**
```typescript
// ❌ NEVER DO THIS in any frontend component
const supabase = createClient(url, key);
const { data } = await supabase.from('table').select();
```

### API Route Client Patterns - CRITICAL FOR AUTHENTICATION

**🚨 CRITICAL: Proper Client Types for API Routes**

API routes MUST use different Supabase clients than frontend components. Using the wrong client type causes authentication failures.

**✅ CORRECT: Use createRouteHandlerClient for Authentication in API Routes**
```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  // ✅ CORRECT: Route handler client reads cookies properly in API routes
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  // ✅ Authentication works correctly
  const { data: { user }, error } = await supabase.auth.getUser();

  // ✅ Use service role client for database operations to bypass RLS
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
```

**❌ WRONG: Never Use SupabaseService or Client Component Clients in API Routes**
```typescript
// ❌ This will fail with "Auth session missing!"
import { SupabaseService } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const supabaseService = new SupabaseService(); // ❌ Uses createClientComponentClient()
  const { data: { user } } = await supabaseService.getClient().auth.getUser(); // ❌ FAILS
}
```

**Why This Matters:**
- **createClientComponentClient()**: Designed for browser/React components, cannot read server cookies
- **createRouteHandlerClient()**: Designed for API routes, properly reads cookies from request headers
- **Service Role Client**: Bypasses RLS for database operations

### Service Role Client Pattern for Database Operations

**🚨 CRITICAL: RLS Infinite Recursion Prevention**

When implementing API endpoints that need to query user data (user_profiles, partners, customers), **ALWAYS use service role client** for database operations to bypass RLS policy conflicts.

**✅ CORRECT API Route Pattern:**
```typescript
// /app/api/partners/profile/route.ts
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  // ✅ Use service role client for database operations
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const supabaseService = new SupabaseService();

  // ✅ Still use regular client for authentication
  const { data: { user }, error: authError } =
    await supabaseService.getClient().auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // ✅ Use service role client for database queries
  const { data: userProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('email', user.email)
    .single();

  // ... rest of logic
}
```

**❌ WRONG Pattern - Causes RLS Infinite Recursion:**
```typescript
// ❌ This will fail with "infinite recursion detected in policy"
export async function GET(request: NextRequest) {
  const supabaseService = new SupabaseService();

  // ❌ This calls getCurrentUserProfile() which triggers RLS recursion
  const partner = await supabaseService.getCurrentPartner();
}
```

**Why This Pattern is Required:**
- **RLS Policies**: Row Level Security policies on `user_profiles` can create circular dependencies
- **Authentication vs Authorization**: Auth check uses regular client, data access uses service role
- **Security Maintained**: Authentication still enforced, but database queries bypass problematic RLS
- **Performance**: Avoids complex RLS policy evaluation that can cause recursion

**When to Use Service Role Client:**
- ✅ **API routes** that query user-related tables (`user_profiles`, `partners`, `customers`)
- ✅ **Cross-table joins** that involve user data
- ✅ **Complex queries** that might trigger RLS policy conflicts
- ✅ **Admin operations** that need to bypass user-scoped RLS

**When NOT to Use:**
- ❌ **Frontend components** (never use service role key in frontend)
- ❌ **Simple queries** that don't involve user profile lookups
- ❌ **Public endpoints** that don't require authentication

### User Type System
The application supports three distinct user types with separate authentication flows:
- **Admin**: Full system access via `/admin/*` routes
- **Partner**: Business partners (groomers, vets) via `/partners/*` routes  
- **Customer**: End users via `/customer/*` routes

Each user type has:
- Dedicated signup flows (`/signup/partner`, `/signup/user`)
- Type-checked authentication via `UserProfile` interface in `lib/user-types.ts`
- Role-based routing and permissions via layout components
- Cached profile data in sessionStorage for performance

### Database Architecture

#### Core Tables
- `user_profiles`: Central user management with `user_type` field
- `partners`: Business partner details with approval workflow
- `customers`: End-user customer records
- `referrals`: Partner referral system with status tracking
- `image_catalog`: AI-generated pet portrait gallery
- `products`: E-commerce product catalog with dynamic pricing
- `breeds`, `themes`, `styles`, `formats`, `coats`: Pet portrait generation metadata
- `media`: Physical print media types (canvas, paper, acrylic, etc.)
- `product_pricing`: Multi-country pricing with automatic profit calculations
- `user_interactions`: Client-side interaction tracking (likes, shares, purchases)

#### Key Features
- **Row Level Security (RLS)**: All tables have comprehensive security policies
- **Database Functions**: Complex operations use `rpc()` calls for better performance
- **Referral System**: Complete tracking from `invited` → `accessed` → `accepted` → `applied`
- **Product System**: Multi-dimensional matrix (media × format × size) with Gelato integration
- **Interaction Tracking**: Client-side user interactions synced with server analytics

### File Structure Patterns

#### API Routes (`/app/api/`)
- User-type specific routes: `/api/admin/*`, `/api/partners/*`, `/api/customers/*`
- RESTful resource management: `/api/[resource]/[id]/route.ts`
- Complex operations use database functions via `.rpc()` calls
- Debug routes in `/api/debug/` for troubleshooting RLS issues
- Interaction tracking endpoints in `/api/interactions/`

#### Page Routes (`/app/`)
- User-type routing: `/admin/*`, `/partners/*`, `/customer/*`
- Each user type has its own layout component with navigation
- Dynamic routes for resources: `/[resource]/[id]/page.tsx`
- Shared components in `/components/` directory
- Referral tracking via `/r/[code]` routes
- Image sharing via `/share/image/[id]` routes

#### Services (`/lib/`)
- `SupabaseService`: Main database service class with all CRUD operations
- Type definitions split across: `types.ts` (main), `user-types.ts`, `product-types.ts`
- Authentication helpers with user-type checking
- `user-interactions.ts`: Client-side interaction tracking with offline support
- `enhanced-prompt-generator.ts`: AI prompt generation system

## Database Operations

### Service Class Usage
Always use the `SupabaseService` class for database operations:

```typescript
import { SupabaseService } from '@/lib/supabase';

const supabaseService = new SupabaseService();
const partner = await supabaseService.getCurrentPartner();
```

### User Type Checking
Use built-in methods for user type validation:

```typescript
const admin = await supabaseService.getCurrentAdmin();
const partner = await supabaseService.getCurrentPartner(); 
const customer = await supabaseService.getCurrentCustomer();
```

### Database Functions
For complex operations, use RPC calls:

```typescript
const { data, error } = await supabase.rpc('get_user_profile', { 
  user_uuid: userId 
});
```

### Referral Status Flow
Referrals follow this status progression:
1. `invited` - Initial referral created
2. `accessed` - Customer visited referral link  
3. `accepted` - Customer created account
4. `applied` - Customer made purchase

Use database functions for status transitions:
- `mark_referral_accessed(referral_code)`
- `mark_referral_accepted(referral_code, customer_email)`

## Common Patterns

### Authentication Flow
1. Check user authentication with `getCurrentUser()`
2. Get user profile with `getCurrentUserProfile()` 
3. Route based on `user_type` field
4. Use type-specific methods for operations
5. Cache profile data in sessionStorage for performance

### Layout Components
Each user type has a dedicated layout component that:
- Handles authentication checks and redirects
- Provides navigation specific to user type
- Manages sign-out functionality
- Uses cached profile data when available

### Database Migrations
- SQL scripts are maintained in `/scripts/` directory
- Use database functions for complex operations
- Always include RLS policies for new tables
- Test with debug endpoints before deploying

### API Error Handling
```typescript
try {
  const { data, error } = await supabaseService.operation();
  if (error) throw error;
  return NextResponse.json(data);
} catch (error) {
  console.error('Operation failed:', error);
  return NextResponse.json(
    { error: 'Operation failed' }, 
    { status: 500 }
  );
}
```

### TypeScript Patterns
- Use `any` type sparingly, typically for filter functions: `filter((item: any) => item.is_active)`
- All database types are defined in `/lib/types.ts`
- User types are in separate `/lib/user-types.ts`
- Product types are in `/lib/product-types.ts`

## Authentication & Authorization

### Route Protection
Pages check user type in the component or layout:
```typescript
const profile = await supabaseService.getCurrentUserProfile();
if (!profile || profile.user_type !== 'admin') {
  redirect('/auth/login');
}
```

### Database Security
- All operations go through RLS policies
- Use service role client only in API routes for admin operations
- Partner operations are scoped to their own data via RLS
- Debug endpoints bypass RLS for troubleshooting

## Development Notes

### Image Management
- Pet images stored in Cloudinary for optimized delivery
- Image catalog uses `image_catalog` table with relationships to breeds, themes, styles
- Fallback to Supabase Storage bucket `pet-images` for legacy images
- Public URLs generated via Cloudinary or `getPublicUrl()` method
- Upload handling in dedicated API routes

### Referral System
- QR codes generated for partner referrals using `qrcode` library
- Complete analytics tracking in `referral_analytics` table
- Commission calculations based on order values
- Partner-specific referral codes with prefixes

### Product System
- Multi-dimensional product matrix: media × format × size combinations
- Dynamic pricing by country/currency with automatic profit calculations
- Gelato integration for print fulfillment
- Price formatting utilities in `product-types.ts`

### AI Integration
- Anthropic Claude SDK for prompt generation
- Enhanced prompt generator in `lib/enhanced-prompt-generator.ts`
- Metadata-driven prompt construction using breed, theme, style combinations
- Export functionality for batch generation workflows

### Batch Processing System
- **Adaptive Batch Speed Controller** (`lib/adaptive-batch-speed-controller.ts`): Dynamic rate limiting based on API performance
- **Batch Job Management** (`/admin/batch-jobs`): Real-time monitoring with live logs
- **Image Variation Generation** (`lib/gemini-variation-service.ts`): AI-powered breed, theme, and style variations
- **Background Processing**: Long-running batch operations with status tracking
- **Rate Limiting**: Intelligent speed adjustment to prevent API rate limiting

### Advanced Features
- **User Interaction Tracking**: Client-side analytics with offline support and server sync
- **Hybrid Cart System**: Seamless guest-to-authenticated user cart migration
- **QR Code Generation**: Partner referral QR codes with analytics tracking
- **Multi-Country Pricing**: Dynamic pricing with automatic currency conversion
- **Image Watermarking**: Automated watermark application for digital assets
- **Share Functionality**: Social media sharing with platform-specific optimizations

## Stripe Payment Integration

### Setup and Configuration
The application integrates with Stripe for secure payment processing:

**Environment Variables:**
- `STRIPE_SECRET_KEY`: Server-side Stripe secret key for API calls
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Client-side publishable key for Stripe Elements
- `STRIPE_WEBHOOK_SECRET`: Webhook endpoint verification secret

**Core Files:**
- `/lib/stripe-server.ts`: Server-side Stripe service wrapper with helper functions
- `/lib/stripe-client.ts`: Client-side Stripe setup and utilities
- `/app/api/payments/create-intent/route.ts`: PaymentIntent creation endpoint
- `/app/api/webhooks/stripe/route.ts`: Webhook handler for Stripe events
- `/components/StripePaymentForm.tsx`: React component for payment processing

### Payment Flow
1. **Cart to Checkout**: User proceeds from cart to checkout page
2. **Shipping Information**: User enters shipping details on step 1
3. **PaymentIntent Creation**: Moving to step 2 creates a PaymentIntent via API
4. **Payment Form**: Stripe Elements renders secure payment form
5. **Payment Confirmation**: Stripe processes payment and confirms via webhook
6. **Order Creation**: Webhook creates order record in database
7. **Confirmation Page**: User sees order confirmation with payment status

### Webhook Handling
The webhook handler processes these Stripe events:
- `payment_intent.succeeded`: Creates order, handles referrals, updates inventory
- `payment_intent.payment_failed`: Logs failed payments for analytics
- `payment_intent.canceled`: Tracks cancellation events
- `charge.dispute.created`: Handles payment disputes

### Integration with Existing Systems
- **Referral System**: Stripe payments integrate with partner referrals and commission tracking
- **Order Management**: Creates orders compatible with existing order structure
- **Cart System**: Works with existing server-side cart context
- **User Authentication**: Respects existing user authentication and profile system

### Testing
Use Stripe test mode with test API keys. Test cards:
- `4242424242424242`: Successful payment
- `4000000000000002`: Declined payment
- `4000000000009995`: Insufficient funds

### Security
- All payment data handled by Stripe (PCI compliant)
- PaymentIntents include metadata for order tracking
- Webhook signature verification prevents tampering
- Client-side validation with server-side confirmation

### User Interaction Tracking
- Client-side interaction tracking via `UserInteractionsService`
- Tracks likes, shares, and purchases with offline support
- Syncs with server-side analytics for comprehensive tracking
- User-specific storage with migration support for anonymous users

### Animal Type Support
- System supports both dogs and cats with `AnimalType = 'dog' | 'cat'`
- Breed and coat data filtered by animal type
- AI prompt generation adapts to animal-specific characteristics

### Testing and Debugging
- Comprehensive test scripts for various system components
- Debug API endpoints for troubleshooting RLS policies
- Cloudinary migration and testing utilities
- Component update validation scripts
- End-to-end testing with Playwright for critical user flows
- Claude development helper script: `tsx scripts/claude-dev-helper.ts` for AI-assisted debugging

## 🚨 ARCHITECTURAL COMPLIANCE CHECKLIST

**Before implementing ANY data access, verify:**

✅ **For Admin Features:**
- [ ] Using `AdminSupabaseService` methods only
- [ ] No direct Supabase client calls in components
- [ ] All database access goes through service methods

✅ **For Customer Features:**  
- [ ] Using `/api/shop/*` endpoints only
- [ ] Email-based authentication for API calls
- [ ] No direct database queries in frontend
- [ ] No admin service usage in customer components

✅ **For Partner Features:**
- [ ] Using API endpoints with Bearer token auth
- [ ] Following `/api/referrals` and similar patterns
- [ ] No direct database access from components

✅ **For All Features:**
- [ ] Authentication handled at API layer, not frontend
- [ ] Data validation in API routes, not components
- [ ] Proper error handling and status codes
- [ ] No bypass of the API layer architecture

✅ **Authentication Consistency (CRITICAL):**
- [ ] Consistent auth approach across all user-type routes
- [ ] Either ALL server-side auth OR ALL client-side auth within user type
- [ ] No mixed server/client auth patterns for same user type
- [ ] Server-side pages use `getCurrentUserProfile()` + `redirect()`
- [ ] Client-side pages use `useUserRouting()` + `<UserAccessControl>`

**❌ RED FLAGS - If you see these, STOP and refactor:**
- Direct `.from()` calls in React components
- `createClient()` imports in frontend components
- Mixed admin/customer service usage
- Database queries outside API routes/services
- Authentication logic in frontend components
- **Mixed server/client authentication within same user type routes**
- **SupabaseService.getCurrentPartner/getCurrentCustomer calls in API routes** (use service role client instead)
- **SupabaseService or createClientComponentClient() in API routes** (causes "Auth session missing!" errors)

## 🐛 DEBUGGING & TROUBLESHOOTING

### Build Failures

**"Cannot access 'y' before initialization" Error:**
- **Cause**: Direct Supabase client imports in component body or circular React Hook dependencies
- **Solution**: Move Supabase initialization to useEffect or use API endpoints
- **Prevention**: Always use API endpoints instead of direct database access in components

**"ReferenceError" in Prerendering:**
- **Cause**: Client-side only code running during static generation
- **Solution**: Add `export const dynamic = 'force-dynamic'` to pages with client-side data fetching
- **Prevention**: Follow server-side vs client-side rendering patterns consistently

### Performance Issues

**Slow Cart Operations:**
- **Check**: Circular dependencies in `lib/hybrid-cart-context.tsx`
- **Solution**: Inline API calls instead of calling other useCallback functions
- **Prevention**: Keep dependency arrays minimal and break circular references

**API Rate Limiting:**
- **Check**: Batch processing speed in `lib/adaptive-batch-speed-controller.ts`
- **Solution**: Adjust delayMs and parallelism parameters
- **Monitor**: Use `/admin/batch-jobs` for real-time batch operation monitoring

### Authentication Issues

**"Auth session missing!" in API Routes:**
- **Cause**: Using SupabaseService or createClientComponentClient() in API routes
- **Solution**: Use createRouteHandlerClient() with cookies for API route authentication
- **Example**: `/api/partners/profile` was using SupabaseService (client component client) instead of route handler client
- **Fix**: Replace with `createRouteHandlerClient({ cookies: () => cookieStore })`

**Inconsistent Auth Behavior:**
- **Cause**: Mixed server-side and client-side authentication within same user type
- **Solution**: Use consistent auth pattern across all routes for each user type
- **Debug**: Check UserProfile caching in sessionStorage

**Redirect Loops:**
- **Cause**: Server-side auth redirecting to client-side auth pages
- **Solution**: Ensure auth failure redirects go to appropriate login pages for user type
- **Prevention**: Use `useUserRouting()` consistently in client components

## Important Implementation Notes

### Legacy Peer Dependencies
When installing new dependencies, always use `npm install --legacy-peer-deps` due to React 19 compatibility requirements.

### Retail Pricing System
- Products have a 70% margin calculation built-in for retail pricing
- Prices are automatically rounded to nearest £2.50 for retail display
- Admin product pages show both base cost and retail pricing with margin calculations

### Cart System Implementation
- Server-side cart context in `lib/server-cart-context.tsx`
- Client-side cart state management with React Context
- Cart operations integrated with Stripe payment intents
- Supports both authenticated and guest user sessions

## 📋 FUTURE REFACTORING TASKS (Non-Priority)

These tasks are documented for future improvement but are not immediate priorities:

### Admin Architecture Alignment
**Status**: Currently exempted from architectural governance for operational needs
**Future Goal**: Align admin components with API-only patterns

- **Admin Component Modernization**: Migrate `/app/admin/**/*` components from direct `AdminSupabaseService` usage to API endpoint patterns
  - Create admin-specific API routes in `/api/admin/`
  - Implement server-side authentication and authorization for admin APIs
  - Refactor admin components to use fetch() calls with proper error handling
  - Maintain admin-specific functionality while following architectural patterns

- **Admin Service Layer**: Restructure admin data access
  - Move admin business logic to API routes
  - Implement proper caching and performance optimizations
  - Add comprehensive logging and audit trails for admin actions
  - Separate admin authentication from data access patterns

### Code Quality Improvements
**Status**: Minor warnings only, no functional issues

- **Image Optimization**: Replace `<img>` tags with Next.js `<Image />` components in admin pages
  - Improves LCP (Largest Contentful Paint) performance
  - Automatic image optimization and responsive sizing
  - Affects ~15 admin pages with image displays

- **React Component Cleanup**: Address minor React warnings
  - Fix unescaped entities in JSX (quotes, apostrophes)
  - Resolve async client component patterns
  - Clean up React Hook dependency arrays in admin components

- **TypeScript Strictness**: Enhance type safety in admin components
  - Add proper typing for admin-specific data structures
  - Implement discriminated unions for user types
  - Strengthen API response type checking

### Performance Optimization
**Status**: Current performance acceptable, optimization for scale

- **Admin Dashboard Loading**: Implement progressive loading patterns
  - Skeleton screens for data-heavy admin pages
  - Pagination for large datasets (customers, orders, products)
  - Virtual scrolling for image catalogs

- **Admin Caching Strategy**: Implement intelligent caching
  - Cache frequently accessed admin data
  - Implement cache invalidation patterns
  - Add background data refresh capabilities

### Testing & Documentation
**Status**: Basic functionality covered, comprehensive testing needed

- **Admin Integration Tests**: Create comprehensive test suites for admin functionality
  - User management workflow tests
  - Product catalog management tests
  - Order processing and fulfillment tests
  - Partner approval and commission tests

- **Admin Documentation**: Create admin-specific documentation
  - Admin user guide for common operations
  - Technical documentation for admin architecture
  - API documentation for future admin endpoints

### Migration Strategy
When these tasks become priority:

1. **Phase 1**: Create admin API endpoints while maintaining current functionality
2. **Phase 2**: Gradually migrate admin components to use new API patterns
3. **Phase 3**: Remove direct database access from admin components
4. **Phase 4**: Clean up architectural exemptions in ESLint configuration

**Estimated Effort**: 2-3 weeks full-time development
**Impact**: Improved consistency, better performance, enhanced maintainability
**Risk**: Low - current admin system is stable and functional

## 🚀 QUICK REFERENCE

### Creating New API Endpoints

**Customer API Pattern:**
```typescript
// /app/api/shop/[resource]/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const customerEmail = searchParams.get('email');

  const supabaseService = new SupabaseService();
  const { data: { user } } = await supabaseService.getClient().auth.getUser();

  if (!user?.email || user.email !== customerEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Your logic here...
}
```

**Partner API Pattern:**
```typescript
// /app/api/partners/[resource]/route.ts
export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const token = authorization?.replace('Bearer ', '');

  const supabaseService = new SupabaseService();
  const { data: { user } } = await supabaseService.getClient().auth.getUser(token);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Your logic here...
}
```

### Frontend Component Patterns

**Client Component with Auth:**
```typescript
'use client'
export default function MyPage() {
  return (
    <UserAccessControl allowedUserTypes={['customer']}>
      <MyPageContent />
    </UserAccessControl>
  );
}
```

**Server Component with Auth:**
```typescript
// No 'use client' - this is a Server Component
export default async function MyPage() {
  const supabaseService = new SupabaseService();
  const userProfile = await supabaseService.getCurrentUserProfile();

  if (!userProfile || userProfile.user_type !== 'customer') {
    redirect('/auth/login');
  }

  return <MyPageContent userProfile={userProfile} />;
}
```

### Database Operations

**Simple Query:**
```typescript
const supabaseService = new SupabaseService();
const { data, error } = await supabaseService.getClient()
  .from('table_name')
  .select('*')
  .eq('id', id);
```

**Complex Query with RPC:**
```typescript
const { data, error } = await supabaseService.getClient()
  .rpc('function_name', {
    parameter1: value1,
    parameter2: value2
  });
```