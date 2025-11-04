# Inline Template Packs Guide

## Overview

Inline template packs are collections of reusable HTML templates that can be inserted into AI-generated messages using special syntax. Unlike tracker card templates, inline packs don't replace the entire tracker - they provide visual elements that can be embedded within narrative text.

## What Are Inline Template Packs?

Inline template packs allow you to:
- Create reusable UI components (phone notifications, emails, notes, etc.)
- Separate inline templates from tracker card templates
- Enable/disable packs without affecting your tracker card
- Share collections of inline templates with others
- Mix templates from multiple packs simultaneously

## Pack Structure

An inline template pack is a JSON file with the following structure:

```json
{
  "templateName": "Mystery Game Inline Pack",
  "templateAuthor": "Your Name",
  "displayInstructions": "These inline displays are designed for mystery/detective scenarios. Use them to create immersive evidence, clues, and communication artifacts that enhance the investigative atmosphere.",
  "inlineTemplates": [
    {
      "insertName": "phone",
      "insertPurpose": "Display a phone message notification",
      "parameters": ["name", "textContent", "time"],
      "htmlContent": "<div>...</div>"
    }
  ]
}
```

### Required Fields

- **templateName**: Display name for your pack
- **templateAuthor**: Your name or organization
- **inlineTemplates**: Array of template definitions (must have at least one item)

### Optional Fields

- **displayInstructions**: Custom guidance for the LLM on when and how to use these templates. This text will be included in the `{{sim_displays}}` macro output under "Template Pack Guidelines" to help the LLM understand the intended use cases for your templates.

### Template Definition Fields

Each inline template in the array must have:

- **insertName**: Unique identifier used in the `[[DISPLAY=...]]` syntax
- **insertPurpose**: Description of what this template displays (for LLM guidance)
- **parameters**: Array of parameter objects, each with `name` and `description` fields
- **htmlContent**: Handlebars template string with inline CSS

#### Parameter Format

Parameters are defined as objects with two properties:

```json
{
  "name": "parameterName",
  "description": "What this parameter is for and what values it should contain"
}
```

This structured format allows the LLM to better understand each parameter's purpose when generating inline displays.

## Creating Inline Templates

### Basic Template

```json
{
  "insertName": "note",
  "insertPurpose": "Display a handwritten note",
  "parameters": [
    {"name": "content", "description": "The note's text content"},
    {"name": "signature", "description": "Signature or initial at the end (optional)"}
  ],
  "htmlContent": "<div style='background: #fef9e7; padding: 20px;'><div>{{content}}</div>{{#if signature}}<div>- {{signature}}</div>{{/if}}</div>"
}
```

### Using in Messages

```
The detective found a crumpled note on the desk.

[[DISPLAY=note, DATA={content: "Meet me at the docks at midnight. Come alone.", signature: "J"}]]

What will you do?
```

### Styling Guidelines

Since inline templates appear within message text, use inline CSS:

```json
{
  "htmlContent": "<div style='background: #1a1a1a; border-radius: 12px; padding: 16px; margin: 12px 0; max-width: 400px;'>...</div>"
}
```

**Best Practices:**
- Use inline styles (no external CSS needed)
- Set `max-width` to prevent templates from being too wide
- Add `margin` for spacing from surrounding text
- Use `border-radius` and `box-shadow` for visual depth
- Consider both light and dark themes

### Handlebars Features

Inline templates support Handlebars syntax:

**Conditional Content:**
```handlebars
{{#if time}}
  <div>{{time}}</div>
{{/if}}
```

**Variables:**
```handlebars
<div>{{name}}</div>
<div>{{textContent}}</div>
```

**Escaping:**
- Use `{{variab le}}` for HTML-escaped output (default)
- Use `{{{variable}}}` for raw HTML (use cautiously)

## Example Templates

### Phone Notification

