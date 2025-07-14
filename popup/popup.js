/**
 * Page Inference - Popup Entry Point
 * 
 * This is the main entry point for the popup UI.
 * It imports and initializes components from the component directory.
 */

// Import our new logger
import logger from '../shared/utils/logger.js';
import { getDomain } from '../shared/utils/url-utils.js';

// Prevent multiple initializations with a global flag
if (window.popupJsInitialized) {
  logger.error('DUPLICATE INITIALIZATION DETECTED: popup.js already initialized!');
} else {
  window.popupJsInitialized = true;
  logger.init('Popup.js initialization started');
}

// Generate a unique ID for this popup instance
const popupInstanceId = Date.now() + '-' + Math.random().toString(36).substring(2, 15);
logger.debug(`Popup instance ID: ${popupInstanceId}`);

// Track if modifier key is pressed (Ctrl on PC, Command on Mac)
let modifierKeyPressed = false;

// Detect if we're on Mac
const isMac = navigator.userAgent.indexOf('Mac') !== -1;

// Expose modifier key state to window so other components can access it
window.ctrlKeyPressed = false; // Keep this name for backward compatibility
window.isMac = isMac;

// *** CRITICAL FIX: Capture modifier state immediately on popup open ***
// This will be used consistently throughout the entire execution chain
let initialModifierState = false;

// Function to monitor modifier key state changes
const monitorModifierKeyState = (newState) => {
  if (newState !== modifierKeyPressed) {
    logger.ctrl(`${isMac ? 'Command' : 'Ctrl'} key state changed: ${newState ? 'pressed' : 'released'}`);
    modifierKeyPressed = newState;
    // Update window variable for other components (keep old name for compatibility)
    window.ctrlKeyPressed = newState;
    
    // Capture the initial state on first detection
    if (newState && !initialModifierState) {
      initialModifierState = true;
      window.initialCtrlState = true;
      logger.ctrl(`Initial ${isMac ? 'Command' : 'Ctrl'} state captured and frozen for execution`);
    }
  }
};

// Immediately capture modifier state on popup open
(function captureInitialModifierState() {
  // Store the initial state globally for consistent use
  window.initialCtrlState = false;
  
  // Check multiple ways to detect modifier key immediately
  const checkImmediateModifierState = () => {
    let detected = false;
    
    // Method 1: Check current event state
    const hasModifier = isMac ? window.event?.metaKey : window.event?.ctrlKey;
    if (hasModifier) {
      detected = true;
      logger.ctrl(`Immediate ${isMac ? 'Command' : 'Ctrl'} detection via window.event`);
    }
    
    // Method 2: Check keyboard API if available
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
      navigator.keyboard.getLayoutMap().then(keyMap => {
        const hasModifierKey = isMac ? 
          (keyMap.has('MetaLeft') || keyMap.has('MetaRight')) :
          (keyMap.has('ControlLeft') || keyMap.has('ControlRight'));
        
        if (hasModifierKey) {
          detected = true;
          logger.ctrl(`Immediate ${isMac ? 'Command' : 'Ctrl'} detection via Keyboard API`);
          monitorModifierKeyState(true);
        }
      }).catch(() => {});
    }
    
    if (detected) {
      initialModifierState = true;
      window.initialCtrlState = true;
      monitorModifierKeyState(true);
      logger.ctrl(`Initial ${isMac ? 'Command' : 'Ctrl'} state captured immediately`);
    }
  };
  
  // Run immediate check
  checkImmediateModifierState();
  
  // Also check on next tick
  setTimeout(checkImmediateModifierState, 0);
})();

