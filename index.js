import { getContext, extension_settings } from "../../../extensions.js";
import {
  saveSettingsDebounced,
  messageFormatting,
  Generate
} from "../../../../script.js";
import { MacrosParser } from "../../../macros.js";
import { SlashCommand } from "../../../slash-commands/SlashCommand.js";
import { SlashCommandParser } from "../../../slash-commands/SlashCommandParser.js";

const MODULE_NAME = "silly-sim-tracker";
const CONTAINER_ID = "silly-sim-tracker-container";

// --- UTILITY FUNCTIONS ---
const log = (message) => console.log(`[SST] [${MODULE_NAME}]`, message);
const get_settings = (key) => settings[key] ?? default_settings[key];
const set_settings = (key, value) => {
  settings[key] = value;
  saveSettingsDebounced();
};

// Global sidebar tracker elements
let globalLeftSidebar = null;
let globalRightSidebar = null;

// Set to track mesText elements that already have preparing text to avoid duplicates
const mesTextsWithPreparingText = new Set();

// Helper function to create or update a global left sidebar
function updateLeftSidebar(content) {
  // Remove existing global sidebar if it exists
  if (globalLeftSidebar) {
    log("Removing existing left sidebar");
    globalLeftSidebar.remove();
  }

  // Find the sheld container
  const sheld = document.getElementById("sheld");
  log("Found sheld element:", sheld);
  if (!sheld) {
    console.warn("[SST] Could not find sheld container for sidebar");
    return;
  }

  // Create a container that stretches vertically and position it before sheld
  const verticalContainer = document.createElement("div");
  verticalContainer.id = "sst-global-sidebar-left";
  verticalContainer.className = "vertical-container";
  verticalContainer.style.cssText = `
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        bottom: 0 !important;
        width: auto !important;
        height: 100% !important;
        z-index: 999 !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 10px !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        align-items: flex-start !important;
        visibility: visible !important;
        overflow: visible !important;
    `;
  log("Created verticalContainer");

  // Create the actual sidebar content container
  const leftSidebar = document.createElement("div");
  leftSidebar.id = "sst-sidebar-left-content";
  leftSidebar.innerHTML = content;
  leftSidebar.style.cssText = `
        width: auto !important;
        height: 100% !important;
        max-width: 300px !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 0 !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        display: block !important;
        visibility: visible !important;
        overflow: visible !important;
        position: relative !important;
    `;
  log("Applied styles to leftSidebar");

  // Debug: Check what we actually have
  const trackerContainer = leftSidebar.querySelector(
    "#silly-sim-tracker-container"
  );

  // Add event listeners for tabs if this is a tabbed template
  setTimeout(() => {
    const tabs = leftSidebar.querySelectorAll(".sim-tracker-tab");
    const cards = leftSidebar.querySelectorAll(".sim-tracker-card");

    if (tabs.length > 0 && cards.length > 0) {
      // Initially activate the first non-inactive tab and card
      let firstActiveIndex = 0;
      // Find the first non-inactive card
      for (let i = 0; i < cards.length; i++) {
        if (!cards[i].classList.contains("inactive")) {
          firstActiveIndex = i;
          break;
        }
      }
      
      if (tabs[firstActiveIndex]) tabs[firstActiveIndex].classList.add("active");
      if (cards[firstActiveIndex]) cards[firstActiveIndex].classList.add("active");

      // Add click listeners to tabs
      tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => {
          // Check if this tab is already active
          const isActive = tab.classList.contains("active");

          // Remove active class from all tabs
          tabs.forEach((t) => t.classList.remove("active"));

          // Handle card and tab animations
          cards.forEach((card, cardIndex) => {
            const correspondingTab = tabs[cardIndex];
            if (cardIndex === index && !isActive) {
              // Slide in the selected card and tab
              card.classList.remove("sliding-out", "tab-hidden");
              card.classList.add("sliding-in");
              if (correspondingTab) {
                correspondingTab.classList.remove("sliding-out", "tab-hidden");
                correspondingTab.classList.add("sliding-in");
              }
              // Add active class after a short delay to ensure the animation works
              setTimeout(() => {
                card.classList.remove("sliding-in");
                card.classList.add("active");
                if (correspondingTab) {
                  correspondingTab.classList.remove("sliding-in");
                  correspondingTab.classList.add("active");
                }
              }, 10);
            } else {
              // Slide out all other cards and tabs
              if (card.classList.contains("active")) {
                card.classList.remove("active");
                card.classList.remove("sliding-in");
                card.classList.add("sliding-out");
                if (correspondingTab) {
                  correspondingTab.classList.remove("active");
                  correspondingTab.classList.remove("sliding-in");
                  correspondingTab.classList.add("sliding-out");
                }
                // Add tab-hidden class after animation completes
                setTimeout(() => {
                  card.classList.add("tab-hidden");
                  card.classList.remove("sliding-out");
                  if (correspondingTab) {
                    correspondingTab.classList.add("tab-hidden");
                    correspondingTab.classList.remove("sliding-out");
                  }
                }, 300);
              }
            }
          });

          // If the clicked tab wasn't already active, activate it
          if (!isActive) {
            tab.classList.add("active");
          }
        });
      });
    }

    const container = leftSidebar.querySelector("#silly-sim-tracker-container");
    if (container) {
      container.style.cssText += `
                width: 100% !important;
                max-width: 100% !important;
                box-sizing: border-box !important;
                display: block !important;
                visibility: visible !important;
                height: 100%;
            `;
    }

    // Log dimensions for debugging
    log("Left sidebar dimensions:", {
      offsetWidth: leftSidebar.offsetWidth,
      offsetHeight: leftSidebar.offsetHeight,
      clientWidth: leftSidebar.clientWidth,
      clientHeight: leftSidebar.clientHeight,
    });

    // Force reflow to ensure proper rendering
    verticalContainer.offsetHeight;
  }, 0);

  // Add the sidebar to the vertical container
  verticalContainer.appendChild(leftSidebar);
  log("Appended leftSidebar to verticalContainer");

  // Store reference to global sidebar
  globalLeftSidebar = verticalContainer;
  log("Stored reference to globalLeftSidebar");

  // Insert the sidebar container directly before the sheld div in the body
  if (sheld.parentNode) {
    sheld.parentNode.insertBefore(verticalContainer, sheld);
    log("Successfully inserted left sidebar before sheld");
  } else {
    console.error("[SST] sheld has no parent node!");
    // Fallback: append to body
    document.body.appendChild(verticalContainer);
  }

  // Debug: Log the final container
  log("Created left sidebar container:", verticalContainer);

  return verticalContainer;
}

