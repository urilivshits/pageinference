/**
 * Message Handler Service
 * 
 * Manages message passing between extension components (background, content scripts, popup).
 */

import { MESSAGE_TYPES } from '../../shared/constants.js';
import * as chatService from './chat-service.js';
import * as storageService from './storage-service.js';

/**
 * Set up message listeners for handling messages from content scripts and popup
 */
export function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, data } = message;
    
    // Use async handler but make sure we return true to indicate we'll respond asynchronously
    handleMessage(type, data, sender).then(sendResponse).catch(error => {
      console.error('Error handling message:', error);
      sendResponse({
        success: false,
        error: error.message || 'Unknown error'
      });
    });
    
    return true; // Indicates we'll respond asynchronously
  });
  
  console.log('Message listeners set up');
}

/**
 * Handle a message based on its type
 * 
 * @param {string} type - The message type
 * @param {Object} data - The message data
 * @param {Object} sender - The sender information
 * @return {Promise<Object>} The response data
 */
async function handleMessage(type, data, sender) {
  const tabId = sender.tab?.id;
  
  switch (type) {
    // API calls
    case MESSAGE_TYPES.SEND_API_REQUEST:
      return handleSendApiRequest(data);
      
    // Chat sessions
    case MESSAGE_TYPES.CREATE_CHAT_SESSION:
      return handleCreateChatSession(tabId, data);
      
    case MESSAGE_TYPES.GET_CHAT_SESSION:
      return handleGetChatSession(data);
      
    case MESSAGE_TYPES.GET_SESSION_LIST:
      return handleGetSessionList(data);
      
    case MESSAGE_TYPES.DELETE_CHAT_SESSION:
      return handleDeleteChatSession(data);
      
    case MESSAGE_TYPES.SEND_USER_MESSAGE:
      return handleSendUserMessage(data);
      
    // Settings
    case MESSAGE_TYPES.GET_USER_PREFERENCES:
      return handleGetUserPreferences();
      
    case MESSAGE_TYPES.UPDATE_USER_PREFERENCES:
      return handleUpdateUserPreferences(data);
      
    case MESSAGE_TYPES.GET_API_KEY:
      return handleGetApiKey();
      
    case MESSAGE_TYPES.SET_API_KEY:
      return handleSetApiKey(data);
      
    // Debug
    case MESSAGE_TYPES.LOG_DEBUG_INFO:
      return handleLogDebugInfo(data);
      
    case MESSAGE_TYPES.GET_DEBUG_LOGS:
      return handleGetDebugLogs();
      
    case MESSAGE_TYPES.CLEAR_DEBUG_LOGS:
      return handleClearDebugLogs();
      
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

// API request handling
async function handleSendApiRequest(data) {
  const { apiKey, messages, model, temperature, useWebSearch, extraParams } = data;
  
  try {
    const result = await chatService.sendApiRequest(
      apiKey, 
      messages, 
      model, 
      temperature, 
      useWebSearch, 
      extraParams
    );
    
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Chat session handling
async function handleCreateChatSession(tabId, data) {
  try {
    const { url, title, options } = data;
    const session = await chatService.createChatSession(tabId, url, title, options);
    return { success: true, data: session };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleGetChatSession(data) {
  try {
    const { pageLoadId } = data;
    const session = await chatService.getChatSession(pageLoadId);
    return { success: true, data: session };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleGetSessionList(data) {
  try {
    const { domain } = data;
    const sessions = await chatService.getAllChatSessions(domain);
    return { success: true, data: sessions };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleDeleteChatSession(data) {
  try {
    const { pageLoadId } = data;
    await chatService.deleteChatSession(pageLoadId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleSendUserMessage(data) {
  try {
    const { pageLoadId, message, pageContent, options } = data;
    const updatedSession = await chatService.sendMessage(
      pageLoadId, 
      message, 
      pageContent, 
      options
    );
    return { success: true, data: updatedSession };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Settings handling
async function handleGetUserPreferences() {
  try {
    const preferences = await storageService.getUserPreferences();
    return { success: true, data: preferences };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleUpdateUserPreferences(data) {
  try {
    const updatedPreferences = await storageService.updateUserPreferences(data);
    return { success: true, data: updatedPreferences };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleGetApiKey() {
  try {
    const apiKey = await storageService.getApiKey();
    return { success: true, data: apiKey };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleSetApiKey(data) {
  try {
    const { apiKey } = data;
    await storageService.setApiKey(apiKey);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Debug handling
async function handleLogDebugInfo(data) {
  try {
    await storageService.storeDebugLog(data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleGetDebugLogs() {
  try {
    const logs = await storageService.getDebugLogs();
    return { success: true, data: logs };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleClearDebugLogs() {
  try {
    await storageService.clearDebugLogs();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default {
  setupMessageListeners
}; 