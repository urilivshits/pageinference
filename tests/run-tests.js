/**
 * Test Runner
 * 
 * This file runs all tests in the test directory.
 * Add new test files to the imports below as they are created.
 */

// Initialize global process if not present
if (!global.process) {
  global.process = {
    stdout: { write: console.log },
    stderr: { write: console.error },
    exit: (code) => { throw new Error(`Process exited with code ${code}`); }
  };
}

// Import test framework and environment
import { printSummary } from './test-framework.js';
import './test-environment.js';

// Run tests asynchronously
async function runTests() {
  try {
    process.stdout.write('\nStarting test execution...\n\n');
    
    // Run Simple tests
    process.stdout.write('Running Simple tests...\n');
    try {
      await import('./simple.test.js');
    } catch (error) {
      process.stderr.write(`Error in Simple tests: ${error.stack}\n`);
    }
    
    // Run Scraper tests
    process.stdout.write('\nRunning Generic Scraper tests...\n');
    try {
      await import('./content/scraper.test.js');
    } catch (error) {
      process.stderr.write(`Error in Scraper tests: ${error.stack}\n`);
    }
    
    // Let the LinkedIn tests run via setTimeout in scraper.test.js
    
    // Print test summary
    setTimeout(() => {
      printSummary();
      process.stdout.write('\nAll tests completed!\n\n');
    }, 3000);  // Wait for LinkedIn tests to complete
    
  } catch (error) {
    process.stderr.write('\nTest execution failed:\n');
    process.stderr.write(error.stack + '\n');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  process.stderr.write('Error running tests:\n');
  process.stderr.write(error.stack + '\n');
  process.exit(1);
}); 