// Import necessary functions from SillyTavern's API
import { getContext, on, SimpleHandlebarsCompiler } from '../../../../scripts/extensions.js';

// A unique name for our extension to prevent conflicts
const extensionName = "DatingSimTracker";
const extensionContainerId = "dating-sim-tracker-container";
let settings; // Variable to hold our settings

// --- HELPER FUNCTIONS (Unchanged) ---

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
        case 1: return '👍'; // Liked
        case 2: return '👎'; // Disliked
        default: return '😐'; // Neutral
    }
};

// --- HTML TEMPLATES (Corrected) ---

// This is the outer flexbox container from your template.
// It will wrap all the generated character cards.
const wrapperTemplate = `
<div id="${extensionContainerId}" style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  {{{cardsHtml}}}
</div>
`;

// This is the inner card element from your template.
// This part will be repeated for each character in the JSON.
const cardTemplate = `
<div style="flex:1 1 100%;min-width:380px;max-width:500px;height:340px;background:linear-gradient(145deg, {{bgColor}} 0%, {{darkerBgColor}} 100%);border-radius:16px;padding:0;box-sizing:border-box;position:relative;color:#fff;font-size:14px;font-weight:500;box-shadow:0 8px 32px rgba(106,90,205,0.3),0 2px 8px rgba(0,0,0,0.1);border:1px solid rgba(255,255,255,0.1);overflow:hidden;transition:transform 0.3s ease,box-shadow 0.3s ease" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 12px 40px rgba(106,90,205,0.4),0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 8px 32px rgba(106,90,205,0.3),0 2px 8px rgba(0,0,0,0.1)'">
    <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px 0 20px;font-size:12px;font-weight:500">
        <div style="background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);font-weight:600;letter-spacing:0.5px">{{currentDate}}</div>
        <div style="display:flex;gap:8px">
            <div style="background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);font-weight:600;letter-spacing:0.5px">Day {{stats.days_since_first_meeting}}</div>
            {{#if stats.preg}}
            <div style="background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);font-weight:600;letter-spacing:0.5px">🤰{{stats.days_preg}}d</div>
            {{/if}}
        </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 20px 0 20px">
        <div style="font-size:26px;font-weight:700;text-shadow:0 2px 4px rgba(0,0,0,0.3);letter-spacing:-0.5px">{{characterName}}</div>
        <div style="display:flex;align-items:center;gap:12px;font-size:20px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
            {{#if healthIcon}}<span>{{healthIcon}}</span>{{/if}}
            <span>{{reactionEmoji}}</span>
        </div>
    </div>
    <div style="position:absolute;top:110px;bottom:90px;left:0;right:0;display:flex;align-items:center;justify-content:center;padding:0 24px">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;gap:8px">
            <div style="display:flex;flex-direction:column;align-items:center;min-width:0;flex:1;padding:12px 8px;border-radius:12px;background:rgba(255,255,255,0.08);backdrop-filter:blur(5px);border:1px solid rgba(255,255,255,0.1);transition:all 0.3s ease" onmouseover="this.style.background='rgba(255,255,255,0.15)';this.style.transform='translateY(-2px)'" onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.transform='translateY(0)'">
                <div style="font-size:40px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));margin-bottom:6px">❤️</div>
                <div style="font-size:28px;font-weight:700;line-height:1;text-shadow:0 2px 4px rgba(0,0,0,0.3)">{{stats.ap}}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;min-width:0;flex:1;padding:12px 8px;border-radius:12px;background:rgba(255,255,255,0.08);backdrop-filter:blur(5px);border:1px solid rgba(255,255,255,0.1);transition:all 0.3s ease" onmouseover="this.style.background='rgba(255,255,255,0.15)';this.style.transform='translateY(-2px)'" onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.transform='translateY(0)'">
                <div style="font-size:40px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));margin-bottom:6px">🔥</div>
                <div style="font-size:28px;font-weight:700;line-height:1;text-shadow:0 2px 4px rgba(0,0,0,0.3)">{{stats.dp}}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;min-width:0;flex:1;padding:12px 8px;border-radius:12px;background:rgba(255,255,255,0.08);backdrop-filter:blur(5px);border:1px solid rgba(255,255,255,0.1);transition:all 0.3s ease" onmouseover="this.style.background='rgba(255,255,255,0.15)';this.style.transform='translateY(-2px)'" onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.transform='translateY(0)'">
                <div style="font-size:40px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));margin-bottom:6px">🤝</div>
                <div style="font-size:28px;font-weight:700;line-height:1;text-shadow:0 2px 4px rgba(0,0,0,0.3)">{{stats.tp}}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;min-width:0;flex:1;padding:12px 8px;border-radius:12px;background:rgba(255,255,255,0.08);backdrop-filter:blur(5px);border:1px solid rgba(255,255,255,0.1);transition:all 0.3s ease" onmouseover="this.style.background='rgba(255,255,255,0.15)';this.style.transform='translateY(-2px)'" onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.transform='translateY(0)'">
                <div style="font-size:40px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));margin-bottom:6px">💔</div>
                <div style="font-size:28px;font-weight:700;line-height:1;text-shadow:0 2px 4px rgba(0,0,0,0.3)">{{stats.cp}}</div>
            </div>
        </div>
    </div>
    <div style="position:absolute;left:16px;right:16px;bottom:16px;min-height:60px;background:rgba(255,255,255,0.12);backdrop-filter:blur(10px);border-radius:12px;display:flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid rgba(255,255,255,0.15);box-shadow:inset 0 1px 0 rgba(255,255,255,0.1)">
        <div style="font-size:22px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));flex-shrink:0">💭</div>
        <div style="flex:1;font-size:13px;font-weight:500;line-height:1.4;overflow:hidden;text-shadow:0 1px 2px rgba(0,0,0,0.3)">{{stats.thought}}</div>
    </div>
</div>
`;

