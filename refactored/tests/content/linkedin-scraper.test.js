import { test, suite, assertTrue, beforeEach, afterEach } from '../test-framework.js';
import { setupTestDOM, cleanupDOM } from '../test-environment.js';
import scrapers from '../../content/scrapers/index.js';

const { linkedInScraper } = scrapers;

console.log('linkedin-scraper.test.js loaded');
console.log('linkedInScraper exists:', !!linkedInScraper);

suite('LinkedIn Scraper Tests', () => {
  beforeEach(() => {
    console.log('Setting up LinkedIn Scraper test');
    setupTestDOM('https://www.linkedin.com/jobs/view/test-job');
    document.title = 'Software Engineer at Test Company';
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'description');
    meta.setAttribute('content', 'Exciting opportunity for a Software Engineer');
    document.head.appendChild(meta);
    
    // Create job details elements
    const jobTitle = document.createElement('div');
    jobTitle.className = 'job-details-jobs-unified-top-card__job-title';
    jobTitle.textContent = 'Software Engineer';
    document.body.appendChild(jobTitle);

    const companyName = document.createElement('div');
    companyName.className = 'job-details-jobs-unified-top-card__company-name';
    companyName.textContent = 'Test Company';
    document.body.appendChild(companyName);

    const jobDescription = document.createElement('div');
    jobDescription.className = 'jobs-description__content';
    jobDescription.textContent = 'Job Requirements: 5+ years experience...';
    document.body.appendChild(jobDescription);
    console.log('LinkedIn Scraper test setup complete');
  });

  afterEach(() => {
    console.log('Cleaning up LinkedIn Scraper test');
    cleanupDOM();
  });

  test('LinkedIn scraper extracts job info', async () => {
    console.log('Running LinkedIn job scraper test');
    const jobInfo = linkedInScraper.scrapeLinkedInJob();
    console.log('Job info:', jobInfo);
    assertTrue(jobInfo.includes('Job Title: Software Engineer'), 'Should contain correct title');
    assertTrue(jobInfo.includes('Company: Test Company'), 'Should contain correct company');
    assertTrue(jobInfo.includes('Job Requirements: 5+ years experience...'), 'Should contain correct job requirements');
    console.log('LinkedIn job scraper test complete');
  });

  test('LinkedIn scraper detects LinkedIn pages', async () => {
    console.log('Running LinkedIn page detection test');
    const isLinkedInPage = linkedInScraper.isLinkedInPage();
    console.log('Is LinkedIn page:', isLinkedInPage);
    assertTrue(isLinkedInPage, 'Should detect LinkedIn domain');
    console.log('LinkedIn page detection test complete');
  });
}); 