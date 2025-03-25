/**
 * Services Index
 * 
 * Exports all background services from a central location for easier imports.
 */

import * as storageService from './storage-service.js';
import * as chatService from './chat-service.js';

// Re-export all individual exports
export { storageService, chatService };

// Default export with all services
export default {
  storageService,
  chatService
}; 