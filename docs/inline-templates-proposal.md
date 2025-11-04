# Inline Templates - Implementation Proposal

## Overview
Inline templates allow inserting pre-designed HTML elements mid-message using special syntax that the LLM can invoke.

## Syntax
```
[[DISPLAY=templateName, DATA={param1: "value1", param2: "value2"}]]
```

## Example Use Case
```
The mysterious caller left a message on your phone.

[[DISPLAY=phone, DATA={name: "Unknown Number", textContent: "I have your dog. Meet me at the docks at midnight."}]]

What do you do?
```

## Template Structure

### JSON Template with Inline Support
```json
{
  "templateName": "Mystery Game Template",
  "templateAuthor": "Developer",
  "templatePosition": "BOTTOM",
  "inlineTemplatesEnabled": true,
  "inlineTemplates": [
    {
      "insertName": "phone",
      "insertPurpose": "Display a phone message notification",
      "parameters": ["name", "textContent", "time"],
      "htmlContent": "<div class='sst-inline-phone' style='background: #1a1a1a; border-radius: 12px; padding: 16px; margin: 12px 0; max-width: 400px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);'><div style='display: flex; align-items: center; margin-bottom: 8px;'><span style='font-size: 24px; margin-right: 12px;'>📱</span><div><div style='font-weight: bold; color: #fff;'>{{name}}</div><div style='font-size: 12px; color: #888;'>{{time}}</div></div></div><div style='color: #ddd; line-height: 1.4;'>{{textContent}}</div></div>"
    },
    {
      "insertName": "email",
      "insertPurpose": "Display an email preview",
      "parameters": ["from", "subject", "preview"],
      "htmlContent": "<div class='sst-inline-email' style='background: #f5f5f5; border-left: 4px solid #4285f4; padding: 16px; margin: 12px 0; max-width: 500px;'><div style='font-weight: bold; color: #202124; margin-bottom: 4px;'>{{from}}</div><div style='font-weight: 600; color: #5f6368; margin-bottom: 8px;'>{{subject}}</div><div style='color: #5f6368; font-size: 14px;'>{{preview}}</div></div>"
    },
    {
      "insertName": "note",
      "insertPurpose": "Display a handwritten note or letter",
      "parameters": ["content", "signature"],
      "htmlContent": "<div class='sst-inline-note' style='background: #fef9e7; border: 1px solid #f4e7c3; padding: 20px; margin: 12px 0; max-width: 450px; font-family: \"Courier New\", monospace; box-shadow: 2px 2px 6px rgba(0,0,0,0.1);'><div style='white-space: pre-wrap; color: #2c3e50; margin-bottom: 16px;'>{{content}}</div>{{#if signature}}<div style='text-align: right; font-style: italic; color: #7f8c8d;'>- {{signature}}</div>{{/if}}</div>"
    }
  ],
  "htmlTemplate": "<!-- Regular card template HTML -->"
}
```

## Implementation Architecture

### 1. Detection Module (`inlineTemplates.js`)
- Export `processInlineTemplates(messageElement, templateConfig)`
- Regex-based detection: `/\[\[DISPLAY=([^,\]]+),\s*DATA=({[^}]+})\]\]/g`
- Compile inline templates with Handlebars
- Replace markers with rendered HTML

### 2. Integration Points
- **Primary**: `CHARACTER_MESSAGE_RENDERED` event
- **Secondary**: MutationObserver for streaming support
- **Fallback**: Manual refresh via settings

### 3. LLM Support
- New macro: `{{available_inlines}}`
- Generates markdown list of available inline templates
- Include in system prompt when enabled

### 4. Settings
- Checkbox: "Enable Inline Templates"
- Only active when current template has `inlineTemplatesEnabled: true`
- Template dropdown shows "(Inline Support)" badge

## Error Handling

### Invalid Syntax
```javascript
// Graceful degradation - show error placeholder
try {
  const data = JSON.parse(dataJSON);
  // ... render template
} catch (error) {
  console.warn(`[SST] Invalid inline template data:`, error);
  return `<span style="color: red; font-style: italic;">[Invalid inline template: ${displayName}]</span>`;
}
```

### Missing Template
```javascript
if (!template) {
  console.warn(`[SST] Inline template not found: ${displayName}`);
  return `<span style="color: orange; font-style: italic;">[Unknown template: ${displayName}]</span>`;
}
```

## Performance Considerations

### Caching Strategy
```javascript
// Cache compiled templates
const inlineTemplateCache = new Map();

function getCompiledInlineTemplate(templateName, htmlContent) {
  const cacheKey = `${templateName}:${hashCode(htmlContent)}`;
  
  if (!inlineTemplateCache.has(cacheKey)) {
    inlineTemplateCache.set(cacheKey, Handlebars.compile(htmlContent));
  }
  
  return inlineTemplateCache.get(cacheKey);
}
```

### Lazy Processing
- Only scan messages that contain `[[` characters
- Skip processing if `inlineTemplatesEnabled: false`
- Debounce during streaming

## Testing Scenarios

1. **Basic Replacement**: Single inline template in message
2. **Multiple Inlines**: Multiple different templates in one message
3. **Nested Data**: Complex JSON objects in DATA parameter
4. **Streaming**: Templates appearing during LLM generation
5. **Template Switching**: Changing templates with inline elements in history
6. **Error Cases**: Invalid JSON, missing templates, malformed syntax

## Documentation Needs

1. **User Guide**: How to use inline templates
2. **Developer Guide**: How to create inline template packs
3. **Prompt Examples**: How to instruct LLM to use inlines
4. **Migration Guide**: Converting standalone templates to inline-enabled

## Example Prompt Addition

```markdown
## Inline Visual Elements

You have access to inline visual elements that can be embedded in your responses:

{{available_inlines}}

Use these sparingly and only when they enhance the narrative. For example:

- When a character receives a text message or email
- When the player finds a note or letter
- When displaying UI elements like inventory items or status effects

Always ensure the inline element data is valid JSON within the DATA parameter.
```

## Backwards Compatibility

- Existing templates without `inlineTemplates` array continue working normally
- Inline processing only triggers when explicitly enabled
- Old messages without inline syntax render unchanged
- Feature can be completely disabled via settings toggle

## Future Enhancements

1. **Dynamic Parameters**: Support for Handlebars helpers in inline templates
2. **Interactive Elements**: Click handlers for inline elements
3. **Animation Support**: CSS animations for inline insertions
4. **Theme Integration**: Inline templates respect active ST theme
5. **Template Marketplace**: Share inline template packs

## Risk Assessment

### Low Risk ✅
- Optional feature with toggle
- Isolated module
- Graceful error handling
- Backwards compatible

### Medium Risk ⚠️
- Regex performance on large chats
- LLM might misuse syntax
- Template complexity for developers

### Mitigation
- Implement caching
- Provide clear LLM examples
- Create template wizard tool
- Comprehensive error messages

## Recommendation

**Proceed with implementation** as a Phase 2 feature after current inline template support is stable. Start with:

1. Basic detection and replacement
2. Simple template structure
3. Limited inline types (3-5 templates)
4. Thorough testing
5. User feedback collection

Then expand based on community usage and feedback.
