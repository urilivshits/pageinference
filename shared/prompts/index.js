/**
 * Page Inference - System Prompts Index
 * 
 * This file exports all system prompts from the various prompt modules.
 * It serves as a central access point for system prompts throughout the application.
 */

import genericPrompts from './generic.js';
import websiteSpecificPrompts from './website-specific.js';

/**
 * Re-export specific prompts for direct imports
 */
// Generic prompts
export const GENERIC_SYSTEM_PROMPT = genericPrompts.GENERIC_SYSTEM_PROMPT;
export const NO_PAGE_CONTENT_SYSTEM_PROMPT = genericPrompts.NO_PAGE_CONTENT_SYSTEM_PROMPT;
export const COMBINED_SYSTEM_PROMPT = genericPrompts.COMBINED_SYSTEM_PROMPT;

// Website-specific prompts
export const LINKEDIN_SYSTEM_PROMPT = websiteSpecificPrompts.LINKEDIN_SYSTEM_PROMPT;
export const GITHUB_SYSTEM_PROMPT = websiteSpecificPrompts.GITHUB_SYSTEM_PROMPT;
export const STACKOVERFLOW_SYSTEM_PROMPT = websiteSpecificPrompts.STACKOVERFLOW_SYSTEM_PROMPT;
export const NEWS_SYSTEM_PROMPT = websiteSpecificPrompts.NEWS_SYSTEM_PROMPT;
export const SHOPPING_SYSTEM_PROMPT = websiteSpecificPrompts.SHOPPING_SYSTEM_PROMPT;
export const DOCUMENTATION_SYSTEM_PROMPT = websiteSpecificPrompts.DOCUMENTATION_SYSTEM_PROMPT;
export const ACADEMIC_SYSTEM_PROMPT = websiteSpecificPrompts.ACADEMIC_SYSTEM_PROMPT;
export const SOCIAL_MEDIA_SYSTEM_PROMPT = websiteSpecificPrompts.SOCIAL_MEDIA_SYSTEM_PROMPT;
export const VIDEO_SYSTEM_PROMPT = websiteSpecificPrompts.VIDEO_SYSTEM_PROMPT;

// Pattern matching for website detection
export const WEBSITE_PATTERNS = websiteSpecificPrompts.WEBSITE_PATTERNS;

/**
 * Helper function to get the appropriate system prompt based on URL and settings
 * 
 * @param {string} url - The URL of the current page
 * @param {boolean} isPageScrapingEnabled - Whether page scraping is enabled
 * @param {boolean} isWebSearchEnabled - Whether web search is enabled
 * @return {string} The appropriate system prompt
 */
export function getSystemPrompt(url, isPageScrapingEnabled, isWebSearchEnabled) {
  // If page scraping is disabled, use the no-content prompt
  if (!isPageScrapingEnabled) {
    return NO_PAGE_CONTENT_SYSTEM_PROMPT;
  }
  
  // If both page scraping and web search are enabled, use the combined prompt
  if (isPageScrapingEnabled && isWebSearchEnabled) {
    return COMBINED_SYSTEM_PROMPT;
  }
  
  // Check for website-specific prompts based on URL
  if (url) {
    const urlLower = url.toLowerCase();
    
    for (const pattern of WEBSITE_PATTERNS) {
      const matchesPattern = pattern.patterns.some(p => 
        urlLower.includes(p.toLowerCase())
      );
      
      if (matchesPattern) {
        return pattern.systemPrompt;
      }
    }
  }
  
  // Default to generic prompt
  return GENERIC_SYSTEM_PROMPT;
}

/**
 * Export all prompts as an object for bulk imports
 */
export default {
  generic: genericPrompts,
  websiteSpecific: websiteSpecificPrompts,
  getSystemPrompt
}; 