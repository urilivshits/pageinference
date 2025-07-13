/**
 * ES Module Loader for Chrome Extensions
 * 
 * This script dynamically imports ES modules for use in Chrome Extensions.
 * It works around the restrictions on ES modules in content scripts.
 */

console.log('[Page Inference] Module loader initializing');

// Function to safely get an extension URL
function getExtensionUrl(path) {
  try {
    return chrome.runtime.getURL(path);
  } catch (error) {
    console.error(`[Page Inference] Error getting extension URL for ${path}:`, error);
    return path;
  }
}

// Function to log messages with a consistent prefix
function logMessage(message, type = 'log') {
  const prefix = '[Page Inference]';
  switch (type) {
    case 'error':
      console.error(`${prefix} ${message}`);
      break;
    case 'warn':
      console.warn(`${prefix} ${message}`);
      break;
    case 'info':
      console.info(`${prefix} ${message}`);
      break;
    default:
      console.log(`${prefix} ${message}`);
      break;
  }
}

// Function to dynamically import modules
async function loadModule(modulePath) {
  try {
    logMessage(`Loading module: ${modulePath}`);
    const fullPath = getExtensionUrl(modulePath);
    const module = await import(fullPath);
    logMessage(`Successfully loaded module: ${modulePath}`);
    return module;
  } catch (error) {
    logMessage(`Error loading module ${modulePath}: ${error.message}`, 'error');
    throw error;
  }
}

// Export the loadModule function for use in content scripts
window.loadPageInferenceModule = loadModule;

// Check if a script can be loaded
async function checkScriptAvailability(path) {
  try {
    const url = getExtensionUrl(path);
    const response = await fetch(url);
    return response.ok;
  } catch (error) {
    logMessage(`Script ${path} is not available: ${error.message}`, 'error');
    return false;
  }
}

// Load the refactored content script when this loader is executed
(async function() {
  try {
    logMessage('Starting content script loading process');
    
    // First check if the script is available
    logMessage('Checking content script availability at ./content/content.js');
    const isContentScriptAvailable = await checkScriptAvailability('./content/content.js');
    
    if (!isContentScriptAvailable) {
      logMessage('Refactored content script is not available at content/content.js, aborting load', 'error');
      return;
    }
    
    logMessage('Content script is available, proceeding with load');
    logMessage('Loading refactored content script from content/content.js');
    const contentScript = await loadModule('./content/content.js');
    logMessage('Refactored content script loaded successfully');
    
    // Log that the module loading completed
    logMessage('Module loading process completed');
  } catch (error) {
    logMessage(`Failed to load refactored content script: ${error.message}`, 'error');
    logMessage(`Error stack: ${error.stack}`, 'error');
  }
})(); 