// formatUtils.js - Format detection, parsing, and generation utilities
import { get_extension_directory } from "./utils.js";

const MODULE_NAME = "silly-sim-tracker";

// --- FORMAT UTILITIES ---
const log = (message) => console.log(`[SST] [${MODULE_NAME}]`, message);

// Function to detect the format of a tracker block
const detectFormat = (content) => {
  // Trim whitespace
  const trimmedContent = content.trim();

  // Try to detect JSON format (starts with { or [)
  if ((trimmedContent.startsWith("{") && trimmedContent.endsWith("}")) ||
      (trimmedContent.startsWith("[") && trimmedContent.endsWith("]"))) {
    return "json";
  }

  // If it doesn't start with { or [, it might be YAML
  // We'll assume YAML for non-JSON content for now
  return "yaml";
};

// Improved function to parse YAML content
const parseYaml = (yamlContent) => {
  try {
    // This is a simplified YAML parser for our specific use case
    // A full implementation would use a library like js-yaml
    const lines = yamlContent.trim().split('');
    const result = {};
    let currentObject = result;
    const stack = [result];
    let inArray = false;
    let currentArray = null;
    let currentArrayParent = null;

    lines.forEach(line => {
      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith('#')) return;

      // Calculate indentation level
      const indent = line.search(/\S/);
      const trimmedLine = line.trim();

      // Handle array items (lines starting with -)
      if (trimmedLine.startsWith('- ')) {
        // This is an array item
        if (!inArray) {
          // Start a new array
          inArray = true;
          currentArray = [];
          // Add array to parent
          const parent = stack[stack.length - 1];
          // Find the key that should contain this array
          // This is a simplification - in real YAML the array would be associated with a key
          // For our purposes, we'll assume it's for the characters field
          parent.characters = currentArray;
        }

        // Extract the content after "- "
        const itemContent = trimmedLine.substring(2).trim();

        // Check if it's a nested object
        if (itemContent.endsWith(':')) {
          // This is a nested object in the array
          const newItem = {};
          currentArray.push(newItem);
          stack.push(newItem);
        } else if (itemContent.includes(':')) {
          // This is a key-value pair in an array item
          // For simplicity, we'll create a new object for this array item if we don't have one
          if (currentArray.length === 0 || typeof currentArray[currentArray.length - 1] !== 'object') {
            const newItem = {};
            if (currentArray.length > 0 && typeof currentArray[currentArray.length - 1] !== 'object') {
              // Replace the last item if it was a simple value
              currentArray.pop();
            }
            currentArray.push(newItem);
            stack.push(newItem);
          }

          const currentArrayItem = stack[stack.length - 1];
          const parts = itemContent.split(':');
          const key = parts[0].trim().replace(/["']/g, '');
          const value = parts.slice(1).join(':').trim();

          // Handle different value types
          if (value === 'true' || value === 'false') {
            currentArrayItem[key] = value === 'true';
          } else if (!isNaN(value.replace(/^\+/, '')) && value !== '') {
            // Remove leading plus sign if present, then convert to number
            currentArrayItem[key] = Number(value.replace(/^\+/, ''));
          } else {
            currentArrayItem[key] = value.replace(/["']/g, '');
          }
        } else {
          // Simple value in array
          currentArray.push(itemContent);
        }
        return;
      }

      // If we were in an array and now have a regular key, exit array mode
      if (inArray && !trimmedLine.startsWith('- ')) {
        inArray = false;
        // Pop array items from stack if needed
        while (stack.length > (indent / 2) + 1) {
          stack.pop();
        }
      }

      // Adjust stack based on indentation
      while (stack.length > (indent / 2) + 1) {
        stack.pop();
      }

      // Get current object at this indentation level
      currentObject = stack[stack.length - 1];

      // Parse key-value pairs
      if (trimmedLine.includes(':')) {
        const parts = trimmedLine.split(':');
        const key = parts[0].trim().replace(/["']/g, '');
        const value = parts.slice(1).join(':').trim();

        // Handle nested objects
        if (value === '') {
          const newObject = {};
          currentObject[key] = newObject;
          stack.push(newObject);
        } else {
          // Handle different value types
          if (value === 'true' || value === 'false') {
            currentObject[key] = value === 'true';
          } else if (!isNaN(value.replace(/^\+/, '')) && value !== '') {
            // Remove leading plus sign if present, then convert to number
            currentObject[key] = Number(value.replace(/^\+/, ''));
          } else {
            currentObject[key] = value.replace(/["']/g, '');
          }
        }
      }
    });

    return result;
  } catch (error) {
    log(`Error parsing YAML content: ${error.message}`);
    throw error;
  }
};

// Function to convert JSON to YAML
const convertJsonToYaml = (jsonObject, indent = 0) => {
  let yaml = '';
  const indentStr = '  '.repeat(indent);

  if (typeof jsonObject === 'object' && jsonObject !== null) {
    if (Array.isArray(jsonObject)) {
      jsonObject.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          yaml += `${indentStr}-\n${convertJsonToYaml(item, indent + 1)}`;
        } else {
          yaml += `${indentStr}- ${convertValueToYaml(item)}\n`;
        }
      });
    } else {
      Object.keys(jsonObject).forEach(key => {
        const value = jsonObject[key];
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            yaml += `${indentStr}${key}:\n`;
            yaml += convertJsonToYaml(value, indent + 1);
          } else {
            yaml += `${indentStr}${key}:\n`;
            yaml += convertJsonToYaml(value, indent + 1);
          }
        } else {
          yaml += `${indentStr}${key}: ${convertValueToYaml(value)}\n`;
        }
      });
    }
  }

  return yaml;
};

// Helper function to convert a value to its YAML representation
const convertValueToYaml = (value) => {
  if (typeof value === 'string') {
    // Check if string needs quotes
    if (value.includes(':') || value.includes('#') || /\s/.test(value)) {
      return `"${value}"`;
    }
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
};

// Function to clean up plus signs from numeric values in content
const cleanupPlusSignsInContent = (content) => {
  try {
    // Replace patterns like "+1", "+123", etc. with just the number
    // This regex matches:
    // - Optional quote (for JSON strings)
    // - Plus sign
    // - One or more digits
    // - Optional decimal point and more digits
    // - Optional quote (for JSON strings)
    // - Followed by comma, whitespace, closing bracket/brace, or end of line
    return content.replace(/(["\s:,\[\{])\+(\d+(?:\.\d+)?)(["\s,\]\}\n\r]|$)/g, '$1$2$3');
  } catch (error) {
    log(`Error cleaning up plus signs: ${error.message}`);
    return content; // Return original content if cleanup fails
  }
};

// Universal parser that can handle both JSON and YAML
const parseTrackerData = (content, format = null) => {
  try {
    // Clean up plus signs from numeric values before parsing
    const cleanedContent = cleanupPlusSignsInContent(content);

    // Detect format if not specified
    if (!format) {
      format = detectFormat(cleanedContent);
    }

    if (format === "json") {
      return JSON.parse(cleanedContent);
    } else if (format === "yaml") {
      return parseYaml(cleanedContent);
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }
  } catch (error) {
    log(`Error parsing tracker data: ${error.message}`);
    throw error;
  }
};

// Function to generate tracker block in the specified format
const generateTrackerBlock = (data, format, identifier) => {
  try {
    if (format === "json") {
      return `\`\`\`${identifier}\n${JSON.stringify(data, null, 2)}\n\`\`\``;
    } else if (format === "yaml") {
      const yamlContent = convertJsonToYaml(data);
      return `\`\`\`${identifier}\n${yamlContent}\`\`\``;
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }
  } catch (error) {
    log(`Error generating tracker block: ${error.message}`);
    throw error;
  }
};

// Function to convert between formats
const convertTrackerFormat = (content, targetFormat, identifier) => {
  try {
    // Parse the content regardless of its current format
    const data = parseTrackerData(content);

    // Generate in the target format
    return generateTrackerBlock(data, targetFormat, identifier);
  } catch (error) {
    log(`Error converting tracker format: ${error.message}`);
    throw error;
  }
};

// Export functions
export {
  detectFormat,
  parseYaml,
  convertJsonToYaml,
  convertValueToYaml,
  cleanupPlusSignsInContent,
  parseTrackerData,
  generateTrackerBlock,
  convertTrackerFormat
};
