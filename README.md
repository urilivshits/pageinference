# Page Inference

A JavaScript library for scraping and inferring content from web pages, with specialized support for LinkedIn job pages.

## Features

- Generic web page scraping to extract structured content
- Specialized LinkedIn page scraping for job listings
- Clean, well-organized API for integration into browser extensions or scripts
- Comprehensive test suite to ensure reliability

## Project Structure

```
/content
  /scrapers
    generic-scraper.js  - Core scraping functionality for any webpage
    linkedin-scraper.js - LinkedIn-specific scraping functionality
    index.js            - Main export and scraper detection
/tests
  /content
    scraper.test.js       - Tests for the generic scraper
    linkedin-scraper.test.js - Tests for the LinkedIn scraper
  test-framework.js       - Simple testing framework
  test-environment.js     - JSDOM setup for tests
  run-tests.js            - Test runner script
```

## Scrapers

### Generic Scraper

The generic scraper extracts the following information from any webpage:

- Page title
- URL
- Meta description
- Main content (prioritizing `<main>` and `<article>` elements)
- Links (with href and text)

### LinkedIn Scraper

The LinkedIn scraper specializes in extracting information from LinkedIn job listings:

- Job title
- Company name
- Job location
- Job description
- Job requirements

## Usage

```javascript
// Import the scrapers
import scrapers from './content/scrapers/index.js';
const { scrapeCurrentPage, detectScraper } = scrapers;

// Scrape the current page
const pageContent = scrapeCurrentPage();
console.log(pageContent);

// Or detect and use a specific scraper
const scraper = detectScraper();
if (scraper.isLinkedInPage()) {
  const jobInfo = scraper.scrapeLinkedInJob();
  console.log(jobInfo);
} else {
  const pageInfo = scraper.scrapePageContent();
  console.log(pageInfo);
}
```

## Testing

The project includes a comprehensive test suite:

```
# Run all tests
node tests/run-tests.js

# Run standalone tests for specific scrapers
node test-generic-scraper.js
node test-linkedin-scraper.js
```

### Testing Approach

- Each scraper has dedicated test files
- Tests use JSDOM to create a mock DOM environment
- Test specific functions like `cleanText`, `extractMainContent`, etc.
- Standalone test scripts provide detailed debugging information

## Development

To extend the scraper functionality:

1. For new generic scraping features, modify `generic-scraper.js`
2. For specialized site scraping, create a new file similar to `linkedin-scraper.js`
3. Update `index.js` to export and detect the new scraper
4. Add tests for your new functionality

## License

MIT 