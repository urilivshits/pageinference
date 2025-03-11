console.log('popup.js loaded');

/**
 * Page Inference - Popup Script
 * 
 * This script handles:
 * 1. User interactions in the popup UI
 * 2. Communication with the background script
 * 3. Display of results and error messages
 * 4. Management of chat history
 */

// Default model name
const DEFAULT_MODEL = 'gpt-4o-mini';

// Common variables
let chatHistory;
let mainContent;
let pastConversationsView;
let settingsContent;
let currentConversationTitle;
let currentConversationTimestamp;
let errorMessage;
let modelSelect;
let currentTabId;
let currentUrl;
let currentPageTitle;
let currentPageLoadId;
let isInNewConversation = true;
let wasInConversationsView = false; // Track last view before going to settings
let isProcessing = false; // Add this flag near the other global variables at the top

// DOM elements - will be populated in DOMContentLoaded

// Event listeners for all document elements
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOMContentLoaded fired');
  console.log('Initializing DOM elements...');
  
  // Get DOM elements
  const submitBtn = document.getElementById('submitBtn');
  console.log('submitBtn element:', submitBtn);
  
  const questionInput = document.getElementById('questionInput');
  console.log('questionInput element:', questionInput);
  const loadingIndicator = document.getElementById('loadingIndicator');
  errorMessage = document.getElementById('errorMessage');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const toggleApiKeyBtn = document.getElementById('toggleApiKeyBtn');
  modelSelect = document.getElementById('modelSelect');
  const themeOptions = document.querySelectorAll('input[name="theme"]');
  const newConversationBtn = document.getElementById('newConversationBtn');
  const pastSessionsBtn = document.getElementById('pastSessionsBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  chatHistory = document.getElementById('chatHistory');
  mainContent = document.getElementById('mainContent');
  pastConversationsView = document.getElementById('pastConversationsView');
  settingsContent = document.getElementById('settingsContent');
  const sessionsContainer = document.getElementById('sessionsContainer');
  currentConversationTitle = document.getElementById('currentConversationTitle');
  currentConversationTimestamp = document.getElementById('currentConversationTimestamp');

  // Ensure we start with the main view
  showMainView();
  updateUIState();

  // Get current tab information
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs[0]) {
      currentTabId = tabs[0].id;
      currentUrl = tabs[0].url;
      currentPageTitle = tabs[0].title || new URL(currentUrl).hostname;
      
      // Check for existing page load ID or create a new one
      await checkOrCreatePageLoadId();
      
      // Load chat history for this tab/URL/pageLoadId
      await loadChatHistory();
      
      // Load saved input text
      await loadSavedInputText();
      
      // Update conversation info
      updateConversationInfo();
      
      // Update UI state
      updateUIState();
    }
  });
  
  // Load saved settings
  const { apiKey } = await chrome.runtime.sendMessage({ action: 'getApiKey' });
  if (apiKey) {
    apiKeyInput.value = apiKey;
  }
  
  // Load saved model preference
  chrome.storage.sync.get('modelPreference', (data) => {
    if (data.modelPreference) {
      // Check if the saved model preference exists in the dropdown
      const optionExists = Array.from(modelSelect.options).some(opt => opt.value === data.modelPreference);
      
      if (optionExists) {
        modelSelect.value = data.modelPreference;
      } else {
        // Default to gpt-4o-mini if saved preference doesn't exist in dropdown
        modelSelect.value = DEFAULT_MODEL;
        // Update stored preference
        chrome.storage.sync.set({ modelPreference: DEFAULT_MODEL });
      }
    } else {
      // Default to gpt-4o-mini if no preference is set
      modelSelect.value = DEFAULT_MODEL;
      // Save the default preference
      chrome.storage.sync.set({ modelPreference: DEFAULT_MODEL });
    }
  });

  // Load saved theme preference
  chrome.storage.sync.get('themePreference', (data) => {
    if (data.themePreference) {
      currentTheme = data.themePreference;
      // Update radio buttons
      themeOptions.forEach(radio => {
        if (radio.value === currentTheme) {
          radio.checked = true;
        }
      });
      // Apply theme
      applyTheme(currentTheme);
    } else {
      // Default to system theme
      currentTheme = 'system';
      applyTheme('system');
    }
  });

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (currentTheme === 'system') {
      applyTheme('system');
    }
  });
  
  // Add input event listener to save input text as user types
  questionInput.addEventListener('input', saveInputText);

  // Initialize event listeners for settings inputs - auto-save on change
  apiKeyInput.addEventListener('change', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      await chrome.storage.sync.set({ apiKey });
    }
  });
  
  modelSelect.addEventListener('change', async () => {
    await chrome.storage.sync.set({ model: modelSelect.value });
  });
  
  themeOptions.forEach(option => {
    option.addEventListener('change', async () => {
      if (option.checked) {
        const theme = option.value;
        applyTheme(theme);
        // Save theme preference
        await chrome.storage.sync.set({ themePreference: theme });
      }
    });
  });

  // Initialize UI state
  chrome.storage.sync.get(['apiKey', 'model', 'theme'], (data) => {
    if (data.apiKey) {
      apiKeyInput.value = data.apiKey;
    }
    
    if (data.model) {
      modelSelect.value = data.model;
    }
    
    // Apply theme
    const savedTheme = data.theme || 'system';
    applyTheme(savedTheme);
    
    // Check the corresponding radio button
    document.querySelector(`input[name="theme"][value="${savedTheme}"]`).checked = true;
  });

  // View navigation
  newConversationBtn.addEventListener('click', startNewConversation);
  pastSessionsBtn.addEventListener('click', showPastConversationsView);
  settingsBtn.addEventListener('click', showSettingsView);

  // Handle ENTER key for message submission
  questionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitBtn.click();
    }
  });

  // Load chat history
  await loadChatHistory();
  await loadSavedInputText();

  // Initialize page load ID
  await checkOrCreatePageLoadId();
  updateUIState();

  // Load model from storage
  chrome.storage.sync.get(['model'], (data) => {
    if (data.model) {
      modelSelect.value = data.model;
    }
  });

  // Load past sessions in background without showing them
  await loadChatSessions();
  
  // Ensure we're in main view
  showMainView();

  // Theme settings handling 
  themeOptions.forEach(option => {
    option.addEventListener('change', async () => {
      if (option.checked) {
        const theme = option.value;
        applyTheme(theme);
        // Save theme preference
        await chrome.storage.sync.set({ themePreference: theme });
      }
    });
  });

  // Toggle API key visibility
  toggleApiKeyBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleApiKeyBtn.textContent = '🔒';
    } else {
      apiKeyInput.type = 'password';
      toggleApiKeyBtn.textContent = '👁️';
    }
  });

  // Handle submit button click
  submitBtn.addEventListener('click', async () => {
    console.log('Submit button clicked');
    const question = questionInput.value.trim();
    console.log('Question:', question);
    console.log('Is processing:', isProcessing);
    
    // Check API key
    const { apiKey } = await chrome.runtime.sendMessage({ action: 'getApiKey' });
    console.log('API key exists:', !!apiKey);
    
    // Check selected model
    const selectedModel = modelSelect.value;
    console.log('Selected model:', selectedModel);
    
    if (!apiKey) {
      showError('Please set your OpenAI API key in settings first.');
      return;
    }
    
    if (!question || isProcessing) {
      console.log('Returning early - empty question or already processing');
      return;
    }

    // Set processing flag to prevent duplicate submissions
    isProcessing = true;
    console.log('Set processing flag to true');
    hideError();
    
    // Save input before clearing
    await saveInputText();
    
    // Add user message to chat
    await addMessageToChat('user', question);
    
    // Clear input after saving
    questionInput.value = '';
    
    // Show loading indicator
    loadingIndicator.classList.remove('hidden');
    
    try {
      // Get current tab ID and URL
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab:', tab);
      
      if (!tab) {
        throw new Error('No active tab found. Please try again.');
      }
      
      const { id: tabId, url, title } = tab;
      
      // Make sure we have the current pageLoadId
      if (!currentPageLoadId) {
        // Try to recover the pageLoadId
        const storageKey = `page_load_${tabId}_${url}`;
        const { [storageKey]: storedPageLoadId } = await chrome.storage.local.get(storageKey);
        
        if (storedPageLoadId) {
          currentPageLoadId = storedPageLoadId;
          console.log(`Recovered pageLoadId: ${currentPageLoadId}`);
        } else {
          // If we still don't have a pageLoadId, create a new one
          console.log('Creating new pageLoadId as none was found');
          currentPageLoadId = `pageload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          await chrome.storage.local.set({ [storageKey]: currentPageLoadId });
        }
      }
      
      console.log('Using pageLoadId:', currentPageLoadId);
      
      // First, get the page content by scraping the current page
      console.log('Sending scrapeCurrentPage message');
      const scraperResponse = await chrome.runtime.sendMessage({
        action: 'scrapeCurrentPage'
      });
      console.log('Scraper response:', scraperResponse);
      
      if (scraperResponse.error) {
        showError(scraperResponse.error);
        loadingIndicator.classList.add('hidden');
        isProcessing = false; // Reset processing flag
        return;
      }
      
      // Now send for inference with the scraped content
      console.log('Sending getInference message');
      const response = await chrome.runtime.sendMessage({
        action: 'getInference',
        question,
        content: scraperResponse.content,
        url,
        tabId: tab.id,
        pageLoadId: currentPageLoadId,
        pageTitle: title
      });
      console.log('Inference response:', response);
      
      // Hide loading indicator
      loadingIndicator.classList.add('hidden');
      
      if (response.error) {
        showError(response.error);
        isProcessing = false; // Reset processing flag
        return;
      }
      
      // Add AI response to chat
      await addMessageToChat('assistant', response.answer);
      
      // Stay in main view
      showMainView();
    } catch (error) {
      loadingIndicator.classList.add('hidden');
      showError(error.message || 'An error occurred');
      console.error('Error:', error);
    } finally {
      isProcessing = false; // Always reset processing flag
    }
  });
});

/**
 * Switch to main chat view
 */
function showMainView() {
  // Hide all content areas first
  mainContent.classList.remove('hidden');
  pastConversationsView.classList.add('hidden');
  settingsContent.classList.add('hidden');
  
  // Update header buttons
  if (isInNewConversation) {
    newConversationBtn.classList.add('active');
    pastSessionsBtn.classList.remove('active');
  } else {
    newConversationBtn.classList.remove('active');
    pastSessionsBtn.classList.add('active');
  }
  
  settingsBtn.classList.remove('active');
  
  // Show the active topic name when in main view
  const conversationInfo = document.getElementById('currentConversationInfo');
  if (conversationInfo) {
    conversationInfo.classList.remove('hidden-topic-name');
  }
  
  // Update UI state
  updateUIState();
}

/**
 * Switch to past conversations view
 */
function showPastConversationsView() {
  // Hide all content areas first
  mainContent.classList.add('hidden');
  pastConversationsView.classList.remove('hidden');
  settingsContent.classList.add('hidden');
  
  // Mark that we're in conversations view
  wasInConversationsView = true;
  
  // Update header buttons
  newConversationBtn.classList.remove('active');
  pastSessionsBtn.classList.add('active');
  settingsBtn.classList.remove('active');
  
  // Hide the active topic name when in history view
  const conversationInfo = document.getElementById('currentConversationInfo');
  if (conversationInfo) {
    conversationInfo.classList.add('hidden-topic-name');
  }
  
  // Update UI state
  updateUIState();
}

/**
 * Shows settings view and hides other views
 */
function showSettingsView() {
  // Remember the previous view state (main or past conversations)
  wasInConversationsView = pastConversationsView.classList.contains('active');
  
  // Hide all content areas
  mainContent.classList.add('hidden');
  pastConversationsView.classList.add('hidden');
  settingsContent.classList.remove('hidden');
  
  // Update header buttons
  newConversationBtn.classList.remove('active');
  pastSessionsBtn.classList.remove('active');
  settingsBtn.classList.add('active');
}

/**
 * Update UI state based on current mode
 */
function updateUIState() {
  // Reset all icon states
  newConversationBtn.classList.remove('active');
  pastSessionsBtn.classList.remove('active');
  settingsBtn.classList.remove('active');
  
  if (mainContent.classList.contains('hidden') && pastConversationsView.classList.contains('hidden')) {
    // Settings view
    settingsBtn.classList.add('active');
  } else if (mainContent.classList.contains('hidden')) {
    // Past conversations view
    pastSessionsBtn.classList.add('active');
  } else {
    // Main view (chat)
    if (isInNewConversation) {
      newConversationBtn.classList.add('active');
    } else {
      // Currently in a past conversation that's loaded in the chat view
      pastSessionsBtn.classList.add('active');
    }
  }
}

/**
 * Check for an existing page load ID or create a new one
 * This helps to distinguish between page reloads and tab switches
 */
async function checkOrCreatePageLoadId() {
  const storageKey = `page_load_${currentTabId}_${currentUrl}`;
  const { [storageKey]: existingPageLoadId } = await chrome.storage.local.get(storageKey);
  
  if (existingPageLoadId) {
    // If we already have a pageLoadId, use it
    currentPageLoadId = existingPageLoadId;
    console.log(`Using existing page load ID: ${currentPageLoadId}`);
  } else {
    // Create a new pageLoadId for this page load
    currentPageLoadId = `pageload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Store it for future reference
    await chrome.storage.local.set({ [storageKey]: currentPageLoadId });
    
    console.log(`Created new page load ID: ${currentPageLoadId}`);
    
    // Clear any existing input as this is a fresh page load
    questionInput.value = '';
    await saveInputText();
  }
}

/**
 * Update the conversation info display
 * @param {Object} sessionInfo - Optional session info object
 */
function updateConversationInfo(sessionInfo = null) {
  // If no specific session info is provided, use the current context
  if (!sessionInfo) {
    sessionInfo = {
      title: currentPageTitle || 'Current Page',
      created: new Date().toISOString(),
      messageCount: 0,
      lastUserRequest: ''
    };
  }

  // Clear previous content
  currentConversationTitle.innerHTML = '';
  
  // Create webpage title element - now takes full width
  const title = document.createElement('span');
  title.classList.add('webpage-title');
  title.title = sessionInfo.title || 'Current Page';
  title.textContent = truncateText(sessionInfo.title || 'Current Page', 50); // Increased length since using full width
  
  // Add webpage title to the title container
  currentConversationTitle.appendChild(title);
  
  // Format and update the timestamp with time on left, message count on right
  const timestamp = new Date(sessionInfo.created);
  const formattedTime = timestamp.toLocaleString();
  
  // Create date span for left side
  const dateSpan = document.createElement('span');
  dateSpan.classList.add('session-date');
  dateSpan.textContent = formattedTime;
  
  // Create message count span for right side
  const countSpan = document.createElement('span');
  countSpan.classList.add('message-count');
  const messageCountText = sessionInfo.messageCount ? `${sessionInfo.messageCount} messages` : '0 messages';
  countSpan.textContent = messageCountText;
  
  // Clear previous timestamp content
  currentConversationTimestamp.innerHTML = '';
  
  // Add both spans to the timestamp container
  currentConversationTimestamp.appendChild(dateSpan);
  currentConversationTimestamp.appendChild(countSpan);
  
  // Make sure the info bar is visible
  currentConversationInfo.classList.remove('hidden');
}

/**
 * Truncate text to a specified length
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Create a new conversation for the current page
 */
async function startNewConversation() {
  console.log('Starting new conversation');
  
  // Generate a new page load ID first
  currentPageLoadId = `pageload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Check for empty conversations before creating a new one
  try {
    // Remove empty conversations except for the new one we're about to create
    const removedCount = await removeEmptyConversations(currentPageLoadId);
    if (removedCount > 0) {
      console.log(`Removed ${removedCount} empty conversations before starting new conversation`);
    }
  } catch (error) {
    console.error('Error removing empty conversations:', error);
    // Continue with new conversation creation even if this check fails
  }
  
  // Update storage with new ID
  const storageKey = `page_load_${currentTabId}_${currentUrl}`;
  await chrome.storage.local.set({ [storageKey]: currentPageLoadId });
  
  // Clear the chat history display
  chatHistory.innerHTML = '';
  
  // Clear the input text
  questionInput.value = '';
  await saveInputText();
  
  // Mark as new conversation
  isInNewConversation = true;
  
  // Update conversation info with the new format
  updateConversationInfo({
    title: currentPageTitle || 'Current Page',
    created: new Date().toISOString(),
    messageCount: 0,
    // We still track lastUserRequest for storage, though it's not displayed
    lastUserRequest: ''
  });
  
  // Save this as a new chat session immediately with initial empty last user request
  await saveChatSession(currentTabId, currentUrl, currentPageLoadId, [], 'New conversation');
  
  // Show main view and update UI state
  showMainView();
  
  console.log(`Started new conversation with ID: ${currentPageLoadId}`);
}

// Event Listeners
settingsBtn.addEventListener('click', () => {
  showSettingsView();
});

toggleApiKeyBtn.addEventListener('click', () => {
  const type = apiKeyInput.type === 'password' ? 'text' : 'password';
  apiKeyInput.type = type;
  toggleApiKeyBtn.textContent = type === 'password' ? '👁️' : '🔒';
});

// Add event listener for past sessions button
pastSessionsBtn.addEventListener('click', async () => {
  // Load and display past sessions
  await loadAndShowPastSessions();
});

// Add event listeners for new conversation button
newConversationBtn.addEventListener('click', startNewConversation);

// Add Enter key support for message submission
questionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); // Prevent newline in textarea
    submitBtn.click();
  }
});

// Helper functions
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
}

function hideError() {
  errorMessage.textContent = '';
  errorMessage.classList.add('hidden');
}

// Theme management functions
function applyTheme(theme) {
  const root = document.documentElement;
  
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

// Theme radio button change handler
themeOptions.forEach(radio => {
  radio.addEventListener('change', (e) => {
    currentTheme = e.target.value;
    applyTheme(currentTheme);
    
    // Save theme preference
    chrome.storage.sync.set({ themePreference: currentTheme });
  });
});

/**
 * Save the current input text to storage
 */
async function saveInputText() {
  if (currentTabId && currentUrl && currentPageLoadId) {
    const inputText = questionInput.value;
    const storageKey = `input_text_${currentTabId}_${currentUrl}_${currentPageLoadId}`;
    await chrome.storage.local.set({ [storageKey]: inputText });
  }
}

/**
 * Load saved input text from storage
 */
async function loadSavedInputText() {
  if (currentTabId && currentUrl && currentPageLoadId) {
    const storageKey = `input_text_${currentTabId}_${currentUrl}_${currentPageLoadId}`;
    const { [storageKey]: savedText } = await chrome.storage.local.get(storageKey);
    
    if (savedText) {
      questionInput.value = savedText;
    }
  }
}

/**
 * Add a message to the chat history and save it
 * @param {string} role - The role of the message sender ('user', 'assistant', or 'system')
 * @param {string} content - The message content
 */
async function addMessageToChat(role, content) {
  // Create timestamp for the message
  const timestamp = new Date().toISOString();
  
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  
  // Apply appropriate styling based on role
  if (role === 'user') {
    messageElement.classList.add('user-message');
    
    // Update conversation info with this latest user message
    // Get current session info
    try {
      const { chatSessions = [] } = await chrome.storage.local.get('chatSessions');
      const currentSession = chatSessions.find(s => s.pageLoadId === currentPageLoadId);
      
      if (currentSession) {
        updateConversationInfo({
          title: currentSession.title || 'Current Page',
          created: currentSession.created,
          lastUpdated: new Date().toISOString(),
          messageCount: (currentSession.messageCount || 0) + 1,
          lastUserRequest: content
        });
      }
    } catch (error) {
      console.error('Error updating conversation info with latest message:', error);
    }
  } else if (role === 'assistant') {
    messageElement.classList.add('ai-message');
  } else if (role === 'system') {
    messageElement.classList.add('system-message');
  }
  
  const header = document.createElement('div');
  header.classList.add('message-header');
  
  // Create a container for the header content
  const headerContent = document.createElement('div');
  headerContent.classList.add('header-content');
  
  // Set header text based on role
  if (role === 'user') {
    headerContent.textContent = 'You';
  } else if (role === 'assistant') {
    headerContent.textContent = 'Assistant';
  } else if (role === 'system') {
    headerContent.textContent = 'System';
  }
  
  // Add timestamp to header
  const timeDisplay = document.createElement('span');
  timeDisplay.classList.add('message-timestamp');
  
  // Format the timestamp
  const messageDate = new Date(timestamp);
  timeDisplay.textContent = messageDate.toLocaleString();
  
  // Add the elements to header
  header.appendChild(headerContent);
  header.appendChild(timeDisplay);
  
  const messageContent = document.createElement('div');
  messageContent.classList.add('message-content');
  messageContent.textContent = content;
  
  // Add copy button
  const copyButton = document.createElement('button');
  copyButton.classList.add('copy-button');
  copyButton.title = 'Copy to clipboard';
  copyButton.addEventListener('click', () => copyToClipboard(content, copyButton));
  
  messageElement.appendChild(header);
  messageElement.appendChild(messageContent);
  messageElement.appendChild(copyButton);
  chatHistory.appendChild(messageElement);
  
  // Scroll to bottom
  chatHistory.scrollTop = chatHistory.scrollHeight;
  
  // Persist the updated chat history
  if (currentTabId && currentUrl && currentPageLoadId) {
    const chatHistoryKey = getChatHistoryKey();
    const { [chatHistoryKey]: currentHistory = [] } = await chrome.storage.local.get(chatHistoryKey);
    
    currentHistory.push({
      role,
      content,
      timestamp
    });
    
    await chrome.storage.local.set({ [chatHistoryKey]: currentHistory });
    
    // Track the last user request if this is a user message
    let lastUserRequest = '';
    if (role === 'user') {
      lastUserRequest = content;
    }
    
    // Update background script's in-memory history
    await chrome.runtime.sendMessage({
      action: 'updateChatHistory',
      tabId: currentTabId,
      url: currentUrl,
      pageLoadId: currentPageLoadId,
      history: currentHistory
    });
    
    // Save this chat session in the sessions index
    await saveChatSession(
      currentTabId, 
      currentUrl, 
      currentPageLoadId, 
      currentHistory,
      role === 'user' ? content : undefined  // Pass the user request if this is a user message
    );
  }
}

/**
 * Remove empty conversations from the chat sessions list, except for a specific conversation
 * @param {string} excludePageLoadId - The pageLoadId to exclude from removal
 * @returns {Promise<number>} The number of empty conversations removed
 */
async function removeEmptyConversations(excludePageLoadId = null) {
  try {
    // Get existing sessions
    const result = await chrome.storage.local.get('chatSessions');
    let chatSessions = result.chatSessions || [];
    
    // Find empty conversations, excluding the specified one
    const emptyConversations = chatSessions.filter(session => {
      return session.messageCount === 0 && session.pageLoadId !== excludePageLoadId;
    });
    
    if (emptyConversations.length === 0) {
      console.log('No empty conversations found to remove.');
      return 0;
    }
    
    console.log(`Found ${emptyConversations.length} empty conversations to remove.`);
    
    // Get the IDs to remove
    const idsToRemove = emptyConversations.map(session => session.pageLoadId);
    
    // Remove these conversations from the array
    const updatedSessions = chatSessions.filter(session => !idsToRemove.includes(session.pageLoadId));
    
    // Also delete their storage keys
    for (const idToRemove of idsToRemove) {
      // Find the session
      const sessionToRemove = emptyConversations.find(s => s.pageLoadId === idToRemove);
      if (sessionToRemove) {
        // Remove chat history from storage
        const sessionHistoryKey = getChatHistoryKey(sessionToRemove.url, idToRemove);
        await chrome.storage.local.remove(sessionHistoryKey);
        console.log(`Removed empty session chat history with key: ${sessionHistoryKey}`);
      }
    }
    
    // Store updated sessions
    await chrome.storage.local.set({ chatSessions: updatedSessions });
    console.log(`Removed ${emptyConversations.length} empty conversations, ${updatedSessions.length} conversations remaining`);
    
    return emptyConversations.length;
  } catch (error) {
    console.error('Error removing empty conversations:', error);
    return 0;
  }
}

/**
 * Save a chat session to the sessions index
 * @param {number} tabId - The tab ID
 * @param {string} url - The URL
 * @param {string} pageLoadId - The page load ID
 * @param {Array} history - The chat history
 * @param {string} lastUserRequest - The last user request (optional)
 */
async function saveChatSession(tabId, url, pageLoadId, history, lastUserRequest) {
  // Allow empty history for new conversations
  if (!history) history = [];
  
  try {
    // Get the page title
    let pageTitle = '';
    try {
      const tab = await chrome.tabs.get(tabId);
      pageTitle = tab.title || new URL(url).hostname;
    } catch (e) {
      pageTitle = new URL(url).hostname;
    }
    
    console.log(`Saving chat session for ${pageLoadId} with ${history.length} messages`);
    
    // Save chat history with the domain-based key
    const chatHistoryKey = getChatHistoryKey(url, pageLoadId);
    await chrome.storage.local.set({ [chatHistoryKey]: history });
    console.log(`Saved chat history with key: ${chatHistoryKey}`);
    
    // Remove empty conversations except for the current one
    await removeEmptyConversations(pageLoadId);
    
    // Get existing sessions (after empty conversations were removed)
    const result = await chrome.storage.local.get('chatSessions');
    let chatSessions = result.chatSessions || [];
    
    // Check if we already have a session for this pageLoadId
    const existingIndex = chatSessions.findIndex(s => s.pageLoadId === pageLoadId);
    
    // Find last user request if not provided
    if (!lastUserRequest && history.length > 0) {
      // Look for the most recent user message in history
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role === 'user') {
          lastUserRequest = history[i].content;
          break;
        }
      }
    }
    
    if (existingIndex >= 0) {
      // Update existing session
      console.log(`Updating existing session at index ${existingIndex}`);
      chatSessions[existingIndex] = {
        ...chatSessions[existingIndex],
        lastUpdated: new Date().toISOString(),
        messageCount: history.length,
        tabId: tabId, // Store the tab ID for backward compatibility
        lastUserRequest: lastUserRequest || chatSessions[existingIndex].lastUserRequest // Keep existing lastUserRequest if new one not provided
      };
      
      // If this is the current session, also update the conversation info display
      if (chatSessions[existingIndex].pageLoadId === currentPageLoadId) {
        updateConversationInfo({
          title: chatSessions[existingIndex].title || 'Current Page',
          created: chatSessions[existingIndex].created,
          lastUpdated: chatSessions[existingIndex].lastUpdated,
          messageCount: chatSessions[existingIndex].messageCount,
          // Still tracking lastUserRequest for storage purposes
          // even though it's not displayed in the header anymore
          lastUserRequest: chatSessions[existingIndex].lastUserRequest || ''
        });
      }
    } else {
      // Add new session
      console.log('Adding new session to chat sessions');
      chatSessions.push({
        pageLoadId,
        url,
        title: pageTitle,
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        messageCount: history.length,
        tabId: tabId, // Store the tab ID for backward compatibility
        lastUserRequest: lastUserRequest || ''
      });
    }
    
    // Sort sessions by last updated time (newest first)
    chatSessions.sort((a, b) => 
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );
    
    // Store updated sessions
    await chrome.storage.local.set({ chatSessions: chatSessions });
    console.log(`Saved ${chatSessions.length} chat sessions to storage`);
  } catch (error) {
    console.error('Error saving chat session:', error);
  }
}

/**
 * Get the storage key for chat history based on current tab, URL, and pageLoadId
 * @param {string} url - The URL to use (optional, defaults to currentUrl)
 * @param {string} pageLoadId - The pageLoadId to use (optional, defaults to currentPageLoadId)
 * @returns {string} The storage key
 */
function getChatHistoryKey(url = currentUrl, pageLoadId = currentPageLoadId) {
  const baseDomain = getBaseDomain(url);
  console.log(`Using base domain '${baseDomain}' for chat history key`);
  return `chat_history_${baseDomain}_${pageLoadId}`;
}

/**
 * Loads chat history for the current tab/URL/pageLoadId
 */
async function loadChatHistory() {
  if (!currentTabId || !currentUrl || !currentPageLoadId) {
    console.warn('Cannot load chat history: missing tab ID, URL, or page load ID');
    return;
  }
  
  try {
    // Remove any empty conversations except the current one
    await removeEmptyConversations(currentPageLoadId);
    
    // Get history based on the domain and pageLoadId
    const chatHistoryKey = getChatHistoryKey(currentUrl, currentPageLoadId);
    console.log(`Loading chat history with key: ${chatHistoryKey}`);
    
    // First try to get from chrome.storage.local for persistence
    const { [chatHistoryKey]: history } = await chrome.storage.local.get(chatHistoryKey);
    
    console.log(`Found ${history ? history.length : 0} messages in chat history`);
    
    if (history && history.length > 0) {
      // Display chat history from storage
      history.forEach(message => {
        displayMessage(message.role, message.content, message.timestamp);
      });
      
      console.log(`Displayed ${history.length} messages from history`);
      
      // Scroll to bottom with a small delay to ensure DOM is updated
      setTimeout(() => {
        chatHistory.scrollTop = chatHistory.scrollHeight;
      }, 100);
      
      // Update background script's in-memory history
      await chrome.runtime.sendMessage({
        action: 'updateChatHistory',
        tabId: currentTabId,
        url: currentUrl,
        pageLoadId: currentPageLoadId,
        history: history
      });
    } else {
      // Try legacy format for backward compatibility
      const legacyKey = `chat_history_${currentTabId}_${currentUrl}_${currentPageLoadId}`;
      console.log(`No history found with domain key, trying legacy key: ${legacyKey}`);
      
      const { [legacyKey]: legacyHistory } = await chrome.storage.local.get(legacyKey);
      
      if (legacyHistory && legacyHistory.length > 0) {
        console.log(`Found ${legacyHistory.length} messages with legacy key`);
        
        // Display the legacy history
        legacyHistory.forEach(message => {
          displayMessage(message.role, message.content, message.timestamp);
        });
        
        console.log(`Displayed ${legacyHistory.length} messages from legacy history`);
        
        // Save with the new format for future use
        await chrome.storage.local.set({ [chatHistoryKey]: legacyHistory });
        console.log(`Migrated history to new key format: ${chatHistoryKey}`);
        
        // Update background script's in-memory history
        await chrome.runtime.sendMessage({
          action: 'updateChatHistory',
          tabId: currentTabId,
          url: currentUrl,
          pageLoadId: currentPageLoadId,
          history: legacyHistory
        });
      } else {
        console.log('No chat history found for current page or new conversation');
      }
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
  }
}

/**
 * Delete a conversation from storage and sessions list
 * @param {string} pageLoadId - The page load ID of the conversation to delete
 */
async function deleteConversation(pageLoadId) {
  try {
    // Get the session to access its URL
    const { chatSessions = [] } = await chrome.storage.local.get('chatSessions');
    const session = chatSessions.find(s => s.pageLoadId === pageLoadId);
    
    if (!session) {
      console.error('Cannot delete conversation: session not found');
      return;
    }
    
    // Remove chat history from storage using the new key format
    const chatHistoryKey = getChatHistoryKey(session.url, pageLoadId);
    await chrome.storage.local.remove(chatHistoryKey);
    console.log(`Removed chat history with key: ${chatHistoryKey}`);
    
    // Also remove any legacy format keys
    const legacyKeys = [
      `chat_history_${currentTabId}_${session.url}_${pageLoadId}`,
      `chat_history_${currentTabId}_${getBaseDomain(session.url)}_${pageLoadId}`
    ];
    
    for (const legacyKey of legacyKeys) {
      await chrome.storage.local.remove(legacyKey);
      console.log(`Removed legacy chat history key: ${legacyKey}`);
    }
    
    // Remove input text from storage
    const inputTextKey = `input_text_${currentTabId}_${session.url}_${pageLoadId}`;
    await chrome.storage.local.remove(inputTextKey);
    
    // Update sessions list
    const updatedSessions = chatSessions.filter(s => s.pageLoadId !== pageLoadId);
    await chrome.storage.local.set({ chatSessions: updatedSessions });
    
    // If we deleted the current conversation, start a new one
    if (pageLoadId === currentPageLoadId) {
      await startNewConversation();
    }
    
    // Refresh the sessions list if it's open
    if (!pastConversationsView.classList.contains('hidden')) {
      await loadAndShowPastSessions();
    }
    
    console.log(`Deleted conversation: ${pageLoadId}`);
  } catch (error) {
    console.error('Error deleting conversation:', error);
  }
}

/**
 * Load and display past sessions in the sessions view
 */
async function loadAndShowPastSessions() {
  // Clear existing items
  sessionsContainer.innerHTML = '';
  
  try {
    // Remove empty conversations except the current one
    await removeEmptyConversations(currentPageLoadId);
    
    const sessions = await loadChatSessions();
    
    if (!sessions || sessions.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.classList.add('empty-state');
      emptyState.textContent = 'No conversations found';
      sessionsContainer.appendChild(emptyState);
      return;
    }
    
    // Add each session to the container
    sessions.forEach(session => {
      try {
        // Create session item container
        const item = document.createElement('div');
        item.classList.add('chat-session-item');
        item.id = `session-${session.pageLoadId}`;
        
        // Create content wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.classList.add('session-content');
        
        // Create title container to hold both webpage title and last request
        const titleContainer = document.createElement('div');
        titleContainer.classList.add('chat-session-title');
        
        // Create webpage title element
        const title = document.createElement('span');
        title.classList.add('webpage-title');
        title.title = session.title || 'Untitled';
        title.textContent = truncateText(session.title || 'Untitled', 30);
        
        // Create last user request element
        const lastRequest = document.createElement('span');
        lastRequest.classList.add('last-user-request');
        lastRequest.title = session.lastUserRequest || '';
        lastRequest.textContent = truncateText(session.lastUserRequest || '', 30);
        
        // Add webpage title and last request to title container
        titleContainer.appendChild(title);
        titleContainer.appendChild(lastRequest);
        
        // Create metadata section
        const meta = document.createElement('div');
        meta.classList.add('session-meta');
        
        // Create date element with formatted date
        const date = document.createElement('span');
        date.classList.add('session-date');
        const formattedDate = new Date(session.lastUpdated).toLocaleString();
        date.textContent = formattedDate;
        date.title = formattedDate;
        
        const count = document.createElement('span');
        count.classList.add('message-count');
        count.textContent = `${session.messageCount} messages`;
        
        // Create delete button - now placed in the meta section
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-button');
        deleteBtn.title = 'Delete from history';
        deleteBtn.setAttribute('aria-label', 'Delete from history');
        
        // Add event listener for delete button
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation(); // Prevent triggering the session click
          
          // Add confirmation
          if (confirm('Delete this topic from history? This action cannot be undone.')) {
            await deleteConversation(session.pageLoadId);
          }
        });
        
        meta.appendChild(date);
        meta.appendChild(count);
        meta.appendChild(deleteBtn);
        
        contentWrapper.appendChild(titleContainer);
        contentWrapper.appendChild(meta);
        
        item.appendChild(contentWrapper);
        
        // Add click handler to load session
        contentWrapper.addEventListener('click', async () => {
          try {
            console.log(`Loading conversation with ID: ${session.pageLoadId}`);
            
            // Set current page load ID before loading
            currentPageLoadId = session.pageLoadId;
            
            // Load and display the selected chat session
            await loadAndDisplayChatSession(session.pageLoadId, session);
            
            // Make sure we're not marked as a new conversation
            isInNewConversation = false;
            
            // Show the main view after loading
            showMainView();
          } catch (error) {
            console.error('Error switching to conversation:', error);
            showError('Failed to load conversation. Please try again.');
          }
        });
        
        sessionsContainer.appendChild(item);
      } catch (error) {
        console.error('Error creating session item:', error);
      }
    });
  } catch (error) {
    console.error('Error loading past sessions:', error);
    showError('Failed to load past conversations. Please try again.');
  }
  
  // Show the past conversations view
  showPastConversationsView();
}

/**
 * Load chat sessions from storage
 * @returns {Promise<Array>} - The chat sessions
 */
async function loadChatSessions() {
  const result = await chrome.storage.local.get('chatSessions');
  const sessions = result.chatSessions || [];
  console.log(`Loaded ${sessions.length} chat sessions from storage`);
  
  if (sessions.length > 0) {
    console.log('First session:', { 
      id: sessions[0].pageLoadId,
      title: sessions[0].title,
      messageCount: sessions[0].messageCount
    });
  }
  
  return sessions;
}

/**
 * Load and display a chat session
 * @param {string} pageLoadId - The page load ID of the session to load
 * @param {Object} sessionInfo - Session metadata
 */
async function loadAndDisplayChatSession(pageLoadId, sessionInfo = null) {
    try {
        console.log('Starting to load chat session:', pageLoadId);
        
        if (!pageLoadId) {
            throw new Error('No pageLoadId provided');
        }
        
        // Remove any empty conversations except the one being loaded
        await removeEmptyConversations(pageLoadId);
        
        // Get existing sessions
        const { chatSessions = [] } = await chrome.storage.local.get('chatSessions');
        console.log('Found total sessions:', chatSessions.length);
        
        // Find the session in the sessions list
        const session = chatSessions.find(s => s.pageLoadId === pageLoadId);
        
        if (!session) {
            throw new Error('Chat session not found: ' + pageLoadId);
        }
        
        console.log('Found session:', {
            pageLoadId: session.pageLoadId,
            url: session.url,
            title: session.title,
            messageCount: session.messageCount
        });
        
        // Update current conversation info
        isInNewConversation = false;
        currentPageLoadId = pageLoadId;
        
        // Update UI with session info
        if (!sessionInfo) {
            sessionInfo = {
                title: session.title || 'Unknown Page',
                url: session.url,
                created: session.created,
                lastUpdated: session.lastUpdated,
                messageCount: session.messageCount,
                lastUserRequest: session.lastUserRequest || ''
            };
        }
        
        updateConversationInfo(sessionInfo);
        
        // Clear current chat display
        chatHistory.innerHTML = '';
        
        // Try first with the full URL as key
        let chatHistoryKey = `chat_history_${session.url}_${pageLoadId}`;
        console.log(`Trying with full URL key: ${chatHistoryKey}`);
        
        let { [chatHistoryKey]: history = [] } = await chrome.storage.local.get(chatHistoryKey);
        
        // If no messages found with URL key, try with base domain
        if (!history || history.length === 0) {
            try {
                const baseDomain = getBaseDomain(session.url);
                chatHistoryKey = `chat_history_${baseDomain}_${pageLoadId}`;
                console.log(`Trying with base domain key: ${chatHistoryKey}`);
                const result = await chrome.storage.local.get(chatHistoryKey);
                history = result[chatHistoryKey] || [];
            } catch (e) {
                console.error('Error getting base domain:', e);
            }
        }
        
        console.log(`Found ${history.length} messages`);
        
        // Display messages if there are any
        if (history && history.length > 0) {
            history.forEach((message, index) => {
                try {
                    displayMessage(message.role, message.content, message.timestamp);
                } catch (e) {
                    console.error(`Error displaying message ${index}:`, e);
                }
            });
            
            // Scroll to bottom with a small delay to ensure DOM is updated
            setTimeout(() => {
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }, 100);
        }
        
        // Show the main view
        showMainView();
        console.log('Successfully loaded and displayed chat session');
        
    } catch (error) {
        console.error('Error loading chat session:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        showError(error.message || 'Failed to load conversation');
    }
}

/**
 * Display a message in the chat history
 * @param {string} role - 'user', 'assistant', or 'system'
 * @param {string} content - The message content
 * @param {string} timestamp - The timestamp of the message (optional)
 */
function displayMessage(role, content, timestamp) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  
  // Apply appropriate styling based on role
  if (role === 'user') {
    messageElement.classList.add('user-message');
  } else if (role === 'assistant') {
    messageElement.classList.add('ai-message');
  } else if (role === 'system') {
    messageElement.classList.add('system-message');
  }
  
  const header = document.createElement('div');
  header.classList.add('message-header');
  
  // Create a container for the header content
  const headerContent = document.createElement('div');
  headerContent.classList.add('header-content');
  
  // Set header text based on role
  if (role === 'user') {
    headerContent.textContent = 'You';
  } else if (role === 'assistant') {
    headerContent.textContent = 'Assistant';
  } else if (role === 'system') {
    headerContent.textContent = 'System';
  }
  
  // Add timestamp to header if available
  if (timestamp) {
    const timeDisplay = document.createElement('span');
    timeDisplay.classList.add('message-timestamp');
    
    // Format the timestamp
    const messageDate = new Date(timestamp);
    timeDisplay.textContent = messageDate.toLocaleString();
    
    // Add the timestamp to header
    header.appendChild(headerContent);
    header.appendChild(timeDisplay);
  } else {
    // If no timestamp, just add the header content
    header.appendChild(headerContent);
  }
  
  const messageContent = document.createElement('div');
  messageContent.classList.add('message-content');
  messageContent.textContent = content;
  
  // Add copy button
  const copyButton = document.createElement('button');
  copyButton.classList.add('copy-button');
  copyButton.title = 'Copy to clipboard';
  copyButton.addEventListener('click', () => copyToClipboard(content, copyButton));
  
  messageElement.appendChild(header);
  messageElement.appendChild(messageContent);
  messageElement.appendChild(copyButton);
  chatHistory.appendChild(messageElement);
  
  // Scroll to bottom
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

/**
 * Copy text to clipboard and show feedback
 * @param {string} text - Text to copy
 * @param {HTMLElement} button - The button element that was clicked
 */
function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    // Store original title
    const originalTitle = button.title;
    
    // Show feedback
    button.title = 'Copied!';
    
    // Reset after a delay
    setTimeout(() => {
      button.title = originalTitle;
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy text:', err);
    button.title = 'Failed to copy';
  });
}

/**
 * Extract the base domain from a URL
 * @param {string} url - The URL to process
 * @returns {string} The base domain
 */
function getBaseDomain(url) {
    try {
        if (!url) {
            throw new Error('No URL provided');
        }
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        console.error('Error getting base domain:', e);
        // Return a safe fallback
        return url.replace(/^https?:\/\//, '').split('/')[0] || 'unknown-domain';
    }
}