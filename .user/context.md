# Service Context
<!-- Project context to check for every query. -->
This document provides essential context about the service we're building. It helps the AI assistant understand the purpose, requirements, and technical details of the project.

## Project Overview
A Chrome browser extension that enables users to ask questions about any webpage using OpenAI's GPT models. The extension extracts content from the current page and leverages OpenAI's API to provide accurate, context-aware answers based on the page's content.

## Technical Stack
- Chrome Extension Framework (Manifest V3)
- Vanilla JavaScript
- HTML/CSS for UI
- OpenAI GPT API (GPT-3.5 Turbo and GPT-4)
- Chrome Storage API for secure data persistence
- Chrome Scripting and ActiveTab APIs for page interaction

## Key Features
- Smart webpage content extraction
- Interactive Q&A interface for webpage content
- OpenAI GPT model integration (3.5 Turbo and GPT-4)
- Secure API key management
- Modern, clean user interface
- Customizable settings
- Cross-origin page support

## Architecture
- **Frontend Components:**
  - popup.html/js: Main user interface and interaction logic
  - styles.css: UI styling and theming
- **Background Services:**
  - background.js: Handles API communication and core extension logic
  - content.js: Manages webpage content extraction
- **Configuration:**
  - manifest.json: Extension configuration and permissions
  - Storage: Secure API key and settings storage

## User Personas
assumption: Based on the implementation, the extension targets:
- General web users seeking to understand webpage content
- Researchers needing quick information extraction
- Students studying online content
- Professionals analyzing web-based documents

## Integration Points
- OpenAI API (GPT-3.5 Turbo and GPT-4 models)
- Chrome Extension APIs:
  - Storage API
  - Scripting API
  - ActiveTab API
- Web page DOM integration via content scripts

## Constraints and Requirements
- Requires valid OpenAI API key
- Limited to active tab access for security
- Must handle varying webpage structures
- Token limits based on OpenAI model constraints
- Cross-origin security considerations
- Chrome browser compatibility (Manifest V3)

## Development Status
assumption: Project appears to be in active development with:
- Core functionality implemented
- Basic error handling in place
- Security measures implemented
- UI/UX refined
- Testing framework established

## Reference Materials
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions)
- Project README.md for setup and usage
- MIT License for terms of use