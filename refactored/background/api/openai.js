/**
 * OpenAI API Service
 * 
 * Provides a unified interface for interacting with the OpenAI API.
 * Handles both completions and responses APIs.
 */

import { API_CONSTANTS } from '../../shared/constants.js';
import { formatMessagesForApi } from '../../shared/models/chat-message.js';

/**
 * Send a request to the OpenAI API
 * 
 * @param {Object} options - Request options
 * @param {string} options.apiKey - OpenAI API key
 * @param {Array} options.messages - Array of message objects
 * @param {string} options.model - Model name (default: gpt-4o-mini)
 * @param {number} options.temperature - Temperature (default: 0.7)
 * @param {boolean} options.useWebSearch - Whether to enable web search
 * @param {Object} options.extraParams - Additional parameters to pass to the API
 * @return {Promise<Object>} API response
 */
export async function sendRequest(options) {
  const { 
    apiKey, 
    messages, 
    model = API_CONSTANTS.DEFAULT_MODEL, 
    temperature = 0.7,
    useWebSearch = false,
    extraParams = {}
  } = options;
  
  if (!apiKey) {
    throw new Error('API key is required');
  }
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array is required and must not be empty');
  }
  
  // Use the right API based on requested features
  const useResponsesApi = true;
  const apiEndpoint = useResponsesApi 
    ? 'https://api.openai.com/v1/responses'
    : 'https://api.openai.com/v1/chat/completions';
  
  // Format depends on which API we're using
  let payload;
  
  if (useResponsesApi) {
    // Convert messages to the Responses API format with correct types
    const responsesInput = [];
    
    // Process messages by role
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      // Determine the correct content type:
      // - System messages use 'input_text'
      // - The current user message (last message) uses 'input_text'
      // - All previous messages use 'output_text'
      const isSystemMessage = message.role === 'system';
      const isCurrentUserMessage = i === messages.length - 1 && message.role === 'user';
      const contentType = (isSystemMessage || isCurrentUserMessage) ? 'input_text' : 'output_text';
      
      responsesInput.push({
        role: message.role,
        content: [
          {
            type: contentType,
            text: message.content
          }
        ]
      });
    }
    
    // Build the request payload for Responses API
    payload = {
      model,
      input: responsesInput,
      temperature,
      max_output_tokens: extraParams.max_tokens || 2048,
      text: {
        format: {
          type: 'text'
        }
      },
      reasoning: {}
    };
    
    // Add tools configuration for web search if enabled
    if (useWebSearch) {
      payload.tools = [
        {
          type: 'function',
          name: 'web_search',
          function: {
            name: 'web_search',
            description: 'Search the web for real-time information',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query'
                }
              },
              required: ['query']
            }
          }
        }
      ];
    }
  } else {
    // Format for Chat Completions API (fallback)
    const formattedMessages = messages.map(message => ({
      role: message.role,
      content: message.content
    }));
    
    payload = {
      model,
      messages: formattedMessages,
      temperature,
      max_tokens: extraParams.max_tokens || 2048
    };
    
    // Add tools configuration for web search
    if (useWebSearch) {
      payload.tools = [
        {
          type: 'function',
          name: 'web_search',
          function: {
            name: 'web_search',
            description: 'Search the web for real-time information',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query'
                }
              },
              required: ['query']
            }
          }
        }
      ];
      payload.tool_choice = "auto";
    }
  }
  
  try {
    console.log(`Sending request to OpenAI ${useResponsesApi ? 'Responses' : 'Chat Completions'} API`);
    console.log('Request payload:', JSON.stringify(payload).substring(0, 500) + '...');
    
    // Make the API request
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    // Check for error responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `HTTP error ${response.status}`;
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorMessage}`);
    }
    
    // Parse the response
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data).substring(0, 500) + '...');
    return data;
    
  } catch (error) {
    console.error('OpenAI API request failed:', error);
    throw new Error(`OpenAI API request failed: ${error.message}`);
  }
}

/**
 * Process the OpenAI API response
 * 
 * @param {Object} apiResponse - The raw API response
 * @return {Object} Processed response with content and sources
 */
export function processApiResponse(apiResponse) {
  // Check if we have a valid response
  if (!apiResponse) {
    throw new Error('Invalid API response: response is empty');
  }
  
  let content = '';
  let sources = [];
  
  // For Responses API format
  if (apiResponse.output && Array.isArray(apiResponse.output)) {
    // Extract text content from output
    for (const output of apiResponse.output) {
      if (output.content && Array.isArray(output.content)) {
        for (const contentItem of output.content) {
          // Check for both input_text and output_text types
          if ((contentItem.type === 'input_text' || contentItem.type === 'output_text') && contentItem.text) {
            content += contentItem.text;
          }
        }
      }
    }
    
    // Extract sources from the sources array
    if (apiResponse.sources && Array.isArray(apiResponse.sources)) {
      sources = apiResponse.sources.map(source => ({
        title: source.title || 'Unknown source',
        url: source.url || '#',
        snippet: source.snippet || ''
      }));
    }
    
    return {
      content,
      sources,
      model: apiResponse.model || '',
      usage: apiResponse.usage || null
    };
  }
  
  // Fallback to chat completions format (for backward compatibility)
  else if (apiResponse.choices && apiResponse.choices[0] && apiResponse.choices[0].message) {
    const message = apiResponse.choices[0].message;
    content = message.content || '';
    
    // Extract sources from tool calls if available
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      message.tool_calls.forEach(toolCall => {
        if (toolCall.function && toolCall.function.name === 'web_search' && toolCall.function.arguments) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            if (args && args.results && Array.isArray(args.results)) {
              sources = args.results.map(result => ({
                title: result.title || 'Unknown Title',
                url: result.url || '#',
                snippet: result.snippet || ''
              }));
            }
          } catch (e) {
            console.error('Error parsing tool call arguments:', e);
          }
        }
      });
    }
    
    return {
      content,
      sources,
      model: apiResponse.model || '',
      usage: apiResponse.usage || null
    };
  }
  
  throw new Error('Invalid API response format');
}

export default {
  sendRequest,
  processApiResponse
}; 