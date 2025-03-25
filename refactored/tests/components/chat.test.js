/**
 * Chat Component Tests
 * 
 * Tests for the chat component functionality
 */

import { test, suite, assertEqual, assertTrue, assertFalse } from '../test-framework.js';
import { MESSAGE_TYPES } from '../../shared/constants.js';
import { initializeChatComponent, setLoading, displayErrorMessage, hideErrorMessage, loadCurrentSession, createAssistantMessage, formatMessagesForApi } from '../../popup/components/chat.js';

// Mock marked function
global.marked = {
  parse: (text) => `<p>${text}</p>`
};

// Mock session data
const mockSession = {
  id: 'test-session',
  title: 'Test Session',
  messages: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' }
  ]
};

// Mock chrome API
const mockChrome = {
  runtime: {
    sendMessage: async (message) => {
      if (message.type === 'GET_CURRENT_SESSION') {
        return { success: true, data: mockSession };
      }
      if (message.type === 'SEND_MESSAGE') {
        return { success: true, data: { role: 'assistant', content: 'Mock response' } };
      }
      return { success: false, error: 'Not implemented in test environment' };
    }
  },
  storage: {
    local: {
      get: async () => ({ apiKey: 'test-key' }),
      set: async () => {},
      remove: async () => {}
    }
  }
};

// Setup mock DOM
function setupMockDOM() {
  document.body.innerHTML = `
    <div id="chat-container">
      <div id="chat-messages"></div>
      <div id="loading-indicator" class="hidden"></div>
      <div id="error-message" class="hidden"></div>
      <div id="input-container">
        <textarea id="message-input"></textarea>
        <button id="send-button">Send</button>
      </div>
      <div id="action-buttons">
        <button id="reason-button">Reason</button>
        <button id="search-page-button">Search Page</button>
        <button id="search-web-button">Search Web</button>
      </div>
      <div id="double-click-area"></div>
      <div id="current-conversation-title"></div>
    </div>
  `;
}

// Cleanup mock DOM
function cleanupMockDOM() {
  document.body.innerHTML = '';
}

// Test suites
suite('Chat Component', async () => {
  let lastQuery;

  // Setup before each test
  beforeEach(async () => {
    // Setup mock DOM
    setupMockDOM();
    
    // Setup mock chrome API
    global.chrome = mockChrome;
    
    // Initialize component
    await initializeChatComponent();
    
    // Reset lastQuery
    lastQuery = '';
  });
  
  afterEach(() => {
    cleanupMockDOM();
    delete global.chrome;
    delete global.marked;
  });
  
  test('Component initialization', () => {
    assertTrue(document.getElementById('chat-container') !== null);
    assertTrue(document.getElementById('message-input') !== null);
    assertTrue(document.getElementById('send-button') !== null);
    assertTrue(document.getElementById('chat-messages') !== null);
  });
  
  test('Message input handling', () => {
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    
    messageInput.value = 'Test message';
    sendButton.click();
    
    // Input should be cleared after sending
    assertEqual(messageInput.value, '');
  });
  
  test('Loading state handling', () => {
    const loadingIndicator = document.getElementById('loading-indicator');
    const sendButton = document.getElementById('send-button');
    
    // Initially hidden
    assertTrue(loadingIndicator.classList.contains('hidden'));
    
    // Show loading
    setLoading(true);
    assertFalse(loadingIndicator.classList.contains('hidden'));
    assertTrue(sendButton.disabled);
    
    // Hide loading
    setLoading(false);
    assertTrue(loadingIndicator.classList.contains('hidden'));
    assertFalse(sendButton.disabled);
  });
  
  test('Error message handling', () => {
    const errorMessage = document.getElementById('error-message');
    
    // Initially hidden
    assertTrue(errorMessage.classList.contains('hidden'));
    
    // Show error
    displayErrorMessage('Test error');
    assertFalse(errorMessage.classList.contains('hidden'));
    assertEqual(errorMessage.textContent, 'Test error');
    
    // Hide error
    hideErrorMessage();
    assertTrue(errorMessage.classList.contains('hidden'));
  });
  
  test('New chat creation', async () => {
    const newChatButton = document.getElementById('new-chat-button');
    newChatButton.click();
    
    // Should clear messages
    const chatMessages = document.getElementById('chat-messages');
    assertEqual(chatMessages.children.length, 0);
  });
  
  test('Action button handling', () => {
    const messageInput = document.getElementById('message-input');
    
    // Test reason button
    document.getElementById('reason-button').click();
    assertTrue(messageInput.value.includes('explain your reasoning'));
    
    // Test search page button
    document.getElementById('search-page-button').click();
    assertTrue(messageInput.value.includes('search the current page'));
    
    // Test search web button
    document.getElementById('search-web-button').click();
    assertTrue(messageInput.value.includes('search the web'));
  });
  
  test('Double click handling', () => {
    const doubleClickArea = document.getElementById('double-click-area');
    const messageInput = document.getElementById('message-input');
    
    // Set last query
    lastQuery = 'Previous query';
    
    // Simulate double click
    doubleClickArea.dispatchEvent(new MouseEvent('dblclick'));
    
    // Should set input to last query
    assertEqual(messageInput.value, 'Previous query');
  });
  
  test('Session loading', async () => {
    // Trigger session load
    await loadCurrentSession();
    
    // Should display session info
    const title = document.getElementById('current-conversation-title');
    assertEqual(title.textContent, mockSession.title);
  });
  
  test('Message sending', async () => {
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    
    messageInput.value = 'Test message';
    sendButton.click();
    
    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should display messages
    const chatMessages = document.getElementById('chat-messages');
    assertTrue(chatMessages.innerHTML.includes('Test message'));
    assertTrue(chatMessages.innerHTML.includes('Mock response'));
  });

  test('createAssistantMessage should handle metadata', () => {
    const metadata = {
      url: 'https://example.com',
      title: 'Example Page',
      content: 'Page content'
    };

    const message = createAssistantMessage('Test message', metadata);
    assertEqual(message, {
      role: 'assistant',
      content: 'Test message',
      metadata: {
        url: 'https://example.com',
        title: 'Example Page',
        content: 'Page content'
      }
    });
  });

  test('formatMessagesForApi should format messages for the API', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' }
    ];

    const formatted = formatMessagesForApi(messages);
    assertEqual(formatted, [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' }
    ]);
  });
}); 