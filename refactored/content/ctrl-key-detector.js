/**
 * Ctrl Key Detector Content Script
 * 
 * This script detects Ctrl key presses when interacting with the extension icon
 * and sends that information to the background script.
 */

// Track the Ctrl key state
let ctrlKeyDown = false;
let lastCtrlKeyMessageTime = 0;
const MESSAGE_THROTTLE_MS = 250; // Increase throttling time to prevent spam
let keyUpTimeoutId = null; // Add timeout ID for delayed key-up processing
let heartbeatCount = 0; // Add counter to further reduce heartbeat frequency
let currentTabId = null; // Store the current tab ID

// Get the current tab ID from the background script
chrome.runtime.sendMessage({ action: 'getTabId' }, (response) => {
  if (response && response.tabId) {
    currentTabId = response.tabId;
    console.log('Ctrl key detector initialized for tab', currentTabId);
  }
});

// Send message to background with throttling
function sendCtrlKeyMessage(isPressed, isHeartbeat = false) {
  const now = Date.now();
  
  // More aggressive throttling for heartbeat messages
  if (isHeartbeat && now - lastCtrlKeyMessageTime < 2000) {
    return; // Skip heartbeat messages if less than 2 seconds since last message
  }
  
  // Regular throttling for direct key events
  if (!isHeartbeat && now - lastCtrlKeyMessageTime < MESSAGE_THROTTLE_MS) {
    return; // Skip if too soon after last message
  }
  
  lastCtrlKeyMessageTime = now;
  
  // Only log direct key events, not heartbeats to reduce spam
  if (!isHeartbeat) {
    console.log(`Sending Ctrl key state for tab ${currentTabId || 'unknown'}: ${isPressed}`);
  }
  
  // Include the tab ID in the message
  const messageData = {
    action: 'ctrlKeyPressed',
    pressed: isPressed,
    timestamp: now,
    isHeartbeat: isHeartbeat,
    tabId: currentTabId
  };
  
  // Send ctrlKeyPressed message
  chrome.runtime.sendMessage(messageData, response => {
    if (!isHeartbeat) { // Only log responses for direct events
      console.log('Ctrl key message sent, response:', response);
    }
  });
  
  // Also send ctrlKeyState message to update real-time state
  chrome.runtime.sendMessage({
    action: 'ctrlKeyState',
    isPressed: isPressed,
    timestamp: now,
    isHeartbeat: isHeartbeat,
    tabId: currentTabId
  });
  
  // Also set in local storage as a backup mechanism
  // But only do full updates for direct key events, not heartbeats
  if (!isHeartbeat && currentTabId) {
    // Use tab-specific storage keys
    const storageData = {
      [`ctrlKeyPressed_tab_${currentTabId}`]: isPressed,
      [`ctrlClickPending_tab_${currentTabId}`]: isPressed,
      [`ctrlKeyPressTimestamp_tab_${currentTabId}`]: now
    };
    
    chrome.storage.local.set(storageData);
    
    // Also store in session storage to persist between popup openings
    try {
      if (isPressed) {
        // Use tab-specific key in sessionStorage
        const tabSpecificKey = `lastCtrlKeyTimestamp_tab_${currentTabId}`;
        sessionStorage.setItem(tabSpecificKey, now.toString());
        console.log(`Stored Ctrl key timestamp in session storage for tab ${currentTabId}:`, now);
      }
    } catch (e) {
      console.error('Failed to store in sessionStorage:', e);
    }
  }
}

// Add event listeners for key states
document.addEventListener('keydown', (event) => {
  if (event.key === 'Control') {
    ctrlKeyDown = true;
    // Clear any pending key-up timeout
    if (keyUpTimeoutId) {
      clearTimeout(keyUpTimeoutId);
      keyUpTimeoutId = null;
    }
    sendCtrlKeyMessage(true);
  }
});

document.addEventListener('keyup', (event) => {
  if (event.key === 'Control') {
    ctrlKeyDown = false;
    
    // Set a delayed message for the key up event
    // This gives the popup time to open and detect the Ctrl state first
    keyUpTimeoutId = setTimeout(() => {
      sendCtrlKeyMessage(false);
      keyUpTimeoutId = null;
    }, 500); // 500ms delay before sending the "released" state
  }
});

// Set up a heartbeat to keep reporting Ctrl state while held, but with reduced frequency
setInterval(() => {
  heartbeatCount++;
  
  if (ctrlKeyDown) {
    // Send a true state every time when key is actively held
    sendCtrlKeyMessage(true, true);
  } else {
    // Only check for stale states every 5 seconds instead of every second
    // to dramatically reduce console spam
    if (heartbeatCount % 5 === 0) {
      // Only check the tab-specific storage keys
      if (currentTabId) {
        chrome.storage.local.get([
          `ctrlKeyPressed_tab_${currentTabId}`,
          `ctrlClickPending_tab_${currentTabId}`
        ], (result) => {
          // Only send if one of these flags is still true but the key is actually up
          const storedCtrlKey = result[`ctrlKeyPressed_tab_${currentTabId}`];
          const storedPending = result[`ctrlClickPending_tab_${currentTabId}`];
          
          if (storedCtrlKey || storedPending) {
            console.log(`Heartbeat detected stale Ctrl key state for tab ${currentTabId}, sending update to false`);
            sendCtrlKeyMessage(false, true);
          }
        });
      }
    }
  }
}, 1000); // Keep checking every second, but take action less frequently

// Also detect clicks near the extension icon area to combine with key state
document.addEventListener('click', (event) => {
  // We can't detect clicks on the extension icon directly from content script,
  // but we can communicate the ctrl state to the background script
  if (ctrlKeyDown) {
    sendCtrlKeyMessage(true);
  }
});

// Handle window focus events for better detection of alt+tab scenarios
window.addEventListener('focus', () => {
  console.log(`Tab ${currentTabId} gained focus`);
  
  // When the window gets focus, send the current real Ctrl key state immediately
  // This ensures we don't rely on possibly stale data after switching back to the tab
  sendCtrlKeyMessage(ctrlKeyDown, false);
});

// Detect when window is about to lose focus
window.addEventListener('blur', () => {
  console.log(`Tab ${currentTabId} lost focus`);
  
  // If Ctrl is pressed when window loses focus, it might be a Ctrl+click on extension
  if (ctrlKeyDown) {
    // Send one final message with a slight delay to ensure it's processed
    setTimeout(() => {
      sendCtrlKeyMessage(true);
    }, 50);
  } else {
    // If not pressing Ctrl when tab loses focus, send a false state to be safe
    // This makes sure we don't have stale Ctrl press data when we return to the tab
    sendCtrlKeyMessage(false);
  }
}); 