/**
 * Simple Test Framework for Page Inference Extension
 * 
 * This provides basic unit testing functionality for our extension modules.
 */

const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

/**
 * Run a test case
 * 
 * @param {string} name - Name of the test case
 * @param {Function} testFn - Function containing the test logic
 * @param {boolean} skip - Whether to skip this test (default: false)
 */
export function test(name, testFn, skip = false) {
  if (skip) {
    console.log(`⚠️ SKIPPED: ${name}`);
    testResults.skipped++;
    testResults.tests.push({ name, status: 'skipped' });
    return;
  }
  
  try {
    testFn();
    console.log(`✅ PASSED: ${name}`);
    testResults.passed++;
    testResults.tests.push({ name, status: 'passed' });
  } catch (error) {
    console.error(`❌ FAILED: ${name}`);
    console.error(`   Error: ${error.message}`);
    testResults.failed++;
    testResults.tests.push({ name, status: 'failed', error: error.message });
  }
}

/**
 * Assertion for equality
 * 
 * @param {any} actual - The actual value
 * @param {any} expected - The expected value
 * @param {string} message - Optional message to display on failure
 */
export function assertEqual(actual, expected, message = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

/**
 * Assertion for truthiness
 * 
 * @param {any} value - The value to check
 * @param {string} message - Optional message to display on failure
 */
export function assertTrue(value, message = '') {
  if (!value) {
    throw new Error(message || `Expected truthy value but got ${value}`);
  }
}

/**
 * Assertion for falsiness
 * 
 * @param {any} value - The value to check
 * @param {string} message - Optional message to display on failure
 */
export function assertFalse(value, message = '') {
  if (value) {
    throw new Error(message || `Expected falsy value but got ${value}`);
  }
}

/**
 * Run a suite of tests
 * 
 * @param {string} suiteName - Name of the test suite
 * @param {Function} suiteFn - Function containing the tests
 */
export function suite(suiteName, suiteFn) {
  console.log(`\n📋 TEST SUITE: ${suiteName}`);
  suiteFn();
}

/**
 * Print a summary of test results
 */
export function printSummary() {
  console.log('\n📊 TEST SUMMARY:');
  console.log(`   Total Tests: ${testResults.passed + testResults.failed + testResults.skipped}`);
  console.log(`   Passed: ${testResults.passed}`);
  console.log(`   Failed: ${testResults.failed}`);
  console.log(`   Skipped: ${testResults.skipped}`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults.tests
      .filter(test => test.status === 'failed')
      .forEach(test => {
        console.log(`   - ${test.name}: ${test.error}`);
      });
  }
}

export default {
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  suite,
  printSummary
}; 