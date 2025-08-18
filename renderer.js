// renderer.js - HTML card rendering code
import { getContext } from "../../../extensions.js";
import { messageFormatting } from "../../../../script.js";
import { extractTemplatePosition, currentTemplatePosition } from "./templating.js";
import { parseTrackerData } from "./formatUtils.js";

const MODULE_NAME = "silly-sim-tracker";
const CONTAINER_ID = "silly-sim-tracker-container";

// Global sidebar tracker elements
let globalLeftSidebar = null;
let globalRightSidebar = null;
let pendingLeftSidebarContent = null;
let pendingRightSidebarContent = null;
let isGenerationInProgress = false;

// Keep track of mesTexts that have preparing text
const mesTextsWithPreparingText = new Set();

// State management functions
const setGenerationInProgress = (value) => {
  isGenerationInProgress = value;
};

const getGenerationInProgress = () => {
  return isGenerationInProgress;
};

// Helper function to create or update a global left sidebar
function updateLeftSidebar(content) {
  // If generation is in progress, store the content for later
  if (isGenerationInProgress) {
    pendingLeftSidebarContent = content;
    return;
  }

  // If we don't have a global sidebar yet, create it
  if (!globalLeftSidebar) {
    // Find the sheld container
    const sheld = document.getElementById("sheld");
    console.log(`[SST] [${MODULE_NAME}]`, "Found sheld element:", sheld);
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
    console.log(`[SST] [${MODULE_NAME}]`, "Created verticalContainer");

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
    console.log(`[SST] [${MODULE_NAME}]`, "Applied styles to leftSidebar");

    // Add the sidebar to the vertical container
    verticalContainer.appendChild(leftSidebar);
    console.log(`[SST] [${MODULE_NAME}]`, "Appended leftSidebar to verticalContainer");

    // Store reference to global sidebar
    globalLeftSidebar = verticalContainer;
    console.log(`[SST] [${MODULE_NAME}]`, "Stored reference to globalLeftSidebar");

    // Insert the sidebar container directly before the sheld div in the body
    if (sheld.parentNode) {
      sheld.parentNode.insertBefore(verticalContainer, sheld);
      console.log(`[SST] [${MODULE_NAME}]`, "Successfully inserted left sidebar before sheld");
    } else {
      console.error("[SST] sheld has no parent node!");
      // Fallback: append to body
      document.body.appendChild(verticalContainer);
    }

    // Add event listeners for tabs (only once when creating)
    attachTabEventListeners(leftSidebar);

    // Debug: Log the final container
    console.log(`[SST] [${MODULE_NAME}]`, "Created left sidebar container:", verticalContainer);

    return verticalContainer;
  } else {
    // Update existing sidebar content without re-attaching event listeners
    const leftSidebar = globalLeftSidebar.querySelector(
      "#sst-sidebar-left-content"
    );
    if (leftSidebar) {
      leftSidebar.innerHTML = content;
    }
  }
}

// Helper function to create or update a global right sidebar
function updateRightSidebar(content) {
  // If generation is in progress, store the content for later
  if (isGenerationInProgress) {
    pendingRightSidebarContent = content;
    return;
  }

  // If we don't have a global sidebar yet, create it
  if (!globalRightSidebar) {
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
    console.log(`[SST] [${MODULE_NAME}]`, "Created verticalContainer");

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

    // Add the sidebar to the vertical container
    verticalContainer.appendChild(rightSidebar);
    console.log(`[SST] [${MODULE_NAME}]`, "Appended rightSidebar to verticalContainer");

    // Store reference to global sidebar
    globalRightSidebar = verticalContainer;
    console.log(`[SST] [${MODULE_NAME}]`, "Stored reference to globalRightSidebar");

    // Insert the sidebar container directly before the sheld div in the body
    if (sheld.parentNode) {
      sheld.parentNode.insertBefore(verticalContainer, sheld);
      console.log(`[SST] [${MODULE_NAME}]`, "Successfully inserted right sidebar before sheld");
    } else {
      console.error("[SST] sheld has no parent node!");
      // Fallback: append to body
      document.body.appendChild(verticalContainer);
    }

    // Add event listeners for tabs (only once when creating)
    attachTabEventListeners(rightSidebar);

    return verticalContainer;
  } else {
    // Update existing sidebar content without re-attaching event listeners
    const rightSidebar = globalRightSidebar.querySelector(
      "#sst-sidebar-right-content"
    );
    if (rightSidebar) {
      rightSidebar.innerHTML = content;
    }
  }
}

