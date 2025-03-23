/**
 * Settings Component Tests
 * 
 * Tests for the settings component functionality
 */

import { test, suite, assertEqual, assertTrue, assertFalse } from '../test-framework.js';
import { MESSAGE_TYPES } from '../../shared/constants.js';

// Mock chrome API
const mockChrome = {
  runtime: {
    sendMessage: async (message) => {
      switch (message.type) {
        case MESSAGE_TYPES.GET_API_KEY:
          return {
            success: true,
            data: 'test-api-key'
          };
        case MESSAGE_TYPES.SET_API_KEY:
          return {
            success: true
          };
        default:
          return { success: false, error: 'Unknown message type' };
      }
    }
  },
  storage: {
    local: {
      get: async (key) => ({
        settings: {
          theme: 'light',
          temperature: 0.7,
          defaultModel: 'gpt-4',
          webSearch: true,
          pageScraping: true
        }
      }),
      set: async (data) => {}
    }
  }
};

// Mock DOM setup
function setupMockDOM() {
  document.body.innerHTML = `
    <div id="settings-container">
      <div class="settings-section">
        <h3>API Key</h3>
        <div class="api-key-input-container">
          <input type="password" id="api-key-input" placeholder="Enter your OpenAI API key">
          <button id="toggle-api-key-visibility">Show</button>
          <button id="save-api-key">Save</button>
        </div>
      </div>
      
      <div class="settings-section">
        <h3>Chat Settings</h3>
        <div class="setting-item">
          <label for="model-selector">AI Model:</label>
          <select id="model-selector">
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          </select>
        </div>
        
        <div class="setting-item">
          <label for="temperature-slider">Temperature:</label>
          <input type="range" id="temperature-slider" min="0" max="1" step="0.1" value="0.7">
          <span id="temperature-value">0.7</span>
        </div>
        
        <div class="setting-item">
          <label for="web-search-toggle">Web Search:</label>
          <input type="checkbox" id="web-search-toggle" checked>
        </div>
        
        <div class="setting-item">
          <label for="page-scraping-toggle">Page Scraping:</label>
          <input type="checkbox" id="page-scraping-toggle" checked>
        </div>
      </div>
      
      <div class="settings-section">
        <h3>Appearance</h3>
        <div class="setting-item">
          <label for="theme-toggle">Theme:</label>
          <select id="theme-selector">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

// Clean up mock DOM
function cleanupMockDOM() {
  document.body.innerHTML = '';
}

// Test suites
suite('Settings Component', async () => {
  // Setup before each test
  let settingsComponent;
  
  beforeEach(async () => {
    // Setup mock DOM
    setupMockDOM();
    
    // Setup mock chrome API
    global.chrome = mockChrome;
    
    // Import settings component
    const module = await import('../../popup/components/settings.js');
    settingsComponent = module.default;
    
    // Initialize component
    settingsComponent.initializeSettingsComponent();
  });
  
  afterEach(() => {
    cleanupMockDOM();
    delete global.chrome;
  });
  
  test('Component initialization', () => {
    assertTrue(document.getElementById('settings-container') !== null);
    assertTrue(document.getElementById('api-key-input') !== null);
    assertTrue(document.getElementById('model-selector') !== null);
    assertTrue(document.getElementById('temperature-slider') !== null);
  });
  
  test('API key handling', async () => {
    const apiKeyInput = document.getElementById('api-key-input');
    const saveButton = document.getElementById('save-api-key');
    const toggleButton = document.getElementById('toggle-api-key-visibility');
    
    // Test API key visibility toggle
    assertEqual(apiKeyInput.type, 'password');
    toggleButton.click();
    assertEqual(apiKeyInput.type, 'text');
    toggleButton.click();
    assertEqual(apiKeyInput.type, 'password');
    
    // Test API key saving
    apiKeyInput.value = 'test-api-key';
    saveButton.click();
    
    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should trigger success event
    assertTrue(document.querySelector('.success-message') !== null);
  });
  
  test('Theme selection', () => {
    const themeSelector = document.getElementById('theme-selector');
    
    // Test theme change
    themeSelector.value = 'dark';
    themeSelector.dispatchEvent(new Event('change'));
    
    assertEqual(document.body.getAttribute('data-theme'), 'dark');
  });
  
  test('Temperature adjustment', () => {
    const temperatureSlider = document.getElementById('temperature-slider');
    const temperatureValue = document.getElementById('temperature-value');
    
    // Test temperature change
    temperatureSlider.value = '0.5';
    temperatureSlider.dispatchEvent(new Event('input'));
    
    assertEqual(temperatureValue.textContent, '0.5');
  });
  
  test('Model selection', () => {
    const modelSelector = document.getElementById('model-selector');
    
    // Test model change
    modelSelector.value = 'gpt-3.5-turbo';
    modelSelector.dispatchEvent(new Event('change'));
    
    // Should trigger settings changed event
    assertTrue(settingsComponent.getSettings().defaultModel === 'gpt-3.5-turbo');
  });
  
  test('Feature toggles', () => {
    const webSearchToggle = document.getElementById('web-search-toggle');
    const pageScrapingToggle = document.getElementById('page-scraping-toggle');
    
    // Test web search toggle
    webSearchToggle.checked = false;
    webSearchToggle.dispatchEvent(new Event('change'));
    assertFalse(settingsComponent.getSettings().webSearch);
    
    // Test page scraping toggle
    pageScrapingToggle.checked = false;
    pageScrapingToggle.dispatchEvent(new Event('change'));
    assertFalse(settingsComponent.getSettings().pageScraping);
  });
  
  test('Settings persistence', async () => {
    // Change some settings
    const settings = {
      theme: 'dark',
      temperature: 0.5,
      defaultModel: 'gpt-3.5-turbo',
      webSearch: false,
      pageScraping: true
    };
    
    // Apply settings
    await settingsComponent.applySettings(settings);
    
    // Verify settings were applied
    assertEqual(document.getElementById('theme-selector').value, 'dark');
    assertEqual(document.getElementById('temperature-slider').value, '0.5');
    assertEqual(document.getElementById('model-selector').value, 'gpt-3.5-turbo');
    assertFalse(document.getElementById('web-search-toggle').checked);
    assertTrue(document.getElementById('page-scraping-toggle').checked);
  });
  
  test('Settings validation', () => {
    const temperatureSlider = document.getElementById('temperature-slider');
    
    // Test invalid temperature
    temperatureSlider.value = '2.0';
    temperatureSlider.dispatchEvent(new Event('input'));
    
    // Should clamp to valid range
    assertEqual(settingsComponent.getSettings().temperature, 1.0);
  });
}); 