/**
 * Background Script
 * 
 * Main entry point for the extension's background page.
 * Sets up listeners and manages the extension's lifecycle.
 */

// Import prompts directly
import { 
  GENERIC_SYSTEM_PROMPT,
  NO_PAGE_CONTENT_SYSTEM_PROMPT,
  WEB_SEARCH_SYSTEM_PROMPT,
  COMBINED_SYSTEM_PROMPT,
  generatePageAwarePrompt
} from '../shared/prompts/generic.js';

import {
  LINKEDIN_SYSTEM_PROMPT,
  GITHUB_SYSTEM_PROMPT,
  STACKOVERFLOW_SYSTEM_PROMPT
} from '../shared/prompts/website-specific.js';

// Import OpenAI service
import openaiApi from './api/openai.js';

// Global variables to store service references
let messageHandler = null;
let storageService = null;
let chatService = null;
let STORAGE_KEYS = null;

// Variables for Ctrl+Click functionality
let ctrlClickPending = false;
let lastCtrlKeyState = false;
let ctrlClickTimeoutId = null;
let ctrlKeyPressTimestamp = 0; // Add timestamp tracking for more reliable detection

// Track the focused windows and tabs
let focusedTabs = {};
let lastFocusedWindowId = null;
let lastFocusedTabId = null;

// Track which tab the popup was opened from
let popupOpenedFromTabId = null;
let popupOpenedFromWindowId = null;
let popupOpenedFromUrl = null;

// Track active popups
let activePopupPorts = [];
let lastActivePopupId = null;

// Track Ctrl key state for popup opening
let wasCtrlKeyPressed = false;

// Track Ctrl key state per tab
let tabCtrlKeyStates = {};

// Double-click detection variables
let lastClickTime = 0;
const doubleClickThreshold = 300; // ms between clicks to count as double-click
let clickCount = 0;
let clickTimer = null;

// Initialize storage keys
const STORAGE_KEYS_CONSTANTS = {
  USER_PREFERENCES: 'userPreferences',
  CHAT_SESSIONS: 'chatSessions',
  DEBUG_MODE: 'debugMode',
  API_KEY: 'openai_api_key',
  GLOBAL_LAST_USER_INPUT: 'global_last_user_input', // New storage key for the last user input
  // Add other storage keys as needed
};

/**
 * Initialize the background script
 */
async function initialize() {
  try {
    console.log('Background script initializing');
    
    // Set up simple references without ES modules
    STORAGE_KEYS = STORAGE_KEYS_CONSTANTS;
    
    // Define simple storageService implementation
    storageService = {
      getValue: async function(key, defaultValue) {
        return new Promise((resolve) => {
          chrome.storage.local.get([key], function(result) {
            resolve(result[key] !== undefined ? result[key] : defaultValue);
          });
        });
      },
      setValue: async function(key, value) {
        return new Promise((resolve) => {
          chrome.storage.local.set({[key]: value}, function() {
            resolve();
          });
        });
      },
      storeDebugLog: async function(logEntry) {
        const logs = await this.getValue('debugLogs', []);
        logs.push(logEntry);
        return this.setValue('debugLogs', logs);
      }
    };
    
    // Create chat service with basic functionality
    chatService = {
      // Get session list from storage
      getSessionList: async function() {
        const sessions = await storageService.getValue(STORAGE_KEYS.CHAT_SESSIONS, []);
        console.log(`Retrieved ${sessions.length} sessions from storage`);
        return sessions;
      },
      
      // Get a specific chat session
      getSession: async function(sessionId) {
        console.log('chatService.getSession called with sessionId:', sessionId);
        
        if (!sessionId) {
          console.warn('No sessionId provided to getSession');
          return null;
        }
        
        const sessions = await this.getSessionList();
        const session = sessions.find(session => session.pageLoadId === sessionId);
        
        if (session) {
          console.log('Session found:', session.pageLoadId);
        } else {
          console.warn('Session not found with ID:', sessionId);
          console.log('Available session IDs:', sessions.map(s => s.pageLoadId));
        }
        
        return session || null;
      },
      
      // Get session by URL
      getSessionByUrl: async function(url) {
        console.log('chatService.getSessionByUrl called with URL:', url);
        
        if (!url) {
          console.warn('No URL provided to getSessionByUrl');
          return null;
        }
        
        const sessions = await this.getSessionList();
        const session = sessions.find(session => session.url === url);
        
        if (session) {
          console.log('Session found by URL, pageLoadId:', session.pageLoadId);
        } else {
          console.warn('No session found with URL:', url);
        }
        
        return session || null;
      },
      
      // Create a new chat session
      createSession: async function(sessionData) {
        if (!sessionData.pageLoadId) {
          console.error('Cannot create session without pageLoadId');
          throw new Error('pageLoadId is required to create a session');
        }
        
        console.log('Creating new chat session with pageLoadId:', sessionData.pageLoadId);
        
        const sessions = await this.getSessionList();
        
        // Check if session with this ID already exists
        const existingIndex = sessions.findIndex(s => s.pageLoadId === sessionData.pageLoadId);
        
        if (existingIndex !== -1) {
          console.log('Session with this pageLoadId already exists, updating instead');
          sessions[existingIndex] = {
            ...sessions[existingIndex],
            ...sessionData,
            lastUpdated: Date.now()
          };
        } else {
          // Add new session at the beginning of the array
          sessions.unshift(sessionData);
        }
        
        await storageService.setValue(STORAGE_KEYS.CHAT_SESSIONS, sessions);
        
        // Return the newly created or updated session
        const createdSession = await this.getSession(sessionData.pageLoadId);
        console.log('Session created successfully:', sessionData.pageLoadId);
        return createdSession;
      },
      
      // Update an existing chat session
      updateSession: async function(sessionData) {
        if (!sessionData.pageLoadId) {
          console.error('Cannot update session without pageLoadId');
          throw new Error('pageLoadId is required to update a session');
        }
        
        console.log('Updating chat session with pageLoadId:', sessionData.pageLoadId);
        
        const sessions = await this.getSessionList();
        const index = sessions.findIndex(s => s.pageLoadId === sessionData.pageLoadId);
        
        if (index !== -1) {
          console.log('Found session to update at index:', index);
          
          // Update existing session with new data
          sessions[index] = {
            ...sessions[index],
            ...sessionData,
            lastUpdated: Date.now()
          };
        } else {
          console.warn('Session not found for update, creating new session:', sessionData.pageLoadId);
          // Add as new session if not found
          sessions.unshift({
            ...sessionData,
            lastUpdated: Date.now(),
            timestamp: sessionData.timestamp || Date.now()
          });
        }
        
        await storageService.setValue(STORAGE_KEYS.CHAT_SESSIONS, sessions);
        
        // Return the updated session
        const updatedSession = await this.getSession(sessionData.pageLoadId);
        console.log('Session updated successfully:', sessionData.pageLoadId);
        return updatedSession;
      },
      
      // Delete a chat session
      deleteSession: async function(pageLoadId) {
        const sessions = await this.getSessionList();
        const filteredSessions = sessions.filter(s => s.pageLoadId !== pageLoadId);
        await storageService.setValue(STORAGE_KEYS.CHAT_SESSIONS, filteredSessions);
        return true;
      }
    };
    
    // Set up message handling
    setupMessageListeners();
    setupExtensionHandlers();
    
    // Check if this is a first install or an update
    chrome.runtime.onInstalled.addListener(async (details) => {
      if (details.reason === 'install') {
        console.log('Extension installed');
        await handleFirstInstall();
      } else if (details.reason === 'update') {
        const previousVersion = details.previousVersion;
        console.log(`Extension updated from ${previousVersion} to ${chrome.runtime.getManifest().version}`);
        await handleUpdate(previousVersion);
      }
    });
    
    // Initialize debug mode if enabled
    const debugMode = await storageService.getValue(STORAGE_KEYS.DEBUG_MODE, false);
    if (debugMode) {
      console.log('Debug mode enabled');
      await storageService.storeDebugLog({
        type: 'initialization',
        message: 'Background script initialized',
        data: { timestamp: Date.now() }
      });
    }
    
    console.log('Background script initialized');
    return true;
  } catch (error) {
    console.error('Error initializing background script:', error);
    return false;
  }
}

