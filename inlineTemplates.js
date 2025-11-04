// inlineTemplates.js - Inline template rendering module
import DOMUtils from "./sthelpers/domUtils.js";
import { query, queryAll } from "./helpers.js";

const MODULE_NAME = "silly-sim-tracker-inline";

// Cache for compiled inline templates
const inlineTemplateCache = new Map();

// Simple hash function for cache keys
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Get or create a compiled inline template
 * @param {string} templateName - Name of the template
 * @param {string} htmlContent - HTML content with Handlebars syntax
 * @returns {Function} Compiled Handlebars template
 */
function getCompiledInlineTemplate(templateName, htmlContent) {
  const cacheKey = `${templateName}:${hashCode(htmlContent)}`;
  
  if (!inlineTemplateCache.has(cacheKey)) {
    try {
      inlineTemplateCache.set(cacheKey, Handlebars.compile(htmlContent));
      console.log(`[SST] [${MODULE_NAME}]`, `Compiled inline template: ${templateName}`);
    } catch (error) {
      console.error(`[SST] [${MODULE_NAME}]`, `Failed to compile inline template "${templateName}":`, error);
      // Return a template that shows an error
      return () => `<span style="color: red; font-style: italic;">[Template compilation error: ${templateName}]</span>`;
    }
  }
  
  return inlineTemplateCache.get(cacheKey);
}

/**
 * Clear the inline template cache
 */
export function clearInlineTemplateCache() {
  const size = inlineTemplateCache.size;
  inlineTemplateCache.clear();
  console.log(`[SST] [${MODULE_NAME}]`, `Cleared ${size} cached inline templates`);
}

/**
 * Parse DATA parameter from inline template syntax
 * @param {string} dataString - The DATA parameter content
 * @returns {Object|null} Parsed data object or null if parsing fails
 */
function parseInlineData(dataString) {
  try {
    // First, strip out ALL HTML tags to prevent SillyTavern's markdown formatter from interfering
    let cleaned = dataString.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities (in case quotes were encoded as &quot;)
    const textarea = document.createElement('textarea');
    textarea.innerHTML = cleaned;
    const decoded = textarea.value;
    
    // Try to parse as JSON
    // Quote unquoted keys
    const normalized = decoded
      .trim()
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":'); // Quote unquoted keys
    
    console.log(`[SST] [${MODULE_NAME}]`, `DEBUG - Normalized JSON:`, normalized);
    
    return JSON.parse(normalized);
  } catch (error) {
    console.warn(`[SST] [${MODULE_NAME}]`, `Failed to parse inline template data:`, error, `\nData string:`, dataString);
    return null;
  }
}

/**
 * Get all available inline templates from current template and enabled packs
 * @param {Object} templateConfig - Current template configuration
 * @param {Function} getSettings - Function to get settings
 * @returns {Array} Array of inline template definitions
 */
function getAllInlineTemplates(templateConfig, getSettings) {
  const allTemplates = [];
  
  // Add templates from current template config
  if (templateConfig && templateConfig.inlineTemplates && Array.isArray(templateConfig.inlineTemplates)) {
    allTemplates.push(...templateConfig.inlineTemplates);
  }
  
  // Add templates from enabled packs
  if (getSettings) {
    const inlinePacks = getSettings("inlinePacks") || [];
    inlinePacks.forEach(pack => {
      // Only include templates from enabled packs
      if (pack.enabled !== false && pack.inlineTemplates && Array.isArray(pack.inlineTemplates)) {
        allTemplates.push(...pack.inlineTemplates);
      }
    });
  }
  
  return allTemplates;
}

/**
 * Find inline template definition by name
 * @param {string} templateName - Name of the inline template
 * @param {Object} templateConfig - Current template configuration
 * @param {Function} getSettings - Function to get settings
 * @returns {Object|null} Inline template definition or null if not found
 */
function findInlineTemplate(templateName, templateConfig, getSettings) {
  const allTemplates = getAllInlineTemplates(templateConfig, getSettings);
  return allTemplates.find(t => t.insertName === templateName) || null;
}

/**
 * Render an inline template with provided data
 * @param {string} templateName - Name of the inline template
 * @param {Object} data - Data to pass to the template
 * @param {Object} templateConfig - Current template configuration
 * @param {Function} getSettings - Function to get settings
 * @returns {string} Rendered HTML or error message
 */
