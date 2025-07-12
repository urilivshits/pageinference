# Page Inference

A JavaScript library for scraping and inferring content from web pages, with specialized support for LinkedIn job pages.

## Project Versions

This project contains two versions:

1. **Original Browser Extension**: The original Chrome extension for page inference.
2. **Refactored Module Version**: A restructured version with improved modularity and comprehensive tests.

See [REFACTORED_VERSION_INSTALLATION.md](REFACTORED_VERSION_INSTALLATION.md) for instructions on installing the refactored version.

## Features

- Generic web page scraping to extract structured content
- Specialized LinkedIn page scraping for job listings
- Clean, well-organized API for integration into browser extensions or scripts
- Comprehensive test suite to ensure reliability

## Project Structure

### Refactored Version Structure

```
/content
  content.js           - Refactored content script entry point
  /scrapers
    generic-scraper.js  - Core scraping functionality for any webpage
    linkedin-scraper.js - LinkedIn-specific scraping functionality
    index.js            - Main export and scraper detection
  /helpers.js          - Helper utilities for extension integration
/popup
  popup.html           - Refactored popup interface
  popup.js             - Popup script
/tests
  /content
    scraper.test.js       - Tests for the generic scraper
    linkedin-scraper.test.js - Tests for the LinkedIn scraper
  test-framework.js       - Simple testing framework
  test-environment.js     - JSDOM setup for tests
  run-tests.js            - Test runner script
test-generic-scraper.js   - Standalone test for generic scraper
test-linkedin-scraper.js  - Standalone test for LinkedIn scraper
module-loader.js          - Module loader for extension integration
refactored-manifest.json  - Updated manifest for refactored version
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