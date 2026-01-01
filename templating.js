// templating.js - Handlebar replacements and template parsing
import DOMUtils from './sthelpers/domUtils.js';

const MODULE_NAME = "silly-sim-tracker";

// Module-level variable to store the current template position
let currentTemplatePosition = "BOTTOM";

// Module-level variable to store the current template's bundled JavaScript logic
let currentTemplateLogic = null;

// Module-level variable to store the current template configuration (for inline templates, etc.)
let currentTemplateConfig = null;

// Module-level variable to store the tabs interaction type for tabbed templates
// 'toggle' = click same tab to expand/retract (default for sidebars)
// 'switching' = click different tabs to switch between them
let currentTabsType = "toggle";

// Module-level cache for DOM measurements to avoid repeated queries
let domMeasurementCache = new Map();
let cacheTimestamp = 0;
const CACHE_DURATION = 100; // Cache measurements for 100ms to avoid excessive queries

const unescapeHtml = (safe) => {
  if (typeof safe !== "string") return safe;
  return safe
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
};

// --- TEMPLATES ---
const wrapperTemplate = `<div id="silly-sim-tracker-container" style="width:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">{{{cardsHtml}}}</div>`;
let compiledWrapperTemplate = Handlebars.compile(wrapperTemplate);
let compiledCardTemplate = null;

// Register Handlebars helpers for template logic
Handlebars.registerHelper("eq", function (a, b) {
  return a === b;
});

Handlebars.registerHelper("gt", function (a, b) {
  return a > b;
});

Handlebars.registerHelper("gte", function (a, b) {
  return a >= b;
});

Handlebars.registerHelper("abs", function (a) {
  if (typeof a !== "number") {
    return 0;
  }
  return Math.abs(a);
});

Handlebars.registerHelper("multiply", function (a, b) {
  if (typeof a !== "number" || typeof b !== "number") {
    return 0;
  }
  return a * b;
});

Handlebars.registerHelper("subtract", function (a, b) {
  if (typeof a !== "number" || typeof b !== "number") {
    return 0;
  }
  return a - b;
});

Handlebars.registerHelper("add", function (a, b) {
  if (typeof a !== "number" || typeof b !== "number") {
    return 0;
  }
  return a + b;
});

Handlebars.registerHelper("divide", function (a, b) {
  if (typeof a !== "number" || typeof b !== "number" || b === 0) {
    return 0;
  }
  return a / b;
});

Handlebars.registerHelper("divideRoundUp", function (a, b) {
  if (typeof a !== "number" || typeof b !== "number" || b === 0) {
    return 0;
  }
  return Math.ceil(a / b);
});

// === HSL COLOR CONVERSION UTILITIES ===

/**
 * Convert RGB values to HSL
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {Object} {h: 0-360, s: 0-100, l: 0-100}
 */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL values to RGB
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {Object} {r: 0-255, g: 0-255, b: 0-255}
 */
function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

Handlebars.registerHelper(
  "adjustColorBrightness",
  function (hexColor, brightnessPercent) {
    // Remove # if present
    hexColor = hexColor.replace("#", "");

    // Parse hex to RGB
    let r = parseInt(hexColor.substring(0, 2), 16);
    let g = parseInt(hexColor.substring(2, 4), 16);
    let b = parseInt(hexColor.substring(4, 6), 16);

    // Adjust brightness (0-100% where 100% is original, 50% is half brightness, etc.)
    brightnessPercent = Math.max(0, Math.min(100, brightnessPercent)) / 100;

    // Apply brightness adjustment
    r = Math.min(255, Math.max(0, Math.floor(r * brightnessPercent)));
    g = Math.min(255, Math.max(0, Math.floor(g * brightnessPercent)));
    b = Math.min(255, Math.max(0, Math.floor(b * brightnessPercent)));

    // Convert back to hex
    return `#${r.toString(16).padStart(2, "0")}${g
      .toString(16)
      .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
);

/**
 * Adjust color using HSL values
 * Usage: {{adjustHSL "#ff0000" 30 0 -10}}
 *   - hueShift: degrees to shift hue (0-360, wraps around)
 *   - saturationAdjust: percentage to add/subtract from saturation (-100 to 100)
 *   - lightnessAdjust: percentage to add/subtract from lightness (-100 to 100)
 */
Handlebars.registerHelper("adjustHSL", function (hexColor, hueShift, saturationAdjust, lightnessAdjust) {
  // Validate inputs
  if (!hexColor || typeof hexColor !== 'string') return "#000000";
  hueShift = typeof hueShift === 'number' ? hueShift : 0;
  saturationAdjust = typeof saturationAdjust === 'number' ? saturationAdjust : 0;
  lightnessAdjust = typeof lightnessAdjust === 'number' ? lightnessAdjust : 0;

  // Parse hex to RGB
  hexColor = hexColor.replace("#", "");
  const r = parseInt(hexColor.substring(0, 2), 16);
  const g = parseInt(hexColor.substring(2, 4), 16);
  const b = parseInt(hexColor.substring(4, 6), 16);

  // Convert to HSL
  let hsl = rgbToHsl(r, g, b);

  // Apply adjustments
  hsl.h = (hsl.h + hueShift) % 360;
  if (hsl.h < 0) hsl.h += 360;  // Handle negative hue
  hsl.s = Math.max(0, Math.min(100, hsl.s + saturationAdjust));
  hsl.l = Math.max(0, Math.min(100, hsl.l + lightnessAdjust));

  // Convert back to RGB
  const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);

  // Return hex
  return `#${rgb.r.toString(16).padStart(2, "0")}${rgb.g.toString(16).padStart(2, "0")}${rgb.b.toString(16).padStart(2, "0")}`;
});