// Helper function to remove global sidebars
function removeGlobalSidebars() {
  if (globalLeftSidebar) {
    // Remove event listeners before removing the sidebar
    const leftSidebar = globalLeftSidebar.querySelector(
      "#sst-sidebar-left-content"
    );
    if (leftSidebar) {
      // Remove any existing event listeners by cloning and replacing
      const newLeftSidebar = leftSidebar.cloneNode(true);
      leftSidebar.parentNode.replaceChild(newLeftSidebar, leftSidebar);
    }
    globalLeftSidebar.remove();
    globalLeftSidebar = null;
  }
  if (globalRightSidebar) {
    // Remove event listeners before removing the sidebar
    const rightSidebar = globalRightSidebar.querySelector(
      "#sst-sidebar-right-content"
    );
    if (rightSidebar) {
      // Remove any existing event listeners by cloning and replacing
      const newRightSidebar = rightSidebar.cloneNode(true);
      rightSidebar.parentNode.replaceChild(newRightSidebar, rightSidebar);
    }
    globalRightSidebar.remove();
    globalRightSidebar = null;
  }
}

// Helper function to attach tab event listeners
function attachTabEventListeners(sidebarElement) {
  // Use setTimeout to ensure DOM is ready
  setTimeout(() => {
    const tabs = sidebarElement.querySelectorAll(".sim-tracker-tab");
    const cards = sidebarElement.querySelectorAll(".sim-tracker-card");

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

      if (tabs[firstActiveIndex])
        tabs[firstActiveIndex].classList.add("active");
      if (cards[firstActiveIndex])
        cards[firstActiveIndex].classList.add("active");

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

    const container = sidebarElement.querySelector(
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
    }

    // Force reflow to ensure proper rendering
    sidebarElement.offsetHeight;
  }, 0);
}

