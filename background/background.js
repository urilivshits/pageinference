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
  generatePageAwarePrompt,
  getSystemPrompt
} from '../shared/prompts/generic.js';

import {
  LINKEDIN_SYSTEM_PROMPT,
  GITHUB_SYSTEM_PROMPT,
  STACKOVERFLOW_SYSTEM_PROMPT
} from '../shared/prompts/website-specific.js';

// Import OpenAI service and logger
import openaiApi from './api/openai.js';
import logger from '../shared/utils/logger.js';
import { DEFAULT_SETTINGS } from '../shared/models/settings.js';

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
  // Removed GLOBAL_LAST_USER_INPUT - now using unified execute_last_input storage
  // Add other storage keys as needed
};

/**
 * Initialize the background script
 */
async function initialize() {
  try {
    logger.init('Background script initializing', null, 'background');
    
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
        logger.session(`Retrieved ${sessions.length} chat sessions`);
        return sessions;
      },
      
      // Get a specific chat session
      getSession: async function(sessionId) {
        logger.session(`Getting session: ${sessionId}`);
        
        if (!sessionId) {
          logger.warn('No sessionId provided to getSession');
          return null;
        }
        
        const sessions = await this.getSessionList();
        const session = sessions.find(session => session.pageLoadId === sessionId);
        
        if (!session) {
          logger.session(`Session not found: ${sessionId}`);
        }
        
        return session || null;
      },
      
      // Get session by URL
      getSessionByUrl: async function(url) {
        logger.session(`Getting session by URL: ${url}`);
        
        if (!url) {
          logger.warn('No URL provided to getSessionByUrl');
          return null;
        }
        
        const sessions = await this.getSessionList();
        const session = sessions.find(session => session.url === url);
        
        if (!session) {
          logger.session(`No session found for URL: ${url}`);
        }
        
        return session || null;
      },
      
      // Create a new chat session
      createSession: async function(sessionData) {
        if (!sessionData.pageLoadId) {
          logger.error('Cannot create session without pageLoadId');
          throw new Error('pageLoadId is required to create a session');
        }
        
        logger.session(`Creating new chat session: ${sessionData.pageLoadId}`);
        
        const sessions = await this.getSessionList();
        
        // Check if session with this ID already exists
        const existingIndex = sessions.findIndex(s => s.pageLoadId === sessionData.pageLoadId);
        
        if (existingIndex !== -1) {
          logger.session('Session already exists, updating instead');
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
        logger.session('Session created successfully');
        return createdSession;
      },
      
      // Update an existing chat session
      updateSession: async function(sessionData) {
        if (!sessionData.pageLoadId) {
          logger.error('Cannot update session without pageLoadId');
          throw new Error('pageLoadId is required to update a session');
        }
        
        logger.session(`Updating session: ${sessionData.pageLoadId}`);
        
        const sessions = await this.getSessionList();
        const index = sessions.findIndex(s => s.pageLoadId === sessionData.pageLoadId);
        
        if (index !== -1) {
          // Update existing session with new data
          sessions[index] = {
            ...sessions[index],
            ...sessionData,
            lastUpdated: Date.now()
          };
        } else {
          logger.session('Session not found, creating new one');
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
        logger.session('Session updated successfully');
        return updatedSession;
      },
      
      // Delete a chat session
      deleteSession: async function(pageLoadId) {
        logger.session(`Deleting session: ${pageLoadId}`);
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
        logger.info('Extension installed', null, 'background');
        await handleFirstInstall();
      } else if (details.reason === 'update') {
        const previousVersion = details.previousVersion;
        logger.info(`Extension updated from ${previousVersion} to ${chrome.runtime.getManifest().version}`, null, 'background');
        await handleUpdate(previousVersion);
      }
    });
    
    // Initialize debug mode if enabled
    const debugMode = await storageService.getValue(STORAGE_KEYS.DEBUG_MODE, false);
    if (debugMode) {
      logger.info('Debug mode enabled', null, 'background');
      await storageService.storeDebugLog({
        type: 'initialization',
        message: 'Background script initialized',
        data: { timestamp: Date.now() }
      });
    }
    
    logger.success('Background script initialized successfully', null, 'background');
    return true;
  } catch (error) {
    logger.error('Error initializing background script:', error);
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
        logger.debug(`Cleaning up storage for closed tab ${tabId}`);
        for (const key of Object.keys(allStorageItems)) {
          if (key.includes(`_tab_${tabId}`)) {
            keysToRemove.push(key);
          }
        }
      }
    }
    
    // Run cleanup if we found keys to remove
    if (keysToRemove.length > 0) {
      logger.debug(`Removing ${keysToRemove.length} stale storage keys`);
      await chrome.storage.local.remove(keysToRemove);
    }
  } catch (error) {
    logger.error('Error cleaning up storage:', error);
  }
}

