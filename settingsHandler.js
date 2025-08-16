import { extension_settings, saveSettingsDebounced } from "../../../extensions.js";
import { loadTemplate, populateTemplateDropdown, handleCustomTemplateUpload } from "./templater.js";

const MODULE_NAME = "silly-sim-tracker";

const default_settings = {
  isEnabled: true,
  codeBlockIdentifier: "sim",
  defaultBgColor: "#6a5acd",
  showThoughtBubble: true,
  customTemplateHtml: "",
  templateFile: "dating-card-template.html",
  datingSimPrompt:
    "Default prompt could not be loaded. Please check file path.",
  hideSimBlocks: true, // New setting to hide sim blocks in message text
  templatePosition: "BOTTOM", // New setting for template position
};

let settings_ui_map = {};

const get_settings = (key) => {
  const settings = extension_settings[MODULE_NAME] || {};
  return settings[key] ?? default_settings[key];
};

const set_settings = (key, value) => {
  if (!extension_settings[MODULE_NAME]) {
    extension_settings[MODULE_NAME] = {};
  }
  extension_settings[MODULE_NAME][key] = value;
  saveSettingsDebounced();
};

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
    console.log(`[SST] Could not find settings element: ${selector}`);
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
  });
};

const initialize_settings_listeners = (loadTemplateCallback, refreshAllCardsCallback) => {
  console.log("[SST] Binding settings UI elements...");

  bind_setting("#isEnabled", "isEnabled", "boolean");
  bind_setting("#codeBlockIdentifier", "codeBlockIdentifier", "text");
  bind_setting("#defaultBgColor", "defaultBgColor", "color");
  bind_setting("#showThoughtBubble", "showThoughtBubble", "boolean");
  bind_setting("#hideSimBlocks", "hideSimBlocks", "boolean"); // New setting
  bind_setting("#datingSimPrompt", "datingSimPrompt", "textarea");
  bind_setting("#templatePosition", "templatePosition", "text");

  // Listener for the default template dropdown
  const $templateSelect = $("#templateFile");
  if ($templateSelect.length) {
    settings_ui_map["templateFile"] = [$templateSelect, "text"];
    $templateSelect.on("change", async () => {
      set_settings("templateFile", $templateSelect.val());
      if (loadTemplateCallback) {
        await loadTemplateCallback();
      }
      if (refreshAllCardsCallback) {
        refreshAllCardsCallback();
      }
    });
  }

  $("#uploadCustomTemplateBtn").on("click", () => {
    $("#customTemplateUpload").click(); // Trigger the hidden file input
  });

  $("#customTemplateUpload").on("change", handleCustomTemplateUpload);

  $("#clearCustomTemplateBtn").on("click", async () => {
    console.log("[SST] Clearing custom template.");
    set_settings("customTemplateHtml", "");
    // We would show a toastr info in the main module
    console.log("[SST] Custom template cleared. Reverted to default.");
    if (loadTemplateCallback) {
      await loadTemplateCallback(); // Reload to apply the selected default
    }
    if (refreshAllCardsCallback) {
      refreshAllCardsCallback();
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
            // We would sanitize the field key in the main module
            updatedFields[index].key = newValue; // Sanitize on input
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

  refresh_settings_ui();
  console.log("[SST] Settings UI successfully bound.");
};

const initialize_settings = async (loadDefaultPromptFromFile) => {
  // Load the prompt from the file first.
  const loadedPrompt = await loadDefaultPromptFromFile();
  // If the prompt was loaded successfully, update the default_settings object.
  if (loadedPrompt) {
    default_settings.datingSimPrompt = loadedPrompt;
  }

  // Now, merge the defaults with any user-saved settings.
  extension_settings[MODULE_NAME] = Object.assign(
    {},
    default_settings,
    extension_settings[MODULE_NAME]
  );
};

const load_settings_html_manually = async (get_extension_directory) => {
  const settingsHtmlPath = `${get_extension_directory()}/settings.html`;
  try {
    const response = await $.get(settingsHtmlPath);
    $("#extensions_settings2").append(response);
    console.log("[SST] Settings HTML manually injected into right-side panel.");
  } catch (error) {
    console.log(`[SST] Error loading settings.html: ${error.statusText}`);
    console.error(error);
  }
};

export {
  default_settings,
  get_settings,
  set_settings,
  refresh_settings_ui,
  bind_setting,
  initialize_settings_listeners,
  initialize_settings,
  load_settings_html_manually,
  populateTemplateDropdown
};