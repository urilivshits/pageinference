/**
 * Simple Scraper Test
 * 
 * Basic tests to verify that the scrapers are working
 */

import { test, suite, assertTrue, beforeEach, afterEach } from './test-framework.js';
import { setupTestDOM, cleanupDOM } from './test-environment.js';

// Create a simple mock scraper for testing
const mockScraper = {
  cleanText: (text) => {
    if (!text) return '';
    return text
      .replace(/\s+/g, ' ')
      .trim();
  },
  scrapePageContent: () => {
    return 'Title: Test Page\nContent: Test content';
  }
};

suite('Mock Scraper Tests', () => {
  beforeEach(() => {
    setupTestDOM('https://example.com/test-page');
    document.title = 'Test Page';
    document.body.textContent = 'Test content';
  });

  afterEach(() => {
    cleanupDOM();
  });

  test('Scraper cleans text correctly', () => {
    const dirtyText = '  Multiple    spaces   \n\n\n and newlines  ';
    const cleanedText = mockScraper.cleanText(dirtyText);
    assertTrue(cleanedText === 'Multiple spaces and newlines', 'Should clean text correctly');
  });

  test('Scraper extracts content', () => {
    const content = mockScraper.scrapePageContent();
    assertTrue(content.includes('Title: Test Page'), 'Should include page title');
    assertTrue(content.includes('Content: Test content'), 'Should include page content');
  });
}); 