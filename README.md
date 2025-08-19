# Pawtraits - AI-Generated Pet Portraits

A comprehensive Next.js application for creating, managing, and selling AI-generated pet portraits with integrated e-commerce functionality.

## Features

- **Multi-User System**: Separate interfaces for Customers, Partners (groomers/vets), and Admins
- **AI Portrait Generation**: Anthropic Claude-powered prompt generation for unique pet portraits
- **E-commerce Platform**: Complete shopping cart, checkout, and order management
- **Payment Processing**: Secure Stripe integration with webhook support
- **Referral System**: Partner referral tracking with commission management
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Image Management**: Cloudinary integration for optimized image delivery

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth
- **Payments**: Stripe with webhooks
- **UI**: React 19, Tailwind CSS, Radix UI
- **Images**: Cloudinary
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Stripe account
- Cloudinary account

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

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

### Installation

1. Clone the repository:
```bash
git clone https://github.com/pawtraits-dev/pawtraits.git
cd pawtraits
```

2. Install dependencies:
```bash
npm install --legacy-peer-deps
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Stripe Webhook Setup

For payment processing to work properly, configure your Stripe webhook endpoint:

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select these events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.dispute.created`

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── admin/             # Admin interface
│   ├── partners/          # Partner (groomer/vet) interface  
│   ├── customer/          # Customer interface
│   └── api/               # API routes
├── components/            # Reusable React components
├── lib/                   # Utilities and services
├── public/               # Static assets
└── styles/               # Global styles
```

## User Types

### Customers
- Browse and purchase pet portraits
- Manage orders and account
- Access via `/customer/*` routes

### Partners (Groomers/Vets)
- Create referral links and QR codes
- Track commissions and client orders
- Access via `/partners/*` routes

### Admins
- Full system management
- Analytics and user management
- Access via `/admin/*` routes

## Payment Flow

1. User adds items to cart
2. Proceeds to checkout with shipping info
3. Stripe PaymentIntent created
4. Secure payment processing with Stripe Elements
5. Webhook confirms payment and creates order
6. User sees confirmation page

## Deployment

The application is configured for easy deployment on Vercel:

1. Push to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy automatically

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is proprietary software. All rights reserved.