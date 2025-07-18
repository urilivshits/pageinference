/**
 * LinkedIn Page Scraper
 * 
 * Specialized scraper for LinkedIn pages, with support for profiles and job postings.
 */

import genericScraper from './generic-scraper.js';

/**
 * Check if the current page is a LinkedIn page
 * 
 * @returns {boolean} - True if the current page is a LinkedIn page
 */
const isLinkedInPage = () => {
  const hostname = window.location.hostname.toLowerCase();
  return hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com');
};

/**
 * Extract content from a specific section using a selector
 * 
 * @param {string} itemSelector - CSS selector for the section
 * @param {string} sectionName - Name of the section for logging
 * @returns {string} - Extracted content
 */
const extractLinkedInSection = (itemSelector, sectionName) => {
  try {
    const items = document.querySelectorAll(itemSelector);
    console.log(`Found ${items.length} items in ${sectionName} section using selector ${itemSelector.trim()}`);
    
    return Array.from(items)
      .map(item => genericScraper.cleanText(item.textContent))
      .filter(text => text)
      .join('\n\n');
  } catch (error) {
    console.error(`Error extracting ${sectionName} section:`, error);
    return '';
  }
};

/**
 * Extract profile information from a LinkedIn profile page
 * 
 * @returns {string} - Formatted profile information
 */
const scrapeLinkedInProfile = () => {
  const sections = [];
  
  // Extract basic profile info
  const name = extractLinkedInSection('.text-heading-xlarge', 'name');
  const headline = extractLinkedInSection('.text-body-medium', 'headline');
  const about = extractLinkedInSection('[data-field="about_section"]', 'about');
  
  if (name) sections.push(`Name: ${name}`);
  if (headline) sections.push(`Headline: ${headline}`);
  if (about) sections.push('\nAbout:', about);
  
  // Extract experience
  const experience = extractLinkedInSection('#experience ~ .pvs-list__outer-container .pvs-entity', 'experience');
  if (experience) {
    sections.push('\nExperience:', experience);
  }
  
  // Extract education
  const education = extractLinkedInSection('#education ~ .pvs-list__outer-container .pvs-entity', 'education');
  if (education) {
    sections.push('\nEducation:', education);
  }
  
  // Extract skills
  const skills = extractLinkedInSection('#skills ~ .pvs-list__outer-container .pvs-entity', 'skills');
  if (skills) {
    sections.push('\nSkills:', skills);
  }
  
  const result = sections.join('\n\n');
  
  console.log(`[LinkedIn Scraper] Profile result: "${result}" (${result.length} characters)`);
  
  // If we didn't get substantial content (less than 100 characters), fall back to generic scraper
  if (result.length < 100) {
    console.log('[LinkedIn Scraper] Profile content too minimal, falling back to generic scraper');
    const genericResult = genericScraper.scrapePageContent({ includeMetadata: true, includeLinks: false });
    console.log(`[LinkedIn Scraper] Generic fallback result length: ${genericResult.length}`);
    return genericResult;
  }
  
  console.log('[LinkedIn Scraper] Profile content sufficient, using LinkedIn-specific result');
  return result;
};

/**
 * Extract job posting information from a LinkedIn job page
 * 
 * @returns {string} - Formatted job posting information
 */
const scrapeLinkedInJob = () => {
  const sections = [];
  
  // Extract job details
  const title = extractLinkedInSection('.job-details-jobs-unified-top-card__job-title', 'job title');
  const company = extractLinkedInSection('.job-details-jobs-unified-top-card__company-name', 'company');
  const location = extractLinkedInSection('.job-details-jobs-unified-top-card__bullet', 'location');
  const description = extractLinkedInSection('.jobs-description__content', 'description');
  
  if (title) sections.push(`Job Title: ${title}`);
  if (company) sections.push(`Company: ${company}`);
  if (location) sections.push(`Location: ${location}`);
  if (description) sections.push('\nDescription:', description);
  
  // Extract job requirements
  const requirements = extractLinkedInSection('.jobs-box__group .jobs-box__list-item', 'requirements');
  if (requirements) {
    sections.push('\nRequirements:', requirements);
  }
  
  const result = sections.join('\n\n');
  
  console.log(`[LinkedIn Scraper] Job result: "${result}" (${result.length} characters)`);
  
  // If we didn't get substantial content (less than 100 characters), fall back to generic scraper
  if (result.length < 100) {
    console.log('[LinkedIn Scraper] Job content too minimal, falling back to generic scraper');
    const genericResult = genericScraper.scrapePageContent({ includeMetadata: true, includeLinks: false });
    console.log(`[LinkedIn Scraper] Generic fallback result length: ${genericResult.length}`);
    return genericResult;
  }
  
  console.log('[LinkedIn Scraper] Job content sufficient, using LinkedIn-specific result');
  return result;
};

/**
 * Scrape content from a LinkedIn page
 * 
 * @param {Object} options - Scraping options
 * @returns {string} - The scraped content
 */
const scrapeLinkedInContent = (options = {}) => {
  try {
    // TEMPORARY: Always use generic scraper to test if fallback works
    console.log('[LinkedIn Scraper] TEMPORARILY using generic scraper for all LinkedIn pages');
    const genericResult = genericScraper.scrapePageContent({ includeMetadata: true, includeLinks: false });
    console.log(`[LinkedIn Scraper] Generic scraper result length: ${genericResult.length}`);
    return genericResult;
    
    // Determine the page type and scrape accordingly
    const path = window.location.pathname.toLowerCase();
    console.log(`[LinkedIn Scraper] Current path: ${path}`);
    
    if (path.includes('/in/') || path.match(/\/profile\/view/)) {
      // Profile page
      console.log('[LinkedIn Scraper] Detected profile page, using profile scraper');
      return scrapeLinkedInProfile();
    } else if (path.includes('/jobs/view/') || path.includes('/jobs/detail/')) {
      // Job posting page
      console.log('[LinkedIn Scraper] Detected job page, using job scraper');
      return scrapeLinkedInJob();
    } else {
      // For other LinkedIn pages, use the generic scraper
      console.log('[LinkedIn Scraper] Unknown page type, using generic scraper');
      return genericScraper.scrapePageContent(options);
    }
  } catch (error) {
    console.error('Error in LinkedIn scraper:', error);
    // Fall back to generic scraper
    console.log('[LinkedIn Scraper] Error occurred, falling back to generic scraper');
    return genericScraper.scrapePageContent(options);
  }
};

export default {
  isLinkedInPage,
  scrapeLinkedInContent,
  // Export these for testing
  scrapeLinkedInProfile,
  scrapeLinkedInJob,
  extractLinkedInSection
}; 