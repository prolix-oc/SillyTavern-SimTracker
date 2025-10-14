# Template Creation Guide: Positioned Card Templates

This guide explains how to create positioned card templates for the SillySimTracker extension, using the "Dating Sim Tracker (Top of Message)" template as a reference.

## Overview

Positioned card templates display character information cards above or below chat messages, integrating directly into the message flow. These cards are responsive, supporting multiple screen sizes with adaptive layouts. This template type is ideal for rich, visually prominent character displays that don't occupy sidebar space.

---

## Template Structure

### 1. HTML File Structure

Your HTML template file should follow this structure:

```html
<!-- TEMPLATE NAME: Your Template Name -->
<!-- AUTHOR: Your Name -->
<!-- POSITION: TOP or BOTTOM -->

<!-- CARD_TEMPLATE_START -->
<style>
  /* Your CSS styles here */
  /* Include responsive media queries */
</style>

<div class="card-container">
  <div class="tracker-card">
    <!-- Card content -->
  </div>
</div>
<!-- CARD_TEMPLATE_END -->

<!-- 
TEMPLATE VARIABLES:
List all available variables here
-->
```

**Important Header Comments:**
- `TEMPLATE NAME`: Display name for your template
- `AUTHOR`: Your name or organization
- `POSITION`: Must be `TOP` or `BOTTOM` for positioned templates
- The markers `CARD_TEMPLATE_START` and `CARD_TEMPLATE_END` are **required**

---

## 2. Key CSS Concepts for Positioned Cards

### Container Structure

```css
/* Container for multiple cards */
.sst-card-container {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: center;
  align-items: start;
  width: 100%;
}
```

**Key Points:**
- Use `flex-wrap: wrap` to allow cards to flow to next line
- Center cards with `justify-content: center`
- Use `gap` for consistent spacing between cards

### Base Card Styling

```css
.tracker-card {
  min-width: 320px;
  border-radius: 16px;
  padding: 0;
  box-sizing: border-box;
  position: relative;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
  backdrop-filter: blur(12px) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2), 
              0 1px 4px rgba(0, 0, 0, 0.1), 
              inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
}
```

**Important Properties:**
- `!important` flags ensure styles aren't overridden by parent themes
- `backdrop-filter` creates glassmorphism effect
- Multiple `box-shadow` layers create depth
- `border-radius` for modern, polished look

### Responsive Breakpoints

```css
/* Mobile Styles (up to 768px) */
@media (max-width: 768px) {
  .tracker-card {
    width: 100%;
    max-width: 100%;
    min-height: 400px;
  }
  
  .stat-icon { font-size: 20px !important; }
  .stat-value { font-size: 16px !important; }
}

/* Desktop Styles (769px - 1399px) */
@media (min-width: 769px) {
  .tracker-card {
    flex: 1 1 calc(50% - 10px);
    max-width: calc(50% - 10px);
    min-width: 300px;
    height: 400px;
  }
  
  .stat-icon { font-size: 28px !important; }
  .stat-value { font-size: 20px !important; }
}

/* Large Screen Styles (1400px+) */
@media (min-width: 1400px) {
  .tracker-card {
    flex: 1 1 600px;
    max-width: 600px;
    height: 400px;
  }
  
  .stat-icon { font-size: 32px !important; }
  .stat-value { font-size: 24px !important; }
}
```

**Responsive Strategy:**
- Mobile: Single column, full width
- Desktop: 2-column layout with calc()
- Large screens: Fixed max-width for optimal readability

### Absolute Positioning for Sections

```css
/* Header at top */
.tracker-card-header {
  padding: 16px 20px 0 20px;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  flex-direction: column;
}

/* Stats in middle - absolute positioned */
.stats-container {
  position: absolute;
  top: 115px;
  bottom: 110px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  flex-wrap: nowrap;
}

/* Thought bubble at bottom - absolute positioned */
.thought-bubble {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 16px;
  min-height: 60px;
}
```

**Why Absolute Positioning:**
- Ensures consistent layout regardless of content length
- Prevents content shifting
- Allows fixed card heights

### Change Indicators

```css
.change-indicator {
  position: absolute;
  top: -8px;
  right: -8px;
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  min-width: 24px;
  text-align: center;
  line-height: 1.2;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  animation: pulse 0.5s ease-in-out;
}

.change-indicator.positive {
  background: rgba(46, 204, 113, 0.9) !important;
}

.change-indicator.negative {
  background: rgba(231, 76, 60, 0.9) !important;
}

@keyframes pulse {
  0% { transform: scale(0.8); opacity: 0.7; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
```

