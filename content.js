/**
 * Page Inference - Content Script
 * 
 * This script runs in the context of web pages and is responsible for:
 * 1. Extracting text content from the current page
 * 2. Sending the content to the background script for processing
 * 3. Handling communication between the popup and background script
 */

// Track initialization status
window.__pageInferenceInitialized = false;

// Initialize the content script
function initialize() {
  // Only initialize once
  if (window.__pageInferenceInitialized) return;
  
  // Listen for messages from the popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    if (request.action === 'scrapeContent') {
      console.log('Scraping page content...');
      const pageContent = scrapePageContent();
      console.log('Scraped content length:', pageContent.length);
      sendResponse({ content: pageContent });
      console.log('Sent response with content');
    }
    return true; // Keep the message channel open for async responses
  });

  window.__pageInferenceInitialized = true;
  console.log('Page Inference content script initialized');
}

// Initialize immediately
initialize();

/**
 * Scrapes the main content from the current page
 * Uses a heuristic approach to find the most relevant text
 * @returns {string} The extracted text content
 */
function scrapePageContent() {
  // First attempt: Try to find the main content area
  const mainContentSelectors = [
    'article', 'main', '.content', '#content', '.article', 
    '.post', '.entry', '[role="main"]', '.main-content'
  ];
  
  for (const selector of mainContentSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim().length > 500) {
      return cleanText(element.textContent);
    }
  }
  
  // Second attempt: Extract from body but filter out navigation, headers, footers, etc.
  const elementsToIgnore = [
    'nav', 'header', 'footer', 'aside', '.sidebar', '.nav', '.menu',
    '.navigation', '.comments', '.ad', '.advertisement', '.promo',
    'script', 'style', 'meta', 'noscript', 'iframe'
  ];
  
  // Create a document fragment to work with
  const tempDoc = document.cloneNode(true);
  
  // Remove unwanted elements
  elementsToIgnore.forEach(selector => {
    const elements = tempDoc.querySelectorAll(selector);
    elements.forEach(el => {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
  });
  
  // Extract the title
  const title = document.title || '';
  
  // Extract metadata if available
  const metadata = extractMetadata();
  
  // Get all paragraphs and headings with substantial text
  const paragraphs = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
  const paragraphText = Array.from(paragraphs)
    .filter(p => p.textContent.trim().length > 20)
    .map(p => p.textContent.trim())
    .join('\n\n');
  
  // Combine everything with appropriate formatting
  let content = '';
  
  if (title) {
    content += `# ${title}\n\n`;
  }
  
  if (metadata.description) {
    content += `${metadata.description}\n\n`;
  }
  
  content += paragraphText;
  
  // If we still don't have enough content, use body as fallback
  if (content.length < 100) {
    content = cleanText(document.body.textContent);
  }
  
  return content;
}

/**
 * Extracts metadata from the page
 * @returns {Object} Object containing metadata
 */
function extractMetadata() {
  const metadata = {
    title: document.title || '',
    description: '',
    url: window.location.href
  };
  
  // Try to get description from meta tags
  const descriptionTag = document.querySelector('meta[name="description"]');
  if (descriptionTag) {
    metadata.description = descriptionTag.getAttribute('content') || '';
  }
  
  // Try Open Graph description as fallback
  if (!metadata.description) {
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      metadata.description = ogDescription.getAttribute('content') || '';
    }
  }
  
  return metadata;
}

/**
 * Cleans up extracted text
 * @param {string} text The text to clean
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')           // Replace multiple spaces with a single space
    .replace(/\n\s*\n/g, '\n\n')    // Replace multiple newlines with double newlines
    .replace(/[^\S\n]+/g, ' ')      // Replace whitespace except newlines with a single space
    .trim();                         // Remove leading/trailing whitespace
} 