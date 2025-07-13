/**
 * Chat Component
 * 
 * Handles displaying chat messages and sending user input to the background script.
 */

import { MESSAGE_TYPES } from '../../shared/constants.js';
import { DEFAULT_SETTINGS } from '../../shared/models/settings.js';
// Remove the import of marked and use window.markdownit which is loaded via script tag
// import { marked } from '../lib/marked.min.js';
// Remove the import of highlight.min.js and use the global hljs object loaded by script tag
// import hljs from '../lib/highlight.min.js';

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

/**
 * Format timestamp to a readable string
 * 
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @return {string} Formatted time string
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

// DOM elements
let chatContainer;
let messageInput;
let sendButton;
let chatMessages;
let loadingIndicator;
let errorMessage;
let doubleClickArea;
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

// Helper function to clear chat messages while preserving the flower animation
function clearChatMessages() {
  if (!chatMessages) return;
  
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
    
    // Restart the animation on the restored flower
    setTimeout(() => {
      const restoredFlower = document.getElementById('popup-flower-animation');
      if (restoredFlower) {
        console.log('🌸 Restarting animation on restored flower');
        restoredFlower.style.animation = 'none';
        restoredFlower.offsetHeight; // Trigger reflow
        restoredFlower.style.animation = 'flowerGrowAndFade 5s ease-out forwards';
      }
    }, 50); // Small delay to ensure DOM is updated
  }
}

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
 * Initialize chat component
 */
