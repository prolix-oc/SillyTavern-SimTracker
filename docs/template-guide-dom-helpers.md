# DOM Measurement Handlebars Helpers

SillySimTracker provides powerful Handlebars helpers that expose DOM measurements to your templates. This allows you to create dynamic, responsive layouts that adapt to the user's viewport and UI elements.

## Overview

These helpers provide real-time access to:
- Viewport dimensions
- Element positions and sizes
- Distances between elements
- Distances from elements to viewport edges
- Computed CSS styles

All measurements are cached for 100ms to ensure performance, and automatically update when the viewport changes (resize, orientation change).

## Available Helpers

### Viewport Measurements

#### `{{viewportWidth}}`
Returns the current viewport width in pixels.

**Example:**
```handlebars
<div style="width: {{viewportWidth}}px;">
  Full viewport width
</div>
```

#### `{{viewportHeight}}`
Returns the current viewport height in pixels.

**Example:**
```handlebars
<div style="max-height: {{subtract viewportHeight 100}}px;">
  Viewport height minus 100px
</div>
```

---

### Element Dimensions

#### `{{elementWidth selector}}`
Returns the width of an element in pixels.

**Parameters:**
- `selector` (string): CSS selector or element ID

**Example:**
```handlebars
<!-- Get width of sheld element -->
<div style="width: {{elementWidth "sheld"}}px;">
  Same width as sheld
</div>

<!-- Get width of chat element -->
<div style="width: {{elementWidth "#chat"}}px;">
  Same width as chat
</div>
```

#### `{{elementHeight selector}}`
Returns the height of an element in pixels.

**Example:**
```handlebars
<div style="height: {{elementHeight "sheld"}}px;">
  Same height as sheld
</div>
```

---

### Element Position

#### `{{elementTop selector}}`
Returns the distance from the element's top edge to the viewport top (in pixels).

**Example:**
```handlebars
<div style="top: {{elementTop "sheld"}}px;">
  Aligned with sheld top
</div>
```

#### `{{elementLeft selector}}`
Returns the distance from the element's left edge to the viewport left (in pixels).

#### `{{elementRight selector}}`
Returns the distance from the viewport left to the element's right edge (in pixels).

#### `{{elementBottom selector}}`
Returns the distance from the viewport top to the element's bottom edge (in pixels).

---

### Element Offset (Document Position)

#### `{{elementOffsetTop selector}}`
Returns the element's distance from the document top (includes scroll position).

#### `{{elementOffsetLeft selector}}`
Returns the element's distance from the document left (includes scroll position).

---

### Distance to Viewport Edges

#### `{{distanceToEdge selector edge}}`
Returns the distance from an element to a viewport edge in pixels.

**Parameters:**
- `selector` (string): CSS selector or element ID
- `edge` (string): Edge to measure to - "left", "right", "top", or "bottom"

**Example:**
```handlebars
<!-- Distance from sheld to right viewport edge -->
<div style="width: {{distanceToEdge "sheld" "right"}}px;">
  Space to the right of sheld
</div>

<!-- Distance from chat to left viewport edge -->
<div style="margin-left: {{distanceToEdge "#chat" "left"}}px;">
  Space to the left of chat
</div>
```

---

### Distance Between Elements

#### `{{distanceBetween selector1 selector2 type}}`
Returns the distance between two elements.

**Parameters:**
- `selector1` (string): First element selector
- `selector2` (string): Second element selector
- `type` (string): Distance type - "horizontal", "vertical", or "diagonal"

**Example:**
```handlebars
<!-- Horizontal distance between sheld and chat -->
<div style="width: {{distanceBetween "sheld" "#chat" "horizontal"}}px;">
  Gap between sheld and chat
</div>
```

---

### Specialized Sidebar Helpers

These helpers provide convenient shortcuts for common sidebar layout calculations.

#### `{{sheldSpaceLeft}}`, `{{sheldSpaceRight}}`, `{{sheldSpaceTop}}`, `{{sheldSpaceBottom}}`
Distance from sheld element to viewport edges.

**Example:**
```handlebars
<!-- Position sidebar in space to the left of sheld -->
<div style="width: {{sheldSpaceLeft}}px; position: fixed; left: 0;">
  Left sidebar
</div>
```

#### `{{chatSpaceLeft}}`, `{{chatSpaceRight}}`, `{{chatSpaceTop}}`, `{{chatSpaceBottom}}`
Distance from chat element to viewport edges.

#### `{{sidebarAvailableWidth side}}`
Calculates the maximum available width for a sidebar on the specified side.

**Parameters:**
- `side` (string): "left" or "right"

**Example:**
```handlebars
<!-- Calculate available width for left sidebar -->
<div style="width: {{subtract (sidebarAvailableWidth "left") 20}}px;">
  Left sidebar with 20px padding
</div>
```

#### `{{sidebarAvailableHeight}}`
Returns the available height for a sidebar (viewport height).

---

### Computed Styles

#### `{{elementStyle selector property}}`
Returns the computed CSS value for a property on an element.

**Parameters:**
- `selector` (string): CSS selector or element ID
- `property` (string): CSS property name (camelCase)

**Example:**
```handlebars
<!-- Get background color of sheld -->
<div style="background: {{elementStyle "sheld" "backgroundColor"}};">
  Same background as sheld
</div>

<!-- Get font size of chat -->
<div style="font-size: {{elementStyle "#chat" "fontSize"}};">
  Same font size as chat
</div>
```

---

### Element Existence Check

#### `{{elementExists selector}}`
Returns true if an element exists in the DOM.

