# Project Progress Report
This document tracks the evolution of the project, documenting architectural decisions, feature implementations, and bug resolutions.

## Architectural Decisions
<!--
FORMAT GUIDE - DO NOT DELETE

- **[Architecture Pattern]** Implemented [pattern name] for [purpose] to enhance [benefit].
- **[Framework Selection]** Adopted [Framework Name] for [component] to improve [benefit].
-->

- **[API Selection]** Evaluated OpenAI Completions API versus Responses API for web search functionality, determining that Responses API offers superior built-in web search capabilities, simplified integration, and enhanced tools. Completions API requires custom function implementation for web search while Responses API provides a native `web_search_preview` tool that directly connects to OpenAI's search infrastructure without requiring custom implementation.

- **[Architecture Refactoring Decision]** Designed a comprehensive refactoring plan to improve code maintainability and prevent regressions in functionality. The plan involves:
  - Reorganizing the monolithic JavaScript files into a modular structure
  - Implementing a service-oriented architecture for better separation of concerns
  - Establishing proper state management across different extension contexts
  - Creating a standardized utility library for shared functionality
  - Following Chrome Extension best practices for component organization
  - Adding proper versioning and migration path for incremental changes
  - Implementing testing strategies to prevent regression issues

- **[Modular Refactoring Implementation]** Created foundation for a modular architecture to improve maintainability and prevent regression issues:
  - Established a well-organized directory structure separating concerns by component type (background, popup, content)
  - Created dedicated service modules for storage management with Promise-based API
  - Centralized all system prompts in a dedicated prompts directory with clear organization by purpose
  - Implemented utility modules for URL handling and message passing
  - Defined a constants file to centralize configuration values across the extension
  - Set up entry point files that will gradually replace the monolithic scripts

## Implemented Features
<!--
FORMAT GUIDE - DO NOT DELETE

- **[Feature Name]** Developed functionality for [purpose] that enables users to [capability].
- **[Optimization]** Enhanced [component] performance by [technique] resulting in [benefit].
-->

- **[Web Search Enhancement]** Implemented OpenAI API web search capabilities in refactored extension:
  - Integrated OpenAI's web_search_preview tool for obtaining up-to-date information
  - Added support for extracting and displaying sources from API responses
  - Implemented combined mode that integrates page content and web search results
  - Created system prompts that instruct the model how to use both information sources
  - Added source attribution for better information credibility
  - References: background/background.js

- **[LinkedIn Scraping]** Restored specialized LinkedIn profile scraping functionality:
  - Implemented dedicated scraper with LinkedIn-specific selectors
  - Added support for extracting structured profile data (name, headline, about, experience, education, skills)
  - Created multiple selector fallbacks to handle LinkedIn UI variations
  - Added specialized text cleaning for LinkedIn content
  - Implemented delayed initialization with multiple retries for LinkedIn's dynamic interface
  - Ensured reliable data extraction regardless of LinkedIn profile layout
  - References: content.js

- **[Web Page Scraping]** Restored and improved the page scraping functionality in the refactored extension:
  - Fixed content script to properly extract visible text from webpages
  - Enhanced background script to handle scraped content reliably with improved error handling
  - Added detailed system message prompts that format page content for better context
  - Implemented fallbacks when scraping fails (e.g., with restricted URLs)
  - Added extensive logging to aid in troubleshooting
  - Created a more robust scraping approach that handles various page structures
  - References: background/background.js, content.js, popup/components/chat.js

- **[UI Simplification]** Streamlined the interface by hiding the Reason button:
  - Removed less frequently used feature from the main interface
  - Focused UI on core functionality (Search Page and Search Web)
  - Created cleaner, more focused user experience
  - References: styles.css

- **[OpenAI Responses API Integration]** Implemented web search functionality using the OpenAI Responses API instead of the Chat Completions API. This enhancement:
  - Provides native web search capabilities through the web_search_preview tool
  - Displays sources with results for better information attribution
  - Eliminates the need for custom search function implementation
  - Offers better search quality through OpenAI's optimized search infrastructure
  - Preserves the existing UI toggle experience for web search functionality
  - References: background.js

