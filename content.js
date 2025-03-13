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

// Check if we're on LinkedIn
const isLinkedIn = window.location.hostname.includes('linkedin.com');
console.log(`Content script loaded on ${isLinkedIn ? 'LinkedIn' : 'standard'} page: ${window.location.href}`);

// Initialize the content script
function initialize() {
  // Only initialize once
  if (window.__pageInferenceInitialized) {
    console.log('Content script already initialized, skipping re-initialization');
    return;
  }
  
  console.log(`Initializing content script, document state: ${document.readyState}`);
  
  // If document isn't ready yet, wait for it
  if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
    console.log('Document not ready, waiting for DOMContentLoaded event');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('DOMContentLoaded fired, initializing content script');
      setupMessageListener();
    });
    // Also set a timeout as a fallback
    setTimeout(() => {
      if (!window.__pageInferenceInitialized) {
        console.log('Timeout reached, forcing initialization');
        setupMessageListener();
      }
    }, 1000);
  } else {
    // Document is ready, initialize now
    console.log('Document ready, initializing immediately');
    setupMessageListener();
  }
}

// Set up the message listener
function setupMessageListener() {
  // Only set up once
  if (window.__pageInferenceInitialized) return;
  
  // Listen for messages from the popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    if (request.action === 'scrapeContent') {
      console.log('Scraping page content...');
      try {
        const pageContent = scrapePageContent();
        console.log('Scraped content length:', pageContent.length);
        sendResponse({ content: pageContent });
        console.log('Sent response with content');
      } catch (error) {
        console.error('Error during content scraping:', error);
        sendResponse({ 
          error: 'Error scraping content: ' + error.message,
          content: `Error extracting content from ${window.location.href}. ${error.message}`
        });
      }
    }
    return true; // Keep the message channel open for async responses
  });

  window.__pageInferenceInitialized = true;
  console.log('Page Inference content script initialized successfully');
  
  // Broadcast initialization status to ensure background script knows we're ready
  try {
    chrome.runtime.sendMessage({ 
      type: 'contentScriptInitialized',
      action: 'contentScriptInitialized',
      url: window.location.href,
      timestamp: Date.now()
    });
    console.log('Sent initialization confirmation to background script');
  } catch (e) {
    console.warn('Failed to send initialization confirmation:', e);
  }
}

// Initialize immediately
initialize();

// Add a failsafe initialization in case the page takes longer to load
if (isLinkedIn) {
  console.log('Setting up additional initialization attempts for LinkedIn');
  // Try again after a delay specifically for LinkedIn which can be slow to fully load
  setTimeout(() => {
    if (!window.__pageInferenceInitialized) {
      console.log('LinkedIn delayed initialization triggered');
      initialize();
    } else {
      console.log('LinkedIn delayed initialization not needed, already initialized');
    }
  }, 1500);
}

/**
 * Specialized function to scrape LinkedIn profile pages
 * @returns {string} Extracted LinkedIn profile information
 */
