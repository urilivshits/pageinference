/**
 * Page Inference - Background Script
 * 
 * This script runs in the background and is responsible for:
 * 1. Handling message communication between content script and popup
 * 2. Sending requests to the OpenAI API
 * 3. Storing and retrieving API key from Chrome storage
 * 4. Managing chat history
 * 
 * Error Handling:
 * - Defensive null/undefined checks for all parameters in critical functions
 * - Safe URL handling to prevent "Cannot read properties of undefined" errors
 * - Graceful fallbacks for missing content or response data
 * - Comprehensive validation of tab and API responses
 * - Clear error messages for debugging and user feedback
 */

// Store chat history per tab/URL/pageLoadId
const chatHistories = {};

// Default model name
const DEFAULT_MODEL = 'gpt-4o-mini';

// Models that support web browsing/search capabilities
const BROWSING_CAPABLE_MODELS = [
  'gpt-4-turbo',
  'gpt-4o',
  'gpt-4-vision-preview',
  'gpt-4-1106-preview',
  'gpt-4o-mini',
  'gpt-4-0125-preview',  // Adding newer model versions
  'gpt-4-turbo-preview',
  'gpt-4-0613',
  'gpt-4-32k-0613'
];

// Website type patterns for detection
const WEBSITE_PATTERNS = [
  {
    type: 'linkedin',
    patterns: ['linkedin.com', 'recruiter', 'job', 'profile', 'hiring', 'resume', 'skills', 'experience', 'recommendation', 'endorsement', 'career', 'employment'],
    systemPrompt: 'You are a helpful assistant specializing in professional networking and career advice. The user is viewing a LinkedIn page which may contain profile information, job listings, or professional content. Help them extract relevant professional insights, evaluate job opportunities, understand career paths, or analyze professional profiles. Focus on professional development, job search, or recruitment insights based on the content provided.'
  },
  {
    type: 'github',
    patterns: ['github.com', 'repository', 'commit', 'pull request', 'issue', 'branch', 'fork', 'merge', 'code', 'developer', 'programming', 'software'],
    systemPrompt: 'You are a helpful assistant specializing in software development. The user is viewing a GitHub page which may contain code repositories, issues, pull requests, or technical documentation. Provide insights about the code, development practices, or technical implementation details. Focus on explaining code functionality, identifying patterns, suggesting improvements, or summarizing technical information from the content provided.'
  },
  {
    type: 'stackoverflow',
    patterns: ['stackoverflow.com', 'question', 'answer', 'programming', 'code', 'error', 'debug', 'function', 'library', 'api', 'solution', 'problem'],
    systemPrompt: 'You are a helpful assistant specializing in technical problem-solving. The user is viewing a Stack Overflow page with programming questions and answers. Help them understand the solutions provided, explain technical concepts, identify best practices, or summarize the key points from different answers. Focus on clarifying technical details and providing additional context where needed.'
  },
  {
    type: 'news',
    patterns: ['news', 'article', 'journalist', 'reporter', 'publish', 'editor', 'headline', 'breaking', 'report', 'media', 'press', 'coverage'],
    systemPrompt: 'You are a helpful assistant analyzing news content. The user is viewing a news article or publication. Help them understand the key points, identify potential biases, summarize the main story, or provide context about the topics covered. Focus on extracting the important information and helping the user gain a clear understanding of the news content.'
  },
  {
    type: 'shopping',
    patterns: ['product', 'price', 'shop', 'buy', 'purchase', 'cart', 'checkout', 'discount', 'retail', 'store', 'ecommerce', 'shipping', 'order'],
    systemPrompt: 'You are a helpful assistant for online shopping. The user is viewing a product page or e-commerce site. Help them understand product features, compare options, evaluate prices, or identify key considerations for their purchase decision. Focus on extracting product information and providing objective analysis of the options available.'
  },
  {
    type: 'documentation',
    patterns: ['docs', 'documentation', 'guide', 'tutorial', 'manual', 'reference', 'api', 'function', 'method', 'class', 'library', 'framework'],
    systemPrompt: 'You are a helpful assistant specializing in technical documentation. The user is viewing technical documentation, API references, or guides. Help them understand the concepts, implementation details, or usage examples from the documentation. Provide clear explanations of technical concepts and help them apply the information to their specific needs.'
  },
  {
    type: 'academic',
    patterns: ['research', 'study', 'paper', 'journal', 'publication', 'experiment', 'methodology', 'findings', 'conclusion', 'hypothesis', 'theory', 'data', 'analysis', 'scholar'],
    systemPrompt: 'You are a helpful assistant specializing in academic content. The user is viewing a research paper, journal article, or academic publication. Help them understand the research methodology, key findings, theoretical implications, or statistical analyses. Focus on extracting the core academic concepts and presenting them in an accessible way while maintaining scientific accuracy.'
  },
  {
    type: 'social_media',
    patterns: ['post', 'tweet', 'share', 'like', 'follow', 'comment', 'friend', 'feed', 'social', 'profile', 'status', 'update'],
    systemPrompt: 'You are a helpful assistant analyzing social media content. The user is viewing a social media platform with posts, comments, or profiles. Help them understand the context of conversations, identify key points from discussions, or extract insights from the social content. Focus on the substance of the communication while filtering out noise or distractions.'
  },
  {
    type: 'video',
    patterns: ['video', 'youtube', 'stream', 'watch', 'view', 'channel', 'subscribe', 'creator', 'content', 'episode'],
    systemPrompt: 'You are a helpful assistant specializing in video content. The user is viewing a video platform or video description page. Help them understand the key points from the video description, creator information, or related content. Focus on extracting the most relevant details about the video content to help them decide if it is worth watching or to better understand what they have viewed.'
  }
];

