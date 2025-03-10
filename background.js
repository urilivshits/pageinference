/**
 * Page Inference - Background Script
 * 
 * This script runs in the background and is responsible for:
 * 1. Handling message communication between content script and popup
 * 2. Sending requests to the OpenAI API
 * 3. Storing and retrieving API key from Chrome storage
 */

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
            sendResponse({ content: response.content });
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
        const result = await getOpenAiInference(
          data.openAiApiKey,
          request.content,
          request.question
        );
        sendResponse({ answer: result });
      } catch (error) {
        sendResponse({ error: error.message || 'Error getting inference from OpenAI API' });
      }
    });
    return true;
  }
});

/**
 * Sends a request to the OpenAI API for inference
 * @param {string} apiKey - The OpenAI API key
 * @param {string} pageContent - The scraped page content
 * @param {string} question - The user's question
 * @returns {Promise<string>} - The inference result
 */
async function getOpenAiInference(apiKey, pageContent, question) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that answers questions based on the provided webpage content. Give concise and accurate answers based solely on the information in the content provided. If the answer cannot be found in the content, state that clearly.'
          },
          {
            role: 'user',
            content: `Here is the content of a webpage:\n\n${pageContent}\n\nBased on this content, please answer the following question: ${question}`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
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