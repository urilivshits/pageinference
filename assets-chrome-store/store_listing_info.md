# Chrome Web Store Listing Information - Browse Buddy

## Basic Store Information

### Essential Details
- Extension Name: Browse Buddy: AI Assistant with Page Reading and Search
- Category: Productivity
- Language: English (Primary)
- Version: 1.0.0
- Manifest Version: 3 (Required for 2024+)
- Minimum Chrome Version: 88+ (Manifest V3 requirement)

### Developer Information
- Developer Name: urilivshits
- Website: https://github.com/urilivshits/pageinference/tree/chrome_store
- Support URL: https://github.com/urilivshits/pageinference/issues
- Privacy Policy: https://github.com/urilivshits/pageinference/blob/chrome_store/assets-chrome-store/PRIVACY_POLICY.md

## Store Listing Content

### Short Description (132 characters max)
AI assistant with automatic page content reading - no more copy-pasting to get contextual help

### Detailed Description
See: store_description.md (Complete marketing description)

### Feature Highlights (for promotional materials)
- Smart AI Models - Choose between GPT-4.1 nano (default - fast daily tasks) or GPT-4.1 (complex reasoning with web search)
- Automatic Page Reading - Analyzes any website content without manual copying
- Smart Click Behavior - Remember and repeat questions on similar pages (perfect for analyzing multiple profiles or products)
- Organized Chat History - Conversations sorted by website domain with timestamps
- Privacy First - API key and conversations stay in your browser, no data collection
- Beautiful Interface - Dark/light themes with magical falling stars animation
- Smart API Key Setup - Automatic guidance if you try to use the extension without an API key configured

### Keywords (SEO Optimization - Internal Use Only)
AI assistant, page reader, context aware, productivity, web content analysis, research tool, browsing helper, automatic content reading, OpenAI, GPT-4, web scraping, chat history, dark mode, privacy focused

### Target Audience
- Researchers and content analysts
- Students and learners
- Professionals reviewing web content
- Users wanting smarter browsing tools
- LinkedIn users analyzing profiles
- Content creators and writers
- Academic researchers

## Privacy & Data Handling

### Data Collection Policy
- Data Collection: None - extension does not collect user data
- User Data Handling: API key stored locally, conversations stored locally
- External Services: OpenAI API only for AI responses
- Analytics: None
- Tracking: None

### Privacy Compliance
- GDPR Compliant: All data stored locally, user control over data
- CCPA Compliant: No data collection, clear privacy policy
- COPPA Compliant: Not designed for children under 13
- Chrome Web Store Policy Compliant: Follows all privacy guidelines

### Chrome Web Store Privacy Form Responses

#### Single Purpose Description
Browse Buddy is an AI assistant extension that automatically reads and analyzes web page content to provide contextual help and answers to user questions. The extension eliminates the need for manual copy-pasting by intelligently extracting page content and using AI to provide relevant assistance based on the current webpage context.

#### Permission Justifications

Storage Permission:
The extension stores user API keys, chat history, and settings locally in the browser. This is essential for maintaining user preferences, preserving conversation history organized by website domain, and ensuring the extension can function without requiring users to re-enter their API key on each use.

Tabs Permission:
Required to detect the current active tab and website URL. This enables the extension to provide context-aware assistance by knowing which website the user is currently viewing, allowing for domain-specific chat history organization and contextual AI responses.

Scripting Permission:
Necessary to inject content scripts that read and extract text content from web pages. This enables the core functionality of automatic page content reading without requiring users to manually copy and paste content for AI analysis.

Host Permission (<all_urls>):
Required to access page content across all websites for the automatic page reading functionality. This allows users to get AI assistance for any webpage they visit, which is the primary purpose of the extension. The extension only reads page content when explicitly activated by the user.

