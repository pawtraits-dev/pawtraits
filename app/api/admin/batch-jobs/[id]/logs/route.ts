import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔍 Fetching logs for job ID:', params.id);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const jobId = params.id;

    // Get job with items and their detailed status
    const { data: job, error: jobError } = await supabase
      .from('batch_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get all job items (simplified query to avoid JOIN issues)
    const { data: items, error: itemsError } = await supabase
      .from('batch_job_items')
      .select('*')
      .eq('job_id', jobId)
      .order('item_index');

    if (itemsError) {
      console.error('Error fetching job items:', itemsError);
      return NextResponse.json({ error: `Failed to fetch job items: ${itemsError.message}` }, { status: 500 });
    }

    // Get additional metadata for items (with error handling)
    const enrichedItems = [];
    for (const item of (items || [])) {
      const enrichedItem = { ...item };

      // Try to get breed name
      if (item.breed_id) {
        try {
          const { data: breed } = await supabase
            .from('breeds')
            .select('id, name, slug')
            .eq('id', item.breed_id)
            .single();
          enrichedItem.breed = breed;
        } catch (error) {
          console.warn(`Could not fetch breed ${item.breed_id}:`, error);
        }
      }

      // Try to get coat name
      if (item.coat_id) {
        try {
          const { data: coat } = await supabase
            .from('coats')
            .select('id, name, slug, hex_color')
            .eq('id', item.coat_id)
            .single();
          enrichedItem.coat = coat;
        } catch (error) {
          console.warn(`Could not fetch coat ${item.coat_id}:`, error);
        }
      }

      // Try to get outfit name
      if (item.outfit_id) {
        try {
          const { data: outfit } = await supabase
            .from('outfits')
            .select('id, name, slug')
            .eq('id', item.outfit_id)
            .single();
          enrichedItem.outfit = outfit;
        } catch (error) {
          console.warn(`Could not fetch outfit ${item.outfit_id}:`, error);
        }
      }

      // Try to get format name
      if (item.format_id) {
        try {
          const { data: format } = await supabase
            .from('formats')
            .select('id, name, slug')
            .eq('id', item.format_id)
            .single();
          enrichedItem.format = format;
        } catch (error) {
          console.warn(`Could not fetch format ${item.format_id}:`, error);
        }
      }

      enrichedItems.push(enrichedItem);
    }

    // Process items into log entries
    const logEntries = [];

    // Add job creation log
    logEntries.push({
      timestamp: job.created_at,
      level: 'info',
      type: 'job_created',
      message: `Batch job created with ${job.total_items} items`,
      details: {
        jobId: job.id,
        jobType: job.job_type,
        totalItems: job.total_items,
        config: job.config
      }
    });

    // Add job start log
    if (job.started_at) {
      logEntries.push({
        timestamp: job.started_at,
        level: 'info',
        type: 'job_started',
        message: 'Batch processing started',
        details: {
          adaptiveSpeedController: 'enabled',
          baseDelayMs: 1500,
          targetSuccessRate: '85%'
        }
      });
    }

    // Add item logs
    enrichedItems.forEach((item, index) => {
      const itemName = getItemDisplayName(item);

      // Item started
      if (item.started_at) {
        logEntries.push({
          timestamp: item.started_at,
          level: 'info',
          type: 'item_started',
          message: `Processing item ${index + 1}/${job.total_items}: ${itemName}`,
          details: {
            itemIndex: item.item_index,
            itemId: item.id,
            itemType: getItemType(item),
            breed: item.breed?.name,
            coat: item.coat?.name,
            outfit: item.outfit?.name,
            format: item.format?.name
          }
        });
      }

      // Item completed/failed
      if (item.completed_at) {
        if (item.status === 'completed') {
          logEntries.push({
            timestamp: item.completed_at,
            level: 'success',
            type: 'item_completed',
            message: `✅ Successfully generated ${itemName}`,
            details: {
              itemIndex: item.item_index,
              generatedImageId: item.generated_image_id,
              geminiDuration: `${item.gemini_duration_ms || 0}ms`,
              totalDuration: `${item.total_duration_ms || 0}ms`,
              retryCount: item.retry_count || 0
            }
          });
        } else if (item.status === 'failed') {
          logEntries.push({
            timestamp: item.completed_at,
            level: 'error',
            type: 'item_failed',
            message: `❌ Failed to generate ${itemName}`,
            details: {
              itemIndex: item.item_index,
              error: item.error_message,
              retryCount: item.retry_count || 0,
              totalDuration: `${item.total_duration_ms || 0}ms`
            }
          });
        }
      }
    });

    // Add adaptive speed controller logs (simulated based on success rate)
    if (job.status === 'running' || job.status === 'completed') {
      const successRate = job.completed_items > 0 ? (job.successful_items / job.completed_items) : 0;
      const speedRecommendation = getSpeedRecommendation(successRate, job.failed_items);

      logEntries.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        type: 'speed_adjustment',
        message: `⚡ Speed Controller: ${speedRecommendation.reasoning}`,
        details: {
          successRate: `${Math.round(successRate * 100)}%`,
          delayMs: `${speedRecommendation.delayMs}ms`,
          adjustmentType: speedRecommendation.adjustmentType,
          confidence: `${Math.round(speedRecommendation.confidence * 100)}%`
        }
      });
    }

    // Job completion log
    if (job.completed_at) {
      const duration = new Date(job.completed_at).getTime() - new Date(job.started_at || job.created_at).getTime();
      const finalSuccessRate = job.completed_items > 0 ? Math.round((job.successful_items / job.completed_items) * 100) : 0;

      logEntries.push({
        timestamp: job.completed_at,
        level: job.status === 'completed' ? 'success' : 'error',
        type: 'job_completed',
        message: `🏁 Batch job ${job.status}: ${job.successful_items}/${job.total_items} items successful (${finalSuccessRate}% success rate)`,
        details: {
          status: job.status,
          totalDuration: `${Math.round(duration / 1000)}s`,
          successfulItems: job.successful_items,
          failedItems: job.failed_items,
          successRate: `${finalSuccessRate}%`,
          averageItemDuration: enrichedItems.length > 0 ? `${Math.round(duration / enrichedItems.length / 1000)}s` : 'N/A'
        }
      });
    }

    // Sort logs by timestamp
    logEntries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return NextResponse.json({
      job,
      items: enrichedItems,
      logs: logEntries,
      summary: {
        totalLogs: logEntries.length,
        logTypes: [...new Set(logEntries.map(log => log.type))],
        levels: [...new Set(logEntries.map(log => log.level))],
        lastUpdate: logEntries[logEntries.length - 1]?.timestamp || job.created_at
      }
    });

  } catch (error) {
    console.error('Error fetching batch job logs for job', jobId, ':', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      error: 'Failed to fetch logs',
      details: errorMessage,
      jobId
    }, { status: 500 });
  }
}