export function initializeChatComponent() {
  console.log('Initializing chat component');
  
  try {
    // Defensive: abort if UI elements are missing
    if (!initializeUIElements()) return;
    
    // Set up event listeners
    setupEventListeners();
    
    // Load any saved messages and settings
    loadSessionState().catch(error => {
      console.error('Error loading session state:', error);
    });
    
    // Initialize button states, including the new toggle buttons
    initializeButtonStates().catch(error => {
      console.error('Error initializing button states:', error);
    });
    
    // Set up auto-resize for input
    setupInputAutoResize();
    
    // Make sure settings are in sync with UI state
    checkToggleState().catch(error => {
      console.error('Error checking toggle state:', error);
    });
    
    // Check for any pending command to execute, such as auto-execution from popup open
    console.log('Checking for pending commands during initialization');
    setTimeout(() => {
      checkForCommandToExecute().catch(error => {
        console.error('Error checking for command to execute:', error);
      });
    }, 300); // Short delay to ensure UI is fully loaded
    
    console.log('Chat component initialization complete');
  } catch (error) {
    console.error('Error initializing chat component:', error);
  }
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
  if (sendButton) sendButton.addEventListener('click', handleSendMessage);
  
  if (messageInput) messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  });
  
  if (messageInput) messageInput.addEventListener('input', () => {
    const maxHeight = window.innerHeight * 0.3;
    messageInput.style.height = 'auto';
    const newHeight = Math.min(messageInput.scrollHeight, maxHeight);
    messageInput.style.height = `${newHeight}px`;
  });
  
  // Action button handlers
  if (newChatButton) newChatButton.addEventListener('click', handleNewChat);
  // The reasonButton is removed, so we don't need this listener
  // reasonButton.addEventListener('click', () => handleActionButton('reason'));
  
  // These are now handled by initializeToggleButtons
  if (searchPageButton) searchPageButton.addEventListener('click', () => handleActionButton('searchPage'));
  if (searchWebButton) searchWebButton.addEventListener('click', () => handleActionButton('searchWeb'));
  
  // Double-click handler for last query
  if (doubleClickArea) doubleClickArea.addEventListener('dblclick', handleDoubleClick);
  
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
    // Clear the current session and UI
    currentSession = null;
    renderMessages([]);
    updateConversationInfo();
    messageInput.value = '';
    messageInput.style.height = 'auto';
    messageInput.focus();
    // Optionally, you can also clear the saved input text
    await clearSavedInputText();
    // Switch to the chat tab
    window.dispatchEvent(new CustomEvent('show-tab', { detail: { tabId: 'chat' } }));
    // Dispatch chat-session-updated to refresh sidebar
    window.dispatchEvent(new CustomEvent('chat-session-updated', { detail: { session: null } }));
    // Reset session state so next message creates a new session
    sessionState.chatHistory = [];
    sessionState.isSubmitting = false;
    sessionState.lastSubmittedQuestion = '';
    // Generate a new pageLoadId and set url/title from current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0] || {};
    sessionState.pageLoadId = await generateNewPageLoadId();
    sessionState.url = currentTab.url || '';
    sessionState.title = currentTab.title || currentTab.url || '';
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
  
  // Clear current messages without showing loading indicator
  setInputEnabled(false);
  clearChatMessages();
  
  try {
    console.log('Loading session with pageLoadId:', pageLoadId);
    
    // Get the session from the background script
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_CHAT_SESSION,
      data: { pageLoadId }
    });
    const session = response?.data;
    if (!session) {
      displayErrorMessage('Session not found');
      setInputEnabled(true);
      return;
    }
    // Set session state for continuation
    sessionState.pageLoadId = session.pageLoadId;
    sessionState.url = session.url;
    sessionState.title = session.title;
    sessionState.chatHistory = session.messages || [];
    currentSession = session;
    renderMessages(session.messages || []);
    updateConversationInfo();
    setInputEnabled(true);
    messageInput.value = '';
    messageInput.style.height = 'auto';
    messageInput.focus();
    // Optionally, clear saved input text
    await clearSavedInputText();
  } catch (err) {
    console.error('Failed to load session:', err);
    displayErrorMessage('Failed to load session');
    setInputEnabled(true);
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
 * Handle sending a new message
 * @param {Object} options - Options for handling the message
 * @param {boolean} [options.saveForAutoExecution=true] - Whether to save the message for auto-execution
 * @param {boolean} [options.isAutoExecution=false] - Whether this is an auto-execution (affects storage clearing)
 */
async function handleSendMessage(options = {}) {
  const { saveForAutoExecution = true, isAutoExecution = false } = options;
  
  try {
    // Get message text
    const messageText = messageInput.value.trim();
    
    // Don't send empty messages
    if (!messageText) {
      console.log('Ignoring empty message');
      return;
    }
    
    // If this is an auto-execution, clear execute_last_input from storage to prevent retry
    if (isAutoExecution) {
      try {
        await chrome.storage.local.remove('execute_last_input');
        console.log('Cleared execute_last_input from storage (auto-execution successful)');
      } catch (error) {
        console.error('Error clearing execute_last_input:', error);
      }
    }
    
    // Prevent duplicate submissions
    if (preventDuplicateSubmission()) {
      console.log('Preventing duplicate submission');
      return;
    }
    
    // === GUARD: Must have a session ID to send ===
    if (!sessionState.pageLoadId) {
      displayErrorMessage('No chat session loaded. Please select or start a chat.');
      setInputEnabled(true);
      return;
    }
    
    // Show loading state
    showLoadingState();
    
    // Store the message for potential reuse
    lastQuery = messageText;
    
    // Note: Removed global_last_user_input - now only using execute_last_input for unified storage
    
    // Also save to execute_last_input for auto-execution on next popup open, if enabled
    if (saveForAutoExecution) {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0] || {};
        
        await chrome.storage.local.set({
          'execute_last_input': {
            value: messageText,
            timestamp: Date.now(),
            // Include tab info but don't require it for execution
            tabId: currentTab.id,
            url: currentTab.url
          }
        });
        console.log('Saved execute_last_input for auto-execution:', messageText);
      } catch (error) {
        console.error('Error saving execute_last_input:', error);
        // Don't block the main flow if this fails
      }
    } else {
      console.log('Skipping execute_last_input save as saveForAutoExecution is disabled');
    }
    
    // Clear input field
    messageInput.value = '';
    clearSavedInputText();
    
    // Ensure settings are up-to-date
    await checkToggleState();
    
    // Get current user preferences
    const preferences = await getUserPreferences();
    console.log('Retrieved user preferences for sending message:', preferences);
    
    // Determine settings for this request
    const settings = {
      pageScraping: preferences.pageScraping !== undefined ? preferences.pageScraping : false,
      webSearch: preferences.webSearch !== undefined ? preferences.webSearch : false,
      		selectedModel: preferences.defaultModel || 'gpt-4.1-nano',
      temperature: preferences.temperature !== undefined ? preferences.temperature : 0
    };
    
    console.log('Using settings for message:', settings);
    
    // Add user message to UI immediately
    addMessageToUI('user', messageText);
    
    // Get page content if enabled
    let pageContent = '';
    if (settings.pageScraping) {
      try {
        console.log('Page scraping is enabled, extracting content');
        pageContent = await extractPageContent();
        console.log('Extracted page content length:', pageContent.length);
      } catch (error) {
        console.error('Error extracting page content:', error);
        addMessageToUI('system', 'Failed to extract page content. Continuing without it.');
      }
    } else {
      console.log('Page scraping is disabled, skipping content extraction');
    }
    
    // Use sessionState.pageLoadId if set, do not create new session if continuing
    let pageLoadId = sessionState.pageLoadId;
    if (!pageLoadId) {
      // New chat: ensure url and title are set
      if (!sessionState.url || !sessionState.title) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0] || {};
        sessionState.url = currentTab.url || '';
        sessionState.title = currentTab.title || currentTab.url || '';
      }
      pageLoadId = await generateNewPageLoadId();
      sessionState.pageLoadId = pageLoadId;
    }
    
    console.log('Sending message to API with page content length:', pageContent ? pageContent.length : 'disabled');
    
    // Get the current toggle states
    const { searchPageEnabled, searchWebEnabled } = await chrome.storage.local.get(['searchPageEnabled', 'searchWebEnabled']);

    // Send message to background script for processing
    const response = await chrome.runtime.sendMessage({
      type: 'send_user_message',
      data: {
        pageLoadId: sessionState.pageLoadId,
        message: messageText,
        pageContent: pageContent,
        webSearch: searchWebEnabled,
        model: settings.selectedModel,
        temperature: settings.temperature,
        url: sessionState.url,
        title: sessionState.title
      }
    });
    
    // Hide loading state
    hideLoadingState();
    
    // Reset submission state
    sessionState.isSubmitting = false;
    
    // Clear any ctrl key pending state after successful message submission
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (tabId) {
        await chrome.runtime.sendMessage({ action: 'clearCtrlKeyState', tabId });
        console.log('Cleared ctrl key state after message submission');
      }
    } catch (error) {
      console.error('Error clearing ctrl key state after submission:', error);
    }
    
    // Handle response
    if (response && response.success) {
      // Update session with response data
      const responseData = response.data;
      
      // Display assistant's response
      if (responseData.response && responseData.response.content) {
        addMessageToUI('assistant', responseData.response.content);
      } else {
        console.error('Invalid response format:', responseData);
        showErrorMessage('Invalid response from server');
      }
      
      // Update session info if returned
      if (responseData.session) {
        sessionState.pageLoadId = responseData.session.pageLoadId;
        displaySessionInfo(responseData.session);
        
        // Notify other components about session update
        window.dispatchEvent(new CustomEvent('chat-session-updated', {
          detail: { session: responseData.session }
        }));
      }
      // Always dispatch chat-session-updated after sending a message
      if (responseData.session) {
        window.dispatchEvent(new CustomEvent('chat-session-updated', {
          detail: { session: responseData.session }
        }));
      }
    } else {
      // Show error message
      const errorMessage = response && response.error ? response.error : 'Failed to process message';
      console.error('Error response:', errorMessage);
      showErrorMessage(errorMessage);
      
      // Add error message to chat
      addMessageToUI('system', `Error: ${errorMessage}`);
    }
  } catch (error) {
    console.error('Error sending message:', error);
    hideLoadingState();
    sessionState.isSubmitting = false;
    showErrorMessage(error.message || 'Failed to send message');
    addMessageToUI('system', `Error: ${error.message || 'Failed to send message'}`);
  }
}

