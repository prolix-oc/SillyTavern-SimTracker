import { getContext, extension_settings } from "../../../extensions.js";
import {
  saveSettingsDebounced,
  messageFormatting,
  Generate,
} from "../../../../script.js";
import { MacrosParser } from "../../../macros.js";
import { SlashCommand } from "../../../slash-commands/SlashCommand.js";
import { SlashCommandParser } from "../../../slash-commands/SlashCommandParser.js";
// Import our new modules
import {
  loadTemplate,
  populateTemplateDropdown,
  handleCustomTemplateUpload,
  loadDefaultPromptFromFile,
  generateSimFormat,
  defaultSimFields
} from "./templater.js";
import {
  renderTrackerCards,
  updateLeftSidebar,
  updateRightSidebar,
  removeGlobalSidebars,
  prepareCharacterData,
  prepareTabbedCharacterData,
  darkenColor,
  getReactionEmoji
} from "./renderer.js";
import {
  migrateJsonFormat,
  migrateAllSimData,
  filterSimBlocksInPrompt,
  updateLastSimStatsOnRegenerateOrSwipe,
  processMessageContent,
  extractSimData
} from "./textProcessor.js";
import {
  default_settings as defaultSettings,
  get_settings,
  set_settings,
  refresh_settings_ui,
  bind_setting,
  initialize_settings_listeners,
  initialize_settings,
  load_settings_html_manually,
  populateTemplateDropdown as populateTemplateDropdownSettings
} from "./settingsHandler.js";
import { get_extension_directory } from "./utils.js";

const MODULE_NAME = "silly-sim-tracker";
const CONTAINER_ID = "silly-sim-tracker-container";

// --- UTILITY FUNCTIONS ---
const log = (message) => console.log(`[SST] [${MODULE_NAME}]`, message);
const get_settings_wrapper = (key) => get_settings(key);
const set_settings_wrapper = (key, value) => {
  set_settings(key, value);
};

// Global variables
let settings = extension_settings[MODULE_NAME] || {};
let lastSimJsonString = "";
// Keep track of when we're expecting code blocks to be generated
let isGeneratingCodeBlocks = false;
let isGenerationInProgress = false;
// Keep track of mesText elements that have preparing text
let mesTextsWithPreparingText = new Set();



const default_settings = defaultSettings;

// Template variables
let compiledCardTemplate = null;

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
        .replace(new RegExp(`^${identifier}\s*`), "")
        .trim();

      // --- NEW --- Capture the raw JSON string for the {{last_sim_stats}} macro
      // Always update the lastSimJsonString when we find a new sim block
      // This ensures it always contains the most recent data
      lastSimJsonString = jsonContent;
      log(`Captured last sim stats JSON from message ID ${mesId}.`);

      // Remove any preparing text
      const preparingText = messageElement.parentNode.querySelector(".sst-preparing-text");
      if (preparingText) {
        preparingText.remove();
        // Remove this mesText from the set since it no longer has preparing text
        mesTextsWithPreparingText.delete(messageElement);
      }

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

      if (preparingText) {
        preparingText.remove();
        // Remove this mesText from the set since it no longer has preparing text
        mesTextsWithPreparingText.delete(messageElement);
      }

      // Clear the flag since we're done processing
      isGeneratingCodeBlocks = false;

      // Get the template position from settings or from template metadata
      const templatePosition = result && result.templatePosition ? 
        result.templatePosition : 
        (get_settings("templatePosition") || "BOTTOM");

      // Use the renderer to display the cards
      renderTrackerCards(messageElement, cardsHtml, templatePosition);
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
        .replace(new RegExp(`^${identifier}\s*`), "")
        .trim();

      // --- NEW --- Capture the raw JSON string for the {{last_sim_stats}} macro
      // Always update the lastSimJsonString when we find a new sim block
      // This ensures it always contains the most recent data
      lastSimJsonString = jsonContent;
      log(`Captured last sim stats JSON from message ID ${mesId}.`);

      // Remove any preparing text
      const preparingText = messageElement.parentNode.querySelector(".sst-preparing-text");
      if (preparingText) {
        preparingText.remove();
        // Remove this mesText from the set since it no longer has preparing text
        mesTextsWithPreparingText.delete(messageElement);
      }

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

      if (preparingText) {
        preparingText.remove();
        // Remove this mesText from the set since it no longer has preparing text
        mesTextsWithPreparingText.delete(messageElement);
      }

      // Get the template position from settings or from template metadata
      const templatePosition = result && result.templatePosition ? 
        result.templatePosition : 
        (get_settings("templatePosition") || "BOTTOM");

      // Use the renderer to display the cards
      renderTrackerCards(messageElement, cardsHtml, templatePosition);
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
let settings_ui_map = {};

