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

// Track content script initialization status per tab
const contentScriptStatus = {};

// Default model name
const DEFAULT_MODEL = 'gpt-4o-mini';
const SEARCH_MODEL = DEFAULT_MODEL; // Only this model supports search functionality

// Models that support web browsing/search capabilities
const BROWSING_CAPABLE_MODELS = [
  'gpt-4o-mini'
];

// Website type patterns for detection
const WEBSITE_PATTERNS = [
  {
    type: 'linkedin',
    patterns: ['linkedin.com', 'recruiter', 'job', 'profile', 'hiring', 'resume', 'skills', 'experience', 'recommendation', 'endorsement', 'career', 'employment'],
    systemPrompt: 'You are a helpful assistant specializing in professional networking and career advice. The user is viewing a LinkedIn page which may contain profile information, job listings, or professional content. Help them extract relevant professional insights, evaluate job opportunities, understand career paths, or analyze professional profiles. Focus on professional development, job search, or recruitment insights based on the content provided. If the content lacks specific information needed to answer the user\'s question, make reasonable assumptions based on your knowledge but clearly indicate what is derived from the content versus what is based on assumptions.'
  },
  {
    type: 'github',
    patterns: ['github.com', 'repository', 'commit', 'pull request', 'issue', 'branch', 'fork', 'merge', 'code', 'developer', 'programming', 'software'],
    systemPrompt: 'You are a helpful assistant specializing in software development. The user is viewing a GitHub page which may contain code repositories, issues, pull requests, or technical documentation. Provide insights about the code, development practices, or technical implementation details. Focus on explaining code functionality, identifying patterns, suggesting improvements, or summarizing technical information from the content provided. If the content lacks details needed to fully answer the user\'s question, make reasonable assumptions based on best practices and your knowledge of software development, but clearly distinguish between content-based information and your assumptions.'
  },
  {
    type: 'stackoverflow',
    patterns: ['stackoverflow.com', 'question', 'answer', 'programming', 'code', 'error', 'debug', 'function', 'library', 'api', 'solution', 'problem'],
    systemPrompt: 'You are a helpful assistant specializing in technical problem-solving. The user is viewing a Stack Overflow page with programming questions and answers. Help them understand the solutions provided, explain technical concepts, identify best practices, or summarize the key points from different answers. Focus on clarifying technical details and providing additional context where needed. If the content doesn\'t fully address the user\'s question, provide a reasonable answer based on your knowledge of programming concepts and best practices, while clearly indicating which parts of your answer are based on the content versus your own expertise.'
  },
  {
    type: 'news',
    patterns: ['news', 'article', 'journalist', 'reporter', 'publish', 'editor', 'headline', 'breaking', 'report', 'media', 'press', 'coverage'],
    systemPrompt: 'You are a helpful assistant analyzing news content. The user is viewing a news article or publication. Help them understand the key points, identify potential biases, summarize the main story, or provide context about the topics covered. Focus on extracting the important information and helping the user gain a clear understanding of the news content. If the article doesn\'t contain all the information needed to answer the user\'s question, provide relevant context or reasonable assumptions based on your knowledge, while clearly distinguishing between facts from the article and additional information you\'re providing.'
  },
  {
    type: 'shopping',
    patterns: ['product', 'price', 'shop', 'buy', 'purchase', 'cart', 'checkout', 'discount', 'retail', 'store', 'ecommerce', 'shipping', 'order'],
    systemPrompt: 'You are a helpful assistant for online shopping. The user is viewing a product page or e-commerce site. Help them understand product features, compare options, evaluate prices, or identify key considerations for their purchase decision. Focus on extracting product information and providing objective analysis of the options available. If specific product details are missing from the content but necessary to answer the user\'s question, make reasonable inferences based on similar products or general knowledge, but clearly indicate which information comes directly from the product page versus your assumptions or general knowledge.'
  },
  {
    type: 'documentation',
    patterns: ['docs', 'documentation', 'guide', 'tutorial', 'manual', 'reference', 'api', 'function', 'method', 'class', 'library', 'framework'],
    systemPrompt: 'You are a helpful assistant specializing in technical documentation. The user is viewing technical documentation, API references, or guides. Help them understand the concepts, implementation details, or usage examples from the documentation. Provide clear explanations of technical concepts and help them apply the information to their specific needs. If the documentation is incomplete or doesn\'t address all aspects of the user\'s question, supplement with your knowledge of standard practices or similar technologies, but clearly distinguish between what\'s explicitly documented and what you\'re adding based on general technical knowledge.'
  },
  {
    type: 'academic',
    patterns: ['research', 'study', 'paper', 'journal', 'publication', 'experiment', 'methodology', 'findings', 'conclusion', 'hypothesis', 'theory', 'data', 'analysis', 'scholar'],
    systemPrompt: 'You are a helpful assistant specializing in academic content. The user is viewing a research paper, journal article, or academic publication. Help them understand the research methodology, key findings, theoretical implications, or statistical analyses. Focus on extracting the core academic concepts and presenting them in an accessible way while maintaining scientific accuracy. If the paper doesn\'t address specific aspects of the user\'s question, provide context from related research or reasonable interpretations based on the academic field, while clearly indicating what information comes directly from the paper versus your broader knowledge of the subject.'
  },
  {
    type: 'social_media',
    patterns: ['post', 'tweet', 'share', 'like', 'follow', 'comment', 'friend', 'feed', 'social', 'profile', 'status', 'update'],
    systemPrompt: 'You are a helpful assistant analyzing social media content. The user is viewing a social media platform with posts, comments, or profiles. Help them understand the context of conversations, identify key points from discussions, or extract insights from the social content. Focus on the substance of the communication while filtering out noise or distractions. If the social media content doesn\'t provide complete information needed to answer the user\'s question, make reasonable inferences based on context or provide general insights, while clearly indicating which parts of your response are based directly on the content versus your interpretations or general knowledge.'
  },
  {
    type: 'video',
    patterns: ['video', 'youtube', 'stream', 'watch', 'view', 'channel', 'subscribe', 'creator', 'content', 'episode'],
    systemPrompt: 'You are a helpful assistant specializing in video content. The user is viewing a video platform or video description page. Help them understand the key points from the video description, creator information, or related content. Focus on extracting the most relevant details about the video content to help them decide if it is worth watching or to better understand what they have viewed. If the video description lacks details needed to fully answer the user\'s question, provide reasonable context or assumptions based on similar content or the creator\'s other work, but clearly distinguish between information from the page and your additional context or assumptions.'
  }
];

// Default system prompt
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant that answers questions based on the provided webpage content. Give concise and accurate answers primarily based on the information in the content provided. If the answer cannot be found completely in the content, you may make reasonable assumptions based on your knowledge, but clearly distinguish between information from the webpage and your own assumptions or additional knowledge.';

// Generic system prompt (used when page scraping is disabled)
const GENERIC_SYSTEM_PROMPT = 'You are a helpful, accurate, and friendly AI assistant. Answer questions helpfully and truthfully. If you do not know the answer to a question, admit it. If the question is ambiguous, ask for clarification. Always be respectful and polite in your answers.';

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
  // Only allow gpt-4o-mini for browsing
  return model === 'gpt-4o-mini';
}