Handlebars.registerHelper("tabZIndex", function (index) {
  // Calculate z-index for tabs (higher for first tabs)
  // This creates a stacking effect where the first tab is on top
  return 5 - index;
});

Handlebars.registerHelper("tabOffset", function (index) {
  // Calculate vertical offset for tabs to prevent overlapping
  // Each tab is about 60px high, so we offset by 65px to add some spacing
  return index * 65;
});

Handlebars.registerHelper("initials", function (name) {
  // Extract the first letter of the name and capitalize it
  if (!name || name.length === 0) return "?";
  return name.charAt(0).toUpperCase();
});

Handlebars.registerHelper("rawFirstLetter", function (name) {
  // Extract the first letter of the name without any formatting
  if (!name || typeof name !== 'string' || name.length === 0) return "?";
  return name.charAt(0);
});

// === STRING TRANSFORMATION HELPERS ===

/**
 * Convert string to lowercase with underscores
 * Usage: {{slugifyUnderscore character.name}}
 * "John Doe" → "john_doe"
 */
Handlebars.registerHelper("slugifyUnderscore", function (name) {
  if (!name || typeof name !== 'string') return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')    // Remove special chars except spaces/dashes
    .replace(/[\s-]+/g, '_');     // Replace spaces/dashes with underscores
});

/**
 * Convert string to lowercase with dashes
 * Usage: {{slugifyDash character.name}}
 * "John Doe" → "john-doe"
 */
Handlebars.registerHelper("slugifyDash", function (name) {
  if (!name || typeof name !== 'string') return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')    // Remove special chars except spaces/dashes
    .replace(/[\s_]+/g, '-');     // Replace spaces/underscores with dashes
});

/**
 * Convert string to camelCase
 * Usage: {{camelCase character.name}}
 * "John Doe" → "johnDoe"
 */
Handlebars.registerHelper("camelCase", function (name) {
  if (!name || typeof name !== 'string') return "";
  return name
    .trim()
    .replace(/[^\w\s]/g, '')     // Remove special chars
    .split(/\s+/)                 // Split on whitespace
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
});

Handlebars.registerHelper("unless", function (conditional, options) {
  if (!conditional) {
    return options.fn(this);
  } else {
    return options.inverse(this);
  }
});

// === DOM MEASUREMENT HELPERS ===

/**
 * Helper to get cached measurement or compute new one
 */
function getCachedMeasurement(key, computeFn) {
  const now = Date.now();
  
  // Clear cache if it's expired
  if (now - cacheTimestamp > CACHE_DURATION) {
    domMeasurementCache.clear();
    cacheTimestamp = now;
  }
  
  if (!domMeasurementCache.has(key)) {
    domMeasurementCache.set(key, computeFn());
  }
  
  return domMeasurementCache.get(key);
}

/**
 * Get viewport width
 * Usage: {{viewportWidth}}
 */
Handlebars.registerHelper("viewportWidth", function() {
  return getCachedMeasurement('viewport-width', () => {
    return window.innerWidth || document.documentElement.clientWidth;
  });
});

/**
 * Get viewport height
 * Usage: {{viewportHeight}}
 */