---

## 3. Handlebars Template Syntax

### Single Card Structure

```handlebars
<div class="sst-card-container">
  <div class="tracker-card {{#if stats.inactive}}inactive{{/if}}" 
    style="background: linear-gradient(145deg, 
      {{bgColor}} 0%, 
      {{darkerBgColor}} 50%, 
      {{darkerBgColor}} 100%);">
    
    <div class="gradient-overlay"></div>
    
    <!-- Header content -->
    <!-- Stats content -->
    <!-- Thought bubble -->
  </div>
</div>
```

### Header with Multiple Rows

```handlebars
<div class="tracker-card-header">
  <!-- Row 1: Date and counters -->
  <div class="header-row-top">
    <div class="header-badge">{{currentDate}}</div>
    <div style="display: flex; gap: 8px;">
      <div class="header-badge">Day {{stats.days_since_first_meeting}}</div>
      {{#if stats.preg}}<div class="header-badge">🤰{{stats.days_preg}}d</div>{{/if}}
    </div>
  </div>
  
  <!-- Row 2: Character name and icons -->
  <div class="header-row-middle">
    <div class="character-name">{{characterName}}</div>
    <div class="icon-container">
      {{#if healthIcon}}<span>{{healthIcon}}</span>{{/if}}
      {{#if stats.inactive}}
        {{#if (eq stats.inactiveReason 1)}}<span>😴</span>{{/if}}
        {{#if (eq stats.inactiveReason 2)}}<span>🏥</span>{{/if}}
      {{/if}}
      <span>{{reactionEmoji}}</span>
    </div>
  </div>
  
  <!-- Row 3: Status text -->
  <div class="header-row-bottom">
    <div class="character-status">
      {{#if stats.relationshipStatus}}<span>{{stats.relationshipStatus}}</span>{{/if}}
      {{#if stats.desireStatus}}<span class="status-divider">|</span><span>{{stats.desireStatus}}</span>{{/if}}
    </div>
  </div>
</div>
```

### Stats with Change Indicators

```handlebars
<div class="stats-container">
  <div class="stat-item">
    <div class="stat-title">AFFECTION</div>
    <div class="stat-container">
      <div class="stat-icon">❤️</div>
      <div class="stat-value">{{stats.ap}}</div>
      {{#if stats.apChange}}{{#unless (eq stats.apChange 0)}}
      <div class="change-indicator positive">
        {{#if (gt stats.apChange 0)}}+{{/if}}{{stats.apChange}}
      </div>
      {{/unless}}{{/if}}
    </div>
  </div>
  
  <!-- Repeat for other stats -->
</div>
```

**Conditional Change Display:**
- Only show if `apChange` exists
- Don't show if change is 0
- Add `+` prefix for positive changes
- Use different colors for positive/negative

### Inactive Reason Icons

```handlebars
{{#if stats.inactive}}
  {{#if (eq stats.inactiveReason 1)}}<span>😴</span>{{/if}}
  {{#if (eq stats.inactiveReason 2)}}<span>🏥</span>{{/if}}
  {{#if (eq stats.inactiveReason 3)}}<span>😡</span>{{/if}}
  {{#if (eq stats.inactiveReason 4)}}<span>🫠</span>{{/if}}
  {{#if (eq stats.inactiveReason 5)}}<span>🪦</span>{{/if}}
{{/if}}
```

---

## 4. JSON Configuration File

### Complete Structure

```json
{
  "templateName": "Your Template (Position)",
  "templateAuthor": "Your Name",
  "templatePosition": "TOP",
  "htmlTemplate": "<!-- Complete HTML as escaped string -->",
  "sysPrompt": "## YOUR TRACKING MODE...",
  "customFields": [
    {
      "key": "ap",
      "description": "Affection Points"
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

### Position Values

- `"TOP"` - Cards appear above chat messages
- `"BOTTOM"` - Cards appear below chat messages
- `"LEFT"` / `"RIGHT"` - Sidebar positions (see other guides)

---

## 5. System Prompt Creation

Positioned templates use the same system prompt structure as sidebar templates. Key sections:

### Output Order

```markdown
### Output Rules