// Helper function to create or update a global right sidebar
function updateRightSidebar(content) {

  // Remove existing global sidebar if it exists
  if (globalRightSidebar) {
    log("Removing existing right sidebar");
    globalRightSidebar.remove();
  }

  // Find the sheld container
  const sheld = document.getElementById("sheld");
  if (!sheld) {
    console.warn("[SST] Could not find sheld container for sidebar");
    return;
  }

  // Create a container that stretches vertically and position it before sheld
  const verticalContainer = document.createElement("div");
  verticalContainer.id = "sst-global-sidebar-right";
  verticalContainer.className = "vertical-container";
  verticalContainer.style.cssText = `
        position: absolute !important;
        right: 0 !important;
        top: 0 !important;
        bottom: 0 !important;
        width: auto !important;
        height: 100% !important;
        z-index: 999 !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 10px !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        align-items: flex-end !important;
        visibility: visible !important;
        overflow: visible !important;
    `;
  log("Created verticalContainer");

  // Create the actual sidebar content container
  const rightSidebar = document.createElement("div");
  rightSidebar.id = "sst-sidebar-right-content";
  rightSidebar.innerHTML = content;
  rightSidebar.style.cssText = `
        width: auto !important;
        height: 100% !important;
        max-width: 300px !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 0 !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        display: block !important;
        visibility: visible !important;
        overflow: visible !important;
        position: relative !important;
    `;

  // Debug: Check what we actually have
  const trackerContainer = rightSidebar.querySelector(
    "#silly-sim-tracker-container"
  );

  // Add event listeners for tabs if this is a tabbed template
  setTimeout(() => {
    const tabs = rightSidebar.querySelectorAll(".sim-tracker-tab");
    const cards = rightSidebar.querySelectorAll(".sim-tracker-card");

    if (tabs.length > 0 && cards.length > 0) {
      // Initially activate the first non-inactive tab and card
      let firstActiveIndex = 0;
      // Find the first non-inactive card
      for (let i = 0; i < cards.length; i++) {
        if (!cards[i].classList.contains("inactive")) {
          firstActiveIndex = i;
          break;
        }
      }
      
      if (tabs[firstActiveIndex]) tabs[firstActiveIndex].classList.add("active");
      if (cards[firstActiveIndex]) cards[firstActiveIndex].classList.add("active");

      // Add click listeners to tabs
      tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => {
          // Check if this tab is already active
          const isActive = tab.classList.contains("active");

          // Remove active class from all tabs
          tabs.forEach((t) => t.classList.remove("active"));

          // Handle card and tab animations
          cards.forEach((card, cardIndex) => {
            const correspondingTab = tabs[cardIndex];
            if (cardIndex === index && !isActive) {
              // Slide in the selected card and tab
              card.classList.remove("sliding-out", "tab-hidden");
              card.classList.add("sliding-in");
              if (correspondingTab) {
                correspondingTab.classList.remove("sliding-out", "tab-hidden");
                correspondingTab.classList.add("sliding-in");
              }
              // Add active class after a short delay to ensure the animation works
              setTimeout(() => {
                card.classList.remove("sliding-in");
                card.classList.add("active");
                if (correspondingTab) {
                  correspondingTab.classList.remove("sliding-in");
                  correspondingTab.classList.add("active");
                }
              }, 10);
            } else {
              // Slide out all other cards and tabs
              if (card.classList.contains("active")) {
                card.classList.remove("active");
                card.classList.remove("sliding-in");
                card.classList.add("sliding-out");
                if (correspondingTab) {
                  correspondingTab.classList.remove("active");
                  correspondingTab.classList.remove("sliding-in");
                  correspondingTab.classList.add("sliding-out");
                }
                // Add tab-hidden class after animation completes
                setTimeout(() => {
                  card.classList.add("tab-hidden");
                  card.classList.remove("sliding-out");
                  if (correspondingTab) {
                    correspondingTab.classList.add("tab-hidden");
                    correspondingTab.classList.remove("sliding-out");
                  }
                }, 300);
              }
            }
          });

          // If the clicked tab wasn't already active, activate it
          if (!isActive) {
            tab.classList.add("active");
          }
        });
      });
    }

    const container = rightSidebar.querySelector(
      "#silly-sim-tracker-container"
    );
    if (container) {
      container.style.cssText += `
                width: 100% !important;
                max-width: 100% !important;
                box-sizing: border-box !important;
                display: block !important;
                visibility: visible !important;
                height: 100%;
            `;
      log("Applied additional styles to container");
    }

    // Force reflow to ensure proper rendering
    verticalContainer.offsetHeight;
  }, 0);

  // Add the sidebar to the vertical container
  verticalContainer.appendChild(rightSidebar);
  log("Appended rightSidebar to verticalContainer");

  // Store reference to global sidebar
  globalRightSidebar = verticalContainer;
  log("Stored reference to globalRightSidebar");

  // Insert the sidebar container directly before the sheld div in the body
  if (sheld.parentNode) {
    sheld.parentNode.insertBefore(verticalContainer, sheld);
    log("Successfully inserted right sidebar before sheld");
  } else {
    console.error("[SST] sheld has no parent node!");
    // Fallback: append to body
    document.body.appendChild(verticalContainer);
  }

  return verticalContainer;
}

// Helper function to remove global sidebars
function removeGlobalSidebars() {
  if (globalLeftSidebar) {
    globalLeftSidebar.remove();
    globalLeftSidebar = null;
  }
  if (globalRightSidebar) {
    globalRightSidebar.remove();
    globalRightSidebar = null;
  }
}

// Default fields for sim data, used for both initial settings and the {{sim_format}} macro
const defaultSimFields = [
  { key: "ap", description: "Affection Points (0-200)" },
  { key: "dp", description: "Desire Points (0-150)" },
  { key: "tp", description: "Trust Points (0-150)" },
  { key: "cp", description: "Contempt Points (0-150)" },
  {
    key: "apChange",
    description:
      "Change in Affection from last action (positive/negative/zero)",
  },
  {
    key: "dpChange",
    description: "Change in Desire from last action (positive/negative/zero)",
  },
  {
    key: "tpChange",
    description: "Change in Trust from last action (positive/negative/zero)",
  },
  {
    key: "cpChange",
    description: "Change in Contempt from last action (positive/negative/zero)",
  },
  {
    key: "relationshipStatus",
    description: "Relationship status text (e.g., 'Romantic Interest')",
  },
  {
    key: "desireStatus",
    description: "Desire status text (e.g., 'A smoldering flame builds.')",
  },
  { key: "preg", description: "Boolean for pregnancy status (true/false)" },
  { key: "days_preg", description: "Days pregnant (if applicable)" },
  { key: "conception_date", description: "Date of conception (YYYY-MM-DD)" },
  {
    key: "health",
    description: "Health Status (0=Unharmed, 1=Injured, 2=Critical)",
  },
  { key: "bg", description: "Hex color for card background (e.g., #6a5acd)" },
  {
    key: "last_react",
    description: "Reaction to User (0=Neutral, 1=Like, 2=Dislike)",
  },
  {
    key: "internal_thought",
    description: "Character's current internal thoughts/feelings",
  },
  {
    key: "days_since_first_meeting",
    description: "Total days since first meeting",
  },
  {
    key: "inactive",
    description: "Boolean for character inactivity (true/false)",
  },
  {
    key: "inactiveReason",
    description:
      "Reason for inactivity (0=Not inactive, 1=Asleep, 2=Comatose, 3=Contempt/anger, 4=Incapacitated, 5=Death)",
  },
];

const default_settings = {
  isEnabled: true,
  codeBlockIdentifier: "sim",
  defaultBgColor: "#6a5acd",
  showThoughtBubble: true,
  customTemplateHtml: "",
  templateFile: "dating-card-template.html",
  datingSimPrompt:
    "Default prompt could not be loaded. Please check file path.",
  customFields: [...defaultSimFields], // Clone the default fields
  hideSimBlocks: true, // New setting to hide sim blocks in message text
  templatePosition: "BOTTOM", // New setting for template position
};

let settings = {};
const settings_ui_map = {};
let lastSimJsonString = "";
// Keep track of when we're expecting code blocks to be generated
let isGeneratingCodeBlocks = false;

// Utility to sanitize a field key (replace spaces with underscores)
const sanitizeFieldKey = (key) => key.replace(/\s+/g, "_");
const darkenColor = (hex) => {
  if (!hex || hex.length < 7) return "#6a5acd";
  let r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  r = Math.floor(r * 0.7)
    .toString(16)
    .padStart(2, "0");
  g = Math.floor(g * 0.7)
    .toString(16)
    .padStart(2, "0");
  b = Math.floor(b * 0.7)
    .toString(16)
    .padStart(2, "0");
  return `#${r}${g}${b}`;
};

const getReactionEmoji = (reactValue) => {
  switch (parseInt(reactValue, 10)) {
    case 1:
      return "👍";
    case 2:
      return "👎";
    default:
      return "😐";
  }
};

const getInactiveReasonEmoji = (reason) => {
  switch (parseInt(reason, 10)) {
    case 1:
      return "😴";
    case 2:
      return "🏥";
    case 3:
      return "😡";
    case 4:
      return "🫠";
    case 5:
      return "🪦";
    default:
      return "";
  }
};

const get_extension_directory = () => {
  const index_path = new URL(import.meta.url).pathname;
  return index_path.substring(0, index_path.lastIndexOf("/"));
};