- **[Web Search Toggle]** Implemented toggle functionality for the "Search Web" button that enables users to turn web search on and off. This feature:
  - Provides visual feedback with button highlighting when active
  - Persists user preference between sessions
  - Maintains the default state as "on" for new installations
  - References: popup.js

- **[Page Scraping Toggle]** Implemented functionality for the "Search Page" button that enables users to toggle between page scraping and direct query modes. This feature:
  - Provides visual feedback with button highlighting when active
  - Persists user preference between sessions
  - Uses a generic system message when page scraping is disabled
  - Maintains the default state as "on" for new installations
  - References: popup.js, background.js, styles.css

- **[Combined Mode System Message]** Enhanced the system messaging to support simultaneous use of "Search Page" and "Search Web" features:
  - Added specialized COMBINED_SYSTEM_PROMPT for the dual-feature scenario
  - Modified getOpenAiInference to detect and handle the combined mode
  - Instructs the model to first use page content then search web as needed
  - Ensures clear attribution of information sources in responses
  - References: background.js

- **[Chat History Domain Filter]** Implemented website-specific filtering for chat history:
  - Added a "Show current site only" toggle in the history view
  - Created filtering logic based on website domain matching
  - Persists user preference between sessions
  - Dynamically updates the chat list when filter is toggled
  - Shows appropriate empty states when no matching chats are found
  - Enabled by default for better domain-focused experience
  - References: popup.js, popup.html, styles.css

- **[Unified Responses API Integration]** Migrated all OpenAI API calls to use the Responses API instead of the Completions API:
  - Updated OpenAI API service to use the Responses API endpoint for all request types
  - Modified message format to use the input/output_text structure required by Responses API
  - Enhanced response processing to handle the Responses API format
  - Implemented consistent error handling for all API calls
  - Fixed issues with simple prompts and page search functionality
  - Maintained compatibility with existing web search implementation
  - Streamlined API usage to use a single API format across all features
  - References: background/api/openai.js

- **[OpenAI API Integration Fix]** Corrected the OpenAI API integration to use the proper endpoints and formats:
  - Fixed incorrect usage of non-existent `/v1/responses` endpoint
  - Properly implemented web search as a tool in the chat completions API
  - Updated message format to use standard role/content structure
  - Added correct tool configuration for web search functionality
  - Improved source extraction and citation formatting
  - Maintained compatibility with all existing features
  - Enhanced error handling and response processing
  - References: background/api/openai.js

- **[OpenAI Responses API Migration]** Implemented proper Responses API integration for all OpenAI features:
  - Updated API endpoint to use the correct `/v1/responses` endpoint
  - Converted message format to use the proper Responses API structure with `input_text` type
  - Implemented response parsing for the Responses API output format
  - Added source extraction from the Responses API sources array
  - Configured proper request parameters for the Responses API (max_output_tokens, text format)
  - Maintained backward compatibility with Chat Completions API format
  - Fixed previous incorrect implementation that was using Chat Completions API
  - References: background/api/openai.js

- **[Responses API Web Search Fix]** Fixed web search functionality in OpenAI Responses API:
  - Corrected the web search tool format from using `type: 'web_search_preview'` to proper function format
  - Implemented the correct function structure with name, description, and parameters
  - Added detailed parameter definition including properties and required fields
  - Fixed "Missing required parameter: 'tools[0].function'" error in API calls
  - Improved error handling with more detailed error messages
  - Ensured proper operation of web search in the Responses API
  - References: background/api/openai.js

