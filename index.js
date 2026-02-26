import { getContext, extension_settings } from "../../../extensions.js";
import {
  saveSettingsDebounced,
  messageFormatting,
  Generate,
} from "../../../../script.js";
import { MacrosParser } from "../../../macros.js";
import { SlashCommand } from "../../../slash-commands/SlashCommand.js";
import { SlashCommandParser } from "../../../slash-commands/SlashCommandParser.js";
import { SlashCommandArgument, ARGUMENT_TYPE } from "../../../slash-commands/SlashCommandArgument.js";

// Import helper utilities
import {
  queryAll,
  query,
  createElement,
  escapeHtml,
  getDistanceToViewport,
  getDistanceBetween,
  logElementMeasurements
} from "./helpers.js";

import {
  getChatContainer,
  getMessageContent,
  closestMessageContent,
  closestMessageWrapper,
  getMessageIdFromElement,
  findCodeBlocksByIdentifier,
} from "./domBridge.js";

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
  initializeViewportChangeHandler,
  forceLayoutUpdate,
  flushPendingSidebarUpdates,
  CONTAINER_ID
} from "./renderer.js";

import {
  compiledWrapperTemplate,
  compiledCardTemplate,
  populateTemplateDropdown,
  handleCustomTemplateUpload,
  loadTemplate,
  extractTemplatePosition,
  currentTemplatePosition,
  getCurrentTemplateConfig
} from "./templating.js";

import {
  processInlineTemplates,
  processAllInlineTemplates,
  setupInlineTemplateObserver,
  clearInlineTemplateCache
} from "./inlineTemplates.js";

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
  generateTrackerWithSecondaryLLM
} from "./secondaryLLM.js";

const MODULE_NAME = "silly-sim-tracker";

