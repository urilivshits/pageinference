/**
 * Settings Component
 *
 * Handles user preferences and API key management.
 */

import { MESSAGE_TYPES, API_CONSTANTS, UI_CONSTANTS } from "../../shared/constants.js";
import { DEFAULT_SETTINGS } from "../../shared/models/settings.js";

// DOM elements
let settingsContainer;
let apiKeyInput;
let toggleApiKeyButton;
let temperatureSlider;
let temperatureValue;
let themeOptions;
let modelSelector;
let webSearchToggle;
let pageScrapingToggle;
let repeatMessageTrigger;
let starsAnimationToggle;

// Settings state
let currentSettings = null;
let modelAvailability = {};

// Auto-save state
let apiKeySaveTimeout = null;
let lastApiKeyValue = '';

// Storage keys (copied from old app to maintain compatibility)
const STORAGE_KEYS = {
	USER_PREFERENCES: "userPreferences",
	API_KEY: "openai_api_key",
};

// Default settings - use centralized defaults
const defaultSettings = DEFAULT_SETTINGS;

/**
 * Initialize the settings component
 */
export async function initializeSettingsComponent() {
	console.log("Initializing settings component");

	// Get DOM elements
	settingsContainer = document.getElementById("settings-container");
	apiKeyInput = document.getElementById("api-key-input");
	toggleApiKeyButton = document.getElementById("toggle-api-key-button");
	
	console.log("Settings DOM elements found:", {
		settingsContainer: !!settingsContainer,
		apiKeyInput: !!apiKeyInput,
		toggleApiKeyButton: !!toggleApiKeyButton
	});
	temperatureSlider = document.getElementById("temperature-slider");
	temperatureValue = document.getElementById("temperature-value");
	themeOptions = document.getElementsByName("theme");
	modelSelector = document.getElementById("model-selector");
	webSearchToggle = document.getElementById("web-search-toggle");
	pageScrapingToggle = document.getElementById("page-scraping-toggle");
	repeatMessageTrigger = document.getElementById("repeat-message-trigger");
	starsAnimationToggle = document.getElementById("stars-animation-toggle");

	// Populate model selector
	await populateModelSelector();

	// Load settings first
	await loadSettings();

	// Add event listeners
	setupEventListeners();

	// Check model availability
	checkModelAvailability();

	// Update slider gradient - only if element exists
	if (temperatureSlider) {
		updateSliderGradient(temperatureSlider);
	}

	// Listen for settings panel being opened to reload API key
	window.addEventListener('settings-panel-opened', () => {
		loadApiKey();
		// Also reload settings to ensure theme selection is properly set
		loadSettings();
	});

	console.log("Settings component initialized");
}

/**
 * Set up event listeners for settings interactions
 */
