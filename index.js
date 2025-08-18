import { 
  messageFormatting,
  Generate,
} from "../../../../script.js";

// Import from our modules
import {
  renderTracker,
  renderTrackerWithoutSim,
  refreshAllCards,
  updateLeftSidebar,
  updateRightSidebar,
  removeGlobalSidebars,
  isGenerationInProgress,
  pendingLeftSidebarContent,
  pendingRightSidebarContent,
  mesTextsWithPreparingText,
  setGenerationInProgress,
  getGenerationInProgress,
  CONTAINER_ID
} from "./renderer.js";

import {
  compiledWrapperTemplate,
  compiledCardTemplate,
  populateTemplateDropdown,
  handleCustomTemplateUpload,
  loadTemplate,
  currentTemplatePosition
} from "./templating.js";

import {
  get_settings,
  set_settings,
  initialize_settings,
  initialize_settings_listeners,
  load_settings_html_manually,
  defaultSimFields,
  handlePresetExport,
  handlePresetImport,
  showManagePresetsModal
} from "./settingsHandler.js";

import {
  log,
  sanitizeFieldKey,
  darkenColor,
  getReactionEmoji,
  getInactiveReasonEmoji,
  updateLastSimStatsOnRegenerateOrSwipe,
  filterSimBlocksInPrompt,
  migrateAllSimData,
} from "./utils.js";

import {
  parseTrackerData,
  generateTrackerBlock
} from "./formatUtils.js";

const MODULE_NAME = "silly-sim-tracker";
const context = SillyTavern.getContext();

let lastSimJsonString = "";
// Keep track of when we're expecting code blocks to be generated
let isGeneratingCodeBlocks = false;

// --- INTERCEPTOR ---
globalThis.simTrackerGenInterceptor = async function (
  chat,
  contextSize,
  abort,
  type
) {
  log(`simTrackerGenInterceptor called with type: ${type}`);

  // Note: isGenerationInProgress is managed within the renderer module

  // Handle regenerate and swipe conditions to reset last_sim_stats macro
  if (type === "regenerate" || type === "swipe") {
    log(`Handling ${type} condition - updating last_sim_stats macro`);
    // For regenerate/swipe operations, pass the ID of the last message in chat
    // This helps find sim data from the message before the one being regenerated/swiped
    const lastMesId =
      chat && Array.isArray(chat) && chat.length > 0 ? chat.length - 1 : null;
    const updatedStats = updateLastSimStatsOnRegenerateOrSwipe(lastMesId, get_settings);
    if (updatedStats) {
      lastSimJsonString = updatedStats;
    }
  }

  // Filter out sim blocks from messages beyond the last 3
  filterSimBlocksInPrompt(chat, get_settings);

  return { chat, contextSize, abort };
};