// Default system prompt
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant that answers questions based on the provided webpage content. Give concise and accurate answers based solely on the information in the content provided. If the answer cannot be found in the content, state that clearly.';

// Handle installation and updates
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
    checkIconsExist();
    // Set default model preference
    chrome.storage.sync.set({ modelPreference: DEFAULT_MODEL });
  } else if (details.reason === 'update') {
    console.log(`Extension updated from ${details.previousVersion} to ${chrome.runtime.getManifest().version}`);
  }
});

// Check if icon files exist and log a warning if they don't
function checkIconsExist() {
  const iconSizes = [16, 48, 128];
  const missingIcons = [];
  
  // This is mostly for documentation purposes since we can't actually check
  // if files exist in the extension directory at runtime
  console.log('Reminder: Make sure to add icon files in the icons directory:');
  iconSizes.forEach(size => {
    console.log(`- icons/default_icon${size}.png`);
  });
  
  // Log missing icons warning to help users
  console.log('If extension icon is not displayed correctly, please refer to icons/README.md');
}

/**
 * Detects the type of website based on the content and URL
 * @param {string} content - The scraped page content
 * @param {string} url - The URL of the page
 * @returns {Object} - The detected website type and corresponding system prompt
 */
function detectWebsiteType(content, url) {
  // Ensure parameters are not undefined/null and have valid defaults
  const safeContent = content || '';
  const safeUrl = url || '';
  
  // Create a combined string for pattern matching
  const combinedText = (safeContent + ' ' + safeUrl).toLowerCase();
  
  // Check each website pattern
  for (const website of WEBSITE_PATTERNS) {
    // Count how many patterns match
    const matchCount = website.patterns.filter(pattern => 
      combinedText.includes(pattern.toLowerCase())
    ).length;
    
    // If more than 3 patterns match or the URL directly contains the website type, return it
    if (matchCount >= 3 || (safeUrl.toLowerCase().includes(website.type))) {
      return {
        type: website.type,
        systemPrompt: website.systemPrompt
      };
    }
  }
  
  // Default if no specific type is detected
  return {
    type: 'general',
    systemPrompt: DEFAULT_SYSTEM_PROMPT
  };
}

/**
 * Checks if the model supports web browsing
 * @param {string} model - The model name
 * @returns {boolean} - Whether the model supports browsing
 */
function modelSupportsBrowsing(model) {
  return BROWSING_CAPABLE_MODELS.includes(model);
}

