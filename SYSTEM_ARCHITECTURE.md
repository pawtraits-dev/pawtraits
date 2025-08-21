# Pawtraits System Architecture & Functionality

## Overview

Pawtraits is a comprehensive AI-powered pet portrait platform that combines e-commerce, partner referral systems, and AI-generated pet artwork. The platform serves three distinct user types (Admin, Partner, Customer) with role-based access and dedicated workflows.

## System Architecture

### Technology Stack

- **Frontend**: Next.js 15 with App Router, React 19, TypeScript (strict mode)
- **Styling**: Tailwind CSS with Radix UI components
- **Backend**: Next.js API Routes with serverless functions
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Authentication**: Supabase Auth with custom user type system
- **Image Storage**: Cloudinary for optimized delivery, Supabase Storage for legacy
- **AI Integration**: Anthropic Claude SDK for prompt generation
- **Payments**: Stripe integration with webhook processing
- **Print Fulfillment**: Gelato API for physical product manufacturing
- **QR Codes**: Dynamic QR generation for partner referrals

### Core Architecture Principles

1. **Multi-Tenant User System**: Three distinct user types with separate authentication flows
2. **Row-Level Security**: Database-enforced permissions for data isolation
3. **API-First Design**: RESTful APIs with consistent error handling
4. **Type Safety**: Comprehensive TypeScript coverage across all layers
5. **Responsive Design**: Mobile-first UI with progressive enhancement
6. **Performance Optimization**: Image optimization, caching, and lazy loading

## User Type System

### Admin Users (`/admin/*`)
**Purpose**: Complete system administration and business management

**Key Capabilities**:
- **Content Management**: Breeds, themes, styles, formats, media types
- **Product Management**: Dynamic pricing, inventory, Gelato integration
- **Partner Management**: Approval workflows, commission tracking
- **Order Management**: Full order lifecycle, customer service
- **Analytics**: Revenue, profit, user interactions, referral performance
- **Carousel Management**: Hero content for all page types
- **Financial Oversight**: Cost tracking, profit margins, commission payments

**Technical Features**:
- Service role database access for administrative operations
- Comprehensive CRUD interfaces for all system entities
- Real-time analytics dashboards
- Batch operation tools for data management

### Partner Users (`/partners/*`)
**Purpose**: Business partners (groomers, veterinarians) who refer customers

**Key Capabilities**:
- **Referral Management**: Generate referral codes, track performance
- **QR Code Generation**: Physical and digital marketing materials
- **Commission Tracking**: Real-time earnings, payment status
- **Customer Analytics**: Referral conversion metrics
- **Order Visibility**: View orders from referred customers
- **Profile Management**: Business information, approval status

**Technical Features**:
- Partner-scoped database access via RLS policies
- Referral code generation with unique prefixes
- Commission calculation based on order values
- QR code integration for offline marketing

### Customer Users (`/customer/*`)
**Purpose**: End-users purchasing AI-generated pet portraits

**Key Capabilities**:
- **Pet Profile Management**: Upload photos, breed/coat selection
- **AI Portrait Generation**: Custom prompts with metadata combinations
- **Product Browsing**: Filter by animal type, themes, styles
- **E-commerce**: Cart management, checkout, order tracking
- **Social Features**: Like, share, and discover pet portraits
- **Order History**: Track purchases and delivery status

**Technical Features**:
- Client-side interaction tracking with offline support
- Referral link processing for partner attribution
- Stripe payment integration with saved payment methods
- Image sharing via secure URLs

## Database Architecture

### Core Data Model

```
user_profiles (Central hub)
├── partners (Business partners)
├── customers (End users)
├── referrals (Partner→Customer relationships)
└── user_interactions (Engagement tracking)

image_catalog (AI-generated content)
├── breeds (Dog/cat breed definitions)
├── themes (Visual themes)
├── styles (Artistic styles)
├── coats (Coat pattern types)
└── formats (Output formats)

products (E-commerce)
├── media (Physical print types)
├── product_pricing (Multi-country pricing)
├── orders (Purchase records)
└── order_items (Line items)

carousels (Content management)
└── carousel_slides (Hero content)
```

### Key Database Features

- **Row Level Security (RLS)**: Every table has comprehensive security policies
- **Database Functions**: Complex operations via `rpc()` calls for performance
- **Multi-Country Support**: Currency-aware pricing with automatic conversions
- **Audit Trail**: Created/updated timestamps with user attribution
- **Referential Integrity**: Foreign key constraints with cascade deletions

## AI Integration System

### Enhanced Prompt Generator
**Location**: `/lib/enhanced-prompt-generator.ts`

**Functionality**:
- Metadata-driven prompt construction
- Breed-specific characteristic integration
- Theme and style combination logic
- Export capabilities for batch generation
- Dynamic prompt optimization based on animal type

**Workflow**:
1. User selects breed, theme, style combination
2. System retrieves metadata from database
3. AI constructs optimized prompt using Claude SDK
4. Generated prompts stored for reuse and refinement

## E-commerce System

### Product Management
- **Multi-dimensional Matrix**: Media × Format × Size combinations
- **Dynamic Pricing**: Country-specific pricing with 70% margin calculations
- **Gelato Integration**: Real-time product availability and pricing
- **Inventory Management**: Stock levels with automatic updates

### Payment Processing
**Stripe Integration Features**:
- PaymentIntent creation with metadata tracking
- Webhook processing for order completion
- Support for multiple currencies
- PCI-compliant payment handling
- Automated refund processing

**Payment Flow**:
1. Cart validation and pricing calculation
2. Shipping information collection
3. PaymentIntent creation via API
4. Stripe Elements secure payment form
5. Webhook confirmation and order creation
6. Email notifications and order tracking

