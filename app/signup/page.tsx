'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Heart, Star, Camera, Gift, ArrowRight, Mail, User } from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';

// Security imports
import { SecureWrapper } from '@/components/security/SecureWrapper';
import { SecureForm, FormField } from '@/components/security/SecureForm';

export default function CustomerSignupPage() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const supabaseService = new SupabaseService();

  // Define secure form fields
  const signupFields: FormField[] = [
    {
      name: 'firstName',
      type: 'text',
      label: 'First Name',
      placeholder: 'Sarah',
      required: true,
      maxLength: 50
    },
    {
      name: 'lastName',
      type: 'text',
      label: 'Last Name',
      placeholder: 'Johnson',
      required: true,
      maxLength: 50
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email Address',
      placeholder: 'sarah@email.com',
      required: true,
      maxLength: 254
    },
    {
      name: 'password',
      type: 'password',
      label: 'Password',
      placeholder: '••••••••',
      required: true,
      sensitive: true,
      maxLength: 128
    },
    {
      name: 'confirmPassword',
      type: 'password',
      label: 'Confirm Password',
      placeholder: '••••••••',
      required: true,
      sensitive: true,
      maxLength: 128
    }
  ];

  const handleSecureSubmit = async (formData: Record<string, any>, securityInfo: any) => {
    // Additional validation for password confirmation
    if (formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setLoading(true);

    try {
      // Create customer auth account
      const authResult = await supabaseService.signUp(formData.email, formData.password, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        userType: 'customer'
      });

      if (authResult.user) {
        setSuccess(true);
      }
    } catch (error) {
      console.error('Signup error:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to create account' });
    } finally {
      setLoading(false);
    }
  };

  const handleSecurityViolation = (violation: any) => {
    console.warn('Security violation detected:', violation);
    setErrors({ submit: 'Security violation detected. Please try again.' });
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Pawtraits!</h1>
            <p className="text-gray-600 mb-6">
              Your account has been created! Check your email to verify your account, then start creating amazing pet portraits.
            </p>
            <Link href="/customer/shop">
              <Button className="w-full bg-gradient-to-r from-pink-600 to-purple-600">
                Create Your First Portrait
                <Camera className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SecureWrapper 
      componentName="CustomerSignup"
      sensitiveContent={true}
      config={{
        enableXSSProtection: true,
        enableClickjackingProtection: true,
        sanitizationLevel: 'strict',
        enableSecurityLogging: true
      }}
    >
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white py-20">
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            🎨 Create Beautiful Pet Portraits
          </h1>
          <p className="text-xl md:text-2xl text-pink-100 mb-8">
            Transform your pet photos into stunning AI-generated artwork
          </p>
          
          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mt-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">AI-Powered</h3>
              <p className="text-pink-100 text-sm">Advanced AI creates professional portraits</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">Multiple Styles</h3>
              <p className="text-pink-100 text-sm">Choose from artistic styles and themes</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">Print Ready</h3>
              <p className="text-pink-100 text-sm">High-quality files perfect for gifts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Signup Form */}
      <div className="py-16 px-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Create Your Account</CardTitle>
              <CardDescription>
                Join thousands of pet lovers creating beautiful portraits
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-red-700">{errors.submit}</p>
                </div>
              )}
              
              <SecureForm
                fields={signupFields}
                onSubmit={handleSecureSubmit}
                onSecurityViolation={handleSecurityViolation}
                config={{
                  enableCSRFProtection: true,
                  enableRateLimiting: true,
                  maxSubmissionsPerMinute: 3,
                  requiredSecurityLevel: 'high',
                  sanitizeInputs: true
                }}
                submitButtonText={loading ? 'Creating Account...' : 'Create Account'}
                submitButtonClassName="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
                className="space-y-4"
              />

              <div className="space-y-4 mt-6 pt-6 border-t">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    Already have an account?{' '}
                    <Link href="/auth/login" className="text-purple-600 hover:text-purple-700 font-medium">
                      Sign in
                    </Link>
                  </p>
                </div>

                {/* Special Offers */}
                <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg p-4">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <Gift className="w-5 h-5 text-purple-600" />
                    <h3 className="font-medium text-purple-800">Got a Referral?</h3>
                  </div>
                  <p className="text-sm text-purple-700 text-center mb-3">
                    Use your groomer's QR code for 20% off your first portrait!
                  </p>
                  <Link href="/customer/shop">
                    <Button variant="outline" size="sm" className="w-full">
                      I Have a Referral Code
                    </Button>
                  </Link>
                </div>

                {/* Business Account */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <User className="w-5 h-5 text-blue-600" />
                    <h3 className="font-medium text-blue-800">Business Account?</h3>
                  </div>
                  <p className="text-sm text-blue-700 text-center mb-3">
                    Groomers, vets & breeders can earn commissions by referring clients
                  </p>
                  <Link href="/signup/partner">
                    <Button variant="outline" size="sm" className="w-full">
                      Become a Partner
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </SecureWrapper>
  );
}