/**
 * Ctrl Key Detector Content Script
 * 
 * This script detects Ctrl key presses when interacting with the extension icon
 * and sends that information to the background script.
 * 
 * DISABLED: Now using popup-based detection instead
 */

/*
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

// Function to send messages about Ctrl key state
function sendCtrlKeyMessage(isPressed, isHeartbeat = false) {
  const now = Date.now();
  
  // For normal updates (not heartbeats), always send them
  // For heartbeats, only send at most once every 2 seconds (MESSAGE_THROTTLE_MS)
  if (!isHeartbeat || (now - lastCtrlKeyMessageTime > MESSAGE_THROTTLE_MS)) {
    lastCtrlKeyMessageTime = now;
    
    // Clone the current tab ID for logging in case it changes
    const tabId = currentTabId;
    
    // Send message to background script with current tab ID
    chrome.runtime.sendMessage({
      action: 'ctrlKeyPressed',
      pressed: isPressed,
      timestamp: now,
      isHeartbeat: isHeartbeat,
      tabId: tabId
    });
    
    // Also use older format for backward compatibility
    chrome.runtime.sendMessage({
      action: 'ctrlKeyState',
      isPressed: isPressed,
      timestamp: now,
      isHeartbeat: isHeartbeat,
      tabId: tabId
    });
  }
}

// Watch for Ctrl key
document.addEventListener('keydown', (event) => {
  if (event.key === 'Control' || event.key === 'Meta') {
    ctrlKeyDown = true;
    
    // Clear any pending timers for key up
    if (keyUpTimeoutId) {
      clearTimeout(keyUpTimeoutId);
      keyUpTimeoutId = null;
    }
    
    sendCtrlKeyMessage(true);
  }
});

document.addEventListener('keyup', (event) => {
  if (event.key === 'Control' || event.key === 'Meta') {
    ctrlKeyDown = false;
    
    // Use a short delay to allow click events to be processed first
    keyUpTimeoutId = setTimeout(() => {
      sendCtrlKeyMessage(false);
      keyUpTimeoutId = null;
    }, 10);
  }
});

// Handle window blur events which might happen when clicking extension icon
window.addEventListener('blur', () => {
  // If Ctrl was down when blur happened, maintain state longer
  if (ctrlKeyDown) {
    // Wait longer before sending key up if blur event happens
    // This helps ensure the extension gets the Ctrl key state
    keyUpTimeoutId = setTimeout(() => {
      ctrlKeyDown = false;
      sendCtrlKeyMessage(false);
      keyUpTimeoutId = null;
    }, 500); // Longer timeout for blur events
  }
});

// Send heartbeats while Ctrl key is down to maintain state
setInterval(() => {
  if (ctrlKeyDown) {
    // Increment counter and only send every few ticks to reduce message volume
    heartbeatCount++;
    if (heartbeatCount % 4 === 0) { // Only send every 4th heartbeat
      sendCtrlKeyMessage(true, true); // true = isHeartbeat
    }
  } else {
    heartbeatCount = 0;
  }
}, 500); // Half-second interval but only sends every 2 seconds

// Keep checking every second, but take action less frequently

// Also detect clicks near the extension icon area to combine with key state
document.addEventListener('click', (event) => {
  // We can't detect clicks on the extension icon directly from content script,
  // but we can communicate the ctrl state to the background script
  if (ctrlKeyDown) {
    sendCtrlKeyMessage(true);
  }
});

// Initial state message
setTimeout(() => {
  sendCtrlKeyMessage(false);
}, 1000);
*/

console.log('Ctrl key detector disabled - using popup-based detection instead'); 