function setupEventListeners() {
	// API key management - only add listeners if elements exist
	if (apiKeyInput) {
		setupApiKeyAutoSave();
	}
	if (toggleApiKeyButton) {
		toggleApiKeyButton.addEventListener("click", toggleApiKeyVisibility);
		
		// Initialize the icon state correctly
		const eyeIcon = toggleApiKeyButton.querySelector('.icon-eye');
		const eyeOffIcon = toggleApiKeyButton.querySelector('.icon-eye-off');
		if (eyeIcon && eyeOffIcon) {
			// Start with password hidden (eye icon visible)
			eyeIcon.style.display = '';
			eyeOffIcon.style.display = 'none';
		}
	} else {
		console.warn("Toggle API key button not found");
	}

	// Temperature slider - only add listener if element exists
	if (temperatureSlider && temperatureValue) {
		temperatureSlider.addEventListener("input", () => {
			const value = parseFloat(temperatureSlider.value);
			temperatureValue.textContent = value.toFixed(1);
			updateSliderGradient(temperatureSlider);
			console.log("Temperature changed:", value);
			updateSettings({ temperature: value });
		});
	}

	// Theme options - only add listeners if elements exist
	if (themeOptions && themeOptions.length > 0) {
		themeOptions.forEach((option) => {
			option.addEventListener("change", async () => {
				if (option.checked) {
					const theme = option.value;
					console.log("Theme changed:", theme);
					
					try {
						// First update the settings (async)
						await updateSettings({ theme });
						
						// Then apply the theme immediately
						applyTheme(theme);
					} catch (error) {
						console.error('Error updating theme:', error);
						// Revert the selection if the update failed
						await loadSettings();
					}
				}
			});
		});
	}

	// Model selection - only add listener if element exists
	if (modelSelector) {
		modelSelector.addEventListener("change", () => {
			const model = modelSelector.value;
			if (modelAvailability[model] === false) {
				alert("This model is not available with your current API key");
				modelSelector.value = currentSettings.defaultModel;
				return;
			}
			console.log("Model changed:", model);
			updateSettings({ defaultModel: model });
		});
	}

	// Page scraping toggle - only add listener if element exists
	if (pageScrapingToggle) {
		pageScrapingToggle.addEventListener('change', () => {
			const enabled = pageScrapingToggle.checked;
			console.log('Page scraping toggled:', enabled);
			
			// Also update the button state in the chat component if it exists
			const searchPageButton = document.getElementById('search-page-button');
			if (searchPageButton) {
				searchPageButton.classList.toggle('active', enabled);
			}
			
			updateSettings({ pageScraping: enabled });
		});
	}

	// Web search toggle - only add listener if element exists
	if (webSearchToggle) {
		webSearchToggle.addEventListener('change', () => {
			const enabled = webSearchToggle.checked;
			
			console.log('Web search toggled:', enabled);
			
			// Also update the button state in the chat component if it exists
			const searchWebButton = document.getElementById('search-web-button');
			if (searchWebButton) {
				searchWebButton.classList.toggle('active', enabled);
			}
			
			updateSettings({ webSearch: enabled });
		});
	}

	// Repeat message trigger - only add listener if element exists
	if (repeatMessageTrigger) {
		repeatMessageTrigger.addEventListener('change', () => {
			const triggerMode = repeatMessageTrigger.value;
			console.log('Repeat message trigger changed:', triggerMode);
			updateSettings({ repeatMessageTrigger: triggerMode });
		});
	}

	// Stars animation toggle - only add listener if element exists
	if (starsAnimationToggle) {
		starsAnimationToggle.addEventListener('change', () => {
			const enabled = starsAnimationToggle.checked;
			console.log('⭐ Stars animation toggled:', enabled);
			updateSettings({ starsAnimation: enabled });
		});
	}
}

/**
 * Toggle API key visibility
 */
function toggleApiKeyVisibility() {
	if (!apiKeyInput) {
		console.error("API key input not found");
		return;
	}
	
	const type = apiKeyInput.type === "password" ? "text" : "password";
	apiKeyInput.type = type;
	
	// Toggle the SVG icons
	const eyeIcon = toggleApiKeyButton.querySelector('.icon-eye');
	const eyeOffIcon = toggleApiKeyButton.querySelector('.icon-eye-off');
	
	if (!eyeIcon || !eyeOffIcon) {
		console.error("Eye icons not found", { eyeIcon, eyeOffIcon });
		return;
	}
	
	// Get the full API key from data attribute
	const fullApiKey = apiKeyInput.getAttribute('data-full-key') || '';
	const maskedApiKey = apiKeyInput.getAttribute('data-masked-key') || '';
	
	if (type === "password") {
		// Hide the key - show masked version
		apiKeyInput.value = maskedApiKey;
		apiKeyInput.title = "API key is hidden";
		eyeIcon.style.display = '';
		eyeOffIcon.style.display = 'none';
	} else {
		// Show the key - show full version for copying
		apiKeyInput.value = fullApiKey;
		apiKeyInput.title = "Click to select all and copy the full API key";
		eyeIcon.style.display = 'none';
		eyeOffIcon.style.display = '';
		
		// Auto-select the text for easier copying
		setTimeout(() => {
			apiKeyInput.select();
		}, 100);
	}
}

/**
 * Apply settings to UI elements
 *
 * @param {Object} settings - Settings to apply
 */
