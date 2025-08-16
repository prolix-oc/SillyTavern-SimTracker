import { messageFormatting } from "../../../../script.js";

// Utility to migrate old JSON format to new format
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
const migrateAllSimData = async (getContext, settings) => {
  try {
    console.log("[SST] Starting migration of all sim data to new format...");
    const context = getContext();

    // Counter for migrated messages
    let migratedCount = 0;

    // Iterate through all messages in the chat
    for (let i = 0; i < context.chat.length; i++) {
      const message = context.chat[i];
      if (!message || !message.mes) continue;

      // Check if this message contains sim data
      const identifier = settings.codeBlockIdentifier;
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
              "```" + identifier + "" + migratedJsonString + "```";

            // Replace in message
            updatedMessage = updatedMessage.replace(match, migratedCodeBlock);
            modified = true;
          } catch (error) {
            console.log(`[SST] Error migrating sim data in message ${i}: ${error.message}`);
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
      console.log(`[SST] Successfully migrated ${migratedCount} messages to new format.`);
      // We would show a toastr success in the main module
      console.log(`[SST] Successfully migrated ${migratedCount} messages to new format!`);
    } else {
      console.log("[SST] No messages needed migration or no sim data found.");
      // We would show a toastr info in the main module
      console.log("[SST] No messages needed migration or no sim data found.");
    }
    
    return migratedCount;
  } catch (error) {
    console.log(`[SST] Error during migration: ${error.message}`);
    // We would show a toastr error in the main module
    console.log("[SST] Error during migration. Check console for details.");
  }
};

// Function to filter sim blocks in prompt (keep only last 3)
const filterSimBlocksInPrompt = (chat, identifier) => {
  try {
    if (!chat || !Array.isArray(chat)) {
      console.log("[SST] Invalid chat data for filtering sim blocks");
      return;
    }

    // Find all messages with sim data
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
      const messagesToRemove = messagesWithSim.slice(
        0,
        messagesWithSim.length - 3
      );

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
    console.log(`[SST] Error filtering sim blocks in prompt: ${error.message}`);
  }
};

// Function to update lastSimJsonString when a message is swiped
const updateLastSimStatsOnRegenerateOrSwipe = (getContext, settings, lastMesId = null) => {
  try {
    const context = getContext();
    if (!context || !context.chat) {
      console.log("[SST] Context or chat not available for regenerate/swipe update");
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
      const identifier = settings.codeBlockIdentifier;
      const simRegex = new RegExp(
        "```" + identifier + "[\\s\\S]*?```",
        "m"
      );
      const match = message.mes.match(simRegex);

      if (match) {
        // Extract JSON content from the match
        const jsonContent = match[0]
          .replace(/```/g, "")
          .replace(new RegExp(`^${identifier}\\s*`), "")
          .trim();

        // Update the lastSimJsonString with the found message's sim data
        console.log(
          `[SST] Updated last_sim_stats macro with data from message ID ${i} during regenerate/swipe`
        );
        return jsonContent;
      }
    }
    console.log("[SST] No character message with sim data found for regenerate/swipe update");
    return "";
  } catch (error) {
    console.log(`[SST] Error updating last sim stats on regenerate/swipe: ${error.message}`);
    return "";
  }
};

// Function to process message content and hide sim blocks if needed
const processMessageContent = (message, settings) => {
  const identifier = settings.codeBlockIdentifier;
  let displayMessage = message.mes;

  // Hide sim blocks if the setting is enabled
  if (settings.hideSimBlocks) {
    const hideRegex = new RegExp("```" + identifier + "[\\s\\S]*?```", "gm");
    displayMessage = displayMessage.replace(
      hideRegex,
      (match) => `<span style="display: none !important;">${match}</span>`
    );
  }

  return displayMessage;
};

// Function to extract sim data from message
const extractSimData = (message, identifier) => {
  // Parse the sim data from the original message content
  const jsonRegex = new RegExp("```" + identifier + "[\\s\\S]*?```");
  const match = message.mes.match(jsonRegex);
  
  if (match) {
    // Extract JSON content from the match
    const jsonContent = match[0]
      .replace(/```/g, "")
      .replace(new RegExp(`^${identifier}\\s*`), "")
      .trim();
    
    try {
      const jsonData = JSON.parse(jsonContent);
      
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

      return {
        success: true,
        jsonContent,
        worldData,
        characterList,
        currentDate,
        currentTime
      };
    } catch (jsonError) {
      console.log(
        `[SST] Failed to parse JSON. Error: ${jsonError.message}`
      );
      return {
        success: false,
        error: `Failed to parse JSON in message. Error: ${jsonError.message}`
      };
    }
  }
  
  return { success: false, error: "No sim data found in message" };
};

export {
  migrateJsonFormat,
  migrateAllSimData,
  filterSimBlocksInPrompt,
  updateLastSimStatsOnRegenerateOrSwipe,
  processMessageContent,
  extractSimData
};