/**
 * Function to clean up legacy storage items that are no longer needed
 * after we've moved to tab-specific state tracking
 */
async function cleanupLegacyStorage() {
  try {
    // Get all items from storage
    const allStorageItems = await chrome.storage.local.get(null);
    const keysToRemove = [];
    
    // Only keep the most recent tab-specific entries, remove old ones
    const tabIdPattern = /_tab_(\d+)$/;
    const currentTabs = new Set();
    
    // First, get all unique tab IDs in storage
    for (const key of Object.keys(allStorageItems)) {
      const match = key.match(tabIdPattern);
      if (match && match[1]) {
        currentTabs.add(match[1]);
      }
    }
    
    // For each tab ID found, check if tab still exists
    for (const tabId of currentTabs) {
      try {
        await chrome.tabs.get(parseInt(tabId));
      } catch (e) {
        // Tab doesn't exist anymore, mark all its keys for removal
        console.log(`Cleaning up storage for closed tab ${tabId}`);
        for (const key of Object.keys(allStorageItems)) {
          if (key.includes(`_tab_${tabId}`)) {
            keysToRemove.push(key);
          }
        }
      }
    }
    
    // Run cleanup if we found keys to remove
    if (keysToRemove.length > 0) {
      console.log('Removing legacy/closed tab storage keys:', keysToRemove);
      await chrome.storage.local.remove(keysToRemove);
    }
    
    // We'll keep the global keys for now for backward compatibility,
    // but we could remove them in a future version
  } catch (error) {
    console.error('Error cleaning up storage:', error);
  }
}

/**
 * Set up message listeners with proper async response handling
 */