- **[Responses API Conversation Fix]** Fixed critical error in follow-up message handling for the OpenAI Responses API:
  - Addressed error: "Invalid value: 'input_text'. Supported values are: 'output_text' and 'refusal'."
  - Modified message format to use 'output_text' for all previous messages in a conversation
  - Updated both web search and standard query paths to use the correct content types
  - Fixed OpenAI API service to properly format conversation history for Responses API
  - Applied special handling with only the latest user message and system message using 'input_text'
  - Ensured proper handling of multi-turn conversations with the Responses API
  - Implemented role-based content type determination for accurate message formatting
  - References: background/background.js, background/api/openai.js

- **[Responses API Content Type Fix]** Fixed message content type handling for OpenAI Responses API conversations:
  - Identified API requires specific content types for different messages in a conversation
  - Updated system messages and current user message to use 'input_text'
  - Set previous conversation messages to use 'output_text' as required by the API
  - Modified response parsing to check for both 'input_text' and 'output_text' types
  - Fixed the error: "Invalid value: 'input_text'. Supported values are: 'output_text' and 'refusal'"
  - Applied the fix to both background.js direct API calls and the OpenAI API service
  - Ensured proper handling of conversation history with the Responses API
  - References: background/background.js, background/api/openai.js

- **[Search Web and Search Page Implementation]** Implemented toggle functionality for "search web" and "search page" features using the OpenAI Responses API:
  - Added click handlers that toggle settings state (webSearch and pageScraping)
  - Implemented visual feedback using the 'active' class on buttons
  - Stored toggle states in Chrome storage for persistence
  - Created specialized system prompts based on context and toggle state
  - Implemented logic to select the appropriate system prompt based on toggle states
  - Added proper web_search function tool to API requests
  - Used correct Responses API format with function structure and parameters
  - References: popup.js, background.js, background/api/openai.js

- **[Global Last User Input Storage]** Implemented storage and retrieval of the last user input globally:
  - Created a dedicated storage key for last user input that works across tabs
  - Updated handleSendMessage to store user input with each submission
  - Added loadGlobalLastUserInput to initialize the lastQuery variable
  - Implemented proper loading on popup initialization
  - References: refactored/popup/components/chat.js, refactored/background/background.js

- **[Automatic Input Execution]** Implemented ability to automatically execute last user input on popup open:
  - Added automatic execution logic in popup initialization
  - Implemented fade-in animation for visual smoothness
  - Created storage mechanism to pass execution data to popup
  - Added popup handling to automatically execute stored input
  - Ensured page content is scraped from current tab when needed
  - References: refactored/popup/popup.js, refactored/popup/components/chat.js

- **[Inter-Tab Communication Refinement]** Enhanced messaging system between background script and content scripts to ensure reliable information exchange with improved error handling and retry mechanisms.

## Resolved Bugs
<!--
FORMAT GUIDE - DO NOT DELETE

- **[Bug ID/Description]** Fixed [issue description] in [file-name.js]
- **[Bug ID/Description]** Resolved [issue description] affecting [component/feature]
-->

- **[History Domain Filter Navigation Bug]** Fixed bug where history domain filter wasn't being reapplied when returning to the history tab after viewing a chat. Updated tab navigation handling to properly reload sessions with current filter settings when the history tab is shown.

- **[History Domain Filter Initial State]** Fixed bug with "Only show {baseUrl}" toggle in history view where the toggle was ON by default but still showed chats from all domains until manually toggled. Updated loadSessions function to properly apply the domain filter based on the initial toggle state in refactored/popup/components/history.js.

- **[Message Channel Timeout Fix]** Resolved asynchronous message handling errors in refactored extension:
  - Fixed "message channel closed before a response was received" errors across multiple components
  - Implemented Promise.race with timeouts to prevent indefinite waiting for responses
  - Added direct storage access fallbacks when message channel errors occur
  - Updated background.js message handler to properly handle all message types
  - Improved error handling and recovery mechanisms throughout components
  - Added specific handlers for each message type in background script
  - Fixed icon path to use correct icons from the refactored directory structure
  - References: background/background.js, popup/components/chat.js, popup/components/settings.js, popup/components/history.js, popup/popup.html