Handlebars.registerHelper("viewportHeight", function() {
  return getCachedMeasurement('viewport-height', () => {
    return window.innerHeight || document.documentElement.clientHeight;
  });
});

/**
 * Get distance from element to viewport edge
 * Usage: {{distanceToEdge "sheld" "left"}} or {{distanceToEdge "#my-element" "right"}}
 * Edges: "left", "right", "top", "bottom"
 */
Handlebars.registerHelper("distanceToEdge", function(selector, edge) {
  const cacheKey = `distance-${selector}-${edge}`;
  
  return getCachedMeasurement(cacheKey, () => {
    const distances = DOMUtils.getDistanceToViewport(selector);
    if (!distances) return 0;
    
    const edgeLower = String(edge).toLowerCase();
    return distances[edgeLower] || 0;
  });
});

/**
 * Get distance between two elements
 * Usage: {{distanceBetween "sheld" "#chat" "horizontal"}}
 * Types: "horizontal", "vertical", "diagonal"
 */
Handlebars.registerHelper("distanceBetween", function(selector1, selector2, type) {
  const cacheKey = `distance-between-${selector1}-${selector2}-${type}`;
  
  return getCachedMeasurement(cacheKey, () => {
    const distance = DOMUtils.getDistanceBetween(selector1, selector2);
    if (!distance) return 0;
    
    const typeLower = String(type).toLowerCase();
    return distance[typeLower] || 0;
  });
});

/**
 * Get element width
 * Usage: {{elementWidth "sheld"}} or {{elementWidth "#my-element"}}
 */
Handlebars.registerHelper("elementWidth", function(selector) {
  const cacheKey = `width-${selector}`;
  
  return getCachedMeasurement(cacheKey, () => {
    const rect = DOMUtils.getRect(selector);
    return rect ? rect.width : 0;
  });
});

/**
 * Get element height
 * Usage: {{elementHeight "sheld"}}
 */
Handlebars.registerHelper("elementHeight", function(selector) {
  const cacheKey = `height-${selector}`;
  
  return getCachedMeasurement(cacheKey, () => {
    const rect = DOMUtils.getRect(selector);
    return rect ? rect.height : 0;
  });
});

/**
 * Get element position (top)
 * Usage: {{elementTop "sheld"}}
 */
Handlebars.registerHelper("elementTop", function(selector) {
  const cacheKey = `top-${selector}`;
  
  return getCachedMeasurement(cacheKey, () => {
    const rect = DOMUtils.getRect(selector);
    return rect ? rect.top : 0;
  });
});

/**
 * Get element position (left)
 * Usage: {{elementLeft "sheld"}}
 */
Handlebars.registerHelper("elementLeft", function(selector) {
  const cacheKey = `left-${selector}`;
  
  return getCachedMeasurement(cacheKey, () => {
    const rect = DOMUtils.getRect(selector);
    return rect ? rect.left : 0;
  });
});

/**
 * Get element position (right)
 * Usage: {{elementRight "sheld"}}
 */
Handlebars.registerHelper("elementRight", function(selector) {
  const cacheKey = `right-${selector}`;
  
  return getCachedMeasurement(cacheKey, () => {
    const rect = DOMUtils.getRect(selector);
    return rect ? rect.right : 0;
  });
});

/**
 * Get element position (bottom)
 * Usage: {{elementBottom "sheld"}}
 */
Handlebars.registerHelper("elementBottom", function(selector) {
  const cacheKey = `bottom-${selector}`;
  
  return getCachedMeasurement(cacheKey, () => {
    const rect = DOMUtils.getRect(selector);
    return rect ? rect.bottom : 0;
  });
});

/**
 * Get element offset from document top
 * Usage: {{elementOffsetTop "sheld"}}
 */
Handlebars.registerHelper("elementOffsetTop", function(selector) {
  const cacheKey = `offset-top-${selector}`;
  
  return getCachedMeasurement(cacheKey, () => {
    const offset = DOMUtils.getOffset(selector);
    return offset ? offset.top : 0;
  });
});

/**
 * Get element offset from document left
 * Usage: {{elementOffsetLeft "sheld"}}
 */
Handlebars.registerHelper("elementOffsetLeft", function(selector) {
  const cacheKey = `offset-left-${selector}`;
  
  return getCachedMeasurement(cacheKey, () => {
    const offset = DOMUtils.getOffset(selector);
    return offset ? offset.left : 0;
  });
});

