/**
 * Controls Component
 * 
 * Manages tab switching and other UI controls.
 */

// DOM elements
let tabButtons;
let tabContainers;
let closeButton;
let minimizeButton;

/**
 * Initialize the controls component
 */
export function initializeControlsComponent() {
  // Get DOM elements
  tabButtons = document.querySelectorAll('.tab-button');
  tabContainers = document.querySelectorAll('.tab-container');
  closeButton = document.getElementById('close-button');
  minimizeButton = document.getElementById('minimize-button');
  
  // Set up event listeners
  setupEventListeners();
  
  // Set default tab
  showTab('chat');
}

/**
 * Set up event listeners for controls
 */
function setupEventListeners() {
  // Tab buttons
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      if (tabId) {
        showTab(tabId);
      }
    });
  });
  
  // New chat button
  const newChatButton = document.getElementById('new-chat-button');
  if (newChatButton) {
    newChatButton.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('new-chat'));
    });
  }
  
  // Close button
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      window.close();
    });
  }
  
  // Minimize button
  if (minimizeButton) {
    minimizeButton.addEventListener('click', () => {
      // In a popup this would minimize, but not much we can do in the popup itself
      window.close();
    });
  }
  
  // Key shortcuts
  document.addEventListener('keydown', (event) => {
    // Close on Escape
    if (event.key === 'Escape') {
      window.close();
    }
    
    // Ctrl+1-3 for tabs
    if (event.ctrlKey && event.key >= '1' && event.key <= '3') {
      const tabIndex = parseInt(event.key) - 1;
      if (tabButtons[tabIndex]) {
        tabButtons[tabIndex].click();
      }
      event.preventDefault();
    }
  });
}

/**
 * Show a specific tab and hide others
 * 
 * @param {string} tabId - ID of the tab to show
 */
function showTab(tabId) {
  // Update active tab button
  tabButtons.forEach(button => {
    const buttonTabId = button.getAttribute('data-tab');
    if (buttonTabId === tabId) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });
  
  // Show/hide tab containers
  tabContainers.forEach(container => {
    const containerTabId = container.getAttribute('data-tab');
    if (containerTabId === tabId) {
      container.classList.add('active');
    } else {
      container.classList.remove('active');
    }
  });
  
  // Dispatch event for other components to handle tab changes
  window.dispatchEvent(new CustomEvent('tab-changed', {
    detail: { tabId }
  }));
  
  // If we're showing the chat tab, make sure it's active
  if (tabId === 'chat') {
    const chatTabButton = document.getElementById('chat-tab');
    if (chatTabButton) {
      chatTabButton.classList.add('active');
    }
  }
}

export default {
  initializeControlsComponent
};