- **[Syntax Error in Highlight.js Import]** Fixed SyntaxError in highlight.js library usage:
  - Identified error in ES module import for highlight.js library that doesn't provide default export
  - Updated chat.js to use the global window.hljs object loaded via script tag in popup.html
  - Changed all references from the imported hljs to window.hljs
  - Modified testing files to properly mock the global hljs object
  - Ensured proper code highlighting functionality in chat messages
  - Maintained consistent syntax highlighting in both light and dark themes
  - References: popup/components/chat.js, tests/components/chat.test.js

- **[Markdown Library Syntax Error Fix]** Fixed SyntaxError related to the marked.js library in the refactored extension:
  - Identified missing closing parenthesis error in marked.min.js library usage
  - Replaced incompatible ES module import for marked library with markdown-it library
  - Updated chat.js component to use markdown-it instead of the marked library
  - Modified testing files to mock markdown-it instead of marked
  - Preserved markdown rendering functionality with highlighting support
  - Created a cleaner implementation that aligns with the included script dependencies
  - References: popup/components/chat.js, tests/components/chat.test.js

- **[Service Worker Imports]** Fixed service worker registration failure by properly handling imports in a service worker context. Instead of using dynamic imports (which are disallowed in service workers), we:
  - Updated manifest.json to include web_accessible_resources for prompt files
  - Used static ES module imports for prompt files instead of dynamic imports
  - Maintained separation of concerns by keeping prompts in their dedicated files in shared/prompts/
  - Fixed the "import() is disallowed on ServiceWorkerGlobalScope" error

- **[Service Worker Registration Fix]** Fixed service worker registration failure (Status code: 3) by eliminating top-level await:
  - Removed top-level await imports that are disallowed in service worker context
  - Created a dedicated loadPrompts() function to handle module imports asynchronously
  - Defined global variables to store prompt references across the background script
  - Updated initialization sequence to load prompts before other services
  - Added proper error handling for module loading failures
  - Fixed cascading timeout errors caused by service worker registration failure
  - References: background/background.js

- **[Cross-Site Chat History Bug]** Fixed issue with chat sessions from different sites not being properly saved:
  - Added sessionUrl variable to keep track of the URL associated with loaded chat history
  - Modified getChatHistoryKey function to prioritize sessionUrl when available
  - Updated addMessageToChat to ensure messages are saved to the correct chat history
  - Added sessionUrl reset when starting new conversations
  - Ensured chat continuation works properly when loading a chat from a different site
  - References: popup.js

- **[Settings Layout Optimization]** Fixed settings page layout to fit within popup without scrolling:
  - Reduced vertical spacing between form elements and sections
  - Decreased font sizes for labels (0.875rem) and help text (0.7rem)
  - Reduced input field heights (28px) and padding (0.35rem)
  - Optimized slider component margins and spacing
  - Adjusted theme options spacing for more compact layout
  - Created a clean, accessible settings interface that displays all options without requiring scrolling
  - References: styles.css

- **[Global Scrollbar Arrow Fix]** Removed scrollbar arrows from all interface elements:
  - Applied universal scrollbar arrow hiding to all containers
  - Targeted scrollbar buttons without container-specific selectors
  - Used multiple CSS techniques (!important, pointer-events, visibility, opacity)
  - Addressed all possible button states (hover, active, vertical, horizontal)
  - Created consistent scrollbar appearance throughout the entire interface
  - Ensured compatibility with various browser implementations

- **[Scrollbar Standardization]** Unified scrollbar styling across interface elements in styles.css:
  - Updated chat-history scrollbar to match the pastConversationsView appearance
  - Removed absolute positioning that was causing alignment issues
  - Added hover effect to improve user feedback when interacting with the scrollbar
  - Implemented consistent border radius using CSS variables
  - Created a more cohesive visual appearance throughout the interface

