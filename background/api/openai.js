/**
 * OpenAI API Service
 * 
 * Provides a unified interface for interacting with the OpenAI API.
 * Handles both completions and responses APIs.
 */

import { API } from '../../shared/constants.js';
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
    model = API.OPENAI.DEFAULT_MODEL, 
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
  
  // Choose the appropriate API endpoint based on whether web search is enabled
  // and the model supports browsing capabilities
  const useResponsesApi = useWebSearch && API.OPENAI.BROWSING_CAPABLE_MODELS.includes(model);
  const apiEndpoint = useResponsesApi 
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  
  // Prepare the messages for the API
  const formattedMessages = formatMessagesForApi(messages);
  
  // Build the request payload
  const payload = {
    model,
    messages: formattedMessages,
    temperature,
    ...extraParams
  };
  
  // Add tools configuration for web search if using responses API
  if (useResponsesApi) {
    payload.tools = [{
      "type": "web_search_preview",
      "settings": {}
    }];
    payload.tool_choice = "auto";
  }
  
  try {
    console.log(`Sending request to OpenAI ${useResponsesApi ? 'Responses' : 'Completions'} API`);
    
    // Make the API request
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });
    
    // Check for error responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `HTTP error ${response.status}`;
      throw new Error(`OpenAI API Error: ${errorMessage}`);
    }
    
    // Parse the response
    const data = await response.json();
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
  if (!apiResponse || !apiResponse.choices || !apiResponse.choices[0]) {
    throw new Error('Invalid API response');
  }
  
  const choice = apiResponse.choices[0];
  const message = choice.message;
  
  if (!message || !message.content) {
    throw new Error('Invalid message in API response');
  }
  
  // Extract content
  const content = message.content;
  
  // Extract sources if available (from tool usage)
  let sources = [];
  if (message.tool_calls && Array.isArray(message.tool_calls)) {
    message.tool_calls.forEach(toolCall => {
      if (toolCall.type === 'web_search' && toolCall.web_search && toolCall.web_search.search_results) {
        sources = toolCall.web_search.search_results.map(result => ({
          title: result.title || '',
          url: result.url || '',
          snippet: result.snippet || ''
        }));
      }
    });
  }
  
  // Extract source attributions from annotations
  if (message.annotations && Array.isArray(message.annotations)) {
    const sourceMap = new Map();
    
    message.annotations.forEach(annotation => {
      if (annotation.type === 'web_search' && annotation.web_search) {
        const index = annotation.web_search.index;
        const source = annotation.web_search.source;
        
        if (index !== undefined && source) {
          sourceMap.set(index, {
            title: source.title || '',
            url: source.url || '',
            snippet: source.snippet || ''
          });
        }
      }
    });
    
    // Convert the map to an array, preserving order
    if (sourceMap.size > 0) {
      sources = Array.from(sourceMap.values());
    }
  }
  
  return {
    content,
    sources,
    model: apiResponse.model || '',
    usage: apiResponse.usage || null
  };
}

export default {
  sendRequest,
  processApiResponse
}; 