let lastSimJsonString = "";

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

  // Clone the chat array to make ephemeral modifications for LLM context
  // Use structuredClone to deep copy message objects so we don't affect the actual chat history
  const clonedChat = chat.map(msg => structuredClone(msg));

  // Clean up excess sim blocks from chat history
  // This ensures we don't clutter the context with old tracker data
  // Only keep the most recent N blocks as configured
  const retainCount = parseInt(get_settings("retainTrackerCount")) || 3;
  const knownIdentifiers = get_settings("knownIdentifiers") || ["sim"];
  
  // Also include the current identifier if it's not in the list
  const currentIdentifier = get_settings("codeBlockIdentifier");
  if (currentIdentifier && !knownIdentifiers.includes(currentIdentifier)) {
    knownIdentifiers.push(currentIdentifier);
  }

  // Find the cutoff point (Nth last assistant message) based on retainTrackerCount
  let cutoffIndex = 0;
  let assistantCount = 0;
  
  // Scan backwards to find the Nth assistant message
  for (let i = clonedChat.length - 1; i >= 0; i--) {
    const msg = clonedChat[i];
    if (!msg.mes) continue;
    
    // Only count assistant messages
    if (!msg.is_user && !msg.is_system) {
      assistantCount++;
      if (assistantCount >= retainCount) {
        cutoffIndex = i;
        break;
      }
    }
  }
  
  // If we found enough assistant messages, strip trackers from all messages older than the cutoff
  // If we didn't reach the limit (cutoffIndex is 0), we don't need to clean anything before it
  if (cutoffIndex > 0) {
    log(`Cleaning up tracker blocks older than message ${cutoffIndex} (retaining last ${retainCount} assistant messages)`);
    
    // Iterate through all messages older than the cutoff
    for (let i = 0; i < cutoffIndex; i++) {
      const msg = clonedChat[i];
      if (!msg.mes) continue;
      
      let content = msg.mes;
      let modified = false;
      
      // Remove all known tracker blocks from this message
      knownIdentifiers.forEach(id => {
        // Regex to match code blocks with this identifier
        const regex = new RegExp("```" + id + "[\\s\\S]*?```", "g");
        
        if (regex.test(content)) {
          content = content.replace(regex, "");
          modified = true;
        }
        
        // Also clean up any wrapper divs if present (for hidden blocks)
        // We handle this by checking for the div wrapper pattern that might remain
        const divRegex = /<div style="display: none;">\s*\n?\s*<\/div>/g;
        if (divRegex.test(content)) {
            content = content.replace(divRegex, "");
            modified = true;
        }
      });
      
      if (modified) {
        // Clean up empty lines that might be left
        content = content.replace(/\n\s*\n\s*\n/g, "\n\n").trim();
        clonedChat[i].mes = content;
      }
    }
  }

  // Filter out sim blocks from messages beyond the configured maximum (for Max Sim Blocks setting)
  // This is a separate setting from Retain N Trackers - Max Sim Blocks is specifically for prompt engineering
  // whereas Retain N Trackers is for context management
  // However, since we just removed old trackers, filterSimBlocksInPrompt will have less work to do
  filterSimBlocksInPrompt(clonedChat, get_settings);

  // Return the modified clone - SillyTavern will use this for prompt building
  // The original chat array remains unchanged in the chat history
  return { chat: clonedChat, contextSize, abort };
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

    // Initialize viewport change detection for dynamic layout updates
    log("Initializing viewport change detection...");
    initializeViewportChangeHandler(get_settings);

    // Set up MutationObserver to hide sim code blocks (both during streaming and in history)
    log("Setting up MutationObserver for sim block hiding...");
    
    const hideSimBlocks = () => {
      if (!get_settings("isEnabled") || !get_settings("hideSimBlocks")) return;

      const identifier = get_settings("codeBlockIdentifier");

      // Find all code elements with the sim class pattern (supports both ST and Lumiverse)
      const simCodeElements = findCodeBlocksByIdentifier(identifier);

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
              const mesText = closestMessageContent(pre);
              if (mesText && !mesTextsWithPreparingText.has(mesText)) {
                // Check if this message already has tracker cards
                const parentMes = closestMessageWrapper(pre);
                const hasTrackerCards = parentMes && parentMes.querySelector(`#${CONTAINER_ID}`);

                // Get the message ID to check if this is the actively generating message
                const mesId = parentMes ? getMessageIdFromElement(parentMes) : null;
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

    // Start observing the chat area (supports both ST and Lumiverse DOM)
    const chatElement = getChatContainer();
    const observerTarget = chatElement || document.body;
    observer.observe(observerTarget, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });

    if (chatElement) {
      // Initial sweep to hide any existing sim blocks
      hideSimBlocks();
    }

    log(`MutationObserver set up for in-flight sim block hiding (target: ${chatElement ? chatElement.id : 'body'}).`);

    // Set up inline templates MutationObserver
    log("Setting up inline templates observer...");
    const inlineTemplatesObserver = setupInlineTemplateObserver(get_settings, getCurrentTemplateConfig);

    inlineTemplatesObserver.observe(observerTarget, {
      childList: true,
      subtree: true,
      characterData: true
    });
    log(`Inline templates observer started (target: ${chatElement ? chatElement.id : 'body'})`);

    log("Registering macros...");

    // Helper function to generate sim_format content (used by both macros and for nested macro replacement)
    const generateSimFormatContent = () => {
      const fields = get_settings("customFields") || [];
      const format = get_settings("trackerFormat") || "json";
      const identifier = get_settings("codeBlockIdentifier") || "sim";

      // Helper to generate default value for a type
      const getDefaultValue = (type) => {
        switch (type) {
          case "number": return "0";
          case "boolean": return "false";
          case "string":
          default: return "\"[VALUE]\"";
        }
      };

      // Helper to generate YAML array field example
      const generateYamlArrayField = (field) => {
        const sanitizedKey = sanitizeFieldKey(field.key);
        let output = `    ${sanitizedKey}:  # ${field.description}\n`;

        if (field.itemSchema === "string") {
          // Simple string array
          output += `      - "[${sanitizedKey.toUpperCase()}_ITEM_1]"\n`;
          output += `      - "[${sanitizedKey.toUpperCase()}_ITEM_2]"\n`;
        } else if (Array.isArray(field.itemSchema) && field.itemSchema.length > 0) {
          // Object array
          output += `      - `;
          field.itemSchema.forEach((prop, idx) => {
            const propKey = sanitizeFieldKey(prop.key);
            const propValue = prop.type === "number" ? "0" : (prop.type === "boolean" ? "false" : `"[${propKey.toUpperCase()}]"`);
            if (idx === 0) {
              output += `${propKey}: ${propValue}`;
              if (prop.description) output += `  # ${prop.description}`;
              output += "\n";
            } else {
              output += `        ${propKey}: ${propValue}`;
              if (prop.description) output += `  # ${prop.description}`;
              output += "\n";
            }
          });
        }
        return output;
      };

      // Helper to generate JSON array field example
      const generateJsonArrayField = (field) => {
        const sanitizedKey = sanitizeFieldKey(field.key);
        let output = `      "${sanitizedKey}": `;

        if (field.itemSchema === "string") {
          // Simple string array
          output += `["[${sanitizedKey.toUpperCase()}_ITEM_1]", "[${sanitizedKey.toUpperCase()}_ITEM_2]"], // ${field.description}\n`;
        } else if (Array.isArray(field.itemSchema) && field.itemSchema.length > 0) {
          // Object array
          output += `[\n        {\n`;
          field.itemSchema.forEach((prop, idx) => {
            const propKey = sanitizeFieldKey(prop.key);
            const propValue = prop.type === "number" ? "0" : (prop.type === "boolean" ? "false" : `"[${propKey.toUpperCase()}]"`);
            const comma = idx < field.itemSchema.length - 1 ? "," : "";
            const comment = prop.description ? ` // ${prop.description}` : "";
            output += `          "${propKey}": ${propValue}${comma}${comment}\n`;
          });
          output += `        }\n      ], // ${field.description}\n`;
        } else {
          // Empty or undefined schema, just show empty array
          output += `[], // ${field.description}\n`;
        }
        return output;
      };

      if (format === "yaml") {
        let exampleYaml = "worldData:\n";
        exampleYaml += "  current_date: \"[CURRENT_STORY_DATE]\"  # YYYY-MM-DD\n";
        exampleYaml += "  current_time: \"[CURRENT_STORY_TIME]\"  # 24-hour time (e.g., 21:34, 10:21)\n";
        exampleYaml += "characters:\n";
        exampleYaml += "  - name: \"[CHARACTER_NAME]\"\n";

        fields.forEach((field) => {
          const sanitizedKey = sanitizeFieldKey(field.key);
          if (field.type === "array") {
            exampleYaml += generateYamlArrayField(field);
          } else {
            exampleYaml += `    ${sanitizedKey}: [${sanitizedKey.toUpperCase()}_VALUE]  # ${field.description}\n`;
          }
        });

        exampleYaml += "  # Add additional character objects here as needed\n";
        return `\`\`\`${identifier}\n${exampleYaml}\`\`\``;
      } else {
        let exampleJson = "{\n";
        exampleJson += "  \"worldData\": {\n";
        exampleJson += "    \"current_date\": \"[CURRENT_STORY_DATE]\", // YYYY-MM-DD\n";
        exampleJson += "    \"current_time\": \"[CURRENT_STORY_TIME]\" // 24-hour time (e.g., 21:34, 10:21)\n";
        exampleJson += "  },\n";
        exampleJson += "  \"characters\": [\n";
        exampleJson += "    {\n";
        exampleJson += "      \"name\": \"[CHARACTER_NAME]\",\n";

        fields.forEach((field) => {
          const sanitizedKey = sanitizeFieldKey(field.key);
          if (field.type === "array") {
            exampleJson += generateJsonArrayField(field);
          } else {
            exampleJson += `      "${sanitizedKey}": [${sanitizedKey.toUpperCase()}_VALUE], // ${field.description}\n`;
          }
        });

        exampleJson += "    }\n";
        exampleJson += "    // Add additional character objects here as needed\n";
        exampleJson += "  ]\n";
        exampleJson += "}";
        return `\`\`\`${identifier}\n${exampleJson}\n\`\`\``;
      }
    };

    MacrosParser.registerMacro("sim_tracker", () => {
      if (!get_settings("isEnabled")) return "";
      log("Processed {{sim_tracker}} macro.");

      let output = get_settings("datingSimPrompt");

      // Replace nested {{sim_format}} macro since SillyTavern can't handle nested macros
      if (output && output.includes("{{sim_format}}")) {
        const simFormatContent = generateSimFormatContent();
        output = output.replace(/\{\{sim_format\}\}/g, simFormatContent);
        log("Replaced nested {{sim_format}} macro with dynamic content");
      }
      
      // If inline templates are enabled, merge the {{sim_displays}} content into this macro
      const inlineEnabled = get_settings("enableInlineTemplates");
      if (inlineEnabled) {
        const templateConfig = getCurrentTemplateConfig();
        const identifier = get_settings("codeBlockIdentifier") || "sim";
        const customInstructions = get_settings("displayInstructionsPrompt") || "";
        
        let displayContent = "\n\n";
        
        // Add custom instructions first if provided
        if (customInstructions && customInstructions.trim() !== "") {
          displayContent += customInstructions.trim() + "\n\n";
        }
        
        displayContent += "## Available Inline Display Add-ons\n\n";
        displayContent += "### 1. Tracker Code Block\n\n";
        displayContent += "Place tracker data at the END of your response in a code block:\n\n";
        displayContent += "- Syntax: ```" + identifier + "\\n[data here]\\n```\n";
        displayContent += "- Must be the LAST element in your message\n";
        displayContent += "- Use the format specified above (see main tracker instructions)\n";
        displayContent += "- Will render as visual tracker cards for the user\n\n";
        
        if (templateConfig) {
          // Collect all available inline templates with their pack info
          const allTemplates = [];
          const packInstructions = [];
          
          // Add templates from current template config
          if (templateConfig.inlineTemplates && Array.isArray(templateConfig.inlineTemplates)) {
            allTemplates.push(...templateConfig.inlineTemplates);
          }
          
          // Add display instructions from current template if available
          if (templateConfig.displayInstructions && templateConfig.displayInstructions.trim() !== "") {
            packInstructions.push({
              source: templateConfig.templateName || "Current Template",
              instructions: templateConfig.displayInstructions.trim()
            });
          }
          
          // Add templates from enabled packs
          const inlinePacks = get_settings("inlinePacks") || [];
          inlinePacks.forEach(pack => {
            if (pack.enabled !== false && pack.inlineTemplates && Array.isArray(pack.inlineTemplates)) {
              allTemplates.push(...pack.inlineTemplates.map(t => ({
                ...t,
                packName: pack.templateName
              })));
              
              // Add pack-specific display instructions if available
              if (pack.displayInstructions && pack.displayInstructions.trim() !== "") {
                packInstructions.push({
                  source: pack.templateName,
                  instructions: pack.displayInstructions.trim()
                });
              }
            }
          });
          
          if (allTemplates.length > 0) {
            displayContent += "### 2. Inline Display Templates\n\n";
            displayContent += "Embed visual elements WITHIN narrative text using special syntax:\n\n";
            displayContent += "- Syntax: `[[DISPLAY=templateName, DATA={param1: \"value1\", param2: \"value2\"}]]`\n";
            displayContent += "- Short form: `[[D=templateName, DATA={...}]]`\n";
            displayContent += "- Can appear anywhere in narrative text\n";
            displayContent += "- Data must be valid JSON object with string values in quotes\n\n";
            
            // Add pack-specific instructions if available
            if (packInstructions.length > 0) {
              displayContent += "**Template Pack Guidelines:**\n\n";
              packInstructions.forEach(packInfo => {
                displayContent += `- **${packInfo.source}**: ${packInfo.instructions}\n`;
              });
              displayContent += "\n";
            }
            
            displayContent += "**Available Templates:**\n\n";
            
            allTemplates.forEach(template => {
              const packInfo = template.packName ? ` *(from ${template.packName})*` : "";
              displayContent += `- **${template.insertName}**${packInfo}: ${template.insertPurpose}\n`;
              
              // List parameters with their descriptions
              if (template.parameters && template.parameters.length > 0) {
                displayContent += `  - Parameters:\n`;
                template.parameters.forEach(param => {
                  displayContent += `    - \`${param.name}\`: ${param.description}\n`;
                });
                
                // Generate example with parameter names
                const exampleParams = template.parameters.map(p => `${p.name}: "example"`).join(", ");
                displayContent += `  - Example: \`[[D=${template.insertName}, DATA={${exampleParams}}]]\`\n`;
              }
            });
          }
        }
        
        output += displayContent;
        log("Merged {{sim_displays}} content into {{sim_tracker}} (inline templates enabled)");
      }

      // Replace {{user}} and {{char}} macros with actual values from context
      // SillyTavern's MacrosParser doesn't handle nested macros, so we do it manually
      // Context: name1 = user/persona name, name2 = character name (undefined in group chats)
      const context = getContext();
      const userName = context.name1 || "User";
      const charName = context.name2 || (context.groupId ? "Characters" : "Character");

      // Get group member names if in a group chat
      let groupNames = "";
      if (context.groupId && context.groups) {
        const currentGroup = context.groups.find(g => g.id === context.groupId);
        if (currentGroup && currentGroup.members) {
          const memberNames = currentGroup.members
            .map(memberId => {
              const char = context.characters.find(c => c.avatar === memberId);
              return char ? char.name : null;
            })
            .filter(Boolean);
          groupNames = memberNames.join(", ");
        }
      }

      // Replace macros
      output = output.replace(/\{\{user\}\}/gi, userName);
      output = output.replace(/\{\{char\}\}/gi, charName);
      if (groupNames) {
        output = output.replace(/\{\{group\}\}/gi, groupNames);
      }

      return output;
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
      log("Processed {{sim_format}} macro.");
      return generateSimFormatContent();
    });

    MacrosParser.registerMacro("sim_displays", () => {
      if (!get_settings("isEnabled")) return "";
      log("Processed {{sim_displays}} macro.");
      
      const identifier = get_settings("codeBlockIdentifier") || "sim";
      const inlineEnabled = get_settings("enableInlineTemplates");
      const templateConfig = getCurrentTemplateConfig();
      const customInstructions = get_settings("displayInstructionsPrompt") || "";
      
      let output = "";
      
      // Add custom instructions first if provided
      if (customInstructions && customInstructions.trim() !== "") {
        output += customInstructions.trim() + "\n\n";
      }
      
      output += "## Available Inline Display Add-ons\n\n";
      output += "### 1. Tracker Code Block\n\n";
      output += "Place tracker data at the END of your response in a code block:\n\n";
      output += "- Syntax: ```" + identifier + "\\n[data here]\\n```\n";
      output += "- Must be the LAST element in your message\n";
      output += "- Format: " + generateSimFormatContent() + "\n";
      output += "- Will render as visual tracker cards for the user\n\n";
      
      if (inlineEnabled && templateConfig) {
        // Collect all available inline templates with their pack info
        const allTemplates = [];
        const packInstructions = [];
        
        // Add templates from current template config
        if (templateConfig.inlineTemplates && Array.isArray(templateConfig.inlineTemplates)) {
          allTemplates.push(...templateConfig.inlineTemplates);
        }
        
        // Add display instructions from current template if available
        if (templateConfig.displayInstructions && templateConfig.displayInstructions.trim() !== "") {
          packInstructions.push({
            source: templateConfig.templateName || "Current Template",
            instructions: templateConfig.displayInstructions.trim()
          });
        }
        
        // Add templates from enabled packs
        const inlinePacks = get_settings("inlinePacks") || [];
        inlinePacks.forEach(pack => {
          if (pack.enabled !== false && pack.inlineTemplates && Array.isArray(pack.inlineTemplates)) {
            allTemplates.push(...pack.inlineTemplates.map(t => ({
              ...t,
              packName: pack.templateName
            })));
            
            // Add pack-specific display instructions if available
            if (pack.displayInstructions && pack.displayInstructions.trim() !== "") {
              packInstructions.push({
                source: pack.templateName,
                instructions: pack.displayInstructions.trim()
              });
            }
          }
        });
        
        if (allTemplates.length > 0) {
          output += "### 2. Inline Display Templates\n\n";
          output += "Embed visual elements WITHIN narrative text using special syntax:\n\n";
          output += "- Syntax: `[[DISPLAY=templateName, DATA={param1: \"value1\", param2: \"value2\"}]]`\n";
          output += "- Short form: `[[D=templateName, DATA={...}]]`\n";
          output += "- Can appear anywhere in narrative text\n";
          output += "- Data must be valid JSON object with string values in quotes\n\n";
          
          // Add pack-specific instructions if available
          if (packInstructions.length > 0) {
            output += "**Template Pack Guidelines:**\n\n";
            packInstructions.forEach(packInfo => {
              output += `- **${packInfo.source}**: ${packInfo.instructions}\n`;
            });
            output += "\n";
          }
          
          output += "**Available Templates:**\n\n";
          
          allTemplates.forEach(template => {
            const packInfo = template.packName ? ` *(from ${template.packName})*` : "";
            output += `- **${template.insertName}**${packInfo}: ${template.insertPurpose}\n`;
            
            // List parameters with their descriptions
            if (template.parameters && template.parameters.length > 0) {
              output += `  - Parameters:\n`;
              template.parameters.forEach(param => {
                output += `    - \`${param.name}\`: ${param.description}\n`;
              });
              
              // Generate example with parameter names
              const exampleParams = template.parameters.map(p => `${p.name}: "example"`).join(", ");
              output += `  - Example: \`[[D=${template.insertName}, DATA={${exampleParams}}]]\`\n`;
            }
          });
        }
      }
      
      return output;
    });

    MacrosParser.registerMacro("sim_display_format", () => {
      if (!get_settings("isEnabled")) return "";
      log("Processed {{sim_display_format}} macro.");
      
      const inlineEnabled = get_settings("enableInlineTemplates");
      const templateConfig = getCurrentTemplateConfig();
      
      if (!inlineEnabled || !templateConfig) {
        return "Inline templates are not currently enabled.";
      }
      
      // Collect all available inline templates
      const allTemplates = [];
      
      // Add templates from current template config
      if (templateConfig.inlineTemplates && Array.isArray(templateConfig.inlineTemplates)) {
        allTemplates.push(...templateConfig.inlineTemplates);
      }
      
      // Add templates from enabled packs
      const inlinePacks = get_settings("inlinePacks") || [];
      inlinePacks.forEach(pack => {
        if (pack.enabled !== false && pack.inlineTemplates && Array.isArray(pack.inlineTemplates)) {
          allTemplates.push(...pack.inlineTemplates.map(t => ({
            ...t,
            packName: pack.templateName
          })));
        }
      });
      
      if (allTemplates.length === 0) {
        return "No inline display templates are currently available.";
      }
      
      let output = "## Inline Display Format Reference\n\n";
      output += "Use inline displays to embed visual elements within your narrative text.\n\n";
      output += "**Syntax:**\n";
      output += "- Full: `[[DISPLAY=templateName, DATA={param1: \"value1\", param2: \"value2\"}]]`\n";
      output += "- Short: `[[D=templateName, DATA={...}]]`\n\n";
      output += "**Rules:**\n";
      output += "- Can appear anywhere in narrative text (unlike tracker code blocks)\n";
      output += "- DATA must be valid JSON with string values in quotes\n";
      output += "- Use double quotes for JSON, single quotes may cause errors\n";
      output += "- All parameter values should be strings (e.g., `time: \"2:30 PM\"` not `time: 2:30`)\n\n";
      output += "**Available Templates:**\n\n";
      
      allTemplates.forEach(template => {
        const packInfo = template.packName ? ` *(from ${template.packName})*` : "";
        output += `### ${template.insertName}${packInfo}\n\n`;
        output += `**Purpose:** ${template.insertPurpose}\n\n`;
        
        // List parameters with descriptions
        if (template.parameters && template.parameters.length > 0) {
          output += `**Parameters:**\n`;
          template.parameters.forEach(param => {
            output += `- \`${param.name}\`: ${param.description}\n`;
          });
          output += `\n`;
          
          output += `**Example:**\n`;
          output += "```\n";
          output += `[[D=${template.insertName}, DATA={`;
          const exampleParams = template.parameters.map(p => `${p.name}: "example value"`).join(", ");
          output += exampleParams;
          output += "}]]\n```\n\n";
        }
      });
      
      return output;
    });
    log("Macros registered successfully.");

    // Register the slash command for force-regenerating tracker blocks
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: "sst-regen",
        callback: async () => {
          const isEnabled = get_settings("isEnabled");
          if (!isEnabled) {
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
            const regenMsgEl = getMessageContent(lastCharMessageIndex);
            if (regenMsgEl) {
              regenMsgEl.innerHTML = messageFormatting(
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
              regenMsgEl.parentNode.insertBefore(
                preparingText,
                regenMsgEl.nextSibling
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
              const updatedMsgEl = getMessageContent(lastCharMessageIndex);
              if (updatedMsgEl) {
                updatedMsgEl.innerHTML = messageFormatting(
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

    // Register the slash command for DOM measurements testing
    SlashCommandParser.addCommandObject(
      SlashCommand.fromProps({
        name: "sst-measure",
        callback: (namedArgs, selector) => {
          const targetSelector = selector || '.sheld';
          
          const element = query(targetSelector);
          
          if (!element) {
            return `Element not found: ${targetSelector}`;
          }
          
          // Log detailed measurements
          logElementMeasurements(element, `Measurements for: ${targetSelector}`);
          
          // Also log distance between element and viewport edges
          const distances = getDistanceToViewport(element);
          
          console.group(`📐 Distance to Viewport Edges: ${targetSelector}`);
          console.log(`Right edge: ${distances.right}px`);
          console.log(`Left edge: ${distances.left}px`);
          console.log(`Top edge: ${distances.top}px`);
          console.log(`Bottom edge: ${distances.bottom}px`);
          console.groupEnd();
          
          return `Measurements logged to console for: ${targetSelector}`;
        },
        returns: "status message",
        unnamedArgumentList: [
          SlashCommandArgument.fromProps({
            description: "CSS selector of element to measure",
            typeList: [ARGUMENT_TYPE.STRING],
            defaultValue: '.sheld',
            enumList: [
              '.sheld',
              '#chat',
              '#send_form',
              '#send_textarea',
              '#sst-sidebar-left-content',
              '#sst-sidebar-right-content',
              '.mes',
              '.mes_text',
              'body',
              '#shadow_select_chat_popup',
              '#left-nav-panel',
              '#right-nav-panel'
            ],
          }),
        ],
        helpString: `
                <div>
                    Logs detailed measurements of a DOM element to the console.
                    Includes dimensions, position, padding, margin, and distances to viewport edges.
                </div>
                <div>
                    <strong>Examples:</strong>
                    <ul>
                        <li>
                            <pre><code class="language-stscript">/sst-measure</code></pre>
                            Logs measurements for the sheld element (default)
                        </li>
                        <li>
                            <pre><code class="language-stscript">/sst-measure #chat</code></pre>
                            Logs measurements for the chat element
                        </li>
                        <li>
                            <pre><code class="language-stscript">/sst-measure #sst-sidebar-right-content</code></pre>
                            Logs measurements for the right sidebar
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
            const customFields = get_settings("customFields") || [];
            let simBlock;

            if (format === "yaml") {
              // Create a YAML structure based on custom fields
              let yamlContent = "worldData:\n";
              yamlContent += "  current_date: \"\"\n";
              yamlContent += "  current_time: \"\"\n";
              yamlContent += "characters:\n";
              yamlContent += "  - name: \"\"\n";

              // Add each custom field with a default value
              customFields.forEach((field) => {
                const key = sanitizeFieldKey(field.key);
                // Use appropriate default based on common field patterns
                let defaultValue = "\"\"";
                if (key.toLowerCase().includes("point") ||
                    key.toLowerCase().endsWith("p") && key.length <= 3 ||
                    key.toLowerCase().includes("day") ||
                    key.toLowerCase().includes("health") ||
                    key.toLowerCase().includes("react")) {
                  defaultValue = "0";
                } else if (key.toLowerCase().includes("inactive") ||
                           key.toLowerCase().includes("preg") && !key.toLowerCase().includes("day")) {
                  defaultValue = "false";
                }
                yamlContent += `    ${key}: ${defaultValue}\n`;
              });

              simBlock = `
\`\`\`${identifier}
${yamlContent}\`\`\``;
            } else {
              // Create a JSON structure based on custom fields
              let fieldsJson = "";
              customFields.forEach((field, index) => {
                const key = sanitizeFieldKey(field.key);
                // Use appropriate default based on common field patterns
                let defaultValue = '""';
                if (key.toLowerCase().includes("point") ||
                    key.toLowerCase().endsWith("p") && key.length <= 3 ||
                    key.toLowerCase().includes("day") ||
                    key.toLowerCase().includes("health") ||
                    key.toLowerCase().includes("react")) {
                  defaultValue = "0";
                } else if (key.toLowerCase().includes("inactive") ||
                           key.toLowerCase().includes("preg") && !key.toLowerCase().includes("day")) {
                  defaultValue = "false";
                }
                const comma = index < customFields.length - 1 ? "," : "";
                fieldsJson += `      "${key}": ${defaultValue}${comma}\n`;
              });

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
${fieldsJson}    }
  ]
}
\`\`\``;
            }
            
            lastCharMessage.mes += simBlock;

            // Update the message in the UI (supports both ST and Lumiverse)
            const addMsgEl = getMessageContent(lastCharMessageIndex);
            if (addMsgEl) {
              addMsgEl.innerHTML = messageFormatting(
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
    // Track pending swipe render to ensure DOM is ready
    let pendingSwipeRender = null;

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, async (mesId) => {
      // Store the last rendered message ID
      lastRenderedMessageId = mesId;

      // Check if this is a pending swipe render
      const isSwipeRender = pendingSwipeRender === mesId;
      if (isSwipeRender) {
        pendingSwipeRender = null;
        log(`Processing delayed tracker render for swiped message ${mesId}`);
      }

      // Render the tracker (this will use existing sim block if present)
      // Sidebar updates are now batched via RAF, so no redundant re-render needed
      renderTracker(mesId, get_settings, compiledWrapperTemplate, compiledCardTemplate, getReactionEmoji, darkenColor, lastSimJsonString);

      // Process inline templates for this message (supports both ST and Lumiverse)
      const inlineMsgEl = getMessageContent(mesId);
      if (inlineMsgEl) {
        const templateConfig = getCurrentTemplateConfig();
        const isEnabled = get_settings("enableInlineTemplates");
        processInlineTemplates(inlineMsgEl, templateConfig, isEnabled, get_settings);
      }
    });

    // Helper function to clean up and wrap sim blocks in all messages with hidden divs
    const wrapSimBlocksInChat = () => {
      if (!get_settings("isEnabled") || !get_settings("hideSimBlocks")) return;
      
      const context = getContext();
      const chat = context.chat;
      
      if (!chat || !Array.isArray(chat)) return;
      
      const identifier = get_settings("codeBlockIdentifier");
      let modifiedCount = 0;
      let fixedOldFormatCount = 0;
      
      chat.forEach((message, index) => {
        if (!message || !message.mes) return;
        
        // First, fix old incorrect format: <div style="display: none;">```sim without newlines
        const oldIncorrectFormat = new RegExp(
          `<div style="display: none;">\`\`\`${identifier}([\\s\\S]*?)\`\`\`</div>`,
          'g'
        );
        
        message.mes = message.mes.replace(oldIncorrectFormat, (match, content) => {
          // Check if it already has proper newlines
          if (match.startsWith('<div style="display: none;">\n```') && match.endsWith('```\n</div>')) {
            return match; // Already correct
          }
          
          // Fix the format with proper newlines
          fixedOldFormatCount++;
          return `<div style="display: none;">\n\`\`\`${identifier}${content}\`\`\`\n</div>`;
        });
        
        // Now check if message contains unwrapped sim blocks
        // Look for sim blocks that aren't preceded by the div tag with newline
        const unwrappedRegex = new RegExp(
          `(?<!<div style="display: none;">\\n)\`\`\`${identifier}[\\s\\S]*?\`\`\`(?!\\n</div>)`,
          'g'
        );
        
        if (unwrappedRegex.test(message.mes)) {
          // Wrap any unwrapped sim blocks
          const wrapRegex = new RegExp(`\`\`\`${identifier}[\\s\\S]*?\`\`\``, 'g');
          message.mes = message.mes.replace(wrapRegex, (match) => {
            // Check if this specific match is already wrapped with proper format
            const matchIndex = message.mes.indexOf(match);
            const beforeMatch = message.mes.substring(Math.max(0, matchIndex - 30), matchIndex);
            const afterMatch = message.mes.substring(matchIndex + match.length, matchIndex + match.length + 10);
            
            if (beforeMatch.endsWith('<div style="display: none;">\n') && afterMatch.startsWith('\n</div>')) {
              // Already wrapped correctly, return as-is
              return match;
            }
            
            // Not wrapped, wrap it with proper newlines
            modifiedCount++;
            return `<div style="display: none;">\n${match}\n</div>`;
          });
        }
      });
      
      if (modifiedCount > 0 || fixedOldFormatCount > 0) {
        log(`Fixed ${fixedOldFormatCount} old format sim blocks and wrapped ${modifiedCount} unwrapped sim blocks`);
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
      
      // Clear inline template cache when switching chats
      clearInlineTemplateCache();
      
      // Just refresh all cards - this will update sidebars with new chat data
      // The refreshAllCards function will find the latest sim data in the new chat
      wrappedRefreshAllCards();
      
      // Process all inline templates in the new chat
      processAllInlineTemplates(get_settings, getCurrentTemplateConfig);
    });
    eventSource.on(event_types.MORE_MESSAGES_LOADED, () => {
      wrappedRefreshAllCards();
      // Process inline templates for newly loaded messages
      processAllInlineTemplates(get_settings, getCurrentTemplateConfig);
    });
    
    eventSource.on(event_types.MESSAGE_UPDATED, () => {
      wrappedRefreshAllCards();
      // Process inline templates for updated messages
      processAllInlineTemplates(get_settings, getCurrentTemplateConfig);
    });
    
    eventSource.on(event_types.MESSAGE_EDITED, (mesId) => {
      log(`Message ${mesId} was edited. Re-rendering tracker card.`);
      renderTrackerWithoutSim(mesId, get_settings, compiledWrapperTemplate, compiledCardTemplate, getReactionEmoji, darkenColor, lastSimJsonString);
      
      // Process inline templates for the edited message (supports both ST and Lumiverse)
      const editedMsgEl = getMessageContent(mesId);
      if (editedMsgEl) {
        const templateConfig = getCurrentTemplateConfig();
        const isEnabled = get_settings("enableInlineTemplates");
        processInlineTemplates(editedMsgEl, templateConfig, isEnabled, get_settings);
      }
    });

    eventSource.on(event_types.MESSAGE_SWIPE, (mesId) => {
      log(
        `Message swipe detected for message ID ${mesId}. Updating last_sim_stats macro and scheduling tracker re-render.`
      );
      const updatedStats = updateLastSimStatsOnRegenerateOrSwipe(mesId, get_settings);
      if (updatedStats) {
        lastSimJsonString = updatedStats;
      }
      // Mark that we need to render after swipe - CHARACTER_MESSAGE_RENDERED will handle it
      // This ensures the DOM is ready before rendering
      pendingSwipeRender = mesId;
    });

    // Listen for generation ended event to update sidebars and trigger secondary LLM
    eventSource.on(event_types.GENERATION_ENDED, async (type) => {
      log(`Generation ended (type: ${type}), updating sidebars if needed`);
      setGenerationInProgress(false);

      // Flush any pending sidebar updates that were debounced during streaming
      // This ensures the final state is rendered immediately
      flushPendingSidebarUpdates();

      // For regenerate or continue operations with positioned templates, refresh all cards
      // This ensures the display reverts to the last tracker block instance
      if (type === "regenerate" || type === "continue") {
        const templatePosition = currentTemplatePosition;
        if (templatePosition === "LEFT" || templatePosition === "RIGHT" || templatePosition === "TOP" || templatePosition === "BOTTOM") {
          log(`${type} operation detected with positioned template - will refresh after processing`);
        }
      }

      // Check if we should use secondary LLM generation
      const isEnabled = get_settings("isEnabled");
      const useSecondaryLLM = get_settings("useSecondaryLLM");
      const context = getContext();

      // Only proceed if extension is enabled, secondary LLM is enabled, and we have a valid message ID
      if (isEnabled && useSecondaryLLM && lastRenderedMessageId !== null) {
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
                
                // Update the message in the UI (supports both ST and Lumiverse)
                const secLlmMsgEl = getMessageContent(mesId);
                if (secLlmMsgEl) {
                  secLlmMsgEl.innerHTML = messageFormatting(
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
        if (mesText && (mesText.classList.contains("mes_text") || mesText.classList.contains("lcs-message-content"))) {
          mesTextsWithPreparingText.delete(mesText);
        }
        element.remove();
      });
    });

    wrappedRefreshAllCards();
    
    // Process all inline templates in the initial chat
    processAllInlineTemplates(get_settings, getCurrentTemplateConfig);
    
    log(`${MODULE_NAME} has been successfully loaded.`);
  } catch (error) {
    console.error(
      `[${MODULE_NAME}] A critical error occurred during initialization. The extension may not work correctly. Error: ${error.stack}`
    );
  }
});
