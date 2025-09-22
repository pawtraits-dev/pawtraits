#!/usr/bin/env tsx

/**
 * Debug Batch Jobs Script
 *
 * Analyzes current batch job status and identifies potential issues
 * with stalled or slow-running batch jobs.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables');
  console.log('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function analyzeBatchJobs() {
  console.log('🔍 ANALYZING BATCH JOBS\n');

  try {
    // Get all recent batch jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('batch_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (jobsError) {
      console.error('❌ Error fetching jobs:', jobsError);
      return;
    }

    if (!jobs || jobs.length === 0) {
      console.log('📝 No batch jobs found');
      return;
    }

    console.log(`📊 Found ${jobs.length} recent batch jobs:\n`);

    for (const job of jobs) {
      console.log(`🏷️  JOB: ${job.id.slice(0, 8)}...`);
      console.log(`   Status: ${job.status.toUpperCase()}`);
      console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
      console.log(`   Started: ${job.started_at ? new Date(job.started_at).toLocaleString() : 'Not started'}`);
      console.log(`   Progress: ${job.completed_items}/${job.total_items} items`);
      console.log(`   Success Rate: ${job.completed_items > 0 ? Math.round((job.successful_items/job.completed_items)*100) : 0}%`);

      if (job.status === 'running') {
        const runTime = job.started_at
          ? Date.now() - new Date(job.started_at).getTime()
          : Date.now() - new Date(job.created_at).getTime();

        console.log(`   ⏱️  Running for: ${Math.round(runTime/1000/60)}m ${Math.round((runTime/1000)%60)}s`);

        // Check if job appears stalled
        const lastActivity = job.completed_items > 0 ? 'Some progress made' : 'No progress yet';
        console.log(`   📈 Activity: ${lastActivity}`);

        // Get detailed item status
        const { data: items, error: itemsError } = await supabase
          .from('batch_job_items')
          .select('*')
          .eq('job_id', job.id)
          .order('item_index');

        if (!itemsError && items) {
          const pendingItems = items.filter(i => i.status === 'pending');
          const runningItems = items.filter(i => i.status === 'running');
          const completedItems = items.filter(i => i.status === 'completed');
          const failedItems = items.filter(i => i.status === 'failed');

          console.log(`   📋 Item Status:`);
          console.log(`      • Pending: ${pendingItems.length}`);
          console.log(`      • Running: ${runningItems.length}`);
          console.log(`      • Completed: ${completedItems.length}`);
          console.log(`      • Failed: ${failedItems.length}`);

          // Check for stuck running items
          if (runningItems.length > 0) {
            console.log(`   🔍 Running Items Details:`);
            for (const runningItem of runningItems) {
              const runningTime = runningItem.started_at
                ? Date.now() - new Date(runningItem.started_at).getTime()
                : 0;

              console.log(`      • Item ${runningItem.item_index + 1}: Running for ${Math.round(runningTime/1000/60)}m ${Math.round((runningTime/1000)%60)}s`);

              if (runningTime > 5 * 60 * 1000) { // More than 5 minutes
                console.log(`        ⚠️  WARNING: Item may be stalled (running > 5 minutes)`);
              }
            }
          }

          // Check for recent failures
          if (failedItems.length > 0) {
            console.log(`   ❌ Failed Items:`);
            failedItems.slice(0, 3).forEach((failedItem, idx) => {
              console.log(`      • Item ${failedItem.item_index + 1}: ${failedItem.error_message || 'Unknown error'}`);
            });
          }

          // Show next pending item
          if (pendingItems.length > 0) {
            const nextItem = pendingItems[0];
            console.log(`   ⏭️  Next item: ${nextItem.item_index + 1} (breed: ${nextItem.breed_id}, coat: ${nextItem.coat_id})`);
          }
        }
      } else if (job.status === 'completed') {
        const totalTime = job.completed_at && job.started_at
          ? new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()
          : 0;

        console.log(`   ✅ Completed in: ${Math.round(totalTime/1000/60)}m ${Math.round((totalTime/1000)%60)}s`);
      }

      console.log(''); // Empty line between jobs
    }

    // Analyze performance patterns
    const runningJobs = jobs.filter(j => j.status === 'running');
    const completedJobs = jobs.filter(j => j.status === 'completed');

    if (runningJobs.length > 1) {
      console.log('🚦 MULTIPLE RUNNING JOBS DETECTED');
      console.log('This might cause resource contention and slower processing.\n');
    }

    if (completedJobs.length > 0) {
      const avgCompletionTime = completedJobs.reduce((sum, job) => {
        if (job.started_at && job.completed_at) {
          return sum + (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime());
        }
        return sum;
      }, 0) / completedJobs.length;

      console.log(`📈 PERFORMANCE METRICS:`);
      console.log(`   Average completion time: ${Math.round(avgCompletionTime/1000/60)}m ${Math.round((avgCompletionTime/1000)%60)}s`);
      console.log(`   Completed jobs: ${completedJobs.length}`);
      console.log(`   Running jobs: ${runningJobs.length}`);
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');

    const stalledJobs = runningJobs.filter(job => {
      const runTime = job.started_at
        ? Date.now() - new Date(job.started_at).getTime()
        : Date.now() - new Date(job.created_at).getTime();

      return runTime > 10 * 60 * 1000 && job.completed_items === 0; // No progress after 10 minutes
    });

    if (stalledJobs.length > 0) {
      console.log('⚠️  Jobs appear to be stalled (no progress > 10min):');
      stalledJobs.forEach(job => {
        console.log(`   - ${job.id.slice(0, 8)}... (consider cancelling and restarting)`);
      });
    }

    if (runningJobs.length > 2) {
      console.log('🔄 Too many concurrent jobs - consider cancelling some to improve performance');
    }

    if (runningJobs.length === 0) {
      console.log('✅ No running jobs - system is idle');
    } else {
      console.log(`🏃 ${runningJobs.length} job(s) currently running`);
    }

  } catch (error) {
    console.error('💥 Error analyzing batch jobs:', error);
  }
}

// Run the analysis
if (require.main === module) {
  analyzeBatchJobs()
    .then(() => {
      console.log('\n🎉 Analysis complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Analysis failed:', error);
      process.exit(1);
    });
}

export { analyzeBatchJobs };