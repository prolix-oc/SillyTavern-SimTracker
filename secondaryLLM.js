// secondaryLLM.js - Handle secondary LLM generation for tracker blocks

import { getContext } from "../../../extensions.js";
import { generateTrackerBlock } from "./formatUtils.js";

const MODULE_NAME = "silly-sim-tracker";

/**
 * Get the request headers for SillyTavern API calls
 */
function getRequestHeaders() {
  return {
    "Content-Type": "application/json",
    "X-CSRF-Token": SillyTavern.getContext().csrf_token || "",
  };
}

/**
 * Get the current completion endpoint from SillyTavern
 */
function getCurrentCompletionEndpoint() {
  const context = SillyTavern.getContext();
  // Use the chat completions endpoint
  return "/api/backends/chat-completions/generate";
}

/**
 * Send a raw completion request to generate tracker data
 * Based on the example-send.js implementation
 * Supports both streaming and non-streaming responses
 */
async function sendRawCompletionRequest({
  model,
  prompt,
  temperature = 0.7,
  api = "openai",
  endpoint = null,
  apiKey = null,
  extra = {},
  streaming = true,
}) {
  let url = getCurrentCompletionEndpoint();
  let headers = getRequestHeaders();

  let body = {
    messages: [{ role: "user", content: prompt }],
    model,
    temperature,
    chat_completion_source: api,
    stream: streaming, // Use streaming parameter
    ...extra,
  };

  // Handle full-manual configuration with direct endpoint calls
  if (api === "full-manual" && endpoint && apiKey) {
    url = endpoint;
    headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    // For direct endpoint calls, use standard OpenAI-compatible format
    body = {
      model,
      messages: [{ role: "user", content: prompt }],
      temperature,
      stream: streaming, // Use streaming parameter
      ...extra,
    };
  } else if (api === "custom" && model) {
    body.custom_model_id = model;
    const oai_settings = SillyTavern.getContext().openai_settings || {};
    body.custom_url = oai_settings.custom_url || "";
  }

  console.log(`[SST] [${MODULE_NAME}]`, "Request URL:", url);
  console.log(`[SST] [${MODULE_NAME}]`, "Request body:", JSON.stringify(body, null, 2));
  console.log(`[SST] [${MODULE_NAME}]`, `Streaming: ${streaming ? "enabled" : "disabled"}`);
  
  const res = await fetch(url + '/chat/completions', {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unable to read error response");
    console.error(`[SST] [${MODULE_NAME}]`, "Request failed with status:", res.status);
    console.error(`[SST] [${MODULE_NAME}]`, "Error response:", errorText);
    throw new Error(`LLM request failed: ${res.status} ${res.statusText} - ${errorText}`);
  }

  // Handle response based on streaming mode
  if (streaming) {
    // Handle streaming response
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let fullText = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines from the buffer
        const lines = buffer.split('\n');
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // Skip empty lines and comments
          if (!trimmedLine || trimmedLine.startsWith(':')) {
            continue;
          }
          
          // SSE format: "data: {...}"
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6); // Remove "data: " prefix
            
            // Check for stream end marker
            if (data === '[DONE]') {
              continue;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              // Extract content from the delta
              let content = "";
              
              // OpenAI-style streaming format
              if (parsed.choices?.[0]?.delta?.content) {
                content = parsed.choices[0].delta.content;
              }
              // Alternative format - direct content in delta
              else if (parsed.delta?.content) {
                content = parsed.delta.content;
              }
              // Claude-style format
              else if (parsed.delta?.text) {
                content = parsed.delta.text;
              }
              // Some APIs might use 'text' directly
              else if (parsed.choices?.[0]?.text) {
                content = parsed.choices[0].text;
              }
              
              if (content) {
                fullText += content;
              }
            } catch (parseError) {
              console.warn(`[SST] [${MODULE_NAME}]`, "Failed to parse SSE data:", data, parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log(`[SST] [${MODULE_NAME}]`, "Received complete response from streaming");
    return { text: fullText, full: { choices: [{ message: { content: fullText } }] } };
  } else {
    // Handle non-streaming response
    const data = await res.json();
    console.log(`[SST] [${MODULE_NAME}]`, "Received complete response (non-streaming)");

    let text = "";

    // Handle different response formats
    if (data.choices?.[0]?.message?.content) {
      text = data.choices[0].message.content;
    } else if (data.completion) {
      text = data.completion;
    } else if (data.choices?.[0]?.text) {
      text = data.choices[0].text;
    } else if (data.content && Array.isArray(data.content)) {
      // Handle Claude's structured format
      const textBlock = data.content.find(
        (block) =>
          block && typeof block === "object" && block.type === "text" && block.text
      );
      text = textBlock?.text || "";
    } else if (typeof data.content === "string") {
      text = data.content;
    }

    return { text, full: data };
  }
}

/**
 * Process chat history to extract the last N messages
 * Converts them to a format suitable for the secondary LLM
 */
function processChatHistory(chat, messageCount, get_settings) {
  if (!chat || !Array.isArray(chat)) {
    return [];
  }

  // Get the last N messages, but filter out system messages
  const recentMessages = chat
    .slice(-messageCount * 2) // Get more than needed in case some are filtered
    .filter((msg) => !msg.is_system)
    .slice(-messageCount); // Take only the last N after filtering

  // Convert to a simple format for the LLM
  return recentMessages.map((msg) => {
    // Determine role based on is_user flag
    const role = msg.is_user ? "user" : "assistant";
    
    // Clean the message content - remove any existing sim blocks
    const identifier = get_settings("codeBlockIdentifier");
    const simRegex = new RegExp("```" + identifier + "[\\s\\S]*?```", "gm");
    const cleanedContent = msg.mes.replace(simRegex, "").trim();

    return {
      role: role,
      content: cleanedContent,
      name: msg.name || (msg.is_user ? "User" : "Character"),
    };
  });
}

/**
 * Load the current template to extract trackerDesc
 */
async function loadCurrentTemplateData(get_settings) {
  try {
    const templateFile = get_settings("templateFile");
    if (!templateFile) {
      return null;
    }

    // Check if this is a user preset (starts with "user-preset-")
    if (templateFile.startsWith("user-preset-")) {
      // Extract the preset from userPresets array in settings
      const userPresets = get_settings("userPresets") || [];
      const presetIndex = parseInt(templateFile.replace("user-preset-", ""));
      
      if (presetIndex >= 0 && presetIndex < userPresets.length) {
        const preset = userPresets[presetIndex];
        console.log(`[SST] [${MODULE_NAME}]`, `Loaded user preset: ${preset.templateName || 'Unnamed'}`);
        return preset;
      } else {
        console.log(`[SST] [${MODULE_NAME}]`, `User preset index ${presetIndex} not found`);
        return null;
      }
    }
    
    // Otherwise, load from JSON file
    if (!templateFile.endsWith(".json")) {
      return null;
    }

    // Get extension directory
    const index_path = new URL(import.meta.url).pathname;
    const extension_directory = index_path.substring(0, index_path.lastIndexOf("/"));
    
    const templatePath = `${extension_directory}/tracker-card-templates/${templateFile}`;
    const response = await $.get(templatePath);
    const templateData = typeof response === "string" ? JSON.parse(response) : response;
    
    console.log(`[SST] [${MODULE_NAME}]`, `Loaded template from file: ${templateFile}`);
    return templateData;
  } catch (error) {
    console.log(`[SST] [${MODULE_NAME}]`, `Error loading template data: ${error.message}`);
    return null;
  }
}

/**
 * Generate a tracker block using a secondary LLM
 */
async function generateTrackerWithSecondaryLLM(get_settings) {
  const context = getContext();
  const chat = context.chat;

  if (!chat || chat.length === 0) {
    console.log(`[SST] [${MODULE_NAME}]`, "No chat history available for secondary generation");
    return null;
  }

  // Get settings
  const messageCount = parseInt(get_settings("secondaryLLMMessageCount")) || 5;
  const api = get_settings("secondaryLLMAPI") || "openai";
  const model = get_settings("secondaryLLMModel") || "";
  const endpoint = get_settings("secondaryLLMEndpoint") || null;
  const apiKey = get_settings("secondaryLLMAPIKey") || null;
  const temperature = parseFloat(get_settings("secondaryLLMTemperature")) || 0.7;
  const top_p = parseFloat(get_settings("secondaryLLMTopP")) || 1;

  if (!model && api !== "full-manual") {
    console.log(`[SST] [${MODULE_NAME}]`, "No model specified for secondary LLM");
    toastr.warning("Secondary LLM model not configured. Please set the model in settings.");
    return null;
  }

  // Load template data to get trackerDesc
  const templateData = await loadCurrentTemplateData(get_settings);
  const trackerDesc = templateData?.trackerDesc || "general tracker";

  // Process chat history
  const messages = processChatHistory(chat, messageCount, get_settings);

  if (messages.length === 0) {
    console.log(`[SST] [${MODULE_NAME}]`, "No messages to process for secondary generation");
    return null;
  }

  // Build the prompt for tracker generation
  const trackerFormat = get_settings("trackerFormat") || "json";
  const customFields = get_settings("customFields") || [];
  const codeBlockIdentifier = get_settings("codeBlockIdentifier") || "sim";

  // Create a description of the conversation
  let conversationText = `You are evaluating a conversation for a ${trackerDesc} context. Based on the following conversation, generate a tracker block that accurately reflects the current context:\n\n`;
  messages.forEach((msg) => {
    conversationText += `${msg.name}: ${msg.content}\n\n`;
  });

  // Add instructions for the tracker format
  conversationText += `\nGenerate a tracker block in ${trackerFormat.toUpperCase()} format wrapped in \`\`\`${codeBlockIdentifier} code fence.\n`;
  conversationText += `The tracker should follow this structure:\n`;

  if (trackerFormat === "yaml") {
    conversationText += `\`\`\`${codeBlockIdentifier}\nworldData:\n  current_date: "YYYY-MM-DD"\n  current_time: "HH:MM"\ncharacters:\n  - name: "Character Name"\n`;
    customFields.forEach((field) => {
      conversationText += `    ${field.key}: [appropriate value] # ${field.description}\n`;
    });
    conversationText += `\`\`\`\n`;
  } else {
    conversationText += `\`\`\`${codeBlockIdentifier}\n{\n  "worldData": {\n    "current_date": "YYYY-MM-DD",\n    "current_time": "HH:MM"\n  },\n  "characters": [\n    {\n      "name": "Character Name",\n`;
    customFields.forEach((field, index) => {
      const comma = index < customFields.length - 1 ? "," : "";
      conversationText += `      "${field.key}": [appropriate value]${comma} // ${field.description}\n`;
    });
    conversationText += `    }\n  ]\n}\n\`\`\`\n`;
  }

  conversationText += `\nIMPORTANT: Only output the tracker block wrapped in the code fence. Do not include any other text or explanations.`;

  try {
    console.log(`[SST] [${MODULE_NAME}]`, "Sending request to secondary LLM...");
    
    // Get streaming setting
    const streaming = get_settings("secondaryLLMStreaming") !== false; // Default to true if not set
    
    // Build extra parameters
    const extra = {};
    if (top_p < 1) {
      extra.top_p = top_p;
    }
    
    const response = await sendRawCompletionRequest({
      model: model,
      prompt: conversationText,
      temperature: temperature,
      api: api,
      endpoint: endpoint,
      apiKey: apiKey,
      extra: extra,
      streaming: streaming,
    });

    if (!response.text) {
      console.log(`[SST] [${MODULE_NAME}]`, "No text received from secondary LLM");
      return null;
    }

    console.log(`[SST] [${MODULE_NAME}]`, "Received response from secondary LLM");
    return response.text;
  } catch (error) {
    console.error(`[SST] [${MODULE_NAME}]`, "Error calling secondary LLM:", error);
    toastr.error(`Secondary LLM generation failed: ${error.message}`);
    return null;
  }
}

export { generateTrackerWithSecondaryLLM, processChatHistory };