// --- RENDER LOGIC ---
const renderTracker = async (mesId, get_settings, compiledWrapperTemplate, compiledCardTemplate, getReactionEmoji, darkenColor, lastSimJsonString) => {
  try {
    if (!get_settings("isEnabled")) return;
    const context = getContext();
    if (!context || !context.chat || mesId >= context.chat.length) {
      console.log(`[SST] [${MODULE_NAME}]`, "Invalid context or message ID for tracker rendering");
      return;
    }

    const message = context.chat[mesId];
    if (!message || !message.mes) {
      console.log(`[SST] [${MODULE_NAME}]`, "Invalid message for tracker rendering");
      return;
    }
    
    const messageElement = document.querySelector(
      `div[mesid="${mesId}"] .mes_text`
    );
    if (!messageElement) return;

    // Log message element dimensions for debugging layout issues
    const messageRect = messageElement.getBoundingClientRect();
    console.log(`[SST] [${MODULE_NAME}]`,
      `Message ID ${mesId} dimensions - Width: ${messageRect.width.toFixed(
        2
      )}px, Height: ${messageRect.height.toFixed(2)}px`
    );

    // Get the template position from settings, with fallback to template-defined position
    const settingsTemplatePosition = get_settings("templatePosition");
    const templateDefinedPosition = currentTemplatePosition;
    
    // Use settings position if it's not "DEFAULT", otherwise use template-defined position
    const effectivePosition = settingsTemplatePosition !== "DEFAULT" 
      ? settingsTemplatePosition 
      : (templateDefinedPosition || "BOTTOM");

    // Process message text to extract sim data
    const identifier = get_settings("codeBlockIdentifier");
    const regexPattern = "```" + identifier + "[\\s\\S]*?```";
    const regex = new RegExp(regexPattern, "gm");
    let match;
    const simBlocks = [];

    // Extract all sim blocks from the message
    while ((match = regex.exec(message.mes)) !== null) {
      try {
        const fullContent = match[0];
        const content = fullContent
          .replace(/```/g, "")
          .replace(new RegExp(`^${identifier}\\s*`), "")
          .trim();

        // Parse the content (handles both JSON and YAML)
        const jsonData = parseTrackerData(content);
        simBlocks.push(jsonData);
      } catch (error) {
        console.log(`[SST] [${MODULE_NAME}]`, `Error parsing sim block in message ${mesId}: ${error.message}`);
      }
    }

    // If no sim blocks found, exit early
    if (simBlocks.length === 0) {
      return;
    }

    // Prepare character data for templates
    const allCharacters = [];
    simBlocks.forEach((block) => {
      // Handle both legacy and modern formats
      if (block.characters && Array.isArray(block.characters)) {
        // Modern format with characters array
        block.characters.forEach((char) => {
          allCharacters.push({
            ...char,
            worldData: block.worldData || {},
          });
        });
      } else {
        // Legacy format with character objects
        Object.keys(block).forEach((key) => {
          if (key !== "current_date" && key !== "current_time") {
            allCharacters.push({
              name: key,
              ...block[key],
              worldData: {
                current_date: block.current_date,
                current_time: block.current_time,
              },
            });
          }
        });
      }
    });

    // If no characters found, exit early
    if (allCharacters.length === 0) {
      return;
    }

    // Prepare template data
    const templateData = {
      characters: allCharacters,
      worldData: allCharacters[0].worldData || {},
    };

    // Render cards
    const renderedCards = compiledCardTemplate(templateData);

    // Wrap cards in container
    const wrappedContent = compiledWrapperTemplate({
      cards: renderedCards,
      cardsHtml: renderedCards,  // For backward compatibility
      worldData: templateData.worldData,
    });

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

    // Handle positioning
    switch (effectivePosition) {
      case "ABOVE":
        // Insert above the message content
        const reasoningElement = messageElement.querySelector(
          ".mes_reasoning_details"
        );
        if (reasoningElement) {
          // Insert above reasoning details if they exist
          const finalHtml =
            wrappedContent +
            `<hr style="margin-top: 15px; margin-bottom: 20px;">`;
          reasoningElement.insertAdjacentHTML("beforebegin", finalHtml);
        } else {
          // If no reasoning details, insert at the beginning of the message
          const finalHtml =
            wrappedContent +
            `<hr style="margin-top: 15px; margin-bottom: 20px;">`;
          messageElement.insertAdjacentHTML("afterbegin", finalHtml);
        }
        break;

      case "BOTTOM":
        // Add a horizontal divider before the cards
        const finalHtml =
          `<hr style="margin-top: 15px; margin-bottom: 20px;">` +
          wrappedContent;
        messageElement.insertAdjacentHTML("beforeend", finalHtml);
        break;

      case "LEFT":
        // Update the global left sidebar with the latest data
        updateLeftSidebar(wrappedContent);
        break;

      case "RIGHT":
        // Update the global right sidebar with the latest data
        updateRightSidebar(wrappedContent);
        break;

      case "MACRO":
        // For MACRO position, replace the placeholder in the message
        const placeholder = messageElement.querySelector(
          "#sst-macro-placeholder"
        );
        if (placeholder) {
          placeholder.insertAdjacentHTML("beforebegin", wrappedContent);
          placeholder.remove();
        }
        break;

      default:
        // Default to BOTTOM positioning
        const finalHtmlDefault =
          `<hr style="margin-top: 15px; margin-bottom: 20px;">` +
          wrappedContent;
        messageElement.insertAdjacentHTML("beforeend", finalHtmlDefault);
        break;
    }
  } catch (error) {
    // Clear the flag on error
    setGenerationInProgress(false);
    console.log(`[SST] [${MODULE_NAME}]`,
      `A critical error occurred in renderTracker for message ID ${mesId}. Please check the console. Error: ${error.stack}`
    );
  }
};

const renderTrackerWithoutSim = (mesId, get_settings, compiledWrapperTemplate, compiledCardTemplate, getReactionEmoji, darkenColor, lastSimJsonString) => {
  try {
    if (!get_settings("isEnabled")) return lastSimJsonString;

    const context = getContext();
    if (!context || !context.chat || mesId >= context.chat.length) {
      console.log(`[SST] [${MODULE_NAME}]`, "Invalid context or message ID for tracker rendering");
      return lastSimJsonString;
    }

    const message = context.chat[mesId];

    if (!message) {
      console.log(`[SST] [${MODULE_NAME}]`, `Error: Could not find message with ID ${mesId}. Aborting render.`);
      return lastSimJsonString;
    }

    const messageElement = document.querySelector(
      `div[mesid="${mesId}"] .mes_text`
    );
    if (!messageElement) return lastSimJsonString;

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

      // Update lastSimJsonString
      // We'll return this value so the caller can update the global variable
      const updatedLastSimJsonString = jsonContent;

      // Remove any preparing text
      const preparingText = messageElement.parentNode.querySelector(".sst-preparing-text");
      if (preparingText) {
        preparingText.remove();
        // Remove this mesText from the set since it no longer has preparing text
        mesTextsWithPreparingText.delete(messageElement);
      }

      let jsonData;

      try {
        // Use our new universal parser that can handle both JSON and YAML
        jsonData = parseTrackerData(jsonContent);
      } catch (parseError) {
        console.log(`[SST] [${MODULE_NAME}]`,
          `Failed to parse tracker data in message ID ${mesId}. Error: ${parseError.message}`
        );
        const errorHtml = `<div style="color: red; font-family: monospace;">[SillySimTracker] Error: Invalid tracker data format in code block.</div>`;
        messageElement.insertAdjacentHTML("beforeend", errorHtml);
        return lastSimJsonString;
      }

      if (typeof jsonData !== "object" || jsonData === null) {
        console.log(`[SST] [${MODULE_NAME}]`, `Parsed data in message ID ${mesId} is not a valid object.`);
        return lastSimJsonString;
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

      if (!characterList.length) return lastSimJsonString;

      // For tabbed templates, we need to pass all characters to the template
      const isTabbedTemplate = get_settings("templateFile") && get_settings("templateFile").includes("tabs");

      let cardsHtml = "";
      if (isTabbedTemplate) {
        // Prepare data for all characters
        const charactersData = characterList
          .map((character, index) => {
            const stats = character;
            const name = character.name;
            if (!stats) {
              console.log(`[SST] [${MODULE_NAME}]`,
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
              console.log(`[SST] [${MODULE_NAME}]`,
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

      // Get the template position from settings, with fallback to template-defined position
      const settingsTemplatePosition = get_settings("templatePosition");
      const templateDefinedPosition = currentTemplatePosition;
      
      // Use settings position if it's not "DEFAULT", otherwise use template-defined position
      const effectivePosition = settingsTemplatePosition !== "DEFAULT" 
        ? settingsTemplatePosition 
        : (templateDefinedPosition || "BOTTOM");

      // Handle different positions
      const wrapperTemplateData = { 
        cards: cardsHtml, 
        cardsHtml: cardsHtml,  // For backward compatibility
        worldData: worldData 
      };
      
      switch (effectivePosition) {
        case "ABOVE":
          // Insert above the message content (inside the message block)
          const reasoningElement = messageElement.querySelector(
            ".mes_reasoning_details"
          );
          if (reasoningElement) {
            // Insert above reasoning details if they exist
            const finalHtml =
              compiledWrapperTemplate(wrapperTemplateData) +
              `<hr style="margin-top: 15px; margin-bottom: 20px;">`;
            reasoningElement.insertAdjacentHTML("beforebegin", finalHtml);
          } else {
            // If no reasoning details, insert at the beginning of the message
            const finalHtml =
              compiledWrapperTemplate(wrapperTemplateData) +
              `<hr style="margin-top: 15px; margin-bottom: 20px;">`;
            messageElement.insertAdjacentHTML("afterbegin", finalHtml);
          }
          break;
        case "LEFT":
          // Update the global left sidebar with the latest data
          updateLeftSidebar(compiledWrapperTemplate(wrapperTemplateData));
          break;
        case "RIGHT":
          // Update the global right sidebar with the latest data
          updateRightSidebar(compiledWrapperTemplate(wrapperTemplateData));
          break;
        case "MACRO":
          // For MACRO position, replace the placeholder in the message
          const placeholder = messageElement.querySelector(
            "#sst-macro-placeholder"
          );
          if (placeholder) {
            const finalHtml = compiledWrapperTemplate(wrapperTemplateData);
            placeholder.insertAdjacentHTML("beforebegin", finalHtml);
            placeholder.remove();
          }
          break;
        case "BOTTOM":
        default:
          // Add a horizontal divider before the cards
          const finalHtml =
            `<hr style="margin-top: 15px; margin-bottom: 20px;">` +
            compiledWrapperTemplate(wrapperTemplateData);
          messageElement.insertAdjacentHTML("beforeend", finalHtml);
          break;
      }
    }
    
    // Return the updated lastSimJsonString so the caller can update the global variable
    return updatedLastSimJsonString;
  } catch (error) {
    console.log(`[SST] [${MODULE_NAME}]`,
      `A critical error occurred in renderTrackerWithoutSim for message ID ${mesId}. Please check the console. Error: ${error.stack}`
    );
    // Return the original lastSimJsonString if there was an error
    return lastSimJsonString;
  }
};

const refreshAllCards = (
  get_settings,
  CONTAINER_ID,
  renderTrackerWithoutSim,
  compiledWrapperTemplate,
  compiledCardTemplate,
  getReactionEmoji,
  darkenColor,
  lastSimJsonString
) => {
  console.log(`[SST] [${MODULE_NAME}]`, "Refreshing all tracker cards on screen.");

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
      // Note: We're not updating lastSimJsonString here as it's handled by the caller
      renderTrackerWithoutSim(
        parseInt(mesId, 10),
        get_settings,
        compiledWrapperTemplate,
        compiledCardTemplate,
        getReactionEmoji,
        darkenColor,
        lastSimJsonString
      );
    }
  });
};

// Export functions
export {
  updateLeftSidebar,
  updateRightSidebar,
  removeGlobalSidebars,
  attachTabEventListeners,
  renderTracker,
  renderTrackerWithoutSim,
  refreshAllCards,
  mesTextsWithPreparingText,
  isGenerationInProgress,
  pendingLeftSidebarContent,
  pendingRightSidebarContent,
  setGenerationInProgress,
  getGenerationInProgress,
  CONTAINER_ID
};