/**
 * Load the current chat session for the active tab
 */
async function loadCurrentSession() {
  try {
    console.log('Loading current chat session...');
    
    // Clear messages
    clearChatMessages();
    
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
    // Update session state
    sessionState.pageLoadId = currentSession.pageLoadId;
    sessionState.url = currentSession.url;
    sessionState.title = currentSession.title;
    
    // Notify sidebar to highlight active session
    window.dispatchEvent(new CustomEvent('active-session-changed', {
      detail: { session: currentSession }
    }));
    
    // Notify history component
    window.dispatchEvent(new CustomEvent('chat-session-updated', {
      detail: { session: currentSession }
    }));
  }
}

/**
 * Render all messages in the chat
 * 
 * @param {Array} messages - Array of message objects
 */
function renderMessages(messages) {
  // Clear messages
  clearChatMessages();
  
  // Add each message
  messages.forEach(message => {
    if (message.role !== 'system') {
      appendMessage(message);
    }
  });
  
  // Highlight all code blocks after rendering
  chatMessages.querySelectorAll('pre code').forEach(block => {
    window.hljs.highlightElement(block);
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
  
  // Add timestamp element
  const timestampElement = document.createElement('div');
  timestampElement.classList.add('message-timestamp');
  
  // Format and display appropriate timestamp
  let timestampToShow = null;
  let timestampLabel = '';
  
  if (message.role === 'user' && message.requestTime) {
    timestampToShow = message.requestTime;
  } else if (message.role === 'assistant' && message.responseTime) {
    timestampToShow = message.responseTime;
  } else if (message.timestamp) {
    // Fallback to general timestamp
    timestampToShow = message.timestamp;
  }
  
  if (timestampToShow) {
    const timeString = formatTimestamp(timestampToShow);
    timestampElement.textContent = timeString; // Just show the time, no label
  }

  // Add copy button
  const copyButton = document.createElement('button');
  copyButton.classList.add('copy-button');
  copyButton.title = 'Copy message';
  copyButton.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  `;
  
  copyButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      // Get the text content without HTML tags and clean up whitespace
      const rawText = contentElement.innerText || contentElement.textContent;
      const cleanedText = rawText
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple newlines with double newline
        .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
        .trim(); // Remove leading/trailing whitespace
      
      await navigator.clipboard.writeText(cleanedText);
      
      // Visual feedback
      copyButton.classList.add('copied');
      copyButton.title = 'Copied!';
      
      // Reset after 2 seconds
      setTimeout(() => {
        copyButton.classList.remove('copied');
        copyButton.title = 'Copy message';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
      // Fallback for older browsers
      try {
        const rawText = contentElement.innerText || contentElement.textContent;
        const cleanedText = rawText
          .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple newlines with double newline
          .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
          .trim(); // Remove leading/trailing whitespace
        
        const textArea = document.createElement('textarea');
        textArea.value = cleanedText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        // Visual feedback for fallback
        copyButton.classList.add('copied');
        copyButton.title = 'Copied!';
        setTimeout(() => {
          copyButton.classList.remove('copied');
          copyButton.title = 'Copy message';
        }, 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy also failed:', fallbackErr);
      }
    }
  });
  
  messageElement.appendChild(contentElement);
  messageElement.appendChild(timestampElement); // Append timestamp before copy button
  messageElement.appendChild(copyButton);
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
    // Only clear the session-specific input if we have a session
    if (currentSession?.pageLoadId) {
      await chrome.storage.local.remove(`input_text_${currentSession.pageLoadId}`);
    }
    
    // Note: execute_last_input is cleared by auto-execution system when used
    console.log('Cleared saved input text');
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
 * Check for any pending command that should be auto-executed
 */
async function checkForCommandToExecute() {
  try {
    console.log('🔍 COMMAND EXECUTION: Starting checkForCommandToExecute');
    
    // First make sure all UI elements are fully initialized
    initializeUIElements();
    
    // Content script injection no longer needed - using working popup-level ctrl detection
    
    // Ensure theme is applied from settings
    const userPrefs = await getUserPreferences();
    const theme = userPrefs.theme || 'light';
    document.body.setAttribute('data-theme', theme);
    console.log('Applied theme from settings:', theme);
    
    // Add visual indicator that the UI is ready
    chatContainer.style.transition = 'opacity 0.3s ease';
    chatContainer.style.opacity = '1';
    
    // *** CRITICAL: Check repeat message trigger setting to determine execution behavior
    const currentUserPrefs = await getUserPreferences();
    const repeatMessageTrigger = currentUserPrefs.repeatMessageTrigger || 'manual';
    
    // Use the working popup-level ctrl detection instead of broken background script approach
    let isCtrlPressed = false;
    let wasCtrlClickPending = false;
    
    // Use the same comprehensive detection methods as the working popup.js system
    let ctrlKeyDetected = false;
    
    // Method 1: Check the window.ctrlKeyPressed global variable set by popup.js detection
    if (window.ctrlKeyPressed === true) {
      ctrlKeyDetected = true;
      console.log('Ctrl key detected via window.ctrlKeyPressed (working popup detection)');
    }
    
    // Method 2: Check if Ctrl key is currently pressed using browser APIs
    try {
      if (navigator.userAgent.indexOf('Mac') !== -1) {
        // Check Command key on Mac
        if (window.event?.metaKey) {
          ctrlKeyDetected = true;
          console.log('Command key detected via window.event.metaKey on Mac');
        }
      } else {
        // Check Ctrl key on other platforms
        if (window.event?.ctrlKey) {
          ctrlKeyDetected = true;
          console.log('Ctrl key detected via window.event.ctrlKey');
        }
      }
    } catch (error) {
      console.warn('Error checking browser event state:', error);
    }
    
    isCtrlPressed = ctrlKeyDetected;
    wasCtrlClickPending = ctrlKeyDetected;
    
    console.log('Ctrl key state from popup-level detection:', { 
      ctrlKeyPressed: isCtrlPressed, 
      ctrlClickPending: wasCtrlClickPending,
      windowCtrlKeyPressed: window.ctrlKeyPressed,
      detectionMethod: 'popup-level'
    });
    
    let shouldAutoExecute = false;
    switch (repeatMessageTrigger) {
      case 'auto':
        // Normal click → Auto-execute, Ctrl+click → Just open
        shouldAutoExecute = !isCtrlPressed;
        console.log(`AUTO mode: Normal click executes, Ctrl+click opens. Ctrl pressed: ${isCtrlPressed}, should execute: ${shouldAutoExecute}`);
        if (isCtrlPressed) {
          console.log('💡 TIP: If you want Ctrl+click to execute commands, switch to MANUAL mode in settings');
        }
        break;
      case 'manual':
        // Normal click → Just open, Ctrl+click → Auto-execute
        shouldAutoExecute = isCtrlPressed;
        console.log(`MANUAL mode: Normal click opens, Ctrl+click executes. Ctrl pressed: ${isCtrlPressed}, should execute: ${shouldAutoExecute}`);
        break;
      case 'disabled':
        // Never auto-execute
        shouldAutoExecute = false;
        console.log(`DISABLED mode: Never auto-execute. Should execute: ${shouldAutoExecute}`);
        break;
      default:
        // Fallback to 'manual' behavior
        shouldAutoExecute = isCtrlPressed;
        console.log(`DEFAULT mode (fallback to manual): Ctrl pressed: ${isCtrlPressed}, should execute: ${shouldAutoExecute}`);
        break;
    }
    
    if (!shouldAutoExecute) {
      if (isCtrlPressed) {
        console.log('Skipping auto-execution - Ctrl key detected');
      } else {
        console.log(`Auto-execute skipped based on trigger setting: ${repeatMessageTrigger}`);
      }
      return;
    }
    
    // If we reach here, auto-execution should proceed
    console.log('Proceeding with auto-execution - Ctrl key not detected');
    
    // Check for auto-execution from storage
    const { execute_last_input } = await chrome.storage.local.get('execute_last_input');
    if (execute_last_input) {
      console.log('Found execute_last_input in storage:', execute_last_input);
      
      // DON'T clear from storage immediately - only clear after successful execution or final abort
      // This allows retry if execution gets interrupted
      
      // Check if behavior should allow auto-execution
      const finalIsCtrlPressed = window.ctrlKeyPressed === true;
      let finalShouldExecute = false;
      switch (repeatMessageTrigger) {
        case 'auto':
          finalShouldExecute = !finalIsCtrlPressed;
          break;
        case 'manual':
          finalShouldExecute = finalIsCtrlPressed;
          break;
        case 'disabled':
          finalShouldExecute = false;
          break;
        default:
          finalShouldExecute = finalIsCtrlPressed;
          break;
      }
      
      if (!finalShouldExecute) {
        console.log(`COMMAND EXECUTION: Skipping auto-execution during command retrieval based on trigger setting: ${repeatMessageTrigger}, Ctrl pressed: ${finalIsCtrlPressed}`);
        // Only clear storage if we're definitively not executing (to prevent retry issues)
        if (repeatMessageTrigger === 'disabled') {
          await chrome.storage.local.remove('execute_last_input');
          console.log('Cleared execute_last_input from storage (disabled mode)');
        }
        return;
      }
      
      // Clear any badge indicators
      try {
        await chrome.action.setBadgeText({ text: '' });
        await chrome.action.setTitle({ title: '' });
      } catch (error) {
        console.error('Error clearing badge:', error);
      }
      
      // Extract values, supporting both formats
      const input = execute_last_input.input || execute_last_input.value || '';
      const tabId = execute_last_input.tabId || null;
      const url = execute_last_input.url || '';
      const timestamp = execute_last_input.timestamp || Date.now();
      
      const currentTime = Date.now();
      const isRecent = currentTime - timestamp < 30000; // 30 seconds threshold
      
      // Validate the command (must have input and be recent)
      if (!input || !input.trim()) {
        console.log('Command has empty input, ignoring');
        return;
      }
      
      if (!isRecent) {
        console.log('Command is too old, ignoring', { 
          timeSinceCommand: currentTime - timestamp,
          threshold: '30 seconds'
        });
        return;
      }
      
      // Check ONCE MORE if behavior should allow auto-execution during validation
      // IMPORTANT: Use cached ctrl state instead of current state to prevent timing issues
      const validationIsCtrlPressed = isCtrlPressed; // Use the initial ctrl state, not current
      let validationShouldExecute = false;
      switch (repeatMessageTrigger) {
        case 'auto':
          validationShouldExecute = !validationIsCtrlPressed;
          break;
        case 'manual':
          validationShouldExecute = validationIsCtrlPressed;
          break;
        case 'disabled':
          validationShouldExecute = false;
          break;
        default:
          validationShouldExecute = validationIsCtrlPressed;
          break;
      }
      
      if (!validationShouldExecute) {
        console.log(`COMMAND EXECUTION: Skipping auto-execution during validation based on trigger setting: ${repeatMessageTrigger}, Ctrl pressed: ${validationIsCtrlPressed}`);
        // Clear execute_last_input since we're not executing
        await chrome.storage.local.remove('execute_last_input');
        console.log('Cleared execute_last_input from storage (validation failed)');
        return;
      }
      
      // Try to get current tab info for validation
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || !tabs.length) {
        console.error('No active tab found for validation');
        return;
      }
      
      const currentTab = tabs[0];
      const matchesCurrentTab = tabId === currentTab.id && url === currentTab.url;
      
      console.log('Execute_last_input validation:', {
        input: input.substring(0, 50) + (input.length > 50 ? '...' : ''),
        isRecent,
        matchesCurrentTab,
        timeSinceCommand: currentTime - timestamp,
        currentTab: { id: currentTab.id, url: currentTab.url },
        commandTab: { id: tabId, url }
      });
      
      // Even if tabs don't perfectly match, we'll still execute if the command is recent
      // This improves reliability across different browser contexts
      
      // Set input value and make sure it's visible
      messageInput.value = input;
      
      // Protect against premature ctrl key clearing during auto-execution
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        if (tabId) {
          // Request background script to extend ctrl key timeout during execution
          await chrome.runtime.sendMessage({ 
            action: 'extendCtrlKeyTimeout', 
            tabId: tabId,
            duration: 5000 // 5 seconds should be enough for execution
          });
          console.log('Extended ctrl key timeout for auto-execution');
        }
      } catch (error) {
        console.warn('Could not extend ctrl key timeout:', error);
      }
      
      // Make sure the input is visible and styled properly
      messageInput.classList.add('auto-execute');
      setTimeout(() => messageInput.classList.remove('auto-execute'), 1000);
      
      // Resize textarea to fit content
      messageInput.style.height = 'auto';
      messageInput.style.height = `${Math.min(messageInput.scrollHeight, 200)}px`;
      messageInput.focus();
      
      // Show visual indicator that we're auto-executing
      const chatHistory = document.querySelector('.chat-history') || document.getElementById('chat-history');
      if (chatHistory) {
        const executingNotice = document.createElement('div');
        executingNotice.className = 'auto-execute-notice';
        executingNotice.textContent = matchesCurrentTab 
          ? `Auto-executing: "${input.substring(0, 50)}${input.length > 50 ? '...' : ''}"`
          : `Auto-executing from different tab: "${input.substring(0, 40)}${input.length > 40 ? '...' : ''}"`;
        
        executingNotice.style.backgroundColor = '#4CAF50';
        executingNotice.style.color = 'white';
        executingNotice.style.padding = '8px';
        executingNotice.style.textAlign = 'center';
        executingNotice.style.fontWeight = 'bold';
        executingNotice.style.borderRadius = '4px';
        executingNotice.style.margin = '8px 0';
        
        chatHistory.insertBefore(executingNotice, chatHistory.firstChild);
        
        // Fade out after a few seconds
        setTimeout(() => {
          executingNotice.style.transition = 'opacity 0.5s';
          executingNotice.style.opacity = '0';
          setTimeout(() => executingNotice.remove(), 500);
        }, 3000);
      }
      
      // Execute the query with a slight delay to ensure UI is ready
      setTimeout(async () => {
        // Check one final time if behavior should allow auto-execution
        // IMPORTANT: Use cached ctrl state instead of current state to prevent timing issues
        const finalCtrlPressed = isCtrlPressed; // Use the initial cached state, not current window state
        let finalExecuteAllowed = false;
        switch (repeatMessageTrigger) {
          case 'auto':
            finalExecuteAllowed = !finalCtrlPressed;
            break;
          case 'manual':
            finalExecuteAllowed = finalCtrlPressed;
            break;
          case 'disabled':
            finalExecuteAllowed = false;
            break;
          default:
            finalExecuteAllowed = finalCtrlPressed;
            break;
        }
        
        if (!finalExecuteAllowed) {
          console.log(`COMMAND EXECUTION: Skipping auto-execution right before execution based on trigger setting: ${repeatMessageTrigger}, Ctrl pressed: ${finalCtrlPressed}`);
          // Clear execute_last_input since we're aborting execution
          await chrome.storage.local.remove('execute_last_input');
          console.log('Cleared execute_last_input from storage (execution aborted)');
          return;
        }
        
        console.log('Auto-triggering submit from command');
        // Double-check that input still has the value before submitting
        if (!messageInput.value || !messageInput.value.trim()) {
          console.error('Input is empty right before submission, refilling:', input);
          messageInput.value = input;
        }
        
        // Mark that this is an auto-execution to handle storage clearing
        handleSendMessage({ isAutoExecution: true });
      }, 800); // Increased delay for more reliable execution
      
      return; // Exit early since we're executing the command
    }
    
    // Fall back to older commandToExecute mechanism for backward compatibility
    const { commandToExecute } = await chrome.storage.local.get('commandToExecute');
    if (commandToExecute) {
      // Check if behavior should allow auto-execution for legacy command
      const legacyCtrlPressed = window.ctrlKeyPressed === true;
      let legacyShouldExecute = false;
      switch (repeatMessageTrigger) {
        case 'auto':
          legacyShouldExecute = !legacyCtrlPressed;
          break;
        case 'manual':
          legacyShouldExecute = legacyCtrlPressed;
          break;
        case 'disabled':
          legacyShouldExecute = false;
          break;
        default:
          legacyShouldExecute = legacyCtrlPressed;
          break;
      }
      
      if (!legacyShouldExecute) {
        console.log(`COMMAND EXECUTION: Skipping legacy command execution based on trigger setting: ${repeatMessageTrigger}, Ctrl pressed: ${legacyCtrlPressed}`);
        // Clear the command still
        await chrome.storage.local.remove('commandToExecute');
        return;
      }
      
      console.log('Found legacy command to execute:', commandToExecute);
      
      // Clear the command immediately
      await chrome.storage.local.remove('commandToExecute');
      
      // Execute if it's not empty
      if (commandToExecute && commandToExecute.trim()) {
        messageInput.value = commandToExecute;
        handleSendMessage();
      }
    }
  } catch (error) {
    console.error('Error checking for command to execute:', error);
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
  sessionState.isSubmitting = true;
  sessionState.lastSubmittedQuestion = messageInput.value.trim();
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
    if (searchPageButton) {
      searchPageButton.classList.toggle('active', pageScraping);
    }
    
    // Initialize search web button state
    const webSearch = settings.webSearch !== undefined ? settings.webSearch : false;
    if (searchWebButton) {
      searchWebButton.classList.toggle('active', webSearch);
    }
    
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
    const defaultPreferences = DEFAULT_SETTINGS;
    
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

// Removed loadGlobalLastUserInput function - now using unified execute_last_input storage

/**
 * Initialize UI elements
 */
function initializeUIElements() {
  console.log('Initializing UI elements for chat component');
  
  // First, immediately notify the background script that the popup is opening 
  // This must be done before any other operations to ensure proper tab tracking
  notifyBackgroundScriptOfPopupOpen();
  
  // Get DOM elements
  chatContainer = document.getElementById('chat-container');
  chatMessages = document.getElementById('chat-messages');
  messageInput = document.getElementById('message-input');
  sendButton = document.getElementById('send-button');
  newChatButton = document.getElementById('new-chat-button');
  reasonButton = document.getElementById('reason-button');
  searchPageButton = document.getElementById('search-page-button');
  searchWebButton = document.getElementById('search-web-button');
  doubleClickArea = document.getElementById('double-click-area');
  loadingIndicator = document.getElementById('loading-indicator');
  errorMessage = document.getElementById('error-message');
  modelSelect = document.getElementById('model-select');
  // Defensive: check for required elements
  if (!chatMessages || !messageInput || !sendButton) {
    console.error('Critical chat UI elements missing. Aborting chat initialization.');
    return false;
  }
  console.log('UI elements initialized');
  return true;
}

/**
 * Load session state
 */
async function loadSessionState() {
  console.log('Loading current session state');
  
  try {
    // Get current tab info to load the appropriate session
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      console.error('No active tab found');
      return;
    }
    
    const currentTab = tabs[0];
    const tabId = currentTab.id;
    const url = currentTab.url;
    const title = currentTab.title || '';
    
    console.log('Current tab info:', { tabId, url, title });
    
    // Try to load existing session for this URL
    const response = await chrome.runtime.sendMessage({
      type: 'get_chat_session',
      data: { url }
    });
    
    if (response.success && response.data) {
      const session = response.data;
      console.log('Found existing session:', session);
      
      // Store session info
      sessionState.pageLoadId = session.pageLoadId;
      sessionState.chatHistory = session.messages || [];
      sessionState.url = session.url;
      sessionState.title = session.title;
      currentSession = session;
      
      // Update UI with session information
      displaySessionInfo(session);
      
      // Update conversation info and notify sidebar
      updateConversationInfo();
      
      // Render all messages from this session
      renderChatHistory(sessionState.chatHistory);
      
      // Store the last query for potential reuse
      if (sessionState.chatHistory && sessionState.chatHistory.length > 0) {
        const userMessages = sessionState.chatHistory.filter(msg => msg.role === 'user');
        if (userMessages.length > 0) {
          lastQuery = userMessages[userMessages.length - 1].content;
        }
      }
    } else {
      console.log('No existing session found for URL, initializing new session');
      
      // Initialize a new empty session for this URL
      sessionState.pageLoadId = `session_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
      sessionState.chatHistory = [];
      sessionState.url = url;
      sessionState.title = title;
      
      // Create session object
      currentSession = {
        pageLoadId: sessionState.pageLoadId,
        url: url,
        title: title,
        messages: [],
        timestamp: Date.now()
      };
      
      // Create a new session in the background
      const createResponse = await chrome.runtime.sendMessage({
        type: 'create_chat_session',
        data: currentSession
      });
      
      if (createResponse.success) {
        console.log('Created new session:', createResponse.data);
        // Update conversation info and notify sidebar
        updateConversationInfo();
      } else {
        console.error('Failed to create new session:', createResponse.error);
      }
    }
  } catch (error) {
    console.error('Error loading session state:', error);
  }
}