#### Remote Code Usage
Yes, using remote code:
The extension communicates with OpenAI's API (https://api.openai.com) to provide AI-powered responses. This is essential for the core functionality of providing intelligent, contextual assistance based on webpage content. The extension sends only the user's question and relevant page content to OpenAI's secure API endpoint, and no user data is stored or processed by OpenAI beyond the immediate API request. All API communication is done through secure HTTPS connections to OpenAI's official API endpoints.

### Chrome Web Store Data Usage Form Responses

#### User Data Collection Declaration
The extension collects the following user data:

WEBSITE CONTENT: The extension reads and extracts text content from web pages that users visit. This includes page text, headings, and visible content that is necessary for providing contextual AI assistance. The extension only reads content when explicitly activated by the user and does not store this content permanently.

WEBSITE URLS: The extension stores the current website URL locally to organize chat history by domain. This allows users to see their conversation history organized by website.

Note: The extension does NOT collect any of the following data types:
- Personally identifiable information (name, address, email, etc.)
- Health information
- Financial and payment information
- Authentication information
- Personal communications
- Location data
- Web history (browsing history tracking)
- User activity (clicks, keystrokes, etc.)

#### Data Usage Certifications
All three mandatory certifications are TRUE:

1. "I do not sell or transfer user data to third parties, outside of the approved use cases" - TRUE
   The extension does not sell or transfer any user data. The only external communication is with OpenAI's API for AI responses, which is an approved use case for providing the extension's core functionality.

2. "I do not use or transfer user data for purposes that are unrelated to my item's single purpose" - TRUE
   All data usage is directly related to the extension's single purpose of providing AI assistance based on webpage content. No data is used for unrelated purposes.

3. "I do not use or transfer user data to determine creditworthiness or for lending purposes" - TRUE
   The extension does not collect or use any data related to financial information, creditworthiness, or lending purposes.

#### Privacy Policy URL
https://github.com/urilivshits/pageinference/blob/chrome_store/assets-chrome-store/PRIVACY_POLICY.md

## Technical Requirements

### Manifest V3 Compliance
- Service Worker: Background script uses service worker
- Permissions: Minimal required permissions only
- Host Permissions: Specific to functionality
- Content Security Policy: Properly configured

### Required Permissions
- storage: Save preferences and chat history locally
- tabs: Detect current website for context
- scripting: Read page content when enabled
- Host Permissions: <all_urls> for page content access, https://*.openai.com/* for API calls

### Performance Requirements
- Fast Loading: Extension loads within 2 seconds
- Memory Efficient: Minimal memory footprint
- No Background Processing: Only processes when user interacts
- Error Handling: Graceful error handling without spam

## Visual Assets Required

### Icons (Required)
- 16x16: assets/icons/default_icon16.png
- 48x48: assets/icons/default_icon48.png
- 128x128: assets/icons/default_icon128.png

### Screenshots (Required - 1280x800 or 640x400)
- Screenshot 1: Main chat interface with AI response
- Screenshot 2: Settings panel with API key configuration
- Screenshot 3: Chat history with domain organization
- Screenshot 4: Dark mode interface
- Screenshot 5: API key guidance modal (new feature)

### Promotional Images (Optional but Recommended)
- Small Tile: 440x280px
- Large Tile: 920x680px
- Marquee: 1400x560px

### Demo Video (Highly Recommended)
- Format: MP4, WebM, or OGV
- Duration: 30-120 seconds
- Content: Demonstrate key features, API key setup, page reading functionality

## Store Requirements Status

### Completed Requirements
- Clear description of functionality
- Privacy policy information
- Data handling disclosure
- Target audience identification
- Feature highlights
- Keywords for search optimization
- Support information
- Website/repository link
- Manifest V3 compliance
- Proper permissions justification
- Error handling implementation
- Code readability requirements met
- API use compliance (OpenAI only)
- Privacy-first design
- Local storage only
- No data collection
- Clear user control over data
- Version history and changelog

### In Progress
- High-quality screenshots (need to capture)
- Demo video creation
- Promotional images
- Final testing on Chrome Web Store

