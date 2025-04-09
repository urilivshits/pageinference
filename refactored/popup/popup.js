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

// Apply theme immediately, before anything else renders
(function applyThemeImmediately() {
  try {
    console.debug('Applying theme immediately on script load');
    
    // IMPORTANT: First make sure we don't have an old separate 'theme' key in storage
    // that might conflict with the proper 'userPreferences.theme'
    chrome.storage.local.remove('theme', () => {
      console.log('THEME DEBUG: Removed any direct "theme" key to avoid conflicts');
    });
    
    // Disable all transitions initially
    document.documentElement.classList.add('theme-transition-disabled');
    document.documentElement.classList.add('theme-loading');
    
    // 1. First check localStorage for immediate theme application
    const cachedTheme = localStorage.getItem('temp_theme_preference');
    console.log('THEME DEBUG: cachedTheme from localStorage:', cachedTheme);
    
    // Initial theme application based on localStorage or system preference
    let initialTheme = cachedTheme;
    
    // Ensure we only apply 'light' or 'dark', not 'system' or other values
    if (!initialTheme || initialTheme === 'system' || (initialTheme !== 'light' && initialTheme !== 'dark')) {
      // For system theme or no stored preference or invalid value, detect system theme
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      initialTheme = prefersDark ? 'dark' : 'light';
      console.log('THEME DEBUG: System preference detected as:', prefersDark ? 'dark' : 'light');
    }
    
    // Always apply an initial theme immediately to prevent flash
    console.debug(`Initial theme application: ${initialTheme}`);
    // Apply theme to HTML element instead of body
    document.documentElement.setAttribute('data-theme', initialTheme);
    
    // 2. Then check Chrome storage for the actual user preference
    chrome.storage.local.get('userPreferences', ({ userPreferences }) => {
      console.log('THEME DEBUG: userPreferences from Chrome storage:', userPreferences);
      
      // Default to system if no preference is set
      let themePreference = (userPreferences && userPreferences.theme) || 'system';
      let effectiveTheme;
      
      // For all preferences, make sure we resolve to either 'light' or 'dark'
      if (themePreference === 'light') {
        effectiveTheme = 'light';
      } else if (themePreference === 'dark') {
        effectiveTheme = 'dark';
      } else {
        // For 'system' or any invalid value, detect system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        effectiveTheme = prefersDark ? 'dark' : 'light';
        console.log('THEME DEBUG: "system" theme resolved to:', effectiveTheme);
      }
      
      // Only update DOM if the effective theme is different from what's already applied
      const currentTheme = document.documentElement.getAttribute('data-theme');
      console.log('THEME DEBUG: Current theme in DOM:', currentTheme, 'New effectiveTheme:', effectiveTheme);
      
      if (currentTheme !== effectiveTheme) {
        console.log('THEME DEBUG: Updating theme from', currentTheme, 'to', effectiveTheme);
        document.documentElement.setAttribute('data-theme', effectiveTheme);
      } else {
        console.log('THEME DEBUG: Theme already correct, no change needed');
      }
      
      // 3. Always update localStorage with the latest preference
      try {
        localStorage.setItem('temp_theme_preference', themePreference); // Store the preference, not the resolved theme
        console.log('THEME DEBUG: Updated localStorage theme preference to:', themePreference);
      } catch (e) {
        console.warn('Could not update cached theme in localStorage:', e);
      }
      
      // Add the ready class to signal theme is fully processed and re-enable transitions
      document.documentElement.classList.add('theme-ready');
      document.documentElement.classList.remove('theme-loading');
      
      // Re-enable transitions after a short delay
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transition-disabled');
      }, 100);
    });
    
    // Set up a listener for system theme changes
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeMediaQuery.addEventListener('change', (e) => {
      // Only apply if the theme is set to "system"
      chrome.storage.local.get('userPreferences', ({ userPreferences }) => {
        if (userPreferences?.theme === 'system') {
          const newTheme = e.matches ? 'dark' : 'light';
          console.debug(`System theme changed to: ${newTheme}`);
          document.documentElement.setAttribute('data-theme', newTheme);
        }
      });
    });
  } catch (error) {
    console.error('Error in immediate theme application:', error);
    // Fallback to system preference if all else fails
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const fallbackTheme = prefersDark ? 'dark' : 'light';
    console.log('THEME DEBUG: Error fallback to system theme:', fallbackTheme);
    document.documentElement.setAttribute('data-theme', fallbackTheme);
    
    // Re-enable transitions even if there was an error
    document.documentElement.classList.remove('theme-loading');
    document.documentElement.classList.add('theme-ready');
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition-disabled');
    }, 100);
  }
})();

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
 * Apply theme from user preferences
 */
