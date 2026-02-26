// domBridge.js - Abstraction layer for DOM queries across standard ST and Lumiverse Chat Style
//
// Standard ST sheld structure:
//   #chat > div.mes[mesid="N"] > .mes_block > .mes_text
//
// Lumiverse Chat Style structure:
//   #lumiverse-chat-root > .lcs-app > .lcs-container > .lcs-scroll-container
//     > .lcs-message-list > .lcs-message[data-mesid="N"] > .lcs-message-content

const MODULE_NAME = "silly-sim-tracker";

/**
 * Detect whether Lumiverse Chat Style is active.
 * Lumiverse hides #chat (display:none) and renders into #lumiverse-chat-root.
 */
function isLumiverseActive() {
  const root = document.getElementById("lumiverse-chat-root");
  if (!root) return false;
  // Confirm the standard #chat is actually hidden
  const stChat = document.getElementById("chat");
  if (stChat && stChat.style.display === "none") return true;
  // If #lumiverse-chat-root exists and has visible children, treat as active
  return root.offsetParent !== null || root.children.length > 0;
}

/**
 * Get the chat container element to observe or query within.
 * Returns #lumiverse-chat-root when Lumiverse is active, otherwise #chat.
 */
function getChatContainer() {
  if (isLumiverseActive()) {
    return document.getElementById("lumiverse-chat-root");
  }
  return document.getElementById("chat");
}

/**
 * Get the CSS class used for message content elements.
 */
function getMessageContentClass() {
  return isLumiverseActive() ? "lcs-message-content" : "mes_text";
}

/**
 * Get the CSS class used for message wrapper elements.
 */
function getMessageWrapperClass() {
  return isLumiverseActive() ? "lcs-message" : "mes";
}

/**
 * Get the attribute name used for message IDs.
 * Standard ST uses "mesid", Lumiverse uses "data-mesid".
 */
function getMessageIdAttr() {
  return isLumiverseActive() ? "data-mesid" : "mesid";
}

/**
 * Get the message content element (.mes_text or .lcs-message-content) for a given message ID.
 * @param {number|string} mesId - The message index
 * @returns {Element|null}
 */
function getMessageContent(mesId) {
  if (isLumiverseActive()) {
    const msg = document.querySelector(`.lcs-message[data-mesid="${mesId}"]`);
    return msg ? msg.querySelector(".lcs-message-content") : null;
  }
  return document.querySelector(`div[mesid="${mesId}"] .mes_text`);
}

/**
 * Get the message wrapper element (.mes or .lcs-message) for a given message ID.
 * @param {number|string} mesId - The message index
 * @returns {Element|null}
 */
function getMessageElement(mesId) {
  if (isLumiverseActive()) {
    return document.querySelector(`.lcs-message[data-mesid="${mesId}"]`);
  }
  return document.querySelector(`div[mesid="${mesId}"]`);
}

/**
 * Get all visible message wrapper elements in the chat.
 * @returns {Element[]}
 */
function getAllMessages() {
  if (isLumiverseActive()) {
    return Array.from(document.querySelectorAll(".lcs-message[data-mesid]"));
  }
  return Array.from(document.querySelectorAll("div#chat .mes"));
}

/**
 * Get the message ID from a message wrapper element.
 * Handles both mesid (ST) and data-mesid (Lumiverse) attributes.
 * @param {Element} element - A message wrapper element
 * @returns {string|null}
 */
function getMessageIdFromElement(element) {
  return element.getAttribute("data-mesid") || element.getAttribute("mesid");
}

/**
 * Find the closest message content element from an arbitrary child node.
 * Works in both ST (.mes_text) and Lumiverse (.lcs-message-content) DOM.
 * @param {Element} element - Any element within a message
 * @returns {Element|null}
 */
function closestMessageContent(element) {
  return element.closest(".mes_text") || element.closest(".lcs-message-content");
}

/**
 * Find the closest message wrapper element from an arbitrary child node.
 * @param {Element} element - Any element within a message
 * @returns {Element|null}
 */
function closestMessageWrapper(element) {
  // Try ST first (.mes), then Lumiverse (.lcs-message)
  const stMsg = element.closest(".mes");
  if (stMsg && stMsg.hasAttribute("mesid")) return stMsg;
  return element.closest(".lcs-message");
}

/**
 * Query all message content elements in the chat.
 * @returns {Element[]}
 */
function getAllMessageContents() {
  if (isLumiverseActive()) {
    return Array.from(document.querySelectorAll(".lcs-message-content"));
  }
  return Array.from(document.querySelectorAll("#chat .mes_text"));
}

/**
 * Find code blocks with a specific class pattern within the chat.
 * Works for both ST (#chat code[class*="..."]) and Lumiverse (.lcs-message-content code[class*="..."]).
 * @param {string} identifier - The code block identifier (e.g., "sim")
 * @returns {Element[]}
 */
function findCodeBlocksByIdentifier(identifier) {
  if (isLumiverseActive()) {
    return Array.from(document.querySelectorAll(`#lumiverse-chat-root code[class*="${identifier}"]`));
  }
  return Array.from(document.querySelectorAll(`#chat code[class*="${identifier}"]`));
}

/**
 * Check if an element is a message content element in either DOM structure.
 * @param {Element} element
 * @returns {boolean}
 */
function isMessageContentElement(element) {
  if (!element || !element.classList) return false;
  return element.classList.contains("mes_text") || element.classList.contains("lcs-message-content");
}

/**
 * Find all message content elements within a given node (for MutationObserver).
 * @param {Element} node - The node to search within
 * @returns {Element[]}
 */
function findMessageContentsInNode(node) {
  const results = [];
  if (isMessageContentElement(node)) {
    results.push(node);
  } else if (node.querySelectorAll) {
    results.push(...node.querySelectorAll(".mes_text"));
    results.push(...node.querySelectorAll(".lcs-message-content"));
  }
  return results;
}

/**
 * Get the reasoning details element within a message content element.
 * Only applicable in standard ST; Lumiverse renders reasoning separately.
 * @param {Element} messageContent - The message content element
 * @returns {Element|null}
 */
function getReasoningElement(messageContent) {
  // Standard ST has .mes_reasoning_details inside .mes_text
  const stReasoning = messageContent.querySelector(".mes_reasoning_details");
  if (stReasoning) return stReasoning;
  // Lumiverse renders reasoning as a sibling (.lcs-reasoning), not inside content
  // So for TOP positioning in Lumiverse, we just insert at the beginning
  return null;
}

export {
  isLumiverseActive,
  getChatContainer,
  getMessageContentClass,
  getMessageWrapperClass,
  getMessageIdAttr,
  getMessageContent,
  getMessageElement,
  getAllMessages,
  getMessageIdFromElement,
  closestMessageContent,
  closestMessageWrapper,
  getAllMessageContents,
  findCodeBlocksByIdentifier,
  isMessageContentElement,
  findMessageContentsInNode,
  getReasoningElement,
};
