import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

// Get current directory (for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Test configuration
const tests = [
  {
    name: 'Database Integration Tests',
    script: 'test-influencer-db.ts',
    description: 'Tests database schema, constraints, and RLS policies'
  },
  {
    name: 'Backend API Tests',
    script: 'test-influencer-system-fixed.ts',
    description: 'Tests CRUD operations, authentication, and data integrity'
  },
  {
    name: 'End-to-End Workflow Tests',
    script: 'test-influencer-workflows.ts',
    description: 'Tests complete user journeys and business workflows'
  }
];

interface TestResult {
  name: string;
  passed: boolean;
  output: string;
  error?: string;
  duration: number;
}

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function logWithColor(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(title: string) {
  const line = '='.repeat(60);
  logWithColor(line, 'cyan');
  logWithColor(title, 'bright');
  logWithColor(line, 'cyan');
}

function logSubHeader(title: string) {
  const line = '-'.repeat(40);
  logWithColor(line, 'blue');
  logWithColor(title, 'blue');
  logWithColor(line, 'blue');
}

async function runTest(testConfig: typeof tests[0]): Promise<TestResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    logWithColor(`\n🚀 Running: ${testConfig.name}`, 'yellow');
    logWithColor(`   ${testConfig.description}`, 'reset');

    const child = spawn('npx', ['tsx', join('scripts', testConfig.script)], {
      cwd: projectRoot,
      stdio: 'pipe',
      env: {
        ...process.env,
        FORCE_COLOR: '1', // Preserve colors in output
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    });

    let output = '';
    let errorOutput = '';

    child.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;
      // Log in real-time
      process.stdout.write(text);
    });

    child.stderr?.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      // Log errors in real-time
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      const passed = code === 0;

      if (passed) {
        logWithColor(`\n✅ ${testConfig.name} completed successfully (${duration}ms)`, 'green');
      } else {
        logWithColor(`\n❌ ${testConfig.name} failed (${duration}ms)`, 'red');
      }

      resolve({
        name: testConfig.name,
        passed,
        output,
        error: errorOutput,
        duration
      });
    });

    child.on('error', (error) => {
      const duration = Date.now() - startTime;
      logWithColor(`\n💥 Failed to start ${testConfig.name}: ${error.message}`, 'red');

      resolve({
        name: testConfig.name,
        passed: false,
        output,
        error: error.message,
        duration
      });
    });
  });
}

