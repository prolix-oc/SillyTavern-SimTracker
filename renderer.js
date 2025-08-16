import { messageFormatting } from "../../../../script.js";

const CONTAINER_ID = "silly-sim-tracker-container";

// Global sidebar tracker elements
let globalLeftSidebar = null;
let globalRightSidebar = null;
let pendingLeftSidebarContent = null;
let pendingRightSidebarContent = null;

// Wrapper template for cards
const wrapperTemplate = `<div id="${CONTAINER_ID}" style="width:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:block !important;visibility:visible !important;">{{{cardsHtml}}}</div>`;

// Utility to darken a color
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

// Helper function to create or update a global left sidebar
function updateLeftSidebar(content) {
  // If generation is in progress, store the content for later
  if (window.sstIsGenerationInProgress) {
    pendingLeftSidebarContent = content;
    return;
  }

  // If we don't have a global sidebar yet, create it
  if (!globalLeftSidebar) {
    // Find the sheld container
    const sheld = document.getElementById("sheld");
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

    // Add the sidebar to the vertical container
    verticalContainer.appendChild(leftSidebar);

    // Store reference to global sidebar
    globalLeftSidebar = verticalContainer;

    // Insert the sidebar container directly before the sheld div in the body
    if (sheld.parentNode) {
      sheld.parentNode.insertBefore(verticalContainer, sheld);
    } else {
      console.error("[SST] sheld has no parent node!");
      // Fallback: append to body
      document.body.appendChild(verticalContainer);
    }

    // Add event listeners for tabs (only once when creating)
    attachTabEventListeners(leftSidebar);

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
  if (window.sstIsGenerationInProgress) {
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

    // Store reference to global sidebar
    globalRightSidebar = verticalContainer;

    // Insert the sidebar container directly before the sheld div in the body
    if (sheld.parentNode) {
      sheld.parentNode.insertBefore(verticalContainer, sheld);
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

// Function to render tracker cards with position handling
const renderTrackerCards = (messageElement, cardsHtml, templatePosition) => {
  // Compile the wrapper template if not already compiled
  if (!window.compiledWrapperTemplate) {
    window.compiledWrapperTemplate = Handlebars.compile(wrapperTemplate);
  }

  switch (templatePosition) {
    case "ABOVE":
      // Insert above the message content (inside the message block)
      const reasoningElement = messageElement.querySelector(
        ".mes_reasoning_details"
      );
      if (reasoningElement) {
        // Insert above reasoning details if they exist
        const finalHtml =
          window.compiledWrapperTemplate({ cardsHtml }) +
          `<hr style="margin-top: 15px; margin-bottom: 20px;">`;
        reasoningElement.insertAdjacentHTML("beforebegin", finalHtml);
      } else {
        // If no reasoning details, insert at the beginning of the message
        const finalHtml =
          window.compiledWrapperTemplate({ cardsHtml }) +
          `<hr style="margin-top: 15px; margin-bottom: 20px;">`;
        messageElement.insertAdjacentHTML("afterbegin", finalHtml);
      }
      break;
    case "LEFT":
      // Update the global left sidebar with the latest data
      updateLeftSidebar(window.compiledWrapperTemplate({ cardsHtml }));
      break;
    case "RIGHT":
      // Update the global right sidebar with the latest data
      updateRightSidebar(window.compiledWrapperTemplate({ cardsHtml }));
      break;
    case "MACRO":
      // For MACRO position, replace the placeholder in the message
      const placeholder = messageElement.querySelector(
        "#sst-macro-placeholder"
      );
      if (placeholder) {
        const finalHtml = window.compiledWrapperTemplate({ cardsHtml });
        placeholder.insertAdjacentHTML("beforebegin", finalHtml);
        placeholder.remove();
      }
      break;
    case "BOTTOM":
    default:
      // Add a horizontal divider before the cards
      const finalHtml =
        `<hr style="margin-top: 15px; margin-bottom: 20px;">` +
        window.compiledWrapperTemplate({ cardsHtml });
      messageElement.insertAdjacentHTML("beforeend", finalHtml);
      break;
  }
};

// Function to prepare character data for templating
const prepareCharacterData = (character, currentDate, currentTime, settings) => {
  const stats = character;
  const name = character.name;
  if (!stats) {
    console.log(`[SST] No stats found for character "${name}". Skipping card.`);
    return null;
  }
  const bgColor = stats.bg || settings.defaultBgColor;
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
    showThoughtBubble: settings.showThoughtBubble,
  };
};

// Function to prepare tabbed character data for templating
const prepareTabbedCharacterData = (character, currentDate, currentTime, settings) => {
  const stats = character;
  const name = character.name;
  if (!stats) {
    console.log(`[SST] No stats found for character "${name}". Skipping card.`);
    return null;
  }
  const bgColor = stats.bg || settings.defaultBgColor;
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
    showThoughtBubble: settings.showThoughtBubble,
  };
};

export {
  renderTrackerCards,
  updateLeftSidebar,
  updateRightSidebar,
  removeGlobalSidebars,
  prepareCharacterData,
  prepareTabbedCharacterData
};