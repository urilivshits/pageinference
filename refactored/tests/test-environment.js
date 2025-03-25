/**
 * Test Environment Setup
 * 
 * Provides utilities for setting up a test DOM environment
 */

import { JSDOM } from 'jsdom';

// Initialize global console if not present
if (!global.console) {
  global.console = {
    log: (...args) => process.stdout.write(args.join(' ') + '\n'),
    error: (...args) => process.stderr.write(args.join(' ') + '\n'),
    warn: (...args) => process.stderr.write(args.join(' ') + '\n'),
    info: (...args) => process.stdout.write(args.join(' ') + '\n'),
    debug: (...args) => process.stdout.write(args.join(' ') + '\n')
  };
}

// Initialize global process if not present
if (!global.process) {
  global.process = {
    stdout: { write: (...args) => console.log(...args) },
    stderr: { write: (...args) => console.error(...args) }
  };
}

/**
 * Creates a new DOM element with specified attributes
 */
export function createElement(tagName, attributes = {}) {
  const element = document.createElement(tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'textContent') {
      element.textContent = value;
    } else if (key === 'className') {
      element.className = value;
    } else {
      element.setAttribute(key, value);
    }
  });
  return element;
}

/**
 * Validates and normalizes a URL string
 */
function validateUrl(url) {
  // If URL is not provided, use a default
  if (!url) {
    return 'https://example.com';
  }
  
  // If URL doesn't have a protocol, add https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  // For test URLs, we'll allow any format
  if (url.includes('example.com') || url.includes('test-page') || url.includes('linkedin.com')) {
    return url;
  }
  
  try {
    // Test if URL is valid
    new URL(url);
    return url;
  } catch (error) {
    console.warn(`Invalid URL provided: ${url}. Using default.`);
    return 'https://example.com';
  }
}

/**
 * Sets up a test DOM environment with the given URL
 */
export function setupTestDOM(url = 'https://example.com') {
  try {
    // Validate and normalize URL
    const validUrl = validateUrl(url);
    
    // Create new JSDOM instance with URL
    const dom = new JSDOM('<!DOCTYPE html><html><head><meta name="description" content=""></head><body></body></html>', {
      url: validUrl,
      contentType: 'text/html',
      includeNodeLocations: true,
      pretendToBeVisual: true,
      runScripts: 'dangerously'
    });

    // Set up global variables
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = new URL(validUrl);
    global.HTMLElement = dom.window.HTMLElement;
    global.Element = dom.window.Element;
    global.Node = dom.window.Node;
    global.Event = dom.window.Event;
    global.MouseEvent = dom.window.MouseEvent;
    global.CustomEvent = dom.window.CustomEvent;

    // Make sure console is available in the window context
    dom.window.console = global.console;

    // Set up navigator with minimal properties needed for tests
    const navigatorProps = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      language: 'en-US',
      languages: ['en-US', 'en'],
      onLine: true
    };

    // Define navigator as a getter to avoid property setting issues
    Object.defineProperty(global, 'navigator', {
      value: navigatorProps,
      writable: false,
      enumerable: true,
      configurable: true
    });

    // Add any missing DOM APIs
    if (!global.window.getComputedStyle) {
      global.window.getComputedStyle = (element) => ({
        getPropertyValue: (prop) => ''
      });
    }

    // Return the DOM for further manipulation
    return dom;
  } catch (error) {
    console.error('Error setting up test DOM:', error);
    throw error;
  }
}

/**
 * Cleans up the test DOM environment
 */
export function cleanupDOM() {
  // Clean up global variables
  delete global.window;
  delete global.document;
  delete global.navigator;
  delete global.location;
  delete global.HTMLElement;
  delete global.Element;
  delete global.Node;
  delete global.Event;
  delete global.MouseEvent;
  delete global.CustomEvent;
  // DO NOT delete global.console
}

// Export test environment utilities
export default {
  setupTestDOM,
  cleanupDOM,
  createElement
}; 