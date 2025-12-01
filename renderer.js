// renderer.js - HTML card rendering code
import { getContext } from "../../../extensions.js";
import { messageFormatting } from "../../../../script.js";
import { extractTemplatePosition, currentTemplatePosition, currentTemplateLogic, currentTabsType, clearDomMeasurementCache } from "./templating.js";
import { parseTrackerData } from "./formatUtils.js";
import {
  createElement,
  query,
  queryAll,
  on,
  addClass,
  removeClass,
  hasClass
} from "./helpers.js";
import DOMUtils from "./sthelpers/domUtils.js";

const MODULE_NAME = "silly-sim-tracker";
const CONTAINER_ID = "silly-sim-tracker-container";

// Viewport change detection
let viewportResizeTimeout = null;
let lastViewportWidth = window.innerWidth;
let lastViewportHeight = window.innerHeight;
let isViewportChangeHandlerInitialized = false;

// Global sidebar tracker elements
let globalLeftSidebar = null;
let globalRightSidebar = null;
let pendingLeftSidebarContent = null;
let pendingRightSidebarContent = null;
let isGenerationInProgress = false;

// Keep track of mesTexts that have preparing text
const mesTextsWithPreparingText = new Set();

// === RENDER OPTIMIZATION: Batching and Debouncing ===

// Pending sidebar updates for RAF batching
let pendingLeftUpdate = null;
let pendingRightUpdate = null;
let rafScheduled = false;

// Debounce timer for streaming updates
let streamingUpdateTimer = null;
const STREAMING_DEBOUNCE_MS = 100;

// Delegated event listener references (to avoid re-attaching)
let leftSidebarDelegateCleanup = null;
let rightSidebarDelegateCleanup = null;

// === PANEL SYSTEM ===
// Virtual panel grouping - pairs tabs with their corresponding cards
// This allows unified state management while supporting legacy template structures
//
// Panel state: 'active' | 'inactive' | 'exiting'
// - active: panel is visible and interactive
// - inactive: panel is hidden
// - exiting: panel is animating out (transitions to inactive after animation)

/**
 * @typedef {Object} Panel
 * @property {HTMLElement|null} tab - The tab button element
 * @property {HTMLElement|null} card - The card content element
 * @property {string} characterId - The character identifier (from data-character attribute)
 * @property {string} state - Current panel state: 'active' | 'inactive' | 'exiting'
 */

/**
 * @typedef {Object} SidebarPanelState
 * @property {Panel[]} panels - Array of panel objects
 * @property {number} activeIndex - Index of the currently active panel
 * @property {Map<number, number>} exitTimeouts - Map of panel index to exit animation timeout IDs
 */

/** @type {{left: SidebarPanelState, right: SidebarPanelState}} */
const sidebarPanelState = {
  left: { panels: [], activeIndex: 0, exitTimeouts: new Map() },
  right: { panels: [], activeIndex: 0, exitTimeouts: new Map() }
};

// Animation duration for panel transitions (matches CSS)
const PANEL_ANIMATION_DURATION_MS = 300;

/**
 * Schedule a batched RAF update for sidebars
 * Collects pending updates and applies them in a single animation frame
 */
function scheduleRafUpdate() {
  if (rafScheduled) return;
  rafScheduled = true;

  requestAnimationFrame(() => {
    rafScheduled = false;

    // Process left sidebar update
    if (pendingLeftUpdate !== null) {
      const content = pendingLeftUpdate;
      pendingLeftUpdate = null;
      applyLeftSidebarUpdate(content);
    }

    // Process right sidebar update
    if (pendingRightUpdate !== null) {
      const content = pendingRightUpdate;
      pendingRightUpdate = null;
      applyRightSidebarUpdate(content);
    }
  });
}

/**
 * Queue a sidebar update - will be batched via RAF
 * During streaming, updates are debounced to reduce jank
 */
function queueSidebarUpdate(side, content) {
  if (side === 'left') {
    pendingLeftUpdate = content;
  } else {
    pendingRightUpdate = content;
  }

  // During generation, debounce updates to reduce render frequency
  if (isGenerationInProgress) {
    if (streamingUpdateTimer) {
      clearTimeout(streamingUpdateTimer);
    }
    streamingUpdateTimer = setTimeout(() => {
      streamingUpdateTimer = null;
      scheduleRafUpdate();
    }, STREAMING_DEBOUNCE_MS);
  } else {
    // Not streaming - apply immediately via RAF
    scheduleRafUpdate();
  }
}

/**
 * Flush any pending sidebar updates immediately
 * Called when generation ends to ensure final state is rendered
 */
function flushPendingSidebarUpdates() {
  if (streamingUpdateTimer) {
    clearTimeout(streamingUpdateTimer);
    streamingUpdateTimer = null;
  }

  // Cancel pending RAF and apply updates synchronously
  if (pendingLeftUpdate !== null || pendingRightUpdate !== null) {
    rafScheduled = false;

    if (pendingLeftUpdate !== null) {
      const content = pendingLeftUpdate;
      pendingLeftUpdate = null;
      applyLeftSidebarUpdate(content);
    }

    if (pendingRightUpdate !== null) {
      const content = pendingRightUpdate;
      pendingRightUpdate = null;
      applyRightSidebarUpdate(content);
    }
  }
}

// === PANEL SYSTEM FUNCTIONS ===

/**
 * Build panel array from sidebar DOM
 * Pairs tabs with cards by matching data-character attribute or by index
 * @param {HTMLElement} sidebarElement - The sidebar content element
 * @returns {Panel[]} Array of panel objects
 */
function buildPanelsFromDOM(sidebarElement) {
  const tabs = queryAll('.sim-tracker-tab', sidebarElement);
  const cards = queryAll('.sim-tracker-card', sidebarElement);

  // If no tabs or cards, return empty
  if (cards.length === 0) return [];

  const panels = [];

  // Try to match by data-character attribute first
  const cardsByCharacter = new Map();
  cards.forEach(card => {
    const charId = card.getAttribute('data-character');
    if (charId !== null) {
      cardsByCharacter.set(charId, card);
    }
  });

  // Build panels - prefer matching by data-character, fall back to index
  const maxLength = Math.max(tabs.length, cards.length);

  for (let i = 0; i < maxLength; i++) {
    const tab = tabs[i] || null;
    const charId = tab?.getAttribute('data-character') ?? String(i);

    // Find matching card by character ID, or use index
    let card = cardsByCharacter.get(charId) || cards[i] || null;

    panels.push({
      tab,
      card,
      characterId: charId,
      state: 'inactive'
    });
  }

  return panels;
}

/**
 * Apply visual state to a panel (both tab and card)
 * @param {Panel} panel - The panel to update
 * @param {string} state - The state to apply: 'active' | 'inactive' | 'exiting' | 'entering'
 *
 * State transitions:
 * - inactive → entering → active (for opening animation)
 * - active → exiting → inactive (for closing animation)
 *
 * The 'entering' state is needed because 'inactive' uses display:none,
 * which prevents CSS transitions. 'entering' removes display:none first,
 * then on the next frame we add 'active' to trigger the animation.
 */
