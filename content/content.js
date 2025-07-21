/**
 * Page Inference - Content Script Entry Point
 * 
 * This script runs in the context of web pages and is responsible for:
 * 1. Initializing page scrapers based on the page type
 * 2. Setting up communication with the background script
 * 3. Handling user interactions on the page
 */

// Initialize Chrome Store compliant console override FIRST
import '../shared/utils/console-override.js';

// Import scrapers and logger
import { scrapeCurrentPage } from './scrapers/index.js';
import logger from '../shared/utils/logger.js';

// Track initialization status
window.__pageInferenceInitialized = false;

// Safe messaging functions for content script compatibility
function isExtensionContextValid() {
  try {
    return !!(chrome.runtime && chrome.runtime.id);
  } catch (error) {
    return false;
  }
}

// Safe wrapper for chrome.runtime.getManifest() calls
function safeGetManifest() {
  try {
    return chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest() : null;
  } catch (error) {
    return null;
  }
}

// Safe wrapper for sendResponse calls
function safeSendResponse(sendResponse, data) {
  try {
    if (isExtensionContextValid()) {
      sendResponse(data);
      return true;
    }
    return false;
  } catch (error) {
    // Silently handle sendResponse errors to prevent Chrome Store issues
    const manifest = safeGetManifest();
    const isDevMode = manifest && !manifest.update_url;
    if (isDevMode) {
      console.warn('[Extension] sendResponse error (dev mode):', error);
    }
    return false;
  }
}

function safeSendMessage(message, callback = null, options = {}) {
  if (!isExtensionContextValid()) {
    if (options.logInDev !== false) {
      const manifest = safeGetManifest();
      const isDevMode = manifest && !manifest.update_url;
      if (isDevMode) {
        console.warn('[Extension] Context invalidated, message not sent:', message);
      }
    }
    return false;
  }

  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError.message;
        const silentErrors = [
          'Extension context invalidated',
          'Could not establish connection',
          'Receiving end does not exist',
          'The message port closed before a response was received'
        ];
        
        const isSilentError = silentErrors.some(silentError => 
          error.includes(silentError)
        );
        
        if (isSilentError) {
          const manifest = safeGetManifest();
          const isDevMode = manifest && !manifest.update_url;
          if (isDevMode && options.logInDev !== false) {
            console.warn('[Extension] Communication error (dev mode):', error);
          }
        } else {
          console.error('[Extension] Unexpected runtime error:', error);
        }
        
        if (callback) {
          callback({ error: error, success: false });
        }
      } else {
        if (callback) {
          callback(response || { success: true });
        }
      }
    });
    return true;
  } catch (error) {
    const manifest = safeGetManifest();
    const isDevMode = manifest && !manifest.update_url;
    if (isDevMode && options.logInDev !== false) {
      console.error('[Extension] Error sending message:', error);
    }
    return false;
  }
}

// Initialize the content script
function initialize() {
  // Only initialize once
  if (window.__pageInferenceInitialized) {
    logger.debug('Content script already initialized, skipping re-initialization');
    console.log('[Page Inference] Content script already initialized, skipping re-initialization');
    return;
  }
  
  logger.init(`Initializing content script on ${window.location.href}`);
  console.log(`[Page Inference] INIT: Starting content script initialization on ${window.location.href}`);
  
  // Set up message listener immediately to handle early requests
  setupMessageListener();
  
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

// Set up message listener for communication with background script
function setupMessageListener() {
  try {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('[Page Inference] CONTENT: Received message:', request);
      logger.debug(`Received message: ${request.action}`);
      
      // Handle content scraping request
      if (request.action === 'scrapeContent') {
        console.log('[Page Inference] CONTENT: Processing scrapeContent request');
        logger.debug('Scraping page content');
        try {
          const pageContent = scrapeCurrentPage();
          console.log(`[Page Inference] CONTENT: Scraped ${pageContent.length} characters`);
          logger.debug(`Scraped content length: ${pageContent.length} characters`);
          safeSendResponse(sendResponse, { content: pageContent });
          console.log('[Page Inference] CONTENT: Sent response with content');
        } catch (error) {
          console.error('[Page Inference] CONTENT: Error during scraping:', error);
          logger.error('Error during content scraping:', error);
          safeSendResponse(sendResponse, { 
            error: 'Error scraping content: ' + error.message,
            content: `Error extracting content from ${window.location.href}. ${error.message}`
          });
        }
        return true; // Keep the message channel open for async responses
      }
      
      // Handle ping to check if content script is initialized
      if (request.action === 'ping') {
        safeSendResponse(sendResponse, { pong: true, initialized: true });
        return true;
      }
      
      // Fallback for unhandled messages
      safeSendResponse(sendResponse, { success: true, message: 'Message received by content script' });
      return true; // Keep the message channel open for async responses
    });
  } catch (error) {
    // Silently handle chrome.runtime.onMessage.addListener errors to prevent Chrome Store issues
    const manifest = safeGetManifest();
    const isDevMode = manifest && !manifest.update_url;
    if (isDevMode) {
      console.warn('[Extension] Failed to add message listener (dev mode):', error);
    }
  }
}

