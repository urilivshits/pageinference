# Page Inference Chrome Extension

A Chrome extension that allows you to ask questions about any webpage using OpenAI's GPT models. The extension extracts the content from the current page and uses OpenAI's API to provide accurate answers based on the page's content.

## Features

- 🔍 Smart content extraction from web pages
- 💬 Ask questions about any webpage
- 🤖 Powered by OpenAI's GPT models (GPT-4o mini, GPT-3.5 Turbo, GPT-4, and GPT-4o)
- 🔒 Secure API key storage
- 🎨 Clean and modern user interface with theme options (light, dark, and system)
- 🌐 Smart website type detection for context-aware responses
- 🔍 Enhanced browsing capabilities for advanced models
- ⚙️ Customizable settings

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory

### Pre-Installation Steps

Before installing, make sure to:

1. Create icon files in the `icons` directory (see the README in that folder)
2. Ensure all files are in place:
   - manifest.json
   - background.js
   - content.js
   - popup.html
   - popup.js
   - styles.css

## Setup

1. Get an OpenAI API key from [OpenAI's website](https://platform.openai.com/account/api-keys)
2. Click the extension icon in Chrome's toolbar
3. Click the settings icon (⚙️)
4. Enter your OpenAI API key
5. Select your preferred model:
   - GPT-4o mini (Default, fastest)
   - GPT-3.5 Turbo (Fast, good balance)
   - GPT-4 (High quality, slower)
   - GPT-4o (Highest quality, with browsing capabilities)
6. Choose your preferred theme (system, light, or dark)
7. Adjust the Response Variety slider to control how creative or precise the AI responses are
8. Click "Save Settings"

## Usage

1. Navigate to any webpage you want to ask questions about
2. Click the extension icon in Chrome's toolbar
3. Type your question in the text area
4. Click "Ask" or press Enter
5. Wait for the response from the AI

## Advanced Features

### Website Type Detection
The extension automatically detects the type of website you're viewing (e.g., LinkedIn, GitHub, documentation, news, etc.) and adjusts its responses to be more relevant to that context.

### Theme Options
Choose between:
- **System**: Automatically matches your browser's theme
- **Light**: Bright theme for daytime use
- **Dark**: Dark theme for reduced eye strain

### Response Variety
Control the creativity level of AI responses:
- **Precise** (0.0): More focused, consistent answers
- **Creative** (1.0): More varied, creative responses
- Default setting is Precise (0.0)

### Enhanced Browsing Support
Advanced models like GPT-4o and GPT-4-turbo include web browsing capabilities to provide more accurate and up-to-date responses.

### Web Search Functionality
The extension now supports web search capabilities with certain AI models (GPT-4o, GPT-4-turbo, and more). When the AI needs additional information to answer your question:

1. It will inform you that it's searching the web for information
2. Execute the search and collect results
3. Return a comprehensive answer that integrates the web search findings
4. All of this happens automatically in a single interaction

## Troubleshooting

### Extension Icon Not Showing
- Make sure you've created the icon files in the `icons` directory as specified in the README there
- Reload the extension in `chrome://extensions/` if you've added the icons after installation

### "Error communicating with page"
- Make sure you're on an active tab with a loaded webpage
- Some websites with strict security policies may block content scripts
- Try refreshing the page and trying again

### API Key Issues
- Double-check that you've entered a valid OpenAI API key
- Make sure your OpenAI account has access to the selected model
- Verify that your API key has sufficient credits/quota

### OpenAI API Errors
- "Rate limit exceeded": Wait and try again later as you've exceeded your API usage limits
- "Invalid model": The selected model may not be available for your API key
- "Token limit exceeded": The page content plus your question may be too long; try a shorter question or use on a page with less content
- "Tool calls processing": If the extension seems to take longer when asking complex questions, it may be processing web search requests in the background

## Development

The extension is built using vanilla JavaScript and follows Chrome's extension best practices. Here's the project structure:

```
├── manifest.json        # Extension configuration
├── popup.html          # Extension popup interface
├── popup.js           # Popup interaction logic
├── styles.css         # UI styling
├── content.js         # Page content extraction
├── background.js      # Background script for API communication
└── icons/             # Extension icons
```

## Testing Guide

To test if the extension is working properly:

1. **Basic Installation Test**
   - After loading the extension, check if the icon appears in the Chrome toolbar
   - Click the icon to verify the popup opens correctly

2. **Content Script Test**
   - Navigate to a simple webpage like Wikipedia
   - Click the extension icon and ask a simple question about the page
   - Verify that the content is being extracted correctly

3. **API Integration Test**
   - Enter your OpenAI API key in the settings
   - Ask a specific question about the page content
   - Verify that you receive a relevant answer

4. **Theme Testing**
   - Try each theme option (system, light, dark)
   - Verify the UI adjusts correctly

5. **Edge Cases**
   - Test on complex pages with lots of dynamic content
   - Test on pages with minimal content
   - Test with very specific questions
   - Test with very broad questions
   - Test on different website types to verify context detection

## Security

- Your OpenAI API key is stored securely in Chrome's storage
- All communication with OpenAI's API is done over HTTPS
- The extension only requests necessary permissions
- No data is collected or stored outside of your browser

## Licensing and Commercial Use

This extension is released under the MIT License, which allows for commercial use, modification, distribution, and private use. You are free to:

- Use the extension for commercial purposes
- Charge users for the extension or services built with it
- Modify the code to suit your needs
- Distribute the extension or derivatives

The only requirements are to include the original license and copyright notice with any substantial portion of the code.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Technical Implementation

### Tool Calls and Sequential API Requests
For models with web search capabilities, the extension implements a sequential API call pattern:

1. First API call: The model may respond with tool calls (e.g., web search requests)
2. Tool execution: The extension processes these tool calls
3. Follow-up API call: The results are sent back to the model for a complete answer

This architecture ensures that responses are comprehensive even when they require external information not present on the current page. 