// Check if modifier key is pressed at startup - most reliable way to catch it
// Different browsers handle key events differently, so we check both ways
if (typeof window !== 'undefined') {
  // Method 1: Check for modifier key using keyboard event
  const checkForModifier = (e) => {
    const hasModifier = isMac ? 
      (e.key === 'Meta' || e.metaKey) : 
      (e.key === 'Control' || e.ctrlKey);
    
    if (hasModifier) {
      logger.ctrl(`${isMac ? 'Command' : 'Ctrl'} key detected on popup open`);
      monitorModifierKeyState(true);
      // Remove this listener once we've detected modifier
      document.removeEventListener('keydown', checkForModifier, true);
    }
  };
  
  // Add capture phase listener to catch it as early as possible
  document.addEventListener('keydown', checkForModifier, true);
  
  // Method 2: Check via mouseup event which might have modifier key info
  document.addEventListener('mouseup', (e) => {
    const hasModifier = isMac ? e.metaKey : e.ctrlKey;
    if (hasModifier) {
      logger.ctrl(`${isMac ? 'Command' : 'Ctrl'} key detected via mouseup event`);
      monitorModifierKeyState(true);
    }
  }, {once: true, capture: true});
  
  // Method 3: Check for current keyboard state
  try {
    // Some browsers support this API
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
      navigator.keyboard.getLayoutMap().then(keyboardLayoutMap => {
        const hasModifierKey = isMac ? 
          (keyboardLayoutMap.has('MetaLeft') || keyboardLayoutMap.has('MetaRight')) :
          (keyboardLayoutMap.has('ControlLeft') || keyboardLayoutMap.has('ControlRight'));
        
        if (hasModifierKey) {
          logger.ctrl(`${isMac ? 'Command' : 'Ctrl'} key detected via Keyboard API`);
          monitorModifierKeyState(true);
        }
      });
    }
  } catch (e) {
    logger.debug('Keyboard API not supported');
  }
}

// Add event listeners for modifier key as early as possible
document.addEventListener('keydown', (event) => {
  const isModifierKey = isMac ? 
    (event.key === 'Meta' || event.metaKey) : 
    (event.key === 'Control' || event.ctrlKey);
  
  if (isModifierKey) {
    monitorModifierKeyState(true);
    logger.ctrl(`${isMac ? 'Command' : 'Ctrl'} key down detected`);
  }
});

document.addEventListener('keyup', (event) => {
  const isModifierKey = isMac ? 
    (event.key === 'Meta' || event.metaKey) : 
    (event.key === 'Control' || event.ctrlKey);
  
  if (isModifierKey) {
    monitorModifierKeyState(false);
    logger.ctrl(`${isMac ? 'Command' : 'Ctrl'} key up detected`);
  }
});

// Apply theme immediately, before anything else renders
(function applyThemeImmediately() {
  try {
    logger.theme('Applying theme on script load');
    
    // IMPORTANT: First make sure we don't have an old separate 'theme' key in storage
    // that might conflict with the proper 'userPreferences.theme'
    chrome.storage.local.remove('theme', () => {
      logger.theme('Removed any direct "theme" key to avoid conflicts');
    });
    
    // Disable all transitions initially
    document.documentElement.classList.add('theme-transition-disabled');
    document.documentElement.classList.add('theme-loading');
    
    // 1. First check localStorage for immediate theme application
    const cachedTheme = localStorage.getItem('temp_theme_preference');
    logger.theme(`Cached theme from localStorage: ${cachedTheme || 'none'}`);
    
    // Initial theme application based on localStorage or system preference
    let initialTheme = cachedTheme;
    
    // Ensure we only apply 'light' or 'dark', not 'system' or other values
    if (!initialTheme || initialTheme === 'system' || (initialTheme !== 'light' && initialTheme !== 'dark')) {
      // For system theme or no stored preference or invalid value, detect system theme
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      initialTheme = prefersDark ? 'dark' : 'light';
      logger.theme(`System preference detected as: ${initialTheme}`);
    }
    
    // Always apply an initial theme immediately to prevent flash
    logger.theme(`Applying initial theme: ${initialTheme}`);
    // Apply theme to HTML element instead of body
    document.documentElement.setAttribute('data-theme', initialTheme);
    
    // 2. Then check Chrome storage for the actual user preference
    chrome.storage.local.get('userPreferences', ({ userPreferences }) => {
      logger.theme(`User preferences from storage: ${JSON.stringify(userPreferences?.theme || 'none')}`);
      
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
        logger.theme(`System theme resolved to: ${effectiveTheme}`);
      }
      
      // Only update DOM if the effective theme is different from what's already applied
      const currentTheme = document.documentElement.getAttribute('data-theme');
      
      if (currentTheme !== effectiveTheme) {
        logger.theme(`Updating theme: ${currentTheme} → ${effectiveTheme}`);
        document.documentElement.setAttribute('data-theme', effectiveTheme);
      }
      
      // 3. Always update localStorage with the latest preference
      try {
        localStorage.setItem('temp_theme_preference', themePreference); // Store the preference, not the resolved theme
        logger.theme(`Updated localStorage theme preference: ${themePreference}`);
      } catch (e) {
        logger.warn('Could not update cached theme in localStorage:', e);
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
          logger.theme(`System theme changed to: ${newTheme}`);
          document.documentElement.setAttribute('data-theme', newTheme);
        }
      });
    });
  } catch (error) {
    logger.error('Error in theme application:', error);
    // Fallback to system preference if all else fails
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const fallbackTheme = prefersDark ? 'dark' : 'light';
    logger.theme(`Error fallback to system theme: ${fallbackTheme}`);
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
      logger.info(`Another popup (${activePopupId}) is active, closing this popup (${popupInstanceId})`);
      window.close();
      return; // Stop initialization
    }
    
    // Set ourselves as the active popup
    await chrome.storage.local.set({ activePopupId: popupInstanceId });
    logger.debug(`Set active popup ID: ${popupInstanceId}`);
    
    // Clean up when this popup is closed
    window.addEventListener('unload', async () => {
      try {
        // Only clear if we're still the active popup
        const { activePopupId: currentActiveId } = await chrome.storage.local.get('activePopupId');
        if (currentActiveId === popupInstanceId) {
          await chrome.storage.local.remove('activePopupId');
          logger.debug(`Removed active popup ID: ${popupInstanceId}`);
        }
      } catch (error) {
        logger.error('Error during popup unload cleanup:', error);
      }
    });
  } catch (error) {
    logger.error('Error checking for old popups:', error);
  }
})();