/**
 * Get computed style property of an element
 * Usage: {{elementStyle "sheld" "backgroundColor"}}
 */
Handlebars.registerHelper("elementStyle", function(selector, property) {
  const cacheKey = `style-${selector}-${property}`;
  
  return getCachedMeasurement(cacheKey, () => {
    return DOMUtils.getStyle(selector, property) || '';
  });
});

/**
 * Get space between sheld and viewport edge
 * Usage: {{sheldSpaceLeft}} or {{sheldSpaceRight}}
 */
Handlebars.registerHelper("sheldSpaceLeft", function() {
  return getCachedMeasurement('sheld-space-left', () => {
    const distances = DOMUtils.getDistanceToViewport('sheld');
    return distances ? distances.left : 0;
  });
});

Handlebars.registerHelper("sheldSpaceRight", function() {
  return getCachedMeasurement('sheld-space-right', () => {
    const distances = DOMUtils.getDistanceToViewport('sheld');
    return distances ? distances.right : 0;
  });
});

Handlebars.registerHelper("sheldSpaceTop", function() {
  return getCachedMeasurement('sheld-space-top', () => {
    const distances = DOMUtils.getDistanceToViewport('sheld');
    return distances ? distances.top : 0;
  });
});

Handlebars.registerHelper("sheldSpaceBottom", function() {
  return getCachedMeasurement('sheld-space-bottom', () => {
    const distances = DOMUtils.getDistanceToViewport('sheld');
    return distances ? distances.bottom : 0;
  });
});

/**
 * Get space between chat and viewport edge
 * Usage: {{chatSpaceLeft}} or {{chatSpaceRight}}
 */
Handlebars.registerHelper("chatSpaceLeft", function() {
  return getCachedMeasurement('chat-space-left', () => {
    const distances = DOMUtils.getDistanceToViewport('#chat');
    return distances ? distances.left : 0;
  });
});

Handlebars.registerHelper("chatSpaceRight", function() {
  return getCachedMeasurement('chat-space-right', () => {
    const distances = DOMUtils.getDistanceToViewport('#chat');
    return distances ? distances.right : 0;
  });
});

Handlebars.registerHelper("chatSpaceTop", function() {
  return getCachedMeasurement('chat-space-top', () => {
    const distances = DOMUtils.getDistanceToViewport('#chat');
    return distances ? distances.top : 0;
  });
});

Handlebars.registerHelper("chatSpaceBottom", function() {
  return getCachedMeasurement('chat-space-bottom', () => {
    const distances = DOMUtils.getDistanceToViewport('#chat');
    return distances ? distances.bottom : 0;
  });
});

/**
 * Calculate width of space beside chat/sheld
 * Usage: {{sidebarAvailableWidth "left"}} or {{sidebarAvailableWidth "right"}}
 */
Handlebars.registerHelper("sidebarAvailableWidth", function(side) {
  const cacheKey = `sidebar-available-${side}`;
  
  return getCachedMeasurement(cacheKey, () => {
    const sideLower = String(side).toLowerCase();
    
    // Get sheld and chat positions
    const sheldRect = DOMUtils.getRect('sheld');
    const chatRect = DOMUtils.getRect('#chat');
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    
    if (!sheldRect && !chatRect) return 0;
    
    if (sideLower === 'left') {
      // Space to the left of both sheld and chat
      const sheldLeft = sheldRect ? sheldRect.left : viewportWidth;
      const chatLeft = chatRect ? chatRect.left : viewportWidth;
      return Math.min(sheldLeft, chatLeft);
    } else if (sideLower === 'right') {
      // Space to the right of both sheld and chat
      const sheldRight = sheldRect ? sheldRect.right : 0;
      const chatRight = chatRect ? chatRect.right : 0;
      const rightEdge = Math.max(sheldRight, chatRight);
      return viewportWidth - rightEdge;
    }
    
    return 0;
  });
});

/**
 * Get available height for sidebar (viewport height)
 * Usage: {{sidebarAvailableHeight}}
 */
Handlebars.registerHelper("sidebarAvailableHeight", function() {
  return getCachedMeasurement('sidebar-available-height', () => {
    return window.innerHeight || document.documentElement.clientHeight;
  });
});

/**
 * Check if element exists in DOM
 * Usage: {{#if (elementExists "sheld")}}...{{/if}}
 */
Handlebars.registerHelper("elementExists", function(selector) {
  const element = DOMUtils.query(selector);
  return element !== null;
});

