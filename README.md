# Silly Sim Tracker

A powerful SillyTavern extension that dynamically renders visually appealing tracker cards based on JSON data embedded in character messages. Perfect for dating sims, RPGs, or any scenario where you need to track character stats, relationships, and story progression.

![Silly Sim Tracker Demo](screenshots/2char.png)

## Installation

1. **Copy the Extension Link**
   - Copy the repo URL (`https://github.com/prolix-oc/SillyTavern-SimTracker`) and keep it in your clipboard

2. **Install in SillyTavern**
   - Open the extensions menu (3 stacked cubes)
   - Click on "Install Extension"
   - Paste URL into repo URL field. OPTIONALLY: select a branch or version of the extension
   - Choose install scope (either for you or globally)

3. **Verify Installation**
   - The extension should now appear in your SillyTavern settings
   - You can access the configuration panel through the Extensions drawer

## Features

### Core Functionality
- **Dynamic Tracker Cards**: Automatically generates beautiful, responsive tracker cards from JSON data in character messages
- **Flexible Data Structure**: Supports both simple and complex data formats with automatic migration tools
- **Real-time Rendering**: Cards update instantly as new messages are received
- **Multi-Character Support**: Display stats for multiple characters in a single message

### Customization Options
- **Customizable Templates**: Choose from built-in templates or create your own custom HTML templates
- **Flexible Styling**: Adjust colors, layouts, and visual elements to match your preferences
- **Configurable Code Blocks**: Set your own identifier for sim data blocks (default: "sim")
- **Thought Bubble Display**: Toggle visibility of character internal thoughts
- **Card Color Customization**: Set default background colors with automatic dark variants

### Advanced Features
- **JSON Format Migration**: Convert legacy data formats to the improved structure with one click
- **Slash Command Support**: Use `/sst-convert` to migrate all data in the current chat
- **Macro Integration**: Includes `{{sim_tracker}}` and `{{last_sim_stats}}` macros for prompt engineering
- **Data Hiding**: Option to hide raw JSON code blocks while keeping the visual cards
- **Custom Fields Definition**: Define your own data fields for use in templates and prompts

### Template System
- **Handlebars.js Templates**: Powerful templating engine for creating rich, dynamic cards
- **Built-in Helpers**: Custom helpers like `eq` and `gt` for conditional logic in templates
- **Responsive Design**: Cards automatically adapt to mobile and desktop layouts
- **Visual Indicators**: Color-coded change indicators for stat modifications
- **Status Icons**: Automatic emoji-based status indicators for health, reactions, and inactivity

### Data Structure
Supports both legacy and modern JSON formats:

**Legacy Format**:
```json
{
  "current_date": "2025-08-10",
  "current_time": "14:30",
  "Alice": {
    "ap": 75,
    "dp": 60,
    "tp": 80,
    "cp": 20
  }
}
```

**Modern Format** (recommended):
```json
{
  "worldData": {
    "current_date": "2025-08-10",
    "current_time": "14:30"
  },
  "characters": [
    {
      "name": "Alice",
      "ap": 75,
      "dp": 60,
      "tp": 80,
      "cp": 20
    }
  ]
}
```

## Usage Examples

### Single Character Card
![Single Character Demo](screenshots/single-char.png)

### Multi-Character Cards
![Multi-Character Demo](screenshots/2char.png)

### Inactive Character Display
![Inactive Character Demo](screenshots/2char-1inactive.png)

## Configuration

The extension offers extensive configuration options through the SillyTavern settings panel:

1. **Enable/Disable**: Master switch to turn the extension on or off
2. **Code Block Identifier**: Customize the keyword used to identify sim data blocks
3. **Default Card Color**: Set the background color for cards
4. **Thought Bubble Visibility**: Toggle display of character thoughts
5. **Template Selection**: Choose from built-in templates or load custom ones
6. **Custom Fields**: Define your own data fields for tracking
7. **Data Hiding**: Hide raw JSON code blocks from chat display
8. **System Prompt**: Customize the base prompt for sim tracking

## Migration Tools

To help users transition to the improved JSON format:

1. **Settings Button**: Use the "Migrate to New Format" button in the settings panel
2. **Slash Command**: Type `/sst-convert` in any chat to migrate all data in that chat
3. **Automatic Compatibility**: Both old and new formats are supported seamlessly

---
