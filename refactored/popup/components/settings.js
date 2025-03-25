/**
 * Settings Component
 * 
 * Handles user preferences and API key management.
 */

import { MESSAGE_TYPES, API_CONSTANTS, UI_CONSTANTS } from '../../shared/constants.js';

// DOM elements
let settingsContainer;
let apiKeyInput;
let toggleApiKeyButton;
let saveApiKeyButton;
let temperatureSlider;
let temperatureValue;
let themeOptions;
let modelSelector;
let webSearchToggle;
let pageScrapingToggle;

// Settings state
let currentSettings = null;
let modelAvailability = {};

/**
 * Initialize the settings component
 */
export function initializeSettingsComponent() {
  // Get DOM elements
  settingsContainer = document.getElementById('settings-container');
  apiKeyInput = document.getElementById('api-key-input');
  toggleApiKeyButton = document.getElementById('toggle-api-key-button');
  saveApiKeyButton = document.getElementById('save-api-key-button');
  temperatureSlider = document.getElementById('temperature-slider');
  temperatureValue = document.getElementById('temperature-value');
  themeOptions = document.getElementsByName('theme');
  modelSelector = document.getElementById('model-selector');
  webSearchToggle = document.getElementById('web-search-toggle');
  pageScrapingToggle = document.getElementById('page-scraping-toggle');
  
  // Add event listeners
  setupEventListeners();
  
  // Load settings
  loadSettings();
  
  // Check model availability
  checkModelAvailability();
  
  // Update slider gradient
  updateSliderGradient(temperatureSlider);
}

/**
 * Set up event listeners for settings interactions
 */
function setupEventListeners() {
  // API key management
  saveApiKeyButton.addEventListener('click', handleSaveApiKey);
  toggleApiKeyButton.addEventListener('click', toggleApiKeyVisibility);
  
  // Temperature slider
  temperatureSlider.addEventListener('input', () => {
    const value = temperatureSlider.value;
    temperatureValue.textContent = value;
    updateSliderGradient(temperatureSlider);
    updateSettings({ temperature: parseFloat(value) });
  });
  
  // Theme options
  themeOptions.forEach(option => {
    option.addEventListener('change', () => {
      if (option.checked) {
        const theme = option.value;
        updateSettings({ theme });
        applyTheme(theme);
      }
    });
  });
  
  // Model selection
  modelSelector.addEventListener('change', () => {
    const model = modelSelector.value;
    if (modelAvailability[model] === false) {
      alert('This model is not available with your current API key');
      modelSelector.value = currentSettings.defaultModel;
      return;
    }
    updateSettings({ defaultModel: model });
  });
  
  // Web search toggle
  webSearchToggle.addEventListener('change', () => {
    const enabled = webSearchToggle.checked;
    if (enabled && !modelAvailability['gpt-4o-mini']) {
      alert('Web search is only available with GPT-4o mini model');
      webSearchToggle.checked = false;
      return;
    }
    updateSettings({ webSearch: enabled });
  });
  
  // Page scraping toggle
  pageScrapingToggle.addEventListener('change', () => {
    updateSettings({ pageScraping: pageScrapingToggle.checked });
  });
}

/**
 * Toggle API key visibility
 */
function toggleApiKeyVisibility() {
  const type = apiKeyInput.type === 'password' ? 'text' : 'password';
  apiKeyInput.type = type;
  toggleApiKeyButton.textContent = type === 'password' ? '👁️' : '🔒';
}

/**
 * Load user settings from storage
 */
async function loadSettings() {
  try {
    // Get user preferences
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_USER_PREFERENCES
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to load settings');
    }
    
    currentSettings = response.data;
    
    // Apply settings to UI
    applySettingsToUI(currentSettings);
    
    // Load API key separately (for security)
    loadApiKey();
  } catch (error) {
    console.error('Error loading settings:', error);
    // Show error in settings container
    settingsContainer.innerHTML += `
      <div class="error-message">
        Error loading settings: ${error.message}
      </div>
    `;
  }
}

/**
 * Apply the selected theme to the UI
 * 
 * @param {string} theme - The theme to apply
 */
function applyTheme(theme) {
  if (theme === 'system') {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      document.body.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    });
  } else {
    document.body.setAttribute('data-theme', theme);
  }
}

/**
 * Populate the model selector with available models
 */
function populateModelSelector() {
  // Clear existing options
  modelSelector.innerHTML = '';
  
  // Add options for each available model
  const models = [
    { value: 'gpt-4o-mini', label: 'GPT-4o mini (Default, Search-enabled)' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4o', label: 'GPT-4o' }
  ];
  
  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model.value;
    option.textContent = model.label;
    modelSelector.appendChild(option);
  });
}