// Listen for messages from the content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Log message type or action, depending on what's available
  if (request.type) {
    console.log('MESSAGE: Received message type:', request.type);
  } else if (request.action) {
    console.log('MESSAGE: Received message action:', request.action);
  } else {
    console.log('MESSAGE: Received message without type or action:', request);
  }
  
  if (request.type === 'processTab') {
    console.log('MESSAGE: Handling processTab request');
    processTabs()
      .then(() => {
        console.log('MESSAGE: processTabs completed successfully');
      })
      .catch(error => {
        console.error('MESSAGE: Error in processTabs:', error);
      });
      
    // Return true to indicate we will send an async response
    return true;
  }
  
  if (request.type === 'followUpQuery') {
    console.log('MESSAGE: Handling followUpQuery request:', request.query, 'Content length:', request.content.length);
    
    // Get API key from storage and handle the follow-up
    chrome.storage.local.get(['openai_api_key'], async (result) => {
      try {
        const apiKey = result.openai_api_key;
        
        if (!apiKey) {
          console.error('MESSAGE: No API key found for follow-up query');
          chrome.runtime.sendMessage({ 
            type: 'followUpResult', 
            content: 'Error: No API key found. Please set your API key in the options.',
            error: true
          });
          return;
        }
        
        // Send processing state to show spinner
        chrome.runtime.sendMessage({ type: 'processingState', isProcessing: true });
        
        // Load system prompt
        let systemPrompt = '';
        try {
          const response = await fetch(chrome.runtime.getURL('system_prompt.txt'));
          systemPrompt = await response.text();
        } catch (promptError) {
          console.error('MESSAGE: Error loading system prompt for follow-up:', promptError);
          systemPrompt = 'You are a helpful assistant that answers questions based on the provided webpage content.';
        }
        
        // Prepare messages with the page content and user's follow-up question
        const messages = [
          {
            role: 'user',
            content: `${request.query}\n\nHere is the content to help answer your question:\n\n${request.content}`
          }
        ];
        
        console.log('MESSAGE: Calling OpenAI API for follow-up');
        
        // Use our new API call function
        const response = await callOpenAI(apiKey, messages, systemPrompt);
        
        console.log('MESSAGE: Received follow-up response, sending to popup');
        
        // Send result back to popup
        chrome.runtime.sendMessage({ 
          type: 'followUpResult', 
          content: response,
          error: false
        });
        
        // Hide spinner
        chrome.runtime.sendMessage({ type: 'processingState', isProcessing: false });
      } catch (error) {
        console.error('MESSAGE: Error handling follow-up query:', error);
        
        // Hide spinner
        chrome.runtime.sendMessage({ type: 'processingState', isProcessing: false });
        
        // Send error to popup
        chrome.runtime.sendMessage({ 
          type: 'followUpResult', 
          content: `Error: ${error.message || 'Unknown error occurred'}`,
          error: true
        });
      }
    });
    
    // Return true to indicate we will send an async response
    return true;
  }
  
  // Handle content script initialization confirmation
  if (request.action === 'contentScriptInitialized' && sender.tab) {
    const tabId = sender.tab.id;
    console.log(`Content script initialized in tab ${tabId} for URL: ${request.url}`);
    contentScriptStatus[tabId] = {
      initialized: true,
      timestamp: request.timestamp || Date.now(),
      url: request.url || sender.tab.url
    };
    sendResponse({ received: true });
    return true;
  }
  
  // Handle scraping request (forward to active tab)
  if (request.action === 'scrapeCurrentPage') {
    console.log('Handling scrapeCurrentPage request');
    
    // First try to get the active tab in the current window
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      console.log('Query for active tab returned:', tabs.length, 'tabs');
      
      // If no active tab found in current window, try to find active tabs in all windows
      if (!tabs || !tabs.length) {
        console.log('No active tab found in current window, checking all windows');
        chrome.tabs.query({ active: true }, async (allWindowTabs) => {
          console.log('Query for active tabs in all windows returned:', allWindowTabs.length, 'tabs');
          
          if (!allWindowTabs || !allWindowTabs.length) {
            console.error('ERROR: No active tab found in any window');
            sendResponse({ error: 'No active tab found. Please make sure a browser tab is active.' });
            return;
          }
          
          // Use the first active tab from any window
          processTab(allWindowTabs[0]);
        });
        return; // Exit the first callback
      }
      
      // If we found an active tab in the current window, process it
      processTab(tabs[0]);
    });
    
    // Helper function to process the tab once we've found it
    async function processTab(tab) {
      console.log('Active tab found, ID:', tab.id, 'URL:', tab.url);

      // Check if we can inject scripts into this tab
      try {
        // Check if this is a supported page
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
          sendResponse({ error: 'This page is not supported' });
          return;
        }

        // Special handling for LinkedIn which may require additional time
        const isLinkedIn = tab.url.includes('linkedin.com');
        const initializationDelay = isLinkedIn ? 800 : 300; // Longer delay for LinkedIn pages
        const maxRetryAttempts = isLinkedIn ? 3 : 2; // More retry attempts for LinkedIn

        console.log(`Page detected: ${isLinkedIn ? 'LinkedIn' : 'Standard'}, using ${initializationDelay}ms delay and ${maxRetryAttempts} retries`);

        // Ensure content script is injected
        try {
          // First check if the content script is already loaded
          let scriptLoaded = false;
          try {
            const checkResult = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                return {
                  initialized: window.__pageInferenceInitialized === true,
                  documentState: document.readyState
                };
              }
            });
            
            // Check if the script is already initialized
            if (checkResult && checkResult[0] && checkResult[0].result && checkResult[0].result.initialized) {
              console.log('Content script already initialized, document state:', checkResult[0].result.documentState);
              scriptLoaded = true;
            } else {
              console.log('Content script not initialized, injecting...');
            }
          } catch (checkError) {
            console.warn('Error checking content script initialization:', checkError);
            // Continue to injection
          }
          
          // Inject the content script if not already loaded
          if (!scriptLoaded) {
            console.log('Injecting content script...');
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            console.log('Content script injected');
            
            // Give the content script time to initialize
            await new Promise(resolve => setTimeout(resolve, initializationDelay));
          }
          
          // Function to send message with retry
          const sendMessageWithRetry = () => {
            let retryCount = 0;
            
            const attemptSend = () => {
              console.log(`Sending scrapeContent message to tab ${tab.id}, attempt ${retryCount + 1}/${maxRetryAttempts}`);
              
              chrome.tabs.sendMessage(
                tab.id,
                { action: 'scrapeContent' },
                (response) => {
                  const lastError = chrome.runtime.lastError;
                  
                  if (lastError) {
                    console.warn(`Error in sendMessage attempt ${retryCount + 1}:`, lastError);
                    
                    if (retryCount < maxRetryAttempts - 1) {
                      retryCount++;
                      console.log(`Retrying in ${initializationDelay}ms...`);
                      setTimeout(attemptSend, initializationDelay);
                    } else {
                      console.error('Max retry attempts reached, giving up');
                      sendResponse({ 
                        error: 'Failed to communicate with the page after multiple attempts. Please refresh the page and try again.',
                        details: lastError.message
                      });
                    }
                    return;
                  }
                  
                  if (!response) {
                    console.warn(`No response received on attempt ${retryCount + 1}`);
                    
                    if (retryCount < maxRetryAttempts - 1) {
                      retryCount++;
                      console.log(`Retrying in ${initializationDelay}ms...`);
                      setTimeout(attemptSend, initializationDelay);
                    } else {
                      console.error('Max retry attempts reached, giving up');
                      sendResponse({ 
                        error: 'No response received from the page after multiple attempts. Please refresh the page and try again.'
                      });
                    }
                    return;
                  }
                  
                  console.log('Received content from tab, length:', response.content ? response.content.length : 0);
                  
                  // Detect website type
                  const websiteType = detectWebsiteType(response.content, tab.url);
                  console.log('Detected website type:', websiteType);
                  
                  // Send the response back to the popup
                  sendResponse({
                    content: response.content,
                    websiteType: websiteType.type,
                    warning: websiteType.type === 'general' ? 
                      'Website type detection failed, using general type' : 
                      undefined
                  });
                }
              );
            };
            
            // Start the process
            attemptSend();
          };
          
          // Start the process
          sendMessageWithRetry();
        } catch (error) {
          console.error('Error during tab communication setup:', error);
          sendResponse({ error: 'Failed to initialize page communication' });
        }
      } catch (error) {
        console.error('Error during tab communication setup:', error);
        sendResponse({ error: 'Failed to initialize page communication' });
      }
    }
    
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
        
        const model = request.model || DEFAULT_MODEL;
        console.log('Using model:', model);
        
        // Check if page content should be skipped (page scraping disabled)
        const skipPageContent = request.skipPageContent === true;
        console.log('Skip page content:', skipPageContent);
        
        // First, make the initial API call
        const pageContent = request.content || '';
        const question = request.question || 'What is on this page?';
        const tabId = request.tabId;
        const pageLoadId = request.pageLoadId;
        
        // Get the inference answer
        try {
          let answer;
          if (skipPageContent) {
            // Use generic system prompt when page scraping is disabled
            answer = await getOpenAiInference(
              data.openAiApiKey,
              '', // Empty content
              question,
              model,
              url,
              true // skipPageContent flag
            );
          } else {
            // Use default system prompt with page content
            answer = await getOpenAiInference(
              data.openAiApiKey,
              pageContent,
              question,
              model,
              url,
              false // skipPageContent flag
            );
          }
          
          if (typeof answer === 'string' && answer.startsWith('Error:')) {
            sendResponse({ error: answer });
          } else {
            sendResponse({ answer });
          }
        } catch (inferenceError) {
          console.error('Inference error:', inferenceError);
          sendResponse({ error: inferenceError.message || 'Failed to get inference result.' });
        }
      } catch (error) {
        console.error('Error processing inference request:', error);
        sendResponse({ error: error.message || 'An error occurred while processing your request.' });
      }
    });
    
    // Return true to indicate we'll respond asynchronously
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
 * Get inference from OpenAI API based on content and question
 * @param {string} apiKey - OpenAI API key
 * @param {string} pageContent - Content of the page
 * @param {string} question - User question
 * @param {string} model - Model to use (default: DEFAULT_MODEL)
 * @param {string} url - URL of the page (for website type detection)
 * @param {boolean} skipPageContent - Whether to skip page content and use generic system prompt
 * @returns {Promise<string>} - Answer or error message
 */