// --- ENTRY POINT ---
jQuery(async () => {
  try {
    log(`Initializing extension: ${MODULE_NAME}`);
    await initialize_settings();
    await load_settings_html_manually();
    await populateTemplateDropdown(get_settings);
    
    // Create wrapper functions that pass the required dependencies
    const wrappedLoadTemplate = () => loadTemplate(get_settings, set_settings);
    const wrappedRefreshAllCards = () => refreshAllCards(
      get_settings, 
      CONTAINER_ID, 
      (mesId) => {
        const updatedLastSimJsonString = renderTrackerWithoutSim(mesId, get_settings, compiledWrapperTemplate, compiledCardTemplate, getReactionEmoji, darkenColor, lastSimJsonString);
        if (updatedLastSimJsonString !== undefined) {
          lastSimJsonString = updatedLastSimJsonString;
        }
      },
      compiledWrapperTemplate,
      compiledCardTemplate,
      getReactionEmoji,
      darkenColor,
      lastSimJsonString
    );
    const wrappedMigrateAllSimData = () => migrateAllSimData(get_settings);
    const wrappedHandleCustomTemplateUpload = (event) => handleCustomTemplateUpload(event, set_settings, wrappedLoadTemplate, wrappedRefreshAllCards);
    const wrappedHandlePresetExport = () => handlePresetExport(wrappedLoadTemplate, wrappedRefreshAllCards);
    const wrappedHandlePresetImport = (event) => handlePresetImport(event, wrappedLoadTemplate, wrappedRefreshAllCards);
    const wrappedShowManagePresetsModal = () => showManagePresetsModal(wrappedLoadTemplate, wrappedRefreshAllCards);
    
    initialize_settings_listeners(wrappedLoadTemplate, wrappedRefreshAllCards, wrappedMigrateAllSimData, wrappedHandleCustomTemplateUpload, wrappedHandlePresetExport, wrappedHandlePresetImport, wrappedShowManagePresetsModal);
    log("Settings panel listeners initialized.");
    await wrappedLoadTemplate();

    // Function to validate if a sim block is complete and valid
const isValidSimBlock = (content, identifier) => {
  try {
    // Check if content exists and is not empty
    if (!content || content.trim() === "") {
      return false;
    }
    
    // Remove the identifier and any leading/trailing whitespace
    let cleanContent = content.trim();
    if (cleanContent.startsWith(identifier)) {
      cleanContent = cleanContent.substring(identifier.length).trim();
    }
    
    // Check if it looks like a complete block (starts and ends properly)
    const trimmedContent = cleanContent.trim();
    
    // For JSON format
    if ((trimmedContent.startsWith("{") && trimmedContent.endsWith("}")) || 
        (trimmedContent.startsWith("[") && trimmedContent.endsWith("]"))) {
      // Try to parse JSON to validate completeness
      const parsed = JSON.parse(trimmedContent);
      // Additional validation - check if it has the expected structure
      if (typeof parsed === 'object' && parsed !== null) {
        // For modern format, check if it has worldData and characters
        if (parsed.worldData !== undefined && parsed.characters !== undefined) {
          return Array.isArray(parsed.characters);
        }
        // For legacy format, check if it has at least one character-like property
        const keys = Object.keys(parsed);
        return keys.length > 0;
      }
      return false;
    }
    
    // For YAML format (simpler validation)
    // Check if it has some key-value structure or array structure
    if (trimmedContent.includes(":") || trimmedContent.startsWith("-")) {
      // Try to parse YAML to validate completeness
      const parsed = parseTrackerData(trimmedContent);
      // Additional validation - check if it has the expected structure
      if (typeof parsed === 'object' && parsed !== null) {
        // For modern format, check if it has worldData and characters
        if (parsed.worldData !== undefined && parsed.characters !== undefined) {
          return Array.isArray(parsed.characters);
        }
        // For legacy format, check if it has at least one character-like property
        const keys = Object.keys(parsed);
        return keys.length > 0;
      }
      return false;
    }
    
    // If we can't determine the format but it's not empty, assume it might be valid
    // This is a fallback for cases where we can't easily validate
    return trimmedContent.length > 0;
  } catch (error) {
    // If parsing fails, it's not a valid complete block
    log(`Sim block validation failed: ${error.message}`);
    return false;
  }
};
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
                  // Extract the content
                  const content = codeElement.textContent.trim();
                  
                  // Validate if this is a complete, valid sim block
                  if (isValidSimBlock(content, identifier)) {
                    log(`Found complete sim block, processing...`);
                    
                    // Hide the code block
                    pre.style.display = "none";
                    
                    // Get the message element
                    const mesText = pre.closest(".mes_text");
                    if (mesText) {
                      // Get the message ID
                      const messageElement = mesText.closest("[mesid]");
                      if (messageElement) {
                        const mesId = parseInt(messageElement.getAttribute("mesid"), 10);
                        if (!isNaN(mesId)) {
                          // Trigger tracker rendering for this message
                          log(`Rendering tracker for message ID ${mesId}`);
                          renderTrackerWithoutSim(mesId, get_settings, compiledWrapperTemplate, compiledCardTemplate, getReactionEmoji, darkenColor, lastSimJsonString);
                        }
                      }
                    }
                    
                    // Remove any preparing text for this message
                    const preparingText = mesText.parentNode.querySelector(".sst-preparing-text");
                    if (preparingText) {
                      preparingText.remove();
                      mesTextsWithPreparingText.delete(mesText);
                    }
                  } else {
                    // If it's an incomplete block and we're in generation mode, show preparing text
                    if (getGenerationInProgress()) {
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
    registerMacro("sim_tracker", () => {
      if (!get_settings("isEnabled")) return "";
      log("Processed {{sim_tracker}} macro.");
      return get_settings("datingSimPrompt");
    });

    registerMacro("last_sim_stats", () => {
      if (!get_settings("isEnabled")) return "";
      log("Processed {{last_sim_stats}} macro.");
      return lastSimJsonString || "{}";
    });

    // Register the slash command for converting sim data formats
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: "sst-convert",
        callback: (args) => {
          // Check if a format parameter was provided
          const targetFormat = args && args.length > 0 ? args[0].toLowerCase() : null;
          
          // Validate format parameter
          if (targetFormat && targetFormat !== "json" && targetFormat !== "yaml") {
            return "Invalid format specified. Use 'json' or 'yaml'.";
          }
          
          let message = "This will convert all sim data in the current chat to the new format.";
          if (targetFormat) {
            message += ` All blocks will be converted to ${targetFormat.toUpperCase()} format.`;
          }
          message += " Are you sure?";
          
          if (confirm(message)) {
            // If a target format was specified, update the user's setting
            if (targetFormat) {
              set_settings("trackerFormat", targetFormat);
            }
            wrappedMigrateAllSimData();
            return "Converting sim data formats... Check notifications for results.";
          }
          return "Conversion cancelled.";
        },
        returns: "status message",
        unnamedArgumentList: [
          {
            name: "format",
            type: "string",
            description: "Target format (json or yaml). If not specified, uses current setting.",
            optional: true,
          },
        ],
        helpString: `
                <div>
                    Converts all sim data in the current chat from the old format to the new format.
                    Optionally converts all blocks to a specific format.
                </div>
                <div>
                    <strong>Examples:</strong>
                    <ul>
                        <li>
                            <pre><code class="language-stscript">/sst-convert</code></pre>
                            Converts all sim data in the current chat to the new format using current settings
                        </li>
                        <li>
                            <pre><code class="language-stscript">/sst-convert json</code></pre>
                            Converts all sim data to JSON format
                        </li>
                        <li>
                            <pre><code class="language-stscript">/sst-convert yaml</code></pre>
                            Converts all sim data to YAML format
                        </li>
                    </ul>
                </div>
            `,
      })
    );

    registerMacro("sim_format", () => {
      if (!get_settings("isEnabled")) return "";
      const fields = get_settings("customFields") || [];
      const format = get_settings("trackerFormat") || "json";
      log("Processed {{sim_format}} macro.");

      if (format === "yaml") {
        // Generate YAML example structure with the new format
        let exampleYaml = "worldData:\n";
        exampleYaml += "  current_date: \"[CURRENT_STORY_DATE]\"  # YYYY-MM-DD\n";
        exampleYaml += "  current_time: \"[CURRENT_STORY_TIME]\"  # 24-hour time (e.g., 21:34, 10:21)\n";
        exampleYaml += "characters:\n";
        exampleYaml += "  - name: \"[CHARACTER_NAME]\"\n";

        // Add each custom field as a commented key-value pair
        fields.forEach((field) => {
          const sanitizedKey = sanitizeFieldKey(field.key);
          exampleYaml += `    ${sanitizedKey}: [${sanitizedKey.toUpperCase()}_VALUE]  # ${
            field.description
          }\n`;
        });

        exampleYaml += "  # Add additional character objects here as needed\n";

        // Wrap in the code block with the identifier
        const identifier = get_settings("codeBlockIdentifier") || "sim";
        return `\`\`\`${identifier}
${exampleYaml}\`\`\``;
      } else {
        // Generate JSON example structure with the new format
        let exampleJson = "{\n";
        exampleJson += "  \"worldData\": {\n";
        exampleJson += "    \"current_date\": \"[CURRENT_STORY_DATE]\", // YYYY-MM-DD\n";
        exampleJson += "    \"current_time\": \"[CURRENT_STORY_TIME]\" // 24-hour time (e.g., 21:34, 10:21)\n";
        exampleJson += "  },\n";
        exampleJson += "  \"characters\": [\n";
        exampleJson += "    {\n";
        exampleJson += "      \"name\": \"[CHARACTER_NAME]\",\n";

        // Add each custom field as a commented key-value pair
        fields.forEach((field) => {
          const sanitizedKey = sanitizeFieldKey(field.key);
          exampleJson += `      "${sanitizedKey}": [${sanitizedKey.toUpperCase()}_VALUE], // ${
            field.description
          }\n`;
        });

        exampleJson += "    }\n";
        exampleJson += "    // Add additional character objects here as needed\n";
        exampleJson += "  ]\n";
        exampleJson += "}";

        // Wrap in the code block with the identifier
        const identifier = get_settings("codeBlockIdentifier") || "sim";
        return `\`\`\`${identifier}
${exampleJson}
\`\`\``;
      }
    });

    // Register a new macro for positionable tracker replacement
    registerMacro("sim_tracker_positioned", () => {
      if (!get_settings("isEnabled")) return "";
      log("Processed {{sim_tracker_positioned}} macro.");

      // This macro is used for template positioning, but the position is now defined in the template itself
      // We'll return an empty string as the position is handled during rendering
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

            // Append the sim block to the message in the user's preferred format
            const format = get_settings("trackerFormat") || "json";
            let simBlock;
            
            if (format === "yaml") {
              // Create a basic YAML structure
              simBlock = `
\`\`\`${identifier}
worldData:
  current_date: ""
  current_time: ""
characters:
  - name: ""
    ap: 0
    dp: 0
    tp: 0
    cp: 0
\`\`\``;
            } else {
              // Create a basic JSON structure
              simBlock = `
\`\`\`${identifier}
{
  "worldData": {
    "current_date": "",
    "current_time": ""
  },
  "characters": [
    {
      "name": "",
      "ap": 0,
      "dp": 0,
      "tp": 0,
      "cp": 0
    }
  ]
}
\`\`\``;
            }
            
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

    const { eventSource, event_types } = context;

    // Set generation in progress flag when generation starts
    eventSource.on(event_types.GENERATION_STARTED, () => {
      setGenerationInProgress(true);
    });

    // Also set generation in progress flag for after commands event
    eventSource.on(event_types.GENERATION_AFTER_COMMANDS, () => {
      setGenerationInProgress(true);
    });

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (mesId) => {
      // Clear generation in progress flag when message is rendered
      setGenerationInProgress(false);
      // The MutationObserver will handle rendering when it detects complete sim blocks
      // We don't need to trigger rendering directly here anymore
    });
    
    eventSource.on(event_types.CHAT_CHANGED, wrappedRefreshAllCards);
    eventSource.on(event_types.MORE_MESSAGES_LOADED, wrappedRefreshAllCards);
    eventSource.on(event_types.MESSAGE_UPDATED, wrappedRefreshAllCards);
    
    eventSource.on(event_types.MESSAGE_EDITED, (mesId) => {
      log(`Message ${mesId} was edited.`);
      // The MutationObserver will handle re-rendering when it detects the updated content
    });
    
    eventSource.on(event_types.MESSAGE_SWIPE, (mesId) => {
      log(
        `Message swipe detected for message ID ${mesId}. Updating last_sim_stats macro.`
      );
      const updatedStats = updateLastSimStatsOnRegenerateOrSwipe(mesId, get_settings);
      if (updatedStats) {
        lastSimJsonString = updatedStats;
      }
      // The MutationObserver will handle re-rendering when it detects the updated content
    });

    // Listen for generation ended event to update sidebars
    eventSource.on(event_types.GENERATION_ENDED, () => {
      log("Generation ended, updating sidebars if needed");
      setGenerationInProgress(false);

      // Update left sidebar if there's pending content
      if (pendingLeftSidebarContent) {
        updateLeftSidebar(pendingLeftSidebarContent);
        // Note: pendingLeftSidebarContent is managed within renderer module
      }

      // Update right sidebar if there's pending content
      if (pendingRightSidebarContent) {
        updateRightSidebar(pendingRightSidebarContent);
        // Note: pendingRightSidebarContent is managed within renderer module
      }

      // Clear any remaining preparing text when generation ends
      document.querySelectorAll(".sst-preparing-text").forEach((element) => {
        const mesText = element.previousElementSibling;
        if (mesText && mesText.classList.contains("mes_text")) {
          mesTextsWithPreparingText.delete(mesText);
        }
        element.remove();
      });
    });

    wrappedRefreshAllCards();
    log(`${MODULE_NAME} has been successfully loaded.`);
  } catch (error) {
    console.error(
      `[${MODULE_NAME}] A critical error occurred during initialization. The extension may not work correctly. Error: ${error.stack}`
    );
  }
});
