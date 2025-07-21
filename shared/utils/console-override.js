/**
 * Console Override for Chrome Store Compliance
 * 
 * Replaces console.error with silent logging in production while preserving
 * full error visibility in development mode.
 */

import { ErrorHandler } from './error-handler.js';

let originalConsoleError = console.error;

/**
 * Initialize console override
 */
export function initConsoleOverride() {
  // Initialize ErrorHandler first to ensure dev mode is detected
  ErrorHandler.init();
  
  // Override console.error globally
  console.error = function(...args) {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime || !chrome.runtime.id) {
        // Extension context invalidated, use minimal logging
        try {
          // Try to use the original console.error if available
          if (typeof originalConsoleError === 'function') {
            originalConsoleError.apply(console, args);
          } else {
            // Last resort: use native console.error
            console.log('[Extension Context Invalidated]', ...args);
          }
        } catch (fallbackError) {
          // Absolute last resort: do nothing
        }
        return;
      }
      
      if (ErrorHandler.getDevMode()) {
        // In development, use original console.error with protection
        try {
          if (typeof originalConsoleError === 'function') {
            originalConsoleError.apply(console, args);
          } else {
            // Fallback to native console.error if original is not available
            console.log('[Dev Mode] Original console.error not available, using native:', ...args);
          }
        } catch (devError) {
          // If original console.error fails in dev mode, use native console.log
          console.log('[Dev Mode] Console.error failed, using console.log:', ...args);
        }
      } else {
        // In production, store error silently for debugging
        storeErrorSilently(args);
      }
    } catch (error) {
      // If console.error itself fails (e.g., extension context invalidated),
      // fall back to the original console.error without our override
      try {
        if (typeof originalConsoleError === 'function') {
          originalConsoleError.apply(console, args);
        } else {
          // Last resort: use native console.error
          console.log('[Console Override Error]', ...args);
        }
      } catch (fallbackError) {
        // Absolute last resort: do nothing to prevent infinite loops
      }
    }
  };
  
  console.log(`[Console Override] ${ErrorHandler.getDevMode() ? 'Development' : 'Production'} mode detected via ErrorHandler`);
  
  // Log additional debug info
  try {
    if (chrome.runtime && chrome.runtime.id) {
      console.log('[Console Override] Extension context is valid, runtime ID:', chrome.runtime.id);
    } else {
      console.log('[Console Override] Extension context is invalid or not available');
    }
  } catch (contextError) {
    console.log('[Console Override] Could not check extension context:', contextError.message);
  }
}

/**
 * Manually enable/disable dev mode
 * @param {boolean} enabled - Whether to enable dev mode
 */
export function setDevMode(enabled) {
  ErrorHandler.setDevMode(enabled);
  console.log(`[Console Override] Dev mode ${enabled ? 'enabled' : 'disabled'} manually via ErrorHandler`);
}

/**
 * Get current dev mode status
 * @returns {boolean} Current dev mode status
 */
export function getDevMode() {
  return ErrorHandler.getDevMode();
}

/**
 * Get detailed dev mode and context information
 * @returns {Object} Detailed status information
 */
export function getDetailedStatus() {
  const status = {
    isDevModeEnabled: ErrorHandler.getDevMode(),
    hasExtensionContext: false,
    runtimeId: null,
    manifestUpdateUrl: null,
    error: null
  };
  
  try {
    if (chrome.runtime && chrome.runtime.id) {
      status.hasExtensionContext = true;
      status.runtimeId = chrome.runtime.id;
      
      try {
        const manifest = chrome.runtime.getManifest();
        status.manifestUpdateUrl = manifest.update_url;
      } catch (manifestError) {
        status.error = `Manifest error: ${manifestError.message}`;
      }
    }
  } catch (contextError) {
    status.error = `Context error: ${contextError.message}`;
  }
  
  return status;
}

/**
 * Restore original console.error
 */
export function restoreConsole() {
  try {
    console.error = originalConsoleError;
    console.log('[Console Override] Original console.error restored');
  } catch (error) {
    // If restoration fails, try to use native console.error
    try {
      console.error = console.error || console.log;
      console.log('[Console Override] Fallback console.error restored');
    } catch (fallbackError) {
      // Absolute last resort: do nothing
    }
  }
}

/**
 * Store error silently for debugging without console spam
 * @param {Array} args - Console.error arguments
 */
function storeErrorSilently(args) {
  try {
    // Check if extension context is still valid before proceeding
    if (!chrome.runtime || !chrome.runtime.id) {
      return; // Extension context invalidated, skip storage
    }
    
    const errorMessage = args.map(arg => 
      typeof arg === 'string' ? arg : JSON.stringify(arg)
    ).join(' ');
    
    // Filter out common Chrome extension communication errors that are expected
    const expectedErrors = [
      'Could not establish connection',
      'Receiving end does not exist',
      'Extension context invalidated',
      'The message port closed before a response was received'
    ];
    
    const isExpectedError = expectedErrors.some(expected => 
      errorMessage.includes(expected)
    );
    
    // Only store unexpected errors to avoid spam
    if (!isExpectedError) {
      const errorInfo = {
        message: errorMessage,
        timestamp: Date.now(),
        stack: new Error().stack
      };
      
      // Store in Chrome storage for debugging with additional error handling
      try {
        chrome.storage.local.get(['silent_errors'], (result) => {
          if (chrome.runtime.lastError) return; // Silent fail
          
          const errors = result.silent_errors || [];
          errors.unshift(errorInfo);
          
          // Keep only last 50 errors
          if (errors.length > 50) {
            errors.splice(50);
          }
          
          chrome.storage.local.set({ silent_errors: errors }, () => {
            if (chrome.runtime.lastError) {
              // Silent fail if storage fails
            }
          });
        });
      } catch (storageError) {
        // Silent fail if storage access fails
      }
    }
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

// Auto-initialize when imported with error handling
try {
  initConsoleOverride();
} catch (error) {
  // If initialization fails, don't override console.error
  // This prevents the override from causing additional errors
  console.log('[Console Override] Initialization failed, using default console.error');
} 