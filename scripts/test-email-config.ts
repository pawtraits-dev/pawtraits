#!/usr/bin/env tsx
// =====================================================
// EMAIL CONFIGURATION TEST SCRIPT
// =====================================================
// Tests Resend email integration and configuration
//
// Usage:
//   tsx scripts/test-email-config.ts your-email@example.com
//
// Prerequisites:
//   1. RESEND_API_KEY environment variable set
//   2. RESEND_FROM_EMAIL environment variable set (or uses default)
//   3. Domain verified in Resend dashboard
//   4. DNS records (SPF, DKIM, DMARC) configured

import { sendEmail, testEmailConfiguration } from '../lib/messaging/providers/email-provider';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

async function testEmailConfig() {
  logSection('Pawtraits Email Configuration Test');

  // Check command line arguments
  const testEmail = process.argv[2];
  if (!testEmail) {
    log('❌ Error: Please provide a test email address', 'red');
    log('\nUsage: tsx scripts/test-email-config.ts your-email@example.com', 'yellow');
    process.exit(1);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(testEmail)) {
    log('❌ Error: Invalid email address format', 'red');
    process.exit(1);
  }

  log(`📧 Test email will be sent to: ${testEmail}`, 'blue');

  // Check environment variables
  logSection('Environment Variables Check');

  const requiredVars = {
    'RESEND_API_KEY': process.env.RESEND_API_KEY,
    'RESEND_FROM_EMAIL': process.env.RESEND_FROM_EMAIL,
    'SUPPORT_EMAIL': process.env.SUPPORT_EMAIL,
  };

  let hasErrors = false;
  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
      log(`❌ ${key}: Not set (will use default)`, 'yellow');
      if (key === 'RESEND_API_KEY') {
        hasErrors = true;
      }
    } else {
      const displayValue = key === 'RESEND_API_KEY'
        ? `${value.substring(0, 10)}...`
        : value;
      log(`✅ ${key}: ${displayValue}`, 'green');
    }
  }

  if (hasErrors) {
    log('\n❌ RESEND_API_KEY is required. Please set it in your .env.local file.', 'red');
    log('\nExample:', 'yellow');
    log('RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'yellow');
    process.exit(1);
  }

  // Display configuration
  logSection('Email Configuration');
  log(`From Email: ${process.env.RESEND_FROM_EMAIL || 'noreply@pawtraits.pics'}`, 'blue');
  log(`Reply To: ${process.env.SUPPORT_EMAIL || 'support@pawtraits.pics'}`, 'blue');
  log(`From Name: ${process.env.RESEND_FROM_NAME || 'Pawtraits'}`, 'blue');

  // Send test email
  logSection('Sending Test Email');

  try {
    log('📤 Sending test email via Resend...', 'yellow');

    const result = await testEmailConfiguration(testEmail);

    if (result.success) {
      log('\n✅ Test email sent successfully!', 'green');
      log(`📧 Message ID: ${result.messageId}`, 'blue');

      log('\n📋 Next Steps:', 'cyan');
      log('1. Check your inbox (including spam folder)', 'yellow');
      log('2. Verify the from address is correct', 'yellow');
      log('3. Try replying to test reply-to address', 'yellow');
      log('4. Check email headers for SPF/DKIM/DMARC pass', 'yellow');

      log('\n🔍 To check email authentication:', 'cyan');
      log('- Forward the email to: mail-tester@mail-tester.com', 'yellow');
      log('- Visit: https://www.mail-tester.com/', 'yellow');
      log('- Aim for a score of 8/10 or higher', 'yellow');

      log('\n📊 Monitor email delivery:', 'cyan');
      log('- Go to Resend Dashboard → Logs', 'yellow');
      log('- Check delivery status and any bounces', 'yellow');
    } else {
      log('\n❌ Test email failed to send', 'red');
      log(`Error: ${result.error}`, 'red');

      log('\n🔧 Troubleshooting:', 'cyan');
      log('1. Verify RESEND_API_KEY is correct', 'yellow');
      log('2. Check domain is verified in Resend dashboard', 'yellow');
      log('3. Verify DNS records are configured (SPF, DKIM, DMARC)', 'yellow');
      log('4. Wait 24-48 hours for DNS propagation', 'yellow');
      log('5. Check Resend dashboard for detailed error logs', 'yellow');

      process.exit(1);
    }
  } catch (error) {
    log('\n❌ Unexpected error occurred', 'red');
    if (error instanceof Error) {
      log(error.message, 'red');
      if (error.stack) {
        log('\nStack trace:', 'yellow');
        console.error(error.stack);
      }
    }
    process.exit(1);
  }

  // Additional test: Send a more realistic email
  logSection('Sending Realistic Email Example');

  try {
    log('📤 Sending order confirmation example...', 'yellow');

    const result = await sendEmail({
      to: testEmail,
      subject: 'Your Pawtraits Order Confirmation #12345',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .order-details {
              background: white;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              color: #666;
              font-size: 12px;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
            }
            .button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🐾 Thank You for Your Order!</h1>
          </div>
          <div class="content">
            <p>Hi there,</p>
            <p>This is a <strong>test email</strong> to demonstrate what your customers will receive when they place an order.</p>

            <div class="order-details">
              <h2>Order Details</h2>
              <p><strong>Order Number:</strong> #12345-TEST</p>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              <p><strong>Total:</strong> $29.99</p>

              <h3>Items:</h3>
              <ul>
                <li>1x Canvas Print (16"x20") - Golden Retriever Portrait</li>
                <li>Theme: Renaissance Royalty</li>
              </ul>
            </div>

            <p>We'll send you another email when your order ships.</p>

            <a href="https://pawtraits.pics/orders/12345" class="button">View Order Status</a>

            <div class="footer">
              <p>This is a test email from Pawtraits Email Configuration Test</p>
              <p>If you received this email correctly, your email system is working!</p>
              <p>Questions? Reply to this email or contact us at support@pawtraits.pics</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Thank You for Your Order!

This is a test email to demonstrate what your customers will receive when they place an order.

Order Details:
- Order Number: #12345-TEST
- Date: ${new Date().toLocaleDateString()}
- Total: $29.99

Items:
- 1x Canvas Print (16"x20") - Golden Retriever Portrait
- Theme: Renaissance Royalty

We'll send you another email when your order ships.

View order status: https://pawtraits.pics/orders/12345

Questions? Reply to this email or contact us at support@pawtraits.pics
      `,
      tags: [
        { name: 'type', value: 'order_confirmation' },
        { name: 'test', value: 'true' }
      ]
    });

    if (result.success) {
      log('\n✅ Order confirmation example sent!', 'green');
      log(`📧 Message ID: ${result.messageId}`, 'blue');
      log('\nCheck your inbox to see how customer emails will look.', 'yellow');
    } else {
      log('\n⚠️  Order confirmation example failed', 'yellow');
      log(`Reason: ${result.error}`, 'yellow');
    }
  } catch (error) {
    log('\n⚠️  Could not send order confirmation example', 'yellow');
  }

  // Final checklist
  logSection('Email Configuration Checklist');

  log('Before going to production, verify:', 'cyan');
  log('', 'reset');
  log('DNS Records (use mxtoolbox.com):', 'yellow');
  log('  ☐ A record points to Vercel', 'reset');
  log('  ☐ MX records point to cPanel mail server', 'reset');
  log('  ☐ SPF record includes both cPanel and Resend', 'reset');
  log('  ☐ DKIM record exists for Resend', 'reset');
  log('  ☐ DMARC record exists', 'reset');
  log('', 'reset');
  log('Resend Dashboard:', 'yellow');
  log('  ☐ Domain shows "Verified" status', 'reset');
  log('  ☐ API key is Production (not Test)', 'reset');
  log('  ☐ From address domain is verified', 'reset');
  log('', 'reset');
  log('Vercel Environment Variables:', 'yellow');
  log('  ☐ RESEND_API_KEY set in all environments', 'reset');
  log('  ☐ RESEND_FROM_EMAIL set correctly', 'reset');
  log('  ☐ SUPPORT_EMAIL set for replies', 'reset');
  log('', 'reset');
  log('Email Testing:', 'yellow');
  log('  ☐ Test emails arrive in inbox (not spam)', 'reset');
  log('  ☐ From address displays correctly', 'reset');
  log('  ☐ Reply-to address works', 'reset');
  log('  ☐ Email authentication passes (SPF/DKIM/DMARC)', 'reset');
  log('  ☐ Mail-tester.com score is 8/10 or higher', 'reset');

  log('\n✅ Email configuration test complete!', 'green');
}

// Run the test
testEmailConfig().catch((error) => {
  log('\n❌ Fatal error:', 'red');
  console.error(error);
  process.exit(1);
});