function setupMessageListeners() {
  // Setup long-lived connections to track popup instances
  chrome.runtime.onConnect.addListener(port => {
    if (port.name === 'popup') {
      console.log(`New popup connected with ID: ${port.sender.contextId}`);
      let registeredPopupId = null;
      
      // Listen for registration message from the popup
      port.onMessage.addListener((message) => {
        if (message.action === 'registerPopup' && message.popupId) {
          registeredPopupId = message.popupId;
          console.log(`Popup registered with ID: ${registeredPopupId}`);
          
          // Close any other open popups
          closeOtherPopups(port.sender.contextId, registeredPopupId);
          
          // Store this ID in local storage as well for backup detection
          chrome.storage.local.set({ activePopupId: registeredPopupId });
        }
      });
      
      // Add this popup to the tracked popups
      activePopupPorts.push(port);
      lastActivePopupId = port.sender.contextId;
      
      // Listen for disconnect to remove from tracked popups
      port.onDisconnect.addListener(() => {
        console.log(`Popup disconnected: ${port.sender.contextId}, registered ID: ${registeredPopupId}`);
        activePopupPorts = activePopupPorts.filter(p => p !== port);
        
        if (lastActivePopupId === port.sender.contextId) {
          lastActivePopupId = activePopupPorts.length > 0 ? 
            activePopupPorts[activePopupPorts.length - 1].sender.contextId : null;
        }
        
        // Clear activePopupId in storage if it matches the one that's disconnecting
        if (registeredPopupId) {
          chrome.storage.local.get('activePopupId', ({activePopupId}) => {
            if (activePopupId === registeredPopupId) {
              chrome.storage.local.remove('activePopupId');
              console.log(`Cleared disconnected popup ID from storage: ${registeredPopupId}`);
            }
          });
        }
      });
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);
    
    // Support both message.type and message.action for backwards compatibility
    const messageType = message.type || message.action;
    
    // Special handling for popup initialization event
    if (messageType === 'popupInitialized') {
      console.debug('Popup initialized, running storage cleanup');
      cleanupLegacyStorage();
      sendResponse({ success: true });
      return true;
    }
    
    if (message.action === 'getCtrlKeyState') {
      const tabId = message.tabId;
      console.debug(`Getting Ctrl key state for tab ${tabId}`);

      chrome.storage.local.get(null, (items) => {
        // Check tab-specific keys first
        const tabSpecificPressed = items[`ctrlKeyPressed_tab_${tabId}`] === true;
        const tabSpecificPending = items[`ctrlClickPending_tab_${tabId}`] === true;
        
        // Fall back to global keys if tab-specific keys don't exist
        const globalPressed = items.ctrlKeyPressed === true;
        const globalPending = items.ctrlClickPending === true;
        
        // Prioritize tab-specific values
        const isPressed = tabSpecificPressed || globalPressed;
        const isPending = tabSpecificPending || globalPending;
        
        console.debug(`Ctrl key state for tab ${tabId}:`, {
          tabSpecific: { pressed: tabSpecificPressed, pending: tabSpecificPending },
          global: { pressed: globalPressed, pending: globalPending },
          final: { ctrlKeyPressed: isPressed, ctrlClickPending: isPending }
        });
        
        sendResponse({
          ctrlKeyPressed: isPressed,
          ctrlClickPending: isPending
        });
      });
      
      return true; // Keep the message channel open for async response
    }

    if (message.action === 'clearCtrlKeyState') {
      const tabId = message.tabId;
      console.debug(`Clearing Ctrl key state for tab ${tabId}`);
      
      // Clear both tab-specific and global states
      const keysToUpdate = {
        [`ctrlKeyPressed_tab_${tabId}`]: false,
        [`ctrlClickPending_tab_${tabId}`]: false,
        [`ctrlKeyPressTimestamp_tab_${tabId}`]: null,
        // Also clear global states for backward compatibility 
        ctrlKeyPressed: false,
        ctrlClickPending: false,
        ctrlKeyPressTimestamp: null
      };
      
      chrome.storage.local.set(keysToUpdate, () => {
        console.debug('Ctrl key state cleared');
        sendResponse({ success: true });
      });
      
      return true; // Keep the message channel open for async response
    }
    
    // Handle message based on type or action
    const handlers = {
      // API key related messages
      'get_api_key': async () => {
        try {
          console.log('Getting API key');
          const apiKey = await storageService.getValue(STORAGE_KEYS.API_KEY, null);
          console.log('API key exists:', !!apiKey);
          return { success: true, data: apiKey };
        } catch (error) {
          console.error('Error retrieving API key:', error);
          return { success: false, error: error.message };
        }
      },
      
      'set_api_key': async () => {
        try {
          const { apiKey } = message.data || {};
          await storageService.setValue(STORAGE_KEYS.API_KEY, apiKey);
          return { success: true };
        } catch (error) {
          console.error('Error setting API key:', error);
          return { success: false, error: error.message };
        }
      },
      
      'test_api_key': async () => {
        try {
          // In a real implementation, we would test the API key
          // For now, we'll just return success
          return { success: true };
        } catch (error) {
          console.error('Error testing API key:', error);
          return { success: false, error: error.message };
        }
      },
      
      // Settings related messages
      'get_settings': async () => {
        try {
          const settings = await storageService.getValue(STORAGE_KEYS.USER_PREFERENCES, {});
          return { success: true, data: settings };
        } catch (error) {
          console.error('Error retrieving settings:', error);
          return { success: false, error: error.message };
        }
      },
      
      'get_user_preferences': async () => {
        try {
          const settings = await storageService.getValue(STORAGE_KEYS.USER_PREFERENCES, {});
          return { success: true, data: settings };
        } catch (error) {
          console.error('Error retrieving user preferences:', error);
          return { success: false, error: error.message };
        }
      },
      
      'update_user_preferences': async () => {
        try {
          const currentSettings = await storageService.getValue(STORAGE_KEYS.USER_PREFERENCES, {});
          const updatedSettings = { ...currentSettings, ...message.data };
          await storageService.setValue(STORAGE_KEYS.USER_PREFERENCES, updatedSettings);
          return { success: true, data: updatedSettings };
        } catch (error) {
          console.error('Error updating user preferences:', error);
          return { success: false, error: error.message };
        }
      },
      
      'set_settings': async () => {
        try {
          const { settings } = message.data || {};
          await storageService.setValue(STORAGE_KEYS.USER_PREFERENCES, settings);
          return { success: true };
        } catch (error) {
          console.error('Error saving settings:', error);
          return { success: false, error: error.message };
        }
      },
      
      // Session related messages
      'get_session_list': async () => {
        try {
          let sessions = await chatService.getSessionList();
          
          // Filter by domain if requested
          if (message.data && message.data.domain) {
            const domain = message.data.domain;
            sessions = sessions.filter(session => {
              try {
                const sessionDomain = new URL(session.url).hostname;
                return sessionDomain === domain;
              } catch (e) {
                return false;
              }
            });
          }
          
          return { success: true, data: sessions };
        } catch (error) {
          console.error('Error retrieving session list:', error);
          return { success: false, error: error.message };
        }
      },
      
      'get_session': async () => {
        try {
          const { sessionId } = message.data || {};
          const session = await chatService.getSession(sessionId);
          return { success: true, data: session };
        } catch (error) {
          console.error('Error retrieving session:', error);
          return { success: false, error: error.message };
        }
      },
      
      'get_chat_session': async () => {
        try {
          const { url, sessionId, pageLoadId } = message.data || {};
          
          let session = null;
          
          // Log the request parameters for debugging
          console.log('GET_CHAT_SESSION request params:', { url, sessionId, pageLoadId });
          
          // Try to get by pageLoadId or sessionId first
          if (pageLoadId) {
            console.log('Looking up session by pageLoadId:', pageLoadId);
            session = await chatService.getSession(pageLoadId);
          } else if (sessionId) {
            console.log('Looking up session by sessionId:', sessionId);
            session = await chatService.getSession(sessionId);
          }
          
          // If not found and URL is provided, try by URL
          if (!session && url) {
            console.log('Session not found by ID, looking up by URL:', url);
            session = await chatService.getSessionByUrl(url);
          }
          
          console.log('GET_CHAT_SESSION result:', session ? 'Session found' : 'Session not found');
          
          return { success: true, data: session };
        } catch (error) {
          console.error('Error retrieving chat session:', error);
          return { success: false, error: error.message };
        }
      },
      
      'create_chat_session': async () => {
        try {
          // Create a session with default pageLoadId if not provided
          const sessionData = message.data || {};
          
          // If pageLoadId is not provided, generate one using timestamp and url hash
          if (!sessionData.pageLoadId && sessionData.url) {
            const timestamp = Date.now();
            const urlHash = sessionData.url.split('').reduce((a, b) => {
              a = ((a << 5) - a) + b.charCodeAt(0);
              return a & a;
            }, 0);
            
            sessionData.pageLoadId = `session_${timestamp}_${Math.abs(urlHash)}`;
            console.log('Generated pageLoadId:', sessionData.pageLoadId);
          } else if (!sessionData.pageLoadId) {
            sessionData.pageLoadId = `session_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
            console.log('Generated random pageLoadId:', sessionData.pageLoadId);
          }
          
          const session = await chatService.createSession({
            ...sessionData,
            timestamp: Date.now(),
            lastUpdated: Date.now()
          });
          
          return { success: true, data: session };
        } catch (error) {
          console.error('Error creating chat session:', error);
          return { success: false, error: error.message };
        }
      },
      
      'update_chat_session': async () => {
        try {
          const sessionData = message.data || {};
          if (!sessionData.pageLoadId) {
            throw new Error('pageLoadId is required');
          }
          
          const session = await chatService.updateSession({
            ...sessionData,
            lastUpdated: Date.now()
          });
          
          return { success: true, data: session };
        } catch (error) {
          console.error('Error updating chat session:', error);
          return { success: false, error: error.message };
        }
      },
      
      'delete_chat_session': async () => {
        try {
          const { pageLoadId } = message.data || {};
          if (!pageLoadId) {
            throw new Error('pageLoadId is required');
          }
          
          await chatService.deleteSession(pageLoadId);
          return { success: true };
        } catch (error) {
          console.error('Error deleting chat session:', error);
          return { success: false, error: error.message };
        }
      },
      
      // Model availability
      'check_model_availability': async () => {
        try {
          // In a real implementation, we would check which models are available
          // For now, we'll just return all models as available
          return { 
            success: true, 
            data: {
              'gpt-4o-mini': true,
              'gpt-3.5-turbo': true,
              'gpt-4': true,
              'gpt-4o': true
            }
          };
        } catch (error) {
          console.error('Error checking model availability:', error);
          return { success: false, error: error.message };
        }
      },
      
      // Content script initialization
      'contentScriptInitialized': async () => {
        try {
          console.log('Content script initialized at:', message.url);
          // Store any initialization state if needed
          return { 
            success: true, 
            message: 'Content script initialization acknowledged'
          };
        } catch (error) {
          console.error('Error handling content script initialization:', error);
          return { success: false, error: error.message };
        }
      },
      
      // Ctrl key state tracking
      'ctrlKeyPressed': async () => {
        const isHeartbeat = message.isHeartbeat || false;
        const tabId = message.tabId || (sender && sender.tab && sender.tab.id);
        
        // Only process non-heartbeat messages fully
        if (!isHeartbeat) {
          const timestamp = Date.now();
          
          // Track tab-specific state if we have a tab ID
          if (tabId) {
            if (!tabCtrlKeyStates[tabId]) {
              tabCtrlKeyStates[tabId] = {};
            }
            tabCtrlKeyStates[tabId].pressed = true;
            tabCtrlKeyStates[tabId].pending = true;
            tabCtrlKeyStates[tabId].timestamp = timestamp;
            
            console.log(`Ctrl key press detected for tab ${tabId}, storing state`);
            
            // Store in local storage using tab-specific keys
            chrome.storage.local.set({ 
              [`ctrlKeyPressed_tab_${tabId}`]: true,
              [`ctrlClickPending_tab_${tabId}`]: true,
              [`ctrlKeyPressTimestamp_tab_${tabId}`]: timestamp
            });
            
            // For backward compatibility, also update global state
            // but only if we don't have a more recent timestamp from another tab
            if (!ctrlKeyPressTimestamp || timestamp > ctrlKeyPressTimestamp) {
              ctrlKeyPressTimestamp = timestamp;
            ctrlClickPending = true;
              lastCtrlKeyState = true;
            }
          } else {
            // Fallback to global state for backward compatibility
            ctrlClickPending = true;
            ctrlKeyPressTimestamp = timestamp;
            lastCtrlKeyState = true;
            
            // Store in local storage
            chrome.storage.local.set({ 
              'ctrlKeyPressed': true,
              'ctrlClickPending': true,
              'ctrlKeyPressTimestamp': timestamp
            });
          }
          
          // Reset after a delay to prevent auto-execution issues
          setTimeout(() => {
            if (tabId && tabCtrlKeyStates[tabId]) {
              console.log(`Auto-clearing ctrlClickPending after timeout for tab ${tabId}`);
              tabCtrlKeyStates[tabId].pending = false;
            } else {
              console.log('Auto-clearing global ctrlClickPending after timeout');
                ctrlClickPending = false;
              }
            }, 5000);
          }
          
          return { success: true };
      },
      
      'getCtrlKeyState': async () => {
        const tabId = message.tabId;
        
        console.log(`Getting Ctrl key state for tab ${tabId || 'global'}`);
        
        let finalCtrlKeyState = false;
        let finalCtrlClickPending = false;
        let finalTimestamp = 0;
        
        try {
          // First check tab-specific states if tabId is provided
          if (tabId) {
            // Define tab-specific storage keys
            const tabStorageKeys = [
              `ctrlKeyPressed_tab_${tabId}`, 
              `ctrlClickPending_tab_${tabId}`, 
              `ctrlKeyPressTimestamp_tab_${tabId}`
            ];
            
            // Get values from storage
            const storedTabState = await chrome.storage.local.get(tabStorageKeys);
            
            // Use explicit equality checks for booleans
            finalCtrlKeyState = storedTabState[`ctrlKeyPressed_tab_${tabId}`] === true;
            finalCtrlClickPending = storedTabState[`ctrlClickPending_tab_${tabId}`] === true;
            finalTimestamp = storedTabState[`ctrlKeyPressTimestamp_tab_${tabId}`] || 0;
            
            console.log(`Tab-specific Ctrl state for tab ${tabId}:`, {
              pressed: finalCtrlKeyState,
              pending: finalCtrlClickPending,
              timestamp: finalTimestamp
            });
            
            // Check in-memory tab state as fallback
            const tabState = tabCtrlKeyStates[tabId];
            if (tabState) {
              if (!finalCtrlKeyState && tabState.pressed === true) {
                finalCtrlKeyState = true;
              }
              if (!finalCtrlClickPending && tabState.pending === true) {
                finalCtrlClickPending = true;
              }
              if (!finalTimestamp && tabState.timestamp) {
                finalTimestamp = tabState.timestamp;
              }
            }
          }
          
          // Check global state as fallback if we don't have definitive tab state
          if (!finalCtrlKeyState && !finalCtrlClickPending) {
            // Define global storage keys
            const globalStorageKeys = [
              'ctrlKeyPressed', 
              'ctrlClickPending', 
              'ctrlKeyPressTimestamp'
            ];
            
            // Get values from storage
            const storedGlobalState = await chrome.storage.local.get(globalStorageKeys);
            
            // Only use global values if we don't have tab-specific values
            if (!finalCtrlKeyState) {
              finalCtrlKeyState = storedGlobalState.ctrlKeyPressed === true;
            }
            if (!finalCtrlClickPending) {
              finalCtrlClickPending = storedGlobalState.ctrlClickPending === true;
            }
            if (!finalTimestamp && storedGlobalState.ctrlKeyPressTimestamp) {
              finalTimestamp = storedGlobalState.ctrlKeyPressTimestamp;
            }
            
            console.log('Global Ctrl state (fallback):', {
              pressed: storedGlobalState.ctrlKeyPressed === true,
              pending: storedGlobalState.ctrlClickPending === true,
              timestamp: storedGlobalState.ctrlKeyPressTimestamp || 0
            });
            
            // Also check in-memory global variables
            if (!finalCtrlKeyState && lastCtrlKeyState === true) {
              finalCtrlKeyState = true;
            }
            if (!finalCtrlClickPending && ctrlClickPending === true) {
              finalCtrlClickPending = true;
            }
            if (!finalTimestamp && ctrlKeyPressTimestamp) {
              finalTimestamp = ctrlKeyPressTimestamp;
            }
          }
        } catch (error) {
          console.error('Error checking stored Ctrl state:', error);
        }
        
        // Add a debug log with final result
        console.log('Final Ctrl key state to return:', {
          ctrlKeyPressed: finalCtrlKeyState,
          ctrlClickPending: finalCtrlClickPending,
          timestamp: finalTimestamp
        });
        
        return { 
          ctrlKeyPressed: finalCtrlKeyState,
          ctrlClickPending: finalCtrlClickPending,
          timestamp: finalTimestamp
        };
      },
      
      'clearCtrlKeyState': async () => {
        const tabId = message.tabId;
        
        // Different log message based on whether we're clearing globally or for a specific tab
        if (tabId) {
          console.log(`Clearing Ctrl key state for tab ${tabId}`);
        } else {
          console.log('Clearing global Ctrl key state');
        }
        
        // Reset memory state
        if (tabId && tabCtrlKeyStates[tabId]) {
          delete tabCtrlKeyStates[tabId];
        } else {
          // Reset global state if not tab-specific
          ctrlClickPending = false;
          lastCtrlKeyState = false;
          ctrlKeyPressTimestamp = 0;
        }
        
        // Clear storage keys
        if (tabId) {
          await chrome.storage.local.remove([
            `ctrlKeyPressed_tab_${tabId}`, 
            `ctrlClickPending_tab_${tabId}`, 
            `ctrlKeyPressTimestamp_tab_${tabId}`
          ]);
          } else {
          // Clear all Ctrl key state entries for cleanup
          const allStorageItems = await chrome.storage.local.get(null);
          const keysToRemove = Object.keys(allStorageItems).filter(key => 
            key.startsWith('ctrlKey') || key.startsWith('ctrlClick')
          );
          
          if (keysToRemove.length > 0) {
            await chrome.storage.local.remove(keysToRemove);
            console.log('Cleared all Ctrl key storage entries:', keysToRemove);
          }
        }
        
        return { success: true };
      },
      
      // Default handler
      'default': async () => {
        console.warn('Unknown message type:', messageType);
        return { success: false, error: 'Unknown message type' };
      },
      
      'getTabId': async () => {
        // Get the tab ID of the sender tab
        if (sender && sender.tab && sender.tab.id) {
          console.log(`Content script requested its tab ID, returning: ${sender.tab.id}`);
          return { 
            success: true, 
            tabId: sender.tab.id
          };
        }
        return { success: false, error: 'Unable to determine tab ID' };
      },
      
      // Add handler for check_ctrl_key message type
      'check_ctrl_key': async () => {
        const tabId = message.tabId;
        console.log(`Received check_ctrl_key message for tab ${tabId}`);
        
        let ctrlKeyPressed = false;
        
        try {
          // Check tab-specific Ctrl key state first
          if (tabId) {
            // Get the stored state
            const tabStorageKey = `ctrlKeyPressed_tab_${tabId}`;
            const result = await chrome.storage.local.get(tabStorageKey);
            
            ctrlKeyPressed = result[tabStorageKey] === true;
            
            // Also check in-memory state
            if (!ctrlKeyPressed && tabCtrlKeyStates[tabId] && tabCtrlKeyStates[tabId].pressed === true) {
              ctrlKeyPressed = true;
            }
          }
          
          // Fallback to global state if needed
          if (!ctrlKeyPressed) {
            const globalResult = await chrome.storage.local.get('ctrlKeyPressed');
            ctrlKeyPressed = globalResult.ctrlKeyPressed === true;
            
            // Check in-memory global state as well
            if (!ctrlKeyPressed && lastCtrlKeyState === true) {
              ctrlKeyPressed = true;
            }
          }
          
          console.log(`Ctrl key state for tab ${tabId}: ${ctrlKeyPressed}`);
          
          return {
            ctrlKeyPressed: ctrlKeyPressed,
            success: true
          };
        } catch (error) {
          console.error('Error checking Ctrl key state:', error);
          return {
            ctrlKeyPressed: false,
            success: false,
            error: error.message
          };
        }
      },
      
      // Add handler for ctrlKeyState message type
      'ctrlKeyState': async () => {
        const isPressed = message.isPressed;
        const tabId = sender && sender.tab && sender.tab.id;
        
        console.log(`Received ctrlKeyState message, isPressed=${isPressed}, tabId=${tabId}`);
        
        if (tabId) {
          // Initialize tab state object if needed
          if (!tabCtrlKeyStates[tabId]) {
            tabCtrlKeyStates[tabId] = { pressed: false, pending: false, timestamp: 0 };
          }
          
          // Update tab-specific state
          tabCtrlKeyStates[tabId].pressed = isPressed;
          
          // If key is being pressed, set pending flag for auto-execution prevention
          if (isPressed) {
            tabCtrlKeyStates[tabId].pending = true;
            tabCtrlKeyStates[tabId].timestamp = Date.now();
            
            // Also update storage
            await chrome.storage.local.set({
              [`ctrlKeyPressed_tab_${tabId}`]: true,
              [`ctrlClickPending_tab_${tabId}`]: true,
              [`ctrlKeyPressTimestamp_tab_${tabId}`]: Date.now()
            });
            
            // Auto-clear after timeout
            setTimeout(() => {
              if (tabCtrlKeyStates[tabId]) {
                console.log(`Auto-clearing ctrlClickPending for tab ${tabId} after timeout`);
                tabCtrlKeyStates[tabId].pending = false;
                chrome.storage.local.set({
                  [`ctrlClickPending_tab_${tabId}`]: false
                });
              }
            }, 5000);
          } else {
            // Key released, update storage
            await chrome.storage.local.set({
              [`ctrlKeyPressed_tab_${tabId}`]: false
            });
          }
        }
        
        return { success: true };
      },
      
      // Add handler for linkedinContentUpdated message type
      'linkedinContentUpdated': async () => {
        console.log('LinkedIn content updated, potentially refreshing scraper data');
        
        // Extract any relevant data from message
        const url = message.url || (sender && sender.tab && sender.tab.url);
        const tabId = sender && sender.tab && sender.tab.id;
        
        // Store info about the updated content if needed
        if (tabId && url) {
          // You could store information about the updated content here
          console.log(`LinkedIn content updated for tab ${tabId} at ${url}`);
        }
        
        return { success: true };
      },
      
      // Add handler for windowFocusChanged message type
      'windowFocusChanged': async () => {
        console.log('Window focus changed event received');
        
        const tabId = sender && sender.tab && sender.tab.id;
        const hasFocus = message.hasFocus === true;
        
        if (tabId) {
          console.log(`Window focus for tab ${tabId} changed to: ${hasFocus}`);
          
          // You might want to update tab focus tracking here
          // This is useful for knowing which tab the user is currently looking at
        }
        
        return { success: true };
      },
      
      // Add handler for send_user_message message type
      'send_user_message': async () => {
        console.log('Handling send_user_message request');
        
        try {
          const { 
            pageLoadId, 
            message: userMessage, 
            pageContent, 
            webSearch,
            model,
            temperature,
            url,
            title
          } = message.data || {};
          
          // Validate required inputs
          if (!userMessage) {
            throw new Error('User message is required');
          }
          
          // Log request details
          console.log('Send user message request details:', {
            pageLoadId,
            messageText: userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : ''),
            hasPageContent: !!pageContent,
            webSearch,
            model,
            temperature
          });
          
          // Get or create session
          let session = null;
          
          if (pageLoadId) {
            // Try to get existing session
            session = await chatService.getSession(pageLoadId);
          }
          
          // If no session found but we have URL/title, create a new one
          if (!session && url) {
            const sessionData = {
              pageLoadId: pageLoadId || `session_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
              url,
              title: title || url,
              messages: [],
              timestamp: Date.now(),
              lastUpdated: Date.now()
            };
            
            console.log('Creating new session:', sessionData);
            session = await chatService.createSession(sessionData);
          }
          
          if (!session) {
            throw new Error('Could not get or create a valid session');
          }
          
          // Prepare array of messages for the API call
          const messages = [];
          
          // Add system prompt depending on context
          let systemPrompt = GENERIC_SYSTEM_PROMPT;
          
          if (webSearch && pageContent) {
            systemPrompt = COMBINED_SYSTEM_PROMPT;
          } else if (webSearch) {
            systemPrompt = WEB_SEARCH_SYSTEM_PROMPT;
          } else if (!pageContent) {
            systemPrompt = NO_PAGE_CONTENT_SYSTEM_PROMPT;
          } else {
            // For page content only, use website-specific prompts if available
            if (url) {
              try {
                const urlObj = new URL(url);
                const hostname = urlObj.hostname.toLowerCase();
                
                if (hostname.includes('linkedin.com')) {
                  systemPrompt = LINKEDIN_SYSTEM_PROMPT;
                } else if (hostname.includes('github.com')) {
                  systemPrompt = GITHUB_SYSTEM_PROMPT;
                } else if (hostname.includes('stackoverflow.com')) {
                  systemPrompt = STACKOVERFLOW_SYSTEM_PROMPT;
                } else {
                  // Use generic page-aware system prompt
                  systemPrompt = generatePageAwarePrompt(url);
                  }
                } catch (e) {
                console.error('Error determining site-specific prompt:', e);
              }
            }
          }
          
          // Add system message
          messages.push({
            role: 'system',
            content: systemPrompt
          });
          
          // Add previous conversation for context
          if (session.messages && session.messages.length > 0) {
            // Only include most recent messages to stay within token limits
            const recentMessages = session.messages.slice(-10);
            messages.push(...recentMessages);
          }
          
          // Add page content as context for the assistant if available
          if (pageContent) {
            messages.push({
              role: 'system',
              content: `Page content:\n${pageContent}`
            });
          }
          
          // Add the new user message
          const newUserMessage = {
            role: 'user',
            content: userMessage,
            timestamp: Date.now()
          };
          
          messages.push(newUserMessage);
          
          // Update session with the new user message
          if (!session.messages) {
            session.messages = [];
          }
          
          session.messages.push(newUserMessage);
          session.lastUserRequest = userMessage;
          session.lastUpdated = Date.now();
          
          // Save session state
          await chatService.updateSession(session);
          
          // Call OpenAI API
          console.log(`Calling OpenAI API with model ${model || 'default'} and ${messages.length} messages`);
          
          // Get API key
          const apiKey = await storageService.getValue(STORAGE_KEYS.API_KEY);
          if (!apiKey) {
            throw new Error('OpenAI API key not found');
          }
          
          // Call API with options
          const apiOptions = {
            model: model || 'gpt-4o-mini',  // Default model
            temperature: temperature !== undefined ? temperature : 0
          };
          
          // Make the actual API call instead of using a mock response
          const apiResponse = await openaiApi.sendRequest({
            apiKey,
            messages,
            model: apiOptions.model,
            temperature: apiOptions.temperature,
            useWebSearch: webSearch || false,
            pageContent: pageContent || ''
          });
          
          // Process the API response to extract content
          const processedResponse = openaiApi.processApiResponse(apiResponse);
          
          // Add response to the session
          const assistantResponse = {
            role: 'assistant',
            content: processedResponse.content,
            timestamp: Date.now(),
            metadata: processedResponse.metadata || {}
          };
          
          // Add sources if they exist in the response
          if (processedResponse.sources) {
            assistantResponse.metadata.sources = processedResponse.sources;
          }
          
          // Check if sources are in the apiResponse directly (fallback)
          if (!assistantResponse.metadata.sources && apiResponse.sources) {
            assistantResponse.metadata.sources = apiResponse.sources;
          }
          
          // Add response to the session
          session.messages.push(assistantResponse);
          session.lastUpdated = Date.now();
          
          // Save updated session
          await chatService.updateSession(session);
          
          // Return the response
          return {
            success: true,
            data: {
              response: assistantResponse,
              session: session
            }
          };
        } catch (error) {
          console.error('Error processing user message:', error);
          return { success: false, error: error.message };
        }
      },
      
      'scrape_page_content': async () => {
        try {
          console.log('Handling page content scraping request');
          
          // Get tab to scrape (either specified or active tab)
          let tab;
          if (message.tabId) {
            try {
              tab = await chrome.tabs.get(message.tabId);
            } catch (error) {
              console.error('Failed to get tab with ID:', message.tabId, error);
              return { success: false, error: 'Tab not found or inaccessible' };
            }
          } else {
            // Get active tab in current window
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs || !tabs.length) {
              return { success: false, error: 'No active tab found' };
            }
            tab = tabs[0];
          }
          
          console.log('Processing scrape request for tab:', tab.id, tab.url);
          
          // Call the helper function that handles the actual scraping
          const result = await processScrapeTabRequest(tab);
          return result;
        } catch (error) {
          console.error('Error processing page scraping request:', error);
          return { 
            success: false, 
            error: error.message || 'Unknown error scraping page',
            data: { content: '' }
          };
        }
      }
    };
    
    // Get the appropriate handler or use default
    const handler = handlers[messageType] || handlers['default'];
    
    // Execute the handler and send response
    handler().then(response => {
      sendResponse(response);
    }).catch(error => {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  });
}