async function applyThemeFromPreferences() {
  // Avoid multiple theme application attempts in rapid succession
  if (window.themeApplicationInProgress) {
    console.log('THEME DEBUG: Theme application already in progress, skipping duplicate call');
    return;
  }
  
  window.themeApplicationInProgress = true;
  
  try {
    console.log('THEME DEBUG: applyThemeFromPreferences called');
    
    // Get user preferences from Chrome storage
    const { userPreferences } = await chrome.storage.local.get('userPreferences');
    console.log('THEME DEBUG: userPreferences in applyThemeFromPreferences:', userPreferences);
    
    // Default to system theme if no preference is set
    const themePreference = (userPreferences && userPreferences.theme) || 'system';
    console.log('THEME DEBUG: Using theme from userPreferences:', themePreference);
    
    let effectiveTheme;
    
    // Ensure we only apply 'light' or 'dark', not 'system' or other values
    if (themePreference === 'light') {
      effectiveTheme = 'light';
    } else if (themePreference === 'dark') {
      effectiveTheme = 'dark';
    } else {
      // For 'system' or any invalid value, detect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = prefersDark ? 'dark' : 'light';
      console.log('THEME DEBUG: In applyThemeFromPreferences, "system" resolved to:', effectiveTheme);
    }
    
    // Check if theme already matches what's applied
    const currentTheme = document.documentElement.getAttribute('data-theme');
    console.log('THEME DEBUG: In applyThemeFromPreferences, current theme:', currentTheme, 'new theme:', effectiveTheme);
    
    if (currentTheme !== effectiveTheme) {
      console.log('THEME DEBUG: In applyThemeFromPreferences, updating theme from', currentTheme, 'to', effectiveTheme);
      document.documentElement.setAttribute('data-theme', effectiveTheme);
    } else {
      console.log('THEME DEBUG: In applyThemeFromPreferences, theme already correct, no change needed');
    }
    
    // Cache the theme preference in localStorage for immediate access next time
    try {
      localStorage.setItem('temp_theme_preference', themePreference); // Store the preference, not the resolved theme
      console.log('THEME DEBUG: In applyThemeFromPreferences, updated localStorage to:', themePreference);
    } catch (e) {
      console.warn('Could not cache theme in localStorage:', e);
    }
    
    // Add a CSS class to indicate theme is loaded
    document.documentElement.classList.add('theme-ready');
    document.documentElement.classList.remove('theme-loading');
  } catch (error) {
    console.error('Error applying theme from preferences:', error);
    // Fallback to system preference if all else fails
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const fallbackTheme = prefersDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', fallbackTheme);
    document.documentElement.classList.add('theme-ready');
    document.documentElement.classList.remove('theme-loading');
  } finally {
    // Reset the flag after a delay to prevent rapid calls but allow later calls
    setTimeout(() => {
      window.themeApplicationInProgress = false;
    }, 200);
  }
}

/**
 * Initialize all UI components and set up their communication
 */
async function initializeComponents() {
  console.debug('Initializing components...');
  
  // Initialize all UI components
  chatComponent.initializeChatComponent();
  settingsComponent.initializeSettingsComponent();
  historyComponent.initializeHistoryComponent();
  controlsComponent.initializeControlsComponent();
  
  // Assign chatComponent to window.chat for access from autoExecuteIfNeeded
  window.chat = chatComponent;
  console.debug('Assigned chat component to window.chat for auto-execution support');
  
  // Set up component communication
  setupComponentCommunication();
  
  console.debug('Components initialized successfully');
  return true;
}

