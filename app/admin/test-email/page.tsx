'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function TestEmailPage() {
  const [email, setEmail] = useState('');
  const [testType, setTestType] = useState<'simple' | 'styled' | 'order-confirmation'>('simple');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; messageId?: string } | null>(null);

  const sendTestEmail = async () => {
    if (!email) {
      setResult({ success: false, message: 'Please enter an email address' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email,
          testType: testType
        })
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: `Test email sent successfully! Check your inbox at ${email}`,
          messageId: data.messageId
        });
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to send test email'
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Network error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Mail className="w-8 h-8 mr-3 text-purple-600" />
            Email System Test
          </h1>
          <p className="text-gray-600 mt-2">
            Test your Resend integration and email templates
          </p>
        </div>

        {/* Configuration Check */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration Status</CardTitle>
            <CardDescription>
              Current email configuration from environment variables
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>From Email:</strong>
                <p className="text-gray-600">{process.env.NEXT_PUBLIC_RESEND_FROM_EMAIL || 'noreply@pawtraits.pics'}</p>
              </div>
              <div>
                <strong>From Name:</strong>
                <p className="text-gray-600">Pawtraits</p>
              </div>
              <div>
                <strong>Reply-To:</strong>
                <p className="text-gray-600">{process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@pawtraits.pics'}</p>
              </div>
              <div>
                <strong>Provider:</strong>
                <p className="text-gray-600">Resend</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <p className="text-blue-800 text-sm flex items-start">
                <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Note:</strong> If configuration looks wrong, check your environment variables in Vercel and redeploy.
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Test Email Sender */}
        <Card>
          <CardHeader>
            <CardTitle>Send Test Email</CardTitle>
            <CardDescription>
              Send a test email to verify Resend integration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email">Recipient Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="your-email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="max-w-md"
              />
              <p className="text-xs text-gray-500">
                Enter the email address where you want to receive the test
              </p>
            </div>

            {/* Test Type Selection */}
            <div className="space-y-3">
              <Label>Test Email Type</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Simple Test */}
                <div
                  onClick={() => setTestType('simple')}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    testType === 'simple'
                      ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">Simple Text</h3>
                    {testType === 'simple' && (
                      <CheckCircle className="w-5 h-5 text-purple-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Basic email with plain text and simple HTML
                  </p>
                </div>

                {/* Styled Template */}
                <div
                  onClick={() => setTestType('styled')}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    testType === 'styled'
                      ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">Styled Template</h3>
                    {testType === 'styled' && (
                      <CheckCircle className="w-5 h-5 text-purple-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Fully styled email with brand colors and formatting
                  </p>
                </div>

                {/* Order Confirmation */}
                <div
                  onClick={() => setTestType('order-confirmation')}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    testType === 'order-confirmation'
                      ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">Order Confirmation</h3>
                    {testType === 'order-confirmation' && (
                      <CheckCircle className="w-5 h-5 text-purple-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Sample order confirmation email for customers
                  </p>
                </div>
              </div>
            </div>

            {/* Send Button */}
            <Button
              onClick={sendTestEmail}
              disabled={loading || !email}
              className="w-full md:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending Test Email...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Test Email
                </>
              )}
            </Button>

            {/* Result Message */}
            {result && (
              <div
                className={`rounded-lg p-4 flex items-start space-x-3 ${
                  result.success
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                    {result.success ? 'Email Sent Successfully!' : 'Email Failed'}
                  </p>
                  <p className={`text-sm mt-1 ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                    {result.message}
                  </p>
                  {result.messageId && (
                    <p className="text-xs text-green-600 mt-2 font-mono">
                      Message ID: {result.messageId}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Supabase Auth Email Testing */}
        <Card>
          <CardHeader>
            <CardTitle>Test Supabase Auth Emails</CardTitle>
            <CardDescription>
              Test authentication emails sent via Resend SMTP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">How to Test Supabase Auth Emails:</h3>
              <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                <li>
                  <strong>Signup Email:</strong>
                  <ul className="ml-6 mt-1 list-disc list-inside">
                    <li>Go to <code className="bg-blue-100 px-1 rounded">/signup</code></li>
                    <li>Create a new account with a test email address</li>
                    <li>Check your inbox for the verification email from Supabase</li>
                  </ul>
                </li>
                <li className="mt-2">
                  <strong>Password Reset:</strong>
                  <ul className="ml-6 mt-1 list-disc list-inside">
                    <li>Go to <code className="bg-blue-100 px-1 rounded">/auth/login</code></li>
                    <li>Click "Forgot Password?"</li>
                    <li>Enter your email address</li>
                    <li>Check your inbox for the password reset email</li>
                  </ul>
                </li>
                <li className="mt-2">
                  <strong>Magic Link (if enabled):</strong>
                  <ul className="ml-6 mt-1 list-disc list-inside">
                    <li>Request a magic link login</li>
                    <li>Check your inbox for the authentication link</li>
                  </ul>
                </li>
              </ol>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-medium text-yellow-900 mb-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Troubleshooting Supabase Emails
              </h3>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>Verify Resend integration in Supabase Dashboard → Project Settings → Auth → SMTP Settings</li>
                <li>Check that SMTP is enabled and configured correctly</li>
                <li>Ensure "From" email is verified in Resend dashboard</li>
                <li>Check spam folder if emails don't arrive</li>
                <li>Look for errors in Supabase logs if emails fail to send</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <a
                href="/signup"
                target="_blank"
                className="inline-block"
              >
                <Button variant="outline" className="w-full">
                  Test Signup Email →
                </Button>
              </a>
              <a
                href="/auth/login"
                target="_blank"
                className="inline-block"
              >
                <Button variant="outline" className="w-full">
                  Test Password Reset →
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Resend Dashboard Link */}
        <Card>
          <CardHeader>
            <CardTitle>Monitor Emails</CardTitle>
            <CardDescription>
              View email delivery status and logs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Go to your Resend dashboard to view:
            </p>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 ml-2">
              <li>Email delivery status</li>
              <li>Bounce and complaint rates</li>
              <li>Email logs and debugging information</li>
              <li>Domain verification status</li>
            </ul>
            <a
              href="https://resend.com/emails"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <Button variant="outline">
                Open Resend Dashboard →
              </Button>
            </a>
          </CardContent>
        </Card>

        {/* Checklist */}
        <Card>
          <CardHeader>
            <CardTitle>Email System Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="check1" className="rounded" />
                <label htmlFor="check1">Resend API key configured in Vercel</label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="check2" className="rounded" />
                <label htmlFor="check2">Domain verified in Resend dashboard</label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="check3" className="rounded" />
                <label htmlFor="check3">DNS records (SPF, DKIM, DMARC) configured</label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="check4" className="rounded" />
                <label htmlFor="check4">Supabase SMTP configured with Resend</label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="check5" className="rounded" />
                <label htmlFor="check5">Test emails received successfully</label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="check6" className="rounded" />
                <label htmlFor="check6">Supabase auth emails working</label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="check7" className="rounded" />
                <label htmlFor="check7">Emails not going to spam</label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