function applyPanelState(panel, state) {
  const { tab, card } = panel;
  panel.state = state;

  // Apply state to card
  if (card) {
    // Remove all state classes
    card.classList.remove('active', 'tab-hidden', 'sliding-in', 'sliding-out');

    switch (state) {
      case 'entering':
        // Prepare for entry animation - element is visible but at "hidden" position
        // Don't add any classes - default CSS state should position it off-screen
        break;
      case 'active':
        card.classList.add('active');
        break;
      case 'exiting':
        // Add both active (for transition start state) and sliding-out (for animation)
        card.classList.add('active', 'sliding-out');
        break;
      case 'inactive':
      default:
        card.classList.add('tab-hidden');
        break;
    }
  }

  // Apply state to tab - synced with card animation
  if (tab) {
    switch (state) {
      case 'entering':
        // Tab is about to become active - don't add 'active' yet
        // This will be added when state changes to 'active'
        tab.classList.remove('active');
        break;
      case 'active':
        tab.classList.add('active');
        break;
      case 'exiting':
        // Remove 'active' to trigger the tab's exit animation
        // This syncs with the card's sliding-out animation
        tab.classList.remove('active');
        break;
      case 'inactive':
      default:
        // Tab is already in inactive position, ensure class is removed
        tab.classList.remove('active');
        break;
    }
  }
}

/**
 * Initialize panel state for a sidebar
 * @param {HTMLElement} sidebarElement - The sidebar content element
 * @param {string} side - 'left' or 'right'
 */
function initializePanelState(sidebarElement, side) {
  const state = sidebarPanelState[side];
  const tabsType = currentTabsType || 'toggle';

  // Clear any pending exit timeouts
  state.exitTimeouts.forEach(timeout => clearTimeout(timeout));
  state.exitTimeouts.clear();

  // Build panels from DOM
  state.panels = buildPanelsFromDOM(sidebarElement);

  if (state.panels.length === 0) {
    state.activeIndex = -1;
    return;
  }

  // Determine initial active panel based on tabsType
  if (tabsType === 'toggle') {
    // Toggle mode: all panels start inactive (collapsed)
    // User must click a tab to expand it
    state.activeIndex = -1;

    // Apply inactive state to all panels
    state.panels.forEach((panel) => {
      applyPanelState(panel, 'inactive');
    });
  } else {
    // Switching mode: first non-inactive panel starts active
    let firstActiveIndex = 0;
    for (let i = 0; i < state.panels.length; i++) {
      const card = state.panels[i].card;
      if (card && !card.classList.contains('inactive') && !card.classList.contains('narrative-inactive')) {
        firstActiveIndex = i;
        break;
      }
    }

    state.activeIndex = firstActiveIndex;

    // Apply initial states to all panels
    state.panels.forEach((panel, i) => {
      applyPanelState(panel, i === firstActiveIndex ? 'active' : 'inactive');
    });
  }

  // Apply container styles
  const container = query('#silly-sim-tracker-container', sidebarElement);
  if (container) {
    DOMUtils.setStyle(container, {
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      display: 'block',
      visibility: 'visible',
      height: '100%'
    });
  }
}

/**
 * Handle panel click based on current tabsType mode
 *
 * Toggle mode (default for sidebars):
 * - Click inactive tab → activate it (and deactivate any other active panel)
 * - Click active tab → deactivate it (toggle off, no panel active)
 *
 * Switching mode:
 * - Click inactive tab → activate it (and deactivate any other active panel)
 * - Click active tab → do nothing (already active)
 *
 * @param {string} side - 'left' or 'right'
 * @param {number} panelIndex - Index of panel that was clicked
 */
function activatePanel(side, panelIndex) {
  const state = sidebarPanelState[side];
  const tabsType = currentTabsType || 'toggle';

  if (panelIndex < 0 || panelIndex >= state.panels.length) {
    return;
  }

  const targetPanel = state.panels[panelIndex];
  const isCurrentlyActive = targetPanel.state === 'active';

  // Handle click on currently active panel
  if (isCurrentlyActive) {
    if (tabsType === 'switching') {
      // Switching mode: clicking active tab does nothing
      return;
    }

    // Toggle mode: clicking active tab deactivates it
    startPanelExitAnimation(state, panelIndex);
    state.activeIndex = -1; // No panel is active now
    return;
  }

  // Clicking an inactive panel - activate it

  // Cancel any pending exit timeout for the panel we're activating
  if (state.exitTimeouts.has(panelIndex)) {
    clearTimeout(state.exitTimeouts.get(panelIndex));
    state.exitTimeouts.delete(panelIndex);
  }

  // Deactivate the previously active panel (if any and different)
  const previousIndex = state.activeIndex;
  if (previousIndex >= 0 && previousIndex < state.panels.length && previousIndex !== panelIndex) {
    const previousPanel = state.panels[previousIndex];

    if (previousPanel.state === 'active' || previousPanel.state === 'exiting') {
      startPanelExitAnimation(state, previousIndex);
    }
  }

  // Activate the target panel with entry animation
  state.activeIndex = panelIndex;
  startPanelEntryAnimation(targetPanel);
}

/**
 * Start entry animation for a panel
 * Goes from inactive → entering → active to allow CSS transitions
 * @param {Panel} panel - The panel to animate in
 * @param {boolean} skipAnimation - If true, go directly to 'active' without animation
 */
function startPanelEntryAnimation(panel, skipAnimation = false) {
  // If already active, nothing to do
  if (panel.state === 'active') {
    return;
  }

  // If skipping animation (e.g., initial load), go straight to active
  if (skipAnimation) {
    applyPanelState(panel, 'active');
    return;
  }

  // If currently entering, let it continue
  if (panel.state === 'entering') {
    return;
  }

  // Step 1: Set to 'entering' state - this removes display:none
  // and positions the element at its starting (hidden) position
  applyPanelState(panel, 'entering');

  // Step 2: On the next frame, add 'active' to trigger the CSS transition
  // Using requestAnimationFrame ensures the browser has rendered the 'entering' state
  requestAnimationFrame(() => {
    // Double RAF to ensure the browser has fully processed the layout change
    requestAnimationFrame(() => {
      // Only proceed if still in 'entering' state (not cancelled)
      if (panel.state === 'entering') {
        applyPanelState(panel, 'active');
      }
    });
  });
}

/**
 * Start exit animation for a panel
 * @param {SidebarPanelState} state - The sidebar panel state
 * @param {number} panelIndex - Index of panel to animate out
 */
function startPanelExitAnimation(state, panelIndex) {
  const panel = state.panels[panelIndex];

  // Cancel any existing exit timeout
  if (state.exitTimeouts.has(panelIndex)) {
    clearTimeout(state.exitTimeouts.get(panelIndex));
  }

  // Start exit animation
  applyPanelState(panel, 'exiting');

  // After animation completes, set to fully inactive
  const timeoutId = setTimeout(() => {
    if (panel.state === 'exiting') {
      applyPanelState(panel, 'inactive');
    }
    state.exitTimeouts.delete(panelIndex);
  }, PANEL_ANIMATION_DURATION_MS);

  state.exitTimeouts.set(panelIndex, timeoutId);
}

/**
 * Set up delegated click handler for panel tabs
 * @param {HTMLElement} sidebarElement - The sidebar content element
 * @param {string} side - 'left' or 'right'
 */