**Example:**
```handlebars
{{#if (elementExists "sheld")}}
  <div>Sheld element exists!</div>
{{else}}
  <div>Sheld not found</div>
{{/if}}
```

---

## Complete Examples

### Responsive Sidebar Template

```handlebars
<!-- POSITION: LEFT -->
<!-- CARD_TEMPLATE_START -->
<div class="sim-tracker-sidebar" style="
  width: {{subtract (sidebarAvailableWidth 'left') 20}}px;
  max-width: 300px;
  height: {{sidebarAvailableHeight}}px;
  position: fixed;
  left: 10px;
  top: 0;
">
  <div class="tracker-card" style="
    background: {{bgColor}};
    padding: 15px;
    border-radius: 12px;
  ">
    <h3>{{characterName}}</h3>
    <p>Viewport: {{viewportWidth}}x{{viewportHeight}}</p>
    <p>Available width: {{sidebarAvailableWidth "left"}}px</p>
  </div>
</div>
<!-- CARD_TEMPLATE_END -->
```

### Positioned Template with Dynamic Width

```handlebars
<!-- POSITION: BOTTOM -->
<!-- CARD_TEMPLATE_START -->
<div class="sim-tracker-card" style="
  width: {{subtract (elementWidth '#chat') 40}}px;
  margin: 20px auto;
  background: {{bgColor}};
  padding: 20px;
  border-radius: 16px;
">
  <h2>{{characterName}}</h2>
  <div class="stats">
    <p>Affection: {{stats.ap}}</p>
    <p>Desire: {{stats.dp}}</p>
  </div>
  <small>Chat width: {{elementWidth "#chat"}}px</small>
</div>
<!-- CARD_TEMPLATE_END -->
```

### Using Math Helpers with DOM Measurements

```handlebars
<!-- Calculate a width that's 80% of available space -->
<div style="width: {{multiply (sidebarAvailableWidth 'right') 0.8}}px;">
  80% of available right space
</div>

<!-- Calculate padding based on viewport -->
<div style="padding: {{divide viewportWidth 100}}px;">
  Padding scales with viewport
</div>

<!-- Center element with calculated margin -->
<div style="
  width: 250px;
  margin-left: {{divide (subtract (sidebarAvailableWidth 'left') 250) 2}}px;
">
  Centered in available space
</div>
```

### Conditional Layouts Based on Space

```handlebars
{{#if (gt (sidebarAvailableWidth "left") 250)}}
  <!-- Wide sidebar layout -->
  <div style="width: 250px;">
    Full width sidebar with all details
  </div>
{{else}}
  <!-- Narrow sidebar layout -->
  <div style="width: {{sidebarAvailableWidth 'left'}}px;">
    Compact sidebar
  </div>
{{/if}}
```

---

## Performance Considerations

1. **Caching**: All DOM measurements are cached for 100ms to prevent excessive DOM queries
2. **Automatic Updates**: The cache is automatically cleared and measurements refreshed when:
   - Viewport is resized
   - Device orientation changes
   - Template is manually refreshed

3. **Debouncing**: Viewport change events are debounced (250ms) to prevent excessive re-renders

---

## Common Selectors

Here are commonly used selectors in SillyTavern:

| Element | Selector | Description |
|---------|----------|-------------|
| Sheld (sidebar) | `sheld` or `#sheld` | Left sidebar container |
| Chat area | `#chat` | Main chat message area |
| Send form | `#send_form` | Message input form |
| Text area | `#send_textarea` | Message text input |
| Messages | `.mes` | Individual message blocks |
| Message text | `.mes_text` | Message content area |
| Left nav panel | `#left-nav-panel` | Left navigation panel |
| Right nav panel | `#right-nav-panel` | Right navigation panel |

---

## Tips and Best Practices

1. **Use Math Helpers**: Combine DOM helpers with math helpers (`add`, `subtract`, `multiply`, `divide`) for flexible calculations

2. **Add Padding/Margins**: Always subtract padding/margins from calculated widths to prevent overflow:
   ```handlebars
   width: {{subtract (sidebarAvailableWidth "left") 20}}px;
   ```

3. **Set Max Widths**: Use `max-width` to prevent elements from becoming too wide on large screens:
   ```handlebars
   width: {{sidebarAvailableWidth "left"}}px;
   max-width: 300px;
   ```

4. **Check Element Existence**: Use `elementExists` before relying on measurements from optional elements

5. **Viewport-Relative Sizing**: Calculate sizes as percentages of viewport for responsive designs:
   ```handlebars
   width: {{multiply viewportWidth 0.25}}px; /* 25% of viewport */
   ```

---

## Troubleshooting

### Measurements Return 0

**Cause**: Element doesn't exist or hasn't been rendered yet

**Solution**: 
- Check the selector is correct
- Use `{{elementExists selector}}` to verify element exists
- Ensure template loads after DOM is ready

### Layout Breaks on Resize

**Cause**: Fixed pixel values don't update automatically

**Solution**: The system automatically refreshes templates on viewport changes, but ensure you're using the helpers correctly and not hardcoding values.

### Performance Issues

**Cause**: Too many DOM queries or complex calculations

**Solution**:
- Measurements are already cached
- Avoid nesting too many calculations
- Use simpler selectors when possible

---

## Related Documentation

- [Template Guide: Non-Tabbed Sidebar](template-guide-non-tabbed-sidebar.md)
- [Template Guide: Positioned Cards](template-guide-positioned-cards.md)
- [Template Guide: Bundled JavaScript](template-guide-bundled-javascript.md)
