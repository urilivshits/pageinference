# 🤖 Browse Buddy: AI Assistant with Page Reading and Search

*Made with love for my brilliant wife, who deserves all the help browsers can give.*

## What is this delightful thing?

Browse Buddy: AI Assistant with Page Reading and Search is a Chrome extension I built for my amazing wife Iuliia, bringing AI assistance directly to her browsing experience. Think of it as her personal AI assistant that actually knows what web page she's on – because she deserves technology that just works.

Perfect for LinkedIn, YouTube, and other places where you need to rate, sum up, look for related news, and more.

![Browse Buddy Demo](assets/images/demo_fhd.gif)

## ✨ Features That Actually Work

### 🤖 AI Models & Intelligence
Choose between two powerful AI models, each with automatic page content analysis:
- **GPT-4.1 nano** (Default): The newest, fastest, and most cost-effective model - perfect for daily browsing tasks
- **GPT-4.1**: The powerhouse reasoning model with **real-time web search** for complex research and current information

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
   - If you don't have an API key set up, you'll see a helpful guidance message
   - Click the profile icon in the top right to open settings
   - Paste your OpenAI API key and hit Save
   - Your key is stored locally and only used for OpenAI API calls (no other servers involved)
   - **Pro tip**: The extension will automatically guide you to set up your API key if you try to use it without one

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

## ❓ Frequently Asked Questions (Because People Will Ask) 🙋‍♀️

### Installation & Setup (The Basics)

**Q: How do I install this magical contraption?**  
A: The usual Chrome extension dance: Download the files, go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", and select the extension folder. You know, the same routine you've done a hundred times because Google won't let us publish decent extensions easily anymore.

**Q: The extension isn't working after installation! 😭**  
A: Let's troubleshoot like civilized humans:
1. Check if the extension is enabled in `chrome://extensions/`
2. Make sure you've added your OpenAI API key (the extension will guide you if you haven't)
3. Try refreshing the page you're on
4. Check the browser console for any error messages
5. If all else fails, try the classic "turn it off and on again" (disable/re-enable the extension)

**Q: Where do I get an OpenAI API key?**  
A: Head over to [OpenAI's API keys page](https://platform.openai.com/api-keys), sign in (or create an account), and generate a new API key. It's like getting a magical password that lets you talk to AI. Keep it secret, keep it safe!

### AI Models & Features (The Smart Stuff)

**Q: What's the difference between GPT-4.1 and GPT-4.1 nano?**  
A: Think of it like choosing between a sports car and a reliable sedan:
- **GPT-4.1 nano** (Default): Fast, efficient, cheaper ($0.10/$0.40 per million tokens) - perfect for daily tasks
- **GPT-4.1**: More powerful, better reasoning, includes web search ($2.00/$8.00 per million tokens) - for complex research

**Q: How does the page reading work?**  
A: When you send a message, the extension automatically reads the current webpage's content and sends it along with your question to the AI. No more copy-pasting! It's like having an AI assistant that actually knows what you're looking at.

**Q: Does the extension read every page I visit?**  
A: **No!** Privacy first, always. The extension only reads page content when you actually send a message, not when you just open the extension or browse around. Your browsing habits stay private.

**Q: What's this "smart click behavior" thing?**  
A: The extension can remember your last question and repeat it automatically on different pages. Perfect for analyzing multiple LinkedIn profiles or comparing products. You can configure this in settings to work exactly how you want.

### Privacy & Security (The Paranoid Stuff)

**Q: Does this extension spy on me?**  
A: **Absolutely not.** This extension doesn't collect, store, or transmit any personal data. All conversations stay in your browser where they belong. We're not Facebook, people.

**Q: What permissions does this thing need?**
A: Just the essentials:
- **Storage**: To save your API key and conversations locally
- **Active Tab**: To read the current page content when you send messages
- **Scripting**: To inject the content reading functionality

**Q: Is my OpenAI API key safe?**  
A: Yep! Your API key is stored locally in your browser's storage and is only used for direct communication with OpenAI's API. It never goes through any other servers.

**Q: Can I use this in incognito mode?**  
A: You'll need to manually enable it for incognito at `chrome://extensions/` by clicking "Details" and enabling "Allow in incognito." Because apparently privacy mode means "disable useful extensions by default." 🙄

### Troubleshooting (When Things Go Wrong)

**Q: The AI isn't responding or giving errors**  
A: Let's debug this step by step:
1. Check if your OpenAI API key is valid and has credits
2. Make sure you're not hitting OpenAI's rate limits
3. Try switching between GPT-4.1 and GPT-4.1 nano models
4. Check your internet connection
5. Look at the browser console for any error messages

**Q: The extension stopped working after a Chrome update**  
A: Because Google loves breaking things. Try this ritual:
1. Go to `chrome://extensions/`
2. Toggle the extension off and on (the classic "have you tried turning it off and on again?")
3. Refresh any open tabs
4. Check if your API key is still there

**Q: The page reading isn't working on some websites**  
A: Some websites (especially those with heavy JavaScript or anti-bot measures) might not work perfectly. Try:
1. Refreshing the page
2. Waiting for the page to fully load
3. Using a different website (most work fine)
4. Manually copying the content if needed

**Q: How do I completely reset this thing?**  
A: Nuclear option: Uninstall and reinstall the extension. Less nuclear: Clear your browser's local storage for the extension (good luck finding that buried in Chrome's settings maze).