function applySettingsToUI(settings) {
	console.log("Applying settings to UI:", settings);

	// Defensive: check for required elements before setting values
	const apiKeyInput = document.getElementById('api-key-input');
	if (apiKeyInput) {
		apiKeyInput.value = settings.apiKey || '';
	} else {
		console.warn('[Settings] api-key-input not found, skipping value set');
	}

	// Apply theme setting
	const themeValue = settings.theme || "system";
	if (themeOptions && themeOptions.length) {
		for (let option of themeOptions) {
			option.checked = (option.value === themeValue);
		}
	} else {
		console.warn('[Settings] themeOptions not found, skipping theme set');
	}

	// Apply temperature setting
	const temperature = settings.temperature !== undefined ? parseFloat(settings.temperature) : defaultSettings.temperature;
	if (temperatureSlider) {
		temperatureSlider.value = temperature;
		updateSliderGradient(temperatureSlider);
	} else {
		console.warn('[Settings] temperatureSlider not found, skipping temperature set');
	}
	if (temperatureValue) {
		temperatureValue.textContent = temperature.toFixed(1);
	} else {
		console.warn('[Settings] temperatureValue not found, skipping temperature value set');
	}

	// Apply model setting
	    const defaultModel = settings.defaultModel || "gpt-4.1";
	if (modelSelector) {
		modelSelector.value = defaultModel;
	} else {
		console.warn('[Settings] modelSelector not found, skipping model set');
	}

	// Apply toggle settings
	if (webSearchToggle) {
		webSearchToggle.checked = settings.webSearch === true;
	} else {
		console.warn('[Settings] webSearchToggle not found, skipping webSearch set');
	}

	if (pageScrapingToggle) {
		pageScrapingToggle.checked = settings.pageScraping === true;
	} else {
		console.warn('[Settings] pageScrapingToggle not found, skipping pageScraping set');
	}

	// Apply repeat message trigger setting
	  const repeatTrigger = settings.repeatMessageTrigger || "manual";
	if (repeatMessageTrigger) {
		repeatMessageTrigger.value = repeatTrigger;
	} else {
		console.warn('[Settings] repeatMessageTrigger not found, skipping repeatMessageTrigger set');
	}

	// Apply stars animation setting
	if (starsAnimationToggle) {
		starsAnimationToggle.checked = settings.starsAnimation === true;
	} else {
		console.warn('[Settings] starsAnimationToggle not found, skipping starsAnimation set');
	}

	console.log("Settings applied to UI - Theme:", themeValue, "Temperature:", temperature, "Repeat Trigger:", repeatTrigger);
}

/**
 * Load user settings from storage
 */
async function loadSettings() {
	try {
		// Get user preferences using Promise.race to handle timeouts
		let response;
		try {
			response = await Promise.race([
				chrome.runtime.sendMessage({
					type: MESSAGE_TYPES.GET_USER_PREFERENCES,
				}),
				new Promise((_, reject) => setTimeout(() => reject(new Error("Settings request timed out")), 5000)),
			]);
		} catch (error) {
			console.error("Error requesting settings, attempting fallback:", error);
			response = null;
		}

		// Initialize currentSettings
		if (response && response.success) {
			currentSettings = response.data;
			console.log("Settings loaded from background service:", currentSettings);
		} else {
			// Fallback to direct storage access
			try {
				console.log("Attempting direct storage access for settings");
				const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PREFERENCES);
				const userPreferences = result[STORAGE_KEYS.USER_PREFERENCES] || {};
				console.log("Settings loaded directly from storage:", userPreferences);

				// Make sure all default settings are present
				currentSettings = { ...defaultSettings };

				// Only use valid values from userPreferences
				Object.keys(defaultSettings).forEach((key) => {
					if (key in userPreferences) {
						currentSettings[key] = userPreferences[key];
					}
				});

				// If any properties were missing, update the storage
				if (Object.keys(currentSettings).some((key) => !(key in userPreferences))) {
					await chrome.storage.local.set({ [STORAGE_KEYS.USER_PREFERENCES]: currentSettings });
					console.log("Updated storage with complete settings:", currentSettings);
				}
			} catch (storageError) {
				console.error("Error accessing storage directly:", storageError);
				currentSettings = { ...defaultSettings };
			}
		}

		// Make sure all required properties exist
		if (!currentSettings || typeof currentSettings !== "object") {
			currentSettings = { ...defaultSettings };
			await chrome.storage.local.set({ [STORAGE_KEYS.USER_PREFERENCES]: currentSettings });
		} else {
			// Check for missing properties
			let needsUpdate = false;
			Object.keys(defaultSettings).forEach((key) => {
				if (!(key in currentSettings)) {
					currentSettings[key] = defaultSettings[key];
					needsUpdate = true;
				}
			});

			// Update storage if needed
			if (needsUpdate) {
				await chrome.storage.local.set({ [STORAGE_KEYS.USER_PREFERENCES]: currentSettings });
			}
		}

		// Apply settings to the UI
		applySettingsToUI(currentSettings);

		// Apply theme immediately
		applyTheme(currentSettings.theme || defaultSettings.theme);

		// Load API key
		loadApiKey();

		return currentSettings;
	} catch (error) {
		console.error("Error loading settings:", error);

		// Use default settings as fallback
		currentSettings = { ...defaultSettings };
		applySettingsToUI(defaultSettings);
		applyTheme(defaultSettings.theme);

		return currentSettings;
	}
}

