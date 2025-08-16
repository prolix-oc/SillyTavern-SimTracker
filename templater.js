import { extension_settings } from "../../../extensions.js";
import { get_extension_directory } from "./utils.js";

const MODULE_NAME = "silly-sim-tracker";

// Default fields for sim data, used for both initial settings and the {{sim_format}} macro
const defaultSimFields = [
  { key: "ap", description: "Affection Points (0-200)" },
  { key: "dp", description: "Desire Points (0-150)" },
  { key: "tp", description: "Trust Points (0-150)" },
  { key: "cp", description: "Contempt Points (0-150)" },
  {
    key: "apChange",
    description:
      "Change in Affection from last action (positive/negative/zero)",
  },
  {
    key: "dpChange",
    description: "Change in Desire from last action (positive/negative/zero)",
  },
  {
    key: "tpChange",
    description: "Change in Trust from last action (positive/negative/zero)",
  },
  {
    key: "cpChange",
    description: "Change in Contempt from last action (positive/negative/zero)",
  },
  {
    key: "relationshipStatus",
    description: "Relationship status text (e.g., 'Romantic Interest')",
  },
  {
    key: "desireStatus",
    description: "Desire status text (e.g., 'A smoldering flame builds.')",
  },
  { key: "preg", description: "Boolean for pregnancy status (true/false)" },
  { key: "days_preg", description: "Days pregnant (if applicable)" },
  { key: "conception_date", description: "Date of conception (YYYY-MM-DD)" },
  {
    key: "health",
    description: "Health Status (0=Unharmed, 1=Injured, 2=Critical)",
  },
  { key: "bg", description: "Hex color for card background (e.g., #6a5acd)" },
  {
    key: "last_react",
    description: "Reaction to User (0=Neutral, 1=Like, 2=Dislike)",
  },
  {
    key: "internal_thought",
    description: "Character's current internal thoughts/feelings",
  },
  {
    key: "days_since_first_meeting",
    description: "Total days since first meeting",
  },
  {
    key: "inactive",
    description: "Boolean for character inactivity (true/false)",
  },
  {
    key: "inactiveReason",
    description:
      "Reason for inactivity (0=Not inactive, 1=Asleep, 2=Comatose, 3=Contempt/anger, 4=Incapacitated, 5=Death)",
  },
];

const default_settings = {
  customFields: [...defaultSimFields], // Clone the default fields
};

let compiledCardTemplate = null;
let compiledWrapperTemplate = null;

// Register Handlebars helpers for template logic
Handlebars.registerHelper("eq", function (a, b) {
  return a === b;
});

