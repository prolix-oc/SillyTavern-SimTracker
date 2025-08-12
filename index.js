import { getContext, extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced, messageFormatting } from '../../../../script.js';
import { MacrosParser } from '../../../macros.js';

const MODULE_NAME = 'SillySimTracker';
const CONTAINER_ID = 'silly-sim-tracker-container';
const SETTINGS_ID = 'silly-sim-tracker-settings';

const default_settings = {
    isEnabled: true,
    codeBlockIdentifier: "sim",
    defaultBgColor: "#6a5acd",
    showThoughtBubble: true,
    customTemplateHtml: '',
    templateFile: "default-card-template.html",
    datingSimPrompt: "Default prompt could not be loaded. Please check file path.",
};

let settings = {};
const settings_ui_map = {};
let lastSimJsonString = '';

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
Handlebars.registerHelper('eq', function (a, b) {
    return a === b;
});

Handlebars.registerHelper('gt', function (a, b) {
    return a > b;
});

Handlebars.registerHelper('unless', function (conditional, options) {
    if (!conditional) {
        return options.fn(this);
    } else {
        return options.inverse(this);
    }
});

const loadDefaultPromptFromFile = async () => {
    const promptPath = `${get_extension_directory()}/prompts/default-prompt.md`;
    try {
        const response = await $.get(promptPath);
        log(`Successfully loaded default prompt from ${promptPath}`);
        return response;
    } catch (error) {
        log(`Error loading default prompt from ${promptPath}. The file might be missing. Error: ${error.statusText}`);
        console.error(error);
        return null; // Return null on failure
    }
};

function populateTemplateDropdown() {
    log('Populating template dropdown with default templates...');

    const defaultFiles = [
        "default-card-template.html"
    ];

    const $select = $('#templateFile');
    const currentSelection = get_settings('templateFile');

    $select.empty();
    defaultFiles.forEach(file => {
        $select.append($('<option>', { value: file, text: file }));
    });

    if (defaultFiles.includes(currentSelection)) {
        $select.val(currentSelection);
    } else if (defaultFiles.length > 0) {
        $select.val(defaultFiles[0]);
        set_settings('templateFile', defaultFiles[0]);
    }

    log('Default template dropdown populated.');
}

function handleCustomTemplateUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        return; // User cancelled the dialog
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const content = e.target.result;
        log(`Read custom template ${file.name}, size: ${content.length}`);
        set_settings('customTemplateHtml', content);
        toastr.success(`Custom template "${file.name}" loaded and applied!`);

        // Immediately reload the template logic and refresh all cards
        await loadTemplate();
        refreshAllCards();
    };
    reader.readAsText(file);

    event.target.value = '';
}

// Load template from file
const loadTemplate = async () => {
    const customTemplateHtml = get_settings('customTemplateHtml');

    if (customTemplateHtml && customTemplateHtml.trim() !== '') {
        log("Loading template from custom HTML stored in settings.");
        try {
            const cardStartMarker = '<!-- CARD_TEMPLATE_START -->';
            const cardEndMarker = '<!-- CARD_TEMPLATE_END -->';
            let cardTemplate = '';

            const startIndex = customTemplateHtml.indexOf(cardStartMarker);
            const endIndex = customTemplateHtml.indexOf(cardEndMarker);

            if (startIndex !== -1 && endIndex !== -1) {
                cardTemplate = customTemplateHtml.substring(startIndex + cardStartMarker.length, endIndex).trim();
            } else {
                let cleanedResponse = customTemplateHtml.replace(/<!--[\s\S]*?-->/g, '').trim();
                const templateVarRegex = /\{\{[^}]+\}\}/;
                const divMatches = [...cleanedResponse.matchAll(/<div[^>]*>[\s\S]*?<\/div>/g)];
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
                } else {
                    throw new Error('Could not find template content with either markers or Handlebars variables.');
                }
            }

            compiledCardTemplate = Handlebars.compile(cardTemplate);
            log("Custom HTML template compiled successfully.");
            return; // Exit successfully
        } catch (error) {
            log(`Error parsing custom HTML template: ${error.message}. Reverting to default file-based template.`);
            toastr.error('The custom HTML template could not be parsed. Check its format.', 'Template Error');
        }
    }

    const templateFile = get_settings('templateFile');
    if (templateFile) {
        const defaultPath = `${get_extension_directory()}/tracker-card-templates/${templateFile}`;
        try {
            const templateContent = await $.get(defaultPath);
            log(`Loading template from default file: ${defaultPath}`);
            // Re-run the same parsing logic for the file content
            const cardStartMarker = '<!-- CARD_TEMPLATE_START -->';
            const cardEndMarker = '<!-- CARD_TEMPLATE_END -->';
            let cardTemplate = '';
            const startIndex = templateContent.indexOf(cardStartMarker);
            const endIndex = templateContent.indexOf(cardEndMarker);
            if (startIndex !== -1 && endIndex !== -1) {
                cardTemplate = templateContent.substring(startIndex + cardStartMarker.length, endIndex).trim();
            } else {
                let cleanedResponse = templateContent.replace(/<!--[\s\S]*?-->/g, '').trim();
                const templateVarRegex = /\{\{[^}]+\}\}/;
                const divMatches = [...cleanedResponse.matchAll(/<div[^>]*>[\s\S]*?<\/div>/g)];
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
                } else {
                    throw new Error('Could not find template content with either markers or Handlebars variables.');
                }
            }
            compiledCardTemplate = Handlebars.compile(cardTemplate);
            log(`Default template '${templateFile}' compiled successfully.`);
            return; // Exit successfully
        } catch (error) {
            log(`Could not load or parse default template file '${templateFile}'. Using hardcoded fallback.`);
        }
    }

    log("Using hardcoded fallback template as a last resort.");
    const fallbackTemplate = `
    <div style="flex:1 1 100%;min-width:380px;max-width:500px;background:red;border-radius:16px;padding:16px;color:#fff;">
        <b>Template Error</b><br>
        No custom template is loaded and the selected default template could not be found or parsed.
    </div>`;
    compiledCardTemplate = Handlebars.compile(fallbackTemplate);
};