/**
 * Apply the selected theme to the UI
 *
 * @param {string} theme - The theme to apply
 */
function applyTheme(theme) {
	console.log('THEME DEBUG: applyTheme called in settings.js with theme:', theme);
	
	let effectiveTheme = theme;
	
	if (theme === "system") {
		// Check system preference
		const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
		effectiveTheme = prefersDark ? "dark" : "light";
		console.log('THEME DEBUG: In settings.js, "system" theme resolved to:', effectiveTheme);
	}
	
	// Check if theme is already correctly set - use documentElement to match popup.js
	const currentTheme = document.documentElement.getAttribute("data-theme");
	console.log('THEME DEBUG: In settings.js, current theme:', currentTheme, 'effectiveTheme:', effectiveTheme);
	
	if (currentTheme !== effectiveTheme) {
		console.log('THEME DEBUG: In settings.js, updating theme from', currentTheme, 'to', effectiveTheme);
		document.documentElement.setAttribute("data-theme", effectiveTheme);
	} else {
		console.log('THEME DEBUG: In settings.js, theme already correct, not changing');
	}
	
	// Theme preference is already stored in userPreferences via updateSettings, no need for additional caching
	console.log('THEME DEBUG: Applied theme preference:', theme);
}

/**
 * Populate the model selector with available models
 */
async function populateModelSelector() {
	const modelSelector = document.getElementById('model-selector');
	if (!modelSelector) return;
	modelSelector.innerHTML = "";

	try {
		// Import constants to use centralized model list
		const { API_CONSTANTS } = await import('../../shared/constants.js');
		const models = API_CONSTANTS.AVAILABLE_MODELS;

		models.forEach((model) => {
			const option = document.createElement("option");
			option.value = model.value;
			option.textContent = model.label;
			modelSelector.appendChild(option);
		});
	} catch (error) {
		console.error('Error loading models from constants:', error);
		// Fallback to default models if import fails
		const fallbackModels = [
			        { value: "gpt-4.1-nano", label: "GPT-4.1 nano" },
			            		{ value: "gpt-4.1", label: "GPT-4.1" },
		];
		
		fallbackModels.forEach((model) => {
			const option = document.createElement("option");
			option.value = model.value;
			option.textContent = model.label;
			modelSelector.appendChild(option);
		});
	}
}

/**
 * Clear the current API key (useful for invalid keys)
 */
async function clearApiKey() {
	try {
		// Clear from storage
		await chrome.storage.local.remove(STORAGE_KEYS.API_KEY);
		
		// Try background channel if available
		try {
			await chrome.runtime.sendMessage({
				type: MESSAGE_TYPES.SET_API_KEY,
				data: { apiKey: null },
			});
		} catch (msgError) {
			console.warn("Background clear failed, but direct storage clear succeeded:", msgError);
		}
		
		// Reset UI
		apiKeyInput.value = "";
		apiKeyInput.setAttribute("data-has-key", "false");
		apiKeyInput.setAttribute("data-full-key", "");
		apiKeyInput.setAttribute("data-masked-key", "");
		lastApiKeyValue = "";
		
		console.log("API key cleared successfully");
	} catch (error) {
		console.error("Error clearing API key:", error);
	}
}

/**
 * Load the API key from storage
 */
