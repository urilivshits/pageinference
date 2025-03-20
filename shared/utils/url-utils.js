/**
 * URL Utilities
 * 
 * Collection of helper functions for URL manipulation and validation.
 */

/**
 * Validate if a string is a proper URL
 * 
 * @param {string} urlString - URL to validate
 * @return {boolean} True if valid URL, false otherwise
 */
export function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

/**
 * Extract the domain from a URL
 * 
 * @param {string} urlString - URL to extract domain from
 * @return {string|null} Domain name or null if invalid URL
 */
export function getDomain(urlString) {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch (e) {
    return null;
  }
}

/**
 * Clean and normalize a URL string
 * 
 * @param {string} urlString - URL to clean
 * @return {string} Cleaned URL
 */
export function cleanUrl(urlString) {
  try {
    const url = new URL(urlString);
    // Remove common tracking parameters
    url.searchParams.delete('utm_source');
    url.searchParams.delete('utm_medium');
    url.searchParams.delete('utm_campaign');
    url.searchParams.delete('utm_term');
    url.searchParams.delete('utm_content');
    // Remove hash if it's just for page location
    if (url.hash && !url.hash.includes('=')) {
      url.hash = '';
    }
    return url.toString();
  } catch (e) {
    // If not a valid URL, return as is
    return urlString;
  }
}

/**
 * Get a storage key for a tab-URL combination
 * 
 * @param {number} tabId - The ID of the current tab
 * @param {string} url - The URL of the page
 * @param {string} prefix - Optional prefix for the key (default: 'page_load_')
 * @return {string} Storage key
 */
export function getTabStorageKey(tabId, url, prefix = 'page_load_') {
  return `${prefix}${tabId}_${url}`;
}

/**
 * Create a readable title from a URL
 * 
 * @param {string} urlString - URL to create title from
 * @param {number} maxLength - Maximum length of the title (default: 50)
 * @return {string} A readable title
 */
export function createTitleFromUrl(urlString, maxLength = 50) {
  try {
    const url = new URL(urlString);
    const domain = url.hostname.replace('www.', '');
    const path = url.pathname.replace(/\/$/, '').replace(/^\//, '');
    
    let title = domain;
    if (path) {
      const pathSegments = path.split('/').filter(Boolean);
      if (pathSegments.length > 0) {
        const lastSegment = pathSegments[pathSegments.length - 1]
          .replace(/[-_]/g, ' ')
          .replace(/\.[^.]+$/, ''); // Remove file extension
        
        title += ': ' + lastSegment;
      }
    }
    
    if (title.length > maxLength) {
      title = title.substring(0, maxLength - 3) + '...';
    }
    
    return title;
  } catch (e) {
    // If parsing fails, return a cleaned version of the URL
    return urlString.substring(0, maxLength);
  }
}

export default {
  isValidUrl,
  getDomain,
  cleanUrl,
  getTabStorageKey,
  createTitleFromUrl
}; 