/**
 * Storage Service
 * 
 * Provides a unified API for storing and retrieving data from Chrome storage.
 * Abstracts the details of chrome.storage to provide a simpler interface.
 */

import { STORAGE_KEYS } from '../../shared/constants.js';

/**
 * Set a value in storage
 * 
 * @param {string} key - The key to store the value under
 * @param {any} value - The value to store
 * @param {string} storageArea - The storage area to use ('local' or 'sync', defaults to 'local')
 * @return {Promise<void>} Promise that resolves when the value is stored
 */
export async function setValue(key, value, storageArea = 'local') {
  const storage = storageArea === 'sync' ? chrome.storage.sync : chrome.storage.local;
  return new Promise((resolve, reject) => {
    try {
      storage.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        console.log(`Stored ${key} in ${storageArea} storage`);
        resolve();
      });
    } catch (error) {
      console.error('Error storing value:', error);
      reject(error);
    }
  });
}

/**
 * Get a value from storage
 * 
 * @param {string} key - The key to retrieve
 * @param {any} defaultValue - The default value to return if the key doesn't exist
 * @param {string} storageArea - The storage area to use ('local' or 'sync', defaults to 'local')
 * @return {Promise<any>} Promise that resolves with the retrieved value
 */
export async function getValue(key, defaultValue = null, storageArea = 'local') {
  const storage = storageArea === 'sync' ? chrome.storage.sync : chrome.storage.local;
  return new Promise((resolve, reject) => {
    try {
      storage.get(key, result => {
        if (chrome.runtime.lastError) {
          console.error('Storage error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        const value = result[key] !== undefined ? result[key] : defaultValue;
        resolve(value);
      });
    } catch (error) {
      console.error('Error retrieving value:', error);
      reject(error);
    }
  });
}

/**
 * Remove a key from storage
 * 
 * @param {string} key - The key to remove
 * @param {string} storageArea - The storage area to use ('local' or 'sync', defaults to 'local')
 * @return {Promise<void>} Promise that resolves when the key is removed
 */
export async function removeValue(key, storageArea = 'local') {
  const storage = storageArea === 'sync' ? chrome.storage.sync : chrome.storage.local;
  return new Promise((resolve, reject) => {
    try {
      storage.remove(key, () => {
        if (chrome.runtime.lastError) {
          console.error('Storage error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        console.log(`Removed ${key} from ${storageArea} storage`);
        resolve();
      });
    } catch (error) {
      console.error('Error removing value:', error);
      reject(error);
    }
  });
}

/**
 * Get all values from storage
 * 
 * @param {string} storageArea - The storage area to use ('local' or 'sync', defaults to 'local')
 * @return {Promise<Object>} Promise that resolves with all values in storage
 */
export async function getAllValues(storageArea = 'local') {
  const storage = storageArea === 'sync' ? chrome.storage.sync : chrome.storage.local;
  return new Promise((resolve, reject) => {
    try {
      storage.get(null, result => {
        if (chrome.runtime.lastError) {
          console.error('Storage error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(result);
      });
    } catch (error) {
      console.error('Error retrieving all values:', error);
      reject(error);
    }
  });
}

/**
 * Clear all values from storage
 * 
 * @param {string} storageArea - The storage area to use ('local' or 'sync', defaults to 'local')
 * @return {Promise<void>} Promise that resolves when storage is cleared
 */
export async function clearStorage(storageArea = 'local') {
  const storage = storageArea === 'sync' ? chrome.storage.sync : chrome.storage.local;
  return new Promise((resolve, reject) => {
    try {
      storage.clear(() => {
        if (chrome.runtime.lastError) {
          console.error('Storage error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        console.log(`Cleared ${storageArea} storage`);
        resolve();
      });
    } catch (error) {
      console.error('Error clearing storage:', error);
      reject(error);
    }
  });
}

// Specific storage functions for common operations

/**
 * Get the OpenAI API key
 * 
 * @return {Promise<string|null>} Promise that resolves with the API key or null if not set
 */
export async function getApiKey() {
  return getValue(STORAGE_KEYS.API_KEY, null, 'sync');
}

/**
 * Set the OpenAI API key
 * 
 * @param {string} apiKey - The API key to store
 * @return {Promise<void>} Promise that resolves when the API key is stored
 */
export async function setApiKey(apiKey) {
  return setValue(STORAGE_KEYS.API_KEY, apiKey, 'sync');
}

/**
 * Get all chat sessions
 * 
 * @return {Promise<Array>} Promise that resolves with an array of chat sessions
 */
export async function getChatSessions() {
  return getValue(STORAGE_KEYS.CHAT_SESSIONS, []);
}

/**
 * Update a chat session
 * 
 * @param {string} pageLoadId - The page load ID of the session to update
 * @param {Object} sessionData - The updated session data
 * @return {Promise<void>} Promise that resolves when the session is updated
 */
export async function updateChatSession(pageLoadId, sessionData) {
  const sessions = await getChatSessions();
  const sessionIndex = sessions.findIndex(s => s.pageLoadId === pageLoadId);
  
  if (sessionIndex !== -1) {
    // Update existing session
    sessions[sessionIndex] = {
      ...sessions[sessionIndex],
      ...sessionData,
      lastUpdated: Date.now()
    };
  } else {
    // Add new session
    sessions.push({
      pageLoadId,
      ...sessionData,
      created: Date.now(),
      lastUpdated: Date.now()
    });
  }
  
  return setValue(STORAGE_KEYS.CHAT_SESSIONS, sessions);
}

/**
 * Delete a chat session
 * 
 * @param {string} pageLoadId - The page load ID of the session to delete
 * @return {Promise<void>} Promise that resolves when the session is deleted
 */
export async function deleteChatSession(pageLoadId) {
  const sessions = await getChatSessions();
  const updatedSessions = sessions.filter(s => s.pageLoadId !== pageLoadId);
  
  return setValue(STORAGE_KEYS.CHAT_SESSIONS, updatedSessions);
}

/**
 * Get user preferences
 * 
 * @return {Promise<Object>} Promise that resolves with user preferences
 */
export async function getUserPreferences() {
  const [theme, temperature, pageScraping, webSearch, currentSiteFilter, defaultModel] = await Promise.all([
    getValue(STORAGE_KEYS.THEME, 'light'),
    getValue(STORAGE_KEYS.TEMPERATURE, 0.7),
    getValue(STORAGE_KEYS.PAGE_SCRAPING_ENABLED, true),
    getValue(STORAGE_KEYS.WEB_SEARCH_ENABLED, true),
    getValue(STORAGE_KEYS.CURRENT_SITE_FILTER, true),
    getValue(STORAGE_KEYS.DEFAULT_MODEL, 'gpt-4o-mini')
  ]);
  
  return {
    theme,
    temperature,
    pageScraping,
    webSearch,
    currentSiteFilter,
    defaultModel
  };
}

/**
 * Set user preferences
 * 
 * @param {Object} preferences - Object containing preferences to update
 * @return {Promise<void>} Promise that resolves when preferences are updated
 */
export async function setUserPreferences(preferences) {
  const updates = [];
  
  if (preferences.theme !== undefined) {
    updates.push(setValue(STORAGE_KEYS.THEME, preferences.theme));
  }
  
  if (preferences.temperature !== undefined) {
    updates.push(setValue(STORAGE_KEYS.TEMPERATURE, preferences.temperature));
  }
  
  if (preferences.pageScraping !== undefined) {
    updates.push(setValue(STORAGE_KEYS.PAGE_SCRAPING_ENABLED, preferences.pageScraping));
  }
  
  if (preferences.webSearch !== undefined) {
    updates.push(setValue(STORAGE_KEYS.WEB_SEARCH_ENABLED, preferences.webSearch));
  }
  
  if (preferences.currentSiteFilter !== undefined) {
    updates.push(setValue(STORAGE_KEYS.CURRENT_SITE_FILTER, preferences.currentSiteFilter));
  }
  
  if (preferences.defaultModel !== undefined) {
    updates.push(setValue(STORAGE_KEYS.DEFAULT_MODEL, preferences.defaultModel));
  }
  
  await Promise.all(updates);
}

export default {
  setValue,
  getValue,
  removeValue,
  getAllValues,
  clearStorage,
  getApiKey,
  setApiKey,
  getChatSessions,
  updateChatSession,
  deleteChatSession,
  getUserPreferences,
  setUserPreferences
}; 