async function runAllTests() {
  logHeader('🧪 Influencer System Automated Test Suite');

  logWithColor('\n📋 Test Plan:', 'bright');
  tests.forEach((test, index) => {
    logWithColor(`   ${index + 1}. ${test.name}`, 'cyan');
    logWithColor(`      ${test.description}`, 'reset');
  });

  logWithColor('\n⚠️  Prerequisites:', 'yellow');
  logWithColor('   • Development server running (npm run dev)', 'reset');
  logWithColor('   • Environment variables loaded (.env.local)', 'reset');
  logWithColor('   • Database accessible with service role key', 'reset');
  logWithColor('   • No critical data in test database', 'reset');

  logWithColor('\n⏳ Starting test execution...', 'bright');

  const results: TestResult[] = [];
  const startTime = Date.now();

  // Run tests sequentially to avoid conflicts
  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
  }

  const totalDuration = Date.now() - startTime;

  // Generate summary report
  logHeader('📊 Test Results Summary');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => r.passed === false).length;
  const total = results.length;

  logWithColor(`\n🏁 Overall Results:`, 'bright');
  logWithColor(`   ✅ Passed: ${passed}/${total}`, passed > 0 ? 'green' : 'reset');
  logWithColor(`   ❌ Failed: ${failed}/${total}`, failed > 0 ? 'red' : 'reset');
  logWithColor(`   ⏱️  Total Time: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`, 'blue');

  // Detailed results
  logSubHeader('📋 Detailed Results');
  results.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌';
    const color = result.passed ? 'green' : 'red';
    logWithColor(`\n${index + 1}. ${icon} ${result.name}`, color);
    logWithColor(`   Duration: ${result.duration}ms`, 'blue');

    if (!result.passed && result.error) {
      logWithColor(`   Error: ${result.error}`, 'red');
    }
  });

  // Performance analysis
  logSubHeader('⚡ Performance Analysis');
  const avgDuration = totalDuration / results.length;
  const slowestTest = results.reduce((prev, current) =>
    (prev.duration > current.duration) ? prev : current
  );
  const fastestTest = results.reduce((prev, current) =>
    (prev.duration < current.duration) ? prev : current
  );

  logWithColor(`   Average test time: ${avgDuration.toFixed(0)}ms`, 'blue');
  logWithColor(`   Slowest: ${slowestTest.name} (${slowestTest.duration}ms)`, 'yellow');
  logWithColor(`   Fastest: ${fastestTest.name} (${fastestTest.duration}ms)`, 'green');

  // Failure analysis
  if (failed > 0) {
    logSubHeader('🔍 Failure Analysis');
    const failedTests = results.filter(r => !r.passed);

    logWithColor('\n❌ Failed tests require attention:', 'red');
    failedTests.forEach(test => {
      logWithColor(`   • ${test.name}`, 'red');
      if (test.error) {
        logWithColor(`     ${test.error.split('\n')[0]}`, 'reset');
      }
    });

    logWithColor('\n🔧 Suggested next steps:', 'yellow');
    logWithColor('   1. Check database connection and permissions', 'reset');
    logWithColor('   2. Verify environment variables are set correctly', 'reset');
    logWithColor('   3. Review failed test output for specific errors', 'reset');
    logWithColor('   4. Check server logs for additional context', 'reset');
  }

  // Success celebration
  if (failed === 0) {
    logWithColor('\n🎉 All tests passed!', 'green');
    logWithColor('   Your influencer system is working correctly.', 'bright');
    logWithColor('   Ready for UX testing and production deployment.', 'green');
  }

  // Next steps
  logSubHeader('🚀 Next Steps');
  if (failed === 0) {
    logWithColor('✅ Automated testing complete - all systems operational', 'green');
    logWithColor('📋 Proceed to UX testing using the checklist:', 'blue');
    logWithColor('   docs/influencer-ux-testing-checklist.md', 'cyan');
    logWithColor('🎯 Manual testing focus areas:', 'yellow');
    logWithColor('   • Admin interface usability', 'reset');
    logWithColor('   • Mobile responsiveness', 'reset');
    logWithColor('   • Visual design consistency', 'reset');
    logWithColor('   • User workflow efficiency', 'reset');
  } else {
    logWithColor('⚠️  Fix failing tests before proceeding to UX testing', 'yellow');
    logWithColor('🔧 Debug failed tests and re-run this suite', 'red');
  }

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Load environment variables from .env.local
function loadEnvironmentVariables() {
  try {
    const envPath = join(projectRoot, '.env.local');
    const envContent = readFileSync(envPath, 'utf8');

    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key] = valueParts.join('=');
        }
      }
    });
  } catch (error) {
    logWithColor('⚠️  Could not load .env.local file', 'yellow');
    console.error(error);
  }
}

// Check prerequisites before starting
function checkPrerequisites(): boolean {
  // Load environment variables first
  loadEnvironmentVariables();

  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missing.length > 0) {
    logWithColor('❌ Missing required environment variables:', 'red');
    missing.forEach(envVar => {
      logWithColor(`   • ${envVar}`, 'red');
    });
    logWithColor('\n💡 Make sure .env.local exists with required variables:', 'yellow');
    logWithColor('   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url', 'cyan');
    logWithColor('   SUPABASE_SERVICE_ROLE_KEY=your_service_key', 'cyan');
    return false;
  }

  return true;
}

// Main execution
async function main() {
  if (!checkPrerequisites()) {
    process.exit(1);
  }

  try {
    await runAllTests();
  } catch (error) {
    logWithColor('\n💥 Unexpected error running test suite:', 'red');
    console.error(error);
    process.exit(1);
  }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  logWithColor('\n\n⚠️  Test suite interrupted by user', 'yellow');
  process.exit(130);
});

process.on('SIGTERM', () => {
  logWithColor('\n\n⚠️  Test suite terminated', 'yellow');
  process.exit(143);
});

// Run the test suite
main();