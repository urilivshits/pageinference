// Prevent multiple initializations with a global flag
if (window.popupJsInitialized) {
  console.error('===== DUPLICATE INITIALIZATION DETECTED: popup.js already initialized! =====');
} else {
  window.popupJsInitialized = true;
  console.log('===== FIRST INITIALIZATION OF POPUP.JS =====');
}

// Log information about scripts for debugging
console.log('Currently loaded scripts:', Array.from(document.scripts).map(s => s.src || 'inline script'));

// Add handler to detect potential DOM changes that might cause multiple script loading
if (window.MutationObserver) {
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        const addedScripts = Array.from(mutation.addedNodes).filter(node => 
          node.tagName === 'SCRIPT' && (node.src && node.src.includes('popup.js'))
        );
        if (addedScripts.length > 0) {
          console.error('===== POPUP.JS ADDED AGAIN TO DOM! =====', addedScripts);
        }
      }
    }
  });
  
  // Start observing once the DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }, { once: true }); // Use once:true to ensure this runs only once
}

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
let loadedFromHistoryItem = false; // New flag to track if we loaded from history item click
let isProcessing = false; // Add this flag near the other global variables at the top
let currentTheme;
let temperatureSlider;
let temperatureValueDisplay;
let isSubmitInProgress = false; // Add a flag to track if submit operation is in progress
let lastSubmittedQuestion = ''; // Track the last submitted question to prevent duplicates

// Function to update the current tab information
async function updateCurrentTabInfo() {
  console.log('Updating current tab information');
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      currentTabId = tabs[0].id;
      currentUrl = tabs[0].url;
      currentPageTitle = tabs[0].title || new URL(currentUrl).hostname;
      
      // Check for existing page load ID or create a new one
      await checkOrCreatePageLoadId();
      console.log('Tab info updated successfully:', currentTabId, currentUrl);
      
      // Load chat history for this tab/URL/pageLoadId
      console.log('LOADING CHAT HISTORY FROM updateCurrentTabInfo');
      await loadChatHistory();
      console.log('CHAT HISTORY LOADING COMPLETE FROM updateCurrentTabInfo');
      
      // Load saved input text
      await loadSavedInputText();
      
      // Update conversation info in the UI
      updateConversationInfo();
      
      // Update UI state
      updateUIState();
      
      return true;
    } else {
      console.error('No active tab found when trying to update tab info');
      return false;
    }
  } catch (error) {
    console.error('Error updating tab information:', error);
    return false;
  }
}

// DOM elements - will be populated in DOMContentLoaded

