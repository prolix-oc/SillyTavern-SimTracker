import { getContext, extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced, messageFormatting } from '../../../../script.js';

const MODULE_NAME = 'SillySimTracker';
const CONTAINER_ID = 'silly-sim-tracker-container';
const SETTINGS_ID = 'silly-sim-tracker-settings';

const default_settings = {
    isEnabled: true,
    codeBlockIdentifier: "sim",
    defaultBgColor: "#6a5acd",
    showThoughtBubble: true,
    templateFile: "default-card-template.html",
};

let settings = {};
const settings_ui_map = {};

// --- UTILITY FUNCTIONS ---
const log = (message) => console.log(`[SST] [${MODULE_NAME}]`, message);
const get_settings = (key) => settings[key] ?? default_settings[key];
const set_settings = (key, value) => {
    settings[key] = value;
    saveSettingsDebounced();
};
const darkenColor = (hex) => {
    if (!hex || hex.length < 7) return '#6a5acd';
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    r = Math.floor(r * 0.7).toString(16).padStart(2, '0');
    g = Math.floor(g * 0.7).toString(16).padStart(2, '0');
    b = Math.floor(b * 0.7).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
};
const getContrastColor = (hex) => {
    if (!hex || hex.length < 7) return 'rgba(255,255,255,0.9)';
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // Return light color for dark backgrounds, dark color for light backgrounds
    return luminance > 0.5 ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)';
};
const getReactionEmoji = (reactValue) => {
    switch (parseInt(reactValue, 10)) {
        case 1: return '👍';
        case 2: return '👎';
        default: return '😐';
    }
};

const get_extension_directory = () => {
    const index_path = new URL(import.meta.url).pathname;
    return index_path.substring(0, index_path.lastIndexOf('/'));
};

// --- TEMPLATES ---
const wrapperTemplate = `<div id="${CONTAINER_ID}" style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">{{{cardsHtml}}}</div>`;
let compiledWrapperTemplate = Handlebars.compile(wrapperTemplate);
let compiledCardTemplate = null;

// Register Handlebars helpers for template logic
Handlebars.registerHelper('eq', function(a, b) {
    return a === b;
});

Handlebars.registerHelper('gt', function(a, b) {
    return a > b;
});

Handlebars.registerHelper('unless', function(conditional, options) {
    if (!conditional) {
        return options.fn(this);
    } else {
        return options.inverse(this);
    }
});

// Load template from file
const loadTemplate = async () => {
    const templateFile = get_settings('templateFile');
    const templatePath = `${get_extension_directory()}/tracker-card-templates/${templateFile}`;

    try {
        const response = await $.get(templatePath);
        log(`Raw template response length: ${response.length}`);
        
        // Look for template markers BEFORE removing HTML comments
        const cardStartMarker = '<!-- CARD_TEMPLATE_START -->';
        const cardEndMarker = '<!-- CARD_TEMPLATE_END -->';
        
        let cardTemplate = '';
        
        // Check if the template has explicit markers in the raw response
        const startIndex = response.indexOf(cardStartMarker);
        const endIndex = response.indexOf(cardEndMarker);
        
        if (startIndex !== -1 && endIndex !== -1) {
            // Extract content between markers
            cardTemplate = response.substring(
                startIndex + cardStartMarker.length, 
                endIndex
            ).trim();
            log(`Extracted card template using markers, length: ${cardTemplate.length}`);
        } else {
            // Fallback: Look for the outermost div that contains template variables
            // This is more robust than looking for specific CSS properties
            
            // Clean the response by removing HTML comments for fallback analysis
            let cleanedResponse = response.replace(/<!--[\s\S]*?-->/g, '').trim();
            log(`Cleaned response length: ${cleanedResponse.length}`);
            
            const templateVarRegex = /\{\{[^}]+\}\}/;
            
            // Find all div elements and check which ones contain template variables
            const divMatches = [...cleanedResponse.matchAll(/<div[^>]*>[\s\S]*?<\/div>/g)];
            
            // Find the largest div that contains template variables
            let bestMatch = null;
            let maxLength = 0;
            
            for (const match of divMatches) {
                if (templateVarRegex.test(match[0]) && match[0].length > maxLength) {
                    bestMatch = match[0];
                    maxLength = match[0].length;
                }
            }
            
            if (bestMatch) {
                cardTemplate = bestMatch;
                log(`Extracted card template using content analysis, length: ${cardTemplate.length}`);
            } else {
                throw new Error('Could not find template content with Handlebars variables');
            }
        }
        
        if (cardTemplate) {
            // Validate that the template contains expected variables
            const requiredVars = ['{{characterName}}', '{{stats.ap}}', '{{stats.dp}}', '{{stats.tp}}', '{{stats.cp}}'];
            const missingVars = requiredVars.filter(varName => !cardTemplate.includes(varName));
            
            if (missingVars.length > 0) {
                log(`Warning: Template missing required variables: ${missingVars.join(', ')}`);
            }
            
            compiledCardTemplate = Handlebars.compile(cardTemplate);
            log(`Template compiled successfully from: ${templateFile}`);
        } else {
            throw new Error('Could not extract card template content');
        }
        
    } catch (error) {
        log(`Error loading template from ${templateFile}: ${error.message}. Using fallback template.`);
        // Fallback to basic template
        const fallbackTemplate = `
        <div style="flex:1 1 100%;min-width:380px;max-width:500px;height:340px;background:linear-gradient(145deg, {{bgColor}} 0%, {{darkerBgColor}} 100%);border-radius:16px;padding:16px;box-sizing:border-box;position:relative;color:#fff;font-size:14px;font-weight:500;">
            <div style="font-size:24px;font-weight:700;margin-bottom:16px;">{{characterName}}</div>
            <div style="margin-bottom:8px;">Date: {{currentDate}}</div>
            <div style="margin-bottom:8px;">Day: {{stats.days_since_first_meeting}}</div>
            <div style="display:flex;gap:16px;margin-bottom:16px;">
                <div>❤️ {{stats.ap}}</div>
                <div>🔥 {{stats.dp}}</div>
                <div>🤝 {{stats.tp}}</div>
                <div>💔 {{stats.cp}}</div>
            </div>
            {{#if showThoughtBubble}}
            <div style="background:rgba(255,255,255,0.1);padding:12px;border-radius:8px;">
                💭 {{stats.internal_thought}}
            </div>
            {{/if}}
        </div>`;
        compiledCardTemplate = Handlebars.compile(fallbackTemplate);
    }
};

