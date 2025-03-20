/**
 * Chat Message Model
 * 
 * Defines the structure for chat messages in the application.
 */

/**
 * Message role types
 */
export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
};

/**
 * Create a new chat message
 * 
 * @param {string} role - The role of the message sender (user, assistant, system)
 * @param {string} content - The content of the message
 * @param {Object} metadata - Additional metadata for the message (optional)
 * @return {Object} A formatted chat message object
 */
export function createMessage(role, content, metadata = {}) {
  if (!Object.values(MessageRole).includes(role)) {
    throw new Error(`Invalid message role: ${role}`);
  }
  
  if (!content || typeof content !== 'string') {
    throw new Error('Message content must be a non-empty string');
  }
  
  return {
    role,
    content,
    timestamp: metadata.timestamp || Date.now(),
    id: metadata.id || generateMessageId(),
    ...metadata
  };
}

/**
 * Create a user message
 * 
 * @param {string} content - The content of the message
 * @param {Object} metadata - Additional metadata (optional)
 * @return {Object} A formatted user message
 */
export function createUserMessage(content, metadata = {}) {
  return createMessage(MessageRole.USER, content, metadata);
}

/**
 * Create an assistant message
 * 
 * @param {string} content - The content of the message
 * @param {Object} metadata - Additional metadata (optional)
 * @return {Object} A formatted assistant message
 */
export function createAssistantMessage(content, metadata = {}) {
  return createMessage(MessageRole.ASSISTANT, content, metadata);
}

/**
 * Create a system message
 * 
 * @param {string} content - The content of the message
 * @param {Object} metadata - Additional metadata (optional)
 * @return {Object} A formatted system message
 */
export function createSystemMessage(content, metadata = {}) {
  return createMessage(MessageRole.SYSTEM, content, metadata);
}

/**
 * Generate a unique message ID
 * 
 * @return {string} A unique ID for the message
 */
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Format messages for OpenAI API
 * 
 * @param {Array} messages - Array of message objects
 * @return {Array} Formatted messages for the API
 */
export function formatMessagesForApi(messages) {
  return messages.map(message => ({
    role: message.role,
    content: message.content
  }));
}

/**
 * Extract text from a message object
 * 
 * @param {Object} message - A message object
 * @return {string} The text content of the message
 */
export function getMessageText(message) {
  if (!message) return '';
  return message.content || '';
}

export default {
  MessageRole,
  createMessage,
  createUserMessage,
  createAssistantMessage,
  createSystemMessage,
  formatMessagesForApi,
  getMessageText
}; 