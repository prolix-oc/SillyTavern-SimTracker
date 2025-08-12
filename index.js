import { getContext, extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced, messageFormatting } from '../../../../script.js';
import { MacrosParser } from '../../../macros.js';
import * as fs from 'fs'

const MODULE_NAME = 'SillySimTracker';
const GIT_MODULE_NAME = 'SillyTavern-DatingSimTracker'
const CONTAINER_ID = 'silly-sim-tracker-container';
const SETTINGS_ID = 'silly-sim-tracker-settings';

const default_settings = {
    isEnabled: true,
    codeBlockIdentifier: "sim",
    defaultBgColor: "#6a5acd",
    showThoughtBubble: true,
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

async function getTemplateFiles() {
    // Dynamically get the base URL path from the browser side.
    const browserPathBase = get_extension_directory();
    // Transform it into a server-side file system path by removing the '/scripts/' prefix.

    const defaultDir = `${browserPathBase}/tracker-card-templates`;
    const customDir = `${browserPathBase}/custom_tracker_templates`;
    let defaultFiles = [];
    let customFiles = [];

    const listFiles = async (path) => {
        try {
            const response = await fetch('/api/files/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: path }),
            });
            if (!response.ok) {
                if (response.status === 404) {
                    log(`Directory not found (this is okay): ${path}`);
                    return [];
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.files.filter(file => file.endsWith('.html'));
        } catch (error) {
            console.error(`Error listing files in ${path}:`, error);
            return [];
        }
    };

    defaultFiles = await listFiles(defaultDir);
    customFiles = await listFiles(customDir);

    const allFiles = [...new Set([...defaultFiles, ...customFiles])];
    return allFiles.sort();
}

async function populateTemplateDropdown() {
    log('Populating template dropdown...');
    const templateFiles = await getTemplateFiles();
    const $select = $('#templateFile');
    const currentSelection = get_settings('templateFile');

    $select.empty();
    templateFiles.forEach(file => {
        $select.append($('<option>', {
            value: file,
            text: file
        }));
    });

    // Restore the user's selection
    $select.val(currentSelection);
    log('Template dropdown populated.');
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const content = e.target.result;
        log(`Read file ${file.name}, size: ${content.length}`);
        await saveCustomTemplate(file.name, content);
    };
    reader.readAsText(file);
}

async function saveCustomTemplate(fileName, content) {
    const serverPathBase = get_extension_directory();
    const customDir = `${serverPathBase}/custom_tracker_templates`;
    const filePath = `${customDir}/${fileName}`;

    try {
        log(`Attempting to save template to: ${filePath}`);
        // This API call now receives the correct server-side path.
        const response = await fetch('/api/files/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: filePath,
                data: content,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
            toastr.success(`Template "${fileName}" uploaded successfully!`, 'Upload Complete');
            await populateTemplateDropdown();
            set_settings('templateFile', fileName);
            $('#templateFile').val(fileName);
            await loadTemplate();
            refreshAllCards();
        } else {
            throw new Error('Save operation was not successful.');
        }

    } catch (error) {
        console.error('Failed to save custom template:', error);
        toastr.error(`Failed to save template: ${error.message}`, 'Upload Failed');
    }
}

// Load template from file
const loadTemplate = async () => {
    const templateFile = get_settings('templateFile');
    if (!templateFile) {
        log('No template file selected. Aborting template load.');
        const fallbackTemplate = `<div>Error: No template file selected in settings.</div>`;
        compiledCardTemplate = Handlebars.compile(fallbackTemplate);
        return;
    }

    // Use relative paths for $.get, which works from the SillyTavern root
    const customPath = `${get_extension_directory()}/custom_tracker_templates/${templateFile}`;
    const defaultPath = `${get_extension_directory()}/tracker-card-templates/${templateFile}`;
    let templateContent;
    let loadedFrom = '';

    try {
        templateContent = await $.get(customPath);
        loadedFrom = `custom directory: ${customPath}`;
    } catch (customError) {
        try {
            templateContent = await $.get(defaultPath);
            loadedFrom = `default directory: ${defaultPath}`;
        } catch (defaultError) {
            log(`Could not find template '${templateFile}' in custom or default directories.`);
            templateContent = null;
        }
    }

    if (templateContent) {
        log(`Successfully loaded template content from ${loadedFrom}`);
        try {
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
            log(`Template '${templateFile}' compiled successfully.`);
            return;

        } catch (parsingError) {
            log(`Error parsing template file '${templateFile}': ${parsingError.message}. Using fallback template.`);
        }
    }

    const fallbackTemplate = `
    <div style="flex:1 1 100%;min-width:380px;max-width:500px;background:red;border-radius:16px;padding:16px;color:#fff;">
        <b>Template Error</b><br>
        Could not load or parse the template file: <b>${templateFile}</b>. Please check the console (F12) for details.
    </div>`;
    compiledCardTemplate = Handlebars.compile(fallbackTemplate);
    log("Compiled a fallback error template.");
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
globalThis.sim_intercept_messages = async function (data) {
    log("SillySimTracker interceptor triggered.");

    if (!get_settings('isEnabled')) {
        return data;
    }

    const datingPrompt = get_settings('datingSimPrompt');
    const datingSimMacro = /\{\{dating_sim\}\}/g;
    const lastStatsMacro = /\{\{last_sim_stats\}\}/g;

    const processString = (str) => {
        if (!str) return str;
        let processed = str;
        if (processed.includes('{{dating_sim}}')) {
            processed = processed.replace(datingSimMacro, datingPrompt);
            log('Replaced {{dating_sim}} macro.');
        }
        if (processed.includes('{{last_sim_stats}}')) {
            processed = processed.replace(lastStatsMacro, lastSimJsonString || '{}');
            log('Replaced {{last_sim_stats}} macro.');
        }
        return processed;
    };

    // Process all relevant parts of the prompt data object
    data.prompt = processString(data.prompt);
    data.system_prompt = processString(data.system_prompt);

    return data;
};

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

    const $templateSelect = $('#templateFile');
    if ($templateSelect.length) {
        settings_ui_map['templateFile'] = [$templateSelect, 'text'];
        $templateSelect.on('change', async () => {
            const value = $templateSelect.val();
            set_settings('templateFile', value);
            await loadTemplate();
            refreshAllCards();
        });
    }

    $('#uploadTemplateBtn').on('click', () => {
        $('#templateUpload').click();
    });

    $('#templateUpload').on('change', handleFileUpload);

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
        await populateTemplateDropdown();
        initialize_settings_listeners();
        log("Settings panel listeners initialized.");
        await loadTemplate();

        log("Registering macros...");
        MacrosParser.registerMacro('dating_sim', () => {
            if (!get_settings('isEnabled')) return '';
            log('Processed {{dating_sim}} macro.');
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
        fs.writeFileSync(`${get_extension_directory()}/file.txt`, "testing lol")
        log(`We wrote a file?`);
        const fileContents = fs.readFileSync(`${get_extension_directory()}/file.txt`)
        log(`File said: ${fileContents}`);

    } catch (error) {
        console.error(`[${MODULE_NAME}] A critical error occurred during initialization. The extension may not work correctly. Error: ${error.stack}`);
    }
});