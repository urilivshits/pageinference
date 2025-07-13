/**
 * ES Module wrapper for marked.min.js
 * 
 * This file loads the marked library as a global and then exports it as an ES module.
 * It's necessary to load marked this way because the minified version is not an ES module.
 */

// Create a promise that will resolve when the library is loaded
const markedPromise = new Promise((resolve) => {
  // Create a script element to load the library
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('lib/marked.min.js');
  script.onload = () => {
    // When the script loads, resolve the promise with the global marked object
    resolve(window.marked);
  };
  document.head.appendChild(script);
});

// Export the default function that will return the marked object when it's loaded
export default async function getMarked() {
  return await markedPromise;
}

// Export a convenience method to render markdown directly
export async function renderMarkdown(markdown, options = {}) {
  const marked = await markedPromise;
  return marked.parse(markdown, options);
} 