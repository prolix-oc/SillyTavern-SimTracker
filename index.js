import { getContext, on, SimpleHandlebarsCompiler, extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

// --- MODULE CONSTANTS ---
const MODULE_NAME = 'SillySimTracker';
const CONTAINER_ID = 'silly-sim-tracker-container';
const SETTINGS_ID = 'silly-sim-tracker-settings';

const default_settings = {
    isEnabled: true,
    codeBlockIdentifier: "sim",
    defaultBgColor: "#6a5acd",
    showThoughtBubble: true,
};

let settings = {};
const settings_ui_map = {};

// --- UTILITY FUNCTIONS ---
const log = (message) => console.log(`[${MODULE_NAME}]`, message);

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


// --- HTML TEMPLATES ---
const wrapperTemplate = `<div id="${CONTAINER_ID}" style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">{{{cardsHtml}}}</div>`;
const cardTemplate = `
<div style="flex:1 1 100%;min-width:380px;max-width:500px;height:340px;background:linear-gradient(145deg, {{bgColor}} 0%, {{darkerBgColor}} 100%);border-radius:16px;padding:0;box-sizing:border-box;position:relative;color:#fff;font-size:14px;font-weight:500;box-shadow:0 8px 32px rgba(106,90,205,0.3),0 2px 8px rgba(0,0,0,0.1);border:1px solid rgba(255,255,255,0.1);overflow:hidden;">
    <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px 0 20px;font-size:12px;font-weight:500">
        <div style="background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);">{{currentDate}}</div>
        <div style="display:flex;gap:8px;">
            <div style="background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);">Day {{stats.days_since_first_meeting}}</div>
            {{#if stats.preg}}<div style="background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);">🤰{{stats.days_preg}}d</div>{{/if}}
        </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 20px 0 20px">
        <div style="font-size:26px;font-weight:700;">{{characterName}}</div>
        <div style="display:flex;align-items:center;gap:12px;font-size:20px;">
            {{#if healthIcon}}<span>{{healthIcon}}</span>{{/if}}
            <span>{{reactionEmoji}}</span>
        </div>
    </div>
    <div style="position:absolute;top:110px;bottom:90px;left:0;right:0;display:flex;align-items:center;justify-content:center;padding:0 24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;gap:8px;">
            <div style="display:flex;flex-direction:column;align-items:center;flex:1;padding:12px 8px;border-radius:12px;background:rgba(255,255,255,0.08);"><div style="font-size:40px;line-height:1;">❤️</div><div style="font-size:28px;font-weight:700;">{{stats.ap}}</div></div>
            <div style="display:flex;flex-direction:column;align-items:center;flex:1;padding:12px 8px;border-radius:12px;background:rgba(255,255,255,0.08);"><div style="font-size:40px;line-height:1;">🔥</div><div style="font-size:28px;font-weight:700;">{{stats.dp}}</div></div>
            <div style="display:flex;flex-direction:column;align-items:center;flex:1;padding:12px 8px;border-radius:12px;background:rgba(255,255,255,0.08);"><div style="font-size:40px;line-h-eight:1;">🤝</div><div style="font-size:28px;font-weight:700;">{{stats.tp}}</div></div>
            <div style="display:flex;flex-direction:column;align-items:center;flex:1;padding:12px 8px;border-radius:12px;background:rgba(255,255,255,0.08);"><div style="font-size:40px;line-height:1;">💔</div><div style="font-size:28px;font-weight:700;">{{stats.cp}}</div></div>
        </div>
    </div>
    {{#if showThoughtBubble}}
    <div style="position:absolute;left:16px;right:16px;bottom:16px;min-height:60px;background:rgba(255,255,255,0.12);backdrop-filter:blur(10px);border-radius:12px;display:flex;align-items:center;gap:12px;padding:12px 16px;">
        <div style="font-size:22px;flex-shrink:0;">💭</div>
        <div style="flex:1;font-size:13px;font-weight:500;line-height:1.4;">{{stats.thought}}</div>
    </div>
    {{/if}}
</div>`;

const compiledWrapperTemplate = SimpleHandlebarsCompiler(wrapperTemplate);
const compiledCardTemplate = SimpleHandlebarsCompiler(cardTemplate);

const renderTracker = (message) => {
    // Check if the extension is enabled in settings
    if (!get_settings('isEnabled')) return;

    const messageElement = document.querySelector(`div[data-message-id="${message.id}"] .mes_text`);
    // Exit if message element not found or if the tracker container is already present for this message
    if (!messageElement || messageElement.querySelector(`#${CONTAINER_ID}`)) return;

    // Get the code block identifier from settings
    const identifier = get_settings('codeBlockIdentifier');
    // Construct regex dynamically using the identifier
    const jsonRegex = new RegExp("```" + identifier + "\\s*([\\s\\S]*?)\\s*```");
    const match = message.mes.match(jsonRegex);

    if (match && match[1]) { // Ensure a match and content within the block
        try {
            const jsonData = JSON.parse(match[1]); // Parse the matched JSON string
            const currentDate = jsonData.current_date || 'Unknown Date';
            // Filter out 'current_date' to get only character names
            const characterNames = Object.keys(jsonData).filter(key => key !== 'current_date');

            if (!characterNames.length) return; // If no characters, do nothing

            // Map over each character to generate their individual card HTML
            const cardsHtml = characterNames.map(name => {
                const stats = jsonData[name];
                const cardData = {
                    characterName: name,
                    currentDate: currentDate,
                    // Use a default thought if none provided, for template safety
                    stats: { ...stats, thought: stats.thought || "No thought recorded." },
                    // Use character's specific background color or default from settings
                    bgColor: stats.bg || get_settings('defaultBgColor'),
                    // Calculate a darker complementary color for the gradient
                    darkerBgColor: darkenColor(stats.bg || get_settings('defaultBgColor')),
                    // Get the reaction emoji based on the numeric value
                    reactionEmoji: getReactionEmoji(stats.last_react),
                    // Show health icon only if health is greater than 0
                    healthIcon: stats.health > 0 ? '🤕' : null,
                    // Pass the global setting for thought bubble visibility
                    showThoughtBubble: get_settings('showThoughtBubble'),
                };
                return compiledCardTemplate(cardData); // Render HTML for one card
            }).join(''); // Join all generated card HTML strings into a single string

            // Render the main wrapper template with all the character cards inside
            const finalHtml = compiledWrapperTemplate({ cardsHtml });
            
            // Get DOMPurify from SillyTavern's context for security
            const { DOMPurify } = getContext().libs;
            const sanitizedHtml = DOMPurify.sanitize(finalHtml); // Sanitize HTML before injecting
            
            // Append the sanitized HTML to the end of the message text div
            messageElement.insertAdjacentHTML('beforeend', sanitizedHtml);
        } catch (error) {
            // Log any errors during JSON parsing or rendering
            log(`Error processing tracker JSON: ${error}`);
        }
    }
};

// --- SETTINGS MANAGEMENT ---
const refresh_settings_ui = () => {
    for (const [key, [element, type]] of Object.entries(settings_ui_map)) {
        const value = get_settings(key);
        switch (type) {
            case 'boolean': element.prop('checked', value); break;
            case 'text':
            case 'color': element.val(value); break;
        }
    }
};

const bind_setting = (selector, key, type) => {
    const element = $(`#${SETTINGS_ID} ${selector}`);
    if (element.length === 0) {
        log(`Could not find settings element: ${selector}`);
        return;
    }
    settings_ui_map[key] = [element, type];
    element.on('change input', () => {
        let value;
        switch (type) {
            case 'boolean': value = element.prop('checked'); break;
            case 'text':
            case 'color': value = element.val(); break;
        }
        set_settings(key, value);
        refresh_settings_ui();
    });
};

const initialize_settings_listeners = () => {
    bind_setting('#isEnabled', 'isEnabled', 'boolean');
    bind_setting('#codeBlockIdentifier', 'codeBlockIdentifier', 'text');
    bind_setting('#defaultBgColor', 'defaultBgColor', 'color');
    bind_setting('#showThoughtBubble', 'showThoughtBubble', 'boolean');
    refresh_settings_ui();
};

const initialize_settings = () => {
    if (Object.keys(extension_settings[MODULE_NAME] ?? {}).length === 0) {
        log("First time setup. Applying defaults.");
        extension_settings[MODULE_NAME] = { ...default_settings };
    } else {
        log("Settings found. Merging with new defaults.");
        extension_settings[MODULE_NAME] = Object.assign({}, default_settings, extension_settings[MODULE_NAME]);
    }
    settings = extension_settings[MODULE_NAME];
};

// NEW: Function to load settings.html into the DOM
const load_settings_html = async () => {
    // Construct the path to the settings file within the extension's directory
    const settingsHtmlPath = `/extensions/${MODULE_NAME}/settings.html`;
    try {
        const response = await fetch(settingsHtmlPath);
        if (!response.ok) {
            log(`Failed to load settings HTML: ${response.statusText}`);
            return;
        }
        const html = await response.text();
        // Append the fetched HTML to the main extension settings area
        $('#extensions_settings2').append(html);
        
        // IMPORTANT: Listeners can only be initialized *after* the HTML is in the DOM
        initialize_settings_listeners();
        log("Settings panel loaded and listeners initialized.");
    } catch (error) {
        log(`Error loading settings panel: ${error}`);
    }
};

// --- ENTRY POINT ---
jQuery(async () => {
    log(`Initializing extension: ${MODULE_NAME}`);

    // Step 1: Initialize the settings data (load from storage or set defaults)
    initialize_settings();

    // Step 2: Manually load the settings UI from settings.html into the DOM
    await load_settings_html();

    // Step 3: Register the main extension functionality
    on('CHARACTER_MESSAGE_RENDERED', renderTracker);

    log(`${MODULE_NAME} has been successfully loaded.`);
});