# 🤖 Browse Buddy: AI Assistant with Page Reading and Search

*Made with love for my brilliant wife, who deserves all the help browsers can give.*

## What is this delightful thing?

Browse Buddy: AI Assistant with Page Reading and Search is a Chrome extension I built for my amazing wife Iuliia, bringing AI assistance directly to her browsing experience. Think of it as her personal AI assistant that actually knows what web page she's on – because she deserves technology that just works.

## ✨ Features That Actually Work

### 🤖 AI Models & Intelligence
Choose between two powerful AI models, each with automatic page content analysis:
- **GPT-4.1 nano**: The newest, fastest, and most cost-effective model - perfect for daily browsing tasks
- **GPT-4.1** (Default): The powerhouse reasoning model with **real-time web search** for complex research and current information

#### Model Specifications
| Model | Context Window | Cost (Input/Output) | Page Content Scraping | Web Search | Best For | Key Benchmarks |
|-------|----------------|-------------------|---------------------|------------|----------|----------------|
| **GPT-4.1 nano** | 1M tokens | $0.10/$0.40 per million | ✅ Always enabled | ❌ Disabled for speed | Daily tasks, quick questions | 80.1% MMLU, 50.3% GPQA, 74.5% IFEval |
| **GPT-4.1** | 1M tokens | $2.00/$8.00 per million | ✅ Always enabled | ✅ Real-time information | Complex reasoning, research | 90.2% MMLU, 66.3% GPQA, 87.4% IFEval, 54.6% SWE-Bench |

### ⌨️ Smart Click Behavior
The extension remembers your last question and can repeat it automatically on different pages - perfect for analyzing multiple similar pages with the same prompt.

- **Manual Mode** (recommended): 
  - Normal click on Chrome extension icon: Just opens the extension normally
  - Ctrl+click (⌘+click on Mac): Opens the extension AND automatically repeats your last question on the current page
- **Auto Mode**: 
  - Normal click on Chrome extension icon: Opens the extension AND automatically repeats your last question on the current page
  - Ctrl+click (⌘+click on Mac): Just opens the extension normally
- **Disabled Mode**: Always just opens the extension (no automatic question repeating)

**Example**: Ask "What are this person's key skills?" on one LinkedIn profile, then Ctrl+click (⌘+click on Mac) the extension icon on other profiles for instant analysis.

### 📱 Interface & Experience
- **Chat History**: Organized by website domain with search and filtering because we're not animals
- **Dark/Light Themes**: Because your retinas matter
- **Stars Animation**: Magical falling stars cascade from top-right to bottom-left when you open the extension. Shows automatically on first install, then you can control it in settings (it's the little things)
- **Message Timestamps**: See exactly when you asked that embarrassing question
- **Copy Messages**: Share the AI's wisdom with the world
- **Temperature Control**: Adjust response creativity (0.0 = robotic, 1.0 = artistic)
- **Multiple Sessions**: Context switching without losing your conversation threads

## 🚀 Getting Started

### Prerequisites
- A Chrome browser (or Chromium-based browser with extension support)
- An OpenAI API key ([get one here](https://platform.openai.com/api-keys))
- A sense of humor about delightful stars animations

### Installation
1. **Load the Extension**: 
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" and select the extension folder
   
2. **Add Your API Key**:
   - Click the extension icon in your toolbar
   - Click on Iuliia's profile icon in the top right
   - Paste your OpenAI API key and hit Save
   - Your key is stored locally and only used for OpenAI API calls (no other servers involved)

3. **Start Chatting**:
   - Navigate to any website
   - Click the extension icon
   - Ask the AI about the page, or anything really
   - Watch the magic happen ✨

## 🎮 How to Use

### Basic Usage
1. Click the extension icon
2. Type your question
3. Hit Enter and enjoy intelligent responses with page context

### Power Moves
- **Model Switching**: Change between nano/full GPT-4.1 via the profile icon
- **Repeat Questions**: Use Ctrl+click (⌘+click on Mac) behavior (configurable in settings)
- **Domain Focus**: Filter chats to show only current website conversations
- **Theme Toggle**: Switch between light/dark modes
- **Keyboard Shortcuts**: Ctrl+1-3 (⌘+1-3 on Mac) to switch between tabs

## 🛡️ Privacy & Security

- **Local Storage Only**: Your API key and conversations stay in your browser
- **No Data Collection**: Everything stays local except direct OpenAI API calls
- **Open Source**: All code is visible and auditable
- **Privacy-First Page Reading**: Page content is only read when you click the send button (not when opening the extension), and only once per conversation for maximum privacy

## 🐛 Known Quirks

- The falling stars animation is non-negotiable (feature, not bug); it brings cosmic joy
- Sometimes the AI gets a little too excited about page content
- Ctrl+click behavior requires JavaScript to be enabled (shocking, we know)
- The extension popup has a fixed size because responsive design is for websites

## 🤝 Contributing

Found a bug? Want to add a feature? Have strong opinions about falling stars? I'm all ears:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (the stars must continue to fall gracefully)
5. Submit a pull request with a detailed description

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details (or just assume it's the usual "do whatever you want but don't blame me" license).

## 🙏 Acknowledgments

- Iuliia, for being the inspiration and the reason this exists
- OpenAI for making AI assistance accessible
- The Chrome Extension team for making browser extensions not completely terrible
- Coffee, for making this project possible
- Anyone reading this (but especially Iuliia ❤️)

---

*Built with ❤️ for the most wonderful woman in the world* 