// --- RENDER LOGIC ---
const renderTracker = (mesId) => {
    try {
        if (!get_settings('isEnabled')) return;

        const context = getContext();
        const message = context.chat[mesId];

        if (!message) {
            log(`[SST] Error: Could not find message with ID ${mesId}. Aborting render.`);
            return;
        }

        const messageElement = document.querySelector(`div[mesid="${mesId}"] .mes_text`);
        if (!messageElement || messageElement.querySelector(`#${CONTAINER_ID}`)) return;

        const identifier = get_settings('codeBlockIdentifier');
        const jsonRegex = new RegExp("```" + identifier + "\\s*([\\s\\S]*?)\\s*```");
        const match = message.mes.match(jsonRegex);

        if (match && match[1]) {
            let jsonData;
            try {
                jsonData = JSON.parse(match[1]);
            } catch (jsonError) {
                log(`[SST] Failed to parse JSON in message ID ${mesId}. Error: ${jsonError.message}`);
                // Optional: Display an error message to the user in the UI.
                messageElement.insertAdjacentHTML('beforeend', `<div style="color: red; font-family: monospace;">[SillySimTracker] Error: Invalid JSON in code block.</div>`);
                return; // Stop execution for this message.
            }

            // ADDED: Check if the parsed data is an object.
            if (typeof jsonData !== 'object' || jsonData === null) {
                log(`[SST] Parsed data in message ID ${mesId} is not a valid object.`);
                return;
            }

            const currentDate = jsonData.current_date || 'Unknown Date';
            const characterNames = Object.keys(jsonData).filter(key => key !== 'current_date');

            if (!characterNames.length) return;

            const cardsHtml = characterNames.map(name => {
                const stats = jsonData[name];
                // ADDED: Check if stats for a character exist to prevent errors.
                if (!stats) {
                    log(`[SST] No stats found for character "${name}" in message ID ${mesId}. Skipping card.`);
                    return ''; // Return an empty string for this card
                }
                const bgColor = stats.bg || get_settings('defaultBgColor');
                const cardData = {
                    characterName: name,
                    currentDate: currentDate,
                    stats: {
                        ...stats,
                        internal_thought: stats.internal_thought || stats.thought || "No thought recorded."
                    },
                    bgColor: bgColor,
                    darkerBgColor: darkenColor(bgColor),
                    contrastColor: getContrastColor(bgColor),
                    reactionEmoji: getReactionEmoji(stats.last_react),
                    healthIcon: stats.health === 1 ? '🤕' : stats.health === 2 ? '💀' : null,
                    showThoughtBubble: get_settings('showThoughtBubble'),
                };
                return compiledCardTemplate(cardData);
            }).join('');

            const finalHtml = compiledWrapperTemplate({ cardsHtml });
            const formattedContent = messageFormatting(finalHtml);
            $(messageElement).append(formattedContent);
        }
    } catch (error) {
        log(`[SST] A critical error occurred in renderTracker for message ID ${mesId}. Please check the console. Error: ${error.stack}`);
    }
};