/**
 * Display session information in the UI
 * @param {Object} session - The session data to display
 */
function displaySessionInfo(session) {
  try {
    if (!session) {
      console.error('Cannot display session info: No session provided');
      return;
    }
    
    console.log('Displaying session info:', {
      title: session.title,
      url: session.url,
      pageLoadId: session.pageLoadId,
      messageCount: session.messages ? session.messages.length : 0
    });
    
    // Update any additional UI elements related to the session
    if (newChatButton) {
      newChatButton.style.display = 'block';
    }
  } catch (error) {
    console.error('Error displaying session info:', error);
  }
}

/**
 * Render chat history in the UI
 * @param {Array} messages - Array of chat messages to render
 */
function renderChatHistory(messages) {
  try {
    if (!chatMessages) {
      console.error('Cannot render chat history: chatMessages element not found');
      return;
    }
    // Clear existing messages
    clearChatMessages();
    // If no messages, show empty state
    if (!messages || messages.length === 0) {
      console.log('No messages to render, showing empty state');
      return;
    }
    console.log(`Rendering ${messages.length} chat messages`);
    // Render each message using appendMessage for consistent styling
    messages.forEach(msg => {
      appendMessage(msg);
    });
    // Highlight all code blocks after rendering
    chatMessages.querySelectorAll('pre code').forEach(block => {
      window.hljs.highlightElement(block);
    });
    // Scroll to the bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (error) {
    console.error('Error rendering chat history:', error);
  }
}