```json
{
  "insertName": "phone",
  "insertPurpose": "Display a phone message notification",
  "parameters": [
    {"name": "name", "description": "Contact name or phone number"},
    {"name": "textContent", "description": "The message text"},
    {"name": "time", "description": "Time the message was received (optional)"}
  ],
  "htmlContent": "<div style='background: #1a1a1a; border-radius: 12px; padding: 16px; margin: 12px 0; max-width: 400px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);'><div style='display: flex; align-items: center; margin-bottom: 8px;'><span style='font-size: 24px; margin-right: 12px;'>📱</span><div><div style='font-weight: bold; color: #fff;'>{{name}}</div>{{#if time}}<div style='font-size: 12px; color: #888;'>{{time}}</div>{{/if}}</div></div><div style='color: #ddd; line-height: 1.4;'>{{textContent}}</div></div>"
}
```

**Usage:**
```
[[DISPLAY=phone, DATA={name: "Unknown Number", textContent: "I have what you're looking for.", time: "2:47 AM"}]]
```

### Email Preview

```json
{
  "insertName": "email",
  "insertPurpose": "Display an email preview",
  "parameters": [
    {"name": "from", "description": "Sender's email address or name"},
    {"name": "subject", "description": "Email subject line"},
    {"name": "preview", "description": "Preview of the email body"}
  ],
  "htmlContent": "<div style='background: #f5f5f5; border-left: 4px solid #4285f4; padding: 16px; margin: 12px 0; max-width: 500px;'><div style='font-weight: bold; color: #202124; margin-bottom: 4px;'>{{from}}</div><div style='font-weight: 600; color: #5f6368; margin-bottom: 8px;'>{{subject}}</div><div style='color: #5f6368; font-size: 14px;'>{{preview}}</div></div>"
}
```

### Evidence Card

```json
{
  "insertName": "evidence",
  "insertPurpose": "Display a piece of evidence or clue",
  "parameters": [
    {"name": "title", "description": "Name or title of the evidence"},
    {"name": "description", "description": "Detailed description of the evidence"},
    {"name": "tag", "description": "Category tag (e.g., 'Physical', 'Testimony', optional)"}
  ],
  "htmlContent": "<div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 2px; margin: 12px 0; max-width: 400px;'><div style='background: #fff; border-radius: 6px; padding: 16px;'><div style='display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;'><div style='font-weight: bold; color: #333; font-size: 16px;'>🔍 {{title}}</div>{{#if tag}}<div style='background: #667eea; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px;'>{{tag}}</div>{{/if}}</div><div style='color: #666; line-height: 1.5; font-size: 14px;'>{{description}}</div></div></div>"
}
```

## Managing Packs

### Importing a Pack

1. Open extension settings
2. Click **"Import Preset"** button
3. Select your pack JSON file
4. The extension automatically detects it's a pack (has `inlineTemplates` array)
5. Pack is added to your collection and enabled by default

### Managing Packs

1. Click **"Manage Presets"** button in settings
2. Switch to **"Inline Template Packs"** tab
3. View all imported packs

**For each pack you can:**
- **Enable/Disable**: Toggle the checkbox to enable or disable the entire pack
- **Remove**: Delete the pack from your collection

### How Packs Work

- **Multiple packs can be active simultaneously**
- Enabled packs merge with the current tracker template's inline templates
- If multiple sources define the same `insertName`, the first one found is used
- Disabled packs are ignored during rendering
- Pack changes take effect immediately (no reload needed)

## Pack vs. Template Inline Templates

You can define inline templates in two places:

### 1. Tracker Card Template
```json
{
  "templateName": "Dating Sim Tracker",
  "inlineTemplatesEnabled": true,
  "inlineTemplates": [
    {"insertName": "heart", ...}
  ],
  "htmlTemplate": "..."
}
```
- Templates specific to this tracker
- Only available when this tracker is active
- Changes when you switch trackers

### 2. Inline Pack
```json
{
  "templateName": "Mystery Game Pack",
  "templateAuthor": "Your Name",
  "inlineTemplates": [
    {"insertName": "evidence", ...}
  ]
}
```
- Templates available across all trackers
- Stays active when you switch trackers
- Can be shared independently

**Best Practice:** Use tracker templates for tracker-specific elements and packs for general-purpose UI components.

## Sharing Packs

To share your pack:

1. Create your pack JSON file
2. Test all templates thoroughly
3. Share the JSON file with others
4. Others import using **"Import Preset"**

