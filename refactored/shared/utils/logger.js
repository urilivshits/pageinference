/**
 * Logger Utility
 * 
 * Provides enhanced console logging with colors and formatting
 * for better debugging and development experience.
 */

// Enable or disable debug logging globally
let debugEnabled = true;

// Color schemes for different log types
const COLORS = {
  init: 'background: #6200ee; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;',
  debug: 'color: #3f51b5; font-weight: bold;',
  info: 'color: #2196f3; font-weight: bold;',
  success: 'color: #4caf50; font-weight: bold;',
  warn: 'color: #ff9800; font-weight: bold;',
  error: 'background: #f44336; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;',
  theme: 'color: #e91e63; font-weight: bold;',
  session: 'color: #9c27b0; font-weight: bold;',
  ctrl: 'color: #009688; font-weight: bold;',
  network: 'color: #795548; font-weight: bold;',
  time: 'color: #607d8b; font-weight: bold;',
  log: 'color: #757575; font-weight: bold;',
};

// Value colors for log data
const VALUE_COLORS = {
  string: 'color: #2e7d32;',    // Green
  number: 'color: #1565c0;',    // Blue
  boolean: 'color: #6a1b9a;',   // Purple
  null: 'color: #616161;',      // Grey
  undefined: 'color: #616161;', // Grey
  object: 'color: #4527a0;',    // Deep Purple
  array: 'color: #00695c;',     // Teal
  default: 'color: #212121;',   // Dark grey
};

// Source labels to indicate origin of logs
const SOURCE_COLORS = {
  popup: 'color: #ff5722; background: #ffebee; padding: 1px 3px; border-radius: 2px;',
  content: 'color: #4caf50; background: #e8f5e9; padding: 1px 3px; border-radius: 2px;',
  background: 'color: #3f51b5; background: #e8eaf6; padding: 1px 3px; border-radius: 2px;',
  default: 'color: #607d8b; background: #eceff1; padding: 1px 3px; border-radius: 2px;',
};

/**
 * Attempt to detect the current script context
 * @returns {string} The detected context: 'popup', 'content', 'background', or 'default'
 */
function detectContext() {
  // Check if we're in a background script context
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getBackgroundPage) {
    try {
      const bgPage = chrome.runtime.getBackgroundPage();
      if (bgPage === window) {
        return 'background';
      }
    } catch (e) {
      // Not in background context or error accessing API
    }
  }
  
  // Check if we're in a popup context
  if (typeof document !== 'undefined' && document.body) {
    if (document.body.dataset && document.body.dataset.context === 'popup') {
      return 'popup';
    }
    
    // Check URL patterns that might suggest we're in the popup
    if (window.location && window.location.href) {
      const url = window.location.href;
      if (url.includes('popup.html') || url.includes('chrome-extension') && url.includes('popup')) {
        return 'popup';
      }
    }
  }
  
  // Check if we're in a content script context by looking for page elements
  if (typeof document !== 'undefined' && document.body) {
    // Content scripts run in the context of a web page
    if (window.location && window.location.href) {
      const url = window.location.href;
      // If not a chrome-extension URL, likely a content script
      if (!url.includes('chrome-extension://')) {
        return 'content';
      }
    }
  }
  
  return 'default';
}

// Cache the detected context to avoid checking each time
const detectedContext = detectContext();

/**
 * Format timestamp for logs
 * @returns {string} formatted timestamp
 */
function getTimestamp() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
}

/**
 * Format the source label
 * @param {string} source - source of the log (popup, content, background)
 * @returns {string} formatted source label
 */
function formatSource(source) {
  const sourceLabel = source || 'default';
  return [`%c${sourceLabel}`, SOURCE_COLORS[sourceLabel] || SOURCE_COLORS.default];
}

/**
 * Determine the value type and return appropriate styling
 * @param {any} value - The value to check type for
 * @returns {string} CSS style for the value type
 */
function getValueColor(value) {
  if (value === null) return VALUE_COLORS.null;
  if (value === undefined) return VALUE_COLORS.undefined;
  
  if (Array.isArray(value)) return VALUE_COLORS.array;
  
  const type = typeof value;
  return VALUE_COLORS[type] || VALUE_COLORS.default;
}

/**
 * Generic log function with type and color
 * @param {string} type - log type (debug, info, error, etc.)
 * @param {string} message - log message
 * @param {any} data - optional data to log
 */
function logWithType(type, message, data = null) {
  const timestamp = getTimestamp();
  const displayType = type.toUpperCase();
  const typeStyle = COLORS[type.toLowerCase()] || COLORS.debug;
  
  if (data !== null && data !== undefined) {
    // All data types use the same formatting without special colors
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      console.log(
        `[${timestamp}] %c${displayType}%c ${message}: ${data}`,
        typeStyle,
        'color: inherit;'
      );
    } else {
      // For objects, arrays, null, undefined
      console.log(
        `[${timestamp}] %c${displayType}%c ${message}`,
        typeStyle,
        'color: inherit;',
        data
      );
    }
  } else {
    console.log(
      `[${timestamp}] %c${displayType}%c ${message}`,
      typeStyle,
      'color: inherit;'
    );
  }
}

/**
 * Logger object with methods for each log type
 */
const logger = {
  // Enable or disable debug logging
  setDebug(enabled) {
    debugEnabled = enabled;
  },
  
  // Standard log levels
  debug(message, data = null) {
    if (debugEnabled) {
      logWithType('debug', message, data);
    }
  },
  
  log(message, data = null) {
    logWithType('log', message, data);
  },
  
  info(message, data = null) {
    logWithType('info', message, data);
  },
  
  warn(message, data = null) {
    logWithType('warn', message, data);
  },
  
  error(message, data = null) {
    logWithType('error', message, data);
  },
  
  success(message, data = null) {
    logWithType('success', message, data);
  },
  
  // Special purpose loggers
  init(message, data = null) {
    logWithType('init', message, data);
  },
  
  theme(message, data = null) {
    if (debugEnabled) {
      logWithType('theme', message, data);
    }
  },
  
  session(message, data = null) {
    if (debugEnabled) {
      logWithType('session', message, data);
    }
  },
  
  ctrl(message, data = null) {
    if (debugEnabled) {
      logWithType('ctrl', message, data);
    }
  },
  
  network(message, data = null) {
    if (debugEnabled) {
      logWithType('network', message, data);
    }
  },
  
  time(label) {
    console.time(label);
  },
  
  timeEnd(label) {
    console.timeEnd(label);
  },
  
  group(label) {
    console.group(label);
  },
  
  groupEnd() {
    console.groupEnd();
  },
  
  // Conditional logging based on condition
  logIf(condition, type, message, data = null) {
    if (condition) {
      this[type](message, data);
    }
  },
  
  // Table logging for objects and arrays
  table(data, columns) {
    console.log('Table Data:');
    console.table(data, columns);
  }
};

export default logger; 