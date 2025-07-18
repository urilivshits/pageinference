/**
 * Settings Model
 * 
 * Defines the structure for user settings in the application.
 */

import { API_CONSTANTS } from '../constants.js';

/**
 * Default settings values - Single source of truth for all default settings
 */
export const DEFAULT_SETTINGS = {
  theme: 'system',
  temperature: 0.5,
  pageScraping: true,
  webSearch: true,  // ✅ Enable web search by default
  currentSiteFilter: false,
  defaultModel: 'gpt-4.1',
  repeatMessageTrigger: 'manual',
  autoExecute: true,  // Enable auto-execution by default
  starsAnimation: true,  // ✨ Enable cosmic greeting by default
  starsAnimationShown: false  // Track if stars animation has been shown for the first time
};

/**
 * Create a settings object with defaults for any missing values
 * 
 * @param {Object} userSettings - User-provided settings
 * @return {Object} Complete settings object with defaults for missing values
 */
export function createSettings(userSettings = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...userSettings
  };
}

/**
 * Validate temperature setting
 * 
 * @param {number} temperature - Temperature value to validate
 * @return {number} Validated temperature (clamped between 0 and 1)
 */
export function validateTemperature(temperature) {
  // Convert to number if string
  const temp = typeof temperature === 'string' ? parseFloat(temperature) : temperature;
  
  // Check if it's a valid number
  if (isNaN(temp)) {
    return DEFAULT_SETTINGS.temperature;
  }
  
  // Clamp between 0 and 1
  return Math.min(Math.max(temp, 0), 1);
}

/**
 * Validate theme setting
 * 
 * @param {string} theme - Theme value to validate
 * @return {string} Validated theme ('light' or 'dark')
 */
export function validateTheme(theme) {
  return theme === 'dark' ? 'dark' : 'light';
}

/**
 * Validate a model name
 * 
 * @param {string} modelName - The model name to validate
 * @param {Array<string>} availableModels - List of available models
 * @return {string} Validated model name
 */
export function validateModel(modelName, availableModels = [API_CONSTANTS.DEFAULT_MODEL]) {
  // If model name is not provided or not in the list of available models, use default
  if (!modelName || !availableModels.includes(modelName)) {
    return API_CONSTANTS.DEFAULT_MODEL;
  }
  
  return modelName;
}

/**
 * Create a validated settings object
 * 
 * @param {Object} rawSettings - Unvalidated settings object
 * @return {Object} Validated settings object
 */
export function validateSettings(rawSettings = {}) {
  const settings = createSettings(rawSettings);
  
  // Convert string or other types to boolean for boolean settings
  const webSearch = typeof settings.webSearch === 'boolean' 
    ? settings.webSearch 
    : Boolean(settings.webSearch === 'true' || settings.webSearch === true);
    
  const pageScraping = typeof settings.pageScraping === 'boolean'
    ? settings.pageScraping
    : Boolean(settings.pageScraping === 'true' || settings.pageScraping === true);
    
  const currentSiteFilter = typeof settings.currentSiteFilter === 'boolean'
    ? settings.currentSiteFilter
    : Boolean(settings.currentSiteFilter === 'true' || settings.currentSiteFilter === true);
    
  const starsAnimation = typeof settings.starsAnimation === 'boolean'
    ? settings.starsAnimation
    : settings.starsAnimation === 'false' ? false : Boolean(settings.starsAnimation === 'true' || settings.starsAnimation === true);
    
  const starsAnimationShown = typeof settings.starsAnimationShown === 'boolean'
    ? settings.starsAnimationShown
    : settings.starsAnimationShown === 'true' ? true : Boolean(settings.starsAnimationShown === true);
  
  return {
    ...settings,
    temperature: validateTemperature(settings.temperature),
    theme: validateTheme(settings.theme),
    defaultModel: validateModel(settings.defaultModel),
    webSearch,
    pageScraping,
    currentSiteFilter,
    starsAnimation,
    starsAnimationShown
  };
}

export default {
  DEFAULT_SETTINGS,
  createSettings,
  validateTemperature,
  validateTheme,
  validateModel,
  validateSettings
}; 