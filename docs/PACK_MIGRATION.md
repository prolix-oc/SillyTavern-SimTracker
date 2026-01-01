# Template Pack Migration Guide

This guide explains how to migrate existing template packs to the new Panel System architecture introduced in SST v2.x.

## Overview

The extension now uses a **Panel System** that groups tabs and cards together as unified units. This provides:
- Synchronized animations between tabs and cards
- Cleaner state management
- Support for custom tab implementations in templates

## Current Template Structure (Legacy)

Most existing templates separate tabs and cards into different containers:

```html
<div class="sim-tracker-container">
  <!-- Tabs in one container -->
  <div class="sim-tracker-tabs">
    <div class="sim-tracker-tab" data-character="0">...</div>
    <div class="sim-tracker-tab" data-character="1">...</div>
  </div>

  <!-- Cards in another container -->
  <div class="sim-tracker-cards-wrapper">
    <div class="sim-tracker-card" data-character="0">...</div>
    <div class="sim-tracker-card" data-character="1">...</div>
  </div>
</div>
```

**This structure is still supported** - the extension matches tabs to cards using:
1. The `data-character` attribute (preferred)
2. Array index as fallback

## Required: data-character Attribute

Ensure both tabs and cards have matching `data-character` attributes:

```html
<!-- Tab -->
<div class="sim-tracker-tab" data-character="{{@index}}">

<!-- Card -->
<div class="sim-tracker-card" data-character="{{@index}}">
```

This allows the Panel System to correctly pair tabs with their corresponding cards.

## CSS Class States

The extension applies these classes to manage panel visibility:

### Card Classes
| Class | Description |
|-------|-------------|
| `active` | Card is visible |
| `sliding-out` | Card is animating out (applied WITH `active` for CSS transition) |
| `tab-hidden` | Card is fully hidden |

### Tab Classes
| Class | Description |
|-------|-------------|
| `active` | Tab is selected |
| *(none)* | Tab is not selected |

Tabs do **not** receive `sliding-out` or `tab-hidden` - they're always visible. Style inactive tabs using the absence of `.active`.

## Required CSS for Animations

Your template CSS must handle these states:

```css
/* Card default state - hidden off-screen */
.sim-tracker-card {
  transform: translateX(100%);  /* or your preferred hidden position */
  opacity: 0;
  visibility: hidden;
  transition: transform 0.3s ease, opacity 0.3s ease, visibility 0.3s ease;
}

/* Card active state - visible */
.sim-tracker-card.active {
  transform: translateX(0);
  opacity: 1;
  visibility: visible;
}

/* Card exit animation - slides out */
.sim-tracker-card.sliding-out {
  transform: translateX(100%);
  opacity: 0;
  visibility: hidden;
}

/* Card fully hidden - no display */
.sim-tracker-card.tab-hidden {
  display: none !important;
}

/* Tab default state */
.sim-tracker-tab {
  transition: transform 0.3s ease;
}

/* Tab active state - moves with card */
.sim-tracker-tab.active {
  transform: translateX(-270px);  /* adjust to your card width */
}
```

## Animation Timing

The extension uses a **300ms** animation duration. Match this in your CSS transitions:

```css
transition: transform 0.3s ease, opacity 0.3s ease;
```

### Synchronized Exit Animation

When a user switches tabs, the exiting tab and card animate **simultaneously**:

1. **Exiting panel**: Both tab and card start their exit animations at the same time
   - Card receives `active` + `sliding-out` classes
   - Tab loses `active` class (triggers its return animation)
2. **After 300ms**: Card gets `tab-hidden` (display: none), animation complete

This ensures the tab button and card slide back together as a unified panel.

## Tab Interaction Types

Templates can specify how tabs behave using the `tabsType` field in the JSON config:

### Toggle Mode (default)
```json
{
  "tabsType": "toggle"
}
```

- **Click inactive tab** → Activates that panel (tab + card slide out)
- **Click active tab** → Deactivates that panel (tab + card retract)
- All panels start **inactive** (collapsed)
- Best for: Sidebar templates where users want to inspect one character at a time

