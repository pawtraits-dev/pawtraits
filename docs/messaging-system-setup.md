# Messaging System Setup Guide

## Overview

The Pawtraits messaging system provides multi-channel messaging capabilities:
- **Email** via Resend
- **SMS** via Twilio
- **In-app message inbox** via database

## Environment Variables

Add these environment variables to your `.env.local` file:

### Resend (Email Provider)

```bash
# Resend API Key
# Get from: https://resend.com/api-keys
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx

# Email defaults
RESEND_FROM_EMAIL=hello@pawtraits.com
RESEND_FROM_NAME=Pawtraits
```

### Twilio (SMS Provider)

```bash
# Twilio Account Credentials
# Get from: https://console.twilio.com/
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Twilio Phone Number (E.164 format)
# Purchase from: https://console.twilio.com/us1/develop/phone-numbers/manage/search
TWILIO_PHONE_NUMBER=+441234567890
```

### Base URL Configuration

```bash
# Production URL (set automatically on Vercel)
VERCEL_URL=your-app.vercel.app

# Or set base URL manually
NEXT_PUBLIC_BASE_URL=https://your-app.com

# For local development
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Database Setup

Run the messaging schema SQL script:

```bash
# Connect to your Supabase database
psql $DATABASE_URL -f db/messaging-schema.sql
```

This creates:
- `message_templates` - Template definitions
- `message_queue` - Queue of pending messages
- `message_delivery_log` - Archive of sent messages
- `user_messages` - In-app message inbox
- `admin_message_config` - Admin configuration
- `message_events` - Event tracking

## Provider Setup

### 1. Resend Configuration

1. **Create Account**: Sign up at https://resend.com
2. **Get API Key**: Go to API Keys → Create API Key
3. **Configure Webhook** (optional for delivery tracking):
   - Go to Webhooks → Add Webhook
   - URL: `https://your-app.com/api/messaging/webhooks/resend`
   - Events: Select all email events (sent, delivered, bounced, etc.)

### 2. Twilio Configuration

1. **Create Account**: Sign up at https://www.twilio.com
2. **Get Credentials**:
   - Account SID and Auth Token from Console Dashboard
3. **Purchase Phone Number**:
   - Go to Phone Numbers → Buy a Number
   - Select a number with SMS capabilities
   - Copy number in E.164 format (e.g., +441234567890)
4. **Webhook Configuration**:
   - Automatically configured via `statusCallback` in code
   - URL: `https://your-app.com/api/messaging/webhooks/twilio`

### 3. Supabase Email Configuration (Optional)

To use Resend for Supabase Auth emails:

1. Go to Supabase Dashboard → Authentication → Email Templates
2. Click "SMTP Settings"
3. Configure SMTP with Resend:
   - **Host**: `smtp.resend.com`
   - **Port**: `465` (SSL) or `587` (TLS)
   - **Username**: `resend`
   - **Password**: Your Resend API key (starts with `re_`)
   - **Sender Email**: `hello@pawtraits.com`
   - **Sender Name**: `Pawtraits`

## Cron Job Setup

The message queue processor should run periodically to send queued messages.

### Vercel Cron (Recommended for Vercel deployments)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/messaging/process",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

This runs every 5 minutes.

### Alternative: External Cron Services

Use services like:
- **Cron-job.org**: Free cron job service
- **EasyCron**: Advanced scheduling options
- **GitHub Actions**: If using GitHub for deployment

Configure to POST to: `https://your-app.com/api/messaging/process`

### Manual Processing (Development Only)

```bash
curl -X POST http://localhost:3000/api/messaging/process
```

## Testing the System

### 1. Test Email Provider

```typescript
// In your code or API route
import { sendEmail } from '@/lib/messaging/providers/email-provider';

const result = await sendEmail({
  to: 'test@example.com',
  subject: 'Test Email',
  html: '<p>Hello from Pawtraits!</p>',
});

console.log(result); // { success: true, messageId: '...' }
```

### 2. Test SMS Provider

```typescript
import { sendSMS } from '@/lib/messaging/providers/sms-provider';

const result = await sendSMS({
  to: '+441234567890',
  body: 'Test SMS from Pawtraits!',
});

console.log(result); // { success: true, messageId: '...' }
```

### 3. Test Message Service

```bash
curl -X POST http://localhost:3000/api/messaging/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "templateKey": "order_confirmation",
    "recipientType": "customer",
    "recipientEmail": "customer@example.com",
    "variables": {
      "customer_name": "John Doe",
      "order_number": "ORD-12345",
      "total_amount": 4999
    }
  }'
```

### 4. Check Queue Status

```bash
curl http://localhost:3000/api/messaging/process
```

### 5. Process Queue Manually

```bash
curl -X POST http://localhost:3000/api/messaging/process
```

## Usage Examples

### Sending a Message via Template

```typescript
import { sendMessage } from '@/lib/messaging/message-service';

// Example: Order confirmation
const result = await sendMessage({
  templateKey: 'order_confirmation',
  recipientType: 'customer',
  recipientId: customer.id,
  recipientEmail: customer.email,
  variables: {
    customer_name: customer.name,
    order_number: order.number,
    total_amount: order.total_cents,
  },
  priority: 'high',
});

// Example: Partner referral notification
await sendMessage({
  templateKey: 'referral_purchase',
  recipientType: 'partner',
  recipientId: partner.id,
  recipientEmail: partner.email,
  recipientPhone: partner.phone, // Optional for SMS
  variables: {
    customer_name: customer.name,
    commission_amount: commission_cents,
    currency: 'GBP',
  },
});
```

