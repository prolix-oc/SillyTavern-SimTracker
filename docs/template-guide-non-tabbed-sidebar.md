# Template Creation Guide: Non-Tabbed Sidebar Templates

This guide explains how to create non-tabbed sidebar templates for the SillySimTracker extension, using the "Dating Sim Tracker (Left, Single)" template as a reference.

## Overview

Non-tabbed sidebar templates display character cards in a vertical stack on the left or right side of the screen. Unlike tabbed templates, all active character cards are visible simultaneously, stacked vertically. This template type is ideal for scenarios with 1-2 characters where you want all information visible at once.

---

## Template Structure

### 1. HTML File Structure

Your HTML template file should follow this structure:

```html
<!-- TEMPLATE NAME: Your Template Name -->
<!-- AUTHOR: Your Name -->
<!-- POSITION: LEFT or RIGHT -->

<!-- CARD_TEMPLATE_START -->
<style>
  /* Your CSS styles here */
</style>

<div class="your-container-class">
  <!-- Single card structure - no tabs -->
  <div class="your-card-class">
    <!-- Card content -->
  </div>
</div>
<!-- CARD_TEMPLATE_END -->

<!-- 
TEMPLATE VARIABLES:
List all available variables here as documentation
-->
```

**Important Header Comments:**
- `TEMPLATE NAME`: Display name for your template
- `AUTHOR`: Your name or organization
- `POSITION`: Must be `LEFT` or `RIGHT` for sidebar templates
- The markers `CARD_TEMPLATE_START` and `CARD_TEMPLATE_END` are **required**

---

## 2. Key CSS Concepts for Non-Tabbed Sidebars

### Container Structure

```css
.sim-tracker-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  pointer-events: none; /* Container doesn't block chat interactions */
}
```

**Key Points:**
- Use `flex-direction: column` to stack cards vertically
- Add `gap` for spacing between multiple cards
- Set `pointer-events: none` on container so clicks pass through to chat

### Card Styling

```css
.sim-tracker-card {
  background: linear-gradient(145deg, #2c2c2c, #1a1a1a);
  border-radius: 18px;
  padding: 20px;
  width: 100%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
```

**Important Properties:**
- `width: 100%` - Card fills the sidebar width
- `position: relative` - Allows absolute positioning of child elements
- `backdrop-filter` - Creates frosted glass effect
- `transition` - Smooth animations for hover/state changes

### Inactive Character State

For characters marked as inactive, reduce opacity:

```css
.sim-tracker-card.inactive {
  opacity: 0.6;
}
```

Alternatively, you can add a visual overlay:

```css
.sim-tracker-card.inactive::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 18px;
  pointer-events: none;
}
```

### Progress Bar Styling

```css
.stat-bar-bg {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}
```

### Thought Bubble

```css
.thought-bubble {
  margin-top: 20px;
  padding: 15px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
```

---

## 3. Handlebars Template Syntax

### Single Card (No Iteration)

Non-tabbed templates typically render one card per character without the `{{#each}}` loop wrapper at the container level:

```handlebars
<div class="sim-tracker-container">
  <div class="sim-tracker-card {{#if stats.inactive}}inactive{{/if}}"
    style="background: linear-gradient(145deg, 
      {{adjustColorBrightness bgColor 70}} 0%, 
      {{adjustColorBrightness darkerBgColor 60}} 50%, 
      {{adjustColorBrightness darkerBgColor 50}} 100%);">
    
    <div class="character-header">
      <div class="character-name">{{characterName}}</div>
      <div class="status-indicator">
        {{#if stats.inactive}}
          💤
        {{else}}
          {{#if (gt stats.ap 70)}}😊{{else if (gt stats.ap 40)}}😐{{else}}😞{{/if}}
        {{/if}}
      </div>
    </div>
    
    <!-- Rest of card content -->
  </div>
</div>
```

**Note:** The extension's rendering engine handles creating multiple instances of this template for multi-character scenarios.

