/**
 * Page Inference Extension Helpers
 * 
 * Utility functions to assist with module loading and extension integration.
 */

/**
 * Safely get a URL from chrome.runtime
 * 
 * @param {string} path - The path to get the URL for
 * @returns {string} - The extension URL for the path
 */
export function getExtensionUrl(path) {
  try {
    return chrome.runtime.getURL(path);
  } catch (error) {
    console.error(`Error getting extension URL for ${path}:`, error);
    return path;
  }
}

/**
 * Log a message with a consistent prefix
 * 
 * @param {string} message - The message to log
 * @param {string} type - The type of log message (log, error, warn, info)
 */
export function logMessage(message, type = 'log') {
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

/**
 * Check if a module is available
 * 
 * @param {string} modulePath - The path to the module
 * @returns {Promise<boolean>} - True if the module is available
 */
export async function checkModuleAvailability(modulePath) {
  try {
    const url = getExtensionUrl(modulePath);
    const response = await fetch(url);
    return response.ok;
  } catch (error) {
    logMessage(`Module ${modulePath} is not available: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Load a script dynamically
 * 
 * @param {string} src - The source URL of the script
 * @returns {Promise<void>} - Resolves when the script is loaded
 */
export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = getExtensionUrl(src);
    script.type = 'module';
    script.onload = () => {
      logMessage(`Script ${src} loaded successfully`);
      resolve();
    };
    script.onerror = (error) => {
      logMessage(`Error loading script ${src}: ${error}`, 'error');
      reject(error);
    };
    document.head.appendChild(script);
  });
}

export default {
  getExtensionUrl,
  logMessage,
  checkModuleAvailability,
  loadScript
}; 