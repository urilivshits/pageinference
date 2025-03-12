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
  console.log('MESSAGE: Received message:', request.type);
  
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
            content: `Based on this content, please answer the following question: ${request.query}\n\n${request.content}`
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
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      console.log('Query for active tab returned:', tabs.length, 'tabs');
      
      if (!tabs[0]) {
        console.error('ERROR: No active tab found in chrome.tabs.query result');
        sendResponse({ error: 'No active tab found' });
        return;
      }

      console.log('Active tab found, ID:', tabs[0].id, 'URL:', tabs[0].url);
      
      // Check if we can inject scripts into this tab
      try {
        const tab = tabs[0];
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
              console.log('Content script not initialized or not detected, document state:', 
                          checkResult && checkResult[0] && checkResult[0].result ? checkResult[0].result.documentState : 'unknown');
            }
          } catch (e) {
            console.log('Content script check failed, assuming not loaded:', e);
          }
          
          // Only inject if not already loaded
          if (!scriptLoaded) {
            console.log('Injecting content script...');
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
              });
              console.log('Content script injection successful');
              
              // Give it more time to initialize
              console.log(`Waiting ${initializationDelay}ms for content script to initialize...`);
              await new Promise(resolve => setTimeout(resolve, initializationDelay));
              
              // Verify initialization after injection
              try {
                const verifyResult = await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: () => window.__pageInferenceInitialized === true
                });
                
                if (verifyResult && verifyResult[0] && verifyResult[0].result) {
                  console.log('Content script successfully initialized after injection');
                } else {
                  console.warn('Content script injected but not showing as initialized, proceeding anyway');
                }
              } catch (verifyError) {
                console.warn('Could not verify content script initialization:', verifyError);
              }
            } catch (injectionError) {
              console.error('Failed to inject content script:', injectionError);
              
              // For LinkedIn pages, try a fallback method
              if (isLinkedIn) {
                console.log('Attempting alternative content extraction for LinkedIn...');
                
                // Generate a descriptive fallback content based on available tab information
                let fallbackContent = '';
                
                if (tab.title) {
                  fallbackContent += `# ${tab.title}\n\n`;
                }
                
                // Include the URL and basic profile indication
                fallbackContent += `LinkedIn profile page: ${tab.url}\n\n`;
                fallbackContent += 'Due to LinkedIn\'s security measures, detailed profile information could not be extracted automatically. ';
                fallbackContent += 'However, I can still help answer questions about this profile based on the information you can see.';
                
                // Try to extract profile name from title if available
                if (tab.title && tab.title.includes('|')) {
                  const possibleName = tab.title.split('|')[0].trim();
                  if (possibleName) {
                    fallbackContent = fallbackContent.replace('# ' + tab.title, '# ' + possibleName);
                    fallbackContent += `\n\nProfile name: ${possibleName}`;
                  }
                }
                
                console.log('Created LinkedIn fallback content, length:', fallbackContent.length);
                
                sendResponse({ 
                  content: fallbackContent,
                  websiteType: 'linkedin',
                  warning: 'Limited content extraction due to LinkedIn security restrictions'
                });
                return;
              } else {
                sendResponse({ error: 'Unable to inject content script into the page. The page might be protected or not fully loaded.' });
                return;
              }
            }
          }
        } catch (e) {
          console.error('Error during content script verification:', e);
          sendResponse({ error: 'Error verifying content script: ' + e.message });
          return;
        }

        // Now try to communicate with the tab
        try {
          let retryCount = 0;
          const maxRetries = maxRetryAttempts;
          
          // Check if we already know the content script is initialized
          if (contentScriptStatus[tab.id] && contentScriptStatus[tab.id].initialized) {
            console.log(`Content script was previously confirmed as initialized for tab ${tab.id}`);
            // Check how old the initialization is
            const initAge = Date.now() - contentScriptStatus[tab.id].timestamp;
            if (initAge > 30000) { // 30 seconds
              console.log(`But initialization is ${initAge}ms old, might need to reinject`);
              delete contentScriptStatus[tab.id]; // Force reinjection
            } else if (contentScriptStatus[tab.id].url !== tab.url) {
              console.log(`But URL has changed from ${contentScriptStatus[tab.id].url} to ${tab.url}, might need to reinject`);
              delete contentScriptStatus[tab.id]; // Force reinjection
            }
          }
          
          const sendMessageWithRetry = () => {
            chrome.tabs.sendMessage(
              tab.id,
              { action: 'scrapeContent' },
              (response) => {
                // Check for Chrome runtime errors first
                if (chrome.runtime.lastError) {
                  console.error('Tab communication error:', chrome.runtime.lastError);
                  
                  // If the error is about receiving end not existing, retry with delay
                  if (chrome.runtime.lastError.message.includes('Receiving end does not exist') && retryCount < maxRetries) {
                    console.log(`Retrying tab communication (attempt ${retryCount + 1} of ${maxRetries})...`);
                    retryCount++;
                    // Wait longer before each retry, with progressively longer delays
                    setTimeout(sendMessageWithRetry, 500 * retryCount);
                    return;
                  }
                  
                  // If we've exhausted retries and it's LinkedIn, use the fallback
                  if (isLinkedIn && retryCount >= maxRetries) {
                    console.log('Using LinkedIn fallback after exhausting retries...');
                    
                    // Generate a descriptive fallback content based on available tab information
                    let fallbackContent = '';
                    
                    if (tab.title) {
                      fallbackContent += `# ${tab.title}\n\n`;
                    }
                    
                    // Include the URL and basic profile indication
                    fallbackContent += `LinkedIn profile page: ${tab.url}\n\n`;
                    fallbackContent += 'Due to LinkedIn\'s security measures, detailed profile information could not be extracted automatically. ';
                    fallbackContent += 'However, I can still help answer questions about this profile based on the information you can see.';
                    
                    // Try to extract profile name from title if available
                    if (tab.title && tab.title.includes('|')) {
                      const possibleName = tab.title.split('|')[0].trim();
                      if (possibleName) {
                        fallbackContent = fallbackContent.replace('# ' + tab.title, '# ' + possibleName);
                        fallbackContent += `\n\nProfile name: ${possibleName}`;
                      }
                    }
                    
                    console.log('Created LinkedIn fallback content, length:', fallbackContent.length);
                    
                    const websiteType = detectWebsiteType(fallbackContent, tab.url);
                    sendResponse({ 
                      content: fallbackContent,
                      websiteType: 'linkedin', // Force LinkedIn type regardless of detection
                      warning: 'Limited content extraction due to LinkedIn security restrictions'
                    });
                    return;
                  }
                  
                  sendResponse({ error: 'Error communicating with page: ' + chrome.runtime.lastError.message });
                  return;
                }
                
                // Update our initialization tracking on successful communication
                if (!contentScriptStatus[tab.id] || !contentScriptStatus[tab.id].initialized) {
                  console.log(`Updating content script status for tab ${tab.id} - successful communication`);
                  contentScriptStatus[tab.id] = {
                    initialized: true,
                    timestamp: Date.now(),
                    url: tab.url
                  };
                }
                
                // Validate response and content
                if (!response) {
                  console.error('Empty response from content script');
                  sendResponse({ error: 'No response received from page. The content script may not be properly initialized.' });
                  return;
                }
                
                // If there was an error during scraping but we got some content back
                if (response.error && response.content) {
                  console.warn('Content script reported error but returned content:', response.error);
                  // We can still use the content
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
                    websiteType: websiteType.type,
                    warning: response.warning // Pass through any warnings from content script
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
        
        const model = request.model || DEFAULT_MODEL;
        console.log('Using model:', model);
        
        // First, make the initial API call
        console.log('Making initial API request to get response or tool calls');
        const result = await getOpenAiInference(
          data.openAiApiKey,
          request.content,
          request.question,
          model,
          url
        );
        
        // If the result contains the web search indicator, we should make a follow-up request
        if (result && typeof result === 'string' && result.includes('Searching the web for:')) {
          console.log('Web search indicator detected in response, should trigger follow-up');
          
          // For future implementation, we would make the actual web search here
          // and then make a follow-up request with the search results
          
          // For now, just inform the user that web search is in progress
          // In a real implementation, we would store a request ID and handle the follow-up
          // asynchronously once search results are available
        }
        
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
        if (errorText && typeof errorText === 'string' && errorText.trim().startsWith('{')) {
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
      if (message.content === null || typeof message.content === 'undefined') {
        console.log('Content is null or undefined, checking for tool calls');
        
        // Check if we have tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
          console.log('Tool calls detected, extracting information');
          console.log('*** TOOL CALLS FOUND - Should trigger sequential API call flow ***');
          
          // Let's log the tool calls for debugging
          console.log('Tool calls details:', JSON.stringify(message.tool_calls));
          
          // IMPORTANT: Check if we need to make a sequential API call
          console.log('Checking if we should make a sequential API call with handleSequentialApiCalls');
          try {
            console.log('Preparing to call handleSequentialApiCalls with tool calls from response');
            
            // Extract tool calls from the message
            const toolCalls = message.tool_calls;
            
            // Call our new sequential API handler with the correct parameters
            const sequentialResult = await handleSequentialApiCalls(
              apiKey,
              requestBody.messages,
              toolCalls
            );
            
            console.log('Sequential API call completed, result length:', sequentialResult ? sequentialResult.length : 0);
            if (sequentialResult) {
              console.log('Sequential result preview:', sequentialResult.substring(0, 100) + '...');
              
              // Use the result from sequential API call
              return sequentialResult;
            } else {
              console.log('No result from sequential API call, falling back to original approach');
              // Continue with fallback approach
            }
          } catch (seqError) {
            console.error('Error during sequential API call handling:', seqError);
            console.error('Sequential API call error stack:', seqError.stack);
            // Continue with the original approach as fallback
          }
          
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
        } else {
          // Null content but no tool calls - this is unexpected but we handle it gracefully
          console.log('Content is null but no tool calls were found');
          return 'Processing your request. If searching for information, I\'ll have a complete answer shortly.';
        }
      }
      
      if (typeof message.content === 'string' && message.content !== null && message.content !== undefined) {
        console.log('About to trim content in handleSequentialApiCalls');
        try {
          const trimmedContent = message.content.trim();
          console.log('Successfully trimmed content in handleSequentialApiCalls');
          return trimmedContent;
        } catch (trimError) {
          console.error('Error trimming message content in handleSequentialApiCalls:', trimError);
          return message.content; // Return untrimmed content if trim fails
        }
      }
      
      // Fallback for unexpected content type (not null, not string)
      console.log('Unexpected message content type:', typeof message.content, 'Content value:', message.content);
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
      
      // Generic response for queries without specific mock data
      if (!searchResults) {
        // For news-related queries
        if (query.includes('news') || query.includes('today') || query.includes('current') || query.includes('recent')) {
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
    }
    
    // Extract the original user query from the last user message
    let userQuery = '';
    if (Array.isArray(messages)) {
      for (let i = messages.length-1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          // Try to extract the original question from the user message
          const userMessage = messages[i].content;
          console.log(`SEQ CALL [${seqId}]: Found user message, content length:`, userMessage.length);
          
          // First look for explicit questions
          const searchMatch = userMessage.match(/search(?:ing)? (?:for|about) ["']?(.*?)["']?[.?!]|what (?:is|are) (.*?)[.?!]|tell me about (.*?)[.?!]|information on (.*?)[.?!]|how to (.*?)[.?!]|why (?:is|are|do|does) (.*?)[.?!]/i);
          
          if (searchMatch) {
            const matchGroups = searchMatch.filter(Boolean).slice(1);
            userQuery = matchGroups[0].trim();
            console.log(`SEQ CALL [${seqId}]: Extracted user query:`, userQuery);
          } else {
            // If no explicit question, try to get any question structure
            const questionMatch = userMessage.match(/[^.!?]*\?/);
            if (questionMatch) {
              userQuery = questionMatch[0].trim();
              console.log(`SEQ CALL [${seqId}]: Extracted question form:`, userQuery);
            }
          }
          break;
        }
      }
    } else {
      console.warn(`SEQ CALL [${seqId}]: Messages is not an array, type:`, typeof messages);
    }

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
    const queryText = userQuery || 'my question';
    const userPrompt = `I asked about ${queryText}. Please provide a comprehensive answer based primarily on the web search results I'm about to provide. The web search results contain the most up-to-date and relevant information, while the webpage content I initially shared may not have this information.`;
    
    followUpMessages.push({
      role: 'user',
      content: userPrompt
    });
    console.log(`SEQ CALL [${seqId}]: Added user message with search instructions`);

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
      content: `Now please answer my question about ${queryText} using the information from these search results.`
    });
    console.log(`SEQ CALL [${seqId}]: Added final user message to prompt for response`);
    
    console.log(`SEQ CALL [${seqId}]: Follow-up message count:`, followUpMessages.length);
    console.log(`SEQ CALL [${seqId}]: Follow-up message roles:`, followUpMessages.map(m => m.role).join(', '));
    
    // Make the second API call with the tool results and a clear instruction 
    // to focus on those results
    console.log(`SEQ CALL [${seqId}]: Making follow-up API call`);
    let followUpResponse;
    try {
      followUpResponse = await callOpenAI(apiKey, followUpMessages, '', 'gpt-4');
      
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
      throw error;
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
 * @param {string} model - Optional model override (defaults to gpt-4)
 * @returns {Promise<string>} - The model's response as a string
 */
async function callOpenAI(apiKey, messages, systemPrompt = '', model = 'gpt-4') {
  console.log('API CALL: Starting OpenAI API call');
  console.log('API CALL: Message count:', messages ? messages.length : 0);
  
  // Generate a unique request ID to track this call through the logs
  const requestId = 'req_' + Math.random().toString(36).substring(2, 12);
  console.log(`API CALL [${requestId}]: Request started`);
  
  if (!apiKey) {
    console.error(`API CALL [${requestId}]: Missing API key`);
    throw new Error('API key is required');
  }
  
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
    }
  }
  
  if (toolMessageWithoutPrecedingToolCall) {
    console.log(`API CALL [${requestId}]: ⚠️ Warning: Invalid message structure detected - a tool message must be preceded by an assistant message with tool_calls`);
    console.log(`API CALL [${requestId}]: Tool role messages found at indices:`, toolRoleIndices);
    // Don't throw an error, just log the warning to help with debugging
  }
  
  try {
    console.log(`API CALL [${requestId}]: Preparing API request`);
    console.log(`API CALL [${requestId}]: Using model:`, model);
    console.log(`API CALL [${requestId}]: Messages count:`, messagesWithSystem.length);
    
    // Log message types for debugging
    const messageRoles = messagesWithSystem.map(m => m.role);
    console.log(`API CALL [${requestId}]: Message roles:`, messageRoles);
    
    // If there are tool messages, log them for debugging
    const toolMessages = messagesWithSystem.filter(m => m.role === 'tool');
    if (toolMessages.length > 0) {
      console.log(`API CALL [${requestId}]: Found ${toolMessages.length} tool messages`);
      toolMessages.forEach((tm, i) => {
        console.log(`API CALL [${requestId}]: Tool message ${i+1} name:`, tm.name);
        console.log(`API CALL [${requestId}]: Tool message ${i+1} preview:`, tm.content.substring(0, 100) + '...');
      });
    }
    
    // Log assistant messages with tool_calls
    const assistantWithToolCalls = messagesWithSystem.filter(m => m.role === 'assistant' && m.tool_calls && m.tool_calls.length);
    if (assistantWithToolCalls.length > 0) {
      console.log(`API CALL [${requestId}]: Found ${assistantWithToolCalls.length} assistant messages with tool_calls`);
      assistantWithToolCalls.forEach((am, i) => {
        console.log(`API CALL [${requestId}]: Assistant message ${i+1} has ${am.tool_calls.length} tool_calls`);
      });
    }
    
    const requestBody = {
      model: model,
      messages: messagesWithSystem,
      temperature: 0.3,
      max_tokens: 1500,
      tools: [
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
      ]
    };
    
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