# Template Creation Guide: Tabbed Sidebar Templates

This guide explains how to create tabbed sidebar templates for the SillySimTracker extension, using the "Dating Sim Tracker (Left w/ Tabs)" template as a reference.

## Overview

Tabbed sidebar templates create interactive cards that slide in from the left or right edge of the screen. Multiple character cards are represented by tabs that users can click to switch between characters. This template type is ideal for multi-character scenarios where screen space is limited.

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
  <!-- Your HTML structure here -->
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
- The markers `CARD_TEMPLATE_START` and `CARD_TEMPLATE_END` are **required** for the extension to identify template boundaries

---

## 2. Key CSS Concepts for Tabbed Sidebars

### Container Structure

```css
.sim-tracker-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  position: relative;
  height: 100%;
  pointer-events: none; /* Container doesn't block interactions */
}
```

### Tab System

**Tab Container:**
```css
.sim-tracker-tabs {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: absolute;
  left: 0; /* For LEFT position; use 'right: 0' for RIGHT */
  top: 0;
  bottom: 0;
  justify-content: center;
  height: 100%;
  z-index: 10; /* Behind cards */
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  pointer-events: auto; /* Tabs are clickable */
}
```

**Individual Tabs:**
```css
.sim-tracker-tab {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  transform: translateX(-60px); /* Hidden by default (LEFT position) */
  z-index: 10;
  pointer-events: auto;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.sim-tracker-tab.active {
  transform: translateX(270px); /* Slide to aligned position */
  z-index: 20; /* Above inactive tabs */
}
```

**Key Points:**
- Each tab should have `data-character="{{@index}}"` attribute for JavaScript interactivity
- Use `transform: translateX()` for smooth animations
- Active tabs should have higher z-index values
- For RIGHT position, use positive translateX for hidden state, negative for active

### Card System

**Card Styling:**
```css
.sim-tracker-card {
  background: linear-gradient(145deg, #2c2c2c, #1a1a1a);
  border-radius: 18px;
  padding: 20px;
  width: 270px;
  position: absolute;
  left: 0; /* For LEFT position */
  top: 50%;
  transform: translateY(-50%) translateX(-100%); /* Hidden off-screen */
  opacity: 0;
  visibility: hidden;
  z-index: 5;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.sim-tracker-card.active {
  transform: translateY(-50%) translateX(0); /* Visible position */
  opacity: 1;
  visibility: visible;
  z-index: 30; /* Above all tabs */
}
```

**Animation States:**
```css
.sim-tracker-card.sliding-in {
  transform: translateY(-50%) translateX(0);
  opacity: 1;
  visibility: visible;
  z-index: 30;
}

.sim-tracker-card.sliding-out {
  transform: translateY(-50%) translateX(-300px);
  opacity: 0;
  visibility: hidden;
  z-index: 5;
}
```

### Inactive Character Overlay

For characters marked as inactive:

```css
.narrative-inactive-overlay {
  position: absolute;
  top: -5px;
  left: -5px;
  width: calc(100% + 10px);
  height: calc(100% + 10px);
  background-color: black;
  opacity: 0.5;
  border-radius: 18px;
  display: none;
  z-index: 100; /* Above all card content */
  pointer-events: none;
}

.narrative-inactive .narrative-inactive-overlay {
  display: block;
}
```

---

## 3. Handlebars Template Syntax

### Iterating Over Characters

```handlebars
{{#each characters}}
  <!-- Content for each character -->
  <div class="character-card" data-character="{{@index}}">
    <h2>{{characterName}}</h2>
    <p>{{stats.internal_thought}}</p>
  </div>
{{/each}}
```

**Built-in Variables:**
- `{{@index}}`: Current iteration index (0-based)
- `{{characterName}}`: Character's name
- `{{currentDate}}`: Current date (YYYY-MM-DD)

### Conditional Rendering

```handlebars
{{#if stats.inactive}}
  <div class="inactive-indicator">💤</div>
{{else}}
  <div class="active-indicator">Active</div>
{{/if}}

{{#if (gt stats.ap 70)}}
  <span>😊</span>
{{else if (gt stats.ap 40)}}
  <span>😐</span>
{{else}}
  <span>😞</span>
{{/if}}
```

