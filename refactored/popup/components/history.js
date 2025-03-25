/**
 * History Component
 * 
 * Displays past chat sessions and allows the user to manage them.
 */

import { MESSAGE_TYPES, UI_CONSTANTS } from '../../shared/constants.js';

// DOM elements
let historyContainer;
let sessionsList;
let noSessionsMessage;
let filterInput;
let domainFilterToggle;

// History state
let allSessions = [];
let currentDomain = null;
let filteringByCurrentDomain = false;

// Add session cleanup state
let cleanupState = {
  lastCleanup: 0,
  cleanupInterval: 60000, // 1 minute
  isCleanupRunning: false
};

// Add session state persistence
let persistentState = {
  filterText: '',
  filterByDomain: true,
  lastDomain: null,
  lastUpdate: 0
};

/**
 * Initialize the history component
 */
export function initializeHistoryComponent() {
  // Get DOM elements
  historyContainer = document.getElementById('history-container');
  sessionsList = document.getElementById('sessions-list');
  noSessionsMessage = document.getElementById('no-sessions-message');
  filterInput = document.getElementById('filter-input');
  domainFilterToggle = document.getElementById('domain-filter-toggle');
  
  // Add event listeners
  setupEventListeners();
  
  // Load persistent state
  loadPersistentState();
  
  // Get current tab domain
  getCurrentDomain().then(() => {
    // Load sessions
    loadSessions();
  });
  
  // Clean up empty conversations periodically
  setInterval(() => {
    const now = Date.now();
    if (now - cleanupState.lastCleanup >= cleanupState.cleanupInterval) {
      removeEmptyConversations();
      cleanupState.lastCleanup = now;
    }
  }, cleanupState.cleanupInterval);
}

/**
 * Load persistent state from storage
 */
async function loadPersistentState() {
  try {
    const { historyState } = await chrome.storage.local.get('historyState');
    if (historyState) {
      persistentState = { ...persistentState, ...historyState };
      
      // Apply saved state
      filterInput.value = persistentState.filterText;
      domainFilterToggle.checked = persistentState.filterByDomain;
      filteringByCurrentDomain = persistentState.filterByDomain;
    }
  } catch (error) {
    console.error('Error loading persistent state:', error);
  }
}

/**
 * Save persistent state to storage
 */
async function savePersistentState() {
  try {
    await chrome.storage.local.set({
      historyState: {
        filterText: persistentState.filterText,
        filterByDomain: persistentState.filterByDomain,
        lastDomain: persistentState.lastDomain,
        lastUpdate: Date.now()
      }
    });
  } catch (error) {
    console.error('Error saving persistent state:', error);
  }
}

/**
 * Set up event listeners for history interactions
 */
function setupEventListeners() {
  // Filter by text
  filterInput.addEventListener('input', () => {
    persistentState.filterText = filterInput.value;
    filterSessions(filterInput.value.toLowerCase());
    savePersistentState();
  });
  
  // Filter by current domain
  domainFilterToggle.addEventListener('change', () => {
    filteringByCurrentDomain = domainFilterToggle.checked;
    persistentState.filterByDomain = filteringByCurrentDomain;
    savePersistentState();
    loadSessions();
  });
  
  // Listen for session updates from chat component
  window.addEventListener('chat-session-updated', (event) => {
    const { session } = event.detail;
    updateSession(session);
  });
}

/**
 * Get the domain of the current tab
 */
async function getCurrentDomain() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = new URL(tab.url);
      currentDomain = url.hostname;
      
      // Update the domain filter label
      const domainLabel = document.getElementById('domain-filter-label');
      if (domainLabel) {
        domainLabel.textContent = `Only show ${currentDomain}`;
      }
    }
  } catch (error) {
    console.error('Error getting current domain:', error);
  }
}

/**
 * Load chat sessions from storage
 */
async function loadSessions() {
  try {
    // Clear the sessions list
    sessionsList.innerHTML = '';
    
    // Show loading state
    noSessionsMessage.textContent = 'Loading sessions...';
    noSessionsMessage.style.display = 'block';
    
    // Get sessions
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_SESSION_LIST,
      data: {
        domain: filteringByCurrentDomain ? currentDomain : null
      }
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to load sessions');
    }
    
    allSessions = response.data || [];
    
    // Sort sessions by last updated time
    allSessions.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    
    // Show message if no sessions
    if (allSessions.length === 0) {
      noSessionsMessage.textContent = 'No chat sessions found';
      noSessionsMessage.style.display = 'block';
      return;
    }
    
    // Hide no sessions message
    noSessionsMessage.style.display = 'none';
    
    // Apply current filter if any
    if (filterInput.value) {
      filterSessions(filterInput.value.toLowerCase());
    } else {
      renderSessions(allSessions);
    }
  } catch (error) {
    console.error('Error loading sessions:', error);
    noSessionsMessage.textContent = `Error: ${error.message}`;
    noSessionsMessage.style.display = 'block';
  }
}

