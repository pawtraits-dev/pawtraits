#!/usr/bin/env tsx
/**
 * Generate 100 Pre-Launch Reviews Script
 *
 * This script generates 100 positive reviews for the Pawtraits platform
 * to populate the reviews carousel at launch.
 *
 * Features:
 * - Creates fake customers with realistic names and locations
 * - Creates fake orders with delivered status
 * - Creates fake order items linked to real images
 * - Generates AI-powered review comments using Claude
 * - Marks reviews as "Early Adopter"
 * - 80% 5-star, 20% 4-star distribution
 *
 * Usage: tsx scripts/generate-launch-reviews.ts
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const claudeApiKey = process.env.CLAUDE_API_KEY!;

if (!supabaseUrl || !serviceRoleKey || !claudeApiKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const anthropic = new Anthropic({ apiKey: claudeApiKey });

// Sample data
const firstNames = [
  'Sarah', 'James', 'Emma', 'Michael', 'Olivia', 'William', 'Ava', 'David',
  'Sophia', 'John', 'Isabella', 'Robert', 'Mia', 'Daniel', 'Charlotte', 'Thomas',
  'Amelia', 'Christopher', 'Harper', 'Matthew', 'Evelyn', 'Andrew', 'Abigail', 'Joshua',
  'Emily', 'Anthony', 'Elizabeth', 'Ryan', 'Sofia', 'Nicholas', 'Avery', 'Alexander',
  'Ella', 'Jonathan', 'Madison', 'Benjamin', 'Scarlett', 'Charles', 'Victoria', 'Samuel',
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Hernandez', 'Moore',
  'Martin', 'Jackson', 'Thompson', 'White', 'Lopez', 'Lee', 'Gonzalez', 'Harris',
  'Clark', 'Lewis', 'Robinson', 'Walker', 'Perez', 'Hall', 'Young',
];

const locations = [
  // UK
  { city: 'London', country: 'United Kingdom', language: 'en' },
  { city: 'Manchester', country: 'United Kingdom', language: 'en' },
  { city: 'Birmingham', country: 'United Kingdom', language: 'en' },
  { city: 'Edinburgh', country: 'United Kingdom', language: 'en' },
  { city: 'Bristol', country: 'United Kingdom', language: 'en' },
  { city: 'Liverpool', country: 'United Kingdom', language: 'en' },

  // USA
  { city: 'New York', country: 'United States', language: 'en' },
  { city: 'Los Angeles', country: 'United States', language: 'en' },
  { city: 'Chicago', country: 'United States', language: 'en' },
  { city: 'San Francisco', country: 'United States', language: 'en' },
  { city: 'Boston', country: 'United States', language: 'en' },
  { city: 'Seattle', country: 'United States', language: 'en' },
  { city: 'Austin', country: 'United States', language: 'en' },
  { city: 'Miami', country: 'United States', language: 'en' },

  // France
  { city: 'Paris', country: 'France', language: 'fr' },
  { city: 'Lyon', country: 'France', language: 'fr' },
  { city: 'Marseille', country: 'France', language: 'fr' },
  { city: 'Bordeaux', country: 'France', language: 'fr' },

  // Spain
  { city: 'Madrid', country: 'Spain', language: 'es' },
  { city: 'Barcelona', country: 'Spain', language: 'es' },
  { city: 'Valencia', country: 'Spain', language: 'es' },
  { city: 'Seville', country: 'Spain', language: 'es' },

  // Italy
  { city: 'Rome', country: 'Italy', language: 'it' },
  { city: 'Milan', country: 'Italy', language: 'it' },
  { city: 'Florence', country: 'Italy', language: 'it' },
  { city: 'Venice', country: 'Italy', language: 'it' },

  // Germany
  { city: 'Berlin', country: 'Germany', language: 'de' },
  { city: 'Munich', country: 'Germany', language: 'de' },
  { city: 'Hamburg', country: 'Germany', language: 'de' },
  { city: 'Frankfurt', country: 'Germany', language: 'de' },
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function generateReviewComment(breedName: string, themeName: string, rating: number, language: string = 'en'): Promise<string> {
  const languageInstructions = {
    en: 'in English',
    fr: 'in French (natural, conversational French)',
    es: 'in Spanish (natural, conversational Spanish)',
    it: 'in Italian (natural, conversational Italian)',
    de: 'in German (natural, conversational German)'
  };

  const prompt = `Generate a short, authentic customer review (1-3 sentences, max 150 words) ${languageInstructions[language as keyof typeof languageInstructions]} for a pet portrait.

Details:
- Breed: ${breedName || 'dog'}
- Theme/Style: ${themeName || 'artistic portrait'}
- Rating: ${rating} stars

CRITICAL: Use VARIED structures. Avoid formulaic patterns. Mix these approaches:
- Start with emotional reaction ("Tears of joy!", "Absolutely speechless", "Best purchase ever")
- Focus on specific details ("The eyes are perfect", "Captured his cheeky personality", "Love the colors")
- Tell a micro-story ("Surprised my wife with this", "Hangs above our fireplace now")
- Use casual language ("Wow just wow", "Can't stop staring at it", "Everyone asks where I got it")
- Mention reactions from others ("Visitors always comment", "Friends thought it was painted by hand")
- Compare to expectations ("Better than I imagined", "Photos don't do it justice")
- Be personal and authentic, like texting a friend

AVOID:
- "The artist..." constructions (or equivalent in other languages)
- Formulaic "quality/service/product" reviews
- Corporate-sounding praise
- Repetitive sentence structures
- Overly formal language

Rating context:
- 5 stars: Thrilled, exceeded expectations, highly emotional
- 4 stars: Very happy, one tiny minor thing could be better (but still loved it)

${language !== 'en' ? 'Write naturally in the target language - use colloquialisms, natural word order, and authentic expressions that native speakers would use.' : ''}

Generate ONLY the review text, no quotes, attribution, or explanations.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text.trim();
    }

    // Fallback
    return `Amazing quality! The portrait of my ${breedName} is absolutely stunning. Couldn't be happier with the result!`;

  } catch (error) {
    console.error('Error generating review comment:', error);
    // Fallback reviews
    const fallbacks = [
      `Absolutely love the ${themeName} style! Perfect capture of my ${breedName}.`,
      `The quality exceeded my expectations. My ${breedName} looks majestic!`,
      `Beautiful artwork! The attention to detail is incredible.`,
      `Worth every penny. My ${breedName} portrait is now the centerpiece of our living room.`,
      `Stunning result! Friends and family are blown away by the quality.`,
    ];
    return randomElement(fallbacks);
  }
}

async function main() {
  console.log('🎨 GENERATING 100 LAUNCH REVIEWS\n');

  // Generate unique timestamp suffix for this batch
  const batchId = Date.now();
  console.log(`📦 Batch ID: ${batchId}\n`);

  // 1. Fetch random images
  console.log('📸 Fetching random images...');
  const { data: images, error: imagesError } = await supabase
    .from('image_catalog')
    .select('id, public_url, breeds!inner(name), themes(name)')
    .eq('is_public', true)
    .limit(100);

  if (imagesError || !images || images.length === 0) {
    console.error('❌ Failed to fetch images:', imagesError);
    process.exit(1);
  }

  console.log(`✅ Found ${images.length} images\n`);

  // 2. Fetch a product to use for all order items
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .limit(1);

  if (!products || products.length === 0) {
    console.error('❌ No products found');
    process.exit(1);
  }

  const product = products[0];
  console.log(`✅ Using product: ${product.name}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < 100; i++) {
    try {
      console.log(`\n📝 Generating review ${i + 1}/100...`);

      // Random data
      const firstName = randomElement(firstNames);
      const lastName = randomElement(lastNames);
      const location = randomElement(locations);
      const image = images[i % images.length];
      const breedName = (image.breeds as any)?.name || 'Dog';
      const themeName = (image.themes as any)?.name || 'Portrait';
      const rating = i < 80 ? 5 : 4; // 80% 5-star, 20% 4-star

      // Create fake customer with unique email
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          email: `early-adopter-${batchId}-${i + 1}@pawtraits.test`,
          first_name: firstName,
          last_name: lastName,
          is_registered: false,
        })
        .select()
        .single();

      if (customerError || !customer) {
        console.error(`   ❌ Failed to create customer:`, customerError);
        errorCount++;
        continue;
      }

      // Create fake order
      const orderNumber = `PA-LAUNCH-${batchId}-${String(i + 1).padStart(4, '0')}`;
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          status: 'delivered',
          customer_email: customer.email,
          shipping_first_name: firstName,
          shipping_last_name: lastName,
          shipping_address: '123 Sample Street',
          shipping_city: location.city,
          shipping_postcode: 'SW1A 1AA',
          shipping_country: location.country,
          subtotal_amount: 2500,
          shipping_amount: 500,
          total_amount: 3000,
          currency: 'GBP',
          payment_status: 'paid',
        })
        .select()
        .single();

      if (orderError || !order) {
        console.error(`   ❌ Failed to create order:`, orderError);
        errorCount++;
        continue;
      }

      // Create order item
      const { data: orderItem, error: orderItemError } = await supabase
        .from('order_items')
        .insert({
          order_id: order.id,
          product_id: product.sku,
          image_id: image.id,
          image_url: image.public_url,
          image_title: `${breedName} Portrait`,
          quantity: 1,
          unit_price: 2500,
          total_price: 2500,
        })
        .select()
        .single();

      if (orderItemError || !orderItem) {
        console.error(`   ❌ Failed to create order item:`, orderItemError);
        errorCount++;
        continue;
      }

      // Generate review comment
      console.log(`   🤖 Generating AI comment (${location.language})...`);
      const comment = await generateReviewComment(breedName, themeName, rating, location.language);

      // Create review
      const daysAgo = randomInt(1, 90);
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);

      const { error: reviewError } = await supabase
        .from('reviews')
        .insert({
          order_item_id: orderItem.id,
          order_id: order.id,
          customer_id: customer.id,
          rating,
          comment,
          customer_first_name: firstName,
          customer_city: location.city,
          customer_country: location.country,
          image_id: image.id,
          image_url: image.public_url,
          image_thumbnail_url: image.public_url,
          breed_name: breedName,
          status: 'approved',
          is_auto_approved: false,
          is_published: true,
          is_early_adopter: true,
          created_at: createdAt.toISOString(),
          published_at: createdAt.toISOString(),
        });

      if (reviewError) {
        console.error(`   ❌ Failed to create review:`, reviewError);
        errorCount++;
        continue;
      }

      successCount++;
      console.log(`   ✅ Review created: ${firstName} from ${location.city} (${rating}⭐)`);

    } catch (error) {
      console.error(`   ❌ Unexpected error:`, error);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 GENERATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`✅ Successfully generated: ${successCount} reviews`);
  console.log(`❌ Failed: ${errorCount} reviews`);
  console.log(`📈 Success rate: ${((successCount / 100) * 100).toFixed(1)}%`);
  console.log('\n🎉 Launch reviews are ready!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
