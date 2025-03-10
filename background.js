/**
 * Page Inference - Background Script
 * 
 * This script runs in the background and is responsible for:
 * 1. Handling message communication between content script and popup
 * 2. Sending requests to the OpenAI API
 * 3. Storing and retrieving API key from Chrome storage
 * 4. Managing chat history
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
  'gpt-4-1106-preview'
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
  // Create a combined string for pattern matching
  const combinedText = (content + ' ' + url).toLowerCase();
  
  // Check each website pattern
  for (const website of WEBSITE_PATTERNS) {
    // Count how many patterns match
    const matchCount = website.patterns.filter(pattern => 
      combinedText.includes(pattern.toLowerCase())
    ).length;
    
    // If more than 3 patterns match or the URL directly contains the website type, return it
    if (matchCount >= 3 || url.toLowerCase().includes(website.type)) {
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
  // Handle scraping request (forward to active tab)
  if (request.action === 'scrapeCurrentPage') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: 'scrapeContent' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(chrome.runtime.lastError);
              sendResponse({ error: 'Error communicating with page' });
              return;
            }
            
            // Detect website type
            const websiteType = detectWebsiteType(response.content, tabs[0].url);
            console.log('Detected website type:', websiteType.type);
            
            // Send content and website type
            sendResponse({ 
              content: response.content,
              websiteType: websiteType.type
            });
          }
        );
      } else {
        sendResponse({ error: 'No active tab found' });
      }
    });
    return true; // Keep the message channel open for async response
  }
  
  // Handle API key storage
  if (request.action === 'setApiKey') {
    chrome.storage.sync.set({ openAiApiKey: request.apiKey }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  // Handle API key retrieval
  if (request.action === 'getApiKey') {
    chrome.storage.sync.get('openAiApiKey', (data) => {
      sendResponse({ apiKey: data.openAiApiKey || '' });
    });
    return true;
  }
  
  // Handle inference request
  if (request.action === 'getInference') {
    chrome.storage.sync.get('openAiApiKey', async (data) => {
      if (!data.openAiApiKey) {
        sendResponse({ error: 'API key not found. Please set your API key in the extension options.' });
        return;
      }
      
      try {
        // Get tab URL for website type detection
        let url = request.url || '';
        let pageTitle = '';
        
        if (!url && request.tabId) {
          const tab = await chrome.tabs.get(request.tabId).catch(() => null);
          if (tab) {
            url = tab.url;
            pageTitle = tab.title || '';
          }
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
          const historyKey = `${request.tabId}_${request.url}_${request.pageLoadId}`;
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
        }
        
        sendResponse({ answer: result });
      } catch (error) {
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
 * @param {string} pageContent - The scraped page content
 * @param {string} question - The user's question
 * @param {string} model - The model to use (default: gpt-4o-mini)
 * @param {string} url - The URL of the page (for context detection)
 * @returns {Promise<string>} - The inference result
 */
async function getOpenAiInference(apiKey, pageContent, question, model = DEFAULT_MODEL, url = '') {
  try {
    console.log(`Using model: ${model}`);
    
    // Detect website type
    const websiteType = detectWebsiteType(pageContent, url);
    console.log(`Detected website type: ${websiteType.type}`);
    
    // Check if model supports browsing
    const supportsBrowsing = modelSupportsBrowsing(model);
    console.log(`Model supports browsing: ${supportsBrowsing}`);
    
    // Configure request body based on model capabilities
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'system',
          content: websiteType.systemPrompt
        },
        {
          role: 'user',
          content: `Here is the content of a webpage (URL: ${url}):\n\n${pageContent}\n\nBased on this content, please answer the following question: ${question}`
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    };
    
    // Add tools for browsing-capable models
    if (supportsBrowsing) {
      requestBody.tools = [
        {
          type: 'web_search',
          config: { provider: 'you' }
        }
      ];
      requestBody.tool_choice = 'auto';
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw error;
  }
} 