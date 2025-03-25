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
        const pageContent = getPageContent();
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