function getItemDisplayName(item: any): string {
  if (item.breed && item.coat) {
    return `${item.breed.name} with ${item.coat.name} coat`;
  }
  if (item.outfit) {
    return `${item.outfit.name} outfit`;
  }
  if (item.format) {
    return `${item.format.name} format`;
  }
  return `Item ${item.item_index + 1}`;
}

function getItemType(item: any): string {
  if (item.breed_id && item.coat_id) return 'breed_coat';
  if (item.outfit_id) return 'outfit';
  if (item.format_id) return 'format';
  return 'unknown';
}

function getSpeedRecommendation(successRate: number, failedItems: number) {
  if (failedItems >= 3) {
    return {
      delayMs: 6000,
      adjustmentType: 'emergency_brake',
      reasoning: `Emergency brake: ${failedItems} failures detected`,
      confidence: 0.95
    };
  }

  if (successRate > 0.85) {
    return {
      delayMs: Math.max(1500 / 1.3, 500),
      adjustmentType: 'speed_up',
      reasoning: `High success rate: ${Math.round(successRate * 100)}% - speeding up`,
      confidence: 0.7
    };
  }

  if (successRate < 0.15) {
    return {
      delayMs: Math.min(1500 * 1.3, 8000),
      adjustmentType: 'slow_down',
      reasoning: `High error rate: ${Math.round((1 - successRate) * 100)}% - slowing down`,
      confidence: 0.8
    };
  }

  return {
    delayMs: 1500,
    adjustmentType: 'maintain',
    reasoning: `Stable performance: ${Math.round(successRate * 100)}% success rate - maintaining speed`,
    confidence: 0.5
  };
}