function setupPanelClickHandler(sidebarElement, side) {
  // Clean up existing listener
  if (side === 'left' && leftSidebarDelegateCleanup) {
    leftSidebarDelegateCleanup();
    leftSidebarDelegateCleanup = null;
  } else if (side === 'right' && rightSidebarDelegateCleanup) {
    rightSidebarDelegateCleanup();
    rightSidebarDelegateCleanup = null;
  }

  const handleClick = (event) => {
    const tab = event.target.closest('.sim-tracker-tab');
    if (!tab) return;

    const state = sidebarPanelState[side];

    // Find which panel this tab belongs to by data-character attribute
    // This is more reliable than DOM element reference comparison
    const clickedCharacterId = tab.getAttribute('data-character');
    let panelIndex = -1;

    if (clickedCharacterId !== null) {
      // Match by data-character attribute
      panelIndex = state.panels.findIndex(p => p.characterId === clickedCharacterId);
    }

    // Fallback: try to match by DOM element reference
    if (panelIndex === -1) {
      panelIndex = state.panels.findIndex(p => p.tab === tab);
    }

    // Last resort: find by index in DOM
    if (panelIndex === -1) {
      const allTabs = queryAll('.sim-tracker-tab', sidebarElement);
      panelIndex = allTabs.indexOf(tab);
    }

    if (panelIndex === -1) {
      return;
    }

    activatePanel(side, panelIndex);
  };

  // Use event delegation
  const cleanup = on(sidebarElement, 'click', '.sim-tracker-tab', handleClick);

  if (side === 'left') {
    leftSidebarDelegateCleanup = cleanup;
  } else {
    rightSidebarDelegateCleanup = cleanup;
  }
}

/**
 * Update panel references after DOM content update
 * Preserves current state while updating element references
 * @param {HTMLElement} sidebarElement - The sidebar content element
 * @param {string} side - 'left' or 'right'
 */
function refreshPanelReferences(sidebarElement, side) {
  const state = sidebarPanelState[side];
  const newPanels = buildPanelsFromDOM(sidebarElement);

  // If panel count changed, reinitialize completely
  if (newPanels.length !== state.panels.length) {
    initializePanelState(sidebarElement, side);
    return;
  }

  // Update element references while preserving states
  newPanels.forEach((newPanel, i) => {
    const oldState = state.panels[i]?.state || 'inactive';
    newPanel.state = oldState;

    // Apply the preserved state to new DOM elements
    applyPanelState(newPanel, oldState);
  });

  state.panels = newPanels;
}

/**
 * Clear panel state for a side (called when sidebar is removed)
 * @param {string} side - 'left' or 'right'
 */
function clearPanelState(side) {
  const state = sidebarPanelState[side];

  // Clear all exit timeouts
  state.exitTimeouts.forEach(timeout => clearTimeout(timeout));
  state.exitTimeouts.clear();

  // Reset state
  state.panels = [];
  state.activeIndex = 0;
}

// Function to execute bundled template logic
const executeTemplateLogic = (data, templateType) => {
  // If no template logic exists, return data unchanged
  if (!currentTemplateLogic || currentTemplateLogic.trim() === '') {
    return data;
  }
  
  try {
    // Create a sandboxed function that receives the data object
    // Wrap in strict mode and use proper encoding to handle Unicode characters
    // We use indirect eval to ensure global scope and better Unicode handling
    const wrappedLogic = '"use strict";\n' + currentTemplateLogic + '\n; return data;';
    const logicFunction = new Function('data', wrappedLogic);
    const transformedData = logicFunction(data);
    
    console.log(`[SST] [${MODULE_NAME}]`, `Template logic executed successfully for ${templateType} template`);
    return transformedData;
  } catch (error) {
    console.warn(`[SST] [${MODULE_NAME}]`, `Template logic execution failed:`, error);
    toastr.error(`Template logic error: ${error.message}`, 'Template Logic Error');
    
    // Return original data on error as fallback
    return data;
  }
};

/**
 * Calculate stat changes by comparing current and previous character data
 * @param {Array} currentCharacters - Current character list
 * @param {String} previousSimData - Previous sim block data (raw string)
 * @returns {Object} - Map of character names to their calculated changes
 */
const calculateStatChanges = (currentCharacters, previousSimData) => {
  const changes = {};

  // If no previous data, all changes are 0
  if (!previousSimData || previousSimData.trim() === '' || previousSimData === '{}') {
    currentCharacters.forEach(char => {
      changes[char.name] = {};
    });
    return changes;
  }

  try {
    // Parse previous sim data
    const previousData = parseTrackerData(previousSimData);

    // Handle both old and new JSON formats for previous data
    let previousCharacters = [];
    if (previousData.worldData && Array.isArray(previousData.characters)) {
      previousCharacters = previousData.characters;
    } else {
      // Convert old format to array
      const worldDataFields = ["current_date", "current_time"];
      Object.keys(previousData).forEach((key) => {
        if (!worldDataFields.includes(key)) {
          previousCharacters.push({
            name: key,
            ...previousData[key],
          });
        }
      });
    }

    // Build a map of previous character data by name
    const previousCharMap = {};
    previousCharacters.forEach(char => {
      previousCharMap[char.name] = char;
    });

    // Calculate changes for each current character
    currentCharacters.forEach(currentChar => {
      const charName = currentChar.name;
      const previousChar = previousCharMap[charName];

      // If character didn't exist before, all changes are 0
      if (!previousChar) {
        changes[charName] = {};
        return;
      }

      // Calculate numeric stat differences
      const charChanges = {};

      // List of stats to track changes for (covers both dating sim and disposition templates)
      const numericStats = [
        'affection', 'desire', 'trust', 'contempt',  // Dating sim stats
        'affinity', 'health'  // Disposition stats
      ];

      numericStats.forEach(stat => {
        const currentValue = currentChar[stat];
        const previousValue = previousChar[stat];

        // Only calculate change if both values exist and are numeric
        if (typeof currentValue === 'number' && typeof previousValue === 'number') {
          charChanges[stat + 'Change'] = currentValue - previousValue;
        }
      });

      // Handle connection affinity changes (for disposition template)
      if (currentChar.connections && Array.isArray(currentChar.connections)) {
        charChanges.connectionChanges = {};

        currentChar.connections.forEach(currentConn => {
          const connName = currentConn.name;

          // Find matching connection in previous data
          if (previousChar.connections && Array.isArray(previousChar.connections)) {
            const previousConn = previousChar.connections.find(c => c.name === connName);

            if (previousConn && typeof currentConn.affinity === 'number' && typeof previousConn.affinity === 'number') {
              charChanges.connectionChanges[connName] = currentConn.affinity - previousConn.affinity;
            } else {
              charChanges.connectionChanges[connName] = 0;
            }
          } else {
            charChanges.connectionChanges[connName] = 0;
          }
        });
      }

      changes[charName] = charChanges;
    });

  } catch (error) {
    console.warn(`[SST] [${MODULE_NAME}]`, `Error calculating stat changes: ${error.message}`);
    // Return empty changes on error
    currentCharacters.forEach(char => {
      changes[char.name] = {};
    });
  }

  return changes;
};