/**
 * Clear the DOM measurement cache (useful for forcing re-measurement)
 * @returns {boolean} True if the cache had entries (template was using DOM helpers)
 */
function clearDomMeasurementCache() {
  const hadEntries = domMeasurementCache.size > 0;
  domMeasurementCache.clear();
  cacheTimestamp = 0;
  return hadEntries;
}

// Function to extract template position from HTML
const extractTemplatePosition = (templateHtml) => {
  if (!templateHtml) return "BOTTOM";
  
  const positionRegex = /<!--\s*POSITION\s*:\s*(.*?)\s*-->/i;
  const positionMatch = templateHtml.match(positionRegex);
  return positionMatch ? positionMatch[1].trim().toUpperCase() : "BOTTOM";
};

// Function to extract bundled JavaScript logic from template HTML
const extractTemplateLogic = (templateHtml) => {
  if (!templateHtml) return null;
  
  // Look for <script type="text/x-handlebars-template-logic">...</script>
  const scriptRegex = /<script\s+type=["']text\/x-handlebars-template-logic["'][^>]*>([\s\S]*?)<\/script>/i;
  const scriptMatch = templateHtml.match(scriptRegex);
  
  if (scriptMatch && scriptMatch[1]) {
    const logic = scriptMatch[1].trim();
    console.log(`[SST] [${MODULE_NAME}]`, `Extracted template logic (${logic.length} characters)`);
    return logic;
  }
  
  return null;
};

const get_extension_directory = () => {
  const index_path = new URL(import.meta.url).pathname;
  return index_path.substring(0, index_path.lastIndexOf("/"));
};

async function populateTemplateDropdown(get_settings) {
  console.log(`[SST] [${MODULE_NAME}]`, "Populating template dropdown with parsed friendly names...");

  const defaultFiles = [
    "wide-style-tracker.json",
    "dating-card-template.json",
    "dating-card-template-positioned.json",
    "dating-card-template-sidebar.json",
    "dating-card-template-sidebar-left.json",
    "dating-card-template-sidebar-tabs.json",
    "dating-card-template-sidebar-left-tabs.json",
    "dating-card-template-macro.json",
    "disposition-card-template-sidebar-tabs.json",
    "tactical-hud-sidebar-tabs.json",
    "bento-style-tracker.json"
  ];

  const templateOptions = [];

  // Process default templates
  await Promise.all(
    defaultFiles.map(async (filename) => {
      const filePath = `${get_extension_directory()}/tracker-card-templates/${filename}`;
      let friendlyName = filename.replace(".json", ""); // Default to filename as a fallback

      try {
        const content = await $.get(filePath);
        let jsonData;
        
        // Try to parse as JSON first
        try {
          // jQuery may automatically parse JSON responses, so we need to check if it's already an object
          jsonData = typeof content === "string" ? JSON.parse(content) : content;
        } catch (jsonError) {
          // If JSON parsing fails, log the error and skip this template
          console.error(
            `Could not parse JSON for template ${filename}:`,
            jsonError
          );
          // If parsing fails, add it to the list with its filename so it's not missing
          templateOptions.push({ filename, friendlyName: filename.replace(".json", ""), type: "default" });
          return;
        }

        const templateName = jsonData.templateName || null;
        const author = jsonData.templateAuthor || null;

        if (templateName && author) {
          friendlyName = `${templateName} - by ${author}`;
        } else if (templateName) {
          friendlyName = templateName;
        }

        templateOptions.push({ filename, friendlyName, type: "default" });
      } catch (error) {
        console.error(
          `Could not fetch or parse template info for ${filename}:`,
          error
        );
        // If fetching fails, add it to the list with its filename so it's not missing
        templateOptions.push({ filename, friendlyName: filename.replace(".json", ""), type: "default" });
      }
    })
  );

  // Process user presets
  const userPresets = get_settings ? get_settings("userPresets") || [] : [];
  userPresets.forEach((preset, index) => {
    try {
      const templateName = preset.templateName || `User Preset ${index + 1}`;
      const author = preset.templateAuthor || "Unknown";

      const friendlyName = `${templateName} - by ${author} (User Preset)`;
      const filename = `user-preset-${index}`; // Unique identifier for user presets

      templateOptions.push({ 
        filename, 
        friendlyName, 
        type: "user",
        presetData: preset // Store the preset data for later use
      });
    } catch (error) {
      console.error(
        `Could not process user preset ${index}:`,
        error
      );
    }
  });

  // Sort the results alphabetically by friendly name for a clean list
  templateOptions.sort((a, b) => a.friendlyName.localeCompare(b.friendlyName));

  console.log(`[SST] [${MODULE_NAME}]`, "Template options to be added to dropdown:", templateOptions);

  const $select = $("#templateFile");
  const currentSelection = get_settings ? get_settings("templateFile") : null;

  $select.empty();
  templateOptions.forEach((option) => {
    $select.append(
      $("<option>", {
        value: option.filename,
        text: option.friendlyName,
        "data-type": option.type, // Store type as data attribute
        "data-preset": option.presetData ? JSON.stringify(option.presetData) : undefined // Store preset data as data attribute
      })
    );
  });

  // Restore the user's selection
  $select.val(currentSelection);
  console.log(`[SST] [${MODULE_NAME}]`, "Template dropdown populated with friendly names.");
}

function handleCustomTemplateUpload(event, set_settings, loadTemplate, refreshAllCards) {
  const file = event.target.files[0];
  if (!file) {
    return; // User cancelled the dialog
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = e.target.result;
    console.log(`[SST] [${MODULE_NAME}]`, `Read custom template ${file.name}, size: ${content.length}`);
    set_settings("customTemplateHtml", content);
    toastr.success(`Custom template "${file.name}" loaded and applied!`);

    // Immediately reload the template logic and refresh all cards
    await loadTemplate();
    refreshAllCards();
  };
  reader.readAsText(file);

  event.target.value = "";
}

// Load template from file
const loadTemplate = async (get_settings, set_settings) => {
  if (!get_settings || !set_settings) {
    console.error(`[SST] [${MODULE_NAME}]`, "loadTemplate called without required get_settings and set_settings functions");
    return;
  }
  
  const customTemplateHtml = get_settings("customTemplateHtml");

  if (customTemplateHtml && customTemplateHtml.trim() !== "") {
    console.log(`[SST] [${MODULE_NAME}]`, "Loading template from custom HTML stored in settings.");
    try {
      const cardStartMarker = "<!-- CARD_TEMPLATE_START -->";
      const cardEndMarker = "<!-- CARD_TEMPLATE_END -->";
      let cardTemplate = "";

      // Extract position metadata from the templatePosition setting or default to BOTTOM
      const templatePosition = get_settings("templatePosition") || extractTemplatePosition(customTemplateHtml) || "BOTTOM";

      const startIndex = customTemplateHtml.indexOf(cardStartMarker);
      const endIndex = customTemplateHtml.indexOf(cardEndMarker);

      if (startIndex !== -1 && endIndex !== -1) {
        cardTemplate = customTemplateHtml
          .substring(startIndex + cardStartMarker.length, endIndex)
          .trim();
      } else {
        let cleanedResponse = customTemplateHtml
          .replace(/<!--[\s\S]*?-->/g, "")
          .trim();
        const templateVarRegex = /\{\{[^}]+\}\}/;
        const divMatches = [
          ...cleanedResponse.matchAll(/<div[^>]*>[\s\S]*?<\/div>/g),
        ];
        let bestMatch = null;
        let maxLength = 0;
        for (const match of divMatches) {
          if (templateVarRegex.test(match[0]) && match[0].length > maxLength) {
            bestMatch = match[0];
            maxLength = match[0].length;
          }
        }
        if (bestMatch) {
          cardTemplate = bestMatch;
        } else {
          throw new Error(
            "Could not find template content with either markers or Handlebars variables."
          );
        }
      }

          // Extract bundled JavaScript logic from the custom template
          currentTemplateLogic = extractTemplateLogic(customTemplateHtml);

          // Extract tabsType from HTML comment if present (<!-- TABS_TYPE: toggle|switching|unmanaged -->)
          const tabsTypeRegex = /<!--\s*TABS_TYPE\s*:\s*(toggle|switching|unmanaged)\s*-->/i;
          const tabsTypeMatch = customTemplateHtml.match(tabsTypeRegex);
          currentTabsType = tabsTypeMatch ? tabsTypeMatch[1].toLowerCase() : "toggle";

          // Store template config (note: custom HTML templates loaded directly don't have a JSON config)
          currentTemplateConfig = {
            templatePosition: templatePosition,
            tabsType: currentTabsType,
            inlineTemplatesEnabled: false, // Custom HTML templates don't support inline templates by default
            inlineTemplates: []
          };

          compiledCardTemplate = Handlebars.compile(cardTemplate);
      // Store the template position in a module-level variable for use during rendering
      currentTemplatePosition = templatePosition;
      console.log(`[SST] [${MODULE_NAME}]`,
        `Custom HTML template compiled successfully. Position: ${templatePosition}`
      );
      return; // Exit successfully
    } catch (error) {
      console.log(`[SST] [${MODULE_NAME}]`,
        `Error parsing custom HTML template: ${error.message}. Reverting to default file-based template.`
      );
      toastr.error(
        "The custom HTML template could not be parsed. Check its format.",
        "Template Error"
      );
    }
  }

  const templateFile = get_settings("templateFile");
  if (templateFile) {
    // Check if this is a user preset
    if (templateFile.startsWith("user-preset-")) {
      try {
        // Get the selected option to retrieve the preset data
        const $select = $("#templateFile");
        const $selectedOption = $select.find(`option[value="${templateFile}"]`);
        const presetData = $selectedOption.data("preset");
        
        if (presetData) {
          console.log(`[SST] [${MODULE_NAME}]`, `Loading template from user preset: ${templateFile}`);
          
          // Extract position metadata from the preset data
          const templatePosition = presetData.templatePosition || "BOTTOM";
          
          // Parse the template content, unescaping HTML if needed
        const cardStartMarker = "<!-- CARD_TEMPLATE_START -->";
        const cardEndMarker = "<!-- CARD_TEMPLATE_END -->";
        let cardTemplate = "";
        // First unescape the HTML template
        const unescapedHtmlTemplate = unescapeHtml(presetData.htmlTemplate);
        const startIndex = unescapedHtmlTemplate.indexOf(cardStartMarker);
        const endIndex = unescapedHtmlTemplate.indexOf(cardEndMarker);
        
        if (startIndex !== -1 && endIndex !== -1) {
          cardTemplate = unescapedHtmlTemplate
            .substring(startIndex + cardStartMarker.length, endIndex)
            .trim();
        } else {
          let cleanedResponse = unescapedHtmlTemplate
            .replace(/<!--[\s\S]*?-->/g, "")
            .trim();
          const templateVarRegex = /\{\{[^}]+\}\}/;
          const divMatches = [
            ...cleanedResponse.matchAll(/<div[^>]*>[\s\S]*?<\/div>/g),
          ];
          let bestMatch = null;
          let maxLength = 0;
          for (const match of divMatches) {
            if (templateVarRegex.test(match[0]) && match[0].length > maxLength) {
              bestMatch = match[0];
              maxLength = match[0].length;
            }
          }
          if (bestMatch) {
            cardTemplate = bestMatch;
          } else {
            throw new Error(
              "Could not find template content with either markers or Handlebars variables."
            );
          }
        }
          
          // Extract bundled JavaScript logic from the user preset template
          currentTemplateLogic = extractTemplateLogic(unescapedHtmlTemplate);

          // Get tabsType from preset data or default to 'toggle'
          currentTabsType = presetData.tabsType || "toggle";

          // Store template config from preset data
          currentTemplateConfig = {
            templatePosition: templatePosition,
            tabsType: currentTabsType,
            inlineTemplatesEnabled: presetData.inlineTemplatesEnabled || false,
            inlineTemplates: presetData.inlineTemplates || []
          };

          compiledCardTemplate = Handlebars.compile(cardTemplate);
          // Store the template position in a module-level variable for use during rendering
          currentTemplatePosition = templatePosition;
          console.log(`[SST] [${MODULE_NAME}]`,
            `User preset '${templateFile}' compiled successfully. Position: ${templatePosition}, TabsType: ${currentTabsType}`
          );
          return; // Exit successfully
        }
      } catch (error) {
        console.log(`[SST] [${MODULE_NAME}]`,
          `Could not load or parse user preset '${templateFile}'. Using default template.`
        );
      }
    } else {
      // Handle default templates (JSON files)
      const defaultPath = `${get_extension_directory()}/tracker-card-templates/${templateFile}`;
      try {
        const templateContent = await $.get(defaultPath);
        let jsonData;
        
        // Try to parse as JSON first
        try {
          jsonData = JSON.parse(templateContent);
        } catch (jsonError) {
          throw new Error(`Could not parse JSON for template ${templateFile}: ${jsonError.message}`);
        }
        
        console.log(`[SST] [${MODULE_NAME}]`, `Loading template from default file: ${defaultPath}`);

        // Extract position metadata from the JSON data
        const templatePosition = jsonData.templatePosition || "BOTTOM";

        // Parse the template content, unescaping HTML if needed
        const cardStartMarker = "<!-- CARD_TEMPLATE_START -->";
        const cardEndMarker = "<!-- CARD_TEMPLATE_END -->";
        let cardTemplate = "";
        // First unescape the HTML template
        const unescapedHtmlTemplate = unescapeHtml(jsonData.htmlTemplate);
        const startIndex = unescapedHtmlTemplate.indexOf(cardStartMarker);
        const endIndex = unescapedHtmlTemplate.indexOf(cardEndMarker);
        
        if (startIndex !== -1 && endIndex !== -1) {
          cardTemplate = unescapedHtmlTemplate
            .substring(startIndex + cardStartMarker.length, endIndex)
            .trim();
        } else {
          let cleanedResponse = unescapedHtmlTemplate
            .replace(/<!--[\s\S]*?-->/g, "")
            .trim();
          const templateVarRegex = /\{\{[^}]+\}\}/;
          const divMatches = [
            ...cleanedResponse.matchAll(/<div[^>]*>[\s\S]*?<\/div>/g),
          ];
          let bestMatch = null;
          let maxLength = 0;
          for (const match of divMatches) {
            if (templateVarRegex.test(match[0]) && match[0].length > maxLength) {
              bestMatch = match[0];
              maxLength = match[0].length;
            }
          }
          if (bestMatch) {
            cardTemplate = bestMatch;
          } else {
            throw new Error(
              "Could not find template content with either markers or Handlebars variables."
            );
          }
        }
        
        // Extract bundled JavaScript logic from the default template
        currentTemplateLogic = extractTemplateLogic(unescapedHtmlTemplate);

        // Get tabsType from JSON data or default to 'toggle'
        currentTabsType = jsonData.tabsType || "toggle";

        // Store template config from JSON data
        currentTemplateConfig = {
          templatePosition: templatePosition,
          tabsType: currentTabsType,
          inlineTemplatesEnabled: jsonData.inlineTemplatesEnabled || false,
          inlineTemplates: jsonData.inlineTemplates || []
        };

        compiledCardTemplate = Handlebars.compile(cardTemplate);
        // Store the template position in a module-level variable for use during rendering
        currentTemplatePosition = templatePosition;
        console.log(`[SST] [${MODULE_NAME}]`,
          `Default template '${templateFile}' compiled successfully. Position: ${templatePosition}, TabsType: ${currentTabsType}`
        );
        return; // Exit successfully
      } catch (error) {
        console.log(`[SST] [${MODULE_NAME}]`,
          `Could not load or parse default template file '${templateFile}'. Using hardcoded fallback. Error: ${error.message}`
        );
      }
    }
  }

  console.log(`[SST] [${MODULE_NAME}]`, "Using hardcoded fallback template as a last resort.");
  const fallbackTemplate = `
    <div style="flex:1 1 100%;min-width:380px;max-width:500px;background:red;border-radius:16px;padding:16px;color:#fff;">
        <b>Template Error</b><br>
        No custom template is loaded and the selected default template could not be found or parsed.
    </div>`;
  compiledCardTemplate = Handlebars.compile(fallbackTemplate);
  // Reset template logic for fallback template
  currentTemplateLogic = null;
  // Reset tabsType for fallback template
  currentTabsType = "toggle";
  // Reset template config for fallback template
  currentTemplateConfig = {
    templatePosition: "BOTTOM",
    tabsType: "toggle",
    inlineTemplatesEnabled: false,
    inlineTemplates: []
  };
  // Store the template position in a module-level variable for use during rendering
  currentTemplatePosition = "BOTTOM";
};

/**
 * Get the current template configuration
 * Used by inline templates module to access template metadata
 */
const getCurrentTemplateConfig = () => {
  return currentTemplateConfig;
};

// Export functions and variables
export {
  wrapperTemplate,
  compiledWrapperTemplate,
  compiledCardTemplate,
  get_extension_directory,
  populateTemplateDropdown,
  handleCustomTemplateUpload,
  loadTemplate,
  extractTemplatePosition,
  currentTemplatePosition,
  currentTemplateLogic,
  currentTemplateConfig,
  currentTabsType,
  getCurrentTemplateConfig,
  unescapeHtml,
  clearDomMeasurementCache
};