// Establish a connection with the background script for popup tracking
let backgroundConnection;
try {
  backgroundConnection = chrome.runtime.connect({ name: 'popup' });
  logger.debug('Connected to background script for popup tracking');
  
  // Send our instance ID to the background script
  backgroundConnection.postMessage({ 
    action: 'registerPopup', 
    popupId: popupInstanceId 
  });
  
  // Listen for messages from the background script
  backgroundConnection.onMessage.addListener((message) => {
    logger.debug('Background script message:', message.action);
    
    // If the background script tells us to close, do so
    if (message.action === 'closePopup') {
      logger.info(`Closing popup: ${message.reason}`);
      window.close();
    }
  });
  
  // Handle disconnection
  backgroundConnection.onDisconnect.addListener(() => {
    logger.debug('Disconnected from background script');
    backgroundConnection = null;
  });
} catch (error) {
  logger.error('Failed to connect to background script:', error);
}

// Also periodically check if we're still the active popup (in case storage-based approach fails)
const activePopupCheck = setInterval(async () => {
  try {
    const { activePopupId } = await chrome.storage.local.get('activePopupId');
    if (activePopupId !== popupInstanceId) {
      logger.info(`No longer active popup. Current: ${activePopupId}, this: ${popupInstanceId}`);
      window.close();
    }
  } catch (error) {
    logger.error('Error during active popup check:', error);
  }
}, 2000); // Check every 2 seconds

// Clear interval on unload
window.addEventListener('unload', () => {
  clearInterval(activePopupCheck);
  
  // Clean up background connection
  logger.debug('Popup window unloading, cleaning up connections');
  if (backgroundConnection) {
    try {
      backgroundConnection.disconnect();
    } catch (error) {
      logger.error('Error disconnecting from background script:', error);
    }
  }
});