/**
 * Set up message listeners with proper async response handling
 */
function setupMessageListeners() {
  // Setup long-lived connections to track popup instances
  chrome.runtime.onConnect.addListener(port => {
    if (port.name === 'popup') {
      logger.debug(`New popup connected: ${port.sender.contextId}`);
      let registeredPopupId = null;
      
      // Listen for registration message from the popup
      port.onMessage.addListener((message) => {
        if (message.action === 'registerPopup' && message.popupId) {
          registeredPopupId = message.popupId;
          logger.debug(`Popup registered: ${registeredPopupId}`);
          
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
        logger.debug(`Popup disconnected: ${registeredPopupId || port.sender.contextId}`);
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
              logger.debug(`Cleared popup ID from storage: ${registeredPopupId}`);
            }
          });
        }
      });
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logger.debug(`Received message: ${message.type || message.action}`);
    
    // Support both message.type and message.action for backwards compatibility
    const messageType = message.type || message.action;
    
    // Special handling for popup initialization event
    if (messageType === 'popupInitialized') {
      logger.debug('Popup initialized, running storage cleanup');
      cleanupLegacyStorage();
      sendResponse({ success: true });
      return true;
    }
    
    if (message.action === 'getCtrlKeyState') {
      const tabId = message.tabId;
      logger.debug(`Getting Ctrl key state for tab ${tabId}`);

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
        
        logger.debug(`Ctrl key state for tab ${tabId}:`, {
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
      logger.debug(`Clearing Ctrl key state for tab ${tabId}`);
      
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
        logger.debug('Ctrl key state cleared');
        sendResponse({ success: true });
      });
      
      return true; // Keep the message channel open for async response
    }
    
    // Handle message based on type or action
    const handlers = {
      // API key related messages
      'get_api_key': async () => {
        try {
          logger.log('Getting API key');
          const apiKey = await storageService.getValue(STORAGE_KEYS.API_KEY, null);
          logger.log('API key exists:', !!apiKey);
          return { success: true, data: apiKey };
        } catch (error) {
          logger.error('Error retrieving API key:', error);
          return { success: false, error: error.message };
        }
      },
      
      'set_api_key': async () => {
        try {
          const { apiKey } = message.data || {};
          await storageService.setValue(STORAGE_KEYS.API_KEY, apiKey);
          return { success: true };
        } catch (error) {
          logger.error('Error setting API key:', error);
          return { success: false, error: error.message };
        }
      },
      
      'test_api_key': async () => {
        try {
          // In a real implementation, we would test the API key
          // For now, we'll just return success
          return { success: true };
        } catch (error) {
          logger.error('Error testing API key:', error);
          return { success: false, error: error.message };
        }
      },
      
      // Settings related messages
      'get_settings': async () => {
        try {
          const settings = await storageService.getValue(STORAGE_KEYS.USER_PREFERENCES, {});
          return { success: true, data: settings };
        } catch (error) {
          logger.error('Error retrieving settings:', error);
          return { success: false, error: error.message };
        }
      },
      
      'get_user_preferences': async () => {
        try {
          const settings = await storageService.getValue(STORAGE_KEYS.USER_PREFERENCES, {});
          return { success: true, data: settings };
        } catch (error) {
          logger.error('Error retrieving user preferences:', error);
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
          logger.error('Error updating user preferences:', error);
          return { success: false, error: error.message };
        }
      },
      
      'set_settings': async () => {
        try {
          const { settings } = message.data || {};
          await storageService.setValue(STORAGE_KEYS.USER_PREFERENCES, settings);
          return { success: true };
        } catch (error) {
          logger.error('Error saving settings:', error);
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
          logger.error('Error retrieving session list:', error);
          return { success: false, error: error.message };
        }
      },
      
      'get_session': async () => {
        try {
          const { sessionId } = message.data || {};
          const session = await chatService.getSession(sessionId);
          return { success: true, data: session };
        } catch (error) {
          logger.error('Error retrieving session:', error);
          return { success: false, error: error.message };
        }
      },
      
      'get_chat_session': async () => {
        try {
          const { url, sessionId, pageLoadId } = message.data || {};
          
          let session = null;
          
          // Log the request parameters for debugging
          logger.log('GET_CHAT_SESSION request params:', { url, sessionId, pageLoadId });
          
          // Try to get by pageLoadId or sessionId first
          if (pageLoadId) {
            logger.log('Looking up session by pageLoadId:', pageLoadId);
            session = await chatService.getSession(pageLoadId);
          } else if (sessionId) {
            logger.log('Looking up session by sessionId:', sessionId);
            session = await chatService.getSession(sessionId);
          }
          
          // If not found and URL is provided, try by URL
          if (!session && url) {
            logger.log('Session not found by ID, looking up by URL:', url);
            session = await chatService.getSessionByUrl(url);
          }
          
          logger.log('GET_CHAT_SESSION result:', session ? 'Session found' : 'Session not found');
          
          return { success: true, data: session };
        } catch (error) {
          logger.error('Error retrieving chat session:', error);
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
            logger.log('Generated pageLoadId:', sessionData.pageLoadId);
          } else if (!sessionData.pageLoadId) {
            sessionData.pageLoadId = `session_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
            logger.log('Generated random pageLoadId:', sessionData.pageLoadId);
          }
          
          const session = await chatService.createSession({
            ...sessionData,
            timestamp: Date.now(),
            lastUpdated: Date.now()
          });
          
          return { success: true, data: session };
        } catch (error) {
          logger.error('Error creating chat session:', error);
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
          logger.error('Error updating chat session:', error);
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
          logger.error('Error deleting chat session:', error);
          return { success: false, error: error.message };
        }
      },
      
      // Model availability
      'check_model_availability': async () => {
        try {
          // Import constants to use centralized model list
          const { API_CONSTANTS } = await import('../shared/constants.js');
          
          // Create availability object from centralized model list
          const modelAvailability = {};
          API_CONSTANTS.AVAILABLE_MODELS.forEach(model => {
            modelAvailability[model.value] = true;
          });
          
          return { 
            success: true, 
            data: modelAvailability
          };
        } catch (error) {
          logger.error('Error checking model availability:', error);
          return { success: false, error: error.message };
        }
      },
      
      // Content script initialization
      'contentScriptInitialized': async () => {
        try {
          logger.log('Content script initialized at:', message.url);
          // Store any initialization state if needed
          return { 
            success: true, 
            message: 'Content script initialization acknowledged'
          };
        } catch (error) {
          logger.error('Error handling content script initialization:', error);
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
            
            logger.log(`Ctrl key press detected for tab ${tabId}, storing state`);
            
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
              logger.log(`Auto-clearing ctrlClickPending after timeout for tab ${tabId}`);
              tabCtrlKeyStates[tabId].pending = false;
            } else {
              logger.log('Auto-clearing global ctrlClickPending after timeout');
                ctrlClickPending = false;
              }
            }, 10000); // Increased timeout for better ctrl+click detection
          }
          
          return { success: true };
      },
      
      'getCtrlKeyState': async () => {
        const tabId = message.tabId;
        
        logger.log(`Getting Ctrl key state for tab ${tabId || 'global'}`);
        
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
            
            logger.log(`Tab-specific Ctrl state for tab ${tabId}:`, {
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
            
            logger.log('Global Ctrl state (fallback):', {
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
          logger.error('Error checking stored Ctrl state:', error);
        }
        
        // Add a debug log with final result
        logger.log('Final Ctrl key state to return:', {
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
      
      'extendCtrlKeyTimeout': async () => {
        const tabId = message.tabId;
        const duration = message.duration || 5000;
        
        logger.debug(`Extending Ctrl key timeout for tab ${tabId} by ${duration}ms`);
        
        // Clear any existing timeout for this tab
        if (tabId && tabCtrlKeyStates[tabId]) {
          // Extend the timeout for this tab
          setTimeout(() => {
            if (tabCtrlKeyStates[tabId]) {
              logger.debug(`Auto-clearing ctrlClickPending for tab ${tabId} after extended timeout`);
              tabCtrlKeyStates[tabId].pending = false;
              chrome.storage.local.set({
                [`ctrlClickPending_tab_${tabId}`]: false
              });
            }
          }, duration);
          
          // Also update the timestamp to reflect the extension
          tabCtrlKeyStates[tabId].timestamp = Date.now();
          chrome.storage.local.set({
            [`ctrlKeyPressTimestamp_tab_${tabId}`]: Date.now()
          });
        }
        
        return { success: true };
      },
      
      'clearCtrlKeyState': async () => {
        const tabId = message.tabId;
        
        // Different log message based on whether we're clearing globally or for a specific tab
        if (tabId) {
          logger.log(`Clearing Ctrl key state for tab ${tabId}`);
        } else {
          logger.log('Clearing global Ctrl key state');
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
            logger.log('Cleared all Ctrl key storage entries:', keysToRemove);
          }
        }
        
        return { success: true };
      },
      
      // Default handler
      'default': async () => {
        logger.warn('Unknown message type:', messageType);
        return { success: false, error: 'Unknown message type' };
      },
      
      'getTabId': async () => {
        // Get the tab ID of the sender tab
        if (sender && sender.tab && sender.tab.id) {
          logger.log(`Content script requested its tab ID, returning: ${sender.tab.id}`);
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
        logger.log(`Checking Ctrl key state for tab ${tabId || 'global'}`);
        
        const isPending = tabId && tabCtrlKeyStates[tabId] ? 
          tabCtrlKeyStates[tabId].pending : 
          ctrlClickPending;
          
        const ctrlKeyPressed = tabId && tabCtrlKeyStates[tabId] ? 
          tabCtrlKeyStates[tabId].pressed || isPending : 
          ctrlKeyPressed || isPending;
        
        return { ctrlKeyPressed };
      },
      
      // Add handler for ctrlKeyState message type
      'ctrlKeyState': async () => {
        const isPressed = message.isPressed;
        // Use tabId from message if available, fallback to sender tab ID
        const tabId = message.tabId || (sender && sender.tab && sender.tab.id);
        
        logger.log(`Received ctrlKeyState message, isPressed=${isPressed}, tabId=${tabId}`);
        
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
                logger.log(`Auto-clearing ctrlClickPending for tab ${tabId} after timeout`);
                tabCtrlKeyStates[tabId].pending = false;
                chrome.storage.local.set({
                  [`ctrlClickPending_tab_${tabId}`]: false
                });
              }
            }, 10000); // Increased timeout for better ctrl+click detection
          } else {
            // Key released - update pressed state but keep pending state for popup detection
            // Do NOT clear the pending flag here - let popup check it or timeout clear it
            await chrome.storage.local.set({
              [`ctrlKeyPressed_tab_${tabId}`]: false
            });
            
            // Keep the pending state for popup to detect ctrl+click
            // Only clear memory pressed state, not pending
            if (tabCtrlKeyStates[tabId]) {
              tabCtrlKeyStates[tabId].pressed = false;
              // Leave pending and timestamp unchanged for popup detection
            }
          }
        }
        
        return { success: true };
      },
      
      // Add handler for linkedinContentUpdated message type
      'linkedinContentUpdated': async () => {
        logger.log('LinkedIn content updated, potentially refreshing scraper data');
        
        // Extract any relevant data from message
        const url = message.url || (sender && sender.tab && sender.tab.url);
        const tabId = sender && sender.tab && sender.tab.id;
        
        // Store info about the updated content if needed
        if (tabId && url) {
          // You could store information about the updated content here
          logger.log(`LinkedIn content updated for tab ${tabId} at ${url}`);
        }
        
        return { success: true };
      },
      
      // Add handler for windowFocusChanged message type
      'windowFocusChanged': async () => {
        logger.log('Window focus changed event received');
        
        const tabId = sender && sender.tab && sender.tab.id;
        const hasFocus = message.hasFocus === true;
        
        if (tabId) {
          logger.log(`Window focus for tab ${tabId} changed to: ${hasFocus}`);
          
          // You might want to update tab focus tracking here
          // This is useful for knowing which tab the user is currently looking at
        }
        
        return { success: true };
      },
      
      // Add handler for send_user_message message type
      'send_user_message': async () => {
        logger.log('Handling send_user_message request');
        
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
          logger.log('Send user message request details:', {
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
            
            logger.log('Creating new session:', sessionData);
            session = await chatService.createSession(sessionData);
          }
          
          if (!session) {
            throw new Error('Could not get or create a valid session');
          }
          
          // Prepare array of messages for the API call
          const messages = [];

          // Only add the system message if it's not already present in the session
          if (!session.messages || session.messages.length === 0 || session.messages[0].role !== 'system') {
            // Add system message with page content if available
            messages.push({
              role: 'system',
              content: getSystemPrompt(url, !!pageContent, pageContent)
            });
          } else {
            // Use the existing system message from the session
            messages.push(session.messages[0]);
          }

          // Add previous conversation for context (excluding any system messages)
          if (session.messages && session.messages.length > 0) {
            // Only include most recent messages to stay within token limits, skip system
            const recentMessages = session.messages.filter(m => m.role !== 'system').slice(-10);
            messages.push(...recentMessages);
          }

          // Add the new user message (do NOT append page content)
          const newUserMessage = {
            role: 'user',
            content: userMessage,
            timestamp: Date.now(), // Keep for backward compatibility
            requestTime: Date.now() // New field for request timestamp
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
          logger.log(`Calling OpenAI API with model ${model || 'default'} and ${messages.length} messages`);

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
            pageContent: '', // Do not append page content to user message
          });

          // Process the API response to extract content
          const processedResponse = openaiApi.processApiResponse(apiResponse);
          
          // Add response to the session
          const assistantResponse = {
            role: 'assistant',
            content: processedResponse.content,
            timestamp: Date.now(), // Keep for backward compatibility
            responseTime: Date.now(), // New field for response timestamp
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
          logger.error('Error processing user message:', error);
          return { success: false, error: error.message };
        }
      },
      
      'scrape_page_content': async () => {
        try {
          logger.log('Handling page content scraping request');
          
          // Get tab to scrape (either specified or active tab)
          let tab;
          const tabId = message.tabId || (message.data && message.data.tabId);
          if (tabId) {
            try {
              tab = await chrome.tabs.get(tabId);
            } catch (error) {
              logger.error('Failed to get tab with ID:', tabId, error);
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
          
          logger.log('Processing scrape request for tab:', tab.id, tab.url);
          
          // Call the helper function that handles the actual scraping
          const result = await processScrapeTabRequest(tab);
          return result;
        } catch (error) {
          logger.error('Error processing page scraping request:', error);
          return { 
            success: false, 
            error: error.message || 'Unknown error scraping page',
            data: { content: '' }
          };
        }
      },
      
      'injectContentScript': async () => {
        try {
          const { tabId } = message;
          
          if (!tabId) {
            throw new Error('tabId is required for content script injection');
          }
          
          logger.log(`Handling request to inject content script into tab ${tabId}`);
          
          await injectContentScriptIfNeeded(tabId);
          
          return { 
            success: true, 
            message: `Content script injected into tab ${tabId}` 
          };
        } catch (error) {
          logger.error('Error injecting content script:', error);
          return { 
            success: false, 
            error: error.message 
          };
        }
      },
      
      'ping': async () => {
        return { success: true, message: 'Content script is running' };
      }
    };
    
    // Get the appropriate handler or use default
    const handler = handlers[messageType] || handlers['default'];
    
    // Execute the handler and send response
    handler().then(response => {
      sendResponse(response);
    }).catch(error => {
      logger.error('Error handling message:', error);
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
      logger.log('Extension installed');
      await handleFirstInstall();
    } else if (reason === 'update') {
      logger.log(`Extension updated from ${previousVersion}`);
      await handleUpdate(previousVersion);
    }
  });
  
  // Handle extension startup
  chrome.runtime.onStartup.addListener(() => {
    logger.log('Extension started');
  });
}

/**
 * Handle first installation of the extension
 */
async function handleFirstInstall() {
  // Set default preferences
  await storageService.setValue(STORAGE_KEYS.USER_PREFERENCES, DEFAULT_SETTINGS);
  
  // Initialize empty chat sessions list
  await storageService.setValue(STORAGE_KEYS.CHAT_SESSIONS, []);
  
  // Note: Removed global_last_user_input initialization - now using unified execute_last_input storage
  
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
    logger.log('Performing migration for pre-2.0.0 version');
    
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
    logger.log('Injecting content script into tab:', tabId);
    
    // Check if we can execute scripts in this tab
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => true,
    });
    
    // Inject the module loader which loads the refactored content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['module-loader.js']
    });
    
    logger.success('Content script injected successfully', null, 'background');
  } catch (error) {
    logger.error('Error injecting content script:', error);
    throw error;
  }
}

/**
 * Helper function to process a tab for content scraping
 * @param {object} tab - The tab to scrape content from
 * @returns {object} - Response object with scraped content or error
 */
async function processScrapeTabRequest(tab) {
  logger.log('Processing scrape request for tab:', tab.id, tab.url, 'in window:', tab.windowId);
  
  // Check if we can scrape this URL (avoid chrome:// urls etc.)
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    logger.warn('Cannot scrape content from this type of URL:', tab.url);
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
    console.log('[Page Inference] BACKGROUND: Sending scrapeContent message to tab:', tab.id, 'URL:', tab.url);
    logger.log('Sending scrapeContent message to tab:', tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeContent' });
    console.log('[Page Inference] BACKGROUND: Received response from content script:', response);
    
    if (!response || !response.content) {
      logger.warn('Content script returned empty or invalid response');
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
    
    logger.log(`Successfully scraped ${response.content.length} characters from page`);
    return { 
      success: true, 
      data: {
        content: response.content,
        title: tab.title || '',
        url: tab.url || ''
      }
    };
  } catch (error) {
    logger.error('Error communicating with content script:', error);
    
    // Since content script communication failed, try injecting the content script
    logger.log('Attempting to inject content script and retry...');
    try {
      await injectContentScriptIfNeeded(tab.id);
      
      // Wait longer for the script to fully initialize and set up message listeners
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // First test if content script is responding with a ping
      logger.log('Testing content script connectivity with ping');
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        logger.log('Content script ping successful');
      } catch (pingError) {
        logger.warn('Content script still not responding after injection, trying longer wait');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Try again after injection
      logger.log('Retrying scrapeContent after script injection');
      const retryResponse = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeContent' });
      
      if (!retryResponse || !retryResponse.content) {
        throw new Error('Content script returned empty response after injection');
      }
      
      logger.log(`Successfully scraped ${retryResponse.content.length} characters after script injection`);
      return { 
        success: true, 
        data: {
          content: retryResponse.content,
          title: tab.title || '',
          url: tab.url || ''
        }
      };
    } catch (retryError) {
      logger.error('Failed to scrape content after script injection:', retryError);
      // Return success with empty content to allow the request to proceed without page content
      // This prevents the "Failed to extract page content" error from stopping the entire request
      return { 
        success: true, 
        data: {
          content: '', // Empty content, will trigger "without page content" flow
          title: tab.title || '',
          url: tab.url || '',
          note: 'Page content extraction failed, proceeding without page context'
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
  logger.log(`Closing all popups except: contextId=${currentContextId}, popupId=${currentPopupId}`);
  
  // Update the active popup ID in storage
  chrome.storage.local.set({ activePopupId: currentPopupId });
  
  // Send message to all active popups to close if they're not the current one
  activePopupPorts.forEach(port => {
    if (port.sender.contextId !== currentContextId) {
      try {
        logger.log(`Sending close message to popup: ${port.sender.contextId}`);
        port.postMessage({ 
          action: 'closePopup', 
          reason: 'Another popup was opened',
          newActivePopupId: currentPopupId
        });
      } catch (error) {
        logger.error(`Error sending close message to popup: ${port.sender.contextId}`, error);
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
    logger.log('Browser action clicked, letting Chrome handle popup opening');
  });
  
  // Note: Ctrl key detection is now handled in the main message listener
  // in setupMessageListeners() to avoid duplicate handlers
}

// Keep handleDoubleClick for backward compatibility
async function handleDoubleClick(tab) {
  // This function is kept for backward compatibility
  // but is no longer used with our new approach
  logger.log('Legacy function: handleDoubleClick is no longer used');
}

/**
 * Handle keyboard commands for extension functionality
 */
function setupKeyboardCommandHandler() {
  // Listen for keyboard shortcuts
  chrome.commands.onCommand.addListener(async (command) => {
    logger.log('Keyboard command received:', command);
    
    if (command === 'run-page-inference') {
      try {
        // Get the active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || !tabs.length) {
          logger.error('No active tab found');
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
          logger.log('No previous chat sessions found for current domain');
          return;
        }
        
        const mostRecentSession = sortedSessions[0];
        logger.log('Found most recent session:', mostRecentSession);
        
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
          logger.log('No previous user message found to execute');
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
        
        logger.log('Stored last user input for execution:', lastUserMessage);
        
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
        logger.error('Error handling keyboard command:', error);
      }
    }
  });
}

// Start initialization
initialize();
setupKeyboardCommandHandler();
setupBrowserActionClickHandler(); 