/**
 * Load the API key from storage
 */
async function loadApiKey() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_API_KEY
    });
    
    if (response.success && response.data) {
      // Mask the API key for display
      apiKeyInput.value = response.data.replace(/^(sk-[^0-9]*)([0-9a-zA-Z]{3}).*([0-9a-zA-Z]{3})$/, '$1***$3');
      apiKeyInput.setAttribute('data-has-key', 'true');
    } else {
      apiKeyInput.value = '';
      apiKeyInput.setAttribute('data-has-key', 'false');
    }
  } catch (error) {
    console.error('Error loading API key:', error);
    apiKeyInput.value = '';
    apiKeyInput.setAttribute('data-has-key', 'false');
  }
}

/**
 * Update slider gradient
 * 
 * @param {HTMLElement} slider - The slider element
 */
function updateSliderGradient(slider) {
  const value = (slider.value - slider.min) / (slider.max - slider.min) * 100;
  slider.style.background = `linear-gradient(to right, var(--accent-color) 0%, var(--accent-color) ${value}%, var(--border-color) ${value}%, var(--border-color) 100%)`;
}

/**
 * Check which models are available with the current API key
 */
async function checkModelAvailability() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.CHECK_MODEL_AVAILABILITY
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to check model availability');
    }
    
    modelAvailability = response.data || {};
    updateModelSelector();
  } catch (error) {
    console.error('Error checking model availability:', error);
  }
}

/**
 * Update model selector based on availability
 */
function updateModelSelector() {
  Array.from(modelSelector.options).forEach(option => {
    const model = option.value;
    const isAvailable = modelAvailability[model] !== false;
    
    if (!isAvailable) {
      option.disabled = true;
      option.textContent += ' (Not available)';
    }
  });
  
  // If current model is not available, switch to default
  if (modelAvailability[modelSelector.value] === false) {
    modelSelector.value = 'gpt-4o-mini';
    updateSettings({ defaultModel: 'gpt-4o-mini' });
  }
}

/**
 * Validate API key format
 * 
 * @param {string} apiKey - The API key to validate
 * @returns {boolean} - Whether the key is valid
 */
function validateApiKey(apiKey) {
  // Basic format check
  if (!apiKey.startsWith('sk-') || apiKey.length < 40) {
    return false;
  }
  
  // Check for common issues
  const commonIssues = [
    /\s/,  // Contains whitespace
    /[<>]/,  // Contains HTML tags
    /['"]/,  // Contains quotes
    /^sk-[a-zA-Z0-9]{48}$/  // Doesn't match expected format
  ];
  
  return !commonIssues.some(issue => issue.test(apiKey));
}

/**
 * Handle saving the API key
 */
async function handleSaveApiKey() {
  const apiKey = apiKeyInput.value.trim();
  
  if (!apiKey) {
    alert('Please enter an API key');
    return;
  }
  
  // Validate key format
  if (!validateApiKey(apiKey)) {
    const confirm = window.confirm(
      'This doesn\'t look like a valid OpenAI API key. It should start with "sk-" and be about 51 characters long. Are you sure you want to save it?'
    );
    if (!confirm) return;
  }
  
  try {
    // First test the key
    const testResponse = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.TEST_API_KEY,
      data: { apiKey }
    });
    
    if (!testResponse.success) {
      throw new Error(testResponse.error || 'API key test failed');
    }
    
    // If test passed, save the key
    const saveResponse = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SET_API_KEY,
      data: { apiKey }
    });
    
    if (!saveResponse.success) {
      throw new Error(saveResponse.error || 'Failed to save API key');
    }
    
    // Show success message
    alert('API key saved and verified successfully');
    
    // Reload the key display
    loadApiKey();
    
    // Check model availability with new key
    checkModelAvailability();
  } catch (error) {
    console.error('Error saving API key:', error);
    alert(`Error saving API key: ${error.message}`);
  }
}

/**
 * Update user settings
 * 
 * @param {Object} settings - The settings to update
 */
async function updateSettings(settings) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.UPDATE_USER_PREFERENCES,
      data: settings
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to update settings');
    }
    
    // Update current settings
    currentSettings = response.data;
  } catch (error) {
    console.error('Error updating settings:', error);
    // Restore previous settings in UI
    applySettingsToUI(currentSettings);
  }
}

export default {
  initializeSettingsComponent
}; 