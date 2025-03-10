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

## Security

- Your OpenAI API key is stored securely in Chrome's storage
- All communication with OpenAI's API is done over HTTPS
- The extension only requests necessary permissions
- No data is collected or stored outside of your browser

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 