async function loadApiKey() {
	try {
		// Try message first
		try {
			const response = await Promise.race([
				chrome.runtime.sendMessage({
					type: MESSAGE_TYPES.GET_API_KEY,
				}),
				new Promise((_, reject) => setTimeout(() => reject(new Error("API key request timed out")), 5000)),
			]);

					if (response.success && response.data) {
			// Store both full and masked versions
			const fullKey = response.data;
			const maskedKey = fullKey.replace(/^(sk-[^0-9]*)([0-9a-zA-Z]{3}).*([0-9a-zA-Z]{3})$/, "$1***$3");
			
			apiKeyInput.setAttribute("data-full-key", fullKey);
			apiKeyInput.setAttribute("data-masked-key", maskedKey);
			apiKeyInput.setAttribute("data-has-key", "true");
			
			// Show masked version by default
			apiKeyInput.value = maskedKey;
			apiKeyInput.type = "password";
			apiKeyInput.title = "API key is hidden";
			
			// Update last saved value for auto-save comparison
			lastApiKeyValue = fullKey;
			return;
		}
		} catch (error) {
			console.error("Error requesting API key via message, trying direct storage:", error);
		}

		// Fallback to direct storage
		const result = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
		const apiKey = result[STORAGE_KEYS.API_KEY];

		if (apiKey) {
			// Check if the API key is obviously invalid
			const validation = validateApiKey(apiKey);
			if (!validation.isValid && (apiKey === 'asdasd' || apiKey === 'test' || apiKey === 'demo')) {
				console.warn('Found obviously invalid API key, clearing it automatically');
				await clearApiKey();
				return;
			}
			
			// Store both full and masked versions
			const fullKey = apiKey;
			const maskedKey = fullKey.replace(/^(sk-[^0-9]*)([0-9a-zA-Z]{3}).*([0-9a-zA-Z]{3})$/, "$1***$3");
			
			apiKeyInput.setAttribute("data-full-key", fullKey);
			apiKeyInput.setAttribute("data-masked-key", maskedKey);
			apiKeyInput.setAttribute("data-has-key", "true");
			
			// Show masked version by default
			apiKeyInput.value = maskedKey;
			apiKeyInput.type = "password";
			apiKeyInput.title = "API key is hidden";
			
			// Update last saved value for auto-save comparison
			lastApiKeyValue = fullKey;
		} else {
			apiKeyInput.value = "";
			apiKeyInput.setAttribute("data-has-key", "false");
			apiKeyInput.setAttribute("data-full-key", "");
			apiKeyInput.setAttribute("data-masked-key", "");
			
			// Update last saved value for auto-save comparison
			lastApiKeyValue = "";
		}
	} catch (error) {
		console.error("Error loading API key:", error);
		apiKeyInput.value = "";
		apiKeyInput.setAttribute("data-has-key", "false");
		apiKeyInput.setAttribute("data-full-key", "");
		apiKeyInput.setAttribute("data-masked-key", "");
		
		// Update last saved value for auto-save comparison
		lastApiKeyValue = "";
	}
}

/**
 * Update slider gradient
 *
 * @param {HTMLElement} slider - The slider element
 */
function updateSliderGradient(slider) {
	const value = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
	slider.style.background = `linear-gradient(to right, var(--accent-color) 0%, var(--accent-color) ${value}%, var(--border-color) ${value}%, var(--border-color) 100%)`;
}

/**
 * Check which models are available with the current API key
 */
async function checkModelAvailability() {
	try {
		// Import constants to use centralized model list
		const { API_CONSTANTS } = await import('../../shared/constants.js');
		
		// Create availability object from centralized model list
		modelAvailability = {};
		API_CONSTANTS.AVAILABLE_MODELS.forEach(model => {
			modelAvailability[model.value] = true;
		});

		updateModelSelector();
	} catch (error) {
		console.error("Error checking model availability:", error);
		// Fallback to default models if import fails
		modelAvailability = {
			"gpt-4.1-nano": true,
			            "gpt-4.1": true,
		};
		updateModelSelector();
	}
}

/**
 * Update model selector based on availability
 */
function updateModelSelector() {
	const modelSelector = document.getElementById('model-selector');
	if (!modelSelector) return;
	Array.from(modelSelector.options).forEach((option) => {
		const model = option.value;
		const isAvailable = modelAvailability[model] !== false;

		if (!isAvailable) {
			option.disabled = true;
			option.textContent += " (Not available)";
		}
	});

	// If current model is not available, switch to default
	if (modelAvailability[modelSelector.value] === false) {
		modelSelector.value = "gpt-4.1-nano";
		        updateSettings({ defaultModel: "gpt-4.1-nano" });
	}
}

/**
 * Validate API key format
 *
 * @param {string} apiKey - The API key to validate
 * @returns {Object} - Validation result with isValid boolean and error message
 */
