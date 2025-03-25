/**
 * Page Inference - Content Script Entry Point (Refactored Version)
 * 
 * This script runs in the context of web pages and is responsible for:
 * 1. Initializing page scrapers based on the page type
 * 2. Setting up communication with the background script
 * 3. Handling user interactions on the page
 */

// Store scraper functionality
let scraperModule = null;
let scrapeCurrentPage = null;

// Track initialization status
window.__pageInferenceInitialized = false;

// Initialize the content script
async function initialize() {
  // Only initialize once
  if (window.__pageInferenceInitialized) {
    console.log('Content script already initialized, skipping re-initialization');
    return;
  }
  
  console.log(`Initializing content script on ${window.location.href}, document state: ${document.readyState}`);
  
  // Load the refactored scrapers
  try {
    console.log('Loading refactored scrapers...');
    scraperModule = await import(chrome.runtime.getURL('./content/scrapers/index.js'));
    scrapeCurrentPage = scraperModule.scrapeCurrentPage;
    console.log('Refactored scrapers loaded successfully');
  } catch (error) {
    console.error('Failed to load refactored scrapers:', error);
    return;
  }
  
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
  if (window.__pageInferenceInitialized || !scrapeCurrentPage) return;
  
  // Listen for messages from the popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    // Handle content scraping request
    if (request.action === 'scrapeContent') {
      console.log('Scraping page content using refactored scrapers...');
      try {
        const pageContent = scrapeCurrentPage();
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
  console.log('Page Inference content script (refactored) initialized successfully');
  
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