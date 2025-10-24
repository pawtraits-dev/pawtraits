#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function showReviews() {
  const results = await supabase
    .from('reviews')
    .select('comment, customer_first_name, customer_city, customer_country, rating')
    .eq('is_early_adopter', true)
    .order('created_at', { ascending: false })
    .limit(15);

  if (results.data) {
    console.log('\n📝 SAMPLE OF MULTILINGUAL REVIEWS:\n');
    let counter = 1;
    for (const review of results.data) {
      console.log(counter + '. ' + review.customer_first_name + ' from ' + review.customer_city + ', ' + review.customer_country + ' (' + review.rating + '⭐)');
      console.log('   "' + review.comment + '"\n');
      counter++;
    }
  }
}

showReviews().then(() => process.exit(0)).catch(console.error);
