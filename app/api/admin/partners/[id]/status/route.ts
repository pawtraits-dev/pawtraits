import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let updateData: any = {};
  
  try {
    // TODO: Add admin authentication check
    const { id } = await params;
    const body = await request.json();
    const { approval_status, rejection_reason } = body;
    
    console.log('Partner status update API: Updating partner', id, 'to status:', approval_status);
    
    updateData = {
      approval_status,
      updated_at: new Date().toISOString()
    };

    // Add status-specific fields
    if (approval_status === 'approved') {
      updateData.approved_at = new Date().toISOString();
      // updateData.approved_by = adminId; // TODO: Get from auth
      // Clear rejection reason if it was previously rejected
      updateData.rejection_reason = null;
    } else if (approval_status === 'rejected' && rejection_reason) {
      updateData.rejection_reason = rejection_reason;
      updateData.approved_at = null; // Clear approval date if it was previously approved
    } else if (approval_status === 'suspended') {
      // Keep existing approval/rejection data but add suspension info
      updateData.suspended_at = new Date().toISOString();
      // updateData.suspended_by = adminId; // TODO: Get from auth
    } else if (approval_status === 'pending') {
      // Reset all status-specific fields for pending
      updateData.approved_at = null;
      updateData.rejection_reason = null;
      updateData.suspended_at = null;
    }

    console.log('Update data:', updateData);
    
    // Direct table update instead of RPC function
    const { data, error } = await supabase
      .from('partners')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    console.log('Update result - data:', data);
    console.log('Update result - error:', error);

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    console.log('Partner status successfully updated to:', data.approval_status);

    // TODO: Log admin action
    // await logAdminAction(adminId, `${approval_status}_partner`, 'partner', id);

    // TODO: Send notification email to partner

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating partner status:', error);
    console.error('Update data was:', JSON.stringify(updateData, null, 2));
    
    // Return more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to update partner status', 
        details: errorMessage
      },
      { status: 500 }
    );
  }
}