// State management functions
const setGenerationInProgress = (value) => {
  isGenerationInProgress = value;
};

const getGenerationInProgress = () => {
  return isGenerationInProgress;
};

// Helper function to create or update a global left sidebar
// This is the public API - queues updates for batched rendering
function updateLeftSidebar(content) {
  queueSidebarUpdate('left', content);
}

// Internal function that actually applies the left sidebar update
function applyLeftSidebarUpdate(content) {
  // If we don't have a global sidebar yet, create it
  if (!globalLeftSidebar) {
    console.log(`[SST] [${MODULE_NAME}]`, "Creating new left sidebar");
    const sheld = document.getElementById("sheld");
    if (!sheld) {
      console.warn("[SST] Could not find sheld container for sidebar - will retry");
      // Re-queue the update to retry
      pendingLeftUpdate = content;
      setTimeout(() => scheduleRafUpdate(), 100);
      return;
    }

    // Create container with CSS containment for performance
    const verticalContainer = createElement('div', {
      attrs: {
        id: 'sst-global-sidebar-left',
        class: 'vertical-container'
      },
      style: {
        position: 'fixed',
        left: '0',
        top: '0',
        bottom: '0',
        width: 'auto',
        height: '100vh',
        boxSizing: 'border-box',
        margin: '0',
        padding: '10px',
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        visibility: 'visible',
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: '100',
        contain: 'layout style'
      }
    });

    // Create the actual sidebar content container
    const leftSidebar = createElement('div', {
      attrs: {
        id: 'sst-sidebar-left-content'
      },
      html: content,
      style: {
        width: 'auto',
        height: '100%',
        maxWidth: '300px',
        boxSizing: 'border-box',
        margin: '0',
        padding: '0',
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        display: 'block',
        visibility: 'visible',
        overflow: 'visible',
        position: 'relative',
        pointerEvents: 'auto',
        contain: 'layout style'
      }
    });

    verticalContainer.appendChild(leftSidebar);
    globalLeftSidebar = verticalContainer;

    if (sheld.parentNode) {
      sheld.parentNode.insertBefore(verticalContainer, sheld);
    } else {
      document.body.appendChild(verticalContainer);
    }

    // Initialize panel state and set up click handler (new panel system)
    initializePanelState(leftSidebar, 'left');
    setupPanelClickHandler(leftSidebar, 'left');

    console.log(`[SST] [${MODULE_NAME}]`, "Created left sidebar container");
    return verticalContainer;
  } else {
    // Update existing sidebar content
    const leftSidebar = query('#sst-sidebar-left-content', globalLeftSidebar);
    if (leftSidebar) {
      updateSidebarContentInPlace(leftSidebar, content, 'left');
    }
  }
}

// Helper function to create or update a global right sidebar
// This is the public API - queues updates for batched rendering
function updateRightSidebar(content) {
  queueSidebarUpdate('right', content);
}

// Internal function that actually applies the right sidebar update
function applyRightSidebarUpdate(content) {
  // If we don't have a global sidebar yet, create it
  if (!globalRightSidebar) {
    console.log(`[SST] [${MODULE_NAME}]`, "Creating new right sidebar");
    const sheld = document.getElementById("sheld");
    if (!sheld) {
      console.warn("[SST] Could not find sheld container for sidebar - will retry");
      // Re-queue the update to retry
      pendingRightUpdate = content;
      setTimeout(() => scheduleRafUpdate(), 100);
      return;
    }

    // Create container with CSS containment for performance
    const verticalContainer = createElement('div', {
      attrs: {
        id: 'sst-global-sidebar-right',
        class: 'vertical-container'
      },
      style: {
        position: 'fixed',
        right: '0',
        top: '0',
        bottom: '0',
        width: 'auto',
        height: '100vh',
        boxSizing: 'border-box',
        margin: '0',
        padding: '10px',
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-end',
        visibility: 'visible',
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: '100',
        contain: 'layout style'
      }
    });

    // Create the actual sidebar content container
    const rightSidebar = createElement('div', {
      attrs: {
        id: 'sst-sidebar-right-content'
      },
      html: content,
      style: {
        width: 'auto',
        height: '100%',
        maxWidth: '300px',
        boxSizing: 'border-box',
        margin: '0',
        padding: '0',
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        display: 'block',
        visibility: 'visible',
        overflow: 'visible',
        position: 'relative',
        pointerEvents: 'auto',
        contain: 'layout style'
      }
    });

    verticalContainer.appendChild(rightSidebar);
    globalRightSidebar = verticalContainer;

    if (sheld.parentNode) {
      sheld.parentNode.insertBefore(verticalContainer, sheld);
    } else {
      document.body.appendChild(verticalContainer);
    }

    // Initialize panel state and set up click handler (new panel system)
    initializePanelState(rightSidebar, 'right');
    setupPanelClickHandler(rightSidebar, 'right');

    console.log(`[SST] [${MODULE_NAME}]`, "Created right sidebar container");
    return verticalContainer;
  } else {
    // Update existing sidebar content
    const rightSidebar = query('#sst-sidebar-right-content', globalRightSidebar);
    if (rightSidebar) {
      updateSidebarContentInPlace(rightSidebar, content, 'right');
    }
  }
}

// Helper function to update sidebar content without destroying DOM
function updateSidebarContentInPlace(existingSidebar, newContentHtml, side = 'left') {
  // Create temporary container to parse new content
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = newContentHtml;

  const existingContainer = query(`#${CONTAINER_ID}`, existingSidebar);
  const newContainer = query(`#${CONTAINER_ID}`, tempDiv);

  // Check if the container structure has changed (different class names or structure)
  const existingContainerClasses = existingContainer ? existingContainer.className : '';
  const newContainerClasses = newContainer ? newContainer.className : '';

  if (!existingContainer || !newContainer || existingContainerClasses !== newContainerClasses) {
    // Template structure changed - full rebuild required
    console.log(`[SST] [${MODULE_NAME}]`, "Container structure mismatch, rebuilding sidebar");
    existingSidebar.innerHTML = newContentHtml;

    // Apply critical container styles
    const container = query('#silly-sim-tracker-container', existingSidebar);
    if (container) {
      DOMUtils.setStyle(container, {
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        display: 'block',
        visibility: 'visible',
        height: '100%'
      });
    }

    // Re-initialize panel state (new panel system)
    initializePanelState(existingSidebar, side);
    return;
  }

  // Get all cards and tabs
  const existingCards = queryAll('.sim-tracker-card', existingContainer);
  const newCards = queryAll('.sim-tracker-card', newContainer);
  const existingTabs = queryAll('.sim-tracker-tab', existingContainer);
  const newTabs = queryAll('.sim-tracker-tab', newContainer);

  // Check if the number of cards changed - if so, need to rebuild
  if (existingCards.length !== newCards.length || existingTabs.length !== newTabs.length) {
    console.log(`[SST] [${MODULE_NAME}]`, "Card/tab count changed, rebuilding sidebar");
    existingSidebar.innerHTML = newContentHtml;

    const container = query('#silly-sim-tracker-container', existingSidebar);
    if (container) {
      DOMUtils.setStyle(container, {
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        display: 'block',
        visibility: 'visible',
        height: '100%'
      });
    }

    // Re-initialize panel state (new panel system)
    initializePanelState(existingSidebar, side);
    return;
  }

  // Get panel state for preserving current states
  const panelState = sidebarPanelState[side];

  // Update each card's content without destroying it
  newCards.forEach((newCard, index) => {
    if (existingCards[index]) {
      const existingCard = existingCards[index];

      // Use replaceChildren for more efficient DOM update (single reflow)
      const fragment = document.createDocumentFragment();
      Array.from(newCard.children).forEach(child => {
        fragment.appendChild(child.cloneNode(true));
      });

      // Clear and append in one operation
      existingCard.replaceChildren(fragment);

      // Update attributes EXCEPT class
      Array.from(newCard.attributes).forEach(attr => {
        if (attr.name !== 'class') {
          existingCard.setAttribute(attr.name, attr.value);
        }
      });

      // Apply base classes from new card
      existingCard.className = newCard.className;
    }
  });

  // Update tabs
  newTabs.forEach((newTab, index) => {
    if (existingTabs[index]) {
      const existingTab = existingTabs[index];

      existingTab.innerHTML = newTab.innerHTML;

      Array.from(newTab.attributes).forEach(attr => {
        if (attr.name !== 'class') {
          existingTab.setAttribute(attr.name, attr.value);
        }
      });

      // Apply base classes from new tab
      existingTab.className = newTab.className;
    }
  });

  // Refresh panel references to point to updated DOM elements, preserving state
  refreshPanelReferences(existingSidebar, side);
}