// Set up the content script functionality
function setupContentScript() {
  if (window.__pageInferenceInitialized) {
    console.log('[Page Inference] SETUP: Already initialized, skipping setup');
    return;
  }
  
  console.log('[Page Inference] SETUP: Starting content script functionality setup');

  window.__pageInferenceInitialized = true;
  logger.success('Content script initialized successfully');
  console.log('[Page Inference] SETUP: Content script core setup completed - starting ctrl key detection');
  
  // Set up keyboard event listeners (for Ctrl key state)
  setupKeyListeners();
  
  // Broadcast initialization status to ensure background script knows we're ready
  console.log('[Page Inference] SETUP: Sending initialization confirmation to background');
  try {
      safeSendMessage({ 
    type: 'contentScriptInitialized',
    action: 'contentScriptInitialized',
    url: window.location.href,
    timestamp: Date.now()
  }, (response) => {
    // Silent handling of chrome.runtime.lastError to prevent extension errors page spam
    if (chrome.runtime.lastError) {
      // Only log in development mode (when extension is unpacked)
      const manifest = safeGetManifest();
      const isDevMode = manifest && !manifest.update_url;
      if (isDevMode) {
        console.error('[Page Inference] Error sending initialization confirmation:', chrome.runtime.lastError.message);
      }
    } else {
      console.log('[Page Inference] COMPLETE: Sent initialization confirmation to background, response:', response);
    }
  });
    logger.debug('Sent initialization confirmation to background');
  } catch (e) {
    logger.warn('Failed to send initialization confirmation:', e);
    console.error('[Page Inference] Failed to send initialization confirmation:', e);
  }
  
  console.log('[Page Inference] COMPLETE: Content script initialized successfully - ctrl key detection active');
}

/**
 * Set up keyboard event listeners to track key states
 */
function setupKeyListeners() {
  console.log('[Page Inference] SETUP: Setting up keyboard event listeners for ctrl detection');
  let ctrlKeyPressed = false;
  let keyEventTimeout = null;
  let currentTabId = null;

  // Get current tab ID first
  console.log('[Page Inference] SETUP: Requesting tab ID from background');
  safeSendMessage({ action: 'getTabId' }, (response) => {
    if (response && response.error) {
      console.error('[Page Inference] Error getting tab ID:', response.error);
      // Try to continue without tab ID
      currentTabId = null;
    } else if (response && response.tabId) {
      currentTabId = response.tabId;
      logger.debug(`Content script initialized for tab ${currentTabId}`);
      console.log(`[Page Inference] Content script initialized for tab ${currentTabId}`);
    } else {
      console.error('[Page Inference] Failed to get tab ID for content script - no response or no tabId in response');
      currentTabId = null;
    }
  });

  // Function to send Ctrl key state with less delay when pressed
  function sendCtrlKeyState(isPressed) {
    clearTimeout(keyEventTimeout);
    
    // Use zero delay when pressing (true) but short delay when releasing (false)
    const delay = isPressed ? 0 : 10;
    
    keyEventTimeout = setTimeout(() => {
      console.log(`[Page Inference] Sending Ctrl key state: ${isPressed ? 'pressed' : 'released'} for tab ${currentTabId}`);
      
      const message = { 
        action: 'ctrlKeyState', 
        isPressed: isPressed,
        tabId: currentTabId // Include tab ID for better tracking
      };
      
      safeSendMessage(message, (response) => {
        if (response && response.error) {
          // Error handled by safeSendMessage utility
          const manifest = safeGetManifest();
          const isDevMode = manifest && !manifest.update_url;
          if (isDevMode) {
            console.error('[Page Inference] Error sending ctrl key state:', response.error);
          }
        } else {
          logger.ctrl(`Sent Ctrl key state: ${isPressed ? 'pressed' : 'released'} for tab ${currentTabId}`);
          console.log(`[Page Inference] Background response:`, response);
        }
      });
    }, delay);
  }

  console.log('[Page Inference] SETUP: Adding keydown and keyup event listeners');
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Control') {
      console.log('[Page Inference] Ctrl key DOWN detected in content script');
      if (!ctrlKeyPressed) {
        ctrlKeyPressed = true;
        // Send immediate message when Ctrl is pressed
        sendCtrlKeyState(true);
      }
    }
  });

  document.addEventListener('keyup', function(event) {
    if (event.key === 'Control') {
      console.log('[Page Inference] Ctrl key UP detected in content script');
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
        safeSendMessage({ 
          action: 'ctrlKeyState', 
          isPressed: false 
        }, (response) => {
          logger.ctrl('Reset Ctrl key state on window blur');
        });
      }, 500); // Longer delay on blur
    }
  });

  // Send initial state
  console.log('[Page Inference] SETUP: Sending initial ctrl state (false) to background');
  safeSendMessage({ 
    action: 'ctrlKeyState', 
    isPressed: false 
  });
  
  logger.debug('Keyboard event listeners initialized');
  console.log('[Page Inference] SETUP: Keyboard event listeners setup completed');
}

// Start initialization
console.log('[Page Inference] STARTUP: Content script file loaded, starting initialization');
initialize();

// Add a failsafe initialization for slow loading pages
setTimeout(() => {
  if (!window.__pageInferenceInitialized) {
    logger.debug('Triggering delayed initialization');
    initialize();
  }
}, 1500); 