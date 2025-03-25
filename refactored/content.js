/**
 * Page Inference - Content Script
 * 
 * This script runs in the context of web pages and is responsible for:
 * 1. Scraping page content
 * 2. Setting up communication with the background script
 * 3. Handling user interactions on the page
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
  
  console.log(`Initializing content script on ${window.location.href}, document state: ${document.readyState}`);
  
  // If document isn't ready yet, wait for it
  if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
    console.log('Document not ready, waiting for DOMContentLoaded event');
    document.addEventListener('DOMContentLoaded', setupContentScript);
    // Also set a timeout as a fallback
    setTimeout(() => {
      if (!window.__pageInferenceInitialized) {
        console.log('Timeout reached, forcing initialization');
        setupContentScript();
      }
    }, 1000);
  } else {
    // Document is ready, initialize now
    console.log('Document ready, initializing immediately');
    setupContentScript();
  }
}

// Set up the content script functionality
function setupContentScript() {
  if (window.__pageInferenceInitialized) return;
  
  // Listen for messages from the popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    // Handle content scraping request
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
      return true; // Keep the message channel open for async responses
    }
    
    // Handle ping to check if content script is initialized
    if (request.action === 'ping') {
      sendResponse({ success: true, initialized: true });
      return true;
    }
    
    // Fallback for unhandled messages
    sendResponse({ success: true, message: 'Message received by content script' });
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
  
  // Set up keyboard event listeners (for Ctrl key state)
  setupKeyListeners();
}

/**
 * Main function to scrape page content
 * Delegates to specialized scrapers based on the website
 * 
 * @returns {string} - The scraped page content
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
  return getPageContent();
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
 * Get the content of the current page
 * 
 * @returns {string} - The page content text
 */
function getPageContent() {
  try {
    // Get body element or fallback to document
    const bodyEl = document.body || document.documentElement;
    
    if (!bodyEl) {
      console.warn('Could not find body element, returning empty content');
      return '';
    }
    
    // Get all visible text nodes
    console.log('Extracting visible text from page...');
    const textContent = getVisibleText(bodyEl);
    
    // Return the text content with a reasonable size limit
    const result = textContent.substring(0, 100000);
    console.log(`Extracted ${result.length} characters of content`);
    return result;
  } catch (error) {
    console.error('Error extracting page content:', error);
    return `Error extracting content from ${window.location.href}. ${error.message}`;
  }
}

/**
 * Get visible text from an element and its children
 * 
 * @param {Element|Node} element - The root element to start from
 * @returns {string} - The visible text content
 */
function getVisibleText(element) {
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
  } catch (error) {
    console.warn('Error processing element children:', error);
  }
  
  return text;
}

/**
 * Check if an element is hidden or has zero dimensions
 * 
 * @param {Element} element - The element to check
 * @returns {boolean} - Whether the element is hidden
 */
function isElementHidden(element) {
  // Check if element is valid and is an Element node
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  
  try {
    const style = window.getComputedStyle(element);
    return (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      element.offsetWidth === 0 ||
      element.offsetHeight === 0
    );
  } catch (error) {
    console.warn('Error checking if element is hidden:', error);
    return false;
  }
}

/**
 * Check if an element is a block-level element
 * 
 * @param {Element} element - The element to check
 * @returns {boolean} - Whether the element is block-level
 */
function isBlockElement(element) {
  // Check if element is valid and is an Element node
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  
  try {
    const style = window.getComputedStyle(element);
    return style.display === 'block' || 
           style.display === 'flex' || 
           style.display === 'grid' || 
           element.tagName?.toLowerCase() === 'br';
  } catch (error) {
    console.warn('Error checking if element is block:', error);
    return false;
  }
}

/**
 * Set up keyboard event listeners to track key states
 */
function setupKeyListeners() {
  let ctrlKeyPressed = false;
  let keyEventTimeout = null;

  // Function to send Ctrl key state with less delay when pressed
  function sendCtrlKeyState(isPressed) {
    clearTimeout(keyEventTimeout);
    
    // Use zero delay when pressing (true) but short delay when releasing (false)
    const delay = isPressed ? 0 : 10;
    
    keyEventTimeout = setTimeout(() => {
      chrome.runtime.sendMessage({ 
        action: 'ctrlKeyState', 
        isPressed: isPressed 
      }, (response) => {
        console.log(`Content script sent Ctrl key=${isPressed}, response:`, response);
      });
    }, delay);
  }

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Control') {
      if (!ctrlKeyPressed) {
        ctrlKeyPressed = true;
        // Send immediate message when Ctrl is pressed
        sendCtrlKeyState(true);
      }
    }
  });

  document.addEventListener('keyup', function(event) {
    if (event.key === 'Control') {
      ctrlKeyPressed = false;
      // Send slightly delayed message when Ctrl is released
      sendCtrlKeyState(false);
    }
  });

  // Hold state longer on window blur to give enough time for click to process
  window.addEventListener('blur', function() {
    if (ctrlKeyPressed) {
      // Wait longer before resetting on blur to ensure click completes
      setTimeout(() => {
        ctrlKeyPressed = false;
        chrome.runtime.sendMessage({ 
          action: 'ctrlKeyState', 
          isPressed: false 
        }, (response) => {
          console.log('Content script sent Ctrl key reset on blur, response:', response);
        });
      }, 500); // Longer delay on blur
    }
  });

  // Send initial state
  chrome.runtime.sendMessage({ 
    action: 'ctrlKeyState', 
    isPressed: false 
  });
}

// Start initialization
initialize();

// Add a failsafe initialization for slow loading pages
setTimeout(() => {
  if (!window.__pageInferenceInitialized) {
    console.log('Delayed initialization triggered');
    initialize();
  } else {
    console.log('Delayed initialization not needed, already initialized');
  }
}, 1500);

// For LinkedIn pages, try additional initialization attempts
// LinkedIn can be slow to fully load all content
if (isLinkedIn) {
  console.log('Setting up additional initialization attempts for LinkedIn');
  
  // Add more retry attempts with increasing delays
  [3000, 5000, 7000].forEach(delay => {
    setTimeout(() => {
      if (window.__pageInferenceInitialized) {
        // Even if initialized, send a re-scrape signal to ensure all content loaded
        console.log(`LinkedIn re-initialization check at ${delay}ms, already initialized, checking if new content loaded`);
        
        // Send a notification that content might have updated
        try {
          chrome.runtime.sendMessage({
            type: 'linkedinContentUpdated',
            action: 'linkedinContentUpdated',
            url: window.location.href,
            timestamp: Date.now()
          });
        } catch (e) {
          console.warn('Failed to send LinkedIn content update notification:', e);
        }
      } else {
        console.log(`LinkedIn delayed initialization at ${delay}ms triggered`);
        initialize();
      }
    }, delay);
  });
} 