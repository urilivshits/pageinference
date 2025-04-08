/**
 * Ctrl Key Detector Content Script
 * 
 * This script detects Ctrl key presses when interacting with the extension icon
 * and sends that information to the background script.
 */

// Track the Ctrl key state
let ctrlKeyDown = false;

// Add event listeners for key states
document.addEventListener('keydown', (event) => {
  if (event.key === 'Control') {
    ctrlKeyDown = true;
    // Send message to background script
    chrome.runtime.sendMessage({
      action: 'ctrlKeyPressed',
      pressed: true
    });
  }
});

document.addEventListener('keyup', (event) => {
  if (event.key === 'Control') {
    ctrlKeyDown = false;
  }
});

// Also detect clicks on the extension icon area to combine with key state
document.addEventListener('click', (event) => {
  // We can't detect clicks on the extension icon directly from content script,
  // but we can communicate the ctrl state to the background script
  if (ctrlKeyDown) {
    chrome.runtime.sendMessage({
      action: 'ctrlKeyPressed',
      pressed: true
    });
  }
}); 