## Referral System

### Partner Referral Workflow
```
Partner creates referral → Customer clicks link → Account creation → Purchase completion
   (invited)              (accessed)         (accepted)      (applied)
```

**Technical Implementation**:
- Unique referral codes with partner prefixes
- QR code generation for offline marketing
- Commission calculation based on order values
- Real-time analytics and performance tracking
- Automated commission payments

### Tracking Capabilities
- Referral link analytics
- Conversion funnel metrics
- Partner performance comparisons
- Commission payout history

## Content Management

### Carousel System
**Purpose**: Dynamic hero content across different page types

**Features**:
- **Page-Specific Carousels**: Home, Dogs, Cats, Themes
- **Rich Content Overlays**: Title, subtitle, description with individual colors
- **Visual Positioning**: 8 positioning options including bottom-center
- **CTA Integration**: Customizable call-to-action buttons
- **Responsive Design**: Mobile-optimized with keyboard navigation
- **Image Optimization**: Cloudinary integration with automatic compression

**Technical Details**:
- 16:9 aspect ratio maintenance
- Cropped edge previews of adjacent slides
- Auto-play with configurable intervals
- Thumbnail navigation (optional)
- Overlay opacity control for text readability

### Image Management
- **Primary Storage**: Cloudinary for optimized delivery
- **Legacy Support**: Supabase Storage fallback
- **Image Processing**: Automatic compression and format optimization
- **CDN Integration**: Global content delivery for performance
- **Watermark Support**: Branded image protection

## API Architecture

### RESTful Design Patterns
- **Resource-Based URLs**: `/api/[resource]/[id]`
- **HTTP Method Semantics**: GET, POST, PATCH, DELETE
- **Consistent Error Handling**: Standardized error responses
- **Type-Safe Responses**: TypeScript interfaces for all API contracts

### User-Type Specific Routing
```
/api/admin/*     - Administrative operations (service role)
/api/partners/*  - Partner-scoped operations (RLS enforced)
/api/customers/* - Customer-scoped operations (RLS enforced)
/api/public/*    - Anonymous access endpoints
```

### Debug and Testing Endpoints
- `/api/debug/*`: RLS troubleshooting and system diagnostics
- Health checks and system status monitoring
- Database function testing and validation

## Security Architecture

### Multi-Layer Security
1. **Authentication**: Supabase Auth with JWT tokens
2. **Authorization**: Role-based access control
3. **Database Security**: Row Level Security policies
4. **API Security**: Request validation and rate limiting
5. **Payment Security**: PCI-compliant Stripe integration

### Data Protection
- **Encryption**: Data encrypted at rest and in transit
- **Access Logging**: Comprehensive audit trails
- **Sensitive Data Handling**: No secrets in client-side code
- **GDPR Compliance**: User data deletion and export capabilities

## Performance Optimizations

### Frontend Performance
- **React 19 Features**: Concurrent rendering and automatic batching
- **Image Optimization**: Next.js Image component with Cloudinary
- **Code Splitting**: Dynamic imports for route-based splitting
- **Caching**: SessionStorage for user profiles and preferences

### Database Performance
- **Indexed Queries**: Strategic database indexes
- **Connection Pooling**: Supabase connection management
- **Query Optimization**: Database functions for complex operations
- **Caching Layer**: Application-level caching for static data

## Analytics and Monitoring

### User Interaction Tracking
- **Client-Side Tracking**: User interactions with offline support
- **Server-Side Analytics**: Comprehensive event logging
- **Real-Time Metrics**: Dashboard analytics for all user types
- **Conversion Tracking**: Referral and purchase funnel analysis

### Business Intelligence
- **Revenue Analytics**: Real-time financial dashboards
- **Partner Performance**: Commission and referral metrics
- **Product Analytics**: Popular themes, breeds, and styles
- **Customer Insights**: Purchase patterns and preferences

## Deployment and Infrastructure

### Hosting Architecture
- **Frontend**: Vercel deployment with global CDN
- **Database**: Supabase managed PostgreSQL
- **Image Storage**: Cloudinary global CDN
- **Payment Processing**: Stripe infrastructure
- **Print Fulfillment**: Gelato API integration

### Environment Management
- **Multi-Environment Setup**: Development, staging, production
- **Environment Variables**: Secure configuration management
- **Deployment Pipeline**: Automated testing and deployment
- **Monitoring**: Application performance monitoring

## Current System State

### Completed Features
✅ Multi-user authentication system
✅ Admin content management interfaces
✅ Partner referral system with QR codes
✅ Customer e-commerce platform
✅ AI prompt generation system
✅ Stripe payment integration
✅ Carousel content management
✅ Product catalog with dynamic pricing
✅ Order management system
✅ Analytics and reporting
✅ Mobile-responsive design

### Active Integrations
- Supabase for database and authentication
- Cloudinary for image optimization
- Stripe for payment processing
- Gelato for print fulfillment
- Anthropic Claude for AI prompts
- Vercel for hosting and deployment

### Data Integrity
- Comprehensive RLS policies across all tables
- Foreign key constraints ensuring referential integrity
- Database functions for complex business logic
- Audit trails with timestamps and user attribution

## Future Extensibility

### Modular Architecture
The system is designed for extensibility with:
- Plugin-based feature additions
- API-first design for third-party integrations
- Microservice-ready architecture
- Scalable database design

### Integration Points
- Webhook endpoints for external system integration
- RESTful APIs for mobile app development
- Export capabilities for data migration
- Extensible user type system for new roles

This architecture supports the current business requirements while providing flexibility for future growth and feature additions.