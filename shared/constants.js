/**
 * Page Inference - Application Constants
 * 
 * This file contains constants used throughout the application.
 * Centralizing these values makes it easier to maintain and update them.
 */

// API Constants
export const API = {
  // OpenAI API Constants
  OPENAI: {
    DEFAULT_MODEL: 'gpt-4o-mini',
    SEARCH_MODEL: 'gpt-4o-mini',
    // Models that support web browsing/search capabilities
    BROWSING_CAPABLE_MODELS: [
      'gpt-4o-mini'
    ],
    // Default model settings
    DEFAULT_TEMPERATURE: 0.7,
    MAX_TOKENS: 4096
  }
};

// Action Types for messaging between contexts
export const ACTION_TYPES = {
  // Content script actions
  CONTENT: {
    INITIALIZED: 'contentScriptInitialized',
    SCRAPE_CONTENT: 'scrapeContent',
    CTRL_KEY_STATE: 'ctrlKeyState',
  },
  
  // Popup actions
  POPUP: {
    INITIALIZED: 'popupInitialized',
    CHECK_CTRL_CLICK: 'checkCtrlClickPending',
  },
  
  // Background script actions
  BACKGROUND: {
    GET_CHAT_HISTORY: 'getChatHistory',
    GET_API_KEY: 'getApiKey',
    SET_API_KEY: 'setApiKey',
    SEND_MESSAGE: 'sendMessage',
    GET_SESSION_INFO: 'getSessionInfo',
  }
};

// Storage Keys
export const STORAGE_KEYS = {
  API_KEY: 'openai_api_key',
  CHAT_SESSIONS: 'chatSessions',
  THEME: 'theme',
  TEMPERATURE: 'temperature',
  PAGE_SCRAPING_ENABLED: 'pageScraping',
  WEB_SEARCH_ENABLED: 'webSearch',
  CURRENT_SITE_FILTER: 'currentSiteFilter',
  DEFAULT_MODEL: 'defaultModel',
  PAGE_LOAD_PREFIX: 'page_load_'
};

// UI Constants
export const UI = {
  // CSS class names
  CLASSES: {
    NIGHT_MODE: 'night-mode',
    ACTIVE_BUTTON: 'active-button',
    ERROR: 'error-message',
    THINKING: 'thinking',
    USER_MESSAGE: 'user-message',
    AI_MESSAGE: 'ai-message',
    SOURCE_LINK: 'source-link',
  },
  
  // Default values
  DEFAULTS: {
    DOUBLE_CLICK_THRESHOLD: 500, // ms
    MAX_CONVERSATION_TITLE_LENGTH: 50,
  }
};

// Default timeout values (in milliseconds)
export const TIMEOUTS = {
  CONTENT_SCRIPT_INIT: 1000,
  CTRL_KEY_CLEAR: 5000,
  DOUBLE_CLICK_WINDOW: 500,
};

// Export default object containing all constants
export default {
  API,
  ACTION_TYPES,
  STORAGE_KEYS,
  UI,
  TIMEOUTS
}; 