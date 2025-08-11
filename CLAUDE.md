# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

# Utility testing scripts
npm run test-cloudinary     # Test Cloudinary integration
npm run test-watermark      # Test watermark functionality  
npm run test-api            # Test API route structure
npm run validate-api        # Validate API structure
npm run upload-watermark    # Upload watermark assets
npm run migrate-cloudinary  # Migrate to Cloudinary storage
npm run check-storage       # Check storage structure
npm run test-components     # Test component updates
```

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