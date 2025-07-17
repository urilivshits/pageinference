/**
 * Console Override for Chrome Store Compliance
 * 
 * Replaces console.error with silent logging in production while preserving
 * full error visibility in development mode.
 */

let isDevModeEnabled = false;
let originalConsoleError = console.error;

/**
 * Detect if we're in development mode
 */
function detectDevMode() {
  try {
    // Check if extension is unpacked (development mode)
    const manifest = chrome.runtime.getManifest();
    return !manifest.update_url;
  } catch (e) {
    return true; // Default to dev mode if detection fails
  }
}

/**
 * Initialize console override
 */
export function initConsoleOverride() {
  isDevModeEnabled = detectDevMode();
  
  // Override console.error globally
  console.error = function(...args) {
    if (isDevModeEnabled) {
      // In development, use original console.error
      originalConsoleError.apply(console, args);
    } else {
      // In production, store error silently for debugging
      storeErrorSilently(args);
    }
  };
  
  console.log(`[Console Override] ${isDevModeEnabled ? 'Development' : 'Production'} mode detected`);
}

/**
 * Manually enable/disable dev mode
 * @param {boolean} enabled - Whether to enable dev mode
 */
export function setDevMode(enabled) {
  isDevModeEnabled = enabled;
  console.log(`[Console Override] Dev mode ${enabled ? 'enabled' : 'disabled'} manually`);
}

/**
 * Get current dev mode status
 * @returns {boolean} Current dev mode status
 */
export function getDevMode() {
  return isDevModeEnabled;
}

/**
 * Restore original console.error
 */
export function restoreConsole() {
  console.error = originalConsoleError;
  console.log('[Console Override] Original console.error restored');
}

/**
 * Store error silently for debugging without console spam
 * @param {Array} args - Console.error arguments
 */
function storeErrorSilently(args) {
  try {
    const errorInfo = {
      message: args.map(arg => 
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' '),
      timestamp: Date.now(),
      stack: new Error().stack
    };
    
    // Store in Chrome storage for debugging
    chrome.storage.local.get(['silent_errors'], (result) => {
      if (chrome.runtime.lastError) return; // Silent fail
      
      const errors = result.silent_errors || [];
      errors.unshift(errorInfo);
      
      // Keep only last 50 errors
      if (errors.length > 50) {
        errors.splice(50);
      }
      
      chrome.storage.local.set({ silent_errors: errors });
    });
  } catch (e) {
    // Silent fail - don't create more errors
  }
}

/**
 * Get silently stored errors for debugging
 * @returns {Promise<Array>} Array of stored errors
 */
export async function getSilentErrors() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(['silent_errors'], (result) => {
        if (chrome.runtime.lastError) {
          resolve([]);
          return;
        }
        resolve(result.silent_errors || []);
      });
    } catch (e) {
      resolve([]);
    }
  });
}

/**
 * Clear silently stored errors
 */
export async function clearSilentErrors() {
  try {
    chrome.storage.local.remove(['silent_errors']);
  } catch (e) {
    // Silent fail
  }
}

// Auto-initialize when imported
initConsoleOverride(); 