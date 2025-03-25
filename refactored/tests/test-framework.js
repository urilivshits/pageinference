/**
 * Simple test framework for running tests in Node.js
 */

// Initialize global console and process if not present
if (!global.console) {
  global.console = {
    log: (...args) => process.stdout.write(args.join(' ') + '\n'),
    error: (...args) => process.stderr.write(args.join(' ') + '\n'),
    warn: (...args) => process.stderr.write(args.join(' ') + '\n'),
    info: (...args) => process.stdout.write(args.join(' ') + '\n'),
    debug: (...args) => process.stdout.write(args.join(' ') + '\n')
  };
}

if (!global.process) {
  global.process = {
    stdout: { write: console.log },
    stderr: { write: console.error }
  };
}

let currentSuite = '';
let testCount = 0;
let passCount = 0;
let failCount = 0;
let beforeEachFns = {};
let afterEachFns = {};

/**
 * Set up function to run before each test in the current suite
 */
export const beforeEach = (fn) => {
  beforeEachFns[currentSuite] = fn;
};

/**
 * Set up function to run after each test in the current suite
 */
export const afterEach = (fn) => {
  afterEachFns[currentSuite] = fn;
};

/**
 * Run a test case
 */
export const test = async (name, testFn) => {
  testCount++;
  try {
    const beforeFn = beforeEachFns[currentSuite];
    if (beforeFn) {
      await beforeFn();
    }
    
    await testFn();
    
    const afterFn = afterEachFns[currentSuite];
    if (afterFn) {
      await afterFn();
    }
    
    process.stdout.write(`✓ ${currentSuite ? currentSuite + ' - ' : ''}${name}\n`);
    passCount++;
  } catch (error) {
    process.stderr.write(`✗ ${currentSuite ? currentSuite + ' - ' : ''}${name}\n`);
    process.stderr.write(`   ${error.message}\n`);
    failCount++;
  }
};

/**
 * Create a test suite
 */
export const suite = async (name, suiteFn) => {
  const previousSuite = currentSuite;
  currentSuite = name;
  
  try {
    await suiteFn();
  } finally {
    currentSuite = previousSuite;
  }
};

/**
 * Assert that two values are equal
 */
export const assertEqual = (actual, expected, message = '') => {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  
  if (actualStr !== expectedStr) {
    throw new Error(
      `${message ? message + '\n' : ''}Expected ${expectedStr} but got ${actualStr}`
    );
  }
};

/**
 * Assert that a value is true
 */
export const assertTrue = (value, message = '') => {
  if (!value) {
    throw new Error(message || 'Expected true but got false');
  }
};

/**
 * Assert that a value is false
 */
export const assertFalse = (value, message = '') => {
  if (value) {
    throw new Error(message || 'Expected false but got true');
  }
};

/**
 * Print test summary
 */
export const printSummary = () => {
  process.stdout.write('\nTest Summary:\n');
  process.stdout.write(`Total Tests: ${testCount}\n`);
  process.stdout.write(`Passed: ${passCount}\n`);
  process.stdout.write(`Failed: ${failCount}\n`);
};

// Export test framework utilities
export default {
  test,
  suite,
  assertEqual,
  assertTrue,
  assertFalse,
  beforeEach,
  afterEach,
  printSummary
}; 
