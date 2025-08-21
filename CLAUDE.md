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

# Type checking
npm run type-check

# Install dependencies (required for React 19 compatibility)
npm install --legacy-peer-deps

# Utility testing scripts (run with tsx from scripts/ directory)
tsx scripts/test-cloudinary.ts          # Test Cloudinary integration
tsx scripts/test-watermark.ts           # Test watermark functionality  
tsx scripts/test-api-routes.ts          # Test API route structure
tsx scripts/validate-api-structure.ts   # Validate API structure
tsx scripts/upload-watermark.ts         # Upload watermark assets
tsx scripts/migrate-to-cloudinary.ts    # Migrate to Cloudinary storage
tsx scripts/check-storage-structure.ts  # Check storage structure
tsx scripts/test-component-updates.ts   # Test component updates

# Enhanced Cart & Gelato Integration Tests
./scripts/run-step1-tests.sh            # Run all Step 1 enhanced cart tests
tsx scripts/test-enhanced-cart.ts       # Test enhanced cart data structure
tsx scripts/test-cart-api-integration.ts # Test cart API integration with enhanced data
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

### Carousel System
The application features a comprehensive carousel management system for displaying hero content across different page types:

**Database Tables:**
- `carousels`: Main carousel configuration with page type association, auto-play settings
- `carousel_slides`: Individual slides with images, text overlays, and CTA buttons

**Core Features:**
- **Page-Specific Carousels**: Separate carousels for `home`, `dogs`, `cats`, and `themes` pages
- **Rich Content Overlays**: Title, subtitle, description text with configurable positioning
- **Individual Text Colors**: Each text element can have different colors including gold option
- **CTA Integration**: Call-to-action buttons with customizable styles (primary, secondary, outline)
- **Image Management**: Cloudinary integration with automatic compression for Vercel compatibility
- **Visual Enhancements**: Cropped edge previews of adjacent slides, centered thumbnails
- **Responsive Design**: Adaptive layouts with mobile-optimized controls

**API Structure:**
- `/api/carousel/[pageType]`: Public API for fetching active carousel data
- `/api/admin/carousels`: Admin CRUD operations for carousel management
- `/api/admin/carousel-slides`: Admin CRUD operations for slide management
- `/api/admin/carousel-upload`: Cloudinary image upload with compression

**Key Files:**
- `/lib/carousel-types.ts`: Complete type definitions for carousel system
- `/components/EnhancedHeroCarousel.tsx`: Main display component with keyboard navigation
- `/app/admin/carousels/`: Admin interface for carousel management
- `/db/carousel-schema.sql`: Database schema and RLS policies

**Text Positioning Options:**
- Center, left, right positioning
- Corner positioning: top-left, top-right, bottom-left, bottom-right, bottom-center
- Each slide can position text independently

**Display Settings:**
- Auto-play intervals (configurable per carousel)
- Thumbnail navigation (can be disabled)
- Overlay opacity control for text readability
- Aspect ratio maintained at 16:9 with object-contain
- Cropped edge previews show partial adjacent slides at full height