/**
 * Render sessions in the list
 * 
 * @param {Array} sessions - Array of session objects
 */
function renderSessions(sessions) {
  // Clear the list
  sessionsList.innerHTML = '';
  
  // Add each session
  sessions.forEach(session => {
    const sessionElement = createSessionElement(session);
    sessionsList.appendChild(sessionElement);
  });
}

/**
 * Get the base domain from a URL
 * 
 * @param {string} url - The URL to extract domain from
 * @returns {string} - The base domain
 */
function getBaseDomain(url) {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.hostname.split('.');
    if (parts.length > 2) {
      // Handle cases like sub.example.com
      return parts.slice(-2).join('.');
    }
    return urlObj.hostname;
  } catch (error) {
    console.error('Error getting base domain:', error);
    return url;
  }
}

/**
 * Update a single session in the list
 */
async function updateSession(session) {
  try {
    // Find the session in the current list
    const index = allSessions.findIndex(s => s.pageLoadId === session.pageLoadId);
    
    if (index !== -1) {
      // Update existing session
      allSessions[index] = session;
    } else {
      // Add new session
      allSessions.unshift(session);
    }
    
    // Sort sessions
    allSessions.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    
    // Update display
    if (filterInput.value) {
      filterSessions(filterInput.value.toLowerCase());
    } else {
      renderSessions(allSessions);
    }
    
    // Update persistent state
    persistentState.lastUpdate = Date.now();
    savePersistentState();
  } catch (error) {
    console.error('Error updating session:', error);
  }
}

/**
 * Remove empty conversations from storage
 */
async function removeEmptyConversations(excludePageLoadId = null) {
  // Prevent concurrent cleanup
  if (cleanupState.isCleanupRunning) {
    return;
  }
  
  try {
    cleanupState.isCleanupRunning = true;
    
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_SESSION_LIST
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to get sessions');
    }
    
    const sessions = response.data || [];
    const emptySessionIds = sessions
      .filter(session => 
        session.pageLoadId !== excludePageLoadId && 
        (!session.messages || session.messages.length === 0) &&
        // Only remove sessions older than 5 minutes
        (Date.now() - new Date(session.lastUpdated).getTime() > 300000)
      )
      .map(session => session.pageLoadId);
    
    if (emptySessionIds.length > 0) {
      console.log('Removing empty sessions:', emptySessionIds);
      
      for (const pageLoadId of emptySessionIds) {
        await chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.DELETE_CHAT_SESSION,
          data: { pageLoadId }
        });
      }
      
      // Reload sessions if any were removed
      loadSessions();
    }
  } catch (error) {
    console.error('Error removing empty conversations:', error);
  } finally {
    cleanupState.isCleanupRunning = false;
    cleanupState.lastCleanup = Date.now();
  }
}

/**
 * Create a DOM element for a session
 * 
 * @param {Object} session - Session object
 * @returns {HTMLElement} - Session list item element
 */
