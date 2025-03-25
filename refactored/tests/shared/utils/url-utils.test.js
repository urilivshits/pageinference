/**
 * URL Utilities Tests
 */

import { test, suite, assertEqual, assertTrue, assertFalse } from '../../test-framework.js';
import { 
  getHostname,
  getDomain, 
  getTabStorageKey, 
  isValidUrl,
  getTitleFromUrl,
  generateHash,
  groupByDomain
} from '../../../shared/utils/url-utils.js';

suite('URL Utilities', () => {
  // getHostname tests
  test('getHostname should extract hostname correctly', () => {
    assertEqual(getHostname('https://example.com/path'), 'example.com');
    assertEqual(getHostname('http://subdomain.example.co.uk'), 'subdomain.example.co.uk');
  });
  
  test('getHostname should return empty string for invalid URLs', () => {
    assertEqual(getHostname('not-a-url'), '');
  });
  
  // getDomain tests
  test('getDomain should extract domain without subdomain correctly', () => {
    assertEqual(getDomain('https://example.com/path'), 'example.com');
    assertEqual(getDomain('http://subdomain.example.com'), 'example.com');
    assertEqual(getDomain('http://another.subdomain.example.co.uk'), 'example.co.uk');
  });
  
  test('getDomain should handle IP addresses', () => {
    assertEqual(getDomain('http://192.168.1.1/'), '192.168.1.1');
  });
  
  test('getDomain should return empty string for invalid URLs', () => {
    assertEqual(getDomain('not-a-url'), '');
  });
  
  // isValidUrl tests
  test('isValidUrl should return true for valid URLs', () => {
    assertTrue(isValidUrl('http://example.com'));
    assertTrue(isValidUrl('https://example.com/path?query=value#hash'));
    assertTrue(isValidUrl('ftp://example.com')); // All protocols are valid
  });
  
  test('isValidUrl should return false for invalid URLs', () => {
    assertFalse(isValidUrl('not-a-url'));
    assertFalse(isValidUrl('example')); // No protocol
  });
  
  // getTabStorageKey tests
  test('getTabStorageKey should generate correct key', () => {
    assertEqual(getTabStorageKey(123, 'https://example.com'), 'tab_123_example.com');
    assertEqual(getTabStorageKey(456, 'https://subdomain.test.com'), 'tab_456_subdomain.test.com');
  });
  
  // getTitleFromUrl tests
  test('getTitleFromUrl should create readable title from URL', () => {
    assertEqual(getTitleFromUrl('https://example.com/blog/article-name'), 'example.com › blog › article name');
    assertEqual(getTitleFromUrl('https://example.com'), 'example.com');
  });
  
  test('getTitleFromUrl should remove www prefix', () => {
    assertEqual(getTitleFromUrl('https://www.example.com/downloads/file.pdf'), 'example.com › downloads › file.pdf');
  });
  
  test('getTitleFromUrl should format path with separators', () => {
    assertEqual(getTitleFromUrl('https://example.com/category/subcategory/page'), 'example.com › category › subcategory › page');
  });
  
  test('getTitleFromUrl should return "Untitled Page" for invalid URLs', () => {
    assertEqual(getTitleFromUrl('not-a-url'), 'Untitled Page');
  });
  
  // generateHash tests
  test('generateHash should generate consistent hash for same input', () => {
    const hash1 = generateHash('test-string');
    const hash2 = generateHash('test-string');
    assertEqual(hash1, hash2);
  });
  
  test('generateHash should generate different hash for different inputs', () => {
    const hash1 = generateHash('test-string-1');
    const hash2 = generateHash('test-string-2');
    assertFalse(hash1 === hash2);
  });
  
  // groupByDomain tests
  test('groupByDomain should group items by domain', () => {
    const items = [
      { url: 'https://example.com/page1', name: 'Item 1' },
      { url: 'https://example.com/page2', name: 'Item 2' },
      { url: 'https://test.com/page', name: 'Item 3' },
      { url: 'https://subdomain.example.com/page', name: 'Item 4' }
    ];
    
    const grouped = groupByDomain(items);
    assertEqual(Object.keys(grouped).length, 2);
    assertEqual(grouped['example.com'].length, 3);
    assertEqual(grouped['test.com'].length, 1);
  });
}); 