/**
 * Page Scraper Index
 * 
 * Exports scraper functions and handles scraper detection.
 */

import genericScraper from './generic-scraper.js';
import linkedInScraper from './linkedin-scraper.js';

/**
 * Detect which scraper to use for the current page
 * 
 * @returns {Object} - The appropriate scraper for the current page
 */
export const detectScraper = () => {
  // Check for LinkedIn pages first
  if (linkedInScraper.isLinkedInPage()) {
    return linkedInScraper;
  }
  
  // Default to generic scraper
  return genericScraper;
};

/**
 * Scrape content from the current page
 * 
 * @param {Object} options - Scraping options
 * @param {boolean} options.includeMetadata - Whether to include page metadata
 * @param {boolean} options.includeLinks - Whether to include page links
 * @returns {string} - The scraped content
 */
export const scrapeCurrentPage = (options = {}) => {
  try {
    const scraper = detectScraper();
    
    // Use LinkedIn scraper's specialized function
    if (scraper === linkedInScraper) {
      return scraper.scrapeLinkedInContent(options);
    }
    
    // Use generic scraper for all other pages
    return scraper.scrapePageContent(options);
  } catch (error) {
    console.error('Error scraping page:', error);
    return `Error scraping page: ${error.message}`;
  }
};

export default {
  detectScraper,
  scrapeCurrentPage,
  genericScraper,
  linkedInScraper
}; 