### Compatibility (Will It Work With My Setup?)

**Q: Does this work on Mac/Linux?**  
A: Yep! Works on all platforms where Chrome runs. The keyboard shortcuts might be slightly different (⌘ instead of Ctrl on Mac), but the functionality is the same.

**Q: Will this work with other AI extensions?**  
A: Generally yes, but conflicts are possible. If things get weird, try disabling other AI-related extensions temporarily. It's like browser extension Thunderdome in there.

**Q: Does this work on mobile Chrome?**  
A: Chrome extensions don't work on mobile Chrome, so sadly no. But the desktop version works great!

### Advanced Usage (For the Power Users)

**Q: Can I change the temperature setting?**  
A: Absolutely! Go to settings and adjust the temperature slider. 0.0 = robotic precision, 1.0 = creative chaos. Find your sweet spot!

**Q: How do I organize my chat history?**  
A: The extension automatically organizes conversations by website domain. You can search and filter through your history, and each conversation is timestamped for easy reference.

**Q: Can I export my conversations?**  
A: Currently no, but you can copy individual messages using the copy button. Your conversations are stored locally, so they're safe as long as you don't clear your browser data.

**Q: Does this work with Chrome's tab groups?**  
A: Yep! Works with tab groups because it doesn't care about Chrome's arbitrary organizational schemes. A tab is a tab is a tab.

## 🤓 Technical Stuff (For the Nerds)

- **Manifest Version:** 3 (because we have no choice with Chrome's current requirements)
- **Permissions:** 
  - `storage` (for API key and conversation persistence)
  - `activeTab` (for reading current page content)
  - `scripting` (for injecting content reading functionality)
- **Background:** Service worker (no more background pages, RIP)
- **Content Scripts:** Dynamic injection for page content reading
- **Storage:** `chrome.storage.local` for conversations and settings
- **API Integration:** Direct OpenAI API communication (no proxy servers)
- **Model Support:** GPT-4.1 and GPT-4.1 nano with automatic fallback
- **Context Window:** 1M tokens for both models
- **Default Settings:** 
  - Model: GPT-4.1 nano
  - Temperature: 0
  - Theme: Auto (follows system preference)
  - Repeat Message Trigger: Auto mode

## 🤝 Contributing

Found a bug? Want to add a feature? Have strong opinions about falling stars? I'm all ears:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (the stars must continue to fall gracefully)
5. Submit a pull request with a detailed description

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details (or just assume it's the usual "do whatever you want but don't blame me" license).

## ❤️ Support This Project

If you find this extension useful, please consider supporting it with a donation.

- **Bitcoin ($BTC)**: `bc1q... (Your Bitcoin Address Here)`
- **Ethereum ($ETH)**: `0x... (Your Ethereum Address Here)`
- **Monero ($XMR)**: `4... (Your Monero Address Here)`
- **USD Coin ($USDC) on Polygon**: `0x... (Your Polygon Address Here)` *(low-fee stablecoin donations)*

Thank you for your generosity and for supporting open-source software that actually works! 🎉

## 🙏 Acknowledgments

- Iuliia, for being the inspiration and the reason this exists
- OpenAI for making AI assistance accessible
- The Chrome Extension team for making browser extensions not completely terrible
- Coffee, for making this project possible
- Anyone reading this (but especially Iuliia ❤️)

---

*Built with ❤️ for the most wonderful woman in the world* 