/**
 * Background Script
 * 
 * Main entry point for the extension's background page.
 * Sets up listeners and manages the extension's lifecycle.
 */

// Global variables to store service references
let messageHandler = null;
let storageService = null;
let chatService = null;
let STORAGE_KEYS = null;

// Variables for Ctrl+Click functionality
let ctrlClickPending = false;
let lastCtrlKeyState = false;
let ctrlClickTimeoutId = null;

// Initialize storage keys
const STORAGE_KEYS_CONSTANTS = {
  USER_PREFERENCES: 'userPreferences',
  CHAT_SESSIONS: 'chatSessions',
  DEBUG_MODE: 'debugMode',
  API_KEY: 'openai_api_key',
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
    
    // Setup message handler with proper async response handling
    setupMessageListeners();
    
    // Set up extension installation/update handlers
    setupExtensionHandlers();
    
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
    
    console.log('Background script initialized successfully');
  } catch (error) {
    console.error('Error initializing background script:', error);
  }
}

/**
 * Set up message listeners with proper async response handling
 */
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);
    
    // Support both message.type and message.action for backwards compatibility
    const messageType = message.type || message.action;
    
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
          
          // Add user message to session
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
          
          // Create messages array for OpenAI API
          const systemMessage = {
            role: 'system',
            content: 'You are a helpful AI assistant that answers questions about the current webpage. Be concise but informative.'
          };
          
          // If page content is available and scraping is enabled, add it to the system message
          if (pageContent && enablePageScraping) {
            systemMessage.content += '\n\nThe current webpage content is provided below:\n\n' + pageContent;
          }
          
          const messages = [
            systemMessage,
            ...session.messages || [],
            userMessageObj
          ];
          
          // Make the actual API call
          try {
            console.log('Making API call to OpenAI with model:', selectedModel);
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                model: selectedModel,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                temperature: temperature,
                max_tokens: 2048
              })
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              console.error('API error details:', errorData);
              throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
            }
            
            const data = await response.json();
            console.log('API response received:', data);
            
            // Create AI response object
            const aiResponseObj = {
              role: 'assistant',
              content: data.choices[0].message.content,
              timestamp: Date.now(),
              model: selectedModel
            };
            
            // Update session with new messages
            const updatedMessages = [...(session.messages || []), userMessageObj, aiResponseObj];
            
            // Update session in storage
            const updatedSession = await chatService.updateSession({
              ...session,
              messages: updatedMessages,
              lastUpdated: Date.now()
            });
            
            return { 
              success: true, 
              data: {
                session: updatedSession,
                message: aiResponseObj
              }
            };
          } catch (apiError) {
            console.error('OpenAI API call error:', apiError);
            
            // Fall back to a simulated response if API call fails
            console.warn('Falling back to simulated response due to API error');
            const aiResponseObj = {
              role: 'assistant',
              content: `Sorry, I encountered an error communicating with the OpenAI API: ${apiError.message}\n\nPlease check your API key and network connection or try again later.`,
              timestamp: Date.now() + 1000,
              error: apiError.message
            };
            
            // Update session with new messages including error
            const updatedMessages = [...(session.messages || []), userMessageObj, aiResponseObj];
            
            // Update session in storage
            const updatedSession = await chatService.updateSession({
              ...session,
              messages: updatedMessages,
              lastUpdated: Date.now()
            });
            
            return { 
              success: true, 
              data: {
                session: updatedSession,
                message: aiResponseObj
              }
            };
          }
        } catch (error) {
          console.error('Error sending user message:', error);
          return { success: false, error: error.message };
        }
      },
      
      // Page scraping functionality
      'scrapeContent': async () => {
        try {
          // Get the active tab
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tabs || tabs.length === 0) {
            throw new Error('No active tab found');
          }
          
          const tab = tabs[0];
          
          // Try to send a message to the content script
          try {
            console.log('Attempting to scrape content from tab:', tab.id);
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeContent' });
            
            return { 
              success: true, 
              data: {
                content: response?.content || '',
                title: tab.title || '',
                url: tab.url || ''
              }
            };
          } catch (error) {
            console.error('Error sending message to content script:', error);
            
            // Since content script communication failed, try injecting the content script
            await injectContentScriptIfNeeded(tab.id);
            
            // Try again after injection
            try {
              const retryResponse = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeContent' });
              
              return { 
                success: true, 
                data: {
                  content: retryResponse?.content || '',
                  title: tab.title || '',
                  url: tab.url || ''
                }
              };
            } catch (retryError) {
              console.error('Error scraping content after script injection:', retryError);
              throw new Error('Failed to scrape page content after script injection');
            }
          }
        } catch (error) {
          console.error('Error scraping page content:', error);
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

// Start the initialization
initialize().catch(error => {
  console.error('Error initializing background script:', error);
}); 