### Conditional Content Display

```handlebars
<!-- Show thought bubble only if content exists -->
{{#if stats.internal_thought}}
<div class="thought-bubble">
  <div style="display: flex; align-items: flex-start; gap: 10px">
    <div style="font-size: 1.2em; flex-shrink: 0">💭</div>
    <div style="font-size: 0.95em; line-height: 1.4; color: rgba(255, 255, 255, 0.85);">
      <strong>Thinks:</strong> {{stats.internal_thought}}
    </div>
  </div>
</div>
{{/if}}
```

### Dynamic Status Indicators

```handlebars
<div class="status-indicator">
  {{#if stats.inactive}}
    💤
  {{else}}
    {{#if (gt stats.ap 70)}}
      😊
    {{else if (gt stats.ap 40)}}
      😐
    {{else}}
      😞
    {{/if}}
  {{/if}}
</div>
```

### Progress Bar with Percentage Calculation

```handlebars
<!-- Affection (0-200 scale, display as 0-100%) -->
<div class="stat-bar-bg">
  <div class="stat-bar-fill" 
    style="width: {{#if (gt stats.ap 200)}}100{{else}}{{#if stats.ap}}{{divide stats.ap 2}}{{else}}0{{/if}}{{/if}}%; 
           background: linear-gradient(90deg, #ff9a9e, #fad0c4);">
  </div>
</div>

<!-- Trust (0-150 scale, display as 0-100%) -->
<div class="stat-bar-bg">
  <div class="stat-bar-fill" 
    style="width: {{#if (gt stats.tp 150)}}100{{else}}{{#if stats.tp}}{{divideRoundUp stats.tp 1.5}}{{else}}0{{/if}}{{/if}}%; 
           background: linear-gradient(90deg, #84fab0, #8fd3f4);">
  </div>
</div>
```

---

## 4. JSON Configuration File

### Complete Structure

```json
{
  "templateName": "Your Template Name (Position)",
  "templateAuthor": "Your Name",
  "templatePosition": "LEFT",
  "htmlTemplate": "<!-- Complete HTML as escaped string -->",
  "sysPrompt": "## YOUR TRACKING MODE\n\n...",
  "customFields": [
    {
      "key": "ap",
      "description": "Affection Points (0-200)"
    },
    {
      "key": "dp",
      "description": "Desire Points (0-150)"
    }
  ],
  "extSettings": {
    "codeBlockIdentifier": "sim",
    "defaultBgColor": "#6a5acd",
    "showThoughtBubble": true,
    "hideSimBlocks": true,
    "templateFile": "your-template-name.html"
  }
}
```

### Template Position Values

- `"LEFT"` - Cards appear on the left side
- `"RIGHT"` - Cards appear on the right side
- `"TOP"` - Cards appear above messages (see positioned template guide)

### Custom Fields Array

Define all stats and properties you want tracked:

```json
"customFields": [
  {
    "key": "ap",
    "description": "Affection Points (0-200)"
  },
  {
    "key": "apChange",
    "description": "Change in Affection from last action"
  },
  {
    "key": "relationshipStatus",
    "description": "Relationship status text"
  },
  {
    "key": "internal_thought",
    "description": "Character's current internal thoughts"
  },
  {
    "key": "inactive",
    "description": "Boolean for character inactivity"
  },
  {
    "key": "inactiveReason",
    "description": "Reason code (0-5)"
  }
]
```

---

## 5. System Prompt Creation

The system prompt guides the AI's behavior for tracking stats.

### Essential Sections

**1. Mode Declaration:**
```markdown
## DATING SIM MODE

**Objective**: Prioritize narrative reality for relationship updates. 
Analyze context to determine current date (YYYY-MM-DD) and time (24h format). 
Update trackers when events occur. Check for `sim` codeblocks containing JSON/YAML.
```