/**
 * Main initialization function for the popup
 */
async function initializePopup() {
  try {
    console.debug('Initializing popup...');

    // Apply theme from user preferences
    await applyThemeFromPreferences();

    // Initialize the components
    await initializeComponents();

    // Check for Chrome storage errors
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      console.error('Chrome storage error:', lastError);
      // Handle error if needed
    }

    // Check if we have an API key
    const apiKeyExists = await checkApiKeyExists();
    if (!apiKeyExists) {
      console.debug('No API key exists, showing settings page');
      navigateToSettings();
    } else {
      console.debug('API key exists, proceeding with initialization');
      
      // Set focus on input after everything is properly initialized
      setTimeout(() => {
        const inputElement = document.getElementById('message-input');
        if (inputElement) {
          inputElement.focus();
        }
        
        // Only attempt auto-execution after popup is fully initialized and input is focused
        autoExecuteIfNeeded();
      }, 100);
    }
  } catch (error) {
    console.error('Error in popup initialization:', error);
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
      let effectiveTheme;
      
      // Ensure we only apply 'light' or 'dark', not 'system' or other values
      if (settings.theme === 'light') {
        effectiveTheme = 'light';
      } else if (settings.theme === 'dark') {
        effectiveTheme = 'dark';
      } else {
        // For 'system' or any invalid value, detect system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        effectiveTheme = prefersDark ? 'dark' : 'light';
        console.debug(`System theme detected as: ${effectiveTheme}`);
      }
      
      // Apply the theme to the HTML element
      document.documentElement.setAttribute('data-theme', effectiveTheme);
      
      // Cache the theme preference in localStorage
      try {
        localStorage.setItem('temp_theme_preference', settings.theme); // Store the preference, not the resolved theme
        console.log('THEME DEBUG: Updated localStorage theme preference to:', settings.theme);
      } catch (e) {
        console.warn('Could not cache theme in localStorage:', e);
      }
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
 * Check if API key exists in storage
 * This function is specifically used to determine if we should show settings on startup
 * @returns {Promise<boolean>} Whether API key exists
 */
async function checkApiKeyExists() {
  try {
    // Try getting the API key from background script
    const response = await chrome.runtime.sendMessage({
      type: 'get_api_key'
    });
    
    // Return true if we have a successful response with data
    return response.success && !!response.data;
  } catch (error) {
    console.error('Error checking if API key exists:', error);
    
    // Try direct storage access as fallback
    try {
      const result = await chrome.storage.local.get('openai_api_key');
      return !!result.openai_api_key;
    } catch (storageError) {
      console.error('Error accessing storage for API key check:', storageError);
      return false;
    }
  }
}

/**
 * Navigate to settings tab
 */
function navigateToSettings() {
  const settingsTab = document.getElementById('settings-tab');
  if (settingsTab) {
    settingsTab.click();
  }
}

/**
 * Auto-execute if needed based on user preferences and stored input
 */
async function autoExecuteIfNeeded() {
  try {
    console.debug('Running auto-execute checks...');
    
    // First get the current tab information
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tab?.id;
    const url = tab?.url;
    
    if (!tabId || !url) {
      console.debug('Could not get valid tab information for auto-execute, aborting');
      return;
    }
    
    console.debug('Current tab:', { tabId, url });
    
    // Check user preferences for auto-execute setting
    const { userPreferences } = await chrome.storage.local.get('userPreferences');
    const autoExecuteEnabled = userPreferences?.autoExecute !== false; // Default to true if not specified
    
    if (!autoExecuteEnabled) {
      console.debug('Auto-execute disabled in user preferences, aborting');
      return;
    }
    
    // Get the last user input that was saved
    const { global_last_user_input } = await chrome.storage.local.get('global_last_user_input');
    const userInput = global_last_user_input;
    
    if (!userInput || !userInput.trim()) {
      console.debug('No valid user input found for auto-execution, aborting');
      return;
    }
    
    console.debug('Found potential input for auto-execution:', userInput.substring(0, 30) + (userInput.length > 30 ? '...' : ''));
    
    // Check if Ctrl key is pressed by asking the background script
    const ctrlCheckResponse = await chrome.runtime.sendMessage({ 
      action: 'check_ctrl_key', 
      tabId: tabId
    });
    
    const ctrlKeyPressed = ctrlCheckResponse && ctrlCheckResponse.ctrlKeyPressed;
    console.debug('Ctrl key state from background script:', ctrlKeyPressed);
    
    // If the Ctrl key is not pressed, auto-execute the command
    if (!ctrlKeyPressed) {
      console.debug('Auto-executing command, Ctrl key not pressed');
      
      // Set the input in the chat component
      const messageInput = document.getElementById('message-input');
      if (messageInput) {
        messageInput.value = userInput;
      } else {
        console.error('Message input element not found');
        return;
      }
      
      // More robust approach to execute with a retry mechanism
      // with proper validation of the chat module
      let retryCount = 0;
      const maxRetries = 5; // Increased from 3 to 5 for more retries
      const retryInterval = 200; // 200ms between retries
      const maxWaitTime = 3000; // Increased from 2000ms to 3000ms for more time to initialize
      
      const startTime = Date.now();
      
      const tryExecute = async () => {
        // Check if we've been trying too long regardless of retry count
        if (Date.now() - startTime > maxWaitTime) {
          console.error(`Timeout reached waiting for chat module initialization after ${maxWaitTime}ms`);
          return;
        }
        
        // Check if chat module is properly initialized
        if (typeof window.chat === 'undefined' || !window.chat || typeof window.chat.executeCommand !== 'function') {
          retryCount++;
          if (retryCount <= maxRetries) {
            console.debug(`Chat module not properly initialized, retrying in ${retryInterval}ms (attempt ${retryCount}/${maxRetries})`);
            setTimeout(tryExecute, retryInterval);
          } else {
            console.error('Chat module not initialized after maximum retries, cannot auto-execute');
          }
          return;
        }
        
        try {
          // Ensure the content script is properly loaded in the tab by sending a test message
          try {
            // Try a ping to see if the content script is ready
            const pingResponse = await chrome.tabs.sendMessage(tabId, { action: 'ping' })
              .catch(error => {
                console.debug('Content script not ready yet:', error);
                return null;
              });
              
            if (!pingResponse || !pingResponse.pong) {
              console.debug('Content script needs initialization, asking background script to reinject');
              // Ask background script to inject the content script if needed
              await chrome.runtime.sendMessage({ 
                action: 'injectContentScript', 
                tabId: tabId 
              });
              
              // Wait a bit for the injection to complete
              await new Promise(resolve => setTimeout(resolve, 500));
            } else {
              console.debug('Content script already initialized');
            }
          } catch (scriptError) {
            console.debug('Error checking content script status:', scriptError);
            // Continue anyway as we'll retry execution
          }
          
          // Execute the stored command
          console.debug('Chat module ready, executing command');
          window.chat.executeCommand();
        } catch (execError) {
          console.error('Error during command execution:', execError);
          // If execution failed, try one more time after a delay
          if (retryCount < maxRetries) {
            retryCount++;
            console.debug(`Command execution failed, retrying in ${retryInterval * 2}ms (attempt ${retryCount}/${maxRetries})`);
            setTimeout(tryExecute, retryInterval * 2);
          }
        }
      };
      
      // Start the execution attempt
      tryExecute();
    } else {
      console.debug('Ctrl key pressed, not auto-executing');
    }
  } catch (error) {
    console.error('Error in auto-execution:', error);
  }
}

// Apply theme as early as possible, before DOMContentLoaded
applyThemeFromPreferences().catch(error => {
  console.error('Error applying early theme:', error);
});

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup DOMContentLoaded event fired');
  
  // Add fade-in animation for visual smoothness
  const popupContainer = document.querySelector('.popup-container');
  if (popupContainer) popupContainer.classList.add('popup-fade-in');
  
  // Continue with normal initialization
  await initializePopup();
});

// Also try to initialize immediately if document is already complete
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log('Document already ready, initializing popup immediately');
  initializePopup();
} 