- **[Scrollbar Overlap Fix]** Resolved chat history scrollbar overlap with question container in styles.css:
  - Removed pseudo-element approach in favor of direct container margin
  - Added appropriate margin-bottom to chat-history container
  - Further reduced height calculation to prevent overlap
  - Added padding-bottom to content-area for consistent spacing
  - Ensured scrollbar remains fully visible throughout the UI

- **[Message Visibility Fix]** Improved last message visibility in styles.css:
  - Increased padding-bottom of chat-history from 18px to 35px
  - Adjusted height calculation for chat-history container
  - Added margin-bottom to messages for better spacing
  - Ensured last message is fully visible above the question container

- **[Layout Fine-tuning]** Refined input area styling and positioning in styles.css:
  - Fixed border radius of New and Ask buttons to apply properly on all sides
  - Moved the entire input container line up from the bottom for better visual balance
  - Adjusted chat history container height and padding to accommodate the new position
  - Improved overall visual consistency and integration between elements

- **[Input Layout Enhancement]** Improved visual integration of buttons and input container in styles.css:
  - Updated "new" and "ask" buttons to use border radius that matches the input container
  - Positioned buttons to visually integrate with the input container edges
  - Modified question container layout to support the new integrated design
  - Adjusted input wrapper to properly fit between the buttons
  - Created a cohesive appearance similar to ChatGPT's interface

- **[UI Width Optimization]** Improved horizontal space utilization in styles.css:
  - Reduced horizontal padding of conversation-info from 1rem to 0.5rem
  - Increased max-width of both conversation-info and input-wrapper by reducing margin space
  - Maintained consistent spacing between elements
  - Enhanced overall visual appearance with wider elements that utilize available space more efficiently

- **[Button Hover Enhancement]** Improved interactive feedback for all button types in styles.css:
  - Added distinct hover effects for buttons in both active and inactive states
  - Implemented hover styling for New, Ask, Chat, and Settings buttons
  - Ensured consistent hover behavior across light and dark themes
  - Created visual distinction between active and hover states
  - Added fallback hover styling for any button not covered by specific rules

- **[Button Toggle Fix]** Fixed visual feedback issue with toggle buttons in styles.css:
  - Improved CSS selector specificity for active button states
  - Created button-specific selectors for more reliable styling
  - Removed duplicate and conflicting style definitions
  - Fixed inconsistent dark mode styling
  - Ensured proper visual feedback when buttons are toggled

- **[UI Enhancement]** Improved button styling to match modern ChatGPT interface:
  - Updated Search Page, Search Web, and Reason buttons to use a cleaner outlined style
  - Standardized button sizing, padding, and border-radius for consistent appearance
  - Implemented subtle hover effects with background color changes
  - Enhanced active state styling with appropriate color indicators
  - Ensured proper appearance in both light and dark themes
  - Removed conflicting style rules to maintain consistency
  - References: styles.css

- **[System Prompt Enhancement]** Updated GENERIC_SYSTEM_PROMPT to be model-agnostic instead of Claude-specific to support various AI models in background.js
- **[Chat History Fix]** Fixed "currentHistory.push is not a function" error by correctly retrieving and passing the chat history array to saveChatSession in the non-scraping mode in popup.js
- **[UI Border Fix]** Fixed input-buttons border visibility in dark mode by explicitly applying border and box-shadow styles to ensure consistent appearance across themes in styles.css
- **[Tooltip Alignment]** Corrected button tooltip positioning to properly center labels below buttons by adding text-align, width:max-content, and position:relative properties in styles.css
- **[Dark Mode Border Enhancement]** Improved border visibility in dark mode by using input-border color and stronger box-shadow for better contrast in styles.css
- **[Theme Persistence]** Fixed theme persistence issue by ensuring themePreference is consistently saved and loaded in popup.js, including adding auto-save to applyTheme function
- **[Width Precision Fix]** Improved width consistency between elements:
  - Updated both conversation-info and input-wrapper to use identical width calculations
  - Applied consistent box-sizing to ensure borders are included in width calculations
  - Used the same max-width (calc(100% - 16px)) for both elements
  - Centered elements with margin: auto for perfect alignment
  - References: styles.css
