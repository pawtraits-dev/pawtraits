// Quick script to manually confirm a user email for development
// Usage: node scripts/confirm-user.js <email>

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function confirmUserByEmail(email) {
  try {
    console.log(`Looking for user with email: ${email}`);
    
    // First, find the user
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      throw listError;
    }
    
    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      console.error(`User with email ${email} not found`);
      return;
    }
    
    console.log(`Found user: ${user.id}, confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
    
    if (user.email_confirmed_at) {
      console.log('User email is already confirmed');
      return;
    }
    
    // Confirm the user
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );
    
    if (error) {
      throw error;
    }
    
    console.log('✅ User email confirmed successfully!');
    console.log('User can now log in with their credentials');
    
  } catch (error) {
    console.error('❌ Error confirming user:', error.message);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/confirm-user.js <email>');
  process.exit(1);
}

confirmUserByEmail(email);