### Available Helper Functions

**Comparison Helpers:**
- `{{#if (gt value1 value2)}}` - Greater than
- `{{#if (eq value1 value2)}}` - Equals
- `{{#if (lt value1 value2)}}` - Less than

**Math Helpers:**
- `{{divide value divisor}}` - Division
- `{{divideRoundUp value divisor}}` - Division with ceiling
- `{{multiply value multiplier}}` - Multiplication

**Custom Helpers:**
- `{{initials characterName}}` - Extracts initials (e.g., "John Doe" → "JD")
- `{{adjustColorBrightness color percentage}}` - Adjusts color brightness

### Dynamic Styling with Variables

```handlebars
<div style="background: linear-gradient(145deg, 
  {{adjustColorBrightness bgColor 70}} 0%, 
  {{adjustColorBrightness darkerBgColor 60}} 50%, 
  {{adjustColorBrightness darkerBgColor 50}} 100%);">
</div>
```

### Progress Bars Example

```handlebars
<div class="stat-bar-bg">
  <div class="stat-bar-fill" 
    style="width: {{#if (gt stats.ap 200)}}100{{else}}{{#if stats.ap}}{{divide stats.ap 2}}{{else}}0{{/if}}{{/if}}%;">
  </div>
</div>
```

---

## 4. JSON Configuration File

Your template needs a corresponding JSON file with the same base name:

```json
{
  "templateName": "Your Template Name",
  "templateAuthor": "Your Name",
  "templatePosition": "LEFT",
  "htmlTemplate": "<!-- Entire HTML content as escaped string -->",
  "sysPrompt": "System prompt for AI...",
  "customFields": [
    {
      "key": "ap",
      "description": "Affection Points (0-200)"
    }
  ],
  "extSettings": {
    "codeBlockIdentifier": "sim",
    "defaultBgColor": "#6a5acd",
    "showThoughtBubble": true,
    "hideSimBlocks": true,
    "templateFile": "your-template.html"
  }
}
```

### Key JSON Properties

**Required Fields:**
- `templateName`: Display name
- `templateAuthor`: Creator name
- `templatePosition`: "LEFT", "RIGHT", or "TOP"
- `htmlTemplate`: Complete HTML template as string
- `sysPrompt`: System prompt for AI character behavior
- `customFields`: Array of tracked data fields
- `extSettings`: Extension-specific settings

**Custom Fields Structure:**
Each field needs:
```json
{
  "key": "field_name",
  "description": "Human-readable description"
}
```

**Extension Settings:**
- `codeBlockIdentifier`: Identifier for AI output blocks (e.g., "sim")
- `defaultBgColor`: Default background color (hex)
- `showThoughtBubble`: Whether to show character thoughts
- `hideSimBlocks`: Whether to hide code blocks in chat
- `templateFile`: Name of the HTML file

---

## 5. System Prompt Creation

The system prompt instructs the AI on how to track and update character stats.

### Key Sections

**1. Core Objective:**
```markdown
## DATING SIM MODE

**Objective**: Prioritize narrative reality for relationship updates. 
Analyze context to determine current date (YYYY-MM-DD) and time (24h format). 
Update trackers when events occur.
```

**2. Output Rules:**
```markdown
### Output Rules

1. **Order**: Narrative → Tracker → Sim codeblock (NEVER omit sim codeblock)
2. **Multi-Character**: Generate ONE card per active character
3. **Performance**: Max 4 active characters
```

