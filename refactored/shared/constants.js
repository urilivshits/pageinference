/**
 * Constants
 * 
 * Application-wide constants used across the extension.
 */

// Storage keys for Chrome extension storage
export const STORAGE_KEYS = {
  // User settings and preferences
  API_KEY: 'api_key',
  USER_PREFERENCES: 'user_preferences',
  THEME: 'theme',
  TEMPERATURE: 'temperature',
  PAGE_SCRAPING_ENABLED: 'page_scraping_enabled',
  WEB_SEARCH_ENABLED: 'web_search_enabled',
  CURRENT_SITE_FILTER: 'current_site_filter',
  DEFAULT_MODEL: 'default_model',
  
  // Session storage
  CHAT_SESSIONS: 'chat_sessions',
  
  // Debugging
  DEBUG_MODE: 'debug_mode',
  DEBUG_LOGS: 'debug_logs'
};

// Message types for communication between content scripts and background
export const MESSAGE_TYPES = {
  // API calls
  SEND_API_REQUEST: 'send_api_request',
  API_RESPONSE: 'api_response',
  
  // Chat sessions
  CREATE_CHAT_SESSION: 'create_chat_session',
  GET_CHAT_SESSION: 'get_chat_session',
  GET_SESSION_LIST: 'get_session_list',
  DELETE_CHAT_SESSION: 'delete_chat_session',
  SEND_USER_MESSAGE: 'send_user_message',
  
  // Page actions
  SCRAPE_PAGE_CONTENT: 'scrape_page_content',
  
  // Settings
  GET_USER_PREFERENCES: 'get_user_preferences',
  UPDATE_USER_PREFERENCES: 'update_user_preferences',
  GET_API_KEY: 'get_api_key',
  SET_API_KEY: 'set_api_key',
  
  // Debug
  LOG_DEBUG_INFO: 'log_debug_info',
  GET_DEBUG_LOGS: 'get_debug_logs',
  CLEAR_DEBUG_LOGS: 'clear_debug_logs'
};

// API constants
export const API_CONSTANTS = {
  // Models
  AVAILABLE_MODELS: [
    { value: 'gpt-4o-mini', label: 'GPT-4o mini (Default)' },
    { value: 'gpt-4.1-nano', label: 'GPT-4.1 nano' },
    { value: 'o4-mini-deep-research', label: 'o4-mini Deep Research' }
  ],
  DEFAULT_MODEL: 'gpt-4o-mini',
  
  // Endpoints
  BASE_URL: 'https://api.openai.com/v1',
  CHAT_COMPLETIONS_ENDPOINT: '/chat/completions',
  
  // Request constants
  DEFAULT_TEMPERATURE: 0,
  MAX_TOKENS: 4096
};

// UI constants
export const UI_CONSTANTS = {
  THEMES: {
    LIGHT: 'light',
    DARK: 'dark'
  },
  
  ANIMATION_DURATION: 300,
  MAX_MESSAGE_PREVIEW_LENGTH: 50
};

// Error messages
export const ERROR_MESSAGES = {
  API_KEY_MISSING: 'OpenAI API key is missing. Please add your API key in the extension settings.',
  API_REQUEST_FAILED: 'API request failed. Please check your connection and try again.',
  SESSION_NOT_FOUND: 'Chat session not found. It may have been deleted or expired.',
  INVALID_MESSAGE: 'Invalid message format. Please try again.',
  STORAGE_ERROR: 'Error accessing storage. Please refresh and try again.'
};

export default {
  STORAGE_KEYS,
  MESSAGE_TYPES,
  API_CONSTANTS,
  UI_CONSTANTS,
  ERROR_MESSAGES
}; 