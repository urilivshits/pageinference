/**
 * Page Inference - Popup Entry Point
 * 
 * This is the main entry point for the popup UI.
 * It imports and initializes components from the component directory.
 */

// Prevent multiple initializations with a global flag
if (window.popupJsInitialized) {
  console.error('===== DUPLICATE INITIALIZATION DETECTED: popup.js already initialized! =====');
} else {
  window.popupJsInitialized = true;
  console.log('===== FIRST INITIALIZATION OF POPUP.JS =====');
}

// Log information about scripts for debugging
console.log('Currently loaded scripts:', Array.from(document.scripts).map(s => s.src || 'inline script'));

// Add handler to detect potential DOM changes that might cause multiple script loading
if (window.MutationObserver) {
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        const addedScripts = Array.from(mutation.addedNodes).filter(node => 
          node.tagName === 'SCRIPT' && (node.src && node.src.includes('popup.js'))
        );
        if (addedScripts.length > 0) {
          console.error('===== POPUP.JS ADDED AGAIN TO DOM! =====', addedScripts);
        }
      }
    }
  });
  
  // Start observing once the DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }, { once: true }); // Use once:true to ensure this runs only once
}

// Import components
import chatComponent from './components/chat.js';
import settingsComponent from './components/settings.js';
import historyComponent from './components/history.js';
import controlsComponent from './components/controls.js';

// This is a self-executing function that runs immediately to set up persistent state
// before any DOMContentLoaded events occur
(async function setupPersistentState() {
  console.log('INIT: Early initialization running before DOM is ready');
  try {
    // Get current tab (this will work even before DOM is loaded)
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      // Get basic tab information
      const tabId = tabs[0].id;
      const url = tabs[0].url;
      const tabStorageKey = `page_load_${tabId}_${url}`;
      
      console.log('INIT: Early tab detection:', tabId, url);
      
      // Check for existing page load ID - we just want to ensure it exists
      // but won't process it yet (that happens in DOMContentLoaded)
      const { [tabStorageKey]: existingTabPageLoadId } = await chrome.storage.local.get(tabStorageKey);
      
      if (existingTabPageLoadId) {
        console.log('INIT: Found existing page load ID early:', existingTabPageLoadId);
      } else {
        console.log('INIT: No existing page load ID found during early initialization');
      }
    } else {
      console.warn('INIT: No active tab found during early initialization');
    }
  } catch (error) {
    console.error('INIT: Error during early initialization:', error);
  }
})();

/**
 * Main initialization function for the popup
 */
async function initializePopup() {
  console.log('Initializing popup...');
  
  try {
    // Initialize UI components
    console.log('Initializing UI components...');
    
    // Controls must be initialized first (tabs, buttons)
    controlsComponent.initializeControlsComponent();
    
    // Initialize other components
    chatComponent.initializeChatComponent();
    settingsComponent.initializeSettingsComponent();
    historyComponent.initializeHistoryComponent();
    
    // Log successful initialization
    console.log('Popup components initialized successfully');
    
    // Listen for custom events between components
    setupComponentCommunication();
    
    // Check for API key
    await checkApiKey();
  } catch (error) {
    console.error('Error initializing popup:', error);
    document.body.innerHTML = `
      <div class="error-message">
        <h2>Initialization Error</h2>
        <p>${error.message}</p>
        <button onclick="window.close()">Close</button>
      </div>
    `;
  }
}

/**
 * Set up communication between components
 */
function setupComponentCommunication() {
  // When a session is selected in history, notify chat component
  window.addEventListener('open-session', (event) => {
    const session = event.detail;
    console.log('Open session event received:', session);
    
    // Switch to chat tab
    document.getElementById('chat-tab').click();
    
    // Dispatch event for chat component
    window.dispatchEvent(new CustomEvent('show-session', {
      detail: {
        pageLoadId: session.pageLoadId,
        url: session.url,
        title: session.title
      }
    }));
  });
  
  // When settings are changed, notify other components
  window.addEventListener('settings-changed', (event) => {
    const { settings } = event.detail;
    console.log('Settings changed event received:', settings);
    
    // Apply theme changes immediately
    if (settings.theme) {
      document.body.setAttribute('data-theme', settings.theme);
    }
    
    // Notify chat component of relevant changes
    if (settings.defaultModel || settings.temperature || settings.webSearch || settings.pageScraping) {
      window.dispatchEvent(new CustomEvent('chat-settings-changed', {
        detail: { settings }
      }));
    }
  });
  
  // When chat session is updated, notify history component
  window.addEventListener('chat-session-updated', (event) => {
    const { session } = event.detail;
    console.log('Chat session updated:', session);
    
    // Notify history component to refresh
    window.dispatchEvent(new CustomEvent('session-updated', {
      detail: { session }
    }));
  });
}

/**
 * Check if API key is set, show appropriate UI if not
 */
async function checkApiKey() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'get_api_key'
    });
    
    const hasApiKey = response.success && response.data;
    
    if (!hasApiKey) {
      // Show API key notice and switch to settings tab
      console.log('No API key found, showing settings tab');
      document.getElementById('settings-tab').click();
      
      // Show API key notice
      const notice = document.createElement('div');
      notice.classList.add('api-key-notice');
      notice.innerHTML = `
        <p>Please enter your OpenAI API key to use the extension.</p>
        <p>You can get an API key from <a href="https://platform.openai.com/account/api-keys" target="_blank">OpenAI's website</a>.</p>
      `;
      
      const apiKeyInput = document.getElementById('api-key-input');
      if (apiKeyInput) {
        apiKeyInput.parentNode.insertBefore(notice, apiKeyInput);
        apiKeyInput.focus();
      }
    }
  } catch (error) {
    console.error('Error checking API key:', error);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePopup); 