// --- SETTINGS MANAGEMENT ---

const refresh_settings_ui = () => {
    for (const [key, [element, type]] of Object.entries(settings_ui_map)) {
        const value = get_settings(key);
        switch (type) {
            case 'boolean': element.prop('checked', value); break;
            case 'text': case 'color': element.val(value); break;
        }
    }
};

const refreshAllCards = () => {
    log("Refreshing all tracker cards on screen.");
    
    // First, remove all existing tracker containers to prevent duplicates
    document.querySelectorAll(`#${CONTAINER_ID}`).forEach(container => {
        container.remove();
    });
    
    // Get all message divs currently in the chat DOM
    const visibleMessages = document.querySelectorAll('div#chat .mes');
    visibleMessages.forEach(messageElement => {
        const mesId = messageElement.getAttribute('mesid');
        if (mesId) {
            // Call the existing render function for each visible message
            renderTracker(parseInt(mesId, 10));
        }
    });
};

const bind_setting = (selector, key, type) => {
    const element = $(`#${SETTINGS_ID} ${selector}`);
    if (element.length === 0) { log(`Could not find settings element: ${selector}`); return; }
    settings_ui_map[key] = [element, type];
    element.on('change input', () => {
        let value;
        switch (type) {
            case 'boolean': value = element.prop('checked'); break;
            case 'text': case 'color': value = element.val(); break;
        }
        set_settings(key, value);

        // Reload template if template file setting changed
        if (key === 'templateFile') {
            loadTemplate().then(() => {
                // Refresh all cards with the new template
                refreshAllCards();
            });
        }
    });
};

const initialize_settings_listeners = () => {
    log("Binding settings UI elements...");

    // Bind all your settings directly
    bind_setting('#isEnabled', 'isEnabled', 'boolean');
    bind_setting('#codeBlockIdentifier', 'codeBlockIdentifier', 'text');
    bind_setting('#defaultBgColor', 'defaultBgColor', 'color');
    bind_setting('#showThoughtBubble', 'showThoughtBubble', 'boolean');
    bind_setting('#templateFile', 'templateFile', 'text');

    // Refresh the UI with the current values
    refresh_settings_ui();
    log("Settings UI successfully bound.");
};

const initialize_settings = () => {
    extension_settings[MODULE_NAME] = Object.assign({}, default_settings, extension_settings[MODULE_NAME]);
    settings = extension_settings[MODULE_NAME];
};

const load_settings_html_manually = async () => {
    const settingsHtmlPath = `${get_extension_directory()}/settings.html`;
    try {
        const response = await $.get(settingsHtmlPath);
        $("#extensions_settings2").append(response);
        log("Settings HTML manually injected into right-side panel.");
    } catch (error) {
        log(`Error loading settings.html: ${error.statusText}`);
        console.error(error);
    }
};


// --- ENTRY POINT ---
jQuery(async () => {
    try {
        log(`Initializing extension: ${MODULE_NAME}`);

        // Initialize settings data from storage
        initialize_settings();
        await load_settings_html_manually();
        // Initialize settings UI listeners
        initialize_settings_listeners();
        log("Settings panel listeners initialized.");

        // Load the template
        await loadTemplate();

        const context = getContext();
        const { eventSource, event_types } = context;
        
        eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, renderTracker);
        eventSource.on(event_types.CHAT_CHANGED, refreshAllCards);
        eventSource.on(event_types.MORE_MESSAGES_LOADED, refreshAllCards);
        eventSource.on(event_types.MESSAGE_EDITED, (mesId) => {
            log(`Message ${mesId} was edited. Re-rendering tracker card.`);
            renderTracker(mesId);
        });
        
        refreshAllCards();
        log(`${MODULE_NAME} has been successfully loaded.`);
    } catch (error) {
        console.error(`[${MODULE_NAME}] A critical error occurred during initialization. The extension may not work correctly. Error: ${error.stack}`);
    }
});