/**
 * Set up handlers for extension installation and updates
 */
function setupExtensionHandlers() {
  // Handle extension installation
  chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
    if (reason === 'install') {
      console.log('Extension installed');
      await handleFirstInstall();
    } else if (reason === 'update') {
      console.log(`Extension updated from ${previousVersion}`);
      await handleUpdate(previousVersion);
    }
  });
  
  // Handle extension startup
  chrome.runtime.onStartup.addListener(() => {
    console.log('Extension started');
  });
}

/**
 * Handle first installation of the extension
 */
async function handleFirstInstall() {
  // Set default preferences
  await storageService.setValue(STORAGE_KEYS.USER_PREFERENCES, {
    theme: 'light',
    temperature: 0.7,
    pageScraping: true,
    webSearch: true,
    currentSiteFilter: true,
    defaultModel: 'gpt-4o-mini',
    autoExecute: true // Enable auto-execution by default
  });
  
  // Initialize empty chat sessions list
  await storageService.setValue(STORAGE_KEYS.CHAT_SESSIONS, []);
  
  // Initialize empty global_last_user_input
  await storageService.setValue('global_last_user_input', '');
  
  // Initialize empty execute_last_input
  await storageService.setValue('execute_last_input', {
    value: '',
    timestamp: Date.now(),
    tabId: null,
    url: ''
  });
  
  // Log installation
  await storageService.storeDebugLog({
    type: 'installation',
    message: 'Extension installed',
    data: { timestamp: Date.now() }
  });
  
  // Open onboarding page
  chrome.tabs.create({
    url: chrome.runtime.getURL('onboarding.html')
  });
}

