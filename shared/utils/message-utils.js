/**
 * Message Utilities
 * 
 * Helpers for structured message passing between popup, background, and content scripts.
 */

import { ACTION_TYPES } from '../constants.js';

/**
 * Send a message to the background script and get a response
 * 
 * @param {Object} message - Message object to send
 * @return {Promise<any>} Response from the background script
 */
export function sendToBackground(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, response => {
        // Check for chrome runtime errors
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(response);
      });
    } catch (error) {
      console.error('Error sending message to background:', error);
      reject(error);
    }
  });
}

/**
 * Send a message to the active tab's content script and get a response
 * 
 * @param {Object} message - Message object to send
 * @param {number} tabId - ID of tab to send message to (optional, defaults to active tab)
 * @return {Promise<any>} Response from the content script
 */
export async function sendToContent(message, tabId = null) {
  // If no tabId is provided, get the active tab
  if (tabId === null) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs[0]) {
      throw new Error('No active tab found');
    }
    tabId = tabs[0].id;
  }
  
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, message, response => {
        // Check for chrome runtime errors
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(response);
      });
    } catch (error) {
      console.error('Error sending message to content script:', error);
      reject(error);
    }
  });
}

/**
 * Create a standard message object with action type
 * 
 * @param {string} action - Action type from ACTION_TYPES
 * @param {Object} data - Data to include in the message
 * @return {Object} Formatted message object
 */
export function createMessage(action, data = {}) {
  return {
    action,
    ...data,
    timestamp: Date.now()
  };
}

/**
 * Helper to request content scraping from the active tab
 * 
 * @param {number} tabId - ID of tab to scrape content from
 * @return {Promise<string>} The scraped page content
 */
export async function scrapePageContent(tabId) {
  try {
    const response = await sendToContent(
      createMessage(ACTION_TYPES.CONTENT.SCRAPE_CONTENT),
      tabId
    );
    
    if (response && response.content) {
      return response.content;
    }
    
    if (response && response.error) {
      throw new Error(response.error);
    }
    
    throw new Error('No content received from page');
  } catch (error) {
    console.error('Error scraping page content:', error);
    throw error;
  }
}

/**
 * Initialize content script in a tab if not already running
 * 
 * @param {number} tabId - ID of tab to initialize content script in
 * @return {Promise<boolean>} True if initialization was successful
 */
export async function ensureContentScriptInitialized(tabId) {
  try {
    // First try to ping the content script
    await sendToContent(
      createMessage('ping'),
      tabId
    );
    
    // If we get here, the content script is already initialized
    return true;
  } catch (error) {
    // If the ping failed, the content script may not be initialized
    // Try to inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content.js']
      });
      
      // Wait a bit for initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try to ping again
      try {
        await sendToContent(
          createMessage('ping'),
          tabId
        );
        return true;
      } catch (secondError) {
        console.error('Content script still not responding after injection', secondError);
        return false;
      }
    } catch (injectionError) {
      console.error('Failed to inject content script', injectionError);
      return false;
    }
  }
}

export default {
  sendToBackground,
  sendToContent,
  createMessage,
  scrapePageContent,
  ensureContentScriptInitialized
}; 