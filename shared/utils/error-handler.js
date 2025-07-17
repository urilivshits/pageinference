/**
 * Chrome Store Compliant Error Handler
 * 
 * Provides silent error handling to prevent extension errors page spam
 * while maintaining proper error tracking for debugging.
 */

export class ErrorHandler {
  static isDevMode = false;
  static forceDevMode = false; // Manual override for dev mode
  static errorCount = 0;
  static maxErrors = 50; // Prevent infinite error loops
  
  /**
   * Initialize error handler with development mode detection
   */
  static init() {
    // Check for manual dev mode override first
    if (this.forceDevMode) {
      this.isDevMode = true;
      return;
    }
    
    // Detect development mode (unpacked extension)
    try {
      this.isDevMode = !chrome.runtime.getManifest()?.update_url;
    } catch (e) {
      this.isDevMode = true;
    }
  }

  /**
   * Toggle development mode manually
   * @param {boolean} enabled - Whether to enable dev mode
   */
  static setDevMode(enabled) {
    this.forceDevMode = enabled;
    this.isDevMode = enabled;
    console.log(`[ErrorHandler] Dev mode ${enabled ? 'enabled' : 'disabled'} manually`);
  }

  /**
   * Get current dev mode status
   * @returns {boolean} Current dev mode status
   */
  static getDevMode() {
    return this.isDevMode;
  }

  /**
   * Handle errors silently in production, with optional console logging in dev
   * @param {string} context - Context where error occurred
   * @param {Error|string} error - The error to handle
   * @param {Object} metadata - Additional metadata
   */
  static handle(context, error, metadata = {}) {
    if (this.errorCount > this.maxErrors) {
      return; // Prevent error spam loops
    }
    
    this.errorCount++;
    
    const errorInfo = {
      context,
      message: error?.message || error,
      timestamp: Date.now(),
      ...metadata
    };

    // Only log to console in development mode
    if (this.isDevMode) {
      console.error(`[${context}]`, error, metadata);
    }

    // Store error for debugging without console spam
    this._storeError(errorInfo);
  }

  /**
   * Handle Chrome runtime errors with context validation
   * @param {string} context - Context where error occurred
   * @param {function} callback - Optional callback to execute if no error
   */
  static handleChromeError(context, callback = null) {
    if (chrome.runtime.lastError) {
      this.handle(context, chrome.runtime.lastError.message, {
        type: 'chrome_runtime_error'
      });
      return true; // Error occurred
    }
    
    // Check if extension context is valid
    if (!this.isContextValid()) {
      this.handle(context, 'Extension context invalidated', {
        type: 'context_invalidated'
      });
      return true; // Context invalid
    }
    
    if (callback) callback();
    return false; // No error
  }

  /**
   * Check if Chrome extension context is still valid
   */
  static isContextValid() {
    try {
      // Try to access chrome.runtime.id - this will throw if context is invalidated
      return !!chrome.runtime?.id;
    } catch (e) {
      return false;
    }
  }

  /**
   * Wrap async operations with error handling
   * @param {function} operation - Async operation to wrap
   * @param {string} context - Context for error reporting
   * @param {any} fallbackValue - Value to return on error
   */
  static async wrapAsync(operation, context, fallbackValue = null) {
    try {
      return await operation();
    } catch (error) {
      this.handle(context, error, { type: 'async_operation' });
      return fallbackValue;
    }
  }

  /**
   * Store error information for debugging without console spam
   * @param {Object} errorInfo - Error information to store
   */
  static _storeError(errorInfo) {
    try {
      // Store last 20 errors for debugging
      const key = 'debug_errors';
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) return; // Silent fail
        
        const errors = result[key] || [];
        errors.unshift(errorInfo);
        
        // Keep only last 20 errors
        if (errors.length > 20) {
          errors.splice(20);
        }
        
        chrome.storage.local.set({ [key]: errors });
      });
    } catch (e) {
      // Silent fail - don't create more errors
    }
  }

  /**
   * Get stored errors for debugging
   * @returns {Promise<Array>} Array of stored errors
   */
  static async getStoredErrors() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['debug_errors'], (result) => {
          if (chrome.runtime.lastError) {
            resolve([]);
            return;
          }
          resolve(result.debug_errors || []);
        });
      } catch (e) {
        resolve([]);
      }
    });
  }

  /**
   * Clear stored errors
   */
  static async clearStoredErrors() {
    try {
      chrome.storage.local.remove(['debug_errors']);
    } catch (e) {
      // Silent fail
    }
  }

  /**
   * Graceful degradation wrapper
   * @param {function} primaryOperation - Primary operation to try
   * @param {function} fallbackOperation - Fallback operation
   * @param {string} context - Context for error reporting
   */
  static async gracefulDegrade(primaryOperation, fallbackOperation, context) {
    try {
      return await primaryOperation();
    } catch (error) {
      this.handle(context, error, { type: 'graceful_degradation' });
      
      if (fallbackOperation) {
        try {
          return await fallbackOperation();
        } catch (fallbackError) {
          this.handle(`${context}_fallback`, fallbackError);
          return null;
        }
      }
      
      return null;
    }
  }
}

// Initialize on load
ErrorHandler.init(); 