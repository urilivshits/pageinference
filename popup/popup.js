/**
 * Page Inference - Popup Entry Point
 * 
 * This is the main entry point for the popup UI.
 * It imports and initializes components from the component directory.
 */

// Import components
// import './components/chat.js';
// import './components/settings.js';
// import './components/history.js';
// import './components/controls.js';

// Prevent multiple initializations with a global flag
if (window.popupJsInitialized) {
  console.error('===== DUPLICATE INITIALIZATION DETECTED: popup.js already initialized! =====');
} else {
  window.popupJsInitialized = true;
  console.log('===== POPUP.JS INITIALIZATION =====');
}

/**
 * Main initialization function for the popup
 */
async function initializePopup() {
  console.log('Initializing popup...');
  
  // This will be replaced with component initialization
  // For now, just logging to confirm the file is being loaded
  console.log('Popup entry point loaded successfully');
  
  // In the next phase, we'll implement:
  // 1. Initialize UI components
  // 2. Set up event listeners
  // 3. Load saved state
  // 4. Connect to background script
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePopup); 