function validateApiKey(apiKey) {
	// Check for empty or null values
	if (!apiKey || apiKey.trim() === '') {
		return { isValid: false, error: 'API key cannot be empty' };
	}

	// Check for obvious invalid values
	if (apiKey === 'asdasd' || apiKey === 'test' || apiKey === 'demo' || apiKey.length < 10) {
		return { isValid: false, error: 'Please enter a valid OpenAI API key' };
	}

	// Basic format check
	if (!apiKey.startsWith("sk-")) {
		return { isValid: false, error: 'API key must start with "sk-"' };
	}

	if (apiKey.length < 40) {
		return { isValid: false, error: 'API key appears to be too short' };
	}

	// Check for common issues
	const commonIssues = [
		{ pattern: /\s/, message: 'API key cannot contain spaces' },
		{ pattern: /[<>]/, message: 'API key cannot contain HTML tags' },
		{ pattern: /['"]/, message: 'API key cannot contain quotes' },
	];

	for (const issue of commonIssues) {
		if (issue.pattern.test(apiKey)) {
			return { isValid: false, error: issue.message };
		}
	}

	return { isValid: true, error: null };
}

/**
 * Setup auto-save functionality for API key
 */
function setupApiKeyAutoSave() {
	// Store initial value
	lastApiKeyValue = apiKeyInput.value;
	
	// Auto-save on blur (unfocus)
	apiKeyInput.addEventListener('blur', () => {
		if (apiKeyInput.value.trim() !== lastApiKeyValue) {
			saveApiKeyAutomatic();
		}
	});
	
	// Auto-save on paste
	apiKeyInput.addEventListener('paste', () => {
		// Small delay to let paste complete
		setTimeout(() => {
			if (apiKeyInput.value.trim() !== lastApiKeyValue) {
				saveApiKeyAutomatic();
			}
		}, 100);
	});
	
	// Auto-save on input with debouncing (for typing)
	apiKeyInput.addEventListener('input', () => {
		// Clear existing timeout
		if (apiKeySaveTimeout) {
			clearTimeout(apiKeySaveTimeout);
		}
		
		// Set new timeout for debounced save
		apiKeySaveTimeout = setTimeout(() => {
			if (apiKeyInput.value.trim() !== lastApiKeyValue) {
				saveApiKeyAutomatic();
			}
		}, 2000); // 2 second delay after user stops typing
	});
	
	// Auto-save on Enter key
	apiKeyInput.addEventListener('keydown', (event) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			if (apiKeyInput.value.trim() !== lastApiKeyValue) {
				saveApiKeyAutomatic();
			}
		}
	});
	
	// Auto-save before page unloads
	window.addEventListener('beforeunload', () => {
		if (apiKeyInput.value.trim() !== lastApiKeyValue) {
			saveApiKeyAutomatic();
		}
	});
}

/**
 * Handle saving the API key automatically (without user prompts)
 */