// Listen for messages from the content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request);
  
  // Handle scraping request (forward to active tab)
  if (request.action === 'scrapeCurrentPage') {
    console.log('Handling scrapeCurrentPage request');
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]) {
        sendResponse({ error: 'No active tab found' });
        return;
      }

      // Check if we can inject scripts into this tab
      try {
        const tab = tabs[0];
        // Check if this is a supported page
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
          sendResponse({ error: 'This page is not supported' });
          return;
        }

        // Ensure content script is injected
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              return window.__pageInferenceInitialized === true;
            }
          });
        } catch (e) {
          console.log('Content script check failed, attempting to inject:', e);
          // Inject content script if not already present
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          // Give it a moment to initialize
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Now try to communicate with the tab
        chrome.tabs.sendMessage(
          tab.id,
          { action: 'scrapeContent' },
          (response) => {
            // Check for Chrome runtime errors first
            if (chrome.runtime.lastError) {
              console.error('Tab communication error:', chrome.runtime.lastError);
              sendResponse({ error: 'Error communicating with page: ' + chrome.runtime.lastError.message });
              return;
            }
            
            // Validate response and content
            if (!response) {
              console.error('Empty response from content script');
              sendResponse({ error: 'No response received from page. The content script may not be properly initialized.' });
              return;
            }
            
            if (!response.content) {
              console.error('Missing content in response:', response);
              sendResponse({ error: 'Invalid response from page. The page content could not be extracted.' });
              return;
            }
            
            try {
              // Detect website type with proper error handling
              const websiteType = detectWebsiteType(response.content, tab.url);
              console.log('Detected website type:', websiteType.type);
              
              // Send content and website type
              console.log('Sending scraped content response');
              sendResponse({ 
                content: response.content,
                websiteType: websiteType.type
              });
            } catch (detectionError) {
              console.error('Error during website type detection:', detectionError);
              // Fall back to general type if detection fails
              sendResponse({ 
                content: response.content,
                websiteType: 'general',
                warning: 'Website type detection failed, using general type'
              });
            }
          }
        );
      } catch (error) {
        console.error('Error during tab communication setup:', error);
        sendResponse({ error: 'Failed to initialize page communication' });
      }
    });
    return true; // Keep the message channel open for async response
  }
  
  // Handle API key storage
  if (request.action === 'setApiKey') {
    console.log('Setting API key');
    chrome.storage.sync.set({ openAiApiKey: request.apiKey }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  // Handle API key retrieval
  if (request.action === 'getApiKey') {
    console.log('Getting API key');
    chrome.storage.sync.get('openAiApiKey', (data) => {
      console.log('API key exists:', !!data.openAiApiKey);
      sendResponse({ apiKey: data.openAiApiKey || '' });
    });
    return true;
  }
  
  // Handle inference request
  if (request.action === 'getInference') {
    console.log('Handling inference request');
    chrome.storage.sync.get('openAiApiKey', async (data) => {
      if (!data.openAiApiKey) {
        console.error('API key not found');
        sendResponse({ error: 'API key not found. Please set your API key in the extension options.' });
        return;
      }
      
      try {
        // Get tab URL for website type detection
        let url = request.url || '';
        let pageTitle = '';
        
        if (!url && request.tabId) {
          try {
            const tab = await chrome.tabs.get(request.tabId).catch(() => null);
            if (tab) {
              url = tab.url;
              pageTitle = tab.title || '';
            } else {
              console.error('Tab not found with ID:', request.tabId);
            }
          } catch (tabError) {
            console.error('Error getting tab information:', tabError);
            // Continue with available data rather than failing completely
          }
        }
        
        if (!url) {
          console.warn('URL not available, using fallback empty string');
        }
        
        const result = await getOpenAiInference(
          data.openAiApiKey,
          request.content,
          request.question,
          request.model || DEFAULT_MODEL,
          url
        );
        
        // Store in chat history
        if (request.tabId && request.url && request.pageLoadId) {
          // Use a more reliable key format based on domain
          const baseDomain = getBaseDomain(request.url);
          const historyKey = `${request.tabId}_${baseDomain}_${request.pageLoadId}`;
          
          console.log(`Storing chat history with key: ${historyKey}`);
          
          if (!chatHistories[historyKey]) {
            chatHistories[historyKey] = [];
          }
          
          chatHistories[historyKey].push({
            role: 'user',
            content: request.question,
            timestamp: new Date().toISOString(),
            pageTitle: pageTitle || new URL(url).hostname
          });
          
          chatHistories[historyKey].push({
            role: 'assistant',
            content: result,
            timestamp: new Date().toISOString()
          });
        } else {
          console.warn('Missing data for chat history:', {
            tabId: request.tabId,
            url: request.url,
            pageLoadId: request.pageLoadId
          });
        }
        
        sendResponse({ answer: result });
      } catch (error) {
        console.error('Error during inference:', error);
        
        // Check for specific model-related errors
        if (error.message && error.message.includes('does not exist or you do not have access to it')) {
          sendResponse({ 
            error: `Model ${request.model || DEFAULT_MODEL} is not available. Please select a different model in settings.`,
            modelError: true
          });
        } else {
          sendResponse({ error: error.message || 'Error getting inference from OpenAI API' });
        }
      }
    });
    return true;
  }
  
  // Handle chat history retrieval
  if (request.action === 'getChatHistory') {
    const historyKey = `${request.tabId}_${request.url}_${request.pageLoadId}`;
    sendResponse({ history: chatHistories[historyKey] || [] });
    return true;
  }
  
  // Handle chat history clearing
  if (request.action === 'clearChatHistory') {
    const historyKey = `${request.tabId}_${request.url}_${request.pageLoadId}`;
    if (chatHistories[historyKey]) {
      delete chatHistories[historyKey];
    }
    // Also clear from chrome.storage.local
    chrome.storage.local.remove(`chat_history_${request.tabId}_${request.url}_${request.pageLoadId}`);
    sendResponse({ success: true });
    return true;
  }

  // Handle chat history update
  if (request.action === 'updateChatHistory') {
    const historyKey = `${request.tabId}_${request.url}_${request.pageLoadId}`;
    chatHistories[historyKey] = request.history;
    sendResponse({ success: true });
    return true;
  }
});