/**
 * Show loading state in the UI
 */
function showLoadingState() {
  if (loadingIndicator) {
    loadingIndicator.style.display = 'block';
  }
  
  if (sendButton) {
    sendButton.disabled = true;
    sendButton.classList.add('loading');
  }
}

/**
 * Hide loading state in the UI
 */
function hideLoadingState() {
  if (loadingIndicator) {
    loadingIndicator.style.display = 'none';
  }
  
  if (sendButton) {
    sendButton.disabled = false;
    sendButton.classList.remove('loading');
  }
}

/**
 * Show error message in the UI
 * @param {string} message - The error message to display
 */
function showErrorMessage(message) {
  if (!errorMessage) return;
  
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  
  // Auto-hide after a few seconds
  setTimeout(() => {
    if (errorMessage) {
      errorMessage.style.display = 'none';
    }
  }, 5000);
}

/**
 * Add a message to the UI
 * @param {string} role - The role of the message sender ('user', 'assistant', 'system')
 * @param {string} content - The message content
 */
function addMessageToUI(role, content) {
  if (!chatMessages) {
    console.error('Cannot add message to UI: chatMessages element not found');
    return;
  }
  
  const currentTime = Date.now();
  
  // Create message object with appropriate timestamps
  const message = { 
    role, 
    content, 
    timestamp: currentTime, // Keep for backward compatibility
    requestTime: role === 'user' ? currentTime : null,
    responseTime: role === 'assistant' ? currentTime : null
  };
  
  appendMessage(message);
  // Highlight all code blocks after rendering
  chatMessages.querySelectorAll('pre code').forEach(block => {
    window.hljs.highlightElement(block);
  });
  // Update session state if needed
  if (!sessionState.chatHistory) {
    sessionState.chatHistory = [];
  }
  sessionState.chatHistory.push(message);
}

