import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function addRatingColumn() {
  console.log('📊 Adding rating column to customer_custom_images table...');

  try {
    // Execute SQL to add rating column
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE customer_custom_images
        ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5);

        COMMENT ON COLUMN customer_custom_images.rating IS 'Customer rating (1-5 stars) to gauge AI model performance';

        CREATE INDEX IF NOT EXISTS idx_customer_custom_images_rating
        ON customer_custom_images(rating)
        WHERE rating IS NOT NULL;
      `
    });

    if (error) {
      console.error('❌ Error adding rating column:', error);
      console.log('\nℹ️  You may need to run this SQL directly in Supabase:');
      console.log(`
ALTER TABLE customer_custom_images
ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5);

COMMENT ON COLUMN customer_custom_images.rating IS 'Customer rating (1-5 stars) to gauge AI model performance';

CREATE INDEX IF NOT EXISTS idx_customer_custom_images_rating
ON customer_custom_images(rating)
WHERE rating IS NOT NULL;
      `);
      process.exit(1);
    }

    console.log('✅ Rating column added successfully!');
    console.log('✅ Index created for analytics queries');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

addRatingColumn();