/**
 * Handle extension update
 * 
 * @param {string} previousVersion - The previous version of the extension
 */
async function handleUpdate(previousVersion) {
  // Log update
  await storageService.storeDebugLog({
    type: 'update',
    message: `Extension updated from ${previousVersion}`,
    data: { 
      previousVersion,
      timestamp: Date.now()
    }
  });
  
  // Perform data migrations if needed
  await performDataMigrations(previousVersion);
}

/**
 * Perform data migrations when updating from previous versions
 * 
 * @param {string} previousVersion - The previous version of the extension
 */
async function performDataMigrations(previousVersion) {
  // Convert version string to number for comparison
  const versionParts = previousVersion.split('.').map(Number);
  
  // Example: If updating from before version 2.0.0
  if (versionParts[0] < 2) {
    console.log('Performing migration for pre-2.0.0 version');
    
    // Here you would perform data migrations specific to this version change
    // For example, moving data from one storage format to another
  }
  
  // More migrations can be added here as needed
}

/**
 * Inject content script if not already present
 * 
 * @param {number} tabId - The ID of the tab to inject into
 */
async function injectContentScriptIfNeeded(tabId) {
  try {
    console.log('Injecting content script into tab:', tabId);
    
    // Check if we can execute scripts in this tab
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => true,
    });
    
    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    
    console.log('Content script injected successfully');
  } catch (error) {
    console.error('Error injecting content script:', error);
    throw error;
  }
}