// Function to update lastSimJsonString when a message is swiped
const updateLastSimStatsOnSwipe = (currentMesId) => {
  try {
    const context = getContext();
    if (!context || !context.chat) {
      log("Context or chat not available for swipe update");
      return;
    }

    // Look for the previous message with sim data
    for (let i = currentMesId - 1; i >= 0; i--) {
      const message = context.chat[i];
      if (!message || !message.mes) continue;

      // Check if this message contains sim data
      const identifier = get_settings("codeBlockIdentifier");
      const simRegex = new RegExp("```" + identifier + "[\\s\\S]*?```", "m");
      const match = message.mes.match(simRegex);

      if (match) {
        // Extract JSON content from the match
        const jsonContent = match[0]
          .replace(/```/g, "")
          .replace(new RegExp(`^${identifier}\\s*`), "")
          .trim();

        // Update the lastSimJsonString with the previous message's sim data
        lastSimJsonString = jsonContent;
        log(`Updated last_sim_stats macro with data from message ID ${i}`);
        return;
      }
    }

    log("No previous message with sim data found for swipe update");
  } catch (error) {
    log(`Error updating last sim stats on swipe: ${error.message}`);
  }
};

// Function to update lastSimJsonString when regenerating or swiping
const updateLastSimStatsOnRegenerateOrSwipe = () => {
  try {
    const context = getContext();
    if (!context || !context.chat) {
      log("Context or chat not available for regenerate/swipe update");
      return;
    }

    // Look for the most recent message with sim data
    for (let i = context.chat.length - 1; i >= 0; i--) {
      const message = context.chat[i];
      if (!message || !message.mes) continue;

      // Check if this message contains sim data
      const identifier = get_settings("codeBlockIdentifier");
      const simRegex = new RegExp("```" + identifier + "[\\s\\S]*?```", "m");
      const match = message.mes.match(simRegex);

      if (match) {
        // Extract JSON content from the match
        const jsonContent = match[0]
          .replace(/```/g, "")
          .replace(new RegExp(`^${identifier}\\s*`), "")
          .trim();

        // Update the lastSimJsonString with the most recent message's sim data
        lastSimJsonString = jsonContent;
        log(`Updated last_sim_stats macro with data from message ID ${i} during regenerate/swipe`);
        return;
      }
    }

    log("No message with sim data found for regenerate/swipe update");
  } catch (error) {
    log(`Error updating last sim stats on regenerate/swipe: ${error.message}`);
  }
};

// Function to filter sim blocks in prompt (keep only last 3)
const filterSimBlocksInPrompt = (chat) => {
  try {
    if (!chat || !Array.isArray(chat)) {
      log("Invalid chat data for filtering sim blocks");
      return;
    }

    // Find all messages with sim data
    const identifier = get_settings("codeBlockIdentifier");
    const simRegexPattern = "```" + identifier + "[\\s\\S]*?```";
    
    // Collect all messages with sim data along with their positions
    const messagesWithSim = [];
    chat.forEach((message, index) => {
      if (message && message.mes) {
        // Create a new regex instance for each test to avoid state issues
        const testRegex = new RegExp(simRegexPattern, "m");
        if (testRegex.test(message.mes)) {
          messagesWithSim.push({ index, message });
        }
      }
    });

    // If we have more than 3 messages with sim data, remove the older ones from the prompt context
    if (messagesWithSim.length > 3) {
      // Get the messages to remove from prompt (all except the last 3)
      const messagesToRemove = messagesWithSim.slice(0, messagesWithSim.length - 3);
      
      messagesToRemove.forEach(({ index, message }) => {
        // Remove sim blocks entirely from the prompt context
        if (message.mes) {
          // Create a new regex for replacement to avoid state issues
          const replaceRegex = new RegExp(simRegexPattern, "gm");
          // Remove the sim blocks completely from the prompt context
          const originalMes = message.mes;
          const filteredMes = originalMes.replace(replaceRegex, "");
          
          // Only modify if we actually made changes
          if (filteredMes !== originalMes) {
            message.mes = filteredMes;
          }
        }
      });
    }
  } catch (error) {
    log(`Error filtering sim blocks in prompt: ${error.message}`);
  }
};

// Utility function to migrate old JSON format to new format
const migrateJsonFormat = (oldJsonData) => {
  // Check if it's already in the new format
  if (oldJsonData.worldData && Array.isArray(oldJsonData.characters)) {
    return oldJsonData; // Already in new format
  }

  // Create new format structure
  const newJsonData = {
    worldData: {},
    characters: [],
  };

  // Define known world data fields
  const worldDataFields = ["current_date", "current_time"];

  // Migrate data
  Object.keys(oldJsonData).forEach((key) => {
    if (worldDataFields.includes(key)) {
      newJsonData.worldData[key] = oldJsonData[key];
    } else {
      // Convert character object to array item
      newJsonData.characters.push({
        name: key,
        ...oldJsonData[key],
      });
    }
  });

  return newJsonData;
};

