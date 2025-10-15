import { getContext, extension_settings } from "../../../extensions.js";
import {
  saveSettingsDebounced,
  messageFormatting,
  Generate,
} from "../../../../script.js";
import { MacrosParser } from "../../../macros.js";
import { SlashCommand } from "../../../slash-commands/SlashCommand.js";
import { SlashCommandParser } from "../../../slash-commands/SlashCommandParser.js";

// Import from our new modules
import {
  renderTracker,
  renderTrackerWithoutSim,
  refreshAllCards,
  updateLeftSidebar,
  updateRightSidebar,
  removeGlobalSidebars,
  attachTabEventListeners,
  isGenerationInProgress,
  pendingLeftSidebarContent,
  pendingRightSidebarContent,
  getPendingLeftSidebarContent,
  getPendingRightSidebarContent,
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
  extractTemplatePosition,
  currentTemplatePosition
} from "./templating.js";

import {
  get_settings,
  set_settings,
  initialize_settings,
  initialize_settings_listeners,
  load_settings_html_manually,
  refresh_settings_ui,
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
  migrateAllSimData
} from "./utils.js";

import {
  parseTrackerData,
  generateTrackerBlock
} from "./formatUtils.js";

import {
  generateTrackerWithSecondaryLLM
} from "./secondaryLLM.js";