**2. Output Order:**
```markdown
### Output Rules

1. **Order**: Narrative → Tracker → Sim codeblock (NEVER omit sim codeblock)
2. **Multi-Character**: Generate ONE card per active character, track separately
3. **Performance**: Max 4 active characters, collapse inactive, preserve all states
```

**3. Stat Definitions:**
```markdown
### Relationship Meters

**Affection (AP)**: 0-200 - Romantic feelings toward {{user}}
- 0-30: Strangers
- 31-60: Acquaintances
- 61-90: Good Friends
- 91-120: Romantic Interest
- 121-150: Going Steady
- 151-180: Committed Relationship
- 181-200: Devoted Partner

**Desire (DP)**: 0-150 - Sexual attraction
- 0-25: Not feeling the heat
- 26-50: A smoldering flame builds
- 51-75: Starting to feel warm
- 76-100: Body's burning up!
- 101-125: A desperate need presents
- 126-150: Pliable in the lustful hunger

**Trust (TP)**: 0-150 - Trust in {{user}}. Higher = admits faults, believes you.

**Contempt (CP)**: 0-150 - Disdain toward {{user}}. Rises when harmed/hurt.
```

**4. Status Tracking:**
```markdown
### Status Trackers

**Change Tracking** (from user's most recent action):
- apChange, dpChange, tpChange, cpChange: Numeric change (+/-/0)

**Health**: 0=Unharmed, 1=Injured, 2=Critical

**Reaction**: 0=Neutral (😐), 1=Like (👍), 2=Dislike (👎)

**Inactive Status**:
- 0: Not inactive
- 1: Asleep (😴)
- 2: Comatose (🏥)
- 3: Contempt/anger (😡)
- 4: Incapacitated (🫠)
- 5: Death (🪦)
```

**5. Critical Enforcement:**
```markdown
## Critical Enforcement

**Position Lock**:
- Narrative FIRST
- Tracker cards AFTER narrative
- Sim codeblock LAST
- NEVER exclude sim codeblock

**Data Correction**:
- If ANY data missing from previous sim block, add it and continue
- Never leave data empty/unavailable
- JSON block at message end is mission critical
```

---

## 6. Available Template Variables

### Core Variables
- `{{characterName}}` - Character's display name
- `{{currentDate}}` - Current in-game date (YYYY-MM-DD)

### Color Theming
- `{{bgColor}}` - Primary background color (hex)
- `{{darkerBgColor}}` - Darker shade for gradients
- `{{contrastColor}}` - Text color for contrast

### Relationship Stats
- `{{stats.ap}}` - Affection points (0-200)
- `{{stats.dp}}` - Desire points (0-150)
- `{{stats.tp}}` - Trust points (0-150)
- `{{stats.cp}}` - Contempt points (0-150)

### Stat Changes
- `{{stats.apChange}}` - Last affection change
- `{{stats.dpChange}}` - Last desire change
- `{{stats.tpChange}}` - Last trust change
- `{{stats.cpChange}}` - Last contempt change

### Status Indicators
- `{{stats.days_since_first_meeting}}` - Day counter
- `{{stats.internal_thought}}` - Character's thoughts
- `{{stats.relationshipStatus}}` - Text status (e.g., "Going Steady")
- `{{stats.desireStatus}}` - Desire description text
- `{{stats.inactive}}` - Boolean inactive flag
- `{{stats.inactiveReason}}` - Numeric reason (0-5)

### Optional Stats
- `{{stats.preg}}` - Pregnancy boolean
- `{{stats.days_preg}}` - Days pregnant
- `{{stats.health}}` - Health status (0-2)
- `{{healthIcon}}` - Health emoji (🤕 or 💀)
- `{{reactionEmoji}}` - Reaction emoji (👍, 👎, 😐)

---

## 7. Layout Best Practices

### Spacing and Hierarchy

