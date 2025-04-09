/**
 * Page Inference - Content Script Entry Point
 * 
 * This script runs in the context of web pages and is responsible for:
 * 1. Initializing page scrapers based on the page type
 * 2. Setting up communication with the background script
 * 3. Handling user interactions on the page
 */

// Import scrapers and logger
import { scrapeCurrentPage } from './scrapers/index.js';
import logger from '../shared/utils/logger.js';

// Track initialization status
window.__pageInferenceInitialized = false;

// Initialize the content script
function initialize() {
  // Only initialize once
  if (window.__pageInferenceInitialized) {
    logger.debug('Content script already initialized, skipping re-initialization');
    return;
  }
  
  logger.init(`Initializing content script on ${window.location.href}`);
  
  // If document isn't ready yet, wait for it
  if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
    logger.debug('Document not ready, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', setupContentScript);
    // Also set a timeout as a fallback
    setTimeout(() => {
      if (!window.__pageInferenceInitialized) {
        logger.debug('Timeout reached, forcing initialization');
        setupContentScript();
      }
    }, 1000);
  } else {
    // Document is ready, initialize now
    logger.debug('Document ready, initializing immediately');
    setupContentScript();
  }
}

// Set up the content script functionality
function setupContentScript() {
  if (window.__pageInferenceInitialized) return;
  
  // Listen for messages from the popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    logger.debug(`Received message: ${request.action}`);
    
    // Handle content scraping request
    if (request.action === 'scrapeContent') {
      logger.debug('Scraping page content');
      try {
        const pageContent = scrapeCurrentPage();
        logger.debug(`Scraped content length: ${pageContent.length} characters`);
        sendResponse({ content: pageContent });
      } catch (error) {
        logger.error('Error during content scraping:', error);
        sendResponse({ 
          error: 'Error scraping content: ' + error.message,
          content: `Error extracting content from ${window.location.href}. ${error.message}`
        });
      }
      return true; // Keep the message channel open for async responses
    }
    
    // Handle ping to check if content script is initialized
    if (request.action === 'ping') {
      sendResponse({ pong: true, initialized: true });
      return true;
    }
    
    // Fallback for unhandled messages
    sendResponse({ success: true, message: 'Message received by content script' });
    return true; // Keep the message channel open for async responses
  });

  window.__pageInferenceInitialized = true;
  logger.success('Content script initialized successfully');
  
  // Broadcast initialization status to ensure background script knows we're ready
  try {
    chrome.runtime.sendMessage({ 
      type: 'contentScriptInitialized',
      action: 'contentScriptInitialized',
      url: window.location.href,
      timestamp: Date.now()
    });
    logger.debug('Sent initialization confirmation to background');
  } catch (e) {
    logger.warn('Failed to send initialization confirmation:', e);
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
        logger.ctrl(`Sent Ctrl key state: ${isPressed ? 'pressed' : 'released'}`);
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
          logger.ctrl('Reset Ctrl key state on window blur');
        });
      }, 500); // Longer delay on blur
    }
  });

  // Send initial state
  chrome.runtime.sendMessage({ 
    action: 'ctrlKeyState', 
    isPressed: false 
  });
  
  logger.debug('Keyboard event listeners initialized');
}

// Start initialization
initialize();

// Add a failsafe initialization for slow loading pages
setTimeout(() => {
  if (!window.__pageInferenceInitialized) {
    logger.debug('Triggering delayed initialization');
    initialize();
  }
}, 1500); 