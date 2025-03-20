/**
 * Page Inference - Content Script Entry Point
 * 
 * This script runs in the context of web pages and is responsible for:
 * 1. Initializing page scrapers based on the page type
 * 2. Setting up communication with the background script
 * 3. Handling user interactions on the page
 */

// Import scrapers
// import './scrapers/generic-scraper.js';
// import './scrapers/linkedin-scraper.js';
// import './scrapers/document-scraper.js';

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
  
  // This will be replaced with actual initialization logic
  // For now, just setting up a basic message listener
  
  // Listen for messages from the popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    // This will be replaced with more sophisticated handling
    // For now, just acknowledging receipt
    
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
}

// Start initialization
initialize(); 