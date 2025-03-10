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

// DOM Elements
const mainContent = document.getElementById('mainContent');
const settingsContent = document.getElementById('settingsContent');
const settingsBtn = document.getElementById('settingsBtn');
const backBtn = document.getElementById('backBtn');
const questionInput = document.getElementById('questionInput');
const submitBtn = document.getElementById('submitBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const answerContainer = document.getElementById('answerContainer');
const answerContent = document.getElementById('answerContent');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleApiKeyBtn = document.getElementById('toggleApiKeyBtn');
const modelSelect = document.getElementById('modelSelect');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const chatHistory = document.getElementById('chatHistory');
const clearChatBtn = document.getElementById('clearChatBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeRadios = document.querySelectorAll('input[name="theme"]');

// Current tab and URL info
let currentTabId = null;
let currentUrl = null;

// Theme management
let currentTheme = 'system';

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab information
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs[0]) {
      currentTabId = tabs[0].id;
      currentUrl = tabs[0].url;
      
      // Load chat history for this tab/URL
      await loadChatHistory();
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
      themeRadios.forEach(radio => {
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
});

// Event Listeners
settingsBtn.addEventListener('click', () => {
  mainContent.classList.add('hidden');
  settingsContent.classList.remove('hidden');
});

backBtn.addEventListener('click', () => {
  settingsContent.classList.add('hidden');
  mainContent.classList.remove('hidden');
});

toggleApiKeyBtn.addEventListener('click', () => {
  const type = apiKeyInput.type === 'password' ? 'text' : 'password';
  apiKeyInput.type = type;
  toggleApiKeyBtn.textContent = type === 'password' ? '👁️' : '🔒';
});

// Add Enter key support for message submission
questionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); // Prevent newline in textarea
    submitBtn.click();
  }
});

clearChatBtn.addEventListener('click', async () => {
  if (currentTabId && currentUrl) {
    await chrome.runtime.sendMessage({
      action: 'clearChatHistory',
      tabId: currentTabId,
      url: currentUrl
    });
    
    // Clear chat history display
    chatHistory.innerHTML = '';
    clearChatBtn.classList.add('hidden');
  }
});

saveSettingsBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;
  
  if (!apiKey) {
    showError('Please enter your OpenAI API key.');
    return;
  }
  
  try {
    await chrome.runtime.sendMessage({ action: 'setApiKey', apiKey });
    await chrome.storage.sync.set({ modelPreference: model });
    
    settingsContent.classList.add('hidden');
    mainContent.classList.remove('hidden');
  } catch (error) {
    showError('Failed to save settings. Please try again.');
  }
});

submitBtn.addEventListener('click', async () => {
  const question = questionInput.value.trim();
  
  if (!question) {
    showError('Please enter a question.');
    return;
  }
  
  // Hide previous errors
  hideError();
  loadingIndicator.classList.remove('hidden');
  
  try {
    // Get the page content
    const { content, websiteType, error } = await chrome.runtime.sendMessage({ 
      action: 'scrapeCurrentPage' 
    });
    
    if (error) {
      throw new Error(error);
    }
    
    // Display website type if detected (non-general)
    if (websiteType && websiteType !== 'general') {
      console.log(`Detected website type: ${websiteType}`);
    }
    
    // Get the model preference
    const { modelPreference } = await chrome.storage.sync.get('modelPreference');
    
    // Add user message to the chat history UI
    addMessageToChat('user', question);
    
    // Get the answer from OpenAI
    const response = await chrome.runtime.sendMessage({
      action: 'getInference',
      content,
      question,
      model: modelPreference || DEFAULT_MODEL,
      tabId: currentTabId,
      url: currentUrl
    });
    
    if (response.error) {
      // If there's a model-specific error, show settings pane
      if (response.modelError) {
        // Add error message to chat
        addMessageToChat('system', `Error: ${response.error}`);
        
        // Display settings pane for model selection
        setTimeout(() => {
          mainContent.classList.add('hidden');
          settingsContent.classList.remove('hidden');
        }, 1500);
      }
      throw new Error(response.error);
    }
    
    // Add AI response to the chat history UI
    addMessageToChat('assistant', response.answer);
    
    // Clear input field
    questionInput.value = '';
    
    // Show clear chat button
    clearChatBtn.classList.remove('hidden');
  } catch (error) {
    showError(error.message);
  } finally {
    loadingIndicator.classList.add('hidden');
  }
});

/**
 * Loads chat history for the current tab/URL
 */
