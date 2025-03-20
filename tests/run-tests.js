/**
 * Test Runner
 * 
 * This file runs all tests in the test directory.
 * Add new test files to the imports below as they are created.
 */

console.log("Starting tests...");

// Import test framework
import { printSummary } from './test-framework.js';

// Import test files
console.log("Importing url-utils.test.js...");
import './shared/utils/url-utils.test.js';
console.log("Importing models.test.js...");
import './models.test.js';
// Import additional test files as they are created
// import './shared/utils/message-utils.test.js';
// import './shared/prompts/index.test.js';
// import './background/services/storage-service.test.js';

// Print final summary after all tests have run
console.log('\n==================================');
console.log('🧪 ALL TESTS COMPLETED');
console.log('==================================');
printSummary(); 