/**
 * Sends a request to the OpenAI API for inference
 * @param {string} apiKey - The OpenAI API key
 * @param {string|null} pageContent - The scraped page content
 * @param {string|null} question - The user's question
 * @param {string|null} model - The model to use (default: gpt-4o-mini)
 * @param {string|null} url - The URL of the page (for context detection)
 * @returns {Promise<string>} - The inference result
 * @throws {Error} - If API request fails or parameters are invalid
 */
async function getOpenAiInference(apiKey, pageContent, question, model = DEFAULT_MODEL, url = '') {
  console.log('Starting getOpenAiInference');
  // Ensure we have an API key
  if (!apiKey || typeof apiKey !== 'string' || (apiKey = apiKey.trim()).length === 0) {
    return 'Error: Please provide a valid OpenAI API key in the extension settings.';
  }
  
  console.log('Have API key, content length:', pageContent ? pageContent.length : 0);
  
  // Ensure all parameters have valid defaults and are properly sanitized
  const safePageContent = (pageContent || '').toString();
  const safeQuestion = (question || 'What is on this page?').toString();
  const safeUrl = (url || '').toString();
  const safeModel = (model || DEFAULT_MODEL).toString();
  
  // Trim long content
  const MAX_CONTENT_LENGTH = 100000;
  const trimmedContent = safePageContent.length > MAX_CONTENT_LENGTH 
    ? safePageContent.substring(0, MAX_CONTENT_LENGTH) + '... (content truncated due to length)'
    : safePageContent;
  
  // Detect website type with error handling
  let websiteType;
  try {
    websiteType = detectWebsiteType(trimmedContent, safeUrl);
    console.log(`Detected website type: ${websiteType.type}`);
  } catch (typeError) {
    console.error('Website type detection failed:', typeError);
    websiteType = {
      type: 'general',
      systemPrompt: DEFAULT_SYSTEM_PROMPT
    };
  }
  
  // Check if the model supports web browsing capability
  const supportsBrowsing = safeModel.includes('gpt-4') || safeModel.includes('gpt-4-turbo');
  console.log('Model supports browsing:', supportsBrowsing);
  
  try {
    // Prepare request body
    const requestBody = {
      model: safeModel,
      messages: [
        {
          role: 'system',
          content: websiteType.systemPrompt
        },
        {
          role: 'user',
          content: `Here is the content of a webpage (URL: ${safeUrl}):\n\n${trimmedContent}\n\nBased on this content, please answer the following question: ${safeQuestion}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    };
    
    // If the model supports browsing, add the tools
    if (supportsBrowsing) {
      requestBody.tools = [
        {
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Search the web for current information.',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query to use.'
                }
              },
              required: ['query']
            }
          }
        }
      ];
    }
    
    console.log('Making API request to OpenAI...');
    
    // Make the API request
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('Received API response, status:', response.status);
    
    // Handle non-200 responses
    if (!response.ok) {
      // Get the error details as text first to avoid JSON parse errors
      let errorText = '';
      try {
        errorText = await response.text();
        console.error('API Error Response (text):', errorText);
        
        // Try to parse as JSON if it looks like JSON
        if (errorText.trim().startsWith('{')) {
          const errorJson = JSON.parse(errorText);
          console.error('API Error Response (parsed):', errorJson);
          
          // Extract error message from various API error formats
          const errorMessage = 
            (errorJson.error && errorJson.error.message) || 
            errorJson.message || 
            `API Error: ${response.status} ${response.statusText}`;
          
          return `Error: ${errorMessage}`;
        }
      } catch (e) {
        console.error('Failed to parse error response:', e);
      }
      
      return `Error: The API returned status ${response.status} ${response.statusText}${errorText ? ': ' + errorText : ''}`;
    }
    
    // Get the raw response text first for better logging
    console.log('Reading response as text...');
    const responseText = await response.text();
    
    // Log the response length for debugging
    console.log(`Response text length: ${responseText.length}`);
    console.log(`Response preview: ${responseText.substring(0, 100)}...`);
    
    // Parse the response text as JSON
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('Successfully parsed API response:', data);
    } catch (parseError) {
      console.error('Error parsing API response:', parseError);
      console.error('Parse error stack:', parseError.stack);
      console.error('Response text that failed to parse:', responseText);
      return 'Error: Failed to parse the API response. Please try again.';
    }
    
    // First, check if we have a valid data object with choices
    if (!data || !data.choices || !data.choices.length || !data.choices[0].message) {
      console.error('Invalid response structure', data);
      return 'Error: Received an invalid response structure from the API.';
    }
    
    console.log('Extracting message from response...');
    
    try {
      const message = data.choices[0].message;
      console.log('Message extracted, content type:', typeof message.content, 'Has tool calls:', !!message.tool_calls);
      
      // CRITICAL: First check if content is null before attempting any operation on it
      if (message.content === null) {
        console.log('Content is null, checking for tool calls');
        
        // Check if we have tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
          // Handle tool calls (web search, etc.)
          if (supportsBrowsing) {
            console.log('Tool calls detected in a browsing-capable model, initiating sequential API calls');
            
            // Get the messages we sent in the original request
            const originalMessages = [
              {
                role: 'system',
                content: websiteType.systemPrompt
              },
              {
                role: 'user',
                content: `Here is the content of a webpage (URL: ${safeUrl}):\n\n${trimmedContent}\n\nBased on this content, please answer the following question: ${safeQuestion}`
              }
            ];
            
            try {
              // Use the sequential API calls handler for search-enabled models
              return await handleSequentialApiCalls(apiKey, data, safeModel, originalMessages);
            } catch (sequentialError) {
              console.error('Error in sequential API calls:', sequentialError);
              return `Error handling search capabilities: ${sequentialError.message}. Please try again.`;
            }
          } else {
            // For non-browsing models that somehow return tool calls
            console.log('Tool calls detected in a non-browsing model', message.tool_calls);
            
            // Extract tool call info in a safe way
            const toolCallsInfo = message.tool_calls.map(toolCall => {
              if (toolCall.type === 'function' && toolCall.function) {
                try {
                  const name = toolCall.function.name;
                  const args = JSON.parse(toolCall.function.arguments || '{}');
                  
                  // Handle web_search function specifically
                  if (name === 'web_search' && args.query) {
                    return `Searching the web for: "${args.query}"`;
                  }
                  return `Using function ${name} with arguments: ${JSON.stringify(args)}`;
                } catch (e) {
                  return `Using function ${toolCall.function.name || 'unknown'} (with unparseable arguments)`;
                }
              }
              return `Using tool: ${toolCall.type || 'unknown'}`;
            }).join(' ');
            
            return `I need to search for more information to answer your question properly. ${toolCallsInfo}`;
          }
        } else {
          // Null content but no tool calls - this is unexpected but we handle it gracefully
          console.log('Content is null but no tool calls were found');
          return 'Processing your request. If searching for information, I\'ll have a complete answer shortly.';
        }
      }
      
      // Case 2: Normal content case (with proper null check and string check)
      if (typeof message.content === 'string' && message.content !== null) {
        try {
          return message.content.trim();
        } catch (trimError) {
          console.error('Error trimming message content:', trimError);
          return message.content; // Return untrimmed content if trim fails
        }
      }
      
      // Fallback for unexpected content type (not null, not string)
      console.log('Unexpected message content type:', typeof message.content);
      return 'I processed your request, but received an unexpected response format. Please try again.';
    } catch (messageError) {
      console.error('Error processing message content:', messageError);
      console.error('Message error stack:', messageError.stack);
      return 'Error: Failed to process the API response. Please try again.';
    }
  } catch (error) {
    console.error('OpenAI API Error:', error);
    console.error('Error stack:', error.stack);
    return `Error: ${error.message || 'Unknown error occurred when calling the OpenAI API'}`;
  }
}

/**
 * Get the base domain from a URL
 * @param {string|null|undefined} url - The URL to extract the domain from
 * @returns {string} The base domain or a fallback value
 */
function getBaseDomain(url) {
  try {
    // Validate URL before processing
    if (!url) {
      console.warn('Empty URL provided to getBaseDomain');
      return 'unknown-domain';
    }
    
    // Handle non-string values
    if (typeof url !== 'string') {
      console.warn('Non-string URL provided to getBaseDomain:', typeof url);
      return 'invalid-url-type';
    }
    
    // Handle URLs without proper protocol
    if (!url.includes('://')) {
      // Simple domain-like strings can still be processed
      if (url.includes('.') && !url.includes(' ')) {
        return url;
      }
      console.warn('Invalid URL format (missing protocol) in getBaseDomain:', url);
      return 'invalid-url-format';
    }
    
    const urlObj = new URL(url);
    // Extract hostname and remove 'www.' if present
    let hostname = urlObj.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch (e) {
    console.error('Error extracting base domain:', e);
    return 'parse-error'; // Return a descriptive error value if parsing fails
  }
}

/**
 * Processes a tool call and returns the result
 * Currently only handles web_search tools
 */
async function executeToolCall(apiKey, toolCall) {
  try {
    // Validate toolCall structure
    if (!toolCall) {
      console.error('Tool call is undefined or null');
      return 'Error: Invalid tool call data received.';
    }
    
    if (toolCall.type !== 'function' || !toolCall.function) {
      console.log('Unsupported tool type or missing function property:', toolCall);
      return `Unsupported tool type: ${toolCall.type || 'unknown'}`;
    }
    
    const name = toolCall.function.name || 'unknown';
    let args = {};
    
    try {
      if (toolCall.function.arguments) {
        args = JSON.parse(toolCall.function.arguments);
      } else {
        console.warn('Missing arguments in tool call:', toolCall);
      }
    } catch (e) {
      console.error('Error parsing tool arguments:', e, toolCall.function.arguments);
      return `Error parsing tool arguments for ${name}: ${e.message}`;
    }
    
    // Handle web_search function
    if (name === 'web_search' && args.query) {
      console.log('Executing web_search with query:', args.query);
      // In a real implementation, this would perform an actual web search
      // For now, we're returning a placeholder
      return `Results for search query "${args.query}":\n` +
             `- This would contain actual search results from the web\n` +
             `- The results would be processed and formatted for the AI to continue\n` +
             `- In a complete implementation, this would use a real search provider`;
    }
    
    console.log('Unsupported function called:', name, args);
    return `Unsupported function: ${name}`;
  } catch (error) {
    // Catch-all error handler to ensure we always return a string
    console.error('Unexpected error in executeToolCall:', error);
    return `Error executing tool: ${error.message}`;
  }
}

/**
 * Handles sequential API calls when tool execution is required
 * This function will:
 * 1. Process the initial API response
 * 2. Execute any tool calls
 * 3. Make a follow-up API call with the tool results if needed
 */
async function handleSequentialApiCalls(apiKey, initialResponse, model, messages) {
  try {
    console.log('Starting sequential API calls handling...');
    
    // Validate input parameters
    if (!apiKey) {
      console.error('Missing API key in handleSequentialApiCalls');
      return 'Error: API key is required for sequential API calls.';
    }
    
    if (!model) {
      console.error('Missing model in handleSequentialApiCalls');
      return 'Error: Model specification is required for sequential API calls.';
    }
    
    if (!Array.isArray(messages)) {
      console.error('Invalid messages format in handleSequentialApiCalls:', typeof messages);
      return 'Error: Invalid message format for sequential API calls.';
    }
    
    // Extract the message from the response
    if (!initialResponse || !initialResponse.choices || 
        !initialResponse.choices.length || !initialResponse.choices[0].message) {
      console.error('Invalid response structure for tool handling', initialResponse);
      return 'Error: Received an invalid response structure from the API.';
    }
    
    console.log('Initial response is valid, extracting message...');
    const message = initialResponse.choices[0].message;
    console.log('Message extracted, tool_calls present:', !!message.tool_calls);
    
    // CRITICAL: Check specifically for tool calls first
    if (!message.tool_calls || !message.tool_calls.length) {
      console.log('No tool calls found in the message, returning content if available');
      
      // No tool calls, handle content
      if (message.content === null) {
        return 'Received an empty response with no tool calls. Please try again.';
      }
      
      if (typeof message.content === 'string' && message.content !== null) {
        try {
          return message.content.trim();
        } catch (trimError) {
          console.error('Error trimming message content:', trimError);
          return message.content; // Return untrimmed content if trim fails
        }
      }
      
      return 'Received an unexpected response format with no tool calls.';
    }
    
    console.log('Processing tool calls:', message.tool_calls);
    
    // Process all tool calls and get results
    const toolResults = [];
    for (const toolCall of message.tool_calls) {
      try {
        const result = await executeToolCall(apiKey, toolCall);
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: result
        });
      } catch (toolError) {
        console.error('Error executing tool call:', toolError);
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: `Error: ${toolError.message}`
        });
      }
    }
    
    // If we have tool results, make a follow-up API call
    if (toolResults.length > 0) {
      console.log('Making follow-up API call with tool results:', toolResults);
      
      // Prepare messages for the follow-up call
      const followUpMessages = [
        ...messages, // Include original system and user messages
        message,     // Include the assistant's message with tool_calls
        ...toolResults // Include the tool results
      ];
      
      console.log('Follow-up messages structure:', JSON.stringify(followUpMessages, null, 2));
      
      try {
        // Make the follow-up API call
        const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: followUpMessages,
            temperature: 0.3,
            max_tokens: 500
          })
        });
        
        if (!followUpResponse.ok) {
          const errorText = await followUpResponse.text();
          console.error('Follow-up API error response:', errorText);
          
          try {
            if (errorText && errorText.trim().startsWith('{')) {
              const errorJson = JSON.parse(errorText);
              throw new Error(errorJson.error?.message || `Follow-up API Error: ${followUpResponse.status}`);
            }
          } catch (e) {
            console.error('Error parsing error response:', e);
          }
          
          throw new Error(`Follow-up API Error: ${followUpResponse.status} ${followUpResponse.statusText}`);
        }
        
        // Get response as text first for better error handling
        const followUpResponseText = await followUpResponse.text();
        console.log('Follow-up response text length:', followUpResponseText.length);
        
        // Parse the response text as JSON
        let followUpData;
        try {
          followUpData = JSON.parse(followUpResponseText);
        } catch (parseError) {
          console.error('Error parsing follow-up response:', parseError);
          return 'Error: Failed to parse the follow-up API response.';
        }
        
        console.log('FOLLOW-UP API RESPONSE:', JSON.stringify(followUpData, null, 2));
        
        // Safe extraction of the final answer from the follow-up response
        if (!followUpData.choices || !followUpData.choices.length || !followUpData.choices[0].message) {
          console.error('Invalid follow-up response structure', followUpData);
          return 'Error: Received an invalid structure in the follow-up response.';
        }
        
        const followUpMessage = followUpData.choices[0].message;
        
        // Handle potential null content in follow-up response (unlikely but possible)
        if (followUpMessage.content === null) {
          console.warn('Follow-up response has null content', followUpData);
          return 'The web search was completed, but I received an empty follow-up response. Please try asking again.';
        }
        
        // Case 2: Normal content case (with proper null check)
        if (typeof followUpMessage.content === 'string' && followUpMessage.content !== null) {
          // Use a safe trim operation with multiple checks
          try {
            return followUpMessage.content.trim();
          } catch (trimError) {
            console.error('Error trimming follow-up message content:', trimError);
            return followUpMessage.content; // Return untrimmed content if trim fails
          }
        }
        
        return 'Received an unexpected format in the follow-up response.';
      } catch (followUpError) {
        console.error('Error in follow-up API call:', followUpError);
        return `Error in follow-up request: ${followUpError.message}`;
      }
    } else {
      // No tool results processed, return a fallback message
      return 'The tool execution did not return any results. Please try again.';
    }
  } catch (error) {
    console.error('Error in sequential API calls:', error);
    return `Error processing your request: ${error.message}`;
  }
} 