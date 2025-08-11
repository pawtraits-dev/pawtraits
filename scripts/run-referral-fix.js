/**
 * Simple runner for the referral fix script
 * Usage: node scripts/run-referral-fix.js
 */

const path = require('path');

// Load environment variables from the project root
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Import and run the main script
const { main } = require('./fix-referral-orders.js');

main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});