// Add handler to detect potential DOM changes that might cause multiple script loading
if (window.MutationObserver) {
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        const addedScripts = Array.from(mutation.addedNodes).filter(node => 
          node.tagName === 'SCRIPT' && (node.src && node.src.includes('popup.js'))
        );
        if (addedScripts.length > 0) {
          logger.error('POPUP.JS ADDED AGAIN TO DOM!', addedScripts);
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
// import historyComponent from './components/history.js'; // Removed as per edit hint
import controlsComponent from './components/controls.js';

// Track initialization status
let popupInitialized = false;

/**
 * Early initialization function that runs immediately
 * Notifies background script as early as possible about popup opening
 */
(function earlyInitialize() {
  logger.init('Early popup initialization');
  try {
    // Notify background script immediately that popup is open
    chrome.runtime.sendMessage({
      type: 'popupInitialized',
      action: 'popupInitialized',
      timestamp: Date.now()
    }, (response) => {
      logger.debug('Background acknowledged early initialization');
    });
  } catch (error) {
    logger.error('Error during early popup initialization:', error);
  }
})();

/**
 * Apply theme from user preferences
 */
async function applyThemeFromPreferences() {
  // Avoid multiple theme application attempts in rapid succession
  if (window.themeApplicationInProgress) {
    logger.theme('Theme application already in progress, skipping');
    return;
  }
  
  window.themeApplicationInProgress = true;
  
  try {
    logger.theme('Applying theme from preferences');
    
    // Get user preferences from Chrome storage
    const { userPreferences } = await chrome.storage.local.get('userPreferences');
    
    // Default to system theme if no preference is set
    const themePreference = (userPreferences && userPreferences.theme) || 'system';
    
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
      logger.theme(`System theme resolved to: ${effectiveTheme}`);
    }
    
    // Check if theme already matches what's applied
    const currentTheme = document.documentElement.getAttribute('data-theme');
    
    if (currentTheme !== effectiveTheme) {
      logger.theme(`Updating theme: ${currentTheme} → ${effectiveTheme}`);
      document.documentElement.setAttribute('data-theme', effectiveTheme);
    }
    
    // Cache the theme preference in localStorage for immediate access next time
    try {
      localStorage.setItem('temp_theme_preference', themePreference); // Store the preference, not the resolved theme
    } catch (e) {
      logger.warn('Could not cache theme in localStorage:', e);
    }
    
    // Add a CSS class to indicate theme is loaded
    document.documentElement.classList.add('theme-ready');
    document.documentElement.classList.remove('theme-loading');
  } catch (error) {
    logger.error('Error applying theme from preferences:', error);
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
  logger.init('Initializing components');
  
  // Initialize all UI components
  chatComponent.initializeChatComponent();
  settingsComponent.initializeSettingsComponent();
  // Only initialize history component if the old history tab exists (legacy)
  // const historyTab = document.getElementById('history-tab');
  // if (historyTab) {
  //   initializeHistoryComponent();
  // }
  controlsComponent.initializeControlsComponent();
  
  // Assign chatComponent to window.chat for access from autoExecuteIfNeeded
  window.chat = chatComponent;
  logger.debug('Assigned chat component to window.chat');
  
  // Set up component communication
  setupComponentCommunication();
  
  // Handle dynamic textarea height
  const messageInput = document.getElementById('message-input');
  const chatInputContainer = document.querySelector('.chat-input-container');

  messageInput.addEventListener('input', () => {
    const maxHeight = window.innerHeight * 0.3;
    messageInput.style.height = 'auto';
    const newHeight = Math.min(messageInput.scrollHeight, maxHeight);
    messageInput.style.height = `${newHeight}px`;
    chatInputContainer.style.height = `${newHeight + 16}px`;
  });

  logger.success('Components initialized successfully');
  return true;
}

/**
 * Main initialization function for the popup
 */
async function initializePopup() {
  // Prevent multiple initializations
  if (popupInitialized) {
    logger.debug('Popup already initialized, skipping');
    return;
  }
  
  try {
    logger.init('Initializing popup');
    popupInitialized = true;

    // Apply theme from user preferences
    await applyThemeFromPreferences();

    // Initialize the components
    await initializeComponents();

    // Remove call to initializeToggleButtons (not defined)
    // initializeToggleButtons();

    // Check for Chrome storage errors
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      logger.error('Chrome storage error:', lastError);
      // Handle error if needed
    }

    // Check if we have an API key
    const apiKeyExists = await checkApiKeyExists();
    if (!apiKeyExists) {
      logger.debug('No API key exists, showing settings page');
      navigateToSettings();
    } else {
      logger.debug('API key exists, proceeding with initialization');
      
      // Check one more time for Ctrl key state right before auto-execution
      const checkCtrlKeyBeforeExecution = () => {
        // Focus on input after everything is properly initialized
        const inputElement = document.getElementById('message-input');
        if (inputElement) {
          inputElement.focus();
        }
        
        // We perform multiple checks for the Ctrl key to be extremely reliable
        let ctrlKeyDetected = false;
        
        // Method 1: Check the window.ctrlKeyPressed global variable set by our detection methods
        if (window.ctrlKeyPressed === true) {
          ctrlKeyDetected = true;
          logger.ctrl('Ctrl key detected via window.ctrlKeyPressed');
        }
        
        // Method 2: Check our local ctrlKeyPressed variable
        if (modifierKeyPressed === true) { // Changed from ctrlKeyPressed to modifierKeyPressed
          ctrlKeyDetected = true;
          logger.ctrl('Ctrl key detected via local modifierKeyPressed');
        }
        
        // Method 3: Check if modifier key is currently pressed using browser APIs
        if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
          navigator.keyboard.getLayoutMap().then(keyMap => {
            const hasModifierKey = isMac ? 
              (keyMap.has('MetaLeft') || keyMap.has('MetaRight')) :
              (keyMap.has('ControlLeft') || keyMap.has('ControlRight'));
              
            if (hasModifierKey) {
              ctrlKeyDetected = true;
              logger.ctrl(`${isMac ? 'Command' : 'Ctrl'} key detected via Keyboard API`);
              monitorModifierKeyState(true);
            }
          }).catch(err => logger.debug('Keyboard API error:', err));
        }
        
        // Method 4: Use event modifier key if available (unlikely, but worth checking)
        const hasModifierInEvent = isMac ? window.event?.metaKey : window.event?.ctrlKey;
        if (hasModifierInEvent) {
          ctrlKeyDetected = true;
          logger.ctrl(`${isMac ? 'Command' : 'Ctrl'} key detected via window.event`);
          monitorModifierKeyState(true);
        }
        
        // Final check: If any method detected Ctrl key, update all variables
        if (ctrlKeyDetected) {
          logger.ctrl('Ctrl key detected in final check before auto-execution');
          monitorModifierKeyState(true);
        }
        
        // Only attempt auto-execution if Ctrl key is not pressed
        if (!ctrlKeyDetected) {
          logger.info('Proceeding with auto-execution - Ctrl key not detected');
          autoExecuteIfNeeded();
        } else {
          logger.info('Skipping auto-execution - Ctrl key detected');
        }
      };
      
      // Small delay to ensure everything is ready - using cached ctrl state
      setTimeout(checkCtrlKeyBeforeExecution, 50);
    }
  } catch (error) {
    logger.error('Error in popup initialization:', error);
  }
}

