/**
 * Tool Executor Service
 * 
 * Provides functionality to execute tool calls from OpenAI responses
 */

import { performWebSearch } from './web-search.js';

/**
 * Execute a tool call and return the result
 * 
 * @param {Object} toolCall - The tool call object from OpenAI
 * @return {Promise<Object>} The result of the tool execution
 */
export async function executeToolCall(toolCall) {
  console.log('Executing tool call:', toolCall);
  
  try {
    // Validate the toolCall
    if (!toolCall) {
      throw new Error('Tool call is undefined or null');
    }
    
    // The Responses API's web_search is now handled directly by the API
    // This executor should only be called for legacy Chat Completions API tools
    
    // For the Chat Completions API format
    if (toolCall.function && toolCall.function.name) {
      return await executeChatCompletionsToolCall(toolCall);
    }
    
    throw new Error(`Unsupported tool call format: ${JSON.stringify(toolCall)}`);
  } catch (error) {
    console.error('Error executing tool call:', error);
    return {
      error: true,
      message: `Error executing tool: ${error.message}`
    };
  }
}

/**
 * Execute a tool call from the Chat Completions API
 * 
 * @param {Object} toolCall - The tool call object
 * @return {Promise<Object>} The result of the tool execution
 */
async function executeChatCompletionsToolCall(toolCall) {
  const name = toolCall.function.name;
  let args = {};
  
  try {
    if (toolCall.function.arguments) {
      args = JSON.parse(toolCall.function.arguments);
    }
  } catch (error) {
    console.error('Error parsing tool arguments:', error);
    throw new Error(`Failed to parse tool arguments: ${error.message}`);
  }
  
  // Handle web_search tool
  if (name === 'web_search') {
    const query = args.query || '';
    if (!query) {
      return await executeWebSearch('latest news');
    }
    
    return await executeWebSearch(query);
  }
  
  throw new Error(`Unsupported tool: ${name}`);
}

/**
 * Execute a web search
 * 
 * @param {string} query - The search query
 * @return {Promise<Object>} The result of the web search
 */
async function executeWebSearch(query) {
  try {
    const searchResults = await performWebSearch(query);
    
    return {
      success: true,
      name: 'web_search',
      result: searchResults,
      sources: parseSearchResultsToSources(searchResults)
    };
  } catch (error) {
    console.error('Error performing web search:', error);
    throw error;
  }
}

/**
 * Parse search results to extract sources
 * 
 * @param {string} searchResults - The formatted search results
 * @return {Array} Array of source objects
 */
function parseSearchResultsToSources(searchResults) {
  // Extract sources from the search results
  // This is a simple implementation - in a real system we'd have structured data
  const lines = searchResults.split('\n');
  const sources = [];
  
  for (const line of lines) {
    // Look for numbered items that are likely to be search results
    const match = line.match(/^\d+\.\s+(.*)/);
    if (match) {
      const title = match[1];
      sources.push({
        title,
        url: '#', // In a real implementation, we'd have actual URLs
        snippet: title
      });
    }
  }
  
  return sources;
}

export default {
  executeToolCall
}; 