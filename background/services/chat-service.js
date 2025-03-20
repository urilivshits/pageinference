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
 * Send a user message and get an AI response
 * 
 * @param {string} pageLoadId - The page load ID
 * @param {string} userMessage - The user message
 * @param {string} pageContent - The page content (optional)
 * @param {Object} options - Additional options (optional)
 * @return {Promise<Object>} The updated session with AI response
 */
export async function sendMessage(pageLoadId, userMessage, pageContent = null, options = {}) {
  // Get the session
  let session = await getChatSession(pageLoadId);
  if (!session) {
    throw new Error(`Chat session not found: ${pageLoadId}`);
  }
  
  // Add the user message
  const userMessageObj = createUserMessage(userMessage);
  session = await addMessage(pageLoadId, userMessageObj);
  
  // Get API key
  const apiKey = await storageService.getApiKey();
  if (!apiKey) {
    throw new Error('API key not found');
  }
  
  // Get appropriate system message based on session settings
  const useWebSearch = session.isWebSearchEnabled;
  const usePageContent = session.isPageScrapingEnabled && pageContent;
  const systemPrompt = getSystemPrompt(
    session.url, 
    usePageContent, 
    useWebSearch
  );
  
  // Replace system message if it exists, or add a new one
  const messages = [...session.messages];
  const systemIndex = messages.findIndex(m => m.role === 'system');
  
  if (systemIndex !== -1) {
    messages[systemIndex] = createSystemMessage(systemPrompt);
  } else {
    messages.unshift(createSystemMessage(systemPrompt));
  }
  
  // Add page content as a system message if available
  if (usePageContent && pageContent) {
    const contentMessage = createSystemMessage(
      `Here is the content of the web page: ${pageContent}`
    );
    messages.push(contentMessage);
  }
  
  // Send the request to OpenAI
  try {
    const apiResponse = await sendRequest({
      apiKey,
      messages: messages,
      model: session.modelName,
      temperature: session.temperature,
      useWebSearch: useWebSearch,
      extraParams: options.extraParams || {}
    });
    
    // Process the response
    const processedResponse = processApiResponse(apiResponse);
    
    // Create the assistant message
    const assistantMessage = createAssistantMessage(
      processedResponse.content,
      {
        sources: processedResponse.sources,
        model: processedResponse.model,
        usage: processedResponse.usage
      }
    );
    
    // Add the assistant message to the session
    session = await addMessage(pageLoadId, assistantMessage);
    
    return session;
  } catch (error) {
    console.error('Error sending message:', error);
    
    // Add an error message to the session
    const errorMessage = createAssistantMessage(
      `Error: ${error.message}`,
      { error: true }
    );
    
    session = await addMessage(pageLoadId, errorMessage);
    
    throw error;
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
  sendMessage,
  getAllChatSessions,
  deleteChatSession,
  getLastUserMessageForDomain
}; 