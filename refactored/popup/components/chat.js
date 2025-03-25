/**
 * Chat Component
 * 
 * Handles displaying chat messages and sending user input to the background script.
 */

import { MESSAGE_TYPES } from '../../shared/constants.js';
// Remove the import of marked and use window.markdownit which is loaded via script tag
// import { marked } from '../../lib/marked.min.js';
// Remove the import of highlight.min.js and use the global hljs object loaded by script tag
// import hljs from '../../lib/highlight.min.js';

// Create markdown-it instance
const md = window.markdownit({
  highlight: function (str, lang) {
    if (lang && window.hljs.getLanguage(lang)) {
      try {
        return window.hljs.highlight(str, { language: lang }).value;
      } catch (__) {}
    }
    return ''; // use external default escaping
  },
  breaks: true,
  linkify: true
});

// DOM elements
let chatContainer;
let messageInput;
let sendButton;
let chatMessages;
let loadingIndicator;
let errorMessage;
let doubleClickArea;
let currentConversationInfo;
let currentConversationTitle;
let currentConversationTimestamp;

// Action buttons
let newChatButton;
let reasonButton;
let searchPageButton;
let searchWebButton;

// Chat state
let currentSession = null;
let isLoading = false;
let lastQuery = null;
let isSubmitInProgress = false;
let lastSubmittedQuestion = '';

// Add error state persistence
let lastError = null;
let errorTimeout = null;

// Add session state
let sessionState = {
  isLoading: false,
  isSubmitting: false,
  lastQuery: null,
  lastSubmittedQuestion: '',
  pageLoadId: null,
  url: null,
  title: null
};

/**
 * Initialize the chat component
 */
export function initializeChatComponent() {
  // Get DOM elements
  chatContainer = document.getElementById('chat-container');
  messageInput = document.getElementById('message-input');
  sendButton = document.getElementById('send-button');
  chatMessages = document.getElementById('chat-messages');
  loadingIndicator = document.getElementById('loading-indicator');
  errorMessage = document.getElementById('error-message');
  doubleClickArea = document.getElementById('double-click-area');
  currentConversationInfo = document.getElementById('current-conversation-info');
  currentConversationTitle = document.getElementById('current-conversation-title');
  currentConversationTimestamp = document.getElementById('current-conversation-timestamp');
  
  // Get action buttons
  newChatButton = document.getElementById('new-chat-button');
  reasonButton = document.getElementById('reason-button');
  searchPageButton = document.getElementById('search-page-button');
  searchWebButton = document.getElementById('search-web-button');
  
  // Add event listeners
  setupEventListeners();
  
  // Listen for session-related events
  window.addEventListener('show-session', handleShowSession);
  window.addEventListener('chat-settings-changed', handleSettingsChanged);
  
  // Load current session
  loadCurrentSession();
  
  // Load saved input text
  loadSavedInputText();
  
  // Setup double-click handlers
  setupDoubleClickHandlers();
  
  // Check for pending Ctrl+Click
  checkForCommandOrCtrlClick();
}

/**
 * Set up event listeners for chat interactions
 */