Handlebars.registerHelper("gt", function (a, b) {
  return a > b;
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

Handlebars.registerHelper("unless", function (conditional, options) {
  if (!conditional) {
    return options.fn(this);
  } else {
    return options.inverse(this);
  }
});

const get_settings = (key) => {
  const settings = extension_settings[MODULE_NAME] || {};
  return settings[key] ?? default_settings[key];
};

const loadDefaultPromptFromFile = async () => {
  const promptPath = `${get_extension_directory()}/prompts/default-prompt.md`;
  try {
    const response = await $.get(promptPath);
    console.log(`[SST] [${MODULE_NAME}]`, `Successfully loaded default prompt from ${promptPath}`);
    return response;
  } catch (error) {
    console.log(
      `[SST] [${MODULE_NAME}]`,
      `Error loading default prompt from ${promptPath}. The file might be missing. Error: ${error.statusText}`
    );
    console.error(error);
    return null; // Return null on failure
  }
};

const populateTemplateDropdown = async () => {
  console.log(`[SST] [${MODULE_NAME}]`, "Populating template dropdown with parsed friendly names...");

  const defaultFiles = [
    "dating-card-template.html",
    "dating-card-template-positioned.html",
    "dating-card-template-sidebar.html",
    "dating-card-template-sidebar-left.html",
    "dating-card-template-sidebar-tabs.html",
    "dating-card-template-sidebar-left-tabs.html",
  ];

  const templateOptions = [];
  const nameRegex = /<!--\s*TEMPLATE NAME\s*:\s*(.*?)\s*-->/;
  const authorRegex = /<!--\s*AUTHOR\s*:\s*(.*?)\s*-->/;

  await Promise.all(
    defaultFiles.map(async (filename) => {
      const filePath = `${get_extension_directory()}/tracker-card-templates/${filename}`;
      let friendlyName = filename; // Default to filename as a fallback

      try {
        const content = await $.get(filePath);

        const nameMatch = content.match(nameRegex);
        const authorMatch = content.match(authorRegex);

        const templateName = nameMatch ? nameMatch[1].trim() : null;
        const author = authorMatch ? authorMatch[1].trim() : null;

        if (templateName && author) {
          friendlyName = `${templateName} - by ${author}`;
        } else if (templateName) {
          friendlyName = templateName;
        }

        templateOptions.push({ filename, friendlyName });
      } catch (error) {
        console.error(
          `[SST] [${MODULE_NAME}]`,
          `Could not fetch or parse template info for ${filename}:`,
          error
        );
        // If fetching fails, add it to the list with its filename so it's not missing
        templateOptions.push({ filename, friendlyName: filename });
      }
    })
  );

  // Sort the results alphabetically by friendly name for a clean list
  templateOptions.sort((a, b) => a.friendlyName.localeCompare(b.friendlyName));

  const $select = $("#templateFile");
  const currentSelection = get_settings("templateFile");

  $select.empty();
  templateOptions.forEach((option) => {
    $select.append(
      $("<option>", {
        value: option.filename,
        text: option.friendlyName,
      })
    );
  });

  // Restore the user's selection
  $select.val(currentSelection);
  console.log(`[SST] [${MODULE_NAME}]`, "Template dropdown populated with friendly names.");
};

function handleCustomTemplateUpload(event) {
  const file = event.target.files[0];
  if (!file) {
    return; // User cancelled the dialog
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = e.target.result;
    console.log(`[SST] [${MODULE_NAME}]`, `Read custom template ${file.name}, size: ${content.length}`);
    
    // This would need to be handled by the main module
    // For now, we'll just log that we need to set the setting
    console.log(`[SST] [${MODULE_NAME}]`, "Custom template loaded. Would set settings in main module.");
  };
  reader.readAsText(file);

  event.target.value = "";
}

// Load template from file
const loadTemplate = async (settings) => {
  const customTemplateHtml = settings.customTemplateHtml;

  if (customTemplateHtml && customTemplateHtml.trim() !== "") {
    console.log(`[SST] [${MODULE_NAME}]`, "Loading template from custom HTML stored in settings.");
    try {
      const cardStartMarker = "<!-- CARD_TEMPLATE_START -->";
      const cardEndMarker = "<!-- CARD_TEMPLATE_END -->";
      let cardTemplate = "";

      // Extract position metadata
      const positionRegex = /<!--\s*POSITION\s*:\s*(.*?)\s*-->/i;
      const positionMatch = customTemplateHtml.match(positionRegex);
      const templatePosition = positionMatch
        ? positionMatch[1].trim().toUpperCase()
        : settings.templatePosition || "BOTTOM"; // Use setting as fallback

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

      compiledCardTemplate = Handlebars.compile(cardTemplate);
      console.log(
        `[SST] [${MODULE_NAME}]`,
        `Custom HTML template compiled successfully. Position: ${templatePosition}`
      );
      return { compiledCardTemplate, templatePosition }; // Return template and position
    } catch (error) {
      console.log(
        `[SST] [${MODULE_NAME}]`,
        `Error parsing custom HTML template: ${error.message}. Reverting to default file-based template.`
      );
      // We would show a toastr error in the main module
      console.log(`[SST] [${MODULE_NAME}]`, "Template Error: The custom HTML template could not be parsed. Check its format.");
    }
  }

  const templateFile = settings.templateFile;
  if (templateFile) {
    const defaultPath = `${get_extension_directory()}/tracker-card-templates/${templateFile}`;
    try {
      const templateContent = await $.get(defaultPath);
      console.log(`[SST] [${MODULE_NAME}]`, `Loading template from default file: ${defaultPath}`);

      // Extract position metadata
      const positionRegex = /<!--\s*POSITION\s*:\s*(.*?)\s*-->/i;
      const positionMatch = templateContent.match(positionRegex);
      const templatePosition = positionMatch
        ? positionMatch[1].trim().toUpperCase()
        : settings.templatePosition || "BOTTOM"; // Use setting as fallback

      // Re-run the same parsing logic for the file content
      const cardStartMarker = "<!-- CARD_TEMPLATE_START -->";
      const cardEndMarker = "<!-- CARD_TEMPLATE_END -->";
      let cardTemplate = "";
      const startIndex = templateContent.indexOf(cardStartMarker);
      const endIndex = templateContent.indexOf(cardEndMarker);
      if (startIndex !== -1 && endIndex !== -1) {
        cardTemplate = templateContent
          .substring(startIndex + cardStartMarker.length, endIndex)
          .trim();
      } else {
        let cleanedResponse = templateContent
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
      compiledCardTemplate = Handlebars.compile(cardTemplate);
      console.log(
        `[SST] [${MODULE_NAME}]`,
        `Default template '${templateFile}' compiled successfully. Position: ${templatePosition}`
      );
      return { compiledCardTemplate, templatePosition }; // Return template and position
    } catch (error) {
      console.log(
        `[SST] [${MODULE_NAME}]`,
        `Could not load or parse default template file '${templateFile}'. Using hardcoded fallback.`
      );
    }
  }

  console.log(`[SST] [${MODULE_NAME}]`, "Using hardcoded fallback template as a last resort.");
  const fallbackTemplate = `
    <div style="flex:1 1 100%;min-width:380px;max-width:500px;background:red;border-radius:16px;padding:16px;color:#fff;">
        <b>Template Error</b><br>
        No custom template is loaded and the selected default template could not be found or parsed.
    </div>`;
  compiledCardTemplate = Handlebars.compile(fallbackTemplate);
  return { compiledCardTemplate, templatePosition: "BOTTOM" }; // Default position for fallback
};

const sanitizeFieldKey = (key) => key.replace(/\s+/g, "_"); // Corrected escaping for regex

const generateSimFormat = (settings) => {
  const fields = settings.customFields || [];
  console.log(`[SST] [${MODULE_NAME}]`, "Processed {{sim_format}} macro.");

  // Start building the JSON example structure
  let exampleJson = "{\n"; // Corrected escaping for newline
  exampleJson += '  "characterName": {\n'; // Corrected escaping for newline

  // Add each custom field as a commented key-value pair
  fields.forEach((field) => {
    const sanitizedKey = sanitizeFieldKey(field.key);
    // Corrected escaping for newline and quotes
    exampleJson += `    "${sanitizedKey}": [${sanitizedKey.toUpperCase()}_VALUE], // ${
      field.description
    }\n`;
  });

  exampleJson += "  },\n"; // Corrected escaping for newline
  exampleJson +=
    '  "characterTwo": { ... }, // Repeat structure for each character\n'; // Corrected escaping for newline
  exampleJson += '  "current_date": [CURRENT_STORY_DATE] // YYYY-MM-DD\n'; // Corrected escaping for newline
  exampleJson +=
    '  "current_time": [CURRENT_STORY_TIME] // 21:34, 10:21, etc (24-hour time)\n'; // Corrected escaping for newline
  exampleJson += "}"; // Corrected escaping for closing brace

  // Wrap in the code block with the identifier
  const identifier = settings.codeBlockIdentifier || "sim";
  return `\`\`\`${identifier}\n${exampleJson}\n\`\`\``; // Corrected escaping for backticks and newlines
};

export {
  loadTemplate,
  populateTemplateDropdown,
  handleCustomTemplateUpload,
  loadDefaultPromptFromFile,
  generateSimFormat,
  defaultSimFields
};