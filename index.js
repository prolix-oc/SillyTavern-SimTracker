import { getContext, on, SimpleHandlebarsCompiler, extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

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

// --- TEMPLATES ---
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

// --- RENDER LOGIC ---
const renderTracker = (message) => {
    if (!get_settings('isEnabled')) return;
    const messageElement = document.querySelector(`div[data-message-id="${message.id}"] .mes_text`);
    if (!messageElement || messageElement.querySelector(`#${CONTAINER_ID}`)) return;
    const identifier = get_settings('codeBlockIdentifier');
    const jsonRegex = new RegExp("```" + identifier + "\\s*([\\s\\S]*?)\\s*```");
    const match = message.mes.match(jsonRegex);
    if (match && match) {
        try {
            const jsonData = JSON.parse(match);
            const currentDate = jsonData.current_date || 'Unknown Date';
            const characterNames = Object.keys(jsonData).filter(key => key !== 'current_date');
            if (!characterNames.length) return;
            const cardsHtml = characterNames.map(name => {
                const stats = jsonData[name];
                const cardData = {
                    characterName: name, currentDate: currentDate,
                    stats: { ...stats, thought: stats.thought || "No thought recorded." },
                    bgColor: stats.bg || get_settings('defaultBgColor'),
                    darkerBgColor: darkenColor(stats.bg || get_settings('defaultBgColor')),
                    reactionEmoji: getReactionEmoji(stats.last_react),
                    healthIcon: stats.health > 0 ? '🤕' : null,
                    showThoughtBubble: get_settings('showThoughtBubble'),
                };
                return compiledCardTemplate(cardData);
            }).join('');
            const finalHtml = compiledWrapperTemplate({ cardsHtml });
            const { DOMPurify } = getContext().libs;
            const sanitizedHtml = DOMPurify.sanitize(finalHtml);
            messageElement.insertAdjacentHTML('beforeend', sanitizedHtml);
        } catch (error) {
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
            case 'text': case 'color': element.val(value); break;
        }
    }
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
    extension_settings[MODULE_NAME] = Object.assign({}, default_settings, extension_settings[MODULE_NAME]);
    settings = extension_settings[MODULE_NAME];
};

// --- ENTRY POINT ---
jQuery(async () => {
    log(`Initializing extension: ${MODULE_NAME}`);

    // Step 1: Initialize settings data from storage
    initialize_settings();

    // Step 2: Create and inject the settings HTML directly
    const settingsHtml = `
        <div id="${SETTINGS_ID}">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Silly Sim Tracker</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div class="silly-sim-tracker-settings-content">
                        <div class="setting">
                            <label for="isEnabled">Enable Tracker</label>
                            <div class="control"><input type="checkbox" id="isEnabled"></div>
                        </div>
                        <p class="description">The master switch to enable or disable the extension.</p>
                        <hr>
                        <div class="setting">
                            <label for="codeBlockIdentifier">Code Block Identifier</label>
                            <div class="control"><input type="text" id="codeBlockIdentifier" class="text_pole"></div>
                        </div>
                        <p class="description">The keyword the extension looks for after the opening \`\`\` (e.g., "sim").</p>
                        <hr>
                        <div class="setting">
                            <label for="defaultBgColor">Default Card Color</label>
                            <div class="control"><input type="color" id="defaultBgColor"></div>
                        </div>
                        <p class="description">The background color used for cards when one isn't specified in the JSON.</p>
                        <hr>
                        <div class="setting">
                            <label for="showThoughtBubble">Show Thought Bubble</label>
                            <div class="control"><input type="checkbox" id="showThoughtBubble"></div>
                        </div>
                        <p class="description">Whether to display the 'thought' section at the bottom of the card.</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Append settings HTML to the extensions settings container
    $("#extensions_settings2").append(settingsHtml);

    // Step 3: Bind listeners after the HTML is injected
    initialize_settings_listeners();
    log("Settings panel loaded and listeners initialized.");

    // Step 4: Register the main extension functionality
    on('CHARACTER_MESSAGE_RENDERED', renderTracker);

    log(`${MODULE_NAME} has been successfully loaded.`);
});