```css
/* Clear visual hierarchy */
.character-header {
  margin-bottom: 18px;
}

.character-name {
  font-size: 1.3em;
  font-weight: 600;
}

.stats-container {
  display: flex;
  flex-direction: column;
  gap: 16px; /* Consistent spacing between stats */
}

.status-container {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05); /* Visual separation */
}
```

### Responsive Considerations

```css
/* Ensure readability on all screen sizes */
.sim-tracker-card {
  min-width: 250px;
  max-width: 350px;
}

@media (max-width: 768px) {
  .sim-tracker-card {
    padding: 16px;
  }
  
  .character-name {
    font-size: 1.2em;
  }
}
```

### Typography

```css
.stat-header {
  font-size: 0.9em;
  color: rgba(255, 255, 255, 0.7); /* Muted for less important text */
}

.relationship-status,
.desire-status {
  font-size: 0.95em;
  color: rgba(255, 255, 255, 0.9);
}
```

---

## 8. Common Layout Patterns

### Header with Day Counter

```handlebars
<div class="days-counter" 
  style="text-align: left; 
         font-style: italic; 
         color: rgba(255, 255, 255, 0.8); 
         font-size: 1em; 
         margin-bottom: 15px; 
         padding-bottom: 10px; 
         border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
  Day {{stats.days_since_first_meeting}}
</div>
```

### Stats Grid Layout

```handlebars
<div class="stats-container">
  <!-- Affection -->
  <div class="stat-item">
    <div class="stat-header">
      <span>Affection</span>
      <span>{{stats.ap}}</span>
    </div>
    <div class="stat-bar-bg">
      <div class="stat-bar-fill" 
        style="width: {{divide stats.ap 2}}%; 
               background: linear-gradient(90deg, #ff9a9e, #fad0c4);">
      </div>
    </div>
  </div>
  
  <!-- Add more stats here -->
</div>
```

### Status Display

```handlebars
<div class="status-container">
  <div class="relationship-status">
    <strong>Relationship:</strong> {{stats.relationshipStatus}}
  </div>
  <div class="desire-status">
    <strong>Desire:</strong> {{stats.desireStatus}}
  </div>
</div>
```

---

## 9. Best Practices

### Visual Design

✅ **Do:**
- Use consistent spacing (multiples of 4px or 8px)
- Maintain clear visual hierarchy
- Use gradient backgrounds for depth
- Include subtle borders and shadows
- Ensure text has sufficient contrast

❌ **Don't:**
- Overcrowd with too much information
- Use overly bright or clashing colors
- Make cards too wide (max 350px recommended)
- Forget hover states for interactive elements

### Performance

✅ **Do:**
- Use CSS transforms for animations
- Limit to 2-3 active cards in sidebar
- Use `will-change` sparingly and only when animating
- Optimize images and use modern formats

❌ **Don't:**
- Animate too many properties simultaneously
- Use heavy filters on large elements
- Create deeply nested DOM structures
- Include large uncompressed images

### Accessibility

✅ **Do:**
- Ensure color contrast meets WCAG AA standards
- Use semantic HTML where appropriate
- Provide text alternatives for icons
- Test with different font sizes

---

## 10. Testing Checklist

- [ ] **Single Character**: Card displays correctly
- [ ] **Multiple Characters**: Cards stack properly with correct spacing
- [ ] **Inactive State**: Opacity or overlay applies correctly
- [ ] **Missing Data**: Template handles undefined values gracefully
- [ ] **Long Names**: Text doesn't overflow containers
- [ ] **All Stats**: Progress bars calculate percentages correctly
- [ ] **Responsive**: Layout works on mobile and desktop
- [ ] **Color Themes**: Works with light and dark character colors
- [ ] **Thought Bubble**: Displays/hides based on content
- [ ] **Status Text**: All status variations render properly

---

## 11. Common Issues and Solutions

### Issue: Card Too Narrow/Wide

**Problem:** Card doesn't fit the sidebar properly