### Still Needed
- Screenshots: Need high-quality screenshots of the extension in action
- Demo Video: Video demonstration of key features
- Promotional Images: Various sizes for store promotion
- Final Testing: Test extension in Chrome Web Store environment
- Compatibility Notes: Test on different Chrome versions

## Publishing Process

### Pre-Submission Checklist
1. Code Review: Ensure all code is readable and well-documented
2. Testing: Test on multiple Chrome versions (88+)
3. Privacy Review: Verify privacy policy compliance
4. Permissions Review: Ensure minimal required permissions
5. Visual Assets: Prepare all required images and videos
6. Documentation: Complete all store listing information

### Submission Steps
1. Developer Account: Ensure 2-step verification is enabled
2. Upload Package: Zip the extension files
3. Store Listing: Fill out all required information
4. Privacy Policy: Link to privacy policy document
5. Screenshots: Upload high-quality screenshots
6. Demo Video: Upload demonstration video
7. Review: Submit for review

### Expected Review Time
- Initial Review: 1-3 weeks (due to host permissions requiring in-depth review)
- Revisions: 1-2 business days per revision
- Final Approval: 1-2 business days

### Review Preparation Notes
- Extension uses <all_urls> host permission for page content reading functionality
- This triggers in-depth manual review process
- All privacy and data handling disclosures are complete and accurate
- Code includes proper error handling and console override for production
- Extension follows Manifest V3 requirements and best practices
- Privacy policy is comprehensive and compliant with Chrome Web Store policies

## Store Optimization

### SEO Strategy
- Primary Keywords: AI assistant, page reader, productivity
- Secondary Keywords: web content analysis, research tool, browsing helper
- Long-tail Keywords: automatic page content reading, contextual AI help

### User Acquisition
- Target Demographics: Professionals, students, researchers
- Use Cases: LinkedIn analysis, content research, web browsing assistance
- Value Proposition: Save time by eliminating copy-paste for AI assistance

### Competitive Advantages
- Privacy-First: No data collection, local storage only
- Smart Features: Automatic page reading, question repetition
- User Experience: Beautiful interface, dark mode, stars animation
- API Key Guidance: Automatic setup assistance for new users

## Technical Specifications

### Extension Architecture
- Background: Service worker (Manifest V3)
- Content Scripts: Dynamic injection for page reading
- Storage: Chrome storage API for local data
- API Integration: Direct OpenAI API communication
- UI Framework: Vanilla JavaScript with CSS

### Browser Compatibility
- Chrome: 88+ (Manifest V3 requirement)
- Edge: 88+ (Chromium-based)
- Opera: 74+ (Chromium-based)
- Brave: 1.28+ (Chromium-based)

### Performance Metrics
- Load Time: <2 seconds
- Memory Usage: <50MB
- CPU Usage: Minimal background processing
- Network: Only when user sends messages

## Support & Maintenance

### User Support
- GitHub Issues: Primary support channel
- Documentation: Comprehensive README and FAQ
- Troubleshooting: Built-in guidance for common issues
- Updates: Regular feature updates and bug fixes

### Maintenance Plan
- Regular Updates: Monthly feature updates
- Bug Fixes: Prompt response to issues
- Security Updates: Immediate response to security concerns
- User Feedback: Active community engagement

---

## Notes for Publisher

### Key Selling Points
1. Privacy-First Design: No data collection, local storage only
2. Smart AI Integration: Automatic page reading with OpenAI
3. User Experience: Beautiful interface with helpful features
4. Productivity Focus: Saves time on web research and analysis

### Potential Concerns to Address
1. API Key Requirement: Users need OpenAI API key (but we guide them)
2. Cost: Users pay for OpenAI API usage (but we use efficient models)
3. Permissions: Requires broad host permissions for page reading

### Success Metrics
- Install Rate: Target 100+ installs in first month
- User Retention: Target 60%+ 7-day retention
- User Rating: Target 4.5+ stars
- Reviews: Encourage positive reviews from satisfied users

---

Last Updated: January 2025
Version: 1.0.0
Status: Ready for Chrome Web Store Submission 