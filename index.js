import { getContext, extension_settings } from "../../../extensions.js";
import {
  saveSettingsDebounced,
  messageFormatting,
  Generate,
} from "../../../../script.js";
import { MacrosParser } from "../../../macros.js";
import { SlashCommand } from "../../../slash-commands/SlashCommand.js";
import { SlashCommandParser } from "../../../slash-commands/SlashCommandParser.js";

// Import helper utilities
import {
  queryAll,
  query,
  createElement,
  escapeHtml
} from "./helpers.js";

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
      const simCodeElements = queryAll(`#chat code[class*="${identifier}"]`);
      
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
            codeElements = Array.from(queryAll(`code[class*="${identifier}"]`, node));
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
                
                // Get the message ID to check if this is the actively generating message
                const mesId = parentMes ? parentMes.getAttribute("mesid") : null;
                const isLastMessage = mesId !== null && lastRenderedMessageId !== null && parseInt(mesId) === lastRenderedMessageId;
                
                // Only show preparing text for the actively generating message without tracker cards
                if (!hasTrackerCards && isLastMessage) {
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

    // Register the slash command for force-regenerating tracker blocks
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: "sst-regen",
        callback: async () => {
          if (!get_settings("isEnabled")) {
            return "Silly Sim Tracker is not enabled.";
          }

          const useSecondaryLLM = get_settings("useSecondaryLLM");
          if (!useSecondaryLLM) {
            return "Secondary LLM generation is not enabled. Please enable it in settings.";
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
            const identifier = get_settings("codeBlockIdentifier");

            // Remove existing sim block if present
            const simRegex = new RegExp("```" + identifier + "[\\s\\S]*?```", "gm");
            lastCharMessage.mes = lastCharMessage.mes.replace(simRegex, "").trim();

            // Update the message UI to show it's being regenerated
            const messageElement = query(
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
              
              // Add visual feedback that generation is in progress
              const preparingText = document.createElement("div");
              preparingText.className = "sst-preparing-text sst-regen-preparing";
              preparingText.textContent = "Regenerating tracker data...";
              preparingText.style.cssText = `
                color: #4a3a9d;
                font-style: italic;
                margin: 10px 0;
                animation: sst-pulse 1.5s infinite;
              `;
              messageElement.parentNode.insertBefore(
                preparingText,
                messageElement.nextSibling
              );
            }

            log("Force-regenerating tracker block for last character message...");
            
            // Generate tracker block with secondary LLM
            const generatedContent = await generateTrackerWithSecondaryLLM(get_settings);
            
            if (generatedContent) {
              log("Successfully generated tracker content with secondary LLM");
              
              // Clean up the response - remove any markdown code fences if present
              let cleanedContent = generatedContent.trim();
              
              // Remove code fences if the LLM added them anyway
              cleanedContent = cleanedContent.replace(/^```(?:json|yaml)?\s*\n?/i, "");
              cleanedContent = cleanedContent.replace(/\n?```\s*$/i, "");
              cleanedContent = cleanedContent.trim();
              
              // Wrap the content in our code block
              const wrappedBlock = `\`\`\`${identifier}\n${cleanedContent}\n\`\`\``;
              
              // Append the tracker block to the message
              lastCharMessage.mes += "\n\n" + wrappedBlock;
              
              // Update lastSimJsonString for the macro
              lastSimJsonString = cleanedContent;
              
              // Save the updated chat
              await context.saveChat();
              
              // Update the message in the UI
              const messageElement = query(
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
              
              log("Updated message with force-regenerated tracker block");
              
              // Remove the preparing text
              const preparingTextElement = query(".sst-regen-preparing");
              if (preparingTextElement) {
                preparingTextElement.remove();
              }
              
              // Re-render the tracker with the new sim block
              renderTrackerWithoutSim(lastCharMessageIndex, get_settings, compiledWrapperTemplate, compiledCardTemplate, getReactionEmoji, darkenColor, lastSimJsonString);
              
              return "Successfully regenerated tracker block for last character message.";
            } else {
              // Remove the preparing text even on failure
              const preparingTextElement = query(".sst-regen-preparing");
              if (preparingTextElement) {
                preparingTextElement.remove();
              }
              return "Failed to generate tracker content. Check console for errors.";
            }
          } catch (error) {
            log(`Error in /sst-regen command: ${error.message}`);
            // Remove the preparing text on error
            const preparingTextElement = query(".sst-regen-preparing");
            if (preparingTextElement) {
              preparingTextElement.remove();
            }
            return `Error: ${error.message}`;
          }
        },
        returns: "status message",
        unnamedArgumentList: [],
        helpString: `
                <div>
                    Force-regenerates the tracker block for the last character message using the secondary LLM.
                    This is useful if the response is invalid or blank.
                </div>
                <div>
                    <strong>Example:</strong>
                    <ul>
                        <li>
                            <pre><code class="language-stscript">/sst-regen</code></pre>
                            Regenerates the tracker block for the last character message
                        </li>
                    </ul>
                </div>
            `,
      })
    );

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
            const messageElement = query(
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

    // Track the last rendered message ID for secondary LLM generation
    let lastRenderedMessageId = null;

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, async (mesId) => {
      // Store the last rendered message ID
      lastRenderedMessageId = mesId;
      
      // Render the tracker (this will use existing sim block if present)
      renderTracker(mesId, get_settings, compiledWrapperTemplate, compiledCardTemplate, getReactionEmoji, darkenColor, lastSimJsonString);
      
      // For sidebar templates, ensure they render even on first message
      // by forcing a re-render after a short delay if this is a positioned template
      const templatePosition = currentTemplatePosition;
      if (templatePosition === "LEFT" || templatePosition === "RIGHT") {
        setTimeout(() => {
          // Re-render to ensure sidebars are created if they weren't during initial render
          log(`Re-rendering message ${mesId} to ensure sidebar creation`);
          renderTrackerWithoutSim(mesId, get_settings, compiledWrapperTemplate, compiledCardTemplate, getReactionEmoji, darkenColor, lastSimJsonString);
        }, 150);
      }
    });
    
    // Helper function to wrap sim blocks in all messages with hidden divs
    const wrapSimBlocksInChat = () => {
      if (!get_settings("isEnabled") || !get_settings("hideSimBlocks")) return;
      
      const context = getContext();
      const chat = context.chat;
      
      if (!chat || !Array.isArray(chat)) return;
      
      const identifier = get_settings("codeBlockIdentifier");
      let modifiedCount = 0;
      
      chat.forEach((message, index) => {
        if (!message || !message.mes) return;
        
        // Check if message contains unwrapped sim blocks
        const unwrappedRegex = new RegExp(`(?<!<div style="display: none;">)\`\`\`${identifier}[\\s\\S]*?\`\`\`(?!</div>)`, 'g');
        
        if (unwrappedRegex.test(message.mes)) {
          // Wrap any unwrapped sim blocks
          const wrapRegex = new RegExp(`\`\`\`${identifier}[\\s\\S]*?\`\`\``, 'g');
          message.mes = message.mes.replace(wrapRegex, (match) => {
            // Check if this specific match is already wrapped
            const beforeMatch = message.mes.substring(0, message.mes.indexOf(match));
            const afterMatch = message.mes.substring(message.mes.indexOf(match) + match.length);
            
            if (beforeMatch.endsWith('<div style="display: none;">') && afterMatch.startsWith('</div>')) {
              // Already wrapped, return as-is
              return match;
            }
            
            // Not wrapped, wrap it
            modifiedCount++;
            return `<div style="display: none;">${match}</div>`;
          });
        }
      });
      
      if (modifiedCount > 0) {
        log(`Wrapped ${modifiedCount} sim blocks in chat messages with hidden divs`);
        // Save the chat after wrapping
        context.saveChat();
      }
    };
    
    eventSource.on(event_types.CHAT_CHANGED, () => {
      log("Chat changed, refreshing all cards and updating sidebars");
      // Clear generation flag since we're switching chats
      setGenerationInProgress(false);
      
      // Wrap sim blocks in the new chat
      wrapSimBlocksInChat();
      
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
        `Message swipe detected for message ID ${mesId}. Updating last_sim_stats macro and re-rendering tracker.`
      );
      const updatedStats = updateLastSimStatsOnRegenerateOrSwipe(mesId, get_settings);
      if (updatedStats) {
        lastSimJsonString = updatedStats;
      }
      // Re-render the tracker for the swiped message (same as MESSAGE_EDITED)
      renderTrackerWithoutSim(mesId, get_settings, compiledWrapperTemplate, compiledCardTemplate, getReactionEmoji, darkenColor, lastSimJsonString);
    });

    // Listen for generation ended event to update sidebars and trigger secondary LLM
    eventSource.on(event_types.GENERATION_ENDED, async () => {
      log("Generation ended, updating sidebars if needed");
      setGenerationInProgress(false);

      // Check if we should use secondary LLM generation
      const useSecondaryLLM = get_settings("useSecondaryLLM");
      const context = getContext();
      
      // Only proceed if we have a valid message ID from the last render
      if (useSecondaryLLM && lastRenderedMessageId !== null) {
        const mesId = lastRenderedMessageId;
        const message = context.chat[mesId];
        
        // Only proceed if we have a valid character message with actual content
        if (message && !message.is_user && !message.is_system && message.mes && message.mes.trim().length > 0) {
          // Check if the message already has a sim block
          const identifier = get_settings("codeBlockIdentifier");
          const simRegex = new RegExp("```" + identifier + "[\\s\\S]*?```", "m");
          const hasSimBlock = simRegex.test(message.mes);
          
          if (!hasSimBlock) {
            log("Generation complete. Message doesn't have sim block, attempting secondary LLM generation...");
            
            try {
              // Generate tracker block with secondary LLM
              const generatedContent = await generateTrackerWithSecondaryLLM(get_settings);
              
              if (generatedContent) {
                log("Successfully generated tracker content with secondary LLM");
                
                // Clean up the response - remove any markdown code fences if present
                let cleanedContent = generatedContent.trim();
                
                // Remove code fences if the LLM added them anyway
                cleanedContent = cleanedContent.replace(/^```(?:json|yaml)?\s*\n?/i, "");
                cleanedContent = cleanedContent.replace(/\n?```\s*$/i, "");
                cleanedContent = cleanedContent.trim();
                
                // Wrap the content in our code block
                const wrappedBlock = `\`\`\`${identifier}\n${cleanedContent}\n\`\`\``;
                
                // Append the tracker block to the message
                message.mes += "\n\n" + wrappedBlock;
                
                // Update lastSimJsonString for the macro
                lastSimJsonString = cleanedContent;
                
                // Save the updated chat
                await context.saveChat();
                
                // Update the message in the UI
                const messageElement = query(
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
                
                // Re-render the tracker with the new sim block using renderTrackerWithoutSim
                // This ensures proper state synchronization for sidebars
                renderTrackerWithoutSim(mesId, get_settings, compiledWrapperTemplate, compiledCardTemplate, getReactionEmoji, darkenColor, lastSimJsonString);
              }
            } catch (error) {
              console.error(`[SST] [${MODULE_NAME}]`, "Error in secondary LLM generation:", error);
            }
          }
        }
        
        // Reset the last rendered message ID
        lastRenderedMessageId = null;
      }

      // Update left sidebar if there's pending content
      const leftContent = getPendingLeftSidebarContent();
      if (leftContent) {
        log("Applying pending left sidebar content after generation ended");
        updateLeftSidebar(leftContent);
        // Re-attach event listeners after updating
        const leftSidebarElement = query("#sst-sidebar-left-content");
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
        const rightSidebarElement = query("#sst-sidebar-right-content");
        if (rightSidebarElement) {
          attachTabEventListeners(rightSidebarElement);
        }
      }

      // Clear any remaining preparing text when generation ends
      queryAll(".sst-preparing-text").forEach((element) => {
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