### Switching Mode
```json
{
  "tabsType": "switching"
}
```

- **Click inactive tab** → Activates that panel, deactivates previous active
- **Click active tab** → Does nothing (already active)
- First panel starts **active** by default
- Best for: Traditional tab interfaces where one panel is always visible

### Unmanaged Mode
```json
{
  "tabsType": "unmanaged"
}
```

- **No JS click handlers** attached to tabs
- **No state classes** (`.active`, `.sliding-out`, `.tab-hidden`) applied
- Template handles all state management via CSS (radio button or checkbox hack)
- Best for: Template developers who want full creative control over tab behavior and animations

#### CSS Radio Button Pattern (Switching)
```handlebars
<style>
  .tab-radio { display: none; }
  .sim-tracker-card { display: none; }

  {{#each characters}}
  #tab-{{@index}}:checked ~ .cards .card-{{@index}} { display: block; }
  {{/each}}
</style>

{{#each characters}}
<input type="radio" name="tabs" id="tab-{{@index}}" {{#if @first}}checked{{/if}}>
{{/each}}

<div class="tabs">
  {{#each characters}}
  <label for="tab-{{@index}}">{{initials characterName}}</label>
  {{/each}}
</div>

<div class="cards">
  {{#each characters}}
  <div class="sim-tracker-card card-{{@index}}">...</div>
  {{/each}}
</div>
```

#### CSS Checkbox Pattern (Collapsible)
```handlebars
<style>
  .toggle { display: none; }
  .card-body { display: grid; grid-template-rows: 0fr; }
  .toggle:checked ~ .card-body { grid-template-rows: 1fr; }
</style>

{{#each characters}}
<div class="card">
  <input type="checkbox" id="toggle-{{@index}}" class="toggle" checked>
  <label for="toggle-{{@index}}">{{characterName}}</label>
  <div class="card-body"><div class="inner">...</div></div>
</div>
{{/each}}
```

### For Custom HTML Templates

Add an HTML comment to specify tab type:
```html
<!-- TABS_TYPE: toggle -->
<!-- TABS_TYPE: switching -->
<!-- TABS_TYPE: unmanaged -->
```

Note: The JSON `"tabsType"` field is preferred over HTML comments.

## Future: Grouped Panel Structure (Optional)

For cleaner templates, you can group tab+card pairs together. This is optional but recommended for new templates:

```html
<div class="sim-tracker-container">
  {{#each characters}}
  <div class="sim-tracker-panel" data-character="{{@index}}">
    <div class="sim-tracker-tab">...</div>
    <div class="sim-tracker-card">...</div>
  </div>
  {{/each}}
</div>
```

The extension will detect and support this structure in future versions.

## Migration Checklist

- [ ] Add `data-character="{{@index}}"` to all `.sim-tracker-tab` elements
- [ ] Add `data-character="{{@index}}"` to all `.sim-tracker-card` elements
- [ ] Ensure CSS handles `.active`, `.sliding-out`, and `.tab-hidden` classes on cards
- [ ] Ensure CSS handles `.active` class on tabs
- [ ] Verify transition duration is ~300ms for smooth animations
- [ ] Test tab switching to confirm both tab and card animate together
- [ ] (Optional) Add `"tabsType": "toggle"` or `"tabsType": "switching"` to template JSON

## Troubleshooting

### Tabs animate but cards don't (or vice versa)
- Check that `data-character` attributes match between tab and card pairs
- Verify CSS transitions are defined for both elements

### Exit animation doesn't play
- Ensure `.sliding-out` CSS keeps the element visible during transition
- The card should have both `.active` and `.sliding-out` during exit

### Cards disappear instantly
- Check that `.tab-hidden` uses `display: none` (final state after animation)
- Verify `.sliding-out` doesn't use `display: none`

## Questions?

Open an issue at the repository or check existing template packs for reference implementations.
