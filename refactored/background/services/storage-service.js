/**
 * Storage Service
 * 
 * Provides functions for interacting with Chrome extension storage.
 */

import { STORAGE_KEYS } from '../../shared/constants.js';
import { validateSettings, DEFAULT_SETTINGS } from '../../shared/models/settings.js';

/**
 * Get a value from storage
 * 
 * @param {string} key - The key to get
 * @param {*} defaultValue - The default value if key doesn't exist
 * @return {Promise<*>} The value or defaultValue if not found
 */
export function getValue(key, defaultValue = null) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(key in result ? result[key] : defaultValue);
    });
  });
}

/**
 * Set a value in storage
 * 
 * @param {string} key - The key to set
 * @param {*} value - The value to store
 * @return {Promise<void>}
 */
export function setValue(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

/**
 * Remove a value from storage
 * 
 * @param {string} key - The key to remove
 * @return {Promise<void>}
 */
export function removeValue(key) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(key, resolve);
  });
}

/**
 * Get multiple values from storage
 * 
 * @param {Array<string>} keys - The keys to get
 * @return {Promise<Object>} Object containing the requested values
 */
export function getMultipleValues(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

/**
 * Set multiple values in storage
 * 
 * @param {Object} items - Object with key/value pairs to set
 * @return {Promise<void>}
 */
export function setMultipleValues(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, resolve);
  });
}

/**
 * Get the API key from storage
 * 
 * @return {Promise<string|null>} The API key or null if not found
 */
export function getApiKey() {
  return getValue(STORAGE_KEYS.API_KEY);
}

/**
 * Set the API key in storage
 * 
 * @param {string} apiKey - The API key to store
 * @return {Promise<void>}
 */
export function setApiKey(apiKey) {
  return setValue(STORAGE_KEYS.API_KEY, apiKey);
}

/**
 * Get the user preferences from storage
 * 
 * @return {Promise<Object>} The user preferences
 */
export async function getUserPreferences() {
  const defaultPreferences = DEFAULT_SETTINGS;
  
  // Get current preferences from local storage
  const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PREFERENCES);
  const rawPreferences = result[STORAGE_KEYS.USER_PREFERENCES] || {};
  
  // If preferences don't exist, initialize with defaults
  if (Object.keys(rawPreferences).length === 0) {
    await chrome.storage.local.set({ [STORAGE_KEYS.USER_PREFERENCES]: defaultPreferences });
    return validateSettings(defaultPreferences);
  }
  
  // Check for missing properties and provide defaults
  const updatedPreferences = { ...defaultPreferences };
  
  // Only use known values for each property
  Object.keys(defaultPreferences).forEach(key => {
    if (key in rawPreferences) {
      updatedPreferences[key] = rawPreferences[key];
    }
  });
  
  // If any missing properties were found, update storage
  if (Object.keys(updatedPreferences).some(key => !(key in rawPreferences))) {
    await chrome.storage.local.set({ [STORAGE_KEYS.USER_PREFERENCES]: updatedPreferences });
  }
  
  return validateSettings(updatedPreferences);
}

/**
 * Update user preferences in storage
 * 
 * @param {Object} preferences - The preferences to update
 * @return {Promise<Object>} The updated preferences
 */
export async function updateUserPreferences(preferences) {
  // Get current preferences
  const currentPreferences = await getUserPreferences();
  
  // Merge with new preferences
  const updatedPreferences = {
    ...currentPreferences,
    ...preferences
  };
  
  // Validate the preferences
  const validatedPreferences = validateSettings(updatedPreferences);
  
  // Save to storage
  await setValue(STORAGE_KEYS.USER_PREFERENCES, validatedPreferences);
  
  return validatedPreferences;
}

/**
 * Get all chat sessions
 * 
 * @return {Promise<Array>} Array of chat session summaries
 */
export async function getChatSessions() {
  const sessions = await getValue(STORAGE_KEYS.CHAT_SESSIONS, []);
  return Array.isArray(sessions) ? sessions : [];
}

/**
 * Update a chat session
 * 
 * @param {string} pageLoadId - The page load ID
 * @param {Object} sessionData - The session data to save
 * @return {Promise<void>}
 */
export function updateChatSession(pageLoadId, sessionData) {
  return setValue(pageLoadId, sessionData);
}

/**
 * Delete a chat session from the sessions list
 * 
 * @param {string} pageLoadId - The page load ID to delete
 * @return {Promise<void>}
 */
export async function deleteChatSession(pageLoadId) {
  const sessions = await getChatSessions();
  const filteredSessions = sessions.filter(s => s.pageLoadId !== pageLoadId);
  
  // Update the sessions list
  await setValue(STORAGE_KEYS.CHAT_SESSIONS, filteredSessions);
}

/**
 * Clear all chat sessions and their data
 * 
 * @return {Promise<void>}
 */
export async function clearAllChatSessions() {
  // Get all sessions
  const sessions = await getChatSessions();
  
  // Create an array of promises to remove each session
  const deletePromises = sessions.map(session => 
    removeValue(session.pageLoadId)
  );
  
  // Wait for all deletions to complete
  await Promise.all(deletePromises);
  
  // Clear the sessions list
  await setValue(STORAGE_KEYS.CHAT_SESSIONS, []);
}

/**
 * Store a debug log entry
 * 
 * @param {Object} logEntry - The log entry to store
 * @return {Promise<void>}
 */
export async function storeDebugLog(logEntry) {
  // Ensure the log entry has a timestamp
  if (!logEntry.timestamp) {
    logEntry.timestamp = Date.now();
  }
  
  // Get current logs
  const logs = await getValue(STORAGE_KEYS.DEBUG_LOGS, []);
  
  // Add new log entry
  logs.push(logEntry);
  
  // Keep only the latest 100 entries
  const trimmedLogs = logs.slice(-100);
  
  // Save to storage
  await setValue(STORAGE_KEYS.DEBUG_LOGS, trimmedLogs);
}

/**
 * Get all debug logs
 * 
 * @return {Promise<Array>} Array of debug log entries
 */
export function getDebugLogs() {
  return getValue(STORAGE_KEYS.DEBUG_LOGS, []);
}

/**
 * Clear all debug logs
 * 
 * @return {Promise<void>}
 */
export function clearDebugLogs() {
  return setValue(STORAGE_KEYS.DEBUG_LOGS, []);
}

export default {
  getValue,
  setValue,
  removeValue,
  getMultipleValues,
  setMultipleValues,
  getApiKey,
  setApiKey,
  getUserPreferences,
  updateUserPreferences,
  getChatSessions,
  updateChatSession,
  deleteChatSession,
  clearAllChatSessions,
  storeDebugLog,
  getDebugLogs,
  clearDebugLogs
}; 