**Solution:**
```css
.sim-tracker-card {
  width: 100%; /* Fill available width */
  max-width: 320px; /* Prevent excessive width */
  min-width: 250px; /* Maintain minimum usability */
}
```

### Issue: Text Overflow

**Problem:** Long character names or thoughts overflow

**Solution:**
```css
.character-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thought-bubble {
  word-wrap: break-word;
  overflow-wrap: break-word;
}
```

### Issue: Progress Bar Not Showing

**Problem:** Bar appears empty even with value

**Solution:**
```handlebars
<!-- Always check for value existence and provide fallback -->
<div style="width: {{#if stats.ap}}{{divide stats.ap 2}}{{else}}0{{/if}}%;">
</div>
```

### Issue: Colors Too Dark/Light

**Problem:** Text unreadable on certain backgrounds

**Solution:**
```css
/* Use semi-transparent backgrounds */
background: rgba(255, 255, 255, 0.05);

/* Add text shadows for readability */
text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);

/* Ensure contrast */
color: rgba(255, 255, 255, 0.9);
```

---

## 12. Example: Complete Card Structure

```handlebars
<div class="sim-tracker-container">
  <div class="sim-tracker-card {{#if stats.inactive}}inactive{{/if}}"
    style="background: linear-gradient(145deg, 
      {{adjustColorBrightness bgColor 70}} 0%, 
      {{adjustColorBrightness darkerBgColor 60}} 50%, 
      {{adjustColorBrightness darkerBgColor 50}} 100%);">
    
    <!-- Day Counter -->
    <div class="days-counter">
      Day {{stats.days_since_first_meeting}}
    </div>
    
    <!-- Header -->
    <div class="character-header">
      <div class="character-name">{{characterName}}</div>
      <div class="status-indicator">
        {{#if stats.inactive}}💤{{else}}😊{{/if}}
      </div>
    </div>
    
    <!-- Stats -->
    <div class="stats-container">
      <div class="stat-item">
        <div class="stat-header">
          <span>Affection</span>
          <span>{{stats.ap}}</span>
        </div>
        <div class="stat-bar-bg">
          <div class="stat-bar-fill" 
            style="width: {{divide stats.ap 2}}%; 
                   background: linear-gradient(90deg, #ff9a9e, #fad0c4);">
          </div>
        </div>
      </div>
    </div>
    
    <!-- Status -->
    <div class="status-container">
      <div class="relationship-status">
        <strong>Relationship:</strong> {{stats.relationshipStatus}}
      </div>
    </div>
    
    <!-- Thought Bubble -->
    {{#if stats.internal_thought}}
    <div class="thought-bubble">
      <div style="display: flex; gap: 10px;">
        <div>💭</div>
        <div>{{stats.internal_thought}}</div>
      </div>
    </div>
    {{/if}}
  </div>
</div>
```

---

## Additional Resources

- Reference: `dating-card-template-sidebar-left.html`
- Configuration: `dating-card-template-sidebar-left.json`
- Compare with tabbed version for advanced features
- See positioned template guide for message-integrated layouts

---

## Quick Start Template

Use this minimal template as a starting point:

```html
<!-- TEMPLATE NAME: My Simple Tracker -->
<!-- AUTHOR: Your Name -->
<!-- POSITION: LEFT -->

<!-- CARD_TEMPLATE_START -->
<style>
.sim-tracker-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.sim-tracker-card {
  background: linear-gradient(145deg, #2c2c2c, #1a1a1a);
  border-radius: 18px;
  padding: 20px;
  width: 100%;
}

.character-name {
  font-size: 1.3em;
  font-weight: 600;
  margin-bottom: 15px;
}
</style>

<div class="sim-tracker-container">
  <div class="sim-tracker-card">
    <div class="character-name">{{characterName}}</div>
    <div>Affection: {{stats.ap}}</div>
  </div>
</div>
<!-- CARD_TEMPLATE_END -->
```

Build from this foundation and add features as needed!
