/**
 * String Utilities Example
 * Demonstrates text processing and manipulation features
 */

const StringUtils = require('../stringUtils');

console.log('=== String Utilities Examples ===\n');

// ============================================================================
// TEXT TRUNCATION
// ============================================================================
console.log('--- Text Truncation ---');
const longText = 'This is a very long text that needs to be truncated for display in a chat interface';
console.log('Original:', longText);
console.log('Truncated (30):', StringUtils.truncate(longText, 30));
console.log('Truncated (50, break words):', StringUtils.truncate(longText, 50, { breakWords: true }));
console.log('Custom ellipsis:', StringUtils.truncate(longText, 30, { ellipsis: '...' }));
console.log('');

// ============================================================================
// HTML AND MARKDOWN STRIPPING
// ============================================================================
console.log('--- HTML/Markdown Stripping ---');
const htmlText = '<p>Hello <b>world</b>! This is <em>important</em>.</p>';
const markdown = '**Bold text** and *italic text* with `code` and [link](url)';

console.log('HTML input:', htmlText);
console.log('Stripped:', StringUtils.stripHtml(htmlText));
console.log('');
console.log('Markdown input:', markdown);
console.log('Stripped:', StringUtils.stripMarkdown(markdown));
console.log('');

// ============================================================================
// FUZZY STRING MATCHING
// ============================================================================
console.log('--- Fuzzy String Matching (Levenshtein) ---');
const pairs = [
  ['hello', 'hello'],
  ['hello', 'hallo'],
  ['kitten', 'sitting'],
  ['Saturday', 'Sunday']
];

pairs.forEach(([str1, str2]) => {
  const distance = StringUtils.levenshtein(str1, str2);
  const similarity = StringUtils.similarity(str1, str2);
  console.log(`"${str1}" vs "${str2}": distance=${distance}, similarity=${similarity.toFixed(2)}`);
});
console.log('');

// ============================================================================
// CASE CONVERSIONS
// ============================================================================
console.log('--- Case Conversions ---');
const testString = 'hello-world-example';
console.log('Original:', testString);
console.log('camelCase:', StringUtils.toCamelCase(testString));
console.log('snake_case:', StringUtils.toSnakeCase(testString));
console.log('kebab-case:', StringUtils.toKebabCase(testString));
console.log('');

const sentence = 'the quick brown fox jumps over the lazy dog';
console.log('Original:', sentence);
console.log('Title Case:', StringUtils.toTitleCase(sentence));
console.log('');

// ============================================================================
// TEMPLATE INTERPOLATION
// ============================================================================
console.log('--- Template Interpolation ---');
const template = 'Hello {name}! You have {count} new messages from {sender}.';
const values = { name: 'John', count: 5, sender: 'Alice' };
console.log('Template:', template);
console.log('Values:', values);
console.log('Result:', StringUtils.template(template, values));
console.log('');

// XSS Protection
console.log('XSS Protection:');
const xssTemplate = 'User input: {userInput}';
const malicious = { userInput: '<script>alert("xss")</script>' };
console.log('Malicious input:', malicious.userInput);
console.log('Safe output:', StringUtils.template(xssTemplate, malicious));
console.log('');

// ============================================================================
// HTML ESCAPING
// ============================================================================
console.log('--- HTML Escaping ---');
const dangerous = '<script>alert("xss")</script>';
console.log('Original:', dangerous);
console.log('Escaped:', StringUtils.escapeHtml(dangerous));
console.log('Unescaped:', StringUtils.unescapeHtml('&lt;div&gt;Content&lt;/div&gt;'));
console.log('');

// ============================================================================
// SLUG GENERATION
// ============================================================================
console.log('--- URL Slug Generation ---');
const titles = [
  'Hello World!',
  'This is a Test',
  'Café François',
  'Multiple   Spaces   Here'
];

titles.forEach(title => {
  console.log(`"${title}" => "${StringUtils.slugify(title)}"`);
});
console.log('');

// ============================================================================
// URL AND EMAIL EXTRACTION
// ============================================================================
console.log('--- URL and Email Extraction ---');
const textWithLinks = 'Visit https://example.com or https://github.com for more info. Contact: user@example.com or admin@site.org';
console.log('Text:', textWithLinks);
console.log('URLs:', StringUtils.extractUrls(textWithLinks));
console.log('Emails:', StringUtils.extractEmails(textWithLinks));
console.log('');

// ============================================================================
// STRING VALIDATION
// ============================================================================
console.log('--- String Validation ---');
const testStrings = ['abc123', 'hello world', '12345', 'test@email'];
testStrings.forEach(str => {
  console.log(`"${str}" is alphanumeric: ${StringUtils.isAlphanumeric(str)}`);
});
console.log('');

console.log('Palindrome tests:');
['racecar', 'hello', 'A man a plan a canal Panama'].forEach(str => {
  console.log(`"${str}": ${StringUtils.isPalindrome(str)}`);
});
console.log('');

// ============================================================================
// WORD AND CHARACTER COUNTING
// ============================================================================
console.log('--- Word and Character Counting ---');
const textToCount = 'Hello world, this is a test message!';
console.log('Text:', textToCount);
console.log('Words:', StringUtils.wordCount(textToCount));
console.log('Characters:', StringUtils.charCount(textToCount));
console.log('Characters (no spaces):', StringUtils.charCount(textToCount, true));
console.log('');

// ============================================================================
// STRING MANIPULATION
// ============================================================================
console.log('--- String Manipulation ---');
console.log('Reverse "hello":', StringUtils.reverse('hello'));
console.log('Capitalize "hello":', StringUtils.capitalize('hello'));
console.log('Repeat "ha" 3 times:', StringUtils.repeat('ha', 3));
console.log('Repeat "ha" 3 times with separator:', StringUtils.repeat('ha', 3, '-'));
console.log('');

console.log('Padding:');
console.log('Left pad "5" to 3 digits:', StringUtils.pad('5', 3, { char: '0', side: 'left' }));
console.log('Right pad "hi" to 10:', StringUtils.pad('hi', 10, { char: '.', side: 'right' }));
console.log('Center pad "hi" to 10:', StringUtils.pad('hi', 10, { char: '-', side: 'both' }));
console.log('');

// ============================================================================
// RANDOM STRING GENERATION
// ============================================================================
console.log('--- Random String Generation ---');
console.log('Random (10 chars):', StringUtils.random(10));
console.log('Random with symbols:', StringUtils.random(12, { symbols: true }));
console.log('Random lowercase only:', StringUtils.random(10, { uppercase: false, numbers: false }));
console.log('Random numbers only:', StringUtils.random(8, { uppercase: false, lowercase: false }));
console.log('');

console.log('=== Examples Complete ===');
