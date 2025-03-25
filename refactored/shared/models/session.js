/**
 * Session Model
 * 
 * Provides functions for creating and managing chat sessions.
 */

import { createSystemMessage } from './chat-message.js';
import { getSystemPrompt } from '../prompts/index.js';
import { getDomain, getTitleFromUrl } from '../utils/url-utils.js';
import { API_CONSTANTS } from '../constants.js';

/**
 * Create a new chat session
 * 
 * @param {string} pageLoadId - The unique ID for this page load
 * @param {string} url - The URL of the page
 * @param {string} title - The title of the page (optional)
 * @param {Array} messages - Initial messages (optional)
 * @param {Object} metadata - Additional metadata for the session (optional)
 * @return {Object} The created session
 */
export function createSession(pageLoadId, url, title, messages = [], metadata = {}) {
  if (!pageLoadId) {
    throw new Error('pageLoadId is required');
  }
  
  if (!url) {
    throw new Error('url is required');
  }
  
  // If no title provided, generate one from URL
  const sessionTitle = title || getTitleFromUrl(url);
  const domain = getDomain(url) || '';
  
  // If no messages provided, add a default system message
  const initialMessages = messages.length > 0 
    ? [...messages] 
    : [createSystemMessage(getSystemPrompt(url, true, false))];
  
  // Set default session settings
  const sessionSettings = {
    modelName: metadata.modelName || API_CONSTANTS.DEFAULT_MODEL,
    temperature: metadata.temperature || API_CONSTANTS.DEFAULT_TEMPERATURE,
    isPageScrapingEnabled: metadata.isPageScrapingEnabled !== undefined 
      ? metadata.isPageScrapingEnabled 
      : true,
    isWebSearchEnabled: metadata.isWebSearchEnabled !== undefined 
      ? metadata.isWebSearchEnabled 
      : false
  };
  
  // Extract specific settings from metadata
  const { modelName, temperature, isPageScrapingEnabled, isWebSearchEnabled, ...otherMetadata } = metadata;
  
  // Create timestamp for creation and last update
  const timestamp = Date.now();
  
  return {
    pageLoadId,
    url,
    title: sessionTitle,
    messages: initialMessages,
    created: timestamp,
    lastUpdated: timestamp,
    ...sessionSettings,
    metadata: otherMetadata
  };
}

/**
 * Add a message to a session
 * 
 * @param {Object} session - The session to add the message to
 * @param {Object} message - The message to add
 * @return {Object} The updated session
 */
export function addMessageToSession(session, message) {
  if (!session) {
    throw new Error('session is required');
  }
  
  if (!message) {
    throw new Error('message is required');
  }
  
  return {
    ...session,
    messages: [...session.messages, message],
    lastUpdated: Date.now()
  };
}

/**
 * Get the last user message from a session
 * 
 * @param {Object} session - The session to get the message from
 * @return {Object|null} The last user message or null if not found
 */
export function getLastUserMessage(session) {
  if (!session || !session.messages || !Array.isArray(session.messages)) {
    return null;
  }
  
  // Get all user messages
  const userMessages = session.messages.filter(m => m.role === 'user');
  
  // Return the last one or null if none found
  return userMessages.length > 0 
    ? userMessages[userMessages.length - 1] 
    : null;
}

/**
 * Update session settings
 * 
 * @param {Object} session - The session to update
 * @param {Object} settings - The new settings
 * @return {Object} The updated session
 */
export function updateSessionSettings(session, settings) {
  if (!session) {
    throw new Error('session is required');
  }
  
  return {
    ...session,
    ...(settings.modelName && { modelName: settings.modelName }),
    ...(settings.temperature !== undefined && { temperature: settings.temperature }),
    ...(settings.isPageScrapingEnabled !== undefined && { isPageScrapingEnabled: settings.isPageScrapingEnabled }),
    ...(settings.isWebSearchEnabled !== undefined && { isWebSearchEnabled: settings.isWebSearchEnabled }),
    lastUpdated: Date.now()
  };
}

/**
 * Create a session summary for display
 * 
 * @param {Object} session - The session to summarize
 * @param {number} previewLength - Maximum length of message preview (default: 50)
 * @return {Object} The session summary
 */
export function createSessionSummary(session, previewLength = 50) {
  if (!session) {
    throw new Error('session is required');
  }
  
  const lastUserMessage = getLastUserMessage(session);
  let messagePreview = '';
  
  if (lastUserMessage) {
    messagePreview = lastUserMessage.content.length > previewLength
      ? `${lastUserMessage.content.substring(0, previewLength)}...`
      : lastUserMessage.content;
  }
  
  return {
    pageLoadId: session.pageLoadId,
    url: session.url,
    title: session.title,
    domain: getDomain(session.url) || '',
    lastUpdated: session.lastUpdated,
    created: session.created,
    messageCount: session.messages.length,
    lastMessagePreview: messagePreview
  };
}

export default {
  createSession,
  addMessageToSession,
  getLastUserMessage,
  updateSessionSettings,
  createSessionSummary
}; 