**File Naming:** Use descriptive names like `mystery-game-inline-pack.json`

## Troubleshooting

### Template Not Found
- Error: `[Unknown template: templateName]`
- **Fix**: Ensure pack is imported and enabled in "Manage Presets"

### Render Error
- Error: `[Render error: templateName]`
- **Fix**: Check Handlebars syntax in `htmlContent`
- **Fix**: Ensure parameter names match between template and usage

### Invalid Data
- Error: `[Invalid inline template data: templateName]`
- **Fix**: Check JSON syntax in `DATA={...}`
- **Fix**: Ensure proper quotes around string values

### Styling Issues
- **Fix**: Use inline styles only (no external CSS)
- **Fix**: Test in both light and dark themes
- **Fix**: Set explicit `color` values, don't rely on inheritance

## Display Instructions (LLM Guidance)

The optional `displayInstructions` field allows you to provide context-specific guidance to the LLM about when and how to use your inline templates. This is especially useful for themed packs or templates with specific use cases.

### When to Use Display Instructions

- **Themed Packs**: Explain the theme and scenarios where templates should be used
- **Special Requirements**: Clarify any special usage patterns or best practices
- **Context Guidance**: Help the LLM understand the narrative tone or style

### Example

```json
{
  "templateName": "Mystery Game Inline Pack",
  "templateAuthor": "Detective Stories Inc",
  "displayInstructions": "These inline displays are designed for mystery/detective scenarios. Use them to create immersive evidence, clues, and communication artifacts that enhance the investigative atmosphere. Prefer these over plain text when presenting clues, messages, or physical evidence the player discovers.",
  "inlineTemplates": [...]
}
```

### How It Works

When you include `displayInstructions` in your pack:

1. The text appears in the `{{sim_displays}}` macro output under "Template Pack Guidelines"
2. Multiple packs can each contribute their own instructions
3. The LLM receives this guidance along with the list of available templates
4. This helps the LLM make better decisions about when to use your templates

### Best Practices for Display Instructions

- **Be concise but clear** - One to two sentences is usually sufficient
- **Focus on use cases** - When should these templates be used?
- **Mention tone/style** - What narrative style do these support?
- **Avoid technical details** - Focus on creative guidance, not implementation

**Good Example:**
```
"These templates create a retro-futuristic aesthetic perfect for cyberpunk or sci-fi noir stories. Use them for terminal outputs, holographic displays, and digital communications."
```

**Too Technical:**
```
"These templates use CSS gradients and flexbox. The phone template has three parameters."
```

## Advanced Techniques

### Multi-line Content

Use escape sequences or keep HTML compact:

```json
{
  "htmlContent": "<div style='white-space: pre-wrap;'>{{content}}</div>"
}
```

Then in usage:
```
[[DISPLAY=note, DATA={content: "Line 1\nLine 2\nLine 3"}]]
```

### Nested Elements

```json
{
  "htmlContent": "<div style='...'>{{#if items}}<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>{{/if}}</div>"
}
```

### Emoji and Icons

Use emoji directly in templates:
```json
{
  "htmlContent": "<span style='font-size: 24px;'>📱</span>"
}
```

## Pack Template

Use this template to start your own pack:

```json
{
  "templateName": "My Inline Pack",
  "templateAuthor": "Your Name",
  "displayInstructions": "Optional: Provide guidance to the LLM about when and how to use these templates.",
  "inlineTemplates": [
    {
      "insertName": "example",
      "insertPurpose": "Example template",
      "parameters": [
        {"name": "param1", "description": "Description of what param1 is for"},
        {"name": "param2", "description": "Description of what param2 is for"}
      ],
      "htmlContent": "<div style='padding: 16px;'>{{param1}} - {{param2}}</div>"
    }
  ]
}
```

**Note:** The `displayInstructions` field is optional but recommended if your pack has a specific theme or use case.

## See Also

- [Inline Templates Proposal](inline-templates-proposal.md) - Original design document
- [Template Guide - Bundled JavaScript](template-guide-bundled-javascript.md) - For tracker templates with JavaScript
- Example pack: `tracker-card-templates/example-inline-pack.json`