function renderInlineTemplate(templateName, data, templateConfig, getSettings) {
  // Find the template definition
  const templateDef = findInlineTemplate(templateName, templateConfig, getSettings);
  
  if (!templateDef) {
    console.warn(`[SST] [${MODULE_NAME}]`, `Inline template not found: ${templateName}`);
    return `<span style="color: orange; font-style: italic;">[Unknown template: ${templateName}]</span>`;
  }
  
  // Get or compile the template
  const compiledTemplate = getCompiledInlineTemplate(templateName, templateDef.htmlContent);
  
  // Render the template with the data
  try {
    return compiledTemplate(data);
  } catch (error) {
    console.error(`[SST] [${MODULE_NAME}]`, `Failed to render inline template "${templateName}":`, error);
    return `<span style="color: red; font-style: italic;">[Render error: ${templateName}]</span>`;
  }
}

/**
 * Regex pattern for detecting inline templates
 * Matches: [[DISPLAY=templateName, DATA={...}]]
 * Also supports shorter syntax: [[D=templateName, DATA={...}]]
 */
const INLINE_TEMPLATE_REGEX = /\[\[(?:DISPLAY|D)=([^,\]]+),\s*DATA=(\{[^\]]+\})\]\]/g;

/**
 * Regex pattern for detecting the start of inline templates (for hiding during streaming)
 * Matches: [[D or [[DISPLAY or [[
 */
const INLINE_TEMPLATE_START_REGEX = /\[\[(?:DISPLAY|D)?/g;

/**
 * Process inline templates in a message element
 * This is the main function that detects and replaces inline template markers
 * 
 * @param {HTMLElement} messageElement - The message element to process
 * @param {Object} templateConfig - Current template configuration
 * @param {boolean} isEnabled - Whether inline templates are enabled
 * @param {Function} getSettings - Function to get settings (optional, for pack support)
 */
export function processInlineTemplates(messageElement, templateConfig, isEnabled, getSettings) {
  // Skip processing if disabled or no template config
  if (!isEnabled || !templateConfig) {
    return;
  }
  
  // Skip processing if message doesn't contain inline template markers
  const messageText = messageElement.textContent || "";
  if (!messageText.includes("[[")) {
    return;
  }
  
  console.log(`[SST] [${MODULE_NAME}]`, `Processing inline templates in message`);
  
  // Get the message HTML
  let messageHTML = messageElement.innerHTML;
  
  // Track if we made any changes
  let hasChanges = false;
  
  // Find and replace inline template markers
  messageHTML = messageHTML.replace(INLINE_TEMPLATE_REGEX, (match, templateName, dataJSON) => {
    hasChanges = true;
    
    console.log(`[SST] [${MODULE_NAME}]`, `DEBUG - Full match:`, match);
    console.log(`[SST] [${MODULE_NAME}]`, `DEBUG - Template name:`, templateName);
    console.log(`[SST] [${MODULE_NAME}]`, `DEBUG - Raw dataJSON:`, dataJSON);
    
    // Parse the data
    const data = parseInlineData(dataJSON);
    
    if (!data) {
      return `<span style="color: red; font-style: italic;">[Invalid inline template data: ${templateName}]</span>`;
    }
    
    // Render the template
    const rendered = renderInlineTemplate(templateName.trim(), data, templateConfig, getSettings);
    
    // Wrap in a container div for easier identification and styling
    return `<div class="sst-inline-template" data-template="${templateName.trim()}">${rendered}</div>`;
  });
  
  // Update the message element if changes were made
  if (hasChanges) {
    messageElement.innerHTML = messageHTML;
    console.log(`[SST] [${MODULE_NAME}]`, `Replaced inline template markers with rendered HTML`);
  }
}

/**
 * Hide inline template markers that are being streamed
 * This wraps partial markers in hidden divs similar to sim blocks
 * 
 * @param {HTMLElement} messageElement - The message element to process
 * @param {boolean} isEnabled - Whether inline templates are enabled
 */
export function hideStreamingInlineMarkers(messageElement, isEnabled) {
  if (!isEnabled) {
    return;
  }
  
  const messageText = messageElement.textContent || "";
  
  // Check if there are any partial inline markers
  // Look for [[ that might be the start of an inline template
  if (!messageText.includes("[[")) {
    return;
  }
  
  // Find all text nodes in the message
  const walker = document.createTreeWalker(
    messageElement,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  // Process text nodes to hide partial markers
  textNodes.forEach(textNode => {
    const text = textNode.textContent;
    
    // Check if this text node contains a partial inline marker
    if (text.includes("[[")) {
      // Check if it's a complete marker (has closing ]])
      const hasComplete = /\[\[(?:DISPLAY|D)=([^,\]]+),\s*DATA=(\{[^\]]+\})\]\]/.test(text);
      
      if (!hasComplete) {
        // This is a partial/incomplete marker - hide it
        const span = document.createElement("span");
        span.className = "sst-inline-marker-hidden";
        span.style.display = "none";
        span.textContent = text;
        
        textNode.parentNode.replaceChild(span, textNode);
        console.log(`[SST] [${MODULE_NAME}]`, `Hid partial inline marker during streaming`);
      }
    }
  });
}

/**
 * Unhide and process inline markers after streaming completes
 * 
 * @param {HTMLElement} messageElement - The message element to process
 * @param {Object} templateConfig - Current template configuration
 * @param {boolean} isEnabled - Whether inline templates are enabled
 * @param {Function} getSettings - Function to get settings (optional, for pack support)
 */
export function unhideAndProcessInlineMarkers(messageElement, templateConfig, isEnabled, getSettings) {
  if (!isEnabled) {
    return;
  }
  
  // Find all hidden inline markers
  const hiddenMarkers = queryAll(".sst-inline-marker-hidden", messageElement);
  
  if (hiddenMarkers.length === 0) {
    return;
  }
  
  console.log(`[SST] [${MODULE_NAME}]`, `Unhiding ${hiddenMarkers.length} inline markers`);
  
  // Unhide them by replacing the span with a text node
  hiddenMarkers.forEach(span => {
    const textNode = document.createTextNode(span.textContent);
    span.parentNode.replaceChild(textNode, span);
  });
  
  // Now process the complete inline templates
  processInlineTemplates(messageElement, templateConfig, isEnabled, getSettings);
}

/**
 * Setup MutationObserver for handling inline templates during streaming
 * 
 * @param {Function} getSettings - Function to get current settings
 * @param {Function} getCurrentTemplateConfig - Function to get current template configuration
 * @returns {MutationObserver} The configured observer
 */
export function setupInlineTemplateObserver(getSettings, getCurrentTemplateConfig) {
  const observer = new MutationObserver((mutations) => {
    const isEnabled = getSettings("enableInlineTemplates");
    if (!isEnabled) {
      return;
    }
    
    const templateConfig = getCurrentTemplateConfig();
    if (!templateConfig) {
      return;
    }
    
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        
        // Check if this is a message text element or contains one
        let messageElements = [];
        if (node.classList && node.classList.contains('mes_text')) {
          messageElements = [node];
        } else {
          messageElements = Array.from(queryAll('.mes_text', node));
        }
        
        messageElements.forEach((messageElement) => {
          // Hide any partial inline markers during streaming
          hideStreamingInlineMarkers(messageElement, isEnabled);
          
          // Also process any complete markers
          processInlineTemplates(messageElement, templateConfig, isEnabled, getSettings);
        });
      });
    });
  });
  
  console.log(`[SST] [${MODULE_NAME}]`, `Inline template observer configured`);
  return observer;
}