/**
 * Helper function to process a tab for content scraping
 * @param {object} tab - The tab to scrape content from
 * @returns {object} - Response object with scraped content or error
 */
async function processScrapeTabRequest(tab) {
  console.log('Processing scrape request for tab:', tab.id, tab.url, 'in window:', tab.windowId);
  
  // Check if we can scrape this URL (avoid chrome:// urls etc.)
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    console.warn('Cannot scrape content from this type of URL:', tab.url);
    return { 
      success: false, 
      error: 'Cannot scrape content from this type of URL',
      data: {
        content: `This page (${tab.url}) cannot be scraped due to browser security restrictions.`,
        title: tab.title || '',
        url: tab.url || ''
      }
    };
  }
  
  // Try to send a message to the content script
  try {
    console.log('Sending scrapeContent message to tab:', tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeContent' });
    
    if (!response || !response.content) {
      console.warn('Content script returned empty or invalid response');
      return { 
        success: false, 
        error: 'Failed to retrieve content from page',
        data: {
          content: '',
          title: tab.title || '',
          url: tab.url || ''
        }
      };
    }
    
    console.log(`Successfully scraped ${response.content.length} characters from page`);
    return { 
      success: true, 
      data: {
        content: response.content,
        title: tab.title || '',
        url: tab.url || ''
      }
    };
  } catch (error) {
    console.error('Error communicating with content script:', error);
    
    // Since content script communication failed, try injecting the content script
    console.log('Attempting to inject content script and retry...');
    try {
      await injectContentScriptIfNeeded(tab.id);
      
      // Wait a moment for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try again after injection
      console.log('Retrying scrapeContent after script injection');
      const retryResponse = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeContent' });
      
      if (!retryResponse || !retryResponse.content) {
        throw new Error('Content script returned empty response after injection');
      }
      
      console.log(`Successfully scraped ${retryResponse.content.length} characters after script injection`);
      return { 
        success: true, 
        data: {
          content: retryResponse.content,
          title: tab.title || '',
          url: tab.url || ''
        }
      };
    } catch (retryError) {
      console.error('Failed to scrape content after script injection:', retryError);
      return { 
        success: false, 
        error: 'Failed to scrape page content after script injection',
        data: {
          content: `Failed to extract content from ${tab.url}. Please refresh the page and try again.`,
          title: tab.title || '',
          url: tab.url || ''
        }
      };
    }
  }
}