/**
 * Extract page content from the current tab
 * 
 * @returns {Promise<string>} - The extracted page content
 */
async function extractPageContent() {
  try {
    console.log('Extracting page content from current tab');
    
    // Get current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found for content extraction');
    }
    
    const currentTab = tabs[0];
    console.log('Sending scrape request for tab:', currentTab.id);
    
    // Request content scraping from background script
    const scrapeMessage = {
      type: MESSAGE_TYPES.SCRAPE_PAGE_CONTENT,
      tabId: currentTab.id,
      url: currentTab.url
    };
    console.log('[Page Inference] POPUP: Sending scrape message:', scrapeMessage);
    const response = await chrome.runtime.sendMessage(scrapeMessage);
    console.log('[Page Inference] POPUP: Received scrape response:', response);
    
    if (!response || !response.success) {
      const errorMsg = response?.error || 'Unknown error scraping page content';
      console.error('Error response from content scraping:', errorMsg);
      throw new Error(errorMsg);
    }
    
    if (!response.data || !response.data.content) {
      console.warn('No content returned from page scraping');
      if (response.data?.note) {
        console.info('Scraper note:', response.data.note);
      }
      return '';
    }
    
    console.log('Successfully scraped page content, length:', response.data.content.length);
    return response.data.content;
  } catch (error) {
    console.error('Error in extractPageContent:', error);
    throw error;
  }
}