- **[Button Style Refinement]** Enhanced button aesthetics by:
  - Reduced font size to 0.75rem for better proportions
  - Increased border radius to 16px for a more modern look
  - Adjusted icon sizes to 14px for better balance
  - Ensured consistent styling across all button types
  - References: styles.css
- **[Button Style Update]** Improved button consistency by:
  - Removed tooltips from "New" and "Ask" buttons for cleaner interface
  - Matched border radius with input-wrapper (12px) for visual harmony
  - References: popup.html, styles.css
- **[Input Area Fix]** Improved chat interface usability by:
  - Fixed input area to bottom of popup window
  - Added independent scrolling for chat history
  - Implemented proper spacing to prevent content overlap
  - References: styles.css
- **[History View Enhancement]** Improved chat history list display by:
  - Extended chat sessions container to use full popup height
  - Removed unnecessary height restrictions
  - Optimized border and spacing for better visual flow
  - References: styles.css
- **[Visual Interface Improvements]** Enhanced chat interface visual elements:
  - Removed divider line between chat and input area for cleaner appearance
  - Improved scrollbar visibility with custom styling for both light and dark themes
  - Added proper padding to ensure scrollbar remains accessible
  - Enhanced shadow effect for visual separation without hard borders
  - References: styles.css
- **[Chat Interface Refinement]** Fixed scrollbar positioning and input area width issues:
  - Implemented fixed height calculation to ensure scrollbar remains above input area
  - Set precise chat history container dimensions to prevent content overflow
  - Adjusted input wrapper width to match conversation info width for visual consistency
  - Improved scrollbar positioning and styling for better accessibility
  - References: styles.css
- **[UI Fine-tuning]** Refined interface measurements for better consistency:
  - Improved scrollbar visibility with additional padding and proper positioning
  - Adjusted input-wrapper width to precisely match conversation info (98% width)
  - Reduced container padding to eliminate width discrepancies
  - Optimized element spacing for better visual consistency
  - References: styles.css
- **[Chat ID Continuity Fix]** Resolved issue with conversation continuity in popup.js:
  - Modified checkOrCreatePageLoadId() to maintain existing IDs for past conversations
  - Updated submit button click handler to preserve pageLoadId when continuing conversations
  - Enhanced loadAndDisplayChatSession() to properly save currentPageLoadId to storage
  - Fixed bug where continuing a past chat would create a new conversation instead
  - Ensured conversations maintain identity while still moving to top of list when updated
- **[Textarea Resize Bug Fix]** Fixed issue with textarea not returning to original size after submitting multi-line input:
  - Identified that input value was being cleared but textarea height was not being reset
  - Added explicit style.height = 'auto' after clearing input value in submit handler
  - Ensured consistent interface appearance after submission
  - Prevents the textarea from remaining at expanded height when empty
  - References: popup.js
- **[Copy Button Repositioning]** Improved copy button accessibility in messages:
  - Moved button position from top-right to bottom-right corner of message boxes
  - Maintained same hover behavior and visual styling
  - Enhanced usability by placing the button in a more ergonomic position
  - Ensures consistency across all message types (AI, user, system)
  - References: styles.css
- **[Chat Persistence Fix]** Fixed issue with chat sessions being reset when the popup is closed and reopened:
  - Modified checkOrCreatePageLoadId to set isInNewConversation to false when finding existing IDs
  - Improved popup initialization sequence to prioritize loading existing sessions
  - Restructured focus event handler to better match the main initialization approach
  - Added history loading when recovering sessions on focus events
  - Removed duplicate loadChatSessions and showMainView calls to prevent conflicts
  - Added more consistent behavior between tab switching and popup reopening
  - References: popup.js
