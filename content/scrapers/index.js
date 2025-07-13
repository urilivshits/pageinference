/**
 * Page Scraper Index
 * 
 * Unified scraper that works on all pages using the generic scraper.
 */

import genericScraper from './generic-scraper.js';

/**
 * Detect which scraper to use for the current page
 * Now always returns the generic scraper for unified behavior
 * 
 * @returns {Object} - The generic scraper for all pages
 */
export const detectScraper = () => {
  // Always use generic scraper for unified behavior across all pages
  return genericScraper;
};

/**
 * Scrape content from the current page using the unified generic scraper
 * 
 * @param {Object} options - Scraping options
 * @param {boolean} options.includeMetadata - Whether to include page metadata
 * @param {boolean} options.includeLinks - Whether to include page links
 * @returns {string} - The scraped content
 */
export const scrapeCurrentPage = (options = {}) => {
  try {
    // Always use the generic scraper for all pages
    const scraper = genericScraper;
    return scraper.scrapePageContent(options);
  } catch (error) {
    console.error('Error scraping page:', error);
    return `Error scraping page: ${error.message}`;
  }
};

export default {
  detectScraper,
  scrapeCurrentPage
}; 