// Compile both templates once for performance
const compiledWrapperTemplate = SimpleHandlebarsCompiler(wrapperTemplate);
const compiledCardTemplate = SimpleHandlebarsCompiler(cardTemplate);

// --- MAIN EXTENSION LOGIC ---

const renderTracker = (message) => {
    // USE SETTING: Master switch to disable the extension
    if (!settings.isEnabled) return;

    const messageElement = document.querySelector(`div[data-message-id="${message.id}"] .mes_text`);
    if (!messageElement || messageElement.querySelector(`#${extensionContainerId}`)) {
        return;
    }

    // USE SETTING: Build the regex dynamically from settings
    const jsonRegex = new RegExp("```" + settings.codeBlockIdentifier + "\\s*([\\s\\S]*?)\\s*```");
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
                    characterName: name,
                    currentDate: currentDate,
                    stats: { ...stats, thought: stats.thought || "No thought recorded." },
                    // USE SETTING: Use default background color from settings
                    bgColor: stats.bg || settings.defaultBgColor,
                    darkerBgColor: darkenColor(stats.bg || settings.defaultBgColor),
                    reactionEmoji: getReactionEmoji(stats.last_react),
                    healthIcon: stats.health > 0 ? '🤕' : null,
                    // USE SETTING: Pass the 'showThoughtBubble' setting to the template
                    showThoughtBubble: settings.showThoughtBubble,
                };
                return compiledCardTemplate(cardData);
            }).join('');

            const finalHtml = compiledWrapperTemplate({ cardsHtml });
            
            const { DOMPurify } = getContext().libs;
            const sanitizedHtml = DOMPurify.sanitize(finalHtml);
            
            messageElement.insertAdjacentHTML('beforeend', sanitizedHtml);

        } catch (error) {
            console.error(`[${extensionName}] Error processing tracker JSON:`, error);
        }
    }
};

// --- SETTINGS PAGE LOGIC ---
const onSettingsChange = () => {
    // This function runs when the settings page is loaded.
    // It populates the inputs with the saved settings and adds event listeners to save changes.
    const isEnabledCheckbox = document.getElementById('isEnabled');
    const identifierInput = document.getElementById('codeBlockIdentifier');
    const colorInput = document.getElementById('defaultBgColor');
    const thoughtBubbleCheckbox = document.getElementById('showThoughtBubble');

    // Populate the form with current settings
    isEnabledCheckbox.checked = settings.isEnabled;
    identifierInput.value = settings.codeBlockIdentifier;
    colorInput.value = settings.defaultBgColor;
    thoughtBubbleCheckbox.checked = settings.showThoughtBubble;

    // Add listeners to update settings when the user changes them
    isEnabledCheckbox.addEventListener('change', () => { settings.isEnabled = isEnabledCheckbox.checked; });
    identifierInput.addEventListener('input', () => { settings.codeBlockIdentifier = identifierInput.value; });
    colorInput.addEventListener('input', () => { settings.defaultBgColor = colorInput.value; });
    thoughtBubbleCheckbox.addEventListener('change', () => { settings.showThoughtBubble = thoughtBubbleCheckbox.checked; });
};

// This function runs when the extension is first loaded
const onExtensionLoad = () => {
    // Load settings from the context
    settings = getContext().settings;
    
    // Register the functions to run on specific events
    on('CHARACTER_MESSAGE_RENDERED', renderTracker);
    on('EXTENSION_SETTINGS_LOADED', onSettingsChange); // This runs when your settings.html is opened

    console.log(`[${extensionName}] Extension loaded.`);
};

// Start the extension
onExtensionLoad();