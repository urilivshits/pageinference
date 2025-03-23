/**
 * Model Tests
 * 
 * Tests for the data models used in the extension.
 */

import { suite, test, assertEqual, assertTrue } from './test-framework.js';
import * as models from '../shared/models/index.js';

// Note: We can't mock crypto.randomUUID in Node.js ESM,
// so we're just checking that IDs are strings rather than specific values

suite('Chat Message Model', () => {
  test('createUserMessage should create a valid user message', () => {
    const message = models.createUserMessage('Hello, world!');
    
    // We can't predict the ID since we can't mock crypto.randomUUID
    // So we'll just check that it's a string
    assertTrue(typeof message.id === 'string');
    assertEqual(message.role, 'user');
    assertEqual(message.content, 'Hello, world!');
    assertTrue(typeof message.timestamp === 'number');
  });
  
  test('createAssistantMessage should create a valid assistant message', () => {
    const message = models.createAssistantMessage('I can help with that!');
    
    assertTrue(typeof message.id === 'string');
    assertEqual(message.role, 'assistant');
    assertEqual(message.content, 'I can help with that!');
    assertTrue(typeof message.timestamp === 'number');
  });
  
  test('createAssistantMessage should handle metadata', () => {
    const message = models.createAssistantMessage('I found this info for you.', {
      sources: ['https://example.com'],
      model: 'gpt-4o-mini',
      usage: { total_tokens: 120 }
    });
    
    assertTrue(typeof message.id === 'string');
    assertEqual(message.role, 'assistant');
    assertEqual(message.content, 'I found this info for you.');
    assertTrue(typeof message.timestamp === 'number');
    assertEqual(message.sources, ['https://example.com']);
    assertEqual(message.model, 'gpt-4o-mini');
    assertEqual(message.usage, { total_tokens: 120 });
  });
  
  test('createSystemMessage should create a valid system message', () => {
    const message = models.createSystemMessage('You are a helpful assistant');
    
    assertTrue(typeof message.id === 'string');
    assertEqual(message.role, 'system');
    assertEqual(message.content, 'You are a helpful assistant');
    assertTrue(typeof message.timestamp === 'number');
  });
  
  test('extractMessageText should return content of a message', () => {
    const message = {
      role: 'user',
      content: 'Hello there!',
      timestamp: Date.now()
    };
    
    assertEqual(models.getMessageText(message), 'Hello there!');
  });
  
  test('formatMessagesForApi should format messages for the API', () => {
    const messages = [
      models.createSystemMessage('You are a helpful assistant'),
      models.createUserMessage('Hello'),
      models.createAssistantMessage('How can I help?')
    ];
    
    const formattedMessages = models.formatMessagesForApi(messages);
    
    const expected = [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'How can I help?' }
    ];
    
    assertEqual(formattedMessages, expected);
  });
});

suite('Session Model', () => {
  test('createSession should create a valid session', () => {
    const session = models.createSession('page123', 'https://example.com', 'Example Page');
    
    assertEqual(session.pageLoadId, 'page123');
    assertEqual(session.url, 'https://example.com');
    assertEqual(session.title, 'Example Page');
    assertTrue(Array.isArray(session.messages));
    assertTrue(typeof session.created === 'number');
    assertTrue(typeof session.lastUpdated === 'number');
    assertTrue(typeof session.modelName === 'string');
    assertTrue(typeof session.temperature === 'number');
    assertTrue(typeof session.isPageScrapingEnabled === 'boolean');
    assertTrue(typeof session.isWebSearchEnabled === 'boolean');
    assertEqual(typeof session.metadata, 'object');
    
    // Should have a system message by default
    assertEqual(session.messages.length, 1);
    assertEqual(session.messages[0].role, 'system');
  });
  
  test('addMessageToSession should add a message to the session', () => {
    const session = models.createSession('page123', 'https://example.com', 'Example Page');
    const message = models.createUserMessage('Hello');
    
    const updatedSession = models.addMessageToSession(session, message);
    
    assertEqual(updatedSession.messages.length, 2); // System + new message
    assertEqual(updatedSession.messages[1].content, message.content);
    assertEqual(updatedSession.messages[1].role, message.role);
    assertTrue(updatedSession.lastUpdated >= session.lastUpdated);
  });
  
  test('getLastUserMessage should return the last user message', () => {
    const session = models.createSession('page123', 'https://example.com', 'Example Page');
    const message1 = models.createUserMessage('Hello');
    const message2 = models.createAssistantMessage('Hi there');
    const message3 = models.createUserMessage('How are you?');
    
    let updatedSession = models.addMessageToSession(session, message1);
    updatedSession = models.addMessageToSession(updatedSession, message2);
    updatedSession = models.addMessageToSession(updatedSession, message3);
    
    const lastUserMessage = models.getLastUserMessage(updatedSession);
    
    assertEqual(lastUserMessage.content, message3.content);
    assertEqual(lastUserMessage.role, message3.role);
  });
  
  test('createSessionSummary should create a valid summary', () => {
    const session = models.createSession('page123', 'https://example.com', 'Example Page');
    const message = models.createUserMessage('This is a test message that is quite long and should be truncated');
    const updatedSession = models.addMessageToSession(session, message);
    
    const summary = models.createSessionSummary(updatedSession);
    
    assertEqual(summary.pageLoadId, 'page123');
    assertEqual(summary.url, 'https://example.com');
    assertEqual(summary.title, 'Example Page');
    assertEqual(summary.domain, 'example.com');
    assertTrue(typeof summary.lastUpdated === 'number');
    assertTrue(typeof summary.created === 'number');
    assertEqual(summary.messageCount, 2); // System + user message
    assertTrue(typeof summary.lastMessagePreview === 'string');
    
    // Preview should be truncated
    assertTrue(summary.lastMessagePreview.length < message.content.length);
  });
});

suite('Settings Model', () => {
  test('createSettings should merge with default settings', () => {
    const userSettings = {
      theme: 'dark',
      temperature: 0.8
    };
    
    const settings = models.createSettings(userSettings);
    
    assertEqual(settings.theme, 'dark');
    assertEqual(settings.temperature, 0.8);
    // Should have default values for other settings
    assertEqual(settings.pageScraping, true);
    assertEqual(settings.webSearch, true);
    assertEqual(settings.defaultModel, 'gpt-4o-mini');
  });
  
  test('validateTemperature should clamp temperature between 0 and 1', () => {
    assertEqual(models.validateTemperature(0.5), 0.5);
    assertEqual(models.validateTemperature(1.5), 1);
    assertEqual(models.validateTemperature(-0.5), 0);
    assertEqual(models.validateTemperature('not a number'), 0.7); // Default
  });
  
  test('validateTheme should validate theme selection', () => {
    assertEqual(models.validateTheme('light'), 'light');
    assertEqual(models.validateTheme('dark'), 'dark');
    assertEqual(models.validateTheme('invalid'), 'light'); // Default
  });
  
  test('validateSettings should return a valid settings object', () => {
    const invalidSettings = {
      theme: 'invalid',
      temperature: 1.5,
      webSearch: 'yes', // Not a boolean
      defaultModel: 'invalid-model'
    };
    
    const validatedSettings = models.validateSettings(invalidSettings);
    
    assertEqual(validatedSettings.theme, 'light'); // Default
    assertEqual(validatedSettings.temperature, 1); // Clamped
    assertEqual(validatedSettings.webSearch, false); // 'yes' string converted to false
    assertEqual(validatedSettings.defaultModel, 'gpt-4o-mini'); // Default
  });
}); 