function setupEventListeners() {
  // Send message when button is clicked
  sendButton.addEventListener('click', handleSendMessage);
  
  // Send message when Enter is pressed (but not with Shift)
  messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  });
  
  // Auto-resize textarea as user types
  messageInput.addEventListener('input', () => {
    // Reset height to calculate actual content height
    messageInput.style.height = 'auto';
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 200)}px`;
  });
  
  // Action button handlers
  newChatButton.addEventListener('click', handleNewChat);
  reasonButton.addEventListener('click', () => handleActionButton('reason'));
  searchPageButton.addEventListener('click', () => handleActionButton('searchPage'));
  searchWebButton.addEventListener('click', () => handleActionButton('searchWeb'));
  
  // Double-click handler for last query
  doubleClickArea.addEventListener('dblclick', handleDoubleClick);
  
  // Auto-save input text when popup closes
  window.addEventListener('unload', () => {
    saveInputText();
  });
  
  // Save periodically
  setInterval(() => {
    saveInputText();
  }, 5000);
  
  // Listen for session open event from history component
  window.addEventListener('open-session', (event) => {
    if (event.detail && event.detail.pageLoadId) {
      handleShowSession({ detail: { pageLoadId: event.detail.pageLoadId } });
    } else {
      console.error('Invalid session data received from history component:', event.detail);
      displayErrorMessage('Cannot open session: Invalid data');
    }
  });
}

/**
 * Handle creating a new chat session
 */
async function handleNewChat() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('Could not detect current tab');
    }
    
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.CREATE_CHAT_SESSION,
      data: {
        url: tab.url,
        title: tab.title
      }
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to create new chat session');
    }
    
    currentSession = response.data;
    renderMessages([]);
    updateConversationInfo();
    messageInput.focus();
  } catch (error) {
    console.error('Error creating new chat:', error);
    displayErrorMessage(error.message);
  }
}

/**
 * Handle action button clicks
 */
async function handleActionButton(action) {
  // Use the input message as-is instead of replacing it with predefined templates
  // Let the system prompt guide the model's understanding of the context
  handleSendMessage();
}

/**
 * Handle double-click on header to repeat last query
 */
function handleDoubleClick() {
  if (lastQuery) {
    messageInput.value = lastQuery;
    handleSendMessage();
  }
}

/**
 * Handle showing a session
 * @param {Event|Object} event - Event or session object from history
 */
async function handleShowSession(event) {
  const pageLoadId = event?.detail?.pageLoadId;
  
  if (!pageLoadId) {
    console.error('No pageLoadId provided to handleShowSession');
    displayErrorMessage('Cannot load session: missing ID');
    return;
  }
  
  // Show loading indicator and clear current messages
  setLoading(true);
  chatMessages.innerHTML = '';
  
  try {
    console.log('Loading session with pageLoadId:', pageLoadId);
    
    // Get the session from the background script
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_CHAT_SESSION,
      data: { pageLoadId }
    });
    
    // First check if we got a successful response
    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to load session');
    }
    
    // Check if session exists in the response
    if (!response.data) {
      throw new Error('Session not found');
    }
    
    currentSession = response.data;
    
    // Check if session has messages array
    if (!currentSession.messages || !Array.isArray(currentSession.messages)) {
      console.warn('Session has no messages array or invalid messages:', currentSession);
      currentSession.messages = [];
    }
    
    renderMessages(currentSession.messages);
    updateConversationInfo();
    
    // Clear any error messages
    hideErrorMessage();
  } catch (error) {
    console.error('Error showing session:', error);
    displayErrorMessage(`Error loading chat: ${error.message}`);
    
    // Reset current session if we couldn't load it
    if (!currentSession || !currentSession.messages) {
      currentSession = null;
    }
  } finally {
    setLoading(false);
  }
}

/**
 * Handle settings changes
 */
function handleSettingsChanged(event) {
  const { settings } = event.detail;
  
  // Update any chat-related settings
  if (settings.defaultModel) {
    // Update model if needed
  }
  
  if (settings.temperature) {
    // Update temperature if needed
  }
  
  if (settings.webSearch !== undefined) {
    searchWebButton.classList.toggle('disabled', !settings.webSearch);
  }
  
  if (settings.pageScraping !== undefined) {
    searchPageButton.classList.toggle('disabled', !settings.pageScraping);
  }
}

/**
 * Handle sending a message
 */
async function handleSendMessage() {
  if (preventDuplicateSubmission()) {
    return;
  }
  
  // Get the message from the input
  const message = messageInput.value.trim();
  if (!message) {
    return;
  }
  
  // Show loading indicator
  setLoading(true);
  
  // Clear the input and saved input
  messageInput.value = '';
  await clearSavedInputText();
  
  // Store the message for possible reuse
  lastQuery = message;
  
  try {
    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('Could not determine current tab');
    }
    
    // Get user preferences
    const prefResponse = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_USER_PREFERENCES
    });
    
    const preferences = prefResponse.success ? prefResponse.data : {};
    const pageScraping = preferences.pageScraping !== false; // Default to true if not set
    
    // Try to get page content if page scraping is enabled
    let pageContent = null;
    if (pageScraping) {
      try {
        console.log('Page scraping is enabled, attempting to scrape content');
        
        // Use the background script to scrape content
        const scrapeResponse = await chrome.runtime.sendMessage({
          type: 'scrapeContent'
        });
        
        if (scrapeResponse && scrapeResponse.success && scrapeResponse.data && scrapeResponse.data.content) {
          pageContent = scrapeResponse.data.content;
          console.log(`Page content scraped successfully: ${pageContent.length} characters`);
        } else if (scrapeResponse && scrapeResponse.data && scrapeResponse.data.content) {
          // We have content in the data even though success is false
          pageContent = scrapeResponse.data.content;
          console.warn('Partial scraping success, using available content:', pageContent.substring(0, 100) + '...');
        } else {
          console.warn('Failed to scrape content:', scrapeResponse?.error || 'Unknown error');
        }
      } catch (error) {
        console.warn('Error during page content scraping:', error);
      }
    } else {
      console.log('Page scraping is disabled, skipping content extraction');
    }
    
    // Check if we have a session, create one if not
    if (!currentSession) {
      console.log('No current session, creating one');
      const sessionResponse = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CREATE_CHAT_SESSION,
        data: {
          url: tab.url,
          title: tab.title,
          pageLoadId: `session_${Date.now()}_${Math.floor(Math.random() * 1000000)}`
        }
      });
      
      if (!sessionResponse.success) {
        throw new Error(sessionResponse.error || 'Failed to create chat session');
      }
      
      currentSession = sessionResponse.data;
      console.log('Created new session:', currentSession);
    }
    
    // Send the message to the background script
    console.log('Sending message with pageLoadId:', currentSession.pageLoadId);
    console.log('Page content included:', pageContent ? 'Yes' : 'No');
    
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SEND_USER_MESSAGE,
      data: {
        pageLoadId: currentSession.pageLoadId,
        message: message,
        url: tab.url,
        title: tab.title,
        sessionData: currentSession,
        pageContent: pageContent,
        enablePageScraping: pageScraping,
        enableWebSearch: preferences.webSearch === true,
        selectedModel: preferences.defaultModel || 'gpt-4o-mini',
        temperature: preferences.temperature || 0.7
      }
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to send message');
    }
    
    // Update the current session with the response
    if (response.data && response.data.session) {
      currentSession = response.data.session;
      
      // Update conversation info
      updateConversationInfo();
      
      // Render all messages
      if (currentSession.messages) {
        renderMessages(currentSession.messages);
      } else {
        console.warn('Session has no messages array:', currentSession);
      }
    } else {
      console.warn('Response missing session data:', response);
    }
    
    // Clear any error messages
    hideErrorMessage();
  } catch (error) {
    console.error('Error sending message:', error);
    displayErrorMessage(error.message);
  } finally {
    sessionState.isSubmitting = false;
    setLoading(false);
  }
}

/**
 * Load the current chat session for the active tab
 */
async function loadCurrentSession() {
  try {
    console.log('Loading current chat session...');
    
    // Clear messages
    chatMessages.innerHTML = '';
    
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      console.warn('No active tab found');
      return;
    }
    
    console.log('Current tab:', tab.url);
    
    // Try to get page load ID for the current tab
    let response;
    try {
      console.log('Requesting chat session for URL:', tab.url);
      
      // Use a Promise with timeout to prevent indefinite waiting
      response = await Promise.race([
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.GET_CHAT_SESSION,
          data: {
            url: tab.url
          }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Chat session request timed out')), 5000)
        )
      ]);
      
      console.log('Chat session response:', response);
    } catch (error) {
      console.error('Error requesting chat session:', error);
      
      // Fallback to direct storage access
      try {
        console.log('Attempting direct storage access fallback');
        const storageKey = `pageload_${tab.id}_${tab.url}`;
        const result = await chrome.storage.local.get(storageKey);
        const pageLoadId = result[storageKey];
        
        console.log('Storage fallback, found pageLoadId:', pageLoadId);
        
        if (pageLoadId) {
          const sessions = await chrome.storage.local.get('chatSessions');
          const chatSessions = sessions.chatSessions || [];
          console.log('Retrieved', chatSessions.length, 'sessions from storage');
          
          currentSession = chatSessions.find(s => s.pageLoadId === pageLoadId);
          
          if (currentSession) {
            console.log('Fallback: Retrieved session from storage', currentSession);
            renderMessages(currentSession.messages || []);
            updateConversationInfo();
            return;
          } else {
            console.warn('Session with ID not found in storage:', pageLoadId);
          }
        }
      } catch (storageError) {
        console.error('Fallback storage access failed:', storageError);
      }
      
      // If all else fails, show empty chat
      console.log('All session retrieval methods failed, showing empty chat');
      currentConversationInfo.classList.add('hidden');
      return;
    }
    
    if (response && response.success && response.data) {
      currentSession = response.data;
      console.log('Session loaded successfully:', currentSession.pageLoadId);
      
      // Ensure messages array exists
      if (!currentSession.messages) {
        console.warn('Session has no messages array, initializing empty array');
        currentSession.messages = [];
      }
      
      renderMessages(currentSession.messages);
      updateConversationInfo();
    } else {
      // No session yet, show empty chat
      console.log('No chat session found for the current tab');
      currentConversationInfo.classList.add('hidden');
    }
  } catch (error) {
    console.error('Error loading chat session:', error);
    displayErrorMessage('Failed to load chat session');
  }
}

/**
 * Update the conversation info display
 */
function updateConversationInfo() {
  if (currentSession) {
    currentConversationTitle.textContent = currentSession.title || 'Untitled Chat';
    currentConversationTimestamp.textContent = new Date(currentSession.timestamp).toLocaleString();
    currentConversationInfo.classList.remove('hidden');
    
    // Update session state
    sessionState.pageLoadId = currentSession.pageLoadId;
    sessionState.url = currentSession.url;
    sessionState.title = currentSession.title;
    
    // Notify history component
    window.dispatchEvent(new CustomEvent('chat-session-updated', {
      detail: { session: currentSession }
    }));
  } else {
    currentConversationInfo.classList.add('hidden');
  }
}

/**
 * Render all messages in the chat
 * 
 * @param {Array} messages - Array of message objects
 */
function renderMessages(messages) {
  // Clear messages
  chatMessages.innerHTML = '';
  
  // Add each message
  messages.forEach(message => {
    if (message.role !== 'system') {
      appendMessage(message);
    }
  });
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Append a single message to the chat
 * 
 * @param {Object} message - Message object with role and content
 */
function appendMessage(message) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', message.role);
  
  const contentElement = document.createElement('div');
  contentElement.classList.add('message-content');
  
  // Format the content with markdown
  contentElement.innerHTML = md.render(message.content);
  
  messageElement.appendChild(contentElement);
  chatMessages.appendChild(messageElement);
  
  // Highlight code blocks
  messageElement.querySelectorAll('pre code').forEach(block => {
    window.hljs.highlightElement(block);
  });
  
  // Scroll to the new message
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Display an error message with persistence
 */
function displayErrorMessage(message, duration = 5000) {
  // Clear any existing error timeout
  if (errorTimeout) {
    clearTimeout(errorTimeout);
  }
  
  // Update error state
  lastError = message;
  
  // Show error in UI
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
  
  // Hide after duration unless it's a persistent error
  if (duration > 0) {
    errorTimeout = setTimeout(() => {
      hideErrorMessage();
    }, duration);
  }
}

/**
 * Hide the error message
 */
function hideErrorMessage() {
  errorMessage.classList.add('hidden');
  lastError = null;
  
  if (errorTimeout) {
    clearTimeout(errorTimeout);
    errorTimeout = null;
  }
}

/**
 * Set the loading state and update UI accordingly
 */
function setLoading(loading) {
  sessionState.isLoading = loading;
  
  if (loading) {
    loadingIndicator.classList.remove('hidden');
    sendButton.disabled = true;
  } else {
    loadingIndicator.classList.add('hidden');
    sendButton.disabled = false;
    messageInput.focus();
  }
}

/**
 * Save input text for persistence
 */
async function saveInputText() {
  if (!messageInput.value) return;
  
  try {
    await chrome.storage.local.set({
      [`input_text_${currentSession?.pageLoadId}`]: messageInput.value
    });
  } catch (error) {
    console.error('Error saving input text:', error);
  }
}

/**
 * Clear saved input text
 */
async function clearSavedInputText() {
  try {
    await chrome.storage.local.remove(`input_text_${currentSession?.pageLoadId}`);
  } catch (error) {
    console.error('Error clearing input text:', error);
  }
}

/**
 * Load saved input text
 */
async function loadSavedInputText() {
  if (!currentSession?.pageLoadId) return;
  
  try {
    const { [`input_text_${currentSession.pageLoadId}`]: savedText } = 
      await chrome.storage.local.get(`input_text_${currentSession.pageLoadId}`);
    
    if (savedText) {
      messageInput.value = savedText;
      messageInput.dispatchEvent(new Event('input')); // Trigger auto-resize
    }
  } catch (error) {
    console.error('Error loading saved input text:', error);
  }
}

/**
 * Check for command to execute
 */
async function checkForCommandToExecute() {
  try {
    const { commandToExecute } = await chrome.storage.local.get('commandToExecute');
    if (commandToExecute) {
      console.log('Found command to execute:', commandToExecute);
      messageInput.value = commandToExecute;
      handleSendMessage();
      await chrome.storage.local.remove('commandToExecute');
    }
  } catch (error) {
    console.error('Error checking for command:', error);
  }
}

/**
 * Setup double-click handlers
 */
function setupDoubleClickHandlers() {
  doubleClickArea.addEventListener('dblclick', async () => {
    if (lastQuery) {
      messageInput.value = lastQuery;
      handleSendMessage();
    }
  });
}

/**
 * Check for Ctrl+Click pending
 */
async function checkForCommandOrCtrlClick() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'checkCtrlClick' });
    if (response?.ctrlClickPending) {
      console.log('Ctrl+Click pending detected');
      setTimeout(async () => {
        await executeLastMessage('Ctrl+Click: ');
      }, 1000);
    }
  } catch (error) {
    console.error('Error checking for Ctrl+Click:', error);
  }
}

/**
 * Execute last message
 */
async function executeLastMessage(prefixText = '') {
  if (!lastQuery) return;
  
  messageInput.value = prefixText + lastQuery;
  handleSendMessage();
}

/**
 * Prevent duplicate submission
 */
function preventDuplicateSubmission() {
  if (sessionState.isSubmitting) {
    console.log('Submission already in progress, preventing duplicate');
    return true;
  }
  
  const currentQuestion = messageInput.value.trim();
  if (currentQuestion === sessionState.lastSubmittedQuestion) {
    console.log('Duplicate question detected, preventing submission');
    return true;
  }
  
  sessionState.isSubmitting = true;
  sessionState.lastSubmittedQuestion = currentQuestion;
  return false;
}

// Export the chat component
export default {
  initializeChatComponent,
  setLoading,
  displayErrorMessage,
  hideErrorMessage,
  loadCurrentSession,
  lastQuery
}; 