- **[Enhanced Chat Persistence]** Fixed persistent issue with chat sessions being reset on popup reopening:
  - Completely redesigned popup initialization sequence with a more robust approach
  - Added dedicated critical initialization logic that runs on DOMContentLoaded
  - Improved checkOrCreatePageLoadId to explicitly verify chat history existence
  - Added fallback mechanisms to retrieve sessions by URL when tab-specific IDs aren't found
  - Created a more intelligent focus event handler that only reloads when needed
  - Added extensive debug logging with CRITICAL prefix for troubleshooting
  - Ensured consistent behavior across all popup opening scenarios
  - References: popup.js
- **[Input Persistence Fix]** Resolved issue with user input being restored when reopening the extension after successful inference:
  - Added new clearSavedInputText function to remove stored input from Chrome storage
  - Called clearSavedInputText after successful inference in both inference paths
  - Ensured stored input text is properly cleaned up after successful submission
  - Prevents previously submitted questions from reappearing in the input field
  - References: popup.js
- **[Keyboard Shortcut Implementation]** Added Ctrl+Shift+Y keyboard shortcut to quickly access the extension and execute queries:
  - Implemented commands configuration in manifest.json to register the shortcut
  - Created command handler in background.js to respond to keyboard events
  - Added logic to either open the popup or execute the last input based on chat existence
  - Implemented message listener in popup.js to handle automatic input execution
  - Ensured shortcuts are user-configurable through Chrome's extension settings
  - Enhanced user experience with faster access to the extension functionality
  - References: manifest.json, background.js, popup.js
- **[Service Worker Compatibility Fix]** Resolved critical service worker error causing extension failure:
  - Removed document event listeners from background script (service workers have no DOM access)
  - Moved Ctrl key detection logic to popup.js where document object is available
  - Reimplemented Ctrl+Click detection using direct key event listeners in popup context
  - Replaced key state storage with timestamp-based approach for popup-background communication
  - Ensured all background script code is service worker compatible
  - Fixed "Uncaught ReferenceError: document is not defined" error in background.js
  - Improved architecture to respect Chrome Extension Manifest V3 requirements
  - Maintained full Ctrl+Click functionality with a more reliable implementation
  - References: background.js, popup.js
- **[Enhanced Ctrl+Click Implementation]** Improved reliability of Ctrl+Click functionality:
  - Moved Ctrl key detection to content scripts where document object is consistently available
  - Implemented message passing between content script and background script for key state
  - Used a more reliable approach storing key state at click time rather than checking real-time
  - Added window blur detection to reset key state when focus is lost
  - Implemented debouncing to prevent excessive message passing 
  - Enhanced logging in background script for easier troubleshooting
  - Created a workflow that works reliably across all Chrome extension contexts
  - Functions without relying on popup's ability to detect keypress events
  - References: content.js, background.js, popup.js
- **[UI Notification Cleanup]** Enhanced user experience with cleaner interface:
  - Removed intrusive error and status notifications for failed or completed operations
  - Eliminated "No previous user request found" error messages in favor of silent failure
  - Removed green API execution notification banners for a more streamlined experience
  - Cleaned up double-click command execution notifications
  - Made error conditions fail silently without displaying error badges or messages
  - Removed related animation and timer code for notice creation/removal
  - Created a cleaner, less distracting UI focused on content rather than status indicators
  - References: background.js, popup.js
- **[User Message Substitution]** Fixed issue where user's actual query was being ignored when using LinkedIn page scraping:
  - Updated GENERIC_SYSTEM_PROMPT to not assume users want page content analysis
  - Modified LINKEDIN_SYSTEM_PROMPT to respond directly to user queries
  - Removed language that implied a generic page analysis request
  - Ensured user messages are preserved in API requests
  - References: shared/prompts/generic.js, shared/prompts/website-specific.js