/**
 * Close all popups except the one with the given ID
 * @param {string} currentContextId - The contextId of the popup to keep open
 * @param {string} currentPopupId - The unique popup ID to keep open
 */
function closeOtherPopups(currentContextId, currentPopupId) {
  console.log(`Closing all popups except: contextId=${currentContextId}, popupId=${currentPopupId}`);
  
  // Update the active popup ID in storage
  chrome.storage.local.set({ activePopupId: currentPopupId });
  
  // Send message to all active popups to close if they're not the current one
  activePopupPorts.forEach(port => {
    if (port.sender.contextId !== currentContextId) {
      try {
        console.log(`Sending close message to popup: ${port.sender.contextId}`);
        port.postMessage({ 
          action: 'closePopup', 
          reason: 'Another popup was opened',
          newActivePopupId: currentPopupId
        });
      } catch (error) {
        console.error(`Error sending close message to popup: ${port.sender.contextId}`, error);
      }
    }
  });
}

/**
 * Handle clicks on the browser action (extension icon)
 * Modified to work with automatic execution on popup open and detect Ctrl key
 */
function setupBrowserActionClickHandler() {
  // We'll add a listener for the onClicked event that Chrome provides for browser actions
  // This won't fire when popup is present, but will help us track Ctrl key state
  chrome.action.onClicked.addListener(async (tab) => {
    console.log('Browser action clicked, letting Chrome handle popup opening');
  });
  
  // Note: Ctrl key detection is now handled in the main message listener
  // in setupMessageListeners() to avoid duplicate handlers
}

