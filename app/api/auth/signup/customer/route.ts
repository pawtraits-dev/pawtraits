import { NextRequest, NextResponse } from 'next/server'
import { SupabaseService } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const signupData = await request.json()

    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      petName,
      breedId,
      coatId,
      age,
      gender,
      weight,
      personalityTraits,
      specialNotes,
      petPhotoUrl,
      referralCode
    } = signupData

    // Input validation
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, password, first name, and last name are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    const supabaseService = new SupabaseService()

    // 1. Create user account with Supabase Auth
    const { data: authData, error: authError } = await supabaseService.getClient().auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim()
        }
      }
    })

    if (authError) {
      console.error('Auth signup error:', authError)
      return NextResponse.json(
        { error: authError.message || 'Failed to create account' },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      )
    }

    // 2. Auto-confirm user email (for development)
    try {
      const confirmResponse = await fetch(`${request.nextUrl.origin}/api/auth/confirm-user-by-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      })

      if (confirmResponse.ok) {
        console.log('User email confirmed')
      }
    } catch (confirmError) {
      console.warn('Email confirmation failed:', confirmError)
    }

    // 3. Create customer record
    let customerId = null
    try {
      const customerData = {
        email: email.toLowerCase().trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        user_id: authData.user.id,
        is_registered: true,
        referred_by_partner_id: null, // Will be set by referral tracking below
        referral_code: referralCode || null,
        referral_date: referralCode ? new Date().toISOString() : null,
        // Simplified referral tracking fields
        referral_type: 'ORGANIC', // Default to ORGANIC, will be updated if referral is valid
        referrer_id: null,
        referral_code_used: referralCode ? referralCode.toUpperCase() : null,
        referral_applied_at: referralCode ? new Date().toISOString() : null
      }

      const { data: customer, error: customerError } = await supabaseService.getClient()
        .from('customers')
        .insert(customerData)
        .select()
        .single()

      if (customerError) {
        console.error('Customer creation error:', customerError)
        // Continue anyway - user account was created successfully
      } else if (customer) {
        customerId = customer.id
      }
    } catch (customerError) {
      console.warn('Customer record creation failed:', customerError)
    }

    // 4. Create user profile with customer type using database function
    try {
      console.log('Creating user profile for customer using RPC function...')

      const { data: profileData, error: profileError } = await supabaseService.getClient()
        .rpc('create_user_profile', {
          p_user_id: authData.user.id,
          p_user_type: 'customer',
          p_first_name: firstName.trim(),
          p_last_name: lastName.trim(),
          p_email: email.toLowerCase().trim(),
          p_phone: phone || null,
          p_partner_id: null,
          p_customer_id: customerId
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        throw profileError
      } else {
        console.log('User profile created successfully')
      }
    } catch (profileError) {
      console.error('User profile creation failed:', profileError)
      // Don't throw - let the signup continue even if profile creation fails
    }

    // 5. Create pet record (only if user provided pet details)
    if (petName?.trim()) {
      try {
        const { error: petError } = await supabaseService.getClient()
          .rpc('create_user_pet', {
            p_user_id: authData.user.id,
            p_name: petName.trim(),
            p_breed_id: breedId || null,
            p_coat_id: coatId || null,
            p_age: age ? parseInt(age) : null,
            p_gender: gender || 'unknown',
            p_weight: weight ? parseFloat(weight) : null,
            p_primary_photo_url: petPhotoUrl || null,
            p_personality_traits: personalityTraits || [],
            p_special_notes: specialNotes || null
          })

        if (petError) {
          console.error('Pet creation error:', petError)
          // Continue anyway - user account was created successfully
        } else {
          console.log('Pet record created successfully')
        }
      } catch (petError) {
        console.warn('Pet creation failed:', petError)
      }
    } else {
      console.log('No pet name provided, skipping pet creation')
    }

    // 6. Handle referral tracking using simplified unified system
    if (referralCode && customerId) {
      try {
        console.log('🔍 Processing referral using unified system for code:', referralCode)

        // Verify referral code using unified API
        const verifyResponse = await fetch(`${request.nextUrl.origin}/api/referrals/verify/${referralCode}`)

        if (verifyResponse.ok) {
          const referralData = await verifyResponse.json()
          console.log('✅ Referral verification successful:', referralData.referral_type, referralData.referrer?.name)

          // Record referral usage using unified API
          const recordResponse = await fetch(`${request.nextUrl.origin}/api/referrals/verify/${referralCode}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer_id: customerId,
              customer_email: email.toLowerCase().trim()
            })
          })

          if (recordResponse.ok) {
            console.log('✅ Simplified referral tracking completed successfully')

            // Also update legacy fields for backward compatibility
            if (referralData.referral_type === 'PARTNER' && referralData.referrer?.id) {
              await supabaseService.getClient()
                .from('customers')
                .update({
                  referred_by_partner_id: referralData.referrer.id,
                  referral_code: referralCode.toUpperCase(),
                  referral_date: new Date().toISOString()
                })
                .eq('id', customerId)
            }
          } else {
            console.error('❌ Failed to record referral usage via unified API')
          }
        } else {
          console.log('⚠️  Referral code not found in unified system, trying legacy fallback')

          // Legacy fallback for old referral codes not yet migrated
          const { data: updatedReferral, error: acceptedError } = await supabaseService.getClient()
            .rpc('mark_referral_accepted_enhanced', {
              p_referral_code: referralCode,
              p_customer_email: email.toLowerCase().trim(),
              p_customer_name: `${firstName} ${lastName}`.trim(),
              p_customer_phone: phone || null
            })

          if (!acceptedError && updatedReferral?.partner_id) {
            console.log('✅ Legacy partner referral processed')
            await supabaseService.getClient()
              .from('customers')
              .update({
                referred_by_partner_id: updatedReferral.partner_id,
                referral_code: referralCode.toUpperCase(),
                referral_date: new Date().toISOString(),
                // Also set simplified fields for legacy referrals
                referral_type: 'PARTNER',
                referrer_id: updatedReferral.partner_id,
                referral_code_used: referralCode.toUpperCase(),
                referral_applied_at: new Date().toISOString()
              })
              .eq('id', customerId)
          }
        }
      } catch (referralError) {
        console.warn('⚠️  Referral processing failed:', referralError)
      }
    }

    return NextResponse.json({
      message: 'Account created successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        customerId
      }
    })

  } catch (error) {
    console.error('Customer signup API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}