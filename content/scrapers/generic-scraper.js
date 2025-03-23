/**
 * Generic Page Scraper
 * 
 * Extracts content from any webpage in a structured format.
 */

/**
 * Clean text content by removing excessive whitespace and normalizing newlines
 * 
 * @param {string} text - The text to clean
 * @returns {string} - The cleaned text
 */
const cleanText = (text) => {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/\n\s*\n/g, '\n\n')  // Replace multiple newlines with double newline
    .trim();
};

/**
 * Extract metadata from the page
 * 
 * @returns {Object} - Object containing page metadata
 */
const extractMetadata = () => {
  const title = document.title || '';
  const url = window.location.href;
  const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  
  return { title, url, description };
};

/**
 * Extract main content from the page
 * 
 * @returns {string} - The main content text
 */
const extractMainContent = () => {
  // Try to find main content area
  const mainContent = document.querySelector('main')?.innerText || '';
  
  // If no main content, try article content
  const articleContent = Array.from(document.querySelectorAll('article'))
    .map(article => article.innerText)
    .join('\n\n');
  
  // If no specific content areas found, use body text
  const bodyContent = document.body.innerText;
  
  return cleanText(mainContent || articleContent || bodyContent);
};

/**
 * Extract links from the page
 * 
 * @returns {Array<Object>} - Array of link objects with href and text
 */
const extractLinks = () => {
  return Array.from(document.querySelectorAll('a[href]'))
    .map(link => ({
      href: link.getAttribute('href'),
      text: cleanText(link.innerText)
    }))
    .filter(link => link.href && link.text); // Only include links with both href and text
};

/**
 * Format the scraped content into a readable string
 * 
 * @param {Object} metadata - Page metadata
 * @param {string} content - Main content text
 * @param {Array<Object>} links - Array of link objects
 * @returns {string} - Formatted content string
 */
const formatContent = (metadata, content, links) => {
  const sections = [];
  
  // Add metadata section
  sections.push(`Title: ${metadata.title}`);
  sections.push(`URL: ${metadata.url}`);
  if (metadata.description) {
    sections.push(`Description: ${metadata.description}`);
  }
  
  // Add main content
  sections.push('\nPage Content:');
  sections.push(content);
  
  // Add links section if there are any links
  if (links.length > 0) {
    sections.push('\nLinks on Page:');
    links.forEach(link => {
      sections.push(`- ${link.text}: ${link.href}`);
    });
  }
  
  return sections.join('\n');
};

/**
 * Scrape content from the current page
 * 
 * @param {Object} options - Scraping options
 * @param {boolean} options.includeMetadata - Whether to include page metadata
 * @param {boolean} options.includeLinks - Whether to include page links
 * @returns {string} - The scraped content
 */
const scrapePageContent = (options = {}) => {
  const { includeMetadata = true, includeLinks = true } = options;
  
  try {
    // Extract content components
    const metadata = includeMetadata ? extractMetadata() : { title: '', url: '', description: '' };
    const content = extractMainContent();
    const links = includeLinks ? extractLinks() : [];
    
    // Format and return the content
    return formatContent(metadata, content, links);
  } catch (error) {
    console.error('Error scraping page content:', error);
    return `Error scraping page content: ${error.message}`;
  }
};

export default {
  scrapePageContent,
  // Export helpers for testing
  cleanText,
  extractMetadata,
  extractMainContent,
  extractLinks
}; 