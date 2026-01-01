# Handlebars Helpers Reference

This guide documents all Handlebars helpers available in SillySimTracker templates. These helpers extend Handlebars with custom functions for comparisons, math, color manipulation, string formatting, and DOM measurements.

---

## Overview

### What Are Handlebars Helpers?

Handlebars helpers are custom functions you can call within your templates to transform data, perform calculations, or create conditional logic. They're invoked using double curly braces.

**Basic syntax:**
```handlebars
{{helperName argument1 argument2}}
```

**With conditionals:**
```handlebars
{{#if (gt value 50)}}Greater than 50{{/if}}
```

**Chained helpers:**
```handlebars
{{multiply (divide viewportWidth 2) 0.8}}
```

### Template Location

Templates are stored as JSON files in `tracker-card-templates/` with this structure:

```json
{
  "templateName": "My Template",
  "templateAuthor": "Your Name",
  "templatePosition": "BOTTOM",
  "htmlTemplate": "<!-- Handlebars template here -->",
  "sysPrompt": "System prompt for AI...",
  "customFields": [
    {"key": "ap", "description": "Affection Points (0-200)"},
    {
      "key": "inventory",
      "description": "Items the character is carrying",
      "type": "array",
      "itemSchema": [
        {"key": "name", "type": "string", "description": "Item name"},
        {"key": "quantity", "type": "number", "description": "How many"}
      ]
    }
  ],
  "extSettings": {
    "codeBlockIdentifier": "sim",
    "defaultBgColor": "#6a5acd"
  }
}
```

---

## Comparison Helpers

Use these helpers to create conditional logic in your templates.

### `eq` - Equality

Check if two values are equal.

| Property | Value |
|----------|-------|
| **Signature** | `{{eq a b}}` |
| **Returns** | Boolean |

**Example:**
```handlebars
{{#if (eq stats.health 0)}}
  <span>Unharmed</span>
{{else if (eq stats.health 1)}}
  <span>Injured</span>
{{else}}
  <span>Critical</span>
{{/if}}
```

---

### `gt` - Greater Than

Check if the first value is greater than the second.

| Property | Value |
|----------|-------|
| **Signature** | `{{gt a b}}` |
| **Returns** | Boolean |

**Example:**
```handlebars
{{#if (gt stats.ap 100)}}
  <div class="high-affection">Deep connection</div>
{{/if}}
```

---

### `gte` - Greater Than or Equal

Check if the first value is greater than or equal to the second.

| Property | Value |
|----------|-------|
| **Signature** | `{{gte a b}}` |
| **Returns** | Boolean |

**Example:**
```handlebars
{{#if (gte stats.tp 75)}}
  <div>Highly trusted</div>
{{/if}}
```

---

### `unless` - Inverse Conditional

Render content when a condition is false. This is the opposite of `{{#if}}`.

| Property | Value |
|----------|-------|
| **Signature** | `{{#unless condition}}...{{/unless}}` |
| **Returns** | Block content |

**Example:**
```handlebars
{{#unless stats.inactive}}
  <div class="active-indicator">Active</div>
{{else}}
  <div class="inactive-indicator">Away</div>
{{/unless}}
```

---

## Math Helpers

Perform mathematical operations on numeric values. All math helpers return `0` if inputs are invalid (non-numeric).

### `abs` - Absolute Value

Get the absolute (non-negative) value of a number.

| Property | Value |
|----------|-------|
| **Signature** | `{{abs value}}` |
| **Returns** | Number (always positive) |

**Example:**
```handlebars
<span class="change">{{abs stats.apChange}}</span>
```

---

### `add` - Addition

Add two numbers together.

| Property | Value |
|----------|-------|
| **Signature** | `{{add a b}}` |
| **Returns** | Number |

**Example:**
```handlebars
<div>Total: {{add stats.ap stats.tp}}</div>
```

---

### `subtract` - Subtraction

Subtract the second number from the first.

| Property | Value |
|----------|-------|
| **Signature** | `{{subtract a b}}` |
| **Returns** | Number |

**Example:**
```handlebars
<div>Remaining: {{subtract 100 stats.used}}</div>
```

---

### `multiply` - Multiplication

