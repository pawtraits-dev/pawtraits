'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ArrowLeft, ArrowRight, Heart, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase-client';
import type { Breed, Coat } from '@/lib/types';

interface FormData {
  // User account
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone: string;
  
  // Pet details
  petName: string;
  breedId: string;
  coatId: string;
  age: string;
  gender: string;
  weight: string;
  personalityTraits: string[];
  specialNotes: string;
}

function UserQRSignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // QR-specific parameters
  const imageId = searchParams.get('imageId');
  const productId = searchParams.get('productId');
  const quantity = searchParams.get('quantity');
  const partnerId = searchParams.get('partner');
  const discountCode = searchParams.get('discount');
  
  // Legacy referral support
  const referralCode = searchParams.get('ref');
  const discount = searchParams.get('discount');
  
  const [currentStep, setCurrentStep] = useState(1);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [coats, setCoats] = useState<Coat[]>([]);
  const [filteredCoats, setFilteredCoats] = useState<Coat[]>([]);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    petName: '',
    breedId: '',
    coatId: '',
    age: '',
    gender: 'unknown',
    weight: '',
    personalityTraits: [],
    specialNotes: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [petPhoto, setPetPhoto] = useState<File | null>(null);
  const [petPhotoPreview, setPetPhotoPreview] = useState<string | null>(null);
  const [referralData, setReferralData] = useState<any>(null);

  // Using singleton supabase client imported above
  const supabase = getSupabaseClient();

  useEffect(() => {
    loadBreedAndCoatData();
  }, []);

  useEffect(() => {
    if (referralCode) {
      console.log('Loading referral data for code:', referralCode);
      loadReferralData();
    }
  }, [referralCode]);

  useEffect(() => {
    // Filter coats based on selected breed
    if (formData.breedId && breeds.length > 0 && coats.length > 0) {
      const selectedBreed = breeds.find(b => b.id === formData.breedId);
      if (selectedBreed) {
        // You could implement breed-coat compatibility here
        // For now, show all coats
        setFilteredCoats(coats.filter((c: any) => c.is_active));
      }
    } else {
      setFilteredCoats(coats.filter((c: any) => c.is_active));
    }
  }, [formData.breedId, breeds, coats]);

  const loadBreedAndCoatData = async () => {
    try {
      const [breedsData, coatsData] = await Promise.all([
        supabase.from('breeds').select('*'),
        supabase.from('coats').select('*')
      ]);
      setBreeds(breedsData?.data?.filter((b: any) => b.is_active) || []);
      setCoats(coatsData?.data?.filter((c: any) => c.is_active) || []);
    } catch (error) {
      console.error('Error loading breed/coat data:', error);
    }
  };

  const loadReferralData = async () => {
    try {
      console.log('Loading referral data for code:', referralCode);
      const response = await fetch(`/api/referrals/code/${referralCode}`);
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Full referral data loaded:', JSON.stringify(data, null, 2));
        console.log('Pet fields in data:', {
          pet_name: data.pet_name,
          pet_breed_id: data.pet_breed_id,
          pet_coat_id: data.pet_coat_id
        });
        
        setReferralData(data);
        
        // Auto-populate form with referral data
        if (data.client_name && data.client_email) {
          const [firstName, ...lastNameParts] = data.client_name.split(' ');
          const newFormData = {
            ...formData,
            email: data.client_email || '',
            firstName: firstName || '',
            lastName: lastNameParts.join(' ') || '',
            phone: data.client_phone || '',
            petName: data.pet_name || '',
            breedId: data.pet_breed_id || '',
            coatId: data.pet_coat_id || ''
          };
          
          console.log('Setting form data to:', JSON.stringify(newFormData, null, 2));
          setFormData(newFormData);
        } else {
          console.log('Missing required data:', {
            client_name: data.client_name,
            client_email: data.client_email
          });
        }
      } else {
        console.log('Response not ok:', response.status, response.statusText);
        const errorData = await response.text();
        console.log('Error response:', errorData);
      }
    } catch (error) {
      console.error('Error loading referral data:', error);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPetPhoto(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPetPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPetPhoto(null);
    setPetPhotoPreview(null);
  };

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.email.trim()) newErrors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';
      
      if (!formData.password) newErrors.password = 'Password is required';
      else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
      
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
      
      if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
      if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    }

    if (step === 2) {
      // Pet details are now optional - no validation errors
      // Users can skip this step if they want to add pets later
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(2)) return;

    setLoading(true);

    try {
      // 1. Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName
          }
        }
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      // 2. Auto-confirm user email (for development)
      try {
        const confirmResponse = await fetch('/api/auth/confirm-user-by-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email }),
        });
        
        if (confirmResponse.ok) {
          console.log('User email confirmed');
          
          // 3. Sign in the user after email confirmation
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
          });
          
          if (signInError) {
            console.error('Auto sign-in failed:', signInError);
            throw signInError;
          }
          
          console.log('User automatically signed in after confirmation');
        }
      } catch (confirmError) {
        console.warn('Email confirmation or auto-signin failed:', confirmError);
        throw confirmError; // Fail the signup if we can't log them in
      }

      // 4. Upload pet photo if provided
      let photoUrl = null;
      if (petPhoto) {
        try {
          const photoFormData = new FormData();
          photoFormData.append('file', petPhoto);
          photoFormData.append('userId', authData.user.id);
          
          const uploadResponse = await fetch('/api/upload/pet-photo', {
            method: 'POST',
            body: photoFormData
          });
          
          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            photoUrl = uploadData.url;
          }
        } catch (uploadError) {
          console.warn('Photo upload failed:', uploadError);
        }
      }

      // 5. Create customer record
      let customerId = null;
      try {
        const customerData = {
          email: formData.email.toLowerCase().trim(),
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          user_id: authData.user.id,
          is_registered: true,
          referred_by_partner_id: null, // Will be set by referral tracking below
          referral_code: referralCode || null,
          referral_date: referralCode ? new Date().toISOString() : null
        };

        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .insert(customerData)
          .select()
          .single();

        if (customerError) {
          console.error('Customer creation error:', customerError);
          // Continue anyway - user account was created successfully
        } else if (customer) {
          customerId = customer.id;
        }
      } catch (customerError) {
        console.warn('Customer record creation failed:', customerError);
      }

      // 4b. Create user profile with customer type using database function
      try {
        console.log('Creating user profile for customer using RPC function...', {
          user_id: authData.user.id,
          user_type: 'customer',
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          email: formData.email.toLowerCase().trim(),
          customer_id: customerId
        });
        
        const { data: profileData, error: profileError } = await supabase
          .rpc('create_user_profile', {
            p_user_id: authData.user.id,
            p_user_type: 'customer',
            p_first_name: formData.firstName.trim(),
            p_last_name: formData.lastName.trim(),
            p_email: formData.email.toLowerCase().trim(),
            p_phone: formData.phone || null,
            p_partner_id: null,
            p_customer_id: customerId
          });
          
        console.log('User profile creation result:', { profileData, profileError });
        
        if (profileError) {
          console.error('Profile creation error:', profileError);
          throw profileError;
        } else {
          console.log('User profile created successfully:', profileData);
        }
      } catch (profileError) {
        console.error('User profile creation failed:', profileError);
        // Don't throw - let the signup continue even if profile creation fails
      }

      // 6. Create pet record (only if user provided pet details)
      if (formData.petName.trim()) {
        const petData = {
          user_id: authData.user.id,
          name: formData.petName,
          breed_id: formData.breedId || null,
          coat_id: formData.coatId || null,
          age: formData.age ? parseInt(formData.age) : null,
          gender: formData.gender,
          weight: formData.weight ? parseFloat(formData.weight) : null,
          primary_photo_url: photoUrl,
          personality_traits: formData.personalityTraits,
          special_notes: formData.specialNotes || null
        };

        const { error: petError } = await supabase
          .rpc('create_user_pet', {
            p_user_id: authData.user.id,
            p_name: petData.name,
            p_breed_id: petData.breed_id,
            p_coat_id: petData.coat_id,
            p_age: petData.age,
            p_gender: petData.gender,
            p_weight: petData.weight,
            p_primary_photo_url: petData.primary_photo_url,
            p_personality_traits: petData.personality_traits,
            p_special_notes: petData.special_notes
          });

        if (petError) {
          console.error('Pet creation error:', petError);
          // Continue anyway - user account was created successfully
        }
      } else {
        console.log('No pet name provided, skipping pet creation');
      }

      // 7. Update referral tracking if referral code provided
      if (referralCode) {
        try {
          console.log('Updating referral tracking for code:', referralCode);
          
          // Mark referral as accepted using the enhanced database function
          const { data: updatedReferral, error: acceptedError } = await supabase
            .rpc('mark_referral_accepted_enhanced', {
              p_referral_code: referralCode,
              p_customer_email: formData.email.toLowerCase().trim(),
              p_customer_name: `${formData.firstName} ${formData.lastName}`.trim(),
              p_customer_phone: formData.phone || null
            });

          if (acceptedError) {
            console.error('Error marking referral as accepted:', acceptedError);
          } else {
            console.log('Referral marked as accepted:', updatedReferral);
            
            // Update customer record with partner reference if we got the referral data
            if (updatedReferral?.partner_id) {
              await supabase
                .from('customers')
                .update({ referred_by_partner_id: updatedReferral.partner_id })
                .eq('user_id', authData.user.id);
            }
          }

          // Track referral event
          if (updatedReferral?.id) {
            await fetch(`/api/referrals/${updatedReferral.id}/track`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                event_type: 'signup_complete',
                user_id: authData.user.id,
                event_data: {
                  customer_email: formData.email,
                  customer_name: `${formData.firstName} ${formData.lastName}`.trim(),
                  pet_name: formData.petName
                }
              })
            });
          }
        } catch (referralError) {
          console.warn('Referral tracking failed:', referralError);
        }
      }

      setSuccess(true);
    } catch (error) {
      console.error('Signup error:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to create account' });
    } finally {
      setLoading(false);
    }
  };

  // Handle redirect after success
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        // Redirect back to QR landing page with auth context
        if (imageId && productId) {
          const returnUrl = new URL(`/shop/${imageId}`, window.location.origin);
          if (partnerId) returnUrl.searchParams.set('partner', partnerId);
          if (discountCode) returnUrl.searchParams.set('discount', discountCode);
          returnUrl.searchParams.set('autoAdd', 'true');
          returnUrl.searchParams.set('productId', productId);
          if (quantity) returnUrl.searchParams.set('quantity', quantity);
          router.push(returnUrl.toString());
        } else {
          router.push('/');
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, router, imageId, productId, partnerId, discountCode, quantity]);

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Pawtraits!</h1>
            <p className="text-gray-600 mb-6">
              Your account has been created successfully. {imageId ? 'You\'re being redirected back to complete your purchase!' : 'You\'re being redirected to your personalized homepage!'}
            </p>
            {discount && (
              <Badge className="mb-4 bg-green-100 text-green-800">
                {discount}% Discount Applied!
              </Badge>
            )}
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Heart className="w-8 h-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Your Pawtraits Account</h1>
              {referralCode && discount && (
                <Badge className="mt-1 bg-purple-100 text-purple-800">
                  {discount}% Off Your First Portrait!
                </Badge>
              )}
            </div>
          </div>
          <Link href="/" className="text-gray-600 hover:text-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>
      </div>

      <div className="py-16 px-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                {currentStep === 1 ? 'Create Your Account' : 'Tell Us About Your Pet (Optional)'}
              </CardTitle>
              <CardDescription>
                {currentStep === 1 
                  ? 'First, let\'s set up your personal account'
                  : 'You can add pet details now or skip this step and add them later'
                }
              </CardDescription>
              
              {/* Progress indicator */}
              <div className="flex items-center justify-center space-x-4 mt-6">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 1 ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>1</div>
                <div className={`h-1 w-16 ${currentStep >= 2 ? 'bg-purple-600' : 'bg-gray-200'}`}></div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 2 ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>2</div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className={errors.firstName ? 'border-red-500' : ''}
                        placeholder="John"
                      />
                      {errors.firstName && <p className="text-sm text-red-600">{errors.firstName}</p>}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className={errors.lastName ? 'border-red-500' : ''}
                        placeholder="Smith"
                      />
                      {errors.lastName && <p className="text-sm text-red-600">{errors.lastName}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className={`${errors.email ? 'border-red-500' : ''} ${
                        referralData?.client_email ? 'bg-gray-50 text-gray-700' : ''
                      }`}
                      placeholder="john@example.com"
                      readOnly={!!referralData?.client_email}
                    />
                    {referralData?.client_email && (
                      <p className="text-xs text-gray-500">Email provided by your referrer</p>
                    )}
                    {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+44 7123 456789"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className={errors.password ? 'border-red-500' : ''}
                        placeholder="••••••••"
                      />
                      {errors.password && <p className="text-sm text-red-600">{errors.password}</p>}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password *</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        className={errors.confirmPassword ? 'border-red-500' : ''}
                        placeholder="••••••••"
                      />
                      {errors.confirmPassword && <p className="text-sm text-red-600">{errors.confirmPassword}</p>}
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  {/* Pet Photo Upload */}
                  <div className="space-y-2">
                    <Label>Pet Photo (Optional)</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      {petPhotoPreview ? (
                        <div className="relative">
                          <img 
                            src={petPhotoPreview} 
                            alt="Pet preview" 
                            className="max-w-full h-48 object-cover rounded-lg mx-auto"
                          />
                          <button
                            type="button"
                            onClick={removePhoto}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 mb-2">Upload a photo of your pet</p>
                          <p className="text-sm text-gray-500 mb-4">This will help us create a more personalized portrait</p>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                            id="petPhoto"
                          />
                          <Label htmlFor="petPhoto" className="cursor-pointer">
                            <Button type="button" variant="outline" asChild>
                              <span>Choose Photo</span>
                            </Button>
                          </Label>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pet Details */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="petName">Pet Name</Label>
                      <Input
                        id="petName"
                        value={formData.petName}
                        onChange={(e) => handleInputChange('petName', e.target.value)}
                        className={`${errors.petName ? 'border-red-500' : ''} ${
                          referralData?.pet_name ? 'bg-gray-50 text-gray-700' : ''
                        }`}
                        placeholder="Buddy"
                      />
                      {referralData?.pet_name && (
                        <p className="text-xs text-gray-500">Pet name provided by your referrer</p>
                      )}
                      {errors.petName && <p className="text-sm text-red-600">{errors.petName}</p>}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="breedId">Breed</Label>
                        <Select
                          value={formData.breedId}
                          onValueChange={(value) => handleInputChange('breedId', value)}
                        >
                          <SelectTrigger className={`${errors.breedId ? 'border-red-500' : ''} ${
                            referralData?.pet_breed_id ? 'bg-gray-50 text-gray-700' : ''
                          }`}>
                            <SelectValue placeholder="Select breed" />
                          </SelectTrigger>
                          <SelectContent>
                            {breeds.map((breed) => (
                              <SelectItem key={breed.id} value={breed.id}>
                                {breed.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {referralData?.pet_breed_id && (
                          <p className="text-xs text-gray-500">Breed provided by your referrer</p>
                        )}
                        {errors.breedId && <p className="text-sm text-red-600">{errors.breedId}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="coatId">Coat Color</Label>
                        <Select
                          value={formData.coatId}
                          onValueChange={(value) => handleInputChange('coatId', value)}
                        >
                          <SelectTrigger className={referralData?.pet_coat_id ? 'bg-gray-50 text-gray-700' : ''}>
                            <SelectValue placeholder="Select coat color" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredCoats.map((coat) => (
                              <SelectItem key={coat.id} value={coat.id}>
                                <div className="flex items-center space-x-2">
                                  {coat.hex_color && (
                                    <div 
                                      className="w-4 h-4 rounded-full border border-gray-300"
                                      style={{ backgroundColor: coat.hex_color }}
                                    />
                                  )}
                                  <span>{coat.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {referralData?.pet_coat_id && (
                          <p className="text-xs text-gray-500">Coat color provided by your referrer</p>
                        )}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="age">Age (years)</Label>
                        <Input
                          id="age"
                          type="number"
                          value={formData.age}
                          onChange={(e) => handleInputChange('age', e.target.value)}
                          placeholder="3"
                          min="0"
                          max="30"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="gender">Gender</Label>
                        <Select
                          value={formData.gender}
                          onValueChange={(value) => handleInputChange('gender', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="unknown">Unknown</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="weight">Weight (lbs)</Label>
                        <Input
                          id="weight"
                          type="number"
                          value={formData.weight}
                          onChange={(e) => handleInputChange('weight', e.target.value)}
                          placeholder="25"
                          min="0"
                          max="300"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="specialNotes">Special Notes</Label>
                      <Textarea
                        id="specialNotes"
                        value={formData.specialNotes}
                        onChange={(e) => handleInputChange('specialNotes', e.target.value)}
                        placeholder="Any special characteristics, markings, or details about your pet..."
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              )}

              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">{errors.submit}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between pt-6">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(prev => prev - 1)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                )}
                
                {currentStep < 2 ? (
                  <Button 
                    type="button" 
                    onClick={handleNext}
                    className="ml-auto bg-gradient-to-r from-purple-600 to-blue-600"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <div className="ml-auto flex gap-3">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={handleSubmit}
                      disabled={loading}
                    >
                      {loading ? 'Creating Account...' : 'Skip for now'}
                    </Button>
                    <Button 
                      type="button" 
                      onClick={handleSubmit}
                      disabled={loading}
                      className="bg-gradient-to-r from-purple-600 to-blue-600"
                    >
                      {loading ? 'Creating Account...' : 'Create Account & Add Pet'}
                    </Button>
                  </div>
                )}
              </div>

              <div className="text-center pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link href="/auth/login" className="text-purple-600 hover:text-purple-700 font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function UserQRSignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading signup form...</p>
        </div>
      </div>
    }>
      <UserQRSignupContent />
    </Suspense>
  );
}