1. **Order**: Narrative → Tracker → Sim codeblock (NEVER omit sim codeblock)
2. **Multi-Character**: Generate ONE card per active character
3. **Performance**: Max 4 active characters
```

### Stat Tracking

```markdown
**Change Tracking** (from user's most recent action):
- apChange, dpChange, tpChange, cpChange: Numeric change (+/-/0)

These changes appear as animated badges on the cards.
```

---

## 6. Available Template Variables

### Core Data
- `{{characterName}}` - Character's name
- `{{currentDate}}` - Current date (YYYY-MM-DD)

### Colors
- `{{bgColor}}` - Primary background (hex)
- `{{darkerBgColor}}` - Darker variant
- `{{contrastColor}}` - Text contrast color

### Stats
- `{{stats.ap}}` - Affection (0-200)
- `{{stats.dp}}` - Desire (0-150)
- `{{stats.tp}}` - Trust (0-150)
- `{{stats.cp}}` - Contempt (0-150)

### Changes (Critical for positioned templates)
- `{{stats.apChange}}` - Last affection change
- `{{stats.dpChange}}` - Last desire change
- `{{stats.tpChange}}` - Last trust change
- `{{stats.cpChange}}` - Last contempt change

### Status
- `{{stats.days_since_first_meeting}}` - Day counter
- `{{stats.internal_thought}}` - Character thoughts
- `{{stats.relationshipStatus}}` - Status text
- `{{stats.desireStatus}}` - Desire text
- `{{stats.inactive}}` - Inactive boolean
- `{{stats.inactiveReason}}` - Reason code (0-5)
- `{{stats.preg}}` - Pregnancy boolean
- `{{stats.days_preg}}` - Days pregnant

### Icons
- `{{healthIcon}}` - Health emoji (🤕 or 💀)
- `{{reactionEmoji}}` - Reaction (👍, 👎, 😐)

---

## 7. Responsive Design Strategies

### Mobile-First Approach

```css
/* Base styles for mobile */
.tracker-card {
  width: 100%;
  min-height: 400px;
}

.stat-container {
  min-height: 70px;
  padding: 6px 3px;
}

/* Then enhance for larger screens */
@media (min-width: 769px) {
  .tracker-card {
    width: calc(50% - 10px);
    height: 400px;
  }
  
  .stat-container {
    min-height: 90px;
    padding: 10px 6px;
  }
}
```

### Dynamic Text Sizing

```css
.stat-title {
  font-size: 8px;
}

@media (min-width: 769px) {
  .stat-title {
    font-size: 10px !important;
  }
}

@media (min-width: 1400px) {
  .stat-title {
    font-size: 11px !important;
  }
}
```

### Flexible Layouts

```css
.stats-container {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: nowrap; /* Keep stats in single row */
}

.stat-item {
  flex: 1;
  min-width: 60px;
  max-width: 120px;
}
```

---

## 8. Advanced Styling Techniques

### Glassmorphism Effect

```css
.tracker-card {
  backdrop-filter: blur(12px) !important;
  background: linear-gradient(145deg, 
    rgba(106, 90, 205, 0.9),
    rgba(80, 70, 180, 0.85)
  ) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.2), 
    0 1px 4px rgba(0, 0, 0, 0.1), 
    inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
}
```

### Gradient Overlays

```css
.gradient-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, 
    transparent, 
    rgba(255, 255, 255, 0.1), 
    transparent) !important;
}
```

### Hover Effects

```css
.stat-container {
  transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
  background: rgba(255, 255, 255, 0.05) !important;
}

