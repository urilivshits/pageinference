/**
 * Chat Component
 * 
 * Handles displaying chat messages and sending user input to the background script.
 */

import { MESSAGE_TYPES } from '../../shared/constants.js';
import { marked } from '../../lib/marked.min.js';
import hljs from '../../lib/highlight.min.js';

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
  
  // Configure markdown renderer
  marked.setOptions({
    highlight: (code, lang) => {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return code;
    },
    breaks: true,
    gfm: true
  });
  
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
  const actionMessages = {
    reason: 'Please explain your reasoning for the last response.',
    searchPage: 'Please search the current page for relevant information.',
    searchWeb: 'Please search the web for up-to-date information about this topic.'
  };
  
  messageInput.value = actionMessages[action];
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
 * Handle showing a session from history
 */
async function handleShowSession(event) {
  const { pageLoadId, url, title } = event.detail;
  
  try {
    // Update session state
    sessionState.pageLoadId = pageLoadId;
    sessionState.url = url;
    sessionState.title = title;
    
    // Load the session
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_CHAT_SESSION,
      data: { pageLoadId }
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to load session');
    }
    
    currentSession = response.data;
    renderMessages(currentSession.messages);
    updateConversationInfo();
    
    // Clear any error messages
    hideErrorMessage();
  } catch (error) {
    console.error('Error showing session:', error);
    displayErrorMessage(error.message);
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
 * Handle sending a message with better error handling
 */
async function handleSendMessage() {
  const message = messageInput.value.trim();
  if (!message || sessionState.isLoading) return;
  
  // Prevent duplicate submissions
  if (preventDuplicateSubmission()) return;
  
  try {
    // Store last query
    sessionState.lastQuery = message;
    lastQuery = message; // Keep for backward compatibility
    
    // Clear input and reset height
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Clear saved input
    await clearSavedInputText();
    
    // Get current tab to send with message
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('Could not detect current tab');
    }
    
    // Show user message immediately
    appendMessage({ role: 'user', content: message });
    
    // Show loading indicator
    setLoading(true);
    
    // First, scrape the page content if needed
    let pageContent = null;
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeContent' });
      pageContent = response?.content;
    } catch (error) {
      console.warn('Error scraping page content:', error);
    }
    
    // Check if we have a session, create one if not
    if (!currentSession) {
      const sessionResponse = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CREATE_CHAT_SESSION,
        data: {
          url: tab.url,
          title: tab.title
        }
      });
      
      if (!sessionResponse.success) {
        throw new Error(sessionResponse.error || 'Failed to create chat session');
      }
      
      currentSession = sessionResponse.data;
    }
    
    // Send the message to the background script
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SEND_USER_MESSAGE,
      data: {
        pageLoadId: currentSession.pageLoadId,
        message: message,
        pageContent: pageContent
      }
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to send message');
    }
    
    // Update the current session with the response
    currentSession = response.data;
    
    // Update conversation info
    updateConversationInfo();
    
    // Render all messages
    renderMessages(currentSession.messages);
    
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
    // Clear messages
    chatMessages.innerHTML = '';
    
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      return;
    }
    
    // Try to get page load ID for the current tab
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_CHAT_SESSION,
      data: {
        url: tab.url
      }
    });
    
    if (response.success && response.data) {
      currentSession = response.data;
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
  contentElement.innerHTML = marked(message.content);
  
  messageElement.appendChild(contentElement);
  chatMessages.appendChild(messageElement);
  
  // Highlight code blocks
  messageElement.querySelectorAll('pre code').forEach(block => {
    hljs.highlightElement(block);
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