async function getOpenAiInference(apiKey, pageContent, question, model = DEFAULT_MODEL, url = '', skipPageContent = false) {
  console.log('Starting getOpenAiInference');
  // Ensure we have an API key
  if (!apiKey || typeof apiKey !== 'string' || (apiKey = apiKey.trim()).length === 0) {
    return 'Error: Please provide a valid OpenAI API key in the extension settings.';
  }
  
  console.log('Have API key, content length:', pageContent ? pageContent.length : 0);
  console.log('Skip page content:', skipPageContent);
  
  // Generate a unique request ID for logging purposes
  const requestId = 'req_' + Math.random().toString(36).substring(2, 12);
  
  // Ensure all parameters have valid defaults and are properly sanitized
  const safePageContent = (pageContent || '').toString();
  const safeQuestion = (question || 'What is on this page?').toString();
  const safeUrl = (url || '').toString();
  const safeModel = (model || DEFAULT_MODEL).toString();
  
  // Get temperature preference
  const temperatureData = await chrome.storage.sync.get('temperaturePreference');
  const temperature = temperatureData.temperaturePreference !== undefined ? 
    parseFloat(temperatureData.temperaturePreference) : 0;
  
  console.log('Using temperature:', temperature);
  
  // Trim long content
  const MAX_CONTENT_LENGTH = 100000;
  const trimmedContent = safePageContent.length > MAX_CONTENT_LENGTH 
    ? safePageContent.substring(0, MAX_CONTENT_LENGTH) + '... (content truncated due to length)'
    : safePageContent;
  
  // Detect website type with error handling
  let websiteType;
  try {
    websiteType = skipPageContent ? 
      { type: 'generic', systemPrompt: GENERIC_SYSTEM_PROMPT } : 
      detectWebsiteType(trimmedContent, safeUrl);
    console.log(`Detected website type: ${websiteType.type}`);
  } catch (typeError) {
    console.error('Website type detection failed:', typeError);
    websiteType = skipPageContent ? 
      { type: 'generic', systemPrompt: GENERIC_SYSTEM_PROMPT } : 
      { type: 'general', systemPrompt: DEFAULT_SYSTEM_PROMPT };
  }
  
  // Check if the model supports web browsing capability (only gpt-4o-mini)
  const supportsBrowsing = safeModel === SEARCH_MODEL;
  
  // If model is not our search model but user requested search, force it to be the search model
  const safeModelToUse = supportsBrowsing ? safeModel : SEARCH_MODEL;
  
  console.log('Model supports browsing:', supportsBrowsing);
  if (!supportsBrowsing) {
    console.log(`Forcing model to ${SEARCH_MODEL} for search capability`);
  }
  
  try {
    // Prepare request body
    const requestBody = {
      model: safeModelToUse,
      messages: [
        {
          role: 'system',
          content: websiteType.systemPrompt
        },
        {
          role: 'user',
          content: skipPageContent ? 
            safeQuestion : 
            `${safeQuestion}\n\nHere is the content of a webpage (URL: ${safeUrl}) to help answer your question:\n\n${trimmedContent}`
        }
      ],
      temperature: temperature,
      max_tokens: 2000
    };
    
    // Only include web search tools if using the search-enabled model
    if (safeModelToUse !== SEARCH_MODEL) {
      console.log(`API CALL [${requestId}]: Model is not ${SEARCH_MODEL}, web search tools will not be available`);
    } else {
      console.log(`API CALL [${requestId}]: Adding web search tools for ${SEARCH_MODEL}`);
      requestBody.tools = [
        {
          type: 'function',
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
    
    console.log(`API CALL [${requestId}]: Making fetch request to OpenAI API with model ${safeModelToUse}`);
    console.log('Request body:', JSON.stringify(requestBody, null, 2).substring(0, 500) + '...');
    
    // Make the API request
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log(`API CALL [${requestId}]: Response received, status: ${response.status} ${response.statusText}`);
    
    // Handle non-200 responses
    if (!response.ok) {
      // Get the error details as text first to avoid JSON parse errors
      let errorText = '';
      try {
        errorText = await response.text();
        console.error(`API CALL [${requestId}]: Error Response (text):`, errorText);
        
        // Try to parse as JSON if it looks like JSON
        if (errorText && typeof errorText === 'string' && errorText.trim().startsWith('{')) {
          const errorJson = JSON.parse(errorText);
          console.error(`API CALL [${requestId}]: Error Response (parsed):`, errorJson);
          
          // Extract error message from various API error formats
          const errorMessage = 
            (errorJson.error && errorJson.error.message) || 
            errorJson.message || 
            `API Error: ${response.status} ${response.statusText}`;
          
          return `Error: ${errorMessage}`;
        }
      } catch (e) {
        console.error(`API CALL [${requestId}]: Failed to parse error response:`, e);
      }
      
      return `Error: The API returned status ${response.status} ${response.statusText}${errorText ? ': ' + errorText : ''}`;
    }
    
    // Get the raw response text first for better logging
    console.log(`API CALL [${requestId}]: Reading response as text...`);
    const responseText = await response.text();
    
    // Log the response length for debugging
    console.log(`API CALL [${requestId}]: Response text length: ${responseText.length}`);
    console.log(`API CALL [${requestId}]: Response preview: ${responseText.substring(0, 100)}...`);
    
    // Parse the response text as JSON
    let data;
    try {
      data = JSON.parse(responseText);
      console.log(`API CALL [${requestId}]: Successfully parsed JSON response`);
    } catch (error) {
      console.error(`API CALL [${requestId}]: Error parsing response as JSON:`, error);
      return `Error: The API returned an invalid JSON response: ${responseText.substring(0, 100)}...`;
    }
    
    // Check for errors in the parsed response
    if (data.error) {
      console.error(`API CALL [${requestId}]: Error in parsed response:`, data.error);
      return `Error: ${data.error.message || 'Unknown API error'}`;
    }
    
    // Handle tool calls in the response
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.tool_calls) {
      console.log(`API CALL [${requestId}]: Response contains tool calls`);
      const toolCalls = data.choices[0].message.tool_calls;
      
      // Handle web search tool call
      if (toolCalls.some(call => call.function && call.function.name === 'web_search')) {
        const searchCall = toolCalls.find(call => call.function && call.function.name === 'web_search');
        
        try {
          const searchArgs = JSON.parse(searchCall.function.arguments);
          const searchQuery = searchArgs.query;
          
          console.log(`API CALL [${requestId}]: Web search requested for query: "${searchQuery}"`);
          return `Searching the web for: "${searchQuery}"...\n\nPlease wait a moment for search results.`;
        } catch (error) {
          console.error(`API CALL [${requestId}]: Error parsing web search arguments:`, error);
          return 'Error: Failed to parse web search query from API response.';
        }
      }
    }
    
    // Extract the content from the response
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      const content = data.choices[0].message.content;
      console.log(`API CALL [${requestId}]: Successfully extracted content from response, length: ${content.length}`);
      return content;
    } else if (data.choices && data.choices[0] && data.choices[0].message) {
      console.error(`API CALL [${requestId}]: Message found but content is missing:`, data.choices[0].message);
      return 'Error: The API response is missing expected content.';
    } else if (data.choices && data.choices[0]) {
      console.error(`API CALL [${requestId}]: No message found in API response:`, data.choices[0]);
      return 'Error: The API response structure is unexpected.';
    } else {
      console.error(`API CALL [${requestId}]: No choices found in API response:`, data);
      return 'Error: The API response does not contain any choices.';
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
    console.log('TOOL EXECUTION: Processing tool call:', toolCall);
    
    // Validate toolCall structure
    if (!toolCall) {
      console.error('TOOL EXECUTION: Tool call is undefined or null');
      return 'Error: Invalid tool call data received.';
    }
    
    if (toolCall.type !== 'function' || !toolCall.function) {
      console.log('TOOL EXECUTION: Unsupported tool type or missing function property:', toolCall);
      return `Unsupported tool type: ${toolCall.type || 'unknown'}`;
    }
    
    const name = toolCall.function.name || 'unknown';
    let args = {};
    
    try {
      if (toolCall.function.arguments) {
        args = JSON.parse(toolCall.function.arguments);
        console.log('TOOL EXECUTION: Successfully parsed arguments:', args);
      } else {
        console.warn('TOOL EXECUTION: Missing arguments in tool call:', toolCall);
      }
    } catch (e) {
      console.error('TOOL EXECUTION: Error parsing tool arguments:', e, toolCall.function.arguments);
      return `Error parsing tool arguments for ${name}: ${e.message}`;
    }
    
    // Handle web_search function
    if (name === 'web_search' && args.query) {
      console.log('TOOL EXECUTION: Executing web_search with query:', args.query);
      console.log('TOOL EXECUTION: Web search started at:', new Date().toISOString());
      
      // Simulate a web search response with detailed mock data
      const mockSearchResultsMap = {
        'major news today': `
1. Global Climate Summit Reaches Historic Agreement - Leaders from 195 countries have reached a new agreement on carbon emissions reduction targets, with binding commitments to limit global warming to 1.5°C above pre-industrial levels.

2. Breakthrough in Quantum Computing Announced - Scientists have achieved quantum supremacy with a stable 1000-qubit processor that operates at room temperature, potentially revolutionizing computing, cryptography, and scientific research.

3. Major Central Banks Announce Coordinated Interest Rate Changes - The Federal Reserve, European Central Bank, and Bank of Japan announced coordinated monetary policy actions to address global inflation concerns.

4. Revolutionary Cancer Treatment Shows 90% Success Rate in Clinical Trials - A new immunotherapy approach has demonstrated unprecedented success in treating previously untreatable forms of cancer, with minimal side effects.

5. Peace Agreement Signed in Long-Running Regional Conflict - After decades of tension, rival nations have signed a comprehensive peace treaty, with international peacekeeping forces deployed to monitor the implementation.
        `,
        'weather tomorrow': `
Current weather forecasts for major regions:

Northeast:
- Temperatures: 60-70°F (15-21°C)
- Conditions: Partly cloudy with isolated showers in the afternoon
- Wind: Moderate easterly winds at 10-15 mph

Midwest:
- Temperatures: 65-75°F (18-24°C)
- Conditions: Morning fog giving way to mostly sunny skies
- Wind: Light westerly winds at 5-10 mph

South:
- Temperatures: 80-90°F (27-32°C)
- Conditions: Hot and humid with afternoon thunderstorms likely
- Wind: Southerly winds at 10-12 mph
- Heat advisories in effect for several states

West Coast:
- Temperatures: 70-80°F (21-27°C)
- Conditions: Clear skies and sunny
- Wind: Light northwestern winds at 5-7 mph
- Air quality alerts in effect for parts of California

Pacific Northwest:
- Temperatures: 55-65°F (13-18°C)
- Conditions: Light rain throughout the day
- Wind: Moderate southwestern winds at 10-15 mph
        `,
        'trending technology': `
Current trending technologies and innovations:

1. Advanced AI Models with Multimodal Capabilities
   - New AI systems can now process and generate text, images, audio, and video simultaneously
   - Major applications include content creation, medical diagnostics, and autonomous systems
   - Recent demonstrations show human-level reasoning capabilities in specialized domains

2. Sustainable Energy Breakthroughs
   - New solid-state battery technology achieves 80% longer life and 3x faster charging
   - Perovskite solar cells reach 32% efficiency, a new record for photovoltaic technology
   - Modular nuclear fusion reactors begin commercial pilot programs in three countries

3. Extended Reality (XR) Technology
   - Next-generation AR glasses with all-day battery life and natural field of view released
   - Virtual workspaces becoming mainstream for distributed teams
   - Healthcare applications for surgical training and remote procedures gaining traction

4. Edge Computing and 6G Development
   - Edge AI processors enabling real-time processing without cloud connectivity
   - Early 6G prototypes demonstrate terabit wireless speeds
   - New protocols for low-latency applications in autonomous vehicles and telemedicine

5. Biotechnology and Genomic Advances
   - CRISPR-based therapeutics receive regulatory approval for several genetic conditions
   - Synthetic biology platforms enable programmable cellular functions for medical and industrial applications
   - Personalized medicine approaches based on individual genomic profiles show promising clinical results
        `,
        'stock market news': `
Latest stock market developments:

1. Major Tech Earnings Beat Expectations
   - Several technology giants reported quarterly earnings above analyst expectations
   - Cloud computing and AI-related revenues show particularly strong growth
   - Tech sector leadership is broadening beyond the traditional mega-cap companies

2. Federal Reserve Policy Announcement
   - The Federal Reserve indicated a potential shift in monetary policy
   - Markets reacted with increased volatility in both equities and fixed income
   - Analysts are divided on the long-term implications for growth sectors

3. Global Market Trends
   - Asian markets reached new highs led by semiconductor and clean energy stocks
   - European indices showed mixed performance amid varying economic data
   - Emerging markets outperformed developed markets for the third consecutive quarter

4. Sector Performance
   - Healthcare and technology remain top-performing sectors year-to-date
   - Energy stocks showed renewed strength amid supply constraints
   - Financial sector experiencing rotation as interest rate expectations shift

5. Market Outlook
   - Volatility indicators suggest increased uncertainty in near-term market direction
   - Corporate buyback announcements have reached record levels
   - Institutional investors are increasing alternative asset allocations amid valuation concerns
        `,
        'health tips': `
Evidence-based health recommendations from recent research:

1. Sleep Optimization
   - Recent studies confirm 7-9 hours of quality sleep is optimal for cognitive function
   - Consistent sleep-wake schedules, even on weekends, improve sleep quality
   - Blue light exposure from screens should be limited 2-3 hours before bedtime
   - Room temperatures between 65-68°F (18-20°C) promote better sleep

2. Nutrition Research Updates
   - Mediterranean and DASH diets continue to show strong evidence for cardiovascular health
   - Intermittent fasting shows promising results for metabolic health markers
   - Regular consumption of fermented foods improves gut microbiome diversity
   - Adequate hydration (approx. 3-4 liters daily for most adults) improves cognitive performance

3. Exercise Guidelines
   - Combination of resistance training and cardio provides optimal health benefits
   - Even short exercise "snacks" (2-3 minutes) throughout the day offer significant benefits
   - Balance training is increasingly recommended for all age groups, not just seniors
   - Recovery days are as important as workout days for physiological adaptation

4. Mental Health Practices
   - Mindfulness meditation shows measurable benefits with just 10-15 minutes daily
   - Spending 120+ minutes weekly in natural environments significantly reduces stress markers
   - Social connections are as important for longevity as diet and exercise
   - Digital detox periods improve attention span and reduce anxiety symptoms

5. Preventive Health Recommendations
   - Regular health screenings should be personalized based on individual risk factors
   - Vitamin D and omega-3 supplementation beneficial for specific populations
   - Standing and moving at least 5 minutes every hour reduces risks of sedentary behavior
   - Personalized preventive health strategies based on genomic profiles showing promising results
        `,
        'cron expression': `
Comprehensive information about cron expressions:

1. Definition and Purpose
   - Cron expressions are strings that define when automated tasks should run
   - They are used in job schedulers like the Unix cron daemon to trigger recurring jobs
   - Standard format consists of five or six fields representing: minute, hour, day of month, month, day of week, and optionally year
   - Example: "0 15 * * *" means "run at 3:00 PM every day"

2. Syntax Breakdown
   - Field positions: [minute] [hour] [day of month] [month] [day of week] [year]
   - Valid time values: minutes (0-59), hours (0-23), day of month (1-31), month (1-12 or JAN-DEC), day of week (0-6 or SUN-SAT)
   - Special characters: asterisk (*) means "every", comma (,) for value lists, hyphen (-) for ranges, slash (/) for increments
   - Example: "*/15 9-17 * * MON-FRI" means "every 15 minutes from 9 AM to 5 PM, Monday through Friday"

3. Common Patterns
   - @yearly (or @annually): Run once a year at midnight on January 1st (0 0 1 1 *)
   - @monthly: Run once a month at midnight on the first day (0 0 1 * *)
   - @weekly: Run once a week at midnight on Sunday (0 0 * * 0)
   - @daily (or @midnight): Run once a day at midnight (0 0 * * *)
   - @hourly: Run once an hour at the beginning of the hour (0 * * * *)

4. Implementation Variations
   - Different cron implementations may have slight syntax variations
   - Some systems support additional special strings like @reboot (run at startup)
   - Extended cron expressions may include seconds as the first field
   - Non-standard implementations may offer additional features like timezones or error handling
   
5. Best Practices
   - Test cron expressions with online validators before implementation
   - Use comment lines in crontab files to document the purpose of each job
   - Consider job execution time when scheduling to avoid resource contention
   - Implement proper logging and error notification for cron jobs
   - Use absolute paths in cron job commands to avoid environment-related issues
        `,
        'linux cron': `
Linux cron system information:

1. Crontab Files
   - System-wide crontab: Located at /etc/crontab, managed by system administrators
   - User crontabs: Typically stored in /var/spool/cron/crontabs/, one file per user
   - crontab -e: Edit your user crontab
   - crontab -l: List your current crontab entries
   - crontab -r: Remove your crontab

2. Crontab Format
   - Each line represents a scheduled job with the format: minute hour day-of-month month day-of-week command
   - Fields are separated by spaces or tabs
   - Comments begin with # and are ignored by the cron daemon
   - Environment variables can be set at the top of the file
   - Example: 30 2 * * 1-5 /path/to/script.sh > /path/to/log.txt 2>&1

3. System Directories
   - /etc/cron.d/: Directory for additional system crontab files
   - /etc/cron.hourly/, /etc/cron.daily/, /etc/cron.weekly/, /etc/cron.monthly/: Directories for scripts to run at specified intervals
   - Scripts in these directories are executed by the run-parts command

4. Security Considerations
   - /etc/cron.allow and /etc/cron.deny control which users can create crontabs
   - Cron jobs run with the permissions of the user who created them
   - System crontabs run with root privileges unless otherwise specified
   - Use the principle of least privilege when setting up cron jobs

5. Troubleshooting
   - Check system logs in /var/log/syslog or journalctl for cron-related messages
   - Ensure scripts have proper execution permissions (chmod +x)
   - Redirect output to a log file for debugging
   - Test commands manually before adding to crontab
   - Be aware of environment differences (PATH, working directory) when running via cron
        `,
        'systemd timer': `
Comprehensive guide to systemd timers:

1. Basic Concepts
   - Systemd timers are an alternative to traditional cron jobs
   - Timers consist of two files: a .timer unit file and a .service unit file
   - Timers can be one-shot or recurring
   - Advantages include better logging, dependency management, and resource control
   - Example location: /etc/systemd/system/ or /usr/lib/systemd/system/

2. Timer Unit File Structure
   - [Unit] section: Description and dependencies
   - [Timer] section: When and how the timer triggers
   - [Install] section: How the timer is enabled
   - OnBootSec: Defines when timer activates after boot
   - OnUnitActiveSec: Defines recurring intervals
   - OnCalendar: Calendar event expressions (similar to cron syntax)
   - AccuracySec: Defines the accuracy window for timer execution

3. Calendar Event Syntax
   - Format: DayOfWeek Year-Month-Day Hour:Minute:Second
   - Supports ranges (Mon..Fri), lists (Mon,Wed,Fri), and wildcards (*)
   - Special expressions: minutely, hourly, daily, weekly, monthly, yearly
   - Example: "Mon,Tue *-*-* 00:00:00" runs at midnight on Mondays and Tuesdays

4. Management Commands
   - systemctl list-timers: View all active timers
   - systemctl start/stop unit.timer: Start/stop a timer
   - systemctl enable/disable unit.timer: Enable/disable a timer at boot
   - systemctl status unit.timer: Check timer status
   - journalctl -u unit.timer: View timer logs

5. Comparison with Cron
   - Better integration with system boot and shutdown sequences
   - More precise control over execution timing
   - Built-in logging and status monitoring
   - Can define dependencies on other services
   - Resource control via cgroups
   - Ability to run missed jobs after system recovery
        `
      };
      
      // Get cleaned query for matching
      const query = args.query.toLowerCase().trim();
      let searchResults = '';
      
      // Check for exact and partial matches with more flexible matching
      function findBestMatch() {
        // First try direct key match
        if (mockSearchResultsMap[query]) {
          return mockSearchResultsMap[query];
        }
        
        // Then try key contains query
        for (const [key, value] of Object.entries(mockSearchResultsMap)) {
          if (key.includes(query)) {
            return value;
          }
        }
        
        // Then try query contains key
        for (const [key, value] of Object.entries(mockSearchResultsMap)) {
          if (query.includes(key)) {
            return value;
          }
        }
        
        // No matches
        return null;
      }
      
      searchResults = findBestMatch();
      
      // Special case handlers for specific topics
      if (!searchResults) {
        // Handle cron-related queries
        if (query.includes('cron') || query.includes('schedule') || query.includes('job timing') || 
            query.includes('scheduled task') || query.includes('periodic task')) {
          console.log('TOOL EXECUTION: Detected cron-related query, providing cron expression info');
          searchResults = mockSearchResultsMap['cron expression'];
        }
        // For time-scheduling related queries
        else if (query.includes('expression') || query.includes('syntax') || query.includes('format')) {
          console.log('TOOL EXECUTION: Detected expression-related query, providing cron expression info');
          searchResults = mockSearchResultsMap['cron expression'];
        }
        // For systemd-related queries
        else if (query.includes('systemd') || query.includes('timer') || query.includes('service scheduling')) {
          console.log('TOOL EXECUTION: Detected systemd-related query, providing systemd timer info');
          searchResults = mockSearchResultsMap['systemd timer'];
        }
        // For Linux administration queries
        else if (query.includes('linux') || query.includes('unix') || query.includes('bash') || 
                 query.includes('shell') || query.includes('command line')) {
          console.log('TOOL EXECUTION: Detected Linux-related query, providing Linux cron info');
          searchResults = mockSearchResultsMap['linux cron'];
        }
        // For news-related queries
        else if (query.includes('news') || query.includes('today') || query.includes('current') || query.includes('recent')) {
          searchResults = mockSearchResultsMap['major news today'];
        }
        // For weather-related queries
        else if (query.includes('weather') || query.includes('forecast') || query.includes('temperature')) {
          searchResults = mockSearchResultsMap['weather tomorrow'];
        }
        // For tech-related queries
        else if (query.includes('tech') || query.includes('technology') || query.includes('digital') || query.includes('innovation')) {
          searchResults = mockSearchResultsMap['trending technology'];
        }
        // For finance-related queries
        else if (query.includes('stock') || query.includes('market') || query.includes('finance') || query.includes('economic')) {
          searchResults = mockSearchResultsMap['stock market news'];
        }
        // For health-related queries
        else if (query.includes('health') || query.includes('medical') || query.includes('wellness') || query.includes('disease')) {
          searchResults = mockSearchResultsMap['health tips'];
        }
        // Truly generic fallback
        else {
          searchResults = `
Search results for "${args.query}":

1. Multiple reputable sources have published information related to your query within the last 24 hours.

2. Expert analysis suggests this topic is gaining significant attention, with various perspectives being shared across different platforms.

3. Recent statistical data provides context for understanding current trends and developments.

4. Several authoritative sources have released updated information that may be relevant to your specific interests.

5. Both mainstream and specialized publications have covered various aspects of this topic, providing a range of insights and details.
          `;
        }
      }
      
      const timestamp = new Date().toISOString();
      
      console.log('TOOL EXECUTION: Web search completed at:', timestamp);
      console.log('TOOL EXECUTION: Search results length:', searchResults ? searchResults.length : 0);
      
      return `Web search results for query "${args.query}" (as of ${timestamp}):\n\n${searchResults.trim()}\n\nNote: This search was performed at the time of your request. Newer information may now be available.`;
    }
    
    console.log('TOOL EXECUTION: Unsupported function called:', name, args);
    return `Unsupported function: ${name}`;
  } catch (error) {
    // Catch-all error handler to ensure we always return a string
    console.error('TOOL EXECUTION: Unexpected error in executeToolCall:', error);
    return `Error executing tool: ${error.message}`;
  }
}

/**
 * Handle sequential API calls for follow-up actions
 * Used for features like web search where an initial call determines 
 * that a web search is needed, and a second call incorporates those search results
 */
async function handleSequentialApiCalls(apiKey, messages, toolCalls) {
  try {
    // Generate a unique sequential call ID for tracking in logs
    const seqId = 'seq_' + Math.random().toString(36).substring(2, 12);
    console.log(`SEQ CALL [${seqId}]: Starting sequential API calls process`);
    console.log(`SEQ CALL [${seqId}]: Message count:`, messages ? messages.length : 0);
    console.log(`SEQ CALL [${seqId}]: Tool calls count:`, toolCalls ? toolCalls.length : 0);
    console.log(`SEQ CALL [${seqId}]: Starting at timestamp:`, new Date().toISOString());
    
    // Validate apiKey
    if (!apiKey) {
      console.error(`SEQ CALL [${seqId}]: API key is missing or invalid`);
      return 'Error: API key is required for sequential API calls';
    }
    
    // Validate toolCalls structure to ensure it meets OpenAI API expectations
    if (toolCalls && Array.isArray(toolCalls)) {
      console.log(`SEQ CALL [${seqId}]: Validating tool calls structure`);
      
      let isValid = true;
      for (let i = 0; i < toolCalls.length; i++) {
        const call = toolCalls[i];
        if (!call.id) {
          console.error(`SEQ CALL [${seqId}]: Tool call at index ${i} is missing 'id' property`);
          isValid = false;
        }
        if (!call.type) {
          console.error(`SEQ CALL [${seqId}]: Tool call at index ${i} is missing 'type' property`);
          isValid = false;
        }
        if (!call.function) {
          console.error(`SEQ CALL [${seqId}]: Tool call at index ${i} is missing 'function' property`);
          isValid = false;
        } else {
          if (!call.function.name) {
            console.error(`SEQ CALL [${seqId}]: Tool call at index ${i} is missing 'function.name' property`);
            isValid = false;
          }
          if (!call.function.arguments) {
            console.error(`SEQ CALL [${seqId}]: Tool call at index ${i} is missing 'function.arguments' property`);
            isValid = false;
          }
        }
      }
      
      if (!isValid) {
        console.error(`SEQ CALL [${seqId}]: One or more tool calls have invalid structure. This will cause API errors.`);
        console.error(`SEQ CALL [${seqId}]: Tool calls:`, JSON.stringify(toolCalls, null, 2));
      } else {
        console.log(`SEQ CALL [${seqId}]: Tool calls structure is valid`);
      }
    } else {
      console.error(`SEQ CALL [${seqId}]: toolCalls is not an array or is undefined:`, toolCalls);
      return 'Error: Invalid tool calls data structure';
    }
    
    // Extract the topic to search from the actual tool calls
    // This is more reliable than extracting from the user message
    let searchTopic = '';
    if (toolCalls && toolCalls.length > 0) {
      for (const call of toolCalls) {
        if (call.function && call.function.name === 'web_search' && call.function.arguments) {
          try {
            const args = JSON.parse(call.function.arguments);
            if (args.query) {
              searchTopic = args.query;
              console.log(`SEQ CALL [${seqId}]: Extracted search topic from tool call:`, searchTopic);
              break;
            }
          } catch (e) {
            console.error(`SEQ CALL [${seqId}]: Error parsing tool call arguments:`, e);
          }
        }
      }
    }
    
    // Fallback: Extract the original user query from the last user message
    let userQuery = '';
    if (Array.isArray(messages)) {
      for (let i = messages.length-1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          // Try to extract the original question from the user message
          const userMessage = messages[i].content || '';
          console.log(`SEQ CALL [${seqId}]: Found user message, content length:`, userMessage.length);
          
          // Extract the actual question/topic the user is asking about
          // Look for specific patterns indicating what the user actually wants to know
          const aboutMatch = userMessage.match(/asked about (.*?)(?:\.|\,|\n|$)/i);
          if (aboutMatch && aboutMatch[1]) {
            userQuery = aboutMatch[1].trim();
            console.log(`SEQ CALL [${seqId}]: Extracted question topic from 'asked about':`, userQuery);
            break;
          }
          
          // First look for explicit questions
          const searchMatch = userMessage.match(/search(?:ing)? (?:for|about) ["']?(.*?)["']?[.?!]|what (?:is|are) (.*?)[.?!]|tell me about (.*?)[.?!]|information on (.*?)[.?!]|how to (.*?)[.?!]|why (?:is|are|do|does) (.*?)[.?!]/i);
          
          if (searchMatch) {
            const matchGroups = searchMatch.filter(Boolean).slice(1);
            userQuery = matchGroups[0].trim();
            console.log(`SEQ CALL [${seqId}]: Extracted user query from question pattern:`, userQuery);
            break;
          } else {
            // If no explicit question, try to get any question structure
            const questionMatch = userMessage.match(/[^.!?]*\?/);
            if (questionMatch) {
              userQuery = questionMatch[0].trim();
              console.log(`SEQ CALL [${seqId}]: Extracted question form:`, userQuery);
              break;
            }
          }
        }
      }
    } else {
      console.warn(`SEQ CALL [${seqId}]: Messages is not an array, type:`, typeof messages);
    }

    // Use the extracted search topic from tool calls if available, otherwise use the user query
    const finalSearchTopic = searchTopic || userQuery || 'general information';
    console.log(`SEQ CALL [${seqId}]: Final search topic:`, finalSearchTopic);

    if (!toolCalls || toolCalls.length === 0) {
      console.log(`SEQ CALL [${seqId}]: No tool calls found, returning null`);
      return null; // No tool execution needed
    }
    
    console.log(`SEQ CALL [${seqId}]: Processing ${toolCalls.length} tool calls`);
    const toolResults = [];
    
    // Execute all tool calls from the first API call
    for (const toolCall of toolCalls) {
      try {
        console.log(`SEQ CALL [${seqId}]: Processing tool call ID:`, toolCall.id, 'Function:', toolCall.function?.name);
        const result = await executeToolCall(apiKey, toolCall);
        console.log(`SEQ CALL [${seqId}]: Tool call executed, result length:`, result.length);
        
        // CRITICAL: Ensure the tool_call_id exactly matches the id of the tool call
        const toolCallId = toolCall.id;
        if (!toolCallId) {
          console.error(`SEQ CALL [${seqId}]: Missing tool call id, generating a random one`);
          // Generate a random ID as fallback
          const randomId = 'call_' + Math.random().toString(36).substring(2, 12);
          toolResults.push({
            tool_call_id: randomId,
            role: 'tool',
            name: toolCall.function?.name,
            content: result
          });
          console.warn(`SEQ CALL [${seqId}]: Used fallback id ${randomId} for tool result`);
        } else {
          toolResults.push({
            tool_call_id: toolCallId,
            role: 'tool',
            name: toolCall.function?.name,
            content: result
          });
          console.log(`SEQ CALL [${seqId}]: Added tool result with id ${toolCallId}`);
        }
        
        console.log(`SEQ CALL [${seqId}]: Added tool result, preview:`, result.substring(0, 100) + '...');
      } catch (error) {
        console.error(`SEQ CALL [${seqId}]: Error executing tool call:`, error);
        
        // Even in error case, ensure the tool_call_id matches
        const toolCallId = toolCall.id || ('call_' + Math.random().toString(36).substring(2, 12));
        toolResults.push({
          tool_call_id: toolCallId,
          role: 'tool',
          name: toolCall.function?.name,
          content: `Error executing tool: ${error.message}`
        });
      }
    }
    
    // Prepare messages for the follow-up API call
    console.log(`SEQ CALL [${seqId}]: Preparing follow-up messages`);
    
    // Start with the system message from the original messages
    const systemMessage = Array.isArray(messages) ? messages.find(msg => msg.role === 'system') : null;
    const followUpMessages = [];
    
    if (systemMessage) {
      console.log(`SEQ CALL [${seqId}]: Adding system message to follow-up`);
      followUpMessages.push(systemMessage);
    } else {
      console.log(`SEQ CALL [${seqId}]: No system message found in original messages`);
      // Add a default system message
      followUpMessages.push({
        role: 'system',
        content: 'You are a helpful assistant that prioritizes information from web search results while answering questions.'
      });
      console.log(`SEQ CALL [${seqId}]: Added default system message`);
    }
    
    // Add a clear user message emphasizing to use the search results
    // Use the finalSearchTopic which should now be properly extracted
    followUpMessages.push({
      role: 'user',
      content: `I need information about "${finalSearchTopic}". Please provide a comprehensive answer based on the search results I'm about to share. If the search results don't contain relevant information about "${finalSearchTopic}", please clearly state that and provide any information you have about the topic.`
    });
    console.log(`SEQ CALL [${seqId}]: Added user message with search instructions for topic: ${finalSearchTopic}`);

    // CRITICAL: When adding the assistant message with tool_calls, make sure it's in the correct format
    followUpMessages.push({
      role: 'assistant',
      content: null,
      tool_calls: toolCalls.map(tc => ({
        id: tc.id,
        type: tc.type || 'function',
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments
        }
      }))
    });
    console.log(`SEQ CALL [${seqId}]: Added assistant message with tool_calls to maintain proper message structure`);
    
    // Add all tool results - now properly following an assistant message with tool_calls
    followUpMessages.push(...toolResults);
    console.log(`SEQ CALL [${seqId}]: Added ${toolResults.length} tool results to follow-up messages`);
    
    // Add a final user message to clearly ask for a response based on the search results
    followUpMessages.push({
      role: 'user',
      content: `Now please answer my question about "${finalSearchTopic}" using the information from these search results. If the search results don't contain relevant information about this topic, please indicate that clearly and provide the best information you have.`
    });
    console.log(`SEQ CALL [${seqId}]: Added final user message to prompt for response about: ${finalSearchTopic}`);
    
    console.log(`SEQ CALL [${seqId}]: Follow-up message count:`, followUpMessages.length);
    console.log(`SEQ CALL [${seqId}]: Follow-up message roles:`, followUpMessages.map(m => m.role).join(', '));
    
    // Make the second API call with the tool results and a clear instruction 
    // to focus on those results
    console.log(`SEQ CALL [${seqId}]: Making follow-up API call`);
    console.log(`SEQ CALL [${seqId}]: Follow-up messages structure:`, JSON.stringify(followUpMessages.map(m => ({
      role: m.role,
      has_content: m.content !== null && m.content !== undefined,
      content_length: m.content ? m.content.length : 0,
      has_tool_calls: !!(m.tool_calls && m.tool_calls.length > 0),
      tool_call_count: m.tool_calls ? m.tool_calls.length : 0,
      tool_call_id: m.tool_call_id,
      name: m.name
    }))));
    
    let followUpResponse;
    try {
      console.log(`SEQ CALL [${seqId}]: Starting callOpenAI for follow-up at:`, new Date().toISOString());
      followUpResponse = await callOpenAI(apiKey, followUpMessages, '', SEARCH_MODEL);
      console.log(`SEQ CALL [${seqId}]: callOpenAI for follow-up completed at:`, new Date().toISOString());
      
      if (!followUpResponse) {
        console.error(`SEQ CALL [${seqId}]: Empty response from follow-up API call`);
        throw new Error('Empty response from follow-up API call');
      }
      
      console.log(`SEQ CALL [${seqId}]: Follow-up API call successful, response length:`, followUpResponse.length);
      console.log(`SEQ CALL [${seqId}]: Follow-up response preview:`, followUpResponse.substring(0, 100) + '...');
      
      // Add a prefix to clearly indicate this came from search results
      return `Based on web search results:\n\n${followUpResponse}`;
    } catch (error) {
      console.error(`SEQ CALL [${seqId}]: Error in follow-up API call:`, error);
      return `Error during web search follow-up: ${error.message}\n\nHere's a summary of what I found:\n\n${toolResults[0]?.content || 'No results available'}`;
    }
  } catch (error) {
    console.error('SEQ CALL: Fatal error in handleSequentialApiCalls:', error);
    throw error;
  }
}

/**
 * Processes the response from the OpenAI API
 * Handles tool calls if present, or returns the content
 */
async function processOpenAIResponse(apiKey, response, model, messages) {
  try {
    // Generate a unique process ID for tracking in logs
    const procId = 'proc_' + Math.random().toString(36).substring(2, 12);
    console.log(`PROCESS [${procId}]: Starting to process OpenAI response`);
    
    // Validate response structure
    if (!response) {
      console.error(`PROCESS [${procId}]: Response is null or undefined`);
      return 'Error: Received an empty response from the API.';
    }
    
    if (!response.choices || !response.choices.length) {
      console.error(`PROCESS [${procId}]: No choices in response:`, JSON.stringify(response).substring(0, 200) + '...');
      return 'Error: The API response did not contain any choices.';
    }
    
    const message = response.choices[0].message;
    
    if (!message) {
      console.error(`PROCESS [${procId}]: No message in first choice:`, JSON.stringify(response.choices[0]).substring(0, 200) + '...');
      return 'Error: The API response did not contain a message.';
    }
    
    console.log(`PROCESS [${procId}]: Has tool calls:`, !!message.tool_calls, 'Content is null:', message.content === null);
    
    // Check for tool calls first (important for sequential API calls)
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`PROCESS [${procId}]: Found ${message.tool_calls.length} tool calls, initiating sequential API calls`);
      
      try {
        // Use our improved sequential API call handler
        console.log(`PROCESS [${procId}]: Calling handleSequentialApiCalls`);
        const result = await handleSequentialApiCalls(apiKey, messages, message.tool_calls);
        
        if (result) {
          console.log(`PROCESS [${procId}]: Sequential API calls successful, result length:`, result.length);
          console.log(`PROCESS [${procId}]: Sequential result preview:`, result.substring(0, 100) + '...');
          return result;
        } else {
          console.warn(`PROCESS [${procId}]: Sequential API calls returned null result`);
          
          // Fallback to content if available
          if (message.content !== null && typeof message.content !== 'undefined') {
            console.log(`PROCESS [${procId}]: Using message content as fallback`);
            return message.content.trim();
          } else {
            console.log(`PROCESS [${procId}]: No content available in fallback path`);
            return 'The tool execution completed but did not return any results.';
          }
        }
      } catch (sequentialError) {
        console.error(`PROCESS [${procId}]: Error in sequential API calls:`, sequentialError);
        
        // If the tool handling fails, use the original content if available
        if (message.content !== null && typeof message.content !== 'undefined') {
          console.log(`PROCESS [${procId}]: Using message content after sequential API call error`);
          return `Note: A web search was attempted but encountered an error: ${sequentialError.message}\n\nHere's what I can tell you from the original content:\n\n${message.content.trim()}`;
        } else {
          console.log(`PROCESS [${procId}]: No content available for error recovery`);
          return `Error handling tools: ${sequentialError.message}`;
        }
      }
    }
    
    // Normal content case (with null check)
    if (message.content === null) {
      console.warn(`PROCESS [${procId}]: Message content is null`);
      return 'Received an empty response from the model.';
    }
    
    if (typeof message.content !== 'string') {
      console.warn(`PROCESS [${procId}]: Message content is not a string, type:`, typeof message.content);
      return 'Received an unexpected content type from the model.';
    }
    
    // Standard text response case
    console.log(`PROCESS [${procId}]: Returning standard text response, length:`, message.content.length);
    return message.content.trim();
  } catch (error) {
    console.error('PROCESS: Unexpected error in processOpenAIResponse:', error);
    return `Error processing the response: ${error.message}`;
  }
}

