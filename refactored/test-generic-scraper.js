/**
 * Standalone Test for Generic Scraper
 * 
 * This script tests the Generic Scraper functionality directly.
 */

import { JSDOM } from 'jsdom';

console.log('Starting script');

try {
  console.log('Importing scrapers...');
  const scrapersModule = await import('./content/scrapers/index.js');
  
  console.log('Scrapers imported:', Object.keys(scrapersModule.default));
  const { genericScraper } = scrapersModule.default;
  
  console.log('genericScraper exists:', !!genericScraper);
  console.log('genericScraper functions:', Object.keys(genericScraper));
  
  // Set up the test environment
  function setupTestDOM(url = 'https://example.com') {
    console.log('Setting up DOM for URL:', url);
    
    // Create a new JSDOM instance
    const dom = new JSDOM(`<!DOCTYPE html>
      <html>
        <head>
          <title>Test Page Title</title>
          <meta name="description" content="Test page description for scraping">
        </head>
        <body>
          Full page body content for testing purposes
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
    console.log('document.body.textContent:', global.document.body.textContent);
    
    // Manually set innerText for body
    document.body.innerText = document.body.textContent;
    console.log('document.body.innerText manually set');
    
    return dom;
  }

  // Run tests
  async function runTests() {
    console.log('🧪 Starting Generic Scraper Tests');
    
    try {
      // Set up the test environment
      const dom = setupTestDOM('https://example.com/test-page');
      console.log('DOM setup complete');
      
      // Override the extractMainContent function for testing
      const originalExtractMainContent = genericScraper.extractMainContent;
      genericScraper.extractMainContent = () => {
        console.log('Using overridden extractMainContent function');
        return 'Full page body content for testing purposes';
      };
      
      // Test: cleanText functionality
      console.log('\n📋 Testing cleanText function');
      const dirtyText = '  Multiple    spaces   \n\n\n and newlines  ';
      
      try {
        console.log('Calling cleanText...');
        const cleanedText = genericScraper.cleanText(dirtyText);
        console.log('cleanText result:', cleanedText);
        
        const expectedCleanedText = 'Multiple spaces and newlines';
        
        if (cleanedText === expectedCleanedText) {
          console.log('✅ cleanText works correctly');
        } else {
          console.error(`❌ cleanText failed: Expected "${expectedCleanedText}" but got "${cleanedText}"`);
        }
      } catch (cleanTextError) {
        console.error('Error in cleanText test:', cleanTextError);
      }
      
      // Test: scrapePageContent functionality
      console.log('\n📋 Testing scrapePageContent function');
      
      try {
        console.log('Calling scrapePageContent...');
        const pageInfo = genericScraper.scrapePageContent();
        console.log('scrapePageContent result:');
        console.log('------- START PAGE INFO -------');
        console.log(pageInfo);
        console.log('------- END PAGE INFO -------');
        
        // Check if the page info contains expected elements
        const checks = [
          { check: pageInfo.includes('Title: Test Page Title'), message: 'Page title is included' },
          { check: pageInfo.includes('URL: https://example.com/test-page'), message: 'Page URL is included' },
          { check: pageInfo.includes('Description: Test page description for scraping'), message: 'Page description is included' },
          { check: pageInfo.includes('Full page body content for testing purposes'), message: 'Page content is included' }
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
        genericScraper.extractMainContent = originalExtractMainContent;
      } catch (pageContentError) {
        console.error('Error in scrapePageContent test:', pageContentError);
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