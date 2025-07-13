/**
 * Settings Component
 *
 * Handles user preferences and API key management.
 */

import { MESSAGE_TYPES, API_CONSTANTS, UI_CONSTANTS } from "../../shared/constants.js";

// DOM elements
let settingsContainer;
let apiKeyInput;
let toggleApiKeyButton;
let saveApiKeyButton;
let temperatureSlider;
let temperatureValue;
let themeOptions;
let modelSelector;
let webSearchToggle;
let pageScrapingToggle;
let repeatMessageTrigger;

// Settings state
let currentSettings = null;
let modelAvailability = {};

// Storage keys (copied from old app to maintain compatibility)
const STORAGE_KEYS = {
	USER_PREFERENCES: "userPreferences",
	API_KEY: "openai_api_key",
};

// Default settings
const defaultSettings = {
	theme: "system",
	temperature: 0,
	pageScraping: true, // Changed to true
	webSearch: false,
	currentSiteFilter: false, // Changed to false
	defaultModel: "gpt-4o-mini",
	repeatMessageTrigger: "manual", // Changed to manual
};

/**
 * Initialize the settings component
 */
export async function initializeSettingsComponent() {
	console.log("Initializing settings component");

	// Get DOM elements
	settingsContainer = document.getElementById("settings-container");
	apiKeyInput = document.getElementById("api-key-input");
	toggleApiKeyButton = document.getElementById("toggle-api-key-button");
	saveApiKeyButton = document.getElementById("save-api-key-button");
	
	console.log("Settings DOM elements found:", {
		settingsContainer: !!settingsContainer,
		apiKeyInput: !!apiKeyInput,
		toggleApiKeyButton: !!toggleApiKeyButton,
		saveApiKeyButton: !!saveApiKeyButton
	});
	temperatureSlider = document.getElementById("temperature-slider");
	temperatureValue = document.getElementById("temperature-value");
	themeOptions = document.getElementsByName("theme");
	modelSelector = document.getElementById("model-selector");
	webSearchToggle = document.getElementById("web-search-toggle");
	pageScrapingToggle = document.getElementById("page-scraping-toggle");
	repeatMessageTrigger = document.getElementById("repeat-message-trigger");

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
	});

	console.log("Settings component initialized");
}

/**
 * Set up event listeners for settings interactions
 */
function setupEventListeners() {
	// API key management - only add listeners if elements exist
	if (saveApiKeyButton) {
		saveApiKeyButton.addEventListener("click", handleSaveApiKey);
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
			option.addEventListener("change", () => {
				if (option.checked) {
					const theme = option.value;
					console.log("Theme changed:", theme);
					updateSettings({ theme });
					applyTheme(theme);
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
			
			if (enabled && !modelAvailability['gpt-4o-mini']) {
				alert('Web search is only available with GPT-4o mini model');
				webSearchToggle.checked = false;
				return;
			}
			
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
			if (option.value === themeValue) {
				option.checked = true;
			}
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
	const defaultModel = settings.defaultModel || "gpt-4o-mini";
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
	const repeatTrigger = settings.repeatMessageTrigger || "auto";
	if (repeatMessageTrigger) {
		repeatMessageTrigger.value = repeatTrigger;
	} else {
		console.warn('[Settings] repeatMessageTrigger not found, skipping repeatMessageTrigger set');
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
	
	// Check if theme is already correctly set
	const currentTheme = document.body.getAttribute("data-theme");
	console.log('THEME DEBUG: In settings.js, current theme:', currentTheme, 'effectiveTheme:', effectiveTheme);
	
	if (currentTheme !== effectiveTheme) {
		console.log('THEME DEBUG: In settings.js, updating theme from', currentTheme, 'to', effectiveTheme);
		document.body.setAttribute("data-theme", effectiveTheme);
	} else {
		console.log('THEME DEBUG: In settings.js, theme already correct, not changing');
	}
	
	// Store the effective theme in localStorage for immediate access on next popup
	localStorage.setItem('temp_theme_preference', effectiveTheme);
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
			{ value: "gpt-4o-mini", label: "GPT-4o mini (Default)" },
			{ value: "gpt-4.1-nano", label: "GPT-4.1 nano" },
			{ value: "o4-mini-deep-research", label: "o4-mini Deep Research" },
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
			return;
		}
		} catch (error) {
			console.error("Error requesting API key via message, trying direct storage:", error);
		}

		// Fallback to direct storage
		const result = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
		const apiKey = result[STORAGE_KEYS.API_KEY];

		if (apiKey) {
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
		} else {
			apiKeyInput.value = "";
			apiKeyInput.setAttribute("data-has-key", "false");
			apiKeyInput.setAttribute("data-full-key", "");
			apiKeyInput.setAttribute("data-masked-key", "");
		}
	} catch (error) {
		console.error("Error loading API key:", error);
		apiKeyInput.value = "";
		apiKeyInput.setAttribute("data-has-key", "false");
		apiKeyInput.setAttribute("data-full-key", "");
		apiKeyInput.setAttribute("data-masked-key", "");
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
			"gpt-4o-mini": true,
			"gpt-4.1-nano": true,
			"o4-mini-deep-research": true,
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
		modelSelector.value = "gpt-4o-mini";
		updateSettings({ defaultModel: "gpt-4o-mini" });
	}
}

/**
 * Validate API key format
 *
 * @param {string} apiKey - The API key to validate
 * @returns {boolean} - Whether the key is valid
 */
function validateApiKey(apiKey) {
	// Basic format check
	if (!apiKey.startsWith("sk-") || apiKey.length < 40) {
		return false;
	}

	// Check for common issues
	const commonIssues = [
		/\s/, // Contains whitespace
		/[<>]/, // Contains HTML tags
		/['"]/, // Contains quotes
		/^sk-[a-zA-Z0-9]{48}$/, // Doesn't match expected format
	];

	return !commonIssues.some((issue) => issue.test(apiKey));
}

/**
 * Handle saving the API key
 */
async function handleSaveApiKey() {
	const apiKey = apiKeyInput.value.trim();

	if (!apiKey) {
		alert("Please enter an API key");
		return;
	}

	// Validate key format
	if (!validateApiKey(apiKey)) {
		const confirm = window.confirm(
			'This doesn\'t look like a valid OpenAI API key. It should start with "sk-" and be about 51 characters long. Are you sure you want to save it?'
		);
		if (!confirm) return;
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

		// Show success message
		alert("API key saved successfully");

		// Reload the key display
		loadApiKey();
		
		// Reset toggle state to hidden after save
		apiKeyInput.type = "password";
		const eyeIcon = toggleApiKeyButton.querySelector('.icon-eye');
		const eyeOffIcon = toggleApiKeyButton.querySelector('.icon-eye-off');
		if (eyeIcon && eyeOffIcon) {
			eyeIcon.style.display = '';
			eyeOffIcon.style.display = 'none';
		}

		// Check model availability with new key
		checkModelAvailability();
	} catch (error) {
		console.error("Error saving API key:", error);
		alert(`Error saving API key: ${error.message}`);
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

export default {
	initializeSettingsComponent,
};
