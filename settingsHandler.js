// settingsHandler.js - SillyTavern settings reading and management

const { extensionSettings, saveSettingsDebounced } = SillyTavern.getContext();
import { sanitizeFieldKey } from "./utils.js";
import { currentTemplatePosition, unescapeHtml } from "./templating.js";
import { populateTemplateDropdown } from "./templating.js";

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
  isEnabled: true,
  codeBlockIdentifier: "sim",
  defaultBgColor: "#6a5acd",
  showThoughtBubble: true,
  customTemplateHtml: "",
  templateFile: "dating-card-template.json", // Changed to JSON file
  datingSimPrompt:
    "Default prompt could not be loaded. Please check file path.",
  customFields: [...defaultSimFields], // Clone the default fields
  hideSimBlocks: true, // New setting to hide sim blocks in message text
  userPresets: [], // New setting to store user presets
};

let settings = {};
const settings_ui_map = {};

const get_settings = (key) => settings[key] ?? default_settings[key];
const set_settings = (key, value) => {
  settings[key] = value;
  saveSettingsDebounced();
};

const get_extension_directory = () => {
  const index_path = new URL(import.meta.url).pathname;
  return index_path.substring(0, index_path.lastIndexOf("/"));
};

const loadDefaultPromptFromFile = async () => {
  const promptPath = `${get_extension_directory()}/prompts/default-prompt.md`;
  try {
    const response = await $.get(promptPath);
    console.log(
      `[SST] [${MODULE_NAME}]`,
      `Successfully loaded default prompt from ${promptPath}`
    );
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

// Function to load the default JSON template
const loadDefaultTemplate = async () => {
  try {
    const defaultTemplatePath = `${get_extension_directory()}/tracker-card-templates/dating-card-template.json`;
    const defaultTemplate = await $.get(defaultTemplatePath);
    // jQuery may automatically parse JSON responses, so we need to check if it's already an object
    const templateData = typeof defaultTemplate === "string" ? JSON.parse(defaultTemplate) : defaultTemplate;

    // Apply the default template settings
    set_settings("customTemplateHtml", unescapeHtml(templateData.htmlTemplate));

    if (templateData.sysPrompt !== undefined) {
      set_settings("datingSimPrompt", templateData.sysPrompt);
    }

    if (templateData.customFields !== undefined) {
      set_settings("customFields", templateData.customFields);
    }

    if (templateData.extSettings) {
      Object.keys(templateData.extSettings).forEach((key) => {
        // Don't overwrite the templateFile setting with the one from extSettings
        // as it refers to the HTML template file, not the JSON preset file
        if (key !== "templateFile") {
          set_settings(key, templateData.extSettings[key]);
        }
      });
    }

    console.log(
      `[SST] [${MODULE_NAME}]`,
      "Successfully loaded default JSON template"
    );
    return true;
  } catch (error) {
    console.log(
      `[SST] [${MODULE_NAME}]`,
      `Error loading default JSON template: ${error.message}`
    );
    return false;
  }
};

// --- SETTINGS MANAGEMENT ---

const refresh_settings_ui = () => {
  for (const [key, [element, type]] of Object.entries(settings_ui_map)) {
    const value = get_settings(key);
    switch (type) {
      case "boolean":
        element.prop("checked", value);
        break;
      case "text":
      case "color":
      case "textarea":
        element.val(value);
        break;
    }
  }
};

const bind_setting = (selector, key, type) => {
  const element = $(selector);
  if (element.length === 0) {
    console.log(
      `[SST] [${MODULE_NAME}]`,
      `Could not find settings element: ${selector}`
    );
    return;
  }
  settings_ui_map[key] = [element, type];
  element.on("change input", () => {
    let value;
    switch (type) {
      case "boolean":
        value = element.prop("checked");
        break;
      case "text":
      case "color":
      case "textarea":
        value = element.val();
        break;
    }
    set_settings(key, value);
    if (key === "templateFile") {
      loadTemplate().then(() => {
        refreshAllCards();
      });
    }
  });
};

const initialize_settings_listeners = (
  loadTemplate,
  refreshAllCards,
  migrateAllSimData,
  handleCustomTemplateUpload,
  handlePresetExport,
  handlePresetImport,
  showManagePresetsModal
) => {
  console.log(`[SST] [${MODULE_NAME}]`, "Binding settings UI elements...");

  bind_setting("#isEnabled", "isEnabled", "boolean");
  bind_setting("#codeBlockIdentifier", "codeBlockIdentifier", "text");
  bind_setting("#defaultBgColor", "defaultBgColor", "color");
  bind_setting("#showThoughtBubble", "showThoughtBubble", "boolean");
  bind_setting("#hideSimBlocks", "hideSimBlocks", "boolean"); // New setting
  bind_setting("#datingSimPrompt", "datingSimPrompt", "textarea");

  // Listener for the default template dropdown
  const $templateSelect = $("#templateFile");
  if ($templateSelect.length) {
    settings_ui_map["templateFile"] = [$templateSelect, "text"];
    $templateSelect.on("change", async () => {
      const selectedValue = $templateSelect.val();
      
      const $selectedOption = $templateSelect.find(
        `option[value="${selectedValue}"]`
      );
      const presetData = $selectedOption.data("preset");
      const templateType = $selectedOption.data("type");

      // If this is a user preset, apply its settings
      if (presetData) {
        // Apply the preset data, unescaping HTML if needed
        set_settings(
          "customTemplateHtml",
          unescapeHtml(presetData.htmlTemplate)
        );

        // Apply other settings if they exist in the preset
        if (presetData.sysPrompt !== undefined) {
          set_settings("datingSimPrompt", presetData.sysPrompt);
        }

        if (presetData.customFields !== undefined) {
          set_settings("customFields", presetData.customFields);
        }

        if (presetData.extSettings) {
          Object.keys(presetData.extSettings).forEach((key) => {
            // Don't overwrite the templateFile setting with the one from extSettings
            // as it refers to the HTML template file, not the JSON preset file
            if (key !== "templateFile") {
              set_settings(key, presetData.extSettings[key]);
            }
          });
        }
      }
      // If this is a default template, load and apply its settings
      else if (templateType === "default" && selectedValue.endsWith(".json")) {
        try {
          const defaultTemplatePath = `${get_extension_directory()}/tracker-card-templates/${selectedValue}`;
          const defaultTemplate = await $.get(defaultTemplatePath);
          // jQuery may automatically parse JSON responses, so we need to check if it's already an object
          const templateData = typeof defaultTemplate === "string" ? JSON.parse(defaultTemplate) : defaultTemplate;

          // Apply the default template settings
          set_settings("customTemplateHtml", unescapeHtml(templateData.htmlTemplate));

          if (templateData.sysPrompt !== undefined) {
            set_settings("datingSimPrompt", templateData.sysPrompt);
          }

          if (templateData.customFields !== undefined) {
            set_settings("customFields", templateData.customFields);
          }

          if (templateData.extSettings) {
            Object.keys(templateData.extSettings).forEach((key) => {
              // Don't overwrite the templateFile setting with the one from extSettings
              // as it refers to the HTML template file, not the JSON preset file
              if (key !== "templateFile") {
                set_settings(key, templateData.extSettings[key]);
              }
            });
          }
        } catch (error) {
          console.log(
            `[SST] [${MODULE_NAME}]`,
            `Error loading or applying default template ${selectedValue}: ${error.message}`
          );
        }
      }

      set_settings("templateFile", selectedValue);
      await loadTemplate();
      refreshAllCards();
    });
  }

  $("#uploadCustomTemplateBtn").on("click", () => {
    $("#customTemplateUpload").click(); // Trigger the hidden file input
  });

  $("#customTemplateUpload").on("change", handleCustomTemplateUpload);

  $("#clearCustomTemplateBtn").on("click", async () => {
    console.log(`[SST] [${MODULE_NAME}]`, "Clearing custom template.");
    set_settings("customTemplateHtml", "");
    toastr.info("Custom template cleared. Reverted to default.");
    await loadTemplate(); // Reload to apply the selected default
    refreshAllCards();
  });

  // Listener for the JSON format migration button
  $("#migrateJsonFormatBtn").on("click", () => {
    if (
      confirm(
        "This will migrate all existing sim data to the new format with worldData and characters array. This operation cannot be undone. Are you sure?"
      )
    ) {
      migrateAllSimData();
    }
  });

  // Listener for preset export button
  $("#exportPresetBtn").on("click", () => {
    handlePresetExport(loadTemplate, refreshAllCards);
  });

  // Listener for preset import button
  $("#importPresetBtn").on("click", () => {
    $("#presetImportInput").click(); // Trigger the hidden file input
  });

  $("#presetImportInput").on("change", (event) => {
    handlePresetImport(event, loadTemplate, refreshAllCards);
  });

  // Listener for manage presets button
  $("#managePresetsBtn").on("click", () => {
    showManagePresetsModal(loadTemplate, refreshAllCards);
  });

  // Listener for reset defaults button
  $("#resetDefaultsBtn").on("click", () => {
    if (
      confirm(
        "Are you sure you want to reset all settings to their default values? This action cannot be undone."
      )
    ) {
      // Reset all settings to defaults
      Object.keys(default_settings).forEach((key) => {
        set_settings(key, default_settings[key]);
      });

      // Special handling for customFields to ensure we clone the array
      set_settings("customFields", [...defaultSimFields]);

      // Special handling for userPresets to ensure we have an empty array
      set_settings("userPresets", []);

      // Auto-load the default JSON template
      loadDefaultTemplate().then(() => {
        // Refresh the UI to reflect the changes
        refresh_settings_ui();

        // Reload template and refresh all cards
        loadTemplate().then(() => {
          refreshAllCards();
        });

        // Repopulate template dropdown to remove any user presets
        populateTemplateDropdown(get_settings);

        toastr.success("All settings have been reset to their default values.");
      });
    }
  });

  // --- Custom Fields UI Logic ---
  const $manageFieldsButton = $("#manageCustomFieldsBtn");

  // Function to create and show the modal
  const createAndShowModal = () => {
    // Remove any existing modal
    $("#sst-custom-fields-modal").remove();

    // Create modal HTML using SillyTavern's built-in classes with dialog element
    const modalHtml = `
            <dialog id="sst-custom-fields-modal" class="popup wide_dialogue_popup large_dialogue_popup vertical_scrolling_dialogue_popup popup--animation-fast">
                <div class="popup-header">
                    <h3 style="margin: 0; padding: 10px 0;">Manage Custom Fields</h3>
                </div>
                <div class="popup-content" style="padding: 15px; flex: 1; display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <div style="flex: 1;"></div>
                        <button id="addCustomFieldBtn" class="menu_button">Add New Field</button>
                    </div>
                    <div id="customFieldsList" class="sst-fields-container" style="flex: 1; overflow-y: auto;">
                        <!-- Fields will be populated here by JavaScript -->
                    </div>
                </div>
                <div class="popup-footer" style="display: flex; justify-content: center; padding: 15px;">
                    <button id="sst-modal-close" class="menu_button">Close</button>
                </div>
            </dialog>
        `;

    // Append modal to body
    $("body").append(modalHtml);

    // Get references to modal elements
    const $modal = $("#sst-custom-fields-modal");
    const $fieldsContainer = $modal.find("#customFieldsList");
    const $addFieldButton = $modal.find("#addCustomFieldBtn");
    const $modalClose = $modal.find("#sst-modal-close");

    // Create field template
    const createFieldTemplate = () => {
      return $(`
                <div class="sst-field-item">
                    <div class="sst-field-header">
                        <input type="text" class="field-key-display field-key text_pole" placeholder="Field key" style="margin-right: 10px;" />
                        <div>
                            <button class="sst-toggle-field menu_button">Expand</button>
                            <button class="remove-field-btn menu_button" style="margin-left: 5px;">Remove</button>
                        </div>
                    </div>
                    <div class="sst-field-details" style="display: none; padding: 10px; border-top: 1px solid #444; margin-top: 5px;">
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <div>
                                <label>Description for LLM:</label>
                                <input type="text" class="field-description text_pole" placeholder="Field description" style="width: 100%;" />
                            </div>
                        </div>
                    </div>
                </div>
            `);
    };

    // Function to render the list of fields
    const renderFields = () => {
      const fields = get_settings("customFields") || [];
      $fieldsContainer.empty();
      fields.forEach((field, index) => {
        const $fieldElement = createFieldTemplate();

        // Set values in the key input (which is now at the top level)
        const fieldKey = field.key || "";
        $fieldElement
          .find(".field-key-display")
          .val(fieldKey)
          .on("input", function () {
            const newValue = $(this).val();
            const updatedFields = [...fields];
            updatedFields[index].key = sanitizeFieldKey(newValue); // Sanitize on input
            set_settings("customFields", updatedFields);
          });

        // Set values in the description input
        $fieldElement
          .find(".field-description")
          .val(field.description)
          .on("input", function () {
            const newValue = $(this).val();
            const updatedFields = [...fields];
            updatedFields[index].description = newValue;
            set_settings("customFields", updatedFields);
          });

        $fieldElement.find(".remove-field-btn").on("click", function () {
          const updatedFields = fields.filter((_, i) => i !== index);
          set_settings("customFields", updatedFields);
          renderFields(); // Re-render the list
        });

        // Handle toggle button
        const $toggleButton = $fieldElement.find(".sst-toggle-field");
        const $details = $fieldElement.find(".sst-field-details");
        $toggleButton.on("click", function () {
          if ($details.is(":visible")) {
            $details.hide();
            $toggleButton.text("Expand");
          } else {
            $details.show();
            $toggleButton.text("Collapse");
          }
        });

        $fieldsContainer.append($fieldElement);
      });
    };

    // Add new field button listener
    $addFieldButton.on("click", () => {
      const fields = get_settings("customFields") || [];
      const newField = {
        key: "new_field_key",
        description: "Description for the LLM",
      };
      set_settings("customFields", [...fields, newField]);
      renderFields(); // Re-render the list

      // Scroll to the bottom where the new field was added
      $fieldsContainer.scrollTop($fieldsContainer[0].scrollHeight);
    });

    // Close modal when clicking the Close button
    $modalClose.on("click", () => {
      $modal.remove();
    });

    // Close modal with Escape key
    $modal.on("keydown", function (e) {
      if (e.key === "Escape") {
        $modal.remove();
      }
    });

    // Also close when clicking on the backdrop (dialog native behavior)
    $modal.on("click", function (e) {
      if (e.target === this) {
        $modal.remove();
      }
    });

    // Render fields and show modal
    renderFields();
    $modal[0].showModal(); // Use the native dialog showModal() method
  };

  // Manage fields button opens the modal
  $manageFieldsButton.on("click", () => {
    createAndShowModal();
  });
};

const initialize_settings = async () => {
  // Load the prompt from the file first.
  const loadedPrompt = await loadDefaultPromptFromFile();
  // If the prompt was loaded successfully, update the default_settings object.
  if (loadedPrompt) {
    default_settings.datingSimPrompt = loadedPrompt;
  }

  // Now, merge the defaults with any user-saved settings.
  // For first-time users, this will populate the settings with our default values.
  // For existing users, it will preserve their existing settings while adding any new default values.
  extensionSettings[MODULE_NAME] = Object.assign(
    {},
    default_settings,
    extensionSettings[MODULE_NAME]
  );
  settings = extensionSettings[MODULE_NAME];

  // Ensure that customFields always has the default values if it's empty or missing
  if (!settings.customFields || settings.customFields.length === 0) {
    settings.customFields = [...defaultSimFields];
  }

  // Ensure that userPresets always exists
  if (!settings.userPresets) {
    settings.userPresets = [];
  }

  // For first-time users, auto-load the default JSON template
  if (!extensionSettings[MODULE_NAME]) {
    try {
      const defaultTemplatePath = `${get_extension_directory()}/tracker-card-templates/dating-card-template.json`;
      const defaultTemplate = await $.get(defaultTemplatePath);
      const templateData = JSON.parse(defaultTemplate);

      // Apply the default template settings
      settings.customTemplateHtml = templateData.htmlTemplate;

      if (templateData.sysPrompt !== undefined) {
        settings.datingSimPrompt = templateData.sysPrompt;
      }

      if (templateData.customFields !== undefined) {
        settings.customFields = templateData.customFields;
      }

      if (templateData.extSettings) {
        Object.keys(templateData.extSettings).forEach((key) => {
          settings[key] = templateData.extSettings[key];
        });
      }
    } catch (error) {
      console.log(
        `[SST] [${MODULE_NAME}]`,
        `Error loading default JSON template: ${error.message}`
      );
    }
  } else {
    // For existing users, if they have selected a default template, load its settings
    const selectedTemplate = settings.templateFile;
    if (selectedTemplate && selectedTemplate.endsWith(".json") && !selectedTemplate.startsWith("user-preset-")) {
      try {
        const defaultTemplatePath = `${get_extension_directory()}/tracker-card-templates/${selectedTemplate}`;
        const defaultTemplate = await $.get(defaultTemplatePath);
        // jQuery may automatically parse JSON responses, so we need to check if it's already an object
        const templateData = typeof defaultTemplate === "string" ? JSON.parse(defaultTemplate) : defaultTemplate;

        // Apply the default template settings
        settings.customTemplateHtml = unescapeHtml(templateData.htmlTemplate);

        if (templateData.sysPrompt !== undefined) {
          settings.datingSimPrompt = templateData.sysPrompt;
        }

        if (templateData.customFields !== undefined) {
          settings.customFields = templateData.customFields;
        }

        if (templateData.extSettings) {
          Object.keys(templateData.extSettings).forEach((key) => {
            // Don't overwrite the templateFile setting with the one from extSettings
            // as it refers to the HTML template file, not the JSON preset file
            if (key !== "templateFile") {
              settings[key] = templateData.extSettings[key];
            }
          });
        }
      } catch (error) {
        console.log(
          `[SST] [${MODULE_NAME}]`,
          `Error loading selected default JSON template: ${error.message}`
        );
      }
    }
  }
};

const load_settings_html_manually = async () => {
  const settingsHtmlPath = `${get_extension_directory()}/settings.html`;
  try {
    const response = await $.get(settingsHtmlPath);
    $("#extensions_settings2").append(response);
    console.log(
      `[SST] [${MODULE_NAME}]`,
      "Settings HTML manually injected into right-side panel."
    );
  } catch (error) {
    console.log(
      `[SST] [${MODULE_NAME}]`,
      `Error loading settings.html: ${error.statusText}`
    );
    console.error(error);
  }
};

// Helper function to escape HTML
const escapeHtml = (unsafe) => {
  if (typeof unsafe !== "string") return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Function to handle preset export
const handlePresetExport = (loadTemplate, refreshAllCards) => {
  // Get references to modal elements
  const $modal = $("#sst-export-preset-modal");
  const $templateName = $modal.find("#exportTemplateName");
  const $templateAuthor = $modal.find("#exportTemplateAuthor");
  const $includeSysPrompt = $modal.find("#exportIncludeSysPrompt");
  const $includeCustomFields = $modal.find("#exportIncludeCustomFields");
  const $includeSettings = $modal.find("#exportIncludeSettings");
  const $confirmBtn = $modal.find("#sst-export-preset-confirm");
  const $cancelBtn = $modal.find("#sst-export-preset-cancel");

  // Pre-fill modal with current settings
  let templateName = "My Template";
  let templateAuthor = "Anonymous";
  let templatePosition = currentTemplatePosition || "BOTTOM";

  $templateName.val(templateName);
  $templateAuthor.val(templateAuthor);

  // Show modal
  $modal[0].showModal();

  // Handle confirm button
  $confirmBtn.off("click").on("click", async () => {
    try {
      // Create preset object
      const preset = {
        templateName: $templateName.val(),
        templateAuthor: $templateAuthor.val(),
        templatePosition: templatePosition,
      };

      // Add HTML template
      preset.htmlTemplate = get_settings("customTemplateHtml") || "";

      // Conditionally add other components
      if ($includeSysPrompt.is(":checked")) {
        preset.sysPrompt = get_settings("datingSimPrompt") || "";
      }

      if ($includeCustomFields.is(":checked")) {
        preset.customFields = get_settings("customFields") || [];
      }

      if ($includeSettings.is(":checked")) {
        // Only include specific settings that make sense for a preset
        preset.extSettings = {
          codeBlockIdentifier: get_settings("codeBlockIdentifier"),
          defaultBgColor: get_settings("defaultBgColor"),
          showThoughtBubble: get_settings("showThoughtBubble"),
          hideSimBlocks: get_settings("hideSimBlocks"),
          templateFile: get_settings("templateFile"),
        };
      }

      // Add to user presets
      const userPresets = get_settings("userPresets") || [];
      userPresets.push(preset);
      set_settings("userPresets", userPresets);

      // Repopulate template dropdown to include the new preset
      await populateTemplateDropdown(get_settings);

      // Create and download file
      const blob = new Blob([JSON.stringify(preset, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${preset.templateName.replace(/\s+/g, "_")}_preset.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toastr.success(`Preset "${preset.templateName}" exported successfully!`);
      $modal[0].close();
    } catch (error) {
      console.error(`[SST] [${MODULE_NAME}]`, "Error exporting preset:", error);
      toastr.error("Failed to export preset. Check console for details.");
    }
  });

  // Handle cancel button
  $cancelBtn.off("click").on("click", () => {
    $modal[0].close();
  });

  // Close modal with Escape key
  $modal.off("keydown").on("keydown", function (e) {
    if (e.key === "Escape") {
      $modal[0].close();
    }
  });

  // Close when clicking on backdrop
  $modal.off("click").on("click", function (e) {
    if (e.target === this) {
      $modal[0].close();
    }
  });
};

// Function to handle preset import
const handlePresetImport = (event, loadTemplate, refreshAllCards) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target.result;
      const preset = JSON.parse(content);

      // Validate preset structure
      if (!preset.htmlTemplate) {
        throw new Error("Invalid preset file: Missing HTML template");
      }

      // Apply HTML template, unescaping if needed
      set_settings("customTemplateHtml", unescapeHtml(preset.htmlTemplate));

      // Apply system prompt if included
      if (preset.sysPrompt !== undefined) {
        set_settings("datingSimPrompt", preset.sysPrompt);
      }

      // Apply custom fields if included
      if (preset.customFields !== undefined) {
        set_settings("customFields", preset.customFields);
      }

      // Apply extension settings if included
      if (preset.extSettings) {
        Object.keys(preset.extSettings).forEach((key) => {
          set_settings(key, preset.extSettings[key]);
        });
      }

      // Add to user presets
      const userPresets = get_settings("userPresets") || [];
      userPresets.push(preset);
      set_settings("userPresets", userPresets);

      // Reload template and refresh cards
      await loadTemplate();
      refreshAllCards();

      // Repopulate template dropdown to include the new preset
      await populateTemplateDropdown(get_settings);

      toastr.success(
        `Preset "${preset.templateName || "Unnamed"}" imported successfully!`
      );
    } catch (error) {
      console.error(`[SST] [${MODULE_NAME}]`, "Error importing preset:", error);
      toastr.error(`Failed to import preset: ${error.message}`);
    }
  };

  reader.onerror = () => {
    toastr.error("Failed to read preset file.");
  };

  reader.readAsText(file);
  event.target.value = ""; // Reset input
};

// Function to show the manage presets modal
const showManagePresetsModal = async (loadTemplate, refreshAllCards) => {
  const $modal = $("#sst-manage-presets-modal");
  const $presetsList = $modal.find("#userPresetsList");
  const $closeBtn = $modal.find("#sst-manage-presets-close");

  // Populate the presets list
  const userPresets = get_settings("userPresets") || [];
  $presetsList.empty();

  if (userPresets.length === 0) {
    $presetsList.append("<p>No user presets found.</p>");
  } else {
    userPresets.forEach((preset, index) => {
      const presetElement = $(`
          <div class="sst-preset-item" style="margin-bottom: 15px; padding: 10px; border: 1px solid #444; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>${
                  preset.templateName || `User Preset ${index + 1}`
                }</strong>
                <div>by ${preset.templateAuthor || "Unknown"}</div>
              </div>
              <div>
                <button class="sst-apply-preset menu_button" data-index="${index}" style="margin-right: 5px;">Apply</button>
                <button class="sst-delete-preset menu_button" data-index="${index}">Delete</button>
              </div>
            </div>
          </div>
        `);
      $presetsList.append(presetElement);
    });

    // Add event listeners for apply buttons
    $presetsList.find(".sst-apply-preset").on("click", async function () {
      const index = $(this).data("index");
      const preset = userPresets[index];

      if (preset) {
        // Apply the preset
        set_settings("customTemplateHtml", unescapeHtml(preset.htmlTemplate));

        if (preset.sysPrompt !== undefined) {
          set_settings("datingSimPrompt", preset.sysPrompt);
        }

        if (preset.customFields !== undefined) {
          set_settings("customFields", preset.customFields);
        }

        if (preset.extSettings) {
          Object.keys(preset.extSettings).forEach((key) => {
            set_settings(key, preset.extSettings[key]);
          });
        }

        // Reload template and refresh cards
        await loadTemplate();
        refreshAllCards();

        toastr.success(
          `Preset "${preset.templateName || "Unnamed"}" applied successfully!`
        );
        $modal[0].close();
      }
    });

    // Add event listeners for delete buttons
    $presetsList.find(".sst-delete-preset").on("click", function () {
      const index = $(this).data("index");

      if (
        confirm(
          `Are you sure you want to delete the preset "${
            userPresets[index].templateName || `User Preset ${index + 1}`
          }"?`
        )
      ) {
        // Remove the preset
        userPresets.splice(index, 1);
        set_settings("userPresets", userPresets);

        // Repopulate template dropdown
        populateTemplateDropdown(get_settings);

        // Show the modal again to refresh the list
        showManagePresetsModal(loadTemplate, refreshAllCards);

        toastr.success("Preset deleted successfully!");
      }
    });
  }

  // Show modal
  $modal[0].showModal();

  // Handle close button
  $closeBtn.off("click").on("click", () => {
    $modal[0].close();
  });

  // Close modal with Escape key
  $modal.off("keydown").on("keydown", function (e) {
    if (e.key === "Escape") {
      $modal[0].close();
    }
  });

  // Close when clicking on backdrop
  $modal.off("click").on("click", function (e) {
    if (e.target === this) {
      $modal[0].close();
    }
  });
};

// Export functions and variables
export {
  defaultSimFields,
  default_settings,
  settings,
  settings_ui_map,
  showManagePresetsModal,
  get_settings,
  set_settings,
  get_extension_directory,
  loadDefaultPromptFromFile,
  refresh_settings_ui,
  bind_setting,
  initialize_settings_listeners,
  initialize_settings,
  load_settings_html_manually,
  escapeHtml,
  handlePresetExport,
  handlePresetImport,
};