// === DEPRECATED TAB STATE FUNCTIONS ===
// These functions are part of the old tab/card separate state system.
// They are superseded by the Panel System (see PANEL SYSTEM FUNCTIONS above).
// Kept for backward compatibility but will be removed in a future version.
// TODO: Remove these functions once all templates migrate to panel-based structure.

/**
 * @deprecated Use applyPanelState() instead
 * Apply state to a card element
 * Cards have full animation states: active, sliding-in, sliding-out, hidden
 * @param {HTMLElement} card - The card element to update
 * @param {string} state - The state to apply
 */
function applyCardState(card, state) {
  switch (state) {
    case 'active':
      card.classList.remove('tab-hidden', 'sliding-in', 'sliding-out');
      card.classList.add('active');
      break;
    case 'sliding-in':
      card.classList.remove('tab-hidden', 'sliding-out', 'active');
      card.classList.add('sliding-in');
      break;
    case 'sliding-out':
      // Keep 'active' during slide-out for CSS transition to work
      card.classList.remove('tab-hidden', 'sliding-in');
      card.classList.add('sliding-out');
      break;
    case 'hidden':
    default:
      card.classList.remove('active', 'sliding-in', 'sliding-out');
      card.classList.add('tab-hidden');
      break;
  }
}

/**
 * @deprecated Use applyPanelState() instead
 * Apply state to a tab button element
 * Tabs only toggle 'active' class - they're always visible, just styled differently
 * The CSS handles the transform animation when active class is added/removed
 * @param {HTMLElement} tab - The tab element to update
 * @param {boolean} isActive - Whether the tab should be active
 */
function applyTabButtonState(tab, isActive) {
  if (isActive) {
    tab.classList.add('active');
  } else {
    tab.classList.remove('active');
  }
}

/**
 * @deprecated Use applyPanelState() instead
 * Legacy wrapper for backward compatibility
 * Routes to appropriate function based on element type
 * @param {HTMLElement} element - The element to update
 * @param {string} state - The state to apply
 */
function applyTabState(element, state) {
  if (element.classList.contains('sim-tracker-tab')) {
    // Tabs only care about active/inactive
    applyTabButtonState(element, state === 'active');
  } else {
    // Cards get full state management
    applyCardState(element, state);
  }
}

/**
 * @deprecated Use initializePanelState() instead
 * Initialize tab states from DOM and set up the state cache
 * @param {HTMLElement} sidebarElement - The sidebar content element
 * @param {string} side - 'left' or 'right'
 */
function initializeTabStates(sidebarElement, side) {
  const cards = queryAll('.sim-tracker-card', sidebarElement);
  const tabs = queryAll('.sim-tracker-tab', sidebarElement);

  if (cards.length === 0) {
    tabStateCache[side] = { activeIndex: 0, states: [] };
    return;
  }

  // Find the first non-inactive card
  let firstActiveIndex = 0;
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].classList.contains("inactive") && !cards[i].classList.contains("narrative-inactive")) {
      firstActiveIndex = i;
      break;
    }
  }

  // Initialize all to hidden, then activate the first valid one
  const states = cards.map((_, i) => i === firstActiveIndex ? 'active' : 'hidden');

  // Apply states to DOM - use separate functions for cards and tabs
  cards.forEach((card, i) => applyCardState(card, states[i]));
  tabs.forEach((tab, i) => applyTabButtonState(tab, states[i] === 'active'));

  // Update cache
  tabStateCache[side] = { activeIndex: firstActiveIndex, states };

  // Apply container styles
  const container = query('#silly-sim-tracker-container', sidebarElement);
  if (container) {
    DOMUtils.setStyle(container, {
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      display: 'block',
      visibility: 'visible',
      height: '100%'
    });
  }
}

/**
 * @deprecated Use setupPanelClickHandler() instead
 * Set up a single delegated event listener for tab clicks
 * This avoids re-attaching listeners on every content update
 * @param {HTMLElement} sidebarElement - The sidebar content element
 * @param {string} side - 'left' or 'right'
 */
function setupDelegatedTabListener(sidebarElement, side) {
  // Clean up existing listener if any
  if (side === 'left' && leftSidebarDelegateCleanup) {
    leftSidebarDelegateCleanup();
    leftSidebarDelegateCleanup = null;
  } else if (side === 'right' && rightSidebarDelegateCleanup) {
    rightSidebarDelegateCleanup();
    rightSidebarDelegateCleanup = null;
  }

  // Animation timeout tracking
  const animationTimeouts = new Map();

  const handleTabClick = (event) => {
    const tab = event.target.closest('.sim-tracker-tab');
    if (!tab) return;

    const tabs = queryAll('.sim-tracker-tab', sidebarElement);
    const cards = queryAll('.sim-tracker-card', sidebarElement);
    const clickedIndex = tabs.indexOf(tab);

    if (clickedIndex === -1) return;

    const cache = tabStateCache[side];
    const isAlreadyActive = cache.states[clickedIndex] === 'active';

    // If clicking already active tab, do nothing
    if (isAlreadyActive) return;

    // Cancel pending card animations
    animationTimeouts.forEach(timeout => clearTimeout(timeout));
    animationTimeouts.clear();

    // Find currently active index
    const previousActiveIndex = cache.activeIndex;

    // Update cache state
    cache.activeIndex = clickedIndex;

    // Process all tabs and cards
    cache.states.forEach((state, i) => {
      const card = cards[i];
      const tabBtn = tabs[i];

      if (i === clickedIndex) {
        // Activate the clicked tab/card pair
        cache.states[i] = 'active';

        // Tab button: immediately toggle active (CSS handles its animation)
        if (tabBtn) applyTabButtonState(tabBtn, true);

        // Card: activate (CSS handles slide-in animation)
        if (card) applyCardState(card, 'active');

      } else if (state === 'active' || state === 'sliding-in') {
        // Deactivate previously active tab/card pair
        cache.states[i] = 'sliding-out';

        // Tab button: immediately remove active (CSS handles its animation back)
        if (tabBtn) applyTabButtonState(tabBtn, false);

        // Card: start slide-out animation
        if (card) applyCardState(card, 'sliding-out');

        // After card animation completes, hide it
        const timeoutId = setTimeout(() => {
          if (cache.states[i] === 'sliding-out') {
            cache.states[i] = 'hidden';
            if (card) applyCardState(card, 'hidden');
          }
          animationTimeouts.delete(i);
        }, 300);

        animationTimeouts.set(i, timeoutId);
      }
    });
  };

  // Use event delegation on the sidebar container
  const cleanup = on(sidebarElement, 'click', '.sim-tracker-tab', handleTabClick);

  // Store cleanup reference
  if (side === 'left') {
    leftSidebarDelegateCleanup = cleanup;
  } else {
    rightSidebarDelegateCleanup = cleanup;
  }
}