.stat-container:hover {
  background: rgba(255, 255, 255, 0.12) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 
              inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
}
```

---

## 9. Best Practices for Positioned Cards

### Layout Considerations

✅ **Do:**
- Use fixed heights for consistency (e.g., 400px)
- Implement responsive breakpoints
- Center cards in their container
- Allow 2-column layout on desktop
- Use absolute positioning for fixed sections

❌ **Don't:**
- Make cards too tall (max 500px recommended)
- Forget mobile optimization
- Use variable heights based on content
- Create overly complex layouts
- Ignore tablet breakpoints

### Visual Hierarchy

✅ **Do:**
- Make character name largest element
- Use color coding for different stats
- Provide clear visual separation between sections
- Use consistent icon sizes within breakpoints
- Implement smooth transitions

❌ **Don't:**
- Crowd too much information
- Use too many different font sizes
- Make interactive elements too small
- Forget sufficient contrast ratios

### Performance

✅ **Do:**
- Use CSS transforms for animations
- Limit backdrop-filter usage
- Optimize for 4 or fewer cards
- Use `will-change` only when animating
- Minimize DOM depth

❌ **Don't:**
- Animate multiple expensive properties
- Use heavy blur values (>15px)
- Create deeply nested structures
- Include large unoptimized assets

---

## 10. Testing Checklist

- [ ] **Single Character**: Card displays correctly at all breakpoints
- [ ] **Multiple Characters**: 2, 3, and 4 cards layout properly
- [ ] **Mobile (< 768px)**: Cards stack vertically, full width
- [ ] **Tablet (768-1399px)**: 2-column layout works
- [ ] **Desktop (1400px+)**: Cards don't exceed max-width
- [ ] **Change Indicators**: Badges appear and animate correctly
- [ ] **Inactive States**: Opacity/overlay applies as expected
- [ ] **Missing Data**: Template handles undefined values
- [ ] **Long Text**: Names and thoughts don't overflow
- [ ] **Color Variations**: Works with different bgColor values
- [ ] **Thought Bubble**: Displays at bottom without overlapping stats
- [ ] **Icons**: All status icons render correctly

---

## 11. Common Issues and Solutions

### Issue: Cards Not Centering

**Problem:** Cards align to one side instead of center

**Solution:**
```css
.sst-card-container {
  display: flex;
  justify-content: center;
  align-items: start;
  width: 100%;
}
```

### Issue: Stats Overlapping

**Problem:** Stats container overlaps header or thought bubble

**Solution:**
```css
.stats-container {
  position: absolute;
  top: 115px; /* Below header */
  bottom: 110px; /* Above thought bubble */
  /* Adjust values based on your header/footer heights */
}

/* Adjust in media queries */
@media (max-width: 768px) {
  .stats-container {
    top: 100px !important;
    bottom: 110px !important;
  }
}
```

### Issue: Change Indicator Not Visible

**Problem:** Badge doesn't appear or is hidden

**Solution:**
```css
.stat-container {
  position: relative; /* Required for absolute child */
}

.change-indicator {
  position: absolute;
  top: -8px;
  right: -8px;
  z-index: 10; /* Above other elements */
}
```

### Issue: Text Too Small on Mobile

**Problem:** Text unreadable on small screens

**Solution:**
```css
@media (max-width: 768px) {
  .character-name {
    font-size: 22px !important;
  }
  
  .stat-value {
    font-size: 16px !important;
  }
  
  .stat-title {
    font-size: 9px !important;
  }
}
```

### Issue: Cards Different Heights

**Problem:** Multi-character cards have inconsistent heights

**Solution:**
```css
.tracker-card {
  height: 400px; /* Fixed height on desktop */
}

