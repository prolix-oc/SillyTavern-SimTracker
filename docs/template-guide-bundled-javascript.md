# Bundled JavaScript in Templates

## Overview

SillySimTracker supports embedding custom JavaScript logic directly within your HTML templates. This powerful feature allows you to create self-contained "mini-applications" where all template logic lives in a single file.

## Why Use Bundled JavaScript?

**Benefits:**
- **Keep templates simple** - Handle complex logic in JavaScript, use simple Handlebars conditionals in HTML
- **Self-contained** - Everything needed for the template is in one file, easy to share
- **Data transformation** - Add computed properties, perform calculations, format values
- **Backward compatible** - Templates without bundled JS continue working normally

## How It Works

The system uses a two-step process:

1. **Extraction (templating.js)** - When a template loads, the system extracts JavaScript from a special `<script>` tag
2. **Execution (renderer.js)** - Before rendering, the JavaScript runs in a secure sandbox to transform the data

## Adding Bundled JavaScript to Your Template

### The Script Tag

Add a `<script>` tag with type `text/x-handlebars-template-logic` anywhere in your template file:

```html
<!-- CARD_TEMPLATE_START -->
<script type="text/x-handlebars-template-logic">
// Your JavaScript code here
// The 'data' parameter contains all template data
// Modify data as needed, then it will be automatically returned

// Example: Add a computed property
if (data.stats && data.stats.health !== undefined) {
  data.stats.isHealthy = data.stats.health > 50;
  data.stats.healthPercentage = Math.round((data.stats.health / 100) * 100);
}
</script>

<div class="tracker-card">
  <!-- Your template HTML here -->
  {{#if stats.isHealthy}}
    <span class="health-good">✓ Healthy ({{stats.healthPercentage}}%)</span>
  {{else}}
    <span class="health-warning">⚠ Needs attention</span>
  {{/if}}
</div>
<!-- CARD_TEMPLATE_END -->
```

**Important:** The `type="text/x-handlebars-template-logic"` attribute is crucial - it prevents the browser from executing the script directly.

### Data Structure

The `data` object structure differs based on your template type:

#### For Single-Card (Non-Tabbed) Templates

```javascript
data = {
  characterName: "Alice",
  currentDate: "2024-01-15",
  currentTime: "14:30",
  stats: {
    health: 85,
    fatigue: 25,
    internal_thought: "I wonder what's for dinner...",
    // ... all other stats from the sim block
  },
  bgColor: "#3498db",
  darkerBgColor: "#2980b9",
  reactionEmoji: "😊",
  healthIcon: null,
  showThoughtBubble: true
}
```

#### For Tabbed Templates

```javascript
data = {
  characters: [
    {
      characterName: "Alice",
      currentDate: "2024-01-15",
      currentTime: "14:30",
      stats: { /* ... */ },
      bgColor: "#3498db",
      // ... other properties
    },
    {
      characterName: "Bob",
      // ... same structure
    }
  ],
  currentDate: "2024-01-15",
  currentTime: "14:30"
}
```

### Examples

#### Example 1: Adding Conditional Flags

Instead of complex Handlebars logic:
```handlebars
{{#if (and (gt stats.health 50) (lt stats.fatigue 30))}}
  Ready for action!
{{/if}}
```

Use bundled JavaScript:
```html
<script type="text/x-handlebars-template-logic">
if (data.stats) {
  data.stats.isReady = data.stats.health > 50 && data.stats.fatigue < 30;
}
</script>

{{#if stats.isReady}}
  Ready for action!
{{/if}}
```

#### Example 2: Calculating Derived Values

```html
<script type="text/x-handlebars-template-logic">
if (data.stats) {
  // Calculate energy as the inverse of fatigue
  data.stats.energy = 100 - data.stats.fatigue;
  
  // Determine overall condition
  const avgHealth = (data.stats.health + data.stats.energy) / 2;
  if (avgHealth > 75) {
    data.stats.condition = "Excellent";
    data.stats.conditionClass = "condition-good";
  } else if (avgHealth > 50) {
    data.stats.condition = "Good";
    data.stats.conditionClass = "condition-ok";
  } else {
    data.stats.condition = "Poor";
    data.stats.conditionClass = "condition-bad";
  }
}
</script>

<div class="{{stats.conditionClass}}">
  Condition: {{stats.condition}}
</div>
```

#### Example 3: String Formatting

```html
<script type="text/x-handlebars-template-logic">
if (data.stats && data.stats.internal_thought) {
  // Truncate long thoughts
  if (data.stats.internal_thought.length > 100) {
    data.stats.shortThought = data.stats.internal_thought.substring(0, 97) + '...';
  } else {
    data.stats.shortThought = data.stats.internal_thought;
  }
  
  // Format name as initials for display
  if (data.characterName) {
    data.initials = data.characterName.split(' ').map(n => n[0]).join('');
  }
}
</script>
```

#### Example 4: Working with Arrays (Tabbed Templates)