// Keep handleDoubleClick for backward compatibility
async function handleDoubleClick(tab) {
  // This function is kept for backward compatibility
  // but is no longer used with our new approach
  console.log('Legacy function: handleDoubleClick is no longer used');
}

/**
 * Handle keyboard commands for extension functionality
 */
function setupKeyboardCommandHandler() {
  // Listen for keyboard shortcuts
  chrome.commands.onCommand.addListener(async (command) => {
    console.log('Keyboard command received:', command);
    
    if (command === 'run-page-inference') {
      try {
        // Get the active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || !tabs.length) {
          console.error('No active tab found');
          return;
        }
        
        const tab = tabs[0];
        const tabId = tab.id;
        const url = tab.url;
        
        // Get the most recent chat session for the current domain
        const chatSessions = await chatService.getSessionList();
        
        // Find sessions for the current domain
        const domainSessions = chatSessions.filter(session => {
          try {
            // Compare domain of session URL with current tab URL
            const sessionUrl = new URL(session.url);
            const tabUrl = new URL(url);
            return sessionUrl.hostname === tabUrl.hostname;
          } catch (e) {
            return false;
          }
        });
        
        // Sort by most recent first
        const sortedSessions = domainSessions.sort((a, b) => 
          (b.lastUpdated || b.timestamp) - (a.lastUpdated || a.timestamp)
        );
        
        if (sortedSessions.length === 0) {
          console.log('No previous chat sessions found for current domain');
          return;
        }
        
        const mostRecentSession = sortedSessions[0];
        console.log('Found most recent session:', mostRecentSession);
        
        // Get the most recent user message
        let lastUserMessage = null;
        
        if (mostRecentSession.messages && mostRecentSession.messages.length > 0) {
          // Find all user messages
          const userMessages = mostRecentSession.messages.filter(msg => 
            msg && msg.role === 'user'
          );
          
          if (userMessages.length > 0) {
            lastUserMessage = userMessages[userMessages.length - 1].content;
          }
        }
        
        // If we didn't find a user message, try using lastUserRequest
        if (!lastUserMessage && mostRecentSession.lastUserRequest) {
          lastUserMessage = mostRecentSession.lastUserRequest;
        }
        
        if (!lastUserMessage) {
          console.log('No previous user message found to execute');
          return;
        }
        
        // Store the message for execution
        await chrome.storage.local.set({
          'execute_last_input': {
            value: lastUserMessage,
            tabId,
            url,
            pageLoadId: mostRecentSession.pageLoadId,
            timestamp: Date.now()
          }
        });
        
        console.log('Stored last user input for execution:', lastUserMessage);
        
        // Set badge to indicate the shortcut was used
        await chrome.action.setBadgeText({ text: '↵' });
        await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
        await chrome.action.setTitle({ title: 'Click to run: "' + lastUserMessage + '"' });
        
        // Flash the badge with alternating colors to make it more noticeable
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            chrome.action.setBadgeBackgroundColor({ color: '#FFEB3B' });
          }, i * 400);
          setTimeout(() => {
            chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
          }, i * 400 + 200);
        }
      } catch (error) {
        console.error('Error handling keyboard command:', error);
      }
    }
  });
}

// Start initialization
initialize();
setupKeyboardCommandHandler();
setupBrowserActionClickHandler(); 