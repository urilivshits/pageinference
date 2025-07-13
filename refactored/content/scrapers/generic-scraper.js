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
 * Check if an element is hidden
 * 
 * @param {Element} element - The element to check
 * @returns {boolean} - Whether the element is hidden
 */
const isElementHidden = (element) => {
  if (!element || !element.style) return false;
  
  const style = window.getComputedStyle(element);
  return (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0' ||
    element.hasAttribute('hidden')
  );
};

/**
 * Check if an element is a block element
 * 
 * @param {Element} element - The element to check
 * @returns {boolean} - Whether the element is a block element
 */
const isBlockElement = (element) => {
  if (!element || !element.tagName) return false;
  
  const blockElements = ['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'NAV', 'ASIDE', 'MAIN', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'HR', 'TABLE', 'TR', 'TD', 'TH'];
  return blockElements.includes(element.tagName.toUpperCase());
};

/**
 * Get visible text from an element and its children (comprehensive extraction)
 * 
 * @param {Element|Node} element - The root element to start from
 * @returns {string} - The visible text content
 */
const getVisibleText = (element) => {
  // Check if element is null or undefined
  if (!element) {
    return '';
  }
  
  // If it's a text node, return its text
  if (element.nodeType === Node.TEXT_NODE) {
    return element.textContent.trim() + ' ';
  }
  
  // Skip if not an element node and not a text node
  if (element.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }
  
  // Skip certain elements
  const tagName = element.tagName?.toLowerCase();
  
  // Skip invisible elements and irrelevant tags
  if (
    isElementHidden(element) ||
    ['script', 'style', 'noscript', 'svg', 'img', 'meta'].includes(tagName)
  ) {
    return '';
  }
  
  // If it has children, recursively get their text
  let text = '';
  try {
    for (const child of element.childNodes) {
      text += getVisibleText(child);
    }
    
    // Add extra spacing for block elements
    if (isBlockElement(element)) {
      text = '\n' + text + '\n';
    }
    
    return text;
  } catch (error) {
    console.warn('Error processing element:', element, error);
    return '';
  }
};

/**
 * Extract main content from the page using comprehensive DOM traversal
 * 
 * @returns {string} - The main content text
 */
const extractMainContent = () => {
  try {
    // Get body element or fallback to document
    const bodyEl = document.body || document.documentElement;
    
    if (!bodyEl) {
      console.warn('Could not find body element, returning empty content');
      return '';
    }
    
    // Get all visible text nodes using comprehensive extraction
    const textContent = getVisibleText(bodyEl);
    
    // Return the text content with a reasonable size limit
    const result = textContent.substring(0, 100000);
    console.log(`Extracted ${result.length} characters of content`);
    return result;
  } catch (error) {
    console.error('Error extracting page content:', error);
    return `Error extracting content from ${window.location.href}. ${error.message}`;
  }
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
  extractLinks,
  getVisibleText,
  isElementHidden,
  isBlockElement
}; 