- **[Prompt Organization]** Restored proper organization of system prompts in the centralized prompts directory:
  - Moved hardcoded prompts from background.js to the shared/prompts directory
  - Added WEB_SEARCH_SYSTEM_PROMPT to shared/prompts/generic.js
  - Created generatePageContentPrompt function for dynamic page content insertion
  - Updated background.js to import and use centralized prompts
  - Fixed special handling for dynamic page content in prompts
  - Updated exports in index.js to maintain consistent organization
  - References: shared/prompts/generic.js, shared/prompts/index.js, background/background.js
- **[Hardcoded Action Messages]** Fixed issue where action buttons (Search Page, Search Web) were replacing user input with hardcoded templates:
  - Removed predefined template messages map in handleActionButton function
  - Modified the function to use the user's actual input instead of replacing it with templates
  - Ensured user's original query is preserved and sent to the API
  - Improved system prompts to provide proper context without assuming query content
  - References: popup/components/chat.js
- **[Direct Background.js Responses API Fix]** Applied direct fixes to background.js to ensure proper use of the OpenAI Responses API:
  - Fixed web search API calls in background.js to use the correct tools format with proper function structure
  - Updated API endpoint from /v1/chat/completions to /v1/responses in direct API calls
  - Applied consistent Responses API format to both web search and standard queries
  - Enhanced response parsing to handle the Responses API output format with proper extraction
  - Fixed the "Missing required parameter: 'tools[0].function'" error
  - Ensured both API request paths (web search and non-web search) use the correct API and format
  - References: background/background.js
- **[Web Search Tool Format Fix]** Resolved "Missing required parameter: 'tools[0].name'" error:
  - Added the required 'name' field directly to the top level of tool objects
  - Fixed both the direct API calls in background.js and the OpenAI API service
  - Maintained correct function structure with nested function.name
  - Ensured proper parameters for the Responses API format
  - Fixed the API call failures for both web search and regular requests
  - References: background/background.js, background/api/openai.js
- **[Missing Module Import]** Fixed ReferenceError in background script where openAiService was undefined by adding the proper import statement: `import * as openAiService from './api/openai.js'`
- **[Incorrect Import Name]** Fixed SyntaxError in OpenAI API service by correcting the import from non-existent `API` to the proper `API_CONSTANTS` export in constants.js file
- **[Background Tab Tracking]** Developed advanced tab tracking system that monitors window focus events and tracks which tab opened the popup.
- **[Smart Content Scraping]** Implemented intelligent content scraping that targets the correct page regardless of current window focus.
- **[Single Popup Enforcement]** Created multi-layered system to ensure only one popup can be open at a time across all Chrome windows.
- **[Improved History Navigation]** Enhanced history item navigation to properly switch to the correct tab when clicking history items from different pages.
- **[Focus-Related Scraping Bug]** Fixed issue where page scraping would fail when popup was focused without first clicking on the source page.
- **[Wrong Page Content Bug]** Resolved bug where content from previously focused page would be scraped instead of the popup's source page.
- **[Cross-Window History Bug]** Fixed issue where clicking history item from one tab would incorrectly open that chat in current tab instead of navigating to the original tab.
- **[Multiple Popups Bug]** Resolved issue where multiple popups could be opened simultaneously, leading to confusion and incorrect content scraping.
- **[Ctrl+Click Popup Opening]** Implemented a no-execution mode when opening the popup with Ctrl+Click:
  - Added detection for Ctrl key press when the extension icon is clicked
  - Created mechanism to open popup without automatically executing the last user input
  - Maintained regular single-click behavior for automatic execution
  - Removed inference execution message from the UI for cleaner appearance
  - References: background/background.js, popup/popup.js
- **[Popup Behavior Optimization]** Fixed bug with automatic execution after creating new chats:
  - Corrected clearSavedInputText() to preserve global_last_user_input value
  - Fixed input text saving mechanism to use correct function for clearing input
  - Added improved state management to ensure last input persistence 
  - Ensured reliable execution across various user workflows without requiring page reload
  - References: popup/components/chat.js, background/background.js