async function loadChatHistory() {
  if (!currentTabId || !currentUrl) {
    return;
  }
  
  try {
    // First try to get from chrome.storage.local for persistence
    const storageKey = `chat_history_${currentTabId}_${currentUrl}`;
    const { [storageKey]: history } = await chrome.storage.local.get(storageKey);
    
    if (history && history.length > 0) {
      // Display chat history from storage
      history.forEach(message => {
        addMessageToChat(message.role, message.content);
      });
      
      // Show clear chat button
      clearChatBtn.classList.remove('hidden');
      
      // Update background script's in-memory history
      await chrome.runtime.sendMessage({
        action: 'updateChatHistory',
        tabId: currentTabId,
        url: currentUrl,
        history: history
      });
    } else {
      // If no history in storage, try getting from background script
      const response = await chrome.runtime.sendMessage({
        action: 'getChatHistory',
        tabId: currentTabId,
        url: currentUrl
      });
      
      const history = response.history || [];
      
      if (history.length > 0) {
        history.forEach(message => {
          addMessageToChat(message.role, message.content);
        });
        
        // Show clear chat button
        clearChatBtn.classList.remove('hidden');
        
        // Save to chrome.storage.local for persistence
        await chrome.storage.local.set({ [storageKey]: history });
      }
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
  }
}

/**
 * Adds a message to the chat history UI and persists it
 * @param {string} role - 'user', 'assistant', or 'system'
 * @param {string} content - The message content
 */
async function addMessageToChat(role, content) {
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
  
  // Set header text based on role
  if (role === 'user') {
    header.textContent = 'You';
  } else if (role === 'assistant') {
    header.textContent = 'Assistant';
  } else if (role === 'system') {
    header.textContent = 'System';
  }
  
  const messageContent = document.createElement('div');
  messageContent.classList.add('message-content');
  messageContent.textContent = content;
  
  // Add copy button
  const copyButton = document.createElement('button');
  copyButton.classList.add('copy-button');
  copyButton.innerHTML = '📋';
  copyButton.title = 'Copy to clipboard';
  copyButton.addEventListener('click', () => copyToClipboard(content, copyButton));
  
  messageElement.appendChild(header);
  messageElement.appendChild(messageContent);
  messageElement.appendChild(copyButton);
  chatHistory.appendChild(messageElement);
  
  // Scroll to bottom
  chatHistory.scrollTop = chatHistory.scrollHeight;
  
  // Persist the updated chat history
  if (currentTabId && currentUrl) {
    const storageKey = `chat_history_${currentTabId}_${currentUrl}`;
    const { [storageKey]: currentHistory = [] } = await chrome.storage.local.get(storageKey);
    
    currentHistory.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
    
    await chrome.storage.local.set({ [storageKey]: currentHistory });
    
    // Update background script's in-memory history
    await chrome.runtime.sendMessage({
      action: 'updateChatHistory',
      tabId: currentTabId,
      url: currentUrl,
      history: currentHistory
    });
  }
}

/**
 * Copy content to clipboard and provide visual feedback
 * @param {string} text - The text to copy
 * @param {HTMLElement} button - The button element that was clicked
 */
function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text)
    .then(() => {
      // Change button icon temporarily for feedback
      const originalIcon = button.innerHTML;
      button.innerHTML = '✓';
      button.style.backgroundColor = 'var(--success-color)';
      button.style.color = 'white';
      
      // Reset button after 2 seconds
      setTimeout(() => {
        button.innerHTML = originalIcon;
        button.style.backgroundColor = '';
        button.style.color = '';
      }, 2000);
    })
    .catch(err => {
      console.error('Failed to copy text: ', err);
      
      // Show error feedback
      button.innerHTML = '❌';
      setTimeout(() => {
        button.innerHTML = '📋';
      }, 2000);
    });
}

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
  
  // Update theme toggle button icon
  const isDark = root.getAttribute('data-theme') === 'dark';
  themeToggleBtn.textContent = isDark ? '☀️' : '🌓';
}

// Theme toggle button click handler
themeToggleBtn.addEventListener('click', () => {
  const root = document.documentElement;
  const isDark = root.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  
  currentTheme = newTheme;
  applyTheme(newTheme);
  
  // Save theme preference
  chrome.storage.sync.set({ themePreference: newTheme });
});

// Theme radio button change handler
themeRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    currentTheme = e.target.value;
    applyTheme(currentTheme);
    
    // Save theme preference
    chrome.storage.sync.set({ themePreference: currentTheme });
  });
}); 