// Event listeners for all document elements
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOMContentLoaded fired');
  
  // Get DOM elements
  const questionInput = document.getElementById('questionInput');
  console.log('questionInput element:', questionInput);
  const submitBtn = document.getElementById('submitBtn');
  console.log('submitBtn element:', submitBtn);
  
  // Auto-resize the textarea as content changes
  function autoResizeTextarea() {
    // Reset height to auto so we can calculate the actual scrollHeight
    questionInput.style.height = 'auto';
    // Set the height to match content (with a max height enforced by CSS)
    questionInput.style.height = Math.min(questionInput.scrollHeight, 200) + 'px';
  }
  
  // Add input and keydown event listeners for auto-resizing
  questionInput.addEventListener('input', autoResizeTextarea);
  questionInput.addEventListener('keydown', (e) => {
    // Auto-resize on special keys
    if (['Backspace', 'Delete'].includes(e.key)) {
      // Use setTimeout to ensure resizing happens after content changes
      setTimeout(autoResizeTextarea, 0);
    }
    
    // Handle Enter key for submission
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent newline in textarea
      submitBtn.click();
    } else if (e.key === 'Enter' && e.shiftKey) {
      // Allow shift+enter for newlines and resize
      setTimeout(autoResizeTextarea, 0);
    }
  });

  // Initial resize
  setTimeout(autoResizeTextarea, 0);
  
  errorMessage = document.getElementById('errorMessage');
  console.log('Error message element:', errorMessage);
  const apiKeyInput = document.getElementById('apiKeyInput');
  const toggleApiKeyBtn = document.getElementById('toggleApiKeyBtn');
  modelSelect = document.getElementById('modelSelect');
  const themeOptions = document.querySelectorAll('input[name="theme"]');
  const newConversationBtn = document.getElementById('newConversationBtn');
  const searchBtn = document.getElementById('searchBtn'); // New search button
  const reasonBtn = document.getElementById('reasonBtn'); // New reason button
  const pastSessionsBtn = document.getElementById('pastSessionsBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  chatHistory = document.getElementById('chatHistory');
  mainContent = document.getElementById('mainContent');
  pastConversationsView = document.getElementById('pastConversationsView');
  settingsContent = document.getElementById('settingsContent');
  const sessionsContainer = document.getElementById('sessionsContainer');
  currentConversationTitle = document.getElementById('currentConversationTitle');
  currentConversationTimestamp = document.getElementById('currentConversationTimestamp');
  temperatureSlider = document.getElementById('temperatureSlider');
  temperatureValueDisplay = document.getElementById('temperatureValue');

  // Ensure we start with the main view
  showMainView();
  updateUIState();

  // Initial tab information update
  await updateCurrentTabInfo();

  // Add focus event listener to the window to update tab information when popup regains focus
  window.addEventListener('focus', async () => {
    console.log('Window regained focus - updating tab info WITHOUT reloading chat history');
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        currentTabId = tabs[0].id;
        currentUrl = tabs[0].url;
        currentPageTitle = tabs[0].title || new URL(currentUrl).hostname;
        
        // Check for existing page load ID or create a new one
        await checkOrCreatePageLoadId();
        console.log('Tab info updated on focus event:', currentTabId, currentUrl);
        
        // Update UI state but DON'T reload chat history to prevent duplication
        updateUIState();
        
        // Load saved input text
        await loadSavedInputText();
      }
    } catch (error) {
      console.error('Error updating tab info on focus event:', error);
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

  // Load saved temperature preference
  chrome.storage.sync.get('temperaturePreference', (data) => {
    if (data.temperaturePreference !== undefined) {
      const temperatureValue = parseFloat(data.temperaturePreference);
      // Set slider value (0-100 range)
      temperatureSlider.value = temperatureValue * 100;
      // Update display value
      temperatureValueDisplay.textContent = temperatureValue.toFixed(1);
    } else {
      // Default to 0 if no preference is set
      temperatureSlider.value = 0;
      temperatureValueDisplay.textContent = '0.0';
      // Save the default preference
      chrome.storage.sync.set({ temperaturePreference: 0 });
    }
    // Update the slider gradient to match the current value
    updateSliderGradient(temperatureSlider);
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
  
  // Temperature slider change handler
  temperatureSlider.addEventListener('input', () => {
    // Convert the 0-100 slider value to 0-1 range for temperature
    const temperatureValue = parseFloat(temperatureSlider.value) / 100;
    // Display with one decimal place
    temperatureValueDisplay.textContent = temperatureValue.toFixed(1);
    // Save temperature preference
    chrome.storage.sync.set({ temperaturePreference: temperatureValue });
    // Update slider gradient
    updateSliderGradient(temperatureSlider);
  });
  
  // Theme radio button change handler
  themeOptions.forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentTheme = e.target.value;
      applyTheme(currentTheme);
      
      // Save theme preference
      chrome.storage.sync.set({ themePreference: currentTheme });
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
  
  // Add event listeners for new buttons (but without functionality yet)
  searchBtn.addEventListener('click', () => {
    console.log('Search button clicked - functionality not implemented yet');
  });
  
  reasonBtn.addEventListener('click', () => {
    console.log('Reason button clicked - functionality not implemented yet');
  });

  // ENTER key handling is already managed in the auto-resize event listener

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

  // Toggle API key visibility
  toggleApiKeyBtn.addEventListener('click', () => {
    const type = apiKeyInput.type === 'password' ? 'text' : 'password';
    apiKeyInput.type = type;
    toggleApiKeyBtn.textContent = type === 'password' ? '👁️' : '🔒';
  });

  // Handle submit button click
  submitBtn.addEventListener('click', async () => {
    console.log('Submit button clicked');
    
    // Prevent duplicate submissions
    if (preventDuplicateSubmission()) {
      console.log('Submission prevented - operation already in progress');
      return;
    }
    
    try {
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
        isSubmitInProgress = false; // Reset the flag
        return;
      }
      
      if (!question || isProcessing) {
        console.log('Returning early - empty question or already processing');
        isSubmitInProgress = false; // Reset the flag
        return;
      }

      // Check if this is a rapid duplicate submission of the same question (within 1 second)
      // This prevents accidental double-clicks but allows intentional resubmission of the same question
      const currentTime = Date.now();
      const lastSubmissionTimeKey = `last_submission_time_${currentPageLoadId}`;
      const { [lastSubmissionTimeKey]: lastSubmissionData } = await chrome.storage.local.get(lastSubmissionTimeKey);
      
      if (lastSubmissionData) {
        const { text, timestamp } = lastSubmissionData;
        const timeSinceLastSubmission = currentTime - timestamp;
        
        // If it's the exact same text and was submitted less than 1 second ago, prevent it
        if (text === question && timeSinceLastSubmission < 1000) {
          console.log('Preventing rapid duplicate submission (within 1 second):', timeSinceLastSubmission, 'ms');
          isSubmitInProgress = false; // Reset the flag
          return;
        }
      }
      
      // Update the last submission data with current text and timestamp
      await chrome.storage.local.set({ 
        [lastSubmissionTimeKey]: { 
          text: question, 
          timestamp: currentTime 
        } 
      });

      // Set processing flag to prevent duplicate submissions
      isProcessing = true;
      console.log('Set processing flag to true');
      hideError();
      
      // Save input before clearing
      await saveInputText();
      
      // Clear input after saving
      questionInput.value = '';
      
      // Show loading state in button
      submitBtn.classList.add('button-loading');
      const spinner = submitBtn.querySelector('.spinner');
      if (spinner) {
        spinner.style.display = 'block';
        
        // Make sure the button text is hidden
        const buttonText = submitBtn.querySelector('.button-text');
        if (buttonText) {
          buttonText.style.visibility = 'hidden';
        }
      }
      
      try {
        // Update tab information BUT DON'T reload chat history
        // since we're manually adding the user message
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
          throw new Error('No active tab found. Please try again.');
        }
        
        // Update core tab information
        currentTabId = tabs[0].id;
        currentUrl = tabs[0].url;
        currentPageTitle = tabs[0].title || new URL(currentUrl).hostname;
        
        // Check for existing page load ID or create a new one
        await checkOrCreatePageLoadId();
        console.log('Tab info updated:', currentTabId, currentUrl);
        
        // NOW add the user message to chat AFTER tab info is updated
        // This ensures the message is associated with the correct pageLoadId
        console.log('ADDING USER MESSAGE TO CHAT UI');
        await addMessageToChat('user', question);
        console.log('DONE ADDING USER MESSAGE TO CHAT UI');
        
        // First, get the page content by scraping the current page
        console.log('Sending scrapeCurrentPage message');
        const scraperResponse = await chrome.runtime.sendMessage({
          action: 'scrapeCurrentPage'
        });
        console.log('Scraper response:', scraperResponse);
        
        if (scraperResponse.error) {
          if (scraperResponse.error.includes('No active tab found')) {
            // Try once more to update tab information before giving up
            console.log('Tab may have lost focus, trying to update tab information again...');
            const retryTabInfo = await updateCurrentTabInfo();
            
            if (retryTabInfo) {
              // Try the scrape request one more time
              console.log('Tab info updated, retrying scrape request...');
              const retryResponse = await chrome.runtime.sendMessage({
                action: 'scrapeCurrentPage'
              });
              
              if (retryResponse.error) {
                showError(retryResponse.error);
                isProcessing = false; // Reset processing flag
                lastSubmittedQuestion = ''; // Reset last submitted question
              } else {
                // Continue with the successful retry response
                await continueWithScrapeResponse(retryResponse, question);
                return;
              }
            } else {
              showError('Unable to find an active browser tab. Please click on a browser tab first.');
            }
          } else {
            showError(scraperResponse.error);
          }
          
          // Hide loading button state
          submitBtn.classList.remove('button-loading');
          const spinner = submitBtn.querySelector('.spinner');
          if (spinner) {
            spinner.style.display = 'none';
            
            // Make button text visible again
            const buttonText = submitBtn.querySelector('.button-text');
            if (buttonText) {
              buttonText.style.visibility = 'visible';
            }
          }
          isProcessing = false; // Reset processing flag
          return;
        }
        
        await continueWithScrapeResponse(scraperResponse, question);
      } catch (error) {
        console.error('Error processing request:', error);
        showError(error.message || 'An error occurred');
        
        // Hide loading button state
        submitBtn.classList.remove('button-loading');
        const spinner = submitBtn.querySelector('.spinner');
        if (spinner) {
          spinner.style.display = 'none';
          
          // Make button text visible again
          const buttonText = submitBtn.querySelector('.button-text');
          if (buttonText) {
            buttonText.style.visibility = 'visible';
          }
        }
        isProcessing = false; // Reset processing flag
      }
    } catch (error) {
      console.error('Error in submit handler:', error);
    } finally {
      // Always reset the flag when the operation is complete
      setTimeout(() => {
        isSubmitInProgress = false;
        console.log('Reset isSubmitInProgress to false');
      }, 1000);
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
  } else if (loadedFromHistoryItem) {
    // If loaded from clicking on a history item, don't highlight any button
    newConversationBtn.classList.remove('active');
    pastSessionsBtn.classList.remove('active');
    // Don't reset the flag here - we'll do it after updateUIState
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
  
  // NOW reset the flag after updateUIState has been called
  if (loadedFromHistoryItem) {
    loadedFromHistoryItem = false;
  }
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
  wasInConversationsView = !pastConversationsView.classList.contains('hidden');
  
  // Hide all content areas
  mainContent.classList.add('hidden');
  pastConversationsView.classList.add('hidden');
  settingsContent.classList.remove('hidden');
  
  // Update header buttons
  newConversationBtn.classList.remove('active');
  pastSessionsBtn.classList.remove('active');
  settingsBtn.classList.add('active');
  
  // Hide the active topic name when in settings view
  const conversationInfo = document.getElementById('currentConversationInfo');
  if (conversationInfo) {
    conversationInfo.classList.add('hidden-topic-name');
  }
}

/**
 * Update UI state based on current mode
 */
function updateUIState() {
  // Reset all icon states
  newConversationBtn.classList.remove('active');
  pastSessionsBtn.classList.remove('active');
  settingsBtn.classList.remove('active');
  
  // If we're showing a conversation from a history item click, don't highlight any buttons
  if (loadedFromHistoryItem) {
    console.log('Loaded from history item - not highlighting any buttons');
    return;
  }
  
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
  
  // Create webpage title element - now takes 50% width
  const title = document.createElement('span');
  title.classList.add('webpage-title');
  title.title = sessionInfo.title || 'Current Page';
  title.textContent = truncateText(sessionInfo.title || 'Current Page', 50);
  
  // Create last user request element - takes the other 50% width
  const lastRequest = document.createElement('span');
  lastRequest.classList.add('last-user-request');
  lastRequest.title = sessionInfo.lastUserRequest || '';
  lastRequest.textContent = truncateText(sessionInfo.lastUserRequest || '', 50);
  
  // Add webpage title and last request to the title container
  currentConversationTitle.appendChild(title);
  currentConversationTitle.appendChild(lastRequest);
  
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
  
  // Reset state
  isProcessing = false;
  
  // Generate a new page load ID first
  const oldPageLoadId = currentPageLoadId;
  currentPageLoadId = `pageload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Save it for the current tab/URL
  if (currentTabId && currentUrl) {
    const storageKey = `page_load_${currentTabId}_${currentUrl}`;
    await chrome.storage.local.set({ [storageKey]: currentPageLoadId });
    
    // Clear lastSubmissionTime for the new conversation
    const lastSubmissionTimeKey = `last_submission_time_${currentPageLoadId}`;
    await chrome.storage.local.remove(lastSubmissionTimeKey);
    
    // Clear history loaded flag for the new conversation
    const historyLoadedKey = `history_loaded_${currentPageLoadId}`;
    await chrome.storage.local.remove(historyLoadedKey);
    
    console.log(`Created new page load ID: ${currentPageLoadId} replacing ${oldPageLoadId}`);
  } else {
    console.error('No active tab when starting new conversation');
  }
  
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

// Enter key handling is now managed in the auto-resize event listener

// Helper functions
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
  
  // Ensure error message is visible by scrolling to it
  errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Auto-hide error after 10 seconds
  setTimeout(() => {
    hideError();
  }, 10000);
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
  
  // Format content based on the role
  if (role === 'assistant') {
    try {
      let renderedContent = '';
      let markdownRendered = false;
      
      // Check explicitly for the markdown-it library
      if (typeof window.markdownit === 'function') {
        console.log('Using window.markdownit for rendering');
        try {
          const md = window.markdownit({
            html: false,
            breaks: true,
            linkify: true,
            typographer: true
          });
          renderedContent = md.render(content);
          markdownRendered = true;
          console.log('Successfully rendered with window.markdownit');
        } catch (err) {
          console.error('Error using window.markdownit:', err);
        }
      } else if (typeof markdownit === 'function') {
        console.log('Using global markdownit for rendering');
        try {
          const md = markdownit({
            html: false,
            breaks: true,
            linkify: true,
            typographer: true
          });
          renderedContent = md.render(content);
          markdownRendered = true;
          console.log('Successfully rendered with global markdownit');
        } catch (err) {
          console.error('Error using global markdownit:', err);
        }
      } 
      
      if (!markdownRendered) {
        console.log('markdown-it is not available, falling back to custom parser');
        renderedContent = basicMarkdownRender(content);
        markdownRendered = true;
      }
      
      if (markdownRendered) {
        // Set the rendered HTML content
        messageContent.innerHTML = renderedContent;
        
        // Add target="_blank" to all links to open in new tab
        const links = messageContent.querySelectorAll('a');
        links.forEach(link => {
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        });
        
        // Apply highlighting to code blocks
        try {
          if (typeof hljs !== 'undefined') {
            messageContent.querySelectorAll('pre code').forEach((block) => {
              hljs.highlightElement(block);
            });
            console.log('Applied code highlighting');
          } else {
            console.warn('highlight.js is not available for code highlighting');
          }
        } catch (e) {
          console.warn('Error applying code highlighting:', e);
        }
      } else {
        // Last resort - plain text
        console.warn('All markdown rendering methods failed, using plain text');
        messageContent.textContent = content;
      }
    } catch (error) {
      console.error('Error in markdown rendering process:', error);
      // Fallback to plain text if there's an error
      messageContent.textContent = content;
    }
  } else {
    // For user and system messages, just use plain text with line breaks
    messageContent.textContent = content;
  }
  
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
      // Instead of using message count, we'll track whether we've loaded history before
      // This way we only load history on first load, but not on subsequent updates
      // which prevents duplicate message rendering
      
      // Create a flag key for this page load to track if history has been loaded
      const historyLoadedKey = `history_loaded_${currentPageLoadId}`;
      const { [historyLoadedKey]: historyLoaded } = await chrome.storage.local.get(historyLoadedKey);
      
      if (!historyLoaded) {
        console.log('First time loading history for this session, displaying messages');
        
        // Display chat history from storage
        history.forEach(message => {
          displayMessage(message.role, message.content, message.timestamp);
        });
        
        console.log(`Displayed ${history.length} messages from history`);
        
        // Mark history as loaded for this session
        await chrome.storage.local.set({ [historyLoadedKey]: true });
      } else {
        console.log('History already loaded for this session, skipping display to avoid duplication');
      }
      
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
            
            // Load and display the selected chat session with fromHistoryClick=true
            await loadAndDisplayChatSession(session.pageLoadId, session, true);
            
            // Make sure we're not marked as a new conversation
            isInNewConversation = false;
            
            // DIRECT APPROACH: Show the main view without highlighting any buttons
            // Hide all content areas except main content
            mainContent.classList.remove('hidden');
            pastConversationsView.classList.add('hidden');
            settingsContent.classList.add('hidden');
            
            // Explicitly clear all active states
            newConversationBtn.classList.remove('active');
            pastSessionsBtn.classList.remove('active');
            settingsBtn.classList.remove('active');
            
            // Show the conversation info
            const conversationInfo = document.getElementById('currentConversationInfo');
            if (conversationInfo) {
              conversationInfo.classList.remove('hidden-topic-name');
            }
            
            console.log('Loaded history item - explicitly not highlighting any buttons');
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
 * @param {boolean} fromHistoryClick - Flag to indicate if this was called directly from a history item click
 */
async function loadAndDisplayChatSession(pageLoadId, sessionInfo = null, fromHistoryClick = false) {
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
        
        // Only call showMainView() if NOT called from a history item click
        // When called from history item clicks, the view switching is handled in the click handler
        if (!fromHistoryClick) {
            showMainView();
        }
        
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
  
  // Format content based on the role
  if (role === 'assistant') {
    try {
      // Debug info to console
      console.log('Rendering markdown for assistant message');
      
      let renderedContent = '';
      let markdownRendered = false;
      
      // Check explicitly for the markdown-it library
      if (typeof window.markdownit === 'function') {
        console.log('Using window.markdownit for rendering');
        try {
          const md = window.markdownit({
            html: false,
            breaks: true,
            linkify: true,
            typographer: true
          });
          renderedContent = md.render(content);
          markdownRendered = true;
          console.log('Successfully rendered with window.markdownit');
        } catch (err) {
          console.error('Error using window.markdownit:', err);
        }
      } else if (typeof markdownit === 'function') {
        console.log('Using global markdownit for rendering');
        try {
          const md = markdownit({
            html: false,
            breaks: true,
            linkify: true,
            typographer: true
          });
          renderedContent = md.render(content);
          markdownRendered = true;
          console.log('Successfully rendered with global markdownit');
        } catch (err) {
          console.error('Error using global markdownit:', err);
        }
      } 
      
      if (!markdownRendered) {
        console.log('markdown-it is not available, falling back to custom parser');
        renderedContent = basicMarkdownRender(content);
        markdownRendered = true;
      }
      
      if (markdownRendered) {
        // Set the rendered HTML content
        messageContent.innerHTML = renderedContent;
        
        // Add target="_blank" to all links to open in new tab
        const links = messageContent.querySelectorAll('a');
        links.forEach(link => {
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        });
        
        // Apply highlighting to code blocks
        try {
          if (typeof hljs !== 'undefined') {
            messageContent.querySelectorAll('pre code').forEach((block) => {
              hljs.highlightElement(block);
            });
            console.log('Applied code highlighting');
          } else {
            console.warn('highlight.js is not available for code highlighting');
          }
        } catch (e) {
          console.warn('Error applying code highlighting:', e);
        }
      } else {
        // Last resort - plain text
        console.warn('All markdown rendering methods failed, using plain text');
        messageContent.textContent = content;
      }
    } catch (error) {
      console.error('Error in markdown rendering process:', error);
      // Fallback to plain text if there's an error
      messageContent.textContent = content;
    }
  } else {
    // For user and system messages, just use plain text with line breaks
    messageContent.textContent = content;
  }
  
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
  // Store original title
  const originalTitle = button.title;
  
  navigator.clipboard.writeText(text).then(() => {
    // Show feedback
    button.title = 'Copied!';
    
    // Briefly change the button appearance to give visual feedback
    button.classList.add('copy-success');
    
    // Reset after a delay
    setTimeout(() => {
      button.title = originalTitle;
      button.classList.remove('copy-success');
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy text:', err);
    button.title = 'Failed to copy';
    
    // Show error styling
    button.classList.add('copy-error');
    
    // Reset after a delay
    setTimeout(() => {
      button.title = originalTitle;
      button.classList.remove('copy-error');
    }, 2000);
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

/**
 * Basic markdown renderer that can handle common markdown syntax
 * Used as a fallback when markdown-it is not available
 * @param {string} text - The markdown text to render
 * @returns {string} - HTML string with rendered markdown
 */
function basicMarkdownRender(text) {
  if (!text) return '';
  
  let html = text;
  
  // Convert headers before handling new lines
  // Handle headers (h1-h6) - Make regex more robust to handle ### at beginning of lines
  html = html.replace(/^(\s*)#{6}\s+(.+)$/gm, '$1<h6>$2</h6>');
  html = html.replace(/^(\s*)#{5}\s+(.+)$/gm, '$1<h5>$2</h5>');
  html = html.replace(/^(\s*)#{4}\s+(.+)$/gm, '$1<h4>$2</h4>');
  html = html.replace(/^(\s*)#{3}\s+(.+)$/gm, '$1<h3>$2</h3>');
  html = html.replace(/^(\s*)#{2}\s+(.+)$/gm, '$1<h2>$2</h2>');
  html = html.replace(/^(\s*)#{1}\s+(.+)$/gm, '$1<h1>$2</h1>');
  
  // Replace new lines with <br> but not inside code blocks
  let parts = html.split(/```[\s\S]*?```/g);
  let codeBlocks = html.match(/```[\s\S]*?```/g) || [];
  let result = '';
  
  for (let i = 0; i < parts.length; i++) {
    // Handle newlines in regular text
    parts[i] = parts[i].replace(/\n/g, '<br>');
    result += parts[i];
    if (i < codeBlocks.length) {
      result += codeBlocks[i];
    }
  }
  html = result;
  
  // Handle bold text
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  // Handle italic text
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  
  // Handle code blocks with proper syntax highlighting and language support
  html = html.replace(/```([a-z]*)\n([\s\S]*?)```/g, function(match, lang, code) {
    const languageClass = lang ? ` class="language-${lang}"` : '';
    return `<pre><code${languageClass}>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/<br>/g, '\n')}</code></pre>`;
  });
  
  // Handle inline code (single backtick)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Handle unordered lists - improved to better handle nested lists
  html = html.replace(/^(\s*)([\*\-\+])\s+(.*)$/gm, function(match, indent, bullet, text) {
    const indentLevel = Math.floor(indent.length / 2);
    const liClass = indentLevel > 0 ? ` class="indent-${indentLevel}"` : '';
    return `<li${liClass}>${text}</li>`;
  });
  
  // Wrap lists in <ul> tags
  let inList = false;
  const lines = html.split('<br>');
  html = '';
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/<li[^>]*>/)) {
      if (!inList) {
        inList = true;
        html += '<ul>';
      }
      html += lines[i];
    } else {
      if (inList) {
        inList = false;
        html += '</ul>';
      }
      html += lines[i];
      if (i < lines.length - 1) {
        html += '<br>';
      }
    }
  }
  
  if (inList) {
    html += '</ul>';
  }
  
  // Handle ordered lists with better nesting support
  inList = false;
  const olLines = html.split('<br>');
  html = '';
  
  const orderedListRegex = /^(\s*)(\d+)\.?\s+(.*)$/;
  for (let i = 0; i < olLines.length; i++) {
    const match = olLines[i].match(orderedListRegex);
    if (match) {
      const [, indent, num, text] = match;
      const indentLevel = Math.floor(indent.length / 2);
      const liClass = indentLevel > 0 ? ` class="indent-${indentLevel}"` : '';
      
      if (!inList) {
        inList = true;
        html += '<ol>';
      }
      html += `<li${liClass}>${text}</li>`;
    } else {
      if (inList) {
        inList = false;
        html += '</ol>';
      }
      html += olLines[i];
      if (i < olLines.length - 1 && !olLines[i].match(/<\/[ou]l>/)) {
        html += '<br>';
      }
    }
  }
  
  if (inList) {
    html += '</ol>';
  }
  
  // Handle blockquotes with better styling
  html = html.replace(/^(\s*)&gt;\s+(.*)$/gm, '<blockquote>$2</blockquote>');
  html = html.replace(/<\/blockquote><br><blockquote>/g, '<br>');
  
  // Handle links with target="_blank" for security
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Handle horizontal rules
  html = html.replace(/^(\s*)([-*_])\2\2+$/gm, '<hr>');
  
  // Clean up any unnecessary <br> tags around block elements
  html = html.replace(/<br><(h[1-6]|ul|ol|pre|blockquote)/g, '<$1');
  html = html.replace(/<\/(h[1-6]|ul|ol|pre|blockquote)><br>/g, '</$1>');
  
  return html;
}

/**
 * Updates a slider's background gradient to represent its current value
 * @param {HTMLInputElement} slider - The slider input element
 */
function updateSliderGradient(slider) {
  const value = slider.value;
  const max = slider.max || 100;
  const percentage = (value / max) * 100;
  slider.style.background = `linear-gradient(to right, var(--accent-color) 0%, var(--accent-color) ${percentage}%, var(--input-bg) ${percentage}%, var(--input-bg) 100%)`;
}

// Helper function to continue processing after scraping is successful
async function continueWithScrapeResponse(scraperResponse, question) {
  try {
    // Now send for inference with the scraped content
    console.log('Sending getInference message');
    console.log('Content length being sent:', scraperResponse.content ? scraperResponse.content.length : 0);
    
    const response = await chrome.runtime.sendMessage({
      action: 'getInference',
      question,
      content: scraperResponse.content,
      url: currentUrl,
      tabId: currentTabId,
      pageLoadId: currentPageLoadId,
      pageTitle: currentPageTitle
    });
    
    console.log('Inference response received:', response);
    
    // Hide loading state in button
    submitBtn.classList.remove('button-loading');
    const spinner = submitBtn.querySelector('.spinner');
    if (spinner) {
      spinner.style.display = 'none';
      
      // Make button text visible again
      const buttonText = submitBtn.querySelector('.button-text');
      if (buttonText) {
        buttonText.style.visibility = 'visible';
      }
    }
    
    if (!response) {
      showError('No response received from the inference API. Please try again.');
      isProcessing = false; // Reset processing flag
      return;
    }
    
    if (response.error) {
      showError(response.error);
      isProcessing = false; // Reset processing flag
      return;
    }
    
    if (!response.answer) {
      showError('The API response did not contain an answer. Please try again.');
      isProcessing = false; // Reset processing flag
      return;
    }
    
    // Add AI response to chat
    await addMessageToChat('assistant', response.answer);
    
    // Stay in main view
    showMainView();
    
    // Reset processing flag
    isProcessing = false;
  } catch (error) {
    console.error('Error in inference:', error);
    showError(error.message || 'An error occurred during inference');
    
    // Hide loading button state
    submitBtn.classList.remove('button-loading');
    const spinner = submitBtn.querySelector('.spinner');
    if (spinner) {
      spinner.style.display = 'none';
      
      // Make button text visible again
      const buttonText = submitBtn.querySelector('.button-text');
      if (buttonText) {
        buttonText.style.visibility = 'visible';
      }
    }
    
    // Reset processing flag
    isProcessing = false;
  }
}

// Helper function to prevent duplicate submissions
function preventDuplicateSubmission() {
  if (isSubmitInProgress) {
    console.log('Preventing duplicate submission - operation already in progress');
    return true; // Submission should be prevented
  }
  
  isSubmitInProgress = true;
  console.log('Setting isSubmitInProgress to true');
  
  // Automatically reset after 5 seconds as a safety measure
  setTimeout(() => {
    isSubmitInProgress = false;
    console.log('Auto-reset isSubmitInProgress to false after timeout');
  }, 5000);
  
  return false; // Submission can proceed
}