// Utility function to migrate all sim data in the chat
const migrateAllSimData = async () => {
  try {
    log("Starting migration of all sim data to new format...");
    const context = getContext();

    // Counter for migrated messages
    let migratedCount = 0;

    // Iterate through all messages in the chat
    for (let i = 0; i < context.chat.length; i++) {
      const message = context.chat[i];
      if (!message || !message.mes) continue;

      // Check if this message contains sim data
      const identifier = get_settings("codeBlockIdentifier");
      const simRegex = new RegExp("```" + identifier + "[\\s\\S]*?```", "gm");
      const matches = message.mes.match(simRegex);

      if (matches && matches.length > 0) {
        // Process each sim block in the message
        let updatedMessage = message.mes;
        let modified = false;

        matches.forEach((match) => {
          try {
            // Extract JSON content
            const jsonContent = match
              .replace(/```/g, "")
              .replace(new RegExp(`^${identifier}\\s*`), "")
              .trim();
            const jsonData = JSON.parse(jsonContent);

            // Check if it's already in new format
            if (jsonData.worldData && Array.isArray(jsonData.characters)) {
              return; // Already in new format, skip
            }

            // Migrate to new format
            const migratedData = migrateJsonFormat(jsonData);

            // Convert back to JSON string
            const migratedJsonString = JSON.stringify(migratedData, null, 2);

            // Reconstruct the code block
            const migratedCodeBlock =
              "```" + identifier + "\n" + migratedJsonString + "\n```";

            // Replace in message
            updatedMessage = updatedMessage.replace(match, migratedCodeBlock);
            modified = true;
          } catch (error) {
            log(`Error migrating sim data in message ${i}: ${error.message}`);
          }
        });

        // If we modified the message, update it
        if (modified) {
          message.mes = updatedMessage;
          migratedCount++;
        }
      }
    }

    if (migratedCount > 0) {
      // Save the updated chat
      // Note: This might require calling SillyTavern's save function
      log(`Successfully migrated ${migratedCount} messages to new format.`);
      toastr.success(
        `Successfully migrated ${migratedCount} messages to new format!`
      );

      // Refresh the chat to show the changes
      refreshAllCards();
    } else {
      log("No messages needed migration or no sim data found.");
      toastr.info("No messages needed migration or no sim data found.");
    }
  } catch (error) {
    log(`Error during migration: ${error.message}`);
    toastr.error("Error during migration. Check console for details.");
  }
};

// --- TEMPLATES ---
const wrapperTemplate = `<div id="${CONTAINER_ID}" style="width:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:block !important;visibility:visible !important;">{{{cardsHtml}}}</div>`;
let compiledWrapperTemplate = Handlebars.compile(wrapperTemplate);
let compiledCardTemplate = null;

// Register Handlebars helpers for template logic
Handlebars.registerHelper("eq", function (a, b) {
  return a === b;
});

Handlebars.registerHelper("gt", function (a, b) {
  return a > b;
});

Handlebars.registerHelper("divide", function (a, b) {
  if (typeof a !== "number" || typeof b !== "number" || b === 0) {
    return 0;
  }
  return a / b;
});

Handlebars.registerHelper("divideRoundUp", function (a, b) {
  if (typeof a !== "number" || typeof b !== "number" || b === 0) {
    return 0;
  }
  return Math.ceil(a / b);
});

Handlebars.registerHelper(
  "adjustColorBrightness",
  function (hexColor, brightnessPercent) {
    // Remove # if present
    hexColor = hexColor.replace("#", "");

    // Parse hex to RGB
    let r = parseInt(hexColor.substring(0, 2), 16);
    let g = parseInt(hexColor.substring(2, 4), 16);
    let b = parseInt(hexColor.substring(4, 6), 16);

    // Adjust brightness (0-100% where 100% is original, 50% is half brightness, etc.)
    brightnessPercent = Math.max(0, Math.min(100, brightnessPercent)) / 100;

    // Apply brightness adjustment
    r = Math.min(255, Math.max(0, Math.floor(r * brightnessPercent)));
    g = Math.min(255, Math.max(0, Math.floor(g * brightnessPercent)));
    b = Math.min(255, Math.max(0, Math.floor(b * brightnessPercent)));

    // Convert back to hex
    return `#${r.toString(16).padStart(2, "0")}${g
      .toString(16)
      .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
);

Handlebars.registerHelper("tabZIndex", function (index) {
  // Calculate z-index for tabs (higher for first tabs)
  // This creates a stacking effect where the first tab is on top
  return 20 - index;
});

Handlebars.registerHelper("tabOffset", function (index) {
  // Calculate vertical offset for tabs to prevent overlapping
  // Each tab is about 60px high, so we offset by 65px to add some spacing
  return index * 65;
});

Handlebars.registerHelper("initials", function (name) {
  // Extract the first letter of the name and capitalize it
  if (!name || name.length === 0) return "?";
  return name.charAt(0).toUpperCase();
});

Handlebars.registerHelper("unless", function (conditional, options) {
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
    log(
      `Error loading default prompt from ${promptPath}. The file might be missing. Error: ${error.statusText}`
    );
    console.error(error);
    return null; // Return null on failure
  }
};

async function populateTemplateDropdown() {
  log("Populating template dropdown with parsed friendly names...");

  const defaultFiles = [
    "dating-card-template.html",
    "dating-card-template-positioned.html",
    "dating-card-template-sidebar.html",
    "dating-card-template-sidebar-left.html",
    "dating-card-template-sidebar-tabs.html",
    "dating-card-template-sidebar-left-tabs.html",
  ];

  const templateOptions = [];
  const nameRegex = /<!--\s*TEMPLATE NAME\s*:\s*(.*?)\s*-->/;
  const authorRegex = /<!--\s*AUTHOR\s*:\s*(.*?)\s*-->/;

  await Promise.all(
    defaultFiles.map(async (filename) => {
      const filePath = `${get_extension_directory()}/tracker-card-templates/${filename}`;
      let friendlyName = filename; // Default to filename as a fallback

      try {
        const content = await $.get(filePath);

        const nameMatch = content.match(nameRegex);
        const authorMatch = content.match(authorRegex);

        const templateName = nameMatch ? nameMatch[1].trim() : null;
        const author = authorMatch ? authorMatch[1].trim() : null;

        if (templateName && author) {
          friendlyName = `${templateName} - by ${author}`;
        } else if (templateName) {
          friendlyName = templateName;
        }

        templateOptions.push({ filename, friendlyName });
      } catch (error) {
        console.error(
          `Could not fetch or parse template info for ${filename}:`,
          error
        );
        // If fetching fails, add it to the list with its filename so it's not missing
        templateOptions.push({ filename, friendlyName: filename });
      }
    })
  );

  // Sort the results alphabetically by friendly name for a clean list
  templateOptions.sort((a, b) => a.friendlyName.localeCompare(b.friendlyName));

  const $select = $("#templateFile");
  const currentSelection = get_settings("templateFile");

  $select.empty();
  templateOptions.forEach((option) => {
    $select.append(
      $("<option>", {
        value: option.filename,
        text: option.friendlyName,
      })
    );
  });

  // Restore the user's selection
  $select.val(currentSelection);
  log("Template dropdown populated with friendly names.");
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
    set_settings("customTemplateHtml", content);
    toastr.success(`Custom template "${file.name}" loaded and applied!`);

    // Immediately reload the template logic and refresh all cards
    await loadTemplate();
    refreshAllCards();
  };
  reader.readAsText(file);

  event.target.value = "";
}

// Load template from file
const loadTemplate = async () => {
  const customTemplateHtml = get_settings("customTemplateHtml");

  if (customTemplateHtml && customTemplateHtml.trim() !== "") {
    log("Loading template from custom HTML stored in settings.");
    try {
      const cardStartMarker = "<!-- CARD_TEMPLATE_START -->";
      const cardEndMarker = "<!-- CARD_TEMPLATE_END -->";
      let cardTemplate = "";

      // Extract position metadata
      const positionRegex = /<!--\s*POSITION\s*:\s*(.*?)\s*-->/i;
      const positionMatch = customTemplateHtml.match(positionRegex);
      const templatePosition = positionMatch
        ? positionMatch[1].trim().toUpperCase()
        : get_settings("templatePosition") || "BOTTOM"; // Use setting as fallback

      const startIndex = customTemplateHtml.indexOf(cardStartMarker);
      const endIndex = customTemplateHtml.indexOf(cardEndMarker);

      if (startIndex !== -1 && endIndex !== -1) {
        cardTemplate = customTemplateHtml
          .substring(startIndex + cardStartMarker.length, endIndex)
          .trim();
      } else {
        let cleanedResponse = customTemplateHtml
          .replace(/<!--[\s\S]*?-->/g, "")
          .trim();
        const templateVarRegex = /\{\{[^}]+\}\}/;
        const divMatches = [
          ...cleanedResponse.matchAll(/<div[^>]*>[\s\S]*?<\/div>/g),
        ];
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
          throw new Error(
            "Could not find template content with either markers or Handlebars variables."
          );
        }
      }

      compiledCardTemplate = Handlebars.compile(cardTemplate);
      // Store the template position in settings for use during rendering
      set_settings("templatePosition", templatePosition);
      log(
        `Custom HTML template compiled successfully. Position: ${templatePosition}`
      );
      return; // Exit successfully
    } catch (error) {
      log(
        `Error parsing custom HTML template: ${error.message}. Reverting to default file-based template.`
      );
      toastr.error(
        "The custom HTML template could not be parsed. Check its format.",
        "Template Error"
      );
    }
  }

  const templateFile = get_settings("templateFile");
  if (templateFile) {
    const defaultPath = `${get_extension_directory()}/tracker-card-templates/${templateFile}`;
    try {
      const templateContent = await $.get(defaultPath);
      log(`Loading template from default file: ${defaultPath}`);

      // Extract position metadata
      const positionRegex = /<!--\s*POSITION\s*:\s*(.*?)\s*-->/i;
      const positionMatch = templateContent.match(positionRegex);
      const templatePosition = positionMatch
        ? positionMatch[1].trim().toUpperCase()
        : get_settings("templatePosition") || "BOTTOM"; // Use setting as fallback

      // Re-run the same parsing logic for the file content
      const cardStartMarker = "<!-- CARD_TEMPLATE_START -->";
      const cardEndMarker = "<!-- CARD_TEMPLATE_END -->";
      let cardTemplate = "";
      const startIndex = templateContent.indexOf(cardStartMarker);
      const endIndex = templateContent.indexOf(cardEndMarker);
      if (startIndex !== -1 && endIndex !== -1) {
        cardTemplate = templateContent
          .substring(startIndex + cardStartMarker.length, endIndex)
          .trim();
      } else {
        let cleanedResponse = templateContent
          .replace(/<!--[\s\S]*?-->/g, "")
          .trim();
        const templateVarRegex = /\{\{[^}]+\}\}/;
        const divMatches = [
          ...cleanedResponse.matchAll(/<div[^>]*>[\s\S]*?<\/div>/g),
        ];
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
          throw new Error(
            "Could not find template content with either markers or Handlebars variables."
          );
        }
      }
      compiledCardTemplate = Handlebars.compile(cardTemplate);
      // Store the template position in settings for use during rendering
      set_settings("templatePosition", templatePosition);
      log(
        `Default template '${templateFile}' compiled successfully. Position: ${templatePosition}`
      );
      return; // Exit successfully
    } catch (error) {
      log(
        `Could not load or parse default template file '${templateFile}'. Using hardcoded fallback.`
      );
    }
  }

  log("Using hardcoded fallback template as a last resort.");
  const fallbackTemplate = `
    <div style="flex:1 1 100%;min-width:380px;max-width:500px;background:red;border-radius:16px;padding:16px;color:#fff;">
        <b>Template Error</b><br>
        No custom template is loaded and the selected default template could not be found or parsed.
    </div>`;
  compiledCardTemplate = Handlebars.compile(fallbackTemplate);
  set_settings("templatePosition", "BOTTOM"); // Default position for fallback
};

// --- RENDER LOGIC ---
const renderTracker = (mesId) => {
  try {
    if (!get_settings("isEnabled")) return;
    const context = getContext();
    const message = context.chat[mesId];
    if (!message) {
      log(`Error: Could not find message with ID ${mesId}. Aborting render.`);
      return;
    }
    const messageElement = document.querySelector(
      `div[mesid="${mesId}"] .mes_text`
    );
    if (!messageElement) return;

    // Log message element dimensions for debugging layout issues
    const messageRect = messageElement.getBoundingClientRect();
    log(
      `Message ID ${mesId} dimensions - Width: ${messageRect.width.toFixed(
        2
      )}px, Height: ${messageRect.height.toFixed(2)}px`
    );

    // Parse the sim data from the original message content
    const identifier = get_settings("codeBlockIdentifier");
    const jsonRegex = new RegExp("```" + identifier + "[\\s\\S]*?```");
    const match = message.mes.match(jsonRegex);

    // Handle message formatting and sim block hiding
    if (get_settings("hideSimBlocks")) {
      let displayMessage = message.mes;

      // Hide sim blocks with spans (for pre-processing)
      const hideRegex = new RegExp("```" + identifier + "[\\s\\S]*?```", "gm");
      displayMessage = displayMessage.replace(
        hideRegex,
        (match) => `<span style="display: none !important;">${match}</span>`
      );

      // Format and display the message content (without the tracker UI)
      messageElement.innerHTML = messageFormatting(
        displayMessage,
        message.name,
        message.is_system,
        message.is_user,
        mesId
      );
    } else {
      // Just format the message if not hiding blocks
      messageElement.innerHTML = messageFormatting(
        message.mes,
        message.name,
        message.is_system,
        message.is_user,
        mesId
      );
    }

    if (match) {
      // Set flag to indicate we're processing a message with sim data
      isGeneratingCodeBlocks = true;

      // Extract JSON content from the match
      const jsonContent = match[0]
        .replace(/```/g, "")
        .replace(new RegExp(`^${identifier}\\s*`), "")
        .trim();

      // --- NEW --- Capture the raw JSON string for the {{last_sim_stats}} macro
      // Always update the lastSimJsonString when we find a new sim block
      // This ensures it always contains the most recent data
      lastSimJsonString = jsonContent;
      log(`Captured last sim stats JSON from message ID ${mesId}.`);

      let jsonData;
      try {
        jsonData = JSON.parse(jsonContent);
      } catch (jsonError) {
        log(
          `Failed to parse JSON in message ID ${mesId}. Error: ${jsonError.message}`
        );
        messageElement.insertAdjacentHTML(
          "beforeend",
          `<div style="color: red; font-family: monospace;">[SillySimTracker] Error: Invalid JSON in code block.</div>`
        );
        return;
      }

      if (typeof jsonData !== "object" || jsonData === null) {
        log(`Parsed data in message ID ${mesId} is not a valid object.`);
        return;
      }

      // Handle both old and new JSON formats
      let worldData, characterList;

      // Check if it's the new format (with worldData and characters array)
      if (jsonData.worldData && Array.isArray(jsonData.characters)) {
        worldData = jsonData.worldData;
        characterList = jsonData.characters;
      } else {
        // Handle old format - convert object structure to array format
        const worldDataFields = ["current_date", "current_time"];
        worldData = {};
        characterList = [];

        Object.keys(jsonData).forEach((key) => {
          if (worldDataFields.includes(key)) {
            worldData[key] = jsonData[key];
          } else {
            // Convert character object to array item
            characterList.push({
              name: key,
              ...jsonData[key],
            });
          }
        });
      }

      const currentDate = worldData.current_date || "Unknown Date";
      const currentTime = worldData.current_time || "Unknown Time";

      if (!characterList.length) return;

      // For tabbed templates, we need to pass all characters to the template
      const isTabbedTemplate = get_settings("templateFile").includes("tabs");

      let cardsHtml = "";
      if (isTabbedTemplate) {
        // Prepare data for all characters
        const charactersData = characterList
          .map((character, index) => {
            const stats = character;
            const name = character.name;
            if (!stats) {
              log(
                `No stats found for character "${name}" in message ID ${mesId}. Skipping card.`
              );
              return null;
            }
            const bgColor = stats.bg || get_settings("defaultBgColor");
            return {
              characterName: name,
              currentDate: currentDate,
              currentTime: currentTime,
              stats: {
                ...stats,
                internal_thought:
                  stats.internal_thought ||
                  stats.thought ||
                  "No thought recorded.",
                relationshipStatus:
                  stats.relationshipStatus || "Unknown Status",
                desireStatus: stats.desireStatus || "Unknown Desire",
                inactive: stats.inactive || false,
                inactiveReason: stats.inactiveReason || 0,
              },
              bgColor: bgColor,
              darkerBgColor: darkenColor(bgColor),
              reactionEmoji: getReactionEmoji(stats.last_react),
              healthIcon:
                stats.health === 1 ? "🤕" : stats.health === 2 ? "💀" : null,
              showThoughtBubble: get_settings("showThoughtBubble"),
            };
          })
          .filter(Boolean); // Remove any null entries

        // For tabbed templates, we pass all characters in one data object
        const templateData = {
          characters: charactersData,
          currentDate: currentDate,
          currentTime: currentTime,
        };

        cardsHtml = compiledCardTemplate(templateData);
      } else {
        cardsHtml = characterList
          .map((character) => {
            const stats = character;
            const name = character.name;
            if (!stats) {
              log(
                `No stats found for character "${name}" in message ID ${mesId}. Skipping card.`
              );
              return "";
            }
            const bgColor = stats.bg || get_settings("defaultBgColor");
            const cardData = {
              characterName: name,
              currentDate: currentDate,
              currentTime: currentTime,
              stats: {
                ...stats,
                internal_thought:
                  stats.internal_thought ||
                  stats.thought ||
                  "No thought recorded.",
                relationshipStatus:
                  stats.relationshipStatus || "Unknown Status",
                desireStatus: stats.desireStatus || "Unknown Desire",
                inactive: stats.inactive || false,
                inactiveReason: stats.inactiveReason || 0,
              },
              bgColor: bgColor,
              darkerBgColor: darkenColor(bgColor),
              reactionEmoji: getReactionEmoji(stats.last_react),
              healthIcon:
                stats.health === 1 ? "🤕" : stats.health === 2 ? "💀" : null,
              showThoughtBubble: get_settings("showThoughtBubble"),
            };
            return compiledCardTemplate(cardData);
          })
          .join("");
      }

      // Remove any preparing text
      const preparingText = messageElement.parentNode.querySelector(".sst-preparing-text");
      if (preparingText) {
        preparingText.remove();
        // Remove this mesText from the set since it no longer has preparing text
        mesTextsWithPreparingText.delete(messageElement);
      }

      // Clear the flag since we're done processing
      isGeneratingCodeBlocks = false;

      // Get the template position from settings
      const templatePosition = get_settings("templatePosition") || "BOTTOM";

      // Handle different positions
      switch (templatePosition) {
        case "ABOVE":
          // Insert above the message content (inside the message block)
          const reasoningElement = messageElement.querySelector(
            ".mes_reasoning_details"
          );
          if (reasoningElement) {
            // Insert above reasoning details if they exist
            const finalHtml =
              compiledWrapperTemplate({ cardsHtml }) +
              `<hr style="margin-top: 15px; margin-bottom: 20px;">`;
            reasoningElement.insertAdjacentHTML("beforebegin", finalHtml);
          } else {
            // If no reasoning details, insert at the beginning of the message
            const finalHtml =
              compiledWrapperTemplate({ cardsHtml }) +
              `<hr style="margin-top: 15px; margin-bottom: 20px;">`;
            messageElement.insertAdjacentHTML("afterbegin", finalHtml);
          }
          break;
        case "LEFT":
          // Update the global left sidebar with the latest data
          updateLeftSidebar(compiledWrapperTemplate({ cardsHtml }));
          break;
        case "RIGHT":
          // Update the global right sidebar with the latest data
          updateRightSidebar(compiledWrapperTemplate({ cardsHtml }));
          break;
        case "MACRO":
          // For MACRO position, replace the placeholder in the message
          const placeholder = messageElement.querySelector(
            "#sst-macro-placeholder"
          );
          if (placeholder) {
            const finalHtml = compiledWrapperTemplate({ cardsHtml });
            placeholder.insertAdjacentHTML("beforebegin", finalHtml);
            placeholder.remove();
          }
          break;
        case "BOTTOM":
        default:
          // Add a horizontal divider before the cards
          const finalHtml =
            `<hr style="margin-top: 15px; margin-bottom: 20px;">` +
            compiledWrapperTemplate({ cardsHtml });
          messageElement.insertAdjacentHTML("beforeend", finalHtml);
          break;
      }
    }
  } catch (error) {
    // Clear the flag on error
    isGeneratingCodeBlocks = false;
    log(
      `A critical error occurred in renderTracker for message ID ${mesId}. Please check the console. Error: ${error.stack}`
    );
  }
};

const renderTrackerWithoutSim = (mesId) => {
  try {
    if (!get_settings("isEnabled")) return;

    const context = getContext();
    const message = context.chat[mesId];

    if (!message) {
      log(`Error: Could not find message with ID ${mesId}. Aborting render.`);
      return;
    }

    const messageElement = document.querySelector(
      `div[mesid="${mesId}"] .mes_text`
    );
    if (!messageElement) return;

    const identifier = get_settings("codeBlockIdentifier");
    let displayMessage = message.mes;

    // Hide sim blocks if the setting is enabled
    if (get_settings("hideSimBlocks")) {
      const hideRegex = new RegExp("```" + identifier + "[\\s\\S]*?```", "gm");
      displayMessage = displayMessage.replace(
        hideRegex,
        (match) => `<span style="display: none !important;">${match}</span>`
      );
    }

    // Format and display the message content (without the tracker UI)
    messageElement.innerHTML = messageFormatting(
      displayMessage,
      message.name,
      message.is_system,
      message.is_user,
      mesId
    );

    // Parse the sim data from the original message content (not the hidden version)
    const dataMatch = message.mes.match(
      new RegExp("```" + identifier + "[\\s\\S]*?```", "m")
    );

    if (dataMatch && dataMatch[0]) {
      // Remove the container if it already exists to prevent duplication on re-renders
      const existingContainer = messageElement.querySelector(
        `#${CONTAINER_ID}`
      );
      if (existingContainer) {
        existingContainer.remove();
      }

      const jsonContent = dataMatch[0]
        .replace(/```/g, "")
        .replace(new RegExp(`^${identifier}\\s*`), "")
        .trim();
      
      // --- NEW --- Capture the raw JSON string for the {{last_sim_stats}} macro
      // Always update the lastSimJsonString when we find a new sim block
      // This ensures it always contains the most recent data
      lastSimJsonString = jsonContent;
      log(`Captured last sim stats JSON from message ID ${mesId}.`);
      let jsonData;

      try {
        jsonData = JSON.parse(jsonContent);
      } catch (jsonError) {
        log(
          `Failed to parse JSON in message ID ${mesId}. Error: ${jsonError.message}`
        );
        const errorHtml = `<div style="color: red; font-family: monospace;">[SillySimTracker] Error: Invalid JSON in code block.</div>`;
        messageElement.insertAdjacentHTML("beforeend", errorHtml);
        return;
      }

      if (typeof jsonData !== "object" || jsonData === null) {
        log(`Parsed data in message ID ${mesId} is not a valid object.`);
        return;
      }

      // Handle both old and new JSON formats
      let worldData, characterList;

      // Check if it's the new format (with worldData and characters array)
      if (jsonData.worldData && Array.isArray(jsonData.characters)) {
        worldData = jsonData.worldData;
        characterList = jsonData.characters;
      } else {
        // Handle old format - convert object structure to array format
        const worldDataFields = ["current_date", "current_time"];
        worldData = {};
        characterList = [];

        Object.keys(jsonData).forEach((key) => {
          if (worldDataFields.includes(key)) {
            worldData[key] = jsonData[key];
          } else {
            // Convert character object to array item
            characterList.push({
              name: key,
              ...jsonData[key],
            });
          }
        });
      }

      const currentDate = worldData.current_date || "Unknown Date";
      const currentTime = worldData.current_time || "Unknown Date";

      if (!characterList.length) return;

      // For tabbed templates, we need to pass all characters to the template
      const isTabbedTemplate = get_settings("templateFile").includes("tabs");

      let cardsHtml = "";
      if (isTabbedTemplate) {
        // Prepare data for all characters
        const charactersData = characterList
          .map((character, index) => {
            const stats = character;
            const name = character.name;
            if (!stats) {
              log(
                `No stats found for character "${name}" in message ID ${mesId}. Skipping card.`
              );
              return null;
            }
            const bgColor = stats.bg || get_settings("defaultBgColor");
            return {
              characterName: name,
              currentDate: currentDate,
              currentTime: currentTime,
              stats: {
                ...stats,
                internal_thought:
                  stats.internal_thought ||
                  stats.thought ||
                  "No thought recorded.",
                relationshipStatus:
                  stats.relationshipStatus || "Unknown Status",
                desireStatus: stats.desireStatus || "Unknown Desire",
                inactive: stats.inactive || false,
                inactiveReason: stats.inactiveReason || 0,
              },
              bgColor: bgColor,
              darkerBgColor: darkenColor(bgColor),
              reactionEmoji: getReactionEmoji(stats.last_react),
              healthIcon:
                stats.health === 1 ? "🤕" : stats.health === 2 ? "💀" : null,
              showThoughtBubble: get_settings("showThoughtBubble"),
            };
          })
          .filter(Boolean); // Remove any null entries

        // For tabbed templates, we pass all characters in one data object
        const templateData = {
          characters: charactersData,
          currentDate: currentDate,
          currentTime: currentTime,
        };

        cardsHtml = compiledCardTemplate(templateData);
      } else {
        cardsHtml = characterList
          .map((character) => {
            const stats = character;
            const name = character.name;
            if (!stats) {
              log(
                `No stats found for character "${name}" in message ID ${mesId}. Skipping card.`
              );
              return "";
            }
            const bgColor = stats.bg || get_settings("defaultBgColor");
            const cardData = {
              characterName: name,
              currentDate: currentDate,
              currentTime: currentTime,
              stats: {
                ...stats,
                internal_thought:
                  stats.internal_thought ||
                  stats.thought ||
                  "No thought recorded.",
                relationshipStatus:
                  stats.relationshipStatus || "Unknown Status",
                desireStatus: stats.desireStatus || "Unknown Desire",
                inactive: stats.inactive || false,
                inactiveReason: stats.inactiveReason || 0,
              },
              bgColor: bgColor,
              darkerBgColor: darkenColor(bgColor),
              reactionEmoji: getReactionEmoji(stats.last_react),
              healthIcon:
                stats.health === 1 ? "🤕" : stats.health === 2 ? "💀" : null,
              showThoughtBubble: get_settings("showThoughtBubble"),
            };
            return compiledCardTemplate(cardData);
          })
          .join("");
      }

      // Remove any preparing text
      const preparingText = messageElement.parentNode.querySelector(".sst-preparing-text");
      if (preparingText) {
        preparingText.remove();
        // Remove this mesText from the set since it no longer has preparing text
        mesTextsWithPreparingText.delete(messageElement);
      }

      // Get the template position from settings
      const templatePosition = get_settings("templatePosition") || "BOTTOM";

      // Handle different positions
      switch (templatePosition) {
        case "ABOVE":
          // Insert above the message content (inside the message block)
          const reasoningElement = messageElement.querySelector(
            ".mes_reasoning_details"
          );
          if (reasoningElement) {
            // Insert above reasoning details if they exist
            const finalHtml =
              compiledWrapperTemplate({ cardsHtml }) +
              `<hr style="margin-top: 15px; margin-bottom: 20px;">`;
            reasoningElement.insertAdjacentHTML("beforebegin", finalHtml);
          } else {
            // If no reasoning details, insert at the beginning of the message
            const finalHtml =
              compiledWrapperTemplate({ cardsHtml }) +
              `<hr style="margin-top: 15px; margin-bottom: 20px;">`;
            messageElement.insertAdjacentHTML("afterbegin", finalHtml);
          }
          break;
        case "LEFT":
          // Update the global left sidebar with the latest data
          updateLeftSidebar(compiledWrapperTemplate({ cardsHtml }));
          break;
        case "RIGHT":
          // Update the global right sidebar with the latest data
          updateRightSidebar(compiledWrapperTemplate({ cardsHtml }));
          break;
        case "MACRO":
          // For MACRO position, replace the placeholder in the message
          const placeholder = messageElement.querySelector(
            "#sst-macro-placeholder"
          );
          if (placeholder) {
            const finalHtml = compiledWrapperTemplate({ cardsHtml });
            placeholder.insertAdjacentHTML("beforebegin", finalHtml);
            placeholder.remove();
          }
          break;
        case "BOTTOM":
        default:
          // Add a horizontal divider before the cards
          const finalHtml =
            `<hr style="margin-top: 15px; margin-bottom: 20px;">` +
            compiledWrapperTemplate({ cardsHtml });
          messageElement.insertAdjacentHTML("beforeend", finalHtml);
          break;
      }
    }
  } catch (error) {
    // Clear the flag on error
    isGeneratingCodeBlocks = false;
    log(
      `A critical error occurred in renderTrackerWithoutSim for message ID ${mesId}. Please check the console. Error: ${error.stack}`
    );
  }
};

// --- SETTINGS MANAGEMENT ---

const refresh_settings_ui = () => {
  for (const [key, [element, type]] of Object.entries(settings_ui_map)) {
    const value = get_settings(key);
    switch (type) {
      case "boolean":
        element.prop("checked", value);
        break;
      case "text":
      case "color":
      case "textarea":
        element.val(value);
        break;
    }
  }
};

const refreshAllCards = () => {
  log("Refreshing all tracker cards on screen.");

  // First, remove all existing tracker containers to prevent duplicates
  document.querySelectorAll(`#${CONTAINER_ID}`).forEach((container) => {
    container.remove();
  });

  // Remove global sidebars
  removeGlobalSidebars();

  // Get all message divs currently in the chat DOM
  const visibleMessages = document.querySelectorAll("div#chat .mes");
  visibleMessages.forEach((messageElement) => {
    const mesId = messageElement.getAttribute("mesid");
    if (mesId) {
      // Call the existing render function for each visible message
      renderTrackerWithoutSim(parseInt(mesId, 10));
    }
  });
};

const bind_setting = (selector, key, type) => {
  const element = $(selector);
  if (element.length === 0) {
    log(`Could not find settings element: ${selector}`);
    return;
  }
  settings_ui_map[key] = [element, type];
  element.on("change input", () => {
    let value;
    switch (type) {
      case "boolean":
        value = element.prop("checked");
        break;
      case "text":
      case "color":
      case "textarea":
        value = element.val();
        break;
    }
    set_settings(key, value);
    if (key === "templateFile") {
      loadTemplate().then(() => {
        refreshAllCards();
      });
    }
  });
};

const initialize_settings_listeners = () => {
  log("Binding settings UI elements...");

  bind_setting("#isEnabled", "isEnabled", "boolean");
  bind_setting("#codeBlockIdentifier", "codeBlockIdentifier", "text");
  bind_setting("#defaultBgColor", "defaultBgColor", "color");
  bind_setting("#showThoughtBubble", "showThoughtBubble", "boolean");
  bind_setting("#hideSimBlocks", "hideSimBlocks", "boolean"); // New setting
  bind_setting("#datingSimPrompt", "datingSimPrompt", "textarea");
  bind_setting("#templatePosition", "templatePosition", "text");

  // Listener for the default template dropdown
  const $templateSelect = $("#templateFile");
  if ($templateSelect.length) {
    settings_ui_map["templateFile"] = [$templateSelect, "text"];
    $templateSelect.on("change", async () => {
      set_settings("templateFile", $templateSelect.val());
      await loadTemplate();
      refreshAllCards();
    });
  }

  $("#uploadCustomTemplateBtn").on("click", () => {
    $("#customTemplateUpload").click(); // Trigger the hidden file input
  });

  $("#customTemplateUpload").on("change", handleCustomTemplateUpload);

  $("#clearCustomTemplateBtn").on("click", async () => {
    log("Clearing custom template.");
    set_settings("customTemplateHtml", "");
    toastr.info("Custom template cleared. Reverted to default.");
    await loadTemplate(); // Reload to apply the selected default
    refreshAllCards();
  });

  // Listener for the JSON format migration button
  $("#migrateJsonFormatBtn").on("click", () => {
    if (
      confirm(
        "This will migrate all existing sim data to the new format with worldData and characters array. This operation cannot be undone. Are you sure?"
      )
    ) {
      migrateAllSimData();
    }
  });

  // --- Custom Fields UI Logic ---
  const $manageFieldsButton = $("#manageCustomFieldsBtn");

  // Function to create and show the modal
  const createAndShowModal = () => {
    // Remove any existing modal
    $("#sst-custom-fields-modal").remove();

    // Create modal HTML using SillyTavern's built-in classes with dialog element
    const modalHtml = `
            <dialog id="sst-custom-fields-modal" class="popup wide_dialogue_popup large_dialogue_popup vertical_scrolling_dialogue_popup popup--animation-fast">
                <div class="popup-header">
                    <h3 style="margin: 0; padding: 10px 0;">Manage Custom Fields</h3>
                </div>
                <div class="popup-content" style="padding: 15px; flex: 1; display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <div style="flex: 1;"></div>
                        <button id="addCustomFieldBtn" class="menu_button">Add New Field</button>
                    </div>
                    <div id="customFieldsList" class="sst-fields-container" style="flex: 1; overflow-y: auto;">
                        <!-- Fields will be populated here by JavaScript -->
                    </div>
                </div>
                <div class="popup-footer" style="display: flex; justify-content: center; padding: 15px;">
                    <button id="sst-modal-close" class="menu_button">Close</button>
                </div>
            </dialog>
        `;

    // Append modal to body
    $("body").append(modalHtml);

    // Get references to modal elements
    const $modal = $("#sst-custom-fields-modal");
    const $fieldsContainer = $modal.find("#customFieldsList");
    const $addFieldButton = $modal.find("#addCustomFieldBtn");
    const $modalClose = $modal.find("#sst-modal-close");

    // Create field template
    const createFieldTemplate = () => {
      return $(`
                <div class="sst-field-item">
                    <div class="sst-field-header">
                        <input type="text" class="field-key-display field-key text_pole" placeholder="Field key" style="margin-right: 10px;" />
                        <div>
                            <button class="sst-toggle-field menu_button">Expand</button>
                            <button class="remove-field-btn menu_button" style="margin-left: 5px;">Remove</button>
                        </div>
                    </div>
                    <div class="sst-field-details" style="display: none; padding: 10px; border-top: 1px solid #444; margin-top: 5px;">
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <div>
                                <label>Description for LLM:</label>
                                <input type="text" class="field-description text_pole" placeholder="Field description" style="width: 100%;" />
                            </div>
                        </div>
                    </div>
                </div>
            `);
    };

    // Function to render the list of fields
    const renderFields = () => {
      const fields = get_settings("customFields") || [];
      $fieldsContainer.empty();
      fields.forEach((field, index) => {
        const $fieldElement = createFieldTemplate();

        // Set values in the key input (which is now at the top level)
        const fieldKey = field.key || "";
        $fieldElement
          .find(".field-key-display")
          .val(fieldKey)
          .on("input", function () {
            const newValue = $(this).val();
            const updatedFields = [...fields];
            updatedFields[index].key = sanitizeFieldKey(newValue); // Sanitize on input
            set_settings("customFields", updatedFields);
          });

        // Set values in the description input
        $fieldElement
          .find(".field-description")
          .val(field.description)
          .on("input", function () {
            const newValue = $(this).val();
            const updatedFields = [...fields];
            updatedFields[index].description = newValue;
            set_settings("customFields", updatedFields);
          });

        $fieldElement.find(".remove-field-btn").on("click", function () {
          const updatedFields = fields.filter((_, i) => i !== index);
          set_settings("customFields", updatedFields);
          renderFields(); // Re-render the list
        });

        // Handle toggle button
        const $toggleButton = $fieldElement.find(".sst-toggle-field");
        const $details = $fieldElement.find(".sst-field-details");
        $toggleButton.on("click", function () {
          if ($details.is(":visible")) {
            $details.hide();
            $toggleButton.text("Expand");
          } else {
            $details.show();
            $toggleButton.text("Collapse");
          }
        });

        $fieldsContainer.append($fieldElement);
      });
    };

    // Add new field button listener
    $addFieldButton.on("click", () => {
      const fields = get_settings("customFields") || [];
      const newField = {
        key: "new_field_key",
        description: "Description for the LLM",
      };
      set_settings("customFields", [...fields, newField]);
      renderFields(); // Re-render the list

      // Scroll to the bottom where the new field was added
      $fieldsContainer.scrollTop($fieldsContainer[0].scrollHeight);
    });

    // Close modal when clicking the Close button
    $modalClose.on("click", () => {
      $modal.remove();
    });

    // Close modal with Escape key
    $modal.on("keydown", function (e) {
      if (e.key === "Escape") {
        $modal.remove();
      }
    });

    // Also close when clicking on the backdrop (dialog native behavior)
    $modal.on("click", function (e) {
      if (e.target === this) {
        $modal.remove();
      }
    });

    // Render fields and show modal
    renderFields();
    $modal[0].showModal(); // Use the native dialog showModal() method
  };

  // Manage fields button opens the modal
  $manageFieldsButton.on("click", () => {
    createAndShowModal();
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
  extension_settings[MODULE_NAME] = Object.assign(
    {},
    default_settings,
    extension_settings[MODULE_NAME]
  );
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

// --- INTERCEPTOR ---
globalThis.simTrackerGenInterceptor = async function (
  chat,
  contextSize,
  abort,
  type
) {
  log(`simTrackerGenInterceptor called with type: ${type}`);
  
  // Handle regenerate and swipe conditions to reset last_sim_stats macro
  if (type === "regenerate" || type === "swipe") {
    log(`Handling ${type} condition - updating last_sim_stats macro`);
    updateLastSimStatsOnRegenerateOrSwipe();
  }
  
  // Filter out sim blocks from messages beyond the last 3
  filterSimBlocksInPrompt(chat);
  
  return { chat, contextSize, abort };
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

    // Set up MutationObserver to hide sim code blocks as they stream in
    log("Setting up MutationObserver for in-flight sim block hiding...");
    const observer = new MutationObserver((mutations) => {
      // Only process if the extension is enabled and hiding is turned on
      if (!get_settings("isEnabled") || !get_settings("hideSimBlocks")) return;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          // Check if the added node is a pre element or contains pre elements
          if (node.nodeType === Node.ELEMENT_NODE) {
            const preElements =
              node.tagName === "PRE" ? [node] : node.querySelectorAll("pre");
            preElements.forEach((pre) => {
              // Check if this pre element is within a mes_text div
              if (pre.closest(".mes_text")) {
                log(`Hiding in-flight code block in mes_text`);
                pre.style.display = "none";

                // Add "Preparing new tracker cards..." text with pulsing animation
                const mesText = pre.closest(".mes_text");
                if (mesText && !mesTextsWithPreparingText.has(mesText)) {
                  // Mark this mesText as having preparing text
                  mesTextsWithPreparingText.add(mesText);

                  const preparingText = document.createElement("div");
                  preparingText.className = "sst-preparing-text";
                  preparingText.textContent = "Preparing new tracker cards...";
                  preparingText.style.cssText = `
                                        color: #4a3a9d; /* Darker blue */
                                        font-style: italic;
                                        margin: 10px 0;
                                        animation: sst-pulse 1.5s infinite;
                                    `;
                  // Insert after mesText instead of appending to it
                  mesText.parentNode.insertBefore(preparingText, mesText.nextSibling);

                  // Add the pulse animation to the document if not already present
                  if (!document.getElementById("sst-pulse-animation")) {
                    const style = document.createElement("style");
                    style.id = "sst-pulse-animation";
                    style.textContent = `
                                            @keyframes sst-pulse {
                                                0% { opacity: 0.5; }
                                                50% { opacity: 1; }
                                                100% { opacity: 0.5; }
                                            }
                                        `;
                    document.head.appendChild(style);
                  }
                }
              }
            });
          }
        });
      });
    });

    // Start observing for changes in the document
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    log("MutationObserver set up for in-flight sim block hiding.");

    log("Registering macros...");
    MacrosParser.registerMacro("sim_tracker", () => {
      if (!get_settings("isEnabled")) return "";
      log("Processed {{sim_tracker}} macro.");
      return get_settings("datingSimPrompt");
    });

    MacrosParser.registerMacro("last_sim_stats", () => {
      if (!get_settings("isEnabled")) return "";
      log("Processed {{last_sim_stats}} macro.");
      return lastSimJsonString || "{}";
    });

    // Register the slash command for converting sim data formats
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: "sst-convert",
        callback: () => {
          if (
            confirm(
              "This will convert all sim data in the current chat to the new format. Are you sure?"
            )
          ) {
            migrateAllSimData();
            return "Converting sim data formats... Check notifications for results.";
          }
          return "Conversion cancelled.";
        },
        returns: "status message",
        unnamedArgumentList: [],
        helpString: `
                <div>
                    Converts all sim data in the current chat from the old format to the new format.
                </div>
                <div>
                    <strong>Example:</strong>
                    <ul>
                        <li>
                            <pre><code class="language-stscript">/sst-convert</code></pre>
                            Converts all sim data in the current chat
                        </li>
                    </ul>
                </div>
            `,
      })
    );

    MacrosParser.registerMacro("sim_format", () => {
      if (!get_settings("isEnabled")) return "";
      const fields = get_settings("customFields") || [];
      log("Processed {{sim_format}} macro.");

      // Start building the JSON example structure
      let exampleJson = "{";
      exampleJson += '  "characterName": {';

      // Add each custom field as a commented key-value pair
      fields.forEach((field) => {
        const sanitizedKey = sanitizeFieldKey(field.key);
        exampleJson += `    "${sanitizedKey}\": [${sanitizedKey.toUpperCase()}_VALUE], // ${
          field.description
        }`;
      });

      exampleJson += "  },";
      exampleJson +=
        '  "characterTwo": { ... }, // Repeat structure for each character';
      exampleJson += '  "current_date": [CURRENT_STORY_DATE] // YYYY-MM-DD';
      exampleJson +=
        '  "current_time": [CURRENT_STORY_TIME] // 21:34, 10:21, etc (24-hour time)';
      exampleJson += "}";

      // Wrap in the code block with the identifier
      const identifier = get_settings("codeBlockIdentifier") || "sim";
      return `\`\`\`${identifier}\n${exampleJson}\n\`\`\``;
    });

    // Register a new macro for positionable tracker replacement
    MacrosParser.registerMacro("sim_tracker_positioned", () => {
      if (!get_settings("isEnabled")) return "";
      log("Processed {{sim_tracker_positioned}} macro.");

      // Get the template position from settings
      const templatePosition = get_settings("templatePosition") || "BOTTOM";

      // Only return replacement content for MACRO position
      if (templatePosition === "MACRO") {
        // This would be replaced with actual tracker content when rendering
        return '<div id="sst-macro-placeholder" style="display: none;">SST_PLACEHOLDER</div>';
      }

      // For other positions, return empty string
      return "";
    });
    log("Macros registered successfully.");

    // Register the slash command for adding sim data to messages
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: "sst-add",
        callback: async () => {
          if (!get_settings("isEnabled")) {
            return "Silly Sim Tracker is not enabled.";
          }

          try {
            const context = getContext();
            if (!context || !context.chat || context.chat.length === 0) {
              return "No chat history found.";
            }

            // Get the last character message
            let lastCharMessageIndex = -1;
            for (let i = context.chat.length - 1; i >= 0; i--) {
              if (!context.chat[i].is_user && !context.chat[i].is_system) {
                lastCharMessageIndex = i;
                break;
              }
            }

            if (lastCharMessageIndex === -1) {
              return "No character message found in chat history.";
            }

            const lastCharMessage = context.chat[lastCharMessageIndex];

            // Check if the message already contains a sim block
            const identifier = get_settings("codeBlockIdentifier");
            const simRegex = new RegExp(
              "```" + identifier + "[\\s\\S]*?```",
              "m"
            );
            if (simRegex.test(lastCharMessage.mes)) {
              return "Last character message already contains a sim block.";
            }

            // Append the sim block to the message
            const simBlock = `\n\`\`\`${identifier}\n`;
            lastCharMessage.mes += simBlock;

            // Update the message in the UI
            const messageElement = document.querySelector(
              `div[mesid="${lastCharMessageIndex}"] .mes_text`
            );
            if (messageElement) {
              messageElement.innerHTML = messageFormatting(
                lastCharMessage.mes,
                lastCharMessage.name,
                lastCharMessage.is_system,
                lastCharMessage.is_user,
                lastCharMessageIndex
              );
            }

            // Use the proper Generate function to continue generation
            await Generate("continue", {});

            return "Added sim block to last character message and requested continuation.";
          } catch (error) {
            log(`Error in /sst-add command: ${error.message}`);
            return `Error: ${error.message}`;
          }
        },
        returns: "status message",
        unnamedArgumentList: [],
        helpString: `
                <div>
                    Adds a sim block to the last character message if it doesn't already have one, and requests continuation.
                </div>
                <div>
                    <strong>Example:</strong>
                    <ul>
                        <li>
                            <pre><code class="language-stscript">/sst-add</code></pre>
                            Adds a sim block to the last character message and continues generation
                        </li>
                    </ul>
                </div>
            `,
      })
    );

    const context = getContext();
    const { eventSource, event_types } = context;

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, renderTracker);
    eventSource.on(event_types.CHAT_CHANGED, refreshAllCards);
    eventSource.on(event_types.MORE_MESSAGES_LOADED, refreshAllCards);
    eventSource.on(event_types.MESSAGE_UPDATED, refreshAllCards);
    eventSource.on(event_types.MESSAGE_EDITED, (mesId) => {
      log(`Message ${mesId} was edited. Re-rendering tracker card.`);
      renderTrackerWithoutSim(mesId);
    });
    eventSource.on(event_types.MESSAGE_SWIPE, (mesId) => {
      log(
        `Message swipe detected for message ID ${mesId}. Updating last_sim_stats macro.`
      );
      updateLastSimStatsOnRegenerateOrSwipe();
    });
    refreshAllCards();
    log(`${MODULE_NAME} has been successfully loaded.`);
  } catch (error) {
    console.error(
      `[${MODULE_NAME}] A critical error occurred during initialization. The extension may not work correctly. Error: ${error.stack}`
    );
  }
});
