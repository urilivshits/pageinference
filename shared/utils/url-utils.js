/**
 * URL Utilities
 * 
 * Utility functions for working with URLs and tabs.
 */

/**
 * Get the hostname from a URL
 * 
 * @param {string} url - The URL to extract hostname from
 * @return {string} The hostname of the URL
 */
export function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    console.error('Invalid URL:', url);
    return '';
  }
}

/**
 * Get the domain from a URL (without subdomain)
 * 
 * @param {string} url - The URL to extract domain from
 * @return {string} The domain name without subdomain
 */
export function getDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');
    
    // Check if it's an IP address
    if (/^(\d+\.){3}\d+$/.test(hostname)) {
      return hostname;
    }
    
    // If it has more than 2 parts, it might have a subdomain
    if (parts.length > 2) {
      // Handle special cases like co.uk, com.au, etc.
      const secondLevelDomains = ['co', 'com', 'gov', 'net', 'org', 'edu'];
      if (parts.length > 2 && secondLevelDomains.includes(parts[parts.length - 2])) {
        return parts.slice(-3).join('.');
      }
      
      return parts.slice(-2).join('.');
    }
    
    return hostname;
  } catch (error) {
    console.error('Invalid URL:', url);
    return '';
  }
}

/**
 * Generate a storage key for a tab/URL combination
 * 
 * @param {number} tabId - The tab ID
 * @param {string} url - The URL
 * @return {string} A storage key unique to the tab/URL combination
 */
export function getTabStorageKey(tabId, url) {
  return `tab_${tabId}_${getHostname(url)}`;
}

/**
 * Check if a URL is valid
 * 
 * @param {string} url - The URL to check
 * @return {boolean} Whether the URL is valid
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get a clean page title from a URL if no title is provided
 * 
 * @param {string} url - The URL to generate a title from
 * @return {string} A cleaned title based on the URL
 */
export function getTitleFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    
    // Remove www. and trailing slashes
    let title = hostname.replace(/^www\./, '');
    
    // Add path if it's not just a slash
    if (pathname && pathname !== '/') {
      // Clean up the path - remove trailing slash, replace dashes with spaces
      const cleanPath = pathname
        .replace(/\/$/, '')
        .replace(/-/g, ' ')
        .replace(/\//g, ' › ');
      
      title += cleanPath;
    }
    
    return title;
  } catch (error) {
    console.error('Invalid URL:', url);
    return 'Untitled Page';
  }
}

/**
 * Generate a hash from a string
 * Useful for creating unique IDs based on URLs
 * 
 * @param {string} str - The string to hash
 * @return {string} A hash of the string
 */
export function generateHash(str) {
  let hash = 0;
  
  if (str.length === 0) {
    return hash.toString(16);
  }
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(16);
}

/**
 * Group URLs by domain
 * 
 * @param {Array<Object>} items - Array of objects containing URLs
 * @param {string} urlKey - The key in each object that contains the URL
 * @return {Object} Object with domains as keys and arrays of items as values
 */
export function groupByDomain(items, urlKey = 'url') {
  return items.reduce((groups, item) => {
    if (!item[urlKey]) return groups;
    
    const domain = getDomain(item[urlKey]);
    
    if (!groups[domain]) {
      groups[domain] = [];
    }
    
    groups[domain].push(item);
    return groups;
  }, {});
}

export default {
  getHostname,
  getDomain,
  getTabStorageKey,
  isValidUrl,
  getTitleFromUrl,
  generateHash,
  groupByDomain
}; 