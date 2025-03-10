# Page Inference Chrome Extension

A Chrome extension that allows you to ask questions about any webpage using OpenAI's GPT models. The extension extracts the content from the current page and uses OpenAI's API to provide accurate answers based on the page's content.

## Features

- 🔍 Smart content extraction from web pages
- 💬 Ask questions about any webpage
- 🤖 Powered by OpenAI's GPT models (GPT-3.5 Turbo and GPT-4)
- 🔒 Secure API key storage
- 🎨 Clean and modern user interface
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
5. Select your preferred model (GPT-3.5 Turbo or GPT-4)
6. Click "Save Settings"

## Usage

1. Navigate to any webpage you want to ask questions about
2. Click the extension icon in Chrome's toolbar
3. Type your question in the text area
4. Click "Ask" or press Enter
5. Wait for the response from the AI

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

4. **Edge Cases**
   - Test on complex pages with lots of dynamic content
   - Test on pages with minimal content
   - Test with very specific questions
   - Test with very broad questions

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