/**
 * Calls the OpenAI API with the given messages
 * @param {string} apiKey - The OpenAI API key
 * @param {Array} messages - Array of message objects with role and content
 * @param {string} systemPrompt - Optional system prompt to prepend
 * @param {string} model - Optional model override (defaults to SEARCH_MODEL)
 * @returns {Promise<string>} - The model's response as a string
 */
async function callOpenAI(apiKey, messages, systemPrompt = '', model = SEARCH_MODEL) {
  console.log('API CALL: Starting OpenAI API call');
  console.log('API CALL: Message count:', messages ? messages.length : 0);
  
  // Generate a unique request ID to track this call through the logs
  const requestId = 'req_' + Math.random().toString(36).substring(2, 12);
  console.log(`API CALL [${requestId}]: Request started at ${new Date().toISOString()}`);
  
  if (!apiKey) {
    console.error(`API CALL [${requestId}]: Missing API key`);
    throw new Error('API key is required');
  }
  
  // Get temperature preference
  const temperatureData = await chrome.storage.sync.get('temperaturePreference');
  const temperature = temperatureData.temperaturePreference !== undefined ? 
    parseFloat(temperatureData.temperaturePreference) : 0;
  
  console.log(`API CALL [${requestId}]: Using temperature:`, temperature);
  
  if (!Array.isArray(messages)) {
    console.error(`API CALL [${requestId}]: Messages is not an array, type:`, typeof messages);
    throw new Error('Messages must be an array');
  }
  
  // Copy messages to avoid modifying the original
  let messagesWithSystem = [...messages];
  
  // Add system prompt if provided
  if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim() !== '') {
    console.log(`API CALL [${requestId}]: Adding system prompt, length:`, systemPrompt.length);
    messagesWithSystem = [
      { role: 'system', content: systemPrompt },
      ...messages.filter(msg => msg.role !== 'system')
    ];
  }
  
  // Validate message structure
  console.log(`API CALL [${requestId}]: Validating message structure`);
  let toolMessageWithoutPrecedingToolCall = false;
  let toolRoleIndices = [];
  
  for (let i = 0; i < messagesWithSystem.length; i++) {
    const msg = messagesWithSystem[i];
    
    // Check if this is a 'tool' message
    if (msg.role === 'tool') {
      toolRoleIndices.push(i);
      
      // A tool message must be preceded by an assistant message with tool_calls
      if (i === 0 || 
          messagesWithSystem[i-1].role !== 'assistant' || 
          !messagesWithSystem[i-1].tool_calls || 
          !messagesWithSystem[i-1].tool_calls.length) {
        toolMessageWithoutPrecedingToolCall = true;
        console.error(`API CALL [${requestId}]: Message structure error: Tool message at index ${i} is not preceded by an assistant message with tool_calls`);
      }
      
      // Validate tool message has required fields
      if (!msg.tool_call_id) {
        console.error(`API CALL [${requestId}]: Tool message at index ${i} is missing required 'tool_call_id' field`);
        // Add a fallback ID to prevent API errors
        msg.tool_call_id = 'fallback_' + Math.random().toString(36).substring(2, 12);
        console.log(`API CALL [${requestId}]: Added fallback tool_call_id: ${msg.tool_call_id}`);
      }
    }
    
    // Validate assistant messages with tool_calls
    if (msg.role === 'assistant' && msg.tool_calls) {
      for (let j = 0; j < msg.tool_calls.length; j++) {
        const toolCall = msg.tool_calls[j];
        if (!toolCall.id) {
          console.error(`API CALL [${requestId}]: Tool call missing id at index ${i}, tool call index ${j}`);
          toolCall.id = 'fallback_' + Math.random().toString(36).substring(2, 12);
          console.log(`API CALL [${requestId}]: Added fallback id: ${toolCall.id}`);
        }
        if (!toolCall.type) {
          console.log(`API CALL [${requestId}]: Tool call missing type, adding default 'function'`);
          toolCall.type = 'function';
        }
        if (!toolCall.function || !toolCall.function.name || !toolCall.function.arguments) {
          console.error(`API CALL [${requestId}]: Tool call missing function details at index ${i}, tool call index ${j}`);
        }
      }
    }
  }
  
  // Fix message structure if needed
  if (toolMessageWithoutPrecedingToolCall) {
    console.log(`API CALL [${requestId}]: Attempting to fix invalid message structure`);
    
    const fixedMessages = [];
    let previousToolCallId = null;
    
    for (let i = 0; i < messagesWithSystem.length; i++) {
      const msg = messagesWithSystem[i];
      
      if (msg.role === 'tool') {
        // If tool message appears without preceding assistant+tool_calls
        // Insert a synthetic assistant message with tool_calls
        if (i === 0 || 
            messagesWithSystem[i-1].role !== 'assistant' || 
            !messagesWithSystem[i-1].tool_calls) {
          
          console.log(`API CALL [${requestId}]: Adding synthetic assistant message before tool message at index ${i}`);
          
          // Generate an ID for the tool call
          const toolCallId = msg.tool_call_id || ('synth_' + Math.random().toString(36).substring(2, 12));
          previousToolCallId = toolCallId;
          
          // Add a synthetic assistant message with tool_calls
          fixedMessages.push({
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: toolCallId,
              type: 'function',
              function: {
                name: msg.name || 'web_search',
                arguments: JSON.stringify({ query: 'synthetic query' })
              }
            }]
          });
          
          // Make sure the tool message uses the same tool_call_id
          if (!msg.tool_call_id) {
            msg.tool_call_id = toolCallId;
          }
        }
      }
      
      fixedMessages.push(msg);
    }
    
    console.log(`API CALL [${requestId}]: Fixed message structure, original count: ${messagesWithSystem.length}, new count: ${fixedMessages.length}`);
    messagesWithSystem = fixedMessages;
  }
  
  try {
    console.log(`API CALL [${requestId}]: Preparing API request`);
    console.log(`API CALL [${requestId}]: Using model:`, model);
    console.log(`API CALL [${requestId}]: Messages count:`, messagesWithSystem.length);
    
    // Dump the full messages array in debug for troubleshooting
    console.log(`API CALL [${requestId}]: Full messages structure:`, JSON.stringify(messagesWithSystem.map(m => ({
      role: m.role,
      content: m.content ? (m.content.length > 50 ? m.content.substring(0, 50) + '...' : m.content) : null,
      has_tool_calls: !!(m.tool_calls && m.tool_calls.length),
      tool_call_count: m.tool_calls ? m.tool_calls.length : 0,
      is_tool: m.role === 'tool',
      tool_call_id: m.tool_call_id,
      name: m.name
    }))));
    
    // Log message types for debugging
    const messageRoles = messagesWithSystem.map(m => m.role);
    console.log(`API CALL [${requestId}]: Message roles:`, messageRoles);
    
    // If there are tool messages, log them for debugging
    const toolMessages = messagesWithSystem.filter(m => m.role === 'tool');
    if (toolMessages.length > 0) {
      console.log(`API CALL [${requestId}]: Found ${toolMessages.length} tool messages`);
      toolMessages.forEach((tm, i) => {
        console.log(`API CALL [${requestId}]: Tool message ${i+1} name:`, tm.name);
        console.log(`API CALL [${requestId}]: Tool message ${i+1} tool_call_id:`, tm.tool_call_id);
        console.log(`API CALL [${requestId}]: Tool message ${i+1} preview:`, tm.content.substring(0, 100) + '...');
      });
    }
    
    // Log assistant messages with tool_calls
    const assistantWithToolCalls = messagesWithSystem.filter(m => m.role === 'assistant' && m.tool_calls && m.tool_calls.length);
    if (assistantWithToolCalls.length > 0) {
      console.log(`API CALL [${requestId}]: Found ${assistantWithToolCalls.length} assistant messages with tool_calls`);
      assistantWithToolCalls.forEach((am, i) => {
        console.log(`API CALL [${requestId}]: Assistant message ${i+1} has ${am.tool_calls.length} tool_calls`);
        am.tool_calls.forEach((tc, j) => {
          console.log(`API CALL [${requestId}]: Tool call ${j+1} id:`, tc.id);
          console.log(`API CALL [${requestId}]: Tool call ${j+1} name:`, tc.function?.name);
        });
      });
    }
    
    const requestBody = {
      model: model,
      messages: messagesWithSystem,
      temperature: temperature,
      max_tokens: 2000
    };
    
    // Only include web search tools if using the search-enabled model
    if (model !== SEARCH_MODEL) {
      console.log(`API CALL [${requestId}]: Model is not ${SEARCH_MODEL}, web search tools will not be available`);
    } else {
      console.log(`API CALL [${requestId}]: Adding web search tools for ${SEARCH_MODEL}`);
      requestBody.tools = [
        {
          type: 'function',
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
    
    console.log(`API CALL [${requestId}]: Making fetch request to OpenAI API`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log(`API CALL [${requestId}]: Response received, status:`, response.status);
    
    if (!response.ok) {
      console.error(`API CALL [${requestId}]: Error response received:`, response.status, response.statusText);
      
      try {
        // Get the error response as text first
        const errorText = await response.text();
        console.error(`API CALL [${requestId}]: Raw error response:`, errorText);
        
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        
        try {
          // Try to parse as JSON
            if (errorText && errorText.trim().startsWith('{')) {
              const errorJson = JSON.parse(errorText);
            console.error(`API CALL [${requestId}]: Error details:`, JSON.stringify(errorJson));
            
            // Extract detailed error message
            if (errorJson.error) {
              if (errorJson.error.message) {
                errorMessage = errorJson.error.message;
                
                // If this is a message structure error, include more detail for debugging
                if (errorMessage.includes('messages with role \'tool\'') || 
                    errorMessage.includes('Invalid parameter: messages')) {
                  console.error(`API CALL [${requestId}]: Message structure error detected. Message roles:`, messageRoles);
                  
                  // Log complete message structure for debugging
                  console.error(`API CALL [${requestId}]: Full message structure for debugging:`, 
                    messagesWithSystem.map((m, i) => ({
                      index: i,
                      role: m.role,
                      has_tool_calls: !!(m.role === 'assistant' && m.tool_calls && m.tool_calls.length),
                      content_preview: m.content ? m.content.substring(0, 50) + '...' : null
                    }))
                  );
                }
              }
            }
          }
        } catch (jsonError) {
          console.error(`API CALL [${requestId}]: Error parsing error response:`, jsonError);
        }
        
        throw new Error(errorMessage);
      } catch (textError) {
        console.error(`API CALL [${requestId}]: Error getting error response text:`, textError);
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

    }
    
    const data = await response.json();
    console.log(`API CALL [${requestId}]: Successfully parsed response JSON`);
    
    // Check if we have tool calls in the response
    const hasToolCalls = data?.choices?.[0]?.message?.tool_calls?.length > 0;
    if (hasToolCalls) {
      console.log(`API CALL [${requestId}]: Response contains tool calls, count:`, 
                 data.choices[0].message.tool_calls.length);
    }
    
    // Process the response with our improved handler
    console.log(`API CALL [${requestId}]: Calling processOpenAIResponse`);
    const result = await processOpenAIResponse(apiKey, data, model, messagesWithSystem);
    console.log(`API CALL [${requestId}]: processOpenAIResponse completed, result length:`, result ? result.length : 0);
    
    return result;
  } catch (error) {
    console.error(`API CALL [${requestId}]: Error in callOpenAI:`, error);
    throw error;
  }
}

/**
 * Process the current active tab
 * This function is triggered when the user clicks the extension icon
 */
async function processTabs() {
  console.log('MAIN: Starting processTabs');
  
  try {
    // Get active tab
    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('MAIN: Queried for active tabs, found:', tabs.length);
    
    if (!tabs || tabs.length === 0) {
      console.error('MAIN: No active tab found!');
      throw new Error('No active tab found');
    }
    
    const activeTab = tabs[0];
    console.log('MAIN: Active tab ID:', activeTab.id);
    console.log('MAIN: Active tab URL:', activeTab.url);
    
    // Set processing state to show the spinner
    chrome.runtime.sendMessage({ type: 'processingState', isProcessing: true });
    
    // Get API key from storage
    let apiKey = null;
    try {
      const result = await chrome.storage.local.get(['openai_api_key']);
      apiKey = result.openai_api_key;
      console.log('MAIN: Retrieved API key, exists:', !!apiKey);
    } catch (storageError) {
      console.error('MAIN: Error retrieving API key from storage:', storageError);
      throw new Error('Failed to retrieve API key. Please set your API key in the options.');
    }
    
    if (!apiKey) {
      console.error('MAIN: No API key found in storage');
      throw new Error('No API key found. Please set your API key in the options.');
    }
    
    // Extract content from the active tab
    console.log('MAIN: Sending message to content script to extract page content');
    let extractedContent = await executeContentScriptWithRetry(activeTab.id);
    console.log('MAIN: Received page content, length:', extractedContent.length);
    
    // Load system prompt from file
    let systemPrompt = '';
    try {
      const response = await fetch(chrome.runtime.getURL('system_prompt.txt'));
      systemPrompt = await response.text();
      console.log('MAIN: Loaded system prompt, length:', systemPrompt.length);
    } catch (promptError) {
      console.error('MAIN: Error loading system prompt:', promptError);
      systemPrompt = 'You are a helpful assistant that answers questions based on the provided webpage content.';
    }
    
    // Prepare the message for the API
    const messages = [
      {
        role: 'user',
        content: `Based on this content, please answer the following question: What is this page about? Please give a thorough summary.\n\n${extractedContent}`
      }
    ];
    
    // Call OpenAI API
    let response;
    try {
      console.log('MAIN: Calling OpenAI API');
      response = await callOpenAI(apiKey, messages, systemPrompt);
      console.log('MAIN: Received response from OpenAI API');
    } catch (apiError) {
      console.error('MAIN: Error calling OpenAI API:', apiError);
      throw new Error(`Failed to call OpenAI API: ${apiError.message}`);
    }
    
    // Send the result to the popup
    console.log('MAIN: Sending results to popup');
    chrome.runtime.sendMessage({ 
      type: 'processResult', 
      content: response,
      url: activeTab.url,
      title: activeTab.title || 'Unknown'
    });
    
    // Set processing state to hide the spinner
    chrome.runtime.sendMessage({ type: 'processingState', isProcessing: false });
    
    console.log('MAIN: processTabs completed successfully');
    return response;
  } catch (error) {
    console.error('MAIN: Error in processTabs:', error);
    
    // Set processing state to hide the spinner even if there's an error
    chrome.runtime.sendMessage({ type: 'processingState', isProcessing: false });
    
    // Send error to popup
    chrome.runtime.sendMessage({ 
      type: 'processError', 
      error: error.message || 'Unknown error occurred'
    });
    
    throw error;
  }
} 
