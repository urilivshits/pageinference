/**
 * Page Inference - Popup Script
 * 
 * This script handles:
 * 1. User interactions in the popup UI
 * 2. Communication with the background script
 * 3. Display of results and error messages
 */

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

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  const { apiKey } = await chrome.runtime.sendMessage({ action: 'getApiKey' });
  if (apiKey) {
    apiKeyInput.value = apiKey;
  }
  
  // Load saved model preference
  chrome.storage.sync.get('modelPreference', (data) => {
    if (data.modelPreference) {
      modelSelect.value = data.modelPreference;
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
  
  // Hide previous results and errors
  hideError();
  answerContainer.classList.add('hidden');
  loadingIndicator.classList.remove('hidden');
  
  try {
    // Get the page content
    const { content, error } = await chrome.runtime.sendMessage({ 
      action: 'scrapeCurrentPage' 
    });
    
    if (error) {
      throw new Error(error);
    }
    
    // Get the model preference
    const { modelPreference } = await chrome.storage.sync.get('modelPreference');
    
    // Get the answer from OpenAI
    const response = await chrome.runtime.sendMessage({
      action: 'getInference',
      content,
      question,
      model: modelPreference || 'gpt-3.5-turbo'
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    // Display the answer
    answerContent.textContent = response.answer;
    answerContainer.classList.remove('hidden');
  } catch (error) {
    showError(error.message);
  } finally {
    loadingIndicator.classList.add('hidden');
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