/**
 * Set up communication between components
 */
function setupComponentCommunication() {
  // When a session is selected in history, notify chat component
  window.addEventListener('open-session', (event) => {
    const session = event.detail;
    logger.session(`Open session event: ${session?.pageLoadId}`);
    
    // No need to switch tabs since we removed the old tab system
    
    // Dispatch event for chat component
    window.dispatchEvent(new CustomEvent('show-session', {
      detail: {
        pageLoadId: session.pageLoadId,
        url: session.url,
        title: session.title
      }
    }));
  });

  // When new chat button is clicked, notify chat component
  window.addEventListener('new-chat', () => {
    // Clear active session selection
    logger.debug('New chat event received - clearing active session selection');
    currentActivePageLoadId = null;
    highlightActiveSidebarSession(null);
    
    if (chatComponent && typeof chatComponent.handleNewChat === 'function') {
      chatComponent.handleNewChat();
    }
  });
  
  // When settings are changed, notify other components
  window.addEventListener('settings-changed', (event) => {
    const { settings } = event.detail;
    logger.debug(`Settings changed: ${Object.keys(settings).join(', ')}`);
    
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
        logger.theme(`System theme resolved to: ${effectiveTheme}`);
      }
      
      // Apply the theme to the HTML element
      document.documentElement.setAttribute('data-theme', effectiveTheme);
      
      // Cache the theme preference in localStorage
      try {
        localStorage.setItem('temp_theme_preference', settings.theme);
      } catch (e) {
        logger.warn('Could not cache theme in localStorage:', e);
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
    logger.session('Chat session updated');
    
    // Notify history component to refresh
    window.dispatchEvent(new CustomEvent('session-updated', {
      detail: { session }
    }));
  });

  // When a tab needs to be shown, handle it here
  window.addEventListener('show-tab', (event) => {
    const { tabId } = event.detail;
    if (tabId) {
      const tabButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
      if (tabButton) {
        tabButton.click();
      }
    }
  });

  // When active session changes, highlight it in sidebar
  window.addEventListener('active-session-changed', (event) => {
    const session = event.detail?.session;
    if (session?.pageLoadId) {
      currentActivePageLoadId = session.pageLoadId; // Store the active session
      highlightActiveSidebarSession(session.pageLoadId);
    }
  });
}

