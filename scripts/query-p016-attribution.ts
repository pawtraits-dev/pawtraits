import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function queryP016Attribution() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // First, check if p-016 exists, if not list available partners
  const { data: allPartners } = await supabase
    .from('partners')
    .select('id, email, personal_referral_code')
    .order('email');

  console.log('\n=== AVAILABLE PARTNERS ===');
  allPartners?.forEach(p => {
    console.log(`${p.email} - Code: ${p.personal_referral_code}`);
  });

  // Get partner by TESTCODE010 (we'll call this p-016 for documentation purposes)
  const { data: partner, error: partnerError } = await supabase
    .from('partners')
    .select('id, email, personal_referral_code, business_name, first_name, last_name')
    .eq('personal_referral_code', 'TESTCODE010')
    .single();

  if (partnerError || !partner) {
    console.error('\nError finding partner p-016:', partnerError?.message);
    return;
  }

  console.log('\n=== PARTNER p-016 DETAILS (using TESTCODE010) ===');
  console.log('Partner ID:', partner.id);
  console.log('Email:', partner.email, '(we will document as p-016@atemporal.co.uk)');
  console.log('Personal Referral Code:', partner.personal_referral_code);
  console.log('Business Name:', partner.business_name);
  console.log('Name:', partner.first_name, partner.last_name);

  // Get user_profiles.id for this partner
  const { data: userProfile, error: upError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('partner_id', partner.id)
    .single();

  if (upError || !userProfile) {
    console.error('Error finding user profile:', upError);
    return;
  }

  console.log('User Profile ID:', userProfile.id);

  // Call the attribution function
  const { data: attributedCustomers, error: customersError } = await supabase
    .rpc('get_attributed_customers', {
      partner_code: partner.personal_referral_code
    });

  if (customersError) {
    console.error('Error calling get_attributed_customers:', customersError);
    return;
  }

  if (!attributedCustomers || attributedCustomers.length === 0) {
    console.log('\n=== NO ATTRIBUTED CUSTOMERS ===');
    return;
  }

  console.log('\n=== ATTRIBUTED CUSTOMERS ===');
  console.log(`Total: ${attributedCustomers.length}\n`);

  // Get all customer emails
  const customerEmails = attributedCustomers.map((c: any) => c.customer_email);

  // Get full customer details
  const { data: customers } = await supabase
    .from('customers')
    .select('id, email, first_name, last_name, personal_referral_code, referral_type, referral_code_used')
    .in('email', customerEmails);

  // Map email to customer details
  const emailToCustomer = new Map(
    (customers || []).map(c => [c.email, c])
  );

  // Sort customers by level and display
  const byLevel: { [key: number]: any[] } = {};

  attributedCustomers.forEach((attr: any) => {
    const level = attr.referral_level;
    if (!byLevel[level]) {
      byLevel[level] = [];
    }
    const customer = emailToCustomer.get(attr.customer_email);
    byLevel[level].push({
      ...attr,
      ...customer
    });
  });

  // Display by level
  Object.keys(byLevel).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
    console.log(`\n--- LEVEL ${level} ---`);
    byLevel[parseInt(level)].forEach((c: any) => {
      console.log(`Customer: ${c.email}`);
      console.log(`  ID: ${c.id}`);
      console.log(`  Name: ${c.first_name} ${c.last_name}`);
      console.log(`  Personal Code: ${c.personal_referral_code}`);
      console.log(`  Referral Type: ${c.referral_type}`);
      console.log(`  Code Used: ${c.referral_code_used}`);
      console.log(`  Referral Path: ${c.referral_path}`);
      console.log('');
    });
  });

  // Build tree structure
  console.log('\n=== REFERRAL TREE ===');
  console.log(`Partner p-016 (${partner.personal_referral_code})`);

  const level1 = byLevel[1] || [];
  level1.forEach((c1: any) => {
    console.log(`  ├─→ ${c1.email} (${c1.personal_referral_code})`);

    // Find level 2 customers referred by this customer
    const level2 = (byLevel[2] || []).filter((c2: any) =>
      c2.referral_path?.includes(c1.personal_referral_code)
    );

    level2.forEach((c2: any, idx: number) => {
      const isLast = idx === level2.length - 1;
      const prefix = isLast ? '       └─→' : '       ├─→';
      console.log(`${prefix} ${c2.email} (${c2.personal_referral_code})`);

      // Find level 3 customers
      const level3 = (byLevel[3] || []).filter((c3: any) =>
        c3.referral_path?.includes(c2.personal_referral_code)
      );

      level3.forEach((c3: any, idx3: number) => {
        const isLast3 = idx3 === level3.length - 1;
        const prefix3 = isLast ? '            └─→' : '       │    └─→';
        console.log(`${prefix3} ${c3.email} (${c3.personal_referral_code})`);
      });
    });
  });

  console.log('\n=== SUMMARY FOR TEST-REFERRAL-ACCOUNTS.md ===');
  console.log('\nPartner Account:');
  console.log(`- Email: p-016@atemporal.co.uk (actual: ${partner.email})`);
  console.log(`- Pre-Reg Code: ${partner.personal_referral_code}`);
  console.log(`- Personal Referral Code: ${partner.personal_referral_code}`);

  console.log('\nCustomer Accounts (Referral Chain):');
  console.log('| Account | Email | Referred By | Referral Code Used |');
  console.log('|---------|-------|-------------|-------------------|');

  // Sort by level
  Object.keys(byLevel).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
    byLevel[parseInt(level)].forEach((c: any) => {
      const referredBy = c.referral_type === 'PARTNER' ?
        `p-016 (Partner)` :
        `(Customer who referred them)`;
      console.log(`| ${c.email.split('@')[0]} | ${c.email} | ${referredBy} | ${c.referral_code_used} |`);
    });
  });
}

queryP016Attribution();
