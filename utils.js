// utils.js - Miscellaneous helper functions
import { getContext } from "../../../extensions.js";
import { parseTrackerData, generateTrackerBlock } from "./formatUtils.js";

const MODULE_NAME = "silly-sim-tracker";

// --- UTILITY FUNCTIONS ---
const log = (message) => console.log(`[SST] [${MODULE_NAME}]`, message);

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
// Function to filter sim blocks in prompt (keep only last 3)
const updateLastSimStatsOnRegenerateOrSwipe = (currentMesId = null, get_settings) => {
  try {
    const context = getContext();
    if (!context || !context.chat) {
      log("Context or chat not available for regenerate/swipe update");
      return;
    }

    // Look for the most recent character message with sim data
    // We iterate backwards from the end of the chat to find the most recent valid message
    for (let i = context.chat.length - 1; i >= 0; i--) {
      const message = context.chat[i];
      if (!message || !message.mes) continue;

      // Only consider character messages (not user or system messages)
      if (message.is_user || message.is_system) continue;

      // Check if this message contains sim data
      const identifier = get_settings("codeBlockIdentifier");
      const simRegex = new RegExp(
        "```" + identifier + "[\\\\s\\\\S]*?```",
        "m"
      );
      const match = message.mes.match(simRegex);

      if (match) {
        // Extract content from the match\n        const fullContent = match[0];\n        const content = fullContent\n          .replace(/```/g, \"\")\n          .replace(new RegExp(`^${identifier}\\\\s*`), \"\")\n          .trim();

        // Update the lastSimJsonString with the found message's sim data
        return content;
      }
    }
    log("No character message with sim data found for regenerate/swipe update");
    return null;
  } catch (error) {
    log(`Error updating last sim stats on regenerate/swipe: ${error.message}`);
    return null;
  }
};

// Function to filter sim blocks in prompt (keep only the last N as configured)
const filterSimBlocksInPrompt = (chat, get_settings) => {
  try {
    if (!chat || !Array.isArray(chat)) {
      log("Invalid chat data for filtering sim blocks");
      return;
    }

    // Get the maximum number of sim blocks to keep in context
    const maxSimBlocks = parseInt(get_settings("maxSimBlocksInContext")) || 3;
    
    // If maxSimBlocks is 0, include all sim blocks (no filtering)
    if (maxSimBlocks === 0) {
      log("maxSimBlocksInContext is 0, including all sim blocks in LLM context");
      return;
    }

    // Find all messages with sim data
    const identifier = get_settings("codeBlockIdentifier");
    // Pattern to match both wrapped and unwrapped sim blocks
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

    // If we have more than maxSimBlocks messages with sim data, remove the older ones from the prompt context
    if (messagesWithSim.length > maxSimBlocks) {
      // Get the messages to remove from prompt (all except the last N)
      const messagesToRemove = messagesWithSim.slice(
        0,
        messagesWithSim.length - maxSimBlocks
      );

      log(`Filtering sim blocks: keeping last ${maxSimBlocks} of ${messagesWithSim.length} sim blocks in LLM context`);

      messagesToRemove.forEach(({ index, message }) => {
        // Remove sim blocks entirely from the prompt context
        if (message.mes) {
          const originalMes = message.mes;
          
          // First, try to remove wrapped sim blocks (with hidden div and newlines)
          // Pattern: <div style="display: none;">\n```identifier...```\n</div>
          const wrappedRegex = new RegExp(
            `<div style="display: none;">\\s*\`\`\`${identifier}[\\s\\S]*?\`\`\`\\s*</div>`,
            "gm"
          );
          let filteredMes = originalMes.replace(wrappedRegex, "");
          
          // Then, remove any remaining unwrapped sim blocks
          const unwrappedRegex = new RegExp(simRegexPattern, "gm");
          filteredMes = filteredMes.replace(unwrappedRegex, "");
          
          // Clean up extra whitespace
          filteredMes = filteredMes.trim();

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
const migrateAllSimData = async (get_settings) => {
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
            // Extract content
            const content = match
              .replace(/```/g, "")
              .replace(new RegExp(`^${identifier}\\s*`), "")
              .trim();
            
            // Parse the content (handles both JSON and YAML)
            const jsonData = parseTrackerData(content);

            // Check if it's already in new format
            if (jsonData.worldData && Array.isArray(jsonData.characters)) {
              return; // Already in new format, skip
            }

            // Migrate to new format
            const migratedData = migrateJsonFormat(jsonData);

            // Convert back to the user's preferred format
            const format = get_settings("trackerFormat") || "json";
            const migratedCodeBlock = generateTrackerBlock(migratedData, format, identifier);

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
      return migratedCount;
    } else {
      log("No messages needed migration or no sim data found.");
      toastr.info("No messages needed migration or no sim data found.");
      return 0;
    }
  } catch (error) {
    log(`Error during migration: ${error.message}`);
    toastr.error("Error during migration. Check console for details.");
    return -1;
  }
};

// Export functions
export {
  log,
  sanitizeFieldKey,
  darkenColor,
  getReactionEmoji,
  getInactiveReasonEmoji,
  get_extension_directory,
  updateLastSimStatsOnRegenerateOrSwipe,
  filterSimBlocksInPrompt,
  migrateJsonFormat,
  migrateAllSimData
};