async function saveApiKeyAutomatic() {
	const inputValue = apiKeyInput.value.trim();
	
	// Get the current full key from data attribute if input is masked
	const isPasswordType = apiKeyInput.type === "password";
	const fullApiKey = apiKeyInput.getAttribute('data-full-key') || '';
	const maskedApiKey = apiKeyInput.getAttribute('data-masked-key') || '';
	
	// Determine the actual API key value
	let apiKey;
	if (isPasswordType && inputValue === maskedApiKey && fullApiKey) {
		// Input is showing masked version, but we have the full key
		apiKey = fullApiKey;
	} else if (!isPasswordType && inputValue && inputValue !== maskedApiKey) {
		// Input is showing full version and has been edited
		apiKey = inputValue;
	} else if (inputValue && inputValue !== maskedApiKey && inputValue !== fullApiKey) {
		// Input has been edited to a new value
		apiKey = inputValue;
	} else {
		// No changes or just toggling visibility
		return;
	}

	// Don't save empty keys
	if (!apiKey) {
		return;
	}
	
	// Don't save if value hasn't changed
	if (apiKey === lastApiKeyValue) {
		return;
	}

	// Validate API key before saving
	const validation = validateApiKey(apiKey);
	if (!validation.isValid) {
		console.warn('Invalid API key detected:', validation.error);
		// For obviously invalid keys like "asdasd", don't save them
		if (apiKey === 'asdasd' || apiKey === 'test' || apiKey === 'demo') {
			console.warn('Refusing to save obviously invalid API key');
			return;
		}
		// For other validation issues, still save but log the warning
	}

	try {
		// First save directly to storage as fallback
		await chrome.storage.local.set({ [STORAGE_KEYS.API_KEY]: apiKey });

		// Try background channel if available
		try {
			const saveResponse = await chrome.runtime.sendMessage({
				type: MESSAGE_TYPES.SET_API_KEY,
				data: { apiKey },
			});

			if (!saveResponse.success) {
				console.warn("Background save not successful, but direct storage succeeded");
			}
		} catch (msgError) {
			console.warn("Background save failed, but direct storage succeeded:", msgError);
		}

		// Update last saved value
		lastApiKeyValue = apiKey;
		
		// Update the data attributes with the new key
		const newMaskedKey = apiKey.replace(/^(sk-[^0-9]*)([0-9a-zA-Z]{3}).*([0-9a-zA-Z]{3})$/, "$1***$3");
		apiKeyInput.setAttribute("data-full-key", apiKey);
		apiKeyInput.setAttribute("data-masked-key", newMaskedKey);
		apiKeyInput.setAttribute("data-has-key", "true");
		
		// Show subtle feedback
		console.log("API key saved automatically");
		showApiKeySaveSuccess();
		
		// Reset toggle state to hidden after save
		apiKeyInput.type = "password";
		apiKeyInput.value = newMaskedKey;
		const eyeIcon = toggleApiKeyButton.querySelector('.icon-eye');
		const eyeOffIcon = toggleApiKeyButton.querySelector('.icon-eye-off');
		if (eyeIcon && eyeOffIcon) {
			eyeIcon.style.display = '';
			eyeOffIcon.style.display = 'none';
		}

		// Check model availability with new key
		checkModelAvailability();
		
		// Notify chat component that API key has been added
		window.dispatchEvent(new CustomEvent('api-key-added'));
	} catch (error) {
		console.error("Error saving API key:", error);
		// Could show a subtle error indicator here instead of alert
	}
}

/**
 * Update user settings
 *
 * @param {Object} settings - The settings to update
 */
async function updateSettings(settings) {
	try {
		// First try through message
		let success = false;
		try {
			const response = await chrome.runtime.sendMessage({
				type: MESSAGE_TYPES.UPDATE_USER_PREFERENCES,
				data: settings,
			});

			if (response.success) {
				currentSettings = response.data;
				success = true;
			}
		} catch (msgError) {
			console.warn("Failed to update settings via message:", msgError);
		}

		// If message failed, update directly in storage
		if (!success) {
			// Get current settings
			const result = await chrome.storage.local.get(STORAGE_KEYS.USER_PREFERENCES);
			const currentPrefs = result[STORAGE_KEYS.USER_PREFERENCES] || defaultSettings;

			// Update with new settings
			const updatedSettings = { ...currentPrefs, ...settings };

			// Save back to storage
			await chrome.storage.local.set({
				[STORAGE_KEYS.USER_PREFERENCES]: updatedSettings,
			});

			currentSettings = updatedSettings;
		}

		// Dispatch a settings updated event
		window.dispatchEvent(
			new CustomEvent("settings-updated", {
				detail: { settings: currentSettings },
			})
		);

		console.log("Settings updated successfully:", settings);
	} catch (error) {
		console.error("Error updating settings:", error);
		// Restore previous settings in UI
		applySettingsToUI(currentSettings);
	}
}

/**
 * Show a brief success message when API key is saved
 */
function showApiKeySaveSuccess() {
	// Remove any existing success message
	const existingMessage = document.querySelector('.api-key-save-success');
	if (existingMessage) {
		existingMessage.remove();
	}

	// Create success message element
	const successMessage = document.createElement('div');
	successMessage.className = 'api-key-save-success';
	successMessage.textContent = '✓ API key saved';

	// Insert after the API key input container
	const apiKeyContainer = document.querySelector('.api-key-input-container');
	if (apiKeyContainer) {
		apiKeyContainer.style.position = 'relative';
		apiKeyContainer.appendChild(successMessage);

		// Animate in
		setTimeout(() => {
			successMessage.style.opacity = '1';
			successMessage.style.transform = 'translateX(-50%) translateY(0)';
		}, 10);

		// Remove after 2 seconds
		setTimeout(() => {
			successMessage.style.opacity = '0';
			successMessage.style.transform = 'translateX(-50%) translateY(10px)';
			setTimeout(() => {
				if (successMessage.parentNode) {
					successMessage.remove();
				}
			}, 300);
		}, 2000);
	}
}

export default {
	initializeSettingsComponent,
};
