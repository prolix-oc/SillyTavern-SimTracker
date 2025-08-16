// templating.js - Handlebar replacements and template parsing
const MODULE_NAME = "silly-sim-tracker";

// --- TEMPLATES ---
const wrapperTemplate = `<div id="silly-sim-tracker-container" style="width:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:block !important;visibility:visible !important;">{{{cardsHtml}}}</div>`;
let compiledWrapperTemplate = Handlebars.compile(wrapperTemplate);
let compiledCardTemplate = null;

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

const get_extension_directory = () => {
  const index_path = new URL(import.meta.url).pathname;
  return index_path.substring(0, index_path.lastIndexOf("/"));
};

async function populateTemplateDropdown(get_settings) {
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

  // Process default templates
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

        templateOptions.push({ filename, friendlyName, type: "default" });
      } catch (error) {
        console.error(
          `Could not fetch or parse template info for ${filename}:`,
          error
        );
        // If fetching fails, add it to the list with its filename so it's not missing
        templateOptions.push({ filename, friendlyName: filename, type: "default" });
      }
    })
  );

  // Process user presets
  const userPresets = get_settings ? get_settings("userPresets") || [] : [];
  userPresets.forEach((preset, index) => {
    try {
      // Parse the preset to extract metadata
      const nameMatch = preset.htmlTemplate.match(nameRegex);
      const authorMatch = preset.htmlTemplate.match(authorRegex);

      const templateName = nameMatch ? nameMatch[1].trim() : preset.templateName || `User Preset ${index + 1}`;
      const author = authorMatch ? authorMatch[1].trim() : preset.templateAuthor || "Unknown";

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

      // Extract position metadata
      const positionRegex = /<!--\s*POSITION\s*:\s*(.*?)\s*-->/i;
      const positionMatch = customTemplateHtml.match(positionRegex);
      const templatePosition = positionMatch
        ? positionMatch[1].trim().toUpperCase()
        : get_settings("templatePosition") || "BOTTOM"; // Use setting as fallback

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
      // Store the template position in settings for use during rendering
      set_settings("templatePosition", templatePosition);
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
          
          // Extract position metadata
          const positionRegex = /<!--\s*POSITION\s*:\s*(.*?)\s*-->/i;
          const positionMatch = presetData.htmlTemplate.match(positionRegex);
          const templatePosition = positionMatch
            ? positionMatch[1].trim().toUpperCase()
            : presetData.templatePosition || get_settings("templatePosition") || "BOTTOM";
          
          // Parse the template content
          const cardStartMarker = "<!-- CARD_TEMPLATE_START -->";
          const cardEndMarker = "<!-- CARD_TEMPLATE_END -->";
          let cardTemplate = "";
          const startIndex = presetData.htmlTemplate.indexOf(cardStartMarker);
          const endIndex = presetData.htmlTemplate.indexOf(cardEndMarker);
          
          if (startIndex !== -1 && endIndex !== -1) {
            cardTemplate = presetData.htmlTemplate
              .substring(startIndex + cardStartMarker.length, endIndex)
              .trim();
          } else {
            let cleanedResponse = presetData.htmlTemplate
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
          // Store the template position in settings for use during rendering
          set_settings("templatePosition", templatePosition);
          console.log(`[SST] [${MODULE_NAME}]`,
            `User preset '${templateFile}' compiled successfully. Position: ${templatePosition}`
          );
          return; // Exit successfully
        }
      } catch (error) {
        console.log(`[SST] [${MODULE_NAME}]`,
          `Could not load or parse user preset '${templateFile}'. Using default template.`
        );
      }
    } else {
      // Handle default templates
      const defaultPath = `${get_extension_directory()}/tracker-card-templates/${templateFile}`;
      try {
        const templateContent = await $.get(defaultPath);
        console.log(`[SST] [${MODULE_NAME}]`, `Loading template from default file: ${defaultPath}`);

        // Extract position metadata
        const positionRegex = /<!--\s*POSITION\s*:\s*(.*?)\s*-->/i;
        const positionMatch = templateContent.match(positionRegex);
        const templatePosition = positionMatch
          ? positionMatch[1].trim().toUpperCase()
          : get_settings("templatePosition") || "BOTTOM"; // Use setting as fallback

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
        // Store the template position in settings for use during rendering
        set_settings("templatePosition", templatePosition);
        console.log(`[SST] [${MODULE_NAME}]`,
          `Default template '${templateFile}' compiled successfully. Position: ${templatePosition}`
        );
        return; // Exit successfully
      } catch (error) {
        console.log(`[SST] [${MODULE_NAME}]`,
          `Could not load or parse default template file '${templateFile}'. Using hardcoded fallback.`
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
  set_settings("templatePosition", "BOTTOM"); // Default position for fallback
};

// Export functions and variables
export {
  wrapperTemplate,
  compiledWrapperTemplate,
  compiledCardTemplate,
  get_extension_directory,
  populateTemplateDropdown,
  handleCustomTemplateUpload,
  loadTemplate
};