```html
<script type="text/x-handlebars-template-logic">
// For tabbed templates, iterate over the characters array
if (data.characters && Array.isArray(data.characters)) {
  data.characters.forEach(char => {
    // Add a status indicator to each character
    if (char.stats) {
      const healthScore = char.stats.health || 0;
      const fatigueScore = char.stats.fatigue || 0;
      
      if (healthScore < 30 || fatigueScore > 80) {
        char.stats.needsAttention = true;
        char.stats.statusColor = "red";
      } else if (healthScore < 60 || fatigueScore > 60) {
        char.stats.needsAttention = false;
        char.stats.statusColor = "yellow";
      } else {
        char.stats.needsAttention = false;
        char.stats.statusColor = "green";
      }
    }
  });
  
  // Count characters needing attention
  data.attentionCount = data.characters.filter(c => c.stats && c.stats.needsAttention).length;
}
</script>
```

## Best Practices

### 1. Keep It Simple

Use bundled JavaScript for data transformation, not complex application logic:

```javascript
// GOOD: Simple calculations and flags
data.stats.isHealthy = data.stats.health > 50;

// BAD: Complex application logic
// Don't try to make API calls or manipulate the DOM
```

### 2. Always Check for Data

Always verify properties exist before using them:

```javascript
// GOOD
if (data.stats && data.stats.health !== undefined) {
  data.stats.healthPercentage = (data.stats.health / 100) * 100;
}

// BAD - might cause errors if health doesn't exist
data.stats.healthPercentage = (data.stats.health / 100) * 100;
```

### 3. Don't Modify Original Values Unless Necessary

Add new properties rather than modifying existing ones:

```javascript
// GOOD
data.stats.displayName = data.characterName.toUpperCase();

// RISKY (but sometimes necessary)
data.characterName = data.characterName.toUpperCase();
```

### 4. Return Is Automatic

The function automatically returns the data object. Don't add `return` statements:

```javascript
// GOOD
data.stats.isReady = true;

// UNNECESSARY (but harmless)
data.stats.isReady = true;
return data; // This is added automatically
```

## Error Handling

If your JavaScript throws an error:
- A toastr error notification will appear with the error message
- A console warning will be logged
- The template will render using the original, untransformed data

To debug, check the browser console for error messages.

## Security

The bundled JavaScript runs in a sandboxed `Function()` context with:
- No access to global variables (except standard JavaScript globals)
- No ability to manipulate the DOM directly
- No network access capabilities

This makes it safe to share templates, but also means you can't:
- Access SillyTavern functions directly
- Make AJAX requests
- Modify the page outside your template

## Template Examples

See the included example templates for working implementations:
- `example-bundled-js-simple.html` - Basic conditional flags
- `example-bundled-js-calculations.html` - Mathematical operations
- `example-bundled-js-tabbed.html` - Working with multiple characters

## Troubleshooting

**Template logic isn't working:**
- Check browser console for JavaScript errors
- Verify the script tag has the correct type attribute: `type="text/x-handlebars-template-logic"`
- Ensure your JavaScript syntax is valid

**Data properties are undefined:**
- Add defensive checks: `if (data.stats && data.stats.health)`
- Log the data object to see its structure: `console.log('Template data:', data);`

**Template renders but computed properties don't appear:**
- Make sure you're adding properties to the `data` object: `data.newProperty = value`
- For tabbed templates, add properties to individual character objects: `char.stats.newProperty = value`

## Complete Working Example

```html
<!-- POSITION: BOTTOM -->
<!-- CARD_TEMPLATE_START -->
<script type="text/x-handlebars-template-logic">
// Add comprehensive status assessment
if (data.stats) {
  const health = data.stats.health || 0;
  const fatigue = data.stats.fatigue || 0;
  
  // Calculate readiness score
  data.stats.readinessScore = Math.round((health - fatigue) / 2);
  
  // Determine status
  if (data.stats.readinessScore > 40) {
    data.stats.status = "Ready";
    data.stats.statusIcon = "✓";
    data.stats.statusColor = "#2ecc71";
  } else if (data.stats.readinessScore > 20) {
    data.stats.status = "Capable";
    data.stats.statusIcon = "◐";
    data.stats.statusColor = "#f39c12";
  } else {
    data.stats.status = "Needs Rest";
    data.stats.statusIcon = "⚠";
    data.stats.statusColor = "#e74c3c";
  }
}
</script>

<div class="sim-tracker-card" style="background: {{bgColor}}; padding: 15px; border-radius: 8px; margin: 10px;">
  <h3>{{characterName}}</h3>
  
  <div style="background: {{stats.statusColor}}; color: white; padding: 8px; border-radius: 4px; margin: 10px 0;">
    {{stats.statusIcon}} Status: {{stats.status}} (Score: {{stats.readinessScore}})
  </div>
  
  <div>
    <strong>Health:</strong> {{stats.health}}<br>
    <strong>Fatigue:</strong> {{stats.fatigue}}
  </div>
  
  {{#if stats.internal_thought}}
    <div style="font-style: italic; margin-top: 10px; padding: 8px; background: rgba(0,0,0,0.1); border-radius: 4px;">
      "{{stats.internal_thought}}"
    </div>
  {{/if}}
</div>
<!-- CARD_TEMPLATE_END -->
```

This will create a template that automatically assesses each character's readiness and displays a colored status indicator based on their health and fatigue levels.
