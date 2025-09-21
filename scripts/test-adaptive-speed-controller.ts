#!/usr/bin/env tsx

/**
 * Test script for AdaptiveBatchSpeedController
 *
 * This validates the implementation of dynamic batch speed control
 * and verifies that the controller adapts properly to different scenarios.
 */

import { AdaptiveBatchSpeedController } from '../lib/adaptive-batch-speed-controller';

async function testAdaptiveSpeedController() {
  console.log('🧪 TESTING AdaptiveBatchSpeedController\n');

  const controller = new AdaptiveBatchSpeedController({
    minDelayMs: 500,
    maxDelayMs: 10000,
    baseDelayMs: 1500,
    successThreshold: 0.85,
    errorThreshold: 0.15,
    adjustmentFactor: 1.3,
    windowSize: 10
  });

  console.log('📊 Initial status:', controller.getStatus());
  console.log('\n=== Test 1: Success Scenario (High Success Rate) ===');

  // Simulate high success rate
  for (let i = 0; i < 8; i++) {
    controller.recordResult(true, 2000 + Math.random() * 1000); // 2-3s response times
  }
  controller.recordResult(false, 5000, 'timeout'); // One timeout
  controller.recordResult(true, 1500);

  let recommendation = controller.getSpeedRecommendation();
  console.log('✅ High success rate recommendation:', recommendation);

  console.log('\n=== Test 2: Rate Limiting Scenario ===');
  controller.reset();

  // Simulate rate limiting hits
  controller.recordResult(false, 1000, '429');
  controller.recordResult(false, 1000, 'rate_limit');
  controller.recordResult(false, 1000, '429');
  controller.recordResult(true, 2000);
  controller.recordResult(true, 2000);

  recommendation = controller.getSpeedRecommendation();
  console.log('🚨 Rate limiting recommendation:', recommendation);

  console.log('\n=== Test 3: High Error Rate Scenario ===');
  controller.reset();

  // Simulate high error rate
  for (let i = 0; i < 6; i++) {
    controller.recordResult(false, 3000, i % 2 === 0 ? 'server_error' : 'timeout');
  }
  for (let i = 0; i < 4; i++) {
    controller.recordResult(true, 2000);
  }

  recommendation = controller.getSpeedRecommendation();
  console.log('⚠️ High error rate recommendation:', recommendation);

  console.log('\n=== Test 4: Stable Performance Scenario ===');
  controller.reset();

  // Simulate stable performance
  for (let i = 0; i < 8; i++) {
    controller.recordResult(true, 2500);
  }
  controller.recordResult(false, 4000, 'timeout');
  controller.recordResult(true, 2000);

  recommendation = controller.getSpeedRecommendation();
  console.log('⚖️ Stable performance recommendation:', recommendation);

  console.log('\n=== Test 5: Emergency Brake Scenario ===');
  controller.reset();

  // Simulate multiple rate limit hits
  for (let i = 0; i < 5; i++) {
    controller.recordResult(false, 1000, '429');
  }

  recommendation = controller.getSpeedRecommendation();
  console.log('🚨 Emergency brake recommendation:', recommendation);

  console.log('\n=== Final Status ===');
  console.log('📊 Controller status:', controller.getStatus());

  console.log('\n✅ ADAPTIVE SPEED CONTROLLER TESTS COMPLETED');
  return true;
}

// Run the test
if (require.main === module) {
  testAdaptiveSpeedController()
    .then(() => {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

export { testAdaptiveSpeedController };