Multiply two numbers.

| Property | Value |
|----------|-------|
| **Signature** | `{{multiply a b}}` |
| **Returns** | Number |

**Example:**
```handlebars
<div style="width: {{multiply stats.progress 2}}px;"></div>
```

---

### `divide` - Division

Divide the first number by the second. Returns `0` if dividing by zero.

| Property | Value |
|----------|-------|
| **Signature** | `{{divide a b}}` |
| **Returns** | Number (decimal) |

**Example - Converting 0-200 to percentage:**
```handlebars
<div class="progress-fill" style="width: {{divide stats.ap 2}}%;"></div>
```

---

### `divideRoundUp` - Division with Ceiling

Divide and round up to the nearest integer.

| Property | Value |
|----------|-------|
| **Signature** | `{{divideRoundUp a b}}` |
| **Returns** | Integer (rounded up) |

**Example - Calculate pages needed:**
```handlebars
<span>Page {{divideRoundUp currentItem 10}} of {{divideRoundUp totalItems 10}}</span>
```

---

## Color Helpers

Manipulate colors dynamically based on template variables.

### `adjustColorBrightness`

Adjust the brightness of a hex color.

| Property | Value |
|----------|-------|
| **Signature** | `{{adjustColorBrightness hexColor brightnessPercent}}` |
| **Parameters** | `hexColor`: Hex code (with or without #)<br>`brightnessPercent`: 0-100 (100 = original, 50 = half brightness) |
| **Returns** | Hex color code |

**Example:**
```handlebars
<div style="background: linear-gradient(145deg,
  {{adjustColorBrightness bgColor 70}} 0%,
  {{adjustColorBrightness bgColor 50}} 100%);">
</div>
```

---

### `adjustHSL`

Adjust a color using the HSL color model. More flexible than brightness adjustment.

| Property | Value |
|----------|-------|
| **Signature** | `{{adjustHSL hexColor hueShift saturationAdjust lightnessAdjust}}` |
| **Parameters** | `hexColor`: Hex code<br>`hueShift`: Degrees to rotate hue (0-360, wraps)<br>`saturationAdjust`: Add/subtract saturation (-100 to 100)<br>`lightnessAdjust`: Add/subtract lightness (-100 to 100) |
| **Returns** | Hex color code |

**Examples:**

```handlebars
<!-- Darken by 20% -->
background: {{adjustHSL bgColor 0 0 -20}};

<!-- Make more saturated -->
border-color: {{adjustHSL bgColor 0 20 0}};

<!-- Shift hue by 180 degrees (complementary color) -->
accent-color: {{adjustHSL bgColor 180 0 0}};

<!-- Desaturate and lighten -->
disabled-color: {{adjustHSL bgColor 0 -50 20}};
```

---

## String Transformation Helpers

Transform strings for display or CSS class names.

### `initials`

Extract and capitalize the first letter of a name.

| Property | Value |
|----------|-------|
| **Signature** | `{{initials name}}` |
| **Returns** | Single uppercase letter (or "?" if empty) |

**Example:**
```handlebars
<div class="avatar">{{initials characterName}}</div>
<!-- "Alice" → "A", "bob" → "B" -->
```

---

### `rawFirstLetter`

Extract the first letter without changing case.

| Property | Value |
|----------|-------|
| **Signature** | `{{rawFirstLetter name}}` |
| **Returns** | Single character (or "?" if empty) |

**Example:**
```handlebars
<span>{{rawFirstLetter characterName}}</span>
<!-- "alice" → "a", "Bob" → "B" -->
```

---

### `slugifyUnderscore`

Convert a string to snake_case format.

| Property | Value |
|----------|-------|
| **Signature** | `{{slugifyUnderscore name}}` |
| **Returns** | Lowercase string with underscores |

**Example:**
```handlebars
<div id="char_{{slugifyUnderscore characterName}}">
<!-- "John Doe" → "john_doe" -->
```

---

### `slugifyDash`

Convert a string to kebab-case format.

| Property | Value |
|----------|-------|
| **Signature** | `{{slugifyDash name}}` |
| **Returns** | Lowercase string with dashes |

**Example:**
```handlebars
<div class="char-{{slugifyDash characterName}}">
<!-- "John Doe" → "john-doe" -->
```

---

### `camelCase`

Convert a string to camelCase format.

| Property | Value |
|----------|-------|
| **Signature** | `{{camelCase name}}` |
| **Returns** | camelCase string |

**Example:**
```handlebars
<div data-char="{{camelCase characterName}}">
<!-- "John Doe" → "johnDoe" -->
```

---

## Tab Positioning Helpers

Calculate z-index and offsets for stacked tab interfaces.

### `tabZIndex`

Calculate z-index for tab stacking where the first tab is on top.

| Property | Value |
|----------|-------|
| **Signature** | `{{tabZIndex index}}` |
| **Returns** | Number (5 - index) |

**Example:**
```handlebars
{{#each characters}}
<div class="tab" style="z-index: {{tabZIndex @index}};">
  {{characterName}}
</div>
{{/each}}
<!-- Index 0 → z-index: 5, Index 1 → z-index: 4, etc. -->
```

---

### `tabOffset`

Calculate vertical offset for stacked tabs.

| Property | Value |
|----------|-------|
| **Signature** | `{{tabOffset index}}` |
| **Returns** | Number (index * 65 pixels) |

**Example:**
```handlebars
{{#each characters}}
<div class="tab" style="margin-top: {{tabOffset @index}}px;">
  {{characterName}}
</div>
{{/each}}
<!-- Index 0 → 0px, Index 1 → 65px, Index 2 → 130px -->
```

---

## DOM Measurement Helpers

For responsive layouts that adapt to the user's viewport and UI elements, see the comprehensive [DOM Measurement Helpers Guide](template-guide-dom-helpers.md).

**Categories include:**
- **Viewport:** `viewportWidth`, `viewportHeight`
- **Element Dimensions:** `elementWidth`, `elementHeight`
- **Element Position:** `elementTop`, `elementLeft`, `elementRight`, `elementBottom`
- **Distance Calculations:** `distanceToEdge`, `distanceBetween`
- **Sidebar Helpers:** `sheldSpaceLeft`, `chatSpaceRight`, `sidebarAvailableWidth`
- **Computed Styles:** `elementStyle`, `elementExists`

---

## Array Fields

Custom fields can be defined as arrays, enabling you to track collections of items like inventories, goals, relationships, buffs/debuffs, and more.

### Defining Array Fields

Array fields are defined in `customFields` with a `type` of `"array"` and an `itemSchema` that describes the structure of each item.

#### Array of Objects

For complex items with multiple properties:

```json
{
  "key": "inventory",
  "description": "Items the character is carrying",
  "type": "array",
  "itemSchema": [
    {"key": "name", "type": "string", "description": "Item name"},
    {"key": "quantity", "type": "number", "description": "How many"},
    {"key": "equipped", "type": "boolean", "description": "Currently equipped"}
  ]
}
```

#### Array of Strings

For simple lists without additional properties:

```json
{
  "key": "goals",
  "description": "Character's current goals",
  "type": "array",
  "itemSchema": "string"
}
```

### Using Array Fields in Templates

Use Handlebars' `{{#each}}` block to iterate over array fields.

#### Object Arrays

```handlebars
{{#if stats.inventory}}
<div class="inventory-section">
  <h4>Inventory ({{stats.inventory.length}} items)</h4>
  {{#each stats.inventory}}
  <div class="item {{#if this.equipped}}equipped{{/if}}">
    <span class="name">{{this.name}}</span>
    <span class="qty">×{{this.quantity}}</span>
  </div>
  {{/each}}
</div>
{{/if}}
```

#### String Arrays

```handlebars
{{#if stats.goals}}
<div class="goals-section">
  <h4>Current Goals</h4>
  <ul>
    {{#each stats.goals}}
    <li>{{this}}</li>
    {{/each}}
  </ul>
</div>
{{/if}}
```

### Array Context Variables

Within an `{{#each}}` block, these special variables are available:

| Variable | Type | Description |
|----------|------|-------------|
| `this` | Any | The current array item |
| `this.propertyName` | Any | Property of current object (for object arrays) |
| `@index` | Number | Current iteration index (0-based) |
| `@first` | Boolean | `true` if first item |
| `@last` | Boolean | `true` if last item |

### Example: Buff/Debuff System

**Field Definition:**
```json
{
  "key": "effects",
  "description": "Active status effects on the character",
  "type": "array",
  "itemSchema": [
    {"key": "name", "type": "string", "description": "Effect name"},
    {"key": "type", "type": "string", "description": "buff or debuff"},
    {"key": "duration", "type": "number", "description": "Turns remaining"}
  ]
}
```

**Template Usage:**
```handlebars
{{#if stats.effects}}
<div class="effects-bar">
  {{#each stats.effects}}
  <div class="effect {{this.type}}">
    <span class="effect-name">{{this.name}}</span>
    {{#if this.duration}}
    <span class="duration">{{this.duration}} turns</span>
    {{/if}}
  </div>
  {{/each}}
</div>
{{/if}}
```

### Example: Relationship Network

**Field Definition:**
```json
{
  "key": "connections",
  "description": "Character's relationships with others",
  "type": "array",
  "itemSchema": [
    {"key": "name", "type": "string", "description": "Connected character's name"},
    {"key": "affinity", "type": "number", "description": "Relationship strength (0-100)"},
    {"key": "status", "type": "string", "description": "Relationship type"}
  ]
}
```

**Template Usage:**
```handlebars
{{#if stats.connections}}
<div class="connections">
  <h4>Connections</h4>
  {{#each stats.connections}}
  <div class="connection">
    <span class="name">{{this.name}}</span>
    <div class="affinity-bar">
      <div class="fill" style="width: {{this.affinity}}%;"></div>
    </div>
    <span class="status">{{this.status}}</span>
  </div>
  {{/each}}
</div>
{{/if}}
```

### Managing Array Fields in Settings

Array fields can be created and managed through the **Manage Fields** modal in Settings:

1. Click **"Manage Fields"** button
2. Click **"Add New Field"**
3. Change the type dropdown from **"Scalar"** to **"Array"**
4. Expand the field to configure the item schema:
   - Select **"Object Properties"** for complex items, then add properties
   - Select **"Simple Strings"** for basic string lists

---

## Template Context Variables

These variables are available within your templates:

### Loop Variables

| Variable | Type | Description |
|----------|------|-------------|
| `characters` | Array | All character objects from tracker data |
| `@index` | Number | Current loop index (0-based) |
| `@first` | Boolean | `true` if first iteration |
| `@last` | Boolean | `true` if last iteration |

### Character Variables

| Variable | Type | Description |
|----------|------|-------------|
| `characterName` | String | Character's display name |
| `currentDate` | String | Current in-story date (YYYY-MM-DD) |
| `stats.*` | Object | All custom fields defined in template |

### Color Variables

| Variable | Type | Description |
|----------|------|-------------|
| `bgColor` | String | Primary background color (hex) |
| `darkerBgColor` | String | Darker variant of background |
| `contrastColor` | String | Text color for contrast |

### Example - Accessing Stats

Given this custom fields configuration:
```json
"customFields": [
  {"key": "ap", "description": "Affection Points"},
  {"key": "dp", "description": "Desire Points"},
  {"key": "internal_thought", "description": "Current thought"}
]
```

Access in template:
```handlebars
<div>Affection: {{stats.ap}}</div>
<div>Desire: {{stats.dp}}</div>
<p class="thought">"{{stats.internal_thought}}"</p>
```

---

## Common Patterns

### Progress Bar

Convert a 0-200 stat to a percentage width:

```handlebars
<div class="progress-track">
  <div class="progress-fill" style="width: {{divide stats.ap 2}}%;"></div>
</div>
```

### Conditional Emoji/Icon

Display different icons based on stat thresholds:

```handlebars
{{#if (gt stats.ap 150)}}
  <span title="Devoted">💕</span>
{{else if (gt stats.ap 100)}}
  <span title="Romantic">💗</span>
{{else if (gt stats.ap 50)}}
  <span title="Friendly">💙</span>
{{else}}
  <span title="Neutral">🤍</span>
{{/if}}
```

### Dynamic Color Gradient

Create gradients that adapt to the character's assigned color:

```handlebars
<div style="background: linear-gradient(145deg,
  {{adjustColorBrightness bgColor 70}} 0%,
  {{adjustColorBrightness darkerBgColor 60}} 50%,
  {{adjustColorBrightness darkerBgColor 50}} 100%);">
</div>
```

### CSS-Safe Class Names

Generate valid CSS class names from character names:

```handlebars
{{#each characters}}
<div class="card card-{{slugifyDash characterName}}"
     id="card-{{@index}}">
  {{characterName}}
</div>
{{/each}}
```

### Stat Change Indicators

Show positive/negative change with color:

```handlebars
{{#if stats.apChange}}
  <span class="change {{#if (gt stats.apChange 0)}}positive{{else}}negative{{/if}}">
    {{#if (gt stats.apChange 0)}}+{{/if}}{{stats.apChange}}
  </span>
{{/if}}
```

### Inactive Character Handling

Apply different styles for inactive characters:

```handlebars
<div class="card {{#if stats.inactive}}inactive{{/if}}">
  {{#if stats.inactive}}
    <div class="overlay">
      {{#if (eq stats.inactiveReason 1)}}Asleep{{/if}}
      {{#if (eq stats.inactiveReason 5)}}Deceased{{/if}}
    </div>
  {{/if}}
  <!-- Card content -->
</div>
```

### Tab System with Stacking

Create stacked tabs with proper z-index:

```handlebars
{{#each characters}}
<div class="sim-tracker-tab"
     data-character="{{@index}}"
     style="z-index: {{tabZIndex @index}};
            margin-top: {{tabOffset @index}}px;
            background: {{bgColor}};">
  {{initials characterName}}
</div>
{{/each}}
```

### Inventory Display

Display array field items with conditional styling:

```handlebars
{{#if stats.inventory}}
<div class="inventory">
  <div class="header">
    <span>Inventory</span>
    <span class="count">{{stats.inventory.length}}</span>
  </div>
  {{#each stats.inventory}}
  <div class="item {{#if this.equipped}}equipped{{/if}}">
    <span class="name">{{this.name}}</span>
    {{#if (gt this.quantity 1)}}
    <span class="qty">×{{this.quantity}}</span>
    {{/if}}
  </div>
  {{/each}}
</div>
{{else}}
<div class="inventory empty">No items</div>
{{/if}}
```

### Goals Checklist

Simple string array as a list:

```handlebars
{{#if stats.goals}}
<div class="goals">
  <h4>Current Goals ({{stats.goals.length}})</h4>
  {{#each stats.goals}}
  <div class="goal">
    <span class="bullet">•</span>
    <span class="text">{{this}}</span>
  </div>
  {{/each}}
</div>
{{/if}}
```

---

## Related Documentation

- [DOM Measurement Helpers](template-guide-dom-helpers.md) - Responsive layout helpers
- [Tabbed Sidebar Templates](template-guide-tabbed-sidebar.md) - Creating tabbed interfaces
- [Inline Template Packs](template-guide-inline-packs.md) - Embeddable UI components
- [Pack Migration Guide](PACK_MIGRATION.md) - Panel system and tab modes

---

## Troubleshooting

### Helper Returns 0 or Empty

**Cause:** Invalid input type (string instead of number, or undefined value)

**Solution:** Check that the variable exists and contains the expected type:
```handlebars
{{#if stats.ap}}
  <div>AP: {{divide stats.ap 2}}%</div>
{{else}}
  <div>No AP data</div>
{{/if}}
```

### Color Helper Not Working

**Cause:** Invalid hex color format

**Solution:** Ensure colors are valid 6-character hex codes:
```handlebars
<!-- Works with or without # -->
{{adjustColorBrightness "#ff5500" 70}}
{{adjustColorBrightness "ff5500" 70}}
```

### Helper Chaining Errors

**Cause:** Incorrect parentheses nesting

**Solution:** Ensure parentheses are balanced and nested correctly:
```handlebars
<!-- Correct -->
{{multiply (divide viewportWidth 2) 0.8}}

<!-- Incorrect - missing inner parentheses -->
{{multiply divide viewportWidth 2 0.8}}
```