/**
 * Execute the command currently in the input field
 * This function is called from popup.js for auto-execution
 */
async function executeCommand() {
  try {
    console.log('executeCommand called from popup.js auto-execution');
    
    // Get current user preferences to check repeat message trigger setting
    const execUserPrefs = await getUserPreferences();
    const execRepeatTrigger = execUserPrefs.repeatMessageTrigger || 'manual';
    
    // Query background script for current ctrl key state
    let execCtrlPressed = false;
    let execWasCtrlClickPending = false;
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      const ctrlState = await chrome.runtime.sendMessage({ action: 'getCtrlKeyState', tabId });
      // Check for pending state (ctrl was pressed during click) rather than current pressed state
      execCtrlPressed = ctrlState?.ctrlClickPending === true || ctrlState?.ctrlKeyPressed === true;
      execWasCtrlClickPending = ctrlState?.ctrlClickPending === true;
      console.log('Ctrl key state for execution:', { pressed: ctrlState?.ctrlKeyPressed, pending: ctrlState?.ctrlClickPending, final: execCtrlPressed });
      
      // DON'T clear the pending state here - let the message submission handle it
      // This ensures ctrl state persists through the entire execution chain
    } catch (error) {
      console.error('Error getting ctrl key state for execution:', error);
      // Fallback to window global
      execCtrlPressed = window.ctrlKeyPressed === true;
    }
    
    let execShouldExecute = false;
    switch (execRepeatTrigger) {
      case 'auto':
        execShouldExecute = !execCtrlPressed;
        break;
      case 'manual':
        execShouldExecute = execCtrlPressed;
        break;
      case 'disabled':
        execShouldExecute = false;
        break;
      default:
        execShouldExecute = execCtrlPressed;
        break;
    }
    
    if (!execShouldExecute) {
      console.log(`EXECUTE_COMMAND: Skipping auto-execution based on trigger setting: ${execRepeatTrigger}, Ctrl pressed: ${execCtrlPressed}`);
      return;
    }
    
    // Call the handleSendMessage function to process the current input
    handleSendMessage();
  } catch (error) {
    console.error('Error in executeCommand:', error);
    displayErrorMessage('Failed to execute command: ' + error.message);
  }
}

// Add this helper function near the top (after imports)
async function generateNewPageLoadId() {
  try {
    // Try to get a new pageLoadId from the background script
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GENERATE_PAGE_LOAD_ID
    });
    if (response && response.pageLoadId) {
      return response.pageLoadId;
    }
  } catch (err) {
    // Ignore and fallback
  }
  // Fallback: use timestamp-based ID
  return `session_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

// Helper to enable/disable input and send button
function setInputEnabled(enabled) {
  if (messageInput) messageInput.disabled = !enabled;
  if (sendButton) sendButton.disabled = !enabled;
}

// Export the chat component
export default {
  initializeChatComponent,
  setLoading,
  displayErrorMessage,
  hideErrorMessage,
  loadCurrentSession,
  lastQuery,
  executeCommand,
  handleNewChat
};