// Helper function to remove global sidebars
function removeGlobalSidebars() {
  // Clean up left sidebar
  if (globalLeftSidebar) {
    // Clean up delegated event listener
    if (leftSidebarDelegateCleanup) {
      leftSidebarDelegateCleanup();
      leftSidebarDelegateCleanup = null;
    }
    // Clear panel state (new panel system)
    clearPanelState('left');
    globalLeftSidebar.remove();
    globalLeftSidebar = null;
  }

  // Clean up right sidebar
  if (globalRightSidebar) {
    // Clean up delegated event listener
    if (rightSidebarDelegateCleanup) {
      rightSidebarDelegateCleanup();
      rightSidebarDelegateCleanup = null;
    }
    // Clear panel state (new panel system)
    clearPanelState('right');
    globalRightSidebar.remove();
    globalRightSidebar = null;
  }

  // Clear any pending updates
  pendingLeftUpdate = null;
  pendingRightUpdate = null;
  if (streamingUpdateTimer) {
    clearTimeout(streamingUpdateTimer);
    streamingUpdateTimer = null;
  }
}

/**
 * @deprecated Use initializePanelState() and setupPanelClickHandler() instead
 * Legacy wrapper for tab event listener attachment
 * Kept for backward compatibility with external calls
 * @param {HTMLElement} sidebarElement - The sidebar content element
 */
function attachTabEventListeners(sidebarElement) {
  // Determine which side this sidebar is on
  const isLeft = sidebarElement.id === 'sst-sidebar-left-content' ||
                 sidebarElement.closest('#sst-global-sidebar-left') !== null;
  const side = isLeft ? 'left' : 'right';

  // Use the new panel system
  initializePanelState(sidebarElement, side);

  // Only set up click handler if not already set up
  if (side === 'left' && !leftSidebarDelegateCleanup) {
    setupPanelClickHandler(sidebarElement, side);
  } else if (side === 'right' && !rightSidebarDelegateCleanup) {
    setupPanelClickHandler(sidebarElement, side);
  }
}

