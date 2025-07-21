/**
 * Developer Tools for Browse Buddy Extension
 * 
 * Provides utilities for debugging and development that can be accessed
 * from the browser console.
 */

import { getSilentErrors, clearSilentErrors } from './console-override.js';
import { ErrorHandler } from './error-handler.js';

/**
 * Global developer utilities
 * These will be available in the browser console as window.BrowseBuddyDev
 */
const DevTools = {
  /**
   * Toggle development mode
   * @param {boolean} enabled - Whether to enable dev mode
   */
  setDevMode(enabled) {
    ErrorHandler.setDevMode(enabled);
    console.log(`🔧 Dev mode ${enabled ? 'ENABLED' : 'DISABLED'} via ErrorHandler`);
    console.log('💡 Console errors will now be', enabled ? 'visible' : 'silent (stored for debugging)');
  },

  /**
   * Get current development mode status
   */
  getDevMode() {
    const mode = ErrorHandler.getDevMode();
    console.log(`🔧 Dev mode is currently: ${mode ? 'ENABLED' : 'DISABLED'} (from ErrorHandler)`);
    return mode;
  },

  /**
   * View silently stored errors
   */
  async viewErrors() {
    const errors = await getSilentErrors();
    const handlerErrors = await ErrorHandler.getStoredErrors();
    
    console.group('🐛 Stored Errors (Silent Mode)');
    console.log(`📊 Found ${errors.length} console errors and ${handlerErrors.length} handler errors`);
    
    if (errors.length > 0) {
      console.group('Console Errors:');
      errors.forEach((error, index) => {
        console.log(`${index + 1}.`, {
          message: error.message,
          time: new Date(error.timestamp).toLocaleString(),
          stack: error.stack
        });
      });
      console.groupEnd();
    }
    
    if (handlerErrors.length > 0) {
      console.group('Handler Errors:');
      handlerErrors.forEach((error, index) => {
        console.log(`${index + 1}.`, {
          context: error.context,
          message: error.message,
          time: new Date(error.timestamp).toLocaleString(),
          metadata: error.metadata
        });
      });
      console.groupEnd();
    }
    
    console.groupEnd();
    return { console: errors, handler: handlerErrors };
  },

  /**
   * Clear all stored errors
   */
  async clearErrors() {
    await clearSilentErrors();
    await ErrorHandler.clearStoredErrors();
    console.log('🗑️ All stored errors cleared');
  },

  /**
   * Show developer help
   */
  help() {
    console.group('🚀 Browse Buddy Developer Tools');
    console.log('Available commands:');
    console.log('');
    console.log('📝 BrowseBuddyDev.setDevMode(true/false) - Toggle development mode');
    console.log('📊 BrowseBuddyDev.getDevMode() - Check current dev mode status');
    console.log('🐛 BrowseBuddyDev.viewErrors() - View all stored errors');
    console.log('🗑️ BrowseBuddyDev.clearErrors() - Clear stored errors');
    console.log('❓ BrowseBuddyDev.help() - Show this help');
    console.log('');
    console.log('💡 In production mode, console.error is silent but errors are stored for debugging');
    console.log('🔧 Enable dev mode to see all console errors in real-time');
    console.groupEnd();
  },

  /**
   * Test error handling
   */
  testError() {
    console.log('🧪 Testing error handling...');
    console.error('Test error - this should be', ErrorHandler.getDevMode() ? 'visible' : 'silent');
    ErrorHandler.handle('dev_tools_test', new Error('Test error from ErrorHandler'));
    console.log('✅ Test completed. Check stored errors if in production mode.');
  }
};

// Make developer tools globally available
if (typeof window !== 'undefined') {
  window.BrowseBuddyDev = DevTools;
  
  // Show welcome message in dev mode
  if (ErrorHandler.getDevMode()) {
    console.log('🚀 Browse Buddy Developer Tools loaded!');
    console.log('💡 Type BrowseBuddyDev.help() for available commands');
  }
}

export default DevTools; 