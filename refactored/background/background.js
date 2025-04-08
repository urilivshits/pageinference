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
      // When popup is opened, immediately capture the tab it was opened from
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0) {
          const currentTab = tabs[0];
          popupOpenedFromTabId = currentTab.id;
          popupOpenedFromWindowId = currentTab.windowId;
          popupOpenedFromUrl = currentTab.url;
          console.log(`Popup opened from tab: ${popupOpenedFromTabId}, window: ${popupOpenedFromWindowId}, URL: ${popupOpenedFromUrl}`);
          
          // Send response indicating we captured the tab
          if (sendResponse) {
            sendResponse({ success: true, message: 'Popup initialization captured' });
          }
        }
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
      'ctrlKeyState': async () => {
        try {
          const isPressed = message.isPressed || false;
          
          console.log('BACKGROUND: Ctrl key state updated:', isPressed);
          
          // If Ctrl key is pressed and wasn't pressed before, set pending flag
          if (isPressed && !lastCtrlKeyState) {
            ctrlClickPending = true;
            console.log('BACKGROUND: Ctrl+Click pending set to true');
            
            // Clear any existing timeout
            if (ctrlClickTimeoutId) {
              clearTimeout(ctrlClickTimeoutId);
            }
            
            // Set timeout to clear the pending flag after 5 seconds
            ctrlClickTimeoutId = setTimeout(() => {
              if (ctrlClickPending) {
                console.log('BACKGROUND: Auto-clearing ctrlClickPending after timeout');
                ctrlClickPending = false;
              }
            }, 5000);
          }
          
          // Update last state
          lastCtrlKeyState = isPressed;
          
          return { success: true };
        } catch (error) {
          console.error('Error updating ctrl key state:', error);
          return { success: false, error: error.message };
        }
      },
      
      // Sending user message
      'send_user_message': async () => {
        try {
          const { 
            pageLoadId, 
            message: userMessage, 
            url, 
            title,
            sessionData, 
            pageContent,
            enablePageScraping = true,
            enableWebSearch = false,
            selectedModel = 'gpt-4o-mini',
            temperature = 0.7
          } = message.data || {};
          
          if (!pageLoadId) {
            throw new Error('pageLoadId is required for sending messages');
          }
          
          if (!userMessage) {
            throw new Error('Message content is required');
          }
          
          console.log('Processing user message:', userMessage);
          console.log('Page scraping enabled:', enablePageScraping);
          console.log('Web search enabled:', enableWebSearch);
          console.log('Page content available:', pageContent ? `Yes (${pageContent.length} characters)` : 'No');
          
          // Get existing session or create a new one
          let session = await chatService.getSession(pageLoadId);
          
          if (!session && sessionData) {
            // Create a new session if it doesn't exist
            session = await chatService.createSession({
              ...sessionData,
              pageLoadId,
              url,
              title,
              timestamp: Date.now(),
              lastUpdated: Date.now(),
              messages: []
            });
          } else if (!session) {
            throw new Error('Chat session not found and sessionData not provided');
          }
          
          // Get page content, either from new scrape or existing session
          let activePageContent = pageContent;
          
          // If page scraping is enabled but no new content was provided,
          // use the existing content stored in the session if available
          if (enablePageScraping && !activePageContent && session.pageContent) {
            activePageContent = session.pageContent;
            console.log(`Using existing page content from session: ${activePageContent.length} characters`);
          }
          
          // Store the page content in the session if available (but not in messages)
          if (enablePageScraping && activePageContent) {
            session.pageContent = activePageContent;
          } else if (!enablePageScraping) {
            // When page scraping is disabled, ensure we don't use any page content
            activePageContent = null;
            console.log('Page scraping is disabled, ignoring any stored page content');
          }
          
          // Add user message to session (without page content)
          const userMessageObj = {
            role: 'user',
            content: userMessage,
            timestamp: Date.now()
          };
          
          // Get the API key from storage
          const apiKey = await storageService.getValue(STORAGE_KEYS.API_KEY, null);
          
          if (!apiKey) {
            throw new Error('API key is not set. Please add your OpenAI API key in settings.');
          }
          
          // Create the appropriate system message based on available content and settings
          let systemContent = '';
          
          if (enablePageScraping && activePageContent && enableWebSearch) {
            // Combined mode: both page content and web search
            systemContent = COMBINED_SYSTEM_PROMPT;
          } else if (enablePageScraping && activePageContent) {
            // Create a page-specific prompt WITHOUT the actual page content
            systemContent = generatePageAwarePrompt(title, url);
          } else if (enableWebSearch) {
            // Use web search specific prompt
            systemContent = WEB_SEARCH_SYSTEM_PROMPT;
          } else {
            systemContent = NO_PAGE_CONTENT_SYSTEM_PROMPT;
          }
          
          const systemMessage = {
            role: 'system',
            content: systemContent
          };
          
          // Create the messages array for the API call
          const messages = [
            systemMessage,
            ...session.messages || [],
            userMessageObj
          ];
          
          // Add the user message to the session (before API call in case it fails)
          session.messages = session.messages || [];
          session.messages.push(userMessageObj);
          session.lastUpdated = Date.now();
          await chatService.updateSession(session);
          
          // Make the API call using the OpenAI service
          console.log('Making API call to OpenAI with model:', selectedModel);
          
          try {
            // Format the user message to include page content if needed
            let formattedUserMessage = userMessage;
            if (enablePageScraping && activePageContent) {
              formattedUserMessage = `${userMessage}\n\nHere is the content of the webpage (URL: ${url || 'No URL available'}) to help answer my question:\n\n${activePageContent}`;
            }
            
            // Replace the last message content with the formatted version for API call only
            const apiMessages = [...messages];
            apiMessages[apiMessages.length - 1] = {
              ...apiMessages[apiMessages.length - 1],
              content: formattedUserMessage
            };
            
            // Use the OpenAI API service to make the request
            const apiResponse = await openaiApi.sendRequest({
              apiKey,
              messages: apiMessages,
              model: selectedModel,
              temperature,
              useWebSearch: enableWebSearch,
              pageContent: enablePageScraping ? activePageContent : '' // Pass page content separately to API service
            });
            
            // Process the response
            const processedResponse = openaiApi.processApiResponse(apiResponse);
            
            // Create AI response object
            const aiResponseObj = {
              role: 'assistant',
              content: processedResponse.content || 'No response generated from the API.',
              timestamp: Date.now(),
              sources: processedResponse.sources || []
            };
            
            // Add the AI response to the session
            session.messages.push(aiResponseObj);
            session.lastUpdated = Date.now();
            await chatService.updateSession(session);
            
            // Return the updated session and the AI response
            return {
              success: true,
              data: {
                session,
                aiResponse: aiResponseObj
              }
            };
          } catch (apiError) {
            console.error('API call failed:', apiError);
            
            // Add the error to the session so the user can see it
            const errorResponseObj = {
              role: 'assistant',
              content: `Error: ${apiError.message || 'API call failed'}`,
              timestamp: Date.now(),
              isError: true
            };
            
            session.messages.push(errorResponseObj);
            session.lastUpdated = Date.now();
            await chatService.updateSession(session);
            
            return {
              success: false,
              error: apiError.message,
              data: {
                session,
                aiResponse: errorResponseObj
              }
            };
          }
        } catch (error) {
          console.error('Error processing user message:', error);
          return { success: false, error: error.message };
        }
      },
      
      // Page scraping functionality
      'scrapeContent': async () => {
        try {
          console.log('Handling scrapeContent request');
          
          // Option 1: If we know which tab the popup was opened from, use that
          if (popupOpenedFromTabId) {
            console.log(`Using stored popup origin tab ID: ${popupOpenedFromTabId}`);
            try {
              // Make sure the tab still exists
              const tab = await chrome.tabs.get(popupOpenedFromTabId);
              if (tab) {
                console.log(`Found popup origin tab still exists: ${tab.id}, ${tab.url}`);
              }
              // Process this tab directly instead of querying for active tab
              return await processScrapeTabRequest(tab);
            } catch (e) {
              console.error(`Error getting popup origin tab: ${e.message}`);
              // If we can't get the stored tab, fall back to normal behavior
              console.log('Falling back to regular tab detection...');
            }
          }
          
          // Option 2: Get the active tab from current window specifically
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tabs || tabs.length === 0) {
            // Option 3: If we can't find the active tab in current window, try getting the last focused window's active tab
            console.log('No active tab found in current window, trying lastFocusedWindow');
            const lastFocusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            if (!lastFocusedTabs || lastFocusedTabs.length === 0) {
              // Option 4: If still no tabs found, try using our tracked focus information
              console.log('No active tab found in lastFocusedWindow, trying tracked focus data');
              if (lastFocusedWindowId && lastFocusedTabId) {
                console.log(`Using tracked focus data: Window ${lastFocusedWindowId}, Tab ${lastFocusedTabId}`);
                try {
                  const trackedTab = await chrome.tabs.get(lastFocusedTabId);
                  if (trackedTab) {
                    console.log('Successfully retrieved tracked tab:', trackedTab.id, trackedTab.url);
                    return await processScrapeTabRequest(trackedTab);
                  }
                } catch (e) {
                  console.error('Error retrieving tracked tab:', e);
                }
              }
              
              // If we still don't have a tab, throw the error
              throw new Error('No active tab found in any window');
            } else {
              return await processScrapeTabRequest(lastFocusedTabs[0]);
            }
          }
          
          // Process the active tab from the current window
          return await processScrapeTabRequest(tabs[0]);
        } catch (error) {
          console.error('Error in scrapeContent handler:', error);
          return { 
            success: false, 
            error: error.message,
            data: {
              content: '',
              title: '',
              url: ''
            }
          };
        }
      },
      
      // Track popup initialization
      'popupInitialized': async () => {
        try {
          // Store information about which tab opened the popup
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs && tabs.length > 0) {
            const currentTab = tabs[0];
            popupOpenedFromTabId = currentTab.id;
            popupOpenedFromWindowId = currentTab.windowId;
            popupOpenedFromUrl = currentTab.url;
            console.log(`Popup initialized from tab: ${popupOpenedFromTabId}, window: ${popupOpenedFromWindowId}, URL: ${popupOpenedFromUrl}`);
            
            // If we have the contextId, use it to check if this is a new popup opening
            // but we won't close other popups here - that happens when the long-lived connection is established
            if (sender.contextId) {
              console.log(`Popup has contextId: ${sender.contextId}`);
              if (lastActivePopupId && lastActivePopupId !== sender.contextId) {
                console.log(`New popup is opening, previous active popup: ${lastActivePopupId}`);
              }
              lastActivePopupId = sender.contextId;
            }
          }
          
          return { success: true };
        } catch (error) {
          console.error('Error handling popup initialization:', error);
          return { success: false, error: error.message };
        }
      },
      
      // Ctrl+Click functionality from the original version
      'checkCtrlClick': async () => {
        try {
          console.log('BACKGROUND: Checking Ctrl+Click pending status:', ctrlClickPending);
          
          const response = { 
            success: true, 
            ctrlClickPending: ctrlClickPending,
            message: ctrlClickPending ? 'Ctrl+Click detected' : 'No Ctrl+Click pending'
          };
          
          // Reset the flag after sending
          if (ctrlClickPending) {
            ctrlClickPending = false;
            console.log('BACKGROUND: Resetting ctrlClickPending to false after check');
          }
          
          return response;
        } catch (error) {
          console.error('Error checking ctrl+click:', error);
          return { success: false, error: error.message };
        }
      },
      
      // Track window focus changes
      'windowFocusChanged': async () => {
        try {
          const tabId = sender.tab?.id;
          const tabUrl = sender.tab?.url || message.url;
          const windowId = sender.tab?.windowId;
          const isFocused = message.focused;
          
          console.log(`Focus change detected: Window ${windowId}, Tab ${tabId}, URL ${tabUrl}, Focused: ${isFocused}`);
          
          if (isFocused && tabId && windowId) {
            // Update our record of the focused tab for this window
            focusedTabs[windowId] = tabId;
            lastFocusedWindowId = windowId;
            lastFocusedTabId = tabId;
            
            console.log(`Updated focused tabs record: Window ${windowId} now has Tab ${tabId} focused`);
            console.log('Current focused tabs record:', focusedTabs);
          } else if (!isFocused && tabId && windowId) {
            // If the current window/tab combination is what we had as focused, clear it
            if (focusedTabs[windowId] === tabId) {
              console.log(`Tab ${tabId} in window ${windowId} lost focus`);
              // We don't delete the entry as it's still the last known focused tab in that window
            }
          }
          
          return { success: true };
        } catch (error) {
          console.error('Error tracking window focus:', error);
          return { success: false, error: error.message };
        }
      },
      
      // Default handler for unknown message types
      'default': async () => {
        console.warn('Unknown message type:', messageType);
        return { success: false, error: 'Unknown message type' };
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
    defaultModel: 'gpt-4o-mini'
  });
  
  // Initialize empty chat sessions list
  await storageService.setValue(STORAGE_KEYS.CHAT_SESSIONS, []);
  
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
 * Modified to work with automatic execution on popup open
 */
function setupBrowserActionClickHandler() {
  // With our new approach, we no longer need to detect clicks in the background script
  // The popup.js will automatically execute the last input when opened
  
  // We'll keep this function for backward compatibility
  chrome.action.onClicked.addListener(async (tab) => {
    console.log('Browser action clicked, letting Chrome handle popup opening');
    
    // No need for any click detection now
    // Popup.js will handle automatic execution when it opens
  });
}

// Keep handleDoubleClick for backward compatibility
async function handleDoubleClick(tab) {
  // This function is kept for backward compatibility
  // but is no longer used with our new approach
  console.log('Legacy function: handleDoubleClick is no longer used');
}

// Start initialization
initialize();

// Set up browser action click handler
setupBrowserActionClickHandler(); 