function createSessionElement(session) {
  const { pageLoadId, title, url, lastUpdated, messages } = session;
  
  // Create list item
  const listItem = document.createElement('li');
  listItem.classList.add('session-item');
  
  // Create session info div
  const sessionInfo = document.createElement('div');
  sessionInfo.classList.add('session-info');
  
  // Add title
  const titleElement = document.createElement('div');
  titleElement.classList.add('session-title');
  titleElement.textContent = title || 'Untitled session';
  sessionInfo.appendChild(titleElement);
  
  // Add URL with base domain
  if (url) {
    const urlElement = document.createElement('div');
    urlElement.classList.add('session-url');
    
    try {
      const urlObj = new URL(url);
      const baseDomain = getBaseDomain(url);
      const path = urlObj.pathname === '/' ? '' : urlObj.pathname;
      urlElement.textContent = baseDomain + path;
      urlElement.title = url; // Full URL on hover
    } catch (e) {
      urlElement.textContent = url;
    }
    
    sessionInfo.appendChild(urlElement);
  }
  
  // Add date with smart formatting
  if (lastUpdated) {
    const dateElement = document.createElement('div');
    dateElement.classList.add('session-date');
    
    const date = new Date(lastUpdated);
    const now = new Date();
    let dateText;
    
    if (date.toDateString() === now.toDateString()) {
      // Today - show time only
      dateText = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } else if (date.getFullYear() === now.getFullYear()) {
      // This year - show month and day
      dateText = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      // Different year - show full date
      dateText = date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    }
    
    dateElement.textContent = dateText;
    dateElement.title = date.toLocaleString(); // Full date/time on hover
    sessionInfo.appendChild(dateElement);
  }
  
  // Add message count with smart formatting
  if (messages && messages.length > 0) {
    const countElement = document.createElement('div');
    countElement.classList.add('session-message-count');
    const messageCount = messages.length;
    countElement.textContent = `${messageCount} message${messageCount === 1 ? '' : 's'}`;
    sessionInfo.appendChild(countElement);
  }
  
  // Add actions
  const actionsContainer = document.createElement('div');
  actionsContainer.classList.add('session-actions');
  
  // Open button
  const openButton = document.createElement('button');
  openButton.classList.add('session-open-button');
  openButton.textContent = 'Open';
  openButton.addEventListener('click', (e) => {
    e.stopPropagation();
    openSession(session);
  });
  actionsContainer.appendChild(openButton);
  
  // Delete button with confirmation
  const deleteButton = document.createElement('button');
  deleteButton.classList.add('session-delete-button');
  deleteButton.textContent = 'Delete';
  deleteButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    // Ask for confirmation
    const messageCount = messages?.length || 0;
    const confirmMessage = messageCount > 0 
      ? `Are you sure you want to delete this chat session with ${messageCount} message${messageCount === 1 ? '' : 's'}?`
      : 'Are you sure you want to delete this empty chat session?';
    
    if (window.confirm(confirmMessage)) {
      await deleteSession(pageLoadId);
    }
  });
  actionsContainer.appendChild(deleteButton);
  
  // Assemble the list item
  listItem.appendChild(sessionInfo);
  listItem.appendChild(actionsContainer);
  
  // Make the whole item clickable
  listItem.addEventListener('click', () => {
    openSession(session);
  });
  
  return listItem;
}

/**
 * Open a chat session
 * 
 * @param {Object} session - Session object to open
 */
async function openSession(session) {
  try {
    // If the session has a URL, open that tab and navigate to it
    if (session.url) {
      // Find if the URL is already open in a tab
      const tabs = await chrome.tabs.query({});
      const existingTab = tabs.find(tab => tab.url === session.url);
      
      if (existingTab) {
        // Switch to the existing tab
        await chrome.tabs.update(existingTab.id, { active: true });
      } else {
        // Open a new tab with the URL
        await chrome.tabs.create({ url: session.url });
      }
    }
    
    // Switch to the chat tab in the popup
    const chatTab = document.getElementById('chat-tab');
    if (chatTab) {
      chatTab.click();
    }
    
    // Notify chat component to show this session
    window.dispatchEvent(new CustomEvent('open-session', { detail: session }));
  } catch (error) {
    console.error('Error opening session:', error);
    alert(`Error opening session: ${error.message}`);
  }
}

/**
 * Delete a chat session
 * 
 * @param {string} pageLoadId - ID of the session to delete
 */
async function deleteSession(pageLoadId) {
  try {
    // Ask for confirmation
    const confirm = window.confirm('Are you sure you want to delete this chat session?');
    if (!confirm) return;
    
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.DELETE_CHAT_SESSION,
      data: { pageLoadId }
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete session');
    }
    
    // Reload sessions
    loadSessions();
  } catch (error) {
    console.error('Error deleting session:', error);
    alert(`Error deleting session: ${error.message}`);
  }
}

/**
 * Filter sessions by search text
 * 
 * @param {string} searchText - Text to filter by
 */
function filterSessions(searchText) {
  if (!searchText) {
    renderSessions(allSessions);
    return;
  }
  
  const filteredSessions = allSessions.filter(session => {
    const searchFields = [
      session.title,
      session.url,
      ...(session.messages || []).map(m => m.content)
    ].filter(Boolean);
    
    return searchFields.some(field => 
      field.toLowerCase().includes(searchText)
    );
  });
  
  renderSessions(filteredSessions);
  
  // Update no sessions message
  if (filteredSessions.length === 0) {
    noSessionsMessage.textContent = 'No matching sessions found';
    noSessionsMessage.style.display = 'block';
  } else {
    noSessionsMessage.style.display = 'none';
  }
}

export default {
  initializeHistoryComponent
}; 