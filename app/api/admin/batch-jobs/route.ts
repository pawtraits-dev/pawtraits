import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Use service role for admin operations
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await request.json();
    const { originalImageId, originalPrompt, currentBreed, currentCoat, currentTheme, currentStyle, currentFormat, targetAge, variationConfig } = body;
    
    console.log('🚀 CREATING BATCH JOB');
    console.log('📊 Config:', JSON.stringify(variationConfig, null, 2));

    if (!originalImageId || !variationConfig) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    // Calculate total items
    const totalItems = (variationConfig.breedCoats?.length || 0) + 
                      (variationConfig.breeds?.length || 0) + 
                      (variationConfig.coats?.length || 0) + 
                      (variationConfig.outfits?.length || 0) + 
                      (variationConfig.formats?.length || 0);

    if (totalItems === 0) {
      return NextResponse.json({ error: 'No variations specified' }, { status: 400 });
    }

    // Create batch job
    const { data: job, error: jobError } = await supabase
      .from('batch_jobs')
      .insert({
        job_type: 'image_generation',
        original_image_id: originalImageId,
        config: {
          originalPrompt,
          currentBreed,
          currentCoat,
          currentTheme,
          currentStyle,
          currentFormat,
          variationConfig
        },
        target_age: targetAge,
        total_items: totalItems,
        status: 'pending'
      })
      .select()
      .single();

    if (jobError) {
      console.error('Failed to create batch job:', jobError);
      return NextResponse.json({ error: 'Failed to create batch job' }, { status: 500 });
    }

    // Create individual job items
    const jobItems = [];
    let itemIndex = 0;

    // Add breed-coat combinations
    if (variationConfig.breedCoats?.length > 0) {
      for (const breedCoat of variationConfig.breedCoats) {
        jobItems.push({
          job_id: job.id,
          item_index: itemIndex++,
          breed_id: breedCoat.breedId,
          coat_id: breedCoat.coatId,
          status: 'pending'
        });
      }
    }

    // Add outfit variations
    if (variationConfig.outfits?.length > 0) {
      for (const outfitId of variationConfig.outfits) {
        jobItems.push({
          job_id: job.id,
          item_index: itemIndex++,
          outfit_id: outfitId,
          status: 'pending'
        });
      }
    }

    // Add format variations
    if (variationConfig.formats?.length > 0) {
      for (const formatId of variationConfig.formats) {
        jobItems.push({
          job_id: job.id,
          item_index: itemIndex++,
          format_id: formatId,
          status: 'pending'
        });
      }
    }

    if (jobItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('batch_job_items')
        .insert(jobItems);

      if (itemsError) {
        console.error('Failed to create job items:', itemsError);
        // Cleanup job if items creation failed
        await supabase.from('batch_jobs').delete().eq('id', job.id);
        return NextResponse.json({ error: 'Failed to create job items' }, { status: 500 });
      }
    }

    console.log(`✅ Created batch job ${job.id} with ${jobItems.length} items`);

    // Start processing asynchronously (don't await)
    processBatchJob(job.id).catch(error => {
      console.error(`Failed to process batch job ${job.id}:`, error);
    });

    return NextResponse.json({
      jobId: job.id,
      status: 'pending',
      totalItems,
      message: 'Batch job created and processing started'
    });

  } catch (error) {
    console.error('Batch job creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create batch job' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    if (jobId) {
      // Get specific job with items
      const { data: job, error: jobError } = await supabase
        .from('batch_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      const { data: items, error: itemsError } = await supabase
        .from('batch_job_items')
        .select('*')
        .eq('job_id', jobId)
        .order('item_index');

      return NextResponse.json({
        job,
        items: items || [],
        progress: {
          total: job.total_items,
          completed: job.completed_items,
          successful: job.successful_items,
          failed: job.failed_items,
          percentage: job.total_items > 0 ? Math.round((job.completed_items / job.total_items) * 100) : 0
        }
      });
    } else {
      // Get all recent jobs
      const { data: jobs, error } = await supabase
        .from('batch_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
      }

      return NextResponse.json(jobs);
    }

  } catch (error) {
    console.error('Error fetching batch jobs:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check if job exists and can be cancelled
    const { data: job, error: jobError } = await supabase
      .from('batch_jobs')
      .select('status')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status === 'completed') {
      return NextResponse.json({ error: 'Cannot cancel completed job' }, { status: 400 });
    }

    if (job.status === 'cancelled') {
      return NextResponse.json({ error: 'Job already cancelled' }, { status: 400 });
    }

    // Cancel the job
    const { error: cancelError } = await supabase
      .from('batch_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (cancelError) {
      console.error('Failed to cancel job:', cancelError);
      return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 });
    }

    // Also cancel any pending items
    await supabase
      .from('batch_job_items')
      .update({
        status: 'skipped',
        completed_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
      .eq('status', 'pending');

    console.log(`🚫 Cancelled batch job: ${jobId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Job cancelled successfully' 
    });

  } catch (error) {
    console.error('Error cancelling batch job:', error);
    return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 });
  }
}

// Background processing function (runs async)
async function processBatchJob(jobId: string) {
  const { BatchProcessingService } = await import('@/lib/batch-processing-service');
  const batchService = new BatchProcessingService();
  
  try {
    await batchService.processBatchJob(jobId);
  } catch (error) {
    console.error(`Failed to process batch job ${jobId}:`, error);
  }
}