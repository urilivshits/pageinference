/**
 * Standalone Test for LinkedIn Scraper
 * 
 * This script tests the LinkedIn Scraper functionality directly.
 */

import { JSDOM } from 'jsdom';

console.log('Starting script');

try {
  console.log('Importing scrapers...');
  const scrapersModule = await import('./content/scrapers/index.js');
  
  console.log('Scrapers imported:', Object.keys(scrapersModule.default));
  const { linkedInScraper } = scrapersModule.default;
  
  console.log('linkedInScraper exists:', !!linkedInScraper);
  console.log('linkedInScraper functions:', Object.keys(linkedInScraper));
  
  // Set up the test environment
  function setupTestDOM(url = 'https://www.linkedin.com/jobs/view/test-job') {
    console.log('Setting up DOM for URL:', url);
    
    // Create a new JSDOM instance
    const dom = new JSDOM(`<!DOCTYPE html>
      <html>
        <head>
          <title>Software Engineer at Test Company</title>
          <meta name="description" content="Exciting opportunity for a Software Engineer">
        </head>
        <body>
          <div class="job-details-jobs-unified-top-card__job-title">Software Engineer</div>
          <div class="job-details-jobs-unified-top-card__company-name">Test Company</div>
          <div class="jobs-description__content">Job Requirements: 5+ years experience...</div>
        </body>
      </html>`, {
      url: url,
      contentType: 'text/html',
      runScripts: 'dangerously'
    });

    console.log('DOM created');
    
    // Set up global variables
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = new URL(url);
    global.console = console;

    console.log('Globals set up');
    
    return dom;
  }

  // Run tests
  async function runTests() {
    console.log('🧪 Starting LinkedIn Scraper Tests');
    
    try {
      // Set up the test environment
      const dom = setupTestDOM('https://www.linkedin.com/jobs/view/test-job');
      console.log('DOM setup complete');
      
      // Test: isLinkedInPage functionality
      console.log('\n📋 Testing isLinkedInPage function');
      
      try {
        console.log('Calling isLinkedInPage...');
        const isLinkedIn = linkedInScraper.isLinkedInPage();
        console.log('isLinkedInPage result:', isLinkedIn);
        
        if (isLinkedIn === true) {
          console.log('✅ isLinkedInPage works correctly');
        } else {
          console.error('❌ isLinkedInPage failed: Expected true but got false');
        }
      } catch (isLinkedInError) {
        console.error('Error in isLinkedInPage test:', isLinkedInError);
      }
      
      // Test: scrapeLinkedInJob functionality
      console.log('\n📋 Testing scrapeLinkedInJob function');
      
      try {
        console.log('Overriding extractLinkedInSection function...');
        const originalExtractSection = linkedInScraper.extractLinkedInSection;
        
        // Override the extraction function for testing
        linkedInScraper.extractLinkedInSection = (selector, name) => {
          console.log(`Extracting section ${name} with selector ${selector}`);
          if (selector.includes('job-title')) {
            return 'Software Engineer';
          } else if (selector.includes('company-name')) {
            return 'Test Company';
          } else if (selector.includes('description')) {
            return 'Job Requirements: 5+ years experience...';
          }
          return '';
        };
        
        console.log('Calling scrapeLinkedInJob...');
        const jobInfo = linkedInScraper.scrapeLinkedInJob();
        console.log('scrapeLinkedInJob result:');
        console.log('------- START JOB INFO -------');
        console.log(jobInfo);
        console.log('------- END JOB INFO -------');
        
        // Check if the job info contains expected elements
        const checks = [
          { check: jobInfo.includes('Job Title: Software Engineer'), message: 'Job title is included' },
          { check: jobInfo.includes('Company: Test Company'), message: 'Company name is included' },
          { check: jobInfo.includes('Job Requirements: 5+ years experience...'), message: 'Job requirements are included' }
        ];
        
        let allTestsPassed = true;
        
        checks.forEach(({ check, message }) => {
          if (check) {
            console.log(`✅ ${message}`);
          } else {
            console.error(`❌ ${message} check failed`);
            allTestsPassed = false;
          }
        });
        
        // Print final result
        if (allTestsPassed) {
          console.log('\n🎉 All tests passed successfully!');
        } else {
          console.error('\n❌ Some tests failed.');
        }
        
        // Restore original function
        linkedInScraper.extractLinkedInSection = originalExtractSection;
        
      } catch (jobInfoError) {
        console.error('Error in scrapeLinkedInJob test:', jobInfoError);
      }
    } catch (error) {
      console.error('\n💥 Test execution error:', error);
    }
  }

  // Run the tests
  console.log('Running tests...');
  await runTests();
  console.log('Tests completed');

} catch (error) {
  console.error('💥 Unhandled error during script execution:', error);
} 