@media (max-width: 768px) {
  .tracker-card {
    min-height: 400px; /* Allow flexibility on mobile */
  }
}
```

---

## 12. Example: Complete Card

```handlebars
<div class="sst-card-container">
  <div class="tracker-card {{#if stats.inactive}}inactive{{/if}}" 
    style="background: linear-gradient(145deg, 
      {{bgColor}} 0%, 
      {{darkerBgColor}} 50%, 
      {{darkerBgColor}} 100%);">
    
    <div class="gradient-overlay"></div>
    
    <!-- Header -->
    <div class="tracker-card-header">
      <div class="header-row-top">
        <div class="header-badge">{{currentDate}}</div>
        <div style="display: flex; gap: 8px;">
          <div class="header-badge">Day {{stats.days_since_first_meeting}}</div>
          {{#if stats.preg}}<div class="header-badge">🤰{{stats.days_preg}}d</div>{{/if}}
        </div>
      </div>
      
      <div class="header-row-middle">
        <div class="character-name">{{characterName}}</div>
        <div class="icon-container">
          {{#if healthIcon}}<span>{{healthIcon}}</span>{{/if}}
          <span>{{reactionEmoji}}</span>
        </div>
      </div>
      
      <div class="header-row-bottom">
        <div class="character-status">
          {{#if stats.relationshipStatus}}<span>{{stats.relationshipStatus}}</span>{{/if}}
          {{#if stats.desireStatus}}<span class="status-divider">|</span><span>{{stats.desireStatus}}</span>{{/if}}
        </div>
      </div>
    </div>
    
    <!-- Stats -->
    <div class="stats-container">
      <div class="stat-item">
        <div class="stat-title">AFFECTION</div>
        <div class="stat-container">
          <div class="stat-icon">❤️</div>
          <div class="stat-value">{{stats.ap}}</div>
          {{#if stats.apChange}}{{#unless (eq stats.apChange 0)}}
          <div class="change-indicator positive">
            {{#if (gt stats.apChange 0)}}+{{/if}}{{stats.apChange}}
          </div>
          {{/unless}}{{/if}}
        </div>
      </div>
      
      <!-- Repeat for other stats -->
    </div>
    
    <!-- Thought Bubble -->
    <div class="thought-label-divider"></div>
    <div class="thought-bubble">
      <div class="thought-label">{{characterName}} thinks:</div>
      <div style="font-size: 22px; flex-shrink: 0;">💭</div>
      <div style="flex: 1; font-size: 13px; font-weight: 400; line-height: 1.4; overflow: hidden;">
        {{stats.internal_thought}}
      </div>
    </div>
  </div>
</div>
```

---

## 13. Accessibility Considerations

### Color Contrast

Ensure sufficient contrast ratios:

```css
/* Light text on dark backgrounds */
.character-name {
  color: #ffffff; /* White text */
}

.stat-value {
  color: rgba(255, 255, 255, 0.95);
}

/* Add text shadows for readability */
.character-status {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
```

### Touch Targets

On mobile, ensure interactive elements are large enough:

```css
@media (max-width: 768px) {
  .stat-container {
    min-height: 70px; /* Minimum 44px recommended */
    min-width: 60px;
  }
}
```

### Semantic HTML

Use meaningful HTML structure:

```html
<div role="region" aria-label="Character Status">
  <h2 class="character-name">{{characterName}}</h2>
  <!-- Content -->
</div>
```

---

## 14. Animation Guidelines

### Entrance Animations

```css
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.tracker-card {
  animation: slideIn 0.3s ease-out;
}
```

### Change Indicator Pulse

```css
@keyframes pulse {
  0% { 
    transform: scale(0.8); 
    opacity: 0.7; 
  }
  50% { 
    transform: scale(1.1); 
    opacity: 1; 
  }
  100% { 
    transform: scale(1); 
    opacity: 1; 
  }
}

.change-indicator {
  animation: pulse 0.5s ease-in-out;
}
```

### Hover Transitions

```css
.stat-container {
  transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.stat-container:hover {
  transform: translateY(-2px);
}
```

---

## 15. Additional Resources

- **Reference Implementation**: `dating-card-template-positioned.html`
- **Configuration Example**: `dating-card-template-positioned.json`
- **System Prompt**: See JSON file for complete AI instructions
- **Related Guides**:
  - Tabbed sidebar templates for alternative layouts
  - Non-tabbed sidebar templates for simpler designs

---

## Quick Start Template

Minimal positioned card template:

```html
<!-- TEMPLATE NAME: My Positioned Tracker -->
<!-- AUTHOR: Your Name -->
<!-- POSITION: TOP -->

<!-- CARD_TEMPLATE_START -->
<style>
.sst-card-container {
  display: flex;
  justify-content: center;
  gap: 20px;
  width: 100%;
}

.tracker-card {
  min-width: 320px;
  height: 400px;
  border-radius: 16px;
  padding: 20px;
  position: relative;
  color: #fff;
}

.character-name {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 20px;
}

@media (min-width: 769px) {
  .tracker-card {
    flex: 1 1 calc(50% - 10px);
    max-width: calc(50% - 10px);
  }
}
</style>

<div class="sst-card-container">
  <div class="tracker-card" 
    style="background: {{bgColor}};">
    <div class="character-name">{{characterName}}</div>
    <div>Day {{stats.days_since_first_meeting}}</div>
    <div>Affection: {{stats.ap}}</div>
  </div>
</div>
<!-- CARD_TEMPLATE_END -->
```

---

## Summary

Positioned card templates provide:

- **Responsive layouts** across all screen sizes
- **Rich visual presentation** with modern effects
- **Change tracking** with animated indicators
- **Multi-character support** with flexible grids
- **Integration** directly in message flow

Key success factors:

1. Implement proper responsive breakpoints
2. Use absolute positioning for consistent layouts
3. Test across all screen sizes
4. Optimize for performance
5. Maintain accessibility standards

Happy template creating!