/**
 * Process all inline templates in the current chat
 * Useful for initial load or when settings change
 * 
 * @param {Function} getSettings - Function to get current settings
 * @param {Function} getCurrentTemplateConfig - Function to get current template configuration
 */
export function processAllInlineTemplates(getSettings, getCurrentTemplateConfig) {
  const isEnabled = getSettings("enableInlineTemplates");
  if (!isEnabled) {
    console.log(`[SST] [${MODULE_NAME}]`, `Inline templates disabled, skipping processing`);
    return;
  }
  
  const templateConfig = getCurrentTemplateConfig();
  if (!templateConfig) {
    console.log(`[SST] [${MODULE_NAME}]`, `No template configuration found`);
    return;
  }
  
  console.log(`[SST] [${MODULE_NAME}]`, `Processing all inline templates in chat`);
  
  // Find all message elements in the chat
  const messageElements = queryAll('#chat .mes_text');
  
  messageElements.forEach((messageElement) => {
    // First unhide any hidden markers
    unhideAndProcessInlineMarkers(messageElement, templateConfig, isEnabled, getSettings);
    
    // Then process inline templates
    processInlineTemplates(messageElement, templateConfig, isEnabled, getSettings);
  });
  
  console.log(`[SST] [${MODULE_NAME}]`, `Processed ${messageElements.length} messages`);
}