// --- RENDER LOGIC ---
const renderTracker = (mesId, get_settings, compiledWrapperTemplate, compiledCardTemplate, getReactionEmoji, darkenColor, lastSimJsonString) => {
  try {
    if (!get_settings("isEnabled")) return;
    const context = getContext();
    const message = context.chat[mesId];
    if (!message) {
      console.log(`[SST] [${MODULE_NAME}]`, `Error: Could not find message with ID ${mesId}. Aborting render.`);
      return;
    }
    
    // For positioned templates (TOP/BOTTOM/LEFT/RIGHT), only render if this is the most recent message with sim data
    const templatePosition = currentTemplatePosition;
    if (templatePosition === "TOP" || templatePosition === "BOTTOM" || templatePosition === "LEFT" || templatePosition === "RIGHT") {
      // Find the most recent message with sim data
      const identifier = get_settings("codeBlockIdentifier");
      let mostRecentSimMessageId = null;
      
      for (let i = context.chat.length - 1; i >= 0; i--) {
        const msg = context.chat[i];
        if (msg) {
          const dataMatch = msg.mes.match(new RegExp("```" + identifier + "[\\s\\S]*?```", "m"));
          if (dataMatch && dataMatch[0]) {
            mostRecentSimMessageId = i;
            break;
          }
        }
      }
      
      // If this message is not the most recent one with sim data, skip rendering
      if (mostRecentSimMessageId !== null && mesId !== mostRecentSimMessageId) {
        console.log(`[SST] [${MODULE_NAME}]`, `Skipping render for positioned template - message ${mesId} is not the most recent (most recent is ${mostRecentSimMessageId})`);
        return;
      }
      
      // If this IS the most recent, remove any old positioned cards first
      if (templatePosition === "TOP" || templatePosition === "BOTTOM") {
        // Remove containers from all other messages
        document.querySelectorAll(`#${CONTAINER_ID}`).forEach((container) => {
          const containerMesId = container.closest('.mes')?.getAttribute('mesid');
          if (containerMesId && parseInt(containerMesId) !== mesId) {
            console.log(`[SST] [${MODULE_NAME}]`, `Removing old positioned card from message ${containerMesId}`);
            container.remove();
          }
        });
      }
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

    // Parse the sim data from the original message content
    const identifier = get_settings("codeBlockIdentifier");
    const jsonRegex = new RegExp("```" + identifier + "[\\s\\S]*?```");
    const match = message.mes.match(jsonRegex);

    // Handle message formatting and sim block hiding
    if (get_settings("hideSimBlocks")) {
      let displayMessage = message.mes;

      // Hide sim blocks with div wrapper (more robust against re-rendering)
      const hideRegex = new RegExp("```" + identifier + "[\\s\\S]*?```", "gm");
      displayMessage = displayMessage.replace(
        hideRegex,
        (match) => `<div style="display: none;">\n${match}\n</div>`
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
      // Extract content from the match
      const fullContent = match[0];
      const content = fullContent
        .replace(/```/g, "")
        .replace(new RegExp(`^${identifier}\\s*`), "")
        .trim();

      // Update lastSimJsonString
      lastSimJsonString = content;

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
        jsonData = parseTrackerData(content);
      } catch (parseError) {
        console.log(`[SST] [${MODULE_NAME}]`,
          `Failed to parse tracker data in message ID ${mesId}. Error: ${parseError.message}`
        );
        messageElement.insertAdjacentHTML(
          "beforeend",
          `<div style="color: red; font-family: monospace;">[SillySimTracker] Error: Invalid tracker data format in code block.</div>`
        );
        return;
      }

      if (typeof jsonData !== "object" || jsonData === null) {
        console.log(`[SST] [${MODULE_NAME}]`, `Parsed data in message ID ${mesId} is not a valid object.`);
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

      // Calculate stat changes for all characters
      const statChanges = calculateStatChanges(characterList, lastSimJsonString);

      // For tabbed templates, we need to pass all characters to the template
      const templateFile = get_settings("templateFile");
      const customTemplateHtml = get_settings("customTemplateHtml");
      const isTabbedTemplate = templateFile.includes("tabs") ||
                               (customTemplateHtml && customTemplateHtml.includes("sim-tracker-tabs"));

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
            const changes = statChanges[name] || {};
            return {
              characterName: name,
              currentDate: currentDate,
              currentTime: currentTime,
              stats: {
                ...stats,
                ...changes,
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
        let templateData = {
          characters: charactersData,
          currentDate: currentDate,
          currentTime: currentTime,
        };
        
        // Execute bundled template logic if it exists
        templateData = executeTemplateLogic(templateData, 'tabbed');

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
            const changes = statChanges[name] || {};
            let cardData = {
              characterName: name,
              currentDate: currentDate,
              currentTime: currentTime,
              stats: {
                ...stats,
                ...changes,
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
            
            // Execute bundled template logic if it exists
            cardData = executeTemplateLogic(cardData, 'single');
            
            return compiledCardTemplate(cardData);
          })
          .join("");
      }

      // Use the template position from the templating module
      const templatePosition = currentTemplatePosition;

      // Handle different positions
      switch (templatePosition) {
        case "TOP":
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
    isGenerationInProgress = false;
    console.log(`[SST] [${MODULE_NAME}]`,
      `A critical error occurred in renderTracker for message ID ${mesId}. Please check the console. Error: ${error.stack}`
    );
  }
};

const renderTrackerWithoutSim = (mesId, get_settings, compiledWrapperTemplate, compiledCardTemplate, getReactionEmoji, darkenColor, lastSimJsonString) => {
  try {
    if (!get_settings("isEnabled")) return;

    const context = getContext();
    const message = context.chat[mesId];

    if (!message) {
      console.log(`[SST] [${MODULE_NAME}]`, `Error: Could not find message with ID ${mesId}. Aborting render.`);
      return;
    }

    // Use the template position from the templating module
    const templatePosition = currentTemplatePosition;
    
    const messageElement = document.querySelector(
      `div[mesid="${mesId}"] .mes_text`
    );
    
    // For non-positioned templates, we need the message element in DOM
    // For positioned templates (LEFT/RIGHT), we can proceed without it
    if (!messageElement && templatePosition !== "LEFT" && templatePosition !== "RIGHT") {
      console.log(`[SST] [${MODULE_NAME}]`, `Message element not found in DOM for mesId ${mesId}, skipping render for non-positioned template`);
      return;
    }

    const identifier = get_settings("codeBlockIdentifier");
    let displayMessage = message.mes;

    // Only format and display message content if we have a message element
    if (messageElement) {
      // Hide sim blocks if the setting is enabled
      if (get_settings("hideSimBlocks")) {
        const hideRegex = new RegExp("```" + identifier + "[\\s\\S]*?```", "gm");
        displayMessage = displayMessage.replace(
          hideRegex,
          (match) => `<div style="display: none;">\n${match}\n</div>`
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
    }

    // Parse the sim data from the original message content (not the hidden version)
    const dataMatch = message.mes.match(
      new RegExp("```" + identifier + "[\\s\\S]*?```", "m")
    );

    if (dataMatch && dataMatch[0]) {
      // Remove the container if it already exists to prevent duplication on re-renders
      // Only do this if we have a message element (for non-positioned templates)
      if (messageElement) {
        const existingContainer = messageElement.querySelector(
          `#${CONTAINER_ID}`
        );
        if (existingContainer) {
          existingContainer.remove();
        }
      }

      const jsonContent = dataMatch[0]
        .replace(/```/g, "")
        .replace(new RegExp(`^${identifier}\s*`), "")
        .trim();

      // Update lastSimJsonString
      lastSimJsonString = jsonContent;

      // Remove any preparing text (only if messageElement exists)
      if (messageElement) {
        const preparingText = messageElement.parentNode.querySelector(".sst-preparing-text");
        if (preparingText) {
          preparingText.remove();
          // Remove this mesText from the set since it no longer has preparing text
          mesTextsWithPreparingText.delete(messageElement);
        }
      }

      let jsonData;

      try {
        // Use our new universal parser that can handle both JSON and YAML
        jsonData = parseTrackerData(jsonContent);
        console.log(`[SST] [${MODULE_NAME}]`, `Successfully parsed tracker data for message ${mesId}`);
      } catch (parseError) {
        console.log(`[SST] [${MODULE_NAME}]`,
          `Failed to parse tracker data in message ID ${mesId}. Error: ${parseError.message}`
        );
        // Only show error in message element if it exists
        if (messageElement) {
          const errorHtml = `<div style="color: red; font-family: monospace;">[SillySimTracker] Error: Invalid tracker data format in code block.</div>`;
          messageElement.insertAdjacentHTML("beforeend", errorHtml);
        }
        return;
      }

      if (typeof jsonData !== "object" || jsonData === null) {
        console.log(`[SST] [${MODULE_NAME}]`, `Parsed data in message ID ${mesId} is not a valid object.`);
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

      // Calculate stat changes for all characters
      const statChanges = calculateStatChanges(characterList, lastSimJsonString);

      // For tabbed templates, we need to pass all characters to the template
      const templateFile = get_settings("templateFile");
      const customTemplateHtml = get_settings("customTemplateHtml");
      const isTabbedTemplate = templateFile.includes("tabs") ||
                               (customTemplateHtml && customTemplateHtml.includes("sim-tracker-tabs"));

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
            const changes = statChanges[name] || {};
            return {
              characterName: name,
              currentDate: currentDate,
              currentTime: currentTime,
              stats: {
                ...stats,
                ...changes,
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
        let templateData = {
          characters: charactersData,
          currentDate: currentDate,
          currentTime: currentTime,
        };
        
        // Execute bundled template logic if it exists
        templateData = executeTemplateLogic(templateData, 'tabbed');

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
            const changes = statChanges[name] || {};
            let cardData = {
              characterName: name,
              currentDate: currentDate,
              currentTime: currentTime,
              stats: {
                ...stats,
                ...changes,
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
            
            // Execute bundled template logic if it exists
            cardData = executeTemplateLogic(cardData, 'single');
            
            return compiledCardTemplate(cardData);
          })
          .join("");
      }

      // Handle different positions
      console.log(`[SST] [${MODULE_NAME}]`, `Rendering tracker for position: ${templatePosition}, mesId: ${mesId}`);
      switch (templatePosition) {
        case "TOP":
          // Insert above the message content (inside the message block)
          if (messageElement) {
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
          }
          break;
        case "LEFT":
          // Update the global left sidebar with the latest data
          console.log(`[SST] [${MODULE_NAME}]`, `Calling updateLeftSidebar for mesId ${mesId}`);
          updateLeftSidebar(compiledWrapperTemplate({ cardsHtml }));
          break;
        case "RIGHT":
          // Update the global right sidebar with the latest data
          console.log(`[SST] [${MODULE_NAME}]`, `Calling updateRightSidebar for mesId ${mesId}`);
          updateRightSidebar(compiledWrapperTemplate({ cardsHtml }));
          break;
        case "MACRO":
          // For MACRO position, replace the placeholder in the message
          if (messageElement) {
            const placeholder = messageElement.querySelector(
              "#sst-macro-placeholder"
            );
            if (placeholder) {
              const finalHtml = compiledWrapperTemplate({ cardsHtml });
              placeholder.insertAdjacentHTML("beforebegin", finalHtml);
              placeholder.remove();
            }
          }
          break;
        case "BOTTOM":
        default:
          // Add a horizontal divider before the cards
          if (messageElement) {
            const finalHtml =
              `<hr style="margin-top: 15px; margin-bottom: 20px;">` +
              compiledWrapperTemplate({ cardsHtml });
            messageElement.insertAdjacentHTML("beforeend", finalHtml);
          }
          break;
      }
    }
  } catch (error) {
    console.log(`[SST] [${MODULE_NAME}]`,
      `A critical error occurred in renderTrackerWithoutSim for message ID ${mesId}. Please check the console. Error: ${error.stack}`
    );
  }
};

const refreshAllCards = (get_settings, CONTAINER_ID, renderTrackerWithoutSim) => {
  console.log(`[SST] [${MODULE_NAME}]`, "Refreshing all tracker cards on screen.");

  // ALWAYS clear all existing containers and sidebars first when refreshing
  // This ensures a clean state when switching templates and prevents duplicate cards
  console.log(`[SST] [${MODULE_NAME}]`, "Clearing all existing tracker containers and sidebars");
  
  // Remove all container elements from the DOM
  document.querySelectorAll(`#${CONTAINER_ID}`).forEach((container) => {
    console.log(`[SST] [${MODULE_NAME}]`, "Removing container:", container);
    container.remove();
  });
  
  // Remove all sidebars
  removeGlobalSidebars();
  
  // Note: We do NOT clear the DOM measurement cache here, as that would interfere
  // with the viewport handler's ability to detect if templates use DOM helpers.
  // Cache clearing happens in the viewport handler only.

  // Get all message divs currently in the chat DOM
  const visibleMessages = document.querySelectorAll("div#chat .mes");
  
  // For positioned templates (LEFT/RIGHT/TOP/BOTTOM), we only want to show the most recent sim data
  // So we need to find the last message with sim data first
  const templatePosition = currentTemplatePosition;
  
  console.log(`[SST] [${MODULE_NAME}]`, `Template position: ${templatePosition}`);
  
  if (templatePosition === "LEFT" || templatePosition === "RIGHT" || templatePosition === "TOP" || templatePosition === "BOTTOM") {
    // Find the last message with sim data by checking the context.chat array directly
    // This is more reliable than checking DOM, especially during chat switching
    const context = getContext();
    const chat = context.chat;
    
    let lastMessageWithSim = null;
    
    if (chat && Array.isArray(chat)) {
      // Iterate backwards through the chat to find the most recent message with sim data
      for (let i = chat.length - 1; i >= 0; i--) {
        const message = chat[i];
        if (message) {
          const identifier = get_settings("codeBlockIdentifier");
          const dataMatch = message.mes.match(
            new RegExp("```" + identifier + "[\\s\\S]*?```", "m")
          );
          if (dataMatch && dataMatch[0]) {
            lastMessageWithSim = i;
            console.log(`[SST] [${MODULE_NAME}]`, `Found sim data in context.chat[${i}]`);
            break;
          }
        }
      }
    }
    
    // Only render the last message with sim data for positioned templates
    // This will create new sidebars/positioned cards at the correct position
    if (lastMessageWithSim !== null) {
      console.log(`[SST] [${MODULE_NAME}]`, `Rendering positioned template for message ${lastMessageWithSim}`);
      renderTrackerWithoutSim(lastMessageWithSim);
    } else {
      // If no message with sim data found, sidebars were already removed above
      console.log(`[SST] [${MODULE_NAME}]`, "No sim data found in chat, positioned elements removed");
    }
  } else {
    // For non-positioned templates (MACRO), render all messages
    visibleMessages.forEach((messageElement) => {
      const mesId = messageElement.getAttribute("mesid");
      if (mesId) {
        renderTrackerWithoutSim(parseInt(mesId, 10));
      }
    });
  }
};

// Helper function to get and clear pending sidebar content
const getPendingLeftSidebarContent = () => {
  const content = pendingLeftSidebarContent;
  pendingLeftSidebarContent = null;
  return content;
};

const getPendingRightSidebarContent = () => {
  const content = pendingRightSidebarContent;
  pendingRightSidebarContent = null;
  return content;
};

/**
 * Initialize viewport change detection
 * This ensures templates re-render when viewport dimensions change
 * Only re-renders if the template actually uses DOM measurement helpers
 */
const initializeViewportChangeHandler = (get_settings) => {
  if (isViewportChangeHandlerInitialized) {
    console.log(`[SST] [${MODULE_NAME}]`, "Viewport change handler already initialized");
    return;
  }
  
  console.log(`[SST] [${MODULE_NAME}]`, "Initializing viewport change detection");
  
  // Use debounced handler to avoid excessive re-renders
  const handleViewportChange = DOMUtils.debounce(() => {
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;
    
    // Only re-render if dimensions actually changed
    if (currentWidth !== lastViewportWidth || currentHeight !== lastViewportHeight) {
      console.log(`[SST] [${MODULE_NAME}]`, 
        `Viewport changed from ${lastViewportWidth}x${lastViewportHeight} to ${currentWidth}x${currentHeight}`
      );
      
      lastViewportWidth = currentWidth;
      lastViewportHeight = currentHeight;
      
      // Check if the template actually uses DOM helpers by checking if cache has entries
      // This way we only re-render templates that opt-in by using DOM measurement helpers
      const wasCacheUsed = clearDomMeasurementCache(); // Returns true if cache had entries
      
      // Only re-render if the template was using DOM measurements
      if (wasCacheUsed && get_settings && get_settings("isEnabled")) {
        console.log(`[SST] [${MODULE_NAME}]`, "Template uses DOM helpers - refreshing cards after viewport change");
        refreshAllCards(get_settings, CONTAINER_ID, renderTrackerWithoutSim);
      } else if (!wasCacheUsed) {
        console.log(`[SST] [${MODULE_NAME}]`, "Template doesn't use DOM helpers - skipping refresh");
      }
    }
  }, 250); // Debounce for 250ms to avoid excessive re-renders
  
  // Listen for window resize
  window.addEventListener('resize', handleViewportChange);
  
  // Listen for orientation change (mobile devices)
  window.addEventListener('orientationchange', () => {
    // Orientation change needs a slight delay for viewport to update
    setTimeout(handleViewportChange, 100);
  });
  
  isViewportChangeHandlerInitialized = true;
  console.log(`[SST] [${MODULE_NAME}]`, "Viewport change detection initialized successfully");
};

/**
 * Manually trigger DOM measurement cache clear and re-render
 * Useful for external code that needs to force a layout update
 */
const forceLayoutUpdate = (get_settings) => {
  console.log(`[SST] [${MODULE_NAME}]`, "Forcing layout update");
  clearDomMeasurementCache();
  
  if (get_settings && get_settings("isEnabled")) {
    refreshAllCards(get_settings, CONTAINER_ID, renderTrackerWithoutSim);
  }
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
  getPendingLeftSidebarContent,
  getPendingRightSidebarContent,
  setGenerationInProgress,
  getGenerationInProgress,
  initializeViewportChangeHandler,
  forceLayoutUpdate,
  flushPendingSidebarUpdates,
  CONTAINER_ID
};