const refreshAllCards = () => {
  log("Refreshing all tracker cards on screen.");

  // First, remove all existing tracker containers to prevent duplicates
  document.querySelectorAll(`#${CONTAINER_ID}`).forEach((container) => {
    container.remove();
  });

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

// --- INTERCEPTOR ---
globalThis.simTrackerGenInterceptor = async function (
  chat,
  contextSize,
  abort,
  type
) {
  log(`simTrackerGenInterceptor called with type: ${type}`);

  // Set generation in progress flag
  isGenerationInProgress = true;
  // Make this available globally for the renderer
  window.sstIsGenerationInProgress = true;

  // Handle regenerate and swipe conditions to reset last_sim_stats macro
  if (type === "regenerate" || type === "swipe") {
    log(`Handling ${type} condition - updating last_sim_stats macro`);
    // For regenerate/swipe operations, pass the ID of the last message in chat
    // This helps find sim data from the message before the one being regenerated/swiped
    const lastMesId =
      chat && Array.isArray(chat) && chat.length > 0 ? chat.length - 1 : null;
    const newSimJson = updateLastSimStatsOnRegenerateOrSwipe(getContext, get_settings_wrapper, lastMesId);
    if (newSimJson) {
      lastSimJsonString = newSimJson;
    }
  }

  // Filter out sim blocks from messages beyond the last 3
  filterSimBlocksInPrompt(chat, get_settings_wrapper("codeBlockIdentifier"));

  return { chat, contextSize, abort };
};

// --- ENTRY POINT ---
jQuery(async () => {
  try {
    log(`Initializing extension: ${MODULE_NAME}`);
    await initialize_settings(loadDefaultPromptFromFile);
    await load_settings_html_manually(get_extension_directory);
    await populateTemplateDropdownSettings();
    initialize_settings_listeners(loadTemplate, refreshAllCards);
    log("Settings panel listeners initialized.");
    const result = await loadTemplate(get_settings_wrapper);
    if (result && result.compiledCardTemplate) {
      compiledCardTemplate = result.compiledCardTemplate;
      // Update the template position in settings if provided
      if (result.templatePosition) {
        set_settings_wrapper("templatePosition", result.templatePosition);
      }
    }

    // Set up MutationObserver to hide sim code blocks as they stream in
    log("Setting up MutationObserver for in-flight sim block hiding...");
    const observer = new MutationObserver((mutations) => {
      // Only process if the extension is enabled, hiding is turned on, and generation is in progress
      if (
        !get_settings_wrapper("isEnabled") ||
        !get_settings_wrapper("hideSimBlocks") ||
        !isGenerationInProgress
      )
        return;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          // Check if the added node is a pre element or contains pre elements
          if (node.nodeType === Node.ELEMENT_NODE) {
            const preElements =
              node.tagName === "PRE" ? [node] : node.querySelectorAll("pre");
            preElements.forEach((pre) => {
              // Check if this pre element is within a mes_text div and contains sim data
              if (pre.closest(".mes_text")) {
                // Check if this is a sim code block
                const codeElement = pre.querySelector("code");
                if (codeElement) {
                  const identifier = get_settings("codeBlockIdentifier");
                  const classList = codeElement.classList;
                  // Check if any class matches our identifier (like language-sim)
                  const isSimBlock =
                    Array.from(classList).some((cls) =>
                      cls.includes(identifier)
                    ) || codeElement.textContent.trim().startsWith(identifier);

                  if (isSimBlock) {
                    log(`Hiding in-flight code block in mes_text`);
                    pre.style.display = "none";

                    // Add "Preparing new tracker cards..." text with pulsing animation
                    const mesText = pre.closest(".mes_text");
                    if (mesText && !mesTextsWithPreparingText.has(mesText)) {
                      // Mark this mesText as having preparing text
                      mesTextsWithPreparingText.add(mesText);

                      const preparingText = document.createElement("div");
                      preparingText.className = "sst-preparing-text";
                      preparingText.textContent =
                        "Preparing new tracker cards...";
                      preparingText.style.cssText = `
                                            color: #4a3a9d; /* Darker blue */
                                            font-style: italic;
                                            margin: 10px 0;
                                            animation: sst-pulse 1.5s infinite;
                                        `;
                      // Insert after mesText instead of appending to it
                      mesText.parentNode.insertBefore(
                        preparingText,
                        mesText.nextSibling
                      );

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
      if (!get_settings_wrapper("isEnabled")) return "";
      log("Processed {{sim_tracker}} macro.");
      return get_settings_wrapper("datingSimPrompt");
    });

    MacrosParser.registerMacro("last_sim_stats", () => {
      if (!get_settings_wrapper("isEnabled")) return "";
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
            migrateAllSimData(getContext, get_settings_wrapper);
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
      if (!get_settings_wrapper("isEnabled")) return "";
      const fields = get_settings_wrapper("customFields") || [];
      log("Processed {{sim_format}} macro.");

      // Use the generateSimFormat function from templater module
      return generateSimFormat({
        customFields: fields,
        codeBlockIdentifier: get_settings_wrapper("codeBlockIdentifier") || "sim"
      });
    });

    // Register a new macro for positionable tracker replacement
    MacrosParser.registerMacro("sim_tracker_positioned", () => {
      if (!get_settings_wrapper("isEnabled")) return "";
      log("Processed {{sim_tracker_positioned}} macro.");

      // Get the template position from settings
      const templatePosition = get_settings_wrapper("templatePosition") || "BOTTOM";

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
          if (!get_settings_wrapper("isEnabled")) {
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
            const identifier = get_settings_wrapper("codeBlockIdentifier");
            const simRegex = new RegExp(
              "```" + identifier + "[\\s\\S]*?```",
              "m"
            );
            if (simRegex.test(lastCharMessage.mes)) {
              return "Last character message already contains a sim block.";
            }

            // Append the sim block to the message
            const simBlock = `
\`\`\`${identifier}
`;
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

    // Set generation in progress flag when generation starts
    eventSource.on(event_types.GENERATION_STARTED, () => {
      isGenerationInProgress = true;
      // Make this available globally for the renderer
      window.sstIsGenerationInProgress = true;
    });

    // Also set generation in progress flag for after commands event
    eventSource.on(event_types.GENERATION_AFTER_COMMANDS, () => {
      isGenerationInProgress = true;
      // Make this available globally for the renderer
      window.sstIsGenerationInProgress = true;
    });

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (mesId) => {
      // Clear generation in progress flag when message is rendered
      isGenerationInProgress = false;
      // Make this available globally for the renderer
      window.sstIsGenerationInProgress = false;
      renderTracker(mesId);
    });
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
      const newSimJson = updateLastSimStatsOnRegenerateOrSwipe(getContext, get_settings_wrapper, mesId);
      if (newSimJson) {
        lastSimJsonString = newSimJson;
      }
    });

    // Listen for generation ended event to update sidebars
    eventSource.on(event_types.GENERATION_ENDED, () => {
      log("Generation ended, updating sidebars if needed");
      isGenerationInProgress = false;
      // Make this available globally for the renderer
      window.sstIsGenerationInProgress = false;

      // Update left sidebar if there's pending content
      if (pendingLeftSidebarContent) {
        updateLeftSidebar(pendingLeftSidebarContent);
        pendingLeftSidebarContent = null;
      }

      // Update right sidebar if there's pending content
      if (pendingRightSidebarContent) {
        updateRightSidebar(pendingRightSidebarContent);
        pendingRightSidebarContent = null;
      }

      // Clear any remaining preparing text when generation ends
      document.querySelectorAll(".sst-preparing-text").forEach((element) => {
        const mesText = element.previousElementSibling;
        if (mesText && mesText.classList.contains("mes_text")) {
          if (typeof mesTextsWithPreparingText !== 'undefined') {
            mesTextsWithPreparingText.delete(mesText);
          }
        }
        element.remove();
      });
    });

    refreshAllCards();
    log(`${MODULE_NAME} has been successfully loaded.`);
  } catch (error) {
    console.error(
      `[${MODULE_NAME}] A critical error occurred during initialization. The extension may not work correctly. Error: ${error.stack}`
    );
  }
});
