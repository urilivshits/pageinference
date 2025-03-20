/**
 * Background Script
 * 
 * Main entry point for the extension's background page.
 * Sets up listeners and manages the extension's lifecycle.
 */

import messageHandler from './services/message-handler.js';
import * as storageService from './services/storage-service.js';
import * as chatService from './services/chat-service.js';
import { STORAGE_KEYS } from '../shared/constants.js';

/**
 * Initialize the background script
 */
async function initialize() {
  console.log('Background script initialized');
  
  // Set up message listeners
  messageHandler.setupMessageListeners();
  
  // Set up extension installation/update handlers
  setupExtensionHandlers();
  
  // Initialize debug mode if enabled
  const debugMode = await storageService.getValue(STORAGE_KEYS.DEBUG_MODE, false);
  if (debugMode) {
    console.log('Debug mode enabled');
    await storageService.storeDebugLog({
      type: 'initialization',
      message: 'Background script initialized',
      data: { timestamp: Date.now() }
    });
  }
}

/**
 * Set up handlers for extension installation and updates
 */
function setupExtensionHandlers() {
  // Handle extension installation
  chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
    if (reason === 'install') {
      console.log('Extension installed');
      await handleFirstInstall();
    } else if (reason === 'update') {
      console.log(`Extension updated from ${previousVersion}`);
      await handleUpdate(previousVersion);
    }
  });
  
  // Handle extension startup
  chrome.runtime.onStartup.addListener(() => {
    console.log('Extension started');
  });
}

/**
 * Handle first installation of the extension
 */
async function handleFirstInstall() {
  // Set default preferences
  await storageService.setValue(STORAGE_KEYS.USER_PREFERENCES, {
    theme: 'light',
    temperature: 0.7,
    pageScraping: true,
    webSearch: true,
    currentSiteFilter: true,
    defaultModel: 'gpt-4o-mini'
  });
  
  // Initialize empty chat sessions list
  await storageService.setValue(STORAGE_KEYS.CHAT_SESSIONS, []);
  
  // Log installation
  await storageService.storeDebugLog({
    type: 'installation',
    message: 'Extension installed',
    data: { timestamp: Date.now() }
  });
  
  // Open onboarding page
  chrome.tabs.create({
    url: chrome.runtime.getURL('onboarding.html')
  });
}

/**
 * Handle extension update
 * 
 * @param {string} previousVersion - The previous version of the extension
 */
async function handleUpdate(previousVersion) {
  // Log update
  await storageService.storeDebugLog({
    type: 'update',
    message: `Extension updated from ${previousVersion}`,
    data: { 
      previousVersion,
      timestamp: Date.now()
    }
  });
  
  // Perform data migrations if needed
  await performDataMigrations(previousVersion);
}

/**
 * Perform data migrations when updating from previous versions
 * 
 * @param {string} previousVersion - The previous version of the extension
 */
async function performDataMigrations(previousVersion) {
  // Convert version string to number for comparison
  const versionParts = previousVersion.split('.').map(Number);
  
  // Example: If updating from before version 2.0.0
  if (versionParts[0] < 2) {
    console.log('Performing migration for pre-2.0.0 version');
    
    // Here you would perform data migrations specific to this version change
    // For example, moving data from one storage format to another
  }
  
  // More migrations can be added here as needed
}

// Start the initialization
initialize().catch(error => {
  console.error('Error initializing background script:', error);
}); 