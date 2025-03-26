/**
 * Chat Service
 * 
 * Provides functions for managing chat sessions and interactions.
 */

import { sendRequest, processApiResponse } from '../api/openai.js';
import { getSystemPrompt } from '../../shared/prompts/index.js';
import { createUserMessage, createAssistantMessage, createSystemMessage } from '../../shared/models/chat-message.js';
import { createSession, addMessageToSession, getLastUserMessage } from '../../shared/models/session.js';
import * as storageService from './storage-service.js';
import { getTabStorageKey } from '../../shared/utils/url-utils.js';
import { STORAGE_KEYS } from '../../shared/constants.js';

/**
 * Generate a new page load ID
 * 
 * @return {string} A unique ID for the page load
 */
export function generatePageLoadId() {
  return `pageload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new chat session
 * 
 * @param {number} tabId - The tab ID
 * @param {string} url - The URL of the page
 * @param {string} title - The title of the page
 * @param {Object} options - Additional options (optional)
 * @return {Promise<Object>} The created session
 */
export async function createChatSession(tabId, url, title, options = {}) {
  const pageLoadId = generatePageLoadId();
  
  // Store the pageLoadId for this tab/URL combination
  const storageKey = getTabStorageKey(tabId, url);
  await storageService.setValue(storageKey, pageLoadId);
  
  // Get user preferences for default settings
  const preferences = await storageService.getUserPreferences();
  
  // Create the session
  const session = createSession(pageLoadId, url, title, [], {
    isWebSearchEnabled: preferences.webSearch,
    isPageScrapingEnabled: preferences.pageScraping,
    modelName: preferences.defaultModel,
    temperature: preferences.temperature,
    ...options
  });
  
  // Save the session to storage
  await storageService.updateChatSession(pageLoadId, session);
  
  // Add to the chat sessions list
  const sessions = await storageService.getChatSessions();
  sessions.unshift({
    pageLoadId,
    url,
    title: session.title,
    lastUpdated: session.lastUpdated,
    created: session.created
  });
  
  // Save the updated list
  await storageService.setValue(STORAGE_KEYS.CHAT_SESSIONS, sessions);
  
  return session;
}

/**
 * Get a chat session by page load ID
 * 
 * @param {string} pageLoadId - The page load ID
 * @return {Promise<Object|null>} The session or null if not found
 */
export async function getChatSession(pageLoadId) {
  return await storageService.getValue(pageLoadId, null);
}

/**
 * Get the page load ID for a tab
 * 
 * @param {number} tabId - The tab ID
 * @param {string} url - The URL of the page
 * @return {Promise<string|null>} The page load ID or null if not found
 */
export async function getPageLoadId(tabId, url) {
  const storageKey = getTabStorageKey(tabId, url);
  return await storageService.getValue(storageKey, null);
}

/**
 * Add a message to a chat session
 * 
 * @param {string} pageLoadId - The page load ID
 * @param {Object} message - The message to add
 * @return {Promise<Object>} The updated session
 */
export async function addMessage(pageLoadId, message) {
  const session = await getChatSession(pageLoadId);
  if (!session) {
    throw new Error(`Chat session not found: ${pageLoadId}`);
  }
  
  const updatedSession = addMessageToSession(session, message);
  await storageService.setValue(pageLoadId, updatedSession);
  
  // Update the session in the chat sessions list
  const sessions = await storageService.getChatSessions();
  const sessionIndex = sessions.findIndex(s => s.pageLoadId === pageLoadId);
  
  if (sessionIndex !== -1) {
    sessions[sessionIndex].lastUpdated = updatedSession.lastUpdated;
    
    // Move the session to the top of the list
    const updatedSession = sessions.splice(sessionIndex, 1)[0];
    sessions.unshift(updatedSession);
    
    await storageService.setValue(STORAGE_KEYS.CHAT_SESSIONS, sessions);
  }
  
  return updatedSession;
}

/**
 * Handles a chat message from the user, processes it through the API and returns the response
 * 
 * @param {Object} request - The chat request with messages and settings
 * @returns {Promise<Object>} - The chat response with content and metadata
 */
export async function handleChatMessage(request) {
  try {
    console.log('Chat service processing message:', request);
    
    const { messages, apiKey, pageContent } = request;
    if (!messages || !Array.isArray(messages)) {
      throw new Error('Invalid messages provided');
    }
    
    // Get user preferences for API calls
    const userPreferences = await storageService.getUserPreferences();
    
    // Prepare API request options
    const options = {
      apiKey: apiKey,
      messages: messages,
      model: userPreferences.defaultModel || API_CONSTANTS.DEFAULT_MODEL,
      temperature: parseFloat(userPreferences.temperature || API_CONSTANTS.DEFAULT_TEMPERATURE),
      useWebSearch: userPreferences.webSearch || false,
      pageContent: pageContent || ''
    };
    
    // Send request to OpenAI API
    console.log('Sending request to OpenAI API with options:', JSON.stringify({
      ...options,
      apiKey: '***REDACTED***',
      messages: `[${messages.length} messages]`
    }));
    
    const apiResponse = await openaiApi.sendRequest(options);
    console.log('Received response from API:', JSON.stringify(apiResponse).substring(0, 500) + '...');
    
    // Process the API response to extract content
    const processedResponse = openaiApi.processApiResponse(apiResponse);
    
    // Format the final response with assistant message and metadata
    return {
      message: {
        role: 'assistant',
        content: processedResponse.content,
        metadata: processedResponse.metadata || {}
      },
      model: apiResponse.model || options.model,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error in chat service:', error);
    
    // Return an error response that can be displayed to the user
    return {
      message: {
        role: 'assistant',
        content: `I encountered an error: ${error.message}`,
        metadata: { error: true }
      },
      error: true,
      errorMessage: error.message
    };
  }
}

/**
 * Get all chat sessions, optionally filtered by domain
 * 
 * @param {string} domain - Domain to filter by (optional)
 * @return {Promise<Array>} Array of chat session summaries
 */
export async function getAllChatSessions(domain = null) {
  const sessions = await storageService.getChatSessions();
  
  if (!domain) {
    return sessions;
  }
  
  return sessions.filter(session => 
    session.url && 
    new URL(session.url).hostname.includes(domain)
  );
}

/**
 * Delete a chat session
 * 
 * @param {string} pageLoadId - The page load ID to delete
 * @return {Promise<void>}
 */
export async function deleteChatSession(pageLoadId) {
  // Remove the session data
  await storageService.removeValue(pageLoadId);
  
  // Remove from the sessions list
  await storageService.deleteChatSession(pageLoadId);
}

/**
 * Get the last user message for a domain
 * 
 * @param {string} domain - The domain to search for
 * @return {Promise<Object|null>} The last user message or null if not found
 */
export async function getLastUserMessageForDomain(domain) {
  // Get all sessions
  const sessions = await storageService.getChatSessions();
  
  // Filter by domain and sort by lastUpdated (newest first)
  const domainSessions = sessions
    .filter(session => session.url && new URL(session.url).hostname.includes(domain))
    .sort((a, b) => b.lastUpdated - a.lastUpdated);
  
  // If no sessions for this domain, return null
  if (domainSessions.length === 0) {
    return null;
  }
  
  // Get the newest session
  const newestSession = await getChatSession(domainSessions[0].pageLoadId);
  if (!newestSession) {
    return null;
  }
  
  // Get the last user message
  return getLastUserMessage(newestSession);
}

export default {
  generatePageLoadId,
  createChatSession,
  getChatSession,
  getPageLoadId,
  addMessage,
  handleChatMessage,
  getAllChatSessions,
  deleteChatSession,
  getLastUserMessageForDomain
}; 