// --- RENDER LOGIC ---
const renderTracker = (mesId) => {
    try {
        if (!get_settings('isEnabled')) return;
        const context = getContext();
        const message = context.chat[mesId];
        if (!message) {
            log(`Error: Could not find message with ID ${mesId}. Aborting render.`);
            return;
        }
        const messageElement = document.querySelector(`div[mesid="${mesId}"] .mes_text`);
        if (!messageElement || messageElement.querySelector(`#${CONTAINER_ID}`)) return;

        const identifier = get_settings('codeBlockIdentifier');
        const jsonRegex = new RegExp("```" + identifier + "\\s*([\\s\\S]*?)\\s*```");
        const match = message.mes.match(jsonRegex);

        if (match && match[1]) {
            // --- NEW --- Capture the raw JSON string for the {{last_sim_stats}} macro
            lastSimJsonString = match[1].trim();
            log(`Captured last sim stats JSON.`);

            let jsonData;
            try {
                jsonData = JSON.parse(match[1]);
            } catch (jsonError) {
                log(`Failed to parse JSON in message ID ${mesId}. Error: ${jsonError.message}`);
                messageElement.insertAdjacentHTML('beforeend', `<div style="color: red; font-family: monospace;">[SillySimTracker] Error: Invalid JSON in code block.</div>`);
                return;
            }

            if (typeof jsonData !== 'object' || jsonData === null) {
                log(`Parsed data in message ID ${mesId} is not a valid object.`);
                return;
            }

            const currentDate = jsonData.current_date || 'Unknown Date';
            const characterNames = Object.keys(jsonData).filter(key => key !== 'current_date');
            if (!characterNames.length) return;

            const cardsHtml = characterNames.map(name => {
                const stats = jsonData[name];
                if (!stats) {
                    log(`No stats found for character "${name}" in message ID ${mesId}. Skipping card.`);
                    return '';
                }
                const bgColor = stats.bg || get_settings('defaultBgColor');
                const cardData = {
                    characterName: name,
                    currentDate: currentDate,
                    stats: { ...stats, internal_thought: stats.internal_thought || stats.thought || "No thought recorded." },
                    bgColor: bgColor,
                    darkerBgColor: darkenColor(bgColor),
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
        log(`A critical error occurred in renderTracker for message ID ${mesId}. Please check the console. Error: ${error.stack}`);
    }
};

// --- SETTINGS MANAGEMENT ---

const refresh_settings_ui = () => {
    for (const [key, [element, type]] of Object.entries(settings_ui_map)) {
        const value = get_settings(key);
        switch (type) {
            case 'boolean': element.prop('checked', value); break;
            case 'text': case 'color': case 'textarea': element.val(value); break;
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
            case 'text': case 'color': case 'textarea': value = element.val(); break;
        }
        set_settings(key, value);
        if (key === 'templateFile') {
            loadTemplate().then(() => {
                refreshAllCards();
            });
        }
    });
};

const initialize_settings_listeners = () => {
    log("Binding settings UI elements...");

    bind_setting('#isEnabled', 'isEnabled', 'boolean');
    bind_setting('#codeBlockIdentifier', 'codeBlockIdentifier', 'text');
    bind_setting('#defaultBgColor', 'defaultBgColor', 'color');
    bind_setting('#showThoughtBubble', 'showThoughtBubble', 'boolean');
    bind_setting('#datingSimPrompt', 'datingSimPrompt', 'textarea');

    // Listener for the default template dropdown
    const $templateSelect = $('#templateFile');
    if ($templateSelect.length) {
        settings_ui_map['templateFile'] = [$templateSelect, 'text'];
        $templateSelect.on('change', async () => {
            set_settings('templateFile', $templateSelect.val());
            await loadTemplate();
            refreshAllCards();
        });
    }

    $('#uploadCustomTemplateBtn').on('click', () => {
        $('#customTemplateUpload').click(); // Trigger the hidden file input
    });

    $('#customTemplateUpload').on('change', handleCustomTemplateUpload);

    $('#clearCustomTemplateBtn').on('click', async () => {
        log("Clearing custom template.");
        set_settings('customTemplateHtml', '');
        toastr.info("Custom template cleared. Reverted to default.");
        await loadTemplate(); // Reload to apply the selected default
        refreshAllCards();
    });

    refresh_settings_ui();
    log("Settings UI successfully bound.");
};


const initialize_settings = async () => {
    // Load the prompt from the file first.
    const loadedPrompt = await loadDefaultPromptFromFile();
    // If the prompt was loaded successfully, update the default_settings object.
    if (loadedPrompt) {
        default_settings.datingSimPrompt = loadedPrompt;
    }

    // Now, merge the defaults with any user-saved settings.
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
        await initialize_settings();
        await load_settings_html_manually();
        populateTemplateDropdown();
        initialize_settings_listeners();
        log("Settings panel listeners initialized.");
        await loadTemplate();

        log("Registering macros...");
        MacrosParser.registerMacro('sim_tracker', () => {
            if (!get_settings('isEnabled')) return '';
            log('Processed {{sim_tracker}} macro.');
            return get_settings('datingSimPrompt');
        });

        MacrosParser.registerMacro('last_sim_stats', () => {
            if (!get_settings('isEnabled')) return '';
            log('Processed {{last_sim_stats}} macro.');
            return lastSimJsonString || '{}';
        });
        log("Macros registered successfully.");

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