**3. Define Stats:**
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
```

**4. Status Trackers:**
```markdown
**Inactive Status** (`inactive: true/false`):
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
```

---

## 6. Available Template Variables

### Character Data
- `{{characterName}}` - Character's name
- `{{currentDate}}` - Current date (YYYY-MM-DD format)

### Color Variables
- `{{bgColor}}` - Primary background color (hex)
- `{{darkerBgColor}}` - Darker variant of background
- `{{contrastColor}}` - Text contrast color

### Stats Variables
- `{{stats.ap}}` - Affection points (0-200)
- `{{stats.dp}}` - Desire points (0-150)
- `{{stats.tp}}` - Trust points (0-150)
- `{{stats.cp}}` - Contempt points (0-150)

### Change Tracking
- `{{stats.apChange}}` - Affection change (+/-)
- `{{stats.dpChange}}` - Desire change (+/-)
- `{{stats.tpChange}}` - Trust change (+/-)
- `{{stats.cpChange}}` - Contempt change (+/-)

### Status Variables
- `{{stats.days_since_first_meeting}}` - Day counter
- `{{stats.preg}}` - Pregnancy status (boolean)
- `{{stats.days_preg}}` - Days pregnant
- `{{stats.internal_thought}}` - Character's thoughts
- `{{stats.relationshipStatus}}` - Text status
- `{{stats.desireStatus}}` - Desire text status
- `{{stats.inactive}}` - Inactive state (boolean)
- `{{stats.inactiveReason}}` - Reason code (0-5)

### Display Variables
- `{{healthIcon}}` - Health icon (🤕 or 💀)
- `{{reactionEmoji}}` - Reaction (👍, 👎, 😐)
- `{{showThoughtBubble}}` - Show/hide thoughts

---

## 7. Z-Index Hierarchy (Critical!)

For tabbed sidebars to work correctly:

```
Inactive cards: z-index: 5
Tabs (inactive): z-index: 10
Tabs (active): z-index: 20
Inactive cards (when displayed): z-index: 25
Active card: z-index: 30
Inactive overlay: z-index: 100
```

**Why This Matters:**
- Active cards must cover all tabs
- Inactive tab overlays must cover all card content
- Tabs must be clickable when cards are hidden

---

## 8. Best Practices

### Performance
- Limit to 4 active characters maximum
- Use CSS transforms instead of position changes for animations
- Use `will-change` property sparingly

### Accessibility
- Ensure sufficient color contrast
- Make clickable areas large enough (min 44x44px)
- Use semantic HTML where possible

### Responsiveness
- Test on multiple screen sizes
- Consider mobile layouts
- Use relative units (rem, em) for text

### Animation
- Use cubic-bezier easing for smooth transitions
- Keep animations under 500ms
- Provide visual feedback for interactions

---

## 9. Testing Your Template

1. **Validate HTML**: Ensure no unclosed tags
2. **Test JavaScript Integration**: Verify `data-character` attributes
3. **Check Z-Index**: Confirm proper layering
4. **Test Animations**: Verify smooth transitions
5. **Multi-Character**: Test with 1, 2, 3, and 4 characters
6. **Inactive States**: Test with inactive characters
7. **Color Variations**: Test with different background colors

---

## 10. Common Pitfalls

❌ **Don't:**
- Use fixed positioning without accounting for sidebar position
- Forget `pointer-events: none` on container
- Use inconsistent z-index values
- Omit transition properties
- Hard-code character-specific data

✅ **Do:**
- Use relative positioning within cards
- Set `pointer-events: auto` on interactive elements
- Follow the z-index hierarchy
- Include smooth transitions
- Use template variables for all dynamic data

---

## Example: Complete Tab Element

```handlebars
{{#each characters}}
<div
  class="sim-tracker-tab"
  data-character="{{@index}}"
  style="background: linear-gradient(145deg, 
    {{adjustColorBrightness bgColor 70}} 0%, 
    {{adjustColorBrightness darkerBgColor 60}} 50%, 
    {{adjustColorBrightness darkerBgColor 50}} 100%);"
>
  <div
    class="tab-initials"
    style="background: linear-gradient(145deg, 
      {{adjustColorBrightness bgColor 90}} 0%, 
      {{adjustColorBrightness bgColor 70}} 100%);"
  >
    {{initials characterName}}
  </div>
</div>
{{/each}}
```

---

## Additional Resources

- See `dating-card-template-sidebar-left-tabs.html` for complete reference
- Review `dating-card-template-sidebar-left-tabs.json` for full configuration
- Test with
