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
let modelSelect;

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
  // First, immediately notify the background script that the popup is opening 
  // This must be done before any other operations to ensure proper tab tracking
  notifyBackgroundScriptOfPopupOpen();
  
  // Get DOM elements
  chatContainer = document.getElementById('chat-container');
  chatMessages = document.getElementById('chat-messages');
  messageInput = document.getElementById('message-input');
  sendButton = document.getElementById('send-button');
  currentConversationInfo = document.getElementById('current-conversation-info');
  currentConversationTitle = document.getElementById('current-conversation-title');
  currentConversationTimestamp = document.getElementById('current-conversation-timestamp');
  newChatButton = document.getElementById('new-chat-button');
  reasonButton = document.getElementById('reason-button');
  searchPageButton = document.getElementById('search-page-button');
  searchWebButton = document.getElementById('search-web-button');
  doubleClickArea = document.getElementById('double-click-area');
  loadingIndicator = document.getElementById('loading-indicator');
  errorMessage = document.getElementById('error-message');
  modelSelect = document.getElementById('model-select');
  
  // Set up event listeners
  setupEventListeners();
  
  // Load current chat session
  loadCurrentSession();
  
  // Auto-resize input field
  setupInputAutoResize();
  
  // Check for command to execute
  checkForCommandToExecute();
  
  // Initialize button states and toggles based on saved preferences
  checkToggleState();
  
  // Load the global last user input
  loadGlobalLastUserInput();
}

/**
 * Notify the background script that the popup has been opened
 * This is critical for proper tab tracking when there's focus loss
 */
function notifyBackgroundScriptOfPopupOpen() {
  console.log('Notifying background script that popup is open');
  try {
    chrome.runtime.sendMessage({
      type: 'popupInitialized',
      action: 'popupInitialized',
      timestamp: Date.now()
    }, (response) => {
      console.log('Background script acknowledged popup initialization:', response);
    });
  } catch (error) {
    console.error('Error notifying background script of popup open:', error);
  }
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
  
  // Comprehensive listener for settings changes
  window.addEventListener('settings-updated', async (event) => {
    console.log('Settings updated event received:', event.detail);
    
    // Always refresh toggle state from storage when settings change
    await checkToggleState();
    
    // If we have specific settings in the event detail, use them
    if (event.detail && event.detail.settings) {
      const { settings } = event.detail;
      
      // Update UI based on specific settings
      if (settings.pageScraping !== undefined && searchPageButton) {
        searchPageButton.classList.toggle('active', settings.pageScraping);
      }
      
      if (settings.webSearch !== undefined && searchWebButton) {
        searchWebButton.classList.toggle('active', settings.webSearch);
      }
      
      console.log('Updated UI from settings event:', settings);
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
  if (action === 'searchPage') {
    // Get current settings
    const settings = await getSettings();
    // Toggle the page scraping setting
    const pageScraping = !settings.pageScraping;
    
    // Update UI button
    searchPageButton.classList.toggle('active', pageScraping);
    
    // Update toggle element if it exists
    const pageScrapingToggle = document.getElementById('page-scraping-toggle');
    if (pageScrapingToggle) {
      pageScrapingToggle.checked = pageScraping;
    }
    
    // Save the setting
    await updateSettings({ pageScraping });
    
    // Notify other components of the settings change
    window.dispatchEvent(new CustomEvent('settings-updated', {
      detail: { settings: { pageScraping } }
    }));
    
    console.log('Page scraping is now', pageScraping ? 'enabled' : 'disabled');
  } else if (action === 'searchWeb') {
    // Get current settings
    const settings = await getSettings();
    // Toggle the web search setting
    const webSearch = !settings.webSearch;
    
    // Update UI button
    searchWebButton.classList.toggle('active', webSearch);
    
    // Update toggle element if it exists
    const webSearchToggle = document.getElementById('web-search-toggle');
    if (webSearchToggle) {
      webSearchToggle.checked = webSearch;
    }
    
    // Save the setting
    await updateSettings({ webSearch });
    
    // Notify other components of the settings change
    window.dispatchEvent(new CustomEvent('settings-updated', {
      detail: { settings: { webSearch } }
    }));
    
    console.log('Web search is now', webSearch ? 'enabled' : 'disabled');
  } else if (action === 'reason') {
    // Use the input message as-is instead of replacing it with predefined templates
    // Let the system prompt guide the model's understanding of the context
    handleSendMessage();
  }
}

/**
 * Get current settings from storage
 */
async function getSettings() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_USER_PREFERENCES
    });
    
    if (response && response.success) {
      return response.data || {};
    }
    
    // Fallback to direct storage access using getUserPreferences
    return await getUserPreferences();
  } catch (error) {
    console.error('Error getting settings:', error);
    return await getUserPreferences();
  }
}

