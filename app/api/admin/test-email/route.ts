import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/messaging/providers/email-provider';

/**
 * Admin endpoint to send test emails via Resend
 * Tests the Resend integration and email configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, testType } = body;

    if (!to || !testType) {
      return NextResponse.json(
        { error: 'Missing required fields: to, testType' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Invalid email address format' },
        { status: 400 }
      );
    }

    console.log(`📧 Sending ${testType} test email to: ${to}`);

    let result;

    switch (testType) {
      case 'simple':
        result = await sendEmail({
          to,
          subject: 'Pawtraits Email Test - Simple',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #7c3aed;">📧 Email Configuration Test</h1>
              <p>This is a simple test email from Pawtraits via Resend.</p>
              <p><strong>If you received this email, your Resend integration is working correctly!</strong></p>

              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
                <p style="margin: 5px 0;"><strong>Test Type:</strong> Simple Text</p>
              </div>

              <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px;">
                Pawtraits Email System<br>
                Powered by Resend
              </p>
            </div>
          `,
          text: `Email Configuration Test\n\nThis is a simple test email from Pawtraits via Resend.\n\nIf you received this email, your Resend integration is working correctly!\n\nSent at: ${new Date().toLocaleString()}`,
          tags: [
            { name: 'type', value: 'test_email' },
            { name: 'test_type', value: 'simple' }
          ]
        });
        break;

      case 'styled':
        result = await sendEmail({
          to,
          subject: 'Pawtraits Email Test - Styled Template',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  background: #f9fafb;
                  margin: 0;
                  padding: 0;
                }
                .container {
                  max-width: 600px;
                  margin: 40px auto;
                  background: white;
                  border-radius: 12px;
                  overflow: hidden;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .header {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  padding: 40px 30px;
                  text-align: center;
                }
                .header h1 {
                  margin: 0;
                  font-size: 32px;
                }
                .content {
                  padding: 40px 30px;
                }
                .info-box {
                  background: #f3f4f6;
                  border-left: 4px solid #7c3aed;
                  padding: 20px;
                  margin: 20px 0;
                  border-radius: 4px;
                }
                .button {
                  display: inline-block;
                  background: #7c3aed;
                  color: white;
                  padding: 14px 28px;
                  text-decoration: none;
                  border-radius: 8px;
                  margin: 20px 0;
                  font-weight: 600;
                }
                .footer {
                  background: #f9fafb;
                  padding: 30px;
                  text-align: center;
                  color: #666;
                  font-size: 14px;
                  border-top: 1px solid #e5e7eb;
                }
                .success-badge {
                  display: inline-block;
                  background: #10b981;
                  color: white;
                  padding: 8px 16px;
                  border-radius: 20px;
                  font-size: 14px;
                  font-weight: 600;
                  margin: 20px 0;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎨 Pawtraits</h1>
                  <p>Email System Test - Styled Template</p>
                </div>

                <div class="content">
                  <div class="success-badge">✓ Email System Working</div>

                  <h2>Styled Email Test</h2>
                  <p>This is a fully styled test email demonstrating:</p>

                  <ul>
                    <li>✅ Gradient header background</li>
                    <li>✅ Responsive design</li>
                    <li>✅ Styled components</li>
                    <li>✅ Brand colors</li>
                    <li>✅ Custom fonts</li>
                  </ul>

                  <div class="info-box">
                    <p style="margin: 5px 0;"><strong>📧 Delivered via:</strong> Resend</p>
                    <p style="margin: 5px 0;"><strong>🕐 Sent at:</strong> ${new Date().toLocaleString()}</p>
                    <p style="margin: 5px 0;"><strong>🎯 Test Type:</strong> Styled Template</p>
                  </div>

                  <p>If this email displays correctly with colors, styling, and formatting, your email templates are working perfectly!</p>

                  <a href="https://pawtraits.pics" class="button">Visit Pawtraits</a>
                </div>

                <div class="footer">
                  <p><strong>Pawtraits Email System</strong></p>
                  <p>Powered by Resend • Hosted on Vercel</p>
                  <p style="margin-top: 15px; font-size: 12px; color: #999;">
                    This is a test email. If you weren't expecting this, please ignore it.
                  </p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `Pawtraits Email System Test - Styled Template\n\n✓ Email System Working\n\nThis is a fully styled test email demonstrating various email features.\n\nDelivered via: Resend\nSent at: ${new Date().toLocaleString()}\nTest Type: Styled Template\n\nIf you received this email, your Resend integration is working correctly!\n\nVisit: https://pawtraits.pics`,
          tags: [
            { name: 'type', value: 'test_email' },
            { name: 'test_type', value: 'styled' }
          ]
        });
        break;

      case 'order-confirmation':
        result = await sendEmail({
          to,
          subject: 'Order Confirmation #TEST-12345 - Pawtraits',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  background: #f9fafb;
                  margin: 0;
                  padding: 0;
                }
                .container {
                  max-width: 600px;
                  margin: 40px auto;
                  background: white;
                  border-radius: 12px;
                  overflow: hidden;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .header {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  padding: 40px 30px;
                  text-align: center;
                }
                .content {
                  padding: 40px 30px;
                }
                .order-details {
                  background: #f9fafb;
                  border: 1px solid #e5e7eb;
                  border-radius: 8px;
                  padding: 20px;
                  margin: 20px 0;
                }
                .order-item {
                  display: flex;
                  padding: 15px 0;
                  border-bottom: 1px solid #e5e7eb;
                }
                .total-row {
                  display: flex;
                  justify-content: space-between;
                  padding: 15px 0;
                  font-size: 18px;
                  font-weight: bold;
                }
                .button {
                  display: inline-block;
                  background: #7c3aed;
                  color: white;
                  padding: 14px 28px;
                  text-decoration: none;
                  border-radius: 8px;
                  margin: 20px 0;
                  font-weight: 600;
                }
                .footer {
                  background: #f9fafb;
                  padding: 30px;
                  text-align: center;
                  color: #666;
                  font-size: 14px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🐾 Thank You for Your Order!</h1>
                  <p>Order #TEST-12345</p>
                </div>

                <div class="content">
                  <p>Hi there,</p>
                  <p>This is a <strong>test email</strong> showing what your customers will receive when they place an order.</p>

                  <div class="order-details">
                    <h2 style="margin-top: 0;">Order Details</h2>

                    <div style="margin: 15px 0;">
                      <strong>Order Number:</strong> TEST-12345<br>
                      <strong>Order Date:</strong> ${new Date().toLocaleDateString()}<br>
                      <strong>Status:</strong> <span style="color: #10b981; font-weight: 600;">Confirmed</span>
                    </div>

                    <h3>Items:</h3>
                    <div class="order-item">
                      <div style="flex: 1;">
                        <strong>Canvas Print (16"x20")</strong><br>
                        <span style="color: #666; font-size: 14px;">Golden Retriever - Renaissance Style</span>
                      </div>
                      <div style="text-align: right;">
                        <strong>£29.99</strong>
                      </div>
                    </div>

                    <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
                      <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                        <span>Subtotal:</span>
                        <span>£29.99</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                        <span>Shipping:</span>
                        <span>£9.99</span>
                      </div>
                      <div class="total-row" style="border-top: 1px solid #e5e7eb; margin-top: 10px;">
                        <span>Total:</span>
                        <span>£39.98</span>
                      </div>
                    </div>
                  </div>

                  <p><strong>What's Next?</strong></p>
                  <p>We'll send you another email when your order ships with tracking information.</p>

                  <a href="https://pawtraits.pics/customer/orders/test-12345" class="button">View Order Status</a>

                  <p style="margin-top: 30px; font-size: 14px; color: #666;">
                    Questions? Reply to this email or contact us at support@pawtraits.pics
                  </p>
                </div>

                <div class="footer">
                  <p><strong>This is a test email</strong></p>
                  <p>If your customers receive emails like this, your system is working perfectly!</p>
                  <p style="margin-top: 15px; font-size: 12px; color: #999;">
                    Pawtraits • Email System Test • Powered by Resend
                  </p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `Thank You for Your Order!\n\nOrder #TEST-12345\n\nThis is a test email showing what your customers will receive when they place an order.\n\nOrder Details:\nOrder Number: TEST-12345\nOrder Date: ${new Date().toLocaleDateString()}\nStatus: Confirmed\n\nItems:\n- Canvas Print (16"x20") - Golden Retriever - Renaissance Style - £29.99\n\nSubtotal: £29.99\nShipping: £9.99\nTotal: £39.98\n\nWhat's Next?\nWe'll send you another email when your order ships with tracking information.\n\nView Order Status: https://pawtraits.pics/customer/orders/test-12345\n\nQuestions? Reply to this email or contact us at support@pawtraits.pics`,
          tags: [
            { name: 'type', value: 'test_email' },
            { name: 'test_type', value: 'order_confirmation' }
          ]
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid test type. Use: simple, styled, or order-confirmation' },
          { status: 400 }
        );
    }

    if (result.success) {
      console.log(`✅ Test email sent successfully: ${result.messageId}`);
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: `Test email sent successfully to ${to}`,
        testType
      });
    } else {
      console.error(`❌ Test email failed:`, result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to send test email'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('💥 Test email endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