const MODULE_NAME = "silly-sim-tracker";

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
    const wrappedRefreshAllCards = () => refreshAllCards(get_settings, CONTAINER_ID, 
      (mesId) => renderTrackerWithoutSim(mesId, get_settings, compiledWrapperTemplate, compiledCardTemplate, getReactionEmoji, darkenColor, lastSimJsonString));
    const wrappedMigrateAllSimData = () => migrateAllSimData(get_settings);
    const wrappedHandleCustomTemplateUpload = (event) => handleCustomTemplateUpload(event, set_settings, wrappedLoadTemplate, wrappedRefreshAllCards);
    const wrappedHandlePresetExport = () => handlePresetExport(wrappedLoadTemplate, wrappedRefreshAllCards);
    const wrappedHandlePresetImport = (event) => handlePresetImport(event, wrappedLoadTemplate, wrappedRefreshAllCards);
    const wrappedShowManagePresetsModal = () => showManagePresetsModal(wrappedLoadTemplate, wrappedRefreshAllCards);
    
    initialize_settings_listeners(wrappedLoadTemplate, wrappedRefreshAllCards, wrappedMigrateAllSimData, wrappedHandleCustomTemplateUpload, wrappedHandlePresetExport, wrappedHandlePresetImport, wrappedShowManagePresetsModal, setGenerationInProgress);
    log("Settings panel listeners initialized.");
    
    // Wait for SillyTavern's debounced settings to be fully applied
    // Then refresh the UI to populate it with saved values
    await new Promise(resolve => setTimeout(resolve, 100));
    refresh_settings_ui();
    log("Settings UI refreshed with saved values.");
    
    await wrappedLoadTemplate();

    // Set up MutationObserver to hide sim code blocks (both during streaming and in history)
    log("Setting up MutationObserver for sim block hiding...");
    
    const hideSimBlocks = () => {
      if (!get_settings("isEnabled") || !get_settings("hideSimBlocks")) return;
      
      const identifier = get_settings("codeBlockIdentifier");
      
      // Find all code elements with the sim class pattern
      const simCodeElements = document.querySelectorAll(`#chat code[class*="${identifier}"]`);
      
      simCodeElements.forEach((codeElement) => {
        // Find the parent pre element
        const pre = codeElement.closest("pre");
        if (pre && pre.style.display !== "none") {
          log(`Hiding sim code block (class-based detection)`);
          pre.style.display = "none";
        }
      });
    };
    
    const observer = new MutationObserver((mutations) => {
      if (!get_settings("isEnabled") || !get_settings("hideSimBlocks")) return;

      const identifier = get_settings("codeBlockIdentifier");
      const isGenerating = getGenerationInProgress();
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          
          // Check if this node is or contains a code element with sim class
          let codeElements = [];
          if (node.tagName === "CODE" && node.className.includes(identifier)) {
            codeElements = [node];
          } else {
            codeElements = Array.from(node.querySelectorAll(`code[class*="${identifier}"]`));
          }
          
          codeElements.forEach((codeElement) => {
            const pre = codeElement.closest("pre");
            if (!pre) return;
            
            // Hide the pre element
            if (pre.style.display !== "none") {
              log(`Hiding sim code block`);
              pre.style.display = "none";
            }
            
            // Only show "Preparing" text if we're actively generating
            if (isGenerating) {
              const mesText = pre.closest(".mes_text");
              if (mesText && !mesTextsWithPreparingText.has(mesText)) {
                // Check if this message already has tracker cards
                const parentMes = mesText.closest(".mes");
                const hasTrackerCards = parentMes && parentMes.querySelector(`#${CONTAINER_ID}`);
                
                // Only show preparing text for messages without tracker cards (actively streaming)
                if (!hasTrackerCards) {
                  mesTextsWithPreparingText.add(mesText);
                  
                  const preparingText = document.createElement("div");
                  preparingText.className = "sst-preparing-text";
                  preparingText.textContent = "Preparing new tracker cards...";
                  preparingText.style.cssText = `
                    color: #4a3a9d;
                    font-style: italic;
                    margin: 10px 0;
                    animation: sst-pulse 1.5s infinite;
                  `;
                  
                  mesText.parentNode.insertBefore(
                    preparingText,
                    mesText.nextSibling
                  );
                  
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
          });
        });
      });
      
      // Also run a sweep to catch any that might have been missed
      hideSimBlocks();
    });

    // Start observing the chat area
    const chatElement = document.getElementById("chat");
    if (chatElement) {
      observer.observe(chatElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
      
      // Initial sweep to hide any existing sim blocks
      hideSimBlocks();
    } else {
      // Fallback to body if chat element not found yet
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
    }

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

    MacrosParser.registerMacro("sim_format", () => {
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

    const context = getContext();
    const { eventSource, event_types } = context;

    // Set generation in progress flag when generation starts
    eventSource.on(event_types.GENERATION_STARTED, () => {
      setGenerationInProgress(true);
    });

    // Also set generation in progress flag for after commands event
    eventSource.on(event_types.GENERATION_AFTER_COMMANDS, () => {
      setGenerationInProgress(true);
    });

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, async (mesId) => {
      // Clear generation in progress flag when message is rendered
      setGenerationInProgress(false);
      
      // Check if we should use secondary LLM generation
      const useSecondaryLLM = get_settings("useSecondaryLLM");
      const context = getContext();
      const message = context.chat[mesId];
      
      if (useSecondaryLLM && message && !message.is_user && !message.is_system) {
        // Check if the message already has a sim block
        const identifier = get_settings("codeBlockIdentifier");
        const simRegex = new RegExp("```" + identifier + "[\\s\\S]*?```", "m");
        const hasSimBlock = simRegex.test(message.mes);
        
        if (!hasSimBlock) {
          log("Message doesn't have sim block, attempting secondary LLM generation...");
          
          try {
            // Generate tracker block with secondary LLM
            const generatedBlock = await generateTrackerWithSecondaryLLM(get_settings);
            
            if (generatedBlock) {
              // Extract just the code block from the response
              const blockMatch = generatedBlock.match(new RegExp("```" + identifier + "[\\s\\S]*?```", "m"));
              
              if (blockMatch) {
                log("Successfully generated tracker block with secondary LLM");
                
                // Append the tracker block to the message
                message.mes += "\n\n" + blockMatch[0];
                
                // Update lastSimJsonString for the macro
                const content = blockMatch[0]
                  .replace(/```/g, "")
                  .replace(new RegExp(`^${identifier}\\s*`), "")
                  .trim();
                lastSimJsonString = content;
                
                // Save the updated chat
                await context.saveChat();
                
                // Update the message in the UI
                const messageElement = document.querySelector(
                  `div[mesid="${mesId}"] .mes_text`
                );
                if (messageElement) {
                  messageElement.innerHTML = messageFormatting(
                    message.mes,
                    message.name,
                    message.is_system,
                    message.is_user,
                    mesId
                  );
                }
                
                log("Updated message with secondary LLM generated tracker block");
              } else {
                log("Generated block doesn't contain proper code fence");
              }
            }
          } catch (error) {
            console.error(`[SST] [${MODULE_NAME}]`, "Error in secondary LLM generation:", error);
          }
        }
      }
      
      // Render the tracker (whether it was already there or just added)
      renderTracker(mesId, get_settings, compiledWrapperTemplate, compiledCardTemplate, getReactionEmoji, darkenColor, lastSimJsonString);
    });
    
    eventSource.on(event_types.CHAT_CHANGED, () => {
      log("Chat changed, refreshing all cards and updating sidebars");
      // Clear generation flag since we're switching chats
      setGenerationInProgress(false);
      // Just refresh all cards - this will update sidebars with new chat data
      // The refreshAllCards function will find the latest sim data in the new chat
      wrappedRefreshAllCards();
    });
    eventSource.on(event_types.MORE_MESSAGES_LOADED, wrappedRefreshAllCards);
    eventSource.on(event_types.MESSAGE_UPDATED, wrappedRefreshAllCards);
    
    eventSource.on(event_types.MESSAGE_EDITED, (mesId) => {
      log(`Message ${mesId} was edited. Re-rendering tracker card.`);
      renderTrackerWithoutSim(mesId, get_settings, compiledWrapperTemplate, compiledCardTemplate, getReactionEmoji, darkenColor, lastSimJsonString);
    });
    
    eventSource.on(event_types.MESSAGE_SWIPE, (mesId) => {
      log(
        `Message swipe detected for message ID ${mesId}. Updating last_sim_stats macro.`
      );
      const updatedStats = updateLastSimStatsOnRegenerateOrSwipe(mesId, get_settings);
      if (updatedStats) {
        lastSimJsonString = updatedStats;
      }
    });

    // Listen for generation ended event to update sidebars
    eventSource.on(event_types.GENERATION_ENDED, () => {
      log("Generation ended, updating sidebars if needed");
      setGenerationInProgress(false);

      // Update left sidebar if there's pending content
      const leftContent = getPendingLeftSidebarContent();
      if (leftContent) {
        log("Applying pending left sidebar content after generation ended");
        updateLeftSidebar(leftContent);
        // Re-attach event listeners after updating
        const leftSidebarElement = document.querySelector("#sst-sidebar-left-content");
        if (leftSidebarElement) {
          attachTabEventListeners(leftSidebarElement);
        }
      }

      // Update right sidebar if there's pending content
      const rightContent = getPendingRightSidebarContent();
      if (rightContent) {
        log("Applying pending right sidebar content after generation ended");
        updateRightSidebar(rightContent);
        // Re-attach event listeners after updating
        const rightSidebarElement = document.querySelector("#sst-sidebar-right-content");
        if (rightSidebarElement) {
          attachTabEventListeners(rightSidebarElement);
        }
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