// Sidebar chat list rendering and logic
function renderSidebarSessions(sessions, activePageLoadId = null) {
  const list = document.getElementById('sidebar-sessions-list');
  const noMsg = document.getElementById('sidebar-no-sessions-message');
  if (!list) return;
  list.innerHTML = '';
  if (!sessions || sessions.length === 0) {
    if (noMsg) noMsg.style.display = '';
    return;
  }
  if (noMsg) noMsg.style.display = 'none';
  sessions.forEach(session => {
    const li = document.createElement('li');
    li.textContent = session.title || session.url || session.pageLoadId || 'Untitled Chat';
    li.title = session.url || session.pageLoadId || '';
    li.setAttribute('data-page-load-id', session.pageLoadId);
    
    // Highlight active session
    if (activePageLoadId && session.pageLoadId === activePageLoadId) {
      li.classList.add('active');
    }
    
    li.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('open-session', { detail: session }));
    });
    list.appendChild(li);
  });
}

// Function to highlight active session in sidebar
function highlightActiveSidebarSession(pageLoadId) {
  const list = document.getElementById('sidebar-sessions-list');
  if (!list) return;
  
  // Remove active class from all sessions
  const allItems = list.querySelectorAll('li');
  allItems.forEach(item => item.classList.remove('active'));
  
  // Add active class to current session if pageLoadId is provided
  if (pageLoadId) {
    const activeItem = list.querySelector(`li[data-page-load-id="${pageLoadId}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
    }
  }
}

// Sidebar search logic
function filterSidebarSessions(sessions, query) {
  if (!query) return sessions;
  const q = query.toLowerCase();
  return sessions.filter(s => (s.title || '').toLowerCase().includes(q) || (s.url || '').toLowerCase().includes(q));
}

// Global variable to track the active session
let currentActivePageLoadId = null;

// Sidebar new chat logic
function setupSidebar() {
  let allSessions = [];
  const searchInput = document.getElementById('sidebar-search-input');
  const newChatBtn = document.getElementById('sidebar-new-chat');
  const domainFilterToggle = document.getElementById('sidebar-domain-filter-toggle');
  let currentBaseDomain = null;
  let domainFilterEnabled = false;

  // Load persisted toggle state
  chrome.storage.local.get('sidebarDomainFilterEnabled', (result) => {
    domainFilterEnabled = !!result.sidebarDomainFilterEnabled;
    if (domainFilterToggle) domainFilterToggle.checked = domainFilterEnabled;
  });

  // Get current tab's base domain
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0] && tabs[0].url) {
      currentBaseDomain = getBaseDomain(tabs[0].url);
      // Always set the label to the static text (no domain)
      const label = document.getElementById('sidebar-domain-filter-label');
      if (label) {
        label.textContent = 'Only show chats from this site';
      }
    }
    // After domain is set, load sessions
    loadSessions();
  });

  // Load sessions from storage or background
  function loadSessions() {
    chrome.storage.local.get(['chatSessions', 'chat_sessions', 'sessions'], (result) => {
      allSessions = result.chatSessions || result.chat_sessions || result.sessions || [];
      // Sort by lastUpdated (descending)
      allSessions.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
      
      // Use the stored active session, or try to get it from tab storage as fallback
      if (currentActivePageLoadId) {
        renderSidebarSessions(applySidebarFilters(allSessions), currentActivePageLoadId);
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          let activePageLoadId = null;
          if (tabs && tabs[0]) {
            const tabId = tabs[0].id;
            chrome.storage.local.get([`pageLoadId_${tabId}`], (result) => {
              activePageLoadId = result[`pageLoadId_${tabId}`];
              if (activePageLoadId) {
                currentActivePageLoadId = activePageLoadId; // Store it for future use
              }
              renderSidebarSessions(applySidebarFilters(allSessions), activePageLoadId);
            });
          } else {
            renderSidebarSessions(applySidebarFilters(allSessions));
          }
        });
      }
    });
  }

  // Apply both search and domain filters
  function getBaseDomain(url) {
    try {
      const urlObj = new URL(url);
      const parts = urlObj.hostname.split('.');
      if (parts.length > 2) {
        return parts.slice(-2).join('.');
      }
      return urlObj.hostname;
    } catch (error) {
      return '';
    }
  }

  function applySidebarFilters(sessions) {
    let filtered = sessions;
    const originalCount = filtered.length;
    
    // Filter out empty sessions (sessions without any messages)
    filtered = filtered.filter(s => s.messages && s.messages.length > 0);
    const afterEmptyFilter = filtered.length;
    
    if (originalCount !== afterEmptyFilter) {
      logger.debug(`Filtered out ${originalCount - afterEmptyFilter} empty sessions (${originalCount} -> ${afterEmptyFilter})`);
    }
    
    // Domain filter (use getBaseDomain logic from history.js)
    if (domainFilterEnabled && currentBaseDomain) {
      filtered = filtered.filter(s => {
        if (!s.url) return false;
        return getBaseDomain(s.url) === currentBaseDomain;
      });
    }
    // Search filter
    if (searchInput && searchInput.value) {
      const q = searchInput.value.toLowerCase();
      filtered = filtered.filter(s => (s.title || '').toLowerCase().includes(q) || (s.url || '').toLowerCase().includes(q));
    }
    return filtered;
  }

  // Search filter
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderSidebarSessions(applySidebarFilters(allSessions), currentActivePageLoadId);
    });
  }
  // Domain filter toggle
  if (domainFilterToggle) {
    domainFilterToggle.addEventListener('change', () => {
      domainFilterEnabled = domainFilterToggle.checked;
      chrome.storage.local.set({ sidebarDomainFilterEnabled: domainFilterEnabled });
      renderSidebarSessions(applySidebarFilters(allSessions), currentActivePageLoadId);
    });
  }

  // New chat
  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      // Clear active session selection
      logger.debug('New chat button clicked - clearing active session selection');
      currentActivePageLoadId = null;
      highlightActiveSidebarSession(null);
      
      // Always trigger a new chat session and clear chat area
      if (window.chat && typeof window.chat.handleNewChat === 'function') {
        window.chat.handleNewChat();
      } else {
        // Fallback: clear chat area directly while preserving flower
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
          // Save the flower element if it exists
          const flowerElement = document.getElementById('popup-flower-animation');
          let flowerHTML = '';
          if (flowerElement) {
            flowerHTML = flowerElement.outerHTML;
          }
          
          // Clear all messages
          chatMessages.innerHTML = '';
          
          // Restore the flower if it existed
          if (flowerHTML) {
            chatMessages.insertAdjacentHTML('afterbegin', flowerHTML);
          }
        }
        const titleElem = document.getElementById('current-conversation-title');
        if (titleElem) titleElem.textContent = '';
        const tsElem = document.getElementById('current-conversation-timestamp');
        if (tsElem) tsElem.textContent = '';
      }
      // Reload sessions to reflect changes (empty sessions will be filtered out)
      setTimeout(loadSessions, 300);
    });
  }
  // Listen for session updates
  window.addEventListener('chat-session-updated', (event) => {
    const { session } = event.detail || {};
    if (session?.pageLoadId) {
      // If this session now has messages and wasn't active before, make it active
      if (session.messages && session.messages.length > 0) {
        logger.debug(`Session ${session.pageLoadId} now has ${session.messages.length} messages - making it active`);
        currentActivePageLoadId = session.pageLoadId;
      }
    }
    loadSessions();
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
    logger.error('Error checking if API key exists:', error);
    
    // Try direct storage access as fallback
    try {
      const result = await chrome.storage.local.get('openai_api_key');
      return !!result.openai_api_key;
    } catch (storageError) {
      logger.error('Error accessing storage for API key check:', storageError);
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
 * Auto-execution is now handled entirely by chat.js checkForCommandToExecute()
 * This eliminates duplicate systems and uses a single storage key (execute_last_input)
 */
async function autoExecuteIfNeeded() {
  // Auto-execution logic moved to chat.js to avoid duplicate systems
  logger.debug('Auto-execution is handled by chat.js checkForCommandToExecute()');
}

// Apply theme as early as possible, before DOMContentLoaded
applyThemeFromPreferences().catch(error => {
  logger.error('Error applying early theme:', error);
});

/**
 * Injects a growing/fading SVG flower animation into the popup background.
 * The animation is theme-aware and disappears after 5 seconds.
 */
/**
 * Restart the flower animation each time the popup opens
 */
function restartFlowerAnimation() {
  console.log('🌸 restartFlowerAnimation called');
  const flower = document.getElementById('popup-flower-animation');
  console.log('🌸 flower element found:', flower);
  if (flower) {
    console.log('🌸 restarting animation');
    // Force restart the animation by removing and re-adding the animation
    flower.style.animation = 'none';
    flower.offsetHeight; // Trigger reflow
    flower.style.animation = 'flowerGrowAndFade 5s ease-out forwards';
    console.log('🌸 animation restarted');
  } else {
    console.log('🌸 flower element not found in DOM');
  }
}

// Restart flower animation on popup open - delay to ensure all rendering is complete
console.log('🌸 Setting up flower animation, document.readyState:', document.readyState);
function setupFlowerAnimation() {
  console.log('🌸 Setting up flower animation with delay');
  // Wait for all components to initialize and render
  setTimeout(() => {
    restartFlowerAnimation();
  }, 500); // Delay to ensure all rendering is complete
}

if (document.readyState === 'loading') {
  console.log('🌸 Adding DOMContentLoaded listener for flower animation');
  document.addEventListener('DOMContentLoaded', setupFlowerAnimation);
} else {
  console.log('🌸 Document ready, calling setupFlowerAnimation immediately');
  setupFlowerAnimation();
}

document.addEventListener('DOMContentLoaded', async () => {
  logger.init('Popup DOM loaded');
  
  // Add fade-in animation for visual smoothness
  const popupContainer = document.querySelector('.popup-container');
  if (popupContainer) popupContainer.classList.add('popup-fade-in');
  
  // Continue with normal initialization
  await initializePopup();
  setupSidebar(); // Initialize sidebar after popup is fully loaded
  
  // Listen for settings updates to apply theme changes immediately
  window.addEventListener('settings-updated', async (event) => {
    logger.theme('Settings updated, applying theme from preferences');
    await applyThemeFromPreferences();
  });
  
  // Debug: log all storage keys/values
  chrome.storage.local.get(null, (all) => {
    console.log('[DEBUG] chrome.storage.local contents:', all);
  });
});

// Settings panel functionality
document.addEventListener('DOMContentLoaded', () => {
  const settingsBtn = document.getElementById('settings-gear-button');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsCloseBtn = document.getElementById('settings-close-button');
  
  // Function to open settings panel
  function openSettingsPanel() {
    settingsPanel.classList.remove('hidden');
    // Dispatch an event to notify the settings component that the panel is now visible
    window.dispatchEvent(new CustomEvent('settings-panel-opened'));
  }
  
  // Function to close settings panel
  function closeSettingsPanel() {
    settingsPanel.classList.add('hidden');
  }
  
  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener('click', (event) => {
      event.stopPropagation(); // Prevent event from bubbling to document
      const wasHidden = settingsPanel.classList.contains('hidden');
      
      if (wasHidden) {
        openSettingsPanel();
      } else {
        closeSettingsPanel();
      }
    });
  }
  
  // Close button functionality
  if (settingsCloseBtn && settingsPanel) {
    settingsCloseBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      closeSettingsPanel();
    });
  }
});

// Restart the flower animation each time the popup opens
