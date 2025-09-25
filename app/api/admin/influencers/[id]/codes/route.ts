import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { InfluencerReferralCodeCreate } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    console.log('Admin influencer codes API: Fetching codes for:', id);

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify influencer exists
    const { data: influencer, error: influencerError } = await supabase
      .from('influencers')
      .select('id, first_name, last_name')
      .eq('id', id)
      .single();

    if (influencerError || !influencer) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      );
    }

    // Get all referral codes for this influencer
    const { data: codes, error } = await supabase
      .from('influencer_referral_codes')
      .select('*')
      .eq('influencer_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching referral codes:', error);
      throw error;
    }

    // Calculate summary stats
    const totalCodes = codes?.length || 0;
    const activeCodes = codes?.filter(code => code.is_active) || [];
    const expiredCodes = codes?.filter(code =>
      code.expires_at && new Date(code.expires_at) < new Date()
    ) || [];

    const totalUsage = codes?.reduce((sum, code) => sum + (code.usage_count || 0), 0) || 0;
    const totalConversions = codes?.reduce((sum, code) => sum + (code.conversion_count || 0), 0) || 0;
    const totalRevenue = codes?.reduce((sum, code) => sum + (code.total_revenue || 0), 0) || 0;
    const totalCommission = codes?.reduce((sum, code) => sum + (code.total_commission || 0), 0) || 0;

    const conversionRate = totalUsage > 0 ? totalConversions / totalUsage : 0;
    const avgRevenuePerConversion = totalConversions > 0 ? totalRevenue / totalConversions : 0;

    const response = {
      influencer: {
        id: influencer.id,
        name: `${influencer.first_name} ${influencer.last_name}`
      },
      referral_codes: codes || [],
      summary: {
        total_codes: totalCodes,
        active_codes: activeCodes.length,
        expired_codes: expiredCodes.length,
        total_usage: totalUsage,
        total_conversions: totalConversions,
        total_revenue: totalRevenue,
        total_commission: totalCommission,
        conversion_rate: conversionRate,
        avg_revenue_per_conversion: avgRevenuePerConversion
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching referral codes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referral codes' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    console.log('Admin influencer codes API: Creating code for:', id);

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await request.json() as InfluencerReferralCodeCreate;

    // Verify influencer exists
    const { data: influencer, error: influencerError } = await supabase
      .from('influencers')
      .select('id')
      .eq('id', id)
      .single();

    if (influencerError || !influencer) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      );
    }

    // Validate required fields
    if (!body.code) {
      return NextResponse.json(
        { error: 'Missing required field: code' },
        { status: 400 }
      );
    }

    // Validate code format (minimum 6 characters, alphanumeric)
    if (body.code.length < 6 || !/^[A-Za-z0-9]+$/.test(body.code)) {
      return NextResponse.json(
        { error: 'Code must be at least 6 alphanumeric characters' },
        { status: 400 }
      );
    }

    // Check if code already exists (globally unique)
    const { data: existingCode } = await supabase
      .from('influencer_referral_codes')
      .select('id')
      .eq('code', body.code.toUpperCase())
      .single();

    if (existingCode) {
      return NextResponse.json(
        { error: 'This referral code already exists' },
        { status: 409 }
      );
    }

    // Prepare referral code data
    const codeData = {
      influencer_id: id,
      code: body.code.toUpperCase(),
      description: body.description?.trim() || null,
      expires_at: body.expires_at || null,
      is_active: body.is_active !== undefined ? body.is_active : true
    };

    // Create the referral code
    const { data: newCode, error: createError } = await supabase
      .from('influencer_referral_codes')
      .insert(codeData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating referral code:', createError);
      throw createError;
    }

    console.log('Successfully created referral code:', newCode.id);
    return NextResponse.json(newCode, { status: 201 });
  } catch (error) {
    console.error('Error creating referral code:', error);

    // Handle specific database errors
    if (error instanceof Error) {
      if (error.message.includes('duplicate key')) {
        return NextResponse.json(
          { error: 'This referral code already exists' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create referral code' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    const body = await request.json();
    const { code_id, ...updateData } = body;

    console.log('Admin influencer codes API: Updating referral code:', code_id);

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    if (!code_id) {
      return NextResponse.json(
        { error: 'Missing code_id' },
        { status: 400 }
      );
    }

    // Verify the code belongs to this influencer
    const { data: existingCode, error: fetchError } = await supabase
      .from('influencer_referral_codes')
      .select('*')
      .eq('id', code_id)
      .eq('influencer_id', id)
      .single();

    if (fetchError || !existingCode) {
      return NextResponse.json(
        { error: 'Referral code not found' },
        { status: 404 }
      );
    }

    // If updating the code value, check for uniqueness
    if (updateData.code && updateData.code !== existingCode.code) {
      if (updateData.code.length < 6 || !/^[A-Za-z0-9]+$/.test(updateData.code)) {
        return NextResponse.json(
          { error: 'Code must be at least 6 alphanumeric characters' },
          { status: 400 }
        );
      }

      const { data: codeExists } = await supabase
        .from('influencer_referral_codes')
        .select('id')
        .eq('code', updateData.code.toUpperCase())
        .neq('id', code_id)
        .single();

      if (codeExists) {
        return NextResponse.json(
          { error: 'This referral code already exists' },
          { status: 409 }
        );
      }
    }

    // Prepare update data
    const codeUpdateData: any = {};
    if (updateData.code !== undefined) codeUpdateData.code = updateData.code.toUpperCase();
    if (updateData.description !== undefined) codeUpdateData.description = updateData.description?.trim() || null;
    if (updateData.expires_at !== undefined) codeUpdateData.expires_at = updateData.expires_at;
    if (updateData.is_active !== undefined) codeUpdateData.is_active = updateData.is_active;

    // Add updated timestamp
    codeUpdateData.updated_at = new Date().toISOString();

    // Update the referral code
    const { data: updatedCode, error: updateError } = await supabase
      .from('influencer_referral_codes')
      .update(codeUpdateData)
      .eq('id', code_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating referral code:', updateError);
      throw updateError;
    }

    console.log('Successfully updated referral code:', code_id);
    return NextResponse.json(updatedCode);
  } catch (error) {
    console.error('Error updating referral code:', error);
    return NextResponse.json(
      { error: 'Failed to update referral code' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('code_id');

    console.log('Admin influencer codes API: Deleting referral code:', codeId);

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    if (!codeId) {
      return NextResponse.json(
        { error: 'Missing code_id parameter' },
        { status: 400 }
      );
    }

    // Verify the code belongs to this influencer
    const { data: existingCode, error: fetchError } = await supabase
      .from('influencer_referral_codes')
      .select('*')
      .eq('id', codeId)
      .eq('influencer_id', id)
      .single();

    if (fetchError || !existingCode) {
      return NextResponse.json(
        { error: 'Referral code not found' },
        { status: 404 }
      );
    }

    // Check if code has been used (has referrals)
    const { data: referrals } = await supabase
      .from('influencer_referrals')
      .select('id')
      .eq('referral_code_id', codeId)
      .limit(1);

    if (referrals && referrals.length > 0) {
      // Don't delete codes with referrals, just deactivate
      const { data: deactivatedCode, error: deactivateError } = await supabase
        .from('influencer_referral_codes')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', codeId)
        .select()
        .single();

      if (deactivateError) {
        console.error('Error deactivating referral code:', deactivateError);
        throw deactivateError;
      }

      console.log('Successfully deactivated referral code:', codeId);
      return NextResponse.json({
        message: 'Referral code deactivated (has existing referrals)',
        code: deactivatedCode
      });
    }

    // Delete the referral code (if no referrals exist)
    const { error: deleteError } = await supabase
      .from('influencer_referral_codes')
      .delete()
      .eq('id', codeId);

    if (deleteError) {
      console.error('Error deleting referral code:', deleteError);
      throw deleteError;
    }

    console.log('Successfully deleted referral code:', codeId);
    return NextResponse.json({ message: 'Referral code deleted successfully' });
  } catch (error) {
    console.error('Error deleting referral code:', error);
    return NextResponse.json(
      { error: 'Failed to delete referral code' },
      { status: 500 }
    );
  }
}