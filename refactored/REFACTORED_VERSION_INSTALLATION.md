# Installing the Refactored Extension Version

This guide explains how to install the refactored version of the "Talk to any webpage" Chrome extension. The refactored version uses a more modular code structure with improved testing and maintainability, while preserving all the original functionality.

## Option 1: Side-by-Side Installation (Recommended)

This option allows you to keep the original extension installed and try the refactored version alongside it.

1. **Prepare the files**
   - Ensure you have the entire codebase downloaded
   - Verify that the following files exist:
     - `refactored-manifest.json`
     - `module-loader.js`
     - `content/content.js` (refactored content script)
     - `content/scrapers/index.js`
     - `content/scrapers/generic-scraper.js`
     - `content/scrapers/linkedin-scraper.js`
     - `popup/popup.html` (refactored popup)

2. **Create a new directory for the refactored extension**
   - Create a folder named `talk-to-webpage-refactored`
   - Copy all files from the original project into this new folder

3. **Replace the manifest file**
   - In the new folder, rename `refactored-manifest.json` to `manifest.json` (replacing the original)

4. **Install in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right corner
   - Click "Load unpacked" and select your `talk-to-webpage-refactored` folder
   - The refactored extension should now appear with "(Refactored)" in its name

5. **Verify installation**
   - You should now have both extensions installed
   - The original will have the original icon
   - The refactored version will have the same icon but a different name

## Option 2: Replace Existing Installation

If you prefer to directly replace the original extension with the refactored version:

1. **Back up your original files first**
   - Create a backup copy of your entire extension folder
   - This allows you to revert if needed

2. **Replace the manifest file**
   - Rename `refactored-manifest.json` to `manifest.json` (overwriting the original)

3. **Add the new files**
   - Ensure `module-loader.js` is in the root directory
   - Verify that the content/scrapers directory contains all necessary files
   - Verify that the popup directory contains the refactored popup.html

4. **Reload the extension**
   - Go to `chrome://extensions/`
   - Find your extension and click the refresh icon
   - Alternatively, toggle the extension off and back on

## Troubleshooting

If you encounter issues with the refactored version:

1. **Check the console for errors**
   - Open Chrome DevTools on any page (F12 or Right-click > Inspect)
   - Look at the Console tab for any error messages

2. **Verify module loading**
   - The console should show messages like "Loading refactored content script from content/content.js" and "Refactored content script loaded successfully"
   - If these messages are missing, there may be a problem with the module loading process

3. **Check for network errors**
   - In Chrome DevTools, go to the Network tab
   - Look for any failed requests related to the extension

4. **Common issues and solutions**
   - If you see "Module not found" errors, verify that all files are in the correct locations
   - If you see "Uncaught SyntaxError: Cannot use import statement outside a module", check that your manifest correctly specifies web_accessible_resources
   - If popup doesn't load, check that paths in the manifest point to popup/popup.html

## Reverting to the Original Version

If you need to go back to the original version:

1. **If using Option 1 (side-by-side)**
   - Simply disable the refactored extension in `chrome://extensions/`

2. **If using Option 2 (replacement)**
   - Restore your backup files
   - Reload the extension in `chrome://extensions/` 