/**
 * Update settings in storage
 */
async function updateSettings(newSettings) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.UPDATE_USER_PREFERENCES,
      data: newSettings
    });
    
    if (response && response.success) {
      return response.data;
    }
    
    // Fallback to direct storage access
    const result = await chrome.storage.local.get('userPreferences');
    const updatedSettings = { ...(result.userPreferences || {}), ...newSettings };
    await chrome.storage.local.set({ userPreferences: updatedSettings });
    return updatedSettings;
  } catch (error) {
    console.error('Error updating settings:', error);
    return null;
  }
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
  
  // Get the message content
  const messageText = messageInput.value.trim();
  if (!messageText) {
    console.warn('Cannot send empty message');
    return;
  }
  
  try {
    // Mark as processing
    isLoading = true;
    setLoading(true);
    
    // Save the user input globally (not URL dependent)
    try {
      await chrome.storage.local.set({ 'global_last_user_input': messageText });
      console.log('Saved global last user input:', messageText);
      
      // Also update the local lastQuery variable
      lastQuery = messageText;
    } catch (storageError) {
      console.error('Error saving global last user input:', storageError);
    }
    
    // Clear the input
    messageInput.value = '';
    
    // Save the cleared input text
    await saveInputText();
    
    // Get current tab information
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('Could not detect current tab');
    }
    
    // CRITICAL: Check toggle state BEFORE sending message to ensure latest state is used
    await checkToggleState();
    
    // Read settings directly from storage for most reliable state
    const result = await chrome.storage.local.get('userPreferences');
    const preferences = result.userPreferences || {};
    
    console.log('Retrieved user preferences for sending message:', preferences);
    
    // Read toggle states directly from the UI elements AFTER synchronizing
    const pageScrapingToggle = document.getElementById('page-scraping-toggle');
    const webSearchToggle = document.getElementById('web-search-toggle');
    
    // Use direct storage values first, then fall back to UI elements if available
    const pageScraping = preferences.pageScraping !== undefined 
                       ? preferences.pageScraping 
                       : (pageScrapingToggle ? pageScrapingToggle.checked : false);
    
    const webSearch = preferences.webSearch !== undefined 
                    ? preferences.webSearch 
                    : (webSearchToggle ? webSearchToggle.checked : false);
    
    // Get selected model and temperature from preferences
    const selectedModel = modelSelect ? modelSelect.value : 
                         (preferences.defaultModel || 'gpt-4o-mini');
    
    const temperature = preferences.temperature !== undefined ? 
                       preferences.temperature : 0;
    
    console.log('Using settings for message:', {
      pageScraping,
      webSearch,
      selectedModel,
      temperature
    });
    
    let pageContent = '';
    
    // Only scrape the page content if page scraping is enabled
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
          // Handle focus-related issues here
          console.warn('Failed to scrape content:', scrapeResponse?.error || 'Unknown error');
          
          // If the error message contains chrome:// or extension page references, it's likely a focus issue
          const errorMsg = scrapeResponse?.error || '';
          const errorContent = scrapeResponse?.data?.content || '';
          
          if (errorContent.includes('chrome://') || errorContent.includes('chrome-extension://') || 
              errorMsg.includes('chrome://') || errorMsg.includes('chrome-extension://')) {
            // Display a more helpful error to the user about focus issues
            displayErrorMessage('Content scraping failed. The extension is trying to scrape a Chrome settings page instead of your actual tab. Please click on the webpage you want to scrape first, then reopen the extension.');
          }
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
    
    // Add the user message to the UI
    appendMessage({
      role: 'user',
      content: messageText
    });
    
    // Store page content in the session data, but don't include it in the message history
    console.log('Sending message to API with page content length:', pageScraping ? (pageContent.length || 0) : 'disabled');
    
    // Make the API call
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SEND_USER_MESSAGE,
      data: {
        pageLoadId: currentSession.pageLoadId,
        message: messageText,
        url: tab.url,
        title: tab.title,
        pageContent: pageContent,  // Send page content to be stored in session but not in history
        enablePageScraping: pageScraping,
        enableWebSearch: webSearch,
        selectedModel,
        temperature  // Add temperature from preferences
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
            console.log('Found current session from fallback:', currentSession);
          }
        }
      } catch (storageError) {
        console.error('Storage fallback failed:', storageError);
      }
    }
    
    if (response && response.success && response.data) {
      // Store the session
      currentSession = response.data;
      console.log('Current session:', currentSession);
      
      // Render messages
      if (currentSession.messages && currentSession.messages.length > 0) {
        console.log('Rendering', currentSession.messages.length, 'messages');
        renderMessages(currentSession.messages);
      }
      
      // Update conversation info
      updateConversationInfo();
    }
    
    // Check and update toggle states after session load
    await checkToggleState();
    
    // Focus the input field
    messageInput.focus();
  } catch (error) {
    console.error('Error loading current session:', error);
    displayErrorMessage(error.message);
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
  
  // Check if we have web search annotations in the metadata before rendering
  let processedContent = message.content;
  
  if (message.metadata && message.metadata.citations) {
    // Format content with citations
    const citations = message.metadata.citations;
    
    // Replace citation markers with superscript numbers
    for (let i = 0; i < citations.length; i++) {
      const citation = citations[i];
      const index = i + 1;
      
      // Replace each citation marker with a superscript number
      const regex = new RegExp(`\\[${citation.title}\\]`, 'g');
      processedContent = processedContent.replace(regex, `<sup>[${index}]</sup>`);
    }
  }
  
  // Format the content with markdown
  contentElement.innerHTML = md.render(processedContent);
  
  // If this is an assistant message with web search results, add them
  if (message.role === 'assistant' && message.metadata && 
      (message.metadata.sources || message.metadata.citations)) {
    const sources = message.metadata.sources || message.metadata.citations || [];
    
    if (sources.length > 0) {
      const sourcesElement = document.createElement('div');
      sourcesElement.classList.add('sources-container');
      
      const sourcesTitle = document.createElement('h4');
      sourcesTitle.textContent = 'Web Search Results';
      sourcesTitle.classList.add('sources-title');
      sourcesElement.appendChild(sourcesTitle);
      
      const sourcesList = document.createElement('ul');
      sourcesList.classList.add('sources-list');
      
      sources.forEach((source, index) => {
        const sourceItem = document.createElement('li');
        sourceItem.classList.add('source-item');
        
        const sourceLink = document.createElement('a');
        sourceLink.href = source.url;
        sourceLink.target = '_blank';
        sourceLink.textContent = `[${index + 1}] ${source.title || 'Unknown Source'}`;
        sourceLink.classList.add('source-link');
        
        const sourceSnippet = document.createElement('p');
        sourceSnippet.textContent = source.snippet || '';
        sourceSnippet.classList.add('source-snippet');
        
        sourceItem.appendChild(sourceLink);
        sourceItem.appendChild(sourceSnippet);
        sourcesList.appendChild(sourceItem);
      });
      
      sourcesElement.appendChild(sourcesList);
      
      // Add a note about web search being active
      const webSearchNote = document.createElement('p');
      webSearchNote.textContent = 'Results from web search';
      webSearchNote.classList.add('web-search-note');
      sourcesElement.appendChild(webSearchNote);
      
      // Add sources after the content
      contentElement.appendChild(sourcesElement);
    }
  }
  
  // Add an indicator for in-progress web searches
  if (message.role === 'assistant' && message.metadata && message.metadata.webSearchInProgress) {
    const searchingIndicator = document.createElement('div');
    searchingIndicator.classList.add('searching-indicator');
    searchingIndicator.textContent = 'Searching the web...';
    contentElement.appendChild(searchingIndicator);
  }
  
  // Add error styling if there's an error
  if (message.role === 'assistant' && message.metadata && message.metadata.error) {
    messageElement.classList.add('error');
  }
  
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
    console.log('Checking for commands to execute...');
    
    // First check for the execute_last_input from double-click
    const { execute_last_input } = await chrome.storage.local.get('execute_last_input');
    if (execute_last_input) {
      console.log('Found execute_last_input:', execute_last_input);
      
      const { input, tabId, url, timestamp } = execute_last_input;
      const currentTime = Date.now();
      const isRecent = currentTime - timestamp < 30000; // 30 seconds threshold
      
      // Try to get current tab info for validation
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || !tabs.length) {
        console.error('No active tab found');
        await chrome.storage.local.remove('execute_last_input');
        return;
      }
      
      const currentTab = tabs[0];
      const matchesCurrentTab = tabId === currentTab.id && url === currentTab.url;
      
      console.log('Execute_last_input validation:', {
        input,
        isRecent,
        matchesCurrentTab,
        timeSinceCommand: currentTime - timestamp
      });
      
      // Execute if recent and matches current tab, or force execution if just recent
      if ((isRecent && matchesCurrentTab) || isRecent) {
        // Clear the stored command to prevent duplicate execution
        await chrome.storage.local.remove('execute_last_input');
        
        // Clear badge
        await chrome.action.setBadgeText({ text: '' });
        await chrome.action.setTitle({ title: '' });
        
        // Add a visual indicator at the top of the popup
        const executingNotice = document.createElement('div');
        executingNotice.className = 'executing-shortcut-notice';
        executingNotice.textContent = `Executing: "${input}"`;
        executingNotice.style.backgroundColor = '#FF9800';
        executingNotice.style.color = 'white';
        executingNotice.style.padding = '8px';
        executingNotice.style.textAlign = 'center';
        executingNotice.style.fontWeight = 'bold';
        executingNotice.style.position = 'sticky';
        executingNotice.style.top = '0';
        executingNotice.style.zIndex = '1000';
        executingNotice.style.borderRadius = '0 0 4px 4px';
        
        // Insert at the top of the popup
        document.body.insertBefore(executingNotice, document.body.firstChild);
        
        // Remove after execution
        setTimeout(() => {
          executingNotice.style.opacity = '0';
          executingNotice.style.transition = 'opacity 0.5s';
          setTimeout(() => executingNotice.remove(), 500);
        }, 3000);
        
        // Set input value
        messageInput.value = input;
        
        // Resize textarea to fit content
        messageInput.style.height = 'auto';
        messageInput.style.height = `${Math.min(messageInput.scrollHeight, 200)}px`;
        
        // Execute the query with a slight delay to ensure UI is ready
        setTimeout(() => {
          console.log('Auto-triggering submit from shortcut');
          handleSendMessage();
        }, 500);
        
        return; // Exit early since we're executing the command
      } else {
        // Clear outdated command
        console.log('Command is outdated or for a different tab, clearing it');
        await chrome.storage.local.remove('execute_last_input');
      }
    }
    
    // Fall back to older commandToExecute mechanism
    const { commandToExecute } = await chrome.storage.local.get('commandToExecute');
    if (commandToExecute) {
      console.log('Found legacy command to execute:', commandToExecute);
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

/**
 * Initialize button states based on saved settings
 */
async function initializeButtonStates() {
  try {
    const settings = await getSettings();
    
    // Initialize search page button state
    const pageScraping = settings.pageScraping !== undefined ? settings.pageScraping : true;
    searchPageButton.classList.toggle('active', pageScraping);
    
    // Initialize search web button state
    const webSearch = settings.webSearch !== undefined ? settings.webSearch : true;
    searchWebButton.classList.toggle('active', webSearch);
    
    console.log('Button states initialized:', { pageScraping, webSearch });
  } catch (error) {
    console.error('Error initializing button states:', error);
  }
}

/**
 * Set up auto-resize for the input field
 */
function setupInputAutoResize() {
  // Auto-resize textarea as user types
  messageInput.addEventListener('input', () => {
    // Reset height to calculate actual content height
    messageInput.style.height = 'auto';
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 200)}px`;
  });
}

/**
 * Get current user preferences
 * 
 * @return {Promise<Object>} User preferences
 */
export async function getUserPreferences() {
  try {
    const result = await chrome.storage.local.get('userPreferences');
    const defaultPreferences = {
      theme: 'system',
      temperature: 0,
      pageScraping: false,
      webSearch: false,
      currentSiteFilter: true,
      defaultModel: 'gpt-4o-mini'
    };
    
    // If userPreferences doesn't exist, initialize it with defaults
    if (!result.userPreferences) {
      await chrome.storage.local.set({ userPreferences: defaultPreferences });
      return defaultPreferences;
    }
    
    // Check for missing properties and provide defaults
    const preferences = result.userPreferences;
    const updatedPreferences = { ...defaultPreferences };
    
    // Only keep known values for each property
    Object.keys(defaultPreferences).forEach(key => {
      if (key in preferences) {
        updatedPreferences[key] = preferences[key];
      }
    });
    
    // If any missing properties were found, update storage
    if (Object.keys(updatedPreferences).some(key => !(key in preferences))) {
      await chrome.storage.local.set({ userPreferences: updatedPreferences });
    }
    
    return updatedPreferences;
  } catch (error) {
    console.error('Error getting user preferences:', error);
    return {};
  }
}

/**
 * Check the state of page scraping and web search toggles in settings and update UI
 */
async function checkToggleState() {
  try {
    // Get the latest user preferences directly from storage
    const result = await chrome.storage.local.get('userPreferences');
    const preferences = result.userPreferences || {};
    
    console.log('Retrieved user preferences for toggle state:', preferences);
    
    // Apply default values for missing preferences
    const pageScraping = preferences.pageScraping !== undefined ? preferences.pageScraping : false;
    const webSearch = preferences.webSearch !== undefined ? preferences.webSearch : false;
    
    // Update the toggle UI based on stored preferences
    const pageScrapingToggle = document.getElementById('page-scraping-toggle');
    const webSearchToggle = document.getElementById('web-search-toggle');
    
    if (pageScrapingToggle) {
      pageScrapingToggle.checked = pageScraping;
      console.log('Set page scraping toggle to:', pageScraping);
    }
    
    if (webSearchToggle) {
      webSearchToggle.checked = webSearch;
      console.log('Set web search toggle to:', webSearch);
    }
    
    // Also update button states
    if (searchPageButton) {
      searchPageButton.classList.toggle('active', pageScraping);
    }
    
    if (searchWebButton) {
      searchWebButton.classList.toggle('active', webSearch);
    }
    
    console.log('Updated toggle state from preferences:', { pageScraping, webSearch });
  } catch (error) {
    console.error('Error checking toggle state:', error);
  }
}

/**
 * Load the global last user input from storage
 * This ensures the lastQuery variable is set even when opening the popup in a new tab
 */
async function loadGlobalLastUserInput() {
  try {
    const result = await chrome.storage.local.get('global_last_user_input');
    if (result.global_last_user_input) {
      console.log('Loaded global last user input:', result.global_last_user_input);
      lastQuery = result.global_last_user_input;
    } else {
      console.log('No global last user input found in storage');
    }
  } catch (error) {
    console.error('Error loading global last user input:', error);
  }
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