### Creating a New Template

```sql
INSERT INTO message_templates (
  template_key,
  name,
  description,
  category,
  channels,
  user_types,
  email_subject_template,
  email_body_template,
  sms_body_template,
  inbox_title_template,
  inbox_body_template,
  inbox_icon,
  can_be_disabled,
  default_enabled
) VALUES (
  'order_shipped',
  'Order Shipped Notification',
  'Sent when an order ships',
  'transactional',
  ARRAY['email', 'sms', 'inbox'],
  ARRAY['customer'],
  'Your order {{order_number}} has shipped!',
  '<h1>Great news!</h1><p>Your order {{order_number}} is on its way.</p><p>Track: {{tracking_url}}</p>',
  'Your order {{order_number}} has shipped! Track: {{tracking_url}}',
  'Order Shipped',
  'Your order {{order_number}} is on its way!',
  'truck',
  false,
  true
);
```

### Accessing User Messages (Inbox)

```typescript
// In a page or API route
const { data: messages } = await supabase
  .from('user_messages')
  .select('*')
  .eq('user_type', 'customer')
  .eq('user_id', userId)
  .eq('is_archived', false)
  .order('created_at', { ascending: false });

// Get unread count
const unreadCount = await supabase.rpc('get_unread_message_count', {
  p_user_type: 'customer',
  p_user_id: userId,
});
```

### Marking Messages as Read

```typescript
await supabase
  .from('user_messages')
  .update({
    is_read: true,
    read_at: new Date().toISOString(),
  })
  .eq('id', messageId);
```

## Handlebars Template Variables

### Built-in Helpers

```handlebars
{{!-- Currency formatting --}}
{{currency total_amount "GBP"}}
<!-- Output: £49.99 (assuming total_amount = 4999) -->

{{!-- Date formatting --}}
{{formatDate created_at "short"}}
<!-- Output: 15 Jan 2025 -->

{{formatDate created_at "long"}}
<!-- Output: 15 January 2025 -->

{{formatDate created_at "time"}}
<!-- Output: 14:30 -->

{{!-- Text transformation --}}
{{uppercase name}}        <!-- JOHN DOE -->
{{lowercase name}}        <!-- john doe -->
{{capitalize name}}       <!-- John doe -->

{{!-- Conditionals --}}
{{#if has_tracking}}
  Track your order: {{tracking_url}}
{{/if}}

{{!-- Loops --}}
{{#each items}}
  - {{name}}: {{currency price "GBP"}}
{{/each}}
```

## Monitoring & Maintenance

### Queue Statistics

```bash
# Get current queue stats
curl http://localhost:3000/api/messaging/process
```

### Archive Old Messages

```bash
# Archive messages older than 7 days
curl -X POST "http://localhost:3000/api/messaging/process?archive=true"
```

### Cleanup Old Logs

```bash
# Delete logs older than 90 days (GDPR compliance)
curl -X POST "http://localhost:3000/api/messaging/process?cleanup=true"
```

### Check Message Events

```sql
-- View recent message events
SELECT * FROM message_events
ORDER BY event_timestamp DESC
LIMIT 100;

-- Delivery rate by template
SELECT
  mq.template_key,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE mq.status = 'sent') as sent,
  COUNT(*) FILTER (WHERE mq.status = 'failed') as failed,
  ROUND(COUNT(*) FILTER (WHERE mq.status = 'sent')::numeric / COUNT(*) * 100, 2) as success_rate
FROM message_queue mq
GROUP BY mq.template_key;
```

## Troubleshooting

### Messages Not Sending

1. Check queue status: `curl http://localhost:3000/api/messaging/process`
2. Verify environment variables are set
3. Check provider API keys are valid
4. Review error messages in `message_queue.error_message`

### Email Bounces

1. Check `message_events` for bounce details
2. Verify recipient email addresses are valid
3. Check Resend dashboard for domain reputation

### SMS Failures

1. Verify phone numbers are in E.164 format (+441234567890)
2. Check Twilio dashboard for account balance
3. Review error codes in Twilio console

### Webhook Not Receiving Events

1. Verify webhook URL is publicly accessible (not localhost)
2. Check webhook configuration in provider dashboard
3. Test webhook endpoint: `curl http://localhost:3000/api/messaging/webhooks/resend`

## Security Considerations

- **API Keys**: Never commit API keys to git. Use environment variables.
- **Webhook Verification**: Consider adding signature verification for webhooks in production.
- **Rate Limiting**: Implement rate limiting on the enqueue endpoint to prevent abuse.
- **RLS Policies**: User messages table has Row Level Security enabled - users can only see their own messages.

## Next Steps

After completing Phase 1 setup:

1. **Phase 2**: Build admin UI for managing templates and viewing queue status
2. **Phase 3**: Add user notification preferences UI
3. **Phase 4**: Implement advanced features (scheduling, throttling, A/B testing)

## Support

For issues or questions:
- Check logs in Supabase Dashboard → Database → Logs
- Review provider dashboards (Resend, Twilio) for delivery issues
- Test endpoints using the examples above
