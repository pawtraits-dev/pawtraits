/**
 * Test script to trigger Supabase Auth emails
 * Run with: tsx scripts/test-auth-email.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function testAuthEmails() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('\n🧪 Supabase Auth Email Test\n');
  console.log('Choose a test option:');
  console.log('1. Send password reset email');
  console.log('2. Send signup confirmation email');
  console.log('3. Send magic link email\n');

  const choice = await question('Enter option (1-3): ');
  const email = await question('Enter test email address: ');

  console.log('\n⏳ Sending email...\n');

  try {
    switch (choice.trim()) {
      case '1':
        // Password reset email
        const { data: resetData, error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/reset-password`
        });

        if (resetError) {
          console.error('❌ Error:', resetError.message);
        } else {
          console.log('✅ Password reset email sent to:', email);
          console.log('📧 Check your inbox for the reset link');
        }
        break;

      case '2':
        // Signup confirmation email
        const testPassword = 'TestPassword123!';
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email: email,
          password: testPassword,
          options: {
            data: {
              test_account: true
            }
          }
        });

        if (signupError) {
          console.error('❌ Error:', signupError.message);
        } else {
          console.log('✅ Signup confirmation email sent to:', email);
          console.log('📧 Check your inbox for the confirmation link');
          console.log('🔑 Test password:', testPassword);
          console.log('\n⚠️  Remember to delete this test user from Supabase Dashboard → Authentication → Users');
        }
        break;

      case '3':
        // Magic link email
        const { data: magicData, error: magicError } = await supabase.auth.signInWithOtp({
          email: email,
          options: {
            emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback`
          }
        });

        if (magicError) {
          console.error('❌ Error:', magicError.message);
        } else {
          console.log('✅ Magic link email sent to:', email);
          console.log('📧 Check your inbox for the magic link');
        }
        break;

      default:
        console.log('❌ Invalid option');
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }

  rl.close();
}

testAuthEmails();
