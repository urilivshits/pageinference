/**
 * OpenAI API Service
 * 
 * Provides a unified interface for interacting with the OpenAI API.
 * Handles both completions and responses APIs.
 */

import { API_CONSTANTS } from '../../shared/constants.js';
import { formatMessagesForApi } from '../../shared/models/chat-message.js';
import { executeToolCall } from './tool-executor.js';

/**
 * Send a request to the OpenAI API
 * 
 * @param {Object} options - Request options
 * @param {string} options.apiKey - OpenAI API key
 * @param {Array} options.messages - Array of message objects
 * @param {string} options.model - Model name (default: gpt-4o-mini)
 * @param {number} options.temperature - Temperature (default: 0)
 * @param {boolean} options.useWebSearch - Whether to enable web search
 * @param {string} options.pageContent - Page content to be combined with user message
 * @param {Object} options.extraParams - Additional parameters to pass to the API
 * @return {Promise<Object>} API response
 */
export async function sendRequest(options) {
  const { 
    apiKey, 
    messages, 
    model = API_CONSTANTS.DEFAULT_MODEL, 
    temperature = API_CONSTANTS.DEFAULT_TEMPERATURE,
    useWebSearch = false,
    pageContent = '',
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
      // - User messages use 'input_text'
      // - Assistant messages use 'output_text'
      const isSystemMessage = message.role === 'system';
      const isUserMessage = message.role === 'user';
      const isAssistantMessage = message.role === 'assistant';
      const contentType = isAssistantMessage ? 'output_text' : 'input_text';
      
      // If this is the current user message and we have page content, combine them
      let messageContent = message.content;
      if (isUserMessage && i === messages.length - 1 && pageContent) {
        messageContent = `${message.content}\n\nHere is the content of the webpage to help answer your question:\n\n${pageContent}`;
      }
      
      responsesInput.push({
        role: message.role,
        content: [
          {
            type: contentType,
            text: messageContent
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
          type: 'web_search'
        }
      ];
    }
  } else {
    // Format for Chat Completions API (fallback)
    const formattedMessages = messages.map((message, index) => {
      // If this is the current user message and we have page content, combine them
      if (index === messages.length - 1 && message.role === 'user' && pageContent) {
        return {
          role: message.role,
          content: `${message.content}\n\nHere is the content of the webpage to help answer your question:\n\n${pageContent}`
        };
      }
      return {
        role: message.role,
        content: message.content
      };
    });
    
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
    
    // Check if we need to process tool calls
    const hasFunctionCalls = useResponsesApi
      ? data.output && data.output.some(output => output.type === 'function_call')
      : data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.tool_calls && data.choices[0].message.tool_calls.length > 0;
    
    if (hasFunctionCalls) {
      console.log('Response contains function calls, processing...');
      return await handleToolCalls(data, options);
    }
    
    return data;
    
  } catch (error) {
    console.error('OpenAI API request failed:', error);
    throw new Error(`OpenAI API request failed: ${error.message}`);
  }
}

/**
 * Handle tool calls in the API response
 * 
 * @param {Object} apiResponse - The API response with tool calls
 * @param {Object} options - The original request options
 * @return {Promise<Object>} The final response after processing tool calls
 */
async function handleToolCalls(apiResponse, options) {
  const { apiKey, model, temperature, extraParams } = options;
  const useResponsesApi = Boolean(apiResponse.output);
  
  // For Responses API with web_search, we don't need to handle tool calls
  // The API already performs the web search for us
  if (useResponsesApi) {
    // Check if we have a web search call in the output
    const hasWebSearchCall = apiResponse.output && 
      apiResponse.output.some(output => output.type === 'web_search_call');
      
    if (hasWebSearchCall) {
      console.log('Web search call handled directly by the Responses API');
      // Return the response as-is since the API handles the web search
      return apiResponse;
    }
  }
  
  // Handle Chat Completions API tool calls (legacy)
  // Get all tool calls from the response
  const toolCalls = !useResponsesApi && 
    apiResponse.choices && 
    apiResponse.choices[0] && 
    apiResponse.choices[0].message && 
    apiResponse.choices[0].message.tool_calls;
  
  if (!toolCalls || toolCalls.length === 0) {
    console.log('No tool calls found in response');
    return apiResponse;
  }
  
  console.log(`Found ${toolCalls.length} tool calls in response`);
  
  // Extract the user query for context (needed if no query is specified in the tool call)
  let userQuery = '';
  if (!useResponsesApi && apiResponse.choices && apiResponse.choices[0] && apiResponse.choices[0].message) {
    // For Chat Completions API, extract from the message history
    userQuery = "latest news"; // Fallback query
  }
  
  // Execute all tool calls
  const toolResults = [];
  for (const toolCall of toolCalls) {
    // If no query is specified in the tool call args, use the user query
    if (toolCall.function && 
        toolCall.function.name === 'web_search' && 
        (!toolCall.function.arguments || toolCall.function.arguments === '{}')) {
      toolCall.function.arguments = JSON.stringify({ query: userQuery });
    }
    
    const result = await executeToolCall(toolCall);
    toolResults.push({
      toolCall,
      result
    });
  }
  
  // For simple web search, we can just return the first result
  if (toolCalls.length === 1 && 
      toolCalls[0].function && 
      toolCalls[0].function.name === 'web_search') {
    
    const searchResult = toolResults[0].result;
    
    if (searchResult.success) {
      // Build a response similar to the original but with the search results
      return {
        ...apiResponse,
        search_results: searchResult.result,
        sources: searchResult.sources,
        choices: [
          {
            message: {
              role: 'assistant',
              content: searchResult.result
            }
          }
        ],
        isToolResult: true
      };
    }
  }
  
  // For more complex cases, make a follow-up API call with the tool results
  const updatedMessages = buildFollowUpMessages(apiResponse, toolResults, useResponsesApi);
  
  // Make a follow-up API call
  const followUpOptions = {
    ...options,
    messages: updatedMessages,
    useWebSearch: false // Don't enable web search for the follow-up call
  };
  
  console.log('Making follow-up API call with tool results');
  const followUpResponse = await sendRequest(followUpOptions);
  
  // Mark this as coming from a follow-up call and include the sources
  const sourcesFromTools = toolResults
    .filter(tr => tr.result.sources)
    .flatMap(tr => tr.result.sources);
    
  return {
    ...followUpResponse,
    isFollowUp: true,
    sources: sourcesFromTools
  };
}

/**
 * Build messages for a follow-up API call with tool results
 * 
 * @param {Object} apiResponse - The original API response
 * @param {Array} toolResults - The results of executing the tool calls
 * @param {boolean} useResponsesApi - Whether using the Responses API format
 * @return {Array} Updated messages for the follow-up call
 */
function buildFollowUpMessages(apiResponse, toolResults, useResponsesApi) {
  if (useResponsesApi) {
    // Get the original conversation from the input
    const originalMessages = apiResponse.input.map(message => {
      return {
        role: message.role,
        content: message.content[0].text
      };
    });
    
    // Add the assistant's message with the tool calls
    originalMessages.push({
      role: 'assistant',
      content: 'I need to search for some information to answer your question.'
    });
    
    // Add the tool results
    toolResults.forEach(tr => {
      originalMessages.push({
        role: 'function',
        name: tr.toolCall.name,
        content: tr.result.result
      });
    });
    
    return originalMessages;
  } else {
    // For Chat Completions API format
    const originalMessages = [];
    // TBD - implement for Chat Completions API if needed
    
    return originalMessages;
  }
}

/**
 * Processes the API response to extract content and handle tool calls
 *
 * @param {Object} apiResponse - The API response
 * @returns {Object} - The formatted response with content
 */
function processApiResponse(apiResponse) {
  if (!apiResponse) {
    throw new Error('Invalid API response: response is null or undefined');
  }
  
  // Check if we're dealing with Responses API
  if (apiResponse.output) {
    console.log('Processing Responses API output');
    
    let content = '';
    let citations = [];
    const metadata = {};
    
    // Check if output is an array and contains content
    if (Array.isArray(apiResponse.output)) {
      // Get text content from output items
      for (const item of apiResponse.output) {
        if (item.type === 'input_text' || item.type === 'output_text') {
          content += item.text + "\n";
        } else if (item.type === 'message' && item.role === 'assistant') {
          // Handle message type content (common in newer responses)
          if (Array.isArray(item.content)) {
            for (const contentItem of item.content) {
              if (contentItem.type === 'input_text' || contentItem.type === 'output_text') {
                content += contentItem.text + "\n";
                
                // Look for URL citations in annotations
                if (contentItem.annotations && Array.isArray(contentItem.annotations)) {
                  citations = citations.concat(
                    contentItem.annotations
                      .filter(anno => anno.type === 'url_citation')
                      .map(anno => ({
                        url: anno.url,
                        title: anno.title || anno.url,
                        snippet: contentItem.text.substring(
                          Math.max(0, anno.start_index - 50),
                          Math.min(contentItem.text.length, anno.end_index + 50)
                        )
                      }))
                  );
                }
              }
            }
          }
        } else if (item.type === 'web_search_call') {
          console.log('Web search call found in response');
          metadata.webSearchPerformed = true;
        }
      }
      
      // Extract sources from annotations if available
      if (apiResponse.annotations && Array.isArray(apiResponse.annotations)) {
        citations = citations.concat(
          apiResponse.annotations
            .filter(anno => anno.type === 'source' && anno.citation)
            .map(anno => ({
              url: anno.citation.url,
              title: anno.citation.title || anno.citation.url,
              snippet: anno.citation.description || ''
            }))
        );
      }
      
      // If we have citations, add them to metadata
      if (citations.length > 0) {
        metadata.sources = citations;
      }
      
      // If we have no content but did a web search, create a standard response
      if (!content.trim() && metadata.webSearchPerformed) {
        content = 'I am searching the web for information on your query. Please wait a moment for the results.';
        metadata.webSearchInProgress = true;
      }
      
      return {
        content: content.trim(),
        metadata,
        sources: citations.length > 0 ? citations : undefined
      };
    }
    
    throw new Error('Invalid API response format');
  }
  
  // Legacy format (Chat Completions API)
  if (apiResponse.choices && apiResponse.choices.length > 0) {
    const message = apiResponse.choices[0].message;
    
    if (message && message.content) {
      return {
        content: message.content,
        toolCalls: message.tool_calls || undefined
      };
    }
  }
  
  throw new Error('Invalid API response format');
}

/**
 * Creates a payload for chat requests with user preferences
 *
 * @param {Array} messages - The messages to send to the API
 * @param {Object} userPreferences - User preferences from storage
 * @returns {Object} - The formatted payload
 */
function createChatRequestPayload(messages, userPreferences) {
  const isWebSearchEnabled = userPreferences.webSearch || false;
  const isResponsesApi = true; // Always use the Responses API
  
  let tools = [];
  
  if (isWebSearchEnabled) {
    // Add web search tool for the Responses API
    tools = [{
      type: "web_search"
    }];
  }
  
  // Add metadata to the first assistant message to indicate web search is in progress
  if (isWebSearchEnabled) {
    // Find the first assistant message (if any) or create metadata for a new one
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        if (!messages[i].metadata) {
          messages[i].metadata = {};
        }
        messages[i].metadata.webSearchInProgress = true;
        break;
      }
    }
  }
  
  // Use Responses API format
  if (isResponsesApi) {
    return {
      messages,
      model: getCurrentModel(userPreferences),
      temperature: userPreferences.temperature !== undefined ? parseFloat(userPreferences.temperature) : API_CONSTANTS.DEFAULT_TEMPERATURE,
      tools: tools.length > 0 ? tools : undefined,
      response_format: { type: "text" }
    };
  }
  
  // Fallback to Chat Completions API (legacy)
  return {
    messages,
    model: getCurrentModel(userPreferences),
    temperature: userPreferences.temperature !== undefined ? parseFloat(userPreferences.temperature) : API_CONSTANTS.DEFAULT_TEMPERATURE,
    tools: tools.length > 0 ? tools : undefined
  };
}

export default {
  sendRequest,
  processApiResponse,
  handleToolCalls,
  createChatRequestPayload
}; 