function scrapeLinkedInProfile() {
  console.log('===== LINKEDIN SCRAPER: Starting specialized LinkedIn profile scraper =====');
  console.log('LINKEDIN SCRAPER: URL being scraped:', window.location.href);
  console.log('LINKEDIN SCRAPER: Document title:', document.title);
  
  // Log the available selectors for debugging
  const debugSelectors = {
    nameSelectors: document.querySelector('.pv-top-card-section__name') ? 'Found .pv-top-card-section__name' : 'Missing .pv-top-card-section__name',
    headingXLarge: document.querySelector('.text-heading-xlarge') ? 'Found .text-heading-xlarge' : 'Missing .text-heading-xlarge',
    h1Heading: document.querySelector('h1.text-heading-xlarge') ? 'Found h1.text-heading-xlarge' : 'Missing h1.text-heading-xlarge',
    lockupTitle: document.querySelector('.artdeco-entity-lockup__title') ? 'Found .artdeco-entity-lockup__title' : 'Missing .artdeco-entity-lockup__title',
    breakWords: document.querySelector('.break-words') ? 'Found .break-words' : 'Missing .break-words',
    profileCardName: document.querySelector('div[data-test-id="profile-card-name"]') ? 'Found div[data-test-id="profile-card-name"]' : 'Missing div[data-test-id="profile-card-name"]'
  };
  console.log('LINKEDIN SCRAPER: Debug selector status:', debugSelectors);
  
  // Extract profile name
  const nameElement = document.querySelector('.pv-top-card-section__name, .text-heading-xlarge, h1.text-heading-xlarge, .artdeco-entity-lockup__title, .break-words, div[data-test-id="profile-card-name"]');
  const name = nameElement ? nameElement.textContent.trim() : 'Unknown Profile Name';
  console.log('LINKEDIN SCRAPER: Found profile name:', name);
  
  // Extract headline
  const headlineElement = document.querySelector('.pv-top-card-section__headline, .text-body-medium, .artdeco-entity-lockup__subtitle, .pv-text-details__headline, .text-body-small');
  const headline = headlineElement ? headlineElement.textContent.trim() : '';
  console.log('LINKEDIN SCRAPER: Found headline:', headline);
  
  // Extract about section
  const aboutElements = document.querySelectorAll('.pv-about__summary-text, .display-flex.ph5.pv3 .display-flex.mt2, .pv-shared-text-with-see-more, section.summary div.core-section-container__content, div[data-test-id="about-section"] p');
  console.log('LINKEDIN SCRAPER: Found about elements:', aboutElements.length);
  const aboutSection = Array.from(aboutElements)
    .map(el => el.textContent.trim())
    .filter(text => text.length > 0)
    .join('\n\n');
  
  // Extract experience
  const experienceSection = extractLinkedInSection('Experience', [
    '#experience-section, .pv-profile-section.experience-section, section[id*="experience"], div[data-test-id="experience-section"], #experience',
    '.pv-entity__summary-info, .display-flex.flex-column.full-width, .pv-entity__position-info, .display-flex.align-items-center.mr1, .pv-text-details__right-panel, .pvs-list__outer-container .pvs-entity'
  ]);
  
  // Extract education
  const educationSection = extractLinkedInSection('Education', [
    '#education-section, .pv-profile-section.education-section, section[id*="education"], div[data-test-id="education-section"], #education',
    '.pv-entity__summary-info, .display-flex.flex-column.full-width, .pv-entity__degree-info, .pv-text-details__right-panel, .pvs-list__outer-container .pvs-entity'
  ]);
  
  // Extract skills
  const skillsSection = extractLinkedInSection('Skills', [
    '#skills-section, .pv-profile-section.pv-skill-categories-section, section[id*="skills"], div[data-test-id="skills-section"], #skills',
    '.pv-skill-category-entity__name, .pv-skill-category-entity__name-text, .mr1, .pv-text-details__right-panel, .pvs-list__outer-container .pvs-entity, span.pvs-skill-pill'
  ]);
  
  // Extract certifications
  const certificationsSection = extractLinkedInSection('Certifications', [
    '.pv-profile-section.certifications-section, section[id*="certifications"]',
    '.pv-certification-entity__summary-info, .display-flex.flex-column.full-width'
  ]);
  
  // Combine all sections
  const profileInfo = [
    `# ${name}`,
    headline,
    aboutSection ? `## About\n${aboutSection}` : '',
    experienceSection,
    educationSection,
    skillsSection,
    certificationsSection
  ].filter(section => section.length > 0).join('\n\n');
  
  console.log('LINKEDIN SCRAPER: Profile extraction complete. Content length:', profileInfo.length);
  console.log('LINKEDIN SCRAPER: Profile preview:', profileInfo.substring(0, 100) + '...');
  
  return profileInfo || `LinkedIn profile: ${name}${headline ? ' - ' + headline : ''}`;
}

/**
 * Helper function to extract sections from LinkedIn profiles
 * @param {string} sectionName The name of the section
 * @param {Array<string>} selectors Array of selectors to try
 * @returns {string} Formatted section text
 */
function extractLinkedInSection(sectionName, selectors) {
  try {
    // Try to find the section container
    let container = null;
    for (const selector of selectors[0].split(',')) {
      container = document.querySelector(selector.trim());
      if (container) break;
    }
    
    if (!container) {
      console.log(`LINKEDIN SCRAPER: No container found for section ${sectionName}`);
      return '';
    }
    
    // Find all items in the section
    let items = [];
    for (const selector of selectors[1].split(',')) {
      const elements = container.querySelectorAll(selector.trim());
      if (elements && elements.length > 0) {
        console.log(`LINKEDIN SCRAPER: Found ${elements.length} items in section ${sectionName} using selector ${selector.trim()}`);
        items = Array.from(elements).map(el => el.textContent.trim());
        break;
      }
    }
    
    // If no items found in the container, try searching document-wide as a fallback
    if (items.length === 0) {
      console.log(`LINKEDIN SCRAPER: No items found in container for section ${sectionName}, trying document-wide search`);
      for (const selector of selectors[1].split(',')) {
        const elements = document.querySelectorAll(selector.trim());
        if (elements && elements.length > 0) {
          console.log(`LINKEDIN SCRAPER: Found ${elements.length} items document-wide for section ${sectionName}`);
          items = Array.from(elements).map(el => el.textContent.trim());
          break;
        }
      }
    }
    
    if (items.length === 0) {
      console.log(`LINKEDIN SCRAPER: No items found for section ${sectionName}`);
      return '';
    }
    
    // Format the section
    return `## ${sectionName}\n${items.join('\n')}`;
  } catch (e) {
    console.warn(`Error extracting LinkedIn ${sectionName} section:`, e);
    return '';
  }
}

/**
 * Scrapes the main content from the current page
 * Uses a heuristic approach to find the most relevant text
 * @returns {string} The extracted text content
 */
function scrapePageContent() {
  console.log('Starting scrapePageContent function, URL:', window.location.href);
  console.log('isLinkedIn check:', isLinkedIn);
  
  // LinkedIn-specific scraping
  if (isLinkedIn) {
    console.log('Detected LinkedIn page, delegating to specialized LinkedIn scraper');
    return scrapeLinkedInProfile();
  }

  console.log('Using general page scraper');
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