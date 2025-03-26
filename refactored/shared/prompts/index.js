/**
 * Page Inference - System Prompts Index
 * 
 * This file exports all system prompts from the various prompt modules.
 * It serves as a central access point for system prompts throughout the application.
 */

import genericPrompts from './generic.js';
import websiteSpecificPrompts from './website-specific.js';
import { getDomain } from '../utils/url-utils.js';

/**
 * Re-export specific prompts for direct imports
 */
// Generic prompts
export const GENERIC_SYSTEM_PROMPT = genericPrompts.GENERIC_SYSTEM_PROMPT;
export const NO_PAGE_CONTENT_SYSTEM_PROMPT = genericPrompts.NO_PAGE_CONTENT_SYSTEM_PROMPT;
export const WEB_SEARCH_SYSTEM_PROMPT = genericPrompts.WEB_SEARCH_SYSTEM_PROMPT;
export const COMBINED_SYSTEM_PROMPT = genericPrompts.COMBINED_SYSTEM_PROMPT;
export const { generatePageContentPrompt } = genericPrompts;

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
 * System Prompts
 * 
 * Centralized management of system prompts for different contexts.
 */

// Base system prompt for general interactions
const BASE_PROMPT = `You are a helpful AI assistant integrated with Chrome. Answer questions conversationally and concisely.`;

// System prompt for when we have page content
const PAGE_CONTENT_PROMPT = `${BASE_PROMPT} I will provide you with the content of the web page the user is viewing.`;

// System prompt for when web search is enabled
const WEB_SEARCH_PROMPT = `${BASE_PROMPT} You can search the web for information that may help answer the user's questions.`;

// System prompt for when both page content and web search are enabled
const COMBINED_PROMPT = `${BASE_PROMPT} I will provide you with the content of the web page the user is viewing. You can also search the web for additional information that may help answer the user's questions.`;

// Domain-specific prompts for popular websites
const DOMAIN_PROMPTS = {
  'github.com': `${BASE_PROMPT} You're viewing content from GitHub. I can help with code, repositories, and GitHub-related questions.`,
  'stackoverflow.com': `${BASE_PROMPT} You're viewing content from Stack Overflow. I can help understand the questions, answers, and code snippets on this page.`,
  'youtube.com': `${BASE_PROMPT} You're viewing a YouTube page. I can help discuss video content if the transcript is available in the page content.`,
  'wikipedia.org': `${BASE_PROMPT} You're viewing a Wikipedia article. I can help summarize or explain the information on this page.`,
  'docs.google.com': `${BASE_PROMPT} You're viewing a Google Docs page. I can help with the document content and provide suggestions or explanations.`,
  'arxiv.org': `${BASE_PROMPT} You're viewing an arXiv paper. I can help explain concepts, summarize sections, or discuss research methodology in this scientific paper.`
};

/**
 * Generate a system prompt based on context
 * 
 * @param {string} url - The current URL
 * @param {boolean} hasPageContent - Whether page content is available
 * @param {boolean} hasWebSearch - Whether web search is enabled
 * @return {string} The appropriate system prompt
 */
export function getSystemPrompt(url, hasPageContent, hasWebSearch) {
  // Check for domain-specific prompts
  const domain = getDomain(url);
  
  let basePrompt = BASE_PROMPT;
  
  // Check if we have a domain-specific prompt
  for (const [domainKey, prompt] of Object.entries(DOMAIN_PROMPTS)) {
    if (domain && domain.includes(domainKey)) {
      basePrompt = prompt;
      break;
    }
  }
  
  // Handle the different context combinations
  if (hasPageContent && hasWebSearch) {
    return COMBINED_PROMPT.replace(BASE_PROMPT, basePrompt);
  } else if (hasPageContent) {
    return PAGE_CONTENT_PROMPT.replace(BASE_PROMPT, basePrompt);
  } else if (hasWebSearch) {
    return WEB_SEARCH_PROMPT.replace(BASE_PROMPT, basePrompt);
  }
  
  return basePrompt;
}

/**
 * Get domain-specific prompt for a given URL
 * 
 * @param {string} url - The URL to check
 * @return {string|null} Domain-specific prompt or null if none exists
 */
export function getDomainSpecificPrompt(url) {
  const domain = getDomain(url);
  
  if (!domain) return null;
  
  for (const [domainKey, prompt] of Object.entries(DOMAIN_PROMPTS)) {
    if (domain.includes(domainKey)) {
      return prompt;
    }
  }
  
  return null;
}

/**
 * Add a custom domain-specific prompt
 * 
 * @param {string} domainPattern - Domain pattern to match (e.g., 'example.com')
 * @param {string} prompt - Custom prompt for this domain
 */
export function addDomainPrompt(domainPattern, prompt) {
  DOMAIN_PROMPTS[domainPattern] = prompt.startsWith(BASE_PROMPT) 
    ? prompt 
    : `${BASE_PROMPT} ${prompt}`;
}

/**
 * Export all prompts as an object for bulk imports
 */
export default {
  generic: genericPrompts,
  websiteSpecific: websiteSpecificPrompts,
  getSystemPrompt,
  BASE_PROMPT,
  PAGE_CONTENT_PROMPT,
  WEB_SEARCH_PROMPT,
  COMBINED_PROMPT,
  DOMAIN_PROMPTS,
  getDomainSpecificPrompt,
  addDomainPrompt
}; 