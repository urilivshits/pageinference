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

// Generate a unique ID for this popup instance
const popupInstanceId = Date.now() + '-' + Math.random().toString(36).substring(2, 15);
console.log(`Popup instance ID: ${popupInstanceId}`);

// Store our ID in local storage to detect and close old popups
(async function checkAndCloseOldPopups() {
  try {
    // Get the current active popup ID
    const { activePopupId } = await chrome.storage.local.get('activePopupId');
    
    // If there's already an active popup, and it's not us, we should close
    if (activePopupId && activePopupId !== popupInstanceId) {
      console.log(`Another popup (${activePopupId}) is already active. This popup (${popupInstanceId}) will close.`);
      window.close();
      return; // Stop initialization
    }
    
    // Set ourselves as the active popup
    await chrome.storage.local.set({ activePopupId: popupInstanceId });
    console.log(`Set this popup (${popupInstanceId}) as the active popup`);
    
    // Clean up when this popup is closed
    window.addEventListener('unload', async () => {
      try {
        // Only clear if we're still the active popup
        const { activePopupId: currentActiveId } = await chrome.storage.local.get('activePopupId');
        if (currentActiveId === popupInstanceId) {
          await chrome.storage.local.remove('activePopupId');
          console.log(`Removed this popup (${popupInstanceId}) as the active popup`);
        }
      } catch (error) {
        console.error('Error during popup unload cleanup:', error);
      }
    });
  } catch (error) {
    console.error('Error checking for old popups:', error);
  }
})();

// Establish a connection with the background script for popup tracking
let backgroundConnection;
try {
  backgroundConnection = chrome.runtime.connect({ name: 'popup' });
  console.log('Connected to background script for popup tracking');
  
  // Send our instance ID to the background script
  backgroundConnection.postMessage({ 
    action: 'registerPopup', 
    popupId: popupInstanceId 
  });
  
  // Listen for messages from the background script
  backgroundConnection.onMessage.addListener((message) => {
    console.log('Received message from background script:', message);
    
    // If the background script tells us to close, do so
    if (message.action === 'closePopup') {
      console.log('Closing popup at background script request:', message.reason);
      window.close();
    }
  });
  
  // Handle disconnection
  backgroundConnection.onDisconnect.addListener(() => {
    console.log('Disconnected from background script');
    backgroundConnection = null;
  });
} catch (error) {
  console.error('Failed to connect to background script:', error);
}

// Also periodically check if we're still the active popup (in case storage-based approach fails)
const activePopupCheck = setInterval(async () => {
  try {
    const { activePopupId } = await chrome.storage.local.get('activePopupId');
    if (activePopupId !== popupInstanceId) {
      console.log(`No longer the active popup. Current active: ${activePopupId}, this popup: ${popupInstanceId}`);
      window.close();
    }
  } catch (error) {
    console.error('Error during active popup check:', error);
  }
}, 2000); // Check every 2 seconds

// Clear interval on unload
window.addEventListener('unload', () => {
  clearInterval(activePopupCheck);
  
  // Clean up background connection
  console.log('Popup window unloading, cleaning up connections');
  if (backgroundConnection) {
    try {
      backgroundConnection.disconnect();
    } catch (error) {
      console.error('Error disconnecting from background script:', error);
    }
  }
});

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

// Track initialization status
let popupInitialized = false;

/**
 * Early initialization function that runs immediately
 * Notifies background script as early as possible about popup opening
 */
(function earlyInitialize() {
  console.log('Performing early popup initialization');
  try {
    // Notify background script immediately that popup is open
    chrome.runtime.sendMessage({
      type: 'popupInitialized',
      action: 'popupInitialized',
      timestamp: Date.now()
    }, (response) => {
      console.log('Background acknowledged early popup initialization:', response);
    });
  } catch (error) {
    console.error('Error during early popup initialization:', error);
  }
})();

/**
 * Main initialization function for the popup
 */
function initializePopup() {
  if (popupInitialized) {
    console.warn('Popup already initialized, skipping');
    return;
  }
  
  console.log('Initializing popup');
  
  // Initialize all components
  chatComponent.initializeChatComponent();
  settingsComponent.initializeSettingsComponent();
  historyComponent.initializeHistoryComponent();
  controlsComponent.initializeControlsComponent();
  
  // Mark as initialized
  popupInitialized = true;
  
  console.log('Popup initialization complete');
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

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup DOMContentLoaded event fired');
  
  // Check if this is a first or second click within the fade-in period
  const popupContainer = document.querySelector('.popup-container');
  popupContainer.classList.add('popup-fade-in');
  
  // Check if there's a pending click timestamp in storage
  try {
    const { first_click_timestamp } = await chrome.storage.local.get('first_click_timestamp');
    const currentTime = Date.now();
    
    if (first_click_timestamp && (currentTime - first_click_timestamp < 1000)) {
      // This is a second click within the fade-in period
      console.log('Second click detected during fade-in, executing last input');
      
      // Remove the timestamp so we don't trigger on next popup open
      await chrome.storage.local.remove('first_click_timestamp');
      
      // Set flag to execute last input
      const { global_last_user_input } = await chrome.storage.local.get('global_last_user_input');
      
      if (global_last_user_input) {
        // Set up execute_last_input that the chat component will check
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length) {
          const currentTab = tabs[0];
          await chrome.storage.local.set({
            'execute_last_input': {
              input: global_last_user_input,
              tabId: currentTab.id,
              url: currentTab.url,
              timestamp: currentTime
            }
          });
        }
      }
    } else {
      // This is the first click, store the timestamp
      await chrome.storage.local.set({ 'first_click_timestamp': currentTime });
      
      // After the fade-in period, clear the timestamp if not used
      setTimeout(async () => {
        await chrome.storage.local.remove('first_click_timestamp');
      }, 1000);
    }
  } catch (error) {
    console.error('Error checking click state:', error);
  }
  
  // Continue with normal initialization
  initializePopup();
});

// Also try to initialize immediately if document is already complete
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log('Document already ready, initializing popup immediately');
  initializePopup();
} 