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
        referral_date: referralCode ? new Date().toISOString() : null
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

    // 6. Update referral tracking if referral code provided
    if (referralCode) {
      try {
        console.log('Updating referral tracking for code:', referralCode)

        // Mark referral as accepted using the enhanced database function
        const { data: updatedReferral, error: acceptedError } = await supabaseService.getClient()
          .rpc('mark_referral_accepted_enhanced', {
            p_referral_code: referralCode,
            p_customer_email: email.toLowerCase().trim(),
            p_customer_name: `${firstName} ${lastName}`.trim(),
            p_customer_phone: phone || null
          })

        if (acceptedError) {
          console.error('Error marking referral as accepted:', acceptedError)
        } else {
          console.log('Referral marked as accepted:', updatedReferral)

          // Update customer record with partner reference if we got the referral data
          if (updatedReferral?.partner_id && customerId) {
            await supabaseService.getClient()
              .from('customers')
              .update({ referred_by_partner_id: updatedReferral.partner_id })
              .eq('id', customerId)
          }
        }

        // Track referral event
        if (updatedReferral?.id) {
          try {
            const trackResponse = await fetch(`${request.nextUrl.origin}/api/referrals/${updatedReferral.id}/track`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event_type: 'signup_complete',
                user_id: authData.user.id,
                event_data: {
                  customer_email: email.toLowerCase().trim(),
                  customer_name: `${firstName} ${lastName}`.trim(),
                  pet_name: petName || null
                }
              })
            })

            if (!trackResponse.ok) {
              console.warn('Referral tracking API call failed')
            }
          } catch (trackError) {
            console.warn('Referral event tracking failed:', trackError